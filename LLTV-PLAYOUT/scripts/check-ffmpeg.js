const { spawnSync } = require('node:child_process');
const bin = process.env.FFMPEG_PATH || 'ffmpeg';
const result = spawnSync(bin, ['-version'], { encoding: 'utf8', windowsHide: true });
if (result.error) {
  console.error(`FFmpeg não encontrado (${bin}). Instale o FFmpeg ou defina FFMPEG_PATH.`);
  process.exit(1);
}
console.log((result.stdout || '').split('\n')[0]);
