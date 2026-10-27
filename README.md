# Adventure OS

A Hebrew-first personal expedition planner for Guatemala & Baja — 2027. Plan the logistics. Preserve the adventure.

## Hosted site and continuous deployment

The GitHub Pages edition uses Supabase email-link login and a private synchronized workspace per account. See **[the deployment guide](docs/DEPLOYMENT.md)** for creating the free project, applying the RLS migration, reviewing the public project configuration and enabling GitHub Pages. The workflow tests and deploys pushes to `main`; the site cannot sign in until Supabase is configured. The intended default URL is `https://rubenrudov.github.io/travel-plan-central-america/`.

## Run locally

Requires Node 24 (uses built-in `node:sqlite`) and npm 11.

```sh
npm ci
npm run dev
```

The app runs on port 3000. It creates `.data/adventure.sqlite` on first request and seeds an editable expedition. No credentials or API keys are required. Optional `ADVENTURE_DATA_DIR` selects a private writable database directory. Do not expose the unauthenticated local edition publicly.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

Browser checks use the installed `/usr/bin/chromium` by default:

```sh
npm run test:e2e
```

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use a different installed Chromium. If none exists, install a supported Chromium with Playwright and point this variable at its executable.

## Use

Open Overview for the next preparation tasks, budget and pending reservations. Every module supports persistent create, edit and delete. Switch Hebrew/English in the top bar. Settings edits the expedition dates, budget and planning exchange rates and creates additional expeditions.

- Itinerary: edit destinations and segments, reorder unlocked segments, review related records when dates move. Confirmed bookings are never moved automatically. Duplicate the whole expedition as a draft to try a different route without changing the original.
- Bookings: record provider, status, original-currency total, payments, cancellation policy, confirmation and dependencies. Linking a task to a booked reservation completes that task. Booking state and payment state are separate.
- Connections: record transport and buffers; expand warnings for incomplete or inconsistent connections. Verify actual schedules and timezone differences with operators.
- Gear: confirm ownership, distinguish purchases/rentals, generate an editable expedition packing list, track packed weight.
- Budget: forecast versus commitments, payments and actual spending. Linked expense records represent booking payments and do not add the booking twice. Budget scenarios compare additional mobula days using user-entered costs; no live quotes.
- Research: decisions and linked option comparisons with pros, cons, prices, source URLs and confidence.
- Preparation logs: actual completed dives are separate from plans. Trek training records are logs, not rehabilitation advice.
- Travel mode: select a date for daily records and upcoming transport. Add your own emergency contacts. Settings exports and restores full JSON backups.

All sample dates and rates are planning assumptions. Ownership is unverified. Booking confirmations, live prices and paid amounts are never invented. The MXN 7,000 mobula target is a ceiling for planning, not a quotation.

## Structure

```
app/                 App Router pages, styles, local state/backup API
components/          Integrated responsive workspace and editors
lib/model.ts         Validation and domain calculations
lib/store.ts         Transactional SQLite persistence and schema initialization
lib/seed.ts          Planning-only initial data
public/              Local landscape and contour artwork
tests/               Domain and Playwright smoke tests
docs/                Product, architecture, roadmap
```

## Deployment and backup

For a private local/server installation, run `npm run build` then `npm start`, retain the database directory on persistent storage and restrict access to a trusted local network. Stop the process before copying the SQLite file (or use SQLite's backup facility); JSON export is available while running. Keep backup files private. Live processes do not survive environment snapshots; restart the app in each task.

The static cloud edition has Supabase Auth, per-user ownership/RLS and a transactional JSON workspace store. It requires the one-time configuration in [DEPLOYMENT.md](docs/DEPLOYMENT.md). The unauthenticated SQLite edition remains for local use only. Private document storage and encrypted offline access are not implemented.

See [architecture](docs/ARCHITECTURE.md) and [roadmap](docs/ROADMAP.md) for limits: cloud storage is a personal workspace per account; transport analysis is basic; offline cold launch is incomplete; attachment upload is not implemented. UI primitives are custom CSS/native controls rather than Tailwind/shadcn. Some seeded record content remains English when the interface is Hebrew.

## Reservation sync and cancellation watch

The **Reservation sync** module integrates Gmail confirmations from Booking.com and Hostelworld. Recognized authenticated confirmations can attach dated accommodation addresses to a uniquely matched destination; uncertain messages go to review. Exact verified free-cancellation cutoffs drive one-week in-app alerts and scheduled Gmail reminders. Backend activation requires Google OAuth credentials, the additional Supabase migration/functions and a cron job. See [RESERVATIONS.md](docs/RESERVATIONS.md) for setup, permissions, supported formats and delivery limitations. This integration does not log into travel accounts or cancel reservations.

In-app cancellation notifications are the default and require no Google token or extra backend setup. The Gmail connection is optional, collapsed by default, and email reminders default to off. In-app alerts appear while using the application, not as background push notifications.

## Route map

Itinerary and Destinations now include an OpenStreetMap view with dotted flight/ferry curves, midpoint vehicle icons, estimated road routes and saved accommodation hover/tap cards. Locate existing records once using Search, Place pin or manual coordinates; unresolved places are never guessed. See [MAP.md](docs/MAP.md) for usage, attribution, service limits and privacy details.
