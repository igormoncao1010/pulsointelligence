-- Índices necessários para o dashboard continuar rápido conforme as menções crescem.
-- Pode ser executado novamente com segurança.
create index if not exists mentions_created_at_idx
  on public.mentions (created_at desc);

create index if not exists mentions_monitor_created_at_idx
  on public.mentions (monitor_id, created_at desc);

create index if not exists sentiment_analysis_article_id_idx
  on public.sentiment_analysis (article_id);

create index if not exists monitor_keywords_monitor_id_idx
  on public.monitor_keywords (monitor_id);

analyze public.mentions;
analyze public.sentiment_analysis;
analyze public.monitor_keywords;
