// scripts/site-scraper.js
// Visita diretamente a ficha de cada produto no homa.pt (sem login) e
// extrai as imagens do carrossel principal.

import { chromium } from 'playwright';

async function acceptCookies(page) {
  try {
    await page.click('text=REJEITAR TODOS', { timeout: 5000 });
  } catch {
    // banner ja nao aparece (cookie de consentimento ja guardado) — normal
  }
}

async function extractImages(page) {
  await page.waitForSelector('[id^="pdpCarousel-"]', { timeout: 15000 });
  await page.waitForTimeout(1000);
  const rawUrls = await page.$$eval('[id^="pdpCarousel-"] img', (imgs) =>
    imgs.map((img) => {
      const src = img.getAttribute('src') || '';
      if (src.startsWith('data:')) {
        return (
          img.getAttribute('data-src') ||
          img.getAttribute('data-lazy') ||
          img.getAttribute('data-original') ||
          null
        );
      }
      return src;
    })
  );
  const absolutos = rawUrls
    .filter((url) => url && !url.startsWith('data:'))
    .map((url) => (url.startsWith('http') ? url : `https://www.homa.pt${url}`));
  return [...new Set(absolutos)];
}

// Recebe uma lista de { ean, url } (o url e a ficha do produto no site)
// e devolve { results: { [ean]: string[] }, errors: { [ean]: string } }
export async function fetchSiteImages(entries) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = {};
  const errors = {};
  try {
    for (const { ean, url } of entries) {
      try {
        await page.goto(url);
        await page.waitForTimeout(1000);
        await acceptCookies(page);
        await page.waitForTimeout(500);
        results[ean] = await extractImages(page);
      } catch (err) {
        errors[ean] = err.message;
      }
    }
  } finally {
    await browser.close();
  }
  return { results, errors };
}
