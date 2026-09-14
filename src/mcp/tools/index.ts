import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMessageTools } from "./messages.js";
import { registerChannelTools } from "./channels.js";
import { registerMemberTools } from "./members.js";
import { registerRoleTools } from "./roles.js";
import { registerPermissionTools } from "./permissions.js";

export function registerAllTools(server: McpServer): void {
  registerMessageTools(server);
  registerChannelTools(server);
  registerMemberTools(server);
  registerRoleTools(server);
  registerPermissionTools(server);
}
