const test = require('node:test');
const assert = require('node:assert/strict');
const { startTranscode } = require('../src/services/ffmpeg');

test('rejects unknown resolution before spawning FFmpeg', () => {
  assert.throws(() => startTranscode({
    inputPath: './storage/media/nonexistent.mp4',
    outputUrl: 'rtmp://example.com/live/key',
    resolution: '8K'
  }), /Resolução não permitida/);
});

test('rejects non-RTMP destination', () => {
  assert.throws(() => startTranscode({
    inputPath: './storage/media/nonexistent.mp4',
    outputUrl: 'https://example.com/live',
    resolution: 'HD'
  }), /Somente destinos RTMP/);
});

test('builds a conservative RTMPS publication command', () => {
  const { buildRtmpArgs } = require('../src/services/ffmpeg');
  const fs = require('node:fs');
  const path = require('node:path');
  const config = require('../src/config');
  fs.mkdirSync(config.mediaRoot, { recursive: true });
  const sample = path.join(config.mediaRoot, 'rtmp-command-test.mp4');
  fs.writeFileSync(sample, 'test');
  try {
    const args = buildRtmpArgs({ inputPath: sample, outputUrl: 'rtmps://example.test/live/secret-key', resolution: 'HD', fps: 25, bitrateKbps: 2500 });
    assert.ok(args.includes('-re'));
    assert.ok(args.includes('libx264'));
    assert.ok(args.includes('ultrafast'));
    assert.ok(args.includes('flv'));
    assert.equal(args.at(-1), 'rtmps://example.test/live/secret-key');
  } finally { fs.unlinkSync(sample); }
});

test('rejects RTMP URLs with embedded credentials, fragments or missing stream path', () => {
  const { buildRtmpArgs } = require('../src/services/ffmpeg');
  const fs = require('node:fs');
  const path = require('node:path');
  const config = require('../src/config');
  fs.mkdirSync(config.mediaRoot, { recursive: true });
  const sample = path.join(config.mediaRoot, 'rtmp-url-test.mp4');
  fs.writeFileSync(sample, 'test');
  try {
    assert.throws(() => buildRtmpArgs({ inputPath: sample, outputUrl: 'rtmp://user:pass@example.test/live/key' }), /usuário, senha/);
    assert.throws(() => buildRtmpArgs({ inputPath: sample, outputUrl: 'rtmp://example.test/live/key#frag' }), /fragmento/);
    assert.throws(() => buildRtmpArgs({ inputPath: sample, outputUrl: 'rtmp://example.test/' }), /endereço de publicação completo/);
  } finally { fs.unlinkSync(sample); }
});

test('continuous RTMP playlist rejects empty lists and non-video media before spawning', () => {
  const { startPlaylistTranscode } = require('../src/services/ffmpeg');
  assert.throws(() => startPlaylistTranscode({ items: [], outputUrl: 'rtmp://example.test/live/key' }), /pelo menos um vídeo/);
  assert.throws(() => startPlaylistTranscode({ items: [{ file_path: './x.mp4', media_type: 'audio' }], outputUrl: 'rtmp://example.test/live/key' }), /somente itens de vídeo/);
});
