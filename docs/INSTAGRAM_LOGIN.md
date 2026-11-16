# Instagram 비즈니스 로그인 연결

1. Supabase에 `cards` 테이블이 있는지 확인한 뒤 `006_instagram_token_permissions.sql`을 트랜잭션으로 적용합니다. 이 파일은 기존 대시보드에서 아직 생성하지 않은 계정·릴스 성과·토큰 저장소도 준비합니다.
2. 배포 환경에 서버 전용 변수 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_APP_ORIGIN`을 설정합니다. 앱 ID와 시크릿은 Meta 대시보드의 Instagram API 설정에 표시된 Instagram 자격 증명을 사용합니다.
3. `INSTAGRAM_APP_ORIGIN`은 끝 슬래시가 없는 배포 주소입니다. Meta의 Instagram 비즈니스 로그인 설정에 이 주소 뒤에 `/api/instagram/callback`을 붙인 HTTPS 주소를 유효한 OAuth 리디렉션 URI로 등록합니다. 배포를 여러 주소에서 열더라도 연결은 이 주소를 사용합니다.
4. 배포한 사이트의 `/accounts`를 열어 @creazy.app, @bbakk_creazy, @moodiee.ai 각각의 연결 버튼을 누르고 본인이 관리하는 계정으로 로그인합니다. `instagram_business_basic`과 `instagram_business_manage_insights`를 허용합니다. 개발 모드에서 테스트할 계정은 Meta 테스터 초대를 수락해야 합니다.
5. 연결 후 `/accounts`에서 연결 상태를 확인합니다. 기존 Vercel 수집 작업이 한국 시간 매일 03시대에 토큰을 확인하고 만료까지 20일 미만이면 갱신을 시도한 뒤 성과를 수집합니다. 배포 직후에는 인증된 서버 담당자가 수집 경로를 직접 호출해 확인할 수 있습니다.

`IG_TOKEN_<계정 ID>`에 넣어둔 토큰은 기존 설치에서 계속 지원합니다. 새 로그인으로 발급한 장기 토큰은 Supabase의 서버 전용 `ig_tokens`에 저장됩니다. Meta 시크릿과 토큰 값은 서버 설정에 입력하고 저장소에는 변수 이름만 남깁니다.
