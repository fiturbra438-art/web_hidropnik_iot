const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}

async function getPlantGuidance(plant, apiKey) {
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
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      }),
      signal: AbortSignal.timeout(15000)
    }
  );

  if (!upstream.ok) {
    const error = new Error(`Gemini merespons HTTP ${upstream.status}`);
    error.detail = (await upstream.text()).slice(0, 500);
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

exports.plantGuidance = onRequest(
  { region: 'asia-southeast1', secrets: [geminiApiKey], timeoutSeconds: 30 },
  async (request, response) => {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Method harus POST' });
      return;
    }

    const plant = typeof request.body?.plant === 'string' ? request.body.plant.trim() : '';
    if (!plant || plant.length > 80) {
      sendJson(response, 400, { error: 'Nama tanaman wajib diisi dan maksimal 80 karakter' });
      return;
    }

    try {
      const guidance = await getPlantGuidance(plant, geminiApiKey.value());
      sendJson(response, 200, { data: guidance, model: GEMINI_MODEL });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        error: error.message || 'Gagal membuat ketentuan tanaman',
        ...(error.detail ? { detail: error.detail } : {})
      });
    }
  }
);
