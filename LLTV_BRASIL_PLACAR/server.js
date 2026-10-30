const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const TOKEN_FILE = path.join(DATA_DIR, 'access-token.txt');

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(TOKEN_FILE)) {
  fs.writeFileSync(TOKEN_FILE, crypto.randomBytes(18).toString('hex'), 'utf8');
}
const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();

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
  if (fs.existsSync(STATE_FILE)) state = { ...initialState, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
} catch (e) { console.error('Não foi possível ler state.json; usando valores iniciais.', e.message); }

let lastTick = Date.now();
function persist() {
  state.updatedAt = Date.now();
  const temp = STATE_FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(state, null, 2), 'utf8');
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
  const payload = `data: ${JSON.stringify({ ...state, serverNow: Date.now() })}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { clients.delete(res); }
  }
}
function safeState() { tick(); return { ...state, serverNow: Date.now() }; }

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
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/health') return send(res, 200, { ok: true, app: 'LLTV BRASIL PLACAR', version: '1.2.0', time: Date.now() });
  if (url.pathname === '/api/network' && req.method === 'GET') {
    const interfaces = [];
    for (const list of Object.values(os.networkInterfaces())) for (const n of list || []) {
      if (n.family === 'IPv4' && !n.internal) interfaces.push({ address: n.address, url: `http://${n.address}:${PORT}` });
    }
    const publicBase = (process.env.LLTV_PUBLIC_URL || '').trim().replace(/\/$/, '');
    return send(res, 200, { ok: true, port: PORT, interfaces, publicBase, currentOrigin: `http://${req.headers.host || `localhost:${PORT}`}`, note: 'Os endereços de rede local funcionam somente quando o celular e o computador estão na mesma rede Wi-Fi. Acesso pela internet exige URL pública HTTPS e configuração externa.' });
  }
  if (url.pathname === '/api/state' && req.method === 'GET') return send(res, 200, safeState());
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
  if (url.pathname.startsWith('/api/')) {
    if (!authorized(req, url)) return send(res, 401, { error: 'Acesso não autorizado. Abra o painel pelo link seguro exibido no computador.' });
    if (url.pathname === '/api/state' && req.method === 'POST') {
      try {
        const patch = validatePatch(await readBody(req));
        if ('running' in patch && patch.running === true && !state.running) lastTick = Date.now();
        if ('elapsedSeconds' in patch) lastTick = Date.now();
        state = { ...state, ...patch, updatedAt: Date.now() };
        persist(); broadcast(); return send(res, 200, safeState());
      } catch (e) { return send(res, 400, { error: e.message }); }
    }
    if (url.pathname === '/api/reset' && req.method === 'POST') {
      state = { ...initialState, date: state.date, homeName: state.homeName, awayName: state.awayName, homeShort: state.homeShort, awayShort: state.awayShort, homeLogo: state.homeLogo, awayLogo: state.awayLogo, updatedAt: Date.now() };
      lastTick = Date.now(); persist(); broadcast(); return send(res, 200, safeState());
    }
    return send(res, 404, { error: 'Endpoint não encontrado' });
  }
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/panel.html';
  const file = path.resolve(PUBLIC, '.' + pathname);
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, 'Arquivo não encontrado', 'text/plain; charset=utf-8');
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600', 'X-Content-Type-Options':'nosniff' });
  fs.createReadStream(file).pipe(res);
});
server.listen(PORT, HOST, () => {
  console.log('\n========================================');
  console.log(' LLTV BRASIL — PLACAR DE FUTEBOL');
  console.log('========================================');
  console.log(`Painel local: http://localhost:${PORT}/panel.html?token=${token}`);
  console.log(`Overlay OBS:  http://localhost:${PORT}/overlay.html`);
  console.log(`Token de controle: ${token}`);
  console.log('\nNo celular, use o IP local do computador e o mesmo token.');
  for (const list of Object.values(os.networkInterfaces())) for (const n of list || []) {
    if (n.family === 'IPv4' && !n.internal) console.log(`Acesso na rede: http://${n.address}:${PORT}/panel.html?token=${token}`);
  }
  console.log('Mantenha esta janela aberta durante a transmissão.\n');
});
function shutdown(){ try{persist()}catch{} server.close(()=>process.exit(0)); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
