import { connectDiscord } from "./discord/client.js";
import { startMcpServer } from "./mcp/server.js";

async function main() {
  await connectDiscord();
  console.error("[claudeindd] Discord bot connected.");
  await startMcpServer();
  console.error("[claudeindd] MCP server listening on stdio.");
}

main().catch((err) => {
  console.error("[claudeindd] Fatal error:", err);
  process.exit(1);
});
