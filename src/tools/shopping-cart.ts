import { Type } from '@mariozechner/pi-ai';
import type { AgentTool } from '@mariozechner/pi-agent-core';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cartPath = resolve(__dirname, '..', '..', 'public', 'shopping-cart.json');

type CartItem = {
    name: string;
    quantity: number;
    unit: string;
    type: string;
};

type Cart = {
    items: ReadonlyArray<CartItem>;
};

const normalizeItem = (item: Omit<CartItem, 'unit'> & { unit?: string }): CartItem => ({
    ...item,
    unit: item.unit ?? 'count',
});

const readCart = (path: string): Promise<Cart> =>
    readFile(path, 'utf-8')
        .then((content) => JSON.parse(content) as Cart)
        .then((cart) => ({ items: cart.items.map(normalizeItem) }))
        .catch(() => ({ items: [] }));

const writeCart = (path: string, cart: Cart): Promise<void> =>
    writeFile(path, JSON.stringify(cart, null, 2), 'utf-8');

const addItems = (cart: Cart, newItems: ReadonlyArray<CartItem>): Cart => ({
    items: newItems.reduce<ReadonlyArray<CartItem>>((acc, newItem) => {
        const existingIndex = acc.findIndex(
            (item) => item.name.toLowerCase() === newItem.name.toLowerCase()
                && item.type.toLowerCase() === newItem.type.toLowerCase()
        );
        return existingIndex >= 0
            ? acc.map((item, i) =>
                i === existingIndex
                    ? { ...item, quantity: item.quantity + newItem.quantity, unit: newItem.unit }
                    : item
            )
            : [...acc, newItem];
    }, cart.items),
});

const removeItems = (cart: Cart, itemsToRemove: ReadonlyArray<{ name: string; quantity?: number }>): Cart => ({
    items: itemsToRemove.reduce<ReadonlyArray<CartItem>>((acc, removeItem) => {
        const existingIndex = acc.findIndex(
            (item) => item.name.toLowerCase() === removeItem.name.toLowerCase()
        );
        if (existingIndex < 0) return acc;
        if (removeItem.quantity === undefined) return acc.filter((_, i) => i !== existingIndex);
        const existing = acc[existingIndex]!;
        const newQuantity = existing.quantity - removeItem.quantity;
        return newQuantity <= 0
            ? acc.filter((_, i) => i !== existingIndex)
            : acc.map((item, i) =>
                i === existingIndex
                    ? { ...item, quantity: newQuantity }
                    : item
            );
    }, cart.items),
});

const formatCart = (cart: Cart, typeFilter?: string) => {
    const filtered = typeFilter
        ? cart.items.filter((item) => item.type.toLowerCase() === typeFilter.toLowerCase())
        : cart.items;

    if (filtered.length === 0) {
        return typeFilter
            ? `No ${typeFilter} items in the cart.`
            : 'The cart is empty.';
    }

    return filtered
        .map((item) => `- ${item.name}: ${item.quantity} ${item.unit} (${item.type})`)
        .join('\n');
};

const itemSchema = Type.Object({
    name: Type.String({ description: 'Item name' }),
    quantity: Type.Optional(Type.Number({ description: 'Quantity. For add: amount to add (default 1). For remove: amount to remove (omit to remove all).' })),
    unit: Type.Optional(Type.String({ description: 'Unit of measurement for the quantity (e.g., "bags", "lbs", "dozen", "cans", "boxes"). Use the most natural unit for the item. Omit or use "count" for individually countable items like eggs.' })),
    type: Type.Optional(Type.String({ description: 'Category/type of item (e.g., grocery, household, electronics). Required when adding items.' })),
});

const parameters = Type.Object({
    action: Type.Union([
        Type.Literal('view'),
        Type.Literal('add'),
        Type.Literal('remove'),
    ], { description: 'The action to perform on the shopping cart' }),
    items: Type.Optional(Type.Array(itemSchema, { description: 'Items to add or remove. Required for add and remove actions.' })),
    type_filter: Type.Optional(Type.String({ description: 'Filter items by type when viewing the cart (e.g., "grocery", "food", "household")' })),
});

export const shoppingCart: AgentTool<typeof parameters> = {
    name: 'shopping_cart',
    description: 'Manage the user\'s shopping cart. Use to view, add, or remove items. Each item has a name, quantity, unit of measurement, and type/category.',
    label: 'Managing shopping cart',
    parameters,
    execute: async (_toolCallId, params) => {
        const cart = await readCart(cartPath);

        if (params.action === 'view') {
            return {
                content: [{ type: 'text' as const, text: formatCart(cart, params.type_filter) }],
                details: {},
            };
        }

        if (params.action === 'add') {
            if (!params.items?.length) {
                return {
                    content: [{ type: 'text' as const, text: 'No items provided to add.' }],
                    details: {},
                };
            }
            const itemsToAdd: ReadonlyArray<CartItem> = params.items.map((item) => ({
                name: item.name,
                quantity: item.quantity ?? 1,
                unit: item.unit ?? 'count',
                type: item.type ?? 'general',
            }));
            const updatedCart = addItems(cart, itemsToAdd);
            await writeCart(cartPath, updatedCart);
            return {
                content: [{ type: 'text' as const, text: `Added ${itemsToAdd.length} item(s) to cart.\n\nCurrent cart:\n${formatCart(updatedCart)}` }],
                details: {},
            };
        }

        if (params.action === 'remove') {
            if (!params.items?.length) {
                return {
                    content: [{ type: 'text' as const, text: 'No items provided to remove.' }],
                    details: {},
                };
            }
            const updatedCart = removeItems(cart, params.items);
            await writeCart(cartPath, updatedCart);
            return {
                content: [{ type: 'text' as const, text: `Removed item(s) from cart.\n\nCurrent cart:\n${formatCart(updatedCart)}` }],
                details: {},
            };
        }

        return {
            content: [{ type: 'text' as const, text: `Unknown action: ${String(params.action)}` }],
            details: {},
        };
    },
};
