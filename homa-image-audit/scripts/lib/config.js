// scripts/lib/config.js
// Configuração central lida a partir de variáveis de ambiente / secrets.
// Nunca colocar valores reais aqui — tudo vem de secrets do GitHub Actions
// (produção) ou de um ficheiro .env local (desenvolvimento, nunca commitado).

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente em falta: ${name}`);
  }
  return value;
}

export const config = {
  // Feed de produtos SFCC (XML, formato tipo Google Shopping / Demandware).
  sfccFeedUrl: process.env.SFCC_FEED_URL || '',

  // Keepeek
  keepeekBaseUrl: process.env.KEEPEEK_BASE_URL || '',
  keepeekEmail: process.env.KEEPEEK_EMAIL || '',
  keepeekPassword: process.env.KEEPEEK_PASSWORD || '',
  // Nome do campo de metadados onde o EAN está guardado na Keepeek.
  // TODO: confirmar o nome exato inspecionando a pesquisa avançada na Keepeek.
  keepeekEanField: process.env.KEEPEEK_EAN_FIELD || 'ean',

  // Anthropic (classificação de imagens)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  classificationModel: 'claude-haiku-4-5-20251001',

  // Nunca processar mais do que isto numa única corrida.
  batchSize: parseInt(process.env.BATCH_SIZE || '100', 10),

  // Categorias de imagem que queremos garantir para cada produto.
  requiredCategories: ['produto', 'close-up', 'ambiente'],
};

export function assertRuntimeConfig() {
  required('SFCC_FEED_URL');
  required('KEEPEEK_BASE_URL');
  required('KEEPEEK_EMAIL');
  required('KEEPEEK_PASSWORD');
}
