create table if not exists public.series_recommendation_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  result jsonb not null
);
create index if not exists series_recommendation_runs_created_at_idx
  on public.series_recommendation_runs (created_at desc);
alter table public.series_recommendation_runs enable row level security;
revoke all on public.series_recommendation_runs from anon, authenticated;
grant select, insert on public.series_recommendation_runs to service_role;
