import { createReadClient } from '@/lib/supabase/server';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export async function GET(){
 try{
  const db=createReadClient(); const now=new Date(); const today=new Date(now); today.setHours(0,0,0,0); const d7=new Date(now.getTime()-7*86400000); const d30=new Date(now.getTime()-30*86400000);
  const [todayCount,weekCount,monthCount,sourcesCount,sourceRows,monitorsCount,recent]=await Promise.all([
   db.from('mentions').select('*',{count:'exact',head:true}).gte('created_at',today.toISOString()),
   db.from('mentions').select('*',{count:'exact',head:true}).gte('created_at',d7.toISOString()),
   db.from('mentions').select('*',{count:'exact',head:true}).gte('created_at',d30.toISOString()),
   db.from('sources').select('*',{count:'exact',head:true}).eq('active',true),
   db.from('sources').select('id,name,domain,source_type,category,active,last_checked_at').order('name'),
   db.from('monitors').select('*',{count:'exact',head:true}).eq('status','active'),
   db.from('mentions').select('id,matched_text,relevance_score,created_at,articles(title,description,url,published_at,sources(name)),monitors(name)').order('created_at',{ascending:false}).limit(8)
  ]);
  const failure=[todayCount,weekCount,monthCount,sourcesCount,sourceRows,monitorsCount,recent].find(x=>x.error); if(failure?.error) throw failure.error;
  return Response.json({connected:true,metrics:{today:todayCount.count??0,week:weekCount.count??0,month:monthCount.count??0,sources:sourcesCount.count??0,monitors:monitorsCount.count??0},sources:sourceRows.data??[],mentions:recent.data??[],updatedAt:now.toISOString()});
 }catch(error){console.error('[api/dashboard]',error);return Response.json({connected:false,metrics:{today:0,week:0,month:0,sources:0,monitors:0},sources:[],mentions:[],error:'Banco ainda não conectado.'},{status:503});}
}
