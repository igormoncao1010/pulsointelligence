import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { sentimentProvider } from '@/services/analysis/sentimentProvider';
import { matchKeywords, type MonitorKeyword } from '@/services/matching/keywordMatcher';
import type { CollectorResult, NormalizedContent } from '@/types/content';

type ActiveMonitor = { id: string; name: string; monitor_keywords: MonitorKeyword[] };
type VideoMention = { articles: { external_id: string; title: string } | null };
type CommentItem = { id: string; snippet: { videoId: string; topLevelComment: { snippet: { textDisplay: string; textOriginal?: string; authorDisplayName: string; authorProfileImageUrl?: string; likeCount?: number; publishedAt: string; updatedAt?: string } }; totalReplyCount?: number } };
type Source = { id: string };

async function getSource(): Promise<Source> {
  const db = createAdminClient();
  const { data: existing, error } = await db.from('sources').select('id').eq('source_type', 'youtube_comment').limit(1).maybeSingle();
  if (error) throw error;
  if (existing) return existing as Source;
  const { data, error: insertError } = await db.from('sources').insert({ name: 'Comentários do YouTube', domain: 'youtube.com', source_type: 'youtube_comment', site_url: 'https://youtube.com', country: 'BR', category: 'Redes sociais', active: true, check_interval: 30 }).select('id').single();
  if (insertError) throw insertError;
  return data as Source;
}

async function fetchComments(videoId: string): Promise<NormalizedContent[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  const url = new URL('https://www.googleapis.com/youtube/v3/commentThreads');
  url.search = new URLSearchParams({ part: 'snippet', videoId, maxResults: '100', order: 'time', textFormat: 'plainText', key }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (response.status === 403) return [];
  if (!response.ok) throw new Error(`YouTube comentários ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const body = (await response.json()) as { items?: CommentItem[] };
  return (body.items ?? []).map((item) => {
    const snippet = item.snippet.topLevelComment.snippet;
    const text = (snippet.textOriginal || snippet.textDisplay || '').trim();
    const commentUrl = `https://www.youtube.com/watch?v=${item.snippet.videoId}&lc=${item.id}`;
    return { source: 'Comentários do YouTube', sourceType: 'youtube_comment' as const, externalId: item.id, title: text.length > 140 ? `${text.slice(0, 137)}...` : text || `Comentário de ${snippet.authorDisplayName}`, description: text, content: text, author: snippet.authorDisplayName, url: commentUrl, canonicalUrl: commentUrl, imageUrl: snippet.authorProfileImageUrl, publishedAt: snippet.publishedAt, metadata: { videoId: item.snippet.videoId, likes: snippet.likeCount ?? 0, replies: item.snippet.totalReplyCount ?? 0, updatedAt: snippet.updatedAt } };
  }).filter((item) => Boolean(item.content));
}

export async function collectYoutubeComments(options: { batch?: number; totalBatches?: number } = {}): Promise<CollectorResult[]> {
  if (!process.env.YOUTUBE_API_KEY) return [];
  const db = createAdminClient();
  const { data, error } = await db.from('monitors').select('id,name,monitor_keywords(id,keyword,type)').eq('status', 'active').order('created_at');
  if (error) throw error;
  const totalBatches = Math.max(1, Math.min(8, options.totalBatches ?? 1));
  const batch = Math.max(0, Math.min(totalBatches - 1, options.batch ?? 0));
  const monitors = ((data ?? []) as ActiveMonitor[]).filter((_, index) => index % totalBatches === batch);
  if (!monitors.length) return [];
  const source = await getSource();
  const results: CollectorResult[] = [];
  for (const monitor of monitors) {
    const started = Date.now();
    const result: CollectorResult = { sourceId: source.id, found: 0, inserted: 0, duplicates: 0, mentions: 0, errors: [], durationMs: 0 };
    try {
      const { data: rows, error: videosError } = await db.from('mentions').select('articles!inner(external_id,title,sources!inner(source_type))').eq('monitor_id', monitor.id).eq('articles.sources.source_type', 'youtube').order('created_at', { ascending: false }).limit(10);
      if (videosError) throw videosError;
      const videos = ((rows ?? []) as unknown as VideoMention[]).map((row) => row.articles).filter((item): item is NonNullable<VideoMention['articles']> => Boolean(item?.external_id));
      const uniqueVideos = [...new Map(videos.map((video) => [video.external_id, video])).values()];
      for (const video of uniqueVideos) {
        let comments: NormalizedContent[] = [];
        try { comments = await fetchComments(video.external_id); } catch (error) { result.errors.push(error instanceof Error ? error.message : 'Erro nos comentários'); continue; }
        result.found += comments.length;
        for (const item of comments) {
          const match = matchKeywords(item.content, monitor.monitor_keywords);
          if (!match.matched) continue;
          const hash = createHash('sha256').update(`youtube-comment|${item.externalId}`).digest('hex');
          const { data: inserted, error: articleError } = await db.from('articles').upsert({ source_id: source.id, external_id: item.externalId, title: item.title, description: item.description, content: item.content, author: item.author, url: item.url, canonical_url: item.canonicalUrl, image_url: item.imageUrl, published_at: item.publishedAt, language: 'pt-BR', category: 'Comentário do YouTube', hash }, { onConflict: 'canonical_url', ignoreDuplicates: true }).select('id').maybeSingle();
          if (articleError) { result.errors.push(articleError.message); continue; }
          let articleId = inserted?.id as string | undefined;
          if (!articleId) {
            result.duplicates++;
            const { data: existing } = await db.from('articles').select('id').eq('canonical_url', item.canonicalUrl).maybeSingle();
            articleId = existing?.id;
          } else result.inserted++;
          if (!articleId) continue;
          await db.from('youtube_comments').upsert({ comment_id: item.externalId, video_id: item.metadata.videoId, author_name: item.author, text: item.content, likes: item.metadata.likes, replies: item.metadata.replies, published_at: item.publishedAt, url: item.url, updated_at: new Date().toISOString() }, { onConflict: 'comment_id' });
          const { data: sentiments } = await db.from('sentiment_analysis').select('id').eq('article_id', articleId).limit(1);
          if (!sentiments?.length) { const analysis = await sentimentProvider.analyzeSentiment(item.content); await db.from('sentiment_analysis').insert({ article_id: articleId, sentiment: analysis.sentiment, score: analysis.score, confidence: analysis.confidence, provider: analysis.provider, model: analysis.model }); }
          const { error: mentionError } = await db.from('mentions').upsert({ monitor_id: monitor.id, article_id: articleId, keyword_id: match.keywordId, matched_text: match.matchedText, relevance_score: match.relevanceScore }, { onConflict: 'monitor_id,article_id,keyword_id', ignoreDuplicates: true });
          if (mentionError) result.errors.push(mentionError.message); else result.mentions++;
        }
      }
    } catch (error) { result.errors.push(error instanceof Error ? error.message : 'Erro desconhecido'); }
    result.durationMs = Date.now() - started;
    await db.from('collection_logs').insert({ source_id: source.id, collector_type: 'youtube_comment', status: result.errors.length ? 'partial' : 'success', items_found: result.found, new_items: result.inserted, duplicates: result.duplicates, errors: result.errors, duration_ms: result.durationMs });
    results.push(result);
  }
  await db.from('sources').update({ last_checked_at: new Date().toISOString() }).eq('id', source.id);
  return results;
}
