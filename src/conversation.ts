import {
    stream,
    type Api,
    type AssistantMessageEventStream,
    type Context,
    type Model,
    type ProviderStreamOptions,
} from '@mariozechner/pi-ai';
import { executeTool } from './tools/index.js';

export type ConversationCallbacks = {
    onTextDelta?: (delta: string) => void;
    onComplete?: () => void;
};

const processStreamEvents = async (
    s: AssistantMessageEventStream,
    callbacks?: ConversationCallbacks
) => {
    for await (const event of s) {
        switch (event.type) {
            case 'start':
                console.log(`Starting with ${event.partial.model}`);
                break;
            case 'text_start':
                console.log('\n[Text started]');
                break;
            case 'text_delta':
                process.stdout.write(event.delta);
                callbacks?.onTextDelta?.(event.delta);
                break;
            case 'text_end':
                console.log('\n[Text ended]');
                break;
            case 'thinking_start':
                console.log('[Model is thinking...]');
                break;
            case 'thinking_delta':
                process.stdout.write(event.delta);
                break;
            case 'thinking_end':
                console.log('[Thinking complete]');
                break;
            case 'toolcall_start':
                console.log(`\n[Tool call started: index ${event.contentIndex}]`);
                break;
            case 'toolcall_delta': {
                const partialCall = event.partial.content[event.contentIndex];
                if (partialCall?.type === 'toolCall') {
                    console.log(`[Streaming args for ${partialCall.name}]`);
                }
                break;
            }
            case 'toolcall_end':
                console.log(`\nTool called: ${event.toolCall.name}`);
                console.log(`Arguments: ${JSON.stringify(event.toolCall.arguments)}`);
                break;
            case 'done':
                console.log(`\nFinished: ${event.reason}`);
                break;
            case 'error':
                console.error(`Error: ${event.error}`);
                break;
        }
    }

    return s.result();
};

export const streamConversation = async <TApi extends Api>(
    model: Model<TApi>,
    context: Context,
    options: ProviderStreamOptions,
    callbacks?: ConversationCallbacks
) => {
    let currentContext = context;
    let s = stream(model, currentContext, options);
    let message = await processStreamEvents(s, callbacks);

    let toolCalls = message.content.filter(b => b.type === 'toolCall');

    while (toolCalls.length > 0) {
        const toolResults = await Promise.all(
            toolCalls.map(async (call) => {
                const result = await executeTool(call);
                return {
                    role: 'toolResult' as const,
                    toolCallId: call.id,
                    toolName: call.name,
                    content: [{ type: 'text' as const, text: result.text }],
                    isError: result.isError,
                    timestamp: Date.now()
                };
            })
        );

        currentContext = {
            ...currentContext,
            messages: [...currentContext.messages, message, ...toolResults]
        };

        s = stream(model, currentContext, options);
        message = await processStreamEvents(s, callbacks);
        toolCalls = message.content.filter(b => b.type === 'toolCall');
    }

    callbacks?.onComplete?.();
    return {
        finalMessage: message,
        context: {
            ...currentContext,
            messages: [...currentContext.messages, message]
        } satisfies Context
    };
};
