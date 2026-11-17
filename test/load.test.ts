import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, parseMappings, serialize } from '../src/load.ts';

function fixture(t: TestContext) {
  const dir=mkdtempSync(join(tmpdir(),'op-action-test-')); t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const envFile=join(dir,'env');writeFileSync(envFile,'existing=value\n');
  const masked:string[]=[];
  return {envFile,masked,options:{token:'fake-token',environmentId:'test-id',variables:'DEST=SOURCE\nOTHER',envFile,mask:(s:string)=>masked.push(s),read:async()=>[{name:'SOURCE',value:'a%\nb\rc'}, {name:'OTHER',value:' quote=" $literal '}, {name:'UNSELECTED',value:'never-export'}]}};
}

test('selected mapping preserves multiline and whitespace, masks before export',async t=>{
  const f=fixture(t);assert.equal(await load(f.options),2);
  const content=readFileSync(f.envFile,'utf8');assert.match(content,/DEST<</);assert.ok(content.includes('a%\nb\rc'));assert.ok(content.includes(' quote=" $literal '));assert.ok(!content.includes('never-export'));assert.ok(f.masked.includes('a%\nb\rc'));assert.ok(f.masked.includes('b\rc'));assert.ok(f.masked.includes('fake-token'));
});
test('missing and empty values do not partially append',async t=>{
  for (const value of [undefined,'','a\0b']) {
    const f=fixture(t);f.options.read=async()=>[{name:'SOURCE',value:'exists'},...(value===undefined?[]:[{name:'OTHER',value}])];
    await assert.rejects(load(f.options));assert.equal(readFileSync(f.envFile,'utf8'),'existing=value\n');
  }
});
test('SDK error body never escapes',async t=>{
  const f=fixture(t);f.options.read=async()=>{throw new Error('private-payload fake-token')};
  await assert.rejects(load(f.options),e=>!String(e).includes('private-payload')&&!String(e).includes('fake-token'));
  assert.equal(readFileSync(f.envFile,'utf8'),'existing=value\n');
});
test('invalid inputs fail before calling provider',async t=>{
  const f=fixture(t);let called=false;f.options.read=async()=>{called=true;return []};
  for (const variables of ['','A=B=C','A\nA=B','GITHUB_ENV','PATH','NODE_OPTIONS','LD_PRELOAD','OP_SERVICE_ACCOUNT_TOKEN','A;echo']) {
    await assert.rejects(load({...f.options,variables}));
  }assert.equal(called,false);
});
test('malformed/duplicate provider response is rejected',async t=>{
  const f=fixture(t);f.options.read=async()=>[{name:'SOURCE',value:'a'},{name:'SOURCE',value:'b'}];
  await assert.rejects(load(f.options));assert.equal(readFileSync(f.envFile,'utf8'),'existing=value\n');
});
test('delimiter collision chooses another delimiter',()=>{
  const ids=['collision','safe'];const result=serialize([{name:'A',value:'op_env_collision\nsecret'}],()=>ids.shift()!);
  assert.equal(result,'A<<op_env_safe\nop_env_collision\nsecret\nop_env_safe\n');
});
test('mapping accepts CRLF and ignores blank lines',()=>{
  assert.deepEqual(parseMappings(' A = B\r\n\r\n C '),[{destination:'A',source:'B'},{destination:'C',source:'C'}]);
});
