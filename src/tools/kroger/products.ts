import { KROGER_BASE_URL } from './client.js';
import { getClientCredentialsToken } from './auth.js';

type KrogerProductItem = {
    productId: string;
    upc: string;
    description: string;
    brand: string;
    items: ReadonlyArray<{
        size?: string;
        price?: {
            regular: number;
            promo: number;
        };
    }>;
};

type KrogerProductsResponse = {
    data: ReadonlyArray<KrogerProductItem>;
};

export type ProductMatch = {
    productId: string;
    upc: string;
    description: string;
    brand: string;
    price: number | null;
    promoPrice: number | null;
    size: string | null;
};

type SearchOptions = {
    locationId?: string | undefined;
    limit?: number | undefined;
};

const extractPrice = (item: KrogerProductItem): { price: number | null; promoPrice: number | null } => {
    const firstItem = item.items[0];
    if (!firstItem?.price) return { price: null, promoPrice: null };
    return {
        price: firstItem.price.regular,
        promoPrice: firstItem.price.promo > 0 ? firstItem.price.promo : null,
    };
};

const toProductMatch = (item: KrogerProductItem): ProductMatch => ({
    productId: item.productId,
    upc: item.upc,
    description: item.description,
    brand: item.brand,
    ...extractPrice(item),
    size: item.items[0]?.size ?? null,
});

export const searchProducts = (term: string, options: SearchOptions = {}): Promise<ReadonlyArray<ProductMatch>> => {
    const params = new URLSearchParams({ 'filter.term': term });
    if (options.locationId) params.set('filter.locationId', options.locationId);
    params.set('filter.limit', String(options.limit ?? 5));

    return getClientCredentialsToken()
        .then((token) =>
            fetch(`${KROGER_BASE_URL}/v1/products?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            })
        )
        .then((res) => {
            if (!res.ok) throw new Error(`Kroger product search failed: ${res.status} ${res.statusText}`);
            return res.json() as Promise<KrogerProductsResponse>;
        })
        .then((data) => data.data.map(toProductMatch));
};
