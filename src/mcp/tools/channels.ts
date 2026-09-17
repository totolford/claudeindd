import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ChannelType } from "discord.js";
import { discordClient } from "../../discord/client.js";
import { errorResult, getGuild, textResult } from "../utils.js";

const channelTypeMap = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  category: ChannelType.GuildCategory,
} as const;

export function registerChannelTools(server: McpServer): void {
  server.tool(
    "discord_list_channels",
    "List all channels in a Discord guild",
    {
      guildId: z.string().describe("The ID of the guild to list channels for"),
    },
    async ({ guildId }) => {
      try {
        const guild = await getGuild(guildId);
        const channels = await guild.channels.fetch();
        const lines = [...channels.values()]
          .filter((c) => c !== null)
          .map((c) => `[${c.id}] ${c.name} (${ChannelType[c.type]})`);
        return textResult(lines.length ? lines.join("\n") : "No channels found.");
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "discord_create_channel",
    "Create a new channel in a Discord guild",
    {
      guildId: z.string().describe("The ID of the guild to create the channel in"),
      name: z.string().describe("The name of the new channel"),
      type: z.enum(["text", "voice", "category"]).default("text").describe("The type of channel to create"),
      parentId: z.string().optional().describe("The ID of the category to place this channel under"),
    },
    async ({ guildId, name, type, parentId }) => {
      try {
        const guild = await getGuild(guildId);
        const channel = await guild.channels.create({
          name,
          type: channelTypeMap[type],
          parent: parentId,
        });
        return textResult(`Created channel ${channel.id} (${channel.name}) in guild ${guildId}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "discord_delete_channel",
    "Delete a Discord channel",
    {
      channelId: z.string().describe("The ID of the channel to delete"),
    },
    async ({ channelId }) => {
      try {
        const channel = await discordClient.channels.fetch(channelId);
        if (!channel || !("delete" in channel)) {
          throw new Error(`Channel not found: ${channelId}`);
        }
        await channel.delete();
        return textResult(`Deleted channel ${channelId}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "discord_edit_channel",
    "Edit any setting of a Discord channel: name, topic, category (move between categories), position, NSFW flag, slowmode, voice bitrate/user limit",
    {
      channelId: z.string().describe("The ID of the channel to edit"),
      name: z.string().optional().describe("The new channel name"),
      topic: z.string().optional().describe("The new channel topic (text channels only)"),
      parentId: z.string().nullable().optional().describe("Category ID to move this channel into, or null to remove it from its category"),
      lockPermissions: z.boolean().optional().describe("When moving to a new category, sync permission overwrites with that category"),
      position: z.number().int().min(0).optional().describe("Position of the channel within its parent/guild"),
      nsfw: z.boolean().optional().describe("Mark the channel as age-restricted (text channels only)"),
      rateLimitPerUser: z.number().int().min(0).max(21600).optional().describe("Slowmode in seconds, 0-21600 (text channels only)"),
      bitrate: z.number().int().optional().describe("Voice channel bitrate in bits per second"),
      userLimit: z.number().int().min(0).max(99).optional().describe("Voice channel user limit, 0 for unlimited"),
    },
    async ({ channelId, name, topic, parentId, lockPermissions, position, nsfw, rateLimitPerUser, bitrate, userLimit }) => {
      try {
        const channel = await discordClient.channels.fetch(channelId);
        if (!channel || !("edit" in channel)) {
          throw new Error(`Channel not found: ${channelId}`);
        }
        await channel.edit({
          name,
          topic,
          parent: parentId,
          lockPermissions,
          position,
          nsfw,
          rateLimitPerUser,
          bitrate,
          userLimit,
        });
        return textResult(`Edited channel ${channelId}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
