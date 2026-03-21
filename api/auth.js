// Kullanıcı kayıt + kota kontrolü
// POST /api/auth  { email }
// Döner: { allowed: true/false, songs_used, songs_limit, plan }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const UPSTASH_URL  = process.env.UPSTASH_REDIS_URL;
const UPSTASH_TOK  = process.env.UPSTASH_REDIS_TOKEN;

async function redisGet(key) {
  const r = await fetch(`${UPSTASH_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOK}` }
  });
  const j = await r.json();
  return j.result;
}

async function redisSet(key, value, ex = 86400) {
  await fetch(`${UPSTASH_URL}/set/${key}/${value}/ex/${ex}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOK}` }
  });
}

async function redisIncr(key) {
  const r = await fetch(`${UPSTASH_URL}/incr/${key}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOK}` }
  });
  const j = await r.json();
  return j.result;
}

async function getOrCreateUser(email) {
  // Önce oku
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/quotas?email=eq.${encodeURIComponent(email)}&select=*`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const rows = await res.json();
  if (rows && rows.length > 0) return rows[0];

  // Yoksa oluştur
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

async function incrementUsage(email) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/quotas?email=eq.${encodeURIComponent(email)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ songs_used: undefined })  // raw sql ile artır
    }
  );
  // Doğrudan RPC ile artır
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_songs`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ user_email: email })
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, action } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });

  // Rate limit: IP başına günde 100 istek
  const ip = req.headers['x-forwarded-for'] || 'unknown';
  const ratKey = `rate:${ip}`;
  const count = await redisIncr(ratKey);
  if (count === 1) await redisSet(ratKey, 1, 86400);
  if (count > 100) return res.status(429).json({ error: 'rate limit' });

  const user = await getOrCreateUser(email);

  if (action === 'check') {
    var limit = user.songs_limit || 3;
    return res.json({
      allowed: user.plan !== 'free' || user.songs_used < limit,
      songs_used: user.songs_used || 0,
      songs_limit: limit,
      plan: user.plan || 'free'
    });
  }

  if (action === 'use') {
    if (user.songs_used >= user.songs_limit && user.plan === 'free') {
      return res.json({ allowed: false, songs_used: user.songs_used, songs_limit: user.songs_limit, plan: user.plan });
    }
    // songs_used artır
    await fetch(
      `${SUPABASE_URL}/rest/v1/quotas?email=eq.${encodeURIComponent(email)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ songs_used: user.songs_used + 1 })
      }
    );
    return res.json({ allowed: true, songs_used: user.songs_used + 1, songs_limit: user.songs_limit, plan: user.plan });
  }

  return res.json({ songs_used: user.songs_used, songs_limit: user.songs_limit, plan: user.plan });
}
