-- Creazy 데일리 바이럴 카드 대시보드 — 초기 스키마
-- 적용 전 확인: 도하(분석)·승원(카드 API)과 컬럼 합의 후 실행하세요.

-- ───────── 계정 ─────────
create table if not exists ig_accounts (
  id uuid primary key default gen_random_uuid(),
  ig_user_id text unique,                -- Instagram 비즈니스 계정 ID (연결 후 채움)
  handle text not null,
  name text,
  followers int,
  status text not null default 'pending' check (status in ('connected','expired','pending')),
  token_expires_at timestamptz,
  -- 액세스 토큰은 이 테이블에 평문으로 두지 말고 Vault/서버 전용 테이블에 저장하세요.
  created_at timestamptz not null default now()
);

-- ───────── 카드 (승원 API 결과) ─────────
create table if not exists cards (
  card_id text primary key,              -- 예: 2026-11-13-dummy-0 (마지막 숫자 = 재생성 회차)
  date date not null,
  type text not null check (type in ('dummy','service')),
  title text not null,
  format text not null,                  -- 포맷별 성과 집계의 키 (표기 통일 필요: 예 '신입 N시간')
  rationale text,
  difficulty smallint check (difficulty between 1 and 3),
  audio jsonb,                           -- { name, commercial_ok }
  storyboard jsonb,                      -- [{cut,start_s,end_s,visual,caption,note}]
  "references" jsonb,                    -- [{url,role}]
  caption_draft text,
  hashtags text[],
  prompt text,
  asset_ids text[],
  score jsonb,                           -- 도하 점수 구성요소 { viral_strength, fit, feasibility, freshness } (권장)
  reference_video_ids text[],            -- 근거가 된 수집 영상 ID (권장)
  created_at timestamptz not null default now()
);
create index if not exists cards_date_idx on cards (date desc, type);

-- ───────── 피드백 로그 (핵심) ─────────
create table if not exists card_events (
  id uuid primary key default gen_random_uuid(),
  card_id text not null references cards(card_id) on delete cascade,
  action text not null check (action in ('selected','passed','regenerated','linked')),
  reason text,                           -- passed: 촬영 불가/톤이 안 맞음/이미 했음/재미없음/기타
  post_url text,                         -- linked: 게시 후 붙여넣은 인스타 URL
  created_at timestamptz not null default now()
);
create index if not exists card_events_card_idx on card_events (card_id, created_at desc);

-- ───────── 게시물·성과 ─────────
create table if not exists posts (
  id text primary key,                   -- Instagram media id
  account_id uuid not null references ig_accounts(id) on delete cascade,
  url text not null,
  shortcode text unique,                 -- URL의 /reel/<shortcode>/ — 카드 연결 매칭 키
  caption text,
  posted_at timestamptz not null,
  card_id text references cards(card_id) on delete set null,  -- URL 붙여넣기로 연결됨
  created_at timestamptz not null default now()
);
create index if not exists posts_account_time_idx on posts (account_id, posted_at desc);

create table if not exists post_metric_snapshots (
  post_id text not null references posts(id) on delete cascade,
  captured_at timestamptz not null default now(),
  checkpoint text,                       -- '24h' | '72h' | '7d' | 'daily'
  views int, reach int, likes int, comments int, shares int, saves int,
  primary key (post_id, captured_at)
);

-- ───────── 분석용 뷰 (도하·승원이 그대로 조회 가능) ─────────
create or replace view v_post_latest as
select distinct on (post_id) *
from post_metric_snapshots
order by post_id, captured_at desc;

-- 성과 점수 = 조회수 / 같은 계정 직전 20개 게시물 조회수 중앙값
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
  having count(*) >= 3                  -- 직전 게시물 3개 미만이면 baseline 없음(null) → 앱에서 보정
) b on true;

-- 포맷별 성과 (최근 90일, 카드 연결된 게시물만)
create or replace view v_format_performance as
select
  card_format as format,
  count(*) as n,
  percentile_cont(0.5) within group (order by multiple) as median_multiple,
  avg(views) as avg_views,
  count(*) < 3 as low_n
from v_post_scored
where card_format is not null
  and multiple is not null
  and posted_at > now() - interval '90 days'
group by card_format;

-- 카드별 피드백 요약 (선택/패스 사유/재생성/연결 게시물 성과) — 서브쿼리로 집계해 중복 부풀림 방지
create or replace view v_card_feedback as
select
  c.card_id, c.date, c.type, c.format, c.difficulty, c.asset_ids, c.score,
  exists (select 1 from card_events e where e.card_id = c.card_id and e.action = 'selected') as selected,
  (select e.reason from card_events e
    where e.card_id = c.card_id and e.action = 'passed'
    order by e.created_at desc limit 1) as pass_reason,
  (select count(*) from card_events e where e.card_id = c.card_id and e.action = 'regenerated') as regen_count,
  (select max(s.multiple) from v_post_scored s where s.card_id = c.card_id) as multiple
from cards c;

-- ───────── RLS ─────────
-- 마케팅팀 내부용(권한 구분 없음)이므로 로그인한 사용자 전체에 허용. anon은 차단.
alter table ig_accounts enable row level security;
alter table cards enable row level security;
alter table card_events enable row level security;
alter table posts enable row level security;
alter table post_metric_snapshots enable row level security;

do $$
declare t text;
begin
  foreach t in array array['ig_accounts','cards','card_events','posts','post_metric_snapshots'] loop
    execute format('create policy "authenticated all" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
