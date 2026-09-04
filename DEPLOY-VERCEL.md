# Como publicar o Pulso

## Antes de começar

Você precisa de contas gratuitas no GitHub, na Vercel e no Supabase. Os dois arquivos SQL que já foram executados no Supabase não precisam ser executados novamente.

### Atualização do formulário de monitoramento

Antes de publicar esta versão, abra o **SQL Editor** do Supabase e execute o conteúdo do arquivo:

`supabase/migrations/202609040002_single_tenant_monitors.sql`

Essa alteração permite salvar monitores reais nesta primeira versão de organização única, ainda sem tela de login.

Para acrescentar os novos feeds RSS validados, execute também:

`supabase/migrations/202609040003_more_rss_sources.sql`

Para acrescentar o segundo lote nacional e regional, execute:

`supabase/migrations/202609040004_expanded_rss_sources.sql`

Para trocar a coleta diária por uma coleta gratuita a cada 30 minutos, edite e execute:

`supabase/migrations/202609040005_cron_every_30_minutes.sql`

Antes de executar, substitua o texto `COLE_AQUI_O_MESMO_CRON_SECRET_DA_VERCEL` pelo valor de `CRON_SECRET` que está na Vercel. Não publique o arquivo preenchido no GitHub; envie ao GitHub somente a versão com o texto de exemplo.

Para habilitar a organização por projetos e colocar monitores antigos no projeto `Geral`, execute:

`supabase/migrations/202609040006_single_tenant_projects.sql`

Para desativar temporariamente os feeds estaduais solicitados do G1 e adicionar as fontes validadas de Goiás, execute:

`supabase/migrations/202609040007_goias_sources.sql`

## 1. Enviar para o GitHub

1. Crie um repositório vazio no GitHub.
2. Envie todo o conteúdo de dentro desta pasta para a raiz do repositório. Não envie a pasta anterior `Saas Clipping`.
3. Não envie `.env.local`, chaves privadas, `node_modules` nem `.next`.

## 2. Importar na Vercel

1. Entre em vercel.com com sua conta do GitHub.
2. Clique em **Add New > Project**.
3. Se for solicitado, autorize a Vercel a acessar o seu GitHub.
4. Importe o repositório que você acabou de criar.
5. Confirme que o framework detectado é **Next.js**.
6. Não altere Build Command, Output Directory ou Install Command.

## 3. Variáveis de ambiente

Antes de clicar em **Deploy**, abra **Environment Variables** e crie:

- `NEXT_PUBLIC_SUPABASE_URL`: a URL do projeto Supabase que você já possui.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: a chave pública/anon que você já possui.
- `SUPABASE_SERVICE_ROLE_KEY`: a chave privada `service_role`, encontrada no Supabase em **Project Settings > API** ou **API Keys**. Nunca coloque essa chave no GitHub.
- `CRON_SECRET`: uma senha longa e aleatória criada por você, com pelo menos 32 caracteres.
- `YOUTUBE_API_KEY`: chave da YouTube Data API v3 usada para coletar vídeos reais de cada monitoramento.
- `AI_PROVIDER`: use o valor `heuristic`.
- `AI_API_KEY`: opcional por enquanto.

Marque **Production**, **Preview** e **Development** para todas as variáveis usadas. A `SUPABASE_SERVICE_ROLE_KEY` e o `CRON_SECRET` são segredos e devem existir somente na Vercel/Supabase, nunca em arquivos enviados ao GitHub.

## 4. Publicar

Clique em **Deploy**. Quando terminar, abra o endereço terminado em `.vercel.app`. Se adicionar ou alterar uma variável depois, abra **Deployments** e use **Redeploy**, pois a mudança só entra em uma nova publicação.

## 5. Coleta automática

O Supabase Cron configurado pela migração `202609040005_cron_every_30_minutes.sql` chama a rota protegida de coleta em oito lotes, duas vezes por hora. Cada lote coleta uma parte das fontes RSS e dos monitoramentos do YouTube. A primeira tela pode aparecer vazia até a primeira execução correspondente ao lote do monitoramento.

Ao adicionar `YOUTUBE_API_KEY` depois do primeiro deploy, faça um **Redeploy** na Vercel. A variável só passa a existir nas novas publicações.

## 6. Relatórios em PDF

Abra **Monitoramentos**, escolha um monitor e clique em **Baixar relatório em PDF**. O arquivo é produzido no navegador com as métricas reais atuais e não ocupa espaço adicional no Supabase. O navegador fará o download com o nome do monitoramento e a data de geração.

Cada alteração futura enviada ao GitHub inicia automaticamente uma nova publicação na Vercel.
