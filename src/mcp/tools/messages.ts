import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { discordClient } from "../../discord/client.js";
import { errorResult, textResult } from "../utils.js";

async function getTextChannel(channelId: string) {
  const channel = await discordClient.channels.fetch(channelId);
  if (!channel || !channel.isTextBased() || !("send" in channel)) {
    throw new Error(`Channel not found or not text-based: ${channelId}`);
  }
  return channel;
}

export function registerMessageTools(server: McpServer): void {
  server.tool(
    "discord_send_message",
    "Send a message to a Discord text channel",
    {
      channelId: z.string().describe("The ID of the channel to send the message to"),
      content: z.string().describe("The message content"),
    },
    async ({ channelId, content }) => {
      try {
        const channel = await getTextChannel(channelId);
        const message = await channel.send(content);
        return textResult(`Sent message ${message.id} to channel ${channelId}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "discord_read_messages",
    "Read recent messages from a Discord text channel",
    {
      channelId: z.string().describe("The ID of the channel to read messages from"),
      limit: z.number().min(1).max(100).default(20).describe("Number of messages to fetch (max 100)"),
    },
    async ({ channelId, limit }) => {
      try {
        const channel = await getTextChannel(channelId);
        const messages = await channel.messages.fetch({ limit });
        const lines = [...messages.values()]
          .reverse()
          .map((m) => `[${m.id}] ${m.author.tag}: ${m.content}`);
        return textResult(lines.length ? lines.join("\n") : "No messages found.");
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "discord_edit_message",
    "Edit a message previously sent by the bot",
    {
      channelId: z.string().describe("The ID of the channel containing the message"),
      messageId: z.string().describe("The ID of the message to edit"),
      content: z.string().describe("The new message content"),
    },
    async ({ channelId, messageId, content }) => {
      try {
        const channel = await getTextChannel(channelId);
        const message = await channel.messages.fetch(messageId);
        await message.edit(content);
        return textResult(`Edited message ${messageId} in channel ${channelId}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "discord_delete_message",
    "Delete a message from a Discord text channel",
    {
      channelId: z.string().describe("The ID of the channel containing the message"),
      messageId: z.string().describe("The ID of the message to delete"),
    },
    async ({ channelId, messageId }) => {
      try {
        const channel = await getTextChannel(channelId);
        const message = await channel.messages.fetch(messageId);
        await message.delete();
        return textResult(`Deleted message ${messageId} from channel ${channelId}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
