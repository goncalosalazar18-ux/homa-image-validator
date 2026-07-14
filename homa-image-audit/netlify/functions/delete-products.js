// netlify/functions/delete-products.js
// Remove entradas do relatorio (public/data/produtos.json) diretamente
// no repositorio GitHub, via API de conteudo do GitHub — sem precisar
// de correr o workflow completo so para apagar linhas.

const FILE_PATH = 'homa-image-audit/public/data/produtos.json';
const MAX_EANS = 100;

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Metodo nao permitido', { status: 405 });
  }

  const providedSecret = req.headers.get('x-trigger-secret');
  if (!process.env.TRIGGER_SECRET || providedSecret !== process.env.TRIGGER_SECRET) {
    return new Response('Nao autorizado', { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('Corpo do pedido invalido, esperava-se JSON.', { status: 400 });
  }

  const eansToRemove = Array.isArray(body.eans)
    ? [...new Set(body.eans.map((e) => String(e).trim()).filter(Boolean))]
    : [];

  if (eansToRemove.length === 0) {
    return new Response('Indica pelo menos um EAN para remover.', { status: 400 });
  }

  if (eansToRemove.length > MAX_EANS) {
    return new Response(`Maximo de ${MAX_EANS} EAN por remocao.`, { status: 400 });
  }

  const { GITHUB_REPO, GITHUB_TOKEN } = process.env;
  if (!GITHUB_REPO || !GITHUB_TOKEN) {
    return new Response('Configuracao em falta no servidor', { status: 500 });
  }

  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`;
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
  };

  const getResponse = await fetch(`${apiUrl}?ref=main`, { headers });
  if (!getResponse.ok) {
    const text = await getResponse.text();
    return new Response(`Falha ao ler o ficheiro atual: ${text}`, { status: 502 });
  }

  const fileData = await getResponse.json();
  const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');

  let report;
  try {
    report = JSON.parse(currentContent);
  } catch {
    return new Response('O ficheiro produtos.json atual nao e JSON valido.', { status: 500 });
  }

  const antes = report.products.length;
  report.products = report.products.filter((p) => !eansToRemove.includes(p.ean));
  const removidos = antes - report.products.length;

  const novoConteudo = Buffer.from(JSON.stringify(report, null, 2)).toString('base64');

  const putResponse = await fetch(apiUrl, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `chore: remover ${removidos} EAN da auditoria`,
      content: novoConteudo,
      sha: fileData.sha,
      branch: 'main',
    }),
  });

  if (!putResponse.ok) {
    const text = await putResponse.text();
    return new Response(`Falha ao guardar as alteracoes: ${text}`, { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true, removidos }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/api/delete-products' };
