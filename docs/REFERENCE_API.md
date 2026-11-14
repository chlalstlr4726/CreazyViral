# 바이럴 레퍼런스 데이터 명세 (대시보드 ← 앞단)

대시보드는 `GET /api/references?days=3|7|14` 응답만 읽어서 그립니다.
지금은 `lib/references.ts`의 `loadReferences()`가 샘플을 돌려줘요. 이 함수만 DB/분석 결과로 바꾸면 화면은 그대로 동작해요.

## 응답
```json
{ "sample": false, "days": 7, "items": [ViralReference, ...] }
```
`sample`이 true면 화면에 "샘플" 안내가 떠요. 실제 데이터면 false.

## ViralReference (영상 1편)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | string | 고유값 |
| url | string | 릴스 링크 |
| username | string | 올린 계정 (@ 없이) |
| posted_at | ISO string | 올린 날짜 |
| plays | number | 조회수 |
| usual_plays | number or null | 그 계정 평소 조회수(최근 릴스 중앙값 등). 모르면 null |
| multiple | number or null (선택) | 배수. 안 주면 plays / usual_plays 로 화면에서 계산 |
| followers | number or null | 팔로워 수 |
| category | 아래 6개 중 하나 | 분류 |
| region | "국내" or "해외" | |
| hook_3s | string | 첫 3초 문장(자막이나 말) |
| duration_s | number | 길이(초) |
| flow | string | 내용 전개 한 줄 |
| cta | string | CTA. 없으면 빈 문자열 |
| is_ad | boolean or null | 광고 여부. 모르면 null |
| reason | string | 추천 이유 한 줄 |
| format_key | string or null (선택) | 같은 형식/소재를 묶는 이름. 서로 다른 계정 2곳 이상에서 같은 값이면 "여러 계정에서 반복"으로 표시 |

category 값(글자 그대로): `직접 경쟁사(AI 상세페이지)`, `AI SaaS`, `디자인 툴/서비스`, `셀러/커머스`, `마케팅 꿀팁`, `기타(포맷만 참고)`

## 참고
- 정렬과 분류/국내해외 필터는 화면에서 합니다. 앞단은 기간 내 영상을 모두 내려주면 돼요.
- `format_key`는 앞단 분석에서 정해주세요(예: "타이머 시연", "실수 체크리스트"). 같은 이름으로 통일돼야 반복이 정확히 잡혀요.
