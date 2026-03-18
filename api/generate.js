export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, style, title } = req.body;

  if (!prompt || !style) {
    return res.status(400).json({ error: 'prompt ve style gerekli' });
  }

  try {
    const response = await fetch('https://api.kie.ai/api/v1/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        style,
        title: title || 'Novahit AI',
        customMode: true,
        instrumental: false,
        model: 'V4_5',
        callBackUrl: 'https://novahitmusic.vercel.app/api/callback',
      }),
    });

    const data = await response.json();

    console.log('kie.ai response:', JSON.stringify(data));

    if (!response.ok || data.code !== 200) {
      return res.status(200).json({ error: data.msg || data.message || ('kie.ai hata kodu: ' + data.code), raw: data });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
}
