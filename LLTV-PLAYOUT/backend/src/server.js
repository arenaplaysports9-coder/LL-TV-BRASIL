const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const api = require('./routes/api');
const extended = require('./routes/extended');
const broadcast = require('./routes/broadcast');
const rtmpRecovery = require('./services/rtmp-recovery');
const ffmpeg = require('./services/ffmpeg');
const pool = require('./db/pool');
const scheduler = require('./services/scheduler');
const playoutRecovery = require('./services/playout-recovery');
const srtRecovery = require('./services/srt-recovery');
const broadcastModules = require('./services/broadcast-modules');

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.corsOrigin.split(',').map(s => s.trim()) }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));
app.get('/', (_req, res) => res.json({ name: 'LLTV PLAYOUT API', docs: '/api/health' }));
app.use('/api', api);
app.use('/api', extended);
app.use('/api', broadcast);
app.use((err, _req, res, _next) => {
  console.error('[api error]', err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

const server = app.listen(config.port, config.host, () => {
  console.log(`LLTV PLAYOUT API listening at http://${config.host}:${config.port}`);
  rtmpRecovery.recoverInterruptedStreams().catch(err=>console.error('[rtmp-recovery]',err.message));
  playoutRecovery.recoverChannels().catch(err=>console.error('[playout-recovery]',err.message));
  srtRecovery.recoverInputs().catch(err=>console.error('[srt-recovery]',err.message));
  scheduler.start();
});
function shutdown() {
  console.log('Encerrando API...');
  // Stop child encoders cleanly but leave persisted jobs recoverable at next boot.
  scheduler.stop();
  ffmpeg.suspendAll();
  require('./services/playout-engine').suspendAll();
  broadcastModules.suspendSrtAll();
  pool.query("UPDATE rtmp_stream_jobs SET status='reconnecting',updated_at=NOW() WHERE status IN ('starting','running','reconnecting')").catch(()=>{});
  server.close(async () => { try { await pool.end(); } catch {} process.exit(0); });
  setTimeout(() => process.exit(1), 15000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
module.exports = app;
