// scripts/run-batch.js
// Ponto de entrada usado pelo GitHub Actions. Corre sempre de forma manual,
// para uma lista concreta de EAN (nunca mais de 100) recebida via input do
// workflow_dispatch. Não há agendamento nem fila — cada corrida processa
// exatamente os EAN pedidos e atualiza public/data/produtos.json.

import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { config, assertRuntimeConfig } from './lib/config.js';
import { fetchSfccProducts } from './fetch-sfcc-products.js';
import { fetchKeepeekImages } from './keepeek-scraper.js';
import { classifyImages } from './classify-images.js';
import { buildReport } from './build-report.js';

const MAX_EANS_PER_CORRIDA = 100;

function parseEanList(raw) {
  if (!raw) return [];
  return [...new Set(raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))];
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

async function run() {
  assertRuntimeConfig();
  await mkdir(path.resolve('state'), { recursive: true });

  const eans = parseEanList(process.env.EAN_LIST);

  if (eans.length === 0) {
    throw new Error('Nenhum EAN foi indicado (EAN_LIST está vazio).');
  }
  if (eans.length > MAX_EANS_PER_CORRIDA) {
    throw new Error(
      `Foram indicados ${eans.length} EAN — o máximo permitido por corrida é ${MAX_EANS_PER_CORRIDA}.`
    );
  }

  console.log(`A processar ${eans.length} EAN: ${eans.join(', ')}`);

  console.log('A ir buscar o catálogo ao feed SFCC...');
  const allProducts = await fetchSfccProducts();
  const wanted = new Set(eans);
  const products = allProducts.filter((p) => wanted.has(p.ean));

  const foundEans = new Set(products.map((p) => p.ean));
  const missing = eans.filter((e) => !foundEans.has(e));
  if (missing.length > 0) {
    console.warn(`Aviso: estes EAN não foram encontrados no feed SFCC: ${missing.join(', ')}`);
  }

  console.log('A pesquisar imagens na Keepeek...');
  const { results, errors } = await fetchKeepeekImages(eans);

  for (const [ean, message] of Object.entries(errors)) {
    console.warn(`Erro na Keepeek para ${ean}: ${message}`);
  }

  // Guarda/atualiza a cache de imagens da Keepeek (útil se este EAN voltar a
  // ser consultado numa corrida futura).
  const keepeekImages = await readJson(path.resolve('state/keepeek-images.json'), {});
  Object.assign(keepeekImages, results);
  await writeFile(
    path.resolve('state/keepeek-images.json'),
    JSON.stringify(keepeekImages, null, 2)
  );

  const productsByEan = new Map(products.map((p) => [p.ean, p]));
  const allImageUrls = eans.flatMap((ean) => [
    ...(productsByEan.get(ean)?.images || []),
    ...(results[ean] || []),
  ]);

  console.log(`A classificar ${allImageUrls.length} imagens...`);
  await classifyImages(allImageUrls);

  console.log('A atualizar o relatório final...');
  await buildReport();

  console.log('Concluído.');
}

run().catch((err) => {
  console.error('Corrida falhou:', err.message);
  process.exit(1);
});
