"use client";

import { useRouter } from "next/navigation";
import { RaceForm } from "@/components/race-form";

export default function SubmitRacePage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-lg font-semibold">Submit a race</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Anyone can submit a race. Pick standard distances or add a custom one.
      </p>

      <RaceForm
        submitLabel="Submit race"
        submittingLabel="Submitting…"
        onSubmit={async (payload) => {
          const res = await fetch("/api/races", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error ?? `Request failed (${res.status})`);
          }
          router.push("/");
        }}
      />
    </div>
  );
}
