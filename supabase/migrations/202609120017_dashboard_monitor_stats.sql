-- Calcula métricas completas no PostgreSQL sem enviar milhares de menções à Vercel.
create or replace function public.dashboard_monitor_stats()
returns table (
  monitor_id uuid,
  today_count bigint,
  week_count bigint,
  month_count bigint,
  total_count bigint,
  relevance_average numeric,
  positive_count bigint,
  neutral_count bigint,
  negative_count bigint,
  unknown_count bigint,
  daily_counts jsonb,
  top_sources jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with latest_sentiment as (
    select distinct on (article_id) article_id, sentiment
    from public.sentiment_analysis
    order by article_id, created_at desc
  ), base as (
    select me.monitor_id, me.created_at, me.relevance_score,
           coalesce(ls.sentiment::text, 'unknown') as sentiment,
           coalesce(s.name, 'Fonte não identificada') as source_name
    from public.mentions me
    left join latest_sentiment ls on ls.article_id = me.article_id
    left join public.articles a on a.id = me.article_id
    left join public.sources s on s.id = a.source_id
  ), summary as (
    select b.monitor_id,
      count(*) filter (where b.created_at >= date_trunc('day', now())) as today_count,
      count(*) filter (where b.created_at >= now() - interval '7 days') as week_count,
      count(*) filter (where b.created_at >= now() - interval '30 days') as month_count,
      count(*) as total_count,
      coalesce(avg(b.relevance_score), 0) as relevance_average,
      count(*) filter (where b.sentiment = 'positive') as positive_count,
      count(*) filter (where b.sentiment = 'neutral') as neutral_count,
      count(*) filter (where b.sentiment = 'negative') as negative_count,
      count(*) filter (where b.sentiment = 'unknown') as unknown_count
    from base b group by b.monitor_id
  ), days as (
    select b.monitor_id, date_trunc('day', b.created_at)::date as day, count(*) as amount
    from base b where b.created_at >= date_trunc('day', now()) - interval '6 days'
    group by b.monitor_id, date_trunc('day', b.created_at)::date
  ), daily as (
    select d.monitor_id, jsonb_object_agg(d.day::text, d.amount) as values
    from days d group by d.monitor_id
  ), source_totals as (
    select b.monitor_id, b.source_name, count(*) as amount,
           row_number() over (partition by b.monitor_id order by count(*) desc) as position
    from base b group by b.monitor_id, b.source_name
  ), sources as (
    select st.monitor_id,
      jsonb_agg(jsonb_build_object('name', st.source_name, 'count', st.amount) order by st.amount desc) as values
    from source_totals st where st.position <= 5 group by st.monitor_id
  )
  select s.monitor_id, s.today_count, s.week_count, s.month_count, s.total_count,
         s.relevance_average, s.positive_count, s.neutral_count, s.negative_count,
         s.unknown_count, coalesce(d.values, '{}'::jsonb), coalesce(src.values, '[]'::jsonb)
  from summary s
  left join daily d on d.monitor_id = s.monitor_id
  left join sources src on src.monitor_id = s.monitor_id;
$$;

revoke all on function public.dashboard_monitor_stats() from public;
grant execute on function public.dashboard_monitor_stats() to service_role;
