// Ses klonlama — fish.audio
// POST /api/voice  { text, reference_audio_url?, voice_id? }

const FISH_KEY = process.env.FISH_API_KEY;
const UPSTASH_URL = process.env.UPSTASH_REDIS_URL;
const UPSTASH_TOK = process.env.UPSTASH_REDIS_TOKEN;

async function redisIncr(key, ex = 86400) {
  const r = await fetch(`${UPSTASH_URL}/incr/${key}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOK}` }
  });
  const j = await r.json();
  if (j.result === 1) {
    await fetch(`${UPSTASH_URL}/expire/${key}/${ex}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOK}` }
    });
  }
  return j.result;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { text, voice_id, reference_audio_url } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text gerekli' });

  // IP rate limit: günde 5 klonlama
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  const count = await redisIncr(`voice:ip:${ip}`);
  if (count > 5) return res.status(429).json({ error: 'Günlük ses klonlama limitin doldu.' });

  try {
    const payload = {
      text,
      format: 'mp3',
      mp3_bitrate: 128,
      latency: 'normal',
      // voice_id varsa klonlanmış ses kullan, yoksa varsayılan
      ...(voice_id ? { voice_id } : {}),
      ...(reference_audio_url ? {
        references: [{ audio: reference_audio_url }]
      } : {})
    };

    const r = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FISH_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const err = await r.text();
      return res.status(500).json({ error: 'fish.audio hata: ' + err });
    }

    // Audio binary döner — direkt ilet
    const audioBuffer = await r.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'inline; filename="novahit-voice.mp3"');
    return res.send(Buffer.from(audioBuffer));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
