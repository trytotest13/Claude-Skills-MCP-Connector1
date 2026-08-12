import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const url = process.env.MCP_URL ?? "http://localhost:3000/mcp";

const client = new Client(
  { name: "claude-skills-connector-test", version: "1.0.0" },
  { versionNegotiation: { mode: "auto" } }
);

await client.connect(new StreamableHTTPClientTransport(new URL(url)));

const { tools } = await client.listTools();

console.log("\nConnected:", url);
console.log("Protocol era:", client.getProtocolEra());
console.log("\nTools:");
for (const tool of tools) {
  console.log(`- ${tool.name}: ${tool.description ?? ""}`);
}

const result = await client.callTool({
  name: "search_skills",
  arguments: { query: "portfolio design" },
});

console.log("\nSearch result:");
for (const block of result.content ?? []) {
  if (block.type === "text") console.log(block.text);
}

await client.close();
