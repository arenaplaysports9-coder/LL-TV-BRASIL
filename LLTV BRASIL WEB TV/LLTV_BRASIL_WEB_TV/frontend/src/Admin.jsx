import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, LayoutDashboard, ArrowLeft, Layers3 } from 'lucide-react';
import catalog from './module-catalog.json';
import './style.css';

function Admin() {
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('Todos');
  const categories=['Todos',...new Set(catalog.map(m=>m.category))];
  const shown=useMemo(()=>catalog.filter(m=>(category==='Todos'||m.category===category)&&(`${m.name} ${m.category}`.toLowerCase().includes(query.toLowerCase()))),[query,category]);
  return <div className="admin-shell">
    <header className="admin-top"><a href="/" className="admin-brand"><img src="/lltv-logo.png" alt="LLTV"/> <span>LLTV BRASIL <small>PAINEL DE GESTÃO</small></span></a><a className="admin-back" href="/"> <ArrowLeft size={16}/> Site público</a></header>
    <main className="admin-main">
      <div className="admin-title"><div><span className="eyebrow">CENTRAL ADMINISTRATIVA</span><h1><LayoutDashboard/> Painel de módulos</h1><p>Visão geral dos 65 módulos previstos para a operação da LLTV BRASIL WEB TV.</p></div><div className="admin-total"><b>65</b><span>módulos catalogados</span></div></div>
      <div className="admin-warning"><strong>Etapa de desenvolvimento:</strong> os 65 módulos estão cadastrados nesta central como estrutura inicial. Telas específicas, operações de cadastro/edição, permissões, integrações e automações serão implementadas e testadas por etapas. Não representa ainda uma plataforma pronta para produção.</div>
      <div className="admin-tools"><label><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar módulo..."/></label><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></div>
      <div className="admin-count">Exibindo {shown.length} de 65 módulos</div>
      <div className="module-grid">{shown.map(m=><article className="module-card" key={m.id}><div className="module-icon"><Layers3 size={19}/></div><div className="module-number">MÓDULO {String(m.id).padStart(2,'0')}</div><h3>{m.name}</h3><p>{m.category}</p><span className="module-status">{m.status}</span></article>)}</div>
    </main>
    <footer><strong>LLTV BRASIL</strong><small>A CASA DAS LIGAS ALTERNATIVAS</small></footer>
  </div>;
}
createRoot(document.getElementById('root')).render(<Admin/>);
