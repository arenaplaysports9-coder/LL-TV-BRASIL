import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Hls from 'hls.js';
import { Radio, CalendarDays, Newspaper, Play, Menu, X, Tv, Trophy, Clock3 } from 'lucide-react';
import './style.css';
import Admin from './Admin.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8787/api';
const STREAM = import.meta.env.VITE_LIVE_STREAM_URL || '';

function Player() {
  const videoRef = useRef(null);
  const [state, setState] = useState(STREAM ? 'Aguardando sinal' : 'Sinal ainda não configurado');
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !STREAM) return;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = STREAM;
      setState('Conectando ao canal');
    } else if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(STREAM);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => setState('Sinal disponível'));
      hls.on(Hls.Events.ERROR, () => setState('Aguardando sinal ao vivo'));
      return () => hls.destroy();
    } else setState('Navegador sem suporte HLS');
  }, []);
  return <div className="player-wrap">
    <video ref={videoRef} controls playsInline poster="/lltv-logo.png" />
    <div className="player-overlay"><span className="live-dot" /> AO VIVO <small>{state}</small></div>
    {!STREAM && <div className="player-message"><Tv size={42}/><strong>LLTV BRASIL</strong><span>O canal está preparado. Configure a URL HLS para receber o sinal.</span></div>}
  </div>;
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [news, setNews] = useState([]);
  const [programs, setPrograms] = useState([]);
  useEffect(() => {
    fetch(`${API}/news`).then(r => r.ok ? r.json() : []).then(setNews).catch(()=>{});
    fetch(`${API}/programs`).then(r => r.ok ? r.json() : []).then(setPrograms).catch(()=>{});
  }, []);
  const links = ['Início','TV ao vivo','Programação','Canais','Futebol','Outros esportes','Notícias','Reprises','Programas','Contato'];
  return <div>
    <header className="topbar">
      <a className="brand" href="#"><img src="/lltv-logo.png" onError={e=>e.currentTarget.style.display='none'} alt="LLTV BRASIL"/><span>LLTV <b>BRASIL</b><small>A CASA DAS LIGAS ALTERNATIVAS</small></span></a>
      <button className="menu-toggle" onClick={()=>setMenuOpen(!menuOpen)} aria-label="Abrir menu">{menuOpen?<X/>:<Menu/>}</button>
      <nav className={menuOpen?'open':''}>{links.map((l,i)=><a key={l} href={['#inicio','#ao-vivo','#programacao','#canais','#futebol','#esportes','#noticias','#reprises','#programas','#contato'][i]} onClick={()=>setMenuOpen(false)}>{l}</a>)}</nav>
      <a className="watch-btn" href="#ao-vivo"><Play size={15} fill="currentColor"/> ASSISTA</a>
    </header>
    <main>
      <section className="hero" id="inicio">
        <div className="hero-content"><span className="eyebrow">EMISSORA ESPORTIVA DIGITAL</span><h1>A CASA DAS <em>LIGAS ALTERNATIVAS</em></h1><p>O esporte tem espaço aqui. Acompanhe transmissões, notícias, programas e grandes histórias.</p><a className="gold-btn" href="#ao-vivo"><Play size={17} fill="currentColor"/> ASSISTA AGORA</a></div>
        <div className="hero-mark"><Trophy size={110}/><span>LLTV</span></div>
      </section>
      <section className="section" id="ao-vivo"><div className="section-head"><div><span className="eyebrow">NOSSO CANAL</span><h2><Radio/> TV AO VIVO</h2></div><span className="status"><i/> CANAL PRINCIPAL</span></div><Player/></section>
      <section className="section" id="programacao"><div className="section-head"><div><span className="eyebrow">NÃO PERCA</span><h2><CalendarDays/> PROGRAMAÇÃO</h2></div></div>
        <div className="cards">{programs.length ? programs.map(p=><article className="card" key={p.id}><span className="tag">PROGRAMADO</span><h3>{p.title}</h3><p>{p.description || 'Acompanhe na LLTV BRASIL.'}</p><small><Clock3 size={14}/> {new Date(p.starts_at).toLocaleString('pt-BR')}</small></article>) : <article className="card empty"><CalendarDays/><h3>Grade de programação</h3><p>As atrações cadastradas pela equipe aparecerão aqui.</p></article>}</div>
      </section>
      <section className="section" id="canais"><div className="section-head"><div><span className="eyebrow">ASSISTA DO SEU JEITO</span><h2><Tv/> NOSSOS CANAIS</h2></div></div><div className="channel-grid">{['LLTV BRASIL','LLTV FUTEBOL','LLTV FEMININO','LLTV BASE','LLTV INTERNACIONAL','LLTV OUTROS ESPORTES'].map((c,i)=><div className="channel" key={c}><span>0{i+1}</span><strong>{c}</strong><small>CANAL DIGITAL</small></div>)}</div></section>
      <section className="section" id="noticias"><div className="section-head"><div><span className="eyebrow">INFORMAÇÃO ESPORTIVA</span><h2><Newspaper/> ÚLTIMAS NOTÍCIAS</h2></div></div><div className="cards">{news.length ? news.map(n=><article className="card" key={n.id}><span className="tag">{n.category || 'ESPORTES'}</span><h3>{n.title}</h3><p>{n.summary}</p></article>) : <article className="card empty"><Newspaper/><h3>Notícias da LLTV</h3><p>As notícias publicadas no painel administrativo serão exibidas nesta área.</p></article>}</div></section>
      <section className="cta" id="contato"><span className="eyebrow">LLTV BRASIL WEB TV</span><h2>O esporte acontece aqui.</h2><p>Uma emissora digital dedicada às competições e às ligas que merecem visibilidade.</p></section>
    </main>
    <footer><strong>LLTV <b>BRASIL</b></strong><span>A CASA DAS LIGAS ALTERNATIVAS</span><small>© {new Date().getFullYear()} LLTV BRASIL. Todos os direitos reservados.</small></footer>
  </div>;
}

createRoot(document.getElementById('root')).render(window.location.pathname.startsWith('/admin') ? <Admin/> : <App/>);
