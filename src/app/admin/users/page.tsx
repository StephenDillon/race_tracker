"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROLES, type Role, type UserAccount } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShieldIcon } from "lucide-react";

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  moderator: "Moderator",
  user: "User",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/users"),
      fetch("/api/auth/me").then((r) => (r.ok ? r.json() : { user: null })),
    ])
      .then(async ([res, meData]: [Response, { user: { id: string } | null }]) => {
        setMyId(meData.user?.id ?? null);
        if (res.status === 401 || res.status === 403) {
          setDenied(true);
          return;
        }
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data: { users: UserAccount[] } = await res.json();
        setUsers(data.users);
      })
      .catch(() => setDenied(true))
      .finally(() => setLoading(false));
  }, []);

  const changeRole = async (userId: string, role: Role) => {
    const previous = users;
    setError(null);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role } : u)),
    );
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
    } catch (err) {
      setUsers(previous);
      setError(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  if (loading) {
    return <p className="text-center text-muted-foreground py-8">Loading…</p>;
  }

  if (denied) {
    return (
      <div className="mx-auto max-w-md pt-8">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            This page is for admins only.{" "}
            <Link href="/races" className="text-primary underline">
              Back to races
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldIcon className="size-5" />
            User permissions
          </CardTitle>
          <CardDescription>
            Admins manage roles; moderators can edit or delete any race; users
            can only edit races they submitted. You cannot change your own role.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-40">Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.email ?? user.id}
                    {user.id === myId && (
                      <Badge variant="secondary" className="ml-2">
                        You
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(user.createdAt.slice(0, 10))}</TableCell>
                  <TableCell>
                    {user.id === myId ? (
                      <span className="text-sm">{ROLE_LABELS[user.role]}</span>
                    ) : (
                      <Select
                        value={user.role}
                        onValueChange={(v) => changeRole(user.id, v as Role)}
                      >
                        <SelectTrigger
                          className="w-full"
                          aria-label={`Role for ${user.email ?? user.id}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
