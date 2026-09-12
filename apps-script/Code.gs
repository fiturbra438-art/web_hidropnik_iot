const GEMINI_MODEL = 'gemini-2.5-flash';

function doPost(event) {
  try {
    const body = JSON.parse(event.postData.contents || '{}');
    const plant = typeof body.plant === 'string' ? body.plant.trim() : '';
    if (!plant || plant.length > 80) {
      return jsonResponse({ error: 'Nama tanaman wajib diisi dan maksimal 80 karakter' });
    }

    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      return jsonResponse({ error: 'GEMINI_API_KEY belum disimpan di Script Properties' });
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

    const response = UrlFetchApp.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'post',
        contentType: 'application/json',
        muteHttpExceptions: true,
        payload: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
        })
      }
    );

    const status = response.getResponseCode();
    const result = JSON.parse(response.getContentText());
    if (status < 200 || status >= 300) {
      const detail = result.error?.message || 'Model Gemini tidak tersedia atau API key tidak memiliki akses.';
      return jsonResponse({ error: `Gemini merespons HTTP ${status}: ${detail}` });
    }

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return jsonResponse({ error: 'Gemini tidak mengembalikan rekomendasi' });
    return jsonResponse({ data: JSON.parse(text), model: GEMINI_MODEL });
  } catch (error) {
    return jsonResponse({ error: error.message || 'Gagal membuat ketentuan tanaman' });
  }
}

function doGet() {
  return jsonResponse({ status: 'ok', service: 'gemini-plant-guidance' });
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
