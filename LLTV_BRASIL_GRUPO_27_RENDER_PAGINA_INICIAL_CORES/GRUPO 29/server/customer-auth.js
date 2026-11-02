'use strict';
// LLTV Brasil Grupo 19 — autenticação de clientes licenciados (Node 18+, Express).
// Usa a mesma base billing-orders.json do Grupo 18. Requer HTTPS em produção.
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();
const DIR = process.env.LLTV_BILLING_DATA_DIR || path.join(process.cwd(), 'data');
const FILE = path.join(DIR, 'customer-auth.json');
const BILLING = path.join(DIR, 'billing-orders.json');
const COOKIE = 'lltv_customer_session';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_MS = 30 * 60 * 1000;
function read(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; } }
function write(db) { fs.mkdirSync(DIR, { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2), { mode: 0o600 }); fs.renameSync(tmp, FILE); }
function db() { return read(FILE, { users: {}, sessions: {}, resets: {} }); }
function billing() { return read(BILLING, { licenses: {}, customers: {} }); }
function email(v) { return String(v || '').trim().toLowerCase().slice(0, 180); }
function hash(password, salt = crypto.randomBytes(16).toString('hex')) { const derived = crypto.scryptSync(password, salt, 64).toString('hex'); return { salt, hash: derived }; }
function equal(a, b) { const x = Buffer.from(String(a || ''), 'hex'), y = Buffer.from(String(b || ''), 'hex'); return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y); }
function licenseFor(address) { const lic = billing().licenses[address]; if (!lic) return null; const valid = lic.status === 'ATIVA' && (lic.permanent === true || (lic.expiresAt && new Date(lic.expiresAt).getTime() > Date.now())); return valid ? lic : null; }
function cookieOptions() { return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_MS }; }
function current(req, store) { const token = String(req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1); if (!token) return null; const s = store.sessions[token]; if (!s || s.expiresAt < Date.now()) { delete store.sessions[token]; return null; } return { token, email: s.email }; }
router.post('/register', express.json({ limit: '32kb' }), (req, res) => {
  const address = email(req.body?.email), password = String(req.body?.password || '');
  if (!/^\S+@\S+\.\S+$/.test(address) || password.length < 10 || password.length > 200) return res.status(400).json({ error: 'Informe um e-mail válido e senha com pelo menos 10 caracteres.' });
  const lic = licenseFor(address); if (!lic) return res.status(403).json({ error: 'Não encontramos uma licença ativa para este e-mail. Conclua o pagamento ou procure o atendimento.' });
  const store = db(); if (store.users[address]) return res.status(409).json({ error: 'Já existe uma conta. Utilize Entrar ou recuperar senha.' });
  store.users[address] = { email: address, ...hash(password), createdAt: new Date().toISOString() }; write(store); res.status(201).json({ ok: true, message: 'Conta criada. Agora você já pode entrar.' });
});
router.post('/login', express.json({ limit: '32kb' }), (req, res) => {
  const address = email(req.body?.email), password = String(req.body?.password || ''); const store = db(), user = store.users[address];
  if (!user || !equal(hash(password, user.salt).hash, user.hash)) return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
  const lic = licenseFor(address); if (!lic) return res.status(403).json({ error: 'Sua licença não está ativa ou venceu. Consulte o atendimento.' });
  const token = crypto.randomBytes(32).toString('hex'); store.sessions[token] = { email: address, expiresAt: Date.now() + SESSION_MS }; write(store); res.cookie(COOKIE, token, cookieOptions()).json({ ok: true, customer: { email: address, name: lic.name, plan: lic.planName, expiresAt: lic.expiresAt, permanent: !!lic.permanent } });
});
router.get('/me', (req, res) => { const store = db(), session = current(req, store); if (!session) return res.status(401).json({ error: 'Sessão não encontrada.' }); const lic = licenseFor(session.email); if (!lic) { delete store.sessions[session.token]; write(store); res.clearCookie(COOKIE, { path: '/' }); return res.status(403).json({ error: 'Licença inativa ou vencida.' }); } res.json({ customer: { email: session.email, name: lic.name, plan: lic.planName, expiresAt: lic.expiresAt, permanent: !!lic.permanent } }); });
router.post('/logout', (req, res) => { const store = db(), session = current(req, store); if (session) { delete store.sessions[session.token]; write(store); } res.clearCookie(COOKIE, { path: '/' }).json({ ok: true }); });
// Recuperação segura: não revela se o e-mail existe. O envio do link exige configurar um provedor de e-mail.
router.post('/forgot-password', express.json({ limit: '16kb' }), (req, res) => { const address = email(req.body?.email), store = db(); if (store.users[address]) { const token = crypto.randomBytes(32).toString('hex'); store.resets[crypto.createHash('sha256').update(token).digest('hex')] = { email: address, expiresAt: Date.now() + RESET_MS }; write(store); if (typeof req.app.locals.lltvSendPasswordReset === 'function') { Promise.resolve(req.app.locals.lltvSendPasswordReset({ email: address, token })).catch(() => {}); } else { console.warn('[LLTV] Configure app.locals.lltvSendPasswordReset para enviar recuperação por e-mail.'); } } res.json({ ok: true, message: 'Se houver uma conta com esse e-mail, enviaremos instruções de recuperação.' }); });
router.post('/reset-password', express.json({ limit: '16kb' }), (req, res) => { const token = String(req.body?.token || ''), password = String(req.body?.password || ''); if (password.length < 10 || password.length > 200) return res.status(400).json({ error: 'A nova senha deve ter pelo menos 10 caracteres.' }); const store = db(), key = crypto.createHash('sha256').update(token).digest('hex'), record = store.resets[key]; if (!record || record.expiresAt < Date.now()) return res.status(400).json({ error: 'Link inválido ou expirado. Solicite uma nova recuperação.' }); store.users[record.email] = { email: record.email, ...hash(password), updatedAt: new Date().toISOString() }; delete store.resets[key]; for (const [id, s] of Object.entries(store.sessions)) if (s.email === record.email) delete store.sessions[id]; write(store); res.json({ ok: true, message: 'Senha alterada. Entre novamente.' }); });
module.exports = router;
