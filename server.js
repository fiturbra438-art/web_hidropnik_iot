const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error('Payload terlalu besar'));
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function serveStatic(request, response, pathname) {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(PUBLIC_DIR, `.${requestedPath}`);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500);
      response.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    response.end(content);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (url.pathname === '/api/health' && request.method === 'GET') {
    sendJson(response, 200, {
      status: 'ok',
      service: 'web-hidroponik-api',
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (url.pathname === '/api/contact' && request.method === 'POST') {
    try {
      const data = JSON.parse(await readBody(request) || '{}');
      if (!data.name || !data.email || !data.message) {
        sendJson(response, 400, { error: 'name, email, dan message wajib diisi' });
        return;
      }

      // Ganti blok ini dengan penyimpanan database atau service yang kamu pilih.
      sendJson(response, 201, {
        message: 'Pesan berhasil diterima',
        data: { name: data.name, email: data.email, message: data.message }
      });
    } catch {
      sendJson(response, 400, { error: 'Body request harus berupa JSON yang valid' });
    }
    return;
  }

  if (request.method === 'GET') {
    serveStatic(request, response, url.pathname);
    return;
  }

  sendJson(response, 404, { error: 'Route tidak ditemukan' });
});

server.listen(PORT, () => {
  console.log(`Web berjalan di http://localhost:${PORT}`);
});
