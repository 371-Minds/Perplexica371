import SessionManager from '@/lib/session';
import { TextBlock } from '@/lib/types';
import db from '@/lib/db';
import { messages } from '@/lib/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import {
  CEO_SYSTEM_PROMPT,
  CFO_SYSTEM_PROMPT,
  CTO_SYSTEM_PROMPT,
  CLO_SYSTEM_PROMPT,
} from '@/lib/prompts/csuite';
import { McpManager } from '@/lib/mcp/McpManager';
import { CSuiteAgentInput, SubAgentReport } from './types';

class CSuiteAgent {
  private async runSubAgent(
    systemPrompt: string,
    query: string,
    config: CSuiteAgentInput['config'],
  ): Promise<string> {
    const stream = config.llm.streamText({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
    });

    let output = '';
    for await (const chunk of stream) {
      output += chunk.contentChunk;
    }
    return output;
  }

  async searchAsync(session: SessionManager, input: CSuiteAgentInput) {
    const exists = await db.query.messages.findFirst({
      where: and(
        eq(messages.chatId, input.chatId),
        eq(messages.messageId, input.messageId),
      ),
    });

    if (!exists) {
      await db.insert(messages).values({
        chatId: input.chatId,
        messageId: input.messageId,
        backendId: session.id,
        query: input.followUp,
        createdAt: new Date().toISOString(),
        status: 'answering',
        responseBlocks: [],
      });
    } else {
      await db
        .delete(messages)
        .where(
          and(eq(messages.chatId, input.chatId), gt(messages.id, exists.id)),
        )
        .execute();
      await db
        .update(messages)
        .set({
          status: 'answering',
          backendId: session.id,
          responseBlocks: [],
        })
        .where(
          and(
            eq(messages.chatId, input.chatId),
            eq(messages.messageId, input.messageId),
          ),
        )
        .execute();
    }

    const mcp = new McpManager();

    const researchBlockId = crypto.randomUUID();
    session.emitBlock({
      id: researchBlockId,
      type: 'research',
      data: {
        subSteps: [
          {
            id: crypto.randomUUID(),
            type: 'reasoning',
            reasoning:
              'CEO Agent is analyzing the request and delegating to CFO, CTO, and CLO sub-agents…',
          },
        ],
      },
    });

    try {
      await mcp.connectAll();
    } catch {
      // MCP servers are optional; proceed without them if unavailable
    }

    const subReports: SubAgentReport[] = [];

    const [cfoReport, ctoReport, cloReport] = await Promise.all([
      this.runSubAgent(
        CFO_SYSTEM_PROMPT(),
        `Regarding the following query, provide a focused financial analysis:\n\n${input.followUp}`,
        input.config,
      ),
      this.runSubAgent(
        CTO_SYSTEM_PROMPT(),
        `Regarding the following query, provide a focused technical analysis:\n\n${input.followUp}`,
        input.config,
      ),
      this.runSubAgent(
        CLO_SYSTEM_PROMPT(),
        `Regarding the following query, provide a focused legal and compliance analysis:\n\n${input.followUp}`,
        input.config,
      ),
    ]);

    subReports.push({ role: 'cfo', label: 'CFO Report', content: cfoReport });
    subReports.push({ role: 'cto', label: 'CTO Report', content: ctoReport });
    subReports.push({ role: 'clo', label: 'CLO Report', content: cloReport });

    session.emit('data', { type: 'researchComplete' });

    const subReportContext = subReports
      .map((r) => `[${r.label}]:\n${r.content}`)
      .join('\n\n---\n\n');

    const systemInstructionsSection = input.config.systemInstructions
      ? `\n\n### User Instructions\n${input.config.systemInstructions}`
      : '';

    const synthesisPrompt = `${CEO_SYSTEM_PROMPT()}

<sub_agent_reports>
${subReportContext}
</sub_agent_reports>
${systemInstructionsSection}`;

    const answerStream = input.config.llm.streamText({
      messages: [
        { role: 'system', content: synthesisPrompt },
        ...input.chatHistory,
        { role: 'user', content: input.followUp },
      ],
    });

    let responseBlockId = '';

    for await (const chunk of answerStream) {
      if (!responseBlockId) {
        const block: TextBlock = {
          id: crypto.randomUUID(),
          type: 'text',
          data: chunk.contentChunk,
        };
        session.emitBlock(block);
        responseBlockId = block.id;
      } else {
        const block = session.getBlock(responseBlockId) as TextBlock | null;
        if (!block) continue;
        block.data += chunk.contentChunk;
        session.updateBlock(block.id, [
          { op: 'replace', path: '/data', value: block.data },
        ]);
      }
    }

    session.emit('end', {});

    try {
      await mcp.disconnectAll();
    } catch {
      // ignore disconnect errors
    }

    await db
      .update(messages)
      .set({
        status: 'completed',
        responseBlocks: session.getAllBlocks(),
      })
      .where(
        and(
          eq(messages.chatId, input.chatId),
          eq(messages.messageId, input.messageId),
        ),
      )
      .execute();
  }
}

export default CSuiteAgent;
