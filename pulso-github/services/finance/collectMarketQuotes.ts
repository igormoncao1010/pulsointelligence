import { createAdminClient } from '@/lib/supabase/server';
import { getBrapiQuotes, getCryptoQuotes } from './marketProviders';

type Asset = { id: string; symbol: string; asset_type: string };

export async function collectMarketQuotes() {
  const db = createAdminClient();
  const { data, error } = await db.from('financial_assets').select('id,symbol,asset_type').eq('active', true);
  if (error) throw error;
  const assets = (data ?? []) as Asset[];
  if (!assets.length) return { found: 0, stored: 0 };
  const [brapi, crypto] = await Promise.allSettled([
    getBrapiQuotes(assets.filter(asset => asset.asset_type !== 'crypto').map(asset => asset.symbol)),
    getCryptoQuotes(assets.filter(asset => asset.asset_type === 'crypto').map(asset => asset.symbol)),
  ]);
  const quotes = [brapi, crypto].flatMap(result => result.status === 'fulfilled' ? result.value : []);
  const ids = new Map(assets.map(asset => [asset.symbol.replace(/[-/]?(BRL|USD)$/i, '').toUpperCase(), asset.id]));
  const rows = quotes.flatMap(quote => {
    const assetId = ids.get(quote.symbol.replace(/[-/]?(BRL|USD)$/i, '').toUpperCase());
    return assetId ? [{ asset_id: assetId, price: quote.price, change_value: quote.change, change_percent: quote.changePercent, volume: quote.volume, market_cap: quote.marketCap, currency: quote.currency, provider: quote.provider, market_time: quote.marketTime }] : [];
  });
  if (rows.length) {
    const { error: insertError } = await db.from('financial_quotes').insert(rows);
    if (insertError) throw insertError;
  }
  return { found: quotes.length, stored: rows.length };
}
