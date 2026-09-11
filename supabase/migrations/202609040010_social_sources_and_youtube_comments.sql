alter table public.sources drop constraint if exists sources_source_type_check;
alter table public.sources add constraint sources_source_type_check
  check (source_type in ('rss','news','youtube','youtube_comment','bluesky','mastodon','lemmy','nostr','telegram','reddit','future'));

create table if not exists public.youtube_comments (
  id uuid primary key default gen_random_uuid(),
  comment_id text unique not null,
  video_id text not null,
  author_name text,
  text text not null,
  likes bigint not null default 0,
  replies integer not null default 0,
  published_at timestamptz,
  url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists youtube_comments_video_idx on public.youtube_comments(video_id);
create index if not exists youtube_comments_published_idx on public.youtube_comments(published_at desc);
alter table public.youtube_comments enable row level security;

insert into public.sources (name, domain, source_type, site_url, country, category, active, check_interval)
select values_to_insert.* from (values
  ('Comentários do YouTube','youtube.com','youtube_comment','https://youtube.com','BR','Redes sociais',true,30),
  ('Lemmy','lemmy.world','lemmy','https://lemmy.world','BR','Redes sociais',true,30),
  ('Nostr','nostr','nostr','https://nostr.com','BR','Redes sociais',true,30)
) as values_to_insert(name,domain,source_type,site_url,country,category,active,check_interval)
where not exists (select 1 from public.sources where source_type=values_to_insert.source_type);
