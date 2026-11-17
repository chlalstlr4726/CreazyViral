# Creazy 영상 추천 API

테르밋의 Creazy를 이용하는 셀러를 위한 숏폼 영상 기획안을 A안과 B안으로 제공합니다. A안은 바이럴 성과와 촬영 가능성을, B안은 바이럴 성과와 Creazy 홍보 적합성을 고려합니다.

## VS Code에서 실행하기

1. VS Code에서 **파일 → 폴더 열기**를 눌러 이 README가 들어 있는 `creazy-api` 폴더를 엽니다.
2. 상단 메뉴에서 **터미널 → 새 터미널**을 누르고 아래 명령을 실행합니다. Node.js 22 이상이 필요하며 이 프로젝트는 별도 패키지 설치 없이 실행됩니다.

   ```sh
   node --env-file-if-exists=.env.local server.mjs
   ```

3. 브라우저에서 [추천 결과 보기](http://127.0.0.1:3000/api/recommendations)를 엽니다. `recommendations.A`와 `recommendations.B` 아래에 두 기획안이 나옵니다.
4. 종료하려면 VS Code 터미널에서 **Ctrl+C**를 누릅니다.

기본값인 `mock` + `demo`는 가상 릴스와 미리 작성한 기획안을 사용합니다. A안은 조회수 480,000, 공유 수 9,600, 조회 대비 공유율 2.00%를 표시합니다. B안은 조회수 260,000, 공유 수 7,800, 조회 대비 공유율 3.00%를 표시합니다.

## AI 생성 켜기

VS Code에서 `.env.example`을 복사해 같은 폴더에 `.env.local`로 저장합니다. 그 파일에서 `GENERATOR=openai`로 바꾸고 `OPENAI_API_KEY=` 뒤에 본인의 키를 입력한 다음 서버를 다시 실행합니다. `.env.local`은 Git에서 제외됩니다. `DATA_SOURCE=mock`으로 두면 같은 브라우저 주소에서 가상 데이터 기반의 AI 기획을 생성합니다.

## 팀 데이터로 연결하기

팀 데이터 연결 방식은 초기 제안입니다. 서버 설정을 `DATA_SOURCE=real` 및 `GENERATOR=openai`로 바꾸면 팀 서버가 `POST /api/recommendations`에 전날 데이터 묶음을 보냅니다. 아래 예시의 날짜는 요청하는 날의 한국 시간 기준 전날로 바꿉니다.

```json
{
  "date": "2026-11-11",
  "reels": [
    {
      "id": "reel-001",
      "format": "전후 비교",
      "summary": "상품 사진과 완성된 홍보 영상을 비교한다.",
      "views": 260000,
      "shares": 7800
    }
  ]
}
```

릴스마다 고유 ID, 포맷, 분석 요약, 양의 정수 조회수가 필요합니다. 공유 수와 HTTPS 원본 링크(`url`)는 선택입니다. 조회수는 원본 그대로 반환하고, 공유율은 공유 수 ÷ 조회수 × 100으로 계산해 소수점 둘째 자리까지 반환합니다. 공유 수가 없으면 공유 수와 공유율은 모두 `null`입니다. 실제 모드에서 입력 데이터가 없거나 날짜가 틀리면 오류가 반환됩니다.

두 모드 모두 응답의 `recommendations.A`, `recommendations.B`에 제목(`title`), 이유(`reason`), 장면별 시간·촬영 지시·자막(`scenes`), 원본 릴스 지표(`evidence`)를 담습니다. `dataSource`와 `generator`로 데이터 출처와 기획안 생성 방식을 확인할 수 있습니다.

서버는 현재 이 컴퓨터에서만 접속할 수 있습니다. 팀 대시보드 연결 시 배포 주소와 실제 데이터 전달 방식을 팀과 맞추면 됩니다.

## 오늘의 카드 두 장

| 주소 | 가상 데이터 모드 | 실제 데이터 모드 |
|---|---|---|
| `/cards/preview` | GET | 전날 데이터 JSON을 담은 POST |
| `/cards/generate` | POST | 전날 데이터 JSON을 담은 POST |

`/cards/preview`는 팀의 카드 형식으로 변환한 두 장을 보여줍니다. Supabase 설정 없이 실행할 수 있습니다. 예를 들어 서버를 3001번에서 실행 중이면 브라우저에서 `http://127.0.0.1:3001/cards/preview`를 엽니다.

`/cards/generate`에는 `?account_id=moodiee`, `?account_id=creazy`, `?account_id=bbakk` 중 하나가 필요합니다. `/cards/preview`에도 같은 값을 전달해 계정별 결과를 미리 볼 수 있습니다.

`/cards/generate`는 Supabase의 `cards`에 오늘 날짜(한국 시간)의 `dummy`와 `service`를 한 요청으로 저장하고, DB에서 두 장을 다시 읽어 반환합니다. 같은 날짜·계정의 최초 카드 두 장이 이미 있으면 기존 카드를 반환합니다. 일부만 있으면 기존 카드를 보존하면서 빠진 카드를 채웁니다.

저장 테스트에는 팀의 `001_init.sql`이 적용된 테스트 프로젝트를 사용합니다. 서버의 `.env.local`에 `SUPABASE_URL`과 서버 전용 `SUPABASE_SECRET_KEY`를 추가한 뒤 재시작합니다. `DATA_SOURCE=mock`으로 저장하면 카드의 추천 근거에 가상 참고 게시물이라고 표시됩니다. 실제 저장을 테스트하려면 서버를 켜 둔 채 별도 PowerShell 터미널에서 아래 명령을 실행합니다.

```powershell
foreach ($accountId in @('moodiee', 'creazy', 'bbakk')) {
  Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3001/cards/generate?account_id=$accountId" | ConvertTo-Json -Depth 10
}
```

카드 ID는 `YYYY-MM-DD-dummy-{account_id}-0`과 `YYYY-MM-DD-service-{account_id}-0`입니다. 실제 모드에서는 각 POST에 전날 릴스 JSON을 담아 주세요. 추천 근거의 조회수와 공유 수는 입력에서 가져옵니다. 오디오는 미정으로 표시하며, 분석 점수와 회사 소재 ID는 팀 데이터가 준비되면 연결합니다. 재생성 API와 아침 실행 일정은 후속 작업입니다.

## Supabase 추천 표에서 바로 읽기 (`DATA_SOURCE=db`)

`DATA_SOURCE=db`로 두면 서버가 요청 본문 대신 Supabase의 매일 추천 표(`daily_recs`)에서 한국 시간 기준 전날의 상위 10편(`in_top10 = true`, `rank` 순)을 읽어 재료로 씁니다. 릴스 JSON을 따로 보낼 필요가 없습니다.

- 필요한 설정: `DATA_SOURCE=db`, `GENERATOR=openai`, `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`
- 칸 대응: `id` ← `shortcode`, `format` ← `flow`(전개 한 줄), `summary` ← "첫 3초: `hook_3s`"(+ 끝에 행동 유도가 있으면 " / 끝: `cta`"), `views` ← `plays`, `shares` ← `shares`, `url` ← `url`
- `/cards/preview`는 GET, `/cards/generate`는 POST(본문 없음)로 부릅니다.
- 전날 추천이 아직 없으면 404를 돌려줍니다.

```powershell
foreach ($accountId in @('moodiee', 'creazy', 'bbakk')) {
  Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3001/cards/generate?account_id=$accountId" | ConvertTo-Json -Depth 10
}
```
