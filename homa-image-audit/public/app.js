const state = {
  products: [],
  updatedAt: null,
  selectedEans: new Set(),
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
        `<a href="${url}" target="_blank" rel="noopener"><img src="${url}" data-fallback="true" loading="lazy" class="gallery-thumb" /></a>`
    )
    .join('')}</div>`;
}

function attachImageFallbacks(container) {
  container.querySelectorAll('img[data-fallback="true"]').forEach((img) => {
    img.addEventListener(
      'error',
      () => {
        img.style.display = 'none';
        const span = document.createElement('span');
        span.className = 'gallery-broken';
        span.title = 'imagem indisponivel';
        span.textContent = '?';
        img.insertAdjacentElement('afterend', span);
      },
      { once: true }
    );
  });
}

function updateDeleteButton() {
  const button = document.getElementById('delete-selected');
  const count = state.selectedEans.size;
  button.textContent = `Eliminar selecionados (${count})`;
  button.disabled = count === 0;
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
    body.innerHTML = `<tr><td colspan="8" class="empty-state">Sem produtos para os filtros escolhidos.</td></tr>`;
    updateDeleteButton();
    return;
  }

  body.innerHTML = filtered
    .map(
      (p) => `
      <tr>
        <td><input type="checkbox" class="row-select" data-ean="${p.ean}" ${
        state.selectedEans.has(p.ean) ? 'checked' : ''
      } /></td>
        <td>${p.ean}</td>
        <td>${p.title || '—'}</td>
        <td>${galleryCell(p.imagensNoSiteUrls)}</td>
        <td>${galleryCell(p.imagensNaKeepeekUrls)}</td>
        <td>${galleryCell(p.imagensNaEasyreaUrls)}</td>
        <td>${estadoBadge(p)}</td>
        <td><button class="btn-delete-row" data-ean="${p.ean}" title="Eliminar esta consulta">✕</button></td>
      </tr>`
    )
    .join('');

  attachImageFallbacks(body);

  body.querySelectorAll('.row-select').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const ean = checkbox.dataset.ean;
      if (checkbox.checked) {
        state.selectedEans.add(ean);
      } else {
        state.selectedEans.delete(ean);
      }
      updateDeleteButton();
    });
  });

  body.querySelectorAll('.btn-delete-row').forEach((button) => {
    button.addEventListener('click', () => {
      const ean = button.dataset.ean;
      if (confirm(`Eliminar a consulta do EAN ${ean}?`)) {
        deleteProducts([ean]);
      }
    });
  });

  updateDeleteButton();
}

async function deleteProducts(eans) {
  if (eans.length === 0) return;
  const secret = window.prompt('Palavra-passe para eliminar:');
  if (!secret) return;
  try {
    const res = await fetch('/api/delete-products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-trigger-secret': secret },
      body: JSON.stringify({ eans }),
    });
    if (!res.ok) throw new Error(await res.text());
    const eansSet = new Set(eans);
    state.products = state.products.filter((p) => !eansSet.has(p.ean));
    eans.forEach((ean) => state.selectedEans.delete(ean));
    render();
    alert(`${eans.length} consulta(s) eliminada(s) com sucesso.`);
  } catch (err) {
    alert(`Não foi possível eliminar: ${err.message}`);
  }
}

document.getElementById('search').addEventListener('input', render);
document.getElementById('filter-estado').addEventListener('change', render);
document.getElementById('ean-input').addEventListener('input', updateEanCount);

document.getElementById('select-all').addEventListener('change', (e) => {
  const query = document.getElementById('search').value;
  const filtroEstado = document.getElementById('filter-estado').value;
  const filtered = state.products.filter((p) => matchesFilters(p, query, filtroEstado));
  if (e.target.checked) {
    filtered.forEach((p) => state.selectedEans.add(p.ean));
  } else {
    filtered.forEach((p) => state.selectedEans.delete(p.ean));
  }
  render();
});

document.getElementById('delete-selected').addEventListener('click', () => {
  const eans = [...state.selectedEans];
  if (confirm(`Eliminar ${eans.length} consulta(s) selecionada(s)?`)) {
    deleteProducts(eans);
  }
});

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
    document.getElementById('ean-input').value = '';
    updateEanCount();
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
