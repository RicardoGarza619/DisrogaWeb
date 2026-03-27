// lib/auth.js — Utilidades JWT + bcrypt
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET = process.env.JWT_SECRET || 'disroga_secret_2026';
const TOKEN_TTL = '7d';

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

function checkPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: TOKEN_TTL });
}

function verifyToken(token) {
  try { return jwt.verify(token, SECRET); }
  catch { return null; }
}

// Middleware Express
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Token inválido o expirado' });
  req.cliente = payload;
  next();
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  req.cliente = token ? verifyToken(token) : null;
  next();
}

module.exports = { hashPassword, checkPassword, signToken, verifyToken, requireAuth, optionalAuth };
