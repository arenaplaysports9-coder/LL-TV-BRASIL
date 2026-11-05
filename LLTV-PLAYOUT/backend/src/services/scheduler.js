function getPool() { return require('../db/pool'); }
function getPlayoutEngine() { return require('./playout-engine'); }

const POLL_MS = Math.max(1000, Number(process.env.SCHEDULER_POLL_MS || 10000));
let timer = null;
let running = false;

function addCalendarInterval(dateValue, recurrence) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) throw new Error('Data de agendamento inválida.');
  if (recurrence === 'once') return null;
  if (recurrence === 'daily') date.setUTCDate(date.getUTCDate() + 1);
  else if (recurrence === 'weekly') date.setUTCDate(date.getUTCDate() + 7);
  else if (recurrence === 'monthly') {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
  } else throw new Error('Recorrência não suportada.');
  return date;
}

function nextFutureRun(dateValue, recurrence, nowValue = new Date()) {
  let next = addCalendarInterval(dateValue, recurrence);
  if (!next) return null;
  const now = new Date(nowValue).getTime();
  let guard = 0;
  while (next.getTime() <= now && guard < 1200) {
    next = addCalendarInterval(next, recurrence);
    guard += 1;
  }
  if (guard >= 1200) throw new Error('Recorrência excede o limite de recuperação de datas vencidas.');
  return next;
}

async function claimDueSchedule() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const due = await client.query(`SELECT id,playlist_id,starts_at,recurrence,COALESCE(next_run_at,starts_at) AS due_at
      FROM schedule_entries WHERE enabled=true AND COALESCE(next_run_at,starts_at)<=NOW()
      ORDER BY COALESCE(next_run_at,starts_at) LIMIT 1 FOR UPDATE SKIP LOCKED`);
    if (!due.rowCount) { await client.query('COMMIT'); return null; }
    const row = due.rows[0];
    const next = nextFutureRun(row.due_at, row.recurrence, new Date());
    if (next) {
      await client.query(`UPDATE schedule_entries SET last_run_at=NOW(),next_run_at=$2,last_status='running',last_error=NULL,updated_at=NOW() WHERE id=$1`, [row.id, next]);
    } else {
      await client.query(`UPDATE schedule_entries SET enabled=false,last_run_at=NOW(),next_run_at=NULL,last_status='running',last_error=NULL,updated_at=NOW() WHERE id=$1`, [row.id]);
    }
    await client.query('COMMIT');
    return row;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

async function executeSchedule(schedule) {
  const pool = getPool();
  const playoutEngine = getPlayoutEngine();
  try {
    const data = await pool.query(`SELECT p.id AS playlist_id,p.name AS playlist_name,c.id AS channel_id,c.resolution
      FROM playlists p JOIN channels c ON c.id=p.channel_id WHERE p.id=$1 AND c.enabled=true`, [schedule.playlist_id]);
    if (!data.rowCount) throw new Error('Playlist ou canal não encontrado/ativado.');
    const target = data.rows[0];
    const items = await pool.query(`SELECT ma.id,ma.title,ma.media_type,ma.duration_seconds,ma.file_path,pi.position
      FROM playlist_items pi JOIN media_assets ma ON ma.id=pi.media_asset_id
      WHERE pi.playlist_id=$1 ORDER BY pi.position`, [schedule.playlist_id]);
    if (!items.rowCount) throw new Error('A playlist agendada está vazia.');
    playoutEngine.load(target.channel_id, items.rows, target.resolution || 'HD');
    const started = playoutEngine.command(target.channel_id, 'play');
    await pool.query(`UPDATE schedule_entries SET last_status='running',last_error=NULL,updated_at=NOW() WHERE id=$1`, [schedule.id]);
    await pool.query(`INSERT INTO operation_logs(tenant_id,level,event,details)
      SELECT c.tenant_id,'info','schedule_playout_started',$2::jsonb FROM channels c WHERE c.id=$1`,
      [target.channel_id, JSON.stringify({ scheduleId:schedule.id, playlistId:target.playlist_id, channelId:target.channel_id, outputUrl:started.outputUrl })]);
    return { scheduleId:schedule.id, status:'started', channelId:target.channel_id, outputUrl:started.outputUrl };
  } catch (error) {
    await pool.query(`UPDATE schedule_entries SET last_status='failed',last_error=$2,updated_at=NOW() WHERE id=$1`, [schedule.id, String(error.message).slice(0,2000)]).catch(() => {});
    await pool.query(`INSERT INTO operation_logs(tenant_id,level,event,details)
      SELECT c.tenant_id,'error','schedule_playout_failed',$2::jsonb FROM playlists p JOIN channels c ON c.id=p.channel_id WHERE p.id=$1`,
      [schedule.playlist_id, JSON.stringify({ scheduleId:schedule.id, error:error.message })]).catch(() => {});
    return { scheduleId:schedule.id, status:'failed', error:error.message };
  }
}

async function runDueSchedules(limit = 10) {
  if (running) return { skipped:true, processed:[] };
  running = true;
  const processed = [];
  try {
    for (let i=0; i<limit; i++) {
      const schedule = await claimDueSchedule();
      if (!schedule) break;
      processed.push(await executeSchedule(schedule));
    }
    return { skipped:false, processed };
  } finally { running = false; }
}

function start() {
  if (timer) return;
  timer = setInterval(() => runDueSchedules().catch(error => console.error('[scheduler]', error.message)), POLL_MS);
  timer.unref?.();
  runDueSchedules().catch(error => console.error('[scheduler-startup]', error.message));
  console.log(`[scheduler] Dispatcher ativo; intervalo ${POLL_MS}ms.`);
}
function stop() { if (timer) clearInterval(timer); timer = null; }
module.exports = { addCalendarInterval, nextFutureRun, runDueSchedules, start, stop };
