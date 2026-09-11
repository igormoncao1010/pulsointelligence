export type KeywordType = 'include' | 'exclude' | 'exact' | 'related';
export interface MonitorKeyword { id: string; keyword: string; type: KeywordType; }
export interface MatchDocument { title?: string | null; description?: string | null; content?: string | null; publishedAt?: string | null; }
export interface KeywordMatch { matched: boolean; keywordId?: string; matchedText?: string; relevanceScore: number; excludedBy?: string; }

export const normalizeForMatch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactTerm = (text: string, term: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(term)}(?=$|[^\\p{L}\\p{N}])`, 'gu');
const occurrences = (text: string, term: string) => [...text.matchAll(exactTerm(text, term))].length;
const asDocument = (input: string | MatchDocument) => typeof input === 'string'
  ? { title: '', description: '', content: input, publishedAt: null }
  : { title: input.title ?? '', description: input.description ?? '', content: input.content ?? '', publishedAt: input.publishedAt ?? null };

export function matchKeywords(input: string | MatchDocument, keywords: MonitorKeyword[]): KeywordMatch {
  const document = asDocument(input);
  const title = normalizeForMatch(document.title), description = normalizeForMatch(document.description), content = normalizeForMatch(document.content);
  const complete = `${title} ${description} ${content}`.trim();
  const excluded = keywords.find(keyword => keyword.type === 'exclude' && occurrences(complete, normalizeForMatch(keyword.keyword)) > 0);
  if (excluded) return { matched: false, relevanceScore: 0, excludedBy: excluded.keyword };
  const matches = keywords.filter(keyword => keyword.type !== 'exclude').flatMap(keyword => {
    const term = normalizeForMatch(keyword.keyword);if (!term) return [];
    const titleCount = occurrences(title, term), descriptionCount = occurrences(description, term), contentCount = occurrences(content, term), total = titleCount + descriptionCount + contentCount;
    if (!total) return [];
    const typeBase = keyword.type === 'exact' ? .50 : keyword.type === 'include' ? .40 : .30;
    const position = titleCount ? .25 : descriptionCount ? .14 : .07;
    return [{ keyword, score: typeBase + position + Math.min(.12, Math.max(0, total - 1) * .03) }];
  });
  if (!matches.length) return { matched: false, relevanceScore: 0 };
  const distinctBonus = Math.min(.10, Math.max(0, matches.length - 1) * .04);
  const age = document.publishedAt ? Date.now() - new Date(document.publishedAt).getTime() : Number.POSITIVE_INFINITY;
  const recencyBonus = age >= 0 && age <= 86400000 ? .05 : age <= 7 * 86400000 ? .025 : 0;
  const best = [...matches].sort((a,b) => b.score - a.score)[0];
  return { matched: true, keywordId: best.keyword.id, matchedText: best.keyword.keyword, relevanceScore: Math.min(.99, best.score + distinctBonus + recencyBonus) };
}

