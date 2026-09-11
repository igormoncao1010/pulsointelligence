# Pulso — Media Intelligence

MVP SaaS de monitoramento de mídia em português. O núcleo coleta feeds RSS no backend, normaliza e deduplica artigos, cruza palavras-chave e cria menções reutilizando uma única publicação entre vários monitores.

## Stack

- Next.js/Vinext, React, TypeScript e Tailwind CSS
- Supabase PostgreSQL + Auth + RLS
- RSS Parser, Recharts e Lucide
- Endpoint protegido compatível com Cron

## Instalação

1. Instale as dependências com `pnpm install`.
2. Copie `.env.example` para `.env.local` e preencha as chaves.
3. No Supabase, execute `supabase/migrations/202609030001_initial_schema.sql`.
4. Execute `supabase/seed.sql` para cadastrar o catálogo inicial de feeds públicos reais.
5. Inicie com `pnpm dev` e abra a URL informada.

## Configuração Supabase

Use a URL e chave anônima no cliente. A chave `SUPABASE_SERVICE_ROLE_KEY` é exclusivamente de servidor e permite ao coletor inserir dados apesar das policies. Nunca exponha essa chave no navegador. As policies limitam a leitura às organizações das quais o usuário participa; o papel `global_admin` em `profiles.role` libera a visão administrativa.

O projeto não inclui publicações, métricas ou usuários simulados. Até a primeira coleta, a interface mostra zeros e estados vazios.

## Fluxo funcional principal

1. Cadastre uma fonte RSS em `sources` com `active = true`.
2. Crie projeto, monitor e termos em `monitor_keywords`.
3. Chame `GET /api/cron/collect` com `Authorization: Bearer $CRON_SECRET`.
4. O coletor busca o feed, converte cada item em `NormalizedContent`, deduplica por URL canônica/hash, grava o artigo e cria as relações em `mentions`.
5. Cada execução fica registrada em `collection_logs`.

Exemplo local:

```bash
curl -H "Authorization: Bearer seu-segredo" http://localhost:3000/api/cron/collect
```

Na Vercel, configure um Cron para `/api/cron/collect` e mantenha `CRON_SECRET` nas variáveis do projeto. Use intervalo compatível com o plano e com `sources.check_interval`.

## Adicionar fonte

Informe nome, domínio, `source_type = rss`, URL do feed, URL do site, categoria, UF e intervalo em minutos. O coletor envia um User-Agent identificável, respeita feeds oficiais e possui timeout. Não há scraping de páginas.

## YouTube

Defina `YOUTUBE_API_KEY`. `services/collectors/youtubeCollector.ts` usa apenas a YouTube Data API e normaliza resultados no mesmo contrato dos demais coletores; não baixa vídeo ou áudio.

## Estrutura

- `app/`: dashboard e endpoints backend
- `components/`: interface reutilizável
- `services/collectors/`: RSS, YouTube e contrato de coletores
- `services/matching/`: regras de termos exatos, inclusões e exclusões
- `services/analysis/`: provider substituível de sentimento
- `services/alerts/`: detecção de picos
- `lib/supabase/`: acesso seguro ao banco
- `supabase/migrations/`: schema, índices e RLS

## Produção

Configure todas as variáveis do `.env.example`, aplique a migration, troque/expanda as policies de escrita conforme o fluxo de convites da organização e agende a limpeza de logs antigos. Para escala, mova coleta para filas/workers e preserve o contrato `NormalizedContent`; PostgreSQL FTS pode ser substituído por OpenSearch sem alterar os coletores.
