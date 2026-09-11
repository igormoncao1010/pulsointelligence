export type SourceType = 'rss' | 'news' | 'youtube' | 'youtube_comment' | 'bluesky' | 'mastodon' | 'lemmy' | 'nostr' | 'telegram' | 'reddit' | 'future';
export interface NormalizedContent {
  source: string; sourceId?: string; sourceType: SourceType; externalId: string;
  title: string; description: string; content: string; author?: string;
  url: string; canonicalUrl?: string; imageUrl?: string; publishedAt: string;
  metadata: Record<string, unknown>;
}
export interface CollectorResult { sourceId: string; found: number; inserted: number; duplicates: number; mentions: number; errors: string[]; durationMs: number; }
export interface ContentCollector<TInput = unknown> { collect(input: TInput): Promise<NormalizedContent[]>; normalize(input: unknown): NormalizedContent; validate(content: NormalizedContent): boolean; }
