let db=Store.loadDB()||{jobs:[],nextNo:1001,seeded:[]};
if(!db.seeded)db.seeded=db.jobs.map(j=>j.no);
const save=()=>Store.saveDB(db);
// Seed real jobs once (a deleted real job is not re-added). Demo job is refreshed only if already loaded.
(typeof REAL_JOBS!=='undefined'?REAL_JOBS:[]).forEach(r=>{const ex=db.jobs.find(j=>j.no===r.no);if(!ex&&!db.seeded.includes(r.no)){db.jobs.push(sheetJob(r));db.seeded.push(r.no)}});
if(typeof DEMO_GEO_JOB!=='undefined'){const ex=db.jobs.find(j=>j.no===DEMO_GEO_JOB.no);if(ex&&ex.version!==DEMO_GEO_JOB.version){db.jobs[db.jobs.indexOf(ex)]=Object.assign(sheetJob(DEMO_GEO_JOB),{version:DEMO_GEO_JOB.version})}}
db.jobs.forEach(j=>{if(j.extJob&&!j.spacer)j.spacer='Grey plastic (warm edge)'});save();
function loadDemo(){const d=demoData();let n=Math.max(db.nextNo||1001,1001);d.jobs.forEach(j=>{if(db.jobs.some(x=>x.no===j.no)){const old=j.no;j.no='KG'+(n++);j.units.forEach(u=>u.id=u.id.replace(old,j.no))}db.jobs.push(j)});
 const nums=db.jobs.map(j=>+(/^KG(\d+)$/.exec(j.no)||[0,0])[1]);db.nextNo=Math.max(n,...nums.map(x=>x+1));
 if(!db.jobs.some(j=>j.no===DEMO_GEO_JOB.no))db.jobs.push(Object.assign(sheetJob(DEMO_GEO_JOB),{version:DEMO_GEO_JOB.version}));save()}
const area=us=>us.reduce((a,u)=>a+u.w*u.h,0)/1e6;
const $=s=>document.querySelector(s);const app=$('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toISOString().slice(0,10);
const fmt=d=>new Date(d+'T12:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
function dueState(job){const t=today();if(job.units.every(u=>u.stage>=5))return'';if(job.due<t)return'late';const s=new Date();s.setDate(s.getDate()+2);return job.due<=s.toISOString().slice(0,10)?'soon':''}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),2200)}
function findUnit(id){id=String(id).trim().toUpperCase();for(const j of db.jobs)for(const u of j.units)if(u.id.toUpperCase()===id)return{job:j,unit:u};return null}
function advance(id,back){const f=findUnit(id);if(!f)return null;const u=f.unit;
  if(back){if(u.stage===0)return f;u.stage--}else{if(u.stage>=6)return Object.assign(f,{done:true});u.stage++}
  u.history.push({stage:u.stage,at:new Date().toISOString()});save();return f}
const BARS=['Grey plastic (warm edge)','Silver aluminium'];
const spec=(u,j)=>u.desc?esc(u.desc)+' · '+esc(glassLine(u,j))+(isAlu(barOf(u,j))?' · Aluminium':' · Warm edge A-rated')+(u.note?' · <b>'+esc(u.note)+'</b>':'')+(u.geo?' · <b>'+geoText(u)+'</b>':'')+(u.lead?' · <b>'+leadText(u)+'</b>':'')+(u.panel?' · PANEL':''):`${u.outer} / ${u.spacerMm}mm ${u.spacer}${u.centre?` / ${u.centre} / ${u.spacerMm}mm`:''} / ${u.inner} · ${u.gas} · ${u.thick}mm`;
const pill=s=>`<span class="stagepill s${s}">${STAGES[s]}</span>`;
let filter='all';let labelMode='avery',startPos=1,incPanels=false;
function passFilter(job){const t=today();if(filter==='all')return true;if(filter==='late')return job.due<t;
  const e=new Date();e.setDate(e.getDate()+(filter==='today'?0:filter==='3d'?3:7));return job.due<=e.toISOString().slice(0,10)}
const filterBar=()=>`<div class="bar">Due: ${[['all','All'],['late','Overdue'],['today','By today'],['3d','Next 3 days'],['7d','Next 7 days']].map(([k,l])=>`<button class="chip ${filter===k?'on':''}" data-filter="${k}">${l}</button>`).join('')}</div>`;

const views={
board(){
  const cols=STAGES.map((s,i)=>{const items=[];db.jobs.filter(passFilter).sort((a,b)=>a.due.localeCompare(b.due)).forEach(j=>j.units.filter(u=>u.stage===i).forEach(u=>items.push({j,u})));
   if(i===6)items.splice(8);
   return `<div class="col"><h3>${s}<span class="count">${items.length}</span></h3>${items.map(({j,u})=>{const ds=dueState(j);return `<div class="unit ${ds}">
    <div class="id">${u.id}</div><div class="meta"><b>${u.w} × ${u.h}</b> · ${u.thick}mm<br>${esc(j.customer)}<br>${ds?`<span class="tag ${ds}">${ds==='late'?'OVERDUE':'DUE SOON'}</span>`:''}Due ${fmt(j.due)}</div>
    ${i<6?`<button class="btn small" data-adv="${u.id}">✓ ${STAGES[i+1]} →</button>`:''}</div>`}).join('')||'<p style="color:#778;font-size:14px;padding:4px">Nothing here</p>'}</div>`}).join('');
  return `<h1>Jobs to do – by stage</h1>${filterBar()}<div class="board">${cols}</div>`},
jobs(){
  const rows=db.jobs.filter(passFilter).sort((a,b)=>a.due.localeCompare(b.due)).map(j=>{const ds=dueState(j);const pct=Math.round(j.units.reduce((s,u)=>s+u.stage,0)/(j.units.length*6)*100);
   return `<tr class="${ds}"><td><a href="#job/${j.no}"><b>${j.no}</b></a></td><td>${esc(j.customer)}</td><td>${fmt(j.due)} ${ds?`<span class="tag ${ds}">${ds==='late'?'OVERDUE':'SOON'}</span>`:''}</td><td>${j.units.length}</td><td><div class="progress"><i style="width:${pct}%"></i></div></td><td><a class="btn small" href="#job/${j.no}">Open</a> <a class="btn small sec" href="#labels/${j.no}">Labels</a></td></tr>`}).join('');
  return `<h1>Jobs</h1>${filterBar()}<div class="card" style="overflow-x:auto;padding:0"><table><tr><th>Job</th><th>Customer</th><th>Due</th><th>Units</th><th>Progress</th><th></th></tr>${rows||'<tr><td colspan=6>No jobs</td></tr>'}</table></div>`},
job(no){const j=db.jobs.find(x=>x.no===no);if(!j)return'<h1>Job not found</h1>';const ds=dueState(j);
  return `<div class="bar"><a class="btn sec" href="#jobs">← Jobs</a><a class="btn" href="#labels/${j.no}">🖨 Print labels</a><a class="btn sec" href="#cut/${j.no}">✂ Cutting list</a>${j.units.some(u=>u.lead)?`<a class="btn sec" href="#lead/${j.no}">◫ Lead marking</a>`:''}<a class="btn sec" href="#edit/${j.no}">✎ Edit job</a><button class="btn warn" data-del="${j.no}">Delete job</button></div>
  <div class="card"><h1>${j.no} – ${esc(j.customer)}</h1><p>Due <b>${fmt(j.due)}</b> ${ds?`<span class="tag ${ds}">${ds==='late'?'OVERDUE':'DUE SOON'}</span>`:''} · ${j.units.length} items · ${area(j.units).toFixed(2)} m²${j.extJob?` · Job No <b>${esc(j.extJob)}</b>`:''}${j.ref?` · Ref <b>${esc(j.ref)}</b>`:''}${j.glassReq?` · Glass req. <b>${fmt(j.glassReq)}</b>`:''}</p>${j.notes?`<p>📝 ${esc(j.notes)}</p>`:''}<label style="max-width:360px">Bar type for this job (lines can override)<select data-jobbar="${j.no}">${BARS.map(b=>`<option ${barName(j.spacer||cutSet.spacerType)===b?'selected':''}>${b}</option>`).join('')}</select></label></div>
  ${j.units.some(u=>u.loc!==undefined)?`<div class="card"><h2 style="margin-top:0">Georgian bars &amp; square lead per line</h2><div class="grid">${[...new Set(j.units.map(u=>u.line))].map(ln=>{const u=j.units.find(x=>x.line===ln);return `<div class="line" style="margin:0"><b>Line ${ln}</b> · ${esc(u.loc||'')} W${esc(u.wno||'')} ${esc(u.pos||'')} · ${u.w}×${u.h}
 <label>Georgian<select data-geoline="${ln}" data-geojob="${j.no}" data-f="geo"><option value="">None</option><option value="18" ${u.geo==='18'?'selected':''}>18mm</option><option value="25" ${u.geo==='25'?'selected':''}>25mm</option></select></label>
 <label>Squares across × up (e.g. 2x4)<input list="geopresets" data-geoline="${ln}" data-geojob="${j.no}" data-f="pat" value="${u.geo?u.geoA+'x'+u.geoU:''}" placeholder="2x4"></label>
 <label>Square lead across × up (blank = none)<input list="geopresets" data-leadline="${ln}" data-geojob="${j.no}" data-f="lead" value="${u.lead?u.leadA+'x'+u.leadU:''}" placeholder="none"></label>
 <label>Lead width mm<input list="leadwidths" data-leadline="${ln}" data-geojob="${j.no}" data-f="leadW" value="${u.leadW||6}"></label></div>`}).join('')}</div><datalist id="geopresets">${GEO_PRESETS.map(p=>`<option value="${p}">`).join('')}</datalist><datalist id="leadwidths"><option value="6"><option value="9"></datalist></div>`:''}
  <div class="card" style="overflow-x:auto;padding:0"><table><tr><th>Unit ID</th><th>Location / W/No / Position</th><th>Size (mm)</th><th>Spec</th><th>Stage</th><th>Move</th></tr>
  ${j.units.map(u=>`<tr><td><b style="font-family:monospace">${u.id}</b></td><td>${u.loc?`${esc(u.loc)} · W${esc(u.wno)} · ${esc(u.pos)}`:'–'}</td><td><b>${u.w} × ${u.h}</b></td><td style="font-size:14px">${spec(u,j)}</td><td>${pill(u.stage)}</td><td style="white-space:nowrap"><button class="btn small sec" data-back="${u.id}">←</button> ${u.stage<6?`<button class="btn small go" data-adv="${u.id}">${STAGES[u.stage+1]} →</button>`:'✔'}</td></tr>`).join('')}</table></div>`},
new(){const opt=(a,s)=>a.map(x=>`<option ${x===s?'selected':''}>${x}</option>`).join('');
  const d=new Date();d.setDate(d.getDate()+7);
  return `<h1>New job <span style="color:#778;font-size:16px">(will be ${db.nextNo?'KG'+db.nextNo:''})</span></h1><form id="newjob"><div class="card grid">
  <div><label>Customer<input name="customer" required></label></div><div><label>Due date<input type="date" name="due" value="${d.toISOString().slice(0,10)}" required></label></div>
  <div style="grid-column:1/-1"><label>Notes<textarea name="notes"></textarea></label></div></div>
  <h2>Units</h2><div id="lines"></div><template id="tpl"><div class="line card"><div class="grid">
   <div><label>Width mm<input name="w" type="number" min="100" max="4000" required inputmode="numeric"></label></div>
   <div><label>Height mm<input name="h" type="number" min="100" max="4000" required inputmode="numeric"></label></div>
   <div><label>Quantity<input name="qty" type="number" min="1" max="200" value="1" required></label></div>
   <div><label>Type<select name="type"><option>Double</option><option>Triple</option></select></label></div>
   <div><label>Outer glass<select name="outer">${opt(GLASS,'4mm toughened')}</select></label></div>
   <div class="centre" hidden><label>Centre glass<select name="centre">${opt(GLASS,'4mm float')}</select></label></div>
   <div><label>Inner glass<select name="inner">${opt(GLASS,'4mm low-E')}</select></label></div>
   <div><label>Spacer<select name="spacer">${opt(SPACERS)}</select></label></div>
   <div><label>Spacer mm<select name="spacerMm">${opt(['6','8','10','12','14','16','18','20','24'],'16')}</select></label></div>
   <div><label>Gas<select name="gas">${opt(GASES)}</select></label></div>
   <div><label>Overall thickness<input name="thick" readonly></label></div>
   <div style="align-self:end"><button type="button" class="btn sec rm">Remove</button></div></div></div></template>
  <div class="bar"><button type="button" class="btn sec" id="addline">+ Add unit line</button><button class="btn go">Save job</button></div></form>`},
labels(no){const jobs=no?db.jobs.filter(j=>j.no===no):db.jobs.filter(j=>j.units.some(u=>u.stage<5));
  const units=[];jobs.forEach(j=>j.units.forEach(u=>{if(!u.panel||incPanels)units.push({j,u})}));
  const nPanels=jobs.reduce((a,j)=>a+j.units.filter(u=>u.panel).length,0);
  const mode=labelMode, start=Math.min(8,Math.max(1,startPos));
  let body;
  if(mode==='avery'){const slots=Array(start-1).fill(null).concat(units);const pages=[];for(let i=0;i<slots.length;i+=8)pages.push(slots.slice(i,i+8));
    body=pages.map(pg=>`<div class="sheet">${pg.map(x=>x?label(x.j,x.u,'avery'):'<div class="label avery blank"></div>').join('')}</div>`).join('');}
  else body=`<div class="labels">${units.map(({j,u})=>label(j,u,'roll')).join('')}</div>`;
  const sheets=mode==='avery'?Math.ceil((units.length+start-1)/8):0;
  return `<div class="no-print"><h1>Labels ${no?'– '+no:'– all open jobs'} <span style="color:#778;font-size:16px">${units.length} labels${sheets?` · ${sheets} A4 sheet${sheets>1?'s':''}`:''}</span></h1>
  <div class="bar"><select id="jobpick" style="width:auto"><option value="">All open jobs</option>${db.jobs.map(j=>`<option ${j.no===no?'selected':''}>${j.no}</option>`).join('')}</select>
  <button class="chip ${mode==='avery'?'on':''}" data-mode="avery">A4 Avery L7165 / L7915 (8 per sheet)</button><button class="chip ${mode==='roll'?'on':''}" data-mode="roll">100×50mm label printer</button>${nPanels?`<button class="chip ${incPanels?'on':''}" data-panels="1">${incPanels?'✓ ':''}Include ${nPanels} panel${nPanels>1?'s':''} (non-glass)</button>`:''}</div>
  ${mode==='avery'?`<div class="bar"><span style="font-weight:600">Start at label position:</span><div class="pos">${[1,2,3,4,5,6,7,8].map(n=>`<button class="${n===start?'on':''}" data-start="${n}">${n}</button>`).join('')}</div><span style="font-size:14px">Use this to reuse a part-used sheet (positions run left→right, top→bottom; ${start-1} skipped).</span></div>`:''}
  <div class="bar"><button class="btn" data-print="${mode}">🖨 Print ${mode==='avery'?'A4 label sheets':'100×50mm labels'}</button></div>
  <p class="note">⚠ In the print window choose <b>${mode==='avery'?'Paper: A4':'Paper: 100 × 50 mm'}</b>, <b>Scale: 100% / Actual size</b> (not “Fit to page”), <b>Margins: None</b>, and turn off headers/footers. ${mode==='avery'?'Do a test print on plain paper and hold it against a label sheet first.':''}</p></div>
  <div class="${mode==='avery'?'sheets':''}">${body}</div>`},
quick(){const d=new Date();d.setDate(d.getDate()+7);const dv=d.toISOString().slice(0,10);
  return `<h1>Quick entry from job sheet</h1><form id="quickform"><div class="card grid">
  <div><label>Customer<input name="customer" required value="KEARGLAZE LTD"></label></div><div><label>Job No (sheet)<input name="extJob" required></label></div>
  <div><label>Ref<input name="ref"></label></div><div><label>Date job required<input type="date" name="due" value="${dv}" required></label></div>
  <div><label>Glass required<input type="date" name="glassReq" value="${dv}"></label></div><div><label>Notes<input name="notes"></label></div><div><label>Bar type (job default)<select name="jobbar">${BARS.map(b=>`<option>${b}</option>`).join('')}</select></label></div></div>
  <div class="card" style="overflow-x:auto;padding:0"><table id="qt"><thead><tr><th>#</th><th>Location</th><th>W/No</th><th>Position</th><th>Qty</th><th>Width × Height</th><th>Description</th><th>Note / glass</th><th>Bar</th><th>Georgian</th><th>Squares across×up</th><th>Square lead across×up</th><th>Lead mm</th><th>Panel</th><th></th></tr></thead><tbody></tbody>
  <datalist id="geopresets">${GEO_PRESETS.map(p=>`<option value="${p}">`).join('')}</datalist><datalist id="leadwidths"><option value="6"><option value="9"></datalist><tfoot><tr><td colspan="15" id="qtot" style="font-weight:700"></td></tr></tfoot></table></div>
  <p style="font-size:14px">Tip: Tab moves across, <b>Enter</b> jumps to the same column on the next row (a new row is added automatically). Size can be typed as <code>475x708</code>. Blank rows are ignored. Location and Description carry down from the row above; Panel ticks itself when the description mentions Panel or MDF.</p>
  <div class="bar"><button type="button" class="btn sec" id="qadd">+ Row</button><button class="btn go">Save job</button></div></form>`},
cut(arg){return cutView(arg)},
lead(arg){return leadView(arg)},
settings(){const last=Store.lastBackup();return `<h1>Settings</h1>
 <div class="card"><h2 style="margin-top:0">💾 Backup</h2><p>All jobs are stored on <b>this device only</b>. Export a backup file at least weekly and keep it somewhere safe (e.g. email it to yourself or save to Google Drive).</p>
 <p>Last backup: <b>${last?last.toLocaleString('en-GB'):'never'}</b></p>
 <div class="bar"><button class="btn" id="sExport">⬇ Export all data (JSON)</button><label class="btn sec" style="cursor:pointer">⬆ Import backup file<input type="file" id="sImport" accept=".json,application/json" hidden></label></div>
 <p style="font-size:14px">Import asks whether to <b>merge</b> (add/update jobs by job number, keep everything else) or <b>replace</b> (wipe this device and restore the file).</p></div>
 <div class="card"><h2 style="margin-top:0">📲 App</h2><div class="bar"><button class="btn" id="setInstall" ${window.kgCanInstall?'':'hidden'} onclick="kgInstall()">⬇ Install app</button></div>
 <p style="font-size:14px">On the Android tablet: open the web link in Chrome, then tap the Install button (or Chrome menu ⋮ → “Add to Home screen”). Works offline once installed.</p>
 <p style="font-size:14px">Cutting list settings (deductions, bar lengths, Georgian, lead) are on the <a href="#cut">✂ Cutting</a> page under “Cutting settings”.</p></div>
 ${aiSettingsCard()}
 <div class="card"><h2 style="margin-top:0">🧪 Demo data</h2><p>Adds clearly marked fake jobs so you can try things out. Delete them afterwards from each job page.</p>
 <div class="bar"><button class="btn sec" id="sDemo">Load demo data</button><button class="btn warn" id="sDelDemo">Remove all DEMO jobs</button></div></div>
 <div class="card"><h2 style="margin-top:0">⚠ Danger zone</h2><button class="btn warn" id="sWipe">Erase all data on this device</button></div>
 <p style="font-size:13px;color:#667">Version 1.0 · storage: this device</p>`},
edit(no){const j=db.jobs.find(x=>x.no===no);if(!j)return'<h1>Job not found</h1>';
 const lines=[...new Set(j.units.map(u=>u.line))].map(ln=>{const us=j.units.filter(u=>u.line===ln);return {ln,u:us[0],qty:us.length,done:us.some(u=>u.stage>0)}});
 const BAR=v=>`<select name="bar"><option value="">Job default</option>${BARS.map(b=>`<option ${v===b?'selected':''}>${b}</option>`).join('')}</select>`;
 const GEO=v=>`<select name="geo"><option value="">None</option><option value="18" ${v==='18'?'selected':''}>18mm</option><option value="25" ${v==='25'?'selected':''}>25mm</option></select>`;
 const row=(l)=>{const u=l.u||{};return `<tr data-ln="${l.ln||''}"><td class="rn">${l.ln||'new'}</td><td><input name="loc" value="${esc(u.loc||'')}"></td><td><input name="wno" value="${esc(u.wno||'')}" style="width:60px"></td><td><input name="pos" value="${esc(u.pos||'')}" style="width:110px"></td>
  <td><input name="qty" type="number" min="0" value="${l.qty||1}" style="width:70px"></td><td><input name="w" type="number" value="${u.w||''}" style="width:90px"></td><td><input name="h" type="number" value="${u.h||''}" style="width:90px"></td>
  <td><input name="desc" value="${esc(u.desc??'28mm Unglazed')}"></td><td><input name="note" value="${esc(u.note||'')}"></td><td>${BAR(u.spacer||'')}</td><td>${GEO(u.geo||'')}</td><td><input name="pat" list="geopresets" value="${u.geo?u.geoA+'x'+u.geoU:''}" style="width:70px"></td>
  <td><input name="lead" list="geopresets" value="${u.lead?u.leadA+'x'+u.leadU:''}" style="width:70px"></td><td><input name="leadW" value="${u.leadW||6}" style="width:55px"></td><td><input type="checkbox" name="panel" ${u.panel?'checked':''} style="width:26px;min-height:26px"></td>
  <td>${l.done?'<span class="tag soon" title="Some units already started">started</span>':''}</td></tr>`};
 return `<div class="bar"><a class="btn sec" href="#job/${j.no}">← Cancel</a></div><h1>Edit ${esc(j.extJob||j.no)}</h1><form id="editform" data-no="${j.no}"><div class="card grid">
 <div><label>Customer<input name="customer" value="${esc(j.customer)}" required></label></div><div><label>Job No (sheet)<input name="extJob" value="${esc(j.extJob||'')}"></label></div><div><label>Ref<input name="ref" value="${esc(j.ref||'')}"></label></div>
 <div><label>Date job required<input type="date" name="due" value="${j.due}" required></label></div><div><label>Glass required<input type="date" name="glassReq" value="${j.glassReq||''}"></label></div>
 <div><label>Bar type (job default)<select name="jobbar">${BARS.map(b=>`<option ${barName(j.spacer||cutSet.spacerType)===b?'selected':''}>${b}</option>`).join('')}</select></label></div>
 <div style="grid-column:1/-1"><label>Notes<textarea name="notes">${esc(j.notes||'')}</textarea></label></div></div>
 <div class="card" style="overflow-x:auto;padding:0"><table id="et"><thead><tr><th>Line</th><th>Location</th><th>W/No</th><th>Position</th><th>Qty</th><th>W</th><th>H</th><th>Description</th><th>Note</th><th>Bar</th><th>Georgian</th><th>Squares a×u</th><th>Lead a×u</th><th>Lead mm</th><th>Panel</th><th></th></tr></thead><tbody>${lines.map(row).join('')}</tbody></table></div>
 <datalist id="geopresets">${GEO_PRESETS.map(p=>`<option value="${p}">`).join('')}</datalist><template id="erow">${row({})}</template>
 <p style="font-size:14px">Set Qty to 0 to remove a line. Changing a quantity keeps existing unit IDs and their progress; new units are added at Cut, removed units are taken from the end of the line.</p>
 <div class="bar"><button type="button" class="btn sec" id="eAdd">+ Add line</button><button class="btn go">Save changes</button></div></form>`},
scansheet(){return scanSheetView()},
scan(){return `<h1>Scan to advance</h1><div class="card scanbox"><label>Scan a label QR / barcode, or type a unit ID and press Enter
  <input id="scanin" autocomplete="off" autocapitalize="characters" placeholder="e.g. KG1001-01" autofocus></label>
  <div class="bar" style="margin-top:10px"><label style="display:flex;gap:8px;align-items:center;font-size:17px"><input type="checkbox" id="undo" style="width:28px;min-height:28px"> Move back a stage instead</label></div>
  <div id="scanres"></div></div><h2>Recent scans</h2><div id="recent" class="card"></div>`}
};
function qrSvg(text){const q=qrcode(0,'M');q.addData(text);q.make();return q.createSvgTag({cellSize:2,margin:0,scalable:true})}
function label(j,u,m){const dd=d=>new Date(d+'T12:00').toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'2-digit'});
 const idx=j.units.indexOf(u)+1;
 if(u.desc!==undefined&&u.loc!==undefined)return `<div class="label ${m} sheetlbl"><div><div class="l-top"><span>${esc(j.customer)}</span><span>${esc(j.extJob||j.no)}${j.ref?' · '+esc(j.ref):''}</span></div>
 <div class="l-loc">${esc(u.loc)}</div><div class="l-wp"><span>W/No <b>${esc(u.wno)}</b></span><span><b>${esc(u.pos)}</b></span></div>
 <div class="l-size">${u.w} × ${u.h} mm</div><div class="l-spec">${esc(u.desc)}${u.geo?` · <b>${geoText(u)}</b>`:''}${u.lead?` · <b>${leadText(u)}</b>`:''}</div><div class="l-glass">${isARated(u,j)?'<span class="arated">A-RATED</span> ':''}${esc(glassLine(u,j))}</div>${u.note?`<div class="l-note">${esc(u.note)}</div>`:''}${u.panel?'<div class="l-note">PANEL – NOT GLASS</div>':''}
 <div class="l-id">${u.id}</div></div>
 <div class="l-qr">${qrSvg(u.id)}<div class="l-due">${j.glassReq?'GLASS '+dd(j.glassReq):'DUE '+dd(j.due)}</div><div>Req ${dd(j.due)}</div><div>${u.of?`${u.of[0]} of ${u.of[1]} · `:''}item ${idx}/${j.units.length}</div></div></div>`;
 return `<div class="label ${m}"><div><div class="l-top"><span>KEARGLAZE</span><span>${j.no}</span></div>
 <div class="l-cust">${esc(j.customer)}</div><div class="l-id">${u.id}</div><div class="l-size">${u.w} × ${u.h} mm</div>
 <div class="l-spec">${u.centre?'TRIPLE':'DOUBLE'} · ${u.thick}mm overall<br>Out: ${u.outer}${u.centre?' · Ctr: '+u.centre:''} · In: ${u.inner}<br>Spacer: ${u.spacerMm}mm ${u.spacer} · Gas: ${u.gas}</div></div>
 <div class="l-qr">${qrSvg(u.id)}<div class="l-due">DUE ${new Date(j.due+'T12:00').toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'2-digit'})}</div><div>Unit ${j.units.indexOf(u)+1}/${j.units.length}</div></div></div>`}

function route(){const [v,arg]=(location.hash.slice(1)||'board').split('/');const fn=views[v]||views.board;
 app.innerHTML=fn(arg);document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('on',a.dataset.nav===v));
 if(v==='new'){addLine();}
 if(v==='quick'){qRow();qRow();if(typeof pendingReview!=='undefined'&&pendingReview){const r=pendingReview;pendingReview=null;fillReview(r)}else{scanResult=null;app.querySelector('[name=extJob]').focus()}}
 if(v==='scan'){const i=$('#scanin');i.focus();renderRecent()}
 window.scrollTo(0,0)}
function addLine(){const n=$('#tpl').content.cloneNode(true);$('#lines').appendChild(n);updThick()}
function updThick(){document.querySelectorAll('#lines .line').forEach(l=>{const g=k=>l.querySelector(`[name=${k}]`).value;const tri=g('type')==='Triple';l.querySelector('.centre').hidden=!tri;
 l.querySelector('[name=thick]').value=thickness({outer:g('outer'),inner:g('inner'),centre:tri?g('centre'):'',spacerMm:g('spacerMm')})+' mm'})}
function qRow(){const tb=$('#qt tbody');const prev=tb.lastElementChild;const pv=k=>prev?prev.querySelector(`[name=${k}]`).value:'';
 const tr=document.createElement('tr');tr.innerHTML=`<td class="rn"></td><td><input name="loc" value="${esc(pv('loc'))}"></td><td><input name="wno" style="width:70px"></td><td><input name="pos" style="width:130px" placeholder="Pane:1(S)"></td><td><input name="qty" type="number" min="1" style="width:80px" inputmode="numeric"></td><td><input name="size" style="width:140px" placeholder="475x708" inputmode="numeric"></td><td><input name="desc" value="${esc(pv('desc')||'28mm Unglazed')}"></td><td><input name="note" placeholder="e.g. Toughened"></td><td><select name="bar" style="min-height:46px;margin:0;width:110px"><option value="">Job default</option><option value="Grey plastic (warm edge)">Grey WE</option><option value="Silver aluminium">Silver alu</option></select></td><td><select name="geo" style="min-height:46px;margin:0;width:90px"><option value="">None</option><option value="18">18mm</option><option value="25">25mm</option></select></td><td><input name="pat" list="geopresets" style="width:80px" placeholder="2x4"></td><td><input name="lead" list="geopresets" style="width:80px" placeholder="none"></td><td><input name="leadW" list="leadwidths" style="width:66px" value="6"></td><td><input type="checkbox" name="panel" style="width:28px;min-height:28px"></td><td><button type="button" class="btn small sec qdel">✕</button></td>`;
 tb.appendChild(tr);qNum();return tr}
function qNum(){const rows=[...document.querySelectorAll('#qt tbody tr')];let n=0,a=0;rows.forEach((r,i)=>{r.querySelector('.rn').textContent=i+1;const p=qParse(r);if(p){n+=p.qty;a+=p.qty*p.w*p.h}});const t=$('#qtot');if(t)t.textContent=`Total items: ${n} · Total area: ${(a/1e6).toFixed(2)} m²`}
function qParse(r){const g=k=>r.querySelector(`[name=${k}]`).value.trim();const m=g('size').match(/(\d+)\s*[x×*X ]\s*(\d+)/);const qty=parseInt(g('qty'))||(m?1:0);if(!m||!qty)return null;
 return {loc:g('loc'),wno:g('wno'),pos:g('pos'),qty,w:+m[1],h:+m[2],desc:g('desc'),note:g('note'),bar:r.querySelector('[name=bar]').value,geo:r.querySelector('[name=geo]').value,pat:g('pat'),leadPat:g('lead'),leadW:g('leadW'),panel:r.querySelector('[name=panel]').checked||isPanel(g('desc'))}}
let recent=[];
function renderRecent(){const r=$('#recent');if(r)r.innerHTML=recent.map(x=>`<div>${x}</div>`).join('')||'No scans yet'}
function doScan(val){const back=$('#undo').checked;const f=advance(val,back);const res=$('#scanres');
 if(!f){res.innerHTML=`<div class="scanres err">❌ Unit <b>${esc(val)}</b> not found</div>`;navigator.vibrate&&navigator.vibrate(300);return}
 const msg=f.done?`⚠ ${f.unit.id} already Dispatched`:`✅ <b>${f.unit.id}</b> → ${pill(f.unit.stage)} &nbsp; ${f.unit.w}×${f.unit.h} · ${esc(f.job.customer)}`;
 res.innerHTML=`<div class="scanres ${f.done?'err':'ok'}">${msg}</div>`;recent.unshift(new Date().toLocaleTimeString('en-GB')+' – '+msg);recent=recent.slice(0,15);renderRecent()}

document.addEventListener('click',e=>{const t=e.target.closest('#qadd,.qdel,[data-adv],[data-back],[data-filter],[data-mode],[data-start],[data-panels],[data-del],[data-print],#addline,.rm,#resetDemo');if(!t)return;
 if(t.id==='qadd')qRow();
 else if(t.classList.contains('qdel')){t.closest('tr').remove();qNum()}
 else if(t.dataset.adv){const f=advance(t.dataset.adv);toast(`${f.unit.id} → ${STAGES[f.unit.stage]}`);route()}
 else if(t.dataset.back){const f=advance(t.dataset.back,true);toast(`${f.unit.id} ← ${STAGES[f.unit.stage]}`);route()}
 else if(t.dataset.panels){incPanels=!incPanels;route()}
 else if(t.dataset.mode){labelMode=t.dataset.mode;route()}
 else if(t.dataset.start){startPos=+t.dataset.start;route()}
 else if(t.dataset.filter){filter=t.dataset.filter;route()}
 else if(t.dataset.del){if(confirm('Delete job '+t.dataset.del+'?')){db.jobs=db.jobs.filter(j=>j.no!==t.dataset.del);save();location.hash='#jobs'}}
 else if(t.dataset.print)printLabels(t.dataset.print);
 else if(t.id==='addline')addLine();
 else if(t.classList.contains('rm')){if(document.querySelectorAll('#lines .line').length>1)t.closest('.line').remove()}
 });
document.addEventListener('change',e=>{const gt=e.target;if(gt.dataset.leadline){const j=db.jobs.find(x=>x.no===gt.dataset.geojob);const box=gt.closest('.line');const ln=+gt.dataset.leadline;
  j.units.filter(u=>u.line===ln).forEach(u=>Object.assign(u,leadFields(box.querySelector('[data-f=lead]').value,box.querySelector('[data-f=leadW]').value)));save();toast('Line '+ln+': '+(leadText(j.units.find(u=>u.line===ln))||'no lead'));route();return}if(gt.dataset.geoline){const j=db.jobs.find(x=>x.no===gt.dataset.geojob);const box=gt.closest('.line');
  const geo=box.querySelector('[data-f=geo]').value,pat=box.querySelector('[data-f=pat]').value||(geo?'2x2':'');j.units.filter(u=>u.line===+gt.dataset.geoline).forEach(u=>Object.assign(u,geoFields(geo,pat)));save();toast('Line '+gt.dataset.geoline+': '+(geoText(j.units.find(u=>u.line===+gt.dataset.geoline))||'no Georgian'));route();return}
 if(e.target.dataset.jobbar){const j=db.jobs.find(x=>x.no===e.target.dataset.jobbar);j.spacer=e.target.value;save();toast(j.no+' bar: '+j.spacer);route();return}if(e.target.closest('#lines'))updThick();if(e.target.id==='jobpick')location.hash='#labels'+(e.target.value?'/'+e.target.value:'')});
document.addEventListener('input',e=>{const r=e.target.closest('#qt tbody tr');if(r){if(e.target.name==='desc')r.querySelector('[name=panel]').checked=isPanel(e.target.value);qNum();if(!r.nextElementSibling&&e.target.value)qRow()}});
document.addEventListener('keydown',e=>{const r=e.target.closest&&e.target.closest('#qt tbody tr');if(r&&e.key==='Enter'){e.preventDefault();const nx=r.nextElementSibling||qRow();nx.querySelector(`[name=${e.target.name}]`).focus();return}if(e.target.id==='scanin'&&e.key==='Enter'){e.preventDefault();const v=e.target.value.trim();if(v)doScan(v);e.target.value='';e.target.focus()}});
document.addEventListener('submit',e=>{if(e.target.id==='quickform'){e.preventDefault();const f=e.target;
 const lines=[...document.querySelectorAll('#qt tbody tr')].map(qParse).filter(Boolean);if(!lines.length){toast('Add at least one line');return}
 const no='KG-'+f.extJob.value.trim().toUpperCase();if(db.jobs.some(j=>j.no===no)&&!confirm(no+' already exists – replace it?'))return;
 db.jobs=db.jobs.filter(j=>j.no!==no);
 const job=sheetJob({no,extJob:f.extJob.value.trim(),customer:f.customer.value.trim(),ref:f.ref.value.trim(),due:f.due.value,glassReq:f.glassReq.value,notes:f.notes.value.trim(),spacer:f.jobbar.value,lines:lines.map(l=>[l.loc,l.wno,l.pos,l.qty,l.w,l.h,l.desc,l.note,l.panel,l.bar,l.geo,l.pat,l.leadPat,l.leadW])});
 scanResult=null;db.jobs.push(job);save();toast(`Saved ${job.extJob} – ${job.units.length} items, ${area(job.units).toFixed(2)} m²`);location.hash='#job/'+job.no;return}
 if(e.target.id!=='newjob')return;e.preventDefault();const f=e.target;
 const job={no:'KG'+db.nextNo++,customer:f.customer.value.trim(),due:f.due.value,notes:f.notes.value.trim(),created:new Date().toISOString(),units:[]};
 document.querySelectorAll('#lines .line').forEach((l,li)=>{const g=k=>l.querySelector(`[name=${k}]`).value;const line={w:g('w'),h:g('h'),outer:g('outer'),inner:g('inner'),centre:g('type')==='Triple'?g('centre'):'',spacer:g('spacer'),spacerMm:g('spacerMm'),gas:g('gas')};
  for(let q=0;q<+g('qty');q++)job.units.push(makeUnit(job,li+1,line))});
 db.jobs.push(job);save();toast(`Saved ${job.no} – ${job.units.length} units`);location.hash='#job/'+job.no});
function setPage(mode){let s=$('#pagestyle');if(!s){s=document.createElement('style');s.id='pagestyle';document.head.appendChild(s)}
 s.textContent=mode==='roll'?'@page{size:100mm 50mm;margin:0}':mode==='cut'?'@page{size:A4 portrait;margin:10mm}':'@page{size:A4 portrait;margin:0}';document.body.classList.remove('print-roll','print-avery','print-cut');document.body.classList.add('print-'+mode)}
function printLabels(mode){setPage(mode==='avery'?'avery':'roll');window.print()}
window.kg={setPage};
addEventListener('hashchange',route);route();

// ---- edit save ----
function saveEdit(f){const j=db.jobs.find(x=>x.no===f.dataset.no);const g=(r,k)=>r.querySelector(`[name=${k}]`);
 Object.assign(j,{customer:f.customer.value.trim(),extJob:f.extJob.value.trim(),ref:f.ref.value.trim(),due:f.due.value,glassReq:f.glassReq.value,notes:f.notes.value.trim(),spacer:f.jobbar.value});
 let maxN=Math.max(0,...j.units.map(u=>+(u.id.split('-').pop())||0));let maxLine=Math.max(0,...j.units.map(u=>u.line));const keep=[];
 [...document.querySelectorAll('#et tbody tr')].forEach(r=>{const qty=Math.max(0,parseInt(g(r,'qty').value)||0),w=+g(r,'w').value,h=+g(r,'h').value;if(!w||!h)return;
  const ln=r.dataset.ln?+r.dataset.ln:++maxLine;const old=j.units.filter(u=>u.line===ln);
  const fields={w,h,loc:g(r,'loc').value.trim(),wno:g(r,'wno').value.trim(),pos:g(r,'pos').value.trim(),desc:g(r,'desc').value.trim(),note:g(r,'note').value.trim(),spacer:g(r,'bar').value,panel:g(r,'panel').checked||isPanel(g(r,'desc').value),
   ...geoFields(g(r,'geo').value,g(r,'pat').value||'2x2'),...leadFields(g(r,'lead').value,g(r,'leadW').value)};
  if(!fields.desc&&old[0]&&old[0].outer)delete fields.desc;
  for(let i=0;i<qty;i++){let u=old[i];if(!u){u={id:j.no+'-'+String(++maxN).padStart(2,'0'),line:ln,outer:'',inner:'',centre:'',spacerMm:0,gas:'',stage:0,history:[{stage:0,at:new Date().toISOString()}]};if(old[0]&&old[0].outer)Object.assign(u,{outer:old[0].outer,inner:old[0].inner,centre:old[0].centre,spacerMm:old[0].spacerMm,gas:old[0].gas})}
   Object.assign(u,fields,{of:[i+1,qty]});if(u.desc)u.thick=parseFloat(u.desc)||u.thick;keep.push(u)}});
 j.units=keep;save();toast('Saved '+(j.extJob||j.no)+' – '+keep.length+' units');location.hash='#job/'+j.no}
document.addEventListener('submit',e=>{if(e.target.id==='editform'){e.preventDefault();saveEdit(e.target)}});
document.addEventListener('click',e=>{const t=e.target;
 if(t.id==='eAdd'){const tb=document.querySelector('#et tbody');tb.appendChild(document.getElementById('erow').content.cloneNode(true))}
 if(t.id==='sExport')exportBackup();
 if(t.id==='sDemo'){loadDemo();toast('Demo data loaded');route()}
 if(t.id==='sDelDemo'&&confirm('Remove every job whose customer starts with "DEMO"?')){db.jobs=db.jobs.filter(j=>!/^DEMO/i.test(j.customer));save();toast('Demo jobs removed');route()}
 if(t.id==='sWipe'&&confirm('Erase ALL jobs and settings on this device? Export a backup first!')&&confirm('Really erase everything?')){Store.removeItem('kearglaze-factory-v1');Store.removeItem('kearglaze-cut-settings-v1');Store.removeItem('kearglaze-cut-done');db={jobs:[],nextNo:1001,seeded:(db.seeded||[])};save();route()}});
document.addEventListener('change',e=>{if(e.target.id==='sImport'&&e.target.files[0]){const fr=new FileReader();fr.onload=()=>{try{const obj=JSON.parse(fr.result);
  const n=(JSON.parse(obj.data['kearglaze-factory-v1']||'{"jobs":[]}').jobs||[]).length;
  const mode=confirm(`Backup from ${new Date(obj.exported).toLocaleString('en-GB')} with ${n} job(s).\n\nOK = MERGE into this device (add/update by job number)\nCancel = choose REPLACE instead`)?'merge':(confirm('REPLACE everything on this device with the backup? This cannot be undone.')?'replace':null);
  if(!mode)return;const r=Store.importAll(obj,mode);db=Store.loadDB()||{jobs:[],nextNo:1001,seeded:[]};if(!db.seeded)db.seeded=db.jobs.map(j=>j.no);
  if(typeof cutSet!=='undefined')Object.assign(cutSet,Store.getJSON('kearglaze-cut-settings-v1',{}));
  toast(mode==='merge'?`Merged: ${r.added} added, ${r.updated} updated`:`Restored ${r.jobs} jobs`);route()}catch(err){alert('Import failed: '+err.message)}};fr.readAsText(e.target.files[0]);e.target.value=''}});
function exportBackup(){const data=Store.exportAll();const blob=new Blob([JSON.stringify(data,null,1)],{type:'application/json'});const a=document.createElement('a');
 a.href=URL.createObjectURL(blob);a.download='kearglaze-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
 Store.markBackup();toast('Backup exported – keep the file safe');if(typeof backupBanner==='function')backupBanner();if(location.hash==='#settings')route()}
