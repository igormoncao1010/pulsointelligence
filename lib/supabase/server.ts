import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase não configurado. Verifique as variáveis de ambiente.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function createReadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase não configurado. Verifique as variáveis de ambiente.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
