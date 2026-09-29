-- ISLEBOUND online leaderboard — run once in Supabase → SQL Editor.
-- Then paste the project URL and anon public key into src/config.js.

create extension if not exists pgcrypto;

create table if not exists public.players (
  id           uuid primary key default gen_random_uuid(),
  nickname     text not null check (nickname ~ '^[A-Za-z0-9_]{3,16}$'),
  secret       uuid not null default gen_random_uuid(),
  total_score  bigint not null default 0,
  cleared      int not null default 0,
  stars        int not null default 0,
  echoes       int not null default 0,
  daily_key    text,
  daily_score  bigint not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists players_nick_lc on public.players (lower(nickname));
create index if not exists players_total on public.players (total_score desc);
create index if not exists players_daily on public.players (daily_key, daily_score desc);

-- Nobody touches the table directly; everything goes through the functions below.
alter table public.players enable row level security;
revoke all on public.players from anon, authenticated;

-- Top 100 all-time (public, no secrets exposed)
create or replace view public.leaderboard with (security_invoker = false) as
  select nickname, total_score, cleared, stars, echoes
  from public.players
  where total_score > 0
  order by total_score desc
  limit 100;
grant select on public.leaderboard to anon, authenticated;

create or replace function public.nickname_available(p_nick text)
returns boolean language sql security definer set search_path = public as $$
  select not exists (select 1 from players where lower(nickname) = lower(p_nick));
$$;

-- Claim a nickname (new player) or rename (existing player proves ownership with its secret)
create or replace function public.claim_nickname(p_nick text, p_id uuid default null, p_secret uuid default null)
returns table (id uuid, secret uuid) language plpgsql security definer set search_path = public as $$
begin
  if p_nick !~ '^[A-Za-z0-9_]{3,16}$' then raise exception 'invalid nickname'; end if;
  if exists (select 1 from players p where lower(p.nickname) = lower(p_nick) and p.id is distinct from p_id) then
    raise exception 'nickname taken';
  end if;
  if p_id is not null and exists (select 1 from players p where p.id = p_id and p.secret = p_secret) then
    update players p set nickname = p_nick, updated_at = now() where p.id = p_id;
    return query select p.id, p.secret from players p where p.id = p_id;
  else
    return query insert into players (nickname) values (p_nick) returning players.id, players.secret;
  end if;
end $$;

-- Submit progress. Basic sanity limits stop obviously impossible numbers.
create or replace function public.submit_score(
  p_id uuid, p_secret uuid, p_total bigint, p_cleared int, p_stars int, p_echoes int, p_daily_key text, p_daily_score bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_cleared < 0 or p_cleared > 360 or p_stars > 1080 or p_echoes > 60 then raise exception 'rejected'; end if;
  if p_total > (p_cleared + 1) * 12000000 then raise exception 'rejected'; end if;
  update players set
    total_score = greatest(total_score, p_total),
    cleared = greatest(cleared, p_cleared), stars = greatest(stars, p_stars), echoes = greatest(echoes, p_echoes),
    daily_score = case when daily_key = p_daily_key then greatest(daily_score, p_daily_score) else p_daily_score end,
    daily_key = p_daily_key, updated_at = now()
  where id = p_id and secret = p_secret;
end $$;

create or replace function public.daily_top(p_key text)
returns table (nickname text, daily_score bigint, cleared int, stars int, echoes int)
language sql security definer set search_path = public as $$
  select nickname, daily_score, cleared, stars, echoes from players
  where daily_key = p_key and daily_score > 0 order by daily_score desc limit 100;
$$;

grant execute on function public.nickname_available(text) to anon, authenticated;
grant execute on function public.claim_nickname(text, uuid, uuid) to anon, authenticated;
grant execute on function public.submit_score(uuid, uuid, bigint, int, int, int, text, bigint) to anon, authenticated;
grant execute on function public.daily_top(text) to anon, authenticated;
