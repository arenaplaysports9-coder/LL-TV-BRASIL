const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const config = require('../backend/src/config');

const results = [];
function report(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? '[OK]' : '[FALHA]'} ${name}: ${detail}`);
}
function executable(bin, args) {
  const r = spawnSync(bin, args, { encoding: 'utf8', windowsHide: true, timeout: 8000 });
  if (r.error) return { ok: false, detail: r.error.code || r.error.message };
  return { ok: r.status === 0, detail: (r.stdout || r.stderr || `código ${r.status}`).split(/\r?\n/)[0].trim() };
}

const major = Number(process.versions.node.split('.')[0]);
report('Node.js >= 20', major >= 20, `versão ${process.versions.node}`);
for (const [name, bin] of [['FFmpeg', config.ffmpegPath], ['FFprobe', process.env.FFPROBE_PATH || 'ffprobe']]) {
  const r = executable(bin, ['-version']);
  report(name, r.ok, r.detail);
}
const protocolCheck = spawnSync(config.ffmpegPath, ['-hide_banner','-protocols'], {encoding:'utf8',windowsHide:true,timeout:8000});
const srtSupported = protocolCheck.status===0 && /\bsrt\b/.test((protocolCheck.stdout||'')+' '+(protocolCheck.stderr||''));
report('FFmpeg SRT protocol', srtSupported, srtSupported ? 'protocolo SRT disponível' : (protocolCheck.error?.message || 'FFmpeg sem suporte SRT detectado'));
for (const [name, dir] of [['Biblioteca de mídia', config.mediaRoot], ['Saída do playout', config.playoutRoot]]) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.doctor-${process.pid}-${Date.now()}`);
    fs.writeFileSync(probe, 'ok', { flag: 'wx' }); fs.unlinkSync(probe);
    report(name, true, `gravável: ${dir}`);
  } catch (e) { report(name, false, `${dir} (${e.code || e.message})`); }
}
const jwtOk = Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32 && !process.env.JWT_SECRET.startsWith('replace_'));
report('JWT_SECRET', jwtOk, jwtOk ? 'configurado' : 'ausente, padrão ou menor que 32 caracteres');
const cryptoKey = process.env.RTMP_SECRET_ENCRYPTION_KEY || '';
const cryptoOk = /^[a-fA-F0-9]{64}$/.test(cryptoKey) && !cryptoKey.startsWith('replace_');
report('RTMP_SECRET_ENCRYPTION_KEY', cryptoOk, cryptoOk ? '64 caracteres hexadecimais configurados' : 'chave ausente ou inválida; recuperação segura RTMP ficará indisponível');

(async () => {
  try {
    const pool = require('../backend/src/db/pool');
    await pool.query('SELECT 1');
    const q = await pool.query("SELECT to_regclass('public.rtmp_stream_jobs') AS rtmp_jobs, to_regclass('public.media_assets') AS media_assets, to_regclass('public.channel_playout_sessions') AS playout_sessions, to_regclass('public.srt_ingest_sessions') AS srt_sessions, to_regclass('public.channel_graphics') AS graphics, to_regclass('public.webtv_settings') AS webtv");
    const schemaOk = Boolean(q.rows[0]?.rtmp_jobs && q.rows[0]?.media_assets && q.rows[0]?.playout_sessions && q.rows[0]?.srt_sessions && q.rows[0]?.graphics && q.rows[0]?.webtv);
    report('PostgreSQL', true, 'conexão estabelecida');
    report('Migrações essenciais', schemaOk, schemaOk ? 'tabelas essenciais e módulos broadcast encontrados' : 'execute npm run db:migrate');
    await pool.end();
  } catch (e) {
    report('PostgreSQL', false, e.code || e.message);
    report('Migrações essenciais', false, 'não verificadas porque o banco está indisponível');
  }
  const failed = results.filter(x => !x.ok);
  console.log(`\nResultado: ${results.length - failed.length}/${results.length} verificações aprovadas.`);
  if (failed.length) process.exitCode = 1;
})();
