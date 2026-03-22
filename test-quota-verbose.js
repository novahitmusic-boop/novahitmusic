// Verbose quota test - show every response

const BASE_URL = 'https://novahitmusic.vercel.app';
const TEST_EMAIL = 'test-quota-verbose-' + Date.now() + '@example.com';

console.log(`\n🔵 VERBOSE QUOTA TEST\nEmail: ${TEST_EMAIL}\n`);

async function testStep(num, action) {
  console.log(`\n${num}️⃣  ${action.toUpperCase()}...`);
  const res = await fetch(`${BASE_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, action })
  });
  const data = await res.json();
  console.log(`   Status: ${res.status}`);
  console.log(`   Full Response:`, JSON.stringify(data, null, 2));
  return data;
}

async function runTests() {
  try {
    await testStep(1, 'check');
    await testStep(2, 'use');
    await testStep(3, 'check');
    await testStep(4, 'use');
    await testStep(5, 'check');
    await testStep(6, 'use');
    await testStep(7, 'check');
    await testStep(8, 'use');
    await testStep(9, 'check');
    await testStep(10, 'use');
    await testStep(11, 'check');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

runTests();
