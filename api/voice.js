// Ses klonlama — Replicate XTTS-v2
// POST /api/voice  { text, speaker_url? }
// speaker_url: 30 sn ses kaydı URL'si (opsiyonel, yoksa varsayılan ses)

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
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

  const { text, speaker_url, language } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text gerekli' });

  // IP rate limit: günde 5 klonlama
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  const count = await redisIncr(`voice:ip:${ip}`);
  if (count > 5) return res.status(429).json({ error: 'Günlük ses klonlama limitin doldu.' });

  try {
    const input = {
      text,
      language: language || 'tr',
      cleanup_voice: true,
      ...(speaker_url ? { speaker: speaker_url } : {})
    };

    // Replicate prediction başlat
    const startRes = await fetch('https://api.replicate.com/v1/models/lucataco/xtts-v2/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=60'
      },
      body: JSON.stringify({ input })
    });

    const prediction = await startRes.json();

    if (prediction.error) {
      return res.status(500).json({ error: prediction.error });
    }

    // Eğer hemen tamamlandıysa (wait=60 ile)
    if (prediction.status === 'succeeded' && prediction.output) {
      return res.json({ audio_url: prediction.output, status: 'completed' });
    }

    // Yoksa prediction ID döndür — client polling yapar
    return res.json({ prediction_id: prediction.id, status: prediction.status });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
