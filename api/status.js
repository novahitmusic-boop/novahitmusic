export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { taskId } = req.query;

  if (!taskId) {
    return res.status(400).json({ error: 'taskId gerekli' });
  }

  try {
    const response = await fetch(
      `https://api.kie.ai/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
        },
      }
    );

    const data = await response.json();

    console.log('kie.ai status response:', JSON.stringify(data));

    if (!response.ok) {
      return res.status(response.status).json({ error: data.msg || 'API hatası' });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
}
