// Cutting lists: glass panes + spacer bar optimisation (first-fit-decreasing)
const CUT_KEY='kearglaze-cut-settings-v1';
const CUT_DEFAULTS={paneDeduct:0,baseGlass:'4mm Float',obscurePane:'outer',greyOuter:'4mm Float',greyInner:'4mm Low-E',aluOuter:'4mm Float',aluInner:'4mm Float',toughOuter:'4mm Toughened',toughGreyInner:'4mm Toughened Low-E',toughAluInner:'4mm Toughened',paneThk:4,spacerOverride:'',greyDeduct:32,aluDeduct:24,stock:5000,kerf:3,endTrim:10,spacerType:'Grey plastic (warm edge)',geoIntGrey:24,geoIntAlu:24,geoEdgeGrey:1,geoEdgeAlu:1,geoCross18:18,geoCross25:25,geoStock:5000,leadSpace:'glass',leadFaces:2,geoJoint:'seg'};
let cutSet=Object.assign({},CUT_DEFAULTS,Store.getJSON(CUT_KEY,{}));
if(cutSet.v3&&!cutSet.v5){cutSet.geoIntAlu=24;cutSet.geoEdgeGrey=cutSet.geoEdgeGrey??1;cutSet.geoEdgeAlu=cutSet.geoEdgeAlu??1;delete cutSet.geoEdge;cutSet.v5=1;Store.setJSON(CUT_KEY,cutSet)}
if(cutSet.v3&&!cutSet.v4){cutSet.geoJoint='seg';cutSet.v4=1;Store.setJSON(CUT_KEY,cutSet)}
if(!cutSet.v3){cutSet=Object.assign({},CUT_DEFAULTS,{stock:cutSet.stock,kerf:cutSet.kerf,endTrim:cutSet.endTrim,greyDeduct:cutSet.greyDeduct,aluDeduct:cutSet.aluDeduct,paneDeduct:cutSet.paneDeduct});cutSet.v3=1;cutSet.v4=1;cutSet.v5=1;Store.setJSON(CUT_KEY,cutSet)}
const saveCut=()=>Store.setJSON(CUT_KEY,cutSet);
let cutSel=null, cutDone=Store.getJSON('kearglaze-cut-done',{});
const isAlu=t=>/alu|silver/i.test(t||'');
// Spacer frame = GLASS size minus TOTAL deduction per dimension, keyed by bar type
function frameSize(gw,gh,barType){const d=isAlu(barType)?+cutSet.aluDeduct:+cutSet.greyDeduct;return {fw:gw-d,fh:gh-d,d}}
function barName(t){return isAlu(t)?'Silver aluminium':'Grey plastic (warm edge)'}
const cap=s=>s.replace(/\b\w/g,c=>c.toUpperCase());
const OBSC=/obscure|digital|satin|frost/i;
function barOf(u,j){return u.spacer||(j&&j.spacer)||cutSet.spacerType}
function panesFor(u,j){
  const triple=!!u.centre; const n=triple?3:2; const bt=barOf(u,j); const alu=isAlu(bt);
  let types;
  if(u.desc!==undefined&&!u.outer){const o=alu?cutSet.aluOuter:cutSet.greyOuter,i=alu?cutSet.aluInner:cutSet.greyInner;types=triple?[o,cutSet.baseGlass,i]:[o,i]}
  else{types=triple?[u.outer,u.centre,u.inner]:[u.outer,u.inner];types=types.map(t=>cap(t.replace('float','Float')))}
  const note=(u.note||'').trim();
  if(/tough/i.test(note))types=types.map((t,k)=>k===n-1?(alu?cutSet.toughAluInner:cutSet.toughGreyInner):cutSet.toughOuter);
  if(OBSC.test(note)){const i=cutSet.obscurePane==='inner'?n-1:0;types[i]='4mm '+cap(note.replace(/\b(\d+mm)\s*/,''))}
  const pos=triple?['Outer','Centre','Inner']:['Outer','Inner'];
  const d=+cutSet.paneDeduct||0;
  return types.map((t,i)=>({type:t,w:u.w-d,h:u.h-d,pane:pos[i]}));
}
function spacerWidth(u){
  if(cutSet.spacerOverride!=='')return +cutSet.spacerOverride;
  if(u.spacerMm)return u.spacerMm;
  const o=parseFloat(u.desc)||u.thick||28;const panes=u.centre?3:2;
  return Math.round((o-panes*cutSet.paneThk)/(panes-1));
}
function ffd(pieces,stock,kerf,trim){
  const usable=stock-trim;const bars=[];
  pieces.slice().sort((a,b)=>b.len-a.len).forEach(p=>{
    if(p.len>usable){bars.push({cuts:[p],used:p.len,over:true});return}
    let b=bars.find(b=>!b.over&&b.used+kerf+p.len<=usable+1e-9&&(b.cuts.length===0||true)&&b.used+(b.cuts.length?kerf:0)+p.len<=usable);
    if(!b){b={cuts:[],used:0};bars.push(b)}
    b.used+= (b.cuts.length?kerf:0)+p.len;b.cuts.push(p)});
  bars.forEach(b=>b.offcut=Math.max(0,usable-b.used));return bars;
}
function cutData(jobs){
  const units=[];jobs.forEach(j=>j.units.filter(u=>!u.panel).forEach(u=>units.push({j,u})));
  const glass={};units.forEach(({j,u})=>panesFor(u,j).forEach(p=>{
    const g=glass[p.type]=glass[p.type]||{};const k=p.w+'x'+p.h;const r=g[k]=g[k]||{w:p.w,h:p.h,qty:0,ids:[],where:new Set()};
    r.qty++;r.ids.push(u.id+(p.pane?' '+p.pane[0]:''));r.where.add(u.loc?`${u.loc} · W${u.wno} · ${u.pos}`:j.no)}));
  const spacers={};units.forEach(({j,u})=>{const sw=spacerWidth(u);const bt=u.spacer||j.spacer||cutSet.spacerType;const key=`${sw}mm ${barName(bt)}`;
    const pd=+cutSet.paneDeduct||0;const {fw,fh}=frameSize(u.w-pd,u.h-pd,bt);const gaps=u.centre?2:1;
    const s=spacers[key]=spacers[key]||{frames:[],pieces:[]};
    for(let g=0;g<gaps;g++){s.frames.push({id:u.id,fw,fh,where:u.loc?`${u.loc} W${u.wno} ${u.pos}`:j.no});
      [fw,fw,fh,fh].forEach(len=>s.pieces.push({len,id:u.id}))}});
  Object.values(spacers).forEach(s=>{s.bars=ffd(s.pieces,+cutSet.stock,+cutSet.kerf,+cutSet.endTrim);
    s.total=s.pieces.reduce((a,p)=>a+p.len,0);s.waste=1-s.total/(s.bars.length*cutSet.stock)});
  const geo={};units.forEach(({j,u})=>{const g=geoCuts(u,j);if(!g)return;const G=geo[u.geo]=geo[u.geo]||{rows:{},pieces:[],crosses:0,endKeys:0,units:0};
   G.units++;G.crosses+=g.crosses;G.endKeys+=g.endKeys;g.cuts.forEach(c=>{const k=c.kind+'|'+c.len;const r=G.rows[k]=G.rows[k]||{...c,qty:0,ids:[]};r.qty+=c.qty;r.ids.push(u.id+(c.qty>1?'×'+c.qty:''));for(let i=0;i<c.qty;i++)G.pieces.push({len:c.len,id:u.id})})});
  Object.values(geo).forEach(G=>{G.bars=ffd(G.pieces,+cutSet.geoStock,+cutSet.kerf,+cutSet.endTrim);G.total=G.pieces.reduce((a,p)=>a+p.len,0);G.waste=G.bars.length?1-G.total/(G.bars.length*cutSet.geoStock):0});
  return {units,glass,spacers,geo};
}
function cutView(arg){
  if(cutSel===null||arg){cutSel=new Set(arg?arg.split(','):db.jobs.filter(j=>j.units.some(u=>u.stage<=1)).map(j=>j.no))}
  const jobs=db.jobs.filter(j=>cutSel.has(j.no));const D=cutData(jobs);const S=cutSet;
  const num=(k,l,step=1)=>`<div><label>${l}<input type="number" step="${step}" data-set="${k}" value="${esc(S[k])}"></label></div>`;
  let gtot=0,ptot=0;
  const gl=Object.entries(D.glass).sort().map(([t,g])=>{const rows=Object.values(g).sort((a,b)=>b.w*b.h-a.w*a.h||b.w-a.w);
    const m2=rows.reduce((a,r)=>a+r.w*r.h*r.qty,0)/1e6;const q=rows.reduce((a,r)=>a+r.qty,0);gtot+=m2;ptot+=q;
    return `<div class="cutgroup"><h2>${esc(t)} <span class="sub">${q} panes · ${m2.toFixed(2)} m²</span></h2><table class="cut"><tr><th>✓</th><th>W × H mm</th><th>Qty</th><th>m²</th><th>Location / W/No / Position</th><th>Unit IDs (O=outer, I=inner)</th></tr>
    ${rows.map(r=>{const k='g|'+t+'|'+r.w+'x'+r.h;return `<tr><td><input type="checkbox" class="tick" data-done="${esc(k)}" ${cutDone[k]?'checked':''}></td><td class="big">${r.w} × ${r.h}</td><td class="big">${r.qty}</td><td>${(r.w*r.h*r.qty/1e6).toFixed(3)}</td><td>${[...r.where].map(esc).join('<br>')}</td><td class="ids">${r.ids.join(', ')}</td></tr>`}).join('')}</table></div>`}).join('');
  const sp=Object.entries(D.spacers).map(([key,s])=>{
    const fr={};s.frames.forEach(f=>{const k=f.fw+'x'+f.fh;(fr[k]=fr[k]||{...f,qty:0,ids:[]}).qty++;fr[k].ids.push(f.id)});
    return `<div class="cutgroup"><h2>Spacer ${esc(key)} <span class="sub">${s.frames.length} frames · ${s.pieces.length} lengths · ${(s.total/1000).toFixed(2)} m · <b>${s.bars.length} bars of ${S.stock}mm</b> · waste ${(s.waste*100).toFixed(1)}%</span></h2>
    <table class="cut"><tr><th>✓</th><th>Frame W × H mm</th><th>Frames</th><th>Cut</th><th>Location</th><th>Unit IDs</th></tr>${Object.values(fr).sort((a,b)=>b.fw-a.fw).map(f=>{const k='f|'+key+'|'+f.fw+'x'+f.fh;return `<tr><td><input type="checkbox" class="tick" data-done="${esc(k)}" ${cutDone[k]?'checked':''}></td><td class="big">${f.fw} × ${f.fh}</td><td class="big">${f.qty}</td><td style="white-space:nowrap">${f.qty*2} × ${f.fw}<br>${f.qty*2} × ${f.fh}</td><td>${esc(f.where)}</td><td class="ids">${f.ids.join(', ')}</td></tr>`}).join('')}</table>
    <h3>Bar cutting patterns (stock ${S.stock}mm, end trim ${S.endTrim}mm, kerf ${S.kerf}mm)</h3>
    ${s.bars.map((b,i)=>{const k='b|'+key+'|'+i;return `<div class="barrow"><input type="checkbox" class="tick" data-done="${esc(k)}" ${cutDone[k]?'checked':''}><b>Bar ${i+1}</b><div class="bar-vis">${b.cuts.map(c=>`<span style="width:${c.len/S.stock*100}%">${c.len}</span>`).join('')}<i style="flex:1"></i></div><span class="pat">${b.cuts.map(c=>c.len).join(' + ')} · offcut <b>${Math.round(b.offcut)}mm</b>${b.over?' ⚠ longer than stock bar':''}</span></div>`}).join('')}</div>`}).join('');
  const gg=Object.entries(D.geo).sort().map(([w,G])=>`<div class="cutgroup"><h2>Georgian ${w}mm <span class="sub">${G.units} units · ${G.pieces.length} cuts · ${(G.total/1000).toFixed(2)} m · <b>${G.bars.length} bars of ${S.geoStock}mm</b> · waste ${(G.waste*100).toFixed(1)}% · <b>${G.crosses} cross keys, ${G.endKeys} end keys</b></span></h2>
   <table class="cut"><tr><th>✓</th><th>Cut length mm</th><th>Qty</th><th>Type</th><th>Unit IDs</th></tr>${Object.values(G.rows).sort((a,b)=>b.len-a.len).map(r=>{const k='geo|'+w+'|'+r.kind+'|'+r.len;return `<tr><td><input type="checkbox" class="tick" data-done="${esc(k)}" ${cutDone[k]?'checked':''}></td><td class="big">${r.len}</td><td class="big">${r.qty}</td><td>${r.kind}</td><td class="ids">${r.ids.join(', ')}</td></tr>`}).join('')}</table>
   <h3>Bar cutting patterns (stock ${S.geoStock}mm, end trim ${S.endTrim}mm, kerf ${S.kerf}mm)</h3>${G.bars.map((b,i)=>{const k='gb|'+w+'|'+i;return `<div class="barrow"><input type="checkbox" class="tick" data-done="${esc(k)}" ${cutDone[k]?'checked':''}><b>Bar ${i+1}</b><div class="bar-vis">${b.cuts.map(c=>`<span style="width:${c.len/S.geoStock*100}%">${c.len}</span>`).join('')}<i style="flex:1"></i></div><span class="pat">${b.cuts.map(c=>c.len).join(' + ')} · offcut <b>${Math.round(b.offcut)}mm</b></span></div>`}).join('')}</div>`).join('');
  const units=D.units.length;
  return `<h1>Cutting lists</h1>
  <div class="card no-print"><b>Jobs:</b><div class="bar" style="margin-top:6px">${db.jobs.map(j=>`<label class="chip ${cutSel.has(j.no)?'on':''}" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" data-cutjob="${j.no}" ${cutSel.has(j.no)?'checked':''} style="width:22px;min-height:22px;margin:0">${esc(j.extJob||j.no)} – ${esc(j.customer)}</label>`).join('')}</div>
  <details><summary style="font-weight:700;cursor:pointer;padding:8px 0">⚙ Cutting settings (saved on this device)</summary><div class="grid">
   ${num('paneDeduct','Pane deduction from unit size (mm)')}<div><label>Default glass (unglazed sheet lines)<input data-set="baseGlass" value="${esc(S.baseGlass)}"></label></div>
   <div><label>Obscure note applies to<select data-set="obscurePane"><option value="outer" ${S.obscurePane==='outer'?'selected':''}>Outer pane</option><option value="inner" ${S.obscurePane==='inner'?'selected':''}>Inner pane</option></select></label></div>
   <div><label>Grey warm edge (A-rated): outer<input data-set="greyOuter" value="${esc(S.greyOuter)}"></label></div><div><label>Grey warm edge (A-rated): inner<input data-set="greyInner" value="${esc(S.greyInner)}"></label></div>
   <div><label>Silver aluminium: outer<input data-set="aluOuter" value="${esc(S.aluOuter)}"></label></div><div><label>Silver aluminium: inner<input data-set="aluInner" value="${esc(S.aluInner)}"></label></div>
   <div><label>Toughened note: outer<input data-set="toughOuter" value="${esc(S.toughOuter)}"></label></div><div><label>Toughened note: inner (grey warm edge)<input data-set="toughGreyInner" value="${esc(S.toughGreyInner)}"></label></div><div><label>Toughened note: inner (aluminium)<input data-set="toughAluInner" value="${esc(S.toughAluInner)}"></label></div>
   ${num('paneThk','Glass thickness for spacer calc (mm)')}<div><label>Spacer width override (blank = auto)<input type="number" data-set="spacerOverride" value="${esc(S.spacerOverride)}"></label></div>
   <div><label>Default bar type (job-sheet lines)<select data-set="spacerType"><option ${!isAlu(S.spacerType)?'selected':''}>Grey plastic (warm edge)</option><option ${isAlu(S.spacerType)?'selected':''}>Silver aluminium</option></select></label></div>
   ${num('greyDeduct','Grey plastic bar: deduct from glass W and H (total mm)',0.5)}${num('aluDeduct','Silver aluminium bar: deduct from glass W and H (total mm)',0.5)}${num('stock','Stock bar length (mm)')}${num('kerf','Saw kerf (mm)',0.5)}${num('endTrim','End trim per bar (mm)')}
   ${num('geoIntGrey','Georgian internal size: deduct from glass, grey warm edge (mm)',0.5)}${num('geoIntAlu','Georgian internal size: deduct from glass, silver aluminium (mm)',0.5)}${num('geoEdgeGrey','Edge key deduction per bar end, grey warm edge (mm)',0.5)}${num('geoEdgeAlu','Edge key deduction per bar end, silver aluminium (mm)',0.5)}${num('geoCross18','Cross key thickness, 18mm bar (mm)',0.5)}${num('geoCross25','Cross key thickness, 25mm bar (mm)',0.5)}${num('geoStock','Georgian stock bar length (mm)')}
   <div><label>Georgian joint method<select data-set="geoJoint"><option value="seg" ${S.geoJoint!=='hfull'?'selected':''}>All bars in segments between cross keys (default)</option><option value="hfull" ${S.geoJoint==='hfull'?'selected':''}>Horizontals full length, verticals in segments</option></select></label></div>
   <div style="align-self:end"><button class="btn sec" id="cutReset" type="button">Reset to defaults</button></div></div>
   <p class="note">⚠ Spacer deductions are your figures (grey −32, aluminium −24 per dimension); pane deduction is a default – <b>check against your own glass, spacer and corner-key setup</b> before cutting.</p></details>
  <div class="bar"><button class="btn" id="cutPrint">🖨 Print A4 cutting lists</button><a class="btn sec" href="#sheets">▦ Sheet plans</a><a class="btn sec" href="#tough">🛒 Toughened order</a><button class="btn sec" id="cutClear">Clear ticks</button></div></div>
  <div class="cutsheet"><div class="cuthead">Kearglaze – Cutting list · ${jobs.map(j=>esc((j.extJob||j.no)+(j.ref?' ('+j.ref+')':''))).join(', ')||'no jobs'} · printed ${new Date().toLocaleDateString('en-GB')} · ${units} sealed units (panels excluded)</div>
  <h1 class="sect">1. Glass cutting list <span class="sub">${ptot} panes · ${gtot.toFixed(2)} m² · pane = unit size − ${S.paneDeduct}mm</span></h1>${gl||'<p>No units.</p>'}
  <h1 class="sect pb">2. Spacer bar cutting list <span class="sub">frame = glass size − ${S.greyDeduct}mm (grey plastic) / − ${S.aluDeduct}mm (silver aluminium) on each of W and H (check against your setup) · 2×W + 2×H straight bars with corner keys</span></h1>${sp||'<p>No units.</p>'}
  <h1 class="sect pb">3. Georgian bar cutting list <span class="sub">internal size = glass − ${S.geoIntGrey} (grey warm edge) / − ${S.geoIntAlu} (silver aluminium); segments = (internal − 2× edge key ${S.geoEdgeGrey}/${S.geoEdgeAlu}mm − crossings × cross key ${S.geoCross18}/${S.geoCross25}mm) ÷ (crossings+1) – <b>check against your setup</b></span></h1>${gg||'<p>No Georgian bars in the selected jobs.</p>'}</div>`;
}
document.addEventListener('change',e=>{const t=e.target;
  if(t.dataset.cutjob){t.checked?cutSel.add(t.dataset.cutjob):cutSel.delete(t.dataset.cutjob);app.innerHTML=cutView()}
  else if(t.dataset.set){cutSet[t.dataset.set]=t.type==='number'&&t.value!==''?+t.value:t.value;saveCut();const o=document.querySelector('details')?.open;app.innerHTML=cutView();if(o)document.querySelector('details').open=true}
  else if(t.dataset.done){cutDone[t.dataset.done]=t.checked;Store.setJSON('kearglaze-cut-done',cutDone)}});
document.addEventListener('click',e=>{const t=e.target;if(t.id==='cutPrint'){setPage('cut');window.print()}
  if(t.id==='cutReset'){cutSet={...CUT_DEFAULTS};saveCut();app.innerHTML=cutView()}
  if(t.id==='cutClear'){cutDone={};Store.setJSON('kearglaze-cut-done',{});app.innerHTML=cutView()}});

// Self-test: user's worked example (glass 660x1200 -> grey 628x1168, aluminium 636x1176)
function cutSelfTest(){const save={...cutSet};cutSet={...CUT_DEFAULTS};const g=frameSize(660,1200,'Grey plastic'),a=frameSize(660,1200,'Aluminium');cutSet=save;
 const ok=g.fw===628&&g.fh===1168&&a.fw===636&&a.fh===1176;return {ok,grey:g.fw+'x'+g.fh,alu:a.fw+'x'+a.fh}}

// Label glass line, e.g. "Outer: Digital Obscure / Inner: Low-E"
function glassLine(u,j){const p=panesFor(u,j);const st=t=>t.replace(/^\d+(\.\d+)?mm\s*/,'');return `Outer: ${st(p[0].type)} / Inner: ${st(p[p.length-1].type)}`}
const isARated=(u,j)=>!isAlu(barOf(u,j));
// Georgian bars (user method): internal size = glass - Georgian internal deduction (grey 24, silver aluminium 24 – confirmed).
// All bars cut into segments between cross keys: deduct edge key (1mm) at each frame end and cross key thickness at each crossing.
function geoCuts(u,j){if(!u.geo)return null;const pd=+cutSet.paneDeduct||0;const alu=isAlu(barOf(u,j));const d=alu?+cutSet.geoIntAlu:+cutSet.geoIntGrey;
 const iw=u.w-pd-d,ih=u.h-pd-d,e=+(alu?cutSet.geoEdgeAlu:cutSet.geoEdgeGrey),ck=+(u.geo==='25'?cutSet.geoCross25:cutSet.geoCross18),nv=u.geoV,nh=u.geoH;const r=x=>Math.round(x*10)/10;const cuts=[];
 const hfull=cutSet.geoJoint==='hfull';
 if(nh){if(nv&&!hfull)cuts.push({kind:'Horizontal segment',len:r((iw-2*e-nv*ck)/(nv+1)),qty:(nv+1)*nh});else cuts.push({kind:'Horizontal (full)',len:r(iw-2*e),qty:nh})}
 if(nv){if(nh)cuts.push({kind:'Vertical segment',len:r((ih-2*e-nh*ck)/(nh+1)),qty:(nh+1)*nv});else cuts.push({kind:'Vertical (full)',len:r(ih-2*e),qty:nv})}
 return {iw,ih,ck,cuts,crosses:nv*nh,endKeys:2*(nv+nh)}}
// Self-tests for pane rules
function paneSelfTest(){const save={...cutSet};cutSet={...CUT_DEFAULTS};const G={spacer:'Grey plastic (warm edge)'},A={spacer:'Silver aluminium'};
 const t=(u,j)=>panesFor({w:500,h:500,desc:'28mm Unglazed',...u},j).map(p=>p.type).join(' | ');
 const cases=[[t({},G),'4mm Float | 4mm Low-E'],[t({},A),'4mm Float | 4mm Float'],[t({note:'Digital Obscure'},G),'4mm Digital Obscure | 4mm Low-E'],[t({note:'Digital Obscure'},A),'4mm Digital Obscure | 4mm Float'],
  [t({note:'Toughened'},G),'4mm Toughened | 4mm Toughened Low-E'],[t({note:'Toughened'},A),'4mm Toughened | 4mm Toughened'],[t({spacer:'Silver aluminium'},G),'4mm Float | 4mm Float']];
 cutSet=save;return cases.map(([got,exp],i)=>({i,ok:got===exp,got,exp}))}

function geoSelfTest(){const save={...cutSet};cutSet={...CUT_DEFAULTS};const G='Grey plastic (warm edge)',A='Silver aluminium';
 const mk=(w,h,geo,pat,spacer=G)=>({id:'T',w,h,desc:'28mm Unglazed',spacer,...geoFields(geo,pat)});
 const f=g=>g.cuts.map(c=>c.qty+'×'+c.len+' '+c.kind).join(', ')+` · ${g.crosses} cross, ${g.endKeys} end keys`;
 const out=[[f(geoCuts(mk(706,1082,'18','2x4'))),'6×331 Horizontal segment, 4×250.5 Vertical segment · 3 cross, 8 end keys','KEY: user example 706x1082 grey 18mm 2 across x 4 up (internal 682x1058)'],
  [f(geoCuts(mk(660,1200,'18','2x2'))),'2×308 Horizontal segment, 2×578 Vertical segment · 1 cross, 4 end keys','660x1200 grey 18mm 2x2 (internal 636x1176)'],
  [f(geoCuts(mk(660,1200,'18','2x1'))),'1×1174 Vertical (full) · 0 cross, 2 end keys','660x1200 grey 18mm 2 across x 1 up (verticals only, full length)'],
  [f(geoCuts(mk(660,1200,'25','3x3'))),'6×194.7 Horizontal segment, 6×374.7 Vertical segment · 4 cross, 8 end keys','660x1200 grey 25mm 3x3 (cross key 25)'],
  [f(geoCuts(mk(660,1200,'18','2x2',A))),'2×308 Horizontal segment, 2×578 Vertical segment · 1 cross, 4 end keys','660x1200 ALUMINIUM 18mm 2x2 (deduct 24, same as grey)']];
 cutSet=save;return out.map(([got,exp,name])=>({ok:got===exp,got:name+': '+got,exp}))}

// Lead centre-lines measured from glass edge. 'glass' = i*W/A ; 'sight' = 12 + i*(W-24)/A (sight area = glass - 24)
function leadCalc(u){const sight=cutSet.leadSpace==='sight',o=sight?12:0,W=u.w,H=u.h,ew=W-2*o,eh=H-2*o,r=x=>Math.round(x*10)/10;
 const v=[],h=[];for(let i=1;i<u.leadA;i++)v.push(r(o+i*ew/u.leadA));for(let j=1;j<u.leadU;j++)h.push(r(o+j*eh/u.leadU));
 const face=(u.leadA-1)*H+(u.leadU-1)*W;return {W,H,v,h,sqW:r(ew/u.leadA),sqH:r(eh/u.leadU),face,faces:+cutSet.leadFaces,total:face*cutSet.leadFaces}}
function leadSelfTest(){const save={...cutSet};cutSet={...CUT_DEFAULTS};const L=leadCalc({w:706,h:1082,...leadFields('2x4',6)});cutSet=save;
 const got=`V ${L.v.join(',')} · H ${L.h.join(',')} · square ${L.sqW}x${L.sqH} · per face ${L.face} · total ${L.total}`;
 const exp='V 353 · H 270.5,541,811.5 · square 353x270.5 · per face 3200 · total 6400';return [{ok:got===exp,got:'LEAD 706x1082 2x4: '+got,exp}]}
function leadSheet(j,u){const L=leadCalc(u);const r=x=>Math.round(x*10)/10;const sc=Math.min(150/L.W,185/L.H);const pw=L.W*sc,ph=L.H*sc,M=22;
 const svg=`<svg viewBox="0 0 ${pw+M*2+30} ${ph+M*2+20}" style="width:${(pw+M*2+30)}mm;height:${(ph+M*2+20)}mm;max-width:100%" font-family="Arial" font-size="3.2">
 <rect x="${M}" y="${M}" width="${pw}" height="${ph}" fill="#eaf6fa" stroke="#000" stroke-width=".5"/>
 ${L.v.map(x=>`<line x1="${M+x*sc}" y1="${M}" x2="${M+x*sc}" y2="${M+ph}" stroke="#333" stroke-width="${Math.max(.6,u.leadW*sc)}"/><line x1="${M+x*sc}" y1="${M-2}" x2="${M+x*sc}" y2="${M+ph+2}" stroke="#c00" stroke-width=".25" stroke-dasharray="1.5,1"/><text x="${M+x*sc}" y="${M-4}" text-anchor="middle" font-weight="bold">${x}</text>`).join('')}
 ${L.h.map(y=>`<line x1="${M}" y1="${M+ph-y*sc}" x2="${M+pw}" y2="${M+ph-y*sc}" stroke="#333" stroke-width="${Math.max(.6,u.leadW*sc)}"/><line x1="${M-2}" y1="${M+ph-y*sc}" x2="${M+pw+2}" y2="${M+ph-y*sc}" stroke="#c00" stroke-width=".25" stroke-dasharray="1.5,1"/><text x="${M+pw+3}" y="${M+ph-y*sc+1.2}" font-weight="bold">${y} ↑</text>`).join('')}
 <text x="${M+pw/2}" y="${M+ph+8}" text-anchor="middle">W ${L.W} (measure verticals from LEFT edge)</text>
 <text x="${M-4}" y="${M+ph/2}" text-anchor="middle" transform="rotate(-90 ${M-4} ${M+ph/2})">H ${L.H} (horizontals from BOTTOM edge)</text></svg>`;
 let cum=0;const vr=L.v.map((x,i)=>{const sp=r(x-(i?L.v[i-1]:0));return `<tr><td>V${i+1}</td><td class="big">${x}</td><td>${r(L.W-x)}</td><td>${sp}</td></tr>`}).join('');
 const hr=L.h.map((y,i)=>{const sp=r(y-(i?L.h[i-1]:0));return `<tr><td>H${i+1}</td><td class="big">${y}</td><td>${r(L.H-y)}</td><td>${sp}</td></tr>`}).join('');
 return `<div class="leadsheet"><div class="cuthead">Kearglaze – Lead marking sheet · ${esc(j.extJob||j.no)} · ${esc(j.customer)} · <b>${u.id}</b> · ${esc(u.loc||'')} W${esc(u.wno||'')} ${esc(u.pos||'')}</div>
 <p><b>${u.w} × ${u.h} mm glass</b> · ${leadText(u)} · centre-lines measured from ${cutSet.leadSpace==='sight'?'glass edge, spaced within sight area (glass − 24)':'glass edge, spaced across full glass'} · square size <b>${L.sqW} × ${L.sqH}</b></p>
 <div class="leadgrid"><div>${svg}</div><div><table class="cut"><tr><th>Line</th><th>From left</th><th>From right</th><th>Spacing</th></tr>${vr||'<tr><td colspan=4>No verticals</td></tr>'}</table><br>
 <table class="cut"><tr><th>Line</th><th>From bottom</th><th>From top</th><th>Spacing</th></tr>${hr||'<tr><td colspan=4>No horizontals</td></tr>'}</table>
 <p>Lead per face: ${L.v.length} × ${L.H} + ${L.h.length} × ${L.W} = <b>${L.face} mm</b><br>Faces: ${L.faces} → <b>total ${(L.total/1000).toFixed(2)} m</b> of ${u.leadW}mm lead</p>
 <p class="note">Mark red dashed centre-lines on the glass; lay lead centred on each line. Check against your setup.</p></div></div></div>`}
function leadView(no){const j=db.jobs.find(x=>x.no===no)||db.jobs.find(x=>x.units.some(u=>u.lead));if(!j)return '<h1>No leaded units</h1>';const us=j.units.filter(u=>u.lead);
 return `<div class="no-print bar"><a class="btn sec" href="#job/${j.no}">← Job</a><button class="btn" id="leadPrint">🖨 Print lead marking sheets (A4, one per unit)</button>
 <label style="width:auto">Space lines within<select data-set="leadSpace" style="width:auto"><option value="glass" ${cutSet.leadSpace!=='sight'?'selected':''}>Full glass (default)</option><option value="sight" ${cutSet.leadSpace==='sight'?'selected':''}>Sight area (glass − 24)</option></select></label>
 <label style="width:auto">Faces<input type="number" data-set="leadFaces" value="${cutSet.leadFaces}" style="width:90px"></label></div>
 <h1 class="no-print">Lead marking – ${esc(j.extJob||j.no)} (${us.length} units)</h1>${us.map(u=>leadSheet(j,u)).join('')||'<p>No leaded units in this job.</p>'}`}
document.addEventListener('click',e=>{if(e.target.id==='leadPrint'){setPage('cut');document.body.classList.add('print-lead');window.print()}});
document.addEventListener('change',e=>{if(e.target.dataset.set&&location.hash.startsWith('#lead'))setTimeout(()=>{app.innerHTML=leadView(location.hash.split('/')[1])},0)});
