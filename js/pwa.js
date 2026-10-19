// PWA: service worker (only on http/https – skipped on file://), install button, backup reminder
(function(){
  const httpish=location.protocol==='https:'||location.protocol==='http:';
  if(httpish&&'serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').then(r=>{window.kgSW=r}).catch(e=>console.warn('SW failed',e)))}
  let deferred=null;const btn=document.getElementById('installBtn');
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;btn.hidden=false;window.kgCanInstall=true;const s=document.getElementById('setInstall');if(s)s.hidden=false});
  window.kgInstall=async()=>{if(!deferred){toast('Use Chrome menu ⋮ → "Add to Home screen" / "Install app"');return}deferred.prompt();const r=await deferred.userChoice;deferred=null;btn.hidden=true;toast(r.outcome==='accepted'?'Installed':'Install cancelled')};
  btn.addEventListener('click',window.kgInstall);
  window.addEventListener('appinstalled',()=>{btn.hidden=true;toast('Kearglaze Factory installed')});
})();
function backupBanner(){const b=document.getElementById('banner');if(!b)return;const last=Store.lastBackup();const days=last?(Date.now()-last)/864e5:Infinity;
  if(db.jobs.length&&days>7&&!sessionStorage.getItem('kg-hide-banner')){b.innerHTML=`<div class="banner">💾 ${last?`Last backup ${Math.floor(days)} days ago`:'No backup yet'} – please export a backup of your jobs. <button class="btn small" id="bExport">Export backup now</button> <button class="btn small sec" id="bHide">Later</button></div>`}else b.innerHTML=''}
document.addEventListener('click',e=>{if(e.target.id==='bExport')exportBackup();if(e.target.id==='bHide'){sessionStorage.setItem('kg-hide-banner','1');backupBanner()}});
backupBanner();
