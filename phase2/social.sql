-- Morning Grind — Social layer (Strava-style). Safe to re-run.

-- Public profiles: everyone can read name/handle; you edit only your own
create table if not exists profiles (
  id           uuid primary key references auth.users on delete cascade,
  handle       text unique,
  display_name text,
  emoji        text default '💪',
  created_at   timestamptz default now()
);
alter table profiles enable row level security;
drop policy if exists "profiles read all"  on profiles;
create policy "profiles read all"  on profiles for select using (true);
drop policy if exists "profiles insert own" on profiles;
create policy "profiles insert own" on profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles update own" on profiles;
create policy "profiles update own" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Follows: you follow friends to see their workouts
create table if not exists follows (
  follower   uuid references auth.users on delete cascade,
  followee   uuid references auth.users on delete cascade,
  created_at timestamptz default now(),
  primary key (follower, followee)
);
alter table follows enable row level security;
drop policy if exists "follows select own" on follows;
create policy "follows select own" on follows for select using (auth.uid() = follower or auth.uid() = followee);
drop policy if exists "follows insert own" on follows;
create policy "follows insert own" on follows for insert with check (auth.uid() = follower);
drop policy if exists "follows delete own" on follows;
create policy "follows delete own" on follows for delete using (auth.uid() = follower);

-- Let followers READ the workout days of people they follow (weights table stays private)
drop policy if exists "days readable by followers" on days;
create policy "days readable by followers" on days for select using (
  exists (select 1 from follows f where f.follower = auth.uid() and f.followee = days.user_id)
);
