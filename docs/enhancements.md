# Enhancements

To enhance **Perplexica** with **MCP (Model Context Protocol)** servers and a **C-Suite AI Agent team** (CEO, CFO, CTO, CLO), we need to modify its architecture to support external tool connections and hierarchical agent orchestration.

Since Perplexica is a Next.js-based search engine that already uses an "Agentic Search Pipeline" (Classifier → Researcher → Writer), we can extend this existing logic.

Here is the comprehensive architectural plan and implementation guide.

---

### **1. High-Level Architecture**

We are transforming Perplexica from a "Search Engine" into a **"Corporate Intelligence Hub"**.

*   **MCP Host:** Perplexica itself (specifically the Next.js backend). It will run an MCP Client to connect to external servers.
*   **MCP Servers:** Standalone services (running locally or remotely) that provide data to the C-Suite agents.
*   **The C-Suite Agents:**
    *   **CEO (Orchestrator):** The entry point. It analyzes the user query, delegates tasks to other execs, and synthesizes the final strategic report.
    *   **CFO (Finance):** Uses MCP to access accounting software (Xero/QuickBooks), stock data, and bank feeds.
    *   **CTO (Tech):** Uses MCP to access GitHub, Jira, Cloudwatch, and technical documentation.
    *   **CLO (Legal):** Uses MCP to access contract repositories, compliance databases, and legal research tools.

---

### **2. System Integration Design**

#### **A. The MCP Layer (New Component)**
Perplexica needs a way to "talk" to external tools. We will add an MCP Client Manager in the backend.

*   **Location:** `src/lib/mcp/`
*   **Function:**
    1.  Connects to MCP Servers via Stdio (local) or SSE (remote).
    2.  Lists available tools (e.g., `get_balance_sheet`, `search_github_issues`).
    3.  Exposes these tools to the specific AI Agents.

#### **B. The C-Suite Agents (New Agents)**
Perplexica currently has modes like "Web Search" and "Academic". We will add a **"Corporate Mode"** or distinct agents.

| Agent Role | Responsibility | MCP Tools / Context |
| :--- | :--- | :--- |
| **CEO** | **Router & Synthesizer.** Receives the prompt (e.g., "Assess risk of Vendor X"). Decides which sub-agents to call. | No specific tools, but has access to the *outputs* of CFO, CTO, and CLO. |
| **CFO** | **Financial Analysis.** Checks financial health, budget impact, and market data. | `finance-mcp-server`: `get_pnl`, `check_vendor_credit_score`, `search_invoices`. |
| **CTO** | **Technical Due Diligence.** Checks code quality, security posture, and system status. | `tech-mcp-server`: `github_search`, `fetch_latest_commit`, `get_sentry_errors`. |
| **CLO** | **Compliance & Risk.** Checks contracts, NDAs, and regulatory compliance. | `legal-mcp-server`: `search_contracts`, `analyze_pdf_clause`, `check_compliance_db`. |

---

### **3. Implementation Guide**

#### **Step 1: Install MCP SDK**
First, add the TypeScript SDK to your Perplexica project.
```bash
npm install @modelcontextprotocol/sdk
```

#### **Step 2: Create the MCP Client Manager**
Create a new file `src/lib/mcp/McpManager.ts`. This handles connections to your external servers.

```typescript
// src/lib/mcp/McpManager.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Configuration for your external MCP servers
const SERVERS = {
  finance: { command: "node", args: ["./path/to/finance-server.js"] },
  tech: { command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] }, // Example using official GitHub server
  legal: { command: "python", args: ["./path/to/legal-server.py"] },
};

export class McpManager {
  private clients: Map<string, Client> = new Map();

  async connectAll() {
    for (const [role, config] of Object.entries(SERVERS)) {
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
      });
      
      const client = new Client({ name: "Perplexica-Host", version: "1.0.0" }, { capabilities: {} });
      await client.connect(transport);
      this.clients.set(role, client);
      console.log(`Connected to ${role} MCP server`);
    }
  }

  async getToolsForRole(role: string) {
    const client = this.clients.get(role);
    if (!client) return [];
    const result = await client.listTools();
    return result.tools;
  }

  async callTool(role: string, toolName: string, args: any) {
    const client = this.clients.get(role);
    if (!client) throw new Error(`Agent ${role} not available`);
    return await client.callTool({ name: toolName, arguments: args });
  }
}
```

#### **Step 3: Define the C-Suite Prompts**
Modify the `src/agents/prompts.ts` (or equivalent location in Perplexica) to include the personas.

```typescript
export const CEO_PROMPT = `
You are the CEO Agent. Your goal is to provide a comprehensive strategic answer.
1. Analyze the user's request.
2. Delegate specific questions to your C-suite (CFO, CTO, CLO) by using the 'ask_agent' tool.
3. Synthesize their findings into a final executive summary.
`;

export const CFO_PROMPT = `
You are the CFO Agent. Focus purely on financial data, budget, and economic risk. 
Use the provided financial tools to look up balance sheets, stock prices, or invoice data.
`;
// ... Repeat for CTO and CLO
```

#### **Step 4: Integrate into Perplexica's Pipeline**
You need to modify the **Agent Handler** (likely in `src/routes/chat.ts` or `src/lib/agent-handler.ts`).

*Current Flow:* User -> Classifier -> specific_agent (e.g., AcademicSearch) -> LLM.
*New Flow:* User -> CEO Agent -> (Wait for Sub-calls) -> LLM.

You will need to implement a function calling loop (ReAct pattern) for the CEO agent so it can "call" the other agents.

```typescript
// Pseudo-code logic for the CEO Agent execution
async function runCeoAgent(query: string) {
  const mcp = new McpManager();
  await mcp.connectAll();

  // 1. CEO Analysis
  const plan = await llm.generate({
    system: CEO_PROMPT,
    messages: [{ role: "user", content: query }],
    tools: [
      { name: "ask_cfo", description: "Ask the CFO a financial question" },
      { name: "ask_cto", description: "Ask the CTO a technical question" }
    ]
  });

  // 2. Execute Sub-Agent Calls
  let context = "";
  if (plan.tool_calls) {
    for (const call of plan.tool_calls) {
      if (call.name === "ask_cfo") {
        // Get CFO tools from MCP
        const cfoTools = await mcp.getToolsForRole("finance");
        // Run CFO Agent loop with access to these tools
        const cfoResponse = await runSubAgent(CFO_PROMPT, call.arguments.question, cfoTools);
        context += `\n[CFO Report]: ${cfoResponse}`;
      }
      // ... handle CTO/CLO similarly
    }
  }

  // 3. Final Synthesis
  const finalAnswer = await llm.generate({
    system: CEO_PROMPT,
    messages: [
      { role: "user", content: query },
      { role: "system", content: `Context from team: ${context}` }
    ]
  });

  return finalAnswer;
}
```

---

### **4. Example Workflow: "Should we acquire Company X?"**

1.  **User:** Asks "Evaluate the acquisition of Startup X."
2.  **CEO Agent:** Receives the prompt. Decides it needs info on finances, tech stack, and IP legality.
    *   *Calls CFO:* "Get financial health of Startup X."
    *   *Calls CTO:* "Analyze Startup X's public GitHub repositories."
    *   *Calls CLO:* "Check for any IP lawsuits regarding Startup X."
3.  **CFO Agent:** Receives request. Uses **Finance MCP Server** (connected to Bloomberg/Crunchbase API) to fetch revenue data. Returns summary.
4.  **CTO Agent:** Receives request. Uses **Tech MCP Server** (connected to GitHub API) to check commit activity and languages. Returns summary.
5.  **CLO Agent:** Receives request. Uses **Legal MCP Server** (connected to a court case DB). Finds no lawsuits.
6.  **CEO Agent:** Aggregates all 3 reports.
    *   *Output:* "Acquisition recommended. Financials are strong (CFO), Tech stack is modern (CTO), and no legal risks found (CLO)."

### **5. Prerequisites & Tools to Build**
To make this work, you need to spin up the actual MCP Servers. You can use ready-made ones or build simple wrappers:

1.  **Tech MCP:** Use the official `@modelcontextprotocol/server-github`.
2.  **Finance MCP:** Build a simple Python MCP server that wraps `yfinance` (Yahoo Finance) or the Stripe API.
3.  **Legal MCP:** Build a wrapper around a PDF search tool (like `pypdf` + `faiss`) to search a local folder of contracts.

This architecture preserves Perplexica's privacy-first nature (since MCP servers can run locally) while giving it "God Mode" capabilities over your corporate data.
