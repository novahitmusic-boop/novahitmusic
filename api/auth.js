// Kota sistemi - Redis based (daha hızlı, esnek)
// POST /api/auth { email, action: "check"|"use" }

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

// Get user quota from Redis, fallback to Supabase
async function getUserQuota(email) {
  const quotaKey = `quota:${email}`;

  // Try Redis first
  const cachedQuota = await redisGet(quotaKey);
  if (cachedQuota) {
    try {
      return JSON.parse(cachedQuota);
    } catch (e) {
      console.error('Redis quota parse error:', e.message);
    }
  }

  // Fallback: read from Supabase
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/quotas?email=eq.${encodeURIComponent(email)}&select=*&limit=1`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const rows = await res.json();

  if (rows && rows.length > 0) {
    const user = rows[0];
    // Cache in Redis for 24 hours
    await redisSet(quotaKey, JSON.stringify({
      email: user.email,
      songs_used: user.songs_used || 0,
      songs_limit: user.songs_limit || 3,
      plan: user.plan || 'free'
    }), 86400);
    return user;
  }

  // New user - create in Supabase and cache in Redis
  const newUser = { email, songs_used: 0, songs_limit: 3, plan: 'free' };
  const ins = await fetch(`${SUPABASE_URL}/rest/v1/quotas`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(newUser)
  });

  if (!ins.ok) {
    console.error('Failed to create user:', await ins.text());
  }

  // Cache in Redis
  await redisSet(quotaKey, JSON.stringify(newUser), 86400);
  return newUser;
}

// Update quota in Redis (source of truth) + Supabase (backup)
async function updateQuota(email, newCount) {
  const quotaKey = `quota:${email}`;
  const quota = {
    email,
    songs_used: newCount,
    songs_limit: 3,
    plan: 'free'
  };

  // Update Redis (fast, immediate)
  await redisSet(quotaKey, JSON.stringify(quota), 86400);

  // Update Supabase async (backup persistence)
  fetch(`${SUPABASE_URL}/rest/v1/quotas?email=eq.${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ songs_used: newCount })
  }).catch(err => console.error('Supabase sync failed:', err.message));

  return quota;
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

  // Sahip emaili — her zaman sınırsız
  const OWNER_EMAILS = ['muratakbal@hotmail.com'];
  if (OWNER_EMAILS.includes(email.toLowerCase())) {
    return res.json({ allowed: true, songs_used: 0, songs_limit: 9999, plan: 'pro' });
  }

  const quota = await getUserQuota(email);
  const used = quota.songs_used || 0;
  const limit = quota.songs_limit || 3;
  const plan = quota.plan || 'free';

  if (action === 'check') {
    return res.json({
      allowed: plan !== 'free' || used < limit,
      songs_used: used,
      songs_limit: limit,
      plan: plan
    });
  }

  if (action === 'use') {
    if (used >= limit && plan === 'free') {
      return res.json({
        allowed: false,
        songs_used: used,
        songs_limit: limit,
        plan: plan,
        error: 'quota_exceeded'
      });
    }

    const updated = await updateQuota(email, used + 1);
    return res.json({
      allowed: true,
      songs_used: updated.songs_used,
      songs_limit: updated.songs_limit,
      plan: updated.plan
    });
  }

  return res.json({ songs_used: used, songs_limit: limit, plan: plan });
}
