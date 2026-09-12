const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const SENSOR_DATA_URL = process.env.SENSOR_DATA_URL
  || 'https://hidroponik-iot-69bf7-default-rtdb.asia-southeast1.firebasedatabase.app/SensorReading.json';
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

function normalizeSensorData(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const hasSensorFields = [
    'phLevel', 'ph', 'pH', 'nutrientLevel', 'nutrisi', 'ec',
    'turbidity', 'kekeruhan', 'temperature', 'suhu', 'waterVolume', 'volume'
  ].some((key) => key in payload);
  const entries = Array.isArray(payload)
    ? payload.filter(Boolean)
    : Object.values(payload).filter((value) => value && typeof value === 'object');
  const data = hasSensorFields ? payload : entries[entries.length - 1];
  if (!data) return null;

  const numberOrNull = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  const sensor = {
    phLevel: numberOrNull(data.phLevel ?? data.ph ?? data.pH),
    nutrientLevel: numberOrNull(data.nutrientLevel ?? data.nutrisi ?? data.ec),
    turbidity: numberOrNull(data.turbidity ?? data.kekeruhan),
    temperature: numberOrNull(data.temperature ?? data.suhu),
    waterVolume: numberOrNull(data.waterVolume ?? data.volume)
  };

  return Object.values(sensor).some((value) => value !== null) ? sensor : null;
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

async function getPlantGuidance(plant) {
  if (!GEMINI_API_KEY) {
    const error = new Error('GEMINI_API_KEY belum dikonfigurasi di server');
    error.statusCode = 503;
    throw error;
  }

  const prompt = `Kamu adalah agronom hidroponik. Berikan ketentuan praktis untuk tanaman ${plant} yang ditanam di sistem hidroponik rumahan.
Kembalikan HANYA JSON valid dengan struktur berikut:
{
  "plant": "${plant}",
  "ph": { "min": number, "max": number, "note": "string" },
  "nutrient": { "min": number, "max": number, "unit": "ppm", "note": "string" },
  "temperature": { "min": number, "max": number, "unit": "C", "note": "string" },
  "advice": ["string", "string", "string"]
}
Gunakan rentang yang masuk akal untuk fase pertumbuhan umum. Jangan memberi dosis bahan kimia spesifik. Semua angka harus berupa number, bukan string. Bahasa Indonesia, ringkas, dan sertakan tepat 3 saran.`;

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      }),
      signal: AbortSignal.timeout(15000)
    }
  );

  if (!upstream.ok) {
    const detail = await upstream.text();
    const error = new Error(`Gemini merespons HTTP ${upstream.status}`);
    error.detail = detail.slice(0, 500);
    error.statusCode = 502;
    throw error;
  }

  const result = await upstream.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const error = new Error('Gemini tidak mengembalikan rekomendasi');
    error.statusCode = 502;
    throw error;
  }

  return JSON.parse(text);
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

  if (url.pathname === '/api/sensor/latest' && request.method === 'GET') {
    try {
      const upstream = await fetch(SENSOR_DATA_URL, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000)
      });

      if (!upstream.ok) {
        sendJson(response, 502, { error: `Sumber sensor merespons HTTP ${upstream.status}` });
        return;
      }

      const sensor = normalizeSensorData(await upstream.json());
      if (!sensor) {
        sendJson(response, 404, { error: 'Data sensor tidak ditemukan' });
        return;
      }

      sendJson(response, 200, { data: sensor, source: SENSOR_DATA_URL });
    } catch (error) {
      sendJson(response, 502, { error: 'Gagal mengambil data dari sumber sensor', detail: error.message });
    }
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

  if (url.pathname === '/api/plant-guidance' && request.method === 'POST') {
    try {
      const data = JSON.parse(await readBody(request) || '{}');
      const plant = typeof data.plant === 'string' ? data.plant.trim() : '';
      if (!plant || plant.length > 80) {
        sendJson(response, 400, { error: 'Nama tanaman wajib diisi dan maksimal 80 karakter' });
        return;
      }

      const guidance = await getPlantGuidance(plant);
      sendJson(response, 200, { data: guidance, model: GEMINI_MODEL });
    } catch (error) {
      sendJson(response, error.statusCode || 400, {
        error: error.message || 'Gagal membuat ketentuan tanaman',
        ...(error.detail ? { detail: error.detail } : {})
      });
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
