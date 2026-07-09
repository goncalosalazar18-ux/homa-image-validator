// scripts/build-ean-id-map.js
// Lê um ficheiro CSV/TSV com duas colunas (Cód. Art., EAN) e gera
// data/ean-to-id.json — o mapa que a ferramenta usa para saber a que
// produto cada EAN pertence.
//
// Uso: node scripts/build-ean-id-map.js caminho/para/o/ficheiro.csv

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const inputPath = process.argv[2];

if (!inputPath) {
  console.error('Uso: node scripts/build-ean-id-map.js caminho/para/ficheiro.csv');
  process.exit(1);
}

const raw = readFileSync(inputPath, 'utf-8');
const lines = raw.split(/\r?\n/);

const isValidEan = (value) => /^\d{8,14}$/.test(value);
const isValidId = (value) => /^\d+$/.test(value);

const map = {};
const conflicts = [];
let skipped = 0;

for (const line of lines) {
  if (!line.trim()) continue;
  const parts = line.split(/\t|,|;/).map((p) => p.trim());
  if (parts.length < 2) {
    skipped++;
    continue;
  }
  const [id, ean] = parts;
  if (!isValidId(id) || !isValidEan(ean)) {
    skipped++;
    continue;
  }
  if (map[ean] && map[ean] !== id) {
    conflicts.push({ ean, existente: map[ean], novo: id });
    continue;
  }
  map[ean] = id;
}

mkdirSync(path.resolve('data'), { recursive: true });
writeFileSync(path.resolve('data/ean-to-id.json'), JSON.stringify(map, null, 2));

console.log(`Mapa gerado com ${Object.keys(map).length} EAN.`);
console.log(`${skipped} linhas ignoradas (cabeçalho, vazias ou inválidas).`);
if (conflicts.length > 0) {
  console.log(`${conflicts.length} conflitos encontrados (mesmo EAN, Cód. Art. diferente):`);
  console.log(conflicts.slice(0, 10));
}
