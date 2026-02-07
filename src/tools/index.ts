import type { Tool, ToolCall } from '@mariozechner/pi-ai';
import * as getTimeTool from './get-time.js';
import * as listCurrentUserDetailsTool from './list-current-user-details.js';

export const tools: Tool[] = [
    getTimeTool.definition,
    listCurrentUserDetailsTool.definition,
];

export const executeTool = async (toolCall: ToolCall): Promise<{ text: string; isError: boolean }> => {
    switch (toolCall.name) {
        case getTimeTool.definition.name:
            return { text: await getTimeTool.execute(toolCall.arguments), isError: false };
        case listCurrentUserDetailsTool.definition.name:
            return { text: await listCurrentUserDetailsTool.execute(toolCall.arguments), isError: false };
        default:
            return { text: `Unknown tool: ${toolCall.name}`, isError: true };
    }
};
