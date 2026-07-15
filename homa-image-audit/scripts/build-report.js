// scripts/build-report.js
// Junta imagens do site, da Keepeek e da EasyRE@ (todas por EAN, exceto
// o site que usa o link do feed apenas para navegar ate a ficha).

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
  const siteImages = await readJson(path.resolve('state/site-images.json'), {});
  const keepeekImages = await readJson(path.resolve('state/keepeek-images.json'), {});
  const easyreaImages = await readJson(path.resolve('state/easyrea-images.json'), {});

  const existing = await readJson(path.resolve('public/data/produtos.json'), {
    updatedAt: null,
    products: [],
  });

  const existingByEan = new Map(existing.products.map((p) => [p.ean, p]));

  for (const ean of eans) {
    const id = eanToId[ean];
    const siteProduct = productsById[id];
    const siteImagesForEan = siteImages[ean] || [];
    const keepeekImagesForEan = keepeekImages[ean] || [];
    const easyreaImagesForEan = easyreaImages[ean] || [];

    existingByEan.set(ean, {
      ean,
      id: id || null,
      title: siteProduct?.title || null,
      imagensNoSite: siteImagesForEan.length,
      imagensNaKeepeek: keepeekImagesForEan.length,
      imagensNaEasyrea: easyreaImagesForEan.length,
      imagensNoSiteUrls: siteImagesForEan,
      imagensNaKeepeekUrls: keepeekImagesForEan,
      imagensNaEasyreaUrls: easyreaImagesForEan,
      diferenca: keepeekImagesForEan.length - siteImagesForEan.length,
      encontradoNoSite: Boolean(siteProduct?.link),
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
