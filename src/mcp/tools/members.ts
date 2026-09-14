import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getGuild, textResult, errorResult } from "../utils.js";

export function registerMemberTools(server: McpServer): void {
  server.tool(
    "discord_list_members",
    "Lists members of a guild with id, username, display name, and top role",
    {
      guildId: z.string(),
      limit: z.number().min(1).max(200).default(50),
    },
    async ({ guildId, limit }) => {
      try {
        const guild = await getGuild(guildId);
        const members = await guild.members.fetch({ limit });
        const lines = members.map(
          (m) => `${m.id} | ${m.user.username} | ${m.displayName} | ${m.roles.highest.name}`
        );
        return textResult(lines.length > 0 ? lines.join("\n") : "No members found.");
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "discord_kick_member",
    "Kicks a member from the guild",
    {
      guildId: z.string(),
      userId: z.string(),
      reason: z.string().optional(),
    },
    async ({ guildId, userId, reason }) => {
      try {
        const guild = await getGuild(guildId);
        const member = await guild.members.fetch(userId);
        await member.kick(reason);
        return textResult(`Kicked ${member.user.username} (${userId}).`);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "discord_ban_member",
    "Bans a user from the guild",
    {
      guildId: z.string(),
      userId: z.string(),
      reason: z.string().optional(),
      deleteMessageSeconds: z.number().optional().default(0),
    },
    async ({ guildId, userId, reason, deleteMessageSeconds }) => {
      try {
        const guild = await getGuild(guildId);
        await guild.members.ban(userId, { reason, deleteMessageSeconds });
        return textResult(`Banned user ${userId}.`);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "discord_unban_member",
    "Unbans a user from the guild",
    {
      guildId: z.string(),
      userId: z.string(),
      reason: z.string().optional(),
    },
    async ({ guildId, userId, reason }) => {
      try {
        const guild = await getGuild(guildId);
        await guild.members.unban(userId, reason);
        return textResult(`Unbanned user ${userId}.`);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "discord_timeout_member",
    "Times out a member for a duration in minutes, or clears the timeout if omitted/zero",
    {
      guildId: z.string(),
      userId: z.string(),
      durationMinutes: z.number().min(0).optional().default(0),
      reason: z.string().optional(),
    },
    async ({ guildId, userId, durationMinutes, reason }) => {
      try {
        const guild = await getGuild(guildId);
        const member = await guild.members.fetch(userId);
        const ms = durationMinutes && durationMinutes > 0 ? durationMinutes * 60 * 1000 : null;
        await member.disableCommunicationUntil(ms ? Date.now() + ms : null, reason);
        return textResult(
          ms ? `Timed out ${member.user.username} for ${durationMinutes} minute(s).` : `Cleared timeout for ${member.user.username}.`
        );
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}
