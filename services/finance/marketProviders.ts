type MarketQuote = {
  symbol: string;
  name: string | null;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  marketCap: number | null;
  currency: string;
  marketTime: string | null;
  provider: string;
};

export type EconomicIndicator = {
  key: string;
  name: string;
  value: number | null;
  unit: string;
  referenceDate: string | null;
  provider: string;
};

const cryptoIds: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin', XRP: 'ripple',
  ADA: 'cardano', DOGE: 'dogecoin', AVAX: 'avalanche-2', DOT: 'polkadot', LINK: 'chainlink',
  LTC: 'litecoin', BCH: 'bitcoin-cash', USDT: 'tether', USDC: 'usd-coin', SHIB: 'shiba-inu',
};

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(15000) });
  const payload = await response.json() as T & { error?: string; message?: string };
  if (!response.ok) throw new Error(payload.message ?? payload.error ?? `HTTP ${response.status}`);
  return payload;
};

export async function getBrapiQuotes(symbols: string[]): Promise<MarketQuote[]> {
  if (!symbols.length) return [];
  const headers: Record<string, string> = { accept: 'application/json' };
  if (process.env.BRAPI_TOKEN) headers.authorization = `Bearer ${process.env.BRAPI_TOKEN}`;
  type Raw = { symbol?: string; requestedSymbol?: string; shortName?: string; longName?: string; regularMarketPrice?: number; regularMarketChange?: number; regularMarketChangePercent?: number; regularMarketVolume?: number; marketCap?: number; currency?: string; regularMarketTime?: string; data?: Raw };
  const payload = await fetchJson<{ results?: Raw[] }>(`https://brapi.dev/api/v2/stocks/quote?symbols=${encodeURIComponent(symbols.join(','))}`, { headers });
  return (payload.results ?? []).map(raw => {
    const item = raw.data ?? raw;
    return { symbol: item.symbol ?? raw.requestedSymbol ?? '', name: item.shortName ?? item.longName ?? null, price: item.regularMarketPrice ?? null, change: item.regularMarketChange ?? null, changePercent: item.regularMarketChangePercent ?? null, volume: item.regularMarketVolume ?? null, marketCap: item.marketCap ?? null, currency: item.currency ?? 'BRL', marketTime: item.regularMarketTime ?? null, provider: 'brapi.dev' };
  });
}

export async function getCryptoQuotes(symbols: string[]): Promise<MarketQuote[]> {
  const selected = [...new Set(symbols.map(symbol => symbol.replace(/[-/]?(BRL|USD)$/i, '').toUpperCase()))];
  const pairs = selected.map(symbol => [symbol, cryptoIds[symbol]] as const).filter((pair): pair is readonly [string, string] => Boolean(pair[1]));
  if (!pairs.length) return [];
  const key = process.env.COINGECKO_API_KEY;
  const headers: Record<string, string> = { accept: 'application/json' };
  if (key) headers['x-cg-demo-api-key'] = key;
  type Coin = { id: string; symbol: string; name: string; current_price: number | null; price_change_24h: number | null; price_change_percentage_24h: number | null; total_volume: number | null; market_cap: number | null; last_updated: string | null };
  const coins = await fetchJson<Coin[]>(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=brl&ids=${encodeURIComponent(pairs.map(([, id]) => id).join(','))}&price_change_percentage=24h`, { headers });
  const requested = new Map(pairs.map(([symbol, id]) => [id, symbol]));
  return coins.map(coin => ({ symbol: requested.get(coin.id) ?? coin.symbol.toUpperCase(), name: coin.name, price: coin.current_price, change: coin.price_change_24h, changePercent: coin.price_change_percentage_24h, volume: coin.total_volume, marketCap: coin.market_cap, currency: 'BRL', marketTime: coin.last_updated, provider: 'CoinGecko' }));
}

const bcbSeries = [
  { key: 'selic', name: 'Selic meta', code: 432, unit: '% a.a.' },
  { key: 'cdi', name: 'CDI', code: 12, unit: '% a.d.' },
  { key: 'ipca', name: 'IPCA', code: 433, unit: '% a.m.' },
  { key: 'usd', name: 'Dólar comercial', code: 1, unit: 'R$' },
] as const;

export async function getEconomicIndicators(): Promise<EconomicIndicator[]> {
  return Promise.all(bcbSeries.map(async series => {
    try {
      const values = await fetchJson<Array<{ data: string; valor: string }>>(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${series.code}/dados/ultimos/1?formato=json`);
      const latest = values.at(-1);
      return { key: series.key, name: series.name, value: latest ? Number(latest.valor.replace(',', '.')) : null, unit: series.unit, referenceDate: latest?.data ?? null, provider: 'Banco Central do Brasil' };
    } catch {
      return { key: series.key, name: series.name, value: null, unit: series.unit, referenceDate: null, provider: 'Banco Central do Brasil' };
    }
  }));
}

