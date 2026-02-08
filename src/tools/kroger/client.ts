export const KROGER_BASE_URL = 'https://api.kroger.com';

export const KROGER_REDIRECT_URI = 'http://localhost:3000/kroger/callback';

export const getKrogerClientId = () => {
    const id = process.env.KROGER_CLIENT_ID;
    if (!id) throw new Error('KROGER_CLIENT_ID environment variable is not set');
    return id;
};

export const getKrogerClientSecret = () => {
    const secret = process.env.KROGER_CLIENT_SECRET;
    if (!secret) throw new Error('KROGER_CLIENT_SECRET environment variable is not set');
    return secret;
};

export const getBasicAuthHeader = () => {
    const credentials = Buffer.from(`${getKrogerClientId()}:${getKrogerClientSecret()}`).toString('base64');
    return `Basic ${credentials}`;
};
