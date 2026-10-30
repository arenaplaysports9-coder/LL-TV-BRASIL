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
  {id:'initial',name:'INICIAL',price:0,currency:'BRL',billingCycle:'monthly',limits:{users:2,monthlyHours:5,storageMB:512,simultaneousDestinations:1},features:{scoreboard:true,central:true,replay:false,var:false,webtv:false,apps:false,ai:false},active:true},
  {id:'professional',name:'PROFISSIONAL',price:0,currency:'BRL',billingCycle:'monthly',limits:{users:5,monthlyHours:30,storageMB:5120,simultaneousDestinations:2},features:{scoreboard:true,central:true,replay:true,var:false,webtv:true,apps:false,ai:false},active:true},
  {id:'advanced',name:'AVANÇADO',price:0,currency:'BRL',billingCycle:'monthly',limits:{users:10,monthlyHours:100,storageMB:20480,simultaneousDestinations:4},features:{scoreboard:true,central:true,replay:true,var:true,webtv:true,apps:false,ai:false},active:true},
  {id:'enterprise',name:'EMPRESARIAL',price:0,currency:'BRL',billingCycle:'monthly',limits:{users:30,monthlyHours:500,storageMB:102400,simultaneousDestinations:8},features:{scoreboard:true,central:true,replay:true,var:true,webtv:true,apps:true,ai:true},active:true}
],subscriptions:[],payments:[],paymentSettings:{methods:{pix:{enabled:false,key:'',keyType:'',beneficiary:'',institution:'',instructions:''},bankTransfer:{enabled:false,bank:'',agency:'',account:'',accountType:'',holder:'',document:'',instructions:''},boleto:{enabled:false,instructions:''},card:{enabled:false,provider:''}},checkoutEnabled:true,manualApproval:true},records:{matches:[],teams:[],competitions:[],media:[],sponsors:[],broadcasts:[]}};
try { if(fs.existsSync(SAAS_FILE)){const saved=JSON.parse(fs.readFileSync(SAAS_FILE,'utf8'));for(const k of Object.keys(saas))if(saved[k]!==undefined)saas[k]=saved[k];} } catch(e){console.error('Falha ao ler saas.json:',e.message);}
saas.payments=Array.isArray(saas.payments)?saas.payments:[];
saas.paymentSettings=saas.paymentSettings||{methods:{},checkoutEnabled:true,manualApproval:true};
saas.paymentSettings.methods=saas.paymentSettings.methods||{};
const sessions=new Map();
function saveSaas(){const tmp=SAAS_FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(saas,null,2),{mode:0o600});fs.renameSync(tmp,SAAS_FILE);}
function slugify(s){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'emissora';}
function hashPassword(password){const salt=crypto.randomBytes(16);const key=crypto.scryptSync(String(password),salt,64);return `${salt.toString('hex')}:${key.toString('hex')}`;}
function verifyPassword(password,stored){try{const [saltHex,keyHex]=String(stored).split(':');const expected=Buffer.from(keyHex,'hex');const actual=crypto.scryptSync(String(password),Buffer.from(saltHex,'hex'),expected.length);return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual);}catch{return false;}}
function getSession(req){const auth=String(req.headers.authorization||'');const bearer=auth.startsWith('Bearer ')?auth.slice(7):'';const s=sessions.get(bearer);if(!s||s.expires<Date.now()){if(bearer)sessions.delete(bearer);return null;}const tenant=saas.tenants.find(t=>t.id===s.tenantId);if(!tenant||tenant.status!=='active')return null;return s;}

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
  brand: 'LLTV BRASIL', tagline: 'A CASA DAS LIGAS ALTERNATIVAS',
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
function authorized(req, url) {
  const supplied = req.headers['x-lltv-token'] || url.searchParams.get('token') || '';
  return supplied.length === token.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(token));
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
const boolFields = new Set(['running','addedTimeEnabled','showDate','showCompetition','showCards']);
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
  if (url.pathname === '/api/health') return send(res, 200, { ok: true, app: 'LLTV BRASIL PLACAR', version: '1.7.0', time: Date.now() });
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
  // Loja pública e contratação SaaS (pagamentos manuais com aprovação administrativa).
  if (url.pathname === '/api/public/plans' && req.method === 'GET') {
    return send(res,200,{items:saas.plans.filter(p=>p.active!==false).map(({id,name,price,currency,billingCycle,limits,features})=>({id,name,price,currency,billingCycle,limits,features})),checkoutEnabled:saas.paymentSettings.checkoutEnabled!==false});
  }
  if (url.pathname === '/api/public/payment-methods' && req.method === 'GET') {
    const m=saas.paymentSettings.methods||{};
    return send(res,200,{methods:{pix:m.pix?.enabled?{enabled:true,key:m.pix.key||'',keyType:m.pix.keyType||'',beneficiary:m.pix.beneficiary||'',institution:m.pix.institution||'',instructions:m.pix.instructions||''}:null,bankTransfer:m.bankTransfer?.enabled?{enabled:true,bank:m.bankTransfer.bank||'',agency:m.bankTransfer.agency||'',account:m.bankTransfer.account||'',accountType:m.bankTransfer.accountType||'',holder:m.bankTransfer.holder||'',document:m.bankTransfer.document||'',instructions:m.bankTransfer.instructions||''}:null,boleto:null,card:null}});
  }
  if (url.pathname === '/api/public/checkout' && req.method === 'POST') {
    try {
      if(saas.paymentSettings.checkoutEnabled===false)return send(res,403,{error:'A contratação online está temporariamente indisponível.'});
      const b=await readBody(req), name=String(b.companyName||'').trim(), owner=String(b.ownerName||'').trim(), email=String(b.email||'').trim().toLowerCase(), password=String(b.password||''), plan=saas.plans.find(p=>p.id===String(b.planId||'')&&p.active!==false), method=String(b.paymentMethod||'');
      if(!name||!owner||!email||password.length<10||!plan)return send(res,400,{error:'Preencha os dados obrigatórios, escolha um plano e use senha com pelo menos 10 caracteres.'});
      if(saas.users.some(u=>u.email===email))return send(res,409,{error:'Este e-mail já possui cadastro.'});
      const enabled=saas.paymentSettings.methods||{}; if(!['pix','bankTransfer'].includes(method)||!enabled[method]?.enabled)return send(res,400,{error:'Esta forma de pagamento não está disponível ou ainda depende de integração com gateway.'});
      const id='org_'+crypto.randomBytes(8).toString('hex'), now=new Date().toISOString();
      const tenant={id,name,slug:slugify(name),status:'pending_payment',planId:plan.id,createdAt:now,storageBytes:0,branding:{name,logo:'',primary:'#102a43',accent:'#e0ad18',domain:''},limits:{...(plan.limits||{})},features:{...(plan.features||{})}};
      const user={id:'usr_'+crypto.randomBytes(8).toString('hex'),tenantId:id,name:owner,email,role:'owner',passwordHash:hashPassword(password),active:true,createdAt:now};
      const sub={id:'sub_'+crypto.randomBytes(8).toString('hex'),tenantId:id,planId:plan.id,status:'pending_payment',billingCycle:plan.billingCycle||'monthly',amount:Number(plan.price)||0,currency:plan.currency||'BRL',paymentMethod:method,createdAt:now};
      const payment={id:'pay_'+crypto.randomBytes(8).toString('hex'),tenantId:id,subscriptionId:sub.id,planId:plan.id,amount:Number(plan.price)||0,currency:'BRL',method,status:'pending',createdAt:now,customerEmail:email,description:`Assinatura ${plan.name}`,instructions:enabled[method].instructions||''};
      saas.tenants.push(tenant);saas.users.push(user);saas.subscriptions.push(sub);saas.payments.push(payment);saveSaas();
      return send(res,201,{ok:true,orderId:payment.id,status:'pending',message:'Cadastro realizado. Sua assinatura será liberada após a confirmação do pagamento.',payment:{id:payment.id,amount:payment.amount,method:payment.method,status:payment.status,instructions:payment.instructions},paymentDetails:method==='pix'?{key:enabled.pix.key,keyType:enabled.pix.keyType,beneficiary:enabled.pix.beneficiary,institution:enabled.pix.institution}:method==='bankTransfer'?{bank:enabled.bankTransfer.bank,agency:enabled.bankTransfer.agency,account:enabled.bankTransfer.account,accountType:enabled.bankTransfer.accountType,holder:enabled.bankTransfer.holder,document:enabled.bankTransfer.document,instructions:enabled.bankTransfer.instructions}:null});
    } catch(e){return send(res,400,{error:e.message});}
  }
  // SaaS multi-tenant: persistência independente do estado do placar.
  if (url.pathname === '/api/saas/login' && req.method === 'POST') {
    try {
      const body = await readBody(req); const email = String(body.email || '').trim().toLowerCase(); const password = String(body.password || '');
      const user = saas.users.find(u => u.email === email && u.active !== false);
      if (!user || !verifyPassword(password, user.passwordHash)) return send(res, 401, { error: 'E-mail ou senha inválidos.' });
      const session = crypto.randomBytes(32).toString('hex'); sessions.set(session, { userId: user.id, tenantId: user.tenantId, role: user.role, expires: Date.now() + 12*60*60*1000 });
      return send(res, 200, { ok: true, token: session, user: { id:user.id, name:user.name, email:user.email, role:user.role, tenantId:user.tenantId } });
    } catch (e) { return send(res, 400, { error:e.message }); }
  }
  if (url.pathname.startsWith('/api/saas/') && url.pathname !== '/api/saas/login') {
    if (!authorized(req, url)) return send(res, 401, { error:'Acesso exclusivo do Super Admin LL TV BRASIL.' });
    if (url.pathname === '/api/saas/summary' && req.method === 'GET') {
      return send(res,200,{ok:true,tenants:saas.tenants.length,activeTenants:saas.tenants.filter(t=>t.status==='active').length,plans:saas.plans.length,users:saas.users.length,subscriptions:saas.subscriptions.length,storageBytes:saas.tenants.reduce((n,t)=>n+(Number(t.storageBytes)||0),0),tenantsList:saas.tenants.map(({id,name,slug,status,planId,createdAt})=>({id,name,slug,status,planId,createdAt}))});
    }
    if(url.pathname==='/api/saas/payment-settings'&&req.method==='GET')return send(res,200,{settings:saas.paymentSettings});
    if(url.pathname==='/api/saas/payment-settings'&&req.method==='PUT'){
      const b=await readBody(req);saas.paymentSettings={...saas.paymentSettings,...b,methods:{...(saas.paymentSettings.methods||{}),...(b.methods||{})}};
      // Secret-like gateway fields are encrypted at rest; public payment instructions remain readable.
      for(const k of ['gatewaySecret','gatewayToken','webhookSecret'])if(saas.paymentSettings[k])saas.paymentSettings[k]=encryptSecret(saas.paymentSettings[k]);
      saveSaas();return send(res,200,{ok:true,settings:saas.paymentSettings});
    }
    if(url.pathname==='/api/saas/payments'&&req.method==='GET')return send(res,200,{items:saas.payments});
    const paymentMatch=url.pathname.match(/^\/api\/saas\/payments\/([\w-]+)\/approve$/);
    if(paymentMatch&&req.method==='POST'){
      const payment=saas.payments.find(x=>x.id===paymentMatch[1]);if(!payment)return send(res,404,{error:'Pagamento não encontrado.'});
      if(payment.status==='approved')return send(res,200,{ok:true,payment});
      payment.status='approved';payment.approvedAt=new Date().toISOString();payment.approvedBy='master';
      const tenant=saas.tenants.find(x=>x.id===payment.tenantId);if(tenant)tenant.status='active';
      const sub=saas.subscriptions.find(x=>x.id===payment.subscriptionId);if(sub){sub.status='active';sub.activatedAt=new Date().toISOString();const cycle=sub.billingCycle||'monthly';const days=cycle==='yearly'?365:cycle==='semiannual'?180:cycle==='quarterly'?90:30;sub.currentPeriodEnd=new Date(Date.now()+days*86400000).toISOString();}
      saveSaas();return send(res,200,{ok:true,payment,tenant,subscription:sub});
    }
    const paymentReject=url.pathname.match(/^\/api\/saas\/payments\/([\w-]+)\/reject$/);
    if(paymentReject&&req.method==='POST'){const payment=saas.payments.find(x=>x.id===paymentReject[1]);if(!payment)return send(res,404,{error:'Pagamento não encontrado.'});payment.status='rejected';payment.rejectedAt=new Date().toISOString();const tenant=saas.tenants.find(x=>x.id===payment.tenantId);if(tenant)tenant.status='payment_rejected';saveSaas();return send(res,200,{ok:true,payment});}
    if (url.pathname === '/api/saas/tenants' && req.method === 'GET') return send(res,200,{items:saas.tenants});
    if (url.pathname === '/api/saas/tenants' && req.method === 'POST') {
      try { const b=await readBody(req); const name=String(b.name||'').trim(); const email=String(b.email||'').trim().toLowerCase(); const password=String(b.password||''); if(!name||!email||password.length<10) return send(res,400,{error:'Informe nome, e-mail e senha com pelo menos 10 caracteres.'}); if(saas.users.some(u=>u.email===email)) return send(res,409,{error:'Este e-mail já está cadastrado.'}); const id='org_'+crypto.randomBytes(8).toString('hex'); const tenant={id,name,slug:slugify(name),status:'active',planId:b.planId||null,createdAt:new Date().toISOString(),storageBytes:0,branding:{name,logo:'',primary:'#102a43',accent:'#e0ad18',domain:''},limits:{users:3,monthlyHours:10,storageMB:1024,simultaneousDestinations:1},features:{scoreboard:true,central:true,replay:false,var:false,webtv:false,apps:false,ai:false}}; saas.tenants.push(tenant); saas.users.push({id:'usr_'+crypto.randomBytes(8).toString('hex'),tenantId:id,name:String(b.ownerName||name),email,role:'owner',passwordHash:hashPassword(password),active:true,createdAt:new Date().toISOString()}); saas.subscriptions.push({id:'sub_'+crypto.randomBytes(8).toString('hex'),tenantId:id,planId:tenant.planId,status:'trial',createdAt:new Date().toISOString(),amount:0,currency:'BRL'}); saveSaas(); return send(res,201,{ok:true,tenant}); } catch(e){return send(res,400,{error:e.message});}
    }
    const tenantMatch=url.pathname.match(/^\/api\/saas\/tenants\/([\w-]+)$/);
    if(tenantMatch && req.method==='PATCH'){const t=saas.tenants.find(x=>x.id===tenantMatch[1]);if(!t)return send(res,404,{error:'Cliente não encontrado.'});const b=await readBody(req);for(const k of ['name','status','planId','limits','features','branding'])if(b[k]!==undefined)t[k]=b[k];saveSaas();return send(res,200,{ok:true,tenant:t});}
    if (url.pathname === '/api/saas/plans' && req.method === 'GET') return send(res,200,{items:saas.plans});
    if (url.pathname === '/api/saas/plans' && req.method === 'POST') {const b=await readBody(req);if(!String(b.name||'').trim())return send(res,400,{error:'Nome do plano obrigatório.'});const p={id:b.id||'plan_'+crypto.randomBytes(6).toString('hex'),name:String(b.name).slice(0,60),price:Number(b.price)||0,currency:'BRL',billingCycle:b.billingCycle||'monthly',limits:b.limits||{},features:b.features||{},active:b.active!==false};const i=saas.plans.findIndex(x=>x.id===p.id);if(i>=0)saas.plans[i]=p;else saas.plans.push(p);saveSaas();return send(res,200,{ok:true,plan:p});}
    if (url.pathname === '/api/saas/subscriptions' && req.method === 'GET') return send(res,200,{items:saas.subscriptions});
    return send(res,404,{error:'Rota SaaS não encontrada.'});
  }
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

  if (url.pathname.startsWith('/api/')) {
    if (!authorized(req, url)) return send(res, 401, { error: 'Acesso não autorizado. Abra o painel pelo link seguro exibido no computador.' });
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
  if (pathname === '/') pathname = '/subscribe.html';
  const file = path.resolve(PUBLIC, '.' + pathname);
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, 'Arquivo não encontrado', 'text/plain; charset=utf-8');
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600', 'X-Content-Type-Options':'nosniff' });
  fs.createReadStream(file).pipe(res);
});
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
