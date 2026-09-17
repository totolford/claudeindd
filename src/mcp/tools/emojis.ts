import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getGuild, errorResult, textResult } from "../utils.js";

export function registerEmojiTools(server: McpServer): void {
  server.tool(
    "discord_list_emojis",
    "List all custom emojis in a guild",
    { guildId: z.string() },
    async ({ guildId }) => {
      try {
        const guild = await getGuild(guildId);
        const emojis = await guild.emojis.fetch();
        const lines = emojis.map((e) => `${e.id} | ${e.name} | ${e.animated ? "animated" : "static"} | ${e.url}`);
        return textResult(lines.length ? lines.join("\n") : "No custom emojis.");
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "discord_create_emoji",
    "Create a custom emoji in a guild from an image URL or base64 data URI",
    {
      guildId: z.string(),
      name: z.string().describe("Emoji name (2-32 characters, alphanumeric/underscore)"),
      image: z.string().describe("Image URL or base64 data URI (e.g. data:image/png;base64,...)"),
    },
    async ({ guildId, name, image }) => {
      try {
        const guild = await getGuild(guildId);
        const emoji = await guild.emojis.create({ name, attachment: image });
        return textResult(`Created emoji ${emoji.name} (${emoji.id})`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "discord_delete_emoji",
    "Delete a custom emoji from a guild",
    { guildId: z.string(), emojiId: z.string() },
    async ({ guildId, emojiId }) => {
      try {
        const guild = await getGuild(guildId);
        const emoji = await guild.emojis.fetch(emojiId);
        await emoji.delete();
        return textResult(`Deleted emoji ${emojiId}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
