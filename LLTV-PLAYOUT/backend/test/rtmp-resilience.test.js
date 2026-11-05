const test = require('node:test');
const assert = require('node:assert/strict');
const cryptoStore = require('../src/services/secret-crypto');
const { buildRtmpArgs } = require('../src/services/ffmpeg');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../src/config');

test('RTMP destination encryption round-trips and does not store plaintext', () => {
  const previous = process.env.RTMP_SECRET_ENCRYPTION_KEY;
  process.env.RTMP_SECRET_ENCRYPTION_KEY = 'ab'.repeat(32);
  try {
    const secret = 'rtmps://live.example.test/app/very-secret-stream-key';
    const ciphertext = cryptoStore.encrypt(secret);
    assert.notEqual(ciphertext, secret);
    assert.equal(cryptoStore.decrypt(ciphertext), secret);
    assert.throws(() => cryptoStore.decrypt(ciphertext.slice(0, -2) + '00'));
  } finally {
    if (previous === undefined) delete process.env.RTMP_SECRET_ENCRYPTION_KEY;
    else process.env.RTMP_SECRET_ENCRYPTION_KEY = previous;
  }
});

test('RTMP persistence refuses a missing or malformed encryption key', () => {
  const previous = process.env.RTMP_SECRET_ENCRYPTION_KEY;
  delete process.env.RTMP_SECRET_ENCRYPTION_KEY;
  try { assert.throws(() => cryptoStore.encrypt('rtmps://example.test/live/key'), /RTMP_SECRET_ENCRYPTION_KEY/); }
  finally { if (previous !== undefined) process.env.RTMP_SECRET_ENCRYPTION_KEY = previous; }
});

test('RTMP FFmpeg command emits progress telemetry for watchdog monitoring', () => {
  fs.mkdirSync(config.mediaRoot, { recursive:true });
  const sample=path.join(config.mediaRoot,`rtmp-progress-${Date.now()}.mp4`);
  fs.writeFileSync(sample,'test');
  try {
    const args=buildRtmpArgs({inputPath:sample,outputUrl:'rtmps://example.test/live/key'});
    assert.ok(args.includes('-progress'));
    assert.ok(args.includes('pipe:2'));
    assert.ok(args.includes('-stats_period'));
  } finally { fs.unlinkSync(sample); }
});
