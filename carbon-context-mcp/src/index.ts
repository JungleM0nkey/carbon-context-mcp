#!/usr/bin/env node
// Carbon MCP — a local, self-contained MCP server for the IBM Carbon Design System.
// Serves docs/token/component lookup over a bundled reference pack. No network required.
// Transport: stdio (for Claude Code / Claude Desktop / MCP Inspector).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";

async function main() {
  const server = new McpServer({
    name: "carbon-context-mcp",
    version: "0.1.0",
  });

  registerTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr only — stdout is the JSON-RPC channel.
  console.error("[carbon-mcp] ready on stdio");
}

main().catch((err) => {
  console.error("[carbon-mcp] fatal:", err);
  process.exit(1);
});
