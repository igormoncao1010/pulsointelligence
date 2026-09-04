alter table public.sources drop constraint if exists sources_source_type_check;
alter table public.sources add constraint sources_source_type_check
  check (source_type in ('rss','news','youtube','bluesky','telegram','reddit','future'));

insert into public.sources (name, domain, source_type, site_url, country, category, active, check_interval)
select 'Bluesky', 'bsky.app', 'bluesky', 'https://bsky.app', 'BR', 'Redes sociais', true, 30
where not exists (select 1 from public.sources where source_type = 'bluesky');
