// FFmpeg-backed channel playout. Produces an HLS output that can be opened by
// compatible players (VLC) or added to OBS as a Media Source/browser workflow.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('../config');

const outputRoot = path.resolve(config.playoutRoot);
const channels = new Map();
const stateListeners = new Map();
function notify(channelId){const fn=stateListeners.get(channelId);if(fn){try{fn(snapshot(channelId));}catch(e){console.error('[playout-state]',e.message);}}}
function setStateListener(channelId,fn){const id=safeChannelId(channelId);if(typeof fn==='function')stateListeners.set(id,fn);else stateListeners.delete(id);}
const resolutions = {
  SD: [720, 480], HD: [1280, 720], FULL_HD: [1920, 1080], UHD_4K: [3840, 2160]
};

function safeChannelId(id) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(String(id))) throw new Error('Identificador de canal inválido.');
  return String(id);
}
function ensureOutput(id) {
  const dir = path.join(outputRoot, safeChannelId(id));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function snapshot(channelId) {
  const s = channels.get(channelId);
  if (!s) return { channelId, status: 'stopped', index: -1, current: null, outputUrl: null, error: null };
  return { channelId, status: s.status, index: s.index, current: s.queue[s.index] || null, queue: s.queue.map((item, i) => ({ ...item, position: i + 1 })),
    outputUrl: s.accessToken ? `/playout/public/${encodeURIComponent(channelId)}/${s.accessToken}/index.m3u8` : null,
    pid: s.child?.pid || null, error: s.error || null, updatedAt: s.updatedAt };
}
function terminate(s) {
  if (!s.child || s.child.exitCode !== null || s.child.killed) return;
  s.expectedExit = true;
  s.child.kill('SIGTERM');
  const child = s.child;
  const timer = setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 4000);
  timer.unref();
}
function launch(channelId, s) {
  const item = s.queue[s.index];
  if (!item) { s.status = 'stopped'; s.updatedAt = new Date().toISOString(); notify(channelId); return snapshot(channelId); }
  if (item.media_type && item.media_type !== 'video') throw new Error('Nesta etapa, o motor de saída HLS aceita arquivos de vídeo. Áudio isolado será implementado em módulo próprio.');
  const input = path.resolve(item.file_path || '');
  const mediaRoot = path.resolve(config.mediaRoot);
  if (!input.startsWith(mediaRoot + path.sep) || !fs.existsSync(input) || !fs.statSync(input).isFile()) {
    s.status = 'failed'; s.error = `Arquivo de mídia ausente ou fora de MEDIA_ROOT: ${item.title}`;
    s.updatedAt = new Date().toISOString(); notify(channelId); throw new Error(s.error);
  }
  const channelDir = ensureOutput(channelId);
  // Each playback attempt gets an isolated directory so a killed FFmpeg process
  // cannot overwrite segments from the next item during shutdown.
  const dir = path.join(channelDir, crypto.randomUUID());
  fs.mkdirSync(dir, { recursive: true });
  s.outputDir = dir;
  const [width, height] = resolutions[s.resolution] || resolutions.HD;
  // Conservative defaults: 720p, 25 fps, ultrafast. Override with environment variables.
  const fps = Number(process.env.PLAYOUT_FPS || 25);
  const bitrate = Number(process.env.PLAYOUT_BITRATE_KBPS || 2500);
  if (!Number.isFinite(fps) || fps < 1 || fps > 60 || !Number.isInteger(bitrate) || bitrate < 500 || bitrate > 12000) {
    throw new Error('PLAYOUT_FPS/PLAYOUT_BITRATE_KBPS fora dos limites permitidos.');
  }
  const args = ['-hide_banner','-loglevel','warning','-nostdin','-re','-i',input,
    '-map','0:v:0','-map','0:a:0?','-vf',`scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,fps=${fps}`,
    '-c:v','libx264','-preset',process.env.PLAYOUT_PRESET || 'ultrafast','-tune','zerolatency',
    '-b:v',`${bitrate}k`,'-maxrate',`${bitrate}k`,'-bufsize',`${bitrate * 2}k`,
    '-c:a','aac','-b:a','96k','-ac','2','-f','hls','-hls_time','4','-hls_list_size','8',
    '-hls_flags','delete_segments+append_list+independent_segments','-hls_segment_filename',path.join(dir,'segment-%06d.ts'),
    path.join(dir,'index.m3u8')];
  const child = spawn(config.ffmpegPath, args, { shell: false, windowsHide: true, stdio: ['ignore','ignore','pipe'] });
  s.child = child; s.status = 'starting'; s.error = null; s.expectedExit = false;
  s.updatedAt = new Date().toISOString(); notify(channelId);
  child.stderr.on('data', data => { s.lastLog = (s.lastLog || '').concat(data.toString()).slice(-3000); });
  child.on('spawn', () => { if (s.child === child) { s.status = 'playing'; s.updatedAt = new Date().toISOString(); notify(channelId); } });
  child.on('error', err => { if (s.child === child) { s.status = 'failed'; s.error = `Não foi possível iniciar FFmpeg: ${err.message}`; s.updatedAt = new Date().toISOString(); notify(channelId); } });
  child.on('exit', (code, signal) => {
    if (s.child !== child) return;
    s.child = null;
    if (s.expectedExit) { s.child = null; s.updatedAt = new Date().toISOString(); notify(channelId); return; }
    if (code === 0) {
      if (s.index < s.queue.length - 1) { s.index += 1; try { launch(channelId, s); } catch (e) { s.status='failed'; s.error=e.message; } }
      else { s.status = 'ended'; s.updatedAt = new Date().toISOString(); notify(channelId); }
    } else { s.status = 'failed'; s.error = `FFmpeg encerrou com código ${code} (${signal || 'sem sinal'}). ${(s.lastLog || '').slice(-800)}`; s.updatedAt = new Date().toISOString(); notify(channelId); }
  });
  return snapshot(channelId);
}
function load(channelId, queue, resolution = 'HD') {
  const id = safeChannelId(channelId);
  if (!Array.isArray(queue) || !queue.length) throw new Error('A fila está vazia.');
  if (!resolutions[resolution]) resolution = 'HD';
  const old = channels.get(id); if (old) terminate(old);
  const s = { queue, index: 0, status: 'stopped', resolution, child: null, error: null, accessToken: crypto.randomBytes(24).toString('hex'), updatedAt: new Date().toISOString() };
  channels.set(id, s); return snapshot(id);
}
function suspendAll() { for (const [id,s] of channels.entries()) { stateListeners.delete(id); if (s.child && s.child.exitCode === null) { terminate(s); s.status='stopped'; s.updatedAt=new Date().toISOString(); } } }
function command(channelId, action) {
  const id = safeChannelId(channelId); const s = channels.get(id);
  if (!s) throw new Error('Carregue uma playlist antes de controlar o playout.');
  if (action === 'play') {
    if (!s.queue.length) throw new Error('A fila está vazia.');
    if (s.status === 'playing' || s.status === 'starting') return snapshot(id);
    if (s.status === 'paused') {
      if (process.platform === 'win32') throw new Error('PAUSE/RETOMAR por suspensão de processo não é suportado nesta versão para Windows. Use STOP e PLAY para reiniciar o item atual.');
      process.kill(s.child.pid, 'SIGCONT'); s.status='playing'; s.updatedAt=new Date().toISOString(); return snapshot(id);
    }
    return launch(id, s);
  }
  if (action === 'pause') {
    if (s.status !== 'playing' || !s.child) throw new Error('Não existe reprodução FFmpeg ativa para pausar.');
    if (process.platform === 'win32') throw new Error('PAUSE ainda não é suportado no Windows nesta versão; use STOP.');
    process.kill(s.child.pid, 'SIGSTOP'); s.status='paused'; s.updatedAt=new Date().toISOString(); return snapshot(id);
  }
  if (action === 'stop') { terminate(s); s.status='stopped'; s.updatedAt=new Date().toISOString(); return snapshot(id); }
  if (action === 'next' || action === 'previous') {
    const next = Math.max(0, Math.min(s.queue.length - 1, s.index + (action === 'next' ? 1 : -1)));
    terminate(s); s.index=next; s.status='stopped'; s.updatedAt=new Date().toISOString(); return launch(id,s);
  }
  throw new Error('Comando de playout desconhecido.');
}
module.exports = { load, command, snapshot, outputRoot, suspendAll, setStateListener };
