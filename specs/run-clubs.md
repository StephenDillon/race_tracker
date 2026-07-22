# Run Clubs

## Overview

Run clubs allow users to discover, create, and manage local running groups. Each club has a home location, basic info, and a schedule of recurring or one-off events. Users can search for clubs by name or city and view upcoming events.

## Features

### Discovery

- New **Run Clubs** tab in the main navigation (alongside Races, My Races, World Majors)
- Search by **name** (free-text, partial match) or **location** (city-level)
- Results display as cards showing:
  - Club name
  - Address
  - Upcoming events (next 3–5?)
  - Club website (if provided)
  - Description / bio

### Club Profile

- Dedicated page per club (`/run-clubs/[id]`)
- Full details: name, description, address, website, social links(?)
- Full list of upcoming events
- Past events(?)

### Club Creation

- Logged-in users can create a run club
- Required fields:
  - Name
  - City, country
  - Address (street-level for meetup location)
- Optional fields:
  - Description
  - Website URL
  - Logo / image(?)

### Events

- Club owners can create events attached to their club
- Event fields:
  - Title (e.g. "Saturday Morning 10K", "Interval Training")
  - Date & time
  - Location / meeting point (defaults to club address?)
  - Distance / type
  - Description
- **Recurring events**: can be set to repeat weekly on a given day
  - System auto-generates upcoming occurrences (next N weeks?)
  - Individual occurrences can be cancelled without affecting the series
- **One-off events**: single date, no recurrence
- **Cancellation**: club owner can cancel individual event occurrences
  - Cancelled events still show but marked as cancelled(?)

### Ownership & Permissions

- The user who creates a club is the owner
- Only the owner can:
  - Edit club details
  - Create / cancel events
- Multiple admins / co-owners(?)

---

## Open Questions

1. **Club membership**: Can users "join" a club, or is this purely a directory? If joinable, does joining do anything (notifications, member count displayed)?
2. **Multiple admins**: Can the owner add other users as admins who can manage events?
3. **Club logo/image**: Support image uploads, or just keep it text-based for now?
4. **Event capacity**: Should events have a max attendee count or RSVP?
5. **Past events**: Show event history on the club page, or only upcoming?
6. **Recurring event generation**: How far ahead should recurring events be generated? (e.g. next 4 weeks, 8 weeks, 12 weeks)
7. **Social links**: Support links to Instagram, Strava club, Facebook group etc?
8. **Club approval**: Can anyone create a club instantly, or is there a moderation step?
9. **Search radius**: When searching by city, exact city match only, or nearby cities too?
10. **Event details page**: Do individual events need their own page, or is the club page enough?
