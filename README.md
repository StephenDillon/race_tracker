# Race Tracker

Find running races to participate in. Browse a table of upcoming races and filter by date, distance, location, entry criteria (open, ballot, closed, …), World Marathon Majors, and major qualifiers. Anyone can submit a race using standard distances or a custom one.

## Stack

- [Next.js](https://nextjs.org) (App Router) + [Tailwind CSS](https://tailwindcss.com)
- Supabase for the database (not wired up yet — currently an in-memory store with seed data)
- Deployed on Vercel

All data access is server-side: the UI only calls this app's own API routes (`/api/races`); API keys never reach the client.

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Project guidance

Architecture rules and contributor/agent guidance live in [AGENTS.md](./AGENTS.md).
