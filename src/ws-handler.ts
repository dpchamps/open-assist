import type { WebSocket } from 'ws';
import type { Api, Model, Message } from '@mariozechner/pi-ai';
import { agentLoop, type AgentContext, type AgentLoopConfig, type AgentMessage } from '@mariozechner/pi-agent-core';
import type { google } from '@google-cloud/text-to-speech/build/protos/protos.js';
import { transcribeBuffer } from './stt.js';
import { createTtsStream, buildWavHeader } from './tts.js';
import { tools } from './tools/index.js';
import { transformContext } from './context.js';

type DevEvent = { event: string; detail?: string | undefined; timestamp: number };

type WsMessage =
    | { type: 'status'; status: 'transcribing' | 'thinking' }
    | { type: 'transcript'; text: string }
    | { type: 'text_delta'; delta: string }
    | { type: 'audio_done' }
    | { type: 'error'; message: string }
    | { type: 'dev_event' } & DevEvent;

const sendJson = (ws: WebSocket, msg: WsMessage) => {
    if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(msg));
    }
};

const sendBinary = (ws: WebSocket, chunk: Uint8Array) => {
    if (ws.readyState === ws.OPEN) {
        ws.send(chunk);
    }
};

const sendDevEvent = (ws: WebSocket, event: string, detail?: string) =>
    sendJson(ws, { type: 'dev_event', event, detail, timestamp: Date.now() });

const convertToLlm = (messages: AgentMessage[]): Message[] => messages as Message[];

const processAudio = async <TApi extends Api>(
    ws: WebSocket,
    audioBuffer: Buffer,
    model: Model<TApi>,
    context: AgentContext,
    apiKey: string,
    signal: AbortSignal
) => {
    sendJson(ws, { type: 'status', status: 'transcribing' });
    const transcript = await transcribeBuffer(audioBuffer, 'recording.webm');
    sendJson(ws, { type: 'transcript', text: transcript });

    sendJson(ws, { type: 'status', status: 'thinking' });

    const tts = createTtsStream();
    let hasText = false;
    let headerSent = false;

    const audioComplete = new Promise<void>((resolve, reject) => {
        tts.stream.on('data', (response: google.cloud.texttospeech.v1.IStreamingSynthesizeResponse) => {
            if (response.audioContent) {
                if (!headerSent) {
                    sendBinary(ws, buildWavHeader(0xFFFFFFFF - 36, 24000, 1, 16));
                    headerSent = true;
                }
                sendBinary(ws, Buffer.from(response.audioContent as Uint8Array));
            }
        });
        tts.stream.on('error', reject);
        tts.stream.on('end', resolve);
    });

    const config: AgentLoopConfig = { model, convertToLlm, apiKey, transformContext };
    const prompt: Message = { role: 'user', content: transcript, timestamp: Date.now() };
    const eventStream = agentLoop([prompt], context, config, signal);

    let allNewMessages: AgentMessage[] = [];
    for await (const event of eventStream) {
        switch (event.type) {
            case 'turn_start':
                console.log(`\n--- Turn Start ---`);
                sendDevEvent(ws, 'turn_start');
                break;
            case 'turn_end':
                console.log(`--- Turn End ---`);
                sendDevEvent(ws, 'turn_end');
                break;
            case 'message_update':
                switch (event.assistantMessageEvent.type) {
                    case 'text_delta':
                        sendJson(ws, { type: 'text_delta', delta: event.assistantMessageEvent.delta });
                        hasText = true;
                        tts.write(event.assistantMessageEvent.delta);
                        process.stdout.write(event.assistantMessageEvent.delta);
                        sendDevEvent(ws, 'text_delta', event.assistantMessageEvent.delta);
                        break;
                    case 'thinking_delta':
                        process.stdout.write(`[thinking] ${event.assistantMessageEvent.delta}`);
                        sendDevEvent(ws, 'thinking_delta', event.assistantMessageEvent.delta);
                        break;
                    case 'toolcall_end': {
                        const { name, arguments: args } = event.assistantMessageEvent.toolCall;
                        console.log(`\n[tool_call] ${name}(${JSON.stringify(args)})`);
                        sendDevEvent(ws, 'tool_call', `${name}(${JSON.stringify(args)})`);
                        break;
                    }
                }
                break;
            case 'tool_execution_start':
                console.log(`[tool_exec] ${event.toolName} started`);
                sendDevEvent(ws, 'tool_exec_start', event.toolName);
                break;
            case 'tool_execution_end': {
                const resultPreview = JSON.stringify(event.result).slice(0, 500);
                console.log(`[tool_exec] ${event.toolName} ${event.isError ? 'FAILED' : 'done'}: ${resultPreview}`);
                sendDevEvent(ws, event.isError ? 'tool_exec_error' : 'tool_exec_end', `${event.toolName}: ${resultPreview}`);
                break;
            }
            case 'message_end':
                process.stdout.write('\n');
                sendDevEvent(ws, 'message_end');
                break;
            case 'agent_end':
                allNewMessages = event.messages;
                sendDevEvent(ws, 'agent_end');
                break;
        }
    }
    tts.end();

    if (hasText) {
        await audioComplete;
    }

    sendJson(ws, { type: 'audio_done' });

    return { ...context, messages: [...context.messages, ...allNewMessages] } satisfies AgentContext;
};

export const handleConnection = <TApi extends Api>(
    ws: WebSocket,
    model: Model<TApi>,
    apiKey: string,
    systemPrompt: string
) => {
    let context: AgentContext = {
        systemPrompt,
        messages: [],
        tools,
    };

    let processing = false;
    let abortController: AbortController | null = null;

    ws.on('message', (data, isBinary) => {
        if (!isBinary) return;

        if (processing) {
            sendJson(ws, { type: 'error', message: 'Already processing a request. Please wait.' });
            return;
        }

        processing = true;
        abortController = new AbortController();

        const audioBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);

        processAudio(ws, audioBuffer, model, context, apiKey, abortController.signal)
            .then((newContext) => {
                context = newContext;
            })
            .catch((err) => {
                sendJson(ws, { type: 'error', message: `Processing error: ${err instanceof Error ? err.message : String(err)}` });
            })
            .finally(() => {
                processing = false;
                abortController = null;
            });
    });

    ws.on('close', () => {
        abortController?.abort();
    });
};
