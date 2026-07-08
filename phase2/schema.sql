-- Morning Grind — Supabase schema (Phase 2)
-- Paste this into the Supabase SQL Editor and click "Run".
-- Uses Supabase Auth: each row is owned by a signed-in user (Row Level Security).

-- Your maxes + settings (one row per user)
create table if not exists profile (
  user_id       uuid primary key references auth.users on delete cascade,
  maxes         jsonb default '{}'::jsonb,   -- {squat:285, bench:215, ...}
  weight_target numeric default 158,
  updated_at    timestamptz default now()
);

-- One row per calendar day: the plan + what you did
create table if not exists days (
  user_id    uuid references auth.users on delete cascade,
  d          date not null,
  plan       jsonb,                          -- the generated session (from the routine or app)
  completed  boolean default false,
  sets       jsonb default '[]'::jsonb,      -- per-exercise sets done
  swaps      jsonb default '{}'::jsonb,      -- exercise swaps chosen
  debrief    jsonb,                          -- post-workout debrief (rating/effort/energy/notes)
  updated_at timestamptz default now(),
  primary key (user_id, d)
);
-- If you already created the tables before, this adds the new column safely:
alter table days add column if not exists debrief jsonb;

-- Bodyweight log (one entry per day)
create table if not exists weights (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users on delete cascade,
  d          date not null,
  lb         numeric not null,
  created_at timestamptz default now(),
  unique (user_id, d)
);

-- Personal records
create table if not exists prs (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users on delete cascade,
  d          date not null,
  lift       text not null,
  lb         numeric not null,
  created_at timestamptz default now()
);

-- WHOOP daily metrics (populated in the WHOOP step)
create table if not exists whoop_daily (
  user_id    uuid references auth.users on delete cascade,
  d          date not null,
  recovery   int,      -- 0-100 %
  hrv        numeric,
  rhr        numeric,
  sleep_perf int,      -- 0-100 %
  strain     numeric,  -- 0-21
  updated_at timestamptz default now(),
  primary key (user_id, d)
);

-- Row Level Security: users can only see/edit their own rows
alter table profile     enable row level security;
alter table days        enable row level security;
alter table weights     enable row level security;
alter table prs         enable row level security;
alter table whoop_daily enable row level security;

create policy "own rows" on profile     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on days        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on weights     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on prs         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on whoop_daily for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
