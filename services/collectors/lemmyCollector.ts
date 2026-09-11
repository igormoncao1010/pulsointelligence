import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { sentimentProvider } from '@/services/analysis/sentimentProvider';
import { matchKeywords, type MonitorKeyword } from '@/services/matching/keywordMatcher';
import type { CollectorResult, NormalizedContent } from '@/types/content';

type Monitor = { id: string; name: string; monitor_keywords: MonitorKeyword[] };
type LemmyPostView = { post: { id: number; name: string; body?: string; url?: string; ap_id?: string; published?: string; published_at?: string; thumbnail_url?: string }; creator: { name: string; display_name?: string }; community?: { name: string }; counts?: { score?: number; comments?: number } };
type Source = { id: string };
const instances = () => (process.env.LEMMY_INSTANCES ?? 'lemmy.world,lemmy.ml').split(',').map((value) => value.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')).filter(Boolean).slice(0, 5);

async function source(): Promise<Source> {
  const db = createAdminClient(); const { data: found, error } = await db.from('sources').select('id').eq('source_type', 'lemmy').limit(1).maybeSingle();
  if (error) throw error; if (found) return found as Source;
  const { data, error: insertError } = await db.from('sources').insert({ name: 'Lemmy', domain: 'lemmy.world', source_type: 'lemmy', site_url: 'https://lemmy.world', country: 'BR', category: 'Redes sociais', active: true, check_interval: 30 }).select('id').single();
  if (insertError) throw insertError; return data as Source;
}

const normalize = (view: LemmyPostView, instance: string): NormalizedContent => {
  const body = view.post.body?.trim() ?? ''; const url = view.post.ap_id || `https://${instance}/post/${view.post.id}`; const author = view.creator.display_name || view.creator.name;
  return { source: `${author} · ${instance}`, sourceType: 'lemmy', externalId: url, title: view.post.name, description: body, content: `${view.post.name}\n${body}`, author, url, canonicalUrl: url, imageUrl: view.post.thumbnail_url, publishedAt: view.post.published_at || view.post.published || new Date().toISOString(), metadata: { instance, community: view.community?.name, score: view.counts?.score ?? 0, comments: view.counts?.comments ?? 0, externalUrl: view.post.url } };
};

async function search(instance: string, term: string): Promise<NormalizedContent[]> {
  const v3 = new URL(`https://${instance}/api/v3/search`); v3.search = new URLSearchParams({ q: term, type_: 'Posts', sort: 'New', listing_type: 'All', page: '1', limit: '20' }).toString();
  let response = await fetch(v3, { headers: { Accept: 'application/json', 'User-Agent': 'PulsoMediaBot/1.0' }, signal: AbortSignal.timeout(15_000) });
  if (response.ok) { const body = (await response.json()) as { posts?: LemmyPostView[] }; return (body.posts ?? []).map((item) => normalize(item, instance)); }
  const v4 = new URL(`https://${instance}/api/v4/post/list`); v4.search = new URLSearchParams({ search_term: term, sort: 'new', type_: 'all', limit: '20' }).toString();
  response = await fetch(v4, { headers: { Accept: 'application/json', 'User-Agent': 'PulsoMediaBot/1.0' }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${instance} respondeu HTTP ${response.status}`);
  const body = (await response.json()) as { items?: LemmyPostView[] }; return (body.items ?? []).map((item) => normalize(item, instance));
}

export async function collectLemmyMonitors(options: { batch?: number; totalBatches?: number } = {}): Promise<CollectorResult[]> {
  const db = createAdminClient(); const { data, error } = await db.from('monitors').select('id,name,monitor_keywords(id,keyword,type)').eq('status', 'active').order('created_at'); if (error) throw error;
  const total = Math.max(1, Math.min(8, options.totalBatches ?? 1)); const batch = Math.max(0, Math.min(total - 1, options.batch ?? 0)); const monitors = ((data ?? []) as Monitor[]).filter((_, index) => index % total === batch); if (!monitors.length) return [];
  const src = await source(); const results: CollectorResult[] = [];
  for (const monitor of monitors) {
    const started = Date.now(); const result: CollectorResult = { sourceId: src.id, found: 0, inserted: 0, duplicates: 0, mentions: 0, errors: [], durationMs: 0 };
    const terms = monitor.monitor_keywords.filter((item) => item.type !== 'exclude').map((item) => item.keyword.trim()).filter(Boolean).slice(0, 5);
    const settled = await Promise.allSettled(instances().flatMap((instance) => terms.map((term) => search(instance, term)))); const unique = new Map<string, NormalizedContent>();
    for (const item of settled) { if (item.status === 'rejected') result.errors.push(item.reason instanceof Error ? item.reason.message : 'Falha no Lemmy'); else for (const post of item.value) unique.set(post.externalId, post); }
    result.found = unique.size;
    for (const item of unique.values()) {
      const match = matchKeywords(item.content, monitor.monitor_keywords); if (!match.matched) continue; const hash = createHash('sha256').update(`lemmy|${item.externalId}`).digest('hex');
      const { data: inserted, error: articleError } = await db.from('articles').upsert({ source_id: src.id, external_id: item.externalId, title: item.title, description: item.description, content: item.content, author: item.author, url: item.url, canonical_url: item.canonicalUrl, image_url: item.imageUrl, published_at: item.publishedAt, language: 'pt-BR', category: 'Lemmy', hash }, { onConflict: 'canonical_url', ignoreDuplicates: true }).select('id').maybeSingle();
      if (articleError) { result.errors.push(articleError.message); continue; } let articleId = inserted?.id as string | undefined;
      if (!articleId) { result.duplicates++; const { data: existing } = await db.from('articles').select('id').eq('canonical_url', item.canonicalUrl).maybeSingle(); articleId = existing?.id; } else result.inserted++; if (!articleId) continue;
      const { data: sentiments } = await db.from('sentiment_analysis').select('id').eq('article_id', articleId).limit(1); if (!sentiments?.length) { const analysis = await sentimentProvider.analyzeSentiment(item.content); await db.from('sentiment_analysis').insert({ article_id: articleId, sentiment: analysis.sentiment, score: analysis.score, confidence: analysis.confidence, provider: analysis.provider, model: analysis.model }); }
      const { error: mentionError } = await db.from('mentions').upsert({ monitor_id: monitor.id, article_id: articleId, keyword_id: match.keywordId, matched_text: match.matchedText, relevance_score: match.relevanceScore }, { onConflict: 'monitor_id,article_id,keyword_id', ignoreDuplicates: true }); if (mentionError) result.errors.push(mentionError.message); else result.mentions++;
    }
    result.durationMs = Date.now() - started; await db.from('collection_logs').insert({ source_id: src.id, collector_type: 'lemmy', status: result.errors.length ? 'partial' : 'success', items_found: result.found, new_items: result.inserted, duplicates: result.duplicates, errors: result.errors, duration_ms: result.durationMs }); results.push(result);
  }
  await db.from('sources').update({ last_checked_at: new Date().toISOString() }).eq('id', src.id); return results;
}
