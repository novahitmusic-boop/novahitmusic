// Ses klonlama durum sorgulama
// GET /api/voice-status?prediction_id=xxx

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;

export default async function handler(req, res) {
  const { prediction_id } = req.query;
  if (!prediction_id) return res.status(400).json({ error: 'prediction_id gerekli' });

  try {
    const r = await fetch(`https://api.replicate.com/v1/predictions/${prediction_id}`, {
      headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}` }
    });
    const data = await r.json();

    if (data.status === 'succeeded') {
      return res.json({ status: 'completed', audio_url: data.output });
    }
    if (data.status === 'failed') {
      return res.json({ status: 'failed', error: data.error });
    }
    return res.json({ status: data.status });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
