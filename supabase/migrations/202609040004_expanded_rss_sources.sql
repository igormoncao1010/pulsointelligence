-- Expansão nacional e regional: 22 feeds validados em 04/09/2026.
create unique index if not exists sources_rss_url_unique on public.sources (rss_url);

insert into public.sources
  (name, domain, source_type, rss_url, site_url, country, state, category, active, check_interval)
values
  ('Agência Brasil — Direitos Humanos','agenciabrasil.ebc.com.br','rss','https://agenciabrasil.ebc.com.br/rss/direitos-humanos/feed.xml','https://agenciabrasil.ebc.com.br/direitos-humanos','BR',null,'direitos-humanos',true,30),
  ('Agência Brasil — Educação','agenciabrasil.ebc.com.br','rss','https://agenciabrasil.ebc.com.br/rss/educacao/feed.xml','https://agenciabrasil.ebc.com.br/educacao','BR',null,'educacao',true,30),
  ('Agência Brasil — Esportes','agenciabrasil.ebc.com.br','rss','https://agenciabrasil.ebc.com.br/rss/esportes/feed.xml','https://agenciabrasil.ebc.com.br/esportes','BR',null,'esportes',true,30),
  ('Agência Brasil — Internacional','agenciabrasil.ebc.com.br','rss','https://agenciabrasil.ebc.com.br/rss/internacional/feed.xml','https://agenciabrasil.ebc.com.br/internacional','BR',null,'internacional',true,30),
  ('Agência Brasil — Meio Ambiente','agenciabrasil.ebc.com.br','rss','https://agenciabrasil.ebc.com.br/rss/meio-ambiente/feed.xml','https://agenciabrasil.ebc.com.br/meio-ambiente','BR',null,'meio-ambiente',true,30),
  ('Agência Brasil — Cultura','agenciabrasil.ebc.com.br','rss','https://agenciabrasil.ebc.com.br/rss/cultura/feed.xml','https://agenciabrasil.ebc.com.br/cultura','BR',null,'cultura',true,30),
  ('Gazeta do Povo — República','gazetadopovo.com.br','rss','https://www.gazetadopovo.com.br/feed/rss/republica.xml','https://www.gazetadopovo.com.br/republica','BR','PR','politica',true,30),
  ('Gazeta do Povo — Economia','gazetadopovo.com.br','rss','https://www.gazetadopovo.com.br/feed/rss/economia.xml','https://www.gazetadopovo.com.br/economia','BR','PR','economia',true,30),
  ('Gazeta do Povo — Brasil','gazetadopovo.com.br','rss','https://www.gazetadopovo.com.br/feed/rss/brasil.xml','https://www.gazetadopovo.com.br/brasil','BR','PR','nacional',true,30),
  ('Gazeta do Povo — Mundo','gazetadopovo.com.br','rss','https://www.gazetadopovo.com.br/feed/rss/mundo.xml','https://www.gazetadopovo.com.br/mundo','BR','PR','internacional',true,30),
  ('Gazeta do Povo — Agronegócio','gazetadopovo.com.br','rss','https://www.gazetadopovo.com.br/feed/rss/agronegocio.xml','https://www.gazetadopovo.com.br/agronegocio','BR','PR','agronegocio',true,30),
  ('Gazeta do Povo — Últimas Notícias','gazetadopovo.com.br','rss','https://www.gazetadopovo.com.br/feed/rss/ultimas-noticias.xml','https://www.gazetadopovo.com.br/ultimas-noticias','BR','PR','nacional',true,30),
  ('G1 Pernambuco','g1.globo.com','rss','https://g1.globo.com/rss/g1/pe/pernambuco/','https://g1.globo.com/pe/pernambuco/','BR','PE','regional',true,30),
  ('G1 São Paulo','g1.globo.com','rss','https://g1.globo.com/rss/g1/sp/sao-paulo/','https://g1.globo.com/sp/sao-paulo/','BR','SP','regional',true,30),
  ('G1 Rio de Janeiro','g1.globo.com','rss','https://g1.globo.com/rss/g1/rj/rio-de-janeiro/','https://g1.globo.com/rj/rio-de-janeiro/','BR','RJ','regional',true,30),
  ('G1 Distrito Federal','g1.globo.com','rss','https://g1.globo.com/rss/g1/df/distrito-federal/','https://g1.globo.com/df/distrito-federal/','BR','DF','regional',true,30),
  ('G1 Minas Gerais','g1.globo.com','rss','https://g1.globo.com/rss/g1/mg/minas-gerais/','https://g1.globo.com/mg/minas-gerais/','BR','MG','regional',true,30),
  ('G1 Bahia','g1.globo.com','rss','https://g1.globo.com/rss/g1/ba/bahia/','https://g1.globo.com/ba/bahia/','BR','BA','regional',true,30),
  ('G1 Ceará','g1.globo.com','rss','https://g1.globo.com/rss/g1/ce/ceara/','https://g1.globo.com/ce/ceara/','BR','CE','regional',true,30),
  ('G1 Paraná','g1.globo.com','rss','https://g1.globo.com/rss/g1/pr/parana/','https://g1.globo.com/pr/parana/','BR','PR','regional',true,30),
  ('G1 Rio Grande do Sul','g1.globo.com','rss','https://g1.globo.com/rss/g1/rs/rio-grande-do-sul/','https://g1.globo.com/rs/rio-grande-do-sul/','BR','RS','regional',true,30),
  ('G1 Amazonas','g1.globo.com','rss','https://g1.globo.com/rss/g1/am/amazonas/','https://g1.globo.com/am/amazonas/','BR','AM','regional',true,30)
on conflict (rss_url) do update set
  name = excluded.name,
  domain = excluded.domain,
  site_url = excluded.site_url,
  state = excluded.state,
  category = excluded.category,
  active = true;
