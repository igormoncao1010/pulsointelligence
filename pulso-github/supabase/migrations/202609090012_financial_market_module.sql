create table if not exists public.financial_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  symbol text not null,
  asset_type text not null default 'stock' check (asset_type in ('stock','fii','etf','index','currency','crypto','option','future')),
  display_name text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, symbol)
);

create index if not exists financial_assets_project_idx
  on public.financial_assets (project_id, active, created_at desc);

alter table public.financial_assets enable row level security;

drop policy if exists financial_assets_member on public.financial_assets;
create policy financial_assets_member on public.financial_assets for select
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id
      and (p.organization_id is null or public.is_org_member(p.organization_id))
  )
);

comment on table public.financial_assets is
  'Ativos reais acompanhados por projeto no módulo Pulso Mercados.';
