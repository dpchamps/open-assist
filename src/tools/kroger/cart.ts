import { KROGER_BASE_URL } from './client.js';
import { getValidAccessToken } from './auth.js';

type CartItem = {
    upc: string;
    quantity: number;
    modality?: string;
};

export const addToKrogerCart = (items: ReadonlyArray<CartItem>): Promise<void> =>
    getValidAccessToken()
        .then((token) => {
            if (!token) throw new Error('Not authenticated with Kroger. Please complete the OAuth flow first.');
            return fetch(`${KROGER_BASE_URL}/v1/cart/add`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    items: items.map((item) => ({
                        upc: item.upc,
                        quantity: item.quantity,
                        ...(item.modality ? { modality: item.modality } : {}),
                    })),
                }),
            });
        })
        .then((res) => {
            if (!res.ok) throw new Error(`Failed to add items to Kroger cart: ${res.status} ${res.statusText}`);
        });
