-- Catálogo inicial composto exclusivamente por feeds públicos reais.
-- Pode ser executado sem usuário; fontes globais têm organization_id nulo.
insert into sources (name, domain, source_type, rss_url, site_url, country, state, category, active, check_interval)
values
 ('Agência Brasil — Últimas Notícias','agenciabrasil.ebc.com.br','rss','https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml','https://agenciabrasil.ebc.com.br','BR',null,'nacional',true,30),
 ('Agência Brasil — Política','agenciabrasil.ebc.com.br','rss','https://agenciabrasil.ebc.com.br/rss/politica/feed.xml','https://agenciabrasil.ebc.com.br/politica','BR',null,'politica',true,30),
 ('Agência Brasil — Economia','agenciabrasil.ebc.com.br','rss','https://agenciabrasil.ebc.com.br/rss/economia/feed.xml','https://agenciabrasil.ebc.com.br/economia','BR',null,'economia',true,30),
 ('Agência Brasil — Justiça','agenciabrasil.ebc.com.br','rss','https://agenciabrasil.ebc.com.br/rss/justica/feed.xml','https://agenciabrasil.ebc.com.br/justica','BR',null,'governo',true,30),
 ('Agência Brasil — Saúde','agenciabrasil.ebc.com.br','rss','https://agenciabrasil.ebc.com.br/rss/saude/feed.xml','https://agenciabrasil.ebc.com.br/saude','BR',null,'outros',true,30),
 ('Câmara dos Deputados — Últimas Notícias','camara.leg.br','rss','https://www.camara.leg.br/noticias/rss/ultimas-noticias','https://www.camara.leg.br/noticias','BR','DF','governo',true,30),
 ('Câmara dos Deputados — Política','camara.leg.br','rss','https://www.camara.leg.br/noticias/rss/dinamico/POLITICA','https://www.camara.leg.br/noticias','BR','DF','politica',true,30),
 ('Câmara dos Deputados — Economia','camara.leg.br','rss','https://www.camara.leg.br/noticias/rss/dinamico/ECONOMIA','https://www.camara.leg.br/noticias','BR','DF','economia',true,30),
 ('Câmara dos Deputados — Segurança','camara.leg.br','rss','https://www.camara.leg.br/noticias/rss/dinamico/SEGURANCA','https://www.camara.leg.br/noticias','BR','DF','governo',true,30),
 ('Câmara dos Deputados — Eleições','camara.leg.br','rss','https://www.camara.leg.br/noticias/rss/dinamico/ELEICOES','https://www.camara.leg.br/noticias','BR','DF','politica',true,30)
on conflict do nothing;
