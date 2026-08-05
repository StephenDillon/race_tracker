"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { ApiKeyMeta } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckIcon, CopyIcon, KeyRoundIcon } from "lucide-react";

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKeyMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedOut, setLoggedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  /** Full key returned once at creation, shown in the dialog. */
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/api-keys");
      if (res.status === 401) {
        setLoggedOut(true);
        return;
      }
      if (!res.ok) return;
      const data: { keys: ApiKeyMeta[] } = await res.json();
      setKeys(data.keys);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setKeys((prev) => [data.apiKey, ...prev]);
      setNewKey(data.key);
      setCopied(false);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (keyId: string) => {
    setKeys((prev) =>
      prev.map((k) => (k.id === keyId ? { ...k, revoked: true } : k)),
    );
    await fetch(`/api/api-keys/${encodeURIComponent(keyId)}`, {
      method: "DELETE",
    });
  };

  const copyKey = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
  };

  if (loading) {
    return <p className="text-center text-muted-foreground py-8">Loading…</p>;
  }

  if (loggedOut) {
    return (
      <div className="mx-auto max-w-md pt-8">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Link href="/login" className="text-primary underline">
              Log in
            </Link>{" "}
            to manage your settings.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRoundIcon className="size-5" />
            API keys
          </CardTitle>
          <CardDescription>
            Keys authenticate REST API requests as you via the{" "}
            <code className="font-mono text-xs">Authorization: Bearer</code>{" "}
            header — for example to submit races to{" "}
            <code className="font-mono text-xs">POST /api/races</code> or manage
            your saved races at{" "}
            <code className="font-mono text-xs">/api/user-races</code>. Each key
            is limited to 100 requests per hour. A key is shown only once, at
            creation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={createKey} className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="key-name">Key name</Label>
              <Input
                id="key-name"
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My race-submitting agent"
              />
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? "Creating…" : "Create key"}
            </Button>
          </form>

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {keys.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No API keys yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {key.keyPrefix}…
                    </TableCell>
                    <TableCell>{formatDate(key.createdAt.slice(0, 10))}</TableCell>
                    <TableCell>
                      {key.lastUsedAt ? formatDate(key.lastUsedAt.slice(0, 10)) : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      {key.revoked ? (
                        <Badge variant="secondary">Revoked</Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => revokeKey(key.id)}
                        >
                          Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={newKey !== null} onOpenChange={(open) => !open && setNewKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API key created</DialogTitle>
            <DialogDescription>
              Copy this key now — it will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg border bg-muted p-3 font-mono text-xs">
              {newKey}
            </code>
            <Button variant="outline" size="icon" onClick={copyKey} aria-label="Copy API key">
              {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Use it as{" "}
            <code className="font-mono">
              Authorization: Bearer {newKey?.slice(0, 11)}…
            </code>
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
