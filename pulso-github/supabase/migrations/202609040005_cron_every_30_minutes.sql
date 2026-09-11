-- ANTES DE EXECUTAR: troque COLE_AQUI_O_MESMO_CRON_SECRET_DA_VERCEL
-- pelo valor de CRON_SECRET cadastrado na Vercel.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
declare secret_id uuid;
begin
  select id into secret_id from vault.secrets where name = 'pulso_app_url';
  if secret_id is null then
    perform vault.create_secret('https://pulsointelligence-phi.vercel.app', 'pulso_app_url', 'Endereço de produção do Pulso');
  else
    perform vault.update_secret(secret_id, 'https://pulsointelligence-phi.vercel.app', 'pulso_app_url', 'Endereço de produção do Pulso');
  end if;
end $$;

do $$
declare secret_id uuid;
begin
  select id into secret_id from vault.secrets where name = 'pulso_cron_secret';
  if secret_id is null then
    perform vault.create_secret('COLE_AQUI_O_MESMO_CRON_SECRET_DA_VERCEL', 'pulso_cron_secret', 'Autorização do coletor Pulso');
  else
    perform vault.update_secret(secret_id, 'COLE_AQUI_O_MESMO_CRON_SECRET_DA_VERCEL', 'pulso_cron_secret', 'Autorização do coletor Pulso');
  end if;
end $$;

create or replace function public.trigger_pulso_collection(batch_no integer)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  request_id bigint;
begin
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'pulso_app_url' order by created_at desc limit 1)
      || '/api/cron/collect?batch=' || batch_no || '&total=8',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'pulso_cron_secret' order by created_at desc limit 1),
      'User-Agent', 'supabase-cron/pulso'
    ),
    timeout_milliseconds := 55000
  ) into request_id;
  return request_id;
end;
$$;

select cron.unschedule(jobid) from cron.job where jobname like 'pulso-collect-batch-%';

select cron.schedule('pulso-collect-batch-0', '0,30 * * * *', 'select public.trigger_pulso_collection(0);');
select cron.schedule('pulso-collect-batch-1', '1,31 * * * *', 'select public.trigger_pulso_collection(1);');
select cron.schedule('pulso-collect-batch-2', '2,32 * * * *', 'select public.trigger_pulso_collection(2);');
select cron.schedule('pulso-collect-batch-3', '3,33 * * * *', 'select public.trigger_pulso_collection(3);');
select cron.schedule('pulso-collect-batch-4', '4,34 * * * *', 'select public.trigger_pulso_collection(4);');
select cron.schedule('pulso-collect-batch-5', '5,35 * * * *', 'select public.trigger_pulso_collection(5);');
select cron.schedule('pulso-collect-batch-6', '6,36 * * * *', 'select public.trigger_pulso_collection(6);');
select cron.schedule('pulso-collect-batch-7', '7,37 * * * *', 'select public.trigger_pulso_collection(7);');
