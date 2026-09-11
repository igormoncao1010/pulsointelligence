-- Fase inicial sem autenticação: permite que o backend crie monitores globais.
-- A API continua sendo a única responsável pelas inserções e usa a service_role.
alter table public.monitors alter column project_id drop not null;
