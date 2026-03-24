/**
 * sync.js
 * Sincroniza datos desde la API de Aspel SAE → SQLite local.
 *
 * Uso:
 *   node sync.js              (sync completo)
 *   node sync.js --solo prod  (solo productos)
 *   node sync.js --solo ofer  (solo ofertas)
 */
require('dotenv').config();
const path = require('path');
const { initDB } = require('./db/init');

const ASPEL_API = process.env.ASPEL_API_URL || 'http://192.168.0.6:3001';

// ── Fetch helper ──────────────────────────────────────────────
async function fetchJSON(url) {
  const { default: fetch } = await import('node-fetch');
  const res = await fetch(url, { timeout: 60000 });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
}

// ── Sync productos ────────────────────────────────────────────
async function syncProductos(db) {
  console.log('⬇️  Descargando productos desde Aspel API...');
  const t0 = Date.now();
  const { productos } = await fetchJSON(`${ASPEL_API}/productos`);
  console.log(`   ${productos.length} productos recibidos`);

  const ts = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO productos
      (id, nombre, categoria_id, categoria, unidad, cve_prodserv,
       existencia, precio, es_alimento, imagen_url, actualizado)
    VALUES
      (@id, @nombre, @categoria_id, @categoria, @unidad, @cve_prodserv,
       @existencia, @precio, @es_alimento, @imagen_url, @actualizado)
    ON CONFLICT(id) DO UPDATE SET
      nombre       = excluded.nombre,
      categoria_id = excluded.categoria_id,
      categoria    = excluded.categoria,
      unidad       = excluded.unidad,
      cve_prodserv = excluded.cve_prodserv,
      existencia   = excluded.existencia,
      precio       = excluded.precio,
      es_alimento  = excluded.es_alimento,
      imagen_url   = excluded.imagen_url,
      actualizado  = excluded.actualizado
  `);

  const upsertAll = db.transaction(prods => {
    for (const p of prods) {
      insert.run({
        id: p.id,
        nombre: p.nombre,
        categoria_id: p.categoria_id || '',
        categoria: p.categoria || '',
        unidad: p.unidad || 'pieza',
        cve_prodserv: p.cve_prodserv || '',
        existencia: p.existencia || 0,
        precio: p.precio || 0,
        es_alimento: p.es_alimento ? 1 : 0,
        imagen_url: `/img/${p.id}`,
        actualizado: ts,
      });
    }
  });

  upsertAll(productos);
  const dur = Date.now() - t0;

  db.prepare(`INSERT INTO sync_log (tabla, registros, duracion_ms, fecha) VALUES (?,?,?,?)`)
    .run('productos', productos.length, dur, ts);

  console.log(`✅ Productos sincronizados: ${productos.length} (${dur}ms)`);
  return productos.length;
}

// ── Sync ofertas ──────────────────────────────────────────────
async function syncOfertas(db) {
  console.log('⬇️  Descargando ofertas desde Aspel API...');
  const t0 = Date.now();
  const { ofertas } = await fetchJSON(`${ASPEL_API}/ofertas`);
  console.log(`   ${ofertas.length} ofertas recibidas`);

  const ts = new Date().toISOString();

  // Eliminar ofertas anteriores y reinsertar (siempre vigentes)
  db.prepare('DELETE FROM ofertas').run();

  const insert = db.prepare(`
    INSERT INTO ofertas
      (id, producto_id, nombre_producto, titulo, unidad, cve_prodserv,
       precio_original, precio_oferta, descuento_pct, badge,
       fecha_ini, fecha_fin, existencia, categoria, es_alimento, imagen_url, actualizado)
    VALUES
      (@id, @producto_id, @nombre_producto, @titulo, @unidad, @cve_prodserv,
       @precio_original, @precio_oferta, @descuento_pct, @badge,
       @fecha_ini, @fecha_fin, @existencia, @categoria, @es_alimento, @imagen_url, @actualizado)
  `);

  const insertAll = db.transaction(items => {
    for (const o of items) {
      insert.run({
        id: String(o.id),
        producto_id: o.producto_id,
        nombre_producto: o.nombre_producto || '',
        titulo: o.titulo || '',
        unidad: o.unidad || 'pieza',
        cve_prodserv: o.cve_prodserv || '',
        precio_original: o.precio_original || 0,
        precio_oferta: o.precio_oferta || 0,
        descuento_pct: o.descuento_pct || 0,
        badge: o.badge || '',
        fecha_ini: o.fecha_ini || null,
        fecha_fin: o.fecha_fin || null,
        existencia: o.existencia || 0,
        categoria: o.categoria || '',
        es_alimento: o.es_alimento ? 1 : 0,
        imagen_url: `/img/${o.producto_id}`,
        actualizado: ts,
      });
    }
  });

  insertAll(ofertas);
  const dur = Date.now() - t0;

  db.prepare(`INSERT INTO sync_log (tabla, registros, duracion_ms, fecha) VALUES (?,?,?,?)`)
    .run('ofertas', ofertas.length, dur, ts);

  console.log(`✅ Ofertas sincronizadas: ${ofertas.length} (${dur}ms)`);
  return ofertas.length;
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const solo = args.includes('--solo') ? args[args.indexOf('--solo') + 1] : null;

  const db = initDB();

  try {
    if (!solo || solo === 'prod') await syncProductos(db);
    if (!solo || solo === 'ofer') await syncOfertas(db);
    console.log('\n🎉 Sincronización completada.');
  } catch (err) {
    console.error('\n❌ Error en sincronización:', err.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
