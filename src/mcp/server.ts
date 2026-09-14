import http from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { registerAllTools } from "./tools/index.js";

export const PORT = Number(process.env.MCP_PORT ?? 3939);
const transports = new Map<string, StreamableHTTPServerTransport>();

function buildServer(): McpServer {
  const server = new McpServer({ name: "claudeindd", version: "0.1.0" });
  registerAllTools(server);
  return server;
}

export async function startMcpServer(): Promise<http.Server> {
  const httpServer = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({ name: "claudeindd", ok: true, pid: process.pid })
      );
      return;
    }

    if (req.url !== "/mcp") {
      res.writeHead(404).end();
      return;
    }

    const sessionId = req.headers["mcp-session-id"];
    const existing = typeof sessionId === "string" ? transports.get(sessionId) : undefined;

    if (existing) {
      void existing.handleRequest(req, res);
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(400).end("No valid session");
      return;
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      void (async () => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(body);
        } catch {
          res.writeHead(400).end("Invalid JSON");
          return;
        }

        if (!isInitializeRequest(parsed)) {
          res.writeHead(400).end("No valid session");
          return;
        }

        const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id: string) => {
            transports.set(id, transport);
          },
        });
        transport.onclose = () => {
          if (transport.sessionId) transports.delete(transport.sessionId);
        };

        const server = buildServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, parsed);
      })();
    });
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(PORT, () => {
      httpServer.removeListener("error", reject);
      resolve();
    });
  });
  return httpServer;
}

export function mcpEndpointUrl(): string {
  return `http://localhost:${PORT}/mcp`;
}

export async function isServerAlreadyRunning(): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${PORT}/health`, { signal: AbortSignal.timeout(1000) });
    if (!res.ok) return false;
    const data = (await res.json()) as { name?: string };
    return data.name === "claudeindd";
  } catch {
    return false;
  }
}
