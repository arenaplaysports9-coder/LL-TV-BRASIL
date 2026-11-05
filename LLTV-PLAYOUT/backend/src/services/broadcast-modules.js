const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('../config');

const preview = new Map();
const graphics = new Map();
const ingest = new Map();
const obs = new Map();

function safeId(value) { if (!/^[a-zA-Z0-9_-]{1,80}$/.test(String(value))) throw new Error('Identificador inválido.'); return String(value); }
function redactSrt(value){return String(value||'').replace(/(passphrase=)[^&\s]+/gi,'$1[REDACTED]').replace(/(srt:\/\/)[^@\s]+@/gi,'$1[REDACTED]@');}
function setPreview(channelId, media) { const id=safeId(channelId); preview.set(id,{media,token:crypto.randomBytes(24).toString('hex'),updatedAt:new Date().toISOString()}); return getPreview(id); }
function getPreview(channelId) { const id=safeId(channelId); const s=preview.get(id); return {channelId:id,preview:s?{id:s.media.id,title:s.media.title,media_type:s.media.media_type,duration_seconds:s.media.duration_seconds,url:`/playout/preview/public/${encodeURIComponent(id)}/${s.token}`,updatedAt:s.updatedAt}:null}; }
function getPreviewMedia(channelId){const s=preview.get(safeId(channelId));return s?.media||null;}
function getPreviewFile(channelId,token){const s=preview.get(safeId(channelId));if(!s||String(token).length!==s.token.length||!crypto.timingSafeEqual(Buffer.from(String(token)),Buffer.from(s.token)))return null;const file=path.resolve(s.media.file_path||'');return fs.existsSync(file)&&fs.statSync(file).isFile()?file:null;}
function takeProgram(channelId, media) { const id=safeId(channelId); return {channelId:id,program:media,updatedAt:new Date().toISOString()}; }
function setGraphics(channelId, payload) {
  const id=safeId(channelId);
  const data={enabled:payload.enabled!==false,logoText:String(payload.logoText||'').slice(0,80),lowerThird:String(payload.lowerThird||'').slice(0,180),scoreboard:{home:String(payload.scoreboard?.home||'CASA').slice(0,40),away:String(payload.scoreboard?.away||'VISITANTE').slice(0,40),homeScore:Math.max(0,Math.min(99,Number(payload.scoreboard?.homeScore)||0)),awayScore:Math.max(0,Math.min(99,Number(payload.scoreboard?.awayScore)||0)),clock:String(payload.scoreboard?.clock||'').slice(0,12),period:String(payload.scoreboard?.period||'').slice(0,30)},updatedAt:new Date().toISOString()};
  graphics.set(id,data); return data;
}
function getGraphics(channelId) { return graphics.get(safeId(channelId))||{enabled:false,lowerThird:'',logoText:'',scoreboard:null}; }
function startSrtIngest({channelId,inputUrl,mode='listener',resolution='SD',onUpdate=null}) {
  const id=safeId(channelId); let parsed; try { parsed=new URL(inputUrl); } catch { throw new Error('URL SRT inválida.'); }
  if(parsed.protocol!=='srt:' || !['listener','caller'].includes(mode)) throw new Error('A entrada aceita somente SRT em modo listener ou caller.');
  if(!['SD','HD'].includes(resolution)) throw new Error('Entrada SRT limitada a SD/HD para preservar recursos.');
  if(ingest.has(id) && ['starting','running'].includes(ingest.get(id).status)) throw new Error('Já existe uma entrada SRT ativa neste canal.');
  const query=new URLSearchParams(parsed.search); if(!query.has('mode'))query.set('mode',mode); const effectiveUrl=`${parsed.protocol}//${parsed.host}${parsed.pathname}?${query.toString()}`;
  const dir=path.join(path.resolve(config.playoutRoot),'srt-ingest',id); fs.mkdirSync(dir,{recursive:true});
  const out=path.join(dir,'index.m3u8');
  const args=['-hide_banner','-loglevel','warning','-nostdin','-i',effectiveUrl,'-map','0:v:0','-map','0:a:0?','-vf',resolution==='SD'?'scale=720:480:force_original_aspect_ratio=decrease,pad=720:480:(ow-iw)/2:(oh-ih)/2':'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2','-c:v','libx264','-preset','ultrafast','-tune','zerolatency','-b:v',resolution==='SD'?'1200k':'1800k','-c:a','aac','-b:a','96k','-f','hls','-hls_time','2','-hls_list_size','6','-hls_flags','delete_segments+append_list','-hls_segment_filename',path.join(dir,'segment-%06d.ts'),out];
  const child=spawn(config.ffmpegPath,args,{shell:false,windowsHide:true,stdio:['ignore','ignore','pipe']});
  const state={channelId:id,child,onUpdate,status:'starting',pid:child.pid||null,startedAt:new Date().toISOString(),outputPath:out,token:crypto.randomBytes(24).toString('hex'),error:null,stderr:''}; ingest.set(id,state);
  const notify=()=>{try{state.onUpdate?.(publicIngest(state));}catch(e){console.error('[srt-ingest-update]',e.message);}}; child.stderr.on('data',d=>{state.stderr=(state.stderr+d.toString()).slice(-2000);}); child.on('spawn',()=>{state.status='running';notify();}); child.on('error',e=>{state.status='failed';state.error=e.message;notify();}); child.on('close',(code)=>{if(state.suspendOnExit){state.status='stopped';return;}if(state.status!=='stopped'){state.status=code===0?'stopped':'failed';if(code!==0)state.error=redactSrt(`FFmpeg SRT encerrou (${code}). ${state.stderr.slice(-500)}`);notify();}});
  state.stop=()=>{state.status='stopped';if(child.exitCode===null)child.kill('SIGTERM');}; return publicIngest(state);
}
function publicIngest(s){return {channelId:s.channelId,status:s.status,pid:s.pid,startedAt:s.startedAt,outputPath:s.outputPath,publicUrl:`/webtv/srt/${encodeURIComponent(s.channelId)}/${s.token}/index.m3u8`,error:s.error};}
function stopSrtIngest(channelId){const s=ingest.get(safeId(channelId));if(!s)throw new Error('Entrada SRT não encontrada.');s.stop?.();return publicIngest(s);}
function getSrtIngest(channelId){const s=ingest.get(safeId(channelId));return s?publicIngest(s):{channelId,status:'stopped'};}
function suspendSrtAll(){for(const state of ingest.values()){if(state.status==='running'){state.suspendOnExit=true;const child=state.child;if(child&&child.exitCode===null)child.kill('SIGTERM');}}}
function getSrtFile(channelId,token,file){const s=ingest.get(safeId(channelId));if(!s||!s.token||String(token).length!==s.token.length||!crypto.timingSafeEqual(Buffer.from(String(token)),Buffer.from(s.token))||(!['index.m3u8'].includes(file)&&!/^segment-\d+\.ts$/.test(file)))return null;const target=path.join(path.dirname(s.outputPath),file);return fs.existsSync(target)?target:null;}

// OBS WebSocket v5 challenge authentication; credentials are never persisted or logged.
function obsConnect({tenantId,url,password,requestType='GetVersion'}) { return new Promise((resolve,reject)=>{
  let target; try { target=new URL(url); } catch { return reject(new Error('Endereço do OBS WebSocket inválido.')); }
  if(!['ws:','wss:'].includes(target.protocol)) return reject(new Error('OBS WebSocket exige ws:// ou wss://.'));
  const WebSocket=require('ws'); const ws=new WebSocket(target.toString(),{handshakeTimeout:5000}); let settled=false; let requestId=0;
  const timeout=setTimeout(()=>{if(!settled){settled=true;ws.terminate();reject(new Error('Tempo esgotado ao conectar ao OBS.'));}},8000);
  const finish=(err,value)=>{if(settled)return;settled=true;clearTimeout(timeout);try{ws.close();}catch{};err?reject(err):resolve(value);};
  ws.on('error',e=>finish(new Error(`Falha OBS WebSocket: ${e.message}`)));
  ws.on('message',raw=>{let msg;try{msg=JSON.parse(raw.toString());}catch{return;}
    if(msg.op===0){const d=msg.d||{};let authentication;
      if(d.authentication){if(!password)return finish(new Error('OBS exige senha WebSocket.'));const secret=crypto.createHash('sha256').update(password+d.authentication.salt).digest('base64');authentication=crypto.createHash('sha256').update(secret+d.authentication.challenge).digest('base64');}
      ws.send(JSON.stringify({op:1,d:{rpcVersion:1,authentication}}));
    } else if(msg.op===2){const id=String(++requestId);ws.send(JSON.stringify({op:6,d:{requestType,requestId:id}}));}
    else if(msg.op===7){const d=msg.d||{};if(d.requestStatus?.result===false)finish(new Error(d.requestStatus.comment||'OBS recusou a solicitação.'));else finish(null,{connected:true,requestType:d.requestType,responseData:d.responseData||{},obsVersion:d.responseData?.obsVersion||null,tenantId});}
  });
 }); }
module.exports={setPreview,getPreview,getPreviewMedia,getPreviewFile,takeProgram,setGraphics,getGraphics,startSrtIngest,stopSrtIngest,getSrtIngest,getSrtFile,suspendSrtAll,obsConnect};
