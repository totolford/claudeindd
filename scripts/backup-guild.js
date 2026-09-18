// Sauvegarde la structure d'un serveur Discord (roles + salons + permissions + emojis,
// PAS les messages) vers un second serveur "backup", en reconstruisant tout dessus.
// Re-executable : garde un fichier de correspondance (ancien id -> id sur le serveur de
// backup) pour mettre a jour au lieu de dupliquer a chaque lancement.
//
// Usage:
//   node scripts/backup-guild.js <sourceGuildId> <targetGuildId>
//
// Necessite DISCORD_TOKEN dans .env (le bot doit etre present sur les deux serveurs,
// avec la permission Administrator recommandee sur le serveur cible).
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API = "https://discord.com/api/v10";
const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error("DISCORD_TOKEN manquant dans .env");
  process.exit(1);
}

const [, , sourceGuildId, targetGuildId] = process.argv;
if (!sourceGuildId || !targetGuildId) {
  console.error("Usage: node scripts/backup-guild.js <sourceGuildId> <targetGuildId>");
  process.exit(1);
}

const MAP_DIR = path.join(__dirname, ".backup-maps");
fs.mkdirSync(MAP_DIR, { recursive: true });
const MAP_PATH = path.join(MAP_DIR, `${sourceGuildId}-${targetGuildId}.json`);

function loadMap() {
  if (!fs.existsSync(MAP_PATH)) return { roles: {}, channels: {}, emojis: {} };
  return JSON.parse(fs.readFileSync(MAP_PATH, "utf8"));
}
function saveMap(map) {
  fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 2) + "\n");
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function api(method, endpoint, body) {
  for (;;) {
    const res = await fetch(`${API}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bot ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      const retryAfter = (data.retry_after ?? 1) * 1000 + 100;
      console.log(`  (rate limited, attente ${Math.round(retryAfter)}ms)`);
      await sleep(retryAfter);
      continue;
    }

    if (res.status === 204) return null;

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) {
      throw new Error(`${method} ${endpoint} -> ${res.status}: ${text}`);
    }

    await sleep(300); // marge de securite contre le rate limit global
    return data;
  }
}

const TEXT_CAPABLE_TYPES = new Set([0, 5, 15]); // GUILD_TEXT, GUILD_ANNOUNCEMENT, GUILD_FORUM

function translateOverwrites(overwrites, roleMap, sourceGuildId, targetGuildId) {
  const out = [];
  for (const ow of overwrites ?? []) {
    if (ow.type === 0) {
      const newId = ow.id === sourceGuildId ? targetGuildId : roleMap[ow.id];
      if (!newId) continue; // role non synchronisee (ex: role gere par une integration)
      out.push({ id: newId, type: 0, allow: ow.allow, deny: ow.deny });
    } else {
      // type 1 = membre : meme id Discord sur tous les serveurs, pas de traduction necessaire
      out.push({ id: ow.id, type: 1, allow: ow.allow, deny: ow.deny });
    }
  }
  return out;
}

async function syncRoles(map) {
  console.log("== Roles ==");
  const [sourceRoles, targetRoles] = await Promise.all([
    api("GET", `/guilds/${sourceGuildId}/roles`),
    api("GET", `/guilds/${targetGuildId}/roles`),
  ]);
  const targetById = new Map(targetRoles.map((r) => [r.id, r]));

  const syncable = sourceRoles
    .filter((r) => r.id !== sourceGuildId && !r.managed)
    .sort((a, b) => a.position - b.position);

  for (const role of syncable) {
    const payload = {
      name: role.name,
      color: role.color,
      hoist: role.hoist,
      mentionable: role.mentionable,
      permissions: role.permissions,
    };

    const existingId = map.roles[role.id];
    if (existingId && targetById.has(existingId)) {
      await api("PATCH", `/guilds/${targetGuildId}/roles/${existingId}`, payload);
      console.log(`  maj: ${role.name}`);
    } else {
      const created = await api("POST", `/guilds/${targetGuildId}/roles`, payload);
      map.roles[role.id] = created.id;
      saveMap(map);
      console.log(`  cree: ${role.name}`);
    }
  }

  const positions = syncable
    .map((role, i) => ({ id: map.roles[role.id], position: i + 1 }))
    .filter((p) => p.id);
  if (positions.length > 0) {
    try {
      await api("PATCH", `/guilds/${targetGuildId}/roles`, positions);
      console.log(`  positions mises a jour (${positions.length} roles)`);
    } catch (err) {
      console.log(`  ATTENTION: impossible de reordonner les roles (${err.message}).`);
      console.log(`  -> Le role du bot doit etre place au-dessus des roles synchronises sur le serveur cible.`);
    }
  }

  console.log(`Roles synchronisees: ${syncable.length}`);
}

async function syncChannels(map) {
  console.log("== Salons ==");
  const sourceChannels = await api("GET", `/guilds/${sourceGuildId}/channels`);
  const targetChannels = await api("GET", `/guilds/${targetGuildId}/channels`);
  const targetById = new Map(targetChannels.map((c) => [c.id, c]));

  const categories = sourceChannels.filter((c) => c.type === 4).sort((a, b) => a.position - b.position);
  const others = sourceChannels.filter((c) => c.type !== 4).sort((a, b) => a.position - b.position);

  async function syncOne(channel) {
    const topicNote = `ID original: ${channel.id}`;
    const topic = TEXT_CAPABLE_TYPES.has(channel.type)
      ? [channel.topic, `[Backup] ${topicNote}`].filter(Boolean).join(" | ").slice(0, 1024)
      : undefined;

    const basePayload = {
      name: channel.name,
      type: channel.type,
      position: channel.position,
      nsfw: channel.nsfw,
      rate_limit_per_user: channel.rate_limit_per_user,
      bitrate: channel.bitrate,
      user_limit: channel.user_limit,
      parent_id: channel.parent_id ? map.channels[channel.parent_id] ?? null : null,
    };
    if (topic !== undefined) basePayload.topic = topic;

    const existingId = map.channels[channel.id];
    let targetId;
    if (existingId && targetById.has(existingId)) {
      await api("PATCH", `/channels/${existingId}`, basePayload);
      targetId = existingId;
      console.log(`  maj: ${channel.name} (${["text", "?", "voice", "?", "categorie"][channel.type] ?? channel.type})`);
    } else {
      const created = await api("POST", `/guilds/${targetGuildId}/channels`, basePayload);
      targetId = created.id;
      map.channels[channel.id] = targetId;
      saveMap(map);
      console.log(`  cree: ${channel.name}`);
    }

    const overwrites = translateOverwrites(channel.permission_overwrites, map.roles, sourceGuildId, targetGuildId);
    if (overwrites.length > 0) {
      await api("PATCH", `/channels/${targetId}`, { permission_overwrites: overwrites });
    }
  }

  for (const cat of categories) await syncOne(cat);
  for (const ch of others) await syncOne(ch);

  console.log(`Salons synchronises: ${categories.length + others.length}`);
}

async function syncEmojis(map) {
  console.log("== Emojis ==");
  const sourceEmojis = await api("GET", `/guilds/${sourceGuildId}/emojis`);
  const targetEmojis = await api("GET", `/guilds/${targetGuildId}/emojis`);
  const targetById = new Set(targetEmojis.map((e) => e.id));

  let created = 0;
  for (const emoji of sourceEmojis) {
    if (emoji.managed) continue;
    const existingId = map.emojis[emoji.id];
    if (existingId && targetById.has(existingId)) continue;

    const ext = emoji.animated ? "gif" : "png";
    const res = await fetch(`https://cdn.discordapp.com/emojis/${emoji.id}.${ext}`);
    if (!res.ok) {
      console.log(`  echec telechargement: ${emoji.name}`);
      continue;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const dataUri = `data:image/${ext === "gif" ? "gif" : "png"};base64,${buffer.toString("base64")}`;

    try {
      const createdEmoji = await api("POST", `/guilds/${targetGuildId}/emojis`, { name: emoji.name, image: dataUri });
      map.emojis[emoji.id] = createdEmoji.id;
      saveMap(map);
      created++;
      console.log(`  cree: ${emoji.name}`);
    } catch (err) {
      console.log(`  echec creation ${emoji.name}: ${err.message}`);
    }
  }
  console.log(`Emojis crees: ${created}`);
}

async function main() {
  console.log(`Backup ${sourceGuildId} -> ${targetGuildId}`);
  const map = loadMap();

  await syncRoles(map);
  await syncChannels(map);
  await syncEmojis(map);

  console.log("\nTermine. Correspondances sauvegardees dans:", MAP_PATH);
}

main().catch((err) => {
  console.error("Erreur fatale:", err);
  process.exit(1);
});
