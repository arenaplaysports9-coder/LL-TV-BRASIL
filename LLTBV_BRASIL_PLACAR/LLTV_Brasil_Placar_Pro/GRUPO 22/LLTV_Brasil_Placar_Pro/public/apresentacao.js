const WA='https://wa.me/5527998663622';
const faq=[
['O que é o LLTV Brasil Placar Pro?','É uma plataforma de gerenciamento esportivo para organizar placares, competições, equipes, partidas, classificações e informações de arbitragem e transmissão.'],
['Funciona com OBS Studio?','O sistema oferece recursos para uso com fontes de navegador no OBS Studio. A configuração da fonte e a conexão com o servidor são necessárias.'],
['Posso cadastrar minhas competições e equipes?','Sim. A plataforma possui módulos de competições, equipes, jogos, rodadas e classificação. Os recursos disponíveis dependem da versão e das permissões da conta.'],
['Posso personalizar as cores do placar?','Sim. O sistema oferece personalização visual, incluindo cores independentes para mandante e visitante.'],
['Funciona no computador e no celular?','O sistema é acessado pela web em navegadores compatíveis e possui interface adaptável. Em dispositivos compatíveis, pode ser instalado como PWA.'],
['Como instalar no iPhone?','Abra o endereço do sistema no Safari, toque em Compartilhar e escolha Adicionar à Tela de Início. A disponibilidade pode variar conforme a versão do iOS.'],
['Quais são os planos e preços?','Inicial: R$ 40,00 por mês. Intermediário: R$ 80,00 por seis meses. Avançado: R$ 100,00 por ano. Vitalício: R$ 150,00 em pagamento único. Consulte as condições e o que está incluído antes de contratar.'],
['Quais são as formas de pagamento?','As formas informadas são PIX ou cartão de crédito. A equipe comercial fornecerá as instruções de pagamento e confirmará a contratação.'],
['O plano vitalício inclui todas as atualizações futuras?','As condições exatas do plano vitalício, incluindo escopo de acesso e política de atualizações, precisam ser confirmadas nas condições comerciais antes da compra.'],
['Como recebo ajuda?','Você pode conversar com esta assistente virtual ou solicitar atendimento humano pelo WhatsApp (27) 99866-3622.'],
['A assistente confirma pagamentos?','Não. A assistente não confirma pagamentos nem ativa contas. A confirmação deve ocorrer pelo sistema financeiro ou pela equipe responsável.'],
['Como solicito uma demonstração ou contratação?','Fale com a equipe pelo WhatsApp e informe que deseja conhecer ou contratar o LLTV Brasil Placar Pro.']
];
const faqList=document.getElementById('faqList');faq.forEach(([q,a])=>{const item=document.createElement('div');item.className='faq-item';const btn=document.createElement('button');btn.className='faq-q';btn.type='button';btn.innerHTML=`<span>${q}</span><b>＋</b>`;const ans=document.createElement('div');ans.className='faq-a';ans.textContent=a;btn.addEventListener('click',()=>{item.classList.toggle('open');btn.querySelector('b').textContent=item.classList.contains('open')?'−':'＋'});item.append(btn,ans);faqList.append(item)});
document.getElementById('year').textContent=new Date().getFullYear();
document.getElementById('menuToggle').addEventListener('click',()=>document.getElementById('mainNav').classList.toggle('open'));
document.querySelectorAll('#mainNav a').forEach(a=>a.addEventListener('click',()=>document.getElementById('mainNav').classList.remove('open')));
// Checkout Asaas: o navegador solicita ao backend um link hospedado. A API Key nunca fica no front-end.
const planKeys={'Inicial':'inicial','Intermediário':'intermediario','Avançado':'avancado','Vitalício':'vitalicio'};
function choosePayment(planLabel){
  const old=document.getElementById('lltvCheckoutDialog'); if(old) old.remove();
  const dialog=document.createElement('div'); dialog.id='lltvCheckoutDialog'; dialog.className='checkout-backdrop';
  dialog.innerHTML=`<section class="checkout-card" role="dialog" aria-modal="true" aria-labelledby="checkoutTitle"><button class="checkout-x" type="button" aria-label="Fechar">×</button><span class="eyebrow">CONTRATAÇÃO SEGURA</span><h2 id="checkoutTitle">Plano ${planLabel}</h2><p>Escolha como deseja pagar. Você será direcionado à página segura hospedada pelo Asaas para concluir os dados e o pagamento.</p><div class="checkout-methods"><button type="button" data-method="PIX">Pagar com PIX</button><button type="button" data-method="CREDIT_CARD">Pagar com cartão de crédito</button></div><small>O acesso não é liberado por este clique. A confirmação depende do retorno oficial do Asaas e da vinculação da compra à conta do cliente.</small><div class="checkout-status" aria-live="polite"></div></section>`;
  document.body.append(dialog);
  const close=()=>dialog.remove(); dialog.querySelector('.checkout-x').addEventListener('click',close); dialog.addEventListener('click',e=>{if(e.target===dialog)close()});
  dialog.querySelectorAll('[data-method]').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true; dialog.querySelectorAll('[data-method]').forEach(b=>b.disabled=true);
    const status=dialog.querySelector('.checkout-status'); status.textContent='Preparando o link de pagamento…';
    try{
      const response=await fetch('/api/billing/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan:planKeys[planLabel],method:btn.dataset.method})});
      const data=await response.json(); if(!response.ok) throw new Error(data.error||'Não foi possível iniciar o pagamento.');
      if(!data.url||!/^https:\/\//i.test(data.url)) throw new Error('O Asaas não retornou um endereço de pagamento válido.');
      status.textContent='Link criado. Abrindo a página segura do Asaas…'; window.location.assign(data.url);
    }catch(err){status.textContent=err.message;dialog.querySelectorAll('[data-method]').forEach(b=>b.disabled=false)}
  }));
}
document.querySelectorAll('.plan-buy').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();choosePayment(a.dataset.plan)}));
const chat=document.getElementById('chatBox'),msgs=document.getElementById('chatMessages');document.getElementById('chatLaunch').addEventListener('click',()=>chat.hidden=!chat.hidden);document.getElementById('chatClose').addEventListener('click',()=>chat.hidden=true);
function addMsg(text,who){const d=document.createElement('div');d.className=who==='user'?'user-msg':'bot-msg';d.textContent=text;msgs.append(d);msgs.scrollTop=msgs.scrollHeight}
function answer(input){const s=input.toLowerCase();if(/preço|precos|plano|planos|valor|vitalício|vitalicio/.test(s))return 'Nossos planos informados são:\n• Inicial: R$ 40,00 por mês.\n• Intermediário: R$ 80,00 por seis meses.\n• Avançado: R$ 100,00 por ano.\n• Vitalício: R$ 150,00 em pagamento único.\n\nAs condições, recursos incluídos e regras do vitalício devem ser confirmadas com a equipe comercial.';if(/pix|cartão|cartao|pagamento|pagar|asaas/.test(s))return 'As formas de pagamento informadas são PIX ou cartão de crédito. Para receber instruções seguras e confirmar a contratação, fale com nossa equipe pelo WhatsApp. Não envie dados do cartão ou senhas por aqui.';if(/obs|transmiss|placar/.test(s))return 'O LLTV Brasil Placar Pro oferece recursos de placar e integração por fonte de navegador no OBS Studio. É necessário configurar a fonte e manter conexão com o sistema.';if(/instal|iphone|ios|android|aplicativo|celular|windows|computador/.test(s))return 'A plataforma pode ser acessada pelo navegador. Em dispositivos compatíveis, pode ser instalada como PWA. No iPhone: abra no Safari, toque em Compartilhar e escolha Adicionar à Tela de Início.';if(/compet|time|equipe|rodada|classifica|arbitr|narrador/.test(s))return 'A plataforma reúne módulos para competições, equipes, jogos e rodadas, classificação, arbitragem e equipe de transmissão. A disponibilidade depende dos recursos habilitados na sua versão.';if(/humano|atendente|whatsapp|contato|suporte|contrat/.test(s))return 'Claro! Nosso atendimento humano está disponível pelo WhatsApp (27) 99866-3622. Clique para abrir a conversa: '+WA;if(/vitalício|vitalicio/.test(s))return 'O plano vitalício está anunciado por R$ 150,00 em pagamento único. Confirme com a equipe o escopo do acesso e a política de atualizações antes da compra.';return 'Ainda não tenho uma resposta segura para essa pergunta. Posso encaminhar você ao atendimento humano pelo WhatsApp (27) 99866-3622: '+WA}
function send(text){const value=(text||'').trim();if(!value)return;addMsg(value,'user');setTimeout(()=>addMsg(answer(value),'bot'),180)}
document.getElementById('chatForm').addEventListener('submit',e=>{e.preventDefault();const input=document.getElementById('chatInput');send(input.value);input.value=''});document.querySelectorAll('[data-question]').forEach(b=>b.addEventListener('click',()=>send(b.dataset.question)));
