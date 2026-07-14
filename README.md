# our little corner

A private, two-person message board for you and your long-distance partner.
Old bulletin-board vibes: warm cream paper, cork board backdrop, a note
"pinned" for every post. New posts land at the top, live, for both of you.

**Stack:** Next.js (App Router) · Vercel · Clerk (auth) · Supabase (Postgres +
Storage + Realtime + Edge Functions + pg_cron)

---

## 1. How it's put together

```
src/
  app/
    page.tsx              the board itself (server component, protected)
    layout.tsx             ClerkProvider, fonts, global shell
    sign-in/[[...sign-in]]/page.tsx
    not-authorized/page.tsx
    manage/page.tsx         tucked-away daily-photo pool uploader
  components/
    board.tsx               client: realtime post list
    composer.tsx             the "new post" box (text/drawing/media/voice)
    drawing-canvas.tsx       freehand canvas: brush, eraser, colour, clear
    voice-recorder.tsx       in-browser recorder (MediaRecorder)
    post-card.tsx            renders one post, incl. the daily-photo style
    pool-manager.tsx         bulk photo upload UI for /manage
    header.tsx
  lib/
    actions.ts               server actions (auth-checked writes)
    auth.ts                  Clerk + allow-list gate
    upload.ts                direct-to-Supabase-Storage upload helper
    supabase/server.ts        service-role client (server only)
    supabase/browser.ts       Clerk-authenticated client (realtime + uploads)
    media.ts, types.ts
  proxy.ts                   Clerk middleware (Next.js 16 renamed this from
                              middleware.ts - same thing)
supabase/
  migrations/0001_init.sql    tables, RLS, storage bucket
  functions/post-daily-photo/ the cron-triggered Edge Function
```

**Why file uploads don't go through Next.js:** Vercel serverless functions
cap request bodies at a few MB, which a video or a folder of photos would
blow past. So the browser asks a tiny server action for a short-lived
*signed upload URL* per file, then uploads the actual bytes straight to
Supabase Storage. Only small JSON (file paths, post text) ever goes through
Vercel.

**Why RLS matters even though writes use the service role key:** every
write (new post, pool upload, the daily-photo cron) goes through
server-side code that already checked `requireAllowedUser()`, using the
Supabase *service role* key, which bypasses Row Level Security entirely.
Reads are different: the board subscribes to Supabase Realtime directly
from the browser for live updates, using the *anon* key. Row Level Security
is what stops a stranger with that (public, bundled-in-the-JS) anon key
from reading your posts - only requests carrying a valid Clerk session
token are allowed to `select` from `posts`. See step 3 below.

---

## 2. Clerk setup

1. Create an app at [dashboard.clerk.com](https://dashboard.clerk.com).
2. **Disable public sign-ups**: *Configure → Restrictions* → turn off
   "Allow sign-ups" (or set mode to "restricted"/invite-only, wording
   varies by Clerk dashboard version). This is what actually keeps the
   board to two people - the `ALLOWED_EMAILS` check in the app is just a
   second layer on top.
3. Invite exactly two people: *Users → Invite* (or send them the sign-up
   link if invite-only mode allows it) - you and your partner.
4. Copy your keys from *API Keys*:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
5. Grab both your email addresses for `ALLOWED_EMAILS` in the env vars
   below (comma-separated, no spaces needed).

You don't need a JWT template for Supabase here - step 3 uses Clerk's
newer native "Third-Party Auth" integration instead, which needs no
per-project Clerk configuration beyond the app itself.

---

## 3. Supabase setup

### 3.1 Create the project and run the migration

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Open the **SQL Editor** and run `supabase/migrations/0001_init.sql`
   (paste the whole file in and hit Run). This creates the `posts` and
   `photo_pool` tables, turns on Row Level Security, adds `posts` to the
   realtime publication, and creates the public `board-media` storage
   bucket.
3. Copy your keys from *Project Settings → API*:
   - `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` (same value)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (⚠️ keep this one server-only, never
     `NEXT_PUBLIC_*` - it bypasses all security rules)

### 3.2 Wire up Clerk as a Third-Party Auth provider (needed for realtime)

The board subscribes to new posts live via Supabase Realtime, straight
from the browser. For that connection to be allowed to read anything (and
only that connection, not a random visitor with your public anon key),
Supabase needs to recognise Clerk's session tokens as valid auth:

1. In Clerk: **Dashboard → Configure → Integrations**, enable the
   **Supabase** integration (this adds the `role: authenticated` claim
   Supabase expects, automatically, to every session token).
2. In Supabase: **Authentication → Sign In / Providers → Third Party
   Auth**, add a **Clerk** provider, and paste your Clerk instance's
   Frontend API URL (looks like `https://xxxxx.clerk.accounts.dev`, found
   in Clerk under *Configure → Domains*).
3. That's it - no JWT template, no shared secret. The `posts` table's RLS
   policy (`to authenticated using (true)`) now only lets requests with a
   valid Clerk session through.

### 3.3 Enable `pg_cron` and `pg_net`

Still in the SQL Editor:

```sql
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
```

(Or via the dashboard: **Database → Extensions**, search for `pg_cron`
and `pg_net`, toggle both on. Same effect.)

### 3.4 Deploy the `post-daily-photo` Edge Function

From your machine, in this repo:

```bash
npm install -g supabase   # if you don't already have the CLI
supabase login
supabase link --project-ref <your-project-ref>   # found in the project URL
supabase functions deploy post-daily-photo
```

The function reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the
environment Supabase automatically injects into every Edge Function - you
don't need to set those manually for the function itself.

It only does anything when called with your service role key as its
bearer token (see `supabase/functions/post-daily-photo/index.ts`), so
anyone who found the URL without that key gets a 401.

### 3.5 Schedule it with `pg_cron`

Back in the SQL Editor, replacing both placeholders (get the function URL
from the Supabase dashboard's Edge Functions page, and your service role
key from Project Settings → API):

```sql
select cron.schedule(
  'daily-photo',
  '0 0 * * *', -- see the timezone note below
  $$
  select net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/post-daily-photo',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <your-service-role-key>',
      'Content-Type', 'application/json'
    )
  );
  $$
);
```

**About "midnight in a configured timezone":** pg_cron schedules run in
UTC. `'0 0 * * *'` is midnight *UTC*, not midnight wherever you are. Work
out the UTC hour for your local midnight and use that instead - e.g. if
you're in a UTC+4 timezone with no daylight saving (like Armenia),
midnight local time is 20:00 UTC the day before, so you'd use
`'0 20 * * *'`. If your timezone observes daylight saving, pg_cron won't
auto-adjust twice a year - you'd need to nudge the schedule manually (or
just accept the post lands an hour off during DST, which, for a couple's
photo board, is unlikely to be a crisis).

To check it's registered: `select * from cron.job;` To see run history:
`select * from cron.job_run_details order by start_time desc limit 5;`

---

## 4. Environment variables

Copy `.env.example` to `.env.local` for local dev, and add the same keys
to your Vercel project (**Settings → Environment Variables**) before
deploying. All of them are required.

| Variable | Where it's used |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk, browser |
| `CLERK_SECRET_KEY` | Clerk, server |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Clerk redirect config |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | send you straight to the board after login |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | same, after an invite acceptance |
| `ALLOWED_EMAILS` | server-side allow-list, defense-in-depth |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase, browser + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase, browser (RLS-restricted) |
| `SUPABASE_URL` | Supabase, server (same value as the public one) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase, server only - never expose this |

---

## 5. Local development

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected
to sign in, then straight to the board.

---

## 6. Deploying

1. Push this repo to GitHub.
2. Import it in [Vercel](https://vercel.com/new).
3. Add all the environment variables from the table above.
4. Deploy.
5. Back in Clerk, add your Vercel production URL under *Configure →
   Domains* if prompted (Clerk needs to know your production origin).

---

## 7. Notes on the media bucket

`board-media` is a **public** Supabase Storage bucket - object paths are
random UUIDs, so this is "unlisted link" security (like a Google Photos
share link), not account-gated security. That keeps the app simple (no
signed-URL refresh logic for images left open in a tab for hours). If you
want stricter access later, flip the bucket to private in the dashboard
and switch `publicMediaUrl()` in `src/lib/media.ts` to mint signed URLs
via a server action instead.
