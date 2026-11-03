const express = require("express");
const http = require("http");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { Server } = require("socket.io");

const app = express(), server = http.createServer(app), io = new Server(server);
const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = path.join(__dirname, "data"), STATE_FILE = path.join(DATA_DIR, "match.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const BACKUP_RETENTION = Math.max(3, Math.min(60, Number(process.env.BACKUP_RETENTION || 14)));
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });

const initial = {
  competition:"LLTV BRASIL", round:"RODADA", venue:"ESTÁDIO", date:"",
  phase:"1º TEMPO",
  home:{name:"MANDANTE",short:"CASA",score:0,crest:"",color:"#174a2b",corners:0,fouls:0,yellow:0,red:0},
  away:{name:"VISITANTE",short:"FORA",score:0,crest:"",color:"#243b70",corners:0,fouls:0,yellow:0,red:0},
  clock:{seconds:0,running:false,period:"1º TEMPO",added:"",startedAt:null},
  visible:{scoreboard:true,lowerThird:false,stats:false,lineups:false,playerId:false,sponsors:false},
  lowerThird:{title:"INFORMAÇÃO",subtitle:"A CASA DAS LIGAS ALTERNATIVAS"},
  referees:{main:"",assistant1:"",assistant2:"",fourth:"",var:""}, broadcastTeam:{narrator:"",commentator:"",reporter:"",host:""},
  playerId:{name:"",number:"",position:"",team:"home"},
  stats:{possessionHome:50,possessionAway:50,shotsHome:0,shotsAway:0,shotsOnHome:0,shotsOnAway:0,offsidesHome:0,offsidesAway:0,savesHome:0,savesAway:0},
  lineups:{home:{starters:[],bench:[]},away:{starters:[],bench:[]}}, events:[], sponsors:[],
  branding:{logo:"",name:"LLTV BRASIL",tagline:"A CASA DAS LIGAS ALTERNATIVAS"},
  customScoreboard:{primary:"#c9a34a",background:"#101216",text:"",position:"top-center",showCompetition:true,showRound:true,showCrests:true,showClock:true,miniEnabled:false,sizes:{mainName:30,mainCrest:55,mainScore:48,mainClock:24,mainGap:10,miniName:22,miniScore:28,miniClock:18,miniWidth:620,miniHeight:54}},
  features:{competition:true,teams:true,fixtures:true,standings:true,manualAdjustments:true,taca:true,tacaMale:true,tacaFemale:true,scoreboard:true,clock:true,stats:true,lineups:true,gc:true,events:true,playerId:true,sponsors:true,crests:true,competitionInfo:true,roundInfo:true,overlay:true,obs:true,graphics:true,substitutions:true,referee:true,backup:true,reports:true,exports:true,audio:true,videoSources:true,cameras:true,replay:true,recording:true,multistream:true,channelLogo:true,homeTeam:true,awayTeam:true,homeCrest:true,awayCrest:true,homeScoreDisplay:true,awayScoreDisplay:true,periodDisplay:true,roundDisplay:true,possession:true,shots:true,corners:true,fouls:true,cards:true,homeLineup:true,homeBench:true,awayLineup:true,awayBench:true,refereeOverlay:true,broadcastOverlay:true},
  competitions:[], teams:[], fixtures:[], rounds:[], phaseConfigs:[], standings:{rules:{win:3,draw:1,loss:0},manualOrder:[],adjustments:[]}, taca:{teams:[],rules:{minPlayers:18,maxPlayers:22,groupSize:4,groupGames:3,qualifiers:8,scoring:"3 / 1 / 0",halfMinutes:30,breakMinutes:10,tiebreak:"Saldo, gols pró, menos vermelhos, menos amarelos, confronto direto, sorteio"}}
};
function mergeDefaults(saved) {
  return {
    ...structuredClone(initial), ...(saved||{}),
    home:{...initial.home,...(saved?.home||{})},
    away:{...initial.away,...(saved?.away||{})},
    clock:{...initial.clock,...(saved?.clock||{})},
    visible:{...initial.visible,...(saved?.visible||{})},
    lowerThird:{...initial.lowerThird,...(saved?.lowerThird||{})},
    referees:{...initial.referees,...(saved?.referees||{})}, broadcastTeam:{...initial.broadcastTeam,...(saved?.broadcastTeam||{})},
    playerId:{...initial.playerId,...(saved?.playerId||{})},
    stats:{...initial.stats,...(saved?.stats||{})},
    lineups:{
      home:Array.isArray(saved?.lineups?.home)?{starters:saved.lineups.home.slice(0,11),bench:saved.lineups.home.slice(11)}:{...initial.lineups.home,...(saved?.lineups?.home||{})},
      away:Array.isArray(saved?.lineups?.away)?{starters:saved.lineups.away.slice(0,11),bench:saved.lineups.away.slice(11)}:{...initial.lineups.away,...(saved?.lineups?.away||{})}
    },
    branding:{...initial.branding,...(saved?.branding||{})},
    customScoreboard:{...initial.customScoreboard,...(saved?.customScoreboard||{}),sizes:{...initial.customScoreboard.sizes,...(saved?.customScoreboard?.sizes||{})}},
    taca:{...initial.taca,...(saved?.taca||{}),rules:{...initial.taca.rules,...(saved?.taca?.rules||{})}},
    features:{...initial.features,...(saved?.features||{})},
    competitions:Array.isArray(saved?.competitions)?saved.competitions:[], teams:Array.isArray(saved?.teams)?saved.teams:[], fixtures:Array.isArray(saved?.fixtures)?saved.fixtures:[], rounds:Array.isArray(saved?.rounds)?saved.rounds:[], phaseConfigs:Array.isArray(saved?.phaseConfigs)?saved.phaseConfigs:[], standings:{...initial.standings,...(saved?.standings||{}),rules:{...initial.standings.rules,...(saved?.standings?.rules||{})},manualOrder:Array.isArray(saved?.standings?.manualOrder)?saved.standings.manualOrder:[],adjustments:Array.isArray(saved?.standings?.adjustments)?saved.standings.adjustments:[]}, sponsors:Array.isArray(saved?.sponsors)?saved.sponsors:[]
  };
}
function loadState(){try{return mergeDefaults(JSON.parse(fs.readFileSync(STATE_FILE,"utf8")));}catch{return structuredClone(initial);}}
let state=loadState();
function writeJsonAtomic(file, value){
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}
function backupName(){return `lltv-backup-${new Date().toISOString().replace(/[:.]/g,"-")}.json`;}
function createBackup(reason="manual"){
  if(fs.existsSync(STATE_FILE)){
    const file=path.join(BACKUP_DIR,backupName());
    const payload=JSON.parse(fs.readFileSync(STATE_FILE,"utf8"));
    payload._backup={createdAt:new Date().toISOString(),reason};
    writeJsonAtomic(file,payload);
  }
  const files=fs.readdirSync(BACKUP_DIR).filter(n=>n.endsWith(".json")).sort().reverse();
  files.slice(BACKUP_RETENTION).forEach(n=>{try{fs.unlinkSync(path.join(BACKUP_DIR,n));}catch{}});
}
function save(){
  state.updatedAt=new Date().toISOString();
  // Um ponto de restauração diário, sem criar um arquivo a cada alteração do placar.
  const today=new Date().toISOString().slice(0,10);
  const hasToday=fs.existsSync(BACKUP_DIR)&&fs.readdirSync(BACKUP_DIR).some(n=>n.startsWith(`lltv-backup-${today}`));
  if(fs.existsSync(STATE_FILE)&&!hasToday)createBackup("automatico-diario");
  writeJsonAtomic(STATE_FILE,state);
}
function snapshot(){
  const copy=structuredClone(state);
  if(copy.clock.running && copy.clock.startedAt) copy.clock.seconds += Math.max(0,Math.floor((Date.now()-copy.clock.startedAt)/1000));
  return copy;
}
function broadcast(){save();io.emit("state",snapshot());}
app.use(express.json({limit:"20mb"}));

// GRUPO 34 — Central de Notícias integrada ao servidor e à estrutura existente.
const NEWS_FILE = path.join(DATA_DIR, "news.json");
const NEWS_UPLOAD_DIR = path.join(DATA_DIR, "news-uploads");
fs.mkdirSync(NEWS_UPLOAD_DIR, { recursive: true });
function loadNews(){ try { const v=JSON.parse(fs.readFileSync(NEWS_FILE,"utf8")); return {articles:Array.isArray(v.articles)?v.articles:[],categories:Array.isArray(v.categories)?v.categories:["Futebol brasileiro","Futebol internacional","Futebol feminino","Futebol de base","Futebol amador","Futsal","Mercado da bola","Entrevistas","Reportagens especiais"]}; } catch { return {articles:[],categories:["Futebol brasileiro","Futebol internacional","Futebol feminino","Futebol de base","Futebol amador","Futsal","Mercado da bola","Entrevistas","Reportagens especiais"]}; } }
let newsStore=loadNews();
function saveNews(){ writeJsonAtomic(NEWS_FILE,newsStore); }
function newsAdmin(req,res,next){
  const token=process.env.NEWS_ADMIN_TOKEN;
  if(!token && process.env.NODE_ENV === "production") return res.status(503).json({error:"Configure NEWS_ADMIN_TOKEN nas variáveis de ambiente para habilitar a administração segura."});
  if(!token) return next(); // Em desenvolvimento local, o acesso permanece aberto.
  const supplied=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  if(supplied!==token) return res.status(401).json({error:"Acesso administrativo não autorizado. Informe o token configurado no servidor."});
  next();
}
app.get("/api/news",(req,res)=>{
  const admin=req.query.admin==="1";
  const items=newsStore.articles.filter(a=>admin||a.status==="published").sort((a,b)=>new Date(b.publishedAt||b.updatedAt||b.createdAt)-new Date(a.publishedAt||a.updatedAt||a.createdAt));
  res.json({articles:items,categories:newsStore.categories});
});
app.post("/api/news/upload",newsAdmin,(req,res)=>{
  try{
    const {dataUrl,name}=req.body||{};
    const m=String(dataUrl||"").match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
    if(!m) return res.status(400).json({error:"Envie uma imagem PNG, JPG, WEBP ou GIF válida."});
    const buffer=Buffer.from(m[2],"base64");
    if(buffer.length>8*1024*1024) return res.status(413).json({error:"A imagem deve ter no máximo 8 MB."});
    const ext={"image/png":"png","image/jpeg":"jpg","image/webp":"webp","image/gif":"gif"}[m[1]];
    const filename=`news-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    fs.writeFileSync(path.join(NEWS_UPLOAD_DIR,filename),buffer);
    res.json({url:`/news-uploads/${filename}`,name:String(name||filename).slice(0,160)});
  }catch(e){res.status(500).json({error:"Falha ao salvar imagem.",detail:e.message});}
});
app.use("/news-uploads",express.static(NEWS_UPLOAD_DIR,{maxAge:"7d"}));
app.post("/api/news",newsAdmin,(req,res)=>{
  const b=req.body||{}; if(!String(b.title||"").trim()||!String(b.content||"").trim()) return res.status(400).json({error:"Título e texto da notícia são obrigatórios."});
  const now=new Date().toISOString(); const article={id: b.id||`news-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,title:String(b.title).trim().slice(0,180),subtitle:String(b.subtitle||"").slice(0,300),content:String(b.content),cover:String(b.cover||""),caption:String(b.caption||"").slice(0,300),credit:String(b.credit||"").slice(0,200),category:String(b.category||"Geral").slice(0,80),tags:Array.isArray(b.tags)?b.tags.map(x=>String(x).slice(0,40)).slice(0,20):[],author:String(b.author||"Redação LLTV Brasil").slice(0,100),competition:String(b.competition||"").slice(0,120),team:String(b.team||"").slice(0,120),source:String(b.source||"").slice(0,300),status:["draft","review","scheduled","published"].includes(b.status)?b.status:"draft",scheduledAt:b.scheduledAt||null,createdAt:b.createdAt||now,updatedAt:now,publishedAt:b.status==="published"?(b.publishedAt||now):(b.publishedAt||null),views:Number(b.views)||0};
  const i=newsStore.articles.findIndex(x=>x.id===article.id); if(i>=0) newsStore.articles[i]=article; else newsStore.articles.unshift(article); saveNews(); res.json({ok:true,article});
});
app.delete("/api/news/:id",newsAdmin,(req,res)=>{const n=newsStore.articles.length;newsStore.articles=newsStore.articles.filter(a=>a.id!==req.params.id);if(n===newsStore.articles.length)return res.status(404).json({error:"Notícia não encontrada."});saveNews();res.json({ok:true});});
app.post("/api/news/categories",newsAdmin,(req,res)=>{const name=String(req.body?.name||"").trim().slice(0,80);if(!name)return res.status(400).json({error:"Informe o nome da categoria."});if(!newsStore.categories.includes(name))newsStore.categories.push(name);saveNews();res.json({ok:true,categories:newsStore.categories});});
app.get("/noticias",(_req,res)=>res.sendFile(path.join(__dirname,"public","noticias.html")));
app.get("/noticias/admin",(_req,res)=>res.sendFile(path.join(__dirname,"public","noticias-admin.html")));

// Grupo 27: página comercial pública como página inicial no Render e no Windows.
// Evita cache de uma versão antiga da página inicial após novo deploy.
const landingPage = path.join(__dirname, "public", "apresentacao.html");
app.get(["/", "/inicio"], (_req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.sendFile(landingPage);
});
app.use("/api/billing",require("./server/asaas-integration"));
app.use("/api/customer",require("./server/customer-auth"));
app.use("/api/assistant",require("./server/assistant"));
app.use(express.static(path.join(__dirname,"public")));
app.get("/api/state",(_,res)=>res.json(snapshot()));
app.post("/api/state",(req,res)=>{
  if(!req.body || typeof req.body!=="object") return res.status(400).json({error:"Estado inválido"});
  state=mergeDefaults({...state,...req.body});
  broadcast();res.json(snapshot());
});
app.get("/api/backup/list",(_,res)=>{
  const files=fs.readdirSync(BACKUP_DIR).filter(n=>n.endsWith(".json")).sort().reverse();
  res.json({retention:BACKUP_RETENTION,backups:files.map(name=>({name,size:fs.statSync(path.join(BACKUP_DIR,name)).size,modifiedAt:fs.statSync(path.join(BACKUP_DIR,name)).mtime.toISOString()}))});
});
app.post("/api/backup/create",(req,res)=>{
  try{writeJsonAtomic(STATE_FILE,state);createBackup("manual");res.json({ok:true,message:"Backup criado.",count:fs.readdirSync(BACKUP_DIR).filter(n=>n.endsWith(".json")).length});}
  catch(e){res.status(500).json({error:"Não foi possível criar o backup.",detail:e.message});}
});
app.get("/api/backup/download",(_,res)=>{
  if(!fs.existsSync(STATE_FILE))writeJsonAtomic(STATE_FILE,state);
  res.download(STATE_FILE,`LLTV_BRASIL_BACKUP_${new Date().toISOString().slice(0,10)}.json`);
});
app.post("/api/backup/restore",(req,res)=>{
  try{
    const incoming=req.body?.state||req.body;
    if(!incoming||typeof incoming!=="object"||Array.isArray(incoming))return res.status(400).json({error:"Arquivo de backup inválido."});
    if(!incoming.home||!incoming.away)return res.status(400).json({error:"Backup não reconhecido: faltam os dados das equipes da partida."});
    writeJsonAtomic(STATE_FILE,state);createBackup("antes-da-restauracao");
    state=mergeDefaults(incoming);broadcast();
    res.json({ok:true,message:"Backup restaurado com sucesso."});
  }catch(e){res.status(400).json({error:"Falha ao restaurar o backup.",detail:e.message});}
});
app.get("/health",(_,res)=>res.json({ok:true,app:"LLTV Placar Pro",version:"5.34-grupo34",storage:"filesystem",newsArticles:newsStore.articles.length,backupRetention:BACKUP_RETENTION,backupCount:fs.readdirSync(BACKUP_DIR).filter(n=>n.endsWith(".json")).length,updatedAt:state.updatedAt||null}));
io.on("connection",socket=>{
  socket.emit("state",snapshot());
  socket.on("patch",patch=>{if(!patch||typeof patch!=="object")return;state=mergeDefaults({...state,...patch});broadcast();});
  socket.on("clock:start",()=>{
    if(!state.clock.running){state.clock.running=true;state.clock.startedAt=Date.now();broadcast();}
  });
  socket.on("clock:pause",()=>{
    if(state.clock.running&&state.clock.startedAt)state.clock.seconds+=Math.max(0,Math.floor((Date.now()-state.clock.startedAt)/1000));
    state.clock.running=false;state.clock.startedAt=null;broadcast();
  });
  socket.on("clock:reset",()=>{state.clock.seconds=0;state.clock.running=false;state.clock.startedAt=null;broadcast();});
  socket.on("clock:set",seconds=>{
    state.clock.seconds=Math.max(0,Math.floor(Number(seconds)||0));state.clock.running=false;state.clock.startedAt=null;broadcast();
  });
  socket.on("event:add",event=>{
    state.events=Array.isArray(state.events)?state.events:[];
    state.events.unshift({id:Date.now(),at:new Date().toISOString(),...event});
    broadcast();
  });
  socket.on("event:remove",id=>{state.events=(state.events||[]).filter(e=>e.id!==id);broadcast();});
  socket.on("match:reset",()=>{
    const keep={competition:state.competition,round:state.round,venue:state.venue,date:state.date,home:{...state.home,name:state.home.name,short:state.home.short,crest:state.home.crest},away:{...state.away,name:state.away.name,short:state.away.short,crest:state.away.crest},lineups:state.lineups,branding:state.branding,customScoreboard:state.customScoreboard,competitions:state.competitions,teams:state.teams,fixtures:state.fixtures,standings:state.standings,taca:state.taca,sponsors:state.sponsors,features:state.features};
    state=mergeDefaults(keep);broadcast();
  });
});
function ips(){const out=[];for(const list of Object.values(os.networkInterfaces()))for(const n of list||[])if(n.family==="IPv4"&&!n.internal)out.push(n.address);return out;}
server.listen(PORT,"0.0.0.0",()=>{
 console.log("\\nLLTV BRASIL – PLACAR ESPORTIVO PRO v5.29");
 console.log(`Painel: http://localhost:${PORT}`);
 ips().forEach(ip=>console.log(`Celular (mesmo Wi-Fi): http://${ip}:${PORT}`));
 console.log(`Overlay OBS: http://localhost:${PORT}/overlay.html\\n`);
});