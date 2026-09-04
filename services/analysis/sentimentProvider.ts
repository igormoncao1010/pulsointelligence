export type Sentiment = 'positive' | 'neutral' | 'negative' | 'unknown';
export interface SentimentResult { sentiment: Sentiment; score: number; confidence: number; provider: string; model: string; }
export interface SentimentProvider { analyzeSentiment(text: string): Promise<SentimentResult>; }
const positive = ['avanço','crescimento','melhora','aprovação','vitória','positivo','sucesso','investimento'];
const negative = ['crise','queda','denúncia','investigação','fraude','morte','risco','negativo','problema'];
export class HeuristicSentimentProvider implements SentimentProvider {
  async analyzeSentiment(text: string): Promise<SentimentResult> { const t=text.toLocaleLowerCase('pt-BR'); const score=positive.filter(w=>t.includes(w)).length-negative.filter(w=>t.includes(w)).length; return {sentiment:score>0?'positive':score<0?'negative':'neutral',score:Math.max(-1,Math.min(1,score/3)),confidence:Math.min(.86,.52+Math.abs(score)*.09),provider:'internal',model:'heuristic-pt-v1'}; }
}
export const sentimentProvider: SentimentProvider = new HeuristicSentimentProvider();
