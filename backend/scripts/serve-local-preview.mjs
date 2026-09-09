import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { pipeline } from 'node:stream';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(scriptDirectory, '..', 'public');
const previewPort = Number(process.env.POS_PREVIEW_PORT ?? 4173);
const apiTarget = new URL(process.env.POS_API_TARGET ?? 'https://mj.pantaibsb.com');

const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

function proxyApi(request, response) {
    const targetUrl = new URL(request.url, apiTarget);
    const transport = targetUrl.protocol === 'https:' ? https : http;
    const headers = { ...request.headers, host: targetUrl.host };

    delete headers.origin;
    delete headers.referer;

    const proxyRequest = transport.request(targetUrl, {
        method: request.method,
        headers,
    }, (proxyResponse) => {
        console.log(`${request.method} ${request.url} -> ${proxyResponse.statusCode}`);
        response.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers);
        pipeline(proxyResponse, response, () => {});
    });

    proxyRequest.on('error', (error) => {
        console.error(`${request.method} ${request.url} -> ${error.message}`);
        if (! response.headersSent) {
            response.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
        }

        response.end(JSON.stringify({ message: `API proxy gagal: ${error.message}` }));
    });

    pipeline(request, proxyRequest, () => {});
}

function serveFrontend(request, response) {
    const requestUrl = new URL(request.url, `http://${request.headers.host ?? '127.0.0.1'}`);
    let relativePath;

    try {
        relativePath = decodeURIComponent(requestUrl.pathname);
    } catch {
        response.writeHead(400);
        response.end('Bad Request');
        return;
    }

    let filePath = path.resolve(publicDirectory, `.${relativePath === '/' ? '/index.html' : relativePath}`);

    if (! filePath.startsWith(`${publicDirectory}${path.sep}`)) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
    }

    if (! existsSync(filePath) || ! statSync(filePath).isFile()) {
        filePath = path.join(publicDirectory, 'index.html');
    }

    response.writeHead(200, {
        'cache-control': 'no-cache',
        'content-type': mimeTypes[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    });
    pipeline(createReadStream(filePath), response, () => {});
}

const server = createServer((request, response) => {
    if (request.url === '/api' || request.url?.startsWith('/api/')) {
        proxyApi(request, response);
        return;
    }

    serveFrontend(request, response);
});

server.listen(previewPort, '127.0.0.1', () => {
    console.log(`POS preview: http://127.0.0.1:${previewPort}`);
    console.log(`API proxy: ${apiTarget.origin}`);
});
