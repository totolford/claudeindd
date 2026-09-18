// Sauvegarde la structure d'un serveur Discord (roles + salons + permissions + emojis,
// PAS les messages) vers un second serveur "backup", en reconstruisant tout dessus.
// Re-executable : garde un fichier de correspondance (ancien id -> id sur le serveur de
// backup) pour mettre a jour au lieu de dupliquer a chaque lancement.
//
// Exporter/rafraichir la backup (realId -> backupId), cree ce qui manque :
//   node scripts/backup-guild.js <realGuildId> <backupGuildId>
//
// Restaurer depuis la backup vers le serveur reel (backupId -> realId), MET A JOUR
// uniquement ce qui a deja ete backup une fois (ne recree jamais un role/salon
// supprime entre temps sur le serveur reel, pour rester une operation sans risque) :
//   node scripts/backup-guild.js <realGuildId> <backupGuildId> --restore
//
// Les deux commandes utilisent toujours l'ordre <realGuildId> <backupGuildId> et
// partagent le meme fichier de correspondance.
//
// Necessite DISCORD_TOKEN dans .env (le bot doit etre present sur les deux serveurs,
// avec la permission Administrator recommandee).
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

const args = process.argv.slice(2).filter((a) => a !== "--restore");
const restore = process.argv.includes("--restore");
const [realGuildId, backupGuildId] = args;
if (!realGuildId || !backupGuildId) {
  console.error("Usage: node scripts/backup-guild.js <realGuildId> <backupGuildId> [--restore]");
  process.exit(1);
}

// En mode normal on lit le serveur reel et on ecrit sur la backup (creation autorisee).
// En mode --restore on lit la backup et on ecrit sur le serveur reel (mise a jour
// uniquement : on ne recree jamais un objet supprime depuis, par securite).
const readGuildId = restore ? backupGuildId : realGuildId;
const writeGuildId = restore ? realGuildId : backupGuildId;
const allowCreate = !restore;

const MAP_DIR = path.join(__dirname, ".backup-maps");
fs.mkdirSync(MAP_DIR, { recursive: true });
const MAP_PATH = path.join(MAP_DIR, `${realGuildId}-${backupGuildId}.json`);

function loadMap() {
  if (!fs.existsSync(MAP_PATH)) return { roles: {}, channels: {}, emojis: {} };
  return JSON.parse(fs.readFileSync(MAP_PATH, "utf8"));
}
function saveMap(map) {
  fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 2) + "\n");
}

// map.roles/channels/emojis sont toujours stockes realId -> backupId, quel que soit le
// sens de l'operation. reversed() les lit dans le bon sens pour le mode en cours.
function reversed(section) {
  if (!restore) return section;
  return Object.fromEntries(Object.entries(section).map(([realId, backupId]) => [backupId, realId]));
}
function record(section, key, value) {
  // key/value sont toujours (id lu -> id ecrit) ; on les range en realId -> backupId.
  if (restore) section[value] = key;
  else section[key] = value;
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

function translateOverwrites(overwrites, roleMap) {
  const out = [];
  for (const ow of overwrites ?? []) {
    if (ow.type === 0) {
      const newId = ow.id === readGuildId ? writeGuildId : roleMap[ow.id];
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
  const roleMap = reversed(map.roles);
  const [readRoles, writeRoles] = await Promise.all([
    api("GET", `/guilds/${readGuildId}/roles`),
    api("GET", `/guilds/${writeGuildId}/roles`),
  ]);
  const writeById = new Map(writeRoles.map((r) => [r.id, r]));

  const syncable = readRoles
    .filter((r) => r.id !== readGuildId && !r.managed)
    .sort((a, b) => a.position - b.position);

  let skipped = 0;
  for (const role of syncable) {
    const payload = {
      name: role.name,
      color: role.color,
      hoist: role.hoist,
      mentionable: role.mentionable,
      permissions: role.permissions,
    };

    const existingId = roleMap[role.id];
    if (existingId && writeById.has(existingId)) {
      await api("PATCH", `/guilds/${writeGuildId}/roles/${existingId}`, payload);
      console.log(`  maj: ${role.name}`);
    } else if (allowCreate) {
      const created = await api("POST", `/guilds/${writeGuildId}/roles`, payload);
      record(map.roles, role.id, created.id);
      saveMap(map);
      console.log(`  cree: ${role.name}`);
    } else {
      console.log(`  ignore (supprime depuis la backup, non recree): ${role.name}`);
      skipped++;
    }
  }

  const positions = syncable
    .map((role, i) => ({ id: reversed(map.roles)[role.id], position: i + 1 }))
    .filter((p) => p.id);
  if (positions.length > 0) {
    try {
      await api("PATCH", `/guilds/${writeGuildId}/roles`, positions);
      console.log(`  positions mises a jour (${positions.length} roles)`);
    } catch (err) {
      console.log(`  ATTENTION: impossible de reordonner les roles (${err.message}).`);
      console.log(`  -> Le role du bot doit etre place au-dessus des roles synchronises sur ce serveur.`);
    }
  }

  console.log(`Roles traitees: ${syncable.length}${skipped ? ` (${skipped} ignorees)` : ""}`);
}

async function syncChannels(map) {
  console.log("== Salons ==");
  const readChannels = await api("GET", `/guilds/${readGuildId}/channels`);
  const writeChannels = await api("GET", `/guilds/${writeGuildId}/channels`);
  const writeById = new Map(writeChannels.map((c) => [c.id, c]));

  const categories = readChannels.filter((c) => c.type === 4).sort((a, b) => a.position - b.position);
  const others = readChannels.filter((c) => c.type !== 4).sort((a, b) => a.position - b.position);

  let skipped = 0;

  async function syncOne(channel) {
    const channelMap = reversed(map.channels);
    const roleMap = reversed(map.roles);

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
      parent_id: channel.parent_id ? channelMap[channel.parent_id] ?? null : null,
    };
    if (!restore && topic !== undefined) basePayload.topic = topic;

    const existingId = channelMap[channel.id];
    let writeId;
    if (existingId && writeById.has(existingId)) {
      await api("PATCH", `/channels/${existingId}`, basePayload);
      writeId = existingId;
      console.log(`  maj: ${channel.name}`);
    } else if (allowCreate) {
      const created = await api("POST", `/guilds/${writeGuildId}/channels`, basePayload);
      writeId = created.id;
      record(map.channels, channel.id, writeId);
      saveMap(map);
      console.log(`  cree: ${channel.name}`);
    } else {
      console.log(`  ignore (supprime depuis la backup, non recree): ${channel.name}`);
      skipped++;
      return;
    }

    const overwrites = translateOverwrites(channel.permission_overwrites, roleMap);
    if (overwrites.length > 0) {
      await api("PATCH", `/channels/${writeId}`, { permission_overwrites: overwrites });
    }
  }

  for (const cat of categories) await syncOne(cat);
  for (const ch of others) await syncOne(ch);

  console.log(`Salons traites: ${categories.length + others.length}${skipped ? ` (${skipped} ignores)` : ""}`);
}

async function syncEmojis(map) {
  console.log("== Emojis ==");
  const emojiMap = reversed(map.emojis);
  const readEmojis = await api("GET", `/guilds/${readGuildId}/emojis`);
  const writeEmojis = await api("GET", `/guilds/${writeGuildId}/emojis`);
  const writeById = new Set(writeEmojis.map((e) => e.id));

  let created = 0;
  for (const emoji of readEmojis) {
    if (emoji.managed) continue;
    const existingId = emojiMap[emoji.id];
    if (existingId && writeById.has(existingId)) continue;
    if (!allowCreate) continue;

    const ext = emoji.animated ? "gif" : "png";
    const res = await fetch(`https://cdn.discordapp.com/emojis/${emoji.id}.${ext}`);
    if (!res.ok) {
      console.log(`  echec telechargement: ${emoji.name}`);
      continue;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const dataUri = `data:image/${ext === "gif" ? "gif" : "png"};base64,${buffer.toString("base64")}`;

    try {
      const createdEmoji = await api("POST", `/guilds/${writeGuildId}/emojis`, { name: emoji.name, image: dataUri });
      record(map.emojis, emoji.id, createdEmoji.id);
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
  console.log(restore ? `Restauration ${backupGuildId} -> ${realGuildId}` : `Backup ${realGuildId} -> ${backupGuildId}`);
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
