# Adventure OS conventions

Use the existing checkout; cloud tasks already run in isolation. Do not create worktrees unless requested.

- Next.js App Router, TypeScript strict mode, Node 24 (node:sqlite).
- Hebrew is the default UI language and RTL direction. All additions must work in English and mobile layouts.
- Never seed invented confirmations, paid amounts, ownership, quotes or actual activity logs. Draft dates and exchange rates are assumptions.
- Domain calculations live in lib/model.ts. Linked payments must not double count the booking total. Cancelled bookings do not count.
- Local data belongs in ignored .data/ (or ADVENTURE_DATA_DIR). Never commit personal data or backups.
- Validate mutations with Zod and preserve optimistic revision checks. Confirmed bookings are never silently shifted.
- npm run typecheck, npm run lint, npm test, npm run build. Browser tests: npm run test:e2e with Playwright Chromium installed.
- Local edition is single-user, unauthenticated, and unsuitable for public exposure. Pages uses Supabase login, owner-only RLS and RPC revision checks. Never publish service-role keys or .data records.
- `npm run build:pages` exports a static site with Supabase configuration and /travel-plan-central-america base path. `npm run test:pages` verifies the static artifact. Server handlers use route.server.ts and must stay excluded from Pages.
- Database migrations belong in supabase/migrations; test ownership policies in tests/supabase.test.ts. CI deploys only successful main pushes/manual runs.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
