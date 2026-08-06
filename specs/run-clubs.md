# Run Clubs

## Overview

Run clubs allow users to discover, join, create, and manage local running groups. Each club has a home location, basic info, social links, and a schedule of recurring or one-off events. Users can search for clubs by name or city and view upcoming events.

---

## Discovery & Search

- New **Run Clubs** tab in main navigation
- Search by **name** (free-text, partial match) or **location** (city-level, exact match)
- Results display as cards showing:
  - Club name
  - Address
  - Member count
  - Next 3 upcoming events (title, date/time)
  - Club website link

---

## Club Profile Page

Route: `/run-clubs/[id]`

Displays:
- Club name and description
- Address (street-level meetup location)
- Website URL
- Social links: Instagram, Strava, Facebook (all optional)
- Member count with "Join" / "Leave" button for logged-in users
- Full list of upcoming events
- Club management controls (visible to owner/admins only)

---

## Club Creation & Editing

Requires login.

### Required fields
- Name
- City, country
- Address (street-level meetup location)

### Optional fields
- Description
- Website URL
- Instagram URL
- Strava club URL
- Facebook group URL

No image/logo uploads (text-only for now).

---

## Ownership & Admins

- The creating user becomes the **owner**
- Owner can invite other users as **admins** (by email or user search)
- Owner and admins can:
  - Edit club details
  - Create, edit, and cancel events
  - Manage admin list (owner only can add/remove admins)
- Regular members have no management permissions

---

## Events

Events are displayed on the club profile page only (no separate event URLs).

### Event fields
- **Title** (e.g. "Saturday Morning 10K", "Interval Training")
- **Date & time**
- **Location / meeting point** (defaults to club address, can be overridden)
- **Distance / type** (optional, free text e.g. "5K", "Easy run", "Intervals")
- **Description** (optional)

### Recurring events
- Can be set to repeat **weekly** on a chosen day and time
- System auto-generates the next **8 weeks** of occurrences
- Individual occurrences can be **cancelled** without affecting the series
- Cancelled occurrences still display but are visually marked as cancelled (strikethrough + "Cancelled" badge)

### One-off events
- Single date, no recurrence

### RSVP
- Logged-in users can mark themselves as **Going** on any event
- Going count is displayed on each event
- No capacity limits

---

## Data Model (conceptual)

### run_clubs
| Field | Type | Notes |
|-------|------|-------|
| id | text (PK) | slug from name |
| name | text | required |
| description | text | optional |
| address | text | street-level |
| city | text | required, for search |
| country | text | display name |
| country_code | text | ISO alpha-2 |
| website | text | optional |
| instagram_url | text | optional |
| strava_url | text | optional |
| facebook_url | text | optional |
| owner_id | uuid | FK to auth.users |
| created_at | timestamptz | |

### club_members
| Field | Type | Notes |
|-------|------|-------|
| club_id | text (FK) | |
| user_id | uuid | |
| role | text | 'owner', 'admin', 'member' |
| joined_at | timestamptz | |
| PK | | (club_id, user_id) |

### rt_club_events
| Field | Type | Notes |
|-------|------|-------|
| id | text (PK) | |
| club_id | text (FK) | |
| title | text | required |
| description | text | optional |
| location | text | defaults to club address |
| distance | text | optional, free text |
| starts_at | timestamptz | date and time |
| recurring | boolean | default false |
| recurrence_day | int | 0=Sun..6=Sat, null if not recurring |
| recurrence_time | time | null if not recurring |
| series_id | text | groups recurring instances, null for one-offs |
| cancelled | boolean | default false |
| created_at | timestamptz | |

### rt_event_rsvps
| Field | Type | Notes |
|-------|------|-------|
| event_id | text (FK) | |
| user_id | uuid | |
| created_at | timestamptz | |
| PK | | (event_id, user_id) |

---

## Pages & Routes

| Route | Description | Auth required |
|-------|-------------|---------------|
| `/run-clubs` | Search & browse clubs | No |
| `/run-clubs/new` | Create a club form | Yes |
| `/run-clubs/[id]` | Club profile with events | No (management controls for owner/admin) |
| `/run-clubs/[id]/edit` | Edit club details | Yes (owner/admin) |

---

## API Endpoints

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/run-clubs` | List/search clubs (query: q, city, country) | No |
| POST | `/api/run-clubs` | Create club | Yes |
| GET | `/api/run-clubs/[id]` | Get club details + members count | No |
| PATCH | `/api/run-clubs/[id]` | Update club | Yes (owner/admin) |
| POST | `/api/run-clubs/[id]/members` | Join club | Yes |
| DELETE | `/api/run-clubs/[id]/members` | Leave club | Yes |
| POST | `/api/run-clubs/[id]/admins` | Add admin (by email) | Yes (owner) |
| DELETE | `/api/run-clubs/[id]/admins` | Remove admin | Yes (owner) |
| GET | `/api/run-clubs/[id]/events` | List upcoming events | No |
| POST | `/api/run-clubs/[id]/events` | Create event (one-off or recurring) | Yes (owner/admin) |
| PATCH | `/api/run-clubs/[id]/events/[eventId]` | Update / cancel event | Yes (owner/admin) |
| POST | `/api/run-clubs/[id]/events/[eventId]/rsvp` | RSVP to event | Yes |
| DELETE | `/api/run-clubs/[id]/events/[eventId]/rsvp` | Remove RSVP | Yes |

---

## Recurring Event Generation

- When a recurring event is created, generate 8 weekly occurrences from the start date
- A background job or on-read generation creates new occurrences as time passes (rolling 8-week window)
- Each occurrence is a row in `rt_club_events` sharing the same `series_id`
- Cancelling one occurrence sets `cancelled = true` on that row only
- Editing the series (time, title) applies to future un-cancelled occurrences

---

## UI Behaviour

### Run Clubs listing page
- Search bar (name or city)
- Grid of club cards
- Each card: name, address, member count, next 3 events
- Click card navigates to club profile

### Club profile page
- Header: name, description, address, website, social links
- "Join" / "Leave" button (logged-in users)
- Member count badge
- Events section: chronological list of upcoming events
  - Each event: title, date/time, location, distance, going count, RSVP button
  - Cancelled events: strikethrough + "Cancelled" badge, no RSVP button
- Management section (owner/admin only):
  - "Create Event" button
  - "Edit Club" link
  - Admin management (owner only)
