// scripts/keepeek-scraper.js
// Login automatizado na Keepeek + pesquisa de imagens por EAN.
//
// IMPORTANTE: os seletores abaixo são placeholders. Antes de correr isto a
// sério, inspeciona (botão direito → inspecionar elemento) o formulário de
// login e a pesquisa avançada na tua instância Keepeek, e ajusta cada ponto
// marcado com TODO. Sem isso, o script vai falhar — é normal, é o esperado
// num primeiro rascunho, já que não temos acesso à vossa instância.

import { chromium } from 'playwright';
import { config } from './lib/config.js';

async function login(page) {
  await page.goto(`${config.keepeekBaseUrl}/login`); // TODO: confirmar URL de login

  // TODO: confirmar os seletores reais dos campos de email/password e do botão
  await page.fill('input[name="email"]', config.keepeekEmail);
  await page.fill('input[name="password"]', config.keepeekPassword);
  await page.click('button[type="submit"]');

  await page.waitForLoadState('networkidle');
}

async function searchByEan(page, ean) {
  // TODO: ajustar ao URL/estrutura real da pesquisa avançada da Keepeek.
  // Muitas instâncias Keepeek suportam pesquisa por metadados via query
  // string, por exemplo:
  //   `${baseUrl}/search?field=${config.keepeekEanField}&value=${ean}`
  // Se a tua instância só permitir pesquisa via caixa de texto (sem query
  // string dedicada), troca este goto por um fill() + Enter na caixa de
  // pesquisa da interface.
  const searchUrl = `${config.keepeekBaseUrl}/search?${config.keepeekEanField}=${encodeURIComponent(
    ean
  )}`;
  await page.goto(searchUrl);
  await page.waitForLoadState('networkidle');

  // TODO: confirmar o seletor real das miniaturas nos resultados de pesquisa
  const imageUrls = await page.$$eval('.media-thumbnail img', (imgs) =>
    imgs.map((img) => img.src)
  );

  return imageUrls;
}

// Faz login uma única vez e pesquisa uma lista de EAN em sequência (nunca
// mais do que o lote que lhe é passado — o controlo de "no máximo 100 de
// cada vez" já vem feito por quem chama esta função, ver run-batch.js).
// Devolve { results: { [ean]: string[] }, errors: { [ean]: string } }
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
        // Pequena pausa entre pesquisas para não sobrecarregar a sessão.
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
