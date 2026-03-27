// set-password.js — Script de utilidad para asignar contraseña a un cliente
// Uso: node set-password.js <clave_cliente> <nueva_contraseña>
// Ejemplo: node set-password.js 597 123456
require('dotenv').config();
const bcrypt = require('bcryptjs');
const path = require('path');

const [,, clave, password] = process.argv;
if (!clave || !password) {
  console.error('Uso: node set-password.js <clave_cliente> <contraseña>');
  process.exit(1);
}
if (password.length < 4) {
  console.error('La contraseña debe tener al menos 4 caracteres');
  process.exit(1);
}

const Database = require('better-sqlite3');
const db = new Database(path.join(__dirname, 'db', 'disroga.db'));

const cliente = db.prepare('SELECT id, nombre, clave FROM clientes WHERE TRIM(clave) = TRIM(?)').get(clave);
if (!cliente) {
  console.error(`❌ Cliente con clave "${clave}" no encontrado en la BD.`);
  console.error('   Recuerda sincronizar primero: node db/sync-clientes.js');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
db.prepare('UPDATE clientes SET password_hash = ? WHERE id = ?').run(hash, cliente.id);
console.log(`✅ Contraseña actualizada para: ${cliente.nombre} (clave: ${cliente.clave})`);
process.exit(0);
