// Direct PATCH test to diagnose Supabase issue

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const EMAIL = 'direct-patch-test-' + Date.now() + '@example.com';

console.log(`\nDirect PATCH Test\nEmail: ${EMAIL}\n`);

async function test() {
  try {
    // 1. CREATE
    console.log('1️⃣  POST (Create record)...');
    let res = await fetch(`${SUPABASE_URL}/rest/v1/quotas`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ email: EMAIL, songs_used: 0, songs_limit: 3, plan: 'free' })
    });
    let data = await res.json();
    console.log(`   Status: ${res.status}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));

    // 2. PATCH
    console.log('\n2️⃣  PATCH (Update to 99)...');
    res = await fetch(`${SUPABASE_URL}/rest/v1/quotas?email=eq.${encodeURIComponent(EMAIL)}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ songs_used: 99 })
    });
    data = await res.json();
    console.log(`   Status: ${res.status}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));

    // 3. GET
    console.log('\n3️⃣  GET (Verify)...');
    res = await fetch(`${SUPABASE_URL}/rest/v1/quotas?email=eq.${encodeURIComponent(EMAIL)}&select=*`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`
      }
    });
    data = await res.json();
    console.log(`   Status: ${res.status}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));

    if (data[0]?.songs_used === 99) {
      console.log('\n✅ PATCH WORKS - value persisted!');
    } else {
      console.log('\n❌ PATCH FAILED - value not persisted');
      console.log(`   Expected: 99, Got: ${data[0]?.songs_used}`);
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
