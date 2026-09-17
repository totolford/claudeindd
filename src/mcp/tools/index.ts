import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMessageTools } from "./messages.js";
import { registerChannelTools } from "./channels.js";
import { registerMemberTools } from "./members.js";
import { registerRoleTools } from "./roles.js";
import { registerPermissionTools } from "./permissions.js";
import { registerThreadTools } from "./threads.js";
import { registerEmojiTools } from "./emojis.js";
import { registerInviteTools } from "./invites.js";
import { registerWebhookTools } from "./webhooks.js";
import { registerGuildTools } from "./guild.js";

export function registerAllTools(server: McpServer): void {
  registerMessageTools(server);
  registerChannelTools(server);
  registerMemberTools(server);
  registerRoleTools(server);
  registerPermissionTools(server);
  registerThreadTools(server);
  registerEmojiTools(server);
  registerInviteTools(server);
  registerWebhookTools(server);
  registerGuildTools(server);
}
