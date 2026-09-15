import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PermissionsBitField } from "discord.js";
import { discordClient } from "../../discord/client.js";
import { textResult, errorResult, toPermissionFlags } from "../utils.js";

async function getGuildChannel(channelId: string) {
  const channel = discordClient.channels.cache.get(channelId) ?? (await discordClient.channels.fetch(channelId));
  if (!channel || !("permissionOverwrites" in channel)) {
    throw new Error(`Channel not found or has no permission overwrites: ${channelId}`);
  }
  return channel;
}

export function registerPermissionTools(server: McpServer): void {
  server.tool(
    "discord_set_channel_permission_overwrite",
    "Sets a permission overwrite on a channel for a role or member",
    {
      channelId: z.string(),
      targetId: z.string(),
      targetType: z.enum(["role", "member"]),
      allow: z.array(z.string()).optional().default([]),
      deny: z.array(z.string()).optional().default([]),
    },
    async ({ channelId, targetId, targetType, allow, deny }) => {
      try {
        const channel = await getGuildChannel(channelId);
        toPermissionFlags(allow);
        toPermissionFlags(deny);
        const overwriteOptions: Record<string, boolean> = {};
        for (const name of allow) overwriteOptions[name] = true;
        for (const name of deny) overwriteOptions[name] = false;
        await channel.permissionOverwrites.edit(targetId, overwriteOptions, {
          type: targetType === "role" ? 0 : 1,
        });
        return textResult(`Set permission overwrite on channel ${channelId} for ${targetType} ${targetId}.`);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "discord_remove_channel_permission_overwrite",
    "Removes a permission overwrite entirely from a channel",
    { channelId: z.string(), targetId: z.string() },
    async ({ channelId, targetId }) => {
      try {
        const channel = await getGuildChannel(channelId);
        await channel.permissionOverwrites.delete(targetId);
        return textResult(`Removed permission overwrite for ${targetId} on channel ${channelId}.`);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "discord_get_channel_permissions",
    "Lists all permission overwrites on a channel",
    { channelId: z.string() },
    async ({ channelId }) => {
      try {
        const channel = await getGuildChannel(channelId);
        const overwrites = channel.permissionOverwrites.cache;
        if (overwrites.size === 0) return textResult("No permission overwrites on this channel.");
        const lines = overwrites.map((ow) => {
          const allowed = new PermissionsBitField(ow.allow).toArray().join(", ") || "none";
          const denied = new PermissionsBitField(ow.deny).toArray().join(", ") || "none";
          return `${ow.id} | type ${ow.type === 0 ? "role" : "member"} | allow: ${allowed} | deny: ${denied}`;
        });
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}
