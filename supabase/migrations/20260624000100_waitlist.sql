-- New migration: 20260624000100_waitlist.sql
-- Waitlist email capture backing the five "Upgrade to Pro" CTAs.
-- Insert-only: anyone (anon or authenticated) may join, but no select policy
-- exists, so captured addresses cannot be read back through the API. Repeat
-- submissions are made idempotent by the unique(email) constraint plus the
-- handler's upsert-with-ignoreDuplicates.
create table if not exists waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  source     text,
  created_at timestamptz not null default now()
);

alter table waitlist enable row level security;

-- Insert-only policy for both anon and authenticated roles. No select/update/
-- delete policy is defined, so the list is write-only from the client's view.
create policy "anyone can join waitlist" on waitlist
  for insert to anon, authenticated with check (true);
