create table if not exists public.financial_quotes (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.financial_assets(id) on delete cascade,
  price numeric,
  change_value numeric,
  change_percent numeric,
  volume numeric,
  market_cap numeric,
  currency text not null default 'BRL',
  provider text not null,
  market_time timestamptz,
  collected_at timestamptz not null default now()
);

create index if not exists financial_quotes_asset_time_idx
  on public.financial_quotes (asset_id, collected_at desc);

alter table public.financial_quotes enable row level security;
drop policy if exists financial_quotes_member on public.financial_quotes;
create policy financial_quotes_member on public.financial_quotes for select
using (
  exists (
    select 1 from public.financial_assets fa
    join public.projects p on p.id = fa.project_id
    where fa.id = asset_id
      and (p.organization_id is null or public.is_org_member(p.organization_id))
  )
);

comment on table public.financial_quotes is
  'Histórico compacto de cotações reais coletadas pelo Pulso Mercados.';

