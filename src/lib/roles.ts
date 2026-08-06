import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getPrisma } from "@/lib/db/prisma";
import { ROLES, type Role, type UserAccount } from "@/lib/types";

/**
 * RBAC roles, stored in user_roles. A user with no row is a plain "user".
 * Admins can do everything moderators can; moderators can edit/delete any
 * race; users can only edit races they submitted.
 */

export async function getUserRole(userId: string): Promise<Role> {
  const row = await getPrisma().rtUserRole.findUnique({
    where: { userId },
    select: { role: true },
  });
  return (ROLES as readonly string[]).includes(row?.role ?? "")
    ? (row!.role as Role)
    : "user";
}

export async function setUserRole(userId: string, role: Role): Promise<void> {
  await getPrisma().rtUserRole.upsert({
    where: { userId },
    create: { userId, role },
    update: { role, updatedAt: new Date() },
  });
}

/** Whether the role may edit/delete races it does not own. */
export function isModerator(role: Role): boolean {
  return role === "admin" || role === "moderator";
}

/**
 * All user accounts with their roles, for the admin page.
 *
 * Accounts live in Supabase Auth, not in our own tables, so this is the one
 * place that still needs the Supabase admin API.
 */
export async function listUsers(): Promise<UserAccount[]> {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const roleRows = await getPrisma().rtUserRole.findMany({
    select: { userId: true, role: true },
  });
  const roleByUser = new Map(roleRows.map((r) => [r.userId, r.role as Role]));

  const users: UserAccount[] = [];
  // auth.admin.listUsers is paginated; walk pages (cap well above expected size).
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(`Failed to list users: ${error.message}`);
    for (const u of data.users) {
      users.push({
        id: u.id,
        email: u.email ?? null,
        role: roleByUser.get(u.id) ?? "user",
        createdAt: u.created_at,
      });
    }
    if (data.users.length < 200) break;
  }

  return users.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
}
