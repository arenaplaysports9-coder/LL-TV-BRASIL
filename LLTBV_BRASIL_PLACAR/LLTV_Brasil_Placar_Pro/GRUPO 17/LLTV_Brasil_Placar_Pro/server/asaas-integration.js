'use strict';
/**
 * LLTV Brasil - integração Asaas (link de pagamento hospedado)
 * Montagem no Express: app.use('/api/billing', require('./server/asaas-integration'));
 * Segredos exclusivamente em variáveis de ambiente. Nunca expor API key no browser.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();

const PLANS = {
  inicial: { name: 'Plano Inicial', value: 40, term: 'Mensal' },
  intermediario: { name: 'Plano Intermediário', value: 80, term: '6 meses' },
  avancado: { name: 'Plano Avançado', value: 100, term: 'Anual' },
  vitalicio: { name: 'Plano Vitalício', value: 150, term: 'Pagamento único' }
};
const DATA_DIR = process.env.LLTV_BILLING_DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'billing-orders.json');
const BASE = process.env.ASAAS_ENV === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';

function readDb() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch (_) { return { links: {}, events: {}, orders: [] }; }
}
function writeDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, DB_FILE);
}
function safeEqual(a, b) {
  if (!a || !b) return false;
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
async function asaas(method, endpoint, body) {
  if (!process.env.ASAAS_API_KEY) {
    const err = new Error('Integração Asaas não configurada. Defina ASAAS_API_KEY no servidor.');
    err.status = 503; throw err;
  }
  const response = await fetch(BASE + endpoint, {
    method,
    headers: { access_token: process.env.ASAAS_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'LLTV-Brasil-Placar-Pro/1.0' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.errors?.map(e => e.description).join('; ') || `Asaas retornou HTTP ${response.status}`);
    err.status = response.status >= 500 ? 502 : 400; throw err;
  }
  return data;
}

router.get('/plans', (_req, res) => res.json({ plans: PLANS, paymentMethods: ['PIX', 'CREDIT_CARD'] }));

router.post('/checkout', async (req, res) => {
  try {
    const planKey = String(req.body?.plan || '').toLowerCase();
    const method = String(req.body?.method || '').toUpperCase();
    const plan = PLANS[planKey];
    if (!plan) return res.status(400).json({ error: 'Plano inválido.' });
    if (!['PIX', 'CREDIT_CARD'].includes(method)) return res.status(400).json({ error: 'Escolha PIX ou cartão de crédito.' });

    const orderId = `LLTV-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const link = await asaas('POST', '/paymentLinks', {
      name: `${plan.name} - LLTV Brasil Placar Pro`,
      description: `${plan.name} (${plan.term}) - acesso ao LLTV Brasil Placar Pro. Consulte as condições comerciais antes do pagamento. Pedido ${orderId}`,
      value: plan.value,
      billingType: method,
      chargeType: 'DETACHED',
      externalReference: orderId,
      notificationEnabled: true
    });
    const db = readDb();
    db.links[link.id] = { orderId, plan: planKey, planName: plan.name, value: plan.value, term: plan.term, method, createdAt: new Date().toISOString(), url: link.url };
    db.orders.push({ orderId, linkId: link.id, plan: planKey, planName: plan.name, value: plan.value, method, status: 'LINK_CRIADO', createdAt: new Date().toISOString() });
    writeDb(db);
    res.json({ orderId, url: link.url, plan: plan.name, value: plan.value, method, message: 'Link de pagamento criado. A confirmação será recebida pelo webhook do Asaas.' });
  } catch (err) { res.status(err.status || 500).json({ error: err.message || 'Não foi possível iniciar o checkout.' }); }
});

// O Asaas envia eventos POST. Configure o token de autenticação do webhook no painel Asaas.
router.post('/webhook', express.json({ limit: '256kb' }), (req, res) => {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  const received = req.get('asaas-access-token');
  if (!expected || !safeEqual(received, expected)) return res.status(401).json({ error: 'Webhook não autorizado.' });
  try {
    const event = req.body || {};
    if (!event.id) return res.status(400).json({ error: 'Evento sem identificador.' });
    const db = readDb();
    if (db.events[event.id]) return res.status(200).json({ received: true, duplicate: true });
    const payment = event.payment || {};
    const linkInfo = db.links[payment.paymentLink];
    db.events[event.id] = { receivedAt: new Date().toISOString(), event: event.event, paymentId: payment.id || null };
    if (linkInfo) {
      const order = db.orders.find(o => o.orderId === linkInfo.orderId);
      if (order) {
        order.paymentId = payment.id || order.paymentId || null;
        order.customer = payment.customer || null;
        order.status = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(event.event) ? 'PAGO_CONFIRMADO' : event.event;
        order.updatedAt = new Date().toISOString();
        if (order.status === 'PAGO_CONFIRMADO') order.paidAt = payment.confirmedDate || payment.paymentDate || new Date().toISOString();
      }
    }
    writeDb(db);
    return res.status(200).json({ received: true });
  } catch (_) { return res.status(500).json({ error: 'Falha ao processar evento.' }); }
});

// Consulta administrativa mínima; proteja com token forte e restrinja no ambiente de produção.
router.get('/admin/orders', (req, res) => {
  if (!safeEqual(req.get('x-lltv-admin-token'), process.env.LLTV_BILLING_ADMIN_TOKEN)) return res.status(401).json({ error: 'Não autorizado.' });
  const db = readDb();
  res.json({ orders: db.orders.slice(-200).reverse() });
});

router.use((err, _req, res, _next) => res.status(400).json({ error: err.message || 'Requisição inválida.' }));
module.exports = router;
