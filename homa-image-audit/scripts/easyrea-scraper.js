// scripts/easyrea-scraper.js
// Login automatizado na EasyRE@ + pesquisa de imagens por EAN.
import { chromium } from 'playwright';
import { config } from './lib/config.js';

async function login(page) {
  await page.goto(config.easyreaBaseUrl);
  await page.waitForTimeout(1500);
  await page.fill('#login', config.easyreaUsername);
  await page.fill('#password', config.easyreaPassword);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
}

async function searchByEan(page, ean) {
  await page.fill('input[placeholder="Search a product"]', ean);
  await page.press('input[placeholder="Search a product"]', 'Enter');
  await page.waitForTimeout(3000);

  const semResultados = await page.locator('text=0 product').count();
  if (semResultados > 0) {
    return [];
  }

  const seletorLinha =
    '#view > div > div > div.wrapper.style-new-skin.ng-scope > div.ng-scope > section > div > div > table > tbody > tr';

  const existeLinha = await page.locator(seletorLinha).count();
  if (existeLinha === 0) {
    return [];
  }

  await page.locator(seletorLinha).first().click();
  await page.waitForTimeout(3000);

  const rawUrls = await page.$$eval('img[src]', (imgs) => imgs.map((img) => img.src));
  const imageUrls = [...new Set(rawUrls.filter((url) => url.includes('media.jja-sa.com')))];

  if (await page.locator('.close, [class*="close"]').count() > 0) {
    try {
      await page.locator('.close, [class*="close"]').first().click();
      await page.waitForTimeout(500);
    } catch {
      // se não conseguir fechar, a próxima pesquisa substitui a mesma na mesma
    }
  }

  return imageUrls;
}

export async function fetchEasyreaImages(eans) {
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
