# Roadmap

Delivered: local integrated planning workspace, editable records, persistent SQLite, backups, responsive Hebrew/English UI, date impact confirmation, research and budget comparison, dive/training logs.

Next priorities:
- Configure and validate Supabase Auth and ownership/RLS against the user’s real project (integration, migration, policy tests and Pages CI/CD are implemented); add private document storage.
- Normalize the existing shared gear identities into one global inventory table with separate per-expedition packing rows.
- Dedicated relational payment ledger and immutable exchange-rate snapshots; refunds and chronological cash flow.
- Structured transport alternatives, timezone-aware interval analysis, lodging gaps and tour-start conflicts. Current warnings cover missing dates, local chronology, short declared buffers and overlapping accommodation.
- Full offline PWA with encrypted sensitive storage and conflict-aware synchronization.
- Extract the large workspace UI into smaller domain components; expand screen-reader testing (dialogs already trap focus and support Escape).
- Expand budget filters by country/date, visual itinerary scenario comparison and richer booking urgency scoring.
