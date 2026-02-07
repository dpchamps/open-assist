import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { getModel } from '@mariozechner/pi-ai';
import 'dotenv/config';
import { handleConnection } from './ws-handler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');

const apiKey = process.env['OPENROUTER_KEY'] ?? '';
if (!apiKey) {
    console.warn('Warning: OPENROUTER_KEY not set in environment');
}

const model = getModel('openrouter', 'deepseek/deepseek-v3.2');
const port = Number(process.env['PORT']) || 3000;

const server = createServer(async (req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
        const html = await readFile(resolve(publicDir, 'index.html'), 'utf-8')
            .catch(() => null);

        if (!html) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', async (ws) => {
    console.log('WebSocket client connected');
    const systemPrompt = await readFile(resolve(publicDir, "assistant-prompt.md"), 'utf8')
    handleConnection(ws, model, apiKey, systemPrompt);

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
    });
});

server.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});
