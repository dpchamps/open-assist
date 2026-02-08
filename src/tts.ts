import { writeFile } from 'node:fs/promises';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import type { google } from '@google-cloud/text-to-speech/build/protos/protos.js';

type StreamingTtsOptions = {
  voice?: { languageCode?: string; name?: string };
  audioEncoding?: 'PCM' | 'OGG_OPUS';
  sampleRateHertz?: number;
};

type TtsStream = {
  write: (text: string) => void;
  end: () => void;
  stream: ReturnType<TextToSpeechClient['streamingSynthesize']>;
};

const DEFAULT_VOICE = { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Achernar' };
const DEFAULT_SAMPLE_RATE = 24000;
const DEFAULT_ENCODING = 'PCM' as const;

const KEEPALIVE_INTERVAL_MS = 4000;

export const createTtsStream = (options?: StreamingTtsOptions): TtsStream => {
  const client = new TextToSpeechClient();
  const stream = client.streamingSynthesize();

  const config: google.cloud.texttospeech.v1.IStreamingSynthesizeConfig = {
    voice: {
      languageCode: options?.voice?.languageCode ?? DEFAULT_VOICE.languageCode,
      name: options?.voice?.name ?? DEFAULT_VOICE.name,
    },
    streamingAudioConfig: {
      audioEncoding: options?.audioEncoding ?? DEFAULT_ENCODING,
      sampleRateHertz: options?.sampleRateHertz ?? DEFAULT_SAMPLE_RATE,
    },
  };

  stream.write({ streamingConfig: config });

  let keepaliveTimer: ReturnType<typeof setInterval> | null = setInterval(() => {
    stream.write({ input: { text: ' ' } });
  }, KEEPALIVE_INTERVAL_MS);

  const resetKeepalive = () => {
    if (keepaliveTimer) clearInterval(keepaliveTimer);
    keepaliveTimer = setInterval(() => {
      stream.write({ input: { text: ' ' } });
    }, KEEPALIVE_INTERVAL_MS);
  };

  return {
    write: (text: string) => {
      stream.write({ input: { text } });
      resetKeepalive();
    },
    end: () => {
      if (keepaliveTimer) clearInterval(keepaliveTimer);
      keepaliveTimer = null;
      stream.end();
    },
    stream,
  };
};

export const buildWavHeader = (dataSize: number, sampleRate: number, channels: number, bitsPerSample: number) => {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return header;
};

export const streamTtsToFile = async (
  textSource: AsyncIterable<string>,
  outputPath: string,
  options?: StreamingTtsOptions
) => {
  const tts = createTtsStream(options);
  const chunks: Buffer[] = [];

  const audioComplete = new Promise<void>((resolve, reject) => {
    tts.stream.on('data', (response: google.cloud.texttospeech.v1.IStreamingSynthesizeResponse) => {
      if (response.audioContent) {
        chunks.push(Buffer.from(response.audioContent as Uint8Array));
      }
    });
    tts.stream.on('error', reject);
    tts.stream.on('end', resolve);
  });

  for await (const text of textSource) {
    tts.write(text);
  }
  tts.end();

  await audioComplete;

  const pcmData = Buffer.concat(chunks);
  const sampleRate = options?.sampleRateHertz ?? DEFAULT_SAMPLE_RATE;
  const wavHeader = buildWavHeader(pcmData.length, sampleRate, 1, 16);
  await writeFile(outputPath, Buffer.concat([wavHeader, pcmData]));
};
