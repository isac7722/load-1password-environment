import { mkdtempSync, readFileSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
// Run only the shipped artifact outside the repo: no node_modules, no source files.
const dir=mkdtempSync(join(tmpdir(),'op-action-dist-'));
try {
  cpSync('dist',join(dir,'dist'),{recursive:true});
  writeFileSync(join(dir,'env'),'');
  const result=spawnSync(process.execPath,[join(dir,'dist/index.js')],{
    cwd:dir,encoding:'utf8',timeout:30000,
    env:{PATH:process.env.PATH,GITHUB_ENV:join(dir,'env'),'INPUT_SERVICE-ACCOUNT-TOKEN':'invalid-test-token','INPUT_ENVIRONMENT-ID':'test','INPUT_VARIABLES':'TEST_VALUE'},
  });
  assert.equal(result.status,1);
  assert.match(result.stdout,/::error::1Password 조회에 실패/);
  assert.doesNotMatch(result.stderr,/ENOENT|MODULE_NOT_FOUND|WebAssembly|Cannot find/);
  assert.equal(readFileSync(join(dir,'env'),'utf8'),'');
  // The fake token may appear only in the GitHub masking command, never diagnostics.
  assert.equal((result.stdout+result.stderr).replaceAll('::add-mask::invalid-test-token','').includes('invalid-test-token'),false);
  console.log('Standalone SDK/WASM artifact smoke passed.');
} finally {rmSync(dir,{recursive:true,force:true});}
