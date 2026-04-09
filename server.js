require('dotenv').config();
const express = require('express');
const Firebird = require('node-firebird');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ─── BD SQLite ─────────────────────────────────────────────
const db = require('./db/init');

// ─── Libs ──────────────────────────────────────────────────
const { hashPassword, checkPassword, signToken, requireAuth, optionalAuth } = require('./lib/auth');
const { enviarPedidoVendedor, enviarPedidoCliente, enviarResetPassword } = require('./lib/mailer');

// ─── Mapa CVE_PRODSERV → Categoría SAT (para IVA) ─────────
const CATS_ALIMENTO = new Set([
  'Alimentos','Frutas','Carnes','Pescados','Lácteos',
  'Aceites','Dulces','Condimentos','Panadería','Bebidas'
]);
const SAT_MAP = {};
try {
  const satData = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'c_ClaveProdServ_filtered.json'), 'utf8'
  ));
  satData.forEach(r => {
    if (r.id) SAT_MAP[String(r.id).trim()] = r.categoria || '';
  });
  console.log(`✅ Mapa SAT cargado: ${Object.keys(SAT_MAP).length} claves`);
} catch(e) {
  console.warn('⚠️  c_ClaveProdServ_filtered.json no encontrado:', e.message);
}

function esAlimentoSAT(cveProdserv) {
  if (!cveProdserv) return false;
  return CATS_ALIMENTO.has(SAT_MAP[String(cveProdserv).trim()]);
}

// ─── Imágenes ──────────────────────────────────────────────
const IMAGES_PATH = process.env.IMAGES_PATH ||
  '\\\\192.168.0.6\\c\\Program Files (x86)\\Common Files\\Aspel\\Sistemas Aspel\\SAE9.00\\Empresa03\\Imagenes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Firebird ──────────────────────────────────────────────
const FB_OPTIONS = {
  host: process.env.DB_HOST || 'DISROGA-SVR',
  port: parseInt(process.env.DB_PORT || '3050'),
  database: process.env.DB_PATH,
  user: process.env.DB_USER || 'sysdba',
  password: process.env.DB_PASSWORD || 'masterkey',
  lowercase_keys: true,
  role: null,
  pageSize: 4096,
};

function fbQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    Firebird.attach(FB_OPTIONS, (err, fbdb) => {
      if (err) return reject(err);
      fbdb.query(sql, params, (err2, rows) => {
        fbdb.detach();
        if (err2) return reject(err2);
        resolve(rows);
      });
    });
  });
}

function clean(val) {
  return typeof val === 'string' ? val.trim() : val;
}

// ══════════════════════════════════════════════════════════
// AUTH – Autenticación de clientes
// ══════════════════════════════════════════════════════════

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { clave, password } = req.body;
  if (!clave || !password) return res.status(400).json({ error: 'Clave y contraseña requeridas' });

  const cliente = db.prepare('SELECT * FROM clientes WHERE TRIM(clave)=TRIM(?) AND activo=1').get(clave);
  if (!cliente) return res.status(401).json({ error: 'Cliente no encontrado' });
  if (!cliente.password_hash) return res.status(403).json({ error: 'sin_password', mensaje: 'Debes configurar tu contraseña primero' });
  if (!checkPassword(password, cliente.password_hash)) return res.status(401).json({ error: 'Contraseña incorrecta' });

  const token = signToken({ id: cliente.id, clave: cliente.clave, nombre: cliente.nombre, descuento: cliente.descuento });
  res.json({ token, cliente: { id: cliente.id, clave: cliente.clave, nombre: cliente.nombre, email: cliente.email, descuento: cliente.descuento, nombre_comercial: cliente.nombre_comercial } });
});

// POST /api/auth/set-password — primera vez o si no tiene contraseña
app.post('/api/auth/set-password', (req, res) => {
  const { clave, email, password } = req.body;
  if (!clave || !email || !password) return res.status(400).json({ error: 'Datos incompletos' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  const cliente = db.prepare('SELECT * FROM clientes WHERE TRIM(clave)=TRIM(?) AND activo=1').get(clave);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
  if (!cliente.email || cliente.email.toLowerCase() !== email.toLowerCase())
    return res.status(403).json({ error: 'El correo no coincide con el registrado' });

  db.prepare('UPDATE clientes SET password_hash=? WHERE id=?')
    .run(hashPassword(password), cliente.id);

  const token = signToken({ id: cliente.id, clave: cliente.clave, nombre: cliente.nombre, descuento: cliente.descuento });
  res.json({ ok: true, token, cliente: { id: cliente.id, clave: cliente.clave, nombre: cliente.nombre, email: cliente.email, descuento: cliente.descuento } });
});

// POST /api/auth/forgot-password
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Correo requerido' });

  const cliente = db.prepare('SELECT * FROM clientes WHERE LOWER(email)=LOWER(TRIM(?)) AND activo=1').get(email);
  // Siempre responder ok para no revelar si el email existe
  if (!cliente) return res.json({ ok: true, mensaje: 'Si existe una cuenta con ese correo, recibirás un enlace.' });

  const token = crypto.randomBytes(32).toString('hex');
  const exp = Date.now() + 60 * 60 * 1000; // 1 hora
  db.prepare('UPDATE clientes SET reset_token=?, reset_token_exp=? WHERE id=?').run(token, exp, cliente.id);

  try {
    await enviarResetPassword(cliente.email, cliente.nombre, token);
  } catch(e) {
    console.error('Error enviando correo reset:', e.message);
  }
  res.json({ ok: true, mensaje: 'Si existe una cuenta con ese correo, recibirás un enlace.' });
});

// POST /api/auth/reset-password
app.post('/api/auth/reset-password', (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Datos incompletos' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  const cliente = db.prepare('SELECT * FROM clientes WHERE reset_token=?').get(token);
  if (!cliente || !cliente.reset_token_exp || Date.now() > cliente.reset_token_exp)
    return res.status(400).json({ error: 'Token inválido o expirado' });

  db.prepare('UPDATE clientes SET password_hash=?, reset_token=NULL, reset_token_exp=NULL WHERE id=?')
    .run(hashPassword(password), cliente.id);
  res.json({ ok: true });
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, (req, res) => {
  const cliente = db.prepare('SELECT id,clave,nombre,rfc,calle,telefono,email,saldo,descuento,limite_credito,nombre_comercial FROM clientes WHERE id=?').get(req.cliente.id);
  if (!cliente) return res.status(404).json({ error: 'No encontrado' });
  res.json({ cliente });
});

// GET /api/mis-pedidos
app.get('/api/mis-pedidos', requireAuth, (req, res) => {
  const pedidos = db.prepare(`
    SELECT id, nombre_contacto, empresa, telefono, email, notas, total, estado, created_at
    FROM pedidos
    WHERE cliente_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.cliente.id);

  const pedidosConItems = pedidos.map(p => ({
    ...p,
    items: db.prepare(`
      SELECT producto_id, nombre_producto, cantidad, precio_unitario, subtotal
      FROM pedido_items WHERE pedido_id = ?
    `).all(p.id)
  }));

  res.json({ pedidos: pedidosConItems });
});

// ══════════════════════════════════════════════════════════
// ADMIN – Sincronización de clientes
// ══════════════════════════════════════════════════════════
app.post('/api/admin/sync-clientes', async (req, res) => {
  try {
    const { syncClientes } = require('./db/sync-clientes');
    const n = await syncClientes();
    res.json({ ok: true, sincronizados: n });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════
// CATEGORÍAS
// ══════════════════════════════════════════════════════════
app.get('/api/categorias', async (req, res) => {
  try {
    const rows = await fbQuery(`
      SELECT TRIM(l.cve_lin) AS id, TRIM(l.desc_lin) AS nombre
      FROM clin03 l
      WHERE l.status = 'A'
        AND EXISTS (SELECT 1 FROM inve03 i WHERE TRIM(i.lin_prod) = TRIM(l.cve_lin) AND i.status = 'A')
      ORDER BY l.desc_lin
    `);
    res.json(rows.map(r => ({ id: clean(r.id), nombre: clean(r.nombre), icono: '📦' })));
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

// ══════════════════════════════════════════════════════════
// PRODUCTOS
// ══════════════════════════════════════════════════════════
app.get('/api/productos', optionalAuth, async (req, res) => {
  try {
    const { categoria, q, cve } = req.query;
    const cliente = req.cliente; // null si no autenticado

    const where = ["i.status = 'A'", "pp1.precio > 1", "i.lin_prod STARTING WITH 'N'", "i.exist > 0"];
    const params = [];

    if (categoria) { where.push('TRIM(i.lin_prod) = ?'); params.push(categoria); }
    if (q) {
      const qSafe = q.substring(0, 40);
      where.push('(UPPER(i.descr) CONTAINING UPPER(?))');
      params.push(qSafe);
    }
    if (cve) {
      if (cve.length > 16) {
        where.push('1=0'); // Imposible que exista una clave mayor a 16
      } else {
        where.push('(i.cve_art CONTAINING ?)');
        params.push(cve);
      }
    }

    const sql = `
      SELECT FIRST 200
        TRIM(i.cve_art)      AS id,
        TRIM(i.descr)        AS nombre,
        TRIM(i.lin_prod)     AS categoria_id,
        TRIM(l.desc_lin)     AS categoria,
        TRIM(i.uni_alt)      AS unidad,
        TRIM(i.cve_prodserv) AS cve_prodserv,
        i.exist              AS existencia,
        i.version_sinc_fecha_img AS version_img,
        pp1.precio           AS precio_publico
      FROM inve03 i
      LEFT JOIN clin03 l            ON l.cve_lin  = i.lin_prod
      JOIN precio_x_prod03 pp1      ON pp1.cve_art = i.cve_art AND pp1.cve_precio = 1
      LEFT JOIN precio_x_prod03 pp2 ON pp2.cve_art = i.cve_art AND pp2.cve_precio = 2
      WHERE ${where.join(' AND ')}
      ORDER BY i.lin_prod, i.descr
    `;

    const rows = await fbQuery(sql, params);

    const productos = rows.map(r => {
      const cveProd    = clean(r.cve_prodserv);
      const esAlimento = esAlimentoSAT(cveProd);
      const base       = parseFloat(r.precio_publico) || 0;
      // Precio con IVA si no es alimento
      const conIva     = esAlimento ? base : Math.round(base * 1.08 * 100) / 100;
      // Ajuste según tipo de usuario
      let precioFinal;
      if (cliente) {
        const desc = parseFloat(cliente.descuento) || 0;
        precioFinal = Math.round(conIva * (1 - desc / 100) * 100) / 100;
      } else {
        precioFinal = Math.round(conIva * 1.10 * 100) / 100; // +10% invitado
      }

      const vStr = r.version_img ? (r.version_img instanceof Date ? r.version_img.getTime() : encodeURIComponent(String(r.version_img).trim())) : '';
      return {
        id:          clean(r.id),
        nombre:      clean(r.nombre),
        categoria:   clean(r.categoria) || clean(r.categoria_id),
        unidad:      clean(r.unidad) || 'pieza',
        existencia:  r.existencia || 0,
        precio:      precioFinal,
        es_alimento: esAlimento,
        imagen_url:  `/img/${clean(r.id)}${vStr ? '?v=' + vStr : ''}`,
      };
    });

    res.json(productos);
  } catch (err) {
    console.error('/api/productos error:', err.message);
    res.status(500).json({ error: 'Error al obtener productos', detalle: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// OFERTAS
// ══════════════════════════════════════════════════════════
app.get('/api/ofertas', optionalAuth, async (req, res) => {
  try {
    const { q } = req.query;
    const cliente = req.cliente;
    const hoy = new Date().toISOString().split('T')[0];

    // Campos comunes para ambas queries
    const CAMPOS = `
      p.cve_polit,
      TRIM(p.descr)            AS pol_descr,
      TRIM(p.t_pol)            AS t_pol,
      TRIM(p.prc_mon)          AS prc_mon,
      p.val                    AS descuento_val,
      p.v_dfech                AS fecha_ini,
      p.v_hfech                AS fecha_fin,
      p.limunivta              AS limunivta,
      p.numuniven              AS numuniven,
      TRIM(i.cve_art)          AS cve_art,
      TRIM(i.descr)            AS prod_nombre,
      TRIM(i.uni_alt)          AS unidad,
      TRIM(i.cve_prodserv)     AS cve_prodserv,
      pp1.precio               AS precio_pub,
      i.exist                  AS existencia,
      i.version_sinc_fecha_img AS version_img,
      TRIM(i.lin_prod)         AS categoria_id,
      TRIM(l.desc_lin)         AS categoria
    `;

    // Una política aplica si:
    //   a) está en rango de fechas vigente, O
    //   b) es por cantidad y aún tiene unidades disponibles
    const WHERE_BASE = `
      p.st = 'A'
      AND (
        (p.v_dfech <= ? AND p.v_hfech >= ?)
        OR (p.limunivta > 0 AND p.numuniven < p.limunivta)
      )
      AND i.status = 'A'
      AND pp1.precio > 1
    `;

    let extraWhere = '';
    const extraParams = [];
    if (q) {
      const qSafe = q.substring(0, 40);
      extraWhere = ' AND (UPPER(i.descr) CONTAINING UPPER(?))';
      extraParams.push(qSafe);
    }

    // ── Query 1: Políticas por artículo (cve_ini tiene valor) ──
    const sqlArt = `
      SELECT FIRST 500 ${CAMPOS}
      FROM poli03 p
      JOIN inve03 i
        ON TRIM(i.cve_art) = TRIM(p.cve_ini)
      JOIN precio_x_prod03 pp1
        ON pp1.cve_art = i.cve_art AND pp1.cve_precio = 1
      LEFT JOIN clin03 l ON l.cve_lin = i.lin_prod
      WHERE ${WHERE_BASE}
        AND p.cve_ini IS NOT NULL
        ${extraWhere}
      ORDER BY p.val DESC
    `;

    // ── Query 2: Políticas por línea (cve_ini NULL, lin_prod real) ──
    const sqlLin = `
      SELECT FIRST 2000 ${CAMPOS}
      FROM poli03 p
      JOIN inve03 i
        ON TRIM(i.lin_prod) = TRIM(p.lin_prod)
      JOIN precio_x_prod03 pp1
        ON pp1.cve_art = i.cve_art AND pp1.cve_precio = 1
      LEFT JOIN clin03 l ON l.cve_lin = i.lin_prod
      WHERE ${WHERE_BASE}
        AND p.cve_ini IS NULL
        AND TRIM(p.lin_prod) <> '?????'
        AND TRIM(p.lin_prod) <> ''
        ${extraWhere}
      ORDER BY p.val DESC
    `;

    const params = [hoy, hoy, ...extraParams];

    // Ejecutar ambas queries en paralelo
    const [rowsArt, rowsLin] = await Promise.all([
      fbQuery(sqlArt, params),
      fbQuery(sqlLin, params),
    ]);

    const allRows = [...rowsArt, ...rowsLin];

    // ── Agrupar por producto ─────────────────────────────────
    const porProducto = new Map();
    for (const r of allRows) {
      const key = clean(r.cve_art);
      if (!key) continue;
      if (!porProducto.has(key)) porProducto.set(key, { info: r, politicas: [] });
      const existing = porProducto.get(key);
      // Evitar duplicar la misma política para el mismo producto
      if (!existing.politicas.find(p => p.cve_polit === r.cve_polit)) {
        const lim = parseInt(r.limunivta) || 0;
        const ven = parseInt(r.numuniven) || 0;
        existing.politicas.push({
          cve_polit:         r.cve_polit,
          descr:             clean(r.pol_descr) || '',
          t_pol:             (r.t_pol  || '').trim(), // 'A' acumulativa | 'S' sustitutiva
          prc_mon:           (r.prc_mon || '').trim(), // 'P' porcentaje  | 'M' monto fijo
          val:               parseFloat(r.descuento_val) || 0,
          fecha_ini:         r.fecha_ini,
          fecha_fin:         r.fecha_fin,
          por_cantidad:      lim > 0,
          unidades_restantes: lim > 0 ? Math.max(0, lim - ven) : null,
        });
      }
    }

    const fmt = (d) => {
      if (!d) return null;
      if (d instanceof Date) return d.toISOString().split('T')[0];
      return String(d).split('T')[0];
    };

    // ── Construir resultado agrupado por producto ─────────────
    const ofertas = [];
    for (const [cveArt, { info, politicas }] of porProducto) {
      // Precio base según tipo de usuario
      const cveProd    = clean(info.cve_prodserv);
      const esAlimento = esAlimentoSAT(cveProd);
      const base       = parseFloat(info.precio_pub) || 0;
      const conIva     = esAlimento ? base : Math.round(base * 1.08 * 100) / 100;

      let precioBase;
      if (cliente) {
        const desc = parseFloat(cliente.descuento) || 0;
        precioBase = Math.round(conIva * (1 - desc / 100) * 100) / 100;
      } else {
        precioBase = Math.round(conIva * 1.10 * 100) / 100;
      }

      // ── Regla sustitutiva / acumulativa ──────────────────────
      const sustitutivas = politicas.filter(p => p.t_pol === 'S');
      const acumulativas  = politicas.filter(p => p.t_pol === 'A');

      let aplicables, tipoAplicacion;
      if (sustitutivas.length > 0) {
        // Solo la sustitutiva de mayor valor
        aplicables      = [sustitutivas.reduce((a, b) => b.val > a.val ? b : a)];
        tipoAplicacion  = 'sustitutiva';
      } else {
        aplicables      = acumulativas;
        tipoAplicacion  = 'acumulativa';
      }

      // ── Precio individual por política ────────────────────────
      const politicasCalculadas = aplicables.map(pol => {
        const pOferta = pol.prc_mon === 'M'
          ? Math.max(0, Math.round((precioBase - pol.val) * 100) / 100)
          : Math.round(precioBase * (1 - pol.val / 100) * 100) / 100;
        return {
          cve_polit:         pol.cve_polit,
          descr:             pol.descr,
          val:               pol.val,
          prc_mon:           pol.prc_mon,
          t_pol:             pol.t_pol,
          precio_oferta:     pOferta,
          badge:             pol.prc_mon === 'M' ? `-$${pol.val.toFixed(2)}` : `${pol.val}% OFF`,
          fecha_ini:         fmt(pol.fecha_ini),
          fecha_fin:         fmt(pol.fecha_fin),
          por_cantidad:      pol.por_cantidad,
          unidades_restantes: pol.unidades_restantes,
        };
      });

      // ── Precio final (cascada si acumulativas) ────────────────
      let precioFinal = precioBase;
      if (tipoAplicacion === 'sustitutiva') {
        precioFinal = politicasCalculadas[0]?.precio_oferta ?? precioBase;
      } else {
        for (const pol of aplicables) {
          precioFinal = pol.prc_mon === 'M'
            ? Math.max(0, Math.round((precioFinal - pol.val) * 100) / 100)
            : Math.round(precioFinal * (1 - pol.val / 100) * 100) / 100;
        }
      }

      const vStr = info.version_img
        ? (info.version_img instanceof Date
            ? info.version_img.getTime()
            : encodeURIComponent(String(info.version_img).trim()))
        : '';

      ofertas.push({
        producto_id:     cveArt,
        nombre_producto: clean(info.prod_nombre),
        unidad:          clean(info.unidad) || 'pieza',
        precio_original: precioBase,
        precio_final:    precioFinal,
        existencia:      info.existencia || 0,
        imagen_url:      `/img/${cveArt}${vStr ? '?v=' + vStr : ''}`,
        categoria:       clean(info.categoria) || clean(info.categoria_id),
        es_alimento:     esAlimento,
        tipo_aplicacion: tipoAplicacion,
        politicas:       politicasCalculadas,
      });
    }

    // Ordenar por mayor ahorro absoluto primero
    ofertas.sort((a, b) => (b.precio_original - b.precio_final) - (a.precio_original - a.precio_final));

    res.json(ofertas);
  } catch (err) {
    console.error('/api/ofertas error:', err.message);
    res.status(500).json({ error: 'Error al obtener ofertas', detalle: err.message });
  }
});


// ══════════════════════════════════════════════════════════
// PEDIDOS
// ══════════════════════════════════════════════════════════
app.post('/api/pedidos', optionalAuth, async (req, res) => {
  const { nombre_contacto, empresa, telefono, email, notas, items } = req.body;

  // Si no hay sesión (invitado), exigimos nombre, teléfono y correo
  if (!req.cliente && (!nombre_contacto || !telefono || !email)) {
    return res.status(400).json({ error: 'Nombre, teléfono y correo son requeridos para invitados' });
  }

  // A los clientes registrados se les permite tener datos en blanco si su cuenta no los tiene
  const nombre_final = nombre_contacto || (req.cliente ? req.cliente.nombre : 'Sin nombre');
  const telefono_final = telefono || '';
  const email_final = email || '';

  if (!items || !items.length) return res.status(400).json({ error: 'El carrito está vacío' });

  const total = items.reduce((s, it) => s + (it.subtotal || it.precio_unitario * it.cantidad), 0);

  const insertPedido = db.prepare(`
    INSERT INTO pedidos (cliente_id, nombre_contacto, empresa, telefono, email, notas, total)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO pedido_items (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const createOrder = db.transaction(() => {
    const { lastInsertRowid } = insertPedido.run(
      req.cliente?.id ?? null, nombre_final, empresa || null, telefono_final, email_final, notas || null, Math.round(total * 100) / 100
    );
    for (const it of items) {
      const subtotal = Math.round(it.precio_unitario * it.cantidad * 100) / 100;
      insertItem.run(lastInsertRowid, it.producto_id, it.nombre_producto, it.cantidad, it.precio_unitario, subtotal);
    }
    return lastInsertRowid;
  });

  const pedidoId = createOrder();
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id=?').get(pedidoId);
  const pedidoItems = db.prepare('SELECT * FROM pedido_items WHERE pedido_id=?').all(pedidoId);

  // Enviar correos al vendedor y al cliente (sin bloquear la respuesta)
  enviarPedidoVendedor(pedido, items, !req.cliente).catch(e => console.error('Email vendedor error:', e.message));
  enviarPedidoCliente(pedido, items, !req.cliente).catch(e => console.error('Email cliente error:', e.message));

  res.json({ ok: true, pedido_id: pedidoId, mensaje: '¡Pedido recibido! Nos pondremos en contacto contigo pronto.' });
});

// ══════════════════════════════════════════════════════════
// IMÁGENES
// ══════════════════════════════════════════════════════════
app.get('/img/:cveArt', (req, res) => {
  const cveArt = req.params.cveArt.replace(/[^a-zA-Z0-9_\-]/g, '');
  const filePath = path.join(IMAGES_PATH, `${cveArt}.jpg`);
  if (fs.existsSync(filePath)) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(filePath);
  } else {
    res.status(404).end();
  }
});

// ══════════════════════════════════════════════════════════
// SPA Fallback
// ══════════════════════════════════════════════════════════
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ══════════════════════════════════════════════════════════
// START
// ══════════════════════════════════════════════════════════
Firebird.attach(FB_OPTIONS, (err, fbdb) => {
  if (err) console.warn('⚠️  No se pudo conectar a Firebird al inicio:', err.message);
  else { console.log('✅ Conexión a Firebird verificada (Aspel SAE)'); fbdb.detach(); }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`   BD: ${FB_OPTIONS.host}:${FB_OPTIONS.port} → ${path.basename(FB_OPTIONS.database || 'SAE.FDB')}`);
});
