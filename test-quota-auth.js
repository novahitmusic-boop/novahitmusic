// Test quota via /api/auth action="use" (known working endpoint)

const BASE_URL = 'https://novahitmusic.vercel.app';
const TEST_EMAIL = 'test-auth-quota-' + Date.now() + '@example.com';

console.log(`\n🔵 TESTING /api/auth QUOTA INCREMENT\nEmail: ${TEST_EMAIL}\n`);

async function testQuotaIncrement() {
  try {
    // Check initial state
    console.log(`\n1️⃣  Initial quota check...`);
    let res = await fetch(`${BASE_URL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, action: 'check' })
    });
    let data = await res.json();
    console.log(`   Status: ${res.status}`);
    console.log(`   Quota: ${data.songs_used}/${data.songs_limit}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));

    // Use 1 song
    console.log(`\n2️⃣  Using 1 song (action=use)...`);
    res = await fetch(`${BASE_URL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, action: 'use' })
    });
    data = await res.json();
    console.log(`   Status: ${res.status}`);
    console.log(`   Allowed: ${data.allowed}`);
    console.log(`   Quota after: ${data.songs_used}/${data.songs_limit}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));

    // Use 2nd song
    console.log(`\n3️⃣  Using 2nd song...`);
    res = await fetch(`${BASE_URL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, action: 'use' })
    });
    data = await res.json();
    console.log(`   Quota after: ${data.songs_used}/${data.songs_limit}`);

    // Use 3rd song
    console.log(`\n4️⃣  Using 3rd song...`);
    res = await fetch(`${BASE_URL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, action: 'use' })
    });
    data = await res.json();
    console.log(`   Quota after: ${data.songs_used}/${data.songs_limit}`);

    // Try 4th (should fail)
    console.log(`\n5️⃣  Try 4th song (should be blocked)...`);
    res = await fetch(`${BASE_URL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, action: 'use' })
    });
    data = await res.json();
    console.log(`   Status: ${res.status}`);
    console.log(`   Allowed: ${data.allowed}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));

    // Check final state
    console.log(`\n6️⃣  Final quota check...`);
    res = await fetch(`${BASE_URL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, action: 'check' })
    });
    data = await res.json();
    console.log(`   Final Quota: ${data.songs_used}/${data.songs_limit}`);

    // Summary
    const testPass = data.songs_used === 3 && data.allowed === false;
    console.log(`\n${testPass ? '✅ AUTH QUOTA TEST PASS' : '❌ AUTH QUOTA TEST FAIL'}`);

  } catch (err) {
    console.error('Test error:', err.message);
  }
}

testQuotaIncrement();
