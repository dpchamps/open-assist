    import type { Tool, ToolCall } from '@mariozechner/pi-ai';
import * as getTimeTool from './get-time.js';
import * as listCurrentUserDetailsTool from './list-current-user-details.js';
import * as searchNearbyTool from './tomtom/search-nearby.js';
import * as timeToDestinationTool from './tomtom/time-to-destination.js';
import * as weatherTool from './weather.js';

export const tools: Tool[] = [
    getTimeTool.definition,
    listCurrentUserDetailsTool.definition,
    searchNearbyTool.definition,
    timeToDestinationTool.definition,
    weatherTool.definition,
];

export const executeTool = async (toolCall: ToolCall): Promise<{ text: string; isError: boolean }> => {
    switch (toolCall.name) {
        case getTimeTool.definition.name:
            return { text: await getTimeTool.execute(toolCall.arguments), isError: false };
        case listCurrentUserDetailsTool.definition.name:
            return { text: await listCurrentUserDetailsTool.execute(toolCall.arguments), isError: false };
        case searchNearbyTool.definition.name:
            return { text: await searchNearbyTool.execute(toolCall.arguments as { query: string; near?: string }), isError: false };
        case timeToDestinationTool.definition.name:
            return { text: await timeToDestinationTool.execute(toolCall.arguments as { origin: string; destination: string }), isError: false };
        case weatherTool.definition.name:
            return { text: await weatherTool.execute(toolCall.arguments as { location: string; timeframe: 'now' | 'day' | 'week' }), isError: false };
        default:
            return { text: `Unknown tool: ${toolCall.name}`, isError: true };
    }
};
