create table if not exists public.ai_monitor_reports (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references public.monitors(id) on delete cascade,
  prompt_hash text not null,
  status text not null default 'pending' check (status in ('pending','complete','error')),
  provider text not null default 'huggingface',
  model text not null,
  input_count integer not null default 0,
  result jsonb,
  token_usage jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (monitor_id, prompt_hash)
);

create index if not exists ai_monitor_reports_monitor_created_idx
  on public.ai_monitor_reports (monitor_id, created_at desc);

alter table public.ai_monitor_reports enable row level security;

drop policy if exists ai_monitor_reports_member on public.ai_monitor_reports;
create policy ai_monitor_reports_member on public.ai_monitor_reports for select
using (
  exists (
    select 1 from public.monitors m
    join public.projects p on p.id = m.project_id
    where m.id = monitor_id
      and (p.organization_id is null or public.is_org_member(p.organization_id))
  )
);

comment on table public.ai_monitor_reports is
  'Relatórios gerados por IA, persistidos para auditoria, histórico e economia de créditos.';
