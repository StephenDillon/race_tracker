"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Race, Role } from "@/lib/types";
import { RaceForm } from "@/components/race-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeftIcon, Trash2Icon } from "lucide-react";

interface Me {
  id: string;
  role: Role;
}

export default function EditRacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [race, setRace] = useState<Race | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/races/${encodeURIComponent(id)}`).then((r) =>
        r.ok ? r.json() : { race: null },
      ),
      fetch("/api/auth/me").then((r) => (r.ok ? r.json() : { user: null })),
    ])
      .then(([raceData, meData]: [{ race: Race | null }, { user: Me | null }]) => {
        setRace(raceData.race);
        setMe(meData.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <p className="text-center text-muted-foreground py-8">Loading…</p>;
  }

  const isModerator = me?.role === "admin" || me?.role === "moderator";
  const canEdit = !!race && !!me && (isModerator || race.submittedBy === me.id);

  if (!race || !canEdit) {
    return (
      <div className="mx-auto max-w-md pt-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-muted-foreground">
              {!race
                ? "Race not found."
                : me
                  ? "You can only edit races you submitted."
                  : "Log in to edit races."}
            </p>
            <Button variant="outline" asChild>
              <Link href={race ? `/races/${encodeURIComponent(id)}` : "/"}>
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
    if (!window.confirm(`Delete "${race.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/races/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      router.push("/races");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete race");
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/races/${encodeURIComponent(id)}`}>
            <ArrowLeftIcon className="size-4" />
            Back to race
          </Link>
        </Button>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-lg font-semibold">Edit race</h1>
          <p className="text-sm text-muted-foreground">{race.name}</p>
        </div>
        {isModerator && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2Icon className="size-4" />
            {deleting ? "Deleting…" : "Delete race"}
          </Button>
        )}
      </div>

      {deleteError && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {deleteError}
        </div>
      )}

      <RaceForm
        initial={race}
        submitLabel="Save changes"
        submittingLabel="Saving…"
        onSubmit={async (payload) => {
          const res = await fetch(`/api/races/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error ?? `Request failed (${res.status})`);
          }
          router.push(`/races/${encodeURIComponent(id)}`);
        }}
      />
    </div>
  );
}
