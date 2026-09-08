import { createReadClient } from '@/lib/supabase/server';
export const runtime='nodejs'; export const dynamic='force-dynamic';
type MonitorMention={id:string;created_at:string;relevance_score:number|null;matched_text:string|null;articles:{title:string;description:string|null;author:string|null;url:string;published_at:string|null;sources:{name:string;source_type:string}|null;sentiment_analysis:Array<{sentiment:string;score:number}>}|null};
type MonitorRow={id:string;project_id:string;name:string;status:string;created_at:string;monitor_keywords:Array<{keyword:string;type:string}>;mentions:MonitorMention[]};
export async function GET(){
 try{
  const db=createReadClient(); const now=new Date(); const today=new Date(now); today.setHours(0,0,0,0); const d7=new Date(now.getTime()-7*86400000); const d30=new Date(now.getTime()-30*86400000);
  const [todayCount,weekCount,monthCount,sourcesCount,sourceRows,projectsRows,monitorsCount,monitorRows,recent]=await Promise.all([
   db.from('mentions').select('*',{count:'exact',head:true}).gte('created_at',today.toISOString()),
   db.from('mentions').select('*',{count:'exact',head:true}).gte('created_at',d7.toISOString()),
   db.from('mentions').select('*',{count:'exact',head:true}).gte('created_at',d30.toISOString()),
   db.from('sources').select('*',{count:'exact',head:true}).eq('active',true),
   db.from('sources').select('id,name,domain,source_type,category,active,last_checked_at').eq('active',true).order('name'),
   db.from('projects').select('id,name,description,status,created_at').eq('status','active').order('created_at'),
   db.from('monitors').select('*',{count:'exact',head:true}).eq('status','active'),
   db.from('monitors').select('id,project_id,name,status,created_at,monitor_keywords(keyword,type),mentions(id,created_at,relevance_score,matched_text,articles(title,description,author,url,published_at,sources(name,source_type),sentiment_analysis(sentiment,score)))').eq('status','active').order('created_at',{ascending:false}),
   db.from('mentions').select('id,matched_text,relevance_score,created_at,articles(title,description,author,url,published_at,sources(name,source_type),sentiment_analysis(sentiment,score)),monitors!inner(id,name,project_id,status)').eq('monitors.status','active').order('created_at',{ascending:false}).limit(300)
  ]);
  const failure=[todayCount,weekCount,monthCount,sourcesCount,sourceRows,projectsRows,monitorsCount,monitorRows,recent].find(x=>x.error); if(failure?.error) throw failure.error;
  const monitors=((monitorRows.data??[]) as unknown as MonitorRow[]).map(row=>{
   const mentions=row.mentions??[];
   const within=(date:string,cutoff:Date)=>new Date(date)>=cutoff;
   const sourceCounts=new Map<string,number>(); const sentiment={positive:0,neutral:0,negative:0,unknown:0};
   const daily=Array.from({length:7},(_,index)=>{const day=new Date(today);day.setDate(today.getDate()-6+index);return {date:day.toISOString().slice(0,10),count:0}});
   for(const mention of mentions){const source=mention.articles?.sources?.name??'Fonte não identificada';sourceCounts.set(source,(sourceCounts.get(source)??0)+1);const value=mention.articles?.sentiment_analysis?.[0]?.sentiment??'unknown';sentiment[value as keyof typeof sentiment]=(sentiment[value as keyof typeof sentiment]??0)+1;const key=new Date(mention.created_at).toISOString().slice(0,10);const point=daily.find(item=>item.date===key);if(point)point.count++;}
   return {id:row.id,projectId:row.project_id,name:row.name,status:row.status,createdAt:row.created_at,keywords:row.monitor_keywords??[],metrics:{today:mentions.filter(item=>within(item.created_at,today)).length,week:mentions.filter(item=>within(item.created_at,d7)).length,month:mentions.filter(item=>within(item.created_at,d30)).length,total:mentions.length,averageRelevance:mentions.length?mentions.reduce((sum,item)=>sum+Number(item.relevance_score??0),0)/mentions.length:0},daily,sentiment,topSources:[...sourceCounts.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count).slice(0,5),recent:mentions.sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).slice(0,8)};
  });
  const projects=(projectsRows.data??[]).map(project=>({...project,monitorCount:monitors.filter(monitor=>monitor.projectId===project.id).length}));
  return Response.json({connected:true,metrics:{today:todayCount.count??0,week:weekCount.count??0,month:monthCount.count??0,sources:sourcesCount.count??0,monitors:monitorsCount.count??0},projects,sources:sourceRows.data??[],monitors,mentions:recent.data??[],updatedAt:now.toISOString()});
 }catch(error){console.error('[api/dashboard]',error);return Response.json({connected:false,metrics:{today:0,week:0,month:0,sources:0,monitors:0},projects:[],sources:[],monitors:[],mentions:[],error:'Banco ainda não conectado.'},{status:503});}
}
