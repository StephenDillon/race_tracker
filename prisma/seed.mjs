/**
 * Seed data for a fresh database: the starter set of races, plus the entry
 * methods that drive the World Majors page.
 *
 * Run by `npm run db:seed` and by `prisma migrate reset`. Idempotent — every
 * insert is ON CONFLICT DO NOTHING, so running it against a populated
 * database changes nothing.
 *
 * Talks to Postgres through `pg` rather than the generated Prisma client:
 * the client is TypeScript with extensionless imports, which plain Node
 * cannot load without a bundler. Seeding is static SQL, so nothing is lost.
 *
 * Set ADMIN_EMAIL to also grant the admin role to an existing Supabase Auth
 * user (the site has no other way to mint the first admin).
 */
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { databaseSchema } from "../src/lib/db/connection.ts";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const M = (distance) => ({ kind: "standard", distance });
const custom = (label, kilometers) => ({ kind: "custom", label, kilometers });

const WORLD_MAJOR = "World Major";
const QUALIFIER = "World Major Qualifier";

/**
 * Ids are the same 8-char lowercase keys the app mints for submitted races
 * (generateRaceKey in src/lib/db/prisma-store.ts) — fixed here so re-seeding
 * is stable.
 */
const RACES = [
  {
    id: "berlin26",
    name: "Berlin Marathon",
    date: "2026-09-27",
    distances: [M("Marathon")],
    city: "Berlin",
    region: "Berlin",
    country: "Germany",
    countryCode: "DE",
    entryStatus: "ballot",
    tags: [WORLD_MAJOR, QUALIFIER],
    website: "https://www.bmw-berlin-marathon.com",
    description:
      "Flat and fast World Marathon Major, home of multiple world records.",
    entryMethods: [
      { method: "Lottery", opens: "2025-10-15", closes: "2025-12-01" },
      { method: "Time Qualifier", opens: "2025-10-15", closes: "2026-06-30" },
      { method: "Tour Operator", opens: "2025-11-01", closes: "2026-07-31" },
      { method: "Charity", opens: "2025-11-01", closes: "2026-07-31" },
    ],
  },
  {
    id: "chicag26",
    name: "Chicago Marathon",
    date: "2026-10-11",
    distances: [M("Marathon")],
    city: "Chicago",
    region: "Illinois",
    country: "United States",
    countryCode: "US",
    entryStatus: "ballot",
    tags: [WORLD_MAJOR, QUALIFIER],
    website: "https://www.chicagomarathon.com",
    description: "Fast, flat World Marathon Major through 29 neighborhoods.",
    entryMethods: [
      { method: "Lottery", opens: "2025-12-01", closes: "2025-12-31" },
      { method: "Time Qualifier", opens: "2026-01-15", closes: "2026-05-15" },
      { method: "Charity", opens: "2026-01-01", closes: "2026-08-01" },
      {
        method: "Legacy Finisher (5+ finishes)",
        opens: "2025-12-01",
        closes: "2026-03-01",
      },
    ],
  },
  {
    id: "nycmar26",
    name: "New York City Marathon",
    date: "2026-11-01",
    distances: [M("Marathon")],
    city: "New York",
    region: "New York",
    country: "United States",
    countryCode: "US",
    entryStatus: "ballot",
    tags: [WORLD_MAJOR, QUALIFIER],
    website: "https://www.nyrr.org",
    description:
      "The largest marathon in the world, through all five boroughs.",
    entryMethods: [
      { method: "Lottery", opens: "2026-01-15", closes: "2026-02-13" },
      { method: "Time Qualifier", opens: "2026-01-15", closes: "2026-08-01" },
      { method: "9+1 Program (2025)", opens: "2025-01-01", closes: "2025-12-31" },
      { method: "Charity", opens: "2026-02-01", closes: "2026-09-01" },
    ],
  },
  {
    id: "valenc26",
    name: "Valencia Marathon",
    date: "2026-12-06",
    distances: [M("Marathon"), M("10K")],
    city: "Valencia",
    region: "Valencia",
    country: "Spain",
    countryCode: "ES",
    entryStatus: "open",
    tags: [QUALIFIER],
    website: "https://www.valenciaciudaddelrunning.com",
    description: "One of the fastest marathon courses in the world.",
  },
  {
    id: "boston27",
    name: "Boston Marathon",
    date: "2027-04-19",
    distances: [M("Marathon")],
    city: "Boston",
    region: "Massachusetts",
    country: "United States",
    countryCode: "US",
    entryStatus: "closed",
    tags: [WORLD_MAJOR],
    website: "https://www.baa.org",
    description:
      "The world's oldest annual marathon. Qualifying time required.",
    entryMethods: [
      { method: "Time Qualifier (BQ)", opens: "2026-09-08", closes: "2026-09-15" },
      { method: "Charity", opens: "2026-10-01", closes: "2027-01-31" },
      { method: "Tour Operator", opens: "2026-10-01", closes: "2027-02-28" },
    ],
  },
  {
    id: "london27",
    name: "London Marathon",
    date: "2027-04-25",
    distances: [M("Marathon")],
    city: "London",
    region: "Greater London",
    country: "United Kingdom",
    countryCode: "GB",
    entryStatus: "ballot",
    tags: [WORLD_MAJOR, QUALIFIER],
    website: "https://www.tcslondonmarathon.com",
    description: "World Marathon Major from Greenwich to The Mall.",
    entryMethods: [
      { method: "Ballot", opens: "2026-04-01", closes: "2026-05-01" },
      { method: "Good for Age", opens: "2026-10-01", closes: "2026-11-01" },
      { method: "Championship Entry", opens: "2026-10-01", closes: "2026-11-01" },
      { method: "Charity", opens: "2026-05-01", closes: "2027-01-31" },
    ],
  },
  {
    id: "grtnth26",
    name: "Great North Run",
    date: "2026-09-13",
    distances: [M("Half Marathon")],
    city: "Newcastle upon Tyne",
    region: "Tyne and Wear",
    country: "United Kingdom",
    countryCode: "GB",
    entryStatus: "ballot",
    website: "https://www.greatrun.org",
    description:
      "The world's biggest half marathon, Newcastle to South Shields.",
  },
  {
    id: "prkpir26",
    name: "Park to Pier 10K",
    date: "2026-08-15",
    distances: [M("10K"), M("5K")],
    city: "Santa Monica",
    region: "California",
    country: "United States",
    countryCode: "US",
    entryStatus: "open",
    description: "Fast seaside out-and-back finishing on the pier.",
  },
  {
    id: "utmb2026",
    name: "Ultra-Trail du Mont-Blanc (UTMB)",
    date: "2026-08-28",
    distances: [custom("171K mountain ultra", 171)],
    city: "Chamonix",
    region: "Auvergne-Rhône-Alpes",
    country: "France",
    countryCode: "FR",
    entryStatus: "ballot",
    website: "https://utmb.world",
    description: "Iconic mountain ultra circumnavigating Mont Blanc.",
  },
  {
    id: "wstnst27",
    name: "Western States Endurance Run",
    date: "2027-06-26",
    distances: [M("100 Mile")],
    city: "Olympic Valley",
    region: "California",
    country: "United States",
    countryCode: "US",
    entryStatus: "ballot",
    website: "https://www.wser.org",
    description:
      "The world's oldest 100-mile trail race, Olympic Valley to Auburn.",
  },
  {
    id: "sydney26",
    name: "Sydney Marathon",
    date: "2026-08-30",
    distances: [M("Marathon"), M("Half Marathon")],
    city: "Sydney",
    region: "New South Wales",
    country: "Australia",
    countryCode: "AU",
    entryStatus: "open",
    tags: [WORLD_MAJOR, QUALIFIER],
    website: "https://www.sydneymarathon.com",
    description:
      "The newest World Marathon Major, finishing at the Opera House.",
    entryMethods: [
      { method: "Open Registration", opens: "2025-10-01", closes: "2026-08-01" },
      { method: "Charity", opens: "2025-11-01", closes: "2026-07-31" },
    ],
  },
  {
    id: "tokyom27",
    name: "Tokyo Marathon",
    date: "2027-03-07",
    distances: [M("Marathon")],
    city: "Tokyo",
    region: "Tokyo",
    country: "Japan",
    countryCode: "JP",
    entryStatus: "ballot",
    tags: [WORLD_MAJOR, QUALIFIER],
    website: "https://www.marathon.tokyo",
    description: "World Marathon Major through the heart of Tokyo.",
    entryMethods: [
      { method: "Lottery", opens: "2026-08-01", closes: "2026-08-31" },
      {
        method: "Charity (One Tokyo Premium)",
        opens: "2026-07-01",
        closes: "2026-11-30",
      },
      { method: "Tour Operator", opens: "2026-09-01", closes: "2026-12-31" },
    ],
  },
  {
    id: "rvrsid26",
    name: "Riverside Classic 5K",
    date: "2026-08-01",
    distances: [M("5K")],
    city: "Austin",
    region: "Texas",
    country: "United States",
    countryCode: "US",
    entryStatus: "open",
    description: "Flat riverside 5K, chip timed, all abilities welcome.",
  },
  {
    id: "dublin26",
    name: "Dublin Marathon",
    date: "2026-10-25",
    distances: [M("Marathon")],
    city: "Dublin",
    region: "Leinster",
    country: "Ireland",
    countryCode: "IE",
    entryStatus: "waitlist",
    tags: [QUALIFIER],
    website: "https://www.dublinmarathon.ie",
    description:
      "The friendly marathon — a lap of the city with huge crowds.",
  },
  {
    id: "twoocn27",
    name: "Two Oceans Marathon",
    date: "2027-03-27",
    distances: [custom("56K ultra", 56), M("Half Marathon")],
    city: "Cape Town",
    region: "Western Cape",
    country: "South Africa",
    countryCode: "ZA",
    entryStatus: "open",
    website: "https://www.twooceansmarathon.org.za",
    description:
      '"The world\'s most beautiful marathon" around the Cape Peninsula.',
  },
  {
    id: "mdnsun27",
    name: "Midnight Sun Half Marathon",
    date: "2027-06-19",
    distances: [M("Half Marathon"), M("10K")],
    city: "Tromsø",
    region: "Troms",
    country: "Norway",
    countryCode: "NO",
    entryStatus: "open",
    website: "https://www.msm.no",
    description: "Race under the midnight sun, north of the Arctic Circle.",
  },
  {
    id: "comrad27",
    name: "Comrades Marathon",
    date: "2027-06-13",
    distances: [custom("~88K road ultra", 88)],
    city: "Durban",
    region: "KwaZulu-Natal",
    country: "South Africa",
    countryCode: "ZA",
    entryStatus: "open",
    website: "https://www.comrades.com",
    description: "The world's largest and oldest ultramarathon.",
  },
  {
    id: "manchr27",
    name: "Manchester Marathon",
    date: "2027-04-11",
    distances: [M("Marathon")],
    city: "Manchester",
    region: "Greater Manchester",
    country: "United Kingdom",
    countryCode: "GB",
    entryStatus: "open",
    tags: [QUALIFIER],
    website: "https://www.manchestermarathon.co.uk",
    description: "The UK's flattest, fastest big-city marathon.",
  },
  {
    id: "baybrd26",
    name: "Bay Bridge Backyard Ultra",
    date: "2026-09-05",
    distances: [custom("Backyard ultra (6.7K loops)", 6.7)],
    city: "Oakland",
    region: "California",
    country: "United States",
    countryCode: "US",
    entryStatus: "sold_out",
    description: "Last one standing format — one 6.7K loop every hour.",
  },
  {
    id: "amstrd26",
    name: "Amsterdam Marathon",
    date: "2026-10-18",
    distances: [M("Marathon"), M("Half Marathon")],
    city: "Amsterdam",
    region: "North Holland",
    country: "Netherlands",
    countryCode: "NL",
    entryStatus: "open",
    tags: [QUALIFIER],
    website: "https://www.tcsamsterdammarathon.nl",
    description: "Fast autumn marathon finishing in the Olympic Stadium.",
  },
  {
    id: "vermnt26",
    name: "Vermont 50",
    date: "2026-09-27",
    distances: [M("50 Mile"), M("50K")],
    city: "Brownsville",
    region: "Vermont",
    country: "United States",
    countryCode: "US",
    entryStatus: "waitlist",
    description: "Rolling trail ultra through Vermont fall foliage.",
  },
  {
    id: "lakesd26",
    name: "Lakeside 100K",
    date: "2026-11-14",
    distances: [M("100K")],
    city: "Queenstown",
    region: "Otago",
    country: "New Zealand",
    countryCode: "NZ",
    entryStatus: "open",
    description: "Point-to-point 100K along Lake Wakatipu single track.",
  },
  {
    id: "eltmil26",
    name: "City Elite Mile",
    date: "2026-08-08",
    distances: [custom("1 Mile road race", 1.609)],
    city: "Eugene",
    region: "Oregon",
    country: "United States",
    countryCode: "US",
    entryStatus: "invitation",
    description: "Elite-only downtown road mile with world-class fields.",
  },
  {
    id: "parish27",
    name: "Paris Half Marathon",
    date: "2027-03-07",
    distances: [M("Half Marathon")],
    city: "Paris",
    region: "Île-de-France",
    country: "France",
    countryCode: "FR",
    entryStatus: "open",
    website: "https://www.harmoniemutuellesemideparis.com",
    description: "Spring half through the heart of Paris.",
  },
  {
    id: "gldcst27",
    name: "Gold Coast Marathon",
    date: "2027-07-04",
    distances: [M("Marathon"), M("Half Marathon"), M("10K")],
    city: "Gold Coast",
    region: "Queensland",
    country: "Australia",
    countryCode: "AU",
    entryStatus: "open",
    tags: [QUALIFIER],
    website: "https://goldcoastmarathon.com.au",
    description:
      "Flat, fast oceanside marathon — Australia's premier road race.",
  },
  {
    id: "bigsur27",
    name: "Big Sur International Marathon",
    date: "2027-04-25",
    distances: [M("Marathon"), custom("21-Miler", 33.8)],
    city: "Big Sur",
    region: "California",
    country: "United States",
    countryCode: "US",
    entryStatus: "ballot",
    website: "https://www.bigsurmarathon.org",
    description: "Highway 1 coastal scenery from Big Sur to Carmel.",
  },
  {
    id: "stckhm27",
    name: "Stockholm Marathon",
    date: "2027-05-29",
    distances: [M("Marathon")],
    city: "Stockholm",
    region: "Stockholm",
    country: "Sweden",
    countryCode: "SE",
    entryStatus: "open",
    tags: [QUALIFIER],
    website: "https://www.stockholmmarathon.se",
    description:
      "Two-lap tour of Stockholm finishing in the 1912 Olympic Stadium.",
  },
];

const INSERT_RACE = `
  insert into races (
    id, name, date, distances, standard_distances, city, region, country,
    country_code, entry_status, tags, entry_methods, website, description
  )
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
  on conflict do nothing
`;

const GRANT_ADMIN = `
  insert into user_roles (user_id, role)
  select id, 'admin' from auth.users where email = $1
  on conflict (user_id) do update set role = 'admin', updated_at = now()
  returning user_id
`;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set — see .env.example.");
  process.exit(1);
}

const schema = databaseSchema();
const client = new pg.Client({
  connectionString,
  options: `-c search_path=${schema}`,
});

await client.connect();
try {
  let inserted = 0;
  for (const race of RACES) {
    const result = await client.query(INSERT_RACE, [
      race.id,
      race.name,
      race.date,
      JSON.stringify(race.distances),
      race.distances.filter((d) => d.kind === "standard").map((d) => d.distance),
      race.city,
      race.region,
      race.country,
      race.countryCode,
      race.entryStatus,
      race.tags ?? [],
      JSON.stringify(race.entryMethods ?? []),
      race.website ?? null,
      race.description ?? null,
    ]);
    inserted += result.rowCount;
  }
  console.log(
    `Seeded ${schema}: ${inserted} race(s) inserted, ${RACES.length - inserted} already present.`,
  );

  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  if (adminEmail) {
    const result = await client.query(GRANT_ADMIN, [adminEmail]);
    console.log(
      result.rowCount > 0
        ? `Granted admin to ${adminEmail}.`
        : `ADMIN_EMAIL ${adminEmail} has no Supabase Auth user — sign up first, then re-run.`,
    );
  }
} finally {
  await client.end();
}
