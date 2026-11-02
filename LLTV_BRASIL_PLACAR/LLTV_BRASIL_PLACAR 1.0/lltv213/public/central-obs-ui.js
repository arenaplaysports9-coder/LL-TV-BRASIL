(()=>{
 const $=id=>document.getElementById(id);
 const trigger=(id)=>{const el=$(id);if(el)el.click();};
 document.querySelectorAll('[data-studio-action]').forEach(btn=>btn.addEventListener('click',()=>{
   const action=btn.dataset.studioAction;
   if(action==='take') trigger('take-live');
   if(action==='cut') trigger('cut-direct');
   if(action==='fade') trigger('transition');
 }));
 const duration=$('studio-transition-duration');if(duration){duration.addEventListener('change',()=>{const status=$('central-status');if(status)status.title='Duração de transição selecionada: '+duration.value+' ms';});}
})();
