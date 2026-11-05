const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');
const ffmpeg = require('../services/ffmpeg');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

// Liveness is intentionally independent from PostgreSQL/FFmpeg so a
// supervisor can distinguish a running Node process from a ready service.
router.get('/health/live', (_req, res) => res.status(200).json({
  ok: true, service: 'LLTV PLAYOUT API', state: 'alive', timestamp: new Date().toISOString()
}));

router.get('/health', async (_req, res) => {
  const checks = { database: 'unknown', schema: 'unknown', mediaStorage: 'unknown', playoutStorage: 'unknown' };
  try {
    await pool.query('SELECT 1');
    checks.database = 'ok';
    const schema = await pool.query("SELECT to_regclass('public.rtmp_stream_jobs') AS rtmp_jobs, to_regclass('public.media_assets') AS media_assets, to_regclass('public.schedule_entries') AS schedule_entries");
    checks.schema = schema.rows[0]?.rtmp_jobs && schema.rows[0]?.media_assets && schema.rows[0]?.schedule_entries ? 'ok' : 'missing_tables';
  } catch (error) { checks.database = 'unavailable'; checks.databaseError = error.code || 'connection_error'; }
  const fs = require('node:fs');
  const config = require('../config');
  for (const [key, directory] of [['mediaStorage', config.mediaRoot], ['playoutStorage', config.playoutRoot]]) {
    try {
      fs.mkdirSync(directory, { recursive: true });
      const probe = require('node:path').join(directory, `.lltv-health-${process.pid}-${Date.now()}`);
      fs.writeFileSync(probe, 'ok', { flag: 'wx' }); fs.unlinkSync(probe);
      checks[key] = 'ok';
    } catch { checks[key] = 'not_writable'; }
  }
  const ready = Object.values(checks).every(value => value === 'ok');
  res.status(ready ? 200 : 503).json({
    ok: ready, service: 'LLTV PLAYOUT API', version: '1.4.0', state: ready ? 'ready' : 'degraded',
    checks, ffmpegPathConfigured: Boolean(process.env.FFMPEG_PATH), timestamp: new Date().toISOString()
  });
});

router.get('/channels', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, name, slug, resolution, width, height, fps, enabled, created_at FROM channels WHERE tenant_id=$1 OR tenant_id IS NULL ORDER BY name', [req.user.tenantId]);
    res.json({ data: result.rows });
  } catch (err) { next(err); }
});

router.post('/channels', requireAuth, requireRole('owner','admin'), async (req, res, next) => {
  const schema = z.object({
    name: z.string().trim().min(2).max(160),
    slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
    resolution: z.enum(['SD','HD','FULL_HD','UHD_4K']).default('HD')
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos.', details: parsed.error.flatten() });
  const dimensions = { SD:[720,480], HD:[1280,720], FULL_HD:[1920,1080], UHD_4K:[3840,2160] }[parsed.data.resolution];
  try {
    const result = await pool.query(
      'INSERT INTO channels(tenant_id,name,slug,resolution,width,height) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [req.user.tenantId, parsed.data.name, parsed.data.slug, parsed.data.resolution, ...dimensions]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Já existe um canal com este slug.' });
    next(err);
  }
});

router.get('/playout/status', requireAuth, (req, res) => res.json({ jobs: ffmpeg.listJobs(req.user.tenantId) }));

router.post('/playout/start', requireAuth, requireRole('owner','admin','operator'), async (req, res, next) => {
  const schema = z.object({
    inputPath: z.string().min(1),
    outputUrl: z.string().url(),
    resolution: z.enum(['SD','HD','FULL_HD','UHD_4K']).default('HD'),
    fps: z.number().min(1).max(60).default(30),
    bitrateKbps: z.number().int().min(500).max(50000).default(4500)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Parâmetros inválidos.', details: parsed.error.flatten() });
  try {
    const owned=await pool.query('SELECT id,title FROM media_assets WHERE file_path=$1 AND tenant_id=$2',[parsed.data.inputPath,req.user.tenantId]);
    if(!owned.rowCount)return res.status(404).json({error:'Arquivo não pertence à biblioteca deste cliente.'});
    res.status(202).json({ job: ffmpeg.startTranscode({...parsed.data,ownerId:req.user.tenantId,sourceTitle:owned.rows[0].title}) });
  } catch (err) { if(/Destino|RTMP|Resolução|FPS|Bitrate|Preset|arquivo|MEDIA_ROOT|URL|usuário|fragmento|endereço|encontrado|dentro de/i.test(err.message))return res.status(400).json({error:err.message}); next(err); }
});

router.post('/playout/stop/:jobId', requireAuth, requireRole('owner','admin','operator'), (req, res) => {
  try { res.json({ job: ffmpeg.stopOwnedJob(req.params.jobId,req.user.tenantId) }); }
  catch (err) { res.status(404).json({ error: err.message }); }
});

module.exports = router;
