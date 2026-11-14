-- 인스타 공식 API 수집용 (001_init.sql 다음에 실행).
-- 적용 전 확인: 팀원이 posts / post_metric_snapshots 에 직접 쌓는 방식이면 1번(계정 행)과 2번(토큰 표)만 필요하거나 필요 없을 수 있어요.

-- 1) 계정 3개 행 (handle 기준으로 한 번만). 수집기가 ig_user_id, followers, status 를 채웁니다.
create unique index if not exists ig_accounts_handle_uidx on ig_accounts (handle);
insert into ig_accounts (handle, name) values
  ('moodiee.ai', '무디'),
  ('creazy.app', '크리에이지 공식'),
  ('bbakk_creazy', '빡')
on conflict (handle) do nothing;

-- 2) 장기 토큰 보관 (약 60일마다 수집기가 자동 갱신). 서버 키로만 접근: RLS 켜고 정책을 만들지 않음 → 브라우저(anon)에서는 읽을 수 없음.
create table if not exists ig_tokens (
  handle text primary key references ig_accounts(handle) on delete cascade,
  token text not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table ig_tokens enable row level security;

-- 3) 24시간/72시간/7일 체크포인트는 게시물당 한 번만 기록
create unique index if not exists snapshots_checkpoint_uidx
  on post_metric_snapshots (post_id, checkpoint) where checkpoint in ('24h', '72h', '7d');
