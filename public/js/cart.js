/**
 * cart.js — Carrito de compras Disroga
 * Maneja: agregar/quitar items, drawer, checkout y pedido
 */

const Cart = (() => {
  let items = JSON.parse(localStorage.getItem('disroga_cart') || '[]');

  function save() {
    localStorage.setItem('disroga_cart', JSON.stringify(items));
    updateBadge();
  }

  function add(producto) {
    const precio = parseFloat(producto.precio_unitario) || 0;
    const qty    = parseInt(producto.cantidad) || 1;
    const existing = items.find(i => i.producto_id === producto.producto_id);
    if (existing) {
      existing.cantidad += qty;
      existing.subtotal = Math.round(existing.cantidad * existing.precio_unitario * 100) / 100;
    } else {
      items.push({
        producto_id:     producto.producto_id,
        nombre_producto: producto.nombre_producto || '—',
        precio_unitario: precio,
        cantidad:        qty,
        imagen_url:      producto.imagen_url || '',
        subtotal:        Math.round(qty * precio * 100) / 100,
      });
    }
    save();
    renderDrawer();
    flashCartBtn();
  }

  function remove(productoId) {
    items = items.filter(i => i.producto_id !== productoId);
    save();
    renderDrawer();
  }

  function setQty(productoId, qty) {
    qty = parseInt(qty);
    const item = items.find(i => i.producto_id === productoId);
    if (!item) return;
    if (qty <= 0) { remove(productoId); return; }
    item.cantidad = qty;
    item.subtotal = Math.round(qty * item.precio_unitario * 100) / 100;
    save();
    renderDrawer();
  }

  function clear() {
    items = [];
    save();
    renderDrawer();
  }

  function total() {
    return Math.round(items.reduce((s, i) => s + i.subtotal, 0) * 100) / 100;
  }

  function count() {
    return items.reduce((s, i) => s + i.cantidad, 0);
  }

  function updateBadge() {
    const badge = document.getElementById('cart-badge');
    if (!badge) return;
    const n = count();
    badge.textContent = n > 99 ? '99+' : n;
    badge.classList.toggle('visible', n > 0);
  }

  function flashCartBtn() {
    const btn = document.getElementById('cart-btn');
    if (!btn) return;
    btn.style.transform = 'scale(1.25)';
    setTimeout(() => { btn.style.transform = ''; }, 200);
  }

  function formatMXN(val) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);
  }

  function renderDrawer() {
    const container = document.getElementById('cart-items');
    const totalEl   = document.getElementById('cart-total');
    if (!container || !totalEl) return;

    if (!items.length) {
      container.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty__icon">🛒</div>
          <p>Tu carrito está vacío</p>
        </div>`;
    } else {
      // Usamos event delegation en lugar de onclick inline
      container.innerHTML = items.map(it => `
        <div class="cart-item" data-id="${it.producto_id}">
          <div class="cart-item__img">
            <img src="${it.imagen_url || ''}" alt="${it.nombre_producto}"
              onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('span'),{textContent:'📦',style:'font-size:1.6rem'}))" />
          </div>
          <div class="cart-item__info">
            <div class="cart-item__name">${it.nombre_producto}</div>
            <div class="cart-item__unit-price">${formatMXN(it.precio_unitario)} c/u</div>
            <div class="cart-item__price">${formatMXN(it.subtotal)}</div>
            <div class="cart-item__qty">
              <button class="qty-drawer-btn" data-action="minus" data-id="${it.producto_id}" data-qty="${it.cantidad - 1}">−</button>
              <span>${it.cantidad}</span>
              <button class="qty-drawer-btn" data-action="plus" data-id="${it.producto_id}" data-qty="${it.cantidad + 1}">+</button>
            </div>
          </div>
          <button class="cart-item__remove cart-remove-btn" data-id="${it.producto_id}" title="Eliminar">✕</button>
        </div>
      `).join('');

      // Event delegation: botones de qty y eliminar en el drawer
      container.querySelectorAll('.qty-drawer-btn').forEach(btn => {
        btn.addEventListener('click', () => setQty(btn.dataset.id, btn.dataset.qty));
      });
      container.querySelectorAll('.cart-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => remove(btn.dataset.id));
      });
    }
    totalEl.textContent = formatMXN(total());
  }

  function openDrawer() {
    renderDrawer();
    document.getElementById('cart-overlay').classList.add('open');
    document.getElementById('cart-drawer').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    document.getElementById('cart-overlay').classList.remove('open');
    document.getElementById('cart-drawer').classList.remove('open');
    document.body.style.overflow = '';
  }

  function getItems() { return [...items]; }

  return { add, remove, setQty, clear, total, count, getItems, openDrawer, closeDrawer, updateBadge, renderDrawer };
})();

// ─── Checkout Modal ──────────────────────────────────────
function openCheckout() {
  if (!Cart.count()) return;
  Cart.closeDrawer();
  const cliente = typeof Auth !== 'undefined' ? Auth.getCliente() : null;

  if (cliente) {
    document.getElementById('co-nombre').value   = cliente.nombre || '';
    document.getElementById('co-empresa').value  = cliente.nombre_comercial || '';
    document.getElementById('co-telefono').value = cliente.telefono || '';
    document.getElementById('co-email').value    = cliente.email || '';
  } else {
    ['co-nombre','co-empresa','co-telefono','co-email'].forEach(id => {
      document.getElementById(id).value = '';
    });
  }
  document.getElementById('co-notas').value = '';
  document.getElementById('checkout-error').classList.remove('visible');
  document.getElementById('checkout-success').classList.remove('visible');
  document.getElementById('checkout-overlay').classList.add('open');
}

function closeCheckout() {
  document.getElementById('checkout-overlay').classList.remove('open');
}

async function submitCheckout(e) {
  e.preventDefault();
  const btn   = document.getElementById('co-submit');
  const errEl = document.getElementById('checkout-error');
  const okEl  = document.getElementById('checkout-success');
  btn.disabled = true;
  btn.textContent = 'Enviando…';
  errEl.classList.remove('visible');
  okEl.classList.remove('visible');

  const body = {
    nombre_contacto: document.getElementById('co-nombre').value.trim(),
    empresa:         document.getElementById('co-empresa').value.trim(),
    telefono:        document.getElementById('co-telefono').value.trim(),
    email:           document.getElementById('co-email').value.trim(),
    notas:           document.getElementById('co-notas').value.trim(),
    items:           Cart.getItems(),
  };

  const token = typeof Auth !== 'undefined' ? Auth.getToken() : null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const resp = await fetch('/api/pedidos', { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Error al enviar pedido');
    okEl.textContent = data.mensaje || '¡Pedido enviado! Nos contactaremos contigo pronto.';
    okEl.classList.add('visible');
    Cart.clear();
    btn.textContent = '¡Enviado!';
    setTimeout(closeCheckout, 3000);
  } catch(err) {
    errEl.textContent = err.message;
    errEl.classList.add('visible');
    btn.disabled = false;
    btn.textContent = 'Enviar Pedido';
  }
}

// ─── Init ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Cart.updateBadge();

  document.getElementById('cart-btn')?.addEventListener('click', Cart.openDrawer);
  document.getElementById('cart-overlay')?.addEventListener('click', Cart.closeDrawer);
  document.getElementById('cart-close')?.addEventListener('click', Cart.closeDrawer);
  document.getElementById('checkout-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeCheckout();
  });
  document.getElementById('checkout-close')?.addEventListener('click', closeCheckout);
  document.getElementById('cart-checkout-btn')?.addEventListener('click', openCheckout);
  document.getElementById('checkout-form')?.addEventListener('submit', submitCheckout);
});
