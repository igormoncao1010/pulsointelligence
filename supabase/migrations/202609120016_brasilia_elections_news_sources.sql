-- Desativa editorias da Agência Brasil solicitadas, preservando artigos antigos.
update public.sources
set active = false,
    updated_at = now()
where lower(name) in (
  lower('Agência Brasil — Cultura'),
  lower('Agência Brasil — Esportes'),
  lower('Agência Brasil — Internacional'),
  lower('Agência Brasil — Meio Ambiente'),
  lower('Agência Brasil — Saúde')
)
or rss_url in (
  'https://agenciabrasil.ebc.com.br/rss/cultura/feed.xml',
  'https://agenciabrasil.ebc.com.br/rss/esportes/feed.xml',
  'https://agenciabrasil.ebc.com.br/rss/internacional/feed.xml',
  'https://agenciabrasil.ebc.com.br/rss/meio-ambiente/feed.xml',
  'https://agenciabrasil.ebc.com.br/rss/saude/feed.xml'
);

create unique index if not exists sources_rss_url_unique
  on public.sources (rss_url);

-- Fontes oficiais de Brasília, eleições e últimas notícias.
insert into public.sources
  (name, domain, source_type, rss_url, site_url, country, state, category, active, check_interval)
values
  ('TSE — Últimas Notícias Eleitorais', 'tse.jus.br', 'rss',
   'https://www.tse.jus.br/rss', 'https://www.tse.jus.br/comunicacao/noticias',
   'BR', 'DF', 'eleicoes', true, 30),

  ('Câmara dos Deputados — Eleições', 'camara.leg.br', 'rss',
   'https://www.camara.leg.br/noticias/rss/dinamico/ELEICOES', 'https://www.camara.leg.br/noticias',
   'BR', 'DF', 'eleicoes', true, 30),

  ('Câmara dos Deputados — Últimas Notícias', 'camara.leg.br', 'rss',
   'https://www.camara.leg.br/noticias/rss/ultimas-noticias', 'https://www.camara.leg.br/noticias',
   'BR', 'DF', 'ultimas-noticias', true, 30),

  ('Senado Federal — Últimas Notícias', 'senado.leg.br', 'rss',
   'https://www12.senado.leg.br/noticias/feed/todasnoticias/RSS', 'https://www12.senado.leg.br/noticias',
   'BR', 'DF', 'politica', true, 30)
on conflict (rss_url) do update set
  name = excluded.name,
  domain = excluded.domain,
  site_url = excluded.site_url,
  country = excluded.country,
  state = excluded.state,
  category = excluded.category,
  active = true,
  check_interval = excluded.check_interval,
  updated_at = now();
