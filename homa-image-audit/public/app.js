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

function categoryTag(product, categoria) {
  const ok = product.categoriasEncontradas?.includes(categoria);
  return `<span class="tag ${ok ? 'tag--ok' : 'tag--missing'}">${ok ? 'tem' : 'falta'}</span>`;
}

function matchesFilters(product, query, categoriaFiltro) {
  const q = query.trim().toLowerCase();
  const matchesQuery =
    !q ||
    product.ean.toLowerCase().includes(q) ||
    (product.title || '').toLowerCase().includes(q);

  const matchesCategoria = !categoriaFiltro || product.categoriasEmFalta.includes(categoriaFiltro);

  return matchesQuery && matchesCategoria;
}

function render() {
  const query = document.getElementById('search').value;
  const categoriaFiltro = document.getElementById('filter-categoria').value;

  const filtered = state.products.filter((p) => matchesFilters(p, query, categoriaFiltro));

  document.getElementById('stat-total').textContent = state.products.length;
  document.getElementById('stat-completos').textContent = state.products.filter(
    (p) => p.completo
  ).length;
  document.getElementById('stat-em-falta').textContent = state.products.filter(
    (p) => !p.completo
  ).length;
  document.getElementById('last-updated').textContent = formatDate(state.updatedAt);

  const body = document.getElementById('products-body');

  if (filtered.length === 0) {
    body.innerHTML = `<tr><td colspan="7" class="empty-state">Sem produtos para os filtros escolhidos.</td></tr>`;
    return;
  }

  body.innerHTML = filtered
    .map(
      (p) => `
      <tr>
        <td>${p.thumbnail ? `<img class="thumb" src="${p.thumbnail}" alt="" loading="lazy" />` : ''}</td>
        <td>${p.ean}</td>
        <td>${p.title || '—'}</td>
        <td>${categoryTag(p, 'produto')}</td>
        <td>${categoryTag(p, 'close-up')}</td>
        <td>${categoryTag(p, 'ambiente')}</td>
        <td><span class="badge ${p.completo ? 'badge--completo' : 'badge--pendente'}">${
        p.completo ? 'completo' : 'a gerar'
      }</span></td>
      </tr>`
    )
    .join('');
}

document.getElementById('search').addEventListener('input', render);
document.getElementById('filter-categoria').addEventListener('change', render);

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
  } catch (err) {
    alert(`Não foi possível disparar a verificação: ${err.message}`);
  } finally {
    button.disabled = false;
    button.textContent = 'Verificar estes EAN';
  }
});

loadData();
