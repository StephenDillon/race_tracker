"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Role, RunClub } from "@/lib/types";
import { RunClubForm } from "@/components/run-club-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeftIcon, Trash2Icon } from "lucide-react";

interface Me {
  id: string;
  role: Role;
}

export default function EditRunClubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [club, setClub] = useState<RunClub | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/run-clubs/${encodeURIComponent(id)}`).then((r) =>
        r.ok ? r.json() : { club: null },
      ),
      fetch("/api/auth/me").then((r) => (r.ok ? r.json() : { user: null })),
    ])
      .then(([clubData, meData]: [{ club: RunClub | null }, { user: Me | null }]) => {
        setClub(clubData.club);
        setMe(meData.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <p className="text-center text-muted-foreground py-8">Loading…</p>;
  }

  const isModerator = me?.role === "admin" || me?.role === "moderator";
  const canEdit = !!club && !!me && (isModerator || club.ownerId === me.id);

  if (!club || !canEdit) {
    return (
      <div className="mx-auto max-w-md pt-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-muted-foreground">
              {!club
                ? "Run club not found."
                : me
                  ? "You can only edit run clubs you own."
                  : "Log in to edit run clubs."}
            </p>
            <Button variant="outline" asChild>
              <Link href={club ? `/run-clubs/${encodeURIComponent(id)}` : "/run-clubs"}>
                <ArrowLeftIcon className="size-4" />
                Back
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${club.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/run-clubs/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      router.push("/run-clubs");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete run club");
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/run-clubs/${encodeURIComponent(id)}`}>
            <ArrowLeftIcon className="size-4" />
            Back to club
          </Link>
        </Button>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-lg font-semibold">Edit run club</h1>
          <p className="text-sm text-muted-foreground">{club.name}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={handleDelete}
          disabled={deleting}
        >
          <Trash2Icon className="size-4" />
          {deleting ? "Deleting…" : "Delete club"}
        </Button>
      </div>

      {deleteError && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {deleteError}
        </div>
      )}

      <RunClubForm
        initial={club}
        submitLabel="Save changes"
        submittingLabel="Saving…"
        onSubmit={async (payload) => {
          const res = await fetch(`/api/run-clubs/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error ?? `Request failed (${res.status})`);
          }
          router.push(`/run-clubs/${encodeURIComponent(id)}`);
        }}
      />
    </div>
  );
}
