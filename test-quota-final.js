// Final quota test - clean sequence

const BASE_URL = 'https://novahitmusic.vercel.app';
const TEST_EMAIL = 'final-quota-test-' + Date.now() + '@example.com';

console.log(`\n✅ FINAL PHASE 2.A QUOTA TEST\nEmail: ${TEST_EMAIL}\n`);

async function step(num, action) {
  const res = await fetch(`${BASE_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, action })
  });
  const data = await res.json();
  const status = data.songs_used === undefined ? '❌' : data.allowed === false ? '🚫' : '✅';
  console.log(`${num}. ${action.toUpperCase()}: ${status} ${data.songs_used}/${data.songs_limit}${data.error ? ` (${data.error})` : ''}`);
  return data;
}

async function test() {
  try {
    const s1 = await step(1, 'check');
    const s2 = await step(2, 'use');
    const s3 = await step(3, 'use');
    const s4 = await step(4, 'use');
    const s5 = await step(5, 'check');
    const s6 = await step(6, 'use');

    console.log('\n📊 RESULTS:');
    const pass = s2.songs_used === 1 && s3.songs_used === 2 && s4.songs_used === 3 &&
                 s5.allowed === false && s6.error === 'quota_exceeded';
    console.log(`   ${pass ? '✅ PHASE 2.A PASS' : '❌ PHASE 2.A FAIL'}`);
    console.log(`   - Song 1-3 incremented: ${s2.songs_used === 1 && s3.songs_used === 2 && s4.songs_used === 3 ? '✅' : '❌'}`);
    console.log(`   - Song 4 blocked: ${s6.error === 'quota_exceeded' ? '✅' : '❌'}`);

  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
