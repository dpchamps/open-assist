import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { getModel } from '@mariozechner/pi-ai';
import 'dotenv/config';
import { handleConnection } from './ws-handler.js';
import { exchangeCodeForTokens, writeTokens } from './tools/kroger/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');

// const apiKey = process.env['ANTHROPIC_KEY'] ?? '';
const apiKey = process.env['OPENROUTER_KEY'] ?? '';
if (!apiKey) {
    console.warn('Warning: OPENROUTER_KEY not set in environment');
}

// const model = getModel('anthropic', 'claude-opus-4-5');
const model = getModel('openrouter', "qwen/qwen3-235b-a22b-2507");
const port = Number(process.env['PORT']) || 3000;

const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.wasm': 'application/wasm',
    '.onnx': 'application/octet-stream',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
};

const SHARED_HEADERS = {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
};

const server = createServer(async (req, res) => {
    if (req.method !== 'GET') {
        res.writeHead(404, SHARED_HEADERS);
        res.end('Not found');
        return;
    }

    const parsedUrl = new URL(req.url ?? '/', `http://${req.headers.host}`);

    if (parsedUrl.pathname === '/kroger/callback') {
        const code = parsedUrl.searchParams.get('code');
        if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8', ...SHARED_HEADERS });
            res.end('<html><body><h1>Error</h1><p>No authorization code received.</p></body></html>');
            return;
        }
        await exchangeCodeForTokens(code)
            .then((tokens) => writeTokens(tokens))
            .then(() => {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...SHARED_HEADERS });
                res.end('<html><body><h1>Kroger Authorization Successful</h1><p>You can close this tab and return to the assistant.</p></body></html>');
            })
            .catch((err) => {
                console.error('Kroger OAuth callback error:', err);
                res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8', ...SHARED_HEADERS });
                res.end(`<html><body><h1>Authorization Failed</h1><p>${err instanceof Error ? err.message : String(err)}</p></body></html>`);
            });
        return;
    }

    const urlPath = req.url === '/' ? '/index.html' : req.url ?? '/';
    const filePath = resolve(publicDir, normalize(urlPath).replace(/^\/+/, ''));

    if (!filePath.startsWith(publicDir)) {
        res.writeHead(403, SHARED_HEADERS);
        res.end('Forbidden');
        return;
    }

    const fileData = await readFile(filePath).catch(() => null);

    if (!fileData) {
        res.writeHead(404, SHARED_HEADERS);
        res.end('Not found');
        return;
    }

    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType, ...SHARED_HEADERS });
    res.end(fileData);
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', async (ws) => {
    console.log('WebSocket client connected');
    const systemPrompt = await readFile(resolve(publicDir, "assistant-prompt.md"), 'utf8');
    handleConnection(ws, model, apiKey, systemPrompt);

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
    });
});

server.listen(port, "0.0.0.0", () => {
    console.log(`Server listening on http://localhost:${port}`);
});
