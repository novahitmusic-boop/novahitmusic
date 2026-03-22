const KIE_API_KEY = process.env.KIE_API_KEY;
const UPSTASH_URL  = process.env.UPSTASH_REDIS_URL;
const UPSTASH_TOK  = process.env.UPSTASH_REDIS_TOKEN;

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

// Call /api/auth to check and update quota
async function checkQuota(email) {
  const res = await fetch('https://novahitmusic.vercel.app/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, action: 'check' })
  });
  return await res.json();
}

async function useQuota(email) {
  const res = await fetch('https://novahitmusic.vercel.app/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, action: 'use' })
  });
  return await res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt: rawPrompt, style: rawStyle, title, email,
          emotion, power, lyrics, chorusLevel, lyricsBy, chorus,
          genres, mood, language } = req.body;

  // Wizard alanlarından prompt/style oluştur
  const prompt = rawPrompt || lyrics || emotion || 'Duygusal Türkçe şarkı';
  const styleParts = [rawStyle, genres, mood, emotion, power].filter(Boolean);
  const style = styleParts.length > 0 ? styleParts.join(', ') : 'Türkçe Pop';

  if (!prompt) {
    return res.status(400).json({ error: 'prompt gerekli' });
  }

  // IP rate limit: günde 50 üretim
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  const ipCount = await redisIncr(`gen:ip:${ip}`);
  if (ipCount > 50) {
    return res.status(429).json({ error: 'Günlük limit aşıldı. Yarın tekrar dene.' });
  }

  // Email ile kota kontrolü (opsiyonel — email gönderilmişse)
  if (email) {
    const quotaCheck = await checkQuota(email);
    if (!quotaCheck.allowed) {
      return res.status(403).json({
        error: 'quota_exceeded',
        message: 'Ücretsiz limitin doldu. Pro\'ya geç, sınırsız üret!',
        songs_used: quotaCheck.songs_used,
        songs_limit: quotaCheck.songs_limit
      });
    }
  }

  try {
    const response = await fetch('https://api.kie.ai/api/v1/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        style,
        title: title || 'Novahit AI',
        customMode: true,
        instrumental: false,
        model: 'V4_5',
        callBackUrl: 'https://novahitmusic.vercel.app/api/callback',
      }),
    });

    const data = await response.json();

    console.log('kie.ai response:', JSON.stringify(data));

    if (!response.ok || data.code !== 200) {
      return res.status(200).json({ error: data.msg || data.message || ('kie.ai hata kodu: ' + data.code), raw: data });
    }

    // Success - increment quota after successful generation
    if (email) {
      const quotaUse = await useQuota(email);
      console.log('Quota incremented:', quotaUse.songs_used);
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
}
