const path = require('node:path');
try { require('dotenv').config({ path: path.resolve(process.cwd(), '.env') }); } catch { /* dotenv is loaded after npm install; environment variables may be supplied by the OS */ }

module.exports = {
  port: Number(process.env.PORT || 4000),
  host: process.env.HOST || '127.0.0.1',
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === 'true',
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  mediaRoot: path.resolve(process.env.MEDIA_ROOT || './storage/media'),
  playoutRoot: path.resolve(process.env.PLAYOUT_OUTPUT_ROOT || './storage/playout'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173'
};
