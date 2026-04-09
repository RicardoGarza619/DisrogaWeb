/**
 * Disroga S.A. de C.V. – main.js
 */

const API = '';
const PRODUCTOS_INICIAL = 24;
const IVA = 1.08; // 8% IVA

const state = {
  productos: [],
  ofertas: [],
};

// ─── Utilidades ────────────────────────────────
function formatMXN(val) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
}
// El servidor ya calcula el precio correcto (IVA + margen o descuento)
function withIVA(precio) {
  return Math.round(precio * 100) / 100;
}
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
async function fetchJSON(url) {
  const token = typeof Auth !== 'undefined' ? Auth.getToken() : null;
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Tema oscuro/claro ───────────────────────────
const themeBtn = document.getElementById('theme-toggle');
function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  localStorage.setItem('theme', dark ? 'dark' : 'light');
}
// Restaurar tema guardado
const savedTheme = localStorage.getItem('theme');
applyTheme(savedTheme === 'dark');
themeBtn.addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  applyTheme(!isDark);
});

// ─── Navbar scroll ─────────────────────────────
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 20);
});

// ─── Hamburger ─────────────────────────────────
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('nav-menu').classList.toggle('open');
});

// ─── Logo fallback ─────────────────────────────
document.querySelectorAll('#logo-img, #footer-logo').forEach(img => {
  img.onerror = () => {
    const span = document.createElement('span');
    span.style.cssText = 'font-size:1.4rem;font-weight:800;color:var(--verde-oscuro);letter-spacing:-0.03em;';
    span.innerHTML = '<span style="color:var(--verde-lima)">D</span>isroga';
    img.replaceWith(span);
  };
});

// ─── Hero cards ─────────────────────────────────
function renderHeroCards(productos) {
  const container = document.getElementById('hero-cards');
  if (!container) return;
  container.innerHTML = productos.slice(0, 3).map(p => `
    <div class="hero__card-float">
      <span class="card-icon">📦</span>
      <span class="card-name">${p.nombre.length > 22 ? p.nombre.substring(0, 22) + '…' : p.nombre}</span>
      <span class="card-price">${formatMXN(p.precio)}</span>
    </div>
  `).join('');
}

// ─── Searchbar ─────────────────────────────
let searchMode = false;

async function fetchSearch(termino) {
  const enc = encodeURIComponent(termino);
  const [porNombre, porCve] = await Promise.all([
    fetchJSON(`${API}/api/productos?q=${enc}`),
    fetchJSON(`${API}/api/productos?cve=${enc}`),
  ]);
  const map = new Map();
  [...porNombre, ...porCve].forEach(p => map.set(p.id, p));
  return [...map.values()];
}

const handleSearch = debounce(async function (e) {
  const termino = e.target.value.trim();
  if (!termino) {
    searchMode = false;
    renderProductos(state.productos.slice(0, PRODUCTOS_INICIAL));
    return;
  }
  searchMode = true;
  try {
    const resultados = await fetchSearch(termino);
    renderProductos(resultados);
  } catch(err) {
    console.error('Error en búsqueda:', err);
  }
}, 350);

document.getElementById('search-input').addEventListener('input', handleSearch);

// Limpiar con Escape
document.getElementById('search-input').addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    this.value = '';
    searchMode = false;
    renderProductos(state.productos.slice(0, PRODUCTOS_INICIAL));
  }
});

// ─── Productos ─────────────────────────────────
function renderProductos(lista) {
  const grid = document.getElementById('products-grid');

  if (!lista || !lista.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🔍</div>
        <div class="empty-state__text">No se encontraron productos. Intenta con otro término.</div>
      </div>`;
    return;
  }

  grid.innerHTML = lista.map(p => {
    const of = (state.ofertas || []).find(o => o.producto_id === p.id);
    const pOrig  = parseFloat(p.precio) || 0;
    let pMostrar = pOrig;
    let lblOferta = '';

    if (of) {
      const pFinal = parseFloat(of.precio_final) || 0;
      if (pFinal > 0 && pFinal < pOrig) {
        pMostrar = pFinal;
        const pctTotal = Math.round((1 - pFinal / pOrig) * 100);
        lblOferta = `<div style="font-size:0.75rem; color:var(--rojo-cancel); font-weight:bold; margin-bottom: 2px;">-${pctTotal}% OFF (<del style="color:var(--texto-suave);">${formatMXN(pOrig)}</del>)</div>`;
      }
    }

    return `
    <article class="product-card" tabindex="0" aria-label="${p.nombre}">
      <div class="product-card__img">
        ${p.imagen_url
          ? `<img src="${p.imagen_url}" alt="${p.nombre}" loading="lazy"
               onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('span'),{textContent:'\u{1F4E6}',style:'font-size:3.5rem'}))" />`
          : `<span style="font-size:3.5rem">\u{1F4E6}</span>`}
      </div>
      <div class="product-card__body">
        <div class="product-card__cve">CVE: ${p.id}</div>
        <div class="product-card__name">${p.nombre}</div>
        <div class="product-card__footer">
          <div class="product-card__price">
            ${lblOferta}
            <span class="product-card__price-label">por ${p.unidad || 'pieza'}</span>
            <span class="product-card__price-value">${formatMXN(pMostrar)}</span>
          </div>
          <span class="product-card__unit">${p.unidad || 'pieza'}</span>
        </div>
        <div class="add-to-cart-row">
          <div class="card-qty-control">
            <button class="card-qty-btn" data-action="minus">−</button>
            <input type="number" class="card-qty-input" value="1" min="1" max="999">
            <button class="card-qty-btn" data-action="plus">+</button>
          </div>
          <button class="btn-add-cart"
            data-id="${p.id}"
            data-precio="${pMostrar}"
            data-img="${p.imagen_url || ''}"
            data-nombre="${p.nombre.replace(/"/g, '&quot;')}"
            data-exist="${p.existencia || 0}"
            aria-label="Agregar al carrito">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            Agregar
          </button>
        </div>
      </div>
    </article>`;
  }).join('');

  // Event delegation para botones de carrito en productos
  grid.querySelectorAll('.add-to-cart-row').forEach(row => {
    const qtyInput = row.querySelector('.card-qty-input');
    const addBtn   = row.querySelector('.btn-add-cart');

    row.querySelectorAll('.card-qty-btn').forEach(qBtn => {
      qBtn.addEventListener('click', () => {
        let v = parseInt(qtyInput.value) || 1;
        v = qBtn.dataset.action === 'plus' ? v + 1 : Math.max(1, v - 1);
        qtyInput.value = v;
      });
    });

    addBtn.addEventListener('click', () => {
      Cart.add({
        producto_id:     addBtn.dataset.id,
        nombre_producto: addBtn.dataset.nombre,
        precio_unitario: parseFloat(addBtn.dataset.precio),
        imagen_url:      addBtn.dataset.img,
        cantidad:        parseInt(qtyInput.value) || 1,
        existencia:      parseInt(addBtn.dataset.exist) || 0,
      });
      qtyInput.value = 1; // reset
    });
  });
}

// ─── Ofertas ─────────────────────────────────
function fmtFecha(iso) {
  if (!iso) return '';
  const [y,m,d] = iso.split('-');
  const meses = ['','ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(d)} ${meses[parseInt(m)]} ${y}`;
}

function renderOfertas(ofertas) {
  const grid = document.getElementById('ofertas-grid');
  if (!ofertas || !ofertas.length) {
    grid.innerHTML = `<p style="color:rgba(255,255,255,0.5);padding:20px">Sin ofertas vigentes en este momento.</p>`;
    return;
  }

  grid.innerHTML = ofertas.map(o => {
    const pOrig  = parseFloat(o.precio_original) || 0;
    const pFinal = parseFloat(o.precio_final)    || 0;
    const tieneDescuento = pFinal > 0 && pFinal < pOrig;

    // Un badge individual por cada política, apilados en la esquina superior
    const badgesHTML = (o.politicas || []).map(pol =>
      `<span class="oferta-badge${pol.por_cantidad ? ' oferta-badge--cantidad' : ''}">${pol.badge}</span>`
    ).join('');

    // Nota "hasta agotar" si alguna política es por cantidad
    const hasCantidad = (o.politicas || []).some(p => p.por_cantidad);
    const cantidadNote = hasCantidad
      ? `<div class="oferta-card__cantidad-note">⏳ Hasta agotar existencia</div>`
      : '';

    const preciosHTML = tieneDescuento ? `
      <div class="oferta-card__prices">
        <span class="oferta-card__old-price">${formatMXN(pOrig)}</span>
        <span class="oferta-card__new-price">${formatMXN(pFinal)}</span>
      </div>
      ${o.politicas && o.politicas.length > 1 ? `<div class="oferta-card__acum-note">Precio con ${o.politicas.length} ofertas aplicadas</div>` : ''}` : `
      <div class="oferta-card__prices">
        <span class="oferta-card__new-price">${formatMXN(pFinal)}</span>
      </div>`;

    return `
    <div class="oferta-card">
      <div class="oferta-card__badges">${badgesHTML}</div>
      <div class="oferta-card__img">
        <img src="${o.imagen_url}" alt="${o.nombre_producto}"
          onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('span'),{textContent:'\u{1F3F7}\uFE0F',style:'font-size:3rem'}))"
          style="width:100%;height:100%;object-fit:contain;border-radius:8px;" />
      </div>
      <div class="oferta-card__product">${o.nombre_producto || ''}</div>
      ${cantidadNote}
      ${preciosHTML}
      <div class="add-to-cart-row">
        <div class="card-qty-control">
          <button class="card-qty-btn" data-action="minus">−</button>
          <input type="number" class="card-qty-input" value="1" min="1" max="999">
          <button class="card-qty-btn" data-action="plus">+</button>
        </div>
        <button class="btn-add-cart"
          data-id="${o.producto_id}"
          data-precio="${pFinal}"
          data-img="${o.imagen_url || ''}"
          data-nombre="${(o.nombre_producto || '').replace(/"/g, '&quot;')}"
          data-exist="${o.existencia || 0}"
          aria-label="Agregar al carrito">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          Agregar
        </button>
      </div>
    </div>`;
  }).join('');

  // Event delegation para botones de carrito en ofertas
  grid.querySelectorAll('.add-to-cart-row').forEach(row => {
    const qtyInput = row.querySelector('.card-qty-input');
    const addBtn   = row.querySelector('.btn-add-cart');

    row.querySelectorAll('.card-qty-btn').forEach(qBtn => {
      qBtn.addEventListener('click', () => {
        let v = parseInt(qtyInput.value) || 1;
        v = qBtn.dataset.action === 'plus' ? v + 1 : Math.max(1, v - 1);
        qtyInput.value = v;
      });
    });

    addBtn.addEventListener('click', () => {
      Cart.add({
        producto_id:     addBtn.dataset.id,
        nombre_producto: addBtn.dataset.nombre,
        precio_unitario: parseFloat(addBtn.dataset.precio),
        imagen_url:      addBtn.dataset.img,
        cantidad:        parseInt(qtyInput.value) || 1,
        existencia:      parseInt(addBtn.dataset.exist) || 0,
      });
      qtyInput.value = 1;
    });
  });
}

// Búsqueda en ofertas desde servidor
const handleOfertasSearch = debounce(async function (e) {
  const termino = e.target.value.trim();
  try {
    const url = termino ? `${API}/api/ofertas?q=${encodeURIComponent(termino)}` : `${API}/api/ofertas`;
    const resultados = await fetchJSON(url);
    renderOfertas(resultados);
  } catch(err) { console.error('Error búsqueda ofertas:', err); }
}, 350);

document.getElementById('ofertas-search-input')
  .addEventListener('input', handleOfertasSearch);

// ─── Init ──────────────────────────────────────
async function init() {
  try {
    const [productos, ofertas] = await Promise.all([
      fetchJSON(`${API}/api/productos`),
      fetchJSON(`${API}/api/ofertas`),
    ]);
    state.productos = shuffle(productos);
    state.ofertas = ofertas;
    renderProductos(state.productos.slice(0, PRODUCTOS_INICIAL));
    renderOfertas(ofertas);
    renderHeroCards(productos);
  } catch (err) {
    console.error('Error al cargar datos:', err);
    document.getElementById('products-grid').innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <div class="empty-state__text">Error al cargar productos. Verifica que el servidor esté activo.</div>
      </div>`;
  }
}

document.addEventListener('DOMContentLoaded', init);
