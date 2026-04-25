async function fetchAndRenderPrices() {
  const grid = document.getElementById('pricesGrid');
  grid.innerHTML = `<div style="color:var(--muted);padding:2rem;grid-column:1/-1;text-align:center">
    <div style="font-size:1.5rem;margin-bottom:.5rem;animation:pulse 1.5s infinite">⬡</div>
    Loading Monad ecosystem prices...
  </div>`;

  // Known Monad mainnet PAIR addresses (not token CAs) — these are the actual trading pair contracts
  const MONAD_PAIRS = [
    '0x9a5B9E78FEdEcdbFe89e4d41Bd44eDCFBD5E4E4a', // MON/USDC
    '0x116e7d070f1888b81e1e0324f56d6746b2d7d8f1', // CHOG/WMON
    '0x212fde77a42d55f980d0a0304e7eebe1e999c60f', // YAKI/WMON
    '0x5a73f1ff9cad2dfa768ac681b6a74f6a60a4c62b', // CHOG/MON (LFJ)
  ];

  try {
    // Strategy 1: fetch by known pair addresses on monad chain
    const pairsUrl = `https://api.dexscreener.com/latest/dex/pairs/monad/${MONAD_PAIRS.join(',')}`;
    const r1 = await fetch(pairsUrl);
    const d1 = await r1.json();
    let pairs = (d1.pairs || []).filter(p => p && p.priceUsd);

    // Strategy 2: also search by name to catch more tokens
    const searches = ['CHOG monad', 'YAKI monad', 'MON USDC monad', 'shMON', 'DAK monad'];
    const searchResults = await Promise.all(
      searches.map(q =>
        fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`)
          .then(r => r.json())
          .catch(() => ({ pairs: [] }))
      )
    );

    // Merge all results, keep only monad chain, deduplicate by baseToken address
    const seen = new Set();
    for (const result of searchResults) {
      for (const p of (result.pairs || [])) {
        if (p.chainId !== 'monad') continue;
        const key = p.baseToken?.address?.toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        pairs.push(p);
      }
    }

    // Deduplicate pairs from strategy 1 too
    const finalPairs = [];
    const finalSeen = new Set();
    for (const p of pairs) {
      const key = p.baseToken?.address?.toLowerCase();
      if (!key || finalSeen.has(key)) continue;
      finalSeen.add(key);
      finalPairs.push(p);
    }

    allFetchedPairs = finalPairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));

    if (allFetchedPairs.length === 0) {
      grid.innerHTML = `<div style="color:var(--muted);padding:2rem;grid-column:1/-1;text-align:center">
        Monad mainnet data not indexed yet on DexScreener.<br>
        <span style="font-size:.78rem">Showing demo data below</span>
      </div>`;
      setTimeout(() => renderPrices('all'), 1500);
      return;
    }

    renderPricesFromData(allFetchedPairs);
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<div style="color:var(--red);padding:2rem;grid-column:1/-1">⚠️ Failed to load. Showing demo data.</div>`;
    setTimeout(() => renderPrices('all'), 1500);
  }
}
