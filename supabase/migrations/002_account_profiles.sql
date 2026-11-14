-- 계정별 탭: 컨셉·소재(팀 공용 저장) + 카드에 계정 연결
-- 적용하지 않아도 대시보드는 동작합니다(이 경우 컨셉·소재는 각자의 브라우저에만 저장).

create table if not exists account_profiles (
  account_id text primary key,           -- moodiee | creazy | bbakk
  concept jsonb not null,                -- { summary, audience, tone, cta, formats, rules }
  materials jsonb not null,              -- [{ id, title, basis, memo, status, updated_at }]
  updated_at timestamptz not null default now()
);

-- 서버(secret key)로만 읽고 쓰므로 브라우저(anon)에는 열지 않는다.
alter table account_profiles enable row level security;

-- 카드가 어느 계정용인지 (카드 API는 계정 ID를 받아 생성)
alter table cards add column if not exists account_id text;
create index if not exists cards_account_date_idx on cards (account_id, date desc, type);
