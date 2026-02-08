import { Type } from '@mariozechner/pi-ai';
import type { AgentTool } from '@mariozechner/pi-agent-core';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const inventoryPath = resolve(__dirname, '..', '..', 'public', 'home-inventory.json');

type InventoryItem = {
    name: string;
    quantity: number;
    unit: string;
    category: string;
};

type Inventory = {
    items: ReadonlyArray<InventoryItem>;
};

const normalizeItem = (item: Omit<InventoryItem, 'unit'> & { unit?: string }): InventoryItem => ({
    ...item,
    unit: item.unit ?? 'count',
});

const readInventory = (path: string): Promise<Inventory> =>
    readFile(path, 'utf-8')
        .then((content) => JSON.parse(content) as Inventory)
        .then((inventory) => ({ items: inventory.items.map(normalizeItem) }))
        .catch(() => ({ items: [] }));

const writeInventory = (path: string, inventory: Inventory): Promise<void> =>
    writeFile(path, JSON.stringify(inventory, null, 2), 'utf-8');

const addItems = (inventory: Inventory, newItems: ReadonlyArray<InventoryItem>): Inventory => ({
    items: newItems.reduce<ReadonlyArray<InventoryItem>>((acc, newItem) => {
        const existingIndex = acc.findIndex(
            (item) => item.name.toLowerCase() === newItem.name.toLowerCase()
                && item.category.toLowerCase() === newItem.category.toLowerCase()
        );
        return existingIndex >= 0
            ? acc.map((item, i) =>
                i === existingIndex
                    ? { ...item, quantity: item.quantity + newItem.quantity, unit: newItem.unit }
                    : item
            )
            : [...acc, newItem];
    }, inventory.items),
});

const removeItems = (inventory: Inventory, itemsToRemove: ReadonlyArray<{ name: string; quantity?: number }>): Inventory => ({
    items: itemsToRemove.reduce<ReadonlyArray<InventoryItem>>((acc, removeItem) => {
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
    }, inventory.items),
});

const formatInventory = (inventory: Inventory, categoryFilter?: string) => {
    const filtered = categoryFilter
        ? inventory.items.filter((item) => item.category.toLowerCase() === categoryFilter.toLowerCase())
        : inventory.items;

    if (filtered.length === 0) {
        return categoryFilter
            ? `No ${categoryFilter} items in the home inventory.`
            : 'The home inventory is empty.';
    }

    return filtered
        .map((item) => `- ${item.name}: ${item.quantity} ${item.unit} (${item.category})`)
        .join('\n');
};

const itemSchema = Type.Object({
    name: Type.String({ description: 'Item name' }),
    quantity: Type.Optional(Type.Number({ description: 'Quantity. For add: amount to add (default 1). For remove: amount to remove (omit to remove all).' })),
    unit: Type.Optional(Type.String({ description: 'Unit of measurement for the quantity (e.g., "bags", "lbs", "bottles", "boxes"). Use the most natural unit for the item. Omit or use "count" for individually countable items.' })),
    category: Type.Optional(Type.String({ description: 'Category of item (e.g., pantry, cleaning, toiletries, kitchen, electronics). Required when adding items.' })),
});

const parameters = Type.Object({
    action: Type.Union([
        Type.Literal('view'),
        Type.Literal('add'),
        Type.Literal('remove'),
    ], { description: 'The action to perform on the home inventory' }),
    items: Type.Optional(Type.Array(itemSchema, { description: 'Items to add or remove. Required for add and remove actions.' })),
    category_filter: Type.Optional(Type.String({ description: 'Filter items by category when viewing the inventory (e.g., "pantry", "cleaning", "toiletries")' })),
});

export const homeInventory: AgentTool<typeof parameters> = {
    name: 'home_inventory',
    description: 'Manage the user\'s home inventory of items they already have on hand. Use to view, add, or remove items. Each item has a name, quantity, unit of measurement, and category.',
    label: 'Managing home inventory',
    parameters,
    execute: async (_toolCallId, params) => {
        const inventory = await readInventory(inventoryPath);

        if (params.action === 'view') {
            return {
                content: [{ type: 'text' as const, text: formatInventory(inventory, params.category_filter) }],
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
            const itemsToAdd: ReadonlyArray<InventoryItem> = params.items.map((item) => ({
                name: item.name,
                quantity: item.quantity ?? 1,
                unit: item.unit ?? 'count',
                category: item.category ?? 'general',
            }));
            const updatedInventory = addItems(inventory, itemsToAdd);
            await writeInventory(inventoryPath, updatedInventory);
            return {
                content: [{ type: 'text' as const, text: `Added ${itemsToAdd.length} item(s) to home inventory.\n\nCurrent inventory:\n${formatInventory(updatedInventory)}` }],
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
            const updatedInventory = removeItems(inventory, params.items);
            await writeInventory(inventoryPath, updatedInventory);
            return {
                content: [{ type: 'text' as const, text: `Removed item(s) from home inventory.\n\nCurrent inventory:\n${formatInventory(updatedInventory)}` }],
                details: {},
            };
        }

        return {
            content: [{ type: 'text' as const, text: `Unknown action: ${String(params.action)}` }],
            details: {},
        };
    },
};
