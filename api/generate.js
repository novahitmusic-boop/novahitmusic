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

// Exponential backoff retry — 429 ve 5xx için
async function kieAIGenerate(payload) {
  const maxAttempts = 3;
  let lastErr;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000);

    try {
      const response = await fetch('https://api.kie.ai/api/v1/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${KIE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // 429 → backoff
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '0') || 0;
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : Math.pow(2, attempt) * 1500;
        console.warn(`kie.ai 429 — deneme ${attempt}/${maxAttempts}, ${waitMs}ms bekleniyor`);
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        return { ok: false, status: 429, data: { msg: 'Sunucu meşgul, lütfen 1-2 dakika sonra tekrar dene.' } };
      }

      // 5xx → backoff
      if (response.status >= 500 && attempt < maxAttempts) {
        console.warn(`kie.ai ${response.status} — deneme ${attempt}/${maxAttempts}`);
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }

      const data = await response.json();
      console.log(`kie.ai yanıt (deneme ${attempt}):`, JSON.stringify(data), 'status:', response.status);
      return { ok: response.ok, status: response.status, data };

    } catch (err) {
      clearTimeout(timeoutId);
      lastErr = err;
      console.warn(`kie.ai bağlantı hatası (deneme ${attempt}/${maxAttempts}):`, err.message);
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw lastErr || new Error('kie.ai bağlantı hatası');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt: rawPrompt, style: rawStyle, title, email,
          emotion, power, lyrics, chorusLevel, lyricsBy, chorus,
          genres, mood, language } = req.body;

  const prompt = rawPrompt || lyrics || emotion || 'Duygusal Türkçe şarkı';
  const styleParts = [rawStyle, genres, mood, emotion, power].filter(Boolean);
  const style = styleParts.length > 0 ? styleParts.join(', ') : 'Türkçe Pop';

  if (!prompt) {
    return res.status(400).json({ error: 'prompt gerekli' });
  }

  // Sahip emaili — IP limiti ve kota atlama
  const OWNER_EMAILS = ['muratakbal@hotmail.com'];
  const isOwner = OWNER_EMAILS.includes((email || '').toLowerCase().trim());

  if (!isOwner) {
    // IP rate limit: günde 50 üretim
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
    const ipCount = await redisIncr(`gen:ip:${ip}`);
    if (ipCount > 50) {
      return res.status(429).json({ error: 'Günlük limit aşıldı. Yarın tekrar dene.' });
    }
  }

  if (email && !isOwner) {
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
    const { ok, status, data } = await kieAIGenerate({
      prompt,
      style,
      title: title || 'Novahit AI',
      customMode: true,
      instrumental: false,
      model: 'V4_5',
      callBackUrl: 'https://novahitmusic.vercel.app/api/callback',
    });

    if (!ok || (data.code && data.code !== 200)) {
      const errMsg = data.msg || data.message || data.error || ('kie.ai hata: ' + (data.code || status));
      console.error('kie.ai hata:', errMsg, data);
      return res.status(400).json({
        error: 'Müzik üretimi başarısız: ' + errMsg,
        code: data.code,
        raw: data
      });
    }

    if (!data.data || !data.data.taskId) {
      console.error('taskId yok:', data);
      return res.status(400).json({
        error: 'kie.ai taskId döndürmedi (yanıt formatı sorunlu)',
        raw: data
      });
    }

    if (email && !isOwner) {
      const quotaUse = await useQuota(email);
      console.log('Kota artırıldı:', quotaUse.songs_used);
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Generate API hatası:', err.message);
    return res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
}
