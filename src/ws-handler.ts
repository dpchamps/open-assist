import type { WebSocket } from 'ws';
import type { Context, Model, Api } from '@mariozechner/pi-ai';
import type { google } from '@google-cloud/text-to-speech/build/protos/protos.js';
import { transcribeBuffer } from './stt.js';
import { createTtsStream, buildWavHeader } from './tts.js';
import { streamConversation } from './conversation.js';
import { tools } from './tools/index.js';

type WsMessage =
    | { type: 'status'; status: 'transcribing' | 'thinking' }
    | { type: 'transcript'; text: string }
    | { type: 'text_delta'; delta: string }
    | { type: 'audio_done' }
    | { type: 'error'; message: string };

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

const processAudio = async <TApi extends Api>(
    ws: WebSocket,
    audioBuffer: Buffer,
    model: Model<TApi>,
    context: Context,
    apiKey: string
) => {
    sendJson(ws, { type: 'status', status: 'transcribing' });
    const transcript = await transcribeBuffer(audioBuffer, 'recording.webm');
    sendJson(ws, { type: 'transcript', text: transcript });

    const updatedContext: Context = {
        ...context,
        messages: [
            ...context.messages,
            { role: 'user', content: transcript, timestamp: Date.now() },
        ],
    };

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

    const { context: newContext } = await streamConversation(model, updatedContext, {
        apiKey,
    }, {
        onTextDelta: (delta) => {
            sendJson(ws, { type: 'text_delta', delta });
            hasText = true;
            tts.write(delta);
        },
        onComplete: () => {
            tts.end();
        },
    });

    if (hasText) {
        await audioComplete;
    }

    sendJson(ws, { type: 'audio_done' });

    return newContext;
};

export const handleConnection = <TApi extends Api>(
    ws: WebSocket,
    model: Model<TApi>,
    apiKey: string,
    systemPrompt: string
) => {
    let context: Context = {
        systemPrompt: systemPrompt,
        messages: [],
        tools,
    };

    let processing = false;

    ws.on('message', (data, isBinary) => {
        if (!isBinary) return;

        if (processing) {
            sendJson(ws, { type: 'error', message: 'Already processing a request. Please wait.' });
            return;
        }

        processing = true;

        const audioBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);

        processAudio(ws, audioBuffer, model, context, apiKey)
            .then((newContext) => {
                context = newContext;
            })
            .catch((err) => {
                sendJson(ws, { type: 'error', message: `Processing error: ${err instanceof Error ? err.message : String(err)}` });
            })
            .finally(() => {
                processing = false;
            });
    });
};
