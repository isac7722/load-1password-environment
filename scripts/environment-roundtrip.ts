import assert from 'node:assert/strict';
import { setSecret } from '@actions/core';
import { load } from '../src/load.ts';
const value = ' first%\nsecond\rthird "quote" $literal\n';
if (process.argv[2] === 'export') {
  await load({ token: 'fixture-token', environmentId: 'fixture-id', variables: 'CI_ROUNDTRIP=SOURCE',
    envFile: process.env.GITHUB_ENV!, mask: setSecret,
    read: async () => [{ name: 'SOURCE', value }, { name: 'UNSELECTED_TEST', value: 'must-not-export' }],
  });
} else {
  assert.equal(process.env.CI_ROUNDTRIP, value);
  assert.equal(process.env.UNSELECTED_TEST, undefined);
  console.log('GitHub environment roundtrip passed.');
}
