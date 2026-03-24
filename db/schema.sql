-- Schema SQLite para Disroga Web
-- Compatible con SQLite 3

CREATE TABLE IF NOT EXISTS productos (
  id           TEXT PRIMARY KEY,
  nombre       TEXT NOT NULL,
  categoria_id TEXT,
  categoria    TEXT,
  unidad       TEXT DEFAULT 'pieza',
  cve_prodserv TEXT,
  existencia   REAL DEFAULT 0,
  precio       REAL NOT NULL DEFAULT 0,
  es_alimento  INTEGER DEFAULT 0,   -- 1 = sin IVA, 0 = con IVA
  imagen_url   TEXT,
  actualizado  TEXT                  -- ISO timestamp de última sync
);

CREATE TABLE IF NOT EXISTS ofertas (
  id              TEXT PRIMARY KEY,
  producto_id     TEXT NOT NULL,
  nombre_producto TEXT,
  titulo          TEXT,
  unidad          TEXT DEFAULT 'pieza',
  cve_prodserv    TEXT,
  precio_original REAL DEFAULT 0,
  precio_oferta   REAL DEFAULT 0,
  descuento_pct   REAL DEFAULT 0,
  badge           TEXT,
  fecha_ini       TEXT,
  fecha_fin       TEXT,
  existencia      REAL DEFAULT 0,
  categoria       TEXT,
  es_alimento     INTEGER DEFAULT 0,
  imagen_url      TEXT,
  actualizado     TEXT
);

CREATE TABLE IF NOT EXISTS sync_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tabla       TEXT NOT NULL,
  registros   INTEGER DEFAULT 0,
  duracion_ms INTEGER DEFAULT 0,
  fecha       TEXT NOT NULL
);
