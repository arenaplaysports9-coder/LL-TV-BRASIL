// Estado operacional do console de playout. A fila é carregada do PostgreSQL;
// os comandos controlam a sessão da API, não substituem ainda o motor FFmpeg.
const sessions = new Map();
function snapshot(channelId) {
  const s = sessions.get(channelId);
  if (!s) return { channelId, status: 'stopped', index: -1, current: null, queue: [], updatedAt: new Date().toISOString() };
  return { ...s, queue: s.queue.map((item, i) => ({ ...item, position: i + 1 })) };
}
function load(channelId, queue) {
  const s = { channelId, status: 'stopped', index: queue.length ? 0 : -1, current: null, queue, updatedAt: new Date().toISOString() };
  s.current = s.index >= 0 ? queue[s.index] : null;
  sessions.set(channelId, s); return snapshot(channelId);
}
function command(channelId, action) {
  const s = sessions.get(channelId);
  if (!s) throw new Error('Carregue uma playlist antes de controlar o playout.');
  if (action === 'play') { if (!s.queue.length) throw new Error('A fila está vazia.'); s.status = 'playing'; }
  else if (action === 'pause') { if (s.status !== 'playing') throw new Error('Não existe reprodução ativa para pausar.'); s.status = 'paused'; }
  else if (action === 'stop') s.status = 'stopped';
  else if (action === 'next' || action === 'previous') {
    if (!s.queue.length) throw new Error('A fila está vazia.');
    const delta = action === 'next' ? 1 : -1;
    s.index = Math.max(0, Math.min(s.queue.length - 1, s.index + delta));
    s.current = s.queue[s.index]; s.status = 'playing';
  }
  s.updatedAt = new Date().toISOString(); return snapshot(channelId);
}
module.exports = { snapshot, load, command };
