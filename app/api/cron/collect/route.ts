import { collectActiveRssSources } from '@/services/collectors/rssCollector';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export async function GET(request:Request){ const secret=process.env.CRON_SECRET; const auth=request.headers.get('authorization'); if(!secret||auth!==`Bearer ${secret}`) return Response.json({error:'Não autorizado'},{status:401}); try{const results=await collectActiveRssSources();return Response.json({ok:true,executedAt:new Date().toISOString(),results});}catch(error){console.error('[cron/collect]',error);return Response.json({ok:false,error:error instanceof Error?error.message:'Falha na coleta'},{status:500});} }
export const POST=GET;
