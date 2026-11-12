# Creazy 데일리 바이럴 카드 대시보드

매일 카드 2장(Dummy / 서비스 소개)을 보여주고, 그 아래에 연결된 인스타 계정들의 성과를 함께 보여주는 PC용 웹 대시보드.
Next.js 15 (App Router) + Tailwind v4 + Recharts, 데이터는 Supabase.

## 지금 상태

| 항목 | 상태 |
|---|---|
| 홈: 오늘의 카드 2장 + 방향성 제언 + 성과 대시보드 | ✅ 샘플 데이터 |
| 선택 → 스토리보드 상세, 패스(사유), 다른 소재로 재생성 | ✅ (브라우저 localStorage에 저장) |
| 게시 후 인스타 URL 붙여넣기로 카드 ↔ 게시물 연결 | ✅ 샘플 URL로 동작 확인 |
| 포맷별 성과 (계정 평균 대비 배수) | ✅ |
| 히스토리, 개발자 제언(`/insights`) | ✅ |
| Supabase 스키마 | ✅ `supabase/migrations/001_init.sql` (Postgres 16에서 적용·조회 검증) |
| Supabase 실제 연결 / 승원 카드 API / 인스타 공식 API 연동 | ⏳ 아직 (mock 사용 중) |
| 슬랙 전송 | ⏳ 나중에 (카드 상세 주소 `/cards/{card_id}`가 바로가기 링크) |

## 실행

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 프로덕션 빌드
```

Vercel 배포: 이 폴더를 Git 저장소로 올리고 Vercel에서 Import → 기본 설정 그대로 배포.
환경변수는 `.env.example` 참고 (Supabase 연결 단계에서 사용).

## 구조

```
app/                 페이지 (/, /history, /insights, /accounts, /cards/[id])
components/          화면 조각 (CardTile, TodaySection, PerformanceSection, LinkPost …)
lib/types.ts         데이터 계약 (카드 JSON, 이벤트, 게시물)
lib/mock.ts          샘플 데이터 — 승원 API / Supabase 연결 시 교체 대상
lib/store.tsx        선택·패스·재생성·URL 연결 상태 (card_events 와 1:1 구조)
lib/analytics.ts     성과 점수(계정 평균 대비 배수), 포맷별 집계, KPI
lib/recommend.ts     일일 방향성 제언 (규칙 기반, 근거 함께 반환)
lib/devInsights.ts   도하·승원에게 보낼 데이터 기반 제안
supabase/migrations/ DB 스키마 + 분석 뷰
docs/DEV_MESSAGE.md  도하·승원에게 전달할 메시지
```

## 핵심 정의

- **성과 점수** = 조회수 ÷ 같은 계정 직전 게시물(최대 20개) 조회수 중앙값. 1.0x = 평소 수준.
- **포맷별 성과** = 카드와 연결된 게시물만 집계, 포맷별 중앙값. 표본 3개 미만은 ‘참고용’.
- **방향성 제언** 규칙은 `lib/recommend.ts` 상단 주석 참고. 최근 7일 게시물이 3개 미만이면 ‘근거 부족’으로 표시.

## Supabase 연결할 때 바꿀 곳

1. `supabase/migrations/001_init.sql` 적용
2. `lib/store.tsx`의 `SEED_EVENTS`/`POSTS`/`cardIndex`와 이벤트 저장(`push`)을 DB 조회·insert로 교체
3. 오늘 카드(`todayPool`)와 재생성을 승원 API 호출로 교체
4. 인스타 공식 API 연결 후 `posts`·`post_metric_snapshots` 수집 (게시 후 24h/72h/7d)
