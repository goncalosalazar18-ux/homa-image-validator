const state = {
  products: [],
  updatedAt: null,
};

async function loadData() {
  const res = await fetch(`data/produtos.json?t=${Date.now()}`);
  const data = await res.json();
  state.products = data.products || [];
  state.updatedAt = data.updatedAt;
  render();
}

function formatDate(iso) {
  if (!iso) return 'ainda sem dados';
  const date = new Date(iso);
  return `atualizado ${date.toLocaleString('pt-PT')}`;
}

const MAX_EANS = 100;

function parseEanInput(raw) {
  return [...new Set(raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))];
}

function updateEanCount() {
  const eans = parseEanInput(document.getElementById('ean-input').value);
  const counter = document.getElementById('ean-count');
  counter.textContent = `${eans.length} / ${MAX_EANS} EAN`;
  counter.classList.toggle('ean-count--over', eans.length > MAX_EANS);
  return eans;
}

function matchesFilters(product, query, filtroEstado) {
  const q = query.trim().toLowerCase();
  const matchesQuery =
    !q ||
    product.ean.toLowerCase().includes(q) ||
    (product.title || '').toLowerCase().includes(q);

  let matchesEstado = true;
  if (filtroEstado === 'em-falta') {
    matchesEstado = product.diferenca > 0;
  } else if (filtroEstado === 'nao-encontrado') {
    matchesEstado = !product.encontradoNoSite;
  }

  return matchesQuery && matchesEstado;
}

function estadoBadge(product) {
  if (!product.encontradoNoSite) {
    return '<span class="badge badge--neutro">não encontrado no site</span>';
  }
  if (product.diferenca > 0) {
    return '<span class="badge badge--pendente">imagens em falta</span>';
  }
  if (product.diferenca < 0) {
    return '<span class="badge badge--completo">site tem mais imagens</span>';
  }
  return '<span class="badge badge--completo">igual nos dois lados</span>';
}

function galleryCell(urls) {
  if (!urls || urls.length === 0) {
    return '<span class="gallery-empty">— sem imagens —</span>';
  }
  return `<div class="gallery">${urls
    .map(
      (url) =>
        `<a href="${url}" target="_blank" rel="noopener"><img src="${url}" loading="lazy" class="gallery-thumb" onerror="this.style.display='none'; this.parentElement.insertAdjacentHTML('afterend', '<span class=\'gallery-broken\' title=\'imagem indisponivel\'>?</span>')" /></a>`
    )
    .join('')}</div>`;
}

function render() {
  const query = document.getElementById('search').value;
  const filtroEstado = document.getElementById('filter-estado').value;
  const filtered = state.products.filter((p) => matchesFilters(p, query, filtroEstado));

  document.getElementById('stat-total').textContent = state.products.length;
  document.getElementById('stat-em-falta').textContent = state.products.filter(
    (p) => p.diferenca > 0
  ).length;
  document.getElementById('stat-nao-encontrados').textContent = state.products.filter(
    (p) => !p.encontradoNoSite
  ).length;
  document.getElementById('last-updated').textContent = formatDate(state.updatedAt);

  const body = document.getElementById('products-body');

  if (filtered.length === 0) {
    body.innerHTML = `<tr><td colspan="5" class="empty-state">Sem produtos para os filtros escolhidos.</td></tr>`;
    return;
  }

  body.innerHTML = filtered
    .map(
      (p) => `
      <tr>
        <td>${p.ean}</td>
        <td>${p.title || '—'}</td>
        <td>${galleryCell(p.imagensNoSiteUrls)}</td>
        <td>${galleryCell(p.imagensNaKeepeekUrls)}</td>
        <td>${estadoBadge(p)}</td>
      </tr>`
    )
    .join('');
}

document.getElementById('search').addEventListener('input', render);
document.getElementById('filter-estado').addEventListener('change', render);
document.getElementById('ean-input').addEventListener('input', updateEanCount);

document.getElementById('sync-button').addEventListener('click', async () => {
  const button = document.getElementById('sync-button');
  const eans = updateEanCount();

  if (eans.length === 0) {
    alert('Cola pelo menos um EAN.');
    return;
  }
  if (eans.length > MAX_EANS) {
    alert(`Tens ${eans.length} EAN — reduz para no máximo ${MAX_EANS}.`);
    return;
  }

  const secret = window.prompt('Palavra-passe para disparar a verificação:');
  if (!secret) return;

  button.disabled = true;
  button.textContent = 'A disparar…';

  try {
    const res = await fetch('/api/trigger-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-trigger-secret': secret },
      body: JSON.stringify({ eans }),
    });
    if (!res.ok) throw new Error(await res.text());
    alert(
      `Verificação disparada para ${eans.length} EAN. Os dados demoram alguns minutos a atualizar — recarrega a página depois.`
    );
    document.getElementById('ean-input').value = '';
    updateEanCount();
  } catch (err) {
    alert(`Não foi possível disparar a verificação: ${err.message}`);
  } finally {
    button.disabled = false;
    button.textContent = 'Verificar estes EAN';
  }
});

loadData();
