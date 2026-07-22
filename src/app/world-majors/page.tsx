"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCountdown, formatDate } from "@/lib/format";
import { ExternalLinkIcon } from "lucide-react";

interface EntryMethod {
  method: string;
  opens: string;
  closes: string;
}

interface Major {
  name: string;
  date: string;
  website: string;
  location: string;
  entryMethods: EntryMethod[];
}

const MAJORS: Major[] = [
  {
    name: "Berlin Marathon",
    date: "2026-09-27",
    website: "https://www.bmw-berlin-marathon.com",
    location: "Berlin, Germany",
    entryMethods: [
      { method: "Lottery", opens: "2025-10-15", closes: "2025-12-01" },
      { method: "Time Qualifier", opens: "2025-10-15", closes: "2026-06-30" },
      { method: "Tour Operator", opens: "2025-11-01", closes: "2026-07-31" },
      { method: "Charity", opens: "2025-11-01", closes: "2026-07-31" },
    ],
  },
  {
    name: "Chicago Marathon",
    date: "2026-10-11",
    website: "https://www.chicagomarathon.com",
    location: "Chicago, USA",
    entryMethods: [
      { method: "Lottery", opens: "2025-12-01", closes: "2025-12-31" },
      { method: "Time Qualifier", opens: "2026-01-15", closes: "2026-05-15" },
      { method: "Charity", opens: "2026-01-01", closes: "2026-08-01" },
      { method: "Legacy Finisher (5+ finishes)", opens: "2025-12-01", closes: "2026-03-01" },
    ],
  },
  {
    name: "New York City Marathon",
    date: "2026-11-01",
    website: "https://www.nyrr.org/tcsnycmarathon",
    location: "New York City, USA",
    entryMethods: [
      { method: "Lottery", opens: "2026-01-15", closes: "2026-02-13" },
      { method: "Time Qualifier", opens: "2026-01-15", closes: "2026-08-01" },
      { method: "9+1 Program (2025)", opens: "2025-01-01", closes: "2025-12-31" },
      { method: "Charity", opens: "2026-02-01", closes: "2026-09-01" },
    ],
  },
  {
    name: "Tokyo Marathon",
    date: "2027-03-07",
    website: "https://www.marathon.tokyo",
    location: "Tokyo, Japan",
    entryMethods: [
      { method: "Lottery", opens: "2026-08-01", closes: "2026-08-31" },
      { method: "Charity (One Tokyo Premium)", opens: "2026-07-01", closes: "2026-11-30" },
      { method: "Tour Operator", opens: "2026-09-01", closes: "2026-12-31" },
    ],
  },
  {
    name: "Boston Marathon",
    date: "2027-04-19",
    website: "https://www.baa.org",
    location: "Boston, USA",
    entryMethods: [
      { method: "Time Qualifier (BQ)", opens: "2026-09-08", closes: "2026-09-15" },
      { method: "Charity", opens: "2026-10-01", closes: "2027-01-31" },
      { method: "Tour Operator", opens: "2026-10-01", closes: "2027-02-28" },
    ],
  },
  {
    name: "London Marathon",
    date: "2027-04-25",
    website: "https://www.tcslondonmarathon.com",
    location: "London, UK",
    entryMethods: [
      { method: "Ballot", opens: "2026-04-01", closes: "2026-05-01" },
      { method: "Good for Age", opens: "2026-10-01", closes: "2026-11-01" },
      { method: "Championship Entry", opens: "2026-10-01", closes: "2026-11-01" },
      { method: "Charity", opens: "2026-05-01", closes: "2027-01-31" },
    ],
  },
  {
    name: "Sydney Marathon",
    date: "2026-08-30",
    website: "https://www.tcssydneymarathon.com",
    location: "Sydney, Australia",
    entryMethods: [
      { method: "Open Registration", opens: "2025-10-01", closes: "2026-08-01" },
      { method: "Charity", opens: "2025-11-01", closes: "2026-07-31" },
    ],
  },
  {
    name: "Cape Town Marathon",
    date: "2027-05-23",
    website: "https://capetownmarathon.com",
    location: "Cape Town, South Africa",
    entryMethods: [
      { method: "Ballot", opens: "2026-06-01", closes: "2026-08-31" },
      { method: "International Entry", opens: "2026-09-01", closes: "2027-03-31" },
      { method: "Charity", opens: "2026-09-01", closes: "2027-04-30" },
    ],
  },
];

function isPast(iso: string): boolean {
  return new Date(`${iso}T23:59:59`) < new Date();
}

export default function WorldMajorsPage() {
  const today = new Date().toISOString().slice(0, 10);

  const upcoming = MAJORS.filter((m) => m.date >= today).sort(
    (a, b) => a.date.localeCompare(b.date),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Abbott World Marathon Majors</h1>
        <p className="text-sm text-muted-foreground">
          Upcoming majors with qualifying methods and entry deadlines
        </p>
      </div>

      <div className="grid gap-5">
        {upcoming.map((major) => (
          <Card key={major.name}>
            <CardContent className="flex flex-col gap-4 pt-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">
                    <a
                      href={major.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 hover:text-primary hover:underline"
                    >
                      {major.name}
                      <ExternalLinkIcon className="size-4" />
                    </a>
                  </h2>
                  <p className="text-sm text-muted-foreground">{major.location}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-sm">{formatDate(major.date)}</div>
                  <div className="text-lg font-bold tracking-tight">
                    {formatCountdown(major.date)}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col className="w-[40%]" />
                    <col className="w-[20%]" />
                    <col className="w-[20%]" />
                    <col className="w-[20%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Entry Method</th>
                      <th className="px-3 py-2 text-left font-medium">Opens</th>
                      <th className="px-3 py-2 text-left font-medium">Closes</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {major.entryMethods.map((entry) => {
                      const opensPast = isPast(entry.opens);
                      const closesPast = isPast(entry.closes);
                      return (
                        <tr key={entry.method} className="border-b last:border-0">
                          <td className={`px-3 py-2 font-medium ${closesPast ? "text-muted-foreground line-through" : ""}`}>
                            {entry.method}
                          </td>
                          <td className={`px-3 py-2 font-mono ${opensPast ? "text-muted-foreground line-through" : ""}`}>
                            {formatDate(entry.opens)}
                          </td>
                          <td className={`px-3 py-2 font-mono ${closesPast ? "text-muted-foreground line-through" : ""}`}>
                            {formatDate(entry.closes)}
                          </td>
                          <td className="px-3 py-2">
                            {closesPast ? (
                              <Badge variant="secondary" className="bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                                Closed
                              </Badge>
                            ) : opensPast ? (
                              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                                Open now
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300">
                                Upcoming
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
