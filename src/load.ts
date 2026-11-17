import { appendFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

export class ConfigurationError extends Error {}

export type Variable = { name: string; value: string };
export type Mapping = { destination: string; source: string };
export type ReadVariables = (token: string, environmentId: string) => Promise<Variable[]>;
const namePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const reserved = /^(GITHUB_|RUNNER_|ACTIONS_|INPUT_|OP_|LD_|DYLD_)/i;
const special = new Set(['PATH', 'HOME', 'SHELL', 'ENV', 'BASH_ENV', 'NODE_OPTIONS', 'NODE_PATH', 'PYTHONPATH', 'PYTHONHOME']);

export function parseMappings(input: string): Mapping[] {
  const lines = input.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) throw new ConfigurationError('Specify at least one variable in variables.');
  const seen = new Set<string>();
  return lines.map(line => {
    const parts = line.split('=');
    const destination = parts[0]?.trim();
    const source = (parts[1] ?? parts[0])?.trim();
    if (parts.length > 2 || !namePattern.test(destination) || !namePattern.test(source)) {
      throw new ConfigurationError('Each variables line must be NAME or DEST=SOURCE.');
    }
    if (reserved.test(destination) || special.has(destination.toUpperCase())) {
      throw new ConfigurationError('Runner, authentication, and process-control variables cannot be used as destinations.');
    }
    if (seen.has(destination)) throw new ConfigurationError('Duplicate destination variable name.');
    seen.add(destination);
    return { destination, source };
  });
}

export function selectVariables(mappings: Mapping[], values: Variable[]): Variable[] {
  const available = new Map<string, string>();
  for (const variable of values) {
    if (typeof variable.name !== 'string' || typeof variable.value !== 'string' || available.has(variable.name)) {
      throw new ConfigurationError('The Environment response has an invalid format.');
    }
    available.set(variable.name, variable.value);
  }
  return mappings.map(({ destination, source }) => {
    const value = available.get(source);
    if (value === undefined || value.length === 0 || value.includes('\0')) {
      throw new ConfigurationError(`Required variable ${source} is missing, empty, or contains an unsupported value.`);
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
    throw new ConfigurationError('A token, an Environment ID, and the GitHub environment file are required.');
  }
  const mappings = parseMappings(options.variables);
  let values: Variable[];
  try { values = await options.read(options.token, options.environmentId); }
  catch { throw new ConfigurationError('1Password lookup failed. Check the token permissions, Environment ID, and connectivity.'); }
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
