# 인스타 공식 API 연결 순서

흐름: 인스타 공식 API (계정 3개) → 매일 수집(`/api/cron/collect-insights`) → Supabase(posts, post_metric_snapshots) → 대시보드(`/api/posts`)

## 1. 앱 만들기 (회사 소유 권장)
- 회사의 Meta Business(비즈니스 포트폴리오)에 앱을 만들고, 회사 담당자를 앱 관리자로 2명 이상 지정하세요.
- 앱 이름 예: creazy-dashboard. 제품은 "Instagram" (Instagram 로그인으로 API 사용) 추가.
- 앱 역할에서 세 계정(moodiee.ai, creazy.app, bbakk_creazy)을 Instagram 테스터로 초대하고, 각 계정 주인이 수락.

## 2. 토큰 받기 (계정 주인이 각자)
앱 대시보드 Instagram > API setup with Instagram login > 계정 옆 Generate token. 나온 토큰과 계정 ID를 1:1로 전달.
토큰은 비밀번호처럼 다루고 단체방에 올리지 마세요.

## 3. 넣는 곳
- `.env.local`과 Vercel 환경변수: `IG_TOKEN_MOODIEE`, `IG_TOKEN_CREAZY`, `IG_TOKEN_BBAKK`, `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`
- Supabase SQL: `001_init.sql` 이 이미 적용돼 있어야 하고, 이어서 `003_instagram_collect.sql` 실행
- 토큰 갱신본은 DB `ig_tokens`에 자동 저장됩니다(약 60일 만료 전 수집기가 갱신).

## 4. 시험
`curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/collect-insights`
결과에 계정별 ok/error가 나옵니다. 성공하면 대시보드 성과 영역 상단에 "인스타 공식 API 실제 데이터"가 뜹니다.

## 수집 방식
- 하루 1번(기본 03:00 KST, `vercel.json`)이면 24시간/72시간/7일 값은 그 시점 직후 24시간 안에 처음 읽은 값으로 기록됩니다. 더 정확히 하려면 크론을 시간 단위로(Vercel 유료 플랜 필요).
- 읽는 지표: 조회수, 도달, 좋아요, 댓글, 공유, 저장 (릴스만, 최근 30일).
- 팀원이 직접 DB에 쌓는 경우에도 같은 표(posts, post_metric_snapshots)에 쌓으면 화면은 그대로 동작합니다. 계정은 ig_accounts.status = 'connected' 여야 실제 데이터로 표시됩니다.
