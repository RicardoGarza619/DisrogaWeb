require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const Firebird = require('node-firebird');
const path = require('path');

const app = express();
const PORT = process.env.ASPEL_API_PORT || 3001;

app.use(express.json());

// ── Conexión Firebird ──────────────────────────────────────────
const FB_OPTIONS = {
  host:     process.env.DB_HOST     || 'DISROGA-SVR',
  port:     parseInt(process.env.DB_PORT || '3050'),
  database: process.env.DB_PATH     || 'C:\\Program Files (x86)\\Common Files\\Aspel\\Sistemas Aspel\\SAE9.00\\Empresa03\\Datos\\SAE90EMPRE03.FDB',
  user:     process.env.DB_USER     || 'sysdba',
  password: process.env.DB_PASSWORD || 'masterkey',
  lowercase_keys: true,
  role: null,
  pageSize: 4096,
};

function fbQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    Firebird.attach(FB_OPTIONS, (err, db) => {
      if (err) return reject(err);
      db.query(sql, params, (err2, rows) => {
        db.detach();
        if (err2) return reject(err2);
        resolve(rows);
      });
    });
  });
}

function clean(val) {
  return typeof val === 'string' ? val.trim() : val;
}

// ── Mapa SAT para identificar alimentos ───────────────────────
const fs = require('fs');
const CATS_ALIMENTO = new Set([
  'Alimentos','Frutas','Carnes','Pescados','Lácteos',
  'Aceites','Dulces','Condimentos','Panadería','Bebidas'
]);
const SAT_MAP = {};
try {
  const satPath = path.join(__dirname, '..', 'c_ClaveProdServ_filtered.json');
  const satData = JSON.parse(fs.readFileSync(satPath, 'utf8'));
  satData.forEach(r => {
    if (r.id) SAT_MAP[String(r.id).trim()] = r.categoria || '';
  });
  console.log(`✅ Mapa SAT: ${Object.keys(SAT_MAP).length} claves`);
} catch(e) {
  console.warn('⚠️  SAT map no disponible:', e.message);
}

function esAlimentoSAT(cveProdserv) {
  if (!cveProdserv) return false;
  return CATS_ALIMENTO.has(SAT_MAP[String(cveProdserv).trim()]);
}

// ── GET /health ───────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── GET /productos ────────────────────────────────────────────
app.get('/productos', async (req, res) => {
  try {
    const sql = `
      SELECT
        TRIM(i.cve_art)      AS id,
        TRIM(i.descr)        AS nombre,
        TRIM(i.lin_prod)     AS categoria_id,
        TRIM(l.desc_lin)     AS categoria,
        TRIM(i.uni_alt)      AS unidad,
        TRIM(i.cve_prodserv) AS cve_prodserv,
        i.exist              AS existencia,
        pp1.precio           AS precio_publico
      FROM inve03 i
      LEFT JOIN clin03 l            ON l.cve_lin  = i.lin_prod
      JOIN precio_x_prod03 pp1      ON pp1.cve_art = i.cve_art AND pp1.cve_precio = 1
      WHERE i.status = 'A'
        AND pp1.precio > 1
        AND i.lin_prod STARTING WITH 'N'
      ORDER BY i.lin_prod, i.descr
    `;
    const rows = await fbQuery(sql);
    const productos = rows.map(r => ({
      id:          clean(r.id),
      nombre:      clean(r.nombre),
      categoria_id: clean(r.categoria_id),
      categoria:   clean(r.categoria) || clean(r.categoria_id) || '',
      unidad:      clean(r.unidad) || 'pieza',
      cve_prodserv: clean(r.cve_prodserv) || '',
      existencia:  r.existencia || 0,
      precio:      parseFloat(r.precio_publico) || 0,
      es_alimento: esAlimentoSAT(clean(r.cve_prodserv)),
    }));
    res.json({ total: productos.length, productos });
  } catch (err) {
    console.error('/productos error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /ofertas ──────────────────────────────────────────────
app.get('/ofertas', async (req, res) => {
  try {
    const hoy = new Date().toISOString().split('T')[0];
    const sql = `
      SELECT FIRST 100
        p.cve_polit,
        TRIM(p.descr)        AS pol_descr,
        TRIM(p.cve_ini)      AS cve_art,
        TRIM(i.descr)        AS prod_nombre,
        TRIM(i.uni_alt)      AS unidad,
        TRIM(i.cve_prodserv) AS cve_prodserv,
        p.val                AS descuento_pct,
        p.v_dfech            AS fecha_ini,
        p.v_hfech            AS fecha_fin,
        pp1.precio           AS precio_pub,
        i.exist              AS existencia,
        TRIM(i.lin_prod)     AS categoria_id,
        TRIM(l.desc_lin)     AS categoria
      FROM poli03 p
      JOIN inve03 i            ON i.cve_art  = p.cve_ini
      JOIN precio_x_prod03 pp1 ON pp1.cve_art = i.cve_art AND pp1.cve_precio = 1
      LEFT JOIN clin03 l       ON l.cve_lin  = i.lin_prod
      WHERE p.st = 'A'
        AND p.v_dfech <= '${hoy}'
        AND p.v_hfech >= '${hoy}'
        AND i.status = 'A'
        AND pp1.precio > 1
      ORDER BY p.val DESC
    `;
    const fmt = d => {
      if (!d) return null;
      if (d instanceof Date) return d.toISOString().split('T')[0];
      return String(d).split('T')[0];
    };
    const rows = await fbQuery(sql);
    const ofertas = rows.map(r => {
      const precio = parseFloat(r.precio_pub) || 0;
      const pct    = parseFloat(r.descuento_pct) || 0;
      return {
        id:              r.cve_polit,
        producto_id:     clean(r.cve_art),
        nombre_producto: clean(r.prod_nombre),
        titulo:          clean(r.pol_descr) || clean(r.prod_nombre),
        unidad:          clean(r.unidad) || 'pieza',
        cve_prodserv:    clean(r.cve_prodserv) || '',
        precio_original: precio,
        precio_oferta:   Math.round(precio * (1 - pct / 100) * 100) / 100,
        descuento_pct:   pct,
        badge:           `${pct}% OFF`,
        fecha_ini:       fmt(r.fecha_ini),
        fecha_fin:       fmt(r.fecha_fin),
        existencia:      r.existencia || 0,
        categoria:       clean(r.categoria) || clean(r.categoria_id) || '',
        es_alimento:     esAlimentoSAT(clean(r.cve_prodserv)),
      };
    });
    res.json({ total: ofertas.length, ofertas });
  } catch (err) {
    console.error('/ofertas error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🔗 Aspel API corriendo en http://localhost:${PORT}`);
  console.log(`   Firebird: ${FB_OPTIONS.host}:${FB_OPTIONS.port}`);
});
