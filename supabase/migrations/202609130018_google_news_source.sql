-- Fonte dinâmica: a aplicação monta uma busca RSS por monitoramento.
create unique index if not exists sources_rss_url_unique on public.sources (rss_url);

insert into public.sources
 (name,domain,source_type,rss_url,site_url,country,state,category,active,check_interval)
values
 ('Google Notícias — Pesquisa por Monitoramento','news.google.com','rss',
  'https://news.google.com/rss/search','https://news.google.com','BR',null,'busca-dinamica',true,30)
on conflict (rss_url) do update set
 name=excluded.name,
 domain=excluded.domain,
 site_url=excluded.site_url,
 category=excluded.category,
 active=true,
 check_interval=excluded.check_interval,
 updated_at=now();
