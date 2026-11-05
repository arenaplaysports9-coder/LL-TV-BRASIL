const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = require('../src/services/playout-engine');
const config = require('../src/config');

test('engine validates channel IDs and requires a non-empty queue', () => {
  assert.throws(() => engine.load('../escape', [{ file_path: 'x', media_type: 'video' }]), /Identificador/);
  assert.throws(() => engine.load(`test-${Date.now()}`, []), /fila está vazia/);
});

test('engine refuses media outside MEDIA_ROOT and audio-only assets', () => {
  const id = `test-${Date.now()}`;
  engine.load(id, [{ title: 'outside', file_path: path.resolve('../outside.mp4'), media_type: 'video' }]);
  assert.throws(() => engine.command(id, 'play'), /fora de MEDIA_ROOT/);
  const audioId = `${id}-audio`;
  engine.load(audioId, [{ title: 'audio', file_path: path.join(config.mediaRoot, 'fake.mp3'), media_type: 'audio' }]);
  assert.throws(() => engine.command(audioId, 'play'), /aceita arquivos de vídeo/);
});

test('FFmpeg creates a real HLS playlist from a generated sample when available', async t => {
  const { spawnSync } = require('node:child_process');
  const probe = spawnSync(config.ffmpegPath, ['-version'], { windowsHide: true });
  if (probe.error || probe.status !== 0) return t.skip('FFmpeg não está instalado neste ambiente.');
  fs.mkdirSync(config.mediaRoot, { recursive: true });
  const sample = path.join(config.mediaRoot, `lltv-test-${Date.now()}.mp4`);
  const gen = spawnSync(config.ffmpegPath, ['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc=size=320x240:rate=10','-f','lavfi','-i','sine=frequency=1000:sample_rate=44100','-t','3','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',sample], { windowsHide: true, timeout: 30000 });
  if (gen.status !== 0) return t.skip('FFmpeg existe, mas não conseguiu gerar o arquivo de teste com os codecs disponíveis.');
  const id = `integration-${Date.now()}`;
  try {
    engine.load(id, [{ title:'Teste de vídeo', file_path:sample, media_type:'video' }], 'SD');
    const state = engine.command(id, 'play');
    assert.ok(['starting','playing'].includes(state.status));
    assert.match(state.outputUrl, /^\/playout\/public\/.+\/[a-f0-9]{48}\/index\.m3u8$/);
    const channelDir = path.join(engine.outputRoot, id);
    const findPlaylist = () => {
      if (!fs.existsSync(channelDir)) return null;
      for (const runDir of fs.readdirSync(channelDir)) { const candidate=path.join(channelDir,runDir,'index.m3u8'); if(fs.existsSync(candidate)) return candidate; }
      return null;
    };
    const deadline = Date.now() + 15000;
    let playlist = findPlaylist();
    while (Date.now() < deadline && !playlist) { await new Promise(r => setTimeout(r, 250)); playlist=findPlaylist(); }
    assert.ok(fs.existsSync(playlist), 'FFmpeg deve criar index.m3u8');
    const contents = fs.readFileSync(playlist, 'utf8');
    assert.match(contents, /#EXTM3U/);
    engine.command(id, 'stop');
    await new Promise(r => setTimeout(r, 300));
    try { fs.rmSync(path.join(engine.outputRoot, id), { recursive: true, force: true }); } catch {}
  } finally {
    try { fs.unlinkSync(sample); } catch {}
  }
});
