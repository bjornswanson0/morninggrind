# Morning Grind 🏋️

A personal, installable **PWA workout app** — a CBum-inspired daily training coach with set-by-set
logging, streaks, cloud sync, a WHOOP-style dashboard, an AI custom-workout generator, and a friends feed.

## What's inside
- **Today** — daily session from a weekly split, set-by-set logging, rest timer, exercise swaps,
  live weather, a rotating verse/quote + Song of the Day, and a WHOOP-style Overview
  (Streak · Today · This-Week rings).
- **AI custom workouts** — describe a session in plain English and get a structured workout
  (a Cloudflare Pages Function calls the Claude API).
- **Progress** — weight + PR charts, consistency calendar, streak stats.
- **Feed** — profiles (photo + bio), follow friends, and see their completed lifts + debriefs.
- **Sync** — cross-device via Supabase (email + password), local-first.
- **Light / dark** theme toggle.

## Tech
Static vanilla HTML/CSS/JS (no build step) · Supabase (Postgres + RLS + auth) ·
one Cloudflare Pages Function for the AI generator · installable PWA (manifest + service worker).

## Run locally
Open `index.html` in a browser (double-click). The AI generator only runs on the deployed site,
since it needs the Pages Function + `ANTHROPIC_API_KEY`.

## Deploy (Cloudflare Pages)
Push to this repo and connect it to Cloudflare Pages for auto-deploy (no build command — the root
is served static and `functions/` is deployed automatically). The AI function (`functions/api/workout.js`,
served at `/api/workout`) needs an `ANTHROPIC_API_KEY` environment variable set in the Pages project's
Settings → Environment variables. Database schema lives in `phase2/*.sql` (run in the Supabase SQL editor).

## Editing your numbers
Open `js/data.js`: `DEFAULT_1RM` (assumed maxes), `SPLIT` (weekly template), `OPENERS` (verse + song rotation).

## Note on secrets
`js/config.js` contains the Supabase **anon** key — safe to be public (protected by Row Level
Security). The `service_role` key and DB password are **never** stored in this repo, and the
Anthropic API key lives only as a Cloudflare Pages environment variable.
