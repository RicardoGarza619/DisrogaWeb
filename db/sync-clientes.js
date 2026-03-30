// db/sync-clientes.js — Sincroniza CLIE03 de Aspel SAE → SQLite
// Columnas de CLIE03: CLAVE, STATUS, NOMBRE, RFC, CALLE, TELEFONO,
//                     EMAILPRED, SALDO, DESCUENTO, NOMBRECOMERCIAL
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Firebird = require('node-firebird');
const db = require('./init');

const FB_OPTIONS = {
  host:         process.env.DB_HOST || 'DISROGA-SVR',
  port:         parseInt(process.env.DB_PORT || '3050'),
  database:     process.env.DB_PATH,
  user:         process.env.DB_USER || 'sysdba',
  password:     process.env.DB_PASSWORD || 'masterkey',
  lowercase_keys: true,   // todos los campos regresan en minúsculas
};

async function syncClientes() {
  return new Promise((resolve, reject) => {
    Firebird.attach(FB_OPTIONS, (err, fbdb) => {
      if (err) return reject(err);

      // Los nombres de columna se reciben en MINÚSCULAS por lowercase_keys:true
      fbdb.query(`
        SELECT
          TRIM(c.CLAVE)           AS clave,
          TRIM(c.NOMBRE)          AS nombre,
          TRIM(c.RFC)             AS rfc,
          TRIM(c.CALLE)           AS calle,
          TRIM(c.TELEFONO)        AS telefono,
          TRIM(c.EMAILPRED)       AS email,
          c.SALDO                 AS saldo,
          c.DESCUENTO             AS descuento,
          c.LIMCRED               AS limite_credito,
          TRIM(c.NOMBRECOMERCIAL) AS nombre_comercial
        FROM CLIE03 c
        WHERE c.STATUS = 'A' AND UPPER(c.CLASIFIC) STARTING WITH 'N'
      `, [], (err2, rows) => {
        fbdb.detach();
        if (err2) return reject(err2);

        const upsert = db.prepare(`
          INSERT INTO clientes
            (clave, nombre, rfc, calle, telefono, email, saldo, descuento, limite_credito, nombre_comercial, synced_at)
          VALUES
            (@clave, @nombre, @rfc, @calle, @telefono, @email, @saldo, @descuento, @limite_credito, @nombre_comercial, datetime('now'))
          ON CONFLICT(clave) DO UPDATE SET
            nombre           = excluded.nombre,
            rfc              = excluded.rfc,
            calle            = excluded.calle,
            telefono         = excluded.telefono,
            email            = excluded.email,
            saldo            = excluded.saldo,
            descuento        = excluded.descuento,
            limite_credito   = excluded.limite_credito,
            nombre_comercial = excluded.nombre_comercial,
            synced_at        = datetime('now')
        `);

        const syncMany = db.transaction((lista) => {
          for (const c of lista) upsert.run(c);
        });

        const str = (v) => (typeof v === 'string' ? v.trim() : null);
        const num = (v) => parseFloat(v) || 0;

        // Con lowercase_keys: true, los alias ya vienen en minúsculas
        const registros = rows.map(r => ({
          clave:            str(r.clave),
          nombre:           str(r.nombre),
          rfc:              str(r.rfc),
          calle:            str(r.calle),
          telefono:         str(r.telefono),
          email:            str(r.email),
          saldo:            num(r.saldo),
          descuento:        num(r.descuento),
          limite_credito:   num(r.limite_credito),
          nombre_comercial: str(r.nombre_comercial),
        }));

        syncMany(registros);
        console.log(`✅ Sync completado: ${registros.length} clientes`);
        resolve(registros.length);
      });
    });
  });
}

// Ejecutar directamente: node db/sync-clientes.js
if (require.main === module) {
  syncClientes()
    .then(n => { console.log(`Sincronizados: ${n}`); process.exit(0); })
    .catch(e => { console.error('Error sync:', e.message); process.exit(1); });
}

module.exports = { syncClientes };
