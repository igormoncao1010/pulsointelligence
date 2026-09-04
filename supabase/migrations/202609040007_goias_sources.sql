-- Troca temporária de feeds estaduais: mantém o histórico, mas interrompe a coleta.
update public.sources
set active = false,
    updated_at = now()
where rss_url in (
  'https://g1.globo.com/rss/g1/am/amazonas/',
  'https://g1.globo.com/rss/g1/ba/bahia/',
  'https://g1.globo.com/rss/g1/ce/ceara/',
  'https://g1.globo.com/rss/g1/pr/parana/',
  'https://g1.globo.com/rss/g1/pe/pernambuco/',
  'https://g1.globo.com/rss/g1/rj/rio-de-janeiro/',
  'https://g1.globo.com/rss/g1/rs/rio-grande-do-sul/'
);

insert into public.sources
  (name, domain, source_type, rss_url, site_url, country, state, category, active, check_interval)
values
  ('G1 Goiás','g1.globo.com','rss','https://g1.globo.com/rss/g1/go/goias/','https://g1.globo.com/go/goias/','BR','GO','regional',true,30),
  ('Goiás 24 Horas','goias24horas.com.br','rss','https://goias24horas.com.br/feed/','https://goias24horas.com.br/','BR','GO','regional',true,30),
  ('Sagres','sagresonline.com.br','rss','https://sagresonline.com.br/feed/','https://sagresonline.com.br/','BR','GO','regional',true,30),
  ('Portal 6','portal6.com.br','rss','https://portal6.com.br/feed/','https://portal6.com.br/','BR','GO','regional',true,30)
on conflict (rss_url) do update set
  name = excluded.name,
  domain = excluded.domain,
  site_url = excluded.site_url,
  state = excluded.state,
  category = excluded.category,
  active = true,
  check_interval = excluded.check_interval,
  updated_at = now();
