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

// ── Mureka: tema tespiti + güçlü prompt + kaliteli söz ───────────────────

// Kullanıcı metninden tema bilgisi çıkar
function detectTheme(text) {
  const t = text.toLowerCase();
  if (/ayrılık|ayrılmak|gittin|bıraktın|bitti|elveda|vedalaş/.test(t))
    return { key: 'ayrilik', label: 'ayrılık' };
  if (/özlem|özledim|hasret|uzak|gelmiyorsun|yokluğun/.test(t))
    return { key: 'ozlem', label: 'özlem' };
  if (/aşk|sevgi|seviyorum|seni seviyorum|kalp|yüreğim/.test(t))
    return { key: 'ask', label: 'aşk' };
  if (/annem|anne|anneciğim|ana|ninni/.test(t))
    return { key: 'anne', label: 'annem' };
  if (/umut|yeni başlangıç|sabah|ışık|yeniden|güneş/.test(t))
    return { key: 'umut', label: 'umut' };
  if (/yalnız|yalnızlık|kimsesiz|tek başım|sessizlik/.test(t))
    return { key: 'yalnizlik', label: 'yalnızlık' };
  if (/ihanet|aldatma|yalan|kandırdın|acı verd/.test(t))
    return { key: 'ihanet', label: 'ihanet' };
  if (/güç|özgürlük|korkma|yılma|savaş|kazan/.test(t))
    return { key: 'guc', label: 'güç' };
  if (/neşe|eğlence|dans|mutluluk|gülüş|sevinç/.test(t))
    return { key: 'nese', label: 'neşe' };
  return { key: 'genel', label: text.split(/[,\s]/)[0].trim().slice(0, 20) || 'duygu' };
}

// Kullanıcı metninden tarz bilgisi çıkar
function detectGenre(text) {
  const t = text.toLowerCase();
  if (/arabesk|araba/.test(t))      return 'arabesk, Turkish arabesque, saz, oud, emotional';
  if (/pop|türkçe pop/.test(t))     return 'Turkish pop, modern, catchy, upbeat';
  if (/ballad|yavaş/.test(t))       return 'slow ballad, piano, emotional, heartfelt';
  if (/r.b|soul/.test(t))           return 'R&B, soul, smooth, groove';
  if (/trap|rap|hip.hop/.test(t))   return 'trap, hip-hop, Turkish rap, hard beat';
  if (/akustik|acoustic|gitar/.test(t)) return 'acoustic folk, guitar, intimate, warm';
  if (/90|doksan/.test(t))          return '90s Turkish pop, nostalgic, retro, saz';
  if (/rock/.test(t))               return 'rock, electric guitar, powerful, energetic';
  return 'arabesk, Turkish arabesque, saz, oud, emotional'; // varsayılan
}

// Mureka prompt alanı — 10 güçlü keyword
function buildDesc(prompt, vocal_gender) {
  const genre = detectGenre(prompt);
  const theme = detectTheme(prompt);
  const mood = {
    ayrilik:   'melancholic, heartbroken, sad, emotional',
    ozlem:     'nostalgic, longing, bittersweet, emotional',
    ask:       'romantic, passionate, tender, emotional',
    anne:      'warm, loving, sentimental, heartfelt',
    umut:      'hopeful, uplifting, optimistic, bright',
    yalnizlik: 'melancholic, lonely, dark, introspective',
    ihanet:    'angry, dramatic, dark, intense',
    guc:       'powerful, energetic, triumphant, bold',
    nese:      'joyful, playful, upbeat, lively',
    genel:     'emotional, soulful, heartfelt, Turkish music',
  }[theme.key] || 'emotional, soulful, heartfelt';

  const vocalStr = vocal_gender === 'female' ? 'female vocal, soft voice' : 'male vocal, powerful voice';
  return `${genre}, ${mood}, ${vocalStr}, slow tempo, Turkish music`.slice(0, 500);
}

// Temaya göre gerçek Türkçe şarkı sözü — [verse]/[pre-chorus]/[chorus]/[verse2]/[bridge]/[chorus]
function buildLyrics(prompt, vocal_gender) {
  const theme = detectTheme(prompt);
  const L = theme.label;

  const templates = {
    ayrilik: `[verse]\nSon bakışın hala gözlerimde\nKapı kapandı arkandan sessizce\nOdalar boş kaldı, sessizlik doldu\nSensiz bir hayat nasıl yaşanır ki\n\n[pre-chorus]\nBilemiyorum, bilemiyorum\nNeden böyle oldu anlamıyorum\n\n[chorus]\nAyrılık yakıyor beni içten\nHer gecenin sonu sensiz bitiyor\n${L}, ${L}, bu son mu acaba\nKalbim hala seni bekliyor\n\n[verse 2]\nFotoğrafların duruyor aynı yerde\nGülüşün kafama kazınmış kaldı\nSeni çağırsam duymaz mısın artık\nBu sessizlik en büyük cevap oldu\n\n[bridge]\nBelki bir gün anlarsın ne hissettim\nBelki dönersin, belki dönmezsin\nAma bu şarkı hep seninle kalacak\n${L} acısıyla yazıldı her satır\n\n[chorus]\nAyrılık yakıyor beni içten\nHer gecenin sonu sensiz bitiyor\n${L}, ${L}, bu son mu acaba\nKalbim hala seni bekliyor`,

    ozlem: `[verse]\nUzakta bir yerde yaşıyorsun belki\nBen burada seninle yaşıyorum hep\nRüyalarımda hep sen varsın yanımda\nUyanınca yine yalnız kalıyorum\n\n[pre-chorus]\nGözlerim yollarda seni arıyor\nSesin kulağımda hala çınlıyor\n\n[chorus]\nÖzledim seni, her sabah özledim\n${L} beni sarıyor geceleri\nNerede olursan ol bil ki özledim\nBu his geçmiyor bir türlü geçmiyor\n\n[verse 2]\nEski sokaklar tanıdık geliyor\nGittiğin günden beri değişmedi\nSen olmadan renkler soluk duruyor\nSensiz geçen her an yıllarca uzuyor\n\n[bridge]\nBir gün döner misin bilmiyorum\nAma bu ${L} içimde yaşıyor\nSana yazdım bu şarkıyı uzaktan\nUmarım bir gün duyarsın sesimi\n\n[chorus]\nÖzledim seni, her sabah özledim\n${L} beni sarıyor geceleri\nNerede olursan ol bil ki özledim\nBu his geçmiyor bir türlü geçmiyor`,

    ask: `[verse]\nİlk kez gördüğümde anladım her şeyi\nGözlerin anlattı söylemeden önce\nKalbim hızlandı duraksadı aniden\nSenin için atıyor artık biliyorum\n\n[pre-chorus]\nSeni sevmek ne güzel hissettiriyor\nYanında olmak her şeye değiyor\n\n[chorus]\n${L} bu, sana olan ${L}\nHer nefeste seninle var oluyorum\nKalbim senin, ruhum senin, her şeyim\nSeninle yaşamak istiyorum hep\n\n[verse 2]\nGüldüğünde dünya güzelleşiyor\nSesiyle her gece uyuyabiliyorum\nEllerine dokunmak istiyorum hep\nYanında olmak hayalim gerçekleşti\n\n[bridge]\nBir ömür seninle olmak istiyorum\nBu ${L} sonsuza kadar sürsün\nSana olan her hissim gerçek biliyorum\nHayatımın anlamısın sen\n\n[chorus]\n${L} bu, sana olan ${L}\nHer nefeste seninle var oluyorum\nKalbim senin, ruhum senin, her şeyim\nSeninle yaşamak istiyorum hep`,

    anne: `[verse]\nKüçük ellerimi tutardın her gece\nNinnilerle büyüttün beni yorulmadan\nGözlerindeki ${L} şefkati unuttum mu\nHayır, her daim kalbimde taşıdım\n\n[pre-chorus]\nSen benim her şeyimsin annem\nVarlığın hayatıma ışık oldu\n\n[chorus]\n${L}, bu şarkı senin için\nSevgin dünyada en saf his bu\nEllerinin izini kalbimde taşıyorum\n${L}, hep yanımda hissediyorum seni\n\n[verse 2]\nYorulduğumda yüzüne bakardım\nGözlerin söylerdi her şey yolunda\nŞimdi uzakta olsan da hissediyorum\nSıcaklığını, kokunu, gülüşünü\n\n[bridge]\nBazen çocuk gibi ağlamak istiyorum\nSarıl bana bir kez daha anneciğim\nBu dünyada en değerlisi sensin\nSeni seviyorum, hep sevdim\n\n[chorus]\n${L}, bu şarkı senin için\nSevgin dünyada en saf his bu\nEllerinin izini kalbimde taşıyorum\n${L}, hep yanımda hissediyorum seni`,

    genel: `[verse]\nBu şarkıyı sana yazdım içimden\nKelimeler yetmez ama denedim\nDuygularım taşıyor, döküldü satırlara\n${L} için, sadece senin için\n\n[pre-chorus]\nSöyleyemedim yüzüne bakarak\nAma bu melodide bulacaksın her şeyi\n\n[chorus]\n${L}, bu şarkı seninle başlıyor\nHer notada seninle var oluyor\nKalbimden çıktı, kalbine gidiyor\n${L}, bu şarkı hep seninle kalacak\n\n[verse 2]\nZamanlar geçer ama duygular kalmaz mı\nBu anlar, bu hisler silinmez içimden\nYıllar sonra bu şarkıyı duyarsan\nBil ki o an seni düşünüyordum\n\n[bridge]\nBelki anlarsın belki anlamazsın\nAma bu ${L} gerçekti her zaman\nSana adanan bu melodiyi duyduğunda\nHisset benim gibi hisset bir an\n\n[chorus]\n${L}, bu şarkı seninle başlıyor\nHer notada seninle var oluyor\nKalbimden çıktı, kalbine gidiyor\n${L}, bu şarkı hep seninle kalacak`,
  };

  return templates[theme.key] || templates.genel;
}

async function murekaGenerate(prompt, title, language, vocal_gender_override) {
  const headers = {
    'Authorization': `Bearer ${MUREKA_KEY}`,
    'Content-Type': 'application/json',
  };

  // Vokal: önce override, yoksa prompt'tan tahmin et
  const lp = prompt.toLowerCase();
  const vocal_gender = vocal_gender_override
    || (lp.includes('kadın') || lp.includes('female') ? 'female'
      : lp.includes('erkek') || lp.includes('male') ? 'male'
      : 'male');

  const desc   = buildDesc(prompt, vocal_gender);
  const lyrics = buildLyrics(prompt, vocal_gender);

  console.log('Mureka desc:', desc);
  console.log('Mureka lyrics (ilk 100):', lyrics.slice(0, 100));

  const songRes = await fetch('https://api.mureka.ai/v1/song/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      lyrics,
      prompt: desc,
      vocal_gender,
      title: (title || '').slice(0, 50),
      model: 'mureka-o2',
      n: 2,
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!songRes.ok) {
    const errText = await songRes.text();
    throw new Error(`Mureka song hata ${songRes.status}: ${errText}`);
  }

  const songJob = await songRes.json();
  console.log('Mureka song job:', JSON.stringify(songJob));
  if (!songJob.id) throw new Error('Mureka task ID yok: ' + JSON.stringify(songJob));

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

  const { prompt: rawPrompt, style, title, email, language, vocal_gender } = req.body;
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
      const result = await murekaGenerate(prompt, title, language || 'Turkish', vocal_gender);
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
