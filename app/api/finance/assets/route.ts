import { createAdminClient } from '@/lib/supabase/server';
import { getBrapiQuotes, getCryptoQuotes, getEconomicIndicators } from '@/services/finance/marketProviders';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type Asset={id:string;project_id:string;symbol:string;asset_type:string;display_name:string|null;notes:string|null;created_at:string};
const sameOrigin=(request:Request)=>{const origin=request.headers.get('origin');if(!origin)return false;try{return new URL(origin).host===new URL(request.url).host}catch{return false}};
const symbolOf=(value:unknown)=>typeof value==='string'?value.trim().toUpperCase().slice(0,18):'';

export async function GET(request:Request){
  try{
    const projectId=new URL(request.url).searchParams.get('projectId')??'';
    if(!projectId)return Response.json({error:'Projeto não informado.'},{status:400});
    const db=createAdminClient();
    const [{data,error},{data:mentions}] = await Promise.all([
      db.from('financial_assets').select('id,project_id,symbol,asset_type,display_name,notes,created_at').eq('project_id',projectId).eq('active',true).order('created_at'),
      db.from('mentions').select('id,created_at,articles(title,description,url,published_at,sources(name,source_type)),monitors!inner(project_id)').eq('monitors.project_id',projectId).order('created_at',{ascending:false}).limit(20),
    ]);
    if(error)throw error;
    const assets=(data??[]) as Asset[];
    const assetIds=assets.map(item=>item.id);
    const historyResult=assetIds.length
      ? await db.from('financial_quotes').select('asset_id,price,change_percent,volume,currency,provider,market_time,collected_at').in('asset_id',assetIds).order('collected_at',{ascending:true}).limit(3000)
      : {data:[],error:null};
    if(historyResult.error)throw historyResult.error;
    const crypto=assets.filter(item=>item.asset_type==='crypto').map(item=>item.symbol);
    const brapi=assets.filter(item=>item.asset_type!=='crypto').map(item=>item.symbol);
    const [brapiResult,cryptoResult,indicatorResult]=await Promise.allSettled([getBrapiQuotes(brapi),getCryptoQuotes(crypto),getEconomicIndicators()]);
    const quotes=[brapiResult,cryptoResult].flatMap(result=>result.status==='fulfilled'?result.value:[]);
    const indicators=indicatorResult.status==='fulfilled'?indicatorResult.value:[];
    const failures=[brapiResult,cryptoResult,indicatorResult].filter(result=>result.status==='rejected').map(result=>result.reason instanceof Error?result.reason.message:'Fonte indisponível');
    return Response.json({assets,quotes,history:historyResult.data??[],indicators,news:mentions??[],provider:'brapi.dev · CoinGecko · BCB',marketError:failures.length?failures.join(' · '):undefined,updatedAt:new Date().toISOString()});
  }catch(error){console.error('[api/finance/assets GET]',error);return Response.json({error:'Não foi possível carregar os ativos.'},{status:500})}
}

export async function POST(request:Request){
  if(!sameOrigin(request))return Response.json({error:'Origem não autorizada.'},{status:403});
  try{const payload=await request.json() as {projectId?:unknown;symbol?:unknown;assetType?:unknown;displayName?:unknown;notes?:unknown};const projectId=typeof payload.projectId==='string'?payload.projectId:'';const symbol=symbolOf(payload.symbol),assetType=typeof payload.assetType==='string'?payload.assetType:'stock',displayName=typeof payload.displayName==='string'?payload.displayName.trim().slice(0,100):null,notes=typeof payload.notes==='string'?payload.notes.trim().slice(0,500):null;if(!projectId||!symbol||! /^[A-Z0-9.=-]{2,18}$/.test(symbol))return Response.json({error:'Informe um projeto e um código de ativo válido.'},{status:400});const db=createAdminClient();const {data:project}=await db.from('projects').select('id').eq('id',projectId).eq('status','active').maybeSingle();if(!project)return Response.json({error:'Projeto não encontrado.'},{status:404});const {data,error}=await db.from('financial_assets').upsert({project_id:projectId,symbol,asset_type:assetType,display_name:displayName||null,notes:notes||null,active:true,updated_at:new Date().toISOString()},{onConflict:'project_id,symbol'}).select('*').single();if(error)throw error;return Response.json({asset:data},{status:201})}catch(error){console.error('[api/finance/assets POST]',error);return Response.json({error:'Não foi possível adicionar o ativo.'},{status:500})}
}

export async function DELETE(request:Request){
  if(!sameOrigin(request))return Response.json({error:'Origem não autorizada.'},{status:403});
  try{const id=new URL(request.url).searchParams.get('id')??'';if(!id)return Response.json({error:'Ativo não informado.'},{status:400});const db=createAdminClient();const {error}=await db.from('financial_assets').update({active:false,updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error;return Response.json({ok:true})}catch(error){console.error('[api/finance/assets DELETE]',error);return Response.json({error:'Não foi possível remover o ativo.'},{status:500})}
}
