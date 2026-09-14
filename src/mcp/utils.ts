import { discordClient } from "../discord/client.js";

export async function getGuild(guildId: string) {
  const guild = discordClient.guilds.cache.get(guildId) ?? (await discordClient.guilds.fetch(guildId));
  if (!guild) {
    throw new Error(`Guild not found: ${guildId}`);
  }
  return guild;
}

export function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
}
