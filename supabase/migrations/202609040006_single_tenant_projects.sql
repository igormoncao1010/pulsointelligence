-- Projetos para a fase inicial sem autenticação.
alter table public.projects alter column organization_id drop not null;

insert into public.projects (name, description, status, organization_id)
select 'Geral', 'Projeto criado para organizar monitoramentos existentes.', 'active', null
where not exists (
  select 1 from public.projects where organization_id is null and lower(name) = 'geral'
);

update public.monitors
set project_id = (
  select id from public.projects
  where organization_id is null and lower(name) = 'geral'
  order by created_at asc
  limit 1
)
where project_id is null;

alter table public.monitors alter column project_id set not null;
