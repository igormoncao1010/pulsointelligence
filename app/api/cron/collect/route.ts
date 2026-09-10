import { collectActiveRssSources } from '@/services/collectors/rssCollector';
import { collectYoutubeMonitors } from '@/services/collectors/youtubeCollector';
import { collectBlueskyMonitors } from '@/services/collectors/blueskyCollector';
import { collectMastodonMonitors } from '@/services/collectors/mastodonCollector';
import { collectYoutubeComments } from '@/services/collectors/youtubeCommentsCollector';
import { collectLemmyMonitors } from '@/services/collectors/lemmyCollector';
import { collectNostrMonitors } from '@/services/collectors/nostrCollector';
import { collectMarketQuotes } from '@/services/finance/collectMarketQuotes';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export const maxDuration=300;
export async function GET(request:Request){ const secret=process.env.CRON_SECRET; const auth=request.headers.get('authorization'); if(!secret||auth!==`Bearer ${secret}`) return Response.json({error:'Não autorizado'},{status:401}); try{const url=new URL(request.url);const rawBatch=Number(url.searchParams.get('batch')??0);const rawTotal=Number(url.searchParams.get('total')??1);const batch=Number.isInteger(rawBatch)?rawBatch:0;const totalBatches=Number.isInteger(rawTotal)?rawTotal:1;const options={batch,totalBatches};const [rss,youtube,bluesky,mastodon,lemmy,nostr,market]=await Promise.all([collectActiveRssSources(options),collectYoutubeMonitors(options),collectBlueskyMonitors(options),collectMastodonMonitors(options),collectLemmyMonitors(options),collectNostrMonitors(options),batch===0?collectMarketQuotes():Promise.resolve({found:0,stored:0,skipped:true})]);const youtubeComments=await collectYoutubeComments(options);return Response.json({ok:true,batch,totalBatches,executedAt:new Date().toISOString(),results:{rss,youtube,youtubeComments,bluesky,mastodon,lemmy,nostr,market}});}catch(error){console.error('[cron/collect]',error);return Response.json({ok:false,error:error instanceof Error?error.message:'Falha na coleta'},{status:500});} }
export const POST=GET;
