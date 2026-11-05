const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const { z } = require('zod');
const pool = require('../db/pool');
const config = require('../config');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const playoutEngine = require('../services/playout-engine');
const ffmpeg = require('../services/ffmpeg');
const rtmpStore = require('../services/rtmp-persistence');
const commercialInserter = require('../services/commercial-inserter');
const uploadRoot = path.resolve(config.mediaRoot);
function watchChannelState(channelId,tenantId){playoutEngine.setStateListener(channelId,state=>{const status=state.status==='playing'||state.status==='starting'?'playing':state.status==='failed'?'failed':'stopped';pool.query('UPDATE channel_playout_sessions SET status=$3,last_error=$4,updated_at=NOW() WHERE channel_id=$1 AND tenant_id=$2',[channelId,tenantId,status,state.error||null]).catch(e=>console.error('[playout-persist]',e.message));});}
fs.mkdirSync(uploadRoot, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2,10)}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 2048) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['video/mp4','video/webm','video/quicktime','audio/mpeg','audio/mp4','audio/wav']);
    cb(allowed.has(file.mimetype) ? null : new Error('Tipo de mídia não permitido.'), allowed.has(file.mimetype));
  }
});

router.post('/auth/register', async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return res.status(503).json({error:'Configure JWT_SECRET (mínimo 32 caracteres).'});
    const schema = z.object({ tenantName:z.string().min(2).max(160), tenantSlug:z.string().regex(/^[a-z0-9-]+$/), name:z.string().min(2).max(160), email:z.string().email(), password:z.string().min(12).max(128) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error:'Dados inválidos.',details:parsed.error.flatten()});
    const d = parsed.data;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const t = await client.query('INSERT INTO tenants(name,slug) VALUES($1,$2) RETURNING id', [d.tenantName,d.tenantSlug]);
      const hash = await bcrypt.hash(d.password, 12);
      const u = await client.query('INSERT INTO users(tenant_id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING id,name,email,role,tenant_id', [t.rows[0].id,d.name,d.email.toLowerCase(),hash,'owner']);
      await client.query('COMMIT');
      const user = u.rows[0];
      const token = jwt.sign({sub:user.id,tenantId:user.tenant_id,role:user.role,email:user.email},process.env.JWT_SECRET,{expiresIn:'8h',issuer:'lltv-playout'});
      res.status(201).json({user,token,expiresIn:'8h'});
    } catch(e) { await client.query('ROLLBACK'); if(e.code==='23505') return res.status(409).json({error:'Empresa ou e-mail já cadastrado.'}); throw e; }
    finally { client.release(); }
  } catch(e) { next(e); }
});

router.post('/auth/login', async (req,res,next) => {
  try {
    const parsed = z.object({email:z.string().email(),password:z.string().min(1)}).safeParse(req.body);
    if(!parsed.success) return res.status(400).json({error:'Informe e-mail e senha.'});
    if(!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return res.status(503).json({error:'JWT_SECRET não configurado.'});
    const r = await pool.query('SELECT id,tenant_id,name,email,password_hash,role,active FROM users WHERE email=$1',[parsed.data.email.toLowerCase()]);
    const u = r.rows[0];
    if(!u || !u.active || !(await bcrypt.compare(parsed.data.password,u.password_hash))) return res.status(401).json({error:'Credenciais inválidas.'});
    const token = jwt.sign({sub:u.id,tenantId:u.tenant_id,role:u.role,email:u.email},process.env.JWT_SECRET,{expiresIn:'8h',issuer:'lltv-playout'});
    res.json({user:{id:u.id,name:u.name,email:u.email,role:u.role,tenantId:u.tenant_id},token,expiresIn:'8h'});
  } catch(e) { next(e); }
});

router.get('/auth/me',requireAuth,async(req,res,next)=>{
  try { const r=await pool.query('SELECT id,name,email,role,tenant_id FROM users WHERE id=$1 AND active=true',[req.user.sub]); if(!r.rowCount)return res.status(404).json({error:'Usuário não encontrado.'}); res.json({user:r.rows[0]}); } catch(e){next(e);}
});

router.post('/media/upload',requireAuth,upload.single('media'),async(req,res,next)=>{
  try {
    if(!req.file)return res.status(400).json({error:'Envie um arquivo no campo media.'});
    const title=(req.body.title||path.basename(req.file.originalname,path.extname(req.file.originalname))).slice(0,240);
    const type=req.file.mimetype.startsWith('audio/')?'audio':'video';
    const r=await pool.query('INSERT INTO media_assets(tenant_id,title,file_path,media_type) VALUES($1,$2,$3,$4) RETURNING *',[req.user.tenantId,title,req.file.path,type]);
    res.status(201).json({data:r.rows[0]});
  }catch(e){next(e);}
});
router.get('/media',requireAuth,async(req,res,next)=>{
  try{const r=await pool.query('SELECT id,title,media_type,duration_seconds,created_at FROM media_assets WHERE tenant_id=$1 ORDER BY created_at DESC',[req.user.tenantId]);res.json({data:r.rows});}catch(e){next(e);}
});

router.post('/playlists',requireAuth,async(req,res,next)=>{
  try{
    const p=z.object({channelId:z.string().uuid(),name:z.string().min(2).max(160),mode:z.enum(['manual','scheduled','loop']).default('manual')}).safeParse(req.body);
    if(!p.success)return res.status(400).json({error:'Dados inválidos.'});
    const c=await pool.query('SELECT id FROM channels WHERE id=$1 AND (tenant_id=$2 OR tenant_id IS NULL)',[p.data.channelId,req.user.tenantId]);
    if(!c.rowCount)return res.status(404).json({error:'Canal não encontrado.'});
    const r=await pool.query('INSERT INTO playlists(channel_id,name,mode) VALUES($1,$2,$3) RETURNING *',[p.data.channelId,p.data.name,p.data.mode]);res.status(201).json({data:r.rows[0]});
  }catch(e){next(e);}
});
router.get('/playlists',requireAuth,async(req,res,next)=>{
  try{const r=await pool.query('SELECT p.* FROM playlists p JOIN channels c ON c.id=p.channel_id WHERE c.tenant_id=$1 OR c.tenant_id IS NULL ORDER BY p.created_at DESC',[req.user.tenantId]);res.json({data:r.rows});}catch(e){next(e);}
});
router.post('/playlists/:id/items',requireAuth,async(req,res,next)=>{
  try{
    const p=z.object({mediaAssetId:z.string().uuid(),position:z.number().int().min(1),scheduledAt:z.string().datetime().optional()}).safeParse(req.body);
    if(!p.success)return res.status(400).json({error:'Dados inválidos.'});
    const own=await pool.query('SELECT p.id FROM playlists p JOIN channels c ON c.id=p.channel_id WHERE p.id=$1 AND (c.tenant_id=$2 OR c.tenant_id IS NULL)',[req.params.id,req.user.tenantId]);
    const media=await pool.query('SELECT id FROM media_assets WHERE id=$1 AND tenant_id=$2',[p.data.mediaAssetId,req.user.tenantId]);
    if(!own.rowCount||!media.rowCount)return res.status(404).json({error:'Playlist ou mídia não encontrada para este cliente.'});
    const r=await pool.query('INSERT INTO playlist_items(playlist_id,media_asset_id,position,scheduled_at) VALUES($1,$2,$3,$4) RETURNING *',[req.params.id,p.data.mediaAssetId,p.data.position,p.data.scheduledAt||null]);res.status(201).json({data:r.rows[0]});
  }catch(e){next(e);}
});

router.post('/schedule',requireAuth,requireRole('owner','admin','operator'),async(req,res,next)=>{
  try{
    const p=z.object({playlistId:z.string().uuid(),startsAt:z.string().datetime(),recurrence:z.enum(['once','daily','weekly','monthly']).default('once')}).safeParse(req.body);
    if(!p.success)return res.status(400).json({error:'Dados inválidos.'});
    const own=await pool.query('SELECT p.id FROM playlists p JOIN channels c ON c.id=p.channel_id WHERE p.id=$1 AND (c.tenant_id=$2 OR c.tenant_id IS NULL)',[p.data.playlistId,req.user.tenantId]);
    if(!own.rowCount)return res.status(404).json({error:'Playlist não encontrada.'});
    const r=await pool.query(`INSERT INTO schedule_entries(playlist_id,starts_at,next_run_at,recurrence,last_status)
      VALUES($1,$2,$2,$3,'pending') RETURNING *`,[p.data.playlistId,p.data.startsAt,p.data.recurrence]);
    res.status(201).json({data:r.rows[0],message:'Agendamento registrado. O dispatcher automático verificará os horários e iniciará a playlist no canal.'});
  }catch(e){next(e);}
});
router.get('/schedule',requireAuth,async(req,res,next)=>{
  try{const r=await pool.query(`SELECT s.* FROM schedule_entries s JOIN playlists p ON p.id=s.playlist_id JOIN channels c ON c.id=p.channel_id
    WHERE c.tenant_id=$1 OR c.tenant_id IS NULL ORDER BY COALESCE(s.next_run_at,s.starts_at)`,[req.user.tenantId]);res.json({data:r.rows});}catch(e){next(e);}
});
router.patch('/schedule/:id',requireAuth,requireRole('owner','admin','operator'),async(req,res,next)=>{
  try{
    const p=z.object({enabled:z.boolean()}).safeParse(req.body);
    if(!p.success)return res.status(400).json({error:'Informe enabled como verdadeiro ou falso.'});
    const r=await pool.query(`UPDATE schedule_entries s SET enabled=$2,last_status=CASE WHEN $2 THEN 'pending' ELSE 'disabled' END,
      next_run_at=CASE WHEN $2 THEN COALESCE(s.next_run_at,s.starts_at) ELSE s.next_run_at END,updated_at=NOW()
      FROM playlists p JOIN channels c ON c.id=p.channel_id
      WHERE s.id=$1 AND s.playlist_id=p.id AND (c.tenant_id=$3 OR c.tenant_id IS NULL) RETURNING s.*`,[req.params.id,p.data.enabled,req.user.tenantId]);
    if(!r.rowCount)return res.status(404).json({error:'Agendamento não encontrado.'});
    res.json({data:r.rows[0]});
  }catch(e){next(e);}
});
router.delete('/schedule/:id',requireAuth,requireRole('owner','admin'),async(req,res,next)=>{
  try{
    const r=await pool.query(`DELETE FROM schedule_entries s USING playlists p,channels c WHERE s.id=$1 AND s.playlist_id=p.id AND p.channel_id=c.id
      AND (c.tenant_id=$2 OR c.tenant_id IS NULL) RETURNING s.id`,[req.params.id,req.user.tenantId]);
    if(!r.rowCount)return res.status(404).json({error:'Agendamento não encontrado.'});
    res.json({deleted:true,id:r.rows[0].id});
  }catch(e){next(e);}
});

router.post('/commercials',requireAuth,requireRole('owner','admin'),async(req,res,next)=>{
  try{
    const p=z.object({mediaAssetId:z.string().uuid(),advertiser:z.string().min(2).max(160),campaign:z.string().max(160).optional(),insertionIntervalMinutes:z.number().int().min(1).max(1440).default(30)}).safeParse(req.body);
    if(!p.success)return res.status(400).json({error:'Dados inválidos.'});
    const m=await pool.query('SELECT id FROM media_assets WHERE id=$1 AND tenant_id=$2',[p.data.mediaAssetId,req.user.tenantId]);
    if(!m.rowCount)return res.status(404).json({error:'Mídia não encontrada.'});
    const r=await pool.query('INSERT INTO commercials(tenant_id,media_asset_id,advertiser,campaign,insertion_interval_minutes) VALUES($1,$2,$3,$4,$5) RETURNING *',[req.user.tenantId,p.data.mediaAssetId,p.data.advertiser,p.data.campaign||null,p.data.insertionIntervalMinutes]);res.status(201).json({data:r.rows[0],note:'Comercial habilitado para inserção automática nas próximas filas e publicações contínuas.'});
  }catch(e){next(e);}
});
router.get('/commercials',requireAuth,async(req,res,next)=>{
  try{const r=await pool.query('SELECT * FROM commercials WHERE tenant_id=$1 ORDER BY created_at DESC',[req.user.tenantId]);res.json({data:r.rows});}catch(e){next(e);}
});
router.patch('/commercials/:id',requireAuth,requireRole('owner','admin'),async(req,res,next)=>{try{const p=z.object({enabled:z.boolean()}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Informe enabled.'});const r=await pool.query('UPDATE commercials SET enabled=$1 WHERE id=$2 AND tenant_id=$3 RETURNING *',[p.data.enabled,req.params.id,req.user.tenantId]);if(!r.rowCount)return res.status(404).json({error:'Comercial não encontrado.'});res.json({data:r.rows[0]});}catch(e){next(e);}});
router.get('/system/metrics',requireAuth,requireRole('owner','admin'),(_req,res)=>{
  const os=require('node:os');
  res.json({uptimeSeconds:process.uptime(),memory:process.memoryUsage(),cpuCount:os.cpus().length,loadAverage:os.loadavg(),freeMemory:os.freemem(),totalMemory:os.totalmem(),platform:process.platform});
});

// Console de playout: fila e transporte operacional por canal.
router.get('/playout/console/:channelId', requireAuth, async (req,res,next)=>{
  try {
    const own=await pool.query('SELECT id FROM channels WHERE id=$1 AND (tenant_id=$2 OR tenant_id IS NULL)',[req.params.channelId,req.user.tenantId]);
    if(!own.rowCount)return res.status(404).json({error:'Canal não encontrado.'});
    res.json({data:playoutEngine.snapshot(req.params.channelId)});
  } catch(e){next(e);}
});
router.post('/playout/console/:channelId/load', requireAuth, async(req,res,next)=>{
  try {
    const p=z.object({playlistId:z.string().uuid()}).safeParse(req.body);
    if(!p.success)return res.status(400).json({error:'Informe uma playlist válida.'});
    const own=await pool.query('SELECT p.id FROM playlists p JOIN channels c ON c.id=p.channel_id WHERE p.id=$1 AND c.id=$2 AND (c.tenant_id=$3 OR c.tenant_id IS NULL)',[p.data.playlistId,req.params.channelId,req.user.tenantId]);
    if(!own.rowCount)return res.status(404).json({error:'Playlist não pertence ao canal/cliente.'});
    const items=await pool.query(`SELECT pi.id,pi.position,ma.id AS media_id,ma.title,ma.media_type,ma.duration_seconds,ma.file_path
      FROM playlist_items pi JOIN media_assets ma ON ma.id=pi.media_asset_id
      WHERE pi.playlist_id=$1 AND ma.tenant_id=$2 ORDER BY pi.position`,[p.data.playlistId,req.user.tenantId]);
    if(!items.rowCount)return res.status(400).json({error:'A playlist não possui mídias válidas.'});
    const ads=await pool.query(`SELECT co.id AS commercial_id,co.insertion_interval_minutes,co.advertiser,ma.id AS media_asset_id,ma.id AS media_id,ma.title,ma.file_path,ma.media_type,ma.duration_seconds,true AS enabled
      FROM commercials co JOIN media_assets ma ON ma.id=co.media_asset_id WHERE co.tenant_id=$1 AND co.enabled=true AND ma.media_type='video' ORDER BY co.insertion_interval_minutes`,[req.user.tenantId]);
    const queue=commercialInserter.composeWithCommercials(items.rows,ads.rows);
    const channel=await pool.query('SELECT resolution FROM channels WHERE id=$1',[req.params.channelId]);
    const resolution=channel.rows[0]?.resolution || 'SD';
    const data=playoutEngine.load(req.params.channelId,queue,resolution);
    await pool.query(`INSERT INTO channel_playout_sessions(channel_id,tenant_id,queue,resolution,status,last_error,updated_at) VALUES($1,$2,$3::jsonb,$4,'stopped',NULL,NOW()) ON CONFLICT(channel_id) DO UPDATE SET queue=EXCLUDED.queue,resolution=EXCLUDED.resolution,status='stopped',last_error=NULL,updated_at=NOW()`,[req.params.channelId,req.user.tenantId,JSON.stringify(queue),resolution]);
    watchChannelState(req.params.channelId,req.user.tenantId);
    res.json({data:{...data,queue:queue.map((item,i)=>({...item,position:i+1}))},message:`Fila carregada no motor FFmpeg com ${queue.filter(x=>x.is_commercial).length} inserção(ões) comercial(is). PLAY inicia a saída HLS.`});
  }catch(e){next(e);}
});
router.post('/playout/console/:channelId/:action', requireAuth, async(req,res,next)=>{
  try {
    const action=z.enum(['play','pause','stop','next','previous']).safeParse(req.params.action);
    if(!action.success)return res.status(404).json({error:'Comando desconhecido.'});
    const own=await pool.query('SELECT id FROM channels WHERE id=$1 AND (tenant_id=$2 OR tenant_id IS NULL)',[req.params.channelId,req.user.tenantId]);
    if(!own.rowCount)return res.status(404).json({error:'Canal não encontrado.'});
    try { watchChannelState(req.params.channelId,req.user.tenantId); const data=playoutEngine.command(req.params.channelId,action.data); await pool.query(`UPDATE channel_playout_sessions SET status=$3,last_error=NULL,updated_at=NOW() WHERE channel_id=$1 AND tenant_id=$2`,[req.params.channelId,req.user.tenantId,['play','next','previous'].includes(action.data)?'playing':'stopped']); res.json({data}); }
    catch(e){res.status(409).json({error:e.message});}
  }catch(e){next(e);}
});


// Saída HLS por URL-capability aleatória, gerada ao carregar a fila.
// O token é efêmero (memória da API) e permite que VLC/OBS leiam os segmentos
// sem precisar enviar cabeçalho Authorization em cada requisição.
router.get('/playout/public/:channelId/:token/:file', async (req,res,next)=>{
  try {
    const channelId=req.params.channelId;
    const state=playoutEngine.snapshot(channelId);
    const expected=state.outputUrl?.split('/')[4];
    const supplied=req.params.token;
    if(!expected || !/^[a-f0-9]{48}$/.test(supplied) || supplied.length!==expected.length || !require('node:crypto').timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return res.status(403).json({error:'Token de saída inválido ou expirado. Carregue novamente a playlist.'});
    if(!/^(index\.m3u8|segment-\d+\.ts)$/.test(req.params.file))return res.status(400).json({error:'Arquivo de saída inválido.'});
    if(!state.outputDir)return res.status(404).json({error:'Inicie o PLAY antes de acessar a saída HLS.'});
    const filePath=path.join(state.outputDir,req.params.file);
    if(!fs.existsSync(filePath))return res.status(404).json({error:'Saída HLS ainda não disponível. Inicie o PLAY e aguarde os primeiros segmentos.'});
    res.setHeader('Cache-Control','no-store');
    if(req.params.file.endsWith('.m3u8'))res.type('application/vnd.apple.mpegurl'); else res.type('video/mp2t');
    res.sendFile(filePath);
  } catch(e){next(e);}
});


// Publicação RTMP/RTMPS a partir de uma mídia da biblioteca do próprio tenant.
// A chave de transmissão é recebida apenas em memória e nunca é devolvida pela API.
router.get('/playout/rtmp/jobs', requireAuth, (req,res)=>{
  res.json({data:ffmpeg.listJobs(req.user.tenantId)});
});
router.post('/playout/rtmp/start-playlist', requireAuth, requireRole('owner','admin','operator'), async(req,res,next)=>{
  const schema=z.object({
    playlistId:z.string().uuid(), outputUrl:z.string().min(12).max(2048), failoverUrl:z.string().min(12).max(2048).optional(),
    resolution:z.enum(['SD','HD','FULL_HD','UHD_4K']).default('SD'),
    fps:z.number().min(1).max(60).default(25),
    bitrateKbps:z.number().int().min(500).max(50000).default(1800),
    preset:z.enum(['ultrafast','superfast','veryfast','faster','fast','medium']).default('ultrafast')
  });
  const parsed=schema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Parâmetros inválidos.',details:parsed.error.flatten()});
  try {
    const tenantLimit=Math.max(1,Number(process.env.MAX_RTMP_JOBS_PER_TENANT||1));
    const globalLimit=Math.max(1,Number(process.env.MAX_RTMP_JOBS_GLOBAL||2));
    if(ffmpeg.countActiveJobs(req.user.tenantId)>=tenantLimit)return res.status(429).json({error:`Limite de publicações simultâneas desta conta atingido (${tenantLimit}).`});
    if(ffmpeg.countActiveJobs()>=globalLimit)return res.status(429).json({error:`Limite de publicações simultâneas do servidor atingido (${globalLimit}).`});
    const playlist=await pool.query(`SELECT p.id,p.name FROM playlists p JOIN channels c ON c.id=p.channel_id WHERE p.id=$1 AND c.tenant_id=$2`,[parsed.data.playlistId,req.user.tenantId]);
    if(!playlist.rowCount)return res.status(404).json({error:'Playlist não encontrada nesta conta.'});
    const items=await pool.query(`SELECT ma.id,ma.title,ma.file_path,ma.media_type,ma.duration_seconds FROM playlist_items pi JOIN media_assets ma ON ma.id=pi.media_asset_id WHERE pi.playlist_id=$1 AND ma.tenant_id=$2 ORDER BY pi.position`,[parsed.data.playlistId,req.user.tenantId]);
    if(!items.rowCount)return res.status(400).json({error:'A playlist não possui mídias.'});
    if(items.rows.some(item=>item.media_type!=='video'))return res.status(400).json({error:'A playlist contém áudio isolado. Remova esses itens; esta publicação aceita somente vídeos.'});
    const ads=await pool.query(`SELECT co.id AS commercial_id,co.insertion_interval_minutes,co.advertiser,ma.id AS media_asset_id,ma.id,ma.title,ma.file_path,ma.media_type,ma.duration_seconds,true AS enabled FROM commercials co JOIN media_assets ma ON ma.id=co.media_asset_id WHERE co.tenant_id=$1 AND co.enabled=true AND ma.media_type='video' ORDER BY co.insertion_interval_minutes`,[req.user.tenantId]);
    const scheduledItems=commercialInserter.composeWithCommercials(items.rows,ads.rows);
    if(scheduledItems.length>500)return res.status(400).json({error:'A programação com comerciais excede 500 itens. Reduza os comerciais ativos.'});
    // Require a stable encryption key before accepting a job: stream keys must
    // survive restarts without ever being stored in plaintext.
    rtmpStore.encrypt(parsed.data.outputUrl);
    if(parsed.data.failoverUrl) rtmpStore.encrypt(parsed.data.failoverUrl);
    const jobOptions={resolution:parsed.data.resolution,fps:parsed.data.fps,bitrateKbps:parsed.data.bitrateKbps,preset:parsed.data.preset};
    const job=ffmpeg.startPlaylistTranscode({...parsed.data,items:scheduledItems,ownerId:req.user.tenantId,sourceTitle:playlist.rows[0].name,
      onUpdate:(updated,heartbeat)=>{
        rtmpStore.updateJob({...updated,progressFresh:heartbeat},req.user.tenantId).catch(e=>console.error('[rtmp-persist]',e.message));
        if(['reconnecting','failed'].includes(updated.status)) rtmpStore.recordEvent(req.user.tenantId,'rtmp_stream_alert',{jobId:updated.id,status:updated.status,error:updated.error,usingFailover:updated.usingFailover}).catch(e=>console.error('[rtmp-alert]',e.message));
      }});
    try { await rtmpStore.saveJob({job,tenantId:req.user.tenantId,playlistId:parsed.data.playlistId,outputUrl:parsed.data.outputUrl,failoverUrl:parsed.data.failoverUrl,options:jobOptions}); }
    catch (persistError) { ffmpeg.stopOwnedJob(job.id,req.user.tenantId); throw persistError; }
    const latest=ffmpeg.listJobs(req.user.tenantId).find(x=>x.id===job.id); if(latest) await rtmpStore.updateJob({...latest,progressFresh:true},req.user.tenantId);
    res.status(202).json({data:job,message:`Publicação contínua iniciada: ${scheduledItems.length} itens incluindo comerciais em repetição. Estado persistido; recuperação após reinício habilitada quando a chave de criptografia estiver configurada.`});
  } catch(e) {
    if(/RTMP_SECRET_ENCRYPTION_KEY/.test(e.message))return res.status(503).json({error:e.message});
    if(/Destino|RTMP|Resolução|FPS|Bitrate|Preset|arquivo|MEDIA_ROOT|URL|usuário|fragmento|endereço|encontrado|dentro de|playlist|vídeo/i.test(e.message))return res.status(400).json({error:e.message});
    next(e);
  }
});

router.post('/playout/rtmp/start', requireAuth, requireRole('owner','admin','operator'), async(req,res,next)=>{
  const schema=z.object({
    mediaAssetId:z.string().uuid(),
    outputUrl:z.string().min(12).max(2048),
    resolution:z.enum(['SD','HD','FULL_HD','UHD_4K']).default('HD'),
    fps:z.number().min(1).max(60).default(25),
    bitrateKbps:z.number().int().min(500).max(50000).default(2500),
    preset:z.enum(['ultrafast','superfast','veryfast','faster','fast','medium']).default('ultrafast')
  });
  const parsed=schema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Parâmetros inválidos.',details:parsed.error.flatten()});
  try{
    const tenantLimit=Math.max(1,Number(process.env.MAX_RTMP_JOBS_PER_TENANT||1));
    const globalLimit=Math.max(1,Number(process.env.MAX_RTMP_JOBS_GLOBAL||2));
    if(ffmpeg.countActiveJobs(req.user.tenantId)>=tenantLimit)return res.status(429).json({error:`Limite de publicações simultâneas desta conta atingido (${tenantLimit}).`});
    if(ffmpeg.countActiveJobs()>=globalLimit)return res.status(429).json({error:`Limite de publicações simultâneas do servidor atingido (${globalLimit}).`});
    const media=await pool.query('SELECT id,title,file_path,media_type FROM media_assets WHERE id=$1 AND tenant_id=$2',[parsed.data.mediaAssetId,req.user.tenantId]);
    if(!media.rowCount)return res.status(404).json({error:'Mídia não encontrada na biblioteca deste cliente.'});
    if(media.rows[0].media_type!=='video')return res.status(400).json({error:'A publicação RTMP desta etapa aceita arquivos de vídeo.'});
    const job=ffmpeg.startTranscode({...parsed.data,inputPath:media.rows[0].file_path,ownerId:req.user.tenantId,sourceTitle:media.rows[0].title});
    res.status(202).json({data:job,message:'Processo de publicação iniciado. Aguarde o FFmpeg conectar ao servidor RTMP.'});
  }catch(e){
    if(/Destino|RTMP|Resolução|FPS|Bitrate|Preset|arquivo|MEDIA_ROOT|URL|usuário|fragmento|endereço|encontrado|dentro de/i.test(e.message))return res.status(400).json({error:e.message});
    next(e);
  }
});
router.post('/playout/rtmp/stop/:jobId', requireAuth, requireRole('owner','admin','operator'), async(req,res)=>{
  try{const data=ffmpeg.stopOwnedJob(req.params.jobId,req.user.tenantId); await pool.query("UPDATE rtmp_stream_jobs SET status='stopped',stopped_at=NOW(),updated_at=NOW() WHERE id=$1 AND tenant_id=$2",[req.params.jobId,req.user.tenantId]); res.json({data});}
  catch(e){res.status(404).json({error:e.message});}
});
router.get('/playout/rtmp/history',requireAuth,async(req,res,next)=>{
  try{const r=await pool.query('SELECT id,playlist_id,status,source_title,retry_count,max_retries,using_failover,last_heartbeat,started_at,stopped_at,updated_at,error FROM rtmp_stream_jobs WHERE tenant_id=$1 ORDER BY started_at DESC LIMIT 50',[req.user.tenantId]);res.json({data:r.rows});}catch(e){next(e);}
});

module.exports=router;
