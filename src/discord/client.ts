import { Client, GatewayIntentBits, Partials } from "discord.js";
import { config } from "../config.js";

export const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

let ready: Promise<void> | undefined;

export function connectDiscord(): Promise<void> {
  if (!ready) {
    ready = new Promise((resolve, reject) => {
      discordClient.once("ready", () => resolve());
      discordClient.once("error", reject);
      discordClient.login(config.discordToken).catch(reject);
    });
  }
  return ready;
}
