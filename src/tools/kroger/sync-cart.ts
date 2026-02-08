import { Type } from '@mariozechner/pi-ai';
import type { AgentTool } from '@mariozechner/pi-agent-core';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchProducts } from './products.js';
import { addToKrogerCart } from './cart.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cartPath = resolve(__dirname, '..', '..', '..', 'public', 'shopping-cart.json');

type LocalCart = {
    items: ReadonlyArray<{ name: string; quantity: number; unit: string; type: string }>;
};

const readLocalCart = (path: string): Promise<LocalCart> =>
    readFile(path, 'utf-8')
        .then((content) => JSON.parse(content) as LocalCart)
        .catch(() => ({ items: [] }));

const formatPrice = (price: number | null) =>
    price !== null ? `$${price.toFixed(2)}` : 'N/A';

const formatProductMatch = (term: string, matches: ReadonlyArray<{ upc: string; description: string; brand: string; price: number | null; promoPrice: number | null }>) => {
    if (matches.length === 0) return `"${term}": No matches found`;

    const lines = matches.map((m, i) => {
        const promo = m.promoPrice !== null ? ` (sale: ${formatPrice(m.promoPrice)})` : '';
        return `  ${i + 1}. [${m.upc}] ${m.brand} - ${m.description} — ${formatPrice(m.price)}${promo}`;
    });

    return [`"${term}":`, ...lines].join('\n');
};

const parameters = Type.Object({
    action: Type.Union([
        Type.Literal('search'),
        Type.Literal('add'),
    ], { description: 'search: look up Kroger products for local cart items. add: add specific UPCs to the Kroger cart.' }),
    location_id: Type.Optional(Type.String({ description: 'Kroger store location ID for store-specific pricing and availability' })),
    search_terms: Type.Optional(Type.Array(Type.String(), { description: 'Override search terms instead of reading from local cart. Each string is searched as a product term.' })),
    items: Type.Optional(Type.Array(
        Type.Object({
            upc: Type.String({ description: 'UPC of the product to add' }),
            quantity: Type.Number({ description: 'Quantity to add' }),
        }),
        { description: 'Items to add to Kroger cart. Required for the "add" action.' },
    )),
});

const executeSearch = async (params: { location_id?: string; search_terms?: ReadonlyArray<string> }) => {
    const terms = params.search_terms ?? (await readLocalCart(cartPath)).items.map((item) => item.name);

    if (terms.length === 0) return 'No items to search for. The local cart is empty.';

    const results = await Promise.all(
        terms.map((term) =>
            searchProducts(term, { locationId: params.location_id })
                .then((matches) => formatProductMatch(term, matches))
                .catch((err) => `"${term}": Search failed — ${err instanceof Error ? err.message : String(err)}`)
        )
    );

    return ['Kroger product matches:', '', ...results].join('\n');
};

const executeAdd = async (items: ReadonlyArray<{ upc: string; quantity: number }> | undefined) => {
    if (!items?.length) return 'No items provided to add. Use the "search" action first to find UPCs.';

    await addToKrogerCart(items);
    return `Successfully added ${items.length} item(s) to your Kroger cart.`;
};

export const syncCartToKroger: AgentTool<typeof parameters> = {
    name: 'sync_cart_to_kroger',
    description: 'Sync the local shopping cart to Kroger. Use "search" to find Kroger products matching local cart items (returns UPCs and prices for review). Use "add" to add specific UPCs and quantities to the Kroger cart.',
    label: 'Syncing cart to Kroger',
    parameters,
    execute: async (_toolCallId, params) => ({
        content: [{
            type: 'text',
            text: params.action === 'search'
                ? await executeSearch(params)
                : await executeAdd(params.items),
        }],
        details: {},
    }),
};
