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
function withIVA(precio, esAlimento) {
  if (esAlimento) return Math.round(precio * 100) / 100; // exento de IVA
  return Math.round(precio * IVA * 100) / 100;
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
  const res = await fetch(url);
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
  // Busca en el servidor por nombre o CVE_ART
  const enc = encodeURIComponent(termino);
  const [porNombre, porCve] = await Promise.all([
    fetchJSON(`${API}/api/productos?q=${enc}`),
    fetchJSON(`${API}/api/productos?cve=${enc}`),
  ]);
  // Unir resultados y quitar duplicados
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

  grid.innerHTML = lista.map(p => `
    <article class="product-card" tabindex="0" aria-label="${p.nombre}">
      <div class="product-card__img">
        ${p.imagen_url
          ? `<img src="${p.imagen_url}" alt="${p.nombre}" loading="lazy"
               onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('span'),{textContent:'\ud83d\udce6',style:'font-size:3.5rem'}))" />`
          : `<span style="font-size:3.5rem">\ud83d\udce6</span>`}

      </div>
      <div class="product-card__body">
        <div class="product-card__cve">CVE: ${p.id}</div>
        <div class="product-card__name">${p.nombre}</div>
        <div class="product-card__footer">
          <div class="product-card__price">
            <span class="product-card__price-label">por ${p.unidad || 'pieza'}</span>
            <span class="product-card__price-value">${formatMXN(withIVA(p.precio, p.es_alimento))}</span>
          </div>
          <span class="product-card__unit">${p.unidad || 'pieza'}</span>
        </div>
      </div>
    </article>
  `).join('');
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
  grid.innerHTML = ofertas.map(o => `
    <div class="oferta-card">
      <span class="oferta-card__badge">${o.badge || '% OFF'}</span>
      <div class="oferta-card__img">
        <img src="${o.imagen_url}" alt="${o.nombre_producto}"
          onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('span'),{textContent:'\ud83c\udff7\ufe0f',style:'font-size:3rem'}))"
          style="width:100%;height:100%;object-fit:contain;border-radius:8px;" />
      </div>
      <div class="oferta-card__product">${o.nombre_producto || ''}</div>
      <div class="oferta-card__prices">
        <span class="oferta-card__old-price">${formatMXN(withIVA(o.precio_original, o.es_alimento))}</span>
        <span class="oferta-card__new-price">${formatMXN(Math.round(withIVA(o.precio_original, o.es_alimento) * (1 - o.descuento_pct / 100) * 100) / 100)}</span>
      </div>
      <div class="oferta-card__desc">${o.descripcion || ''}</div>
      <div class="oferta-card__vigencia">
        📅 ${fmtFecha(o.fecha_ini)} → <strong>${fmtFecha(o.fecha_fin)}</strong>
      </div>
    </div>`
  ).join('');
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
    state.productos = shuffle(productos); // aleatorio en cada carga
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
