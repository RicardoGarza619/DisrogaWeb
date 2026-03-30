/**
 * auth.js — Autenticación de clientes Disroga
 * Login, set-password y recuperar contraseña
 */

const Auth = (() => {
  const KEY_TOKEN   = 'disroga_token';
  const KEY_CLIENTE = 'disroga_cliente';

  function getToken()   { return localStorage.getItem(KEY_TOKEN); }
  function getCliente() {
    try { return JSON.parse(localStorage.getItem(KEY_CLIENTE)); }
    catch { return null; }
  }

  function save(token, cliente) {
    localStorage.setItem(KEY_TOKEN, token);
    localStorage.setItem(KEY_CLIENTE, JSON.stringify(cliente));
    renderNavbar();
  }

  function logout() {
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_CLIENTE);
    renderNavbar();
    // Recargar productos para mostrar precios con margen de invitado
    if (typeof init === 'function') location.reload();
  }

  function renderNavbar() {
    const cliente    = getCliente();
    const authArea   = document.getElementById('navbar-auth-area');
    if (!authArea) return;

    if (cliente) {
      authArea.innerHTML = `
        <div class="navbar__user-info" onclick="openProfileModal()" style="display:flex;align-items:center;gap:6px;cursor:pointer;color:var(--texto-medio);transition:var(--transicion);" title="Ver Perfil">
          <svg style="color:var(--verde-oscuro); transition: color 0.3s;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
            <path d="M12 2C8.686 2 6 4.686 6 8C6 11.314 8.686 14 12 14C15.314 14 18 11.314 18 8C18 4.686 15.314 2 12 2ZM4 20C4 16.686 6.686 14 10 14H14C17.314 14 20 16.686 20 20V22H4V20Z"/>
          </svg>
          <span style="font-weight:600;font-size:0.9rem;">${cliente.nombre.split(' ')[0]}</span>
          ${cliente.descuento > 0 ? `<span class="precio-descuento" style="margin-left:4px;">${cliente.descuento}% Off</span>` : ''}
        </div>
        <button class="navbar__logout" onclick="Auth.logout()" style="margin-left:8px;">Salir</button>`;
    } else {
      authArea.innerHTML = `
        <button class="btn-auth-open" onclick="openAuthModal()" style="background:none;border:1.5px solid var(--gris-borde);border-radius:var(--radio-pill);padding:6px 14px;font-size:0.85rem;font-weight:600;cursor:pointer;color:var(--texto-medio);transition:var(--transicion)">
          Iniciar Sesión
        </button>`;
    }
  }

  return { getToken, getCliente, save, logout, renderNavbar };
})();

// ─── Abrir / cerrar modal de auth ───────────────────────
function openAuthModal(tab) {
  document.getElementById('auth-overlay').classList.add('open');
  if (tab) switchAuthTab(tab);
}
function closeAuthModal() {
  document.getElementById('auth-overlay').classList.remove('open');
  clearAuthErrors();
}
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-panel').forEach(p => p.style.display = 'none');
  document.querySelector(`.auth-tab[data-tab="${tab}"]`)?.classList.add('active');
  document.getElementById(`auth-panel-${tab}`).style.display = 'block';
  clearAuthErrors();
}
function clearAuthErrors() {
  document.querySelectorAll('.form-error, .form-success').forEach(el => el.classList.remove('visible'));
}

// ─── Modal Perfil ─────────────────────────
async function openProfileModal() {
  document.getElementById('profile-overlay').classList.add('open');
  const content = document.getElementById('profile-content');
  const token = Auth.getToken();
  if (!token) {
    content.innerHTML = '<div style="color:var(--rojo-cancel); padding:20px; text-align:center;">Sesión no válida</div>';
    return;
  }

  content.innerHTML = '<div style="text-align:center; padding: 20px;">Cargando información...</div>';

  try {
    const resp = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!resp.ok) throw new Error('Error al cargar la cuenta');
    const { cliente } = await resp.json();
    content.innerHTML = `
      <div style="font-size:0.95rem; line-height:1.8; color: var(--texto-medio);">
        <p><strong>Clave:</strong> ${cliente.clave}</p>
        <p><strong>Nombre:</strong> ${cliente.nombre}</p>
        <p><strong>Empresa/Comercial:</strong> ${cliente.nombre_comercial || 'N/D'}</p>
        <p><strong>RFC:</strong> ${cliente.rfc || 'N/D'}</p>
        <p><strong>Correo:</strong> ${cliente.email || 'N/D'}</p>
        <p><strong>Teléfono:</strong> ${cliente.telefono || 'N/D'}</p>
        <hr style="border:none; border-top:1px solid var(--gris-borde); margin: 12px 0;">
        <p style="color:var(--verde-oscuro)"><strong>Descuento Cliente:</strong> ${cliente.descuento}%</p>
        <p><strong>Límite de Crédito:</strong> ${parseFloat(cliente.limite_credito || 0) > 0 ? '$' + parseFloat(cliente.limite_credito).toFixed(2) : 'Sin límite o contado'}</p>
        <p><strong>Saldo Actual:</strong> <span style="${parseFloat(cliente.saldo || 0) > 0 ? 'color:var(--rojo-cancel);font-weight:bold;' : ''}">$${parseFloat(cliente.saldo || 0).toFixed(2)}</span></p>
      </div>`;
  } catch (err) {
    content.innerHTML = `<div style="color:var(--rojo-cancel); padding:20px; text-align:center;">${err.message}</div>`;
  }
}

function closeProfileModal() {
  document.getElementById('profile-overlay').classList.remove('open');
}

// ─── Login ───────────────────────────────────────────────
async function submitLogin(e) {
  e.preventDefault();
  const btn   = document.getElementById('login-submit');
  const errEl = document.getElementById('login-error');
  errEl.classList.remove('visible');
  btn.disabled = true; btn.textContent = 'Verificando…';

  const clave    = document.getElementById('login-clave').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave, password }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      if (data.error === 'sin_password') {
        closeAuthModal();
        openAuthModal('set-password');
        document.getElementById('sp-clave').value = clave;
        return;
      }
      throw new Error(data.error || 'Error al iniciar sesión');
    }
    Auth.save(data.token, data.cliente);
    closeAuthModal();
    location.reload(); // recargar para precios de cliente
  } catch(err) {
    errEl.textContent = err.message;
    errEl.classList.add('visible');
  } finally {
    btn.disabled = false; btn.textContent = 'Iniciar Sesión';
  }
}

// ─── Set password (primera vez) ──────────────────────────
async function submitSetPassword(e) {
  e.preventDefault();
  const btn   = document.getElementById('sp-submit');
  const errEl = document.getElementById('sp-error');
  const okEl  = document.getElementById('sp-success');
  errEl.classList.remove('visible'); okEl.classList.remove('visible');

  const clave    = document.getElementById('sp-clave').value.trim();
  const email    = document.getElementById('sp-email').value.trim();
  const password = document.getElementById('sp-password').value;
  const confirm  = document.getElementById('sp-confirm').value;

  if (password !== confirm) {
    errEl.textContent = 'Las contraseñas no coinciden';
    errEl.classList.add('visible'); return;
  }
  btn.disabled = true; btn.textContent = 'Guardando…';

  try {
    const resp = await fetch('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave, email, password }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Error al guardar contraseña');
    Auth.save(data.token, data.cliente);
    okEl.textContent = '¡Contraseña creada! Iniciando sesión…';
    okEl.classList.add('visible');
    setTimeout(() => { closeAuthModal(); location.reload(); }, 1500);
  } catch(err) {
    errEl.textContent = err.message;
    errEl.classList.add('visible');
    btn.disabled = false; btn.textContent = 'Crear Contraseña';
  }
}

// ─── Recuperar contraseña ────────────────────────────────
async function submitForgot(e) {
  e.preventDefault();
  const btn   = document.getElementById('forgot-submit');
  const errEl = document.getElementById('forgot-error');
  const okEl  = document.getElementById('forgot-success');
  errEl.classList.remove('visible'); okEl.classList.remove('visible');
  btn.disabled = true; btn.textContent = 'Enviando…';

  const email = document.getElementById('forgot-email').value.trim();
  try {
    const resp = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await resp.json();
    okEl.textContent = data.mensaje || 'Correo enviado si existe la cuenta.';
    okEl.classList.add('visible');
  } catch(err) {
    errEl.textContent = err.message;
    errEl.classList.add('visible');
  } finally {
    btn.disabled = false; btn.textContent = 'Enviar Enlace';
  }
}

// ─── Reset password (desde link en correo) ───────────────
async function submitResetPassword(e) {
  e.preventDefault();
  const params = new URLSearchParams(location.search);
  const token  = params.get('token');
  if (!token) return;

  const btn      = document.getElementById('rp-submit');
  const errEl    = document.getElementById('rp-error');
  const okEl     = document.getElementById('rp-success');
  const password = document.getElementById('rp-password').value;
  const confirm  = document.getElementById('rp-confirm').value;

  if (password !== confirm) {
    errEl.textContent = 'Las contraseñas no coinciden';
    errEl.classList.add('visible'); return;
  }
  btn.disabled = true; btn.textContent = 'Guardando…';
  errEl.classList.remove('visible'); okEl.classList.remove('visible');

  try {
    const resp = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Error al restablecer');
    okEl.textContent = '¡Contraseña actualizada! Redirigiendo…';
    okEl.classList.add('visible');
    setTimeout(() => { location.href = '/'; }, 2000);
  } catch(err) {
    errEl.textContent = err.message;
    errEl.classList.add('visible');
    btn.disabled = false; btn.textContent = 'Guardar Contraseña';
  }
}

// ─── Init ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Auth.renderNavbar();

  // Cerrar modal al click fuera
  document.getElementById('auth-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeAuthModal();
  });
  document.getElementById('profile-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeProfileModal();
  });
  document.getElementById('auth-close')?.addEventListener('click', closeAuthModal);

  // Tabs
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab));
  });

  // Forms
  document.getElementById('login-form')?.addEventListener('submit', submitLogin);
  document.getElementById('sp-form')?.addEventListener('submit', submitSetPassword);
  document.getElementById('forgot-form')?.addEventListener('submit', submitForgot);
  document.getElementById('rp-form')?.addEventListener('submit', submitResetPassword);

  // Si hay token=xxx en la URL → abrir panel de reset
  if (new URLSearchParams(location.search).get('token')) {
    document.getElementById('reset-password-overlay')?.classList.add('open');
  }
});
