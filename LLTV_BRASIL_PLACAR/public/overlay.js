(() => {
  const $=id=>document.getElementById(id);
  const blank='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="38" fill="#15243a" stroke="#66758a" stroke-width="2"/><text x="40" y="51" text-anchor="middle" font-size="32">⚽</text></svg>');
  let state={elapsedSeconds:0,serverNow:Date.now()},localReceipt=Date.now();
  function fmt(sec){sec=Math.max(0,Number(sec)||0);return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');}
  function render(s){state=s;localReceipt=Date.now();
    $('o-home-name').textContent=s.homeName||'TIME DA CASA';$('o-away-name').textContent=s.awayName||'TIME VISITANTE';
    $('o-home-short').textContent=s.homeShort||'';$('o-away-short').textContent=s.awayShort||'';
    $('o-home-score').textContent=s.homeScore??0;$('o-away-score').textContent=s.awayScore??0;
    $('o-home-logo').src=s.homeLogo||blank;$('o-away-logo').src=s.awayLogo||blank;
    $('overlay').style.setProperty('--home-color',s.homeColor||'#d92332'); $('overlay').style.setProperty('--away-color',s.awayColor||'#2878d0');
    $('o-home-logo').style.borderColor=s.homeColor||'#d92332'; $('o-away-logo').style.borderColor=s.awayColor||'#2878d0';
    $('o-period').textContent=s.period||'1º TEMPO';$('o-brand').textContent=s.brand||'LLTV BRASIL';
    $('o-date').textContent=s.showDate&&s.date?new Date(s.date+'T12:00:00').toLocaleDateString('pt-BR')+(s.kickoff?' · '+s.kickoff:''):'';
    $('o-competition').textContent=[s.showCompetition?s.competition:'',s.round].filter(Boolean).join(' · ');
    $('o-match-details').textContent=[s.stadium,s.city].filter(Boolean).join(' · ');
    $('o-cards').textContent=s.showCards?`🟨 ${s.homeYellow||0}  🟥 ${s.homeRed||0}  |  🟨 ${s.awayYellow||0}  🟥 ${s.awayRed||0}`:'';
    $('o-added').textContent=s.addedTimeEnabled && Number(s.addedMinutes)>0?`+${s.addedMinutes}'`:'';
    const v=s.visibility||{};
    const cd=s.competitionDisplay||{};
    const display=$('o-competition-display');
    display.style.display=cd.enabled?'block':'none';
    $('o-display-title').textContent=cd.title||'';
    const content=$('o-display-content');content.replaceChildren();
    if(cd.enabled&&Array.isArray(cd.lines)){cd.lines.slice(0,80).forEach(line=>{const row=document.createElement('div');row.className='competition-display-line';row.textContent=String(line);content.append(row);});}
    if(cd.enabled){$('overlay-score').style.display='none';$('o-modules').style.display='none';$('o-gc').style.display='none';}
    $('overlay-score').style.display=(v.scoreboard===false)?'none':'';
    $('o-clock').parentElement.style.display=(v.clock===false)?'none':'';
    $('o-added').style.display=(v.addedTime===false)?'none':'';
    $('o-match-details').style.display=(v.matchInfo===false)?'none':'';
    $('o-cards').style.display=(v.cards===false || v.cards===undefined && !s.showCards)?'none':'';
    $('o-competition').parentElement.style.display=(v.matchInfo===false)?'none':'';
    const art=s.broadcastArt||{};const opening=!!art.opening, halftime=!!art.halftime, fulltime=!!art.fulltime;
    $('o-art-opening').style.display=opening?'flex':'none';$('o-art-live').style.display=art.live?'flex':'none';$('o-art-fulltime').style.display=fulltime?'flex':'none';$('o-art-halftime').style.display=halftime?'flex':'none';
    $('o-half-home-logo').src=s.homeLogo||blank;$('o-half-away-logo').src=s.awayLogo||blank;$('o-half-home-name').textContent=s.homeShort||s.homeName||'MANDANTE';$('o-half-away-name').textContent=s.awayShort||s.awayName||'VISITANTE';$('o-half-home-score').textContent=s.homeScore??0;$('o-half-away-score').textContent=s.awayScore??0;
    $('overlay-score').style.display=(opening||halftime||fulltime||v.scoreboard===false||cd.enabled)?'none':'';$('o-clock').parentElement.style.display=(opening||halftime||fulltime||v.clock===false)?'none':'';$('o-modules').style.display=(opening||halftime||fulltime||cd.enabled)?'none':'';$('o-match-details').style.display=(opening||halftime||fulltime||v.matchInfo===false)?'none':'';$('o-cards').style.display=(opening||halftime||fulltime||v.cards===false || v.cards===undefined && !s.showCards)?'none':'';$('o-sponsors').style.display=(opening||halftime||fulltime)?'none':'';$('o-ad-top').style.display=(opening||halftime||fulltime)?'none':$('o-ad-top').style.display;$('o-ad-right').style.display=(opening||halftime||fulltime)?'none':$('o-ad-right').style.display;
    $('o-gc-title').textContent=s.gc?.title||'';$('o-gc-info').textContent=s.gc?.info||'';$('o-gc').style.display=s.gc?.enabled&&!opening&&!halftime&&!fulltime?'block':'none';
    if(halftime){$('o-art-halftime').style.display='flex';}
    renderModules(s,v);renderPngGraphics(s,v);if(opening||halftime||fulltime){$('o-sponsors').style.display='none';$('o-ad-top').style.display='none';$('o-ad-right').style.display='none';}drawClock();
  }
  function renderModules(s,v){
    const root=$('o-modules');root.replaceChildren();
    const add=(title,content,key)=>{if(v[key]===false||!content)return;const box=document.createElement('section');box.className='overlay-module';const h=document.createElement('b');h.textContent=title;box.appendChild(h);const pre=document.createElement('div');pre.textContent=typeof content==='string'?content:JSON.stringify(content,null,2);box.appendChild(pre);root.appendChild(box);};
    const homeLineup=s.manualLineupsHome||(s.manualLineups&&!s.manualLineupsAway?s.manualLineups:'');
    const awayLineup=s.manualLineupsAway||'';
    const showHomeLineup=v.lineupsHome===undefined?!!v.lineups:!!v.lineupsHome;
    const showAwayLineup=v.lineupsAway===undefined?!!v.lineups:!!v.lineupsAway;
    if(showHomeLineup&&homeLineup)add('ESCALAÇÃO — '+(s.homeName||'MANDANTE'),homeLineup,'lineupsHome');
    if(showAwayLineup&&awayLineup)add('ESCALAÇÃO — '+(s.awayName||'VISITANTE'),awayLineup,'lineupsAway');
    if(!homeLineup&&!awayLineup&&s.lineups&&(showHomeLineup||showAwayLineup))add('ESCALAÇÕES',s.lineups,'lineups');
    add('BANCO DE RESERVAS',s.manualBench,'bench');
    const homeSubs=s.manualSubstitutionsHome||(s.manualSubstitutions&&!s.manualSubstitutionsAway?s.manualSubstitutions:'');
    const awaySubs=s.manualSubstitutionsAway||'';
    if(homeSubs)add('SUBSTITUIÇÕES — '+(s.homeName||'MANDANTE'),homeSubs,'substitutionsHome');
    if(awaySubs)add('SUBSTITUIÇÕES — '+(s.awayName||'VISITANTE'),awaySubs,'substitutionsAway');
    if(!homeSubs&&!awaySubs&&s.substitutions && v.substitutionsHome===undefined && v.substitutionsAway===undefined)add('SUBSTITUIÇÕES',s.substitutions,'substitutions');
    add('ESTATÍSTICAS',s.statistics,'statistics');
    add('EQUIPE DE ARBITRAGEM',s.manualOfficials||s.officials,'officials');
    add('EQUIPE DE TRANSMISSÃO',s.manualCrew||s.crew,'crew');
    add('EVENTOS E CARTÕES',s.events,'cards');
  }
  function renderPngGraphics(s,v){
    const sponsorsRoot=$('o-sponsors');sponsorsRoot.replaceChildren();
    if(v.sponsors!==false && Array.isArray(s.sponsors)){
      s.sponsors.filter(item=>item&&item.image).slice(0,10).forEach(item=>{const img=document.createElement('img');img.src=item.image;img.alt=item.name||'Patrocinador';img.title=item.name||'Patrocinador';sponsorsRoot.appendChild(img);});
    }
    sponsorsRoot.style.display=(v.sponsors!==false && sponsorsRoot.children.length)?'flex':'none';
    const ads=s.ads||{};const enabled=v.ads!==false&&!!ads.enabled;
    const top=$('o-ad-top'),right=$('o-ad-right');
    top.src=ads.top?.image||'';right.src=ads.right?.image||'';
    top.style.display=enabled&&!!ads.top?.image?'block':'none';right.style.display=enabled&&!!ads.right?.image?'block':'none';
    top.style.width=Math.max(100,Math.min(1920,Number(ads.top?.width)||900))+'px';top.style.height=Math.max(20,Math.min(400,Number(ads.top?.height)||120))+'px';
    right.style.width=Math.max(20,Math.min(500,Number(ads.right?.width)||150))+'px';right.style.height=Math.max(100,Math.min(1080,Number(ads.right?.height)||700))+'px';
  }
  function drawClock(){let sec=Number(state.elapsedSeconds)||0;if(state.running)sec+=Math.max(0,Math.min(2,(Date.now()-localReceipt)/1000));$('o-clock').textContent=fmt(Math.floor(sec));}
  async function init(){try{const r=await fetch('/api/state');render(await r.json());}catch{}const es=new EventSource('/api/events');es.onmessage=e=>{try{render(JSON.parse(e.data));}catch{}};setInterval(drawClock,250);}
  init();
})();