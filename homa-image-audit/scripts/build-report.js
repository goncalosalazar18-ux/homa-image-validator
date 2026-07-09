// scripts/build-report.js
// Junta produtos do site (por Cód. Art.) com imagens da Keepeek (por EAN),
// e compara quantas imagens existem em cada lado — sem classificação por
// categoria, só contagem.

import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

async function readJson(filePath, fallback) {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function buildReport({ eans, eanToId, productsById }) {
  const keepeekImages = await readJson(path.resolve('state/keepeek-images.json'), {});
  const existing = await readJson(path.resolve('public/data/produtos.json'), {
    updatedAt: null,
    products: [],
  });
  const existingByEan = new Map(existing.products.map((p) => [p.ean, p]));

  for (const ean of eans) {
    const id = eanToId[ean];
    const siteProduct = productsById[id];
    const siteImages = siteProduct?.images || [];
    const keepeekImagesForEan = keepeekImages[ean] || [];

    existingByEan.set(ean, {
      ean,
      id: id || null,
      title: siteProduct?.title || null,
      thumbnail: siteImages[0] || keepeekImagesForEan[0] || null,
      imagensNoSite: siteImages.length,
      imagensNaKeepeek: keepeekImagesForEan.length,
      diferenca: keepeekImagesForEan.length - siteImages.length,
      encontradoNoSite: Boolean(siteProduct),
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
