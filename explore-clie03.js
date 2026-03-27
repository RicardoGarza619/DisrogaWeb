// explore-clie03.js — Muestra los campos REALES de la tabla CLIE03
require('dotenv').config();
const Firebird = require('node-firebird');

const FB_OPTIONS = {
  host: process.env.DB_HOST || 'DISROGA-SVR',
  port: parseInt(process.env.DB_PORT || '3050'),
  database: process.env.DB_PATH,
  user: process.env.DB_USER || 'sysdba',
  password: process.env.DB_PASSWORD || 'masterkey',
  lowercase_keys: true,
};

Firebird.attach(FB_OPTIONS, (err, db) => {
  if (err) { console.error('Error conexión:', err.message); process.exit(1); }

  // 1. Columnas de CLIE03 desde el diccionario de Firebird
  db.query(`
    SELECT TRIM(rf.RDB$FIELD_NAME) AS campo
    FROM RDB$RELATION_FIELDS rf
    WHERE TRIM(rf.RDB$RELATION_NAME) = 'CLIE03'
    ORDER BY rf.RDB$FIELD_POSITION
  `, [], (err2, rows) => {
    if (err2) {
      console.error('Error leyendo columnas:', err2.message);
    } else {
      console.log('\n=== COLUMNAS DE CLIE03 ===');
      rows.forEach(r => console.log(' •', r.campo));
    }

    // 2. Un registro de ejemplo (status A)
    db.query(`SELECT FIRST 1 * FROM clie03 WHERE status = 'A'`, [], (err3, rows2) => {
      if (err3) {
        console.error('Error leyendo fila:', err3.message);
      } else if (rows2.length) {
        console.log('\n=== MUESTRA DE UN CLIENTE ACTIVO ===');
        console.log(rows2[0]);
      }
      db.detach();
    });
  });
});
