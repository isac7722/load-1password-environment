import * as core from '@actions/core';
import { load, ConfigurationError } from './load.ts';
import { readVariables } from './sdk.ts';

const timeout = setTimeout(() => {
  core.setFailed('1Password lookup exceeded the 60-second time limit.');
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
  core.info(`Passed ${count} variable(s) to subsequent steps.`);
}

// Only load() validation errors are intended for display; avoid raw filesystem/SDK errors.
run().catch(error => core.setFailed(error instanceof ConfigurationError ? error.message : 'Failed to pass the 1Password Environment variables. Check the runner environment file.')).finally(() => clearTimeout(timeout));
