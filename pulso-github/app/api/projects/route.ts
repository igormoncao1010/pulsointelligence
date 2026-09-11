import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { name?: unknown; description?: unknown };
    const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 100) : '';
    const description = typeof payload.description === 'string' ? payload.description.trim().slice(0, 500) : '';
    if (name.length < 2) return Response.json({ error: 'Digite um nome com pelo menos 2 caracteres.' }, { status: 400 });
    const db = createAdminClient();
    const { data: duplicate } = await db.from('projects').select('id').ilike('name', name).limit(1).maybeSingle();
    if (duplicate) return Response.json({ error: 'Já existe um projeto com esse nome.' }, { status: 409 });
    const { data, error } = await db.from('projects').insert({ organization_id: null, name, description: description || null, status: 'active' }).select('id,name,description,status,created_at').single();
    if (error) throw error;
    return Response.json({ project: data }, { status: 201 });
  } catch (error) {
    console.error('[api/projects]', error);
    return Response.json({ error: 'Não foi possível criar o projeto.' }, { status: 500 });
  }
}
