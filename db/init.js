// db/init.js — Crea la base de datos SQLite y todas las tablas
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'disroga.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
-- Clientes sincronizados de Aspel CLIE03
CREATE TABLE IF NOT EXISTS clientes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  clave        TEXT    NOT NULL UNIQUE,
  nombre       TEXT    NOT NULL,
  rfc          TEXT,
  calle        TEXT,
  telefono     TEXT,
  email        TEXT,
  saldo        REAL    DEFAULT 0,
  descuento    REAL    DEFAULT 0,
  limite_credito REAL  DEFAULT 0,
  nombre_comercial TEXT,
  password_hash    TEXT,
  reset_token      TEXT,
  reset_token_exp  INTEGER,
  activo       INTEGER DEFAULT 1,
  synced_at    TEXT    DEFAULT (datetime('now')),
  created_at   TEXT    DEFAULT (datetime('now'))
);

-- Pedidos (invitados y clientes)
CREATE TABLE IF NOT EXISTS pedidos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id      INTEGER REFERENCES clientes(id),
  nombre_contacto TEXT NOT NULL,
  empresa         TEXT,
  telefono        TEXT NOT NULL,
  email           TEXT NOT NULL,
  notas           TEXT,
  total           REAL NOT NULL DEFAULT 0,
  estado          TEXT NOT NULL DEFAULT 'pendiente',
  created_at      TEXT DEFAULT (datetime('now'))
);

-- Items del pedido
CREATE TABLE IF NOT EXISTS pedido_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id        INTEGER NOT NULL REFERENCES pedidos(id),
  producto_id      TEXT    NOT NULL,
  nombre_producto  TEXT    NOT NULL,
  cantidad         REAL    NOT NULL DEFAULT 1,
  precio_unitario  REAL    NOT NULL,
  subtotal         REAL    NOT NULL
);
`);

try {
  db.exec("ALTER TABLE clientes ADD COLUMN limite_credito REAL DEFAULT 0;");
} catch(e) {
  // Ignorar si la columna ya existe
}

console.log('✅ BD SQLite inicializada en', DB_PATH);
module.exports = db;
