import { writeFile } from 'node:fs/promises';
import { getModel, type AssistantMessage, type Message } from '@mariozechner/pi-ai';
import { agentLoop, type AgentContext, type AgentLoopConfig, type AgentMessage } from '@mariozechner/pi-agent-core';
import type { google } from '@google-cloud/text-to-speech/build/protos/protos.js';
import 'dotenv/config';
import { tools } from './tools/index.js';
import { transformContext } from './context.js';
import { transcribeFile } from './stt.js';
import { createTtsStream, buildWavHeader } from './tts.js';

const audioFilePath = process.argv[2];

const userMessage = audioFilePath
    ? await transcribeFile(audioFilePath)
    : 'What time is it?';

console.log(`User: ${userMessage}`);

const model = getModel('openrouter', 'deepseek/deepseek-v3.2');

const convertToLlm = (messages: AgentMessage[]): Message[] => messages as Message[];

const context: AgentContext = {
    systemPrompt: 'You are a helpful assistant.',
    messages: [],
    tools,
};

const config: AgentLoopConfig = {
    model,
    convertToLlm,
    apiKey: process.env["OPENROUTER_KEY"] || "",
    transformContext,
};

const prompt: Message = { role: 'user', content: userMessage, timestamp: Date.now() };

const tts = createTtsStream();
const chunks: Buffer[] = [];
let hasText = false;

const audioComplete = new Promise<void>((resolve, reject) => {
    tts.stream.on('data', (response: google.cloud.texttospeech.v1.IStreamingSynthesizeResponse) => {
        if (response.audioContent) {
            chunks.push(Buffer.from(response.audioContent as Uint8Array));
        }
    });
    tts.stream.on('error', reject);
    tts.stream.on('end', resolve);
});

const eventStream = agentLoop([prompt], context, config);

let finalMessages: AgentMessage[] = [];
for await (const event of eventStream) {
    switch (event.type) {
        case 'message_update':
            if (event.assistantMessageEvent.type === 'text_delta') {
                hasText = true;
                process.stdout.write(event.assistantMessageEvent.delta);
                tts.write(event.assistantMessageEvent.delta);
            }
            break;
        case 'agent_end':
            finalMessages = event.messages;
            break;
    }
}
tts.end();

if (hasText) {
    await audioComplete;

    const pcmData = Buffer.concat(chunks);
    const wavHeader = buildWavHeader(pcmData.length, 24000, 1, 16);
    await writeFile('./response.wav', Buffer.concat([wavHeader, pcmData]));
    console.log(`\nAudio saved to ./response.wav`);
}

const lastAssistant = [...finalMessages].reverse().find((m): m is AssistantMessage => (m as Message).role === 'assistant');
if (lastAssistant) {
    console.log(`\nTotal tokens: ${lastAssistant.usage.input} in, ${lastAssistant.usage.output} out`);
    console.log(`Cost: $${lastAssistant.usage.cost.total.toFixed(4)}`);
}
