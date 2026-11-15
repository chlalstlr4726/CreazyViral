-- 매일 추천 표 `daily_recs` (도하 파이프라인, 2026-11-15)
--
-- 상태: 원격(Supabase creazy-viral)에 2026-11-15 23:5x KST에 이 내용 그대로 적용했다(도하 허락).
--   원격에서는 표 이름 앞에 public.을 붙여 실행했다. 2026-11-15 추천 14줄이 들어 있다.
-- 왜: 대시보드 홈 '최근 바이럴 Top 5'와 AI 스토리보드가 지금은 형 `reels`를 조회수 순으로 읽는다.
--   도하가 승인한 매일 추천(분석 칸 포함)을 이 표에 넣으면 승원이 홈을 이 표로 바꿔 연결한다.
-- 한 줄 = 그날 추천한 릴스 한 편. 같은 날 같은 릴스는 덮어쓴다.
-- 읽고 쓰는 방식: 서버 전용 키(service_role)로만. RLS 켬, 정책 없음, anon·authenticated 권한 회수, 지우기 권한 없음.
-- 개인정보: 댓글 글·댓글 단 사람은 넣지 않는다.

create table if not exists daily_recs (
  rec_date date not null,                -- 추천한 날(KST)
  rank int not null,                     -- 그날 순위(반응 점수 순)
  in_top10 boolean not null,             -- 노션 CSV 10줄에 든 편
  shortcode text not null,               -- 릴스 코드
  url text not null,
  username text not null,                -- 계정(@ 없이)
  display_name text,
  caption text not null default '',      -- 캡션 앞 300자
  posted_at timestamptz,
  plays bigint,                          -- 조회수
  likes int,
  comments int,
  shares int,
  duration_sec numeric(6,1),
  followers int,
  usual_plays bigint,                    -- 평소 조회수(최근 릴스 중앙값)
  usual_plays_source text check (usual_plays_source in ('apify','크롬 대강')),
  multiple numeric(10,1),                -- 평소 대비 배수
  reaction_score numeric(6,2),           -- 2·log10 조회수 + 2·log10 댓글 + log10 좋아요
  category text,                         -- 분류(승원 6개와 같은 이름)
  hook_3s text not null default '',      -- 첫 3초 문장
  flow text not null default '',         -- 이야기 전개 한 줄
  cta text not null default '',
  ad_status text check (ad_status in ('광고','광고 아님','확인 필요')),
  hook_formula text,                     -- 훅 공식(회사 사전)
  story_structure text,                  -- 이야기 구조(회사 사전)
  display_style text,                    -- 보여 주는 방식(회사 사전)
  same_format_accounts int,              -- 같은 형식을 쓴 서로 다른 계정 수
  reason text not null default '',       -- 추천 이유 한 줄
  ai_made text check (ai_made in ('예','아니오','모름')), -- AI로 만든 릴스인가
  music_title text,
  caution text,                          -- 주의(예: 소재 교체 필수). 없으면 null
  created_at timestamptz not null default now(),
  primary key (rec_date, shortcode)
);
create index if not exists daily_recs_date_rank_idx on daily_recs (rec_date desc, rank);

alter table daily_recs enable row level security;
revoke all on daily_recs from anon, authenticated;
grant select, insert, update on daily_recs to service_role;
revoke delete, truncate, references, trigger on daily_recs from service_role;
