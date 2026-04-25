/**
 * 10kScope — AI Analyze Proxy
 * Vercel Serverless Function: /api/analyze
 *
 * Proxies Anthropic API calls server-side so the API key
 * is never exposed to the client.
 *
 * Set this in your Vercel project dashboard:
 *   Settings → Environment Variables → ANTHROPIC_API_KEY = your_key
 *
 * POST body (JSON):
 *   { tokenData: { ...DexScreener pair fields } }
 */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel environment variables' });
  }

  let tokenData;
  try {
    tokenData = req.body?.tokenData;
    if (!tokenData) throw new Error('Missing tokenData');
  } catch {
    return res.status(400).json({ error: 'Invalid request body. Expected { tokenData: {...} }' });
  }

  // Build a structured prompt from real DexScreener data
  const {
    name, symbol, address,
    priceUsd, priceChange,
    liquidity, volume,
    fdv, marketCap,
    pairCreatedAt, dexId,
    chainId, pairAddress,
    txns, pairCount,
  } = tokenData;

  const ageMs   = pairCreatedAt ? Date.now() - pairCreatedAt : null;
  const ageDays = ageMs ? Math.floor(ageMs / 86400000) : null;
  const liqUsd  = liquidity?.usd ?? 0;
  const volH24  = volume?.h24 ?? 0;
  const volH6   = volume?.h6 ?? 0;
  const volH1   = volume?.h1 ?? 0;
  const ch1h    = priceChange?.h1 ?? 0;
  const ch6h    = priceChange?.h6 ?? 0;
  const ch24h   = priceChange?.h24 ?? 0;
  const buys1h  = txns?.h1?.buys ?? 0;
  const sells1h = txns?.h1?.sells ?? 0;
  const buys24h = txns?.h24?.buys ?? 0;
  const sells24h= txns?.h24?.sells ?? 0;

  const prompt = `You are a professional crypto token analyst specializing in on-chain data and DeFi risk assessment. Analyze this token from real market data and give a concise, honest assessment.

TOKEN DATA:
- Name: ${name} ($${symbol})
- Contract: ${address}
- Chain: ${chainId || 'monad'}
- DEX: ${dexId || 'unknown'}
- Price: $${priceUsd}
- Price Change: 1h ${ch1h}% | 6h ${ch6h}% | 24h ${ch24h}%
- Liquidity (USD): $${liqUsd.toLocaleString()}
- Volume: 1h $${volH1?.toLocaleString()} | 6h $${volH6?.toLocaleString()} | 24h $${volH24?.toLocaleString()}
- FDV: $${fdv?.toLocaleString() ?? 'unknown'}
- Market Cap: $${marketCap?.toLocaleString() ?? 'unknown'}
- Pair Age: ${ageDays !== null ? ageDays + ' days' : 'unknown'}
- Pair Address: ${pairAddress}
- Buy/Sell (1h): ${buys1h} buys / ${sells1h} sells
- Buy/Sell (24h): ${buys24h} buys / ${sells24h} sells
- Total Pairs Found: ${pairCount || 1}

Write a 3–4 sentence analysis covering:
1. What this token appears to be based on its name/symbol and trading behavior
2. Liquidity and volume health (flag if low, healthy, or suspicious)
3. Buy/sell pressure and price action signals
4. Overall risk level and a practical takeaway for a trader

Be direct, specific, and use the actual numbers. Do not be generic. Do not add disclaimers at the end. Output plain text only — no markdown, no bullet points.`;

  try {
    const upstream = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type':         'application/json',
        'x-api-key':            apiKey,
        'anthropic-version':    '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-opus-4-5',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data?.error?.message || 'Anthropic API error' });
    }

    const text = data.content?.[0]?.text || '';
    return res.status(200).json({ analysis: text });

  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach Anthropic API', detail: err.message });
  }
};
