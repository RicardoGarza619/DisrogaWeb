/**
 * db/init.js
 * Crea el archivo SQLite y las tablas si no existen.
 * Usa node:sqlite — integrado en Node.js v22.5+, sin instalación adicional.
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs   = require('fs');

const DB_PATH = path.join(__dirname, 'disroga.db');
const SCHEMA  = path.join(__dirname, 'schema.sql');

function initDB() {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  const sql = fs.readFileSync(SCHEMA, 'utf8');
  db.exec(sql);

  if (require.main === module) {
    console.log(`✅ BD inicializada en ${DB_PATH}`);
    console.log('Tablas creadas: productos, ofertas, sync_log');
  }
  return db;
}

module.exports = { initDB, DB_PATH };

if (require.main === module) initDB();
