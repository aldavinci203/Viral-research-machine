export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  try {
    const response = await fetch(decodeURIComponent(url), {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const text = await response.text();
    return res.status(200).send(text);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
