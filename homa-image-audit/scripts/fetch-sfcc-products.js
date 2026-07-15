// scripts/fetch-sfcc-products.js
// Vai buscar o feed de produtos do SFCC e devolve, por Cód. Art. (g:id),
// o título e as imagens já existentes no site.
//
// O EAN não existe neste feed — o cruzamento com o EAN é feito à parte,
// via data/ean-to-id.json (gerado por scripts/build-ean-id-map.js).

import { XMLParser } from 'fast-xml-parser';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { config } from './lib/config.js';

function toArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function extractImages(item) {
  const images = [];
  if (item['g:image_link']) images.push(item['g:image_link']);
  for (const img of toArray(item['g:additional_image_link'])) {
    images.push(img);
  }
  return images.filter(Boolean);
}

export async function fetchSfccProducts() {
  const response = await fetch(config.sfccFeedUrl);
  if (!response.ok) {
    throw new Error(`Falha ao ir buscar o feed SFCC: HTTP ${response.status}`);
  }
  const xml = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    processEntities: {
      enabled: true,
      maxTotalExpansions: 200000,
      maxExpandedLength: 5000000,
      maxEntitySize: 50000,
    },
  });
  const parsed = parser.parse(xml);
  const items = toArray(parsed?.rss?.channel?.item);

  const productsById = {};
  for (const item of items) {
    const id = item['g:id'] || item.id;
    if (!id) continue;
    productsById[String(id)] = {
      id: String(id),
      title: item['g:title'] || item.title || '',
      link: item['link'] || item.link || null,
      images: extractImages(item),
    };
  }

  await mkdir(path.resolve('state'), { recursive: true });
  await writeFile(
    path.resolve('state/site-products-by-id.json'),
    JSON.stringify(productsById, null, 2)
  );

  return productsById;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchSfccProducts().then((products) => {
    console.log(`${Object.keys(products).length} produtos encontrados no feed SFCC.`);
  });
}
