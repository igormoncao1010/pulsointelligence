# Como publicar o Pulso

## 1. Enviar para o GitHub

Crie um repositório vazio no GitHub e envie **o conteúdo desta pasta**, não a pasta principal do projeto. O arquivo `.env.local` não está aqui e nenhuma chave secreta será publicada.

## 2. Importar na Vercel

1. Entre em vercel.com e clique em **Add New → Project**.
2. Escolha **Import Git Repository** e selecione o repositório do Pulso.
3. Confirme que o framework detectado é **Next.js**.
4. Não altere Build Command, Output Directory ou Install Command.

## 3. Variáveis de ambiente

Em **Project Settings → Environment Variables**, crie:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `YOUTUBE_API_KEY` (opcional por enquanto)
- `AI_PROVIDER` com valor `heuristic`
- `AI_API_KEY` (opcional por enquanto)

Marque Production, Preview e Development para URL e chave pública. Para os segredos, use pelo menos Production.

## 4. Publicar

Clique em **Deploy**. Depois de alterar variáveis, abra **Deployments**, escolha o último deployment e clique em **Redeploy**.

## 5. Coleta automática

O arquivo `vercel.json` agenda uma coleta diária às 08:00 UTC. A Vercel usa `CRON_SECRET` para proteger a chamada. A frequência pode ser aumentada posteriormente conforme o plano contratado.
