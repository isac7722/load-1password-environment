import { createClient } from '@1password/sdk';
import type { ReadVariables } from './load.ts';

// Keep SDK/API migration inside this adapter. See README maintenance note.
export const readVariables: ReadVariables = async (token, environmentId) => {
  const client = await createClient({
    auth: token,
    integrationName: 'load-1password-environment',
    integrationVersion: 'v1.0.0',
  });
  const response = await client.environments.getVariables(environmentId);
  return response.variables;
};
