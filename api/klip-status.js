// Klip üretim durumu sorgulama
// GET /api/klip-status?request_id=xxx&model=xxx

const FAL_KEY = process.env.FAL_API_KEY;

export default async function handler(req, res) {
  const { request_id, model } = req.query;
  if (!request_id || !model) return res.status(400).json({ error: 'request_id ve model gerekli' });

  try {
    const r = await fetch(`https://queue.fal.run/${model}/requests/${request_id}/status`, {
      headers: { 'Authorization': `Key ${FAL_KEY}` }
    });
    const data = await r.json();

    if (data.status === 'COMPLETED') {
      // Sonucu al
      const result = await fetch(`https://queue.fal.run/${model}/requests/${request_id}`, {
        headers: { 'Authorization': `Key ${FAL_KEY}` }
      });
      const output = await result.json();
      return res.json({ status: 'completed', video_url: output?.video?.url || output?.url });
    }

    return res.json({ status: data.status?.toLowerCase() || 'processing' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
