import {createHash} from 'node:crypto';
import Parser from 'rss-parser';
import {createAdminClient} from '@/lib/supabase/server';
import {matchKeywords,type MonitorKeyword} from '@/services/matching/keywordMatcher';
import {sentimentProvider} from '@/services/analysis/sentimentProvider';
import type {CollectorResult} from '@/types/content';

type Monitor={id:string;monitor_keywords:MonitorKeyword[]};
type GoogleItem={title?:string;link?:string;guid?:string;contentSnippet?:string;content?:string;creator?:string;isoDate?:string;pubDate?:string};
const parser=new Parser();
const queryFor=(keywords:MonitorKeyword[])=>{
 const wanted=keywords.filter(item=>item.type!=='exclude').map(item=>item.keyword.trim()).filter(Boolean).slice(0,8);
 const excluded=keywords.filter(item=>item.type==='exclude').map(item=>item.keyword.trim()).filter(Boolean).slice(0,5);
 const positive=wanted.map(term=>term.includes(' ')?`"${term}"`:term).join(' OR ');
 return `${positive} ${excluded.map(term=>`-${term.includes(' ')?`"${term}"`:term}`).join(' ')}`.trim();
};

export async function collectGoogleNewsMonitors(options:{batch?:number;totalBatches?:number}={}):Promise<CollectorResult>{
 const db=createAdminClient(),result:CollectorResult={sourceId:'',found:0,inserted:0,duplicates:0,mentions:0,errors:[],durationMs:0};const started=Date.now();
 const {data:source,error:sourceError}=await db.from('sources').select('id,name').eq('domain','news.google.com').eq('active',true).maybeSingle();
 if(sourceError)throw sourceError;if(!source){result.errors.push('Fonte Google Notícias não cadastrada. Execute a migração 018.');return result}
 result.sourceId=source.id;
 const {data:monitorRows,error:monitorError}=await db.from('monitors').select('id,monitor_keywords(id,keyword,type)').eq('status','active');if(monitorError)throw monitorError;
 const total=Math.max(1,Math.min(8,options.totalBatches??1)),batch=Math.max(0,Math.min(total-1,options.batch??0));const monitors=(monitorRows??[]).filter((_,index)=>index%total===batch) as Monitor[];
 for(const monitor of monitors){const query=queryFor(monitor.monitor_keywords);if(!query)continue;
  try{const url=`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;const response=await fetch(url,{headers:{'User-Agent':'PulsoMediaBot/1.0','Accept':'application/rss+xml, application/xml, text/xml'},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error(`Google Notícias respondeu HTTP ${response.status}`);const feed=await parser.parseString(await response.text());
   for(const raw of (feed.items as GoogleItem[]).slice(0,50)){const title=String(raw.title??'').trim(),link=String(raw.link??raw.guid??'').trim(),description=String(raw.contentSnippet??raw.content??'').trim();if(!title||!/^https?:\/\//.test(link))continue;result.found++;const match=matchKeywords({title,description,content:description,publishedAt:raw.isoDate??raw.pubDate},monitor.monitor_keywords);if(!match.matched)continue;const publishedAt=new Date(raw.isoDate??raw.pubDate??Date.now()).toISOString(),hash=createHash('sha256').update(`google-news|${link}|${title}`).digest('hex');
    const {data:article,error:articleError}=await db.from('articles').upsert({source_id:source.id,external_id:String(raw.guid??link),title,description,content:description,author:raw.creator??null,url:link,canonical_url:link.split('#')[0],published_at:publishedAt,language:'pt-BR',category:'google-news',hash},{onConflict:'canonical_url',ignoreDuplicates:true}).select('id').maybeSingle();if(articleError){result.errors.push(articleError.message);continue}let articleId=article?.id as string|undefined;if(!articleId){result.duplicates++;const {data:existing}=await db.from('articles').select('id').eq('canonical_url',link.split('#')[0]).maybeSingle();articleId=existing?.id}else result.inserted++;if(!articleId)continue;
    const {data:sentiments}=await db.from('sentiment_analysis').select('id').eq('article_id',articleId).limit(1);if(!sentiments?.length){const analysis=await sentimentProvider.analyzeSentiment(`${title}\n${description}`);await db.from('sentiment_analysis').insert({article_id:articleId,sentiment:analysis.sentiment,score:analysis.score,confidence:analysis.confidence,provider:analysis.provider,model:analysis.model})}
    const {error:mentionError}=await db.from('mentions').upsert({monitor_id:monitor.id,article_id:articleId,keyword_id:match.keywordId,matched_text:match.matchedText,relevance_score:match.relevanceScore},{onConflict:'monitor_id,article_id,keyword_id',ignoreDuplicates:true});if(mentionError)result.errors.push(mentionError.message);else result.mentions++;
   }
  }catch(error){result.errors.push(error instanceof Error?error.message:'Falha no Google Notícias')}
 }
 result.durationMs=Date.now()-started;await db.from('collection_logs').insert({source_id:source.id,collector_type:'google_news',status:result.errors.length?'partial':'success',items_found:result.found,new_items:result.inserted,duplicates:result.duplicates,errors:result.errors,duration_ms:result.durationMs});await db.from('sources').update({last_checked_at:new Date().toISOString()}).eq('id',source.id);return result;
}
