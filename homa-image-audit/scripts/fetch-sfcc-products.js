// scripts/fetch-sfcc-products.js
// Vai buscar o feed de produtos do SFCC e extrai EAN + imagens já existentes
// no site.
//
// TODO: este parser assume um feed estilo Google Shopping (comum em SFCC),
// com <item><g:gtin>, <g:image_link>, <g:additional_image_link>. Ajusta os
// nomes dos campos abaixo (EAN_FIELDS / extractImages) ao feed real que
// tens em SFCC — ou troca fetchSfccProducts() por uma chamada OCAPI se
// preferires ir direto à Data API em vez do feed.

import { XMLParser } from 'fast-xml-parser';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { config } from './lib/config.js';

const EAN_FIELDS = ['g:gtin', 'gtin', 'ean'];

function toArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function extractEan(item) {
  for (const field of EAN_FIELDS) {
    if (item[field]) return String(item[field]).trim();
  }
  return null;
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

  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);

  const items = toArray(parsed?.rss?.channel?.item);

  const products = items
    .map((item) => ({
      ean: extractEan(item),
      id: item['g:id'] || item.id || null,
      title: item['g:title'] || item.title || '',
      images: extractImages(item),
    }))
    .filter((p) => p.ean);

  await mkdir(path.resolve('state'), { recursive: true });
  await writeFile(
    path.resolve('state/site-products.json'),
    JSON.stringify(products, null, 2)
  );

  return products;
}

// Permite correr este ficheiro isoladamente: node scripts/fetch-sfcc-products.js
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchSfccProducts().then((products) => {
    console.log(`${products.length} produtos com EAN encontrados no feed SFCC.`);
  });
}
