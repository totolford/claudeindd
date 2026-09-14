import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getGuild, textResult, errorResult } from "../utils.js";

export function registerRoleTools(server: McpServer): void {
  server.tool(
    "discord_list_roles",
    "Lists roles in a guild with id, name, color, and position",
    { guildId: z.string() },
    async ({ guildId }) => {
      try {
        const guild = await getGuild(guildId);
        const roles = await guild.roles.fetch();
        const lines = roles.map(
          (r) => `${r.id} | ${r.name} | ${r.hexColor} | position ${r.position}`
        );
        return textResult(lines.length > 0 ? lines.join("\n") : "No roles found.");
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "discord_create_role",
    "Creates a new role in the guild",
    {
      guildId: z.string(),
      name: z.string(),
      color: z.string().optional(),
      hoist: z.boolean().optional(),
      mentionable: z.boolean().optional(),
    },
    async ({ guildId, name, color, hoist, mentionable }) => {
      try {
        const guild = await getGuild(guildId);
        const role = await guild.roles.create({
          name,
          color: color as `#${string}` | undefined,
          hoist,
          mentionable,
        });
        return textResult(`Created role ${role.name} (${role.id}).`);
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
        const guild = await getGuild(guildId);
        const role = await guild.roles.fetch(roleId);
        if (!role) throw new Error(`Role not found: ${roleId}`);
        await role.delete();
        return textResult(`Deleted role ${roleId}.`);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "discord_edit_role",
    "Edits an existing role",
    {
      guildId: z.string(),
      roleId: z.string(),
      name: z.string().optional(),
      color: z.string().optional(),
      hoist: z.boolean().optional(),
      mentionable: z.boolean().optional(),
    },
    async ({ guildId, roleId, name, color, hoist, mentionable }) => {
      try {
        const guild = await getGuild(guildId);
        const role = await guild.roles.fetch(roleId);
        if (!role) throw new Error(`Role not found: ${roleId}`);
        await role.edit({
          name,
          color: color as `#${string}` | undefined,
          hoist,
          mentionable,
        });
        return textResult(`Edited role ${roleId}.`);
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
