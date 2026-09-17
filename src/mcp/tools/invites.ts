import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { discordClient } from "../../discord/client.js";
import { getGuild, errorResult, textResult } from "../utils.js";

export function registerInviteTools(server: McpServer): void {
  server.tool(
    "discord_create_invite",
    "Create an invite link for a channel",
    {
      channelId: z.string(),
      maxAgeSeconds: z.number().min(0).optional().default(86400).describe("0 for never expires"),
      maxUses: z.number().min(0).optional().default(0).describe("0 for unlimited uses"),
      temporary: z.boolean().optional().default(false).describe("Grants temporary membership"),
    },
    async ({ channelId, maxAgeSeconds, maxUses, temporary }) => {
      try {
        const channel = await discordClient.channels.fetch(channelId);
        if (!channel || !("createInvite" in channel)) {
          throw new Error(`Channel not found or does not support invites: ${channelId}`);
        }
        const invite = await channel.createInvite({ maxAge: maxAgeSeconds, maxUses, temporary });
        return textResult(`Created invite: https://discord.gg/${invite.code}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "discord_list_invites",
    "List all active invites for a guild",
    { guildId: z.string() },
    async ({ guildId }) => {
      try {
        const guild = await getGuild(guildId);
        const invites = await guild.invites.fetch();
        const lines = invites.map(
          (i) => `${i.code} | channel ${i.channelId} | uses ${i.uses}/${i.maxUses || "∞"} | by ${i.inviter?.tag ?? "unknown"}`,
        );
        return textResult(lines.length ? lines.join("\n") : "No active invites.");
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "discord_delete_invite",
    "Revoke an invite by its code",
    { guildId: z.string(), code: z.string() },
    async ({ guildId, code }) => {
      try {
        const guild = await getGuild(guildId);
        const invite = await guild.invites.fetch(code);
        await invite.delete();
        return textResult(`Revoked invite ${code}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
