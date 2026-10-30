(() => {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  let token = params.get('token') || '';
  let state = {};
  let optimistic = false;
  const fields = ['homeName','awayName','homeShort','awayShort','date','kickoff','competition','round','stadium','city','brand','tagline'];
  const bools = ['showDate','showCompetition','showCards'];
  const jsonKeys=['statistics','sponsors','ads','events'];
  const manualFields={manualLineupsHome:'manualLineupsHome',manualLineupsAway:'manualLineupsAway',manualBench:'manualBench',manualSubstitutionsHome:'manualSubstitutionsHome',manualSubstitutionsAway:'manualSubstitutionsAway',manualOfficials:'manualOfficials',manualCrew:'manualCrew'};
  const moduleKeys=['lineupsHome','lineupsAway','bench','substitutionsHome','substitutionsAway','officials','crew'];
  function headers(){return {'Content-Type':'application/json','X-LLTV-Token':token};}
  async function refreshToken(){
    const res = await fetch('/api/token', {cache:'no-store'});
    const data = await res.json().catch(()=>({}));
    if(!res.ok || !data.token) throw new Error(data.error || 'Não foi possível obter o token do placar. Abra o painel pelo endereço local do computador ou use o link seguro exibido pelo servidor.');
    token = data.token;
    history.replaceState(null,'',location.pathname+'?token='+encodeURIComponent(token));
  }
  async function api(path, method='GET', body, retried=false) {
    const res = await fetch(path, {method, headers:headers(), body:body?JSON.stringify(body):undefined, cache:'no-store'});
    const data = await res.json().catch(()=>({}));
    if(res.status===401 && path!='/api/token' && !retried){
      await refreshToken();
      return api(path, method, body, true);
    }
    if(!res.ok) throw new Error(data.error || 'Falha na comunicação');
    return data;
  }
  function fmt(sec){sec=Math.max(0,Number(sec)||0);return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');}
  function showNotice(msg){const n=$('notice');n.textContent=msg;n.classList.add('show');clearTimeout(showNotice.t);showNotice.t=setTimeout(()=>n.classList.remove('show'),3500);}
  function setVal(id,val){const el=$(id);if(el && document.activeElement!==el){if(el.type==='checkbox')el.checked=!!val;else if(val!==undefined)el.value=val??'';}}
  function render(s){
    state=s;
    $('connection').textContent='● Conectado';$('connection').style.color='#85f0bb';
    const overlayOn=s.overlayEnabled!==false;const overlayBtn=$('toggle-overlay');if(overlayBtn){overlayBtn.textContent=overlayOn?'Desativar overlay':'Ativar overlay';overlayBtn.classList.toggle('primary',overlayOn);overlayBtn.classList.toggle('danger',!overlayOn);overlayBtn.setAttribute('aria-pressed',String(overlayOn));$('overlay-status').textContent=overlayOn?'Overlay ativado e visível no endereço gráfico.':'Overlay desativado: a saída gráfica ficará totalmente oculta.';}
    for(const f of fields)setVal(f,s[f]);
    for(const f of bools)setVal(f,s[f]);
    for(const k of jsonKeys){const el=$('json-'+k);if(el && document.activeElement!==el)el.value=JSON.stringify(s[k]??(k==='sponsors'||k==='events'?[]:{}),null,2);}
    for(const [id,key] of Object.entries(manualFields)){let value=s[key]||'';if(key==='manualLineupsHome'&&!value)value=s.manualLineups||'';if(key==='manualSubstitutionsHome'&&!value)value=s.manualSubstitutions||'';setVal(id,value);}
    document.querySelectorAll('[data-module-toggle]').forEach(btn=>{const key=btn.dataset.moduleToggle;const vis=s.visibility||{};const legacyKey=(key==='lineupsHome'||key==='lineupsAway')?'lineups':key;const on=vis[key]===undefined?!!vis[legacyKey]:!!vis[key];btn.textContent=on?'Ativado — ocultar':'Desativado — mostrar';btn.classList.toggle('primary',on);btn.classList.toggle('danger',!on);btn.setAttribute('aria-pressed',String(on));});
    renderPngControls(s);
    const vis=s.visibility||{};for(const k of ['scoreboard','clock','addedTime','lineups','bench','substitutions','cards','statistics','sponsors','ads','officials','crew','matchInfo'])setVal('vis-'+k,vis[k]??(['scoreboard','clock','addedTime','matchInfo'].includes(k)));
    const art=s.broadcastArt||{};document.querySelectorAll('[data-art-toggle]').forEach(btn=>{const key=btn.dataset.artToggle;const on=!!art[key];const labels={opening:['Desativar abertura','Ativar abertura'],live:['Desativar AO VIVO','Ativar AO VIVO'],halftime:['Desativar intervalo','Ativar intervalo'],fulltime:['Desativar fim de jogo','Ativar fim de jogo']};btn.textContent=on?labels[key][0]:labels[key][1];btn.classList.toggle('primary',on);btn.classList.toggle('danger',!on);btn.setAttribute('aria-pressed',String(on));});setVal('gc-title',s.gc?.title||'');setVal('gc-info',s.gc?.info||'');$('gc-status').textContent=s.gc?.enabled?'GC ativo na transmissão.':'GC desativado.';
    $('control-home-name').textContent=s.homeName;$('control-away-name').textContent=s.awayName;
    $('control-home-score').textContent=s.homeScore;$('control-away-score').textContent=s.awayScore;
    $('cards-home-name').textContent=s.homeName;$('cards-away-name').textContent=s.awayName;
    for(const f of ['homeYellow','awayYellow','homeRed','awayRed'])$(f+'Value').textContent=s[f]||0;
    $('prev-home').textContent=s.homeName;$('prev-away').textContent=s.awayName;
    $('prev-home-short').textContent=s.homeShort;$('prev-away-short').textContent=s.awayShort;
    $('prev-hs').textContent=s.homeScore;$('prev-as').textContent=s.awayScore;
    $('prev-clock').textContent=fmt(s.elapsedSeconds);$('timer-big').textContent=fmt(s.elapsedSeconds);
    $('prev-period').textContent=s.period;$('period-select').value=s.period;
    setVal('added-minutes-input',s.addedMinutes||0);
    const addedOn=!!s.addedTimeEnabled; $('toggle-added').textContent=addedOn?'Ativado — ocultar acréscimo':'Desativado — mostrar acréscimo'; $('toggle-added').classList.toggle('primary',addedOn); $('toggle-added').classList.toggle('danger',!addedOn); $('toggle-added').setAttribute('aria-pressed',String(addedOn)); $('added-status').textContent=addedOn?(Number(s.addedMinutes)>0?`Acréscimo +${s.addedMinutes}' visível no overlay.`:'Acréscimo ativado, mas defina os minutos para exibir.'):'O acréscimo está oculto no overlay.';
    $('prev-brand').textContent=s.brand;
    const dateText=s.date ? new Date(s.date+'T12:00:00').toLocaleDateString('pt-BR') : '';
    $('preview-meta').textContent=[s.showDate?dateText:'',s.competition,s.round,'PARTIDA AO VIVO'].filter(Boolean).join(' · ');
    $('prev-home-logo').src=s.homeLogo||blankLogo();$('prev-away-logo').src=s.awayLogo||blankLogo();
    setVal('homeColor',s.homeColor||'#d92332'); setVal('awayColor',s.awayColor||'#2878d0');
    $('prev-home-logo').style.borderColor=s.homeColor||'#d92332'; $('prev-away-logo').style.borderColor=s.awayColor||'#2878d0';
    $('mini-score').style.setProperty('--home-color',s.homeColor||'#d92332'); $('mini-score').style.setProperty('--away-color',s.awayColor||'#2878d0');
    $('obs-url').textContent=location.origin+'/overlay.html';
  }
  function blankLogo(){return 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="38" fill="#15243a" stroke="#66758a" stroke-width="2"/><text x="40" y="51" text-anchor="middle" font-size="32">⚽</text></svg>');}
  async function update(patch){try{render(await api('/api/state','POST',patch));}catch(e){showNotice(e.message);}}
  async function load(){try{if(!token){const t=await api('/api/token');token=t.token;history.replaceState(null,'',location.pathname+'?token='+encodeURIComponent(token));}render(await api('/api/state'));}catch(e){$('connection').textContent='Erro de conexão';showNotice(e.message);}}
  document.querySelectorAll('[data-score]').forEach(b=>b.addEventListener('click',()=>{const key=b.dataset.score;update({[key]:Math.max(0,Math.min(99,(Number(state[key])||0)+Number(b.dataset.delta)))})}));
  document.querySelectorAll('[data-card]').forEach(b=>b.addEventListener('click',()=>{const key=b.dataset.card;update({[key]:Math.max(0,Math.min(99,(Number(state[key])||0)+Number(b.dataset.delta)))})}));
  $('save-modules').addEventListener('click',()=>{try{const p={};for(const k of jsonKeys)p[k]=JSON.parse($('json-'+k).value||((k==='sponsors'||k==='events')?'[]':'{}'));const visibility={};for(const k of ['scoreboard','clock','addedTime','lineups','bench','substitutions','cards','statistics','sponsors','ads','officials','crew','matchInfo'])visibility[k]=$('vis-'+k).checked;for(const k of ['lineupsHome','lineupsAway','substitutionsHome','substitutionsAway'])visibility[k]=!!(state.visibility||{})[k];p.visibility=visibility; if(p.statistics?.home && p.statistics?.away && Number.isFinite(Number(p.statistics.home.possession)) && Number.isFinite(Number(p.statistics.away.possession)) && Number(p.statistics.home.possession)+Number(p.statistics.away.possession)!==100) {showNotice('A posse de bola das duas equipes deve somar 100%.');return;} update(p).then(()=>showNotice('Módulos avançados salvos e sincronizados.'));}catch(e){showNotice('JSON inválido: '+e.message);}});
    $('save-manual-modules').addEventListener('click',()=>{const p={};for(const [id,key] of Object.entries(manualFields))p[key]=$(id).value;p.manualLineups='';p.manualSubstitutions='';update(p).then(()=>{showNotice('Escalações e substituições separadas salvas e sincronizadas.');$('manual-module-status').textContent='Informações salvas no servidor e sincronizadas com os overlays.';});});
  function toggleButton(btn,on,onText,offText){btn.textContent=on?onText:offText;btn.classList.toggle('primary',on);btn.classList.toggle('danger',!on);btn.setAttribute('aria-pressed',String(on));}
  function readPng(input){return new Promise((resolve,reject)=>{const file=input.files&&input.files[0];if(!file)return reject(new Error('Selecione um arquivo PNG.'));if(file.type!=='image/png')return reject(new Error('Envie somente imagens PNG.'));if(file.size>300000)return reject(new Error('O PNG deve ter até 300 KB para sincronizar com segurança.'));const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('Não foi possível ler o arquivo.'));r.readAsDataURL(file);});}
  function renderPngControls(s){
    const sponsors=Array.isArray(s.sponsors)?s.sponsors:[];const list=$('png-sponsor-list');list.replaceChildren();
    sponsors.forEach((sp,i)=>{if(!sp||!sp.image)return;const row=document.createElement('div');row.className='png-sponsor-row';const img=document.createElement('img');img.src=sp.image;img.alt='';const label=document.createElement('span');label.textContent=sp.name||('Patrocinador '+(i+1));const remove=document.createElement('button');remove.type='button';remove.className='button danger';remove.textContent='Remover';remove.addEventListener('click',()=>{if(!confirm('Remover este patrocinador da lista?'))return;const next=[...sponsors];next.splice(i,1);update({sponsors:next}).then(()=>showNotice('Patrocinador removido.'));});row.append(img,label,remove);list.appendChild(row);});
    const vis=s.visibility||{};toggleButton($('toggle-png-sponsors'),!!vis.sponsors,'Ativado — ocultar patrocinadores','Desativado — mostrar patrocinadores');toggleButton($('toggle-png-ads'),!!vis.ads&&!!s.ads?.enabled,'Anúncio em L ativado — ocultar','Anúncio em L desativado — mostrar');
    const ads=s.ads||{};$('png-ad-top-width').value=ads.top?.width||900;$('png-ad-top-height').value=ads.top?.height||120;$('png-ad-right-width').value=ads.right?.width||150;$('png-ad-right-height').value=ads.right?.height||700;
    $('png-ads-status').textContent=ads.enabled?'Anúncio em L salvo. A visibilidade no overlay é controlada pelo botão acima.':'Anúncio em L desativado.';
  }
  $('add-png-sponsor').addEventListener('click',async()=>{try{const image=await readPng($('png-sponsor-file'));const name=$('png-sponsor-name').value.trim()||'Patrocinador';const sponsors=Array.isArray(state.sponsors)?state.sponsors:[];if(sponsors.length>=10)throw new Error('Limite de 10 patrocinadores PNG por partida.');const next=[...sponsors,{name,image}];await api('/api/state','POST',{sponsors:next});$('png-sponsor-name').value='';$('png-sponsor-file').value='';showNotice('Patrocinador PNG adicionado.');}catch(e){showNotice(e.message);}});
  $('clear-png-sponsors').addEventListener('click',()=>{if(!confirm('Apagar todos os patrocinadores cadastrados?'))return;update({sponsors:[]}).then(()=>showNotice('Lista de patrocinadores limpa.'));});
  $('toggle-png-sponsors').addEventListener('click',()=>{const visibility={...(state.visibility||{}),sponsors:!state.visibility?.sponsors};update({visibility}).then(()=>showNotice(visibility.sponsors?'Patrocinadores ativados.':'Patrocinadores ocultos; arquivos preservados.'));});
  $('toggle-png-ads').addEventListener('click',()=>{const enabled=!(state.ads||{}).enabled;const visibility={...(state.visibility||{}),ads:enabled};const ads={...(state.ads||{}),enabled};update({ads,visibility}).then(()=>showNotice(enabled?'Anúncio em L ativado.':'Anúncio em L ocultado; imagens preservadas.'));});
  $('save-png-ads').addEventListener('click',async()=>{try{const current=state.ads||{};const top={...(current.top||{}),enabled:true,width:clamp($('png-ad-top-width').value,100,1920),height:clamp($('png-ad-top-height').value,20,400)};const right={...(current.right||{}),enabled:true,width:clamp($('png-ad-right-width').value,20,500),height:clamp($('png-ad-right-height').value,100,1080)};const topFile=$('png-ad-top-file'),rightFile=$('png-ad-right-file');if(topFile.files.length)top.image=await readPng(topFile);if(rightFile.files.length)right.image=await readPng(rightFile);if(!top.image||!right.image)throw new Error('Envie um PNG para a faixa superior e outro para a faixa direita.');await api('/api/state','POST',{ads:{...current,enabled:true,top,right}});topFile.value='';rightFile.value='';showNotice('Anúncio em L salvo. Ative a exibição quando estiver pronto.');}catch(e){showNotice(e.message);}});
  $('remove-png-ads').addEventListener('click',()=>{if(!confirm('Remover as duas imagens do anúncio em L?'))return;const ads={...(state.ads||{}),enabled:false,top:{...(state.ads||{}).top,image:'',enabled:false},right:{...(state.ads||{}).right,image:'',enabled:false}};update({ads}).then(()=>showNotice('Imagens do anúncio em L removidas.'));});
  function clamp(v,min,max){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):min;}

  document.querySelectorAll('[data-module-toggle]').forEach(btn=>btn.addEventListener('click',()=>{const key=btn.dataset.moduleToggle;const visibility={...(state.visibility||{})};visibility[key]=!visibility[key];update({visibility}).then(()=>showNotice(visibility[key]?'Módulo ativado no overlay.':'Módulo desativado; os dados foram preservados.'));}));
  $('start').addEventListener('click',()=>update({running:true}));
  $('pause').addEventListener('click',()=>update({running:false}));
  $('zero').addEventListener('click',()=>update({running:false,elapsedSeconds:0}));
  $('set-time').addEventListener('click',()=>{const m=Math.max(0,Math.min(720,parseInt($('set-minutes').value||'0',10)));const s=Math.max(0,Math.min(59,parseInt($('set-seconds').value||'0',10)));update({running:false,elapsedSeconds:m*60+s});});
  $('period-select').addEventListener('change',()=>update({period:$('period-select').value}));
  const periods=['PRÉ-JOGO','1º TEMPO','INTERVALO','2º TEMPO','FIM DE JOGO','1º TEMPO PRORROGAÇÃO','INTERVALO PRORROGAÇÃO','2º TEMPO PRORROGAÇÃO','DISPUTA DE PÊNALTIS'];
  $('next-period').addEventListener('click',()=>{const i=periods.indexOf(state.period);update({period:periods[(i+1)%periods.length],running:false,elapsedSeconds:0});});
  $('save-added').addEventListener('click',()=>{const mins=Math.max(0,Math.min(99,parseInt($('added-minutes-input').value||'0',10)));update({addedMinutes:mins}).then(()=>showNotice('Minutos de acréscimo aplicados.'));});
  $('toggle-added').addEventListener('click',()=>update({addedTimeEnabled:!state.addedTimeEnabled}).then(()=>showNotice(state.addedTimeEnabled?'Acréscimo ativado no overlay.':'Acréscimo desativado no overlay.')));
  $('save-match').addEventListener('click',()=>{const p={};for(const f of fields.slice(0,10))p[f]=$(f).value;update(p).then(()=>showNotice('Dados da partida salvos.'));});
  $('save-display').addEventListener('click',()=>{update({brand:$('brand').value,tagline:$('tagline').value,showDate:$('showDate').checked,showCompetition:$('showCompetition').checked,showCards:$('showCards').checked}).then(()=>showNotice('Preferências salvas.'));});
  function readLogo(input,key){const file=input.files&&input.files[0];if(!file)return;if(file.size>1_000_000){showNotice('Imagem muito grande. Use arquivo de até 1 MB.');input.value='';return;}const reader=new FileReader();reader.onload=()=>update({[key]:reader.result}).then(()=>showNotice('Escudo atualizado.'));reader.readAsDataURL(file);}
  $('homeColor').addEventListener('input',()=>update({homeColor:$('homeColor').value}));
  $('awayColor').addEventListener('input',()=>update({awayColor:$('awayColor').value}));
  $('homeLogoFile').addEventListener('change',()=>readLogo($('homeLogoFile'),'homeLogo'));
  $('awayLogoFile').addEventListener('change',()=>readLogo($('awayLogoFile'),'awayLogo'));
  $('clear-logos').addEventListener('click',()=>update({homeLogo:'',awayLogo:''}).then(()=>showNotice('Escudos removidos.')));
  $('reset-match').addEventListener('click',async()=>{if(!confirm('Zerar os gols, cartões e cronômetro? Os nomes e escudos serão preservados.'))return;try{render(await api('/api/reset','POST',{}));showNotice('Placar e relógio reiniciados.');}catch(e){showNotice(e.message);}});
  $('open-overlay').addEventListener('click',()=>window.open('/overlay.html','lltv-overlay'));
  $('copy-url').addEventListener('click',async()=>{const value=location.origin+'/overlay.html';try{await navigator.clipboard.writeText(value);showNotice('Link do overlay copiado.');}catch{showNotice('Link do overlay: '+value);}});
  $('toggle-overlay').addEventListener('click',()=>update({overlayEnabled:state.overlayEnabled===false}).then(()=>showNotice(state.overlayEnabled===false?'Overlay ativado.':'Overlay desativado.')));
  function panelShareUrl(){return location.origin+location.pathname+'?token='+encodeURIComponent(token);}
  $('copy-mobile-panel').addEventListener('click',async()=>{const value=panelShareUrl();$('mobile-panel-url').textContent=value;try{await navigator.clipboard.writeText(value);showNotice('Link do painel copiado. Abra-o no celular.');}catch{showNotice('Copie o endereço exibido abaixo do botão.');}});
  $('share-mobile-panel').addEventListener('click',async()=>{const value=panelShareUrl();$('mobile-panel-url').textContent=value;if(navigator.share){try{await navigator.share({title:'Painel LLTV BRASIL',text:'Acesso ao painel de controle LLTV BRASIL',url:value});}catch(e){if(e.name!=='AbortError')showNotice('Não foi possível compartilhar neste dispositivo.');}}else{try{await navigator.clipboard.writeText(value);showNotice('Compartilhamento não disponível; link copiado.');}catch{showNotice('Copie o endereço exibido abaixo.');}}});
  $('show-mobile-qr').addEventListener('click',()=>{const value=panelShareUrl();$('mobile-panel-url').textContent=value;const wrap=$('mobile-qr-wrap');wrap.hidden=!wrap.hidden;if(!wrap.hidden){$('mobile-qr').replaceChildren();if(window.QRCode)new QRCode($('mobile-qr'),{text:value,width:220,height:220});else showNotice('A biblioteca de QR Code não carregou. Use Copiar Link.');}});
  $('save-gc').addEventListener('click',()=>update({gc:{...(state.gc||{}),title:$('gc-title').value,info:$('gc-info').value,enabled:!!state.gc?.enabled}}).then(()=>showNotice('GC salvo.')));
  $('activate-gc').addEventListener('click',()=>update({gc:{title:$('gc-title').value,info:$('gc-info').value,enabled:true}}).then(()=>showNotice('GC ativado na transmissão.')));
  $('deactivate-gc').addEventListener('click',()=>update({gc:{...(state.gc||{}),title:$('gc-title').value,info:$('gc-info').value,enabled:false}}).then(()=>showNotice('GC desativado.')));
  $('clear-gc').addEventListener('click',()=>{ $('gc-title').value='';$('gc-info').value='';update({gc:{title:'',info:'',enabled:false}}).then(()=>showNotice('Texto do GC limpo.'));});
  document.querySelectorAll('[data-art-toggle]').forEach(btn=>btn.addEventListener('click',()=>{const key=btn.dataset.artToggle;const arts={...(state.broadcastArt||{})};arts[key]=!arts[key];if(['opening','halftime','fulltime'].includes(key)&&arts[key]){for(const other of ['opening','halftime','fulltime'])if(other!==key)arts[other]=false;}update({broadcastArt:arts}).then(()=>showNotice(arts[key]?'Arte ativada.':'Arte desativada.'));}));
  load();
  let es;function connect(){es=new EventSource('/api/events');es.onmessage=e=>{try{render(JSON.parse(e.data));}catch{}};es.onerror=()=>{$('connection').textContent='Reconectando…';$('connection').style.color='#ffd479';};}connect();
  setInterval(()=>{
    let sec = Number(state.elapsedSeconds) || 0;
    if (state.running) {
      const receivedAt = Number(state.serverNow) || Date.now();
      sec += Math.max(0, Math.floor((Date.now() - receivedAt) / 1000));
    }
    $('timer-big').textContent=fmt(sec);
    $('prev-clock').textContent=fmt(sec);
  },250);
})();