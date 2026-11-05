const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('../config');

const jobs = new Map();
const allowedResolutions = {
  SD: [720, 480], HD: [1280, 720], FULL_HD: [1920, 1080], UHD_4K: [3840, 2160]
};

function buildRtmpArgs({ inputPath, outputUrl, resolution = 'HD', fps = 25, bitrateKbps = 2500, preset = 'ultrafast' }) {
  if (!allowedResolutions[resolution]) throw new Error('Resolução não permitida.');
  if (!Number.isFinite(fps) || fps < 1 || fps > 60) throw new Error('FPS deve estar entre 1 e 60.');
  if (!Number.isInteger(bitrateKbps) || bitrateKbps < 500 || bitrateKbps > 50000) throw new Error('Bitrate inválido.');
  let target;
  try { target = new URL(outputUrl); } catch { throw new Error('Destino inválido.'); }
  if (target.protocol !== 'rtmp:' && target.protocol !== 'rtmps:') throw new Error('Somente destinos RTMP/RTMPS são aceitos nesta versão.');
  if (target.username || target.password || target.hash) throw new Error('A URL não pode conter usuário, senha ou fragmento.');
  if (outputUrl.length > 2048) throw new Error('Destino RTMP muito longo.');
  if (!target.hostname || !target.pathname || target.pathname === '/') throw new Error('Informe o endereço de publicação completo, incluindo aplicação e chave.');
  if (!['ultrafast','superfast','veryfast','faster','fast','medium'].includes(preset)) throw new Error('Preset de codificação inválido.');
  const resolvedInput = path.resolve(inputPath);
  const mediaRoot = path.resolve(config.mediaRoot);
  if (resolvedInput !== mediaRoot && !resolvedInput.startsWith(mediaRoot + path.sep)) {
    throw new Error('O arquivo de entrada precisa estar dentro de MEDIA_ROOT.');
  }
  if (!fs.existsSync(resolvedInput) || !fs.statSync(resolvedInput).isFile()) throw new Error('Arquivo de mídia não encontrado.');
  const [width, height] = allowedResolutions[resolution];
  return [
    '-hide_banner', '-nostdin', '-re', '-i', resolvedInput,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
    '-r', String(fps), '-c:v', 'libx264', '-preset', preset, '-tune', 'zerolatency',
    '-b:v', `${bitrateKbps}k`, '-maxrate', `${bitrateKbps}k`, '-bufsize', `${bitrateKbps * 2}k`,
    '-c:a', 'aac', '-b:a', '96k', '-ar', '44100', '-stats_period', '5', '-progress', 'pipe:2', '-f', 'flv', outputUrl
  ];
}

function startTranscode(options) {
  const args = buildRtmpArgs(options);
  const { outputUrl, ownerId = null, sourceTitle = null } = options;
  const id = crypto.randomUUID();
  const child = spawn(config.ffmpegPath, args, { shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  const job = { id, pid: child.pid || null, status: 'starting', startedAt: new Date().toISOString(), stderr: '', ownerId, sourceTitle, destinationHost: new URL(outputUrl).hostname, outputUrl };
  jobs.set(id, job);
  child.stderr.on('data', chunk => { job.stderr = (job.stderr + chunk.toString()).slice(-4000); });
  child.on('spawn', () => { job.status = 'running'; });
  child.on('error', err => { job.status = 'failed'; job.error = err.message; });
  child.on('exit', (code, signal) => {
    if (job.status !== 'stopped') job.status = code === 0 ? 'stopped' : 'failed';
    job.exitCode = code; job.signal = signal; job.stoppedAt = new Date().toISOString();
  });
  job.process = child;
  return publicJob(job);
}

function ffconcatEscape(filePath) {
  const normalized = path.resolve(filePath).replace(/\\/g, '/');
  return normalized.replace(/'/g, "'\\''");
}

function startPlaylistTranscode(options) {
  const { items, outputUrl, failoverUrl = null, ownerId = null, sourceTitle = 'Playlist', resolution = 'HD', fps = 25, bitrateKbps = 2500, preset = 'ultrafast', jobId = null, onUpdate = null, usingFailover = false } = options;
  if (!Array.isArray(items) || items.length === 0) throw new Error('A playlist precisa conter pelo menos um vídeo.');
  if (items.length > 500) throw new Error('A playlist excede o limite de 500 vídeos por publicação.');
  if (items.some(item => item.media_type && item.media_type !== 'video')) throw new Error('A publicação contínua aceita somente itens de vídeo.');
  // Reuse the single-file validator for destination, profile, and media-root checks.
  const firstArgs = buildRtmpArgs({ inputPath: items[0].file_path, outputUrl, resolution, fps, bitrateKbps, preset });
  if (failoverUrl) buildRtmpArgs({ inputPath: items[0].file_path, outputUrl: failoverUrl, resolution, fps, bitrateKbps, preset });
  const mediaRoot = path.resolve(config.mediaRoot);
  const safeItems = items.map(item => {
    const resolved = path.resolve(item.file_path || '');
    if (resolved !== mediaRoot && !resolved.startsWith(mediaRoot + path.sep)) throw new Error('Todos os vídeos precisam estar dentro de MEDIA_ROOT.');
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) throw new Error(`Arquivo de mídia não encontrado: ${item.title || 'vídeo'}.`);
    return { path: resolved, title: item.title || 'Vídeo' };
  });
  const listDir = path.join(path.resolve(config.playoutRoot), '_rtmp');
  fs.mkdirSync(listDir, { recursive: true });
  const id = jobId || crypto.randomUUID();
  const listPath = path.join(listDir, `${id}-${crypto.randomUUID()}.ffconcat`);
  const listText = ['ffconcat version 1.0', ...safeItems.map(item => `file '${ffconcatEscape(item.path)}'`)].join('\n') + '\n';
  fs.writeFileSync(listPath, listText, { encoding: 'utf8', flag: 'wx' });
  const args = firstArgs.slice();
  args.splice(2, 3, '-re', '-stream_loop', '-1', '-f', 'concat', '-safe', '0', '-i', listPath);
  const job = {
    id, pid: null, status: 'starting', startedAt: new Date().toISOString(), stderr: '', ownerId,
    sourceTitle, destinationHost: new URL(outputUrl).hostname, playlist: true,
    itemCount: safeItems.length, retryCount: 0, failoverUrl, usingFailover: !!usingFailover, onUpdate, lastProgressAt: Date.now(), progress: {}, retryOnFailover: 0, maxRetries: (() => { const n = Number(process.env.RTMP_RECONNECT_RETRIES ?? 3); return Number.isInteger(n) ? Math.max(0, Math.min(10, n)) : 3; })(),
    listPath, args, outputUrl, retryTimer: null, process: null, stopRequested: false
  };
  jobs.set(id, job);
  const launch = () => {
    if (job.stopRequested) return;
    job.status = job.retryCount ? 'reconnecting' : 'starting';
    let child;
    try { child = spawn(config.ffmpegPath, job.args, { shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] }); }
    catch (err) { scheduleRetry(err.message); return; }
    job.process = child;
    job.pid = child.pid || null;
    child.stderr.on('data', chunk => {
      const text = chunk.toString(); job.stderr = (job.stderr + text).slice(-4000);
      for (const line of text.split(/\r?\n/)) { const i=line.indexOf('='); if(i>0) { const k=line.slice(0,i), v=line.slice(i+1); if(['out_time_ms','out_time','fps','bitrate','speed','progress'].includes(k)) job.progress[k]=v; } }
      if (job.progress.progress === 'continue' || job.progress.progress === 'end') { job.lastProgressAt=Date.now(); job.progressFresh=true; job.progress.progress=''; notify(); }
    });
    child.on('spawn', () => { if (job.process === child && !job.stopRequested) { job.status = 'running'; job.lastProgressAt=Date.now(); notify(); } });
    child.on('error', err => { if (job.process === child) { job.error = err.message; job.status = 'reconnecting'; notify(); } });
    child.on('close', (code, signal) => {
      if (job.process !== child) return;
      job.process = null; job.pid = null;
      if (job.suspendOnExit) { job.process=null; job.pid=null; job.status='reconnecting'; notify(); return; }
      if (job.stopRequested) { finalize(); return; }
      scheduleRetry(`FFmpeg encerrou (código ${code}, sinal ${signal || '—'}).`);
    });
  };
  const finalize = () => {
    if (job.retryTimer) clearTimeout(job.retryTimer);
    job.retryTimer = null;
    job.status = 'stopped'; job.stoppedAt = new Date().toISOString(); notify();
    try { fs.unlinkSync(listPath); } catch {}
  };
  const scheduleRetry = reason => {
    if (job.stopRequested) return finalize();
    job.error = `${reason} ${(job.stderr || '').slice(-500)}`.trim();
    if (job.retryCount >= job.maxRetries) {
      if (job.failoverUrl && !job.usingFailover) {
        job.usingFailover = true; job.retryCount = 0; job.error = `Falha no destino principal; alternando para o destino de contingência. ${job.error}`;
        const current = job.args.lastIndexOf(outputUrl); if (current >= 0) job.args[current] = job.failoverUrl;
        notify(); launch(); return;
      }
      job.status = 'failed'; job.stoppedAt = new Date().toISOString(); notify();
      try { fs.unlinkSync(listPath); } catch {}
      return;
    }
    const delayMs = Math.min(30000, 1000 * (2 ** job.retryCount));
    job.retryCount += 1; job.status = 'reconnecting'; notify();
    job.retryTimer = setTimeout(() => { job.retryTimer = null; launch(); }, delayMs);
    job.retryTimer.unref?.();
  };
  job.stop = () => {
    job.stopRequested = true;
    if (job.retryTimer) { clearTimeout(job.retryTimer); job.retryTimer = null; }
    if (job.process && job.process.exitCode === null) {
      const child = job.process;
      child.kill('SIGTERM');
      const killTimer = setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 5000);
      killTimer.unref?.();
    } else finalize();
  };
  function notify() { if (typeof job.onUpdate === 'function') { try { job.onUpdate(publicJob(job), job.progressFresh === true); } catch (e) { console.error('[rtmp-job-update]',e.message); } } job.progressFresh=false; }
  launch();
  return publicJob(job);
}

function stopJob(id) {
  const job = jobs.get(id);
  if (!job) throw new Error('Trabalho não encontrado.');
  if (job.playlist && job.stop) { job.status = 'stopped'; job.stop(); return publicJob(job); }
  if (job.process && !job.process.killed) {
    job.status = 'stopped';
    job.process.kill('SIGTERM');
    const proc = job.process;
    const timer = setTimeout(() => { if (proc.exitCode === null) proc.kill('SIGKILL'); }, 5000);
    timer.unref();
  }
  return publicJob(job);
}
function redactDestination(value) { return String(value || '').replace(/rtmps?:\/\/[^\s'"\]]+/gi, '[destino RTMP oculto]'); }
function publicJob(job) {
  return { id: job.id, pid: job.pid, status: job.status, startedAt: job.startedAt, stoppedAt: job.stoppedAt, error: job.error ? redactDestination(job.error) : undefined, sourceTitle: job.sourceTitle, destinationHost: job.destinationHost, playlist: !!job.playlist, itemCount: job.itemCount || undefined, retryCount: job.retryCount || 0, maxRetries: job.maxRetries || 0, usingFailover: !!job.usingFailover, progress: job.progress || {}, lastProgressAt: job.lastProgressAt ? new Date(job.lastProgressAt).toISOString() : null };
}

// Detect a stalled encoder even if the child process remains alive. A missing
// progress heartbeat triggers the same bounded reconnect/failover path.
const watchdog = setInterval(() => {
  const now = Date.now();
  for (const job of jobs.values()) {
    if (!job.playlist || job.status !== 'running' || !job.process || !job.lastProgressAt) continue;
    if (now - job.lastProgressAt > Number(process.env.RTMP_PROGRESS_TIMEOUT_MS || 60000)) {
      job.error = 'Sem progresso de codificação dentro do limite; reiniciando a publicação.';
      job.status = 'reconnecting';
      try { job.process.kill('SIGTERM'); } catch {}
    }
  }
}, 10000);
watchdog.unref?.();
function listJobs(ownerId = null) { return [...jobs.values()].filter(job => ownerId === null || job.ownerId === ownerId).map(publicJob); }
function countActiveJobs(ownerId = null) { return [...jobs.values()].filter(job => (ownerId === null || job.ownerId === ownerId) && ['starting','running','reconnecting'].includes(job.status)).length; }
function suspendAll() {
  for (const job of jobs.values()) {
    if (!job.playlist || !job.process || job.process.exitCode !== null) continue;
    job.suspendOnExit=true; job.status='reconnecting';
    try { job.process.kill('SIGTERM'); } catch {}
  }
}
function stopOwnedJob(id, ownerId) {
  const job = jobs.get(id);
  if (!job || job.ownerId !== ownerId) throw new Error('Trabalho não encontrado.');
  return stopJob(id);
}
module.exports = { startTranscode, startPlaylistTranscode, stopJob, stopOwnedJob, listJobs, countActiveJobs, buildRtmpArgs, suspendAll };
