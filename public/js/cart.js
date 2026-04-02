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
      existing.existencia = parseInt(producto.existencia) || 0;
      existing.subtotal = Math.round(existing.cantidad * existing.precio_unitario * 100) / 100;
    } else {
      items.push({
        producto_id:     producto.producto_id,
        nombre_producto: producto.nombre_producto || '—',
        precio_unitario: precio,
        cantidad:        qty,
        existencia:      parseInt(producto.existencia) || 0,
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

      container.querySelectorAll('.qty-drawer-btn').forEach(btn => {
        btn.addEventListener('click', () => setQty(btn.dataset.id, btn.dataset.qty));
      });
      container.querySelectorAll('.cart-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => remove(btn.dataset.id));
      });
    }
    totalEl.textContent = formatMXN(total());

    const legendsEl = document.getElementById('cart-legends');
    if (legendsEl) {
      const cliente = typeof Auth !== 'undefined' ? Auth.getCliente() : null;
      legendsEl.innerHTML = `
        <div style="margin-bottom:4px;">* IVA incluido (8%)</div>
        <div style="margin-bottom:4px; color: ${cliente ? 'var(--verde-oscuro)' : 'inherit'}; font-weight: ${cliente ? '600' : 'normal'}">
          ${cliente ? '* Descuento de cliente ya aplicado.' : ''}
        </div>
        <div>* Sujeto a validación de disponibilidad.</div>
      `;
    }
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

// ─── Checkout: abre el modal correcto según sesión ──────────────
function openCheckout() {
  if (!Cart.count()) return;
  Cart.closeDrawer();
  const cliente = typeof Auth !== 'undefined' ? Auth.getCliente() : null;

  if (cliente) {
    // Modal cliente registrado
    const infoBox = document.getElementById('cc-info-box');
    if (infoBox) {
      infoBox.innerHTML = `
        <div style="font-weight:700; color:var(--verde-oscuro); margin-bottom:8px;">👤 Solicitud como cliente registrado</div>
        <div><strong>Nombre:</strong> ${cliente.nombre}</div>
        ${cliente.email    ? `<div><strong>Correo:</strong> ${cliente.email}</div>` : ''}
        ${cliente.telefono ? `<div><strong>Teléfono:</strong> ${cliente.telefono}</div>` : ''}
        <div style="margin-top:8px; font-size:0.8rem; color:var(--texto-suave);">Tu información de contacto ya está registrada en el sistema.</div>`;
    }
    // Resetear botón
    const btn = document.getElementById('cc-submit');
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar Solicitud de Pedido'; }

    document.getElementById('cc-notas').value = '';
    document.getElementById('checkout-cliente-error').classList.remove('visible');
    document.getElementById('checkout-cliente-success').classList.remove('visible');
    document.getElementById('checkout-cliente-overlay').classList.add('open');
  } else {
    // Modal invitado
    ['co-nombre','co-empresa','co-telefono','co-email','co-notas'].forEach(id => {
      document.getElementById(id).value = '';
    });
    // Resetear botón
    const btn = document.getElementById('co-submit');
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar Solicitud de Pedido'; }

    document.getElementById('checkout-error').classList.remove('visible');
    document.getElementById('checkout-success').classList.remove('visible');
    document.getElementById('checkout-overlay').classList.add('open');
  }
}

function closeCheckout() {
  document.getElementById('checkout-overlay').classList.remove('open');
}

function closeCheckoutCliente() {
  document.getElementById('checkout-cliente-overlay').classList.remove('open');
}

// ─── Submit Invitado ────────────────────────────────────────────
async function submitCheckout(e) {
  e.preventDefault();
  const btn   = document.getElementById('co-submit');
  const errEl = document.getElementById('checkout-error');
  const okEl  = document.getElementById('checkout-success');
  btn.disabled = true; btn.textContent = 'Enviando…';
  errEl.classList.remove('visible'); okEl.classList.remove('visible');

  const body = {
    nombre_contacto: document.getElementById('co-nombre').value.trim(),
    empresa:         document.getElementById('co-empresa').value.trim(),
    telefono:        document.getElementById('co-telefono').value.trim(),
    email:           document.getElementById('co-email').value.trim(),
    notas:           document.getElementById('co-notas').value.trim(),
    items:           Cart.getItems(),
  };

  try {
    const resp = await fetch('/api/pedidos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Error al enviar');
    okEl.textContent = data.mensaje || '¡Solicitud enviada! Nos contactaremos pronto.';
    okEl.classList.add('visible');
    Cart.clear(); btn.textContent = '¡Solicitud enviada!';
    setTimeout(closeCheckout, 3000);
  } catch(err) {
    errEl.textContent = err.message; errEl.classList.add('visible');
    btn.disabled = false; btn.textContent = 'Enviar Solicitud de Pedido';
  }
}

// ─── Submit Cliente Registrado ──────────────────────────────────
async function submitCheckoutCliente(e) {
  e.preventDefault();
  const btn   = document.getElementById('cc-submit');
  const errEl = document.getElementById('checkout-cliente-error');
  const okEl  = document.getElementById('checkout-cliente-success');
  btn.disabled = true; btn.textContent = 'Enviando…';
  errEl.classList.remove('visible'); okEl.classList.remove('visible');

  const cliente = typeof Auth !== 'undefined' ? Auth.getCliente() : null;
  if (!cliente) {
    errEl.textContent = 'Sesión expirada. Por favor inicia sesión de nuevo.';
    errEl.classList.add('visible');
    btn.disabled = false; btn.textContent = 'Enviar Solicitud de Pedido';
    return;
  }

  const body = {
    nombre_contacto: cliente.nombre,
    empresa:         cliente.nombre_comercial || '',
    telefono:        cliente.telefono || '',
    email:           cliente.email || '',
    notas:           document.getElementById('cc-notas').value.trim(),
    items:           Cart.getItems(),
  };

  const token = Auth.getToken();
  try {
    const resp = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Error al enviar');
    okEl.textContent = data.mensaje || '¡Solicitud enviada! Nuestro equipo se pondrá en contacto contigo.';
    okEl.classList.add('visible');
    Cart.clear(); btn.textContent = '¡Solicitud enviada!';
    setTimeout(closeCheckoutCliente, 3000);
  } catch(err) {
    errEl.textContent = err.message; errEl.classList.add('visible');
    btn.disabled = false; btn.textContent = 'Enviar Solicitud de Pedido';
  }
}

// ─── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Cart.updateBadge();

  document.getElementById('cart-btn')?.addEventListener('click', Cart.openDrawer);
  document.getElementById('cart-overlay')?.addEventListener('click', Cart.closeDrawer);
  document.getElementById('cart-close')?.addEventListener('click', Cart.closeDrawer);

  // Modal invitado
  document.getElementById('checkout-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeCheckout();
  });
  document.getElementById('checkout-close')?.addEventListener('click', closeCheckout);
  document.getElementById('checkout-form')?.addEventListener('submit', submitCheckout);

  // Modal cliente registrado
  document.getElementById('checkout-cliente-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeCheckoutCliente();
  });
  document.getElementById('checkout-cliente-close')?.addEventListener('click', closeCheckoutCliente);
  document.getElementById('checkout-cliente-form')?.addEventListener('submit', submitCheckoutCliente);

  document.getElementById('cart-checkout-btn')?.addEventListener('click', openCheckout);
});
