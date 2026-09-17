# claudeindd

Bot Discord auto-hébergé qui expose le contrôle complet d'un serveur Discord (salons, rôles, membres, permissions, messages) sous forme d'outils MCP, pour qu'un client IA (Claude Desktop, Claude Code, etc.) puisse piloter le serveur.

## Setup

1. Copier `.env.example` en `.env` et renseigner `DISCORD_TOKEN` (token du bot, depuis le [Discord Developer Portal](https://discord.com/developers/applications)).
2. Inviter le bot sur le serveur avec les permissions nécessaires (scope `bot`, permission `Administrator` recommandé vu l'étendue des actions).
3. Activer les **Privileged Gateway Intents** suivants dans le portail développeur : `SERVER MEMBERS INTENT` et `MESSAGE CONTENT INTENT`.
4. Double-cliquer **`start.bat`**. Il installe les dépendances si besoin, connecte le bot Discord, puis démarre le serveur MCP. Fermer la fenêtre arrête tout (bot + serveur MCP).

La fenêtre affiche l'URL du serveur MCP une fois prêt : `http://localhost:3939/mcp` (port configurable via la variable d'environnement `MCP_PORT`).

## Connecter un client MCP

Le serveur tourne en **Streamable HTTP** (pas en stdio) : lance `start.bat` d'abord, puis connecte ton client à l'URL affichée. Dans Claude Desktop (`claude_desktop_config.json`) :

```json
{
  "mcpServers": {
    "claudeindd": {
      "url": "http://localhost:3939/mcp"
    }
  }
}
```

Le serveur n'est pas exposé à l'extérieur de ta machine (localhost uniquement).

## Outils MCP disponibles

- **Messages** : `discord_send_message`, `discord_send_file` (zip, images, documents — jusqu'à 10 fichiers, 25MB chacun, contenu en base64), `discord_read_messages`, `discord_edit_message`, `discord_delete_message`
- **Salons** : `discord_list_channels`, `discord_create_channel`, `discord_delete_channel`, `discord_edit_channel` (nom, topic, catégorie/déplacement, position, NSFW, slowmode, bitrate, limite d'utilisateurs vocaux)
- **Membres** : `discord_list_members`, `discord_kick_member`, `discord_ban_member`, `discord_unban_member`, `discord_timeout_member`
- **Rôles** : `discord_list_roles`, `discord_create_role` (nom, couleur, permissions, icône/emoji), `discord_delete_role`, `discord_edit_role` (idem création), `discord_set_role_position` (hiérarchie), `discord_add_role_to_member`, `discord_remove_role_from_member`
- **Permissions** : `discord_set_channel_permission_overwrite`, `discord_remove_channel_permission_overwrite`, `discord_get_channel_permissions`

## Sécurité

Ce bot donne un accès total et sans confirmation au serveur Discord connecté (bannissement, suppression de salons, modification de permissions...). Le token dans `.env` ne doit jamais être commité ni partagé. Le degré de confiance accordé au client IA connecté doit être équivalent à celui d'un administrateur du serveur.
