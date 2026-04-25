export default async function handler(req, res) {
  const { action, address } = req.query;
  if (!action || !address) return res.status(400).json({ error: 'Missing params' });

  const apiKey = process.env.MONADSCAN_API_KEY || '';
  const url = `https://api.monadscan.com/api?module=account&action=${action}&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`;

  try {
    const r = await fetch(url);
    const data = await r.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ status: '0', message: err.message, result: [] });
  }
}
