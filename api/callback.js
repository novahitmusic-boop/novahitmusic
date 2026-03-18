export default async function handler(req, res) {
  // kie.ai callback - sadece 200 döndür
  return res.status(200).json({ ok: true });
}
