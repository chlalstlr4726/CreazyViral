set local search_path = public, pg_catalog;

create table if not exists ig_accounts (
  id uuid primary key default gen_random_uuid(),
  ig_user_id text unique,
  handle text not null,
  name text,
  followers int,
  status text not null default 'pending' check (status in ('connected','expired','pending')),
  token_expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists posts (
  id text primary key,
  account_id uuid not null references ig_accounts(id) on delete cascade,
  url text not null,
  shortcode text unique,
  caption text,
  posted_at timestamptz not null,
  card_id text references cards(card_id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists posts_account_time_idx on posts (account_id, posted_at desc);

create table if not exists post_metric_snapshots (
  post_id text not null references posts(id) on delete cascade,
  captured_at timestamptz not null default now(),
  checkpoint text,
  views int, reach int, likes int, comments int, shares int, saves int,
  primary key (post_id, captured_at)
);

create or replace view v_post_latest as
select distinct on (post_id) *
from post_metric_snapshots
order by post_id, captured_at desc;

create or replace view v_post_scored as
select
  p.id, p.account_id, p.url, p.shortcode, p.caption, p.posted_at, p.card_id,
  c.type   as card_type,
  c.format as card_format,
  l.views, l.reach, l.likes, l.comments, l.shares, l.saves,
  b.baseline,
  case when b.baseline > 0 then l.views::numeric / b.baseline end as multiple
from posts p
join v_post_latest l on l.post_id = p.id
left join cards c on c.card_id = p.card_id
left join lateral (
  select percentile_cont(0.5) within group (order by x.views) as baseline
  from (
    select l2.views
    from posts p2
    join v_post_latest l2 on l2.post_id = p2.id
    where p2.account_id = p.account_id and p2.posted_at < p.posted_at
    order by p2.posted_at desc
    limit 20
  ) x
  having count(*) >= 3
) b on true;

create unique index if not exists ig_accounts_handle_uidx on ig_accounts (handle);
insert into ig_accounts (handle, name) values
  ('moodiee.ai', '무디'),
  ('creazy.app', '크리에이지 공식'),
  ('bbakk_creazy', '빡')
on conflict (handle) do nothing;

create table if not exists ig_tokens (
  handle text primary key references ig_accounts(handle) on delete cascade,
  token text not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table ig_tokens enable row level security;

create unique index if not exists snapshots_checkpoint_uidx
  on post_metric_snapshots (post_id, checkpoint) where checkpoint in ('24h', '72h', '7d');

alter table public.ig_tokens enable row level security;
revoke all on table public.ig_tokens from anon, authenticated;
grant select, insert, update on table public.ig_tokens to service_role;
alter table public.ig_accounts enable row level security;
alter table public.posts enable row level security;
alter table public.post_metric_snapshots enable row level security;
revoke all on table public.v_post_latest, public.v_post_scored from anon, authenticated;
grant select on table public.v_post_latest, public.v_post_scored to service_role;
grant select, insert, update on table public.ig_accounts, public.posts, public.post_metric_snapshots to service_role;
