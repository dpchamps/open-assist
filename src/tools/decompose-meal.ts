import { Type, type Static } from '@mariozechner/pi-ai';
import type { AgentTool } from '@mariozechner/pi-agent-core';
import { pipeline } from '@xenova/transformers';
import { createClient } from '../postgres.js';

const parameters = Type.Object({
    meal: Type.String({ description: 'Description of the meal to decompose into ingredients (e.g. "chicken parmesan", "beef stew")' }),
});

const SIMILARITY_THRESHOLD = 0.3;
const MAX_RESULTS = 3;

const SEARCH_QUERY = `
    SELECT
        r.title,
        r.ingredients,
        r.directions,
        1 - (re.embedding <=> $1) as similarity_score
    FROM recipes r
    JOIN recipe_embeddings re ON r.id = re.recipe_id
    WHERE 1 - (re.embedding <=> $1) > $2
    ORDER BY similarity_score DESC
    LIMIT $3
`;

type RecipeRow = {
    title: string;
    ingredients: string[];
    directions: string;
    similarity_score: number;
};

const generateEmbedding = async (text: string) => {
    const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const result = await embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(result.data as Float32Array);
};

const formatResults = (meal: string, rows: RecipeRow[]) => {
    if (rows.length === 0) {
        return `No recipes found matching "${meal}".`;
    }

    const header = `Found ${rows.length} recipe${rows.length === 1 ? '' : 's'} matching "${meal}":\n`;

    const entries = rows.map((row, i) => {
        const ingredientList = row.ingredients
            .map((ing) => `   - ${ing}`)
            .join('\n');
        return `${i + 1}. ${row.title} (similarity: ${row.similarity_score.toFixed(2)})\n   Ingredients:\n${ingredientList}\n   Directions:\n   ${row.directions}`;
    });

    return header + '\n' + entries.join('\n\n');
};

const executeDecomposeMeal = async (params: Static<typeof parameters>) => {
    const client = await createClient();
    try {
        const embedding = await generateEmbedding(params.meal);
        const result = await client.query<RecipeRow>(SEARCH_QUERY, [
            JSON.stringify(embedding),
            SIMILARITY_THRESHOLD,
            MAX_RESULTS,
        ]);
        return formatResults(params.meal, result.rows);
    } finally {
        await client.end();
    }
};

export const decomposeMeal: AgentTool<typeof parameters> = {
    name: 'decompose_meal',
    description: 'Search a database of over 1 million recipes for a meal. Returns the top matching recipes with full ingredient lists including quantities and cooking directions.',
    label: 'Searching recipes',
    parameters,
    execute: async (_toolCallId, params) => ({
        content: [{
            type: 'text',
            text: await executeDecomposeMeal(params),
        }],
        details: {},
    }),
};
