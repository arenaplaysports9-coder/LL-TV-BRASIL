(() => {
  'use strict';
  let deferredInstallPrompt = null;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const bar = (id, className, message, actions) => {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('section'); el.id = id; el.className = className;
      el.innerHTML = `<span class="pwa-message"></span><div class="pwa-actions"></div>`;
      const main = document.querySelector('main');
      if (main) main.insertBefore(el, main.firstChild);
    }
    el.querySelector('.pwa-message').textContent = message;
    const box = el.querySelector('.pwa-actions'); box.replaceChildren();
    actions.forEach(({label, action, secondary}) => {
      const button = document.createElement('button'); button.textContent = label;
      if (secondary) button.className = 'pwa-dismiss'; button.addEventListener('click', action); box.append(button);
    });
    el.classList.remove('pwa-hidden'); return el;
  };
  const hide = id => { const el = document.getElementById(id); if (el) el.classList.add('pwa-hidden'); };
  function showIOSHelp() {
    const wrap = document.createElement('div'); wrap.className = 'pwa-modal-backdrop';
    wrap.innerHTML = '<div class="pwa-modal" role="dialog" aria-modal="true"><h2>Instalar LLTV Brasil</h2><p>No iPhone ou iPad, a instalação é feita pelo Safari:</p><ol><li>Abra este endereço no <b>Safari</b>.</li><li>Toque no botão <b>Compartilhar</b> (quadrado com seta).</li><li>Escolha <b>Adicionar à Tela de Início</b>.</li><li>Confirme em <b>Adicionar</b>.</li></ol><p>O ícone LLTV ficará disponível na tela inicial.</p><button type="button" id="pwaCloseHelp">Entendi</button></div>';
    document.body.append(wrap); wrap.querySelector('#pwaCloseHelp').addEventListener('click', () => wrap.remove());
    wrap.addEventListener('click', e => { if (e.target === wrap) wrap.remove(); });
  }
  function showInstall() {
    if (isStandalone) return;
    bar('pwaInstallBar','pwa-install-bar','Instale o LLTV Brasil Placar Pro no seu dispositivo para abrir como aplicativo.',[
      {label:'INSTALAR APLICATIVO', action: async () => {
        if (deferredInstallPrompt) { deferredInstallPrompt.prompt(); const result = await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; if (result && result.outcome === 'accepted') hide('pwaInstallBar'); }
        else if (isIOS) showIOSHelp();
        else showIOSHelp();
      }},
      {label:'Depois',secondary:true,action:()=>hide('pwaInstallBar')}
    ]);
  }
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstallPrompt = event; showInstall(); });
  window.addEventListener('appinstalled', () => hide('pwaInstallBar'));
  if (!isStandalone) showInstall();

  function showUpdate(registration) {
    bar('pwaUpdateBar','pwa-update-bar','Nova atualização do LLTV Brasil Placar Pro disponível. Atualize para receber as melhorias do sistema.',[
      {label:'ATUALIZAR AGORA',action:()=>{
        const waiting = registration && registration.waiting;
        if (waiting) waiting.postMessage({type:'SKIP_WAITING'});
        else location.reload();
      }},
      {label:'Mais tarde',secondary:true,action:()=>hide('pwaUpdateBar')}
    ]);
  }
  if ('serviceWorker' in navigator && /^https:/.test(location.protocol) || ('serviceWorker' in navigator && location.hostname === 'localhost')) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        if (registration.waiting && navigator.serviceWorker.controller) showUpdate(registration);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(registration);
          });
        });
        setInterval(() => registration.update().catch(()=>{}), 5 * 60 * 1000);
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return; refreshing = true; location.reload();
        });
      } catch (error) { console.warn('PWA: não foi possível registrar o service worker.', error); }
    });
  }
})();
