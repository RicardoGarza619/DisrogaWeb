// db/sync-clientes.js — Sincroniza CLIE03 de Aspel SAE → SQLite
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Firebird = require('node-firebird');
const db = require('./init');

const FB_OPTIONS = {
  host: process.env.DB_HOST || 'DISROGA-SVR',
  port: parseInt(process.env.DB_PORT || '3050'),
  database: process.env.DB_PATH,
  user: process.env.DB_USER || 'sysdba',
  password: process.env.DB_PASSWORD || 'masterkey',
  lowercase_keys: true,
};

async function syncClientes() {
  return new Promise((resolve, reject) => {
    Firebird.attach(FB_OPTIONS, (err, fbdb) => {
      if (err) return reject(err);
      fbdb.query(`
        SELECT
          TRIM(c.cve_clie)       AS clave,
          TRIM(c.nombre)         AS nombre,
          TRIM(c.rfc)            AS rfc,
          TRIM(c.calle)          AS calle,
          TRIM(c.telefono)       AS telefono,
          TRIM(c.emailpred)      AS email,
          c.saldo                AS saldo,
          c.descuento            AS descuento,
          TRIM(c.nombre_comer)   AS nombre_comercial
        FROM clie03 c
        WHERE c.status = 'A'
      `, [], (err2, rows) => {
        fbdb.detach();
        if (err2) return reject(err2);

        const upsert = db.prepare(`
          INSERT INTO clientes (clave, nombre, rfc, calle, telefono, email, saldo, descuento, nombre_comercial, synced_at)
          VALUES (@clave, @nombre, @rfc, @calle, @telefono, @email, @saldo, @descuento, @nombre_comercial, datetime('now'))
          ON CONFLICT(clave) DO UPDATE SET
            nombre           = excluded.nombre,
            rfc              = excluded.rfc,
            calle            = excluded.calle,
            telefono         = excluded.telefono,
            email            = excluded.email,
            saldo            = excluded.saldo,
            descuento        = excluded.descuento,
            nombre_comercial = excluded.nombre_comercial,
            synced_at        = datetime('now')
        `);

        const syncMany = db.transaction((clientes) => {
          for (const c of clientes) upsert.run(c);
        });

        const clean = (v) => (typeof v === 'string' ? v.trim() : v) ?? null;
        const registros = rows.map(r => ({
          clave:            clean(r.clave),
          nombre:           clean(r.nombre),
          rfc:              clean(r.rfc),
          calle:            clean(r.calle),
          telefono:         clean(r.telefono),
          email:            clean(r.email),
          saldo:            parseFloat(r.saldo) || 0,
          descuento:        parseFloat(r.descuento) || 0,
          nombre_comercial: clean(r.nombre_comercial),
        }));

        syncMany(registros);
        console.log(`✅ Sync completado: ${registros.length} clientes`);
        resolve(registros.length);
      });
    });
  });
}

// Si se ejecuta directamente: node db/sync-clientes.js
if (require.main === module) {
  syncClientes()
    .then(n => { console.log(`Sincronizados: ${n}`); process.exit(0); })
    .catch(e => { console.error('Error sync:', e.message); process.exit(1); });
}

module.exports = { syncClientes };
