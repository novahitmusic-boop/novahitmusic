const MUREKA_KEY = process.env.MUREKA_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { taskId, provider } = req.query;
  if (!taskId) return res.status(400).json({ error: 'taskId gerekli' });

  // ── Mureka polling ────────────────────────────────────────────────────
  if (provider === 'mureka' && MUREKA_KEY) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 15000);
      const r = await fetch(`https://api.mureka.ai/v1/song/query/${encodeURIComponent(taskId)}`, {
        headers: { 'Authorization': `Bearer ${MUREKA_KEY}` },
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      const data = await r.json();

      if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'Mureka API hatası' });

      // Normalize → frontend'in beklediği formata çevir
      if (data.status === 'succeeded' && data.songs?.length > 0) {
        const audioList = data.songs.map(s => ({
          audioUrl: s.mp3_url,
          title: s.title,
          songName: s.title,
          cover: s.cover,
          duration: s.duration_milliseconds,
        }));
        return res.status(200).json({
          data: { response: { sunoData: audioList }, status: 'SUCCESS' }
        });
      }

      if (data.status === 'failed') {
        return res.status(200).json({ data: { status: 'FAILED', response: null } });
      }

      // Hâlâ işleniyor
      return res.status(200).json({ data: { status: data.status || 'PENDING', response: null } });

    } catch (err) {
      return res.status(500).json({ error: 'Mureka status hatası: ' + err.message });
    }
  }

  // ── kie.ai polling ────────────────────────────────────────────────────
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 15000);
      const r = await fetch(
        `https://api.kie.ai/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`,
        { headers: { 'Authorization': `Bearer ${process.env.KIE_API_KEY}` }, signal: ctrl.signal }
      );
      clearTimeout(tid);

      if (r.status >= 500 && attempt < 2) {
        await new Promise(x => setTimeout(x, 1500)); continue;
      }

      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data.msg || 'API hatası' });
      return res.status(200).json(data);

    } catch (err) {
      if (attempt < 2) { await new Promise(x => setTimeout(x, 1500)); continue; }
      return res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
  }
}
