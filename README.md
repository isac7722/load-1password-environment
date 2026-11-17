# Load 1Password Environment

1Password Environment의 필요한 변수를 선택해 다음 GitHub Actions step에 전달한다. TypeScript·Node 24와 공식 1Password SDK를 사용하며 Python·op CLI 설치는 필요 없다.

```yaml
- name: Load deployment configuration
  uses: isac7722/load-1password-environment@v1
  with:
    service-account-token: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
    environment-id: ${{ vars.OP_ENVIRONMENT_ID }}
    variables: |
      AWS_DEPLOY_ROLE_ARN
      AWS_REGION
      DATABASE_PASSWORD=DB_PASSWORD

- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ env.AWS_DEPLOY_ROLE_ARN }}
    aws-region: ${{ env.AWS_REGION }}
```

AWS OIDC를 사용하려면 job에 `id-token: write` 권한도 필요하다. 운영에서는 Action을 검증한 전체 커밋 SHA로 고정하는 것을 권장한다.

## 계약

- 토큰에는 필요한 Environment 읽기 권한만 부여한다.
- `variables`는 한 줄에 `NAME` 또는 `DEST=SOURCE`를 사용한다. 빈 줄은 무시한다.
- 요청한 모든 값이 있어야 하며 빈 문자열·NUL 문자는 거부한다. 전체 검증 후 한 번에 후속 step 환경변수로 전달한다.
- 다중 행·공백·따옴표·달러 기호를 보존한다. 쉘 스크립트로 평가하지 않는다.
- 요청한 값과 토큰을 로그 마스킹에 등록한다. 원본 SDK 오류·응답·비밀값은 로그에 출력하지 않는다. GitHub의 마스킹은 인코딩·가공된 값까지 보호하지 않으므로 값을 출력하지 않는다.
- `.env`나 별도 비밀값 파일을 생성하지 않는다. GitHub가 제공하는 `GITHUB_ENV` 파일을 사용하므로 runner의 임시 환경 파일과 후속 step에는 값이 존재한다. 환경변수는 같은 job의 이후 step에만 전달된다.
- 같은 대상 변수를 여러 번 매핑하면 실패한다. 후속 Action 호출에서 같은 이름을 명시하면 기존 값을 덮어쓴다.
- `GITHUB_*`, `RUNNER_*`, `ACTIONS_*`, `INPUT_*`, `OP_*`, `LD_*`, `DYLD_*`, PATH·HOME·SHELL·ENV·BASH_ENV·NODE_OPTIONS·NODE_PATH·PYTHONPATH·PYTHONHOME는 대상 이름으로 거부한다.
- SDK는 Environment 전체를 읽고 메모리에서 선택한다. 선택하지 않은 값은 export하지 않는다. 접근 범위 자체를 줄이려면 Environment와 서비스 계정 권한을 분리한다.
- 조회 실패는 Action 실패로 처리하며 과거 값으로 대체하지 않는다. 실행 제한 시간은 60초다.

## 지원과 검증

Linux x64·ARM64, macOS x64·ARM64를 자체 CI에서 검증한다. Windows는 지원 범위 밖이다. `dist/index.js`와 `dist/core_bg.wasm`을 함께 사용한다. checkout 후 의존성 설치 없이 실행 가능하도록 배포 산출물을 Git에 포함한다.

```sh
npm ci
npm run check
```

테스트는 가짜 값만 사용한다. 패키징 검증은 소스와 node_modules가 없는 임시 디렉터리에서 실제 SDK/WASM을 로드하고 잘못된 토큰의 안전한 실패를 검사한다. 실제 서비스 계정·Environment 연동은 소비 저장소의 승인된 배포에서 별도로 확인한다.

## SDK 유지보수

현재 배포된 `@1password/sdk@0.5.0`의 `environments.getVariables`를 사용한다. 공식 문서는 2027-01-20에 기존 API 제거와 `list_secrets` 계열 전환을 예고하지만, 확인한 JavaScript 배포 패키지에는 새 API가 없다. 새 JS 버전이 제공되면 `src/sdk.ts`와 실제 연동 검증을 갱신해야 한다. [공식 안내](https://www.1password.dev/sdks/environments)

## 릴리스

네 플랫폼 CI가 통과하고 실제 Environment 연동을 검증한 커밋을 릴리스한다. 패치 버전 태그는 변경하지 않고 `v1`만 검증한 최신 호환 릴리스로 이동한다. breaking change는 새 major로 게시한다. README의 간단한 사용 예시는 `@v1`을 사용하며 운영 소비자는 SHA를 고정할 수 있다.

MIT 라이선스. SDK와 번들 의존성의 라이선스는 `licenses/`와 `dist/`의 notices를 함께 보존한다.
