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
    "Edit a Discord channel's name or topic",
    {
      channelId: z.string().describe("The ID of the channel to edit"),
      name: z.string().optional().describe("The new channel name"),
      topic: z.string().optional().describe("The new channel topic"),
    },
    async ({ channelId, name, topic }) => {
      try {
        const channel = await discordClient.channels.fetch(channelId);
        if (!channel || !("edit" in channel)) {
          throw new Error(`Channel not found: ${channelId}`);
        }
        await channel.edit({ name, topic });
        return textResult(`Edited channel ${channelId}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
