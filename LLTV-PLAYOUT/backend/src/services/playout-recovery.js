const pool=require('../db/pool');
const engine=require('./playout-engine');
async function recoverChannels(){
  const result=await pool.query("SELECT channel_id,tenant_id,queue,resolution FROM channel_playout_sessions WHERE status='playing' ORDER BY updated_at");
  let recovered=0;
  for(const row of result.rows){
    try{const queue=Array.isArray(row.queue)?row.queue:JSON.parse(row.queue);if(!queue.length)throw new Error('Fila persistida vazia.');engine.setStateListener(row.channel_id,state=>{const status=state.status==='playing'||state.status==='starting'?'playing':state.status==='failed'?'failed':'stopped';pool.query('UPDATE channel_playout_sessions SET status=$3,last_error=$4,updated_at=NOW() WHERE channel_id=$1 AND tenant_id=$2',[row.channel_id,row.tenant_id,status,state.error||null]).catch(()=>{});});engine.load(row.channel_id,queue,row.resolution||'SD');engine.command(row.channel_id,'play');recovered++;}
    catch(e){await pool.query("UPDATE channel_playout_sessions SET status='failed',last_error=$2,updated_at=NOW() WHERE channel_id=$1",[row.channel_id,e.message]);console.error(`[playout-recovery] Canal ${row.channel_id}: ${e.message}`);}
  }
  console.log(`[playout-recovery] ${recovered} canal(is) recuperado(s) de ${result.rowCount}.`);return {recovered,found:result.rowCount};
}
module.exports={recoverChannels};
