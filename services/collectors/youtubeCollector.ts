import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { sentimentProvider } from '@/services/analysis/sentimentProvider';
import { matchKeywords, type MonitorKeyword } from '@/services/matching/keywordMatcher';
import type { CollectorResult, ContentCollector, NormalizedContent } from '@/types/content';

type YoutubeSearchItem = {
  id: { videoId?: string };
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    channelId: string;
    channelTitle: string;
    thumbnails?: { high?: { url: string }; default?: { url: string } };
  };
};
type ActiveMonitor = { id: string; name: string; monitor_keywords: MonitorKeyword[] };
type YoutubeSource = { id: string; name: string };

export class YoutubeCollector implements ContentCollector<string> {
  async collect(query: string) {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) throw new Error('YOUTUBE_API_KEY não configurada');
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.search = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      maxResults: '25',
      order: 'date',
      relevanceLanguage: 'pt',
      regionCode: 'BR',
      publishedAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      q: query,
      key,
    }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`YouTube API ${response.status}: ${detail.slice(0, 240)}`);
    }
    const body = (await response.json()) as { items?: YoutubeSearchItem[] };
    return (body.items ?? []).map((item) => this.normalize(item)).filter((item) => this.validate(item));
  }

  normalize(raw: unknown): NormalizedContent {
    const item = raw as YoutubeSearchItem;
    const id = item.id.videoId ?? '';
    const url = `https://www.youtube.com/watch?v=${id}`;
    return {
      source: item.snippet.channelTitle,
      sourceType: 'youtube',
      externalId: id,
      title: item.snippet.title,
      description: item.snippet.description,
      content: item.snippet.description,
      author: item.snippet.channelTitle,
      url,
      canonicalUrl: url,
      imageUrl: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.default?.url,
      publishedAt: item.snippet.publishedAt,
      metadata: { channelId: item.snippet.channelId },
    };
  }

  validate(content: NormalizedContent) {
    return Boolean(content.externalId && content.title && content.url);
  }
}

const contentHash = (item: NormalizedContent) =>
  createHash('sha256').update(`youtube|${item.externalId}`).digest('hex');

const searchQueryFor = (keywords: MonitorKeyword[]) => {
  const positive = keywords
    .filter((item) => item.type !== 'exclude')
    .map((item) => item.keyword.trim())
    .filter(Boolean)
    .slice(0, 8);
  const excluded = keywords
    .filter((item) => item.type === 'exclude')
    .map((item) => `-${item.keyword.trim()}`)
    .filter((item) => item !== '-');
  const alternatives = positive.map((term) => (term.includes(' ') ? `"${term}"` : term)).join('|');
  return [alternatives, ...excluded].filter(Boolean).join(' ').slice(0, 450);
};

async function getYoutubeSource(): Promise<YoutubeSource> {
  const db = createAdminClient();
  const { data: existing, error: selectError } = await db
    .from('sources')
    .select('id,name')
    .eq('source_type', 'youtube')
    .limit(1)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing as YoutubeSource;

  const { data: created, error: insertError } = await db
    .from('sources')
    .insert({ name: 'YouTube', domain: 'youtube.com', source_type: 'youtube', site_url: 'https://www.youtube.com', country: 'BR', category: 'Redes sociais', active: true, check_interval: 30 })
    .select('id,name')
    .single();
  if (insertError) throw insertError;
  return created as YoutubeSource;
}

export async function collectYoutubeMonitors(
  options: { batch?: number; totalBatches?: number } = {},
): Promise<CollectorResult[]> {
  if (!process.env.YOUTUBE_API_KEY) return [];
  const db = createAdminClient();
  const { data, error } = await db.from('monitors').select('id,name,monitor_keywords(id,keyword,type)').eq('status', 'active').order('created_at');
  if (error) throw error;

  const totalBatches = Math.max(1, Math.min(8, options.totalBatches ?? 1));
  const batch = Math.max(0, Math.min(totalBatches - 1, options.batch ?? 0));
  const monitors = ((data ?? []) as ActiveMonitor[]).filter((_, index) => index % totalBatches === batch);
  if (!monitors.length) return [];

  const source = await getYoutubeSource();
  const collector = new YoutubeCollector();
  const results: CollectorResult[] = [];
  for (const monitor of monitors) {
    const started = Date.now();
    const result: CollectorResult = { sourceId: source.id, found: 0, inserted: 0, duplicates: 0, mentions: 0, errors: [], durationMs: 0 };
    try {
      const query = searchQueryFor(monitor.monitor_keywords);
      if (!query) throw new Error(`Monitoramento "${monitor.name}" não possui termos pesquisáveis`);
      const items = await collector.collect(query);
      result.found = items.length;

      for (const item of items) {
        const match = matchKeywords({ title:item.title, description:item.description, content:item.content, publishedAt:item.publishedAt }, monitor.monitor_keywords);
        if (!match.matched) continue;
        const { data: insertedArticle, error: articleError } = await db.from('articles').upsert({
          source_id: source.id, external_id: item.externalId, title: item.title, description: item.description,
          content: item.content, author: item.author, url: item.url, canonical_url: item.canonicalUrl,
          image_url: item.imageUrl, published_at: item.publishedAt, language: 'pt-BR', category: 'YouTube', hash: contentHash(item),
        }, { onConflict: 'canonical_url', ignoreDuplicates: true }).select('id').maybeSingle();
        if (articleError) { result.errors.push(articleError.message); continue; }

        let articleId = insertedArticle?.id as string | undefined;
        if (!articleId) {
          result.duplicates++;
          const { data: existing, error: existingError } = await db.from('articles').select('id').eq('canonical_url', item.canonicalUrl).maybeSingle();
          if (existingError || !existing) { if (existingError) result.errors.push(existingError.message); continue; }
          articleId = existing.id;
        } else result.inserted++;

        const { error: videoError } = await db.from('youtube_videos').upsert({
          source_id: source.id, video_id: item.externalId, channel_id: item.metadata.channelId,
          channel_name: item.author, title: item.title, description: item.description, thumbnail: item.imageUrl,
          published_at: item.publishedAt, url: item.url, updated_at: new Date().toISOString(),
        }, { onConflict: 'video_id' });
        if (videoError) result.errors.push(videoError.message);

        const { data: sentimentRows } = await db.from('sentiment_analysis').select('id').eq('article_id', articleId).limit(1);
        if (!sentimentRows?.length) {
          const analysis = await sentimentProvider.analyzeSentiment(`${item.title}\n${item.description}`);
          const { error: sentimentError } = await db.from('sentiment_analysis').insert({ article_id: articleId, sentiment: analysis.sentiment, score: analysis.score, confidence: analysis.confidence, provider: analysis.provider, model: analysis.model });
          if (sentimentError) result.errors.push(sentimentError.message);
        }

        const { error: mentionError } = await db.from('mentions').upsert({ monitor_id: monitor.id, article_id: articleId, keyword_id: match.keywordId, matched_text: match.matchedText, relevance_score: match.relevanceScore }, { onConflict: 'monitor_id,article_id,keyword_id', ignoreDuplicates: true });
        if (mentionError) result.errors.push(mentionError.message); else result.mentions++;
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Erro desconhecido');
    }
    result.durationMs = Date.now() - started;
    await db.from('collection_logs').insert({ source_id: source.id, collector_type: 'youtube', status: result.errors.length ? 'partial' : 'success', items_found: result.found, new_items: result.inserted, duplicates: result.duplicates, errors: result.errors, duration_ms: result.durationMs });
    results.push(result);
  }
  await db.from('sources').update({ last_checked_at: new Date().toISOString() }).eq('id', source.id);
  return results;
}
