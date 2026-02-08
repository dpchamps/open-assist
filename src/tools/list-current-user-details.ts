import { Type } from '@mariozechner/pi-ai';
import type { AgentTool } from '@mariozechner/pi-agent-core';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const userDetailsPath = resolve(__dirname, '..', '..', 'public', 'user-details.json');

const parameters = Type.Object({});

export const listCurrentUserDetails: AgentTool<typeof parameters> = {
    name: 'list_current_user_details',
    description: 'Get the current user details including name, location, job, interests, and bio',
    label: 'Loading user details',
    parameters,
    execute: async (_toolCallId, _params) => ({
        content: [{
            type: 'text',
            text: await readFile(userDetailsPath, 'utf-8'),
        }],
        details: {},
    }),
};
