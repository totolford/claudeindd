import { discordClient, connectDiscord } from "./discord/client.js";
import { startMcpServer, mcpEndpointUrl } from "./mcp/server.js";

async function main() {
  await connectDiscord();
  console.error(`[claudeindd] Discord bot connected as ${discordClient.user?.tag}.`);

  const httpServer = await startMcpServer();
  console.error(`[claudeindd] MCP server listening on ${mcpEndpointUrl()}`);
  console.error("[claudeindd] Ready. Close this window to stop the bot and the MCP server.");

  const shutdown = () => {
    console.error("[claudeindd] Shutting down...");
    httpServer.close();
    discordClient.destroy();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("SIGHUP", shutdown);
}

main().catch((err) => {
  console.error("[claudeindd] Fatal error:", err);
  process.exit(1);
});
