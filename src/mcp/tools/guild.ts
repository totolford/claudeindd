import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ActivityType, GuildVerificationLevel } from "discord.js";
import { discordClient } from "../../discord/client.js";
import { getGuild, errorResult, textResult } from "../utils.js";

export function registerGuildTools(server: McpServer): void {
  server.tool(
    "discord_get_guild_info",
    "Get information about a guild: name, owner, member count, boost level, icon, verification level",
    { guildId: z.string() },
    async ({ guildId }) => {
      try {
        const guild = await getGuild(guildId);
        const owner = await guild.fetchOwner().catch(() => null);
        return textResult(
          [
            `Name: ${guild.name}`,
            `ID: ${guild.id}`,
            `Owner: ${owner?.user.tag ?? guild.ownerId}`,
            `Members: ${guild.memberCount}`,
            `Boost level: ${guild.premiumTier} (${guild.premiumSubscriptionCount ?? 0} boosts)`,
            `Verification level: ${guild.verificationLevel}`,
            `Icon: ${guild.iconURL() ?? "none"}`,
            `Created: ${guild.createdAt.toISOString()}`,
          ].join("\n"),
        );
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "discord_edit_guild",
    "Edit guild-level settings: name, description, icon, or verification level",
    {
      guildId: z.string(),
      name: z.string().optional(),
      description: z.string().nullable().optional(),
      icon: z.string().nullable().optional().describe("Image URL or base64 data URI, or null to remove"),
      verificationLevel: z.enum(["None", "Low", "Medium", "High", "VeryHigh"]).optional(),
    },
    async ({ guildId, name, description, icon, verificationLevel }) => {
      try {
        const guild = await getGuild(guildId);
        await guild.edit({
          name,
          description,
          icon,
          verificationLevel: verificationLevel ? GuildVerificationLevel[verificationLevel] : undefined,
        });
        return textResult(`Edited guild ${guildId}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "discord_get_audit_log",
    "Read recent entries from the guild's audit log",
    {
      guildId: z.string(),
      limit: z.number().min(1).max(100).default(20),
    },
    async ({ guildId, limit }) => {
      try {
        const guild = await getGuild(guildId);
        const log = await guild.fetchAuditLogs({ limit });
        const lines = [...log.entries.values()].map(
          (e) => `[${e.id}] ${e.action} by ${e.executor?.tag ?? "unknown"} on target ${e.targetId ?? "?"}${e.reason ? ` — ${e.reason}` : ""}`,
        );
        return textResult(lines.length ? lines.join("\n") : "No audit log entries.");
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "discord_set_bot_presence",
    "Set the bot's own online status and activity",
    {
      status: z.enum(["online", "idle", "dnd", "invisible"]).optional(),
      activityText: z.string().optional().describe("Activity text, e.g. \"with the API\""),
      activityType: z.enum(["Playing", "Watching", "Listening", "Competing"]).optional().default("Playing"),
    },
    async ({ status, activityText, activityType }) => {
      try {
        discordClient.user?.setPresence({
          status,
          activities: activityText ? [{ name: activityText, type: ActivityType[activityType] }] : undefined,
        });
        return textResult("Updated bot presence.");
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
