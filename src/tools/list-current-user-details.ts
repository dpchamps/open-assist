import { Type, type Static } from '@mariozechner/pi-ai';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const userDetailsPath = resolve(__dirname, '..', '..', 'public', 'user-details.json');

const parameters = Type.Object({});

export const definition = {
    name: 'list_current_user_details',
    description: 'Get the current user details including name, location, job, interests, and bio',
    parameters,
};

export const execute = async (_params: Static<typeof parameters>) => {
    const raw = await readFile(userDetailsPath, 'utf-8');
    return raw;
};
