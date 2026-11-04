-- Chetapawa: database schema
-- Run this once in the Supabase SQL editor (or with `psql`) on a fresh project.
-- All tables use the cz_ prefix.
--
-- Access model
--   * The browser uses the anon key. It can only READ, and only non-sensitive columns.
--   * Every write goes through Nuxt server routes using the service role key,
--     which bypasses RLS. There are no insert/update/delete policies for anon.
--   * cz_creators.manage_token_hash is never readable by anon (column-level grants).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.cz_creators (
  id                 uuid primary key default gen_random_uuid(),
  handle             text not null unique
                       check (handle ~ '^[a-z0-9_]{3,24}$'),
  display_name       text not null check (char_length(display_name) between 1 and 60),
  bio                text check (bio is null or char_length(bio) <= 280),
  payout_address     text not null check (char_length(payout_address) between 1 and 128),
  dest_asset_id      text not null,
  dest_asset_symbol  text not null,
  dest_chain         text not null,
  manage_token_hash  text not null,
  created_at         timestamptz not null default now()
);

create table if not exists public.cz_goals (
  id             uuid primary key default gen_random_uuid(),
  creator_id     uuid not null references public.cz_creators(id) on delete cascade,
  title          text not null check (char_length(title) between 1 and 80),
  target_amount  numeric not null check (target_amount > 0),
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);

-- Only one active goal per creator.
create unique index if not exists cz_goals_one_active_per_creator
  on public.cz_goals (creator_id) where active;

create table if not exists public.cz_tips (
  id                   uuid primary key default gen_random_uuid(),
  creator_id           uuid not null references public.cz_creators(id) on delete cascade,
  goal_id              uuid references public.cz_goals(id) on delete set null,
  origin_asset_id      text not null,
  origin_asset_symbol  text not null,
  origin_chain         text not null,
  amount_in            text not null,              -- base units, exactly as sent to the quote
  amount_in_formatted  text,                       -- human units, for display
  amount_out           text,                       -- base units, filled on success
  amount_out_formatted text,                       -- human units, quote estimate until success
  amount_out_usd       numeric,                    -- filled on success (falls back to quote_out_usd)
  quote_out_usd        numeric,                    -- USD estimate from the quote
  expires_at           timestamptz,                -- deposit deadline returned by 1Click
  deposit_address      text not null,
  deposit_memo         text,
  status               text not null default 'pending'
                         check (status in ('pending', 'processing', 'success', 'failed', 'refunded', 'expired')),
  tipper_name          text check (tipper_name is null or char_length(tipper_name) <= 40),
  message              text check (message is null or char_length(message) <= 140),
  created_at           timestamptz not null default now(),
  settled_at           timestamptz
);

-- Columns added in step 5. Safe to re-run on databases created before them.
alter table public.cz_tips add column if not exists amount_in_formatted  text;
alter table public.cz_tips add column if not exists amount_out_formatted text;
alter table public.cz_tips add column if not exists quote_out_usd        numeric;
alter table public.cz_tips add column if not exists expires_at           timestamptz;

create index if not exists cz_tips_creator_created_idx
  on public.cz_tips (creator_id, created_at desc);
create index if not exists cz_tips_goal_idx
  on public.cz_tips (goal_id) where status = 'success';
create index if not exists cz_tips_open_idx
  on public.cz_tips (creator_id, created_at) where status in ('pending', 'processing');
create index if not exists cz_tips_deposit_address_idx
  on public.cz_tips (deposit_address);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.cz_creators enable row level security;
alter table public.cz_goals    enable row level security;
alter table public.cz_tips     enable row level security;

-- Public read policies. No write policies exist, so anon and authenticated
-- roles cannot insert, update or delete. The service role bypasses RLS.
drop policy if exists cz_creators_public_read on public.cz_creators;
create policy cz_creators_public_read on public.cz_creators
  for select to anon, authenticated using (true);

drop policy if exists cz_goals_public_read on public.cz_goals;
create policy cz_goals_public_read on public.cz_goals
  for select to anon, authenticated using (true);

drop policy if exists cz_tips_public_read on public.cz_tips;
create policy cz_tips_public_read on public.cz_tips
  for select to anon, authenticated using (true);

-- Column-level grants: hide manage_token_hash from the browser roles.
revoke all on public.cz_creators from anon, authenticated;
grant select (id, handle, display_name, bio, payout_address, dest_asset_id,
              dest_asset_symbol, dest_chain, created_at)
  on public.cz_creators to anon, authenticated;

revoke all on public.cz_goals from anon, authenticated;
grant select on public.cz_goals to anon, authenticated;

revoke all on public.cz_tips from anon, authenticated;
grant select on public.cz_tips to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Goal progress view
-- Sums settled USD value of successful tips per goal, plus the raw amount_out
-- sum as a fallback (see README "Decisions" for goal math).
-- security_invoker makes the view respect the caller's RLS and grants.
-- ---------------------------------------------------------------------------

create or replace view public.cz_goal_progress
with (security_invoker = true) as
select
  g.id                                              as goal_id,
  g.creator_id,
  g.title,
  g.target_amount,
  g.active,
  g.created_at,
  g.completed_at,
  coalesce(sum(t.amount_out_usd), 0)                as raised_usd,
  coalesce(sum(nullif(t.amount_out, '')::numeric), 0) as raised_out,
  count(t.id)                                       as tip_count
from public.cz_goals g
left join public.cz_tips t
  on t.goal_id = g.id and t.status = 'success'
group by g.id;

grant select on public.cz_goal_progress to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- The overlay and dashboard subscribe to changes on cz_tips and cz_goals.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cz_tips'
  ) then
    alter publication supabase_realtime add table public.cz_tips;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cz_goals'
  ) then
    alter publication supabase_realtime add table public.cz_goals;
  end if;
end $$;
