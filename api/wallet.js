/**
 * 10kScope — Wallet Proxy
 * Vercel Serverless Function: /api/wallet
 *
 * Proxies MonadScan (Etherscan V2, chain 143) requests server-side
 * so the API key is never exposed to the client.
 *
 * Set this in your Vercel project dashboard:
 *   Settings → Environment Variables → ETHERSCAN_API_KEY = your_key
 *
 * Supported query params:
 *   ?action=txlist|tokentx|tokennfttx
 *   &address=0x...
 */

const MONADSCAN_BASE = 'https://api.etherscan.io/v2/api';
const MONAD_CHAIN_ID = 143;

const ALLOWED_ACTIONS = new Set(['txlist', 'tokentx', 'tokennfttx']);

const DEFAULT_OFFSETS = {
  txlist:     15,
  tokentx:    50,
  tokennfttx: 20,
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET')    return res.status(405).json({ status: '0', message: 'Method not allowed' });

  const { action, address } = req.query;

  if (!ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ status: '0', message: 'Invalid action' });
  }

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return res.status(400).json({ status: '0', message: 'Invalid address' });
  }

  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ status: '0', message: 'ETHERSCAN_API_KEY not set in Vercel environment variables' });
  }

  const params = new URLSearchParams({
    chainid: MONAD_CHAIN_ID,
    module:  'account',
    action,
    address,
    sort:    'desc',
    offset:  DEFAULT_OFFSETS[action],
    page:    1,
    apikey:  apiKey,
  });

  try {
    const upstream = await fetch(`${MONADSCAN_BASE}?${params}`);
    const data     = await upstream.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ status: '0', message: 'Upstream fetch failed', detail: err.message });
  }
};
