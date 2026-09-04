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
- `YOUTUBE_API_KEY`: opcional por enquanto.
- `AI_PROVIDER`: use o valor `heuristic`.
- `AI_API_KEY`: opcional por enquanto.

Marque **Production**, **Preview** e **Development** para todas as variáveis usadas. A `SUPABASE_SERVICE_ROLE_KEY` e o `CRON_SECRET` são segredos e devem existir somente na Vercel/Supabase, nunca em arquivos enviados ao GitHub.

## 4. Publicar

Clique em **Deploy**. Quando terminar, abra o endereço terminado em `.vercel.app`. Se adicionar ou alterar uma variável depois, abra **Deployments** e use **Redeploy**, pois a mudança só entra em uma nova publicação.

## 5. Coleta automática

O arquivo `vercel.json` agenda uma coleta diária às 08:00 UTC, equivalente a 05:00 no horário de Brasília. A Vercel usa `CRON_SECRET` para proteger essa chamada. A primeira tela pode aparecer vazia até a primeira coleta.

Cada alteração futura enviada ao GitHub inicia automaticamente uma nova publicação na Vercel.
