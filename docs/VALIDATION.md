# Validation — October 26, 2026

Executed in the cloud environment with Node 24.19.0 and npm 11.9.0:

- Clean `npm ci --cache /workspace/.npm-cache --no-audit --no-fund`: passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed without errors or warnings.
- `npm test`: 11 tests passed across three files. Includes financial non-duplication, cancelled bookings, actual dive counts, dependency impacts, input validation, reusable gear, payment recalculation and SQLite persistence/stale transaction rejection.
- `npm run build`: passed, producing the App Router page and dynamic state/backup API routes.
- `npm run test:e2e`: all five browser tests passed against both the development server and the final production server using the installed Chromium.
- Production `npm start`: started successfully on port 3000. Functional browser workflows passed against this process.
- Backup export: parsed successfully and confirmed the original expedition remains active, with no temporary test expeditions left behind.

Browser checks cover Hebrew RTL startup, task create/edit/delete across reloads, a 390px mobile viewport without horizontal overflow, booking costs, gear packing persistence, actual dive logging, date-change impact confirmation without changing the confirmed booking, and invalid/stale API writes. Desktop (1440px) and mobile screenshots were captured and visually inspected; generated screenshots are ignored in test-results/.

Initial failures were corrected: writable npm cache selection, a seed typing issue, React lint findings, development origin configuration, valid same-origin API saves and accessible select names. The Playwright browser download was blocked by current network policy; tests instead used the existing /usr/bin/chromium. Optional web-font requests fall back to local fonts when blocked.

Install and start instructions plus optional browser-download/font domains were saved to the environment configuration draft. This does not publish the environment or validate restoration into a future task. Review and save the draft in environment settings, then publish when desired.

This evidence establishes the local development workflow and tested MVP journeys. It does not establish production authentication, Supabase connectivity, private file storage, full cold-start offline operation, comprehensive timezone/connection analysis or live travel data. See ROADMAP.md for those limitations.

## GitHub Pages + Supabase follow-up

- Unit/Postgres suite: 14 tests passed, including the actual Supabase SQL migration run in PGlite with authenticated Alice/Bob users and an anonymous role. RLS blocked cross-user reads, updates and inserts; anonymous table/RPC access was denied; stale revisions were rejected.
- Static export: passed for `/travel-plan-central-america`, with no API routes in the route manifest and no database export.
- Static Playwright suite: 3 passed, covering subpath assets, sign-in link redirect, authenticated saves/reload, backup download, sign-out and mobile login layout. Supabase HTTP responses were mocked and test-only public configuration was used for this ignored local artifact. This is not evidence of live Supabase connectivity.
- TypeScript and lint passed after the integration. The local server workflow is separately revalidated before pushing.
- GitHub API requests were blocked by the current environment policy. Supabase project creation, applying the migration to that project, configuring GitHub repository variables and enabling Pages remain external prerequisites. No service-role key or database file is included in the site.

See DEPLOYMENT.md for the exact one-time configuration. A live deployment is not claimed until the GitHub deployment and real Supabase sign-in succeed.

## Gmail reservations and cancellation watch

The reservation update adds tested core calculations, sender-aware conservative parsing, dated accommodation linkage, inbox/token isolation and atomic import merging. Both Supabase Edge Functions pass Deno type checking. The local browser suite passes six tests, including the new verified cutoff/address journey; the static cloud suite passes four tests. Server and Pages builds pass. Tests use synthetic messages and isolated databases; no real Gmail account was connected, no live reservation imported and no notification email sent. The new backend migration, Google OAuth credentials, Edge Function deployment and cron schedule require project-owner setup described in RESERVATIONS.md. The website module alone does not establish active background synchronization.

## OpenStreetMap route planning

TypeScript, ESLint, 31 unit/database tests and both server/static builds passed. New map browser checks passed for dotted flight/ferry midpoint icons, estimated road geometry, confirmed geocoding selection persisted across reload, saved accommodation provider/address popups, mobile popup containment and horizontal layout, road-routing failure labels and manual pin placement without geocoding. The five-test static suite also verifies Leaflet's dynamic bundle beneath the GitHub Pages base path. Desktop/mobile map screenshots were inspected using controlled tile/service responses. Public Nominatim/OSRM connectivity was blocked by the workspace proxy, so successful live service requests are not claimed; failure handling and manual alternatives were tested. See MAP.md for provider, privacy and operational limits.

## Login-time expedition reference error

37 unit/database tests passed, including six recovery cases that preserve stored records/payment data and refuse ambiguous or lossy repair. Both builds passed. The six-test static suite reproduces the login-time malformed reference failure, verifies that no write occurs before a backup and confirmation, and verifies repair persistence after reload. Private cloud rows were not read through an administrative credential or reset; the repair runs only in the authenticated user's app. See WORKSPACE_RECOVERY.md.
