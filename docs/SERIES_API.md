# 홈의 경쟁사 분석과 신규 채널 추천

## 경쟁사 분석

홈에서 경쟁사 분석을 선택하면 기존 경쟁사 화면을 볼 수 있습니다. `GET /api/references?days=7`은 Supabase `competitor_reels`에서 최근 등록된 릴스를 읽고 평소 조회수의 3배 이상을 계정별로 집계합니다. 동일한 `format_key`가 서로 다른 계정 두 곳 이상에서 조건을 충족하면 반복 형식으로 표시합니다. 등록된 선별 영상이 집계 범위입니다.

## 신규 채널 추천

1. Supabase에 `supabase/migrations/004_series_recommendation_runs.sql`을 적용합니다.
2. Next.js 서버에 기존 Supabase 설정과 함께 `OPENAI_API_KEY`, `SERIES_DRAFT_MODEL`, `SERIES_JUDGE_MODEL`, `SERIES_GENERATION_TOKEN`을 설정합니다. 두 모델 모두 Chat Completions JSON 모드를 지원해야 합니다.
3. 서버 담당자가 Bearer 토큰과 JSON 본문을 넣어 `POST /api/series`를 호출합니다. 첫 생성에는 `{}`를 보내고, 선별 결과를 사람이 검토한 뒤에는 예를 들어 `{"feedback":"제품 데모를 반복하는 안보다 시청자가 다음 편에 참여할 수 있는 포맷을 우선해 주세요."}`를 보낼 수 있습니다. 토큰은 서버 전용입니다.
4. 신규 채널 추천 탭은 `GET /api/series`에서 최근 성공 결과를 읽습니다. 생성 실패 시 이전 성공 결과를 그대로 표시합니다.

초안 모델은 방향 9개에 10개씩 생성합니다. 유효하고 이름이 중복되지 않는 후보가 80개 이상일 때 심사 모델이 모든 유효 후보를 비교해 5개를 고릅니다. 각 추천에는 실제 레퍼런스와 점수, 첫 3개 에피소드가 포함됩니다. 가중치는 근거 35%, 테르밋·Creazy 적합성 25%, 참신함 20%, 지속성 20%입니다. 광고로 확인된 영상은 선정 근거에서 제외합니다.
