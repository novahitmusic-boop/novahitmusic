// Phase 2.A Automated Quota Test
// Tests 3-song limit + Pro lock quota system

const BASE_URL = 'https://novahitmusic.vercel.app';
const TEST_EMAIL = 'test-quota-phase2a-' + Date.now() + '@example.com';

console.log(`\n🔵 PHASE 2.A QUOTA TEST\nEmail: ${TEST_EMAIL}\n`);

// Generate song and check quota
async function testSongGeneration(songNum) {
  console.log(`\n📝 TEST ${songNum}: Generate Song #${songNum}`);

  const genRes = await fetch(`${BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `Test song number ${songNum}`,
      style: 'pop, upbeat',
      title: `Test Song ${songNum}`,
      email: TEST_EMAIL,
      emotion: 'happy',
      language: 'tr'
    })
  });

  const genData = await genRes.json();
  console.log(`  Generation status: ${genRes.status}`);

  if (!genRes.ok) {
    console.log(`  ❌ FAILED: ${genData.error}`);
    return { success: false, quota: null, error: genData.error };
  }

  console.log(`  ✅ Task created: ${genData.taskId || genData.id || 'id_unknown'}`);

  // Wait 2 sec for Supabase to update
  await new Promise(r => setTimeout(r, 2000));

  // Check quota
  console.log(`  📊 Checking quota...`);
  const quotaRes = await fetch(`${BASE_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, action: 'check' })
  });

  const quotaData = await quotaRes.json();
  console.log(`  Quota: ${quotaData.songs_used}/${quotaData.songs_limit} (Plan: ${quotaData.plan})`);

  return { success: true, quota: quotaData };
}

async function runTests() {
  try {
    // Test songs 1-3
    const results = [];
    for (let i = 1; i <= 3; i++) {
      const result = await testSongGeneration(i);
      results.push(result);
      if (!result.success) break;
    }

    // Test 4th song (should fail)
    if (results[2]?.quota?.songs_used === 3) {
      console.log(`\n📝 TEST 4: Try Song #4 (Should Be Blocked)`);

      const genRes = await fetch(`${BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Test song number 4',
          style: 'pop',
          title: 'Test Song 4',
          email: TEST_EMAIL,
          emotion: 'happy',
          language: 'tr'
        })
      });

      const genData = await genRes.json();
      console.log(`  Status: ${genRes.status}`);

      if (genData.error === 'quota_exceeded') {
        console.log(`  ✅ BLOCKED: Quota exceeded (as expected)`);
        console.log(`  Message: ${genData.message}`);
        results.push({ success: false, blocked: true, error: 'quota_exceeded' });
      } else {
        console.log(`  ⚠️  UNEXPECTED: ${genData.error || 'no error'}`);
      }
    }

    // Summary
    console.log(`\n\n📋 SUMMARY:`);
    console.log(`  Song 1: ${results[0]?.success ? '✅' : '❌'} (Quota: ${results[0]?.quota?.songs_used || 'N/A'})`);
    console.log(`  Song 2: ${results[1]?.success ? '✅' : '❌'} (Quota: ${results[1]?.quota?.songs_used || 'N/A'})`);
    console.log(`  Song 3: ${results[2]?.success ? '✅' : '❌'} (Quota: ${results[2]?.quota?.songs_used || 'N/A'})`);
    console.log(`  Song 4: ${results[3]?.blocked ? '✅ BLOCKED' : '❌ SHOULD BE BLOCKED'}`);

    const allPass = results[0]?.success && results[1]?.success && results[2]?.success && results[3]?.blocked;
    console.log(`\n${allPass ? '✅ PHASE 2.A PASS' : '❌ PHASE 2.A FAIL'}\n`);

  } catch (err) {
    console.error('Test error:', err.message);
  }
}

runTests();
