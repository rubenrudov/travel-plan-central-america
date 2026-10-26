# Gmail reservation sync and cancellation reminders

## Default: in-app notifications, no Google required

Use Bookings to enter accommodation details and the verified free-cancellation cutoff. Overview shows the alert starting one week before that cutoff. No Gmail connection, Google token, new integration migration, Edge Function or cron job is required for these in-app alerts. They are shown while the app is open and do not notify you when it is closed. Email reminders default to OFF. The Gmail section is collapsed and makes no integration requests until you explicitly open it.

## Optional Gmail integration

Adventure OS connects to the Gmail mailbox receiving Booking.com and Hostelworld confirmations. This is an email integration, not a direct login to either travel account. No travel-account passwords are collected. An encrypted server-held Google refresh token enables scans and email reminders while the app is closed.

A scan processes up to 20 messages per batch and resumes its pagination on the next scan. The first scan covers the preceding year; later scans use a two-day overlap and message-ID deduplication. Sender domains are checked exactly. Automatic imports additionally require DMARC authentication results in the Gmail headers, recognizable property/reference/check-in/check-out/address fields, and one unambiguous destination match within one expedition's dates. City names and editable comma-separated destination aliases are matched as whole phrases. Overlapping scenarios or destinations go to review rather than choosing one silently.

Unrecognized layouts, missing details, uncertain senders, unmatched destinations and incomplete changes appear in **Reservation sync → Needs your review**, with a link to the original Gmail message. The app does not retain raw email bodies, attachments or mailbox-wide exports. Unrelated senders are ignored. Generic parsing currently recognizes labeled English fields and some Hebrew labels, plus unambiguous ISO/English-month dates. Real provider layouts and other languages vary; they are not all supported. Do not treat the parser as an authoritative travel record.

Cancellation deadlines are extracted only from explicit free-cancellation cutoff lines with an unambiguous date and time. Automatic verification also requires an authenticated provider sender and either an explicit IANA timezone on that line or an explicit property-local-time statement plus the matched destination’s configured timezone. Other formats remain unverified: open the booking, inspect the original policy, choose Free cancellation / Non-refundable / Unknown, enter the exact property-local cutoff and IANA timezone, and verify it. Changing the deadline/timezone/policy clears verification. A provider amendment replaces deadline information only when it can be parsed again; otherwise it clears verification to prevent stale alerts. Imported stays default to in-app notifications only. Email reminders remain OFF unless you explicitly enable them for a booking; existing choices survive amendments. Real sanitized confirmation/update samples would help expand provider-specific formats; unsupported formats never receive guessed deadlines.

Current accommodation is derived from dated confirmed stays with an address, rather than overwriting a destination's address permanently. Checkout day is excluded. Multiple overlapping stays remain visible. Travel mode shows the accommodation address on the dated booking.

The reminder is due at the same property-local time seven calendar days before free cancellation ends, including DST transitions. If verified less than a week beforehand, it becomes a catch-up reminder. Cancelled, non-refundable, unverified and expired bookings do not send. Pending provider updates with a matching reference suspend reminder delivery until reviewed. Email goes only to the connected Gmail account. It is sent through Gmail's send API, with an in-app alert also available on Overview.

## One-time backend setup (required before Connect Gmail works)

These steps require the project owner's Google/Supabase dashboards or authenticated Supabase CLI. A Supabase publishable key cannot deploy functions, set server secrets or create the schedule. Do not send passwords, OAuth client secrets, service-role keys, encryption keys or CLI tokens in chat.

1. Apply `supabase/migrations/202610270001_reservation_sync.sql` in the Supabase SQL Editor. Existing workspaces are preserved. It creates server-only token/state/delivery tables, an owner-readable import inbox and an atomic service-only import RPC. No browser role can read refresh tokens or call the privileged import RPC.
2. In Google Cloud Console create/select a project, enable **Gmail API**, and configure its OAuth consent screen. For an external app in Testing, add your Gmail address as a test user. Request these scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
3. Create a **Web application OAuth client**. Add this exact authorized redirect URI:
   `https://zpvmiwnqywachfrpzvyl.supabase.co/functions/v1/gmail-connect?callback=1`
4. In Supabase Edge Function secrets securely configure:

   | Secret | Purpose |
   | --- | --- |
   | `GOOGLE_CLIENT_ID` | Google web OAuth client ID |
   | `GOOGLE_CLIENT_SECRET` | Google web OAuth client secret |
   | `GMAIL_TOKEN_ENCRYPTION_KEY` | Base64 encoding of 32 random bytes, e.g. generate privately with `openssl rand -base64 32` |
   | `RESERVATION_JOB_SECRET` | A separate long random secret for scheduled calls |
   | `ADVENTURE_APP_URL` | `https://rubenrudov.github.io/travel-plan-central-america/` |

   Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` inside deployed Edge Functions; never put the service-role key in the frontend or GitHub Pages variables. Preserve the encryption key across redeployments. Rotating it requires reconnecting existing Gmail accounts.
5. Deploy both functions from this checkout using your own authenticated CLI:

   ```sh
   npx supabase login
   npx supabase link --project-ref zpvmiwnqywachfrpzvyl
   npx supabase functions deploy gmail-connect --no-verify-jwt
   npx supabase functions deploy reservation-jobs --no-verify-jwt
   ```

   `--no-verify-jwt` is intentional: the OAuth callback uses a single-use ten-minute state instead of a Supabase JWT, authenticated POST actions explicitly validate the Supabase session, and background jobs require the separate job secret. Do not remove these checks.
6. In Supabase enable the `pg_cron` and `pg_net` extensions and use **Vault** to save `reservation_jobs_url` and `reservation_job_secret` as described in `supabase/schedule-reservations.sql`. The latter must match the function's job secret. Run that scheduling SQL once. It calls the job every 30 minutes. Review the cron/network outcomes in the dashboard; reminders can be up to roughly 30 minutes after their calculated due time. Long scans of a large mailbox may take multiple batches.
7. In the app choose **Reservation sync → Connect Gmail**, approve the read/send scopes, and return to the app. Sync now runs one batch; the scheduled job continues later. The scheduler must be configured separately—connecting Gmail alone does not install it.
8. Verify one actual confirmation, amendment and cancellation from each provider. Check property/address/dates and cancellation terms in the original message before relying on the imported record. Enable a verified reminder and confirm the sent message in your own account. No live messages were sent during development tests.

Google's restricted Gmail scopes may require verification/security review for broader distribution. External apps left in Testing commonly receive refresh tokens that expire after seven days, requiring reconnection. Follow Google's current consent-screen requirements for durable access; this is a personal integration, not a claim of approved public Google integration.

## Delivery behavior and limits

A unique delivery claim is stored before sending. A successful send is marked sent. An ambiguous send failure is marked uncertain and is not automatically retried, because Gmail has no idempotency-key contract for this send endpoint. Check Gmail Sent and in-app alerts if the integration reports uncertainty. A crash during sending can also leave a sending claim; inspect it manually. This favors preventing duplicate mail over guaranteed exactly-once delivery. Disconnecting removes the stored token and attempts to revoke Google's grant; if revocation fails, remove the app in Google Account permissions as well.

Bookings can still be entered manually; in-app deadline alerts work without Gmail. No automatic cancellation or payment action is performed. Supabase free-tier availability, Google authorization expiry, quotas and network outages can delay jobs; the original provider confirmation remains authoritative. This feature is not a guarantee against cancellation fees.

## Validation

Unit tests cover local-time/DST calculations, refusal of ambiguous times, non-refundable/cancelled/expired exclusion, destination matching, checkout boundaries, sender lookalikes and conservative parsing. PostgreSQL tests apply the new migration, verify owner-only inbox reads and server-only token tables, and exercise atomic import merging without losing payment totals. Browser tests cover manual deadline verification and dated stay addresses. OAuth consent, Gmail parsing of the user's actual mail, function deployment, scheduling and actual email delivery require the owner's configuration and remain unverified until connected.
