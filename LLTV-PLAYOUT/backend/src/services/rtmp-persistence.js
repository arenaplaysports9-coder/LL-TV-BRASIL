const pool = require('../db/pool');
const { encrypt, decrypt } = require('./secret-crypto');

async function saveJob({ job, tenantId, playlistId, outputUrl, failoverUrl, options }) {
  const destination = encrypt(outputUrl);
  const failover = encrypt(failoverUrl);
  await pool.query(`INSERT INTO rtmp_stream_jobs
    (id,tenant_id,playlist_id,status,destination_ciphertext,failover_ciphertext,options,source_title,retry_count,max_retries,using_failover,last_heartbeat,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,NOW(),NOW())
    ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,destination_ciphertext=EXCLUDED.destination_ciphertext,
    failover_ciphertext=EXCLUDED.failover_ciphertext,options=EXCLUDED.options,source_title=EXCLUDED.source_title,
    retry_count=EXCLUDED.retry_count,max_retries=EXCLUDED.max_retries,using_failover=EXCLUDED.using_failover,last_heartbeat=NOW(),updated_at=NOW()`,
  [job.id,tenantId,playlistId,job.status,destination,failover,JSON.stringify(options),job.sourceTitle,job.retryCount,job.maxRetries,!!job.usingFailover]);
}
async function updateJob(job, tenantId) {
  await pool.query(`UPDATE rtmp_stream_jobs SET status=$2,retry_count=$3,max_retries=$4,last_heartbeat=CASE WHEN $5 THEN NOW() ELSE last_heartbeat END,
    error=$6,using_failover=$7,updated_at=NOW(),stopped_at=CASE WHEN $2 IN ('stopped','failed') THEN NOW() ELSE NULL END WHERE id=$1 AND tenant_id=$8`,
  [job.id,job.status,job.retryCount||0,job.maxRetries||0,job.progressFresh===true,job.error||null,!!job.usingFailover,tenantId]);
}
async function listRecoverable() {
  const r = await pool.query("SELECT * FROM rtmp_stream_jobs WHERE status IN ('starting','running','reconnecting') ORDER BY updated_at");
  return r.rows.map(row => ({ ...row, outputUrl: decrypt(row.destination_ciphertext), failoverUrl: decrypt(row.failover_ciphertext) }));
}
async function markInterrupted() {
  await pool.query("UPDATE rtmp_stream_jobs SET status='failed',error='Servidor reiniciado; aguardando tentativa de recuperação.',updated_at=NOW() WHERE status IN ('starting','running','reconnecting')");
}
async function recordEvent(tenantId, event, details) {
  await pool.query('INSERT INTO operation_logs(tenant_id,level,event,details) VALUES($1,$2,$3,$4::jsonb)', [tenantId,'warning',event,JSON.stringify(details||{})]);
  const hook = process.env.PLAYOUT_ALERT_WEBHOOK;
  if (hook) {
    try { await fetch(hook, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({source:'LLTV PLAYOUT',event,details,createdAt:new Date().toISOString()}) , signal:AbortSignal.timeout(5000)}); }
    catch (e) { console.error('[alert-webhook]',e.message); }
  }
}
module.exports = { saveJob, updateJob, listRecoverable, markInterrupted, recordEvent, encrypt, decrypt };
