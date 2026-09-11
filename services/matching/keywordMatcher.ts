export type KeywordType = 'include' | 'exclude' | 'exact' | 'related';
export interface MonitorKeyword { id: string; keyword: string; type: KeywordType; }
export interface KeywordMatch { matched: boolean; keywordId?: string; matchedText?: string; relevanceScore: number; excludedBy?: string; }

export const normalizeForMatch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
const exactTerm = (text: string, term: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}\\p{N}])`, 'u').test(text);

export function matchKeywords(text: string, keywords: MonitorKeyword[]): KeywordMatch {
  const normalized = normalizeForMatch(text);
  const excluded = keywords.find(k => k.type === 'exclude' && normalized.includes(normalizeForMatch(k.keyword)));
  if (excluded) return { matched: false, relevanceScore: 0, excludedBy: excluded.keyword };
  const candidates = keywords.filter(k => k.type !== 'exclude').map(k => ({...k, term: normalizeForMatch(k.keyword)}));
  const exact = candidates.find(k => k.type === 'exact' && exactTerm(normalized, k.term));
  const included = exact ?? candidates.find(k => exactTerm(normalized, k.term));
  if (!included) return { matched: false, relevanceScore: 0 };
  const occurrences = normalized.split(included.term).length - 1;
  const base = included.type === 'exact' ? 0.86 : included.type === 'include' ? 0.72 : 0.64;
  return { matched: true, keywordId: included.id, matchedText: included.keyword, relevanceScore: Math.min(0.99, base + Math.min(occurrences, 4) * 0.03) };
}
