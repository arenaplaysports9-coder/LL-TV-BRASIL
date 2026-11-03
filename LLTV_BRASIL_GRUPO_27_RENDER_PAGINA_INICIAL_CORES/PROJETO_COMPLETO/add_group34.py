from pathlib import Path
p=Path('/mnt/data/lltv34/server.js')
s=p.read_text()
insert=r'''
// GRUPO 34 — Central de Notícias integrada ao servidor e à estrutura existente.
const NEWS_FILE = path.join(DATA_DIR, "news.json");
const NEWS_UPLOAD_DIR = path.join(DATA_DIR, "news-uploads");
fs.mkdirSync(NEWS_UPLOAD_DIR, { recursive: true });
function loadNews(){ try { const v=JSON.parse(fs.readFileSync(NEWS_FILE,"utf8")); return {articles:Array.isArray(v.articles)?v.articles:[],categories:Array.isArray(v.categories)?v.categories:["Futebol brasileiro","Futebol internacional","Futebol feminino","Futebol de base","Futebol amador","Futsal","Mercado da bola","Entrevistas","Reportagens especiais"]}; } catch { return {articles:[],categories:["Futebol brasileiro","Futebol internacional","Futebol feminino","Futebol de base","Futebol amador","Futsal","Mercado da bola","Entrevistas","Reportagens especiais"]}; } }
let newsStore=loadNews();
function saveNews(){ writeJsonAtomic(NEWS_FILE,newsStore); }
function newsAdmin(req,res,next){
  const token=process.env.NEWS_ADMIN_TOKEN;
  if(!token) return next(); // Configure NEWS_ADMIN_TOKEN no ambiente de produção.
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
'''
needle='app.use(express.json({limit:"20mb"}));'
s=s.replace(needle,needle+'\n'+insert)
s=s.replace('app.get("/health",(_,res)=>res.json({ok:true,app:"LLTV Placar Pro",version:"5.29-grupo29",storage:"filesystem",backupRetention:BACKUP_RETENTION,backupCount:fs.readdirSync(BACKUP_DIR).filter(n=>n.endsWith(".json")).length,updatedAt:state.updatedAt||null}));','app.get("/health",(_,res)=>res.json({ok:true,app:"LLTV Placar Pro",version:"5.34-grupo34",storage:"filesystem",newsArticles:newsStore.articles.length,backupRetention:BACKUP_RETENTION,backupCount:fs.readdirSync(BACKUP_DIR).filter(n=>n.endsWith(".json")).length,updatedAt:state.updatedAt||null}));')
p.write_text(s)
# add nav button to existing tab bar
p=Path('/mnt/data/lltv34/public/index.html'); s=p.read_text()
s=s.replace('<button class="tab" data-tab="controles">Controles gerais</button></nav>','<button class="tab" data-tab="controles">Controles gerais</button><a class="tab" href="/noticias/admin" target="_blank" rel="noopener">Central de Notícias ↗</a></nav>')
p.write_text(s)
