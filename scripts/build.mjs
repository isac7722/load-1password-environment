import { build } from 'esbuild';
import { mkdirSync, copyFileSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
await build({ entryPoints: ['src/index.ts'], bundle: true, platform: 'node', target: 'node24', format: 'cjs', outfile: 'dist/index.js', legalComments: 'linked' });
copyFileSync('node_modules/@1password/sdk-core/nodejs/core_bg.wasm', 'dist/core_bg.wasm');
writeFileSync('dist/package.json', '{"type":"commonjs"}\n');

const notices = [
  ['@1password/sdk and sdk-core', 'licenses/1password-sdk-MIT.txt'],
  ['@actions/core', 'node_modules/@actions/core/LICENSE.md'],
  ['@actions/exec', 'node_modules/@actions/exec/LICENSE.md'],
  ['@actions/io', 'node_modules/@actions/io/LICENSE.md'],
  ['@actions/http-client', 'node_modules/@actions/http-client/LICENSE'],
  ['tunnel', 'node_modules/tunnel/LICENSE'],
  ['undici', 'node_modules/undici/LICENSE'],
].map(([name, path]) => `## ${name}\n\n${readFileSync(path, 'utf8')}`).join('\n\n');
writeFileSync('dist/THIRD_PARTY_LICENSES.txt', notices);
