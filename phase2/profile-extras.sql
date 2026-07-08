-- Morning Grind — extra profile fields (photo + bio).
-- Run this once in the Supabase SQL Editor (New query → paste → Run).
-- Safe to re-run: "add column if not exists" is idempotent.

alter table profiles add column if not exists avatar text; -- profile photo (small base64 JPEG data URL)
alter table profiles add column if not exists goals  text; -- workout goals
alter table profiles add column if not exists quote  text; -- favorite quote
alter table profiles add column if not exists movie  text; -- favorite movie

-- Existing RLS policies on `profiles` (public read, owner update) already cover these columns.
