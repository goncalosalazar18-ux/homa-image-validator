# hôma · auditoria de imagens por EAN

Cruza produtos do site (feed SFCC) com as imagens disponíveis na Keepeek,
classifica cada imagem em **produto / close-up / ambiente**, e mostra num
dashboard que categorias faltam gerar para cada produto.

**Corre só manualmente.** No dashboard, colas os EAN que queres verificar
naquele momento (máximo 100 de cada vez) e clicas em "Verificar estes EAN".
Não há agendamento nem processamento automático de todo o catálogo.

Sem Supabase, sem Lovable — só GitHub (motor + dados) e Netlify (interface).

## Como está organizado

```
.github/workflows/sync-images.yml   → o motor: workflow manual, recebe até 100 EAN por corrida
scripts/                            → toda a lógica do motor (Node.js)
netlify/functions/trigger-sync.js   → recebe os EAN do dashboard e dispara o workflow
public/                             → o dashboard (HTML/CSS/JS puro, sem framework)
state/                              → caches internas (imagens Keepeek, classificações)
public/data/produtos.json           → o único ficheiro que o dashboard lê
```

## Como funciona, do clique ao resultado

1. No dashboard, colas até 100 EAN na caixa de texto e clicas em "Verificar
   estes EAN"
2. É pedida uma palavra-passe (`TRIGGER_SECRET`) — proteção simples contra
   cliques ao acaso
3. A Netlify Function `trigger-sync` valida a lista e dispara o workflow do
   GitHub Actions com esses EAN como input
4. O workflow: vai buscar o feed SFCC → filtra só os EAN pedidos → pesquisa
   cada um na Keepeek → classifica as imagens novas (produto/close-up/ambiente)
   → atualiza `public/data/produtos.json` → faz commit do resultado
5. Passados uns minutos, recarregas o dashboard e vês os EAN verificados
   (os restantes produtos do catálogo continuam visíveis com o último estado
   conhecido, mesmo que ainda não tenham sido verificados nesta ronda)

## O que falta confirmar antes de correr a sério

1. **`scripts/keepeek-scraper.js`** — os seletores de login e de pesquisa são
   placeholders (marcados com `TODO`). Inspeciona a interface da Keepeek
   (botão direito → inspecionar elemento) no formulário de login e na
   pesquisa avançada, e ajusta.
2. **Nome do campo EAN na Keepeek** — confirma como o EAN está guardado como
   metadado (ex: `ean`, `gencod`, `reference`) e define isso no secret
   `KEEPEEK_EAN_FIELD`.
3. **`scripts/fetch-sfcc-products.js`** — assume um feed estilo Google
   Shopping. Se o vosso feed SFCC tiver uma estrutura diferente, ajusta o
   parser (ou troca por uma chamada OCAPI direta).

## Configuração

### 1. Secrets no GitHub (Settings → Secrets and variables → Actions)

| Secret | Descrição |
|---|---|
| `SFCC_FEED_URL` | URL do feed de produtos SFCC |
| `KEEPEEK_BASE_URL` | URL da vossa instância Keepeek |
| `KEEPEEK_EMAIL` | Email de login na Keepeek |
| `KEEPEEK_PASSWORD` | Password de login na Keepeek |
| `KEEPEEK_EAN_FIELD` | Nome do campo de metadados do EAN na Keepeek |
| `ANTHROPIC_API_KEY` | Chave da API da Anthropic (classificação de imagens) |

### 2. Variáveis de ambiente no Netlify (Site settings → Environment variables)

| Variável | Descrição |
|---|---|
| `GITHUB_TOKEN` | Fine-grained personal access token com permissão "Actions: write" neste repositório |
| `GITHUB_REPO` | `org-ou-user/nome-do-repo` |
| `TRIGGER_SECRET` | Uma palavra-passe à tua escolha, para proteger o botão "Verificar estes EAN" |

### 3. Deploy

1. Cria o repositório no GitHub e faz push deste projeto
2. Liga o repositório à Netlify (publish directory: `public`, functions
   directory: `netlify/functions` — já vem configurado no `netlify.toml`)
3. Não precisas de ativar nada além disto — o workflow só corre quando o
   disparas (a partir do dashboard, ou manualmente em Actions → Verificar
   imagens por EAN → Run workflow, colando os EAN no campo pedido)

## Nota sobre o botão "Verificar estes EAN"

A proteção por `TRIGGER_SECRET` é uma barreira simples (evita cliques
acidentais ou de visitantes ao acaso), não segurança robusta — a palavra-passe
passa em texto no pedido. Se este dashboard vier a ficar acessível
publicamente, vale a pena reforçar com a funcionalidade de "Password
Protection" do Netlify (se disponível no vosso plano) ou restringir o acesso
ao domínio por outra via.

## Custo aproximado

Cada imagem nova é classificada uma única vez (cache em
`state/classifications.json`) — se voltares a verificar o mesmo EAN mais
tarde, só as imagens novas desde a última vez são classificadas outra vez.
Com Claude Haiku, o custo por imagem é baixo.
