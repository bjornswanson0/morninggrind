# Phase 2 setup — your part (≈10 minutes)

Goal: stand up the shared database so the app + email become one synced system, and unlock WHOOP.

## Step 1 — Create a free Supabase project
1. Go to **https://supabase.com** → sign up (GitHub or email).
2. **New project** → name it `morning-grind` → pick a strong DB password (save it) → choose a region near you (e.g., East US).
3. Wait ~2 min for it to provision.

## Step 2 — Create the tables
1. In the project, open **SQL Editor** (left sidebar) → **New query**.
2. Open `phase2/schema.sql` from this folder, copy all of it, paste, and click **Run**.
3. You should see "Success." (Creates profile, days, weights, prs, whoop_daily with security.)

## Step 3 — Turn on email sign-in
1. **Authentication → Providers → Email** → make sure it's enabled (magic link is fine).

## Step 4 — Give me two values (safe to share)
From **Project Settings → API**:
- **Project URL** (looks like `https://xxxx.supabase.co`)
- **anon public** key (the long `anon` key — this one is meant for client apps; NOT the `service_role` key)

Paste those two to me and I'll wire the app to sync to your database.

---

## Later, for WHOOP (do when we reach that step — you have the WHOOP now)
1. Go to **https://developer.whoop.com** → sign in with your WHOOP account → create an app.
2. It gives a **Client ID** + **Client Secret** (the secret stays server-side, never in the app).
3. Hand those over at the WHOOP step and I'll wire recovery-based auto-adjust.

Nothing here costs money — Supabase + hosting + WHOOP dev are all free tiers for one user.
