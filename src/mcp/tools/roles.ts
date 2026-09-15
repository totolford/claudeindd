import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PermissionsBitField } from "discord.js";
import { getGuild, textResult, errorResult, toPermissionFlags } from "../utils.js";

async function fetchRole(guildId: string, roleId: string) {
  const guild = await getGuild(guildId);
  const role = await guild.roles.fetch(roleId);
  if (!role) throw new Error(`Role not found: ${roleId}`);
  return role;
}

export function registerRoleTools(server: McpServer): void {
  server.tool(
    "discord_list_roles",
    "Lists roles in a guild with id, name, color, position, and permissions",
    { guildId: z.string() },
    async ({ guildId }) => {
      try {
        const guild = await getGuild(guildId);
        const roles = await guild.roles.fetch();
        const sorted = [...roles.values()].sort((a, b) => b.position - a.position);
        const lines = sorted.map(
          (r) => `${r.id} | ${r.name} | ${r.hexColor} | position ${r.position} | permissions: ${r.permissions.toArray().join(", ") || "none"}`
        );
        return textResult(lines.length > 0 ? lines.join("\n") : "No roles found.");
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "discord_create_role",
    "Creates a new role in the guild, optionally with a full permission set and an icon or emoji",
    {
      guildId: z.string(),
      name: z.string(),
      color: z.string().optional().describe("Hex color, e.g. #ff0000"),
      hoist: z.boolean().optional().describe("Display members with this role separately in the member list"),
      mentionable: z.boolean().optional(),
      permissions: z.array(z.string()).optional().describe("Full permission set for the role, e.g. [\"ManageMessages\", \"KickMembers\"]"),
      icon: z.string().optional().describe("Role icon as a URL or base64 data URI (requires guild ROLE_ICONS feature)"),
      unicodeEmoji: z.string().optional().describe("Emoji to use as the role icon instead of a custom image"),
    },
    async ({ guildId, name, color, hoist, mentionable, permissions, icon, unicodeEmoji }) => {
      try {
        const guild = await getGuild(guildId);
        const permissionBits = permissions ? new PermissionsBitField(toPermissionFlags(permissions)) : undefined;
        const role = await guild.roles.create({
          name,
          color: color as `#${string}` | undefined,
          hoist,
          mentionable,
          permissions: permissionBits,
          icon,
          unicodeEmoji,
        });
        return textResult(`Created role ${role.name} (${role.id}) at position ${role.position}.`);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "discord_delete_role",
    "Deletes a role from the guild",
    { guildId: z.string(), roleId: z.string() },
    async ({ guildId, roleId }) => {
      try {
        const role = await fetchRole(guildId, roleId);
        await role.delete();
        return textResult(`Deleted role ${roleId}.`);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "discord_edit_role",
    "Edits an existing role's name, color, permissions, hoist/mentionable flags, or icon/emoji",
    {
      guildId: z.string(),
      roleId: z.string(),
      name: z.string().optional(),
      color: z.string().optional().describe("Hex color, e.g. #ff0000"),
      hoist: z.boolean().optional(),
      mentionable: z.boolean().optional(),
      permissions: z.array(z.string()).optional().describe("Replaces the role's full permission set"),
      icon: z.string().optional().describe("Role icon as a URL or base64 data URI"),
      unicodeEmoji: z.string().optional(),
    },
    async ({ guildId, roleId, name, color, hoist, mentionable, permissions, icon, unicodeEmoji }) => {
      try {
        const role = await fetchRole(guildId, roleId);
        const permissionBits = permissions ? new PermissionsBitField(toPermissionFlags(permissions)) : undefined;
        await role.edit({
          name,
          color: color as `#${string}` | undefined,
          hoist,
          mentionable,
          permissions: permissionBits,
          icon,
          unicodeEmoji,
        });
        return textResult(`Edited role ${roleId}.`);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "discord_set_role_position",
    "Moves a role to a new position in the guild's role hierarchy (higher number = higher in the list)",
    { guildId: z.string(), roleId: z.string(), position: z.number().int().min(0) },
    async ({ guildId, roleId, position }) => {
      try {
        const guild = await getGuild(guildId);
        const role = await fetchRole(guildId, roleId);
        await guild.roles.setPosition(role, position);
        return textResult(`Moved role ${roleId} to position ${position}.`);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "discord_add_role_to_member",
    "Adds a role to a guild member",
    { guildId: z.string(), userId: z.string(), roleId: z.string() },
    async ({ guildId, userId, roleId }) => {
      try {
        const guild = await getGuild(guildId);
        const member = await guild.members.fetch(userId);
        await member.roles.add(roleId);
        return textResult(`Added role ${roleId} to ${member.user.username}.`);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "discord_remove_role_from_member",
    "Removes a role from a guild member",
    { guildId: z.string(), userId: z.string(), roleId: z.string() },
    async ({ guildId, userId, roleId }) => {
      try {
        const guild = await getGuild(guildId);
        const member = await guild.members.fetch(userId);
        await member.roles.remove(roleId);
        return textResult(`Removed role ${roleId} from ${member.user.username}.`);
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}
