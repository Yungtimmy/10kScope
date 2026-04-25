export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tokenData } = req.body || {};
  if (!tokenData) return res.status(400).json({ error: 'Missing tokenData' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set in Vercel env vars' });

  const prompt = `You are a crypto token analyst. Analyze this Monad ecosystem token and give a 2-3 sentence risk assessment. Be direct and concise — no headers or bullet points.

Token: ${tokenData.name} (${tokenData.symbol})
Address: ${tokenData.address}
Price: $${tokenData.priceUsd}
24h Change: ${tokenData.priceChange?.h24}%
Liquidity: $${tokenData.liquidity?.usd}
Volume 24h: $${tokenData.volume?.h24}
FDV: $${tokenData.fdv}
DEX: ${tokenData.dexId}
Pair count: ${tokenData.pairCount}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err.error?.message || 'Gemini API error' });
    }

    const data = await response.json();
    const analysis = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No analysis returned.';
    return res.status(200).json({ analysis });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
