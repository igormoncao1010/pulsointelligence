import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { sentimentProvider } from '@/services/analysis/sentimentProvider';
import { matchKeywords, type MonitorKeyword } from '@/services/matching/keywordMatcher';
import type { CollectorResult, NormalizedContent } from '@/types/content';

type BlueskyPost = {
  uri: string;
  cid: string;
  author: { did: string; handle: string; displayName?: string; avatar?: string };
  record: { text?: string; createdAt?: string; langs?: string[] };
  embed?: { images?: Array<{ thumb?: string; fullsize?: string; alt?: string }> };
  likeCount?: number;
  replyCount?: number;
  repostCount?: number;
  quoteCount?: number;
  indexedAt?: string;
};
type ActiveMonitor = { id: string; name: string; monitor_keywords: MonitorKeyword[] };
type BlueskySource = { id: string; name: string };

const postUrl = (post: BlueskyPost) => {
  const rkey = post.uri.split('/').at(-1) ?? post.cid;
  return `https://bsky.app/profile/${post.author.did}/post/${rkey}`;
};

const titleFor = (text: string, author: string) => {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) return `Publicação de ${author}`;
  return compact.length > 140 ? `${compact.slice(0, 137)}...` : compact;
};

const normalize = (post: BlueskyPost): NormalizedContent => {
  const text = post.record.text?.trim() ?? '';
  const url = postUrl(post);
  return {
    source: post.author.displayName || post.author.handle,
    sourceType: 'bluesky',
    externalId: post.uri,
    title: titleFor(text, post.author.displayName || post.author.handle),
    description: text,
    content: text,
    author: post.author.displayName || post.author.handle,
    url,
    canonicalUrl: url,
    imageUrl: post.embed?.images?.[0]?.thumb,
    publishedAt: post.record.createdAt || post.indexedAt || new Date().toISOString(),
    metadata: {
      uri: post.uri,
      cid: post.cid,
      did: post.author.did,
      handle: post.author.handle,
      likes: post.likeCount ?? 0,
      replies: post.replyCount ?? 0,
      reposts: post.repostCount ?? 0,
      quotes: post.quoteCount ?? 0,
    },
  };
};

const searchableTerms = (keywords: MonitorKeyword[]) => keywords
  .filter((item) => item.type !== 'exclude')
  .map((item) => item.keyword.trim())
  .filter(Boolean)
  .slice(0, 6);

async function searchPosts(term: string): Promise<NormalizedContent[]> {
  const url = new URL('https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts');
  url.search = new URLSearchParams({ q: term, limit: '25', sort: 'latest', lang: 'pt' }).toString();
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'PulsoMediaBot/1.0' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Bluesky API ${response.status}: ${(await response.text()).slice(0, 240)}`);
  const body = (await response.json()) as { posts?: BlueskyPost[] };
  return (body.posts ?? []).map(normalize).filter((item) => Boolean(item.externalId && item.content && item.url));
}

async function getBlueskySource(): Promise<BlueskySource> {
  const db = createAdminClient();
  const { data: existing, error: selectError } = await db.from('sources').select('id,name').eq('source_type', 'bluesky').limit(1).maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing as BlueskySource;
  const { data: created, error: insertError } = await db.from('sources').insert({
    name: 'Bluesky', domain: 'bsky.app', source_type: 'bluesky', site_url: 'https://bsky.app',
    country: 'BR', category: 'Redes sociais', active: true, check_interval: 30,
  }).select('id,name').single();
  if (insertError) throw insertError;
  return created as BlueskySource;
}

export async function collectBlueskyMonitors(
  options: { batch?: number; totalBatches?: number } = {},
): Promise<CollectorResult[]> {
  const db = createAdminClient();
  const { data, error } = await db.from('monitors').select('id,name,monitor_keywords(id,keyword,type)').eq('status', 'active').order('created_at');
  if (error) throw error;
  const totalBatches = Math.max(1, Math.min(8, options.totalBatches ?? 1));
  const batch = Math.max(0, Math.min(totalBatches - 1, options.batch ?? 0));
  const monitors = ((data ?? []) as ActiveMonitor[]).filter((_, index) => index % totalBatches === batch);
  if (!monitors.length) return [];

  const source = await getBlueskySource();
  const results: CollectorResult[] = [];
  for (const monitor of monitors) {
    const started = Date.now();
    const result: CollectorResult = { sourceId: source.id, found: 0, inserted: 0, duplicates: 0, mentions: 0, errors: [], durationMs: 0 };
    try {
      const terms = searchableTerms(monitor.monitor_keywords);
      if (!terms.length) throw new Error(`Monitoramento "${monitor.name}" não possui termos pesquisáveis`);
      const settled = await Promise.allSettled(terms.map(searchPosts));
      const unique = new Map<string, NormalizedContent>();
      for (const search of settled) {
        if (search.status === 'rejected') result.errors.push(search.reason instanceof Error ? search.reason.message : 'Falha na busca do Bluesky');
        else for (const item of search.value) unique.set(item.externalId, item);
      }
      const items = [...unique.values()];
      result.found = items.length;

      for (const item of items) {
        const match = matchKeywords(`${item.title}\n${item.content}`, monitor.monitor_keywords);
        if (!match.matched) continue;
        const hash = createHash('sha256').update(`bluesky|${item.externalId}`).digest('hex');
        const { data: insertedArticle, error: articleError } = await db.from('articles').upsert({
          source_id: source.id, external_id: item.externalId, title: item.title, description: item.description,
          content: item.content, author: item.author, url: item.url, canonical_url: item.canonicalUrl,
          image_url: item.imageUrl, published_at: item.publishedAt, language: 'pt-BR', category: 'Bluesky', hash,
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
    await db.from('collection_logs').insert({ source_id: source.id, collector_type: 'bluesky', status: result.errors.length ? 'partial' : 'success', items_found: result.found, new_items: result.inserted, duplicates: result.duplicates, errors: result.errors, duration_ms: result.durationMs });
    results.push(result);
  }
  await db.from('sources').update({ last_checked_at: new Date().toISOString() }).eq('id', source.id);
  return results;
}
