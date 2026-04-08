import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import z from 'zod';
import { Tool } from '@/lib/models/types';

type ServerConfig = {
  command: string;
  args: string[];
};

const SERVERS: Record<string, ServerConfig> = {
  finance: {
    command: process.env.MCP_FINANCE_COMMAND || 'node',
    args: (process.env.MCP_FINANCE_ARGS || './path/to/finance-server.js').split(
      ' ',
    ),
  },
  tech: {
    command: process.env.MCP_TECH_COMMAND || 'npx',
    args: (
      process.env.MCP_TECH_ARGS || '-y @modelcontextprotocol/server-github'
    ).split(' '),
  },
  legal: {
    command: process.env.MCP_LEGAL_COMMAND || 'python',
    args: (process.env.MCP_LEGAL_ARGS || './path/to/legal-server.py').split(
      ' ',
    ),
  },
};

export class McpManager {
  private clients: Map<string, Client> = new Map();

  async connectAll() {
    for (const [role, config] of Object.entries(SERVERS)) {
      try {
        const transport = new StdioClientTransport({
          command: config.command,
          args: config.args,
        });

        const client = new Client(
          { name: 'Perplexica-Host', version: '1.0.0' },
          { capabilities: {} },
        );
        await client.connect(transport);
        this.clients.set(role, client);
        console.log(`Connected to ${role} MCP server`);
      } catch (err) {
        console.warn(`Could not connect to ${role} MCP server:`, err);
      }
    }
  }

  async getToolsForRole(role: string) {
    const client = this.clients.get(role);
    if (!client) return [];
    try {
      const result = await client.listTools();
      return result.tools;
    } catch (err) {
      console.warn(`Failed to list tools for ${role}:`, err);
      return [];
    }
  }

  async callTool(role: string, toolName: string, args: Record<string, unknown>) {
    const client = this.clients.get(role);
    if (!client) throw new Error(`MCP server for ${role} not available`);
    return await client.callTool({ name: toolName, arguments: args });
  }

  async disconnectAll() {
    for (const [role, client] of this.clients.entries()) {
      try {
        await client.close();
        console.log(`Disconnected from ${role} MCP server`);
      } catch (err) {
        console.warn(`Failed to disconnect from ${role} MCP server:`, err);
      }
    }
    this.clients.clear();
  }

  /**
   * Convert MCP tools for a given role into the app's Tool[] format so they
   * can be passed directly to BaseLLM.streamText / generateText.
   */
  async getToolsAsAppTools(role: string): Promise<Tool[]> {
    const mcpTools = await this.getToolsForRole(role);
    return mcpTools.map((t) => ({
      name: t.name,
      description: t.description ?? '',
      schema: this.convertInputSchema(t.inputSchema),
    }));
  }

  /**
   * Convert a JSON Schema object (as returned by MCP tool definitions) into
   * a Zod object schema compatible with the app's Tool.schema type.
   */
  private convertInputSchema(inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  }): z.ZodObject<any> {
    if (!inputSchema || inputSchema.type !== 'object') {
      return z.object({});
    }

    const props = inputSchema.properties ?? {};
    const required: string[] = inputSchema.required ?? [];
    const zodFields: Record<string, z.ZodTypeAny> = {};

    for (const [key, prop] of Object.entries(props)) {
      let fieldType: z.ZodTypeAny;

      switch ((prop as any).type) {
        case 'string':
          fieldType = z.string();
          break;
        case 'number':
          fieldType = z.number();
          break;
        case 'integer':
          fieldType = z.number().int();
          break;
        case 'boolean':
          fieldType = z.boolean();
          break;
        case 'array':
          fieldType = z.array(z.unknown());
          break;
        case 'object':
          fieldType = z.object({}).catchall(z.unknown());
          break;
        default:
          fieldType = z.unknown();
      }

      if (!required.includes(key)) {
        fieldType = fieldType.optional() as z.ZodTypeAny;
      }

      zodFields[key] = fieldType;
    }

    return z.object(zodFields);
  }
}
