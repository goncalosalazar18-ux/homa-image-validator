// scripts/build-report.js
// Junta produtos do site + imagens da Keepeek + classificações, e calcula
// que categorias de imagem faltam por produto (EAN). Escreve o resultado
// em public/data/produtos.json — o único ficheiro que o dashboard lê.

import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { config } from './lib/config.js';

async function readJson(filePath, fallback) {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function buildReport() {
  const siteProducts = await readJson(path.resolve('state/site-products.json'), []);
  const keepeekImages = await readJson(path.resolve('state/keepeek-images.json'), {});
  const classifications = await readJson(path.resolve('state/classifications.json'), {});
  const existing = await readJson(path.resolve('public/data/produtos.json'), {
    updatedAt: null,
    products: [],
  });

  const existingByEan = new Map(existing.products.map((p) => [p.ean, p]));

  for (const product of siteProducts) {
    const allImages = [...(product.images || []), ...(keepeekImages[product.ean] || [])];

    const categoriasEncontradas = new Set();
    for (const url of allImages) {
      const category = classifications[url];
      if (category && config.requiredCategories.includes(category)) {
        categoriasEncontradas.add(category);
      }
    }

    const categoriasEmFalta = config.requiredCategories.filter(
      (c) => !categoriasEncontradas.has(c)
    );

    existingByEan.set(product.ean, {
      ean: product.ean,
      id: product.id,
      title: product.title,
      thumbnail: product.images?.[0] || allImages[0] || null,
      categoriasEncontradas: [...categoriasEncontradas],
      categoriasEmFalta,
      completo: categoriasEmFalta.length === 0,
      totalImagens: allImages.length,
    });
  }

  const report = {
    updatedAt: new Date().toISOString(),
    products: [...existingByEan.values()].sort((a, b) =>
      (a.title || '').localeCompare(b.title || '')
    ),
  };

  await mkdir(path.resolve('public/data'), { recursive: true });
  await writeFile(path.resolve('public/data/produtos.json'), JSON.stringify(report, null, 2));

  return report;
}
