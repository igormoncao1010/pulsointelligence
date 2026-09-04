-- Novos feeds públicos, reais e validados em 04/09/2026.
create unique index if not exists sources_rss_url_unique on public.sources (rss_url);

insert into public.sources
  (name, domain, source_type, rss_url, site_url, country, state, category, active, check_interval)
values
  ('Supremo Tribunal Federal — Notícias','noticias.stf.jus.br','rss','https://noticias.stf.jus.br/feed/','https://noticias.stf.jus.br','BR','DF','governo',true,30),
  ('Fundação Oswaldo Cruz — Notícias','portal.fiocruz.br','rss','https://portal.fiocruz.br/rss.xml','https://portal.fiocruz.br','BR','RJ','saude',true,30),
  ('IBGE — Agência de Notícias','agenciadenoticias.ibge.gov.br','rss','https://agenciadenoticias.ibge.gov.br/agencia-noticias/2012-agencia-de-noticias/noticias.html?format=feed&type=rss','https://agenciadenoticias.ibge.gov.br','BR','RJ','economia',true,30),
  ('Presidência da República — Notícias','gov.br','rss','https://www.gov.br/planalto/pt-br/acompanhe-o-planalto/noticias/RSS','https://www.gov.br/planalto','BR','DF','governo',true,30),
  ('G1 — Últimas Notícias','g1.globo.com','rss','https://g1.globo.com/rss/g1/','https://g1.globo.com','BR',null,'nacional',true,30),
  ('Folha de S.Paulo — Em cima da hora','folha.uol.com.br','rss','https://feeds.folha.uol.com.br/emcimadahora/rss091.xml','https://www.folha.uol.com.br','BR','SP','nacional',true,30),
  ('CNN Brasil — Notícias','cnnbrasil.com.br','rss','https://www.cnnbrasil.com.br/feed/','https://www.cnnbrasil.com.br','BR','SP','nacional',true,30),
  ('Poder360 — Notícias','poder360.com.br','rss','https://www.poder360.com.br/feed/','https://www.poder360.com.br','BR','DF','politica',true,30),
  ('Congresso em Foco — Notícias','congressoemfoco.uol.com.br','rss','https://congressoemfoco.uol.com.br/feed/','https://congressoemfoco.uol.com.br','BR','DF','politica',true,30),
  ('BBC News Brasil','bbc.com','rss','https://feeds.bbci.co.uk/portuguese/rss.xml','https://www.bbc.com/portuguese','BR',null,'internacional',true,30),
  ('Agência Pública — Reportagens','apublica.org','rss','https://apublica.org/feed/','https://apublica.org','BR','SP','nacional',true,30)
on conflict (rss_url) do update set
  name = excluded.name,
  domain = excluded.domain,
  site_url = excluded.site_url,
  category = excluded.category,
  active = true;
