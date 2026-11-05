const pool = require('../db/pool');
const ffmpeg = require('./ffmpeg');
const store = require('./rtmp-persistence');
const commercialInserter = require('./commercial-inserter');

async function recoverInterruptedStreams() {
  if (process.env.RTMP_RECOVER_ON_START !== 'true') return { enabled:false, recovered:0 };
  let rows;
  try { rows = await store.listRecoverable(); }
  catch (error) { console.error('[rtmp-recovery] Não foi possível ler jobs persistidos:', error.message); return { enabled:true, recovered:0, error:error.message }; }
  let recovered = 0;
  for (const row of rows) {
    try {
      if (!row.outputUrl) throw new Error('Destino RTMP não pôde ser descriptografado.');
      const items = await pool.query(`SELECT ma.id,ma.title,ma.file_path,ma.media_type FROM playlist_items pi JOIN media_assets ma ON ma.id=pi.media_asset_id WHERE pi.playlist_id=$1 AND ma.tenant_id=$2 ORDER BY pi.position`,[row.playlist_id,row.tenant_id]);
      if (!items.rowCount) throw new Error('Playlist vazia ou mídias indisponíveis após reinício.');
      const ads = await pool.query(`SELECT co.id AS commercial_id,co.insertion_interval_minutes,co.advertiser,ma.id AS media_asset_id,ma.title,ma.file_path,ma.media_type,ma.duration_seconds,true AS enabled FROM commercials co JOIN media_assets ma ON ma.id=co.media_asset_id WHERE co.tenant_id=$1 AND co.enabled=true AND ma.media_type='video' ORDER BY co.insertion_interval_minutes`,[row.tenant_id]);
      const recoveredItems = commercialInserter.composeWithCommercials(items.rows,ads.rows);
      const options = row.options || {};
      const usingFailover=!!row.using_failover;
      const activeDestination=usingFailover && row.failoverUrl ? row.failoverUrl : row.outputUrl;
      const alternateDestination=usingFailover ? row.outputUrl : row.failoverUrl;
      const job = ffmpeg.startPlaylistTranscode({ ...options, items:recoveredItems, outputUrl:activeDestination, failoverUrl:alternateDestination, usingFailover, ownerId:row.tenant_id, sourceTitle:row.source_title || 'Playlist recuperada', jobId:row.id,
        onUpdate:(updated,heartbeat)=>{
          store.updateJob({...updated,progressFresh:heartbeat},row.tenant_id).catch(e=>console.error('[rtmp-recovery-persist]',e.message));
          if(['reconnecting','failed'].includes(updated.status)) store.recordEvent(row.tenant_id,'rtmp_stream_recovery_alert',{jobId:updated.id,status:updated.status,error:updated.error}).catch(()=>{});
        }});
      await store.saveJob({job,tenantId:row.tenant_id,playlistId:row.playlist_id,outputUrl:row.outputUrl,failoverUrl:row.failoverUrl,options});
      recovered++;
    } catch (error) {
      await pool.query("UPDATE rtmp_stream_jobs SET status='failed',error=$2,stopped_at=NOW(),updated_at=NOW() WHERE id=$1",[row.id,error.message]).catch(()=>{});
      await store.recordEvent(row.tenant_id,'rtmp_stream_recovery_failed',{jobId:row.id,error:error.message}).catch(()=>{});
      console.error(`[rtmp-recovery] Job ${row.id}:`,error.message);
    }
  }
  console.log(`[rtmp-recovery] ${recovered} transmissão(ões) recuperada(s) de ${rows.length} pendente(s).`);
  return { enabled:true,recovered,found:rows.length };
}
module.exports = { recoverInterruptedStreams };
