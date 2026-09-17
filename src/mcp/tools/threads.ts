import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ChannelType } from "discord.js";
import { discordClient } from "../../discord/client.js";
import { errorResult, textResult } from "../utils.js";

async function getThreadCapableChannel(channelId: string) {
  const channel = await discordClient.channels.fetch(channelId);
  if (!channel || !("threads" in channel) || !("messages" in channel)) {
    throw new Error(`Channel not found or does not support threads: ${channelId}`);
  }
  return channel;
}

export function registerThreadTools(server: McpServer): void {
  server.tool(
    "discord_create_thread",
    "Create a new thread in a text channel, optionally starting from an existing message",
    {
      channelId: z.string().describe("The ID of the parent text channel"),
      name: z.string().describe("Thread name"),
      messageId: z.string().optional().describe("Create the thread from this existing message instead of standalone"),
      autoArchiveMinutes: z.enum(["60", "1440", "4320", "10080"]).optional().default("1440").describe("Auto-archive duration"),
    },
    async ({ channelId, name, messageId, autoArchiveMinutes }) => {
      try {
        const channel = await getThreadCapableChannel(channelId);
        const autoArchiveDuration = Number(autoArchiveMinutes) as 60 | 1440 | 4320 | 10080;
        const thread = messageId
          ? await (await channel.messages.fetch(messageId)).startThread({ name, autoArchiveDuration })
          : await channel.threads.create({ name, autoArchiveDuration });
        return textResult(`Created thread ${thread.id} (${thread.name}) in channel ${channelId}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "discord_list_active_threads",
    "List active (non-archived) threads in a guild",
    { guildId: z.string() },
    async ({ guildId }) => {
      try {
        const guild = discordClient.guilds.cache.get(guildId) ?? (await discordClient.guilds.fetch(guildId));
        const active = await guild.channels.fetchActiveThreads();
        const lines = [...active.threads.values()].map((t) => `[${t.id}] ${t.name} (parent: ${t.parentId})`);
        return textResult(lines.length ? lines.join("\n") : "No active threads.");
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "discord_archive_thread",
    "Archive or unarchive, and lock or unlock, a thread",
    {
      threadId: z.string(),
      archived: z.boolean().optional().describe("Set the archived state"),
      locked: z.boolean().optional().describe("Set the locked state (requires Manage Threads to unlock)"),
    },
    async ({ threadId, archived, locked }) => {
      try {
        const channel = await discordClient.channels.fetch(threadId);
        if (!channel || channel.type !== ChannelType.PublicThread && channel.type !== ChannelType.PrivateThread) {
          throw new Error(`Not a thread: ${threadId}`);
        }
        if (locked !== undefined) await channel.setLocked(locked);
        if (archived !== undefined) await channel.setArchived(archived);
        return textResult(`Updated thread ${threadId}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
