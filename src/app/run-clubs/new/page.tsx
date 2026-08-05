"use client";

import { useRouter } from "next/navigation";
import { RequireLogin } from "@/components/require-login";
import { RunClubForm } from "@/components/run-club-form";

export default function NewRunClubPage() {
  const router = useRouter();

  return (
    <RequireLogin message="Log in to add your run club.">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-1 text-lg font-semibold">Add your run club</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          You&apos;ll be the owner and can edit the club and its runs any time.
        </p>

        <RunClubForm
          submitLabel="Create club"
          submittingLabel="Creating…"
          onSubmit={async (payload) => {
            const res = await fetch("/api/run-clubs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
              throw new Error(data.error ?? `Request failed (${res.status})`);
            }
            router.push(`/run-clubs/${encodeURIComponent(data.club.id)}`);
          }}
        />
      </div>
    </RequireLogin>
  );
}
