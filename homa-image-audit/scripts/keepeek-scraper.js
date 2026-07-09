// scripts/keepeek-scraper.js
// Login automatizado na Keepeek + pesquisa de imagens por EAN.
import { chromium } from 'playwright';
import { config } from './lib/config.js';

async function login(page) {
  await page.goto(config.keepeekBaseUrl);
  await page.fill('input.kpk-input[type="text"]', config.keepeekEmail);
  await page.fill('input[type="password"]', config.keepeekPassword);
  await page.click('text=Se connecter');
  await page.waitForSelector('#kpk-query-input', { timeout: 15000 });
  console.log('URL depois do login:', page.url());
}

async function searchByEan(page, ean) {
  await page.goto(config.keepeekBaseUrl);
  await page.waitForSelector('#kpk-query-input', { timeout: 15000 });
  await page.fill('#kpk-query-input', ean);
  await page.press('#kpk-query-input', 'Enter');
  await page.waitForTimeout(3000);

  const semResultados = await page.locator('text=Aucun résultat trouvé').count();
  if (semResultados > 0) {
    return [];
  }

  const rawUrls = await page.$$eval('[style*="background-image"]', (els) =>
    els.map((el) => {
      const match = el.getAttribute('style').match(/url\(['"]?(.*?)['"]?\)/);
      return match ? match[1] : null;
    })
  );

  const imageUrls = [
    ...new Set(
      rawUrls.filter((url) => url && /\/medias\/domain\d+\/media\d+\//.test(url))
    ),
  ];

  return imageUrls;
}

export async function fetchKeepeekImages(eans) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = {};
  const errors = {};

  try {
    await login(page);
    for (const ean of eans) {
      try {
        results[ean] = await searchByEan(page, ean);
        await page.waitForTimeout(500);
      } catch (err) {
        errors[ean] = err.message;
      }
    }
  } finally {
    await browser.close();
  }

  return { results, errors };
}
