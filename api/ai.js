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

  const { prompt, json = false, audio = null, mime = 'audio/wav', tts = null } = req.body || {};
  if (tts) return speak(tts, key, res);
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

  const models = [
    process.env.GEMINI_MODEL,
    'gemini-flash-latest',
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-2.5-flash',
    'gemini-flash-lite-latest',
    'gemini-2.5-flash-lite'
  ].filter((m, i, a) => m && a.indexOf(m) === i);

  let last = 'No se pudo conectar con la IA. Probá de nuevo en un rato.';
  for (const model of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body)
      });
      const data = await r.json().catch(() => ({}));

      if (r.status === 429) {
        last = 'Llegamos al límite gratis de la IA por ahora. Esperá un minuto y probá de nuevo.';
        continue; // cada modelo tiene su propio límite: probamos el siguiente
      }
      if (r.status === 400 && /api key/i.test(JSON.stringify(data))) {
        return res.status(500).json({ error: 'La clave GEMINI_API_KEY no es válida. Revisala en Vercel y volvé a desplegar.' });
      }
      if (r.status === 403) {
        return res.status(500).json({ error: 'Google rechazó la clave (403). Revisá que GEMINI_API_KEY sea de AI Studio y esté bien copiada.' });
      }
      if (!r.ok) {
        last = (data && data.error && data.error.message) || `Error ${r.status} de la IA.`;
        if (r.status === 404 || r.status === 400) continue; // modelo no disponible: probamos el siguiente
        return res.status(502).json({ error: last });
      }

      const cand = data.candidates && data.candidates[0];
      const text = ((cand && cand.content && cand.content.parts) || []).map(p => p.text || '').join('');
      if (!cand || (!text && !audio)) {
        last = 'La IA no devolvió respuesta (puede haber sido bloqueada por un filtro). Probá de nuevo.';
        continue;
      }
      return res.status(200).json({ text, model });
    } catch (e) {
      last = 'No se pudo conectar con la IA. Probá de nuevo en un rato.';
    }
  }
  return res.status(/límite/.test(last) ? 429 : 502).json({ error: last });
}

// ---------- Texto a voz: crea audio real (WAV) con las voces de Gemini ----------
// Recibe { lines: [{ speaker, text }] } con hasta ~600 caracteres por pedido
// y devuelve { audio: base64 PCM 16 bits, rate }.
const VOICES = { 'Sofi': 'Kore', 'Martín': 'Puck', 'Narradora': 'Kore' };
const TTS_MODELS = [
  process.env.GEMINI_TTS_MODEL,
  'gemini-3.8-flash-lite-tts',
  'gemini-3.8-flash-tts',
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts'
].filter(Boolean);

async function speak(tts, key, res) {
  const lines = Array.isArray(tts.lines) ? tts.lines.filter(l => l && typeof l.text === 'string' && l.text.trim()) : [];
  const total = lines.reduce((n, l) => n + l.text.length, 0);
  if (!lines.length) return res.status(400).json({ error: 'No hay texto para convertir en audio.' });
  if (total > 1500) return res.status(413).json({ error: 'Fragmento demasiado largo para el audio.' });

  const speakers = [...new Set(lines.map(l => String(l.speaker || 'Narradora')))].slice(0, 2);
  const voiceOf = (s, i) => VOICES[s] || ['Kore', 'Puck'][i] || 'Kore';
  let text, speechConfig;
  if (speakers.length > 1) {
    text = 'Leé este diálogo de un podcast educativo uruguayo, con acento rioplatense, tono cálido, natural y con buen ritmo:\n\n' +
      lines.map(l => `${l.speaker}: ${l.text}`).join('\n');
    speechConfig = { multiSpeakerVoiceConfig: { speakerVoiceConfigs: speakers.map((s, i) => ({ speaker: s, voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceOf(s, i) } } })) } };
  } else {
    text = 'Leé el siguiente texto en español con acento rioplatense, tono cálido y claro, como quien explica algo a una compañera:\n\n' +
      lines.map(l => l.text).join('\n');
    speechConfig = { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceOf(speakers[0], 0) } } };
  }
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig }
  });

  let last = 'No se pudo crear el audio.';
  for (const model of TTS_MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 429) return res.status(429).json({ error: 'Llegamos al límite gratis de audio por ahora.' });
      if (!r.ok) {
        last = (data.error && data.error.message) || `Error ${r.status} al crear el audio.`;
        if (r.status === 404 || r.status === 400) continue; // modelo no disponible: probamos el siguiente
        return res.status(502).json({ error: last });
      }
      const part = (((data.candidates || [])[0] || {}).content || {}).parts || [];
      const inline = part.map(p => p.inlineData || p.inline_data).find(Boolean);
      if (!inline || !inline.data) { last = 'La IA no devolvió audio.'; continue; }
      const m = /rate=(\d+)/.exec(inline.mimeType || inline.mime_type || '');
      return res.status(200).json({ audio: inline.data, rate: m ? +m[1] : 24000, model });
    } catch (e) {
      last = 'No se pudo conectar con la IA para crear el audio.';
    }
  }
  return res.status(502).json({ error: last });
}
