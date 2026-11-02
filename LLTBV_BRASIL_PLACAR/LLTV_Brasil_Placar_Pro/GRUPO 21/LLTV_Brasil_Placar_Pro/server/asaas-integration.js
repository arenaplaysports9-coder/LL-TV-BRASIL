'use strict';
/** LLTV Brasil - checkout Asaas + clientes/licenças. Node 18+. */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();
const PLANS = {
  inicial: { name: 'Plano Inicial', value: 40, days: 30, term: 'Mensal' },
  intermediario: { name: 'Plano Intermediário', value: 80, days: 183, term: '6 meses' },
  avancado: { name: 'Plano Avançado', value: 100, days: 365, term: 'Anual' },
  vitalicio: { name: 'Plano Vitalício', value: 150, days: null, term: 'Pagamento único' }
};
const DATA_DIR = process.env.LLTV_BILLING_DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'billing-orders.json');
const BASE = process.env.ASAAS_ENV === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
function readDb(){ try { const d=JSON.parse(fs.readFileSync(DB_FILE,'utf8')); return {links:{},events:{},orders:[],customers:{},licenses:{},...d}; } catch(_){ return {links:{},events:{},orders:[],customers:{},licenses:{}}; } }
function writeDb(db){ fs.mkdirSync(DATA_DIR,{recursive:true}); const tmp=DB_FILE+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(db,null,2),{mode:0o600}); fs.renameSync(tmp,DB_FILE); }
function safeEqual(a,b){ if(!a||!b)return false; const x=Buffer.from(String(a)),y=Buffer.from(String(b)); return x.length===y.length&&crypto.timingSafeEqual(x,y); }
function admin(req,res,next){ if(!safeEqual(req.get('x-lltv-admin-token'),process.env.LLTV_BILLING_ADMIN_TOKEN))return res.status(401).json({error:'Não autorizado.'}); next(); }
function clean(v,n=120){return String(v||'').trim().slice(0,n)}
function addPeriod(date,days){const d=new Date(date);d.setUTCDate(d.getUTCDate()+days);return d.toISOString();}
async function asaas(method,endpoint,body){ if(!process.env.ASAAS_API_KEY){const e=new Error('Asaas não configurado no servidor.');e.status=503;throw e;} const r=await fetch(BASE+endpoint,{method,headers:{access_token:process.env.ASAAS_API_KEY,'Content-Type':'application/json',Accept:'application/json','User-Agent':'LLTV-Brasil-Placar-Pro/1.0'},body:body?JSON.stringify(body):undefined});const data=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(data.errors?.map(x=>x.description).join('; ')||`Asaas HTTP ${r.status}`);e.status=r.status>=500?502:400;throw e;}return data;}
router.get('/plans',(_q,s)=>s.json({plans:PLANS,paymentMethods:['PIX','CREDIT_CARD']}));
router.post('/checkout',async(req,res)=>{try{
 const planKey=clean(req.body?.plan,30).toLowerCase(),method=clean(req.body?.method,20).toUpperCase(),plan=PLANS[planKey];
 const name=clean(req.body?.name,120),email=clean(req.body?.email,180).toLowerCase(),phone=clean(req.body?.phone,30);
 if(!plan)return res.status(400).json({error:'Plano inválido.'}); if(!['PIX','CREDIT_CARD'].includes(method))return res.status(400).json({error:'Escolha PIX ou cartão.'});
 if(name.length<2||!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:'Informe nome e e-mail válido para vincular a contratação à sua conta.'});
 const orderId=`LLTV-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
 const link=await asaas('POST','/paymentLinks',{name:`${plan.name} - LLTV Brasil`,description:`${plan.name} (${plan.term}) - pedido ${orderId}`,value:plan.value,billingType:method,chargeType:'DETACHED',externalReference:orderId,notificationEnabled:true});
 const db=readDb();db.links[link.id]={orderId,plan:planKey,planName:plan.name,value:plan.value,term:plan.term,days:plan.days,method,name,email,phone,createdAt:new Date().toISOString(),url:link.url};db.orders.push({orderId,linkId:link.id,plan:planKey,planName:plan.name,value:plan.value,method,name,email,phone,status:'AGUARDANDO_PAGAMENTO',createdAt:new Date().toISOString()});writeDb(db);
 res.json({orderId,url:link.url,plan:plan.name,value:plan.value,method,message:'Finalize o pagamento no ambiente seguro do Asaas. A licença será registrada após confirmação oficial.'});
 }catch(e){res.status(e.status||500).json({error:e.message||'Falha ao iniciar checkout.'});}});
router.post('/webhook',express.json({limit:'256kb'}),(req,res)=>{const expected=process.env.ASAAS_WEBHOOK_TOKEN;if(!expected||!safeEqual(req.get('asaas-access-token'),expected))return res.status(401).json({error:'Webhook não autorizado.'});try{
 const ev=req.body||{};if(!ev.id)return res.status(400).json({error:'Evento sem identificador.'});const db=readDb();if(db.events[ev.id])return res.status(200).json({received:true,duplicate:true});const p=ev.payment||{};const info=db.links[p.paymentLink];db.events[ev.id]={receivedAt:new Date().toISOString(),event:ev.event,paymentId:p.id||null};
 if(info){const order=db.orders.find(o=>o.orderId===info.orderId);if(order){order.paymentId=p.id||order.paymentId||null;order.status=['PAYMENT_CONFIRMED','PAYMENT_RECEIVED'].includes(ev.event)?'PAGO_CONFIRMADO':ev.event;order.updatedAt=new Date().toISOString();if(order.status==='PAGO_CONFIRMADO'){
 order.paidAt=p.confirmedDate||p.paymentDate||new Date().toISOString();const key=info.email;const now=new Date();const old=db.licenses[key];let expiresAt=null;if(info.days!==null){const base=old&&old.status==='ATIVA'&&old.expiresAt&&new Date(old.expiresAt)>now?old.expiresAt:now.toISOString();expiresAt=addPeriod(base,info.days);}db.customers[key]={name:info.name,email:key,phone:info.phone,updatedAt:now.toISOString(),createdAt:db.customers[key]?.createdAt||now.toISOString()};db.licenses[key]={email:key,name:info.name,plan:info.plan,planName:info.planName,status:'ATIVA',activatedAt:now.toISOString(),expiresAt,permanent:info.days===null,lastOrderId:info.orderId,lastPaymentId:p.id||null};
 }} }
 writeDb(db);res.json({received:true});}catch(_){res.status(500).json({error:'Falha ao processar webhook.'});}});
router.get('/admin/orders',admin,(req,res)=>{const db=readDb();res.json({orders:db.orders.slice(-500).reverse()});});
router.get('/admin/customers',admin,(req,res)=>{const db=readDb();const customers=Object.values(db.customers).map(c=>({...c,license:db.licenses[c.email]||null}));res.json({customers});});
router.patch('/admin/licenses/:email',admin,(req,res)=>{const email=clean(decodeURIComponent(req.params.email),180).toLowerCase();const db=readDb();const lic=db.licenses[email];if(!lic)return res.status(404).json({error:'Licença não encontrada.'});const status=clean(req.body?.status,20).toUpperCase();if(!['ATIVA','SUSPENSA','CANCELADA'].includes(status))return res.status(400).json({error:'Status inválido.'});lic.status=status;lic.updatedAt=new Date().toISOString();if(req.body?.expiresAt!==undefined){const d=req.body.expiresAt?new Date(req.body.expiresAt):null;if(d&&!Number.isNaN(d.getTime()))lic.expiresAt=d.toISOString();else if(req.body.expiresAt)return res.status(400).json({error:'Data de vencimento inválida.'});}writeDb(db);res.json({license:lic});});
router.get('/admin/summary',admin,(_q,res)=>{const db=readDb(),orders=db.orders;res.json({customers:Object.keys(db.customers).length,licenses:Object.values(db.licenses).filter(x=>x.status==='ATIVA').length,pending:orders.filter(x=>x.status==='AGUARDANDO_PAGAMENTO').length,paid:orders.filter(x=>x.status==='PAGO_CONFIRMADO').length});});
router.use((err,_q,res,_n)=>res.status(400).json({error:err.message||'Requisição inválida.'}));
module.exports=router;
