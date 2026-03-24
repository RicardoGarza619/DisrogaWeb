require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');
const { initDB } = require('./db/init');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Inicializar BD SQLite ──────────────────────────────────────
const db = initDB();

// ── Ruta de imágenes Aspel SAE ────────────────────────────────
const IMAGES_PATH = process.env.IMAGES_PATH ||
  '\\\\192.168.0.6\\c\\Program Files (x86)\\Common Files\\Aspel\\Sistemas Aspel\\SAE9.00\\Empresa03\\Imagenes';

// ─────────────────────────────────────────────────────────────
// GET /api/productos
// Lee desde SQLite local
// ─────────────────────────────────────────────────────────────
app.get('/api/productos', (req, res) => {
  try {
    const { q, cve } = req.query;

    let sql    = 'SELECT * FROM productos WHERE 1=1';
    const params = [];

    if (q) {
      sql += ' AND UPPER(nombre) LIKE UPPER(?)';
      params.push(`%${q}%`);
    }
    if (cve) {
      sql += ' AND id LIKE ?';
      params.push(`%${cve}%`);
    }
    sql += ' ORDER BY nombre';

    const rows = db.prepare(sql).all(...params);

    const productos = rows.map(r => ({
      id:          r.id,
      nombre:      r.nombre,
      categoria_id: r.categoria_id,
      categoria:   r.categoria,
      unidad:      r.unidad  || 'pieza',
      existencia:  r.existencia || 0,
      precio:      r.precio  || 0,
      es_alimento: r.es_alimento === 1,
      imagen_url:  r.imagen_url || `/img/${r.id}`,
    }));

    res.json(productos);
  } catch (err) {
    console.error('/api/productos error:', err.message);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/ofertas
// Lee ofertas vigentes desde SQLite
// ─────────────────────────────────────────────────────────────
app.get('/api/ofertas', (req, res) => {
  try {
    const { q } = req.query;
    const hoy = new Date().toISOString().split('T')[0];

    let sql = `SELECT * FROM ofertas
               WHERE (fecha_fin IS NULL OR fecha_fin >= ?)`;
    const params = [hoy];

    if (q) {
      sql += ' AND UPPER(nombre_producto) LIKE UPPER(?)';
      params.push(`%${q}%`);
    }
    sql += ' ORDER BY descuento_pct DESC';

    const rows = db.prepare(sql).all(...params);

    const ofertas = rows.map(r => ({
      id:              r.id,
      producto_id:     r.producto_id,
      nombre_producto: r.nombre_producto,
      titulo:          r.titulo,
      unidad:          r.unidad || 'pieza',
      precio_original: r.precio_original || 0,
      precio_oferta:   r.precio_oferta   || 0,
      descuento_pct:   r.descuento_pct   || 0,
      badge:           r.badge,
      fecha_ini:       r.fecha_ini,
      fecha_fin:       r.fecha_fin,
      existencia:      r.existencia || 0,
      categoria:       r.categoria,
      es_alimento:     r.es_alimento === 1,
      imagen_url:      r.imagen_url || `/img/${r.producto_id}`,
      descripcion:     `${r.descuento_pct}% de descuento sobre precio público.`,
    }));

    res.json(ofertas);
  } catch (err) {
    console.error('/api/ofertas error:', err.message);
    res.status(500).json({ error: 'Error al obtener ofertas' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/sync
// Ejecuta sync.js para actualizar la BD local desde Aspel API
// ─────────────────────────────────────────────────────────────
app.post('/api/sync', (req, res) => {
  const { solo } = req.body; // 'prod' | 'ofer' | undefined
  const args = solo ? `--solo ${solo}` : '';
  console.log(`🔄 Iniciando sync${solo ? ` (${solo})` : ''}...`);

  // Ejecutar en background para no bloquear el request
  const { spawn } = require('child_process');
  const child = spawn(process.execPath, ['sync.js', ...args.split(' ').filter(Boolean)], {
    cwd: __dirname,
    detached: false,
    stdio: 'inherit',
  });

  child.on('close', code => {
    console.log(`✅ Sync terminado (exit ${code})`);
  });

  res.json({ ok: true, mensaje: 'Sincronización iniciada en segundo plano.' });
});

// ─────────────────────────────────────────────────────────────
// GET /api/sync/status  — último log de sincronización
// ─────────────────────────────────────────────────────────────
app.get('/api/sync/status', (req, res) => {
  try {
    const logs = db.prepare(
      'SELECT * FROM sync_log ORDER BY id DESC LIMIT 10'
    ).all();
    res.json(logs);
  } catch(e) {
    res.json([]);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /img/:cveArt  — sirve imagen del producto
// ─────────────────────────────────────────────────────────────
app.get('/img/:cveArt', (req, res) => {
  const cveArt   = req.params.cveArt.replace(/[^a-zA-Z0-9_\-]/g, '');
  const filePath = path.join(IMAGES_PATH, `${cveArt}.jpg`);
  if (fs.existsSync(filePath)) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(filePath);
  } else {
    res.status(404).end();
  }
});

// ─────────────────────────────────────────────────────────────
// Fallback SPA
// ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor Disroga en http://localhost:${PORT}`);

  // Verificar cuántos registros hay en la BD
  try {
    const prods  = db.prepare('SELECT COUNT(*) AS n FROM productos').get();
    const ofertas = db.prepare('SELECT COUNT(*) AS n FROM ofertas').get();
    console.log(`   📦 Productos en BD: ${prods.n}`);
    console.log(`   🏷️  Ofertas en BD:   ${ofertas.n}`);
    if (prods.n === 0) {
      console.log('   ⚠️  BD vacía — ejecuta: node sync.js');
    }
  } catch(e) {
    console.warn('   ⚠️  no se pudo leer la BD:', e.message);
  }
});
