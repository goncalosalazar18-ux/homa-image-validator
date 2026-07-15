// scripts/run-batch.js
import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { config, assertRuntimeConfig } from './lib/config.js';
import { fetchSfccProducts } from './fetch-sfcc-products.js';
import { fetchSiteImages } from './site-scraper.js';
import { fetchKeepeekImages } from './keepeek-scraper.js';
import { fetchEasyreaImages } from './easyrea-scraper.js';
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
  if (eans.length === 0) throw new Error('Nenhum EAN foi indicado (EAN_LIST está vazio).');
  if (eans.length > MAX_EANS_PER_CORRIDA) {
    throw new Error(`Foram indicados ${eans.length} EAN — o máximo permitido é ${MAX_EANS_PER_CORRIDA}.`);
  }

  console.log(`A processar ${eans.length} EAN: ${eans.join(', ')}`);

  const eanToId = await readJson(path.resolve('data/ean-to-id.json'), {});
  if (Object.keys(eanToId).length === 0) {
    throw new Error(
      'data/ean-to-id.json está vazio ou não existe. Corre scripts/build-ean-id-map.js primeiro.'
    );
  }

  const wanted = eans.filter((ean) => eanToId[ean]);
  const semMapa = eans.filter((ean) => !eanToId[ean]);
  if (semMapa.length > 0) {
    console.warn(`Aviso: estes EAN não estão no mapa produto/EAN: ${semMapa.join(', ')}`);
  }

  console.log('A ir buscar o catálogo ao feed SFCC (so para saber o link de cada produto)...');
  const productsById = await fetchSfccProducts();

  const entradasSite = wanted
    .map((ean) => {
      const id = eanToId[ean];
      const link = productsById[id]?.link;
      return link ? { ean, url: link } : null;
    })
    .filter(Boolean);

  const semLink = wanted.filter((ean) => {
    const id = eanToId[ean];
    return !productsById[id]?.link;
  });
  if (semLink.length > 0) {
    console.warn(`Aviso: estes EAN nao tem link no feed (produto descontinuado?): ${semLink.join(', ')}`);
  }

  console.log('A visitar as fichas de produto no site...');
  const { results: siteResults, errors: siteErrors } = await fetchSiteImages(entradasSite);
  for (const [ean, message] of Object.entries(siteErrors)) {
    console.warn(`Erro no site para ${ean}: ${message}`);
  }
  const siteImages = await readJson(path.resolve('state/site-images.json'), {});
  Object.assign(siteImages, siteResults);
  await writeFile(path.resolve('state/site-images.json'), JSON.stringify(siteImages, null, 2));

  console.log('A pesquisar imagens na Keepeek...');
  const { results: keepeekResults, errors: keepeekErrors } = await fetchKeepeekImages(wanted);
  for (const [ean, message] of Object.entries(keepeekErrors)) {
    console.warn(`Erro na Keepeek para ${ean}: ${message}`);
  }
  const keepeekImages = await readJson(path.resolve('state/keepeek-images.json'), {});
  Object.assign(keepeekImages, keepeekResults);
  await writeFile(path.resolve('state/keepeek-images.json'), JSON.stringify(keepeekImages, null, 2));

  console.log('A pesquisar imagens na EasyRE@...');
  const { results: easyreaResults, errors: easyreaErrors } = await fetchEasyreaImages(wanted);
  for (const [ean, message] of Object.entries(easyreaErrors)) {
    console.warn(`Erro na EasyRE@ para ${ean}: ${message}`);
  }
  const easyreaImages = await readJson(path.resolve('state/easyrea-images.json'), {});
  Object.assign(easyreaImages, easyreaResults);
  await writeFile(path.resolve('state/easyrea-images.json'), JSON.stringify(easyreaImages, null, 2));

  console.log('A atualizar o relatório final...');
  await buildReport({ eans: wanted, eanToId, productsById });

  console.log('Concluído.');
}

run().catch((err) => {
  console.error('Corrida falhou:', err.message);
  process.exit(1);
});
