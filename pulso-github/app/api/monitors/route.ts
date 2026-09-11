import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Payload = {
  projectId?: unknown;
  name?: unknown;
  required?: unknown;
  related?: unknown;
  excluded?: unknown;
};

const normalizeTerms = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((term): term is string => typeof term === 'string').map(term => term.trim()).filter(Boolean))].slice(0, 30);
};

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Payload;
    const projectId = typeof payload.projectId === 'string' ? payload.projectId : '';
    const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 120) : '';
    const required = normalizeTerms(payload.required);
    const related = normalizeTerms(payload.related);
    const excluded = normalizeTerms(payload.excluded);

    if (!projectId || !name || required.length === 0) {
      return Response.json({ error: 'Selecione o projeto, informe o nome e pelo menos uma palavra obrigatória.' }, { status: 400 });
    }

    const db = createAdminClient();
    const { data: project, error: projectError } = await db.from('projects').select('id').eq('id', projectId).eq('status', 'active').maybeSingle();
    if (projectError || !project) return Response.json({ error: 'Projeto não encontrado.' }, { status: 404 });
    const { data: monitor, error: monitorError } = await db
      .from('monitors')
      .insert({ project_id: projectId, name, status: 'active', language: 'pt-BR', country: 'BR' })
      .select('id,name,status')
      .single();
    if (monitorError) throw monitorError;

    const keywords = [
      ...required.map(keyword => ({ monitor_id: monitor.id, keyword, type: 'include' })),
      ...related.map(keyword => ({ monitor_id: monitor.id, keyword, type: 'related' })),
      ...excluded.map(keyword => ({ monitor_id: monitor.id, keyword, type: 'exclude' })),
    ];
    const { error: keywordError } = await db.from('monitor_keywords').insert(keywords);
    if (keywordError) {
      await db.from('monitors').delete().eq('id', monitor.id);
      throw keywordError;
    }

    return Response.json({ monitor }, { status: 201 });
  } catch (error) {
    console.error('[api/monitors]', error);
    return Response.json({ error: 'Não foi possível salvar o monitoramento.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json() as Payload & { id?: unknown };
    const id = typeof payload.id === 'string' ? payload.id : '';
    const projectId = typeof payload.projectId === 'string' ? payload.projectId : '';
    const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 120) : '';
    const required = normalizeTerms(payload.required);
    const related = normalizeTerms(payload.related);
    const excluded = normalizeTerms(payload.excluded);
    if (!id || !projectId || !name || required.length === 0) {
      return Response.json({ error: 'Informe o monitoramento, o projeto, o nome e pelo menos uma palavra obrigatória.' }, { status: 400 });
    }

    const db = createAdminClient();
    const { data: project } = await db.from('projects').select('id').eq('id', projectId).eq('status', 'active').maybeSingle();
    if (!project) return Response.json({ error: 'Projeto não encontrado.' }, { status: 404 });
    const { data: monitor } = await db.from('monitors').select('id,status').eq('id', id).maybeSingle();
    if (!monitor || monitor.status !== 'active') return Response.json({ error: 'Monitoramento não encontrado.' }, { status: 404 });

    const { error: monitorError } = await db.from('monitors').update({ project_id: projectId, name, updated_at: new Date().toISOString() }).eq('id', id);
    if (monitorError) throw monitorError;
    const { data: previousKeywords, error: previousError } = await db.from('monitor_keywords').select('keyword,type').eq('monitor_id', id);
    if (previousError) throw previousError;
    const { error: deleteError } = await db.from('monitor_keywords').delete().eq('monitor_id', id);
    if (deleteError) throw deleteError;
    const keywords = [
      ...required.map(keyword => ({ monitor_id: id, keyword, type: 'include' })),
      ...related.map(keyword => ({ monitor_id: id, keyword, type: 'related' })),
      ...excluded.map(keyword => ({ monitor_id: id, keyword, type: 'exclude' })),
    ];
    const { error: keywordError } = await db.from('monitor_keywords').insert(keywords);
    if (keywordError) {
      if (previousKeywords?.length) await db.from('monitor_keywords').insert(previousKeywords.map(item => ({ ...item, monitor_id: id })));
      throw keywordError;
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[api/monitors PATCH]', error);
    return Response.json({ error: 'Não foi possível editar o monitoramento.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id') ?? '';
    if (!id) return Response.json({ error: 'Monitoramento não informado.' }, { status: 400 });
    const db = createAdminClient();
    const { data, error } = await db.from('monitors').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'active').select('id').maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: 'Monitoramento não encontrado.' }, { status: 404 });
    return Response.json({ ok: true, archived: true });
  } catch (error) {
    console.error('[api/monitors DELETE]', error);
    return Response.json({ error: 'Não foi possível excluir o monitoramento.' }, { status: 500 });
  }
}
