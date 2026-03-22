export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { taskId } = req.query;

  if (!taskId) {
    return res.status(400).json({ error: 'taskId gerekli' });
  }

  // 2 deneme: geçici 5xx hatalarını emer
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        `https://api.kie.ai/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`,
        {
          headers: { 'Authorization': `Bearer ${process.env.KIE_API_KEY}` },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      // 5xx → 1 kez retry
      if (response.status >= 500 && attempt < 2) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({ error: data.msg || 'API hatası' });
      }

      return res.status(200).json(data);

    } catch (err) {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      return res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
  }
}
