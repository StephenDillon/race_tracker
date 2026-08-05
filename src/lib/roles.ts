import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ROLES, type Role, type UserAccount } from "@/lib/types";

/**
 * RBAC roles, stored in rt_user_roles. A user with no row is a plain "user".
 * Admins can do everything moderators can; moderators can edit/delete any
 * race; users can only edit races they submitted.
 */

const TABLE = "rt_user_roles";

const globalCache = globalThis as unknown as { __rtRolesClient?: SupabaseClient };

function getClient(): SupabaseClient {
  if (!globalCache.__rtRolesClient) {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    }
    globalCache.__rtRolesClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return globalCache.__rtRolesClient;
}

export async function getUserRole(userId: string): Promise<Role> {
  const { data, error } = await getClient()
    .from(TABLE)
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to get user role: ${error.message}`);
  const role = (data as { role: string } | null)?.role;
  return (ROLES as readonly string[]).includes(role ?? "") ? (role as Role) : "user";
}

export async function setUserRole(userId: string, role: Role): Promise<void> {
  const { error } = await getClient()
    .from(TABLE)
    .upsert({ user_id: userId, role, updated_at: new Date().toISOString() });

  if (error) throw new Error(`Failed to set user role: ${error.message}`);
}

/** Whether the role may edit/delete races it does not own. */
export function isModerator(role: Role): boolean {
  return role === "admin" || role === "moderator";
}

/** All user accounts with their roles, for the admin page. */
export async function listUsers(): Promise<UserAccount[]> {
  const client = getClient();

  const { data: roleRows, error: rolesError } = await client
    .from(TABLE)
    .select("user_id, role");
  if (rolesError) throw new Error(`Failed to list roles: ${rolesError.message}`);
  const roleByUser = new Map(
    (roleRows as { user_id: string; role: Role }[]).map((r) => [r.user_id, r.role]),
  );

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
