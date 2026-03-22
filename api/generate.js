const KIE_API_KEY    = process.env.KIE_API_KEY;
const MUREKA_KEY     = process.env.MUREKA_API_KEY;
const UPSTASH_URL    = process.env.UPSTASH_REDIS_URL;
const UPSTASH_TOK    = process.env.UPSTASH_REDIS_TOKEN;

const OWNER_EMAILS   = ['muratakbal@hotmail.com'];

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
  return res.json();
}

async function useQuota(email) {
  const res = await fetch('https://novahitmusic.vercel.app/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, action: 'use' })
  });
  return res.json();
}

// ── Mureka: önce söz üret, sonra şarkı üret ──────────────────────────────
async function murekaGenerate(prompt, title, language) {
  const headers = {
    'Authorization': `Bearer ${MUREKA_KEY}`,
    'Content-Type': 'application/json',
  };

  // 1. Söz üret
  const lyricsRes = await fetch('https://api.mureka.ai/v1/lyrics/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, model: 'auto' }),
    signal: AbortSignal.timeout(20000),
  });
  if (!lyricsRes.ok) throw new Error('Mureka lyrics hata: ' + lyricsRes.status);
  const lyricsJob = await lyricsRes.json();

  // Söz sonucunu bekle (sync veya async)
  let lyrics = lyricsJob.text || lyricsJob.lyrics || '';
  if (!lyrics && lyricsJob.id) {
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const poll = await fetch(`https://api.mureka.ai/v1/lyrics/query/${lyricsJob.id}`, {
        headers, signal: AbortSignal.timeout(10000),
      });
      const pd = await poll.json();
      if (pd.status === 'succeeded' || pd.status === 'completed') {
        lyrics = pd.text || pd.lyrics || pd.content || '';
        break;
      }
      if (pd.status === 'failed') throw new Error('Mureka lyrics failed');
    }
  }
  if (!lyrics) throw new Error('Mureka lyrics boş döndü');

  // 2. Vokal cinsiyeti tahmin et
  const lowerPrompt = prompt.toLowerCase();
  const vocal_gender = lowerPrompt.includes('kadın') || lowerPrompt.includes('female') ? 'female'
    : lowerPrompt.includes('erkek') || lowerPrompt.includes('male') ? 'male'
    : 'female';

  // 3. Şarkı üret
  const songRes = await fetch('https://api.mureka.ai/v1/song/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      lyrics,
      desc: prompt.slice(0, 200),
      vocal_gender,
      title: title || '',
      model: 'auto',
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!songRes.ok) throw new Error('Mureka song hata: ' + songRes.status);
  const songJob = await songRes.json();
  if (!songJob.id) throw new Error('Mureka task ID yok');

  return { provider: 'mureka', taskId: songJob.id };
}

// ── kie.ai: exponential backoff retry ────────────────────────────────────
async function kieAIGenerate(payload) {
  const maxAttempts = 3;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 50000);
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
      clearTimeout(tid);
      if (response.status === 429) {
        const wait = (parseInt(response.headers.get('retry-after') || '0') || Math.pow(2, attempt)) * 1500;
        if (attempt < maxAttempts) { await new Promise(r => setTimeout(r, wait)); continue; }
        return { ok: false, status: 429, data: { msg: 'Sunucu meşgul, lütfen tekrar dene.' } };
      }
      if (response.status >= 500 && attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000)); continue;
      }
      const data = await response.json();
      return { ok: response.ok, status: response.status, data };
    } catch (err) {
      clearTimeout(tid);
      lastErr = err;
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
  throw lastErr || new Error('kie.ai bağlantı hatası');
}

// ── Handler ───────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt: rawPrompt, style, title, email, language } = req.body;
  const prompt = rawPrompt || style || 'Duygusal Türkçe şarkı';
  if (!prompt) return res.status(400).json({ error: 'prompt gerekli' });

  const isOwner = OWNER_EMAILS.includes((email || '').toLowerCase().trim());

  // IP rate limit (owner hariç)
  if (!isOwner) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
    const cnt = await redisIncr(`gen:ip:${ip}`);
    if (cnt > 50) return res.status(429).json({ error: 'Günlük limit aşıldı. Yarın tekrar dene.' });
  }

  // Kota kontrolü (owner hariç)
  if (email && !isOwner) {
    const qc = await checkQuota(email);
    if (!qc.allowed) return res.status(403).json({
      error: 'quota_exceeded',
      message: 'Ücretsiz limitin doldu. Pro\'ya geç!',
      songs_used: qc.songs_used,
      songs_limit: qc.songs_limit,
    });
  }

  // ── Mureka (primary) ──────────────────────────────────────────────────
  if (MUREKA_KEY) {
    try {
      console.log('Mureka ile üretiliyor...');
      const result = await murekaGenerate(prompt, title, language || 'Turkish');
      if (email && !isOwner) await useQuota(email);
      return res.status(200).json({ data: { taskId: result.taskId, provider: 'mureka' } });
    } catch (err) {
      console.warn('Mureka hata, kie.ai fallback:', err.message);
    }
  }

  // ── kie.ai (fallback) ─────────────────────────────────────────────────
  try {
    console.log('kie.ai ile üretiliyor...');
    const { ok, status, data } = await kieAIGenerate({
      prompt,
      style: prompt,
      title: title || 'Novahit AI',
      customMode: true,
      instrumental: false,
      model: 'V4_5',
      callBackUrl: 'https://novahitmusic.vercel.app/api/callback',
    });

    if (!ok || (data.code && data.code !== 200)) {
      const msg = data.msg || data.message || data.error || ('kie.ai hata: ' + (data.code || status));
      return res.status(400).json({ error: 'Müzik üretimi başarısız: ' + msg });
    }
    if (!data.data?.taskId) return res.status(400).json({ error: 'taskId alınamadı' });

    if (email && !isOwner) await useQuota(email);
    return res.status(200).json({ data: { taskId: data.data.taskId, provider: 'kie' } });
  } catch (err) {
    console.error('Generate hatası:', err.message);
    return res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
}
