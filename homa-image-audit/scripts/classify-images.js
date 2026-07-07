// scripts/classify-images.js
// Classifica imagens em "produto", "close-up" ou "ambiente" usando a API da
// Anthropic. Usa uma cache em disco para nunca reclassificar a mesma
// imagem duas vezes — importante para manter o custo baixo a 3000+ EAN.

import Anthropic from '@anthropic-ai/sdk';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { config } from './lib/config.js';

const CACHE_PATH = path.resolve('state/classifications.json');
const CATEGORIES = ['produto', 'close-up', 'ambiente'];

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

async function loadCache() {
  try {
    const raw = await readFile(CACHE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveCache(cache) {
  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function imageUrlToBase64(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Não consegui ir buscar a imagem: HTTP ${response.status}`);
  }
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await response.arrayBuffer());
  return { base64: buffer.toString('base64'), mediaType: contentType };
}

async function classifyOne(url) {
  const { base64, mediaType } = await imageUrlToBase64(url);

  const message = await anthropic.messages.create({
    model: config.classificationModel,
    max_tokens: 10,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text:
              'Classifica esta imagem de produto de e-commerce em exatamente uma ' +
              'destas categorias: produto (fundo neutro tipo packshot), close-up ' +
              '(detalhe/textura do produto), ambiente (produto num contexto/lifestyle). ' +
              'Responde só com a palavra da categoria, sem mais nada.',
          },
        ],
      },
    ],
  });

  const raw = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim()
    .toLowerCase();

  return CATEGORIES.find((c) => raw.includes(c)) || 'desconhecido';
}

// Recebe uma lista de URLs de imagem, classifica só as que ainda não estão
// em cache, e devolve o mapa completo { [url]: categoria }.
export async function classifyImages(imageUrls) {
  const cache = await loadCache();
  const unique = [...new Set(imageUrls)];
  const toClassify = unique.filter((url) => !cache[url]);

  for (const url of toClassify) {
    try {
      cache[url] = await classifyOne(url);
    } catch (err) {
      cache[url] = 'erro';
      console.error(`Erro a classificar ${url}: ${err.message}`);
    }
  }

  await saveCache(cache);
  return cache;
}
