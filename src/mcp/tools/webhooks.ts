import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WebhookClient } from "discord.js";
import { discordClient } from "../../discord/client.js";
import { errorResult, textResult } from "../utils.js";

export function registerWebhookTools(server: McpServer): void {
  server.tool(
    "discord_create_webhook",
    "Create a webhook on a text channel",
    { channelId: z.string(), name: z.string() },
    async ({ channelId, name }) => {
      try {
        const channel = await discordClient.channels.fetch(channelId);
        if (!channel || !("createWebhook" in channel)) {
          throw new Error(`Channel not found or does not support webhooks: ${channelId}`);
        }
        const webhook = await channel.createWebhook({ name });
        return textResult(`Created webhook ${webhook.id} (${webhook.name})\nURL: ${webhook.url}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "discord_list_webhooks",
    "List all webhooks on a text channel",
    { channelId: z.string() },
    async ({ channelId }) => {
      try {
        const channel = await discordClient.channels.fetch(channelId);
        if (!channel || !("fetchWebhooks" in channel)) {
          throw new Error(`Channel not found or does not support webhooks: ${channelId}`);
        }
        const webhooks = await channel.fetchWebhooks();
        const lines = webhooks.map((w) => `${w.id} | ${w.name}`);
        return textResult(lines.length ? lines.join("\n") : "No webhooks on this channel.");
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "discord_delete_webhook",
    "Delete a webhook by ID",
    { webhookId: z.string() },
    async ({ webhookId }) => {
      try {
        const webhook = await discordClient.fetchWebhook(webhookId);
        await webhook.delete();
        return textResult(`Deleted webhook ${webhookId}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "discord_send_webhook_message",
    "Send a message through an existing webhook, optionally overriding the display name and avatar",
    {
      webhookUrl: z.string().describe("Full webhook URL, as returned by discord_create_webhook"),
      content: z.string(),
      username: z.string().optional(),
      avatarUrl: z.string().optional(),
    },
    async ({ webhookUrl, content, username, avatarUrl }) => {
      try {
        const client = new WebhookClient({ url: webhookUrl });
        const message = await client.send({ content, username, avatarURL: avatarUrl });
        return textResult(`Sent webhook message ${message.id}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
