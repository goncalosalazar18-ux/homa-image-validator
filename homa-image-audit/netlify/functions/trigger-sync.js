// netlify/functions/trigger-sync.js
// Recebe a lista de EAN escrita no dashboard (máx. 100), guarda o token do
// GitHub em segurança no lado do servidor, e dispara o workflow manual
// "Verificar imagens por EAN" com essa lista.
//
// Variáveis de ambiente a configurar no Netlify (Site settings → Environment
// variables), NUNCA no código:
//   GITHUB_TOKEN    → fine-grained PAT com permissão "Actions: write" neste repo
//   GITHUB_REPO     → "org-ou-user/nome-do-repo"
//   TRIGGER_SECRET  → uma palavra-passe à tua escolha, para proteger o botão

const MAX_EANS = 100;

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Método não permitido', { status: 405 });
  }

  const providedSecret = req.headers.get('x-trigger-secret');
  if (!process.env.TRIGGER_SECRET || providedSecret !== process.env.TRIGGER_SECRET) {
    return new Response('Não autorizado', { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('Corpo do pedido inválido, esperava-se JSON.', { status: 400 });
  }

  const eans = Array.isArray(body.eans)
    ? [...new Set(body.eans.map((e) => String(e).trim()).filter(Boolean))]
    : [];

  if (eans.length === 0) {
    return new Response('Indica pelo menos um EAN.', { status: 400 });
  }
  if (eans.length > MAX_EANS) {
    return new Response(
      `Foram indicados ${eans.length} EAN — o máximo por verificação é ${MAX_EANS}.`,
      { status: 400 }
    );
  }

  const { GITHUB_REPO, GITHUB_TOKEN } = process.env;
  if (!GITHUB_REPO || !GITHUB_TOKEN) {
    return new Response('Configuração em falta no servidor', { status: 500 });
  }

  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/sync-images.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: { eans: eans.join(',') },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    return new Response(`Falha ao disparar o workflow: ${text}`, { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true, total: eans.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/api/trigger-sync' };
