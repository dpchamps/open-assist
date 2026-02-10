import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

const WHISPER_URL = process.env['WHISPER_URL'] ?? "";

const transcribe = async (audioBlob: Blob, filename: string) => {
    const formData = new FormData();
    formData.append('file', audioBlob, filename);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'json');

    const response = await fetch(WHISPER_URL, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Whisper API error: ${response.status} ${await response.text()}`);
    }

    const json = await response.json() as { text?: string };

    if (typeof json.text !== 'string') {
        throw new Error(`Unexpected Whisper response shape: ${JSON.stringify(json)}`);
    }

    return json.text;
};

export const transcribeFile = async (filePath: string) => {
    const fileBuffer = await readFile(filePath);
    return transcribe(new Blob([fileBuffer]), basename(filePath));
};

export const transcribeBuffer = async (buffer: Buffer, filename: string) =>
    transcribe(new Blob([buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer]), filename);
