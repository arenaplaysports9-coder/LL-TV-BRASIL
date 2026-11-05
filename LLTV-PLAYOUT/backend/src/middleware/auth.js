const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET;
function requireAuth(req, res, next) {
  if (!secret || secret.length < 32) return res.status(503).json({ error: 'JWT_SECRET precisa ser configurado com pelo menos 32 caracteres.' });
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Autenticação necessária.' });
  try { req.user = jwt.verify(token, secret); next(); }
  catch { return res.status(401).json({ error: 'Token inválido ou expirado.' }); }
}
function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'Permissão insuficiente.' });
}
module.exports = { requireAuth, requireRole };
