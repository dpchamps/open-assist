import { writeFile } from 'node:fs/promises';
import { getModel, type Context } from '@mariozechner/pi-ai';
import type { google } from '@google-cloud/text-to-speech/build/protos/protos.js';
import 'dotenv/config';
import { tools } from './tools/index.js';
import { streamConversation } from './conversation.js';
import { transcribeFile } from './stt.js';
import { createTtsStream, buildWavHeader } from './tts.js';

const audioFilePath = process.argv[2];

const userMessage = audioFilePath
    ? await transcribeFile(audioFilePath)
    : 'What time is it?';

console.log(`User: ${userMessage}`);

const model = getModel('openrouter', 'deepseek/deepseek-v3.2');

const context: Context = {
    systemPrompt: 'You are a helpful assistant.',
    messages: [{ role: 'user', content: userMessage, timestamp: Date.now() }],
    tools,
};

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

const { finalMessage } = await streamConversation(model, context, {
    apiKey: process.env["OPENROUTER_KEY"] || ""
}, {
    onTextDelta: (delta) => {
        hasText = true;
        tts.write(delta);
    },
    onComplete: () => {
        tts.end();
    },
});

if (hasText) {
    await audioComplete;

    const pcmData = Buffer.concat(chunks);
    const wavHeader = buildWavHeader(pcmData.length, 24000, 1, 16);
    await writeFile('./response.wav', Buffer.concat([wavHeader, pcmData]));
    console.log(`Audio saved to ./response.wav`);
}

console.log(`\nTotal tokens: ${finalMessage.usage.input} in, ${finalMessage.usage.output} out`);
console.log(`Cost: $${finalMessage.usage.cost.total.toFixed(4)}`);
