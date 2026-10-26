# GitHub Pages + private Supabase workspace

GitHub Pages hosts only the exported interface. Supabase provides email-link login and a private workspace per account. The local SQLite database and its actual records are never included in the website or Git history. Backups from the local edition can be imported after signing in to the hosted edition.

## One-time setup

1. Create a free project at https://supabase.com/dashboard. Choose the Free plan and keep your database password private. Wait for the project to finish provisioning.
2. In its SQL Editor, run the contents of [202610260001_workspaces.sql](../supabase/migrations/202610260001_workspaces.sql) once. It creates the workspace table, ownership policies and transactional save/load functions. Do not disable row-level security.
3. In Authentication → URL Configuration, set **Site URL** to `https://rubenrudov.github.io/travel-plan-central-america/` and add that exact URL to **Redirect URLs**. Leave email authentication enabled. The sign-in link must be opened in the same browser that requested it because authentication uses PKCE.
4. In Project Settings / Connect / API Keys, find the project URL and **publishable key** (legacy `anon` key also works). Never use `service_role`, `sb_secret_` or a database password. Public browser keys are safe only with the included RLS policies.
5. The workflow now includes the owner-provided public project URL and publishable key as defaults. No repository variables are required for this project. To override them later, in [GitHub repository variables](https://github.com/rubenrudov/travel-plan-central-america/settings/variables/actions), create these **Actions repository variables** (not environment-only variables):

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Your `https://PROJECT_REF.supabase.co` URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your publishable or legacy anon key |

6. In [repository Pages settings](https://github.com/rubenrudov/travel-plan-central-america/settings/pages), choose **GitHub Actions** as the build/deployment source. Pages availability for private repositories depends on the GitHub plan; do not change repository visibility without reviewing the source data.
7. Open [Actions](https://github.com/rubenrudov/travel-plan-central-america/actions/workflows/pages.yml), choose **Validate and deploy Adventure OS**, then **Run workflow** on `main`. The build uses the configured public project defaults. Re-run after changing any configuration.
8. After the deploy job succeeds, open `https://rubenrudov.github.io/travel-plan-central-america/`. Request a sign-in email, open it in the same browser and import a local backup via Settings if you want your existing records.

The public project defaults (or repository-variable overrides) are compiled into the static browser bundle; they are configuration, not server secrets. Changing them requires a new workflow run. No Supabase service key or personal GitHub token is needed in the workflow: Pages deployment uses GitHub's short-lived `GITHUB_TOKEN` and OIDC with narrowly scoped permissions.

## Continuous deployment

`.github/workflows/pages.yml` runs on every push to `main`, on pull requests, and manually. It installs with the lockfile, runs TypeScript, lint, all unit/Postgres policy tests, the local server build and browser workflows, builds the static Pages site and tests its subpath/assets/auth integration. Only a successful push/manual run deploys; pull requests never publish. Browser tests mock the Supabase HTTP boundary so CI does not mutate your real workspace or send sign-in emails. SQL policy tests run the actual migration in an isolated PGlite PostgreSQL engine with two users plus an anonymous role. Verify the real project separately after applying the migration.

To update: edit → test → commit → push to `main`. Actions tests and publishes the new version. A failed build leaves the previous deployment in place. Shared edits use revision checks and reject stale saves rather than overwriting changes from another device. Reload after a conflict. Existing cloud data is not reset by a deployment.

## Run the cloud edition locally

Copy `.env.example` to ignored `.env.local`, supply the public project settings and run `npm run dev`. Add the local URL (including base path) to Supabase redirect URLs for local email authentication. To return to the local SQLite edition, remove the cloud variables from `.env.local`.

```sh
npm ci
npm run build:pages
npm run preview:pages
npm run test:pages
```

The Pages build defaults to `/travel-plan-central-america`. Static files are in ignored `out/`; `.nojekyll` is generated. API route handlers use `.server.ts` extensions and are excluded by configuration from the static build. No API route is exported and no `.data` files are copied. Page assets are bundled with the base path.

## Custom domain later

The default address already provides HTTPS. To use an owned custom domain later, configure it in GitHub Pages, follow GitHub's current DNS verification instructions, change workflow `NEXT_PUBLIC_BASE_PATH` to an empty string, and update Supabase Site URL plus redirect URLs to the custom domain. Re-run CI after the change. Export a backup before switching domains; authentication sessions are specific to each origin.

## Scope and operating limits

This is a personal workspace, not a multiuser collaboration system. Each signed-in user owns a separate workspace; no public data-sharing feature exists. New accounts receive the planning-only seed. A first sign-in may create an account; after creating yours, you may disable new signups in Supabase to keep access limited. Email rate limits and free-project availability are controlled by Supabase. Internet access is required for synchronization; export JSON before traveling offline. No sensitive document upload or encrypted offline vault is implemented. GitHub Pages serves public application code, while actual records are private in Supabase behind authentication and RLS.

The cloud store uses a single JSON workspace row per user, with server-side revision checks. It reuses the validated domain model and keeps writes atomic. Normalized domain tables and richer collaborative merging remain future improvements. This storage choice avoids partially saved itinerary/booking/budget updates in this personal MVP.
