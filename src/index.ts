import { discordClient, connectDiscord } from "./discord/client.js";
import { startMcpServer, mcpEndpointUrl, isServerAlreadyRunning } from "./mcp/server.js";

async function main() {
  if (await isServerAlreadyRunning()) {
    console.error(`[claudeindd] Already running at ${mcpEndpointUrl()} (another window or session owns it).`);
    console.error("[claudeindd] Nothing to do here — close this window and use the existing instance.");
    return;
  }

  await connectDiscord();
  console.error(`[claudeindd] Discord bot connected as ${discordClient.user?.tag}.`);

  let httpServer;
  try {
    httpServer = await startMcpServer();
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EADDRINUSE") {
      console.error(`[claudeindd] Another instance grabbed the port first. Close this window and use it.`);
    } else {
      console.error("[claudeindd] Failed to start MCP server:", err);
    }
    discordClient.destroy();
    return;
  }
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
