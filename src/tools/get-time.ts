import { Type } from '@mariozechner/pi-ai';
import type { AgentTool } from '@mariozechner/pi-agent-core';

const parameters = Type.Object({
    timezone: Type.Optional(Type.String({ description: 'Optional timezone (e.g., America/New_York)' }))
});

export const getTime: AgentTool<typeof parameters> = {
    name: 'get_time',
    description: 'Get the current time',
    label: 'Getting time',
    parameters,
    execute: async (_toolCallId, params) => ({
        content: [{
            type: 'text',
            text: new Date().toLocaleString('en-US', {
                timeZone: params.timezone ?? 'UTC',
                dateStyle: 'full',
                timeStyle: 'long'
            }),
        }],
        details: {},
    }),
};
