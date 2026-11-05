const pool=require('../db/pool');
const crypto=require('./secret-crypto');
const modules=require('./broadcast-modules');
async function recoverInputs(){
  const r=await pool.query("SELECT channel_id,tenant_id,input_ciphertext,mode,resolution FROM srt_ingest_sessions WHERE status='running'");let recovered=0;
  for(const row of r.rows){try{const inputUrl=crypto.decrypt(row.input_ciphertext);modules.startSrtIngest({channelId:row.channel_id,inputUrl,mode:row.mode,resolution:row.resolution,onUpdate:(state)=>pool.query('UPDATE srt_ingest_sessions SET status=$3,last_error=$4,updated_at=NOW() WHERE channel_id=$1 AND tenant_id=$2',[row.channel_id,row.tenant_id,state.status,state.error||null]).catch(e=>console.error('[srt-recovery-persist]',e.message))});recovered++;}
    catch(e){await pool.query("UPDATE srt_ingest_sessions SET status='failed',last_error=$2,updated_at=NOW() WHERE channel_id=$1",[row.channel_id,e.message]);console.error(`[srt-recovery] Canal ${row.channel_id}: ${e.message}`);}}
  console.log(`[srt-recovery] ${recovered} entrada(s) recuperada(s) de ${r.rowCount}.`);return {recovered,found:r.rowCount};
}
module.exports={recoverInputs};
