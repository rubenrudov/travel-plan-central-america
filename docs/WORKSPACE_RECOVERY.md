# Expedition reference recovery

If the saved workspace cannot be opened because `activeId`, expedition IDs and record-collection keys disagree, the app displays a recovery screen after authentication. The original workspace is retained in memory and can be downloaded directly, even though ordinary validated backup export could not open it.

The screen provides field-level diagnostics and an explicit proposed repair for these cases:

- A stale active expedition ID: choose the first existing expedition without changing any collections.
- One metadata ID with no collection plus one collection with no metadata: propose linking those existing records to that expedition. The user must review the proposed association; the app does not know whether an externally edited ID was intended.
- Exactly identical duplicate expedition entries: retain one metadata entry and its unchanged records.

The user must download the original backup before Confirm repair is enabled. Saving uses the original revision, so a newer edit on another device causes a conflict instead of being overwritten. A failed or uncertain response tells the user to reload the latest data. No seed reset, reseeding, record-ID regeneration or replacement of personal bookings/payments occurs.

Ambiguous multiple collections, conflicting duplicate metadata, missing collections or unknown fields that validation would strip are left untouched for manual review. The original backup is still available. Do not delete the user's workspace row or replace it with the example seed to bypass validation.

Validation remains strict for writes. New-account seeds are validated before initialization. A valid existing workspace is returned unchanged. Recovery code does not bypass authentication or RLS, and no administrator key is needed: the confirmed repair is saved through the user's existing session.

Tests cover unchanged amounts/references/records, original-payload preservation, stale active IDs, one-to-one collection linking, duplicate handling, refusal to guess, and an authenticated browser journey through backup → confirmation → save → reload. This does not claim that a particular user's private row was inspected or repaired before they confirm it in the app.
