# claudeindd

Bot Discord auto-hébergé qui expose le contrôle complet d'un serveur Discord (salons, rôles, membres, permissions, messages) sous forme d'outils MCP, pour qu'un client IA (Claude Desktop, Claude Code, etc.) puisse piloter le serveur.

## Setup

1. `npm install`
2. Copier `.env.example` en `.env` et renseigner `DISCORD_TOKEN` (token du bot, depuis le [Discord Developer Portal](https://discord.com/developers/applications)).
3. Inviter le bot sur le serveur avec les permissions nécessaires (scope `bot`, permission `Administrator` recommandé vu l'étendue des actions).
4. Activer les **Privileged Gateway Intents** suivants dans le portail développeur : `SERVER MEMBERS INTENT` et `MESSAGE CONTENT INTENT`.
5. `npm run build` puis `npm start` (ou `npm run dev` pour lancer directement en TypeScript).

## Connecter un client MCP (Claude Desktop)

Ajouter dans `claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "claudeindd": {
      "command": "node",
      "args": ["C:/Users/anato/Random/claudeindd/dist/index.js"]
    }
  }
}
```

Ou en dev direct avec tsx :

```json
{
  "mcpServers": {
    "claudeindd": {
      "command": "npx",
      "args": ["tsx", "C:/Users/anato/Random/claudeindd/src/index.ts"]
    }
  }
}
```

## Outils MCP disponibles

- **Messages** : `discord_send_message`, `discord_read_messages`, `discord_edit_message`, `discord_delete_message`
- **Salons** : `discord_list_channels`, `discord_create_channel`, `discord_delete_channel`, `discord_edit_channel`
- **Membres** : `discord_list_members`, `discord_kick_member`, `discord_ban_member`, `discord_unban_member`, `discord_timeout_member`
- **Rôles** : `discord_list_roles`, `discord_create_role`, `discord_delete_role`, `discord_edit_role`, `discord_add_role_to_member`, `discord_remove_role_from_member`
- **Permissions** : `discord_set_channel_permission_overwrite`, `discord_remove_channel_permission_overwrite`, `discord_get_channel_permissions`

## Sécurité

Ce bot donne un accès total et sans confirmation au serveur Discord connecté (bannissement, suppression de salons, modification de permissions...). Le token dans `.env` ne doit jamais être commité ni partagé. Le degré de confiance accordé au client IA connecté doit être équivalent à celui d'un administrateur du serveur.
