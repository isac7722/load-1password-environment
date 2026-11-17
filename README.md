# Load 1Password Environment

**English** | [한국어](README.ko.md)

Selects the variables you need from a 1Password Environment and passes them to subsequent GitHub Actions steps. Built with TypeScript, Node 24, and the official 1Password SDK; no Python or `op` CLI installation is required.

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

AWS OIDC also requires the `id-token: write` permission on the job. In production, pin the Action to the full commit SHA you have verified.

## Contract

- Grant the token read access to only the Environment it needs.
- `variables` takes one `NAME` or `DEST=SOURCE` per line. Blank lines are ignored.
- Every requested value must exist; empty strings and NUL characters are rejected. Values are passed to subsequent steps as environment variables in a single write, only after all of them have been validated.
- Multiline values, whitespace, quotes, and dollar signs are preserved. Values are never evaluated as shell script.
- Requested values and the token are registered for log masking. Raw SDK errors, responses, and secret values are never written to the log. GitHub masking does not protect encoded or transformed values, so do not print the values.
- No `.env` or separate secret file is created. The Action uses the `GITHUB_ENV` file provided by GitHub, so the values exist in the runner's temporary environment file and in subsequent steps. Environment variables are passed only to later steps of the same job.
- Mapping the same destination variable more than once fails. A later Action call that names the same variable overwrites the earlier value.
- `GITHUB_*`, `RUNNER_*`, `ACTIONS_*`, `INPUT_*`, `OP_*`, `LD_*`, `DYLD_*`, and PATH, HOME, SHELL, ENV, BASH_ENV, NODE_OPTIONS, NODE_PATH, PYTHONPATH, PYTHONHOME are rejected as destination names.
- The SDK reads the entire Environment and the selection happens in memory. Unselected values are not exported. To narrow the access scope itself, split Environments and service account permissions.
- A failed lookup fails the Action; it never falls back to previous values. The execution time limit is 60 seconds.

## Support and verification

Linux x64/ARM64 and macOS x64/ARM64 are verified in this repository's CI. Windows is not supported. `dist/index.js` and `dist/core_bg.wasm` are used together. The build output is committed to Git so the Action runs after checkout without installing dependencies.

```sh
npm ci
npm run check
```

Tests use only fake values. The packaging check loads the real SDK/WASM in a temporary directory without sources or node_modules and verifies that an invalid token fails safely. Integration with a real service account and Environment is verified separately in approved deployments of consuming repositories.

## SDK maintenance

The Action uses `environments.getVariables` from the currently published `@1password/sdk@0.5.0`. The official documentation announces removal of the existing API and a move to the `list_secrets` family on 2027-01-20, but the published JavaScript package we checked does not include the new API yet. When a new JS version ships, `src/sdk.ts` and the real integration check must be updated. [Official notice](https://www.1password.dev/sdks/environments)

## Releases

Release commits that pass CI on all four platforms and have been verified against a real Environment. Patch version tags are never moved; only `v1` moves to the latest verified compatible release. Breaking changes are published as a new major version. The short usage example in this README uses `@v1`; production consumers can pin a SHA.

MIT licensed. Keep the license notices of the SDK and bundled dependencies in `licenses/` and `dist/` together.
