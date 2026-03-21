const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
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

async function getUser(email) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/quotas?email=eq.${encodeURIComponent(email)}&select=*`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const rows = await res.json();
  if (rows && rows.length > 0) return rows[0];

  // Kullanıcı yoksa oluştur (3 hediye şarkı)
  const ins = await fetch(`${SUPABASE_URL}/rest/v1/quotas`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({ email, songs_used: 0, songs_limit: 3, plan: 'free' })
  });
  const created = await ins.json();
  return Array.isArray(created) ? created[0] : created;
}

async function incrementUsage(email, currentUsed) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/quotas?email=eq.${encodeURIComponent(email)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ songs_used: currentUsed + 1 })
    }
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt: rawPrompt, style: rawStyle, title, email,
          emotion, power, lyrics, chorusLevel, lyricsBy, chorus } = req.body;

  // Wizard alanlarından prompt/style oluştur
  const prompt = rawPrompt || lyrics || emotion || 'Duygusal Türkçe şarkı';
  const style  = rawStyle  || [emotion, power].filter(Boolean).join(', ') || 'Türkçe Pop';

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
    const user = await getUser(email);
    if (user && user.plan === 'free' && user.songs_used >= (user.songs_limit || 3)) {
      return res.status(403).json({
        error: 'quota_exceeded',
        message: 'Ücretsiz limitin doldu. Pro\'ya geç, sınırsız üret!',
        songs_used: user.songs_used,
        songs_limit: user.songs_limit
      });
    }
    // Kullanımı artır
    if (user) await incrementUsage(email, user.songs_used);
  }

  try {
    const response = await fetch('https://api.kie.ai/api/v1/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
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

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
}
