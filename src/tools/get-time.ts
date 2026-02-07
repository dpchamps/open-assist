import { Type, type Static } from '@mariozechner/pi-ai';

const parameters = Type.Object({
    timezone: Type.Optional(Type.String({ description: 'Optional timezone (e.g., America/New_York)' }))
});

export const definition = {
    name: 'get_time',
    description: 'Get the current time',
    parameters,
};

export const execute = async (params: Static<typeof parameters>) =>
    new Date().toLocaleString('en-US', {
        timeZone: params.timezone ?? 'UTC',
        dateStyle: 'full',
        timeStyle: 'long'
    });
