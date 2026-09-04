import { createHash } from 'node:crypto';
import Parser from 'rss-parser';
import { createAdminClient } from '@/lib/supabase/server';
import { matchKeywords, type MonitorKeyword } from '@/services/matching/keywordMatcher';
import type { CollectorResult, ContentCollector, NormalizedContent } from '@/types/content';

type RssSource = { id:string; name:string; rss_url:string; site_url:string|null; };
const parser = new Parser();
export class RssCollector implements ContentCollector<RssSource> {
  async collect(source:RssSource){ const response=await fetch(source.rss_url,{headers:{'User-Agent':'PulsoMediaBot/1.0 (+responsible RSS monitoring)','Accept':'application/rss+xml, application/xml, text/xml'},signal:AbortSignal.timeout(12000)}); if(!response.ok)throw new Error(`HTTP ${response.status} em ${source.name}`); const feed=await parser.parseString(await response.text()); return feed.items.slice(0,100).map(item=>this.normalize({...item,_source:source})).filter(item=>this.validate(item)); }
  normalize(raw:any):NormalizedContent { const source=raw._source as RssSource; const url=raw.link??raw.guid??''; return {source:source.name,sourceId:source.id,sourceType:'rss',externalId:String(raw.guid??url),title:String(raw.title??'Sem título'),description:String(raw.contentSnippet??raw.summary??''),content:String(raw.content??raw['content:encoded']??raw.contentSnippet??''),author:raw.creator??raw.author,url,canonicalUrl:url.split('#')[0],imageUrl:raw.enclosure?.url,publishedAt:new Date(raw.isoDate??raw.pubDate??Date.now()).toISOString(),metadata:{categories:raw.categories??[]}}; }
  validate(item:NormalizedContent){ return Boolean(item.title&&item.url&&/^https?:\/\//.test(item.url)); }
}
const hashContent=(item:NormalizedContent)=>createHash('sha256').update(`${item.title}|${item.content}`).digest('hex');

export async function collectActiveRssSources():Promise<CollectorResult[]> {
  const db=createAdminClient(); const {data:sources,error}=await db.from('sources').select('id,name,rss_url,site_url').eq('active',true).eq('source_type','rss').not('rss_url','is',null); if(error) throw error;
  const collector=new RssCollector(); const results:CollectorResult[]=[];
  for(const source of (sources??[]) as RssSource[]){ const started=Date.now(); const result:CollectorResult={sourceId:source.id,found:0,inserted:0,duplicates:0,mentions:0,errors:[],durationMs:0};
   try { const items=await collector.collect(source); result.found=items.length;
    for(const item of items){ const hash=hashContent(item); const {data:article,error:upsertError}=await db.from('articles').upsert({source_id:source.id,external_id:item.externalId,title:item.title,description:item.description,content:item.content,author:item.author,url:item.url,canonical_url:item.canonicalUrl,image_url:item.imageUrl,published_at:item.publishedAt,language:'pt-BR',hash},{onConflict:'canonical_url',ignoreDuplicates:true}).select('id').maybeSingle();
     if(upsertError){result.errors.push(upsertError.message);continue;} if(!article){result.duplicates++;continue;} result.inserted++;
     const {data:monitors}=await db.from('monitors').select('id,monitor_keywords(id,keyword,type)').eq('status','active');
     for(const monitor of monitors??[]){ const match=matchKeywords(`${item.title}\n${item.description}\n${item.content}`,monitor.monitor_keywords as MonitorKeyword[]); if(match.matched){ const {error:mentionError}=await db.from('mentions').upsert({monitor_id:monitor.id,article_id:article.id,keyword_id:match.keywordId,matched_text:match.matchedText,relevance_score:match.relevanceScore},{onConflict:'monitor_id,article_id,keyword_id',ignoreDuplicates:true}); if(!mentionError) result.mentions++; }}
    }
   }catch(e){result.errors.push(e instanceof Error?e.message:'Erro desconhecido');}
   result.durationMs=Date.now()-started; await db.from('collection_logs').insert({source_id:source.id,collector_type:'rss',status:result.errors.length?'partial':'success',items_found:result.found,new_items:result.inserted,duplicates:result.duplicates,errors:result.errors,duration_ms:result.durationMs}); await db.from('sources').update({last_checked_at:new Date().toISOString()}).eq('id',source.id); results.push(result);
  } return results;
}
