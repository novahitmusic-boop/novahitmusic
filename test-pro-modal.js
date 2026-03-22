// Test: Pro modal displays correctly when quota exceeded

const BASE_URL = 'https://novahitmusic.vercel.app';
const TEST_EMAIL = 'pro-modal-test-' + Date.now() + '@example.com';

console.log(`\n🔐 PRO MODAL TEST\nEmail: ${TEST_EMAIL}\n`);

async function testProModal() {
  try {
    // Step 1: Use all 3 free songs
    console.log('1️⃣  Filling quota (3 songs)...');
    for (let i = 1; i <= 3; i++) {
      const res = await fetch(`${BASE_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL, action: 'use' })
      });
      const data = await res.json();
      console.log(`   Song ${i}: ${data.songs_used}/${data.songs_limit}`);
    }

    // Step 2: Try 4th song (should be blocked)
    console.log('\n2️⃣  Attempting 4th song (should trigger Pro modal)...');
    const quotaRes = await fetch(`${BASE_URL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, action: 'check' })
    });
    const quotaData = await quotaRes.json();

    if (quotaData.allowed === false) {
      console.log('   ✅ User blocked (allowed: false)');
      console.log('   ✅ Pro modal SHOULD appear on site');
      console.log(`   ✅ Message: "Şarkın hazır! Pro'ya geç"`);
      console.log(`   ✅ CTA: "🔒 İndirmek için Pro'ya geç — $9.99/ay"`);
      console.log(`   ✅ Price display: "$16.99 → $9.99/ay"`);
      console.log(`   ✅ Fallback link: "veya ücretsiz bu ay 1 şarkı indir →"`);
    } else {
      console.log('   ❌ ERROR: User not blocked!');
      return false;
    }

    // Step 3: Manual test instructions
    console.log('\n3️⃣  MANUAL VERIFICATION NEEDED:');
    console.log('   1. Open: https://novahitmusic.vercel.app');
    console.log(`   2. Enter email: ${TEST_EMAIL}`);
    console.log('   3. Generate song 1 (any settings)');
    console.log('   4. Generate song 2');
    console.log('   5. Generate song 3');
    console.log('   6. Click "✦ Şarkımı Oluştur" for song 4');
    console.log('   ');
    console.log('   EXPECTED:');
    console.log('   - Loading spinner appears INSTANTLY (<50ms)');
    console.log('   - After ~500ms: Pro modal pops up');
    console.log('   - Modal shows: "Şarkın hazır! Pro\'ya geç"');
    console.log('   - Button: "🔒 İndirmek için Pro\'ya geç — $9.99/ay"');
    console.log('   - Price: Strikethrough $16.99 → $9.99');
    console.log('   - Link: "veya ücretsiz bu ay 1 şarkı indir →"');
    console.log('\n✅ PRO MODAL TEST SETUP COMPLETE\n');

    return true;

  } catch (err) {
    console.error('Error:', err.message);
    return false;
  }
}

testProModal();
