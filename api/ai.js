// Backend de reescribo: hace de intermediario entre la web y Gemini.
// La clave GEMINI_API_KEY vive en las variables de entorno de Vercel, nunca en el HTML.

const MAX_PROMPT = 200000; // caracteres
const MAX_AUDIO = 4000000; // base64 (~3 MB de audio por pedido)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'Falta configurar GEMINI_API_KEY en Vercel (Settings → Environment Variables).' });
  }

  const { prompt, json = false, audio = null, mime = 'audio/wav' } = req.body || {};
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Falta el pedido.' });
  }
  if (prompt.length > MAX_PROMPT) {
    return res.status(413).json({ error: 'El material es demasiado largo. Probá con una parte.' });
  }
  if (audio && (typeof audio !== 'string' || audio.length > MAX_AUDIO)) {
    return res.status(413).json({ error: 'El fragmento de audio es demasiado grande.' });
  }

  const parts = [{ text: prompt }];
  if (audio) parts.unshift({ inline_data: { mime_type: mime, data: audio } });

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: audio ? 0.1 : 0.7,
      ...(json ? { responseMimeType: 'application/json' } : {})
    }
  };

  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body)
    });
    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      if (r.status === 429) {
        return res.status(429).json({ error: 'Llegamos al límite gratis de la IA por ahora. Esperá un minuto y probá de nuevo.' });
      }
      const msg = (data && data.error && data.error.message) || `Error ${r.status} de la IA.`;
      return res.status(502).json({ error: msg });
    }

    const cand = data.candidates && data.candidates[0];
    if (!cand) {
      return res.status(502).json({ error: 'La IA no devolvió respuesta (puede haber sido bloqueada por un filtro). Probá de nuevo.' });
    }
    const text = ((cand.content && cand.content.parts) || []).map(p => p.text || '').join('');
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(502).json({ error: 'No se pudo conectar con la IA. Probá de nuevo en un rato.' });
  }
}
