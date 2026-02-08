import { Type } from '@mariozechner/pi-ai';
import type { AgentTool } from '@mariozechner/pi-agent-core';
import { getValidAccessToken, buildAuthUrl } from './auth.js';

const parameters = Type.Object({
    action: Type.Union([
        Type.Literal('check'),
        Type.Literal('initiate'),
    ], { description: 'check: verify if user is authenticated with Kroger. initiate: get the authorization URL for the user to visit.' }),
});

const checkAuth = () =>
    getValidAccessToken()
        .then((token) =>
            token
                ? 'User is authenticated with Kroger. You can proceed with cart operations.'
                : 'User is not authenticated with Kroger. Use the "initiate" action to get the auth URL.'
        )
        .catch(() => 'User is not authenticated with Kroger. Use the "initiate" action to get the auth URL.');

const initiateAuth = () => {
    const url = buildAuthUrl();
    return `Please visit this URL to authorize Kroger access:\n\n${url}\n\nAfter authorizing, Kroger will redirect back to the local server and authentication will be complete.`;
};

export const krogerAuth: AgentTool<typeof parameters> = {
    name: 'kroger_auth',
    description: 'Manage Kroger OAuth2 authentication. Use "check" to verify if the user is authenticated, or "initiate" to get the authorization URL.',
    label: 'Managing Kroger auth',
    parameters,
    execute: async (_toolCallId, params) => ({
        content: [{
            type: 'text',
            text: params.action === 'check' ? await checkAuth() : initiateAuth(),
        }],
        details: {},
    }),
};
