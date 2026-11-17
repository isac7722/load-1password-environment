import { appendFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

export type Variable = { name: string; value: string };
export type Mapping = { destination: string; source: string };
export type ReadVariables = (token: string, environmentId: string) => Promise<Variable[]>;
const namePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const reserved = /^(GITHUB_|RUNNER_|ACTIONS_|INPUT_|OP_|LD_|DYLD_)/i;
const special = new Set(['PATH', 'HOME', 'SHELL', 'ENV', 'BASH_ENV', 'NODE_OPTIONS', 'NODE_PATH', 'PYTHONPATH', 'PYTHONHOME']);

export function parseMappings(input: string): Mapping[] {
  const lines = input.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) throw new Error('variables에 하나 이상의 변수를 지정하세요.');
  const seen = new Set<string>();
  return lines.map(line => {
    const parts = line.split('=');
    const destination = parts[0]?.trim();
    const source = (parts[1] ?? parts[0])?.trim();
    if (parts.length > 2 || !namePattern.test(destination) || !namePattern.test(source)) {
      throw new Error('variables는 NAME 또는 DEST=SOURCE 형식이어야 합니다.');
    }
    if (reserved.test(destination) || special.has(destination.toUpperCase())) {
      throw new Error('runner·인증·프로세스 제어 변수는 대상으로 사용할 수 없습니다.');
    }
    if (seen.has(destination)) throw new Error('대상 변수 이름이 중복되었습니다.');
    seen.add(destination);
    return { destination, source };
  });
}

export function selectVariables(mappings: Mapping[], values: Variable[]): Variable[] {
  const available = new Map<string, string>();
  for (const variable of values) {
    if (typeof variable.name !== 'string' || typeof variable.value !== 'string' || available.has(variable.name)) {
      throw new Error('Environment 응답 형식이 올바르지 않습니다.');
    }
    available.set(variable.name, variable.value);
  }
  return mappings.map(({ destination, source }) => {
    const value = available.get(source);
    if (value === undefined || value.length === 0 || value.includes('\0')) {
      throw new Error('요청한 필수 값이 없거나 빈 값 또는 지원하지 않는 값입니다.');
    }
    return { name: destination, value };
  });
}

export function serialize(values: Variable[], delimiterFactory: () => string = randomUUID): string {
  return values.map(({ name, value }) => {
    let delimiter: string;
    do { delimiter = `op_env_${delimiterFactory()}`; } while (value.includes(delimiter));
    return `${name}<<${delimiter}\n${value}\n${delimiter}\n`;
  }).join('');
}

export async function load(options: {
  token: string; environmentId: string; variables: string; envFile: string;
  read: ReadVariables; mask: (value: string) => void;
}): Promise<number> {
  // Never expose SDK exceptions, which may contain credentials or response bodies.
  if (options.token) options.mask(options.token);
  if (!options.token || !/^[A-Za-z0-9_-]+$/.test(options.environmentId) || !options.envFile) {
    throw new Error('토큰, Environment ID와 GitHub 환경 파일이 필요합니다.');
  }
  const mappings = parseMappings(options.variables);
  let values: Variable[];
  try { values = await options.read(options.token, options.environmentId); }
  catch { throw new Error('1Password 조회에 실패했습니다. 토큰 권한·Environment ID·연결 상태를 확인하세요.'); }
  const selected = selectVariables(mappings, values);
  for (const { value } of selected) {
    options.mask(value);
    // Mask individual lines as well, even when a later command prints only one line.
    for (const line of value.split(/\r?\n/)) if (line) options.mask(line);
  }
  // Validate every requested value before a single append; no partial export on missing values.
  appendFileSync(options.envFile, serialize(selected), { encoding: 'utf8', flag: 'a' });
  return selected.length;
}
