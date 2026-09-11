import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { sentimentProvider } from '@/services/analysis/sentimentProvider';
import { matchKeywords, type MonitorKeyword } from '@/services/matching/keywordMatcher';
import type { CollectorResult, NormalizedContent } from '@/types/content';

type MastodonStatus = {
  id: string;
  uri: string;
  url: string | null;
  created_at: string;
  content: string;
  language?: string | null;
  account: { acct: string; display_name: string; avatar?: string };
  media_attachments?: Array<{ preview_url?: string; url?: string; description?: string }>;
  favourites_count?: number;
  reblogs_count?: number;
  replies_count?: number;
  reblog?: MastodonStatus | null;
};
type ActiveMonitor = { id: string; name: string; monitor_keywords: MonitorKeyword[] };
type MastodonSource = { id: string; name: string };

const instances = () => (process.env.MASTODON_INSTANCES ?? 'mastodon.social,mastodon.online')
  .split(',').map((item) => item.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')).filter(Boolean).slice(0, 5);

const decodeHtml = (value: string) => value
  .replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+\n/g, '\n').replace(/[ \t]+/g, ' ').trim();

const titleFor = (text: string, author: string) => {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) return `Publicação de ${author}`;
  return compact.length > 140 ? `${compact.slice(0, 137)}...` : compact;
};

const normalize = (raw: MastodonStatus, instance: string): NormalizedContent => {
  const status = raw.reblog ?? raw;
  const text = decodeHtml(status.content);
  const author = status.account.display_name || status.account.acct;
  const url = status.url || status.uri;
  return {
    source: `${author} · ${instance}`,
    sourceType: 'mastodon',
    externalId: status.uri || `${instance}:${status.id}`,
    title: titleFor(text, author),
    description: text,
    content: text,
    author,
    url,
    canonicalUrl: url,
    imageUrl: status.media_attachments?.[0]?.preview_url,
    publishedAt: status.created_at,
    metadata: {
      instance, account: status.account.acct, uri: status.uri,
      favourites: status.favourites_count ?? 0, boosts: status.reblogs_count ?? 0,
      replies: status.replies_count ?? 0,
    },
  };
};

const hashtagFor = (term: string) => term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_]/g, '');

async function fetchTimeline(instance: string, hashtag?: string): Promise<NormalizedContent[]> {
  const path = hashtag ? `/api/v1/timelines/tag/${encodeURIComponent(hashtag)}` : '/api/v1/timelines/public';
  const url = new URL(`https://${instance}${path}`);
  url.search = new URLSearchParams({ limit: '40' }).toString();
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'PulsoMediaBot/1.0' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${instance} respondeu HTTP ${response.status}`);
  const body = (await response.json()) as MastodonStatus[];
  return body.map((item) => normalize(item, instance)).filter((item) => Boolean(item.externalId && item.content && item.url));
}

async function getMastodonSource(): Promise<MastodonSource> {
  const db = createAdminClient();
  const { data: existing, error: selectError } = await db.from('sources').select('id,name').eq('source_type', 'mastodon').limit(1).maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing as MastodonSource;
  const { data: created, error: insertError } = await db.from('sources').insert({
    name: 'Mastodon / Fediverso', domain: 'mastodon.social', source_type: 'mastodon', site_url: 'https://mastodon.social',
    country: 'BR', category: 'Redes sociais', active: true, check_interval: 30,
  }).select('id,name').single();
  if (insertError) throw insertError;
  return created as MastodonSource;
}

export async function collectMastodonMonitors(
  options: { batch?: number; totalBatches?: number } = {},
): Promise<CollectorResult[]> {
  const db = createAdminClient();
  const { data, error } = await db.from('monitors').select('id,name,monitor_keywords(id,keyword,type)').eq('status', 'active').order('created_at');
  if (error) throw error;
  const totalBatches = Math.max(1, Math.min(8, options.totalBatches ?? 1));
  const batch = Math.max(0, Math.min(totalBatches - 1, options.batch ?? 0));
  const monitors = ((data ?? []) as ActiveMonitor[]).filter((_, index) => index % totalBatches === batch);
  if (!monitors.length) return [];
  const source = await getMastodonSource();
  const results: CollectorResult[] = [];

  for (const monitor of monitors) {
    const started = Date.now();
    const result: CollectorResult = { sourceId: source.id, found: 0, inserted: 0, duplicates: 0, mentions: 0, errors: [], durationMs: 0 };
    try {
      const terms = monitor.monitor_keywords.filter((item) => item.type !== 'exclude').map((item) => item.keyword.trim()).filter(Boolean).slice(0, 5);
      if (!terms.length) throw new Error(`Monitoramento "${monitor.name}" não possui termos pesquisáveis`);
      const requests: Array<Promise<NormalizedContent[]>> = [];
      for (const instance of instances()) {
        requests.push(fetchTimeline(instance));
        for (const term of terms) {
          const hashtag = hashtagFor(term);
          if (hashtag.length >= 2) requests.push(fetchTimeline(instance, hashtag));
        }
      }
      const settled = await Promise.allSettled(requests);
      const unique = new Map<string, NormalizedContent>();
      for (const request of settled) {
        if (request.status === 'rejected') result.errors.push(request.reason instanceof Error ? request.reason.message : 'Falha na consulta ao Mastodon');
        else for (const item of request.value) unique.set(item.externalId, item);
      }
      const items = [...unique.values()];
      result.found = items.length;
      for (const item of items) {
        const match = matchKeywords(`${item.title}\n${item.content}`, monitor.monitor_keywords);
        if (!match.matched) continue;
        const hash = createHash('sha256').update(`mastodon|${item.externalId}`).digest('hex');
        const { data: insertedArticle, error: articleError } = await db.from('articles').upsert({
          source_id: source.id, external_id: item.externalId, title: item.title, description: item.description,
          content: item.content, author: item.author, url: item.url, canonical_url: item.canonicalUrl,
          image_url: item.imageUrl, published_at: item.publishedAt, language: 'pt-BR', category: 'Mastodon', hash,
        }, { onConflict: 'canonical_url', ignoreDuplicates: true }).select('id').maybeSingle();
        if (articleError) { result.errors.push(articleError.message); continue; }
        let articleId = insertedArticle?.id as string | undefined;
        if (!articleId) {
          result.duplicates++;
          const { data: existing, error: existingError } = await db.from('articles').select('id').eq('canonical_url', item.canonicalUrl).maybeSingle();
          if (existingError || !existing) { if (existingError) result.errors.push(existingError.message); continue; }
          articleId = existing.id;
        } else result.inserted++;
        const { data: sentimentRows } = await db.from('sentiment_analysis').select('id').eq('article_id', articleId).limit(1);
        if (!sentimentRows?.length) {
          const analysis = await sentimentProvider.analyzeSentiment(item.content);
          const { error: sentimentError } = await db.from('sentiment_analysis').insert({ article_id: articleId, sentiment: analysis.sentiment, score: analysis.score, confidence: analysis.confidence, provider: analysis.provider, model: analysis.model });
          if (sentimentError) result.errors.push(sentimentError.message);
        }
        const { error: mentionError } = await db.from('mentions').upsert({
          monitor_id: monitor.id, article_id: articleId, keyword_id: match.keywordId,
          matched_text: match.matchedText, relevance_score: match.relevanceScore,
        }, { onConflict: 'monitor_id,article_id,keyword_id', ignoreDuplicates: true });
        if (mentionError) result.errors.push(mentionError.message); else result.mentions++;
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Erro desconhecido');
    }
    result.durationMs = Date.now() - started;
    await db.from('collection_logs').insert({ source_id: source.id, collector_type: 'mastodon', status: result.errors.length ? 'partial' : 'success', items_found: result.found, new_items: result.inserted, duplicates: result.duplicates, errors: result.errors, duration_ms: result.durationMs });
    results.push(result);
  }
  await db.from('sources').update({ last_checked_at: new Date().toISOString() }).eq('id', source.id);
  return results;
}
