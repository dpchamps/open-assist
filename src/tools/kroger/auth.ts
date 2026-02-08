import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KROGER_BASE_URL, KROGER_REDIRECT_URI, getKrogerClientId, getBasicAuthHeader } from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_TOKEN_PATH = resolve(__dirname, '..', '..', '..', 'public', 'kroger-tokens.json');

type TokenData = {
    access_token: string;
    refresh_token: string;
    expires_at: number;
};

type TokenResponse = {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
};

const readTokens = (path: string): Promise<TokenData | null> =>
    readFile(path, 'utf-8')
        .then((content) => JSON.parse(content) as TokenData)
        .catch(() => null);

export const writeTokens = (tokens: TokenData, path: string = DEFAULT_TOKEN_PATH): Promise<void> =>
    writeFile(path, JSON.stringify(tokens, null, 2), 'utf-8');

const tokenResponseToData = (response: TokenResponse, existingRefreshToken?: string): TokenData => ({
    access_token: response.access_token,
    refresh_token: response.refresh_token ?? existingRefreshToken ?? '',
    expires_at: Date.now() + response.expires_in * 1000,
});

export const getClientCredentialsToken = (): Promise<string> =>
    fetch(`${KROGER_BASE_URL}/v1/connect/oauth2/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: getBasicAuthHeader(),
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            scope: 'product.compact',
        }),
    })
        .then((res) => {
            if (!res.ok) throw new Error(`Client credentials token request failed: ${res.status} ${res.statusText}`);
            return res.json() as Promise<TokenResponse>;
        })
        .then((data) => data.access_token);

export const exchangeCodeForTokens = (code: string): Promise<TokenData> =>
    fetch(`${KROGER_BASE_URL}/v1/connect/oauth2/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: getBasicAuthHeader(),
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: KROGER_REDIRECT_URI,
        }),
    })
        .then((res) => {
            if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${res.statusText}`);
            return res.json() as Promise<TokenResponse>;
        })
        .then(tokenResponseToData);

export const refreshAccessToken = (refreshToken: string): Promise<TokenData> =>
    fetch(`${KROGER_BASE_URL}/v1/connect/oauth2/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: getBasicAuthHeader(),
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }),
    })
        .then((res) => {
            if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${res.statusText}`);
            return res.json() as Promise<TokenResponse>;
        })
        .then((data) => tokenResponseToData(data, refreshToken));

export const getValidAccessToken = (tokenFilePath: string = DEFAULT_TOKEN_PATH): Promise<string | null> =>
    readTokens(tokenFilePath).then((tokens) => {
        if (!tokens) return null;

        if (tokens.expires_at > Date.now() + 60_000) return tokens.access_token;

        if (!tokens.refresh_token) return null;

        return refreshAccessToken(tokens.refresh_token)
            .then((refreshed) => writeTokens(refreshed, tokenFilePath).then(() => refreshed.access_token))
            .catch(() => null);
    });

export const buildAuthUrl = () => {
    const params = new URLSearchParams({
        scope: 'cart.basic:write',
        response_type: 'code',
        client_id: getKrogerClientId(),
        redirect_uri: KROGER_REDIRECT_URI,
    });
    return `${KROGER_BASE_URL}/v1/connect/oauth2/authorize?${params.toString()}`;
};
