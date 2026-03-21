// Klip üretimi — fal.ai Wan 2.5 (Text-to-Video)
// POST /api/klip  { prompt, image_url? }
// image_url varsa Image-to-Video, yoksa Text-to-Video

const FAL_KEY = process.env.FAL_API_KEY;
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

  const { prompt, image_url } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt gerekli' });

  // IP rate limit: günde 10 klip
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  const count = await redisIncr(`klip:ip:${ip}`);
  if (count > 10) return res.status(429).json({ error: 'Günlük klip limitin doldu.' });

  // Model seç: görsel varsa I2V, yoksa T2V
  const model = image_url
    ? 'fal-ai/wan-i2v'   // Image-to-Video
    : 'fal-ai/wan/v2.2/t2v'; // Text-to-Video

  const body = image_url
    ? { prompt, image_url, duration: '5', aspect_ratio: '16:9' }
    : { prompt, duration: '5', aspect_ratio: '16:9', resolution: '720p' };

  try {
    // fal.ai async queue
    const queueRes = await fetch(`https://queue.fal.run/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const queue = await queueRes.json();

    if (!queueRes.ok) {
      return res.status(500).json({ error: queue.detail || 'fal.ai hata' });
    }

    // request_id döndür — client polling yapar
    return res.json({
      request_id: queue.request_id,
      status_url: queue.status_url,
      model
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
