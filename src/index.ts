import * as core from '@actions/core';
import { load, ConfigurationError } from './load.ts';
import { readVariables } from './sdk.ts';

const timeout = setTimeout(() => {
  core.setFailed('1Password 조회 제한 시간(60초)을 초과했습니다.');
  process.exit(1);
}, 60_000);

async function run() {
  const count = await load({
    token: core.getInput('service-account-token'),
    environmentId: core.getInput('environment-id'),
    variables: core.getInput('variables', { trimWhitespace: false }),
    envFile: process.env.GITHUB_ENV ?? '',
    read: readVariables,
    mask: core.setSecret,
  });
  core.info(`${count}개 변수를 후속 step에 전달했습니다.`);
}

// Only load() validation errors are intended for display; avoid raw filesystem/SDK errors.
run().catch(error => core.setFailed(error instanceof ConfigurationError ? error.message : '1Password Environment 전달에 실패했습니다. runner 환경 파일을 확인하세요.')).finally(() => clearTimeout(timeout));
