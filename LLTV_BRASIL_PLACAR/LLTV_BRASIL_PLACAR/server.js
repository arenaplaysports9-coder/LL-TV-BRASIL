const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
let ffmpegProcess = null;
let ffmpegStartedAt = 0;
let ffmpegStatus = { state: 'ENCERRADO', encoder: '', error: '', bitrate: '', fps: '', resolution: '' };
let ffmpegLog = '';
// Sinalização WebRTC em memória: o Render coordena a conexão, mas não transporta o vídeo.
const returnSignals = new Map();
function pushReturnSignal(to, message) { const q=returnSignals.get(to)||[]; q.push({...message,at:Date.now()}); returnSignals.set(to,q.slice(-200)); }
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const TOKEN_FILE = path.join(DATA_DIR, 'access-token.txt');
const SECRET_FILE = path.join(DATA_DIR, 'secret.key');
if (!process.env.LLTV_SECRET_KEY && !fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
const secretKeyHex = (process.env.LLTV_SECRET_KEY || fs.readFileSync(SECRET_FILE, 'utf8').trim());
if (!/^[a-f0-9]{64}$/i.test(secretKeyHex)) throw new Error('LLTV_SECRET_KEY deve conter 64 caracteres hexadecimais.');
const secretKey = Buffer.from(secretKeyHex, 'hex');
function encryptSecret(value) {
  if (!value || String(value).startsWith('enc:v1:')) return value || '';
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', secretKey, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `enc:v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
}
function decryptSecret(value) {
  if (typeof value !== 'string' || !value.startsWith('enc:v1:')) return value || '';
  try { const [, , ivHex, tagHex, dataHex] = value.split(':'); const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey, Buffer.from(ivHex, 'hex')); decipher.setAuthTag(Buffer.from(tagHex, 'hex')); return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8'); } catch { return ''; }
}
function hydrateSecrets(input) {
  if (input.central && Array.isArray(input.central.destinations)) input.central.destinations = input.central.destinations.map(d => ({ ...d, key: decryptSecret(d.key) }));
  return input;
}
function serializeSecrets(input) {
  const copy = JSON.parse(JSON.stringify(input));
  if (copy.central && Array.isArray(copy.central.destinations)) copy.central.destinations = copy.central.destinations.map(d => ({ ...d, key: encryptSecret(d.key) }));
  return copy;
}

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(TOKEN_FILE)) {
  fs.writeFileSync(TOKEN_FILE, crypto.randomBytes(18).toString('hex'), 'utf8');
}
const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();

// Camada SaaS: contas, planos, assinaturas e registros isolados por organização.
const SAAS_FILE = path.join(DATA_DIR, 'saas.json');
const saas = { tenants:[], users:[], plans:[
  {id:'initial',name:'INICIAL',price:40,currency:'BRL',billingCycle:'monthly',limits:{users:2,monthlyHours:5,storageMB:512,simultaneousDestinations:1},features:{scoreboard:true,central:true,replay:false,var:false,webtv:false,apps:false,ai:false},active:true},
  {id:'professional',name:'INTERMEDIÁRIO',price:80,currency:'BRL',billingCycle:'semiannual',limits:{users:5,monthlyHours:30,storageMB:5120,simultaneousDestinations:2},features:{scoreboard:true,central:true,replay:true,var:false,webtv:true,apps:false,ai:false},active:true},
  {id:'advanced',name:'AVANÇADO',price:100,currency:'BRL',billingCycle:'annual',limits:{users:10,monthlyHours:100,storageMB:20480,simultaneousDestinations:4},features:{scoreboard:true,central:true,replay:true,var:true,webtv:true,apps:false,ai:false},active:true},
  {id:'enterprise',name:'EMPRESARIAL',price:null,currency:'BRL',billingCycle:'custom',limits:{users:30,monthlyHours:500,storageMB:102400,simultaneousDestinations:8},features:{scoreboard:true,central:true,replay:true,var:true,webtv:true,apps:true,ai:true},active:true},
  {id:'custom',name:'PERSONALIZADO',price:null,currency:'BRL',billingCycle:'custom',limits:{},features:{},active:true}
],subscriptions:[],webhookEvents:[],records:{matches:[],teams:[],competitions:[],media:[],sponsors:[],broadcasts:[]},whatsappConfig:{},whatsappLogs:[],whatsappQueue:[],supportTickets:[],auditLogs:[],messageTemplates:[],financeExpenses:[],whatsappContacts:[],campaigns:[],backupHistory:[]};
try { if(fs.existsSync(SAAS_FILE)){const saved=JSON.parse(fs.readFileSync(SAAS_FILE,'utf8'));for(const k of Object.keys(saas))if(saved[k]!==undefined)saas[k]=saved[k];} } catch(e){console.error('Falha ao ler saas.json:',e.message);}
for (const plan of (saas.plans||[])) { if (plan.price === 0 || plan.price === '0' || plan.price === '0.00') plan.price = null; if (!plan.billingCycle) plan.billingCycle = 'custom'; }
// Tabela comercial solicitada para a página pública (valores mensais).
for (const [id,name,price,billingCycle] of [['initial','INICIAL',40,'monthly'],['professional','INTERMEDIÁRIO',80,'semiannual'],['advanced','AVANÇADO',100,'annual']]) { let p=saas.plans.find(x=>x.id===id); if(!p){p={id,name,price,currency:'BRL',billingCycle,limits:{},features:{},active:true};saas.plans.push(p);} else {p.name=name;p.price=price;p.currency='BRL';p.billingCycle=billingCycle;p.active=true;} }
if (!(saas.plans||[]).some(p=>p.id==='custom')) saas.plans.push({id:'custom',name:'PERSONALIZADO',price:null,currency:'BRL',billingCycle:'custom',limits:{},features:{},active:true});
const sessions=new Map();
saas.asaasConfig = saas.asaasConfig || { apiUrl:'https://api.asaas.com/v3', apiKey:'', webhookToken:'', enabledMethods:{PIX:true,CREDIT_CARD:true,BOLETO:true}, pixKey:'', pixHolder:'', pixType:'', pixQrCode:'' };
function saveSaas(){const tmp=SAAS_FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(saas,null,2),{mode:0o600});fs.renameSync(tmp,SAAS_FILE);}
function audit(action,detail=''){saas.auditLogs=saas.auditLogs||[];saas.auditLogs.push({id:'aud_'+crypto.randomBytes(6).toString('hex'),action,detail:String(detail).slice(0,300),at:new Date().toISOString()});saas.auditLogs=saas.auditLogs.slice(-2000);}
function renderMessage(template,vars={}){return String(template||'').replace(/\{([a-z_]+)\}/gi,(_,k)=>String(vars[k]??''));}
async function sendWhatsAppMessage(to,body,templateName){
 const c=saas.whatsappConfig||{};const tokenValue=decryptSecret(c.accessToken)||process.env.WHATSAPP_ACCESS_TOKEN;const phoneId=c.phoneNumberId||process.env.WHATSAPP_PHONE_NUMBER_ID;const version=c.apiVersion||process.env.WHATSAPP_API_VERSION||'v23.0';
 if(!tokenValue||!phoneId)throw new Error('WhatsApp Business Platform não configurada. Informe token e Phone Number ID no painel.');
 const digits=String(to||'').replace(/\D/g,'');if(digits.length<10||digits.length>15)throw new Error('Número de WhatsApp inválido. Use DDI + DDD + número.');
 const payload=templateName?{messaging_product:'whatsapp',to:digits,type:'template',template:{name:templateName,language:{code:c.language||'pt_BR'}}}:{messaging_product:'whatsapp',to:digits,type:'text',text:{preview_url:false,body:String(body||'').slice(0,4096)}};
 const r=await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(phoneId)}/messages`,{method:'POST',headers:{Authorization:`Bearer ${tokenValue}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error?.message||`Meta Graph API retornou HTTP ${r.status}`);
 const log={id:'wam_'+crypto.randomBytes(7).toString('hex'),to:digits,body:String(body||''),templateName:templateName||'',messageId:data.messages?.[0]?.id||'',status:'accepted',createdAt:new Date().toISOString()};saas.whatsappLogs=saas.whatsappLogs||[];saas.whatsappLogs.push(log);saas.whatsappLogs=saas.whatsappLogs.slice(-3000);saveSaas();return log;
}
async function asaasRequest(endpoint, method='GET', body) {
  const cfg=saas.asaasConfig||{}; const apiKey=decryptSecret(cfg.apiKey)||process.env.ASAAS_API_KEY;
  if(!apiKey) throw new Error('Conta Asaas não conectada. Acesse o painel exclusivo ASAAS e configure a API Key.');
  const base=(cfg.apiUrl||process.env.ASAAS_API_URL||'https://api.asaas.com/v3').replace(/\/$/,'');
  const response=await fetch(base+endpoint,{method,headers:{'access_token':apiKey,'Content-Type':'application/json','Accept':'application/json','User-Agent':'LLTV-BRASIL/2.0.0'},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error((data.errors||[]).map(e=>e.description).join('; ')||data.message||`Asaas retornou HTTP ${response.status}`);
  return data;
}
function setSubscriptionExpiry(sub){const plan=saas.plans.find(p=>p.id===sub.planId);const d=new Date();if(plan?.billingCycle==='semiannual')d.setMonth(d.getMonth()+6);else if(plan?.billingCycle==='annual')d.setFullYear(d.getFullYear()+1);else d.setMonth(d.getMonth()+1);sub.expiresAt=d.toISOString();}
function activatePaidSubscription(sub, payment) {
  if(!sub || !payment || !['PAYMENT_CONFIRMED','PAYMENT_RECEIVED'].includes(payment.event)) return false;
  if(sub.asaasPaymentId && sub.asaasPaymentId!==payment.payment.id) return false;
  sub.status='active';sub.paidAt=new Date().toISOString();sub.asaasPaymentStatus=payment.payment.status;setSubscriptionExpiry(sub);
  const tenant=saas.tenants.find(t=>t.id===sub.tenantId);if(tenant)tenant.status='active';saveSaas();return true;
}
function slugify(s){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'emissora';}
function hashPassword(password){const salt=crypto.randomBytes(16);const key=crypto.scryptSync(String(password),salt,64);return `${salt.toString('hex')}:${key.toString('hex')}`;}
function verifyPassword(password,stored){try{const [saltHex,keyHex]=String(stored).split(':');const expected=Buffer.from(keyHex,'hex');const actual=crypto.scryptSync(String(password),Buffer.from(saltHex,'hex'),expected.length);return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual);}catch{return false;}}
function getSession(req, allowBillingOnly=false){const auth=String(req.headers.authorization||'');const bearer=auth.startsWith('Bearer ')?auth.slice(7):'';const s=sessions.get(bearer);if(!s||s.expires<Date.now()){if(bearer)sessions.delete(bearer);return null;}const tenant=saas.tenants.find(t=>t.id===s.tenantId);if(!tenant)return null;const sub=saas.subscriptions.find(x=>x.tenantId===s.tenantId);if(sub?.expiresAt&&Date.now()>Date.parse(sub.expiresAt)){sub.status='expired';tenant.status='suspended';saveSaas();}if((tenant.status!=='active'||!sub||sub.status!=='active')&&!allowBillingOnly)return null;return s;}

const initialState = {
  homeName: 'TIME DA CASA', awayName: 'TIME VISITANTE',
  homeShort: 'CASA', awayShort: 'FORA',
  homeLogo: '', awayLogo: '', homeColor: '#d92332', awayColor: '#2878d0',
  homeScore: 0, awayScore: 0,
  homeYellow: 0, awayYellow: 0, homeRed: 0, awayRed: 0,
  date: new Date().toISOString().slice(0, 10),
  kickoff: '', competition: '', round: '', stadium: '', city: '',
  period: '1º TEMPO', elapsedSeconds: 0, running: false,
  addedMinutes: 0, addedTimeEnabled: false, showDate: true, showCompetition: true, showCards: false,
  brand: 'LLTV BRASIL', tagline: 'A CASA DAS LIGAS ALTERNATIVAS', overlayEnabled: true,
  lineups: {home:{coach:'',starters:[],bench:[]},away:{coach:'',starters:[],bench:[]}},
  substitutions: [], events: [], statistics: {home:{possession:50,shots:0,onTarget:0,corners:0,fouls:0,offsides:0,attacks:0,dangerousAttacks:0},away:{possession:50,shots:0,onTarget:0,corners:0,fouls:0,offsides:0,attacks:0,dangerousAttacks:0}},
  sponsors: [], ads: {enabled:false,top:{enabled:false,image:'',text:'',x:0,y:0,width:700,height:100},right:{enabled:false,image:'',text:'',x:1800,y:100,width:120,height:700},items:[],rotationSeconds:10},
  officials: {main:'',assistant1:'',assistant2:'',fourth:'',var:'',avar:'',others:[]},
  crew: {narration:'',commentary:'',reporting:'',presenter:'',imageGeneration:'',direction:'',production:'',technical:'',others:[]},
  visibility: {scoreboard:true,clock:true,addedTime:true,lineups:false,lineupsHome:false,lineupsAway:false,bench:false,substitutions:false,substitutionsHome:false,substitutionsAway:false,cards:false,statistics:false,sponsors:false,ads:false,officials:false,crew:false,matchInfo:true},
  broadcastArt: {opening:false,live:false,halftime:false,fulltime:false}, gc: {title:'',info:'',enabled:false}, competitionManager: {competitions:[]}, central: {sources:[], destinations:[], activeSourceId:null, programSourceId:null, narrator:{enabled:false,token:''}, settings:{mode:'horizontal',width:1920,height:1080,fps:30}},
  updatedAt: Date.now()
};
let state = { ...initialState };
try {
  if (fs.existsSync(STATE_FILE)) state = hydrateSecrets({ ...initialState, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) });
} catch (e) { console.error('Não foi possível ler state.json; usando valores iniciais.', e.message); }

let lastTick = Date.now();
function persist() {
  state.updatedAt = Date.now();
  const temp = STATE_FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(serializeSecrets(state), null, 2), 'utf8');
  fs.renameSync(temp, STATE_FILE);
}
function tick() {
  const now = Date.now();
  const delta = Math.floor((now - lastTick) / 1000);
  if (delta > 0) {
    if (state.running) state.elapsedSeconds = Math.max(0, Number(state.elapsedSeconds) || 0) + Math.min(delta, 5);
    lastTick += delta * 1000;
  }
}
setInterval(() => {
  const before = Number(state.elapsedSeconds) || 0;
  tick();
  if (state.running && (Number(state.elapsedSeconds) || 0) !== before) {
    persist();
    broadcast();
  }
}, 250).unref();

const clients = new Set();
function broadcast() {
  const payload = `data: ${JSON.stringify({ ...publicState(), serverNow: Date.now() })}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { clients.delete(res); }
  }
}
function publicState() {
  const copy = JSON.parse(JSON.stringify(state));
  if (copy.central && Array.isArray(copy.central.destinations)) copy.central.destinations = copy.central.destinations.map(({ key, ...destination }) => ({ ...destination, hasKey: Boolean(key) }));
  return copy;
}
function safeState() { tick(); return { ...publicState(), serverNow: Date.now() }; }

const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon' };
function send(res, code, body, type='application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
function b32encode(buf){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,value=0,out='';for(const byte of buf){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5;}}if(bits)out+=alphabet[(value<<(5-bits))&31];return out;}
function b32decode(str){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,value=0,out=[];for(const ch of String(str||'').toUpperCase().replace(/=|\s/g,'')){const n=alphabet.indexOf(ch);if(n<0)continue;value=(value<<5)|n;bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8;}}return Buffer.from(out);}
function verifyTotp(secret,code,now=Date.now()){const key=b32decode(secret);const counter=Math.floor(now/30000);for(let drift=-1;drift<=1;drift++){const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(counter+drift));const h=crypto.createHmac('sha1',key).update(b).digest();const off=h[h.length-1]&15;const n=(h.readUInt32BE(off)&0x7fffffff)%1000000;if(String(n).padStart(6,'0')===String(code||'').replace(/\s/g,''))return true;}return false;}
function isOptedOut(contact){return Boolean(contact?.optOutAt||contact?.optedOut===true);}
function addAudit(action,detail){audit(action,detail);saveSaas();}
async function webdavRequest(method, url, body){const user=process.env.BACKUP_WEBDAV_USER||'',pass=process.env.BACKUP_WEBDAV_PASSWORD||'';const headers={};if(user||pass)headers.Authorization='Basic '+Buffer.from(user+':'+pass).toString('base64');if(body){headers['Content-Type']='application/json';}const r=await fetch(url,{method,headers,...(body?{body}:{}),signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error('Armazenamento externo respondeu HTTP '+r.status);return r;}
async function createRemoteBackup(){const base=process.env.BACKUP_WEBDAV_URL;if(!base)return {skipped:true,reason:'BACKUP_WEBDAV_URL não configurada'};const safeSaas=JSON.parse(JSON.stringify(saas));if(safeSaas.adminTwoFactor?.secret)safeSaas.adminTwoFactor.secret=encryptSecret(safeSaas.adminTwoFactor.secret);const payload={format:'LLTV_BACKUP_V1',createdAt:new Date().toISOString(),appVersion:'2.7.0',encryptionKeyRequired:true,saas:safeSaas,state:serializeSecrets(state)};const name='lltv-backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';const url=base.replace(/\/$/,'')+'/'+name;await webdavRequest('PUT',url,JSON.stringify(payload));saas.backupHistory=saas.backupHistory||[];saas.backupHistory.push({name,url,createdAt:payload.createdAt,status:'uploaded'});saas.backupHistory=saas.backupHistory.slice(-100);saveSaas();return {ok:true,name,createdAt:payload.createdAt};}
function authorized(req, url) {
  const supplied = req.headers['x-lltv-token'] || url.searchParams.get('token') || '';
  const valid=supplied.length === token.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(token)); if(!valid)return false; const two=saas.adminTwoFactor||{}; const required=process.env.LLTV_ADMIN_2FA_REQUIRED!=='false'; if(required&&!two.enabled)return false; if(two.enabled){const otp=String(req.headers['x-lltv-otp']||'');return verifyTotp(two.secret,otp);} return true;
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''; req.on('data', chunk => { body += chunk; if (body.length > 5_000_000) { reject(new Error('Corpo muito grande')); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('JSON inválido')); } });
    req.on('error', reject);
  });
}
const allowed = new Set([
  'homeName','awayName','homeShort','awayShort','homeLogo','awayLogo','homeColor','awayColor','homeScore','awayScore',
  'homeYellow','awayYellow','homeRed','awayRed','date','kickoff','competition','round','stadium','city',
  'period','elapsedSeconds','running','addedMinutes','addedTimeEnabled','showDate','showCompetition','showCards','brand','tagline','lineups','substitutions','events','statistics','sponsors','ads','officials','crew','visibility','manualLineups','manualLineupsHome','manualLineupsAway','manualBench','manualSubstitutions','manualSubstitutionsHome','manualSubstitutionsAway','manualOfficials','manualCrew','broadcastArt','gc','competitionManager','competitionDisplay','central'
]);
const textFields = new Set(['homeName','awayName','homeShort','awayShort','date','kickoff','competition','round','stadium','city','period','brand','tagline','manualLineups','manualLineupsHome','manualLineupsAway','manualBench','manualSubstitutions','manualSubstitutionsHome','manualSubstitutionsAway','manualOfficials','manualCrew']);
const numericFields = new Set(['homeScore','awayScore','homeYellow','awayYellow','homeRed','awayRed','elapsedSeconds','addedMinutes']);
const boolFields = new Set(['running','addedTimeEnabled','showDate','showCompetition','showCards','overlayEnabled']);
function validatePatch(patch) {
  const out = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!allowed.has(key)) continue;
    if (textFields.has(key)) {
      if (typeof value !== 'string') continue;
      out[key] = value.slice(0, key.startsWith('manual') ? 12000 : (key.toLowerCase().includes('name') ? 35 : 120));
    } else if (numericFields.has(key)) {
      const n = Number(value);
      if (Number.isFinite(n)) out[key] = Math.max(0, Math.min(key === 'elapsedSeconds' ? 12*60*60 : 99, Math.floor(n)));
    } else if (boolFields.has(key) && typeof value === 'boolean') out[key] = value;
    else if (['lineups','substitutions','events','statistics','sponsors','ads','officials','crew','visibility','broadcastArt','gc','competitionManager','competitionDisplay','central'].includes(key)) {
      if (value && typeof value === 'object') {
        const serialized = JSON.stringify(value);
        if (serialized.length <= 4500000) out[key] = JSON.parse(serialized);
      }
    } else if (key === 'homeLogo' || key === 'awayLogo') {
      if (typeof value === 'string' && (value === '' || /^data:image\/(png|jpeg|webp|svg\+xml);base64,/i.test(value)) && value.length < 1_500_000) out[key] = value;
    }
  }
  return out;
}
async function ffmpegAvailable() {
  try { const { stdout } = await execFileAsync(FFMPEG_PATH, ['-hide_banner','-encoders'], { timeout: 12000, windowsHide: true, maxBuffer: 4*1024*1024 }); return stdout; }
  catch (e) { throw new Error('FFmpeg não encontrado. Instale FFmpeg no computador que executa o servidor ou configure FFMPEG_PATH.'); }
}
function parseEncoders(text) {
  return text.split(/\r?\n/).map(line => {
    const m = line.match(/^\s*[A-Z\.]{6}\s+([\w_]+)\s+/); return m ? m[1] : null;
  }).filter(Boolean);
}
function encoderLabel(name) { return ({h264_nvenc:'NVIDIA NVENC',h264_qsv:'Intel Quick Sync',h264_amf:'AMD AMF',libx264:'FFmpeg libx264',libx265:'FFmpeg libx265'})[name] || name; }
function makeInputArgs(body) {
  const kind = String(body.inputType || 'url');
  if (kind === 'dshow') {
    const video = String(body.videoDevice || '').trim(), audio = String(body.audioDevice || '').trim();
    if (!video) throw new Error('Informe o nome exato do dispositivo de vídeo DirectShow.');
    return ['-f','dshow','-i',`video=${video}${audio ? ':audio='+audio : ''}`];
  }
  if (kind === 'file') { const file = String(body.input || '').trim(); if (!file) throw new Error('Informe o caminho do arquivo de vídeo.'); return ['-re','-i',file]; }
  const input = String(body.input || '').trim();
  if (!/^https?:\/\/|^rtmps?:\/\/|^srt:\/\//i.test(input)) throw new Error('A fonte URL deve ser HTTP(S), RTMP(S) ou SRT.');
  return ['-i', input];
}
function stopFfmpeg() {
  if (!ffmpegProcess) return false;
  const proc = ffmpegProcess; ffmpegProcess = null; proc.__lltvStopping = true;
  try { if (process.platform === 'win32') spawn('taskkill',['/pid',String(proc.pid),'/t','/f'],{windowsHide:true,stdio:'ignore'}); else proc.kill('SIGTERM'); } catch {}
  ffmpegStatus = {...ffmpegStatus,state:'ENCERRADO'}; return true;
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/health') return send(res, 200, { ok: true, app: 'LLTV BRASIL PLACAR', version: '2.7.0', time: Date.now() });
  if (url.pathname === '/api/network' && req.method === 'GET') {
    const interfaces = [];
    for (const list of Object.values(os.networkInterfaces())) for (const n of list || []) {
      if (n.family === 'IPv4' && !n.internal) interfaces.push({ address: n.address, url: `http://${n.address}:${PORT}` });
    }
    const publicBase = (process.env.LLTV_PUBLIC_URL || '').trim().replace(/\/$/, '');
    return send(res, 200, { ok: true, port: PORT, interfaces, publicBase, currentOrigin: `http://${req.headers.host || `localhost:${PORT}`}`, note: 'Os endereços de rede local funcionam somente quando o celular e o computador estão na mesma rede Wi-Fi. Acesso pela internet exige URL pública HTTPS e configuração externa.' });
  }
  if (url.pathname === '/api/state' && req.method === 'GET') return send(res, 200, authorized(req, url) ? { ...state, serverNow: Date.now() } : safeState());
  if (url.pathname === '/api/events' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type':'text/event-stream; charset=utf-8', 'Cache-Control':'no-cache', 'Connection':'keep-alive', 'Access-Control-Allow-Origin':'*' });
    res.write(`data: ${JSON.stringify(safeState())}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (url.pathname === '/api/token' && req.method === 'GET') {
    // O painel aberto no próprio computador pode recuperar o token localmente.
    // A rota nunca entrega o token a dispositivos remotos; estes devem usar o link seguro
    // com ?token=... exibido no terminal do servidor.
    const remote = String(req.socket.remoteAddress || '').toLowerCase();
    const isLoopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
    if (!isLoopback) return send(res, 403, { error: 'Por segurança, abra o painel pelo link seguro com token exibido no computador que executa o servidor.' });
    return send(res, 200, { ok: true, token });
  }
  // Pagamentos recorrentes Asaas: o acesso só é liberado após webhook de pagamento confirmado.
  if (url.pathname === '/api/asaas/webhook' && req.method === 'POST') {
    try {
      const expected=decryptSecret(saas.asaasConfig?.webhookToken)||process.env.ASAAS_WEBHOOK_TOKEN||'';const supplied=String(req.headers['asaas-access-token']||'');
      if(!expected || supplied.length!==expected.length || !crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected))) return send(res,401,{error:'Webhook não autorizado.'});
      const event=await readBody(req);saas.lastWebhookAt=new Date().toISOString();const eventId=String(event.id||'');if(!eventId)return send(res,400,{error:'Evento sem identificador.'});
      if((saas.webhookEvents||[]).includes(eventId))return send(res,200,{received:true,duplicate:true});
      saas.webhookEvents=saas.webhookEvents||[];saas.webhookEvents.push(eventId);saas.webhookEvents=saas.webhookEvents.slice(-5000);
      const payment=event.payment||{};const sub=saas.subscriptions.find(x=>x.asaasSubscriptionId===payment.subscription||x.asaasPaymentId===payment.id||x.id===payment.externalReference);
      if(sub){saas.paymentHistory=saas.paymentHistory||[];const hist=saas.paymentHistory.find(x=>x.paymentId===payment.id);if(hist){hist.status=payment.status||event.event;hist.updatedAt=new Date().toISOString();}if(['PAYMENT_CONFIRMED','PAYMENT_RECEIVED'].includes(event.event)){sub.status='active';sub.paidAt=new Date().toISOString();setSubscriptionExpiry(sub);sub.asaasPaymentId=payment.id||sub.asaasPaymentId;sub.asaasPaymentStatus=payment.status;const tenant=saas.tenants.find(t=>t.id===sub.tenantId);if(tenant)tenant.status='active';}else if(['PAYMENT_OVERDUE','PAYMENT_DELETED','PAYMENT_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED'].includes(event.event)){sub.status='past_due';const tenant=saas.tenants.find(t=>t.id===sub.tenantId);if(tenant)tenant.status='suspended';}sub.lastAsaasEvent=event.event;}
      saveSaas();return send(res,200,{received:true});
    } catch(e){return send(res,400,{error:e.message});}
  }
  if (url.pathname === '/api/public/plans' && req.method === 'GET') return send(res,200,{items:saas.plans.filter(p=>p.active && ['initial','professional','advanced'].includes(p.id)).map(({id,name,price,currency,billingCycle})=>({id,name,price,currency,billingCycle}))});
  if (url.pathname === '/api/public/subscribe' && req.method === 'POST') {
    try {
      const b=await readBody(req);const name=String(b.company||'').trim().slice(0,100),ownerName=String(b.name||'').trim().slice(0,100),email=String(b.email||'').trim().toLowerCase(),username=String(b.username||'').trim().toLowerCase(),password=String(b.password||''),passwordConfirm=String(b.passwordConfirm||''),cpfCnpj=String(b.cpfCnpj||'').replace(/\D/g,''),phone=String(b.phone||'').replace(/\D/g,'');const plan=saas.plans.find(p=>p.id===String(b.planId||''));const billingType=String(b.billingType||'PIX').toUpperCase();
      if(!name||!ownerName||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^[a-z0-9._-]{3,30}$/.test(username)||password.length<10||(passwordConfirm&&password!==passwordConfirm)||!plan||!['initial','professional','advanced'].includes(plan.id)||cpfCnpj.length<11||cpfCnpj.length>14||phone.length<10||!['PIX','CREDIT_CARD','BOLETO'].includes(billingType)) return send(res,400,{error:'Preencha todos os dados, escolha um plano e uma forma de pagamento válida.'});
      if(saas.asaasConfig?.enabledMethods?.[billingType]===false)return send(res,400,{error:'Esta forma de pagamento está temporariamente indisponível.'});
      if(saas.users.some(u=>u.email===email||u.username===username))return send(res,409,{error:'Este e-mail ou nome de usuário já possui cadastro.'});
      const id='org_'+crypto.randomBytes(8).toString('hex'),now=new Date().toISOString();
      const tenant={id,name,slug:slugify(name),status:'pending_payment',planId:plan.id,createdAt:now,storageBytes:0,branding:{name,logo:'',primary:'#102a43',accent:'#e0ad18',domain:''},limits:plan.limits||{},features:plan.features||{}};
      const user={id:'usr_'+crypto.randomBytes(8).toString('hex'),tenantId:id,name:ownerName,email,username,phone,passwordHash:hashPassword(password),role:'owner',active:true,createdAt:now};
      const subscription={id:'sub_'+crypto.randomBytes(8).toString('hex'),tenantId:id,planId:plan.id,status:'pending_payment',createdAt:now,amount:Number(plan.price),currency:'BRL',billingCycle:plan.billingCycle,paymentMethod:billingType};
      const customer=await asaasRequest('/customers','POST',{name:ownerName,company:name,email,cpfCnpj,phone,mobilePhone:phone,externalReference:id,notificationDisabled:false});
      const dueDate=new Date(Date.now()+86400000).toISOString().slice(0,10);
      const asaasBillingType=billingType==='CREDIT_CARD'?'UNDEFINED':billingType;const payment=await asaasRequest('/payments','POST',{customer:customer.id,billingType:asaasBillingType,value:Number(plan.price),dueDate,description:`LL TV BRASIL — Plano ${plan.name}`,externalReference:subscription.id,postalService:false});
      subscription.asaasCustomerId=customer.id;subscription.asaasPaymentId=payment.id;subscription.asaasBillingType=asaasBillingType;subscription.paymentUrl=payment.invoiceUrl||payment.bankSlipUrl||'';subscription.paymentDueDate=payment.dueDate||dueDate;
      let pix=null;if(billingType==='PIX'){try{pix=await asaasRequest(`/payments/${encodeURIComponent(payment.id)}/pixQrCode`);subscription.pixQrCode=pix.encodedImage||'';subscription.pixCopyPaste=pix.payload||'';}catch(e){subscription.pixError=e.message;}}
      saas.tenants.push(tenant);saas.users.push(user);saas.subscriptions.push(subscription);saveSaas();
      return send(res,201,{ok:true,message:'Cadastro criado. Conclua o pagamento; o acesso será liberado após a confirmação do Asaas.',requestId:subscription.id,plan:{name:plan.name,price:plan.price,billingCycle:plan.billingCycle},paymentUrl:subscription.paymentUrl||null,paymentDueDate:subscription.paymentDueDate,pix:pix?{encodedImage:pix.encodedImage,payload:pix.payload,expirationDate:pix.expirationDate}:null});
    }catch(e){return send(res,400,{error:e.message});}
  }
  // SaaS multi-tenant: persistência independente do estado do placar.
  if (url.pathname === '/api/saas/login' && req.method === 'POST') {
    try {
      const body = await readBody(req); const email = String(body.email || '').trim().toLowerCase(); const password = String(body.password || '');
      const identifier = String(body.identifier || body.username || email).trim().toLowerCase(); const user = saas.users.find(u => (u.email === identifier || u.username === identifier) && u.active !== false);
      if (!user || !verifyPassword(password, user.passwordHash)) return send(res, 401, { error: 'E-mail ou senha inválidos.' });
      const tenant=saas.tenants.find(t=>t.id===user.tenantId); const subscription=saas.subscriptions.find(x=>x.tenantId===user.tenantId); if(subscription?.expiresAt&&Date.now()>Date.parse(subscription.expiresAt)){subscription.status='expired';if(tenant)tenant.status='suspended';saveSaas();} if(!tenant || !subscription) return send(res,403,{error:'Conta não encontrada.'});
      const session = crypto.randomBytes(32).toString('hex'); sessions.set(session, { userId: user.id, tenantId: user.tenantId, role: user.role, expires: Date.now() + 12*60*60*1000 });
      return send(res, 200, { ok: true, billingOnly: tenant.status!=='active'||subscription.status!=='active', token: session, user: { id:user.id, name:user.name, email:user.email, role:user.role, tenantId:user.tenantId } });
    } catch (e) { return send(res, 400, { error:e.message }); }
  }
  if(url.pathname.startsWith('/api/admin/security/2fa')){
    const supplied=req.headers['x-lltv-token']||url.searchParams.get('token')||'';const valid=supplied.length===token.length&&crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(token));if(!valid)return send(res,401,{error:'Token administrativo inválido.'});
    if(url.pathname==='/api/admin/security/2fa/status'&&req.method==='GET')return send(res,200,{enabled:Boolean(saas.adminTwoFactor?.enabled),configured:Boolean(saas.adminTwoFactor?.secret)});
    if(url.pathname==='/api/admin/security/2fa/setup'&&req.method==='POST'){const secret=b32encode(crypto.randomBytes(20));saas.adminTwoFactor={secret,pendingAt:new Date().toISOString(),enabled:false};saveSaas();return send(res,200,{secret,otpauth:`otpauth://totp/LLTV%20BRASIL:Administrador?secret=${secret}&issuer=LLTV%20BRASIL&algorithm=SHA1&digits=6&period=30`,message:'Cadastre no aplicativo autenticador e confirme com o código de 6 dígitos.'});}
    if(url.pathname==='/api/admin/security/2fa/enable'&&req.method==='POST'){const b=await readBody(req);if(!saas.adminTwoFactor?.secret||!verifyTotp(saas.adminTwoFactor.secret,b.code))return send(res,400,{error:'Código inválido.'});saas.adminTwoFactor.enabled=true;saas.adminTwoFactor.enabledAt=new Date().toISOString();saveSaas();audit('admin_2fa_enabled','Autenticação de dois fatores ativada');return send(res,200,{ok:true,enabled:true});}
    if(url.pathname==='/api/admin/security/2fa/disable'&&req.method==='POST'){const b=await readBody(req);if(!verifyTotp(saas.adminTwoFactor?.secret,b.code))return send(res,400,{error:'Código inválido.'});saas.adminTwoFactor.enabled=false;saveSaas();audit('admin_2fa_disabled','Autenticação de dois fatores desativada');return send(res,200,{ok:true});}
    return send(res,404,{error:'Rota 2FA não encontrada.'});
  }
  if(url.pathname.startsWith('/api/admin/marketing/')){
    if(!authorized(req,url))return send(res,401,{error:'Acesso administrativo não autorizado.'});
    if(url.pathname==='/api/admin/marketing/contacts'&&req.method==='GET')return send(res,200,{items:(saas.whatsappContacts||[]).map(({phone,name,consentAt,optOutAt,segments})=>({phone,name,consentAt,optOutAt,segments,optedOut:Boolean(optOutAt)}))});
    if(url.pathname==='/api/admin/marketing/contacts'&&req.method==='POST'){const b=await readBody(req);const phone=String(b.phone||'').replace(/\D/g,'');if(phone.length<10||phone.length>15||b.consent!==true)return send(res,400,{error:'Telefone válido e opt-in explícito são obrigatórios.'});saas.whatsappContacts=saas.whatsappContacts||[];let c=saas.whatsappContacts.find(x=>x.phone===phone);if(!c){c={phone};saas.whatsappContacts.push(c);}c.name=String(b.name||'').slice(0,100);c.tenantId=String(b.tenantId||'').slice(0,100);c.segments=Array.isArray(b.segments)?b.segments.map(x=>String(x).slice(0,40)).slice(0,20):[];c.consentAt=new Date().toISOString();c.optOutAt=null;c.optedOut=false;saveSaas();return send(res,201,{ok:true,contact:c});}
    if(url.pathname==='/api/admin/marketing/campaigns'&&req.method==='GET')return send(res,200,{items:(saas.campaigns||[]).slice().reverse()});
    if(url.pathname==='/api/admin/marketing/campaigns'&&req.method==='POST'){const b=await readBody(req);const name=String(b.name||'').trim(),templateName=String(b.templateName||'').trim();if(!name||!templateName)return send(res,400,{error:'Nome e modelo aprovado da campanha são obrigatórios.'});const segment=String(b.segment||'').trim();const recipients=(saas.whatsappContacts||[]).filter(c=>c.consentAt&&!isOptedOut(c)&&(!segment||(c.segments||[]).includes(segment)));if(!recipients.length)return send(res,400,{error:'Não há contatos com opt-in válido neste segmento.'});const scheduledAt=b.scheduledAt?Date.parse(b.scheduledAt):Date.now();if(!Number.isFinite(scheduledAt))return send(res,400,{error:'Data de agendamento inválida.'});const campaign={id:'cmp_'+crypto.randomBytes(7).toString('hex'),name,templateName,segment,scheduledAt:new Date(scheduledAt).toISOString(),status:'scheduled',recipientCount:recipients.length,createdAt:new Date().toISOString()};saas.campaigns=saas.campaigns||[];saas.campaigns.push(campaign);saas.whatsappQueue=saas.whatsappQueue||[];for(const c of recipients)saas.whatsappQueue.push({id:'wq_'+crypto.randomBytes(7).toString('hex'),campaignId:campaign.id,to:c.phone,templateName,scheduledAt:campaign.scheduledAt,status:'scheduled',consentAt:c.consentAt,createdAt:new Date().toISOString(),attempts:0});saveSaas();return send(res,201,{ok:true,campaign,queued:recipients.length});}
    return send(res,404,{error:'Rota de campanhas não encontrada.'});
  }
  if(url.pathname==='/api/public/whatsapp/optout'&&req.method==='POST'){const b=await readBody(req);const phone=String(b.phone||'').replace(/\D/g,'');const c=(saas.whatsappContacts||[]).find(x=>x.phone===phone);if(!c)return send(res,404,{error:'Contato não encontrado.'});c.optOutAt=new Date().toISOString();c.optedOut=true;for(const job of (saas.whatsappQueue||[]))if(job.to===phone&&job.status==='scheduled')job.status='cancelled_optout';saveSaas();return send(res,200,{ok:true,message:'Descadastramento registrado.'});}
  if(url.pathname.startsWith('/api/admin/backup/')){
    if(!authorized(req,url))return send(res,401,{error:'Acesso administrativo não autorizado.'});
    if(url.pathname==='/api/admin/backup/remote'&&req.method==='POST'){try{return send(res,200,await createRemoteBackup());}catch(e){return send(res,502,{error:e.message});}}
    if(url.pathname==='/api/admin/backup/history'&&req.method==='GET')return send(res,200,{items:(saas.backupHistory||[]).slice().reverse()});
    if(url.pathname==='/api/admin/backup/restore-remote'&&req.method==='POST'){try{const b=await readBody(req);const base=process.env.BACKUP_WEBDAV_URL;if(!base||!String(b.name||'').startsWith('lltv-backup-')||String(b.name).includes('..')||String(b.name).includes('/'))return send(res,400,{error:'Informe um nome de backup válido e configure BACKUP_WEBDAV_URL.'});const r=await webdavRequest('GET',base.replace(/\/$/,'')+'/'+b.name);const backup=await r.json();if(backup.format!=='LLTV_BACKUP_V1'||!backup.saas||!backup.state)return send(res,400,{error:'Arquivo remoto não é um backup LLTV válido.'});return send(res,200,{ok:true,backup,warning:'Revise o conteúdo e envie-o para /api/admin/backup/restore com confirm RESTAURAR LLTV.'});}catch(e){return send(res,502,{error:'Falha ao ler backup remoto: '+e.message});}}
    if(url.pathname==='/api/admin/backup/restore'&&req.method==='POST'){const b=await readBody(req);if(b.confirm!=='RESTAURAR LLTV'||b.format!=='LLTV_BACKUP_V1'||!b.saas||!b.state)return send(res,400,{error:'Backup inválido. Confirme com confirm: RESTAURAR LLTV.'});const required=['tenants','users','subscriptions','records'];if(!required.every(k=>Array.isArray(b.saas[k])||typeof b.saas[k]==='object'))return send(res,400,{error:'Estrutura do backup incompleta.'});const oldSaas=JSON.parse(JSON.stringify(saas)),oldState=JSON.parse(JSON.stringify(state));try{for(const k of Object.keys(saas))delete saas[k];Object.assign(saas,b.saas);if(saas.adminTwoFactor?.secret)saas.adminTwoFactor.secret=decryptSecret(saas.adminTwoFactor.secret);state=hydrateSecrets(b.state);saveSaas();persist();audit('backup_restored',b.createdAt||'backup importado');return send(res,200,{ok:true,message:'Restauração aplicada. Credenciais criptografadas dependem da mesma LLTV_SECRET_KEY.'});}catch(e){for(const k of Object.keys(saas))delete saas[k];Object.assign(saas,oldSaas);state=oldState;return send(res,500,{error:'Falha ao restaurar: '+e.message});}}
    return send(res,404,{error:'Rota de backup não encontrada.'});
  }
  if (url.pathname.startsWith('/api/admin/whatsapp/')) {
    const publicMetaWebhook=url.pathname==='/api/admin/whatsapp/webhook'&&(req.method==='GET'||req.method==='POST');
    if(!publicMetaWebhook&&!authorized(req,url))return send(res,401,{error:'Acesso exclusivo do Super Administrador.'});
    saas.whatsappConfig=saas.whatsappConfig||{};
    if(url.pathname==='/api/admin/whatsapp/status'&&req.method==='GET')return send(res,200,{configured:Boolean((decryptSecret(saas.whatsappConfig.accessToken)||process.env.WHATSAPP_ACCESS_TOKEN)&&(saas.whatsappConfig.phoneNumberId||process.env.WHATSAPP_PHONE_NUMBER_ID)),phoneNumberId:saas.whatsappConfig.phoneNumberId||'',businessAccountId:saas.whatsappConfig.businessAccountId||'',apiVersion:saas.whatsappConfig.apiVersion||'v23.0',language:saas.whatsappConfig.language||'pt_BR',hasVerifyToken:Boolean(decryptSecret(saas.whatsappConfig.webhookVerifyToken)||process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),hasToken:Boolean(decryptSecret(saas.whatsappConfig.accessToken)||process.env.WHATSAPP_ACCESS_TOKEN),logs:(saas.whatsappLogs||[]).slice(-30).reverse()});
    if(url.pathname==='/api/admin/whatsapp/config'&&req.method==='POST'){const b=await readBody(req);if(b.accessToken)saas.whatsappConfig.accessToken=encryptSecret(String(b.accessToken).trim());saas.whatsappConfig.phoneNumberId=String(b.phoneNumberId||'').trim().slice(0,80);saas.whatsappConfig.businessAccountId=String(b.businessAccountId||'').trim().slice(0,80);saas.whatsappConfig.apiVersion=String(b.apiVersion||'v23.0').trim().replace(/[^v0-9.]/g,'').slice(0,12);saas.whatsappConfig.language=String(b.language||'pt_BR').slice(0,12);if(b.webhookVerifyToken)saas.whatsappConfig.webhookVerifyToken=encryptSecret(String(b.webhookVerifyToken).trim());audit('whatsapp_config_updated','Configuração da API atualizada');saveSaas();return send(res,200,{ok:true,message:'Configuração salva com token criptografado no servidor.'});}
    if(url.pathname==='/api/admin/whatsapp/test'&&req.method==='POST'){const b=await readBody(req);try{const log=await sendWhatsAppMessage(b.to,b.message||'Teste de conexão LL TV BRASIL — WhatsApp Business Platform.');return send(res,200,{ok:true,log});}catch(e){return send(res,400,{ok:false,error:e.message});}}
    if(url.pathname==='/api/admin/whatsapp/send'&&req.method==='POST'){const b=await readBody(req);try{if(b.consent!==true)return send(res,400,{error:'Registre e confirme o consentimento do destinatário antes do envio.'});const log=await sendWhatsAppMessage(b.to,b.message,b.templateName);return send(res,201,{ok:true,log});}catch(e){return send(res,400,{error:e.message});}}
    if(url.pathname==='/api/admin/whatsapp/templates'&&req.method==='GET')return send(res,200,{items:saas.messageTemplates||[]});
    if(url.pathname==='/api/admin/whatsapp/templates'&&req.method==='POST'){const b=await readBody(req);if(!String(b.name||'').trim()||!String(b.body||'').trim())return send(res,400,{error:'Informe nome e conteúdo do modelo.'});saas.messageTemplates=saas.messageTemplates||[];const t={id:b.id||'tpl_'+crypto.randomBytes(6).toString('hex'),name:String(b.name).slice(0,80),body:String(b.body).slice(0,4000),category:String(b.category||'UTILITY'),purpose:String(b.purpose||''),daysBefore:Number.isFinite(Number(b.daysBefore))?Number(b.daysBefore):null,metaApprovedName:String(b.metaApprovedName||'').slice(0,100),updatedAt:new Date().toISOString()};const i=saas.messageTemplates.findIndex(x=>x.id===t.id);if(i>=0)saas.messageTemplates[i]=t;else saas.messageTemplates.push(t);saveSaas();return send(res,200,{ok:true,item:t});}
    if(url.pathname==='/api/admin/whatsapp/queue'&&req.method==='GET')return send(res,200,{items:(saas.whatsappQueue||[]).slice().reverse()});
    if(url.pathname==='/api/admin/whatsapp/queue'&&req.method==='POST'){const b=await readBody(req);const to=String(b.to||'').replace(/\D/g,'');const templateName=String(b.templateName||'').trim();const when=Date.parse(b.scheduledAt||Date.now());if(b.consent!==true)return send(res,400,{error:'É obrigatório registrar consentimento/opt-in.'});if(to.length<10||to.length>15||!templateName||!Number.isFinite(when))return send(res,400,{error:'Informe telefone, modelo oficial aprovado e data válida.'});const job={id:'wq_'+crypto.randomBytes(7).toString('hex'),to,templateName,scheduledAt:new Date(when).toISOString(),status:'scheduled',consentAt:new Date().toISOString(),createdAt:new Date().toISOString(),attempts:0};saas.whatsappQueue=saas.whatsappQueue||[];saas.whatsappQueue.push(job);saveSaas();return send(res,201,{ok:true,item:job});}
    if(url.pathname.startsWith('/api/admin/whatsapp/queue/')&&req.method==='DELETE'){const id=url.pathname.split('/').pop();const job=(saas.whatsappQueue||[]).find(x=>x.id===id);if(!job)return send(res,404,{error:'Agendamento não encontrado.'});if(job.status!=='scheduled')return send(res,409,{error:'Somente agendamentos pendentes podem ser cancelados.'});job.status='cancelled';saveSaas();return send(res,200,{ok:true});}
    if(url.pathname==='/api/admin/whatsapp/webhook'&&req.method==='GET'){const mode=url.searchParams.get('hub.mode'),verify=url.searchParams.get('hub.verify_token'),challenge=url.searchParams.get('hub.challenge');const expected=decryptSecret(saas.whatsappConfig.webhookVerifyToken)||process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN||'';if(mode==='subscribe'&&expected&&verify===expected)return send(res,200,challenge||'','text/plain; charset=utf-8');return send(res,403,{error:'Verificação do webhook recusada.'});}
    if(url.pathname==='/api/admin/whatsapp/webhook'&&req.method==='POST'){const appSecret=process.env.WHATSAPP_APP_SECRET||'';if(!appSecret)return send(res,503,{error:'Configure WHATSAPP_APP_SECRET para validar a assinatura do webhook.'});const raw=await new Promise((resolve,reject)=>{let chunks=[];let size=0;req.on('data',c=>{size+=c.length;if(size>5000000){reject(new Error('Corpo muito grande'));req.destroy();}else chunks.push(c)});req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject)});const signature=String(req.headers['x-hub-signature-256']||'');const expected='sha256='+crypto.createHmac('sha256',appSecret).update(raw).digest('hex');if(signature.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return send(res,401,{error:'Assinatura do webhook inválida.'});const b=JSON.parse(raw.toString('utf8')||'{}');saas.whatsappWebhookEvents=saas.whatsappWebhookEvents||[];for(const entry of (b.entry||[]))for(const change of (entry.changes||[])){for(const msg of (change.value?.messages||[])){const textBody=String(msg.text?.body||'').trim().toUpperCase();if(['STOP','SAIR','PARAR','CANCELAR','REMOVER'].includes(textBody)){const phone=String(msg.from||'').replace(/\D/g,'');const c=(saas.whatsappContacts||[]).find(x=>x.phone===phone);if(c){c.optOutAt=new Date().toISOString();c.optedOut=true;for(const job of (saas.whatsappQueue||[]))if(job.to===phone&&job.status==='scheduled')job.status='cancelled_optout';}}}for(const status of (change.value?.statuses||[])){const log=(saas.whatsappLogs||[]).find(x=>x.messageId===status.id);if(log){log.status=status.status;log.statusAt=new Date().toISOString();log.errors=status.errors||[];}}}saas.whatsappWebhookEvents.push({at:new Date().toISOString(),count:(b.entry||[]).length});saas.whatsappWebhookEvents=saas.whatsappWebhookEvents.slice(-3000);saveSaas();return send(res,200,{ok:true});}
    return send(res,404,{error:'Rota WhatsApp não encontrada.'});
  }
  if (url.pathname.startsWith('/api/tenant/support/')) {
    const session=getSession(req,true); if(!session)return send(res,401,{error:'Faça login para acessar o atendimento.'});
    saas.supportTickets=saas.supportTickets||[];
    if(url.pathname==='/api/tenant/support/tickets'&&req.method==='GET')return send(res,200,{items:saas.supportTickets.filter(t=>t.tenantId===session.tenantId).slice().reverse()});
    if(url.pathname==='/api/tenant/support/tickets'&&req.method==='POST'){
      const b=await readBody(req);if(!String(b.subject||'').trim()||!String(b.message||'').trim())return send(res,400,{error:'Informe assunto e mensagem.'});
      const user=saas.users.find(u=>u.id===session.userId);const t={id:'ticket_'+crypto.randomBytes(7).toString('hex'),tenantId:session.tenantId,userId:session.userId,name:user?.name||'',email:user?.email||'',subject:String(b.subject).slice(0,180),message:String(b.message).slice(0,5000),category:String(b.category||'Geral').slice(0,60),status:'Aberto',createdAt:new Date().toISOString(),updates:[]};saas.supportTickets.push(t);saveSaas();audit('support_ticket_created',t.id);return send(res,201,{ok:true,ticket:t});
    }
    const mt=url.pathname.match(/^\/api\/tenant\/support\/tickets\/([^/]+)$/);if(mt&&req.method==='POST'){const t=saas.supportTickets.find(x=>x.id===mt[1]&&x.tenantId===session.tenantId);if(!t)return send(res,404,{error:'Chamado não encontrado.'});const b=await readBody(req);if(!String(b.message||'').trim())return send(res,400,{error:'Digite a mensagem.'});t.updates=t.updates||[];t.updates.push({message:String(b.message).slice(0,5000),at:new Date().toISOString(),by:'client'});if(t.status==='Aguardando cliente')t.status='Em atendimento';saveSaas();return send(res,200,{ok:true,ticket:t});}
    return send(res,404,{error:'Rota de atendimento não encontrada.'});
  }
  if (url.pathname.startsWith('/api/admin/support/')) {
    if(!authorized(req,url))return send(res,401,{error:'Acesso exclusivo do Super Administrador.'});
    if(url.pathname==='/api/admin/support/tickets'&&req.method==='GET')return send(res,200,{items:(saas.supportTickets||[]).slice().reverse()});
    if(url.pathname==='/api/admin/support/tickets'&&req.method==='POST'){const b=await readBody(req);if(!String(b.subject||'').trim()||!String(b.message||'').trim())return send(res,400,{error:'Informe assunto e mensagem.'});const tenantId=String(b.tenantId||'');if(!saas.tenants.some(x=>x.id===tenantId))return send(res,400,{error:'Organização inválida.'});const t={id:'ticket_'+crypto.randomBytes(7).toString('hex'),tenantId,name:String(b.name||'').slice(0,120),email:String(b.email||'').slice(0,160),subject:String(b.subject).slice(0,180),message:String(b.message).slice(0,5000),category:String(b.category||'Geral'),status:'Aberto',createdAt:new Date().toISOString(),updates:[]};saas.supportTickets=saas.supportTickets||[];saas.supportTickets.push(t);saveSaas();return send(res,201,{ok:true,ticket:t});}
    const m=url.pathname.match(/^\/api\/admin\/support\/tickets\/([^/]+)$/);if(m&&req.method==='PATCH'){const t=(saas.supportTickets||[]).find(x=>x.id===m[1]);if(!t)return send(res,404,{error:'Chamado não encontrado.'});const b=await readBody(req);if(['Aberto','Em atendimento','Aguardando cliente','Resolvido','Encerrado'].includes(b.status))t.status=b.status;if(b.reply){t.updates=t.updates||[];t.updates.push({message:String(b.reply).slice(0,5000),at:new Date().toISOString(),by:'admin'});}saveSaas();return send(res,200,{ok:true,ticket:t});}
    return send(res,404,{error:'Rota de atendimento não encontrada.'});
  }
  if (url.pathname.startsWith('/api/admin/finance/')) {
    if(!authorized(req,url))return send(res,401,{error:'Acesso exclusivo do Super Administrador.'});
    if(url.pathname==='/api/admin/finance/summary'&&req.method==='GET'){const history=saas.paymentHistory||[];const received=history.filter(x=>['RECEIVED','CONFIRMED','PAYMENT_RECEIVED','PAYMENT_CONFIRMED'].includes(x.status));const pending=history.filter(x=>['PENDING','AWAITING_RISK_ANALYSIS','AWAITING_CHARGEBACK_REVERSAL'].includes(x.status));const overdue=history.filter(x=>x.status==='OVERDUE');const expenses=saas.financeExpenses||[];const expenseTotal=expenses.reduce((n,x)=>n+Number(x.amount||0),0);return send(res,200,{receivedTotal:received.reduce((n,x)=>n+Number(x.amount||0),0),pendingTotal:pending.reduce((n,x)=>n+Number(x.amount||0),0),overdueTotal:overdue.reduce((n,x)=>n+Number(x.amount||0),0),expenseTotal,netReceived:received.reduce((n,x)=>n+Number(x.amount||0),0)-expenseTotal,receivedCount:received.length,pendingCount:pending.length,overdueCount:overdue.length,expenseCount:expenses.length,expenses:expenses.slice().reverse(),history:history.slice(-500).reverse()});}
    if(url.pathname==='/api/admin/finance/expenses'&&req.method==='GET')return send(res,200,{items:(saas.financeExpenses||[]).slice().reverse()});
    if(url.pathname==='/api/admin/finance/expenses'&&req.method==='POST'){const b=await readBody(req);const amount=Number(b.amount);if(!String(b.description||'').trim()||!Number.isFinite(amount)||amount<=0)return send(res,400,{error:'Informe descrição e valor válido.'});const x={id:'exp_'+crypto.randomBytes(7).toString('hex'),description:String(b.description).slice(0,180),category:String(b.category||'Geral').slice(0,80),amount,currency:'BRL',date:String(b.date||new Date().toISOString().slice(0,10)).slice(0,10),createdAt:new Date().toISOString()};saas.financeExpenses=saas.financeExpenses||[];saas.financeExpenses.push(x);saveSaas();audit('finance_expense_created',x.id);return send(res,201,{ok:true,item:x});}
    const ex=url.pathname.match(/^\/api\/admin\/finance\/expenses\/([^/]+)$/);if(ex&&req.method==='DELETE'){const i=(saas.financeExpenses||[]).findIndex(x=>x.id===ex[1]);if(i<0)return send(res,404,{error:'Despesa não encontrada.'});saas.financeExpenses.splice(i,1);saveSaas();audit('finance_expense_deleted',ex[1]);return send(res,200,{ok:true});}
    return send(res,404,{error:'Rota financeira não encontrada.'});
  }
  if (url.pathname === '/api/admin/security/audit' && req.method === 'GET') {if(!authorized(req,url))return send(res,401,{error:'Acesso exclusivo do Super Administrador.'});return send(res,200,{items:(saas.auditLogs||[]).slice(-500).reverse()});}
  if (url.pathname === '/api/admin/backup/export' && req.method === 'GET') {if(!authorized(req,url))return send(res,401,{error:'Acesso exclusivo do Super Administrador.'});const safeSaas=JSON.parse(JSON.stringify(saas));if(safeSaas.asaasConfig){safeSaas.asaasConfig.apiKey='';safeSaas.asaasConfig.webhookToken='';}if(safeSaas.whatsappConfig){safeSaas.whatsappConfig.accessToken='';safeSaas.whatsappConfig.webhookVerifyToken='';}if(safeSaas.adminTwoFactor){safeSaas.adminTwoFactor.secret='';safeSaas.adminTwoFactor.enabled=false;}const safeState=JSON.parse(JSON.stringify(state));if(safeState.central?.destinations)safeState.central.destinations=safeState.central.destinations.map(d=>({...d,key:''}));const payload={generatedAt:new Date().toISOString(),version:'2.7.0',notice:'Credenciais externas foram omitidas por segurança; reconfigure-as após a restauração.',saas:safeSaas,state:safeState};return send(res,200,payload,'application/json; charset=utf-8');}
  if (url.pathname.startsWith('/api/admin/asaas/')) {
    if(!authorized(req,url))return send(res,401,{error:'Acesso exclusivo do Super Administrador.'});
    const cfg=saas.asaasConfig;
    if(url.pathname==='/api/admin/asaas/status'&&req.method==='GET')return send(res,200,{connected:Boolean(decryptSecret(cfg.apiKey)||process.env.ASAAS_API_KEY),apiUrl:cfg.apiUrl||process.env.ASAAS_API_URL||'https://api.asaas.com/v3',environment:(cfg.apiUrl||process.env.ASAAS_API_URL||'').includes('sandbox')?'SANDBOX':'PRODUÇÃO',hasWebhookToken:Boolean(decryptSecret(cfg.webhookToken)||process.env.ASAAS_WEBHOOK_TOKEN),enabledMethods:cfg.enabledMethods||{},pixKey:cfg.pixKey||'',pixHolder:cfg.pixHolder||'',pixType:cfg.pixType||'',lastWebhook:saas.lastWebhookAt||null});
    if(url.pathname==='/api/admin/asaas/config'&&req.method==='POST'){const b=await readBody(req);const apiUrl=String(b.apiUrl||'https://api.asaas.com/v3');if(!/^https:\/\/(api|api-sandbox)\.asaas\.com\/v3$/.test(apiUrl))return send(res,400,{error:'URL oficial inválida. Use produção ou sandbox do Asaas.'});if(b.apiKey)cfg.apiKey=encryptSecret(String(b.apiKey).trim());if(b.webhookToken)cfg.webhookToken=encryptSecret(String(b.webhookToken).trim());cfg.apiUrl=apiUrl;cfg.enabledMethods={PIX:b.pix!==false,CREDIT_CARD:b.creditCard!==false,BOLETO:b.boleto!==false};cfg.pixKey=String(b.pixKey||'').slice(0,150);cfg.pixHolder=String(b.pixHolder||'').slice(0,100);cfg.pixType=String(b.pixType||'').slice(0,30);saveSaas();return send(res,200,{ok:true,message:'Configurações protegidas e salvas.'});}
    if(url.pathname==='/api/admin/asaas/test'&&req.method==='POST'){try{const account=await asaasRequest('/myAccount');return send(res,200,{ok:true,account:{name:account.name||account.company||'Conta Asaas',email:account.email||'',walletId:account.walletId||''}});}catch(e){return send(res,400,{ok:false,error:e.message});}}
    if(url.pathname==='/api/admin/asaas/webhook-info'&&req.method==='GET'){const host=String(req.headers.host||'');const proto=String(req.headers['x-forwarded-proto']||'https').split(',')[0];return send(res,200,{url:`${proto}://${host}/api/asaas/webhook`,header:'asaas-access-token',events:['PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_OVERDUE','PAYMENT_DELETED','PAYMENT_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED']});}
    return send(res,404,{error:'Rota de administração Asaas não encontrada.'});
  }
  if (url.pathname.startsWith('/api/saas/') && url.pathname !== '/api/saas/login') {
    if (!authorized(req, url)) return send(res, 401, { error:'Acesso exclusivo do Super Admin LL TV BRASIL.' });
    if (url.pathname === '/api/saas/summary' && req.method === 'GET') {
      return send(res,200,{ok:true,tenants:saas.tenants.length,activeTenants:saas.tenants.filter(t=>t.status==='active').length,overdueTenants:saas.tenants.filter(t=>t.status==='suspended').length,pendingPayments:saas.subscriptions.filter(x=>x.status==='pending_payment').length,activeSubscriptions:saas.subscriptions.filter(x=>x.status==='active').length,overdueSubscriptions:saas.subscriptions.filter(x=>['past_due','expired'].includes(x.status)).length,revenueConfirmed:(saas.paymentHistory||[]).filter(x=>['RECEIVED','CONFIRMED','PAYMENT_RECEIVED','PAYMENT_CONFIRMED'].includes(x.status)).reduce((n,x)=>n+Number(x.amount||0),0),plans:saas.plans.length,users:saas.users.length,subscriptions:saas.subscriptions.length,storageBytes:saas.tenants.reduce((n,t)=>n+(Number(t.storageBytes)||0),0),tenantsList:saas.tenants.map(({id,name,slug,status,planId,createdAt})=>({id,name,slug,status,planId,createdAt}))});
    }
    if (url.pathname === '/api/saas/tenants' && req.method === 'GET') return send(res,200,{items:saas.tenants});
    if (url.pathname === '/api/saas/tenants' && req.method === 'POST') {
      try { const b=await readBody(req); const name=String(b.name||'').trim(); const email=String(b.email||'').trim().toLowerCase(); const password=String(b.password||''); if(!name||!email||password.length<10) return send(res,400,{error:'Informe nome, e-mail e senha com pelo menos 10 caracteres.'}); if(saas.users.some(u=>u.email===email)) return send(res,409,{error:'Este e-mail já está cadastrado.'}); const id='org_'+crypto.randomBytes(8).toString('hex'); const tenant={id,name,slug:slugify(name),status:'active',planId:b.planId||null,createdAt:new Date().toISOString(),storageBytes:0,branding:{name,logo:'',primary:'#102a43',accent:'#e0ad18',domain:''},limits:{users:3,monthlyHours:10,storageMB:1024,simultaneousDestinations:1},features:{scoreboard:true,central:true,replay:false,var:false,webtv:false,apps:false,ai:false}}; saas.tenants.push(tenant); saas.users.push({id:'usr_'+crypto.randomBytes(8).toString('hex'),tenantId:id,name:String(b.ownerName||name),email,role:'owner',passwordHash:hashPassword(password),active:true,createdAt:new Date().toISOString()}); saas.subscriptions.push({id:'sub_'+crypto.randomBytes(8).toString('hex'),tenantId:id,planId:tenant.planId,status:'active',createdAt:new Date().toISOString(),amount:0,currency:'BRL'}); saveSaas(); return send(res,201,{ok:true,tenant}); } catch(e){return send(res,400,{error:e.message});}
    }
    const tenantMatch=url.pathname.match(/^\/api\/saas\/tenants\/([\w-]+)$/);
    if(tenantMatch && req.method==='PATCH'){const t=saas.tenants.find(x=>x.id===tenantMatch[1]);if(!t)return send(res,404,{error:'Cliente não encontrado.'});const b=await readBody(req);for(const k of ['name','status','planId','limits','features','branding'])if(b[k]!==undefined)t[k]=b[k];saveSaas();return send(res,200,{ok:true,tenant:t});}
    if (url.pathname === '/api/saas/plans' && req.method === 'GET') return send(res,200,{items:saas.plans});
    if (url.pathname === '/api/saas/plans' && req.method === 'POST') {const b=await readBody(req);if(!String(b.name||'').trim())return send(res,400,{error:'Nome do plano obrigatório.'});const raw=String(b.price??'').trim();const price=raw===''?null:Number(raw);if(price!==null&&(!Number.isFinite(price)||price<0))return send(res,400,{error:'Informe um preço válido ou deixe o valor em branco para contratação personalizada.'});const p={id:b.id||'plan_'+crypto.randomBytes(6).toString('hex'),name:String(b.name).slice(0,60),price,currency:'BRL',billingCycle:b.billingCycle||'custom',limits:b.limits||{},features:b.features||{},active:b.active!==false};const i=saas.plans.findIndex(x=>x.id===p.id);if(i>=0)saas.plans[i]=p;else saas.plans.push(p);saveSaas();return send(res,200,{ok:true,plan:p});}
    if (url.pathname === '/api/saas/subscriptions' && req.method === 'GET') return send(res,200,{items:saas.subscriptions});
    const approvalMatch=url.pathname.match(/^\/api\/saas\/subscriptions\/([\w-]+)\/approve$/); if(approvalMatch && req.method==='POST'){const sub=saas.subscriptions.find(x=>x.id===approvalMatch[1]);if(!sub)return send(res,404,{error:'Solicitação não encontrada.'});sub.status='active';sub.activatedAt=new Date().toISOString();sub.manualApproval=true;setSubscriptionExpiry(sub);const tenant=saas.tenants.find(x=>x.id===sub.tenantId);if(tenant)tenant.status='active';saveSaas();return send(res,200,{ok:true,subscription:sub});}
    const rejectMatch=url.pathname.match(/^\/api\/saas\/subscriptions\/([\w-]+)\/reject$/); if(rejectMatch && req.method==='POST'){const sub=saas.subscriptions.find(x=>x.id===rejectMatch[1]);if(!sub)return send(res,404,{error:'Solicitação não encontrada.'});sub.status='cancelled';const tenant=saas.tenants.find(x=>x.id===sub.tenantId);if(tenant)tenant.status='suspended';saveSaas();return send(res,200,{ok:true});}
    return send(res,404,{error:'Rota SaaS não encontrada.'});
  }
  // Área de assinatura acessível mesmo quando a assinatura estiver vencida.
  if (url.pathname === '/api/billing/me' && req.method === 'GET') {
    const s=getSession(req,true); if(!s)return send(res,401,{error:'Faça login novamente.'});
    const sub=saas.subscriptions.find(x=>x.tenantId===s.tenantId); const tenant=saas.tenants.find(x=>x.id===s.tenantId);
    return send(res,200,{tenant:{id:tenant.id,name:tenant.name,status:tenant.status},subscription:sub||null,plans:saas.plans.filter(p=>['initial','professional','advanced'].includes(p.id)).map(({id,name,price,billingCycle})=>({id,name,price,billingCycle})),history:(saas.paymentHistory||[]).filter(x=>x.tenantId===s.tenantId)});
  }
  if (url.pathname === '/api/billing/renew' && req.method === 'POST') {
    try { const s=getSession(req,true);if(!s)return send(res,401,{error:'Faça login novamente.'});const b=await readBody(req);const plan=saas.plans.find(p=>p.id===String(b.planId||''));const billingType=String(b.billingType||'PIX').toUpperCase();if(!plan||!['initial','professional','advanced'].includes(plan.id)||!['PIX','CREDIT_CARD','BOLETO'].includes(billingType))return send(res,400,{error:'Plano ou forma de pagamento inválida.'});if(saas.asaasConfig?.enabledMethods?.[billingType]===false)return send(res,400,{error:'Forma de pagamento indisponível.'});const user=saas.users.find(u=>u.id===s.userId);const tenant=saas.tenants.find(t=>t.id===s.tenantId);const customerId=(saas.subscriptions.find(x=>x.tenantId===s.tenantId)||{}).asaasCustomerId;if(!customerId)return send(res,400,{error:'Cliente ainda não está vinculado ao Asaas. Solicite suporte ao administrador.'});const dueDate=new Date(Date.now()+86400000).toISOString().slice(0,10);const bt=billingType==='CREDIT_CARD'?'UNDEFINED':billingType;const payment=await asaasRequest('/payments','POST',{customer:customerId,billingType:bt,value:Number(plan.price),dueDate,description:`LL TV BRASIL — Renovação ${plan.name}`,externalReference:`${s.tenantId}:${plan.id}:${Date.now()}`,postalService:false});let pix=null;if(billingType==='PIX')pix=await asaasRequest(`/payments/${encodeURIComponent(payment.id)}/pixQrCode`);const old=saas.subscriptions.find(x=>x.tenantId===s.tenantId);if(old){old.status='pending_payment';old.planId=plan.id;old.amount=Number(plan.price);old.billingCycle=plan.billingCycle;old.asaasPaymentId=payment.id;old.paymentUrl=payment.invoiceUrl||payment.bankSlipUrl||'';old.paymentDueDate=payment.dueDate||dueDate;old.paymentMethod=billingType;}saas.paymentHistory=saas.paymentHistory||[];saas.paymentHistory.push({tenantId:s.tenantId,paymentId:payment.id,amount:Number(plan.price),planId:plan.id,method:billingType,status:payment.status||'PENDING',createdAt:new Date().toISOString(),invoiceUrl:payment.invoiceUrl||payment.bankSlipUrl||''});tenant.status='suspended';saveSaas();return send(res,201,{ok:true,paymentUrl:payment.invoiceUrl||payment.bankSlipUrl||null,pix:pix?{encodedImage:pix.encodedImage,payload:pix.payload}:null,dueDate});}catch(e){return send(res,400,{error:e.message});}
  }
  if (url.pathname === '/api/billing/cancel' && req.method === 'POST') {const s=getSession(req,true);if(!s)return send(res,401,{error:'Faça login novamente.'});const sub=saas.subscriptions.find(x=>x.tenantId===s.tenantId);if(sub){sub.cancelAtPeriodEnd=true;sub.cancelRequestedAt=new Date().toISOString();saveSaas();}return send(res,200,{ok:true,message:'Cancelamento solicitado. O acesso permanece até o fim do período já pago.'});}
  if (url.pathname === '/api/tenant/me' && req.method === 'GET') { const s=getSession(req); if(!s)return send(res,401,{error:'Sessão inválida ou expirada.'}); const user=saas.users.find(u=>u.id===s.userId); const tenant=saas.tenants.find(t=>t.id===s.tenantId); return send(res,200,{user:{id:user.id,name:user.name,email:user.email,role:user.role},tenant}); }
  if (url.pathname.startsWith('/api/tenant/')) {
    const session=getSession(req); if(!session)return send(res,401,{error:'Faça login para acessar este ambiente.'});
    const collection=url.pathname.split('/')[3]; const allowedCollections=new Set(['matches','teams','competitions','media','sponsors','broadcasts']); if(!allowedCollections.has(collection))return send(res,404,{error:'Módulo não encontrado.'});
    saas.records[collection]=saas.records[collection]||[]; const list=saas.records[collection].filter(r=>r.tenantId===session.tenantId);
    if(req.method==='GET')return send(res,200,{items:list});
    if(req.method==='POST'){const b=await readBody(req);const item={...b,id:'rec_'+crypto.randomBytes(8).toString('hex'),tenantId:session.tenantId,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};delete item.password;saas.records[collection].push(item);saveSaas();return send(res,201,{item});}
    const id=url.pathname.split('/')[4];const index=saas.records[collection].findIndex(r=>r.id===id&&r.tenantId===session.tenantId);if(index<0)return send(res,404,{error:'Registro não encontrado.'});
    if(req.method==='PATCH'){const b=await readBody(req);const old=saas.records[collection][index];saas.records[collection][index]={...old,...b,id:old.id,tenantId:old.tenantId,updatedAt:new Date().toISOString()};saveSaas();return send(res,200,{item:saas.records[collection][index]});}
    if(req.method==='DELETE'){saas.records[collection].splice(index,1);saveSaas();return send(res,200,{ok:true});}
    return send(res,405,{error:'Método não permitido.'});
  }

  if (url.pathname === '/api/public/webtv' && req.method === 'GET') { const webtv=state.central?.webtv||{}; const candidate=String(webtv.streamUrl||''); let streamUrl=''; try { const parsed=new URL(candidate); if(['http:','https:'].includes(parsed.protocol)) streamUrl=parsed.href; } catch {} return send(res,200,{title:String(webtv.title||'LL TV BRASIL — AO VIVO').slice(0,120),streamUrl}); }
  // Central de agendamento multiplataforma — dados persistentes e segredos cifrados.
  if (url.pathname.startsWith('/api/admin/broadcast/')) {
    const oauthCallback=url.pathname==='/api/admin/broadcast/youtube/callback';
    if (!oauthCallback && !authorized(req,url)) return send(res,401,{error:'Acesso administrativo não autorizado.'});
    saas.broadcastIntegrations=saas.broadcastIntegrations||{};
    saas.broadcastAccounts=saas.broadcastAccounts||[];
    saas.broadcastSchedules=saas.broadcastSchedules||[];
    const providers=['youtube','facebook','instagram','tiktok','twitch','x','linkedin','kick'];
    if(url.pathname==='/api/admin/broadcast/integrations'&&req.method==='GET'){
      const items=providers.map(provider=>{const c=saas.broadcastIntegrations[provider]||{};return {provider,configured:Boolean(c.clientId||c.appId||c.apiKey),clientId:c.clientId||'',appId:c.appId||'',redirectUri:c.redirectUri||'',hasClientSecret:Boolean(decryptSecret(c.clientSecret)),hasApiKey:Boolean(decryptSecret(c.apiKey)),hasAccessToken:Boolean(decryptSecret(c.accessToken)),status:c.status||'not_connected',updatedAt:c.updatedAt||null};});
      return send(res,200,{items,accounts:saas.broadcastAccounts.map(a=>({...a,token:undefined,refreshToken:undefined}))});
    }
    if(url.pathname==='/api/admin/broadcast/integrations'&&req.method==='POST'){
      const b=await readBody(req),provider=String(b.provider||'').toLowerCase();if(!providers.includes(provider))return send(res,400,{error:'Plataforma inválida.'});
      const old=saas.broadcastIntegrations[provider]||{};const c={...old,provider,clientId:String(b.clientId||old.clientId||'').slice(0,500),appId:String(b.appId||old.appId||'').slice(0,500),redirectUri:String(b.redirectUri||old.redirectUri||'').slice(0,1000),apiKey:b.apiKey?encryptSecret(String(b.apiKey)):old.apiKey||'',clientSecret:b.clientSecret?encryptSecret(String(b.clientSecret)):old.clientSecret||'',appSecret:b.appSecret?encryptSecret(String(b.appSecret)):old.appSecret||'',accessToken:b.accessToken?encryptSecret(String(b.accessToken)):old.accessToken||'',rtmpUrl:String(b.rtmpUrl||old.rtmpUrl||'').slice(0,1000),streamKey:b.streamKey?encryptSecret(String(b.streamKey)):old.streamKey||'',status:old.status||'configured',updatedAt:new Date().toISOString()};
      saas.broadcastIntegrations[provider]=c;saveSaas();audit('broadcast_integration_saved',provider);return send(res,200,{ok:true,message:'Credenciais salvas e protegidas.',provider});
    }
    if(url.pathname==='/api/admin/broadcast/integrations/test'&&req.method==='POST'){
      const b=await readBody(req),provider=String(b.provider||'').toLowerCase(),c=saas.broadcastIntegrations[provider]||{};
      if(provider==='youtube'){
        if(!c.clientId||!decryptSecret(c.clientSecret))return send(res,400,{ok:false,error:'Cadastre Client ID e Client Secret do Google.'});
        if(!saas.broadcastAccounts.some(a=>a.provider==='youtube'&&a.status==='connected'))return send(res,200,{ok:false,status:'awaiting_authorization',message:'Credenciais cadastradas. Conecte uma conta Google para testar os recursos autorizados.'});
        const a=saas.broadcastAccounts.find(x=>x.provider==='youtube'&&x.status==='connected');try{const r=await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',{headers:{Authorization:'Bearer '+decryptSecret(a.accessToken)}});const d=await r.json();if(!r.ok)throw new Error(d.error?.message||'Falha YouTube HTTP '+r.status);return send(res,200,{ok:true,status:'connected',channels:(d.items||[]).map(x=>({id:x.id,title:x.snippet?.title}))});}catch(e){return send(res,400,{ok:false,error:e.message});}
      }
      // Diagnóstico real por API oficial para os demais provedores. A validação de identidade
      // não significa, por si só, que a conta tenha permissão para criar/agendar uma LIVE.
      const access=decryptSecret(c.accessToken)||'';
      const profiles={
        facebook:{url:'https://graph.facebook.com/v23.0/me?fields=id,name',headers:{Authorization:'Bearer '+access}},
        instagram:{url:'https://graph.facebook.com/v23.0/me?fields=id,username',headers:{Authorization:'Bearer '+access}},
        twitch:{url:'https://api.twitch.tv/helix/users',headers:{Authorization:'Bearer '+access,'Client-Id':c.clientId||''}},
        x:{url:'https://api.x.com/2/users/me',headers:{Authorization:'Bearer '+access}},
        linkedin:{url:'https://api.linkedin.com/v2/userinfo',headers:{Authorization:'Bearer '+access}},
        tiktok:{url:'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',headers:{Authorization:'Bearer '+access}},
        kick:{url:'https://api.kick.com/public/v1/users',headers:{Authorization:'Bearer '+access}}
      };
      if(profiles[provider]){
        if(!access)return send(res,200,{ok:false,status:'awaiting_authorization',message:'Cadastre as credenciais da aplicação e conclua o OAuth oficial. O teste de identidade exige Access Token válido.'});
        if(provider==='twitch'&&!c.clientId)return send(res,400,{ok:false,status:'missing_client_id',error:'A Twitch exige Client ID junto com o token.'});
        try{const r=await fetch(profiles[provider].url,{headers:profiles[provider].headers});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error((d.message||d.error_description||d.error||'API recusou a solicitação')+' (HTTP '+r.status+')');
          const data=d.data?.[0]||d.data||d;const externalId=String(data.id||data.user_id||data.open_id||data.sub||'');const name=String(data.name||data.username||data.display_name||data.login||data.localizedFirstName||'Conta autorizada');
          if(!externalId)throw new Error('A API respondeu, mas não retornou identificador de conta reconhecível. Confira os escopos autorizados.');
          let account=saas.broadcastAccounts.find(a=>a.provider===provider&&a.externalId===externalId);const saved={id:account?.id||'acct_'+crypto.randomBytes(7).toString('hex'),provider,externalId,name,status:'connected',accessToken:encryptSecret(access),connectedAt:new Date().toISOString()};if(account)Object.assign(account,saved);else saas.broadcastAccounts.push(saved);c.status='connected';c.lastTestAt=new Date().toISOString();saveSaas();audit('broadcast_provider_identity_verified',provider+':'+externalId);return send(res,200,{ok:true,status:'connected',account:{id:saved.id,provider,name,externalId},message:'Identidade validada pela API oficial. Os recursos de LIVE/agendamento dependem das permissões e elegibilidade desta conta.'});
        }catch(e){c.status='error';c.lastError=String(e.message||e).slice(0,400);saveSaas();return send(res,400,{ok:false,status:'invalid_credentials_or_permissions',error:c.lastError});}
      }
      const configured=Boolean(c.clientId||c.appId||decryptSecret(c.apiKey)||access);return send(res,200,{ok:false,status:configured?'awaiting_platform_validation':'not_configured',message:configured?'Credenciais cadastradas, mas este provedor ainda não possui verificação de identidade implementada neste servidor.':'Cadastre as credenciais oficiais primeiro.'});
    }
    if(url.pathname==='/api/admin/broadcast/youtube/connect'&&req.method==='GET'){
      const c=saas.broadcastIntegrations.youtube||{};if(!c.clientId||!decryptSecret(c.clientSecret))return send(res,400,{error:'Cadastre Client ID e Client Secret do Google.'});
      const redirect=c.redirectUri||(`${(process.env.LLTV_PUBLIC_URL||(`${req.headers['x-forwarded-proto']||'https'}://${req.headers.host}`)).replace(/\/$/,'')}/api/admin/broadcast/youtube/callback`);
      const nonce=crypto.randomBytes(24).toString('hex');saas.youtubeOAuthPending=saas.youtubeOAuthPending||{};saas.youtubeOAuthPending[nonce]={createdAt:Date.now(),redirect};saveSaas();const q=new URLSearchParams({client_id:c.clientId,redirect_uri:redirect,response_type:'code',scope:'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload',access_type:'offline',prompt:'consent',state:nonce});res.writeHead(302,{Location:'https://accounts.google.com/o/oauth2/v2/auth?'+q.toString(), 'Cache-Control':'no-store'});return res.end();
    }
    if(url.pathname==='/api/admin/broadcast/youtube/callback'&&req.method==='GET'){
      const nonce=url.searchParams.get('state')||'',pending=saas.youtubeOAuthPending?.[nonce];if(!pending||Date.now()-pending.createdAt>10*60*1000)return send(res,400,'Autorização inválida ou expirada. Volte ao painel e tente novamente.','text/plain; charset=utf-8');delete saas.youtubeOAuthPending[nonce];
      if(url.searchParams.get('error')){saveSaas();return send(res,400,'Autorização Google não concluída: '+url.searchParams.get('error'),'text/plain; charset=utf-8');}
      try{const c=saas.broadcastIntegrations.youtube;const form=new URLSearchParams({code:url.searchParams.get('code')||'',client_id:c.clientId,client_secret:decryptSecret(c.clientSecret),redirect_uri:pending.redirect,grant_type:'authorization_code'});const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form});const d=await r.json();if(!r.ok)throw new Error(d.error_description||d.error||'Falha na troca do código OAuth');const info=await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',{headers:{Authorization:'Bearer '+d.access_token}});const ch=await info.json();if(!info.ok)throw new Error(ch.error?.message||'Não foi possível consultar canais');for(const x of (ch.items||[])){const old=saas.broadcastAccounts.find(a=>a.provider==='youtube'&&a.externalId===x.id);const account={id:old?.id||'acct_'+crypto.randomBytes(7).toString('hex'),provider:'youtube',externalId:x.id,name:x.snippet?.title||'Canal YouTube',status:'connected',accessToken:encryptSecret(d.access_token),refreshToken:d.refresh_token?encryptSecret(d.refresh_token):(old?.refreshToken||''),expiresAt:Date.now()+Number(d.expires_in||3600)*1000,connectedAt:new Date().toISOString()};if(old)Object.assign(old,account);else saas.broadcastAccounts.push(account);}c.status='connected';saveSaas();audit('broadcast_youtube_connected',(ch.items||[]).length+' canais');return send(res,200,'Conta Google conectada. Você pode voltar ao Painel LLTV Brasil.','text/plain; charset=utf-8');}catch(e){saveSaas();return send(res,502,'Falha na conexão YouTube: '+e.message,'text/plain; charset=utf-8');}
    }
    if(url.pathname==='/api/admin/broadcast/schedules'&&req.method==='GET')return send(res,200,{items:saas.broadcastSchedules.slice().sort((a,b)=>String(a.scheduledAt).localeCompare(String(b.scheduledAt)))});
    if(url.pathname==='/api/admin/broadcast/schedules'&&req.method==='POST'){
      const b=await readBody(req),title=String(b.title||'').trim(),scheduled=Date.parse(b.scheduledAt),destinations=Array.isArray(b.destinations)?b.destinations:[];if(!title||!Number.isFinite(scheduled)||scheduled<Date.now()-60000||!destinations.length)return send(res,400,{error:'Informe título, data futura válida e pelo menos um destino.'});
      let cover='';if(b.coverData){const m=String(b.coverData).match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);if(!m)return send(res,400,{error:'Capa inválida. Use PNG, JPG ou WebP.'});const buf=Buffer.from(m[2],'base64');if(buf.length>5*1024*1024)return send(res,400,{error:'A capa deve ter no máximo 5 MB.'});const dir=path.join(DATA_DIR,'broadcast-covers');fs.mkdirSync(dir,{recursive:true});const name='cover_'+crypto.randomBytes(12).toString('hex')+({ 'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'}[m[1]]);fs.writeFileSync(path.join(dir,name),buf,{mode:0o600});cover='/api/admin/broadcast/cover/'+name;}
      const id='brd_'+crypto.randomBytes(8).toString('hex');const item={id,title:title.slice(0,200),description:String(b.description||'').slice(0,5000),tags:Array.isArray(b.tags)?b.tags.map(x=>String(x).slice(0,50)).slice(0,30):String(b.tags||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,30),category:String(b.category||'Sports').slice(0,80),language:String(b.language||'pt-BR').slice(0,20),visibility:String(b.visibility||'public'),timezone:String(b.timezone||'America/Sao_Paulo'),scheduledAt:new Date(scheduled).toISOString(),cover,obsScene:String(b.obsScene||''),obsProfile:String(b.obsProfile||''),status:b.draft?'draft':'scheduled',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),destinations:destinations.map(d=>({provider:String(d.provider||'').toLowerCase(),accountId:String(d.accountId||''),status:'pending_validation',message:'Aguardando validação e processamento da plataforma.',externalId:'',url:''}))};
      if(item.destinations.some(d=>!providers.includes(d.provider)))return send(res,400,{error:'Um ou mais destinos são inválidos.'});
      // Criação nativa real no YouTube quando há conta autorizada; demais destinos permanecem explicitamente pendentes até seu adaptador/permissão ser validado.
      for(const dest of item.destinations){
        if(dest.provider!=='youtube')continue;
        const account=saas.broadcastAccounts.find(a=>a.id===dest.accountId&&a.provider==='youtube'&&a.status==='connected');if(!account){dest.status='not_connected';dest.message='Selecione uma conta/canal YouTube conectado.';continue;}
        try{
          let access=decryptSecret(account.accessToken);if(account.expiresAt<Date.now()+60000&&decryptSecret(account.refreshToken)){const cfg=saas.broadcastIntegrations.youtube;const form=new URLSearchParams({client_id:cfg.clientId,client_secret:decryptSecret(cfg.clientSecret),refresh_token:decryptSecret(account.refreshToken),grant_type:'refresh_token'});const rr=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form});const rd=await rr.json();if(!rr.ok)throw new Error(rd.error_description||rd.error||'Falha ao renovar token');access=rd.access_token;account.accessToken=encryptSecret(access);account.expiresAt=Date.now()+Number(rd.expires_in||3600)*1000;saveSaas();}
          const api='https://www.googleapis.com/youtube/v3';const headers={Authorization:'Bearer '+access,'Content-Type':'application/json'};
          const br=await fetch(api+'/liveBroadcasts?part=snippet,status,contentDetails',{method:'POST',headers,body:JSON.stringify({snippet:{title:item.title,description:item.description,scheduledStartTime:item.scheduledAt},status:{privacyStatus:['public','unlisted','private'].includes(item.visibility)?item.visibility:'public',selfDeclaredMadeForKids:false},contentDetails:{enableAutoStart:false,enableAutoStop:false}})});const bd=await br.json();if(!br.ok)throw new Error(bd.error?.message||'YouTube não criou o evento (HTTP '+br.status+')');
          const sr=await fetch(api+'/liveStreams?part=snippet,cdn,contentDetails,status',{method:'POST',headers,body:JSON.stringify({snippet:{title:item.title+' — Sinal'},cdn:{frameRate:'variable',ingestionType:'rtmp',resolution:'variable'},contentDetails:{isReusable:false}})});const sd=await sr.json();if(!sr.ok)throw new Error(sd.error?.message||'Evento criado, mas falhou ao criar entrada de sinal. Evento: '+bd.id);
          const bind=await fetch(api+'/liveBroadcasts/bind?id='+encodeURIComponent(bd.id)+'&part=id,contentDetails&streamId='+encodeURIComponent(sd.id),{method:'POST',headers});const bindData=await bind.json();if(!bind.ok)throw new Error(bindData.error?.message||'Evento criado, mas falhou a vinculação do sinal.');
          dest.status='confirmed';dest.message='Evento ao vivo criado e vinculado no YouTube; aguardando início do sinal.';dest.externalId=bd.id;dest.streamId=sd.id;dest.url='https://www.youtube.com/watch?v='+bd.id;dest.ingestionAddress=sd.cdn?.ingestionInfo?.ingestionAddress||'';dest.streamName=encryptSecret(sd.cdn?.ingestionInfo?.streamName||'');dest.hasStreamKey=Boolean(sd.cdn?.ingestionInfo?.streamName);
          if(item.cover){try{const coverFile=path.join(DATA_DIR,'broadcast-covers',path.basename(item.cover));const image=fs.readFileSync(coverFile);if(image.length<=2*1024*1024){const mimeType=coverFile.endsWith('.png')?'image/png':coverFile.endsWith('.webp')?'image/webp':'image/jpeg';const tr=await fetch(api+'/thumbnails/set?videoId='+encodeURIComponent(bd.id),{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':mimeType},body:image});const td=await tr.json().catch(()=>({}));dest.coverStatus=tr.ok?'uploaded':('failed: '+(td.error?.message||tr.status));}else dest.coverStatus='failed: YouTube limita a miniatura a 2 MB.';}catch(e){dest.coverStatus='failed: '+e.message;}}
        }catch(e){dest.status='error';dest.message=String(e.message||e).slice(0,500);}
      }
      item.status=item.destinations.every(d=>d.status==='confirmed')?'confirmed':(item.destinations.some(d=>d.status==='confirmed')?'partially_confirmed':'scheduled');saas.broadcastSchedules.push(item);saveSaas();audit('broadcast_schedule_created',id);return send(res,201,{ok:true,item:{...item,destinations:item.destinations.map(({streamName,ingestionAddress,...d})=>({...d,hasStreamKey:Boolean(streamName||d.hasStreamKey)}))}});
    }
    const match=url.pathname.match(/^\/api\/admin\/broadcast\/schedules\/([A-Za-z0-9_-]+)$/);if(match){const item=saas.broadcastSchedules.find(x=>x.id===match[1]);if(!item)return send(res,404,{error:'Agendamento não encontrado.'});if(req.method==='PUT'){const b=await readBody(req);if(b.title!==undefined)item.title=String(b.title).slice(0,200);if(b.description!==undefined)item.description=String(b.description).slice(0,5000);if(b.scheduledAt!==undefined){const d=Date.parse(b.scheduledAt);if(!Number.isFinite(d)||d<Date.now()-60000)return send(res,400,{error:'Data inválida.'});item.scheduledAt=new Date(d).toISOString();}if(b.status&&['draft','scheduled','cancelled'].includes(b.status))item.status=b.status;item.updatedAt=new Date().toISOString();saveSaas();audit('broadcast_schedule_updated',item.id);return send(res,200,{ok:true,item});}if(req.method==='DELETE'){item.status='deleted';item.updatedAt=new Date().toISOString();saveSaas();audit('broadcast_schedule_deleted',item.id);return send(res,200,{ok:true});}}
    const coverMatch=url.pathname.match(/^\/api\/admin\/broadcast\/cover\/(cover_[a-f0-9]+\.(?:png|jpg|webp))$/);if(coverMatch&&req.method==='GET'){const f=path.join(DATA_DIR,'broadcast-covers',coverMatch[1]);if(!fs.existsSync(f))return send(res,404,{error:'Capa não encontrada.'});res.writeHead(200,{'Content-Type':coverMatch[1].endsWith('.png')?'image/png':coverMatch[1].endsWith('.webp')?'image/webp':'image/jpeg','Cache-Control':'private, max-age=3600'});return fs.createReadStream(f).pipe(res);}
  }
  if (url.pathname.startsWith('/api/')) {
    if (!authorized(req, url)) return send(res, 401, { error: 'Acesso não autorizado. Abra o painel pelo link seguro exibido no computador.' });
    if (url.pathname === '/api/return/signal' && req.method === 'POST') {
      try { const b=await readBody(req); const to=String(b.to||'').slice(0,100), from=String(b.from||'').slice(0,100), type=String(b.type||''); if(!to||!from||!['offer','answer','candidate','close','heartbeat'].includes(type)) return send(res,400,{error:'Sinal WebRTC inválido.'}); pushReturnSignal(to,{from,type,data:b.data||null}); return send(res,200,{ok:true}); } catch(e){return send(res,400,{error:e.message});}
    }
    if (url.pathname === '/api/return/poll' && req.method === 'GET') { const client=String(url.searchParams.get('client')||'').slice(0,100); if(!client)return send(res,400,{error:'Cliente ausente.'}); const items=returnSignals.get(client)||[]; returnSignals.set(client,[]); return send(res,200,{items}); }
    if (url.pathname === '/api/encoders/discover' && req.method === 'GET') {
      try {
        const raw = await ffmpegAvailable(); const encoders = parseEncoders(raw);
        const candidates = ['h264_nvenc','h264_qsv','h264_amf','libx264','libx265'].filter(x => encoders.includes(x));
        const verified = []; for (const name of candidates) { try { await execFileAsync(FFMPEG_PATH,['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=320x180:rate=15','-t','1','-an','-c:v',name,'-f','null','-'],{timeout:12000,windowsHide:true,maxBuffer:512*1024}); verified.push(name); } catch {} }
        const cpu = os.cpus();
        return send(res,200,{ok:true,ffmpeg:FFMPEG_PATH,version:(await execFileAsync(FFMPEG_PATH,['-version'],{timeout:8000,windowsHide:true})).stdout.split(/\r?\n/)[0],encoders:verified.map(name=>({name,label:encoderLabel(name),type:name==='libx264'||name==='libx265'?'software':'hardware',tested:true})),listedEncoders:candidates,allEncoders:encoders,cpu:{model:cpu[0]?.model||'n/d',cores:cpu.length},platform:process.platform,host:os.hostname()});
      } catch(e) { return send(res,503,{ok:false,error:e.message,encoders:[]}); }
    }
    if (url.pathname === '/api/encoders/test' && req.method === 'POST') {
      try {
        const body=await readBody(req), name=String(body.encoder||'libx264'); const available=parseEncoders(await ffmpegAvailable());
        if(!available.includes(name)) return send(res,400,{ok:false,error:`Encoder ${name} não está disponível neste ambiente.`});
        await execFileAsync(FFMPEG_PATH,['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=640x360:rate=25','-t','2','-an','-c:v',name,'-f','null','-'],{timeout:20000,windowsHide:true,maxBuffer:1024*1024});
        return send(res,200,{ok:true,encoder:name,label:encoderLabel(name),message:'Teste real de codificação concluído.'});
      } catch(e) { return send(res,422,{ok:false,error:(e.stderr||e.message||'Falha no teste').toString().slice(-1200)}); }
    }
    if (url.pathname === '/api/multistream/status' && req.method === 'GET') return send(res,200,{...ffmpegStatus,active:Boolean(ffmpegProcess),elapsedSeconds:ffmpegProcess?Math.floor((Date.now()-ffmpegStartedAt)/1000):0,log:ffmpegLog.slice(-1500)});
    if (url.pathname === '/api/multistream/stop' && req.method === 'POST') { const stopped=stopFfmpeg(); return send(res,200,{ok:true,stopped,state:'ENCERRADO'}); }
    if (url.pathname === '/api/multistream/start' && req.method === 'POST') {
      try {
        if(ffmpegProcess) return send(res,409,{error:'Já existe uma multitransmissão em execução.'});
        const body=await readBody(req); const encoder=String(body.encoder||'libx264');
        const available=parseEncoders(await ffmpegAvailable()); if(!available.includes(encoder)) return send(res,400,{error:`Encoder ${encoder} indisponível no computador/servidor local.`});
        const destinations=(state.central?.destinations||[]).filter(d=>d.enabled!==false && d.url && d.key);
        if(!destinations.length) return send(res,400,{error:'Cadastre e ative pelo menos um destino com URL e chave.'});
        const inputArgs=makeInputArgs(body); const settings=state.central?.settings||{}; const width=Math.max(320,Math.min(3840,Number(settings.width)||1280)),height=Math.max(240,Math.min(2160,Number(settings.height)||720)),fps=Math.max(1,Math.min(60,Number(settings.fps)||30));
        const args=['-hide_banner','-nostdin','-y',...inputArgs,'-map','0:v:0','-map','0:a?','-c:v',encoder];
        if(encoder==='libx264'||encoder==='libx265') args.push('-preset','veryfast');
        args.push('-b:v',String(body.videoBitrate||'4500k'),'-maxrate',String(body.videoBitrate||'4500k'),'-bufsize',String(body.videoBitrate||'4500k'),'-vf',`scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,fps=${fps}`,'-c:a','aac','-b:a','128k','-ar','48000');
        for(const d of destinations){const key=decryptSecret(d.key);const target=String(d.url).replace(/\/$/,'')+'/'+key;args.push('-f','flv',target);}
        ffmpegLog=''; ffmpegStatus={state:'CONECTANDO',encoder,label:encoderLabel(encoder),error:'',resolution:`${width}x${height}`,fps:String(fps),bitrate:String(body.videoBitrate||'4500k')};
        const child=spawn(FFMPEG_PATH,args,{windowsHide:true,stdio:['ignore','ignore','pipe']}); ffmpegProcess=child; ffmpegStartedAt=Date.now();
        child.stderr.on('data',buf=>{const line=buf.toString();ffmpegLog=(ffmpegLog+line).slice(-12000);const m=line.match(/frame=\s*(\d+).*?fps=\s*([\d.]+).*?bitrate=\s*([^\s]+)/);if(m){ffmpegStatus.state='AO VIVO';ffmpegStatus.fps=m[2];ffmpegStatus.bitrate=m[3];}});
        child.on('error',err=>{ffmpegStatus={...ffmpegStatus,state:'ERRO',error:err.message};ffmpegProcess=null;});
        child.on('exit',(code,signal)=>{const intentional=Boolean(child.__lltvStopping);ffmpegStatus={...ffmpegStatus,state:(code===0||intentional)?'ENCERRADO':'ERRO',error:(code===0||intentional)?'':`FFmpeg encerrou (código ${code}, sinal ${signal||'n/d'}).`};if(ffmpegProcess===child)ffmpegProcess=null;});
        return send(res,200,{ok:true,state:'CONECTANDO',encoder:encoderLabel(encoder),destinations:destinations.length});
      } catch(e) { ffmpegStatus={...ffmpegStatus,state:'ERRO',error:e.message}; return send(res,400,{error:e.message}); }
    }
    if (url.pathname.startsWith('/api/obs/')) return send(res, 410, { error: 'Integração OBS removida na versão 1.5.0. A LLTV Brasil está migrando para produção independente.' });
    if (url.pathname === '/api/state' && req.method === 'POST') {
      try {
        const patch = validatePatch(await readBody(req));
        if ('running' in patch && patch.running === true && !state.running) lastTick = Date.now();
        if ('elapsedSeconds' in patch) lastTick = Date.now();
        state = { ...state, ...patch, updatedAt: Date.now() };
        persist(); broadcast(); return send(res, 200, { ...state, serverNow: Date.now() });
      } catch (e) { return send(res, 400, { error: e.message }); }
    }
    if (url.pathname === '/api/reset' && req.method === 'POST') {
      state = { ...initialState, date: state.date, homeName: state.homeName, awayName: state.awayName, homeShort: state.homeShort, awayShort: state.awayShort, homeLogo: state.homeLogo, awayLogo: state.awayLogo, updatedAt: Date.now() };
      lastTick = Date.now(); persist(); broadcast(); return send(res, 200, safeState());
    }
    return send(res, 404, { error: 'Endpoint não encontrado' });
  }
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const file = path.resolve(PUBLIC, '.' + pathname);
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, 'Arquivo não encontrado', 'text/plain; charset=utf-8');
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600', 'X-Content-Type-Options':'nosniff' });
  fs.createReadStream(file).pipe(res);
});
// Worker persistente da Central de Agendamento: lembretes e atualização de estado (não inicia encoder remoto).
let broadcastWorkerBusy=false;
setInterval(()=>{if(broadcastWorkerBusy)return;broadcastWorkerBusy=true;try{saas.broadcastSchedules=saas.broadcastSchedules||[];saas.broadcastNotifications=saas.broadcastNotifications||[];const now=Date.now();let changed=false;for(const item of saas.broadcastSchedules){if(!['scheduled','confirmed','partially_confirmed'].includes(item.status))continue;const start=Date.parse(item.scheduledAt);if(!Number.isFinite(start))continue;for(const mins of [30,10]){const key=item.id+':'+mins;if(start-now<=mins*60000&&start-now>(mins-1)*60000&&!saas.broadcastNotifications.some(n=>n.key===key)){saas.broadcastNotifications.push({id:'bn_'+crypto.randomBytes(6).toString('hex'),key,scheduleId:item.id,title:item.title,type:'reminder',minutesBefore:mins,createdAt:new Date().toISOString(),read:false});changed=true;}}if(start<=now&&item.status!=='cancelled'&&item.status!=='deleted'&&!item.startedAt){item.status=item.destinations.some(d=>d.status==='confirmed')?'ready_to_start':'requires_attention';item.readyAt=item.readyAt||new Date().toISOString();changed=true;}}if(changed)saveSaas();}catch(e){console.error('Broadcast scheduler:',e.message);}finally{broadcastWorkerBusy=false;}},15000).unref();
// Worker persistente: processa somente modelos oficiais e agendamentos com opt-in registrado.
let reminderWorkerBusy=false;
setInterval(async()=>{if(reminderWorkerBusy)return;reminderWorkerBusy=true;try{const now=Date.now();for(const sub of (saas.subscriptions||[])){if(sub.status!=='active'||!sub.expiresAt)continue;const days=Math.ceil((Date.parse(sub.expiresAt)-now)/86400000);if(![7,3,1,0,-1].includes(days))continue;const key=`${sub.id}:${days}`;saas.reminderSent=saas.reminderSent||{};if(saas.reminderSent[key])continue;const tenant=saas.tenants.find(t=>t.id===sub.tenantId);const contact=(saas.whatsappContacts||[]).find(c=>c.tenantId===sub.tenantId&&c.consentAt&&!isOptedOut(c));if(!contact)continue;const tpl=(saas.messageTemplates||[]).find(t=>t.purpose==='billing_reminder'&&t.daysBefore===days);if(!tpl||!tpl.metaApprovedName)continue;saas.whatsappQueue.push({id:'wq_'+crypto.randomBytes(7).toString('hex'),to:contact.phone,templateName:tpl.metaApprovedName,scheduledAt:new Date().toISOString(),status:'scheduled',consentAt:contact.consentAt,createdAt:new Date().toISOString(),attempts:0,reminderKey:key});saas.reminderSent[key]=new Date().toISOString();saveSaas();break;}}catch(e){console.error('Reminder worker:',e.message);}finally{reminderWorkerBusy=false;}},60000).unref();
let lastRemoteBackupDay='';
setInterval(async()=>{if(!process.env.BACKUP_WEBDAV_URL)return;const day=new Date().toISOString().slice(0,10);if(day===lastRemoteBackupDay)return;try{const result=await createRemoteBackup();if(result.ok)lastRemoteBackupDay=day;}catch(e){console.error('Backup externo automático:',e.message);}},60000).unref();
let whatsappWorkerBusy=false;
setInterval(async()=>{if(whatsappWorkerBusy)return;whatsappWorkerBusy=true;try{const now=Date.now();for(const job of (saas.whatsappQueue||[])){if(job.status!=='scheduled'||Date.parse(job.scheduledAt)>now)continue;const contact=(saas.whatsappContacts||[]).find(c=>c.phone===job.to);if(contact&&isOptedOut(contact)){job.status='cancelled_optout';saveSaas();continue;}job.status='processing';job.attempts=(job.attempts||0)+1;saveSaas();try{const log=await sendWhatsAppMessage(job.to,'',job.templateName);job.status='accepted';job.messageId=log.messageId;job.processedAt=new Date().toISOString();}catch(e){job.status=job.attempts>=3?'failed':'scheduled';job.lastError=String(e.message||e).slice(0,500);job.scheduledAt=new Date(Date.now()+Math.min(job.attempts*5,30)*60000).toISOString();}saveSaas();break;}}catch(e){console.error('WhatsApp queue worker:',e.message);}finally{whatsappWorkerBusy=false;}},15000).unref();

server.listen(PORT, HOST, () => {
  console.log('\n========================================');
  console.log(' LLTV BRASIL — BROADCAST SYSTEM / CENTRAL DE TRANSMISSÃO');
  console.log('========================================');
  console.log(`Painel local: http://localhost:${PORT}/panel.html?token=${token}`);
  console.log(`Overlay gráfico: http://localhost:${PORT}/overlay.html`);
  console.log(`Token de controle: ${token}`);
  console.log('\nNo celular, use o IP local do computador e o mesmo token.');
  for (const list of Object.values(os.networkInterfaces())) for (const n of list || []) {
    if (n.family === 'IPv4' && !n.internal) console.log(`Acesso na rede: http://${n.address}:${PORT}/panel.html?token=${token}`);
  }
  console.log('Mantenha esta janela aberta durante a transmissão.\n');
});
function shutdown(){ try{stopFfmpeg();persist()}catch{} server.close(()=>process.exit(0)); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
