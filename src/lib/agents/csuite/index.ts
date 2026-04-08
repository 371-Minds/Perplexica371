import SessionManager from '@/lib/session';
import { Message, TextBlock } from '@/lib/types';
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
import { Tool, ToolCall } from '@/lib/models/types';
import { CSuiteAgentInput, SubAgentReport } from './types';

class CSuiteAgent {
  private readonly MAX_TOOL_ITERATIONS = 5;

  /**
   * Run a sub-agent (CFO / CTO / CLO) with an optional tool-calling loop.
   *
   * When `tools` is non-empty and `mcp` + `mcpRole` are provided the agent
   * enters a ReAct loop: it calls the LLM, executes any tool calls via the
   * McpManager, feeds the results back as `tool` messages, and repeats until
   * the model stops requesting tools or the iteration limit is reached.
   *
   * When no tools are available the method falls through to a simple
   * single-shot streaming call (previous behaviour).
   */
  private async runSubAgent(
    systemPrompt: string,
    query: string,
    config: CSuiteAgentInput['config'],
    tools: Tool[] = [],
    mcp?: McpManager,
    mcpRole?: string,
  ): Promise<string> {
    const agentMessages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query },
    ];

    let finalOutput = '';

    const iterations =
      tools.length > 0 && mcp && mcpRole ? this.MAX_TOOL_ITERATIONS : 1;

    for (let i = 0; i < iterations; i++) {
      const stream = config.llm.streamText({
        messages: agentMessages,
        tools: tools.length > 0 ? tools : undefined,
      });

      let contentChunk = '';
      const accumulatedToolCalls: ToolCall[] = [];

      for await (const chunk of stream) {
        contentChunk += chunk.contentChunk;

        for (const tc of chunk.toolCallChunk) {
          const existing = accumulatedToolCalls.findIndex(
            (ftc) => ftc.id === tc.id,
          );
          if (existing !== -1) {
            accumulatedToolCalls[existing].arguments = tc.arguments;
          } else {
            accumulatedToolCalls.push({ ...tc });
          }
        }
      }

      if (contentChunk) {
        // Each iteration replaces the output: earlier iterations are
        // intermediate tool-call steps; only the last content response
        // (when the model stops requesting tools) is the final answer.
        finalOutput = contentChunk;
      }

      if (accumulatedToolCalls.length === 0 || !mcp || !mcpRole) {
        break;
      }

      agentMessages.push({
        role: 'assistant',
        content: contentChunk,
        tool_calls: accumulatedToolCalls,
      });

      for (const tc of accumulatedToolCalls) {
        let toolResult: string;
        try {
          const result = await mcp.callTool(mcpRole, tc.name, tc.arguments);
          toolResult = JSON.stringify(result);
        } catch (err) {
          toolResult = `Error calling tool "${tc.name}": ${(err as Error).message}`;
        }

        agentMessages.push({
          role: 'tool',
          id: tc.id,
          name: tc.name,
          content: toolResult,
        });
      }
    }

    return finalOutput;
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

    // Fetch per-role tools after connecting (empty array if server unavailable)
    const [cfoTools, ctoTools, cloTools] = await Promise.all([
      mcp.getToolsAsAppTools('finance').catch((err) => {
        console.warn('Failed to fetch CFO tools from MCP:', err);
        return [] as Tool[];
      }),
      mcp.getToolsAsAppTools('tech').catch((err) => {
        console.warn('Failed to fetch CTO tools from MCP:', err);
        return [] as Tool[];
      }),
      mcp.getToolsAsAppTools('legal').catch((err) => {
        console.warn('Failed to fetch CLO tools from MCP:', err);
        return [] as Tool[];
      }),
    ]);

    const subReports: SubAgentReport[] = [];

    const [cfoReport, ctoReport, cloReport] = await Promise.all([
      this.runSubAgent(
        CFO_SYSTEM_PROMPT(),
        `Regarding the following query, provide a focused financial analysis:\n\n${input.followUp}`,
        input.config,
        cfoTools,
        mcp,
        'finance',
      ),
      this.runSubAgent(
        CTO_SYSTEM_PROMPT(),
        `Regarding the following query, provide a focused technical analysis:\n\n${input.followUp}`,
        input.config,
        ctoTools,
        mcp,
        'tech',
      ),
      this.runSubAgent(
        CLO_SYSTEM_PROMPT(),
        `Regarding the following query, provide a focused legal and compliance analysis:\n\n${input.followUp}`,
        input.config,
        cloTools,
        mcp,
        'legal',
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
