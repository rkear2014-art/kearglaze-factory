/* Glass sheet optimiser (guillotine) + toughened glass purchase order.
   Annealed panes are nested on stock sheets; toughened panes are bought in cut-to-size. */
const OPT_KEY='kearglaze-opt-settings-v1';
const OPT_DEFAULTS={sheets:'Obscure|Digital|Satin|Pattern=1250x2250\nFloat|Low-E=2250x1190,2250x1060,2250x980\n*=2250x1190,2250x1060,2250x980',trim:10,kerf:0,rotate:true,noRotate:'Obscure|Digital|Satin|Pattern',minRemnant:300,
 tSupplier:'Bloomsbury Glass',tAddress:'',tEmail:'',tPhone:'',tLeadDays:3};
let optSet=Object.assign({},OPT_DEFAULTS,Store.getJSON(OPT_KEY,{}));
if(!optSet.v2){optSet.sheets=OPT_DEFAULTS.sheets;optSet.tSupplier=optSet.tSupplier||'Bloomsbury Glass';optSet.v2=1;Store.setJSON(OPT_KEY,optSet)}
const saveOpt=()=>Store.setJSON(OPT_KEY,optSet);
const isTough=t=>/tough/i.test(t||'');
function sheetsFor(type){for(const line of String(optSet.sheets).split(/\n|;/)){const m=line.match(/^\s*(.+?)\s*=\s*(.+)$/);if(!m)continue;
  const sz=[...m[2].matchAll(/(\d+)\s*[x×]\s*(\d+)/g)].map(x=>({w:+x[1],h:+x[2]}));if(sz.length&&(m[1].trim()==='*'||new RegExp(m[1],'i').test(type)))return sz}return [{w:2250,h:1190}]}
const sheetFor=type=>sheetsFor(type)[0];
function canRotate(type){return !!optSet.rotate&&!(optSet.noRotate&&new RegExp(optSet.noRotate,'i').test(type))}

// ---- guillotine packer ----
// node: {x,y,w,h, cut:{dir:'across'|'down',at,len}, kids:[], piece}
function packOnce(pieces,S,opts,heur,split){const t=opts.trim,k=opts.kerf;const bins=[];
 const newBin=()=>{const root={x:t,y:t,w:S.w-2*t,h:S.h-2*t,kids:[]};const b={root,free:[root],placed:[]};bins.push(b);return b};
 const score=(f,w,h)=>heur==='baf'?f.w*f.h-w*h:heur==='bssf'?Math.min(f.w-w,f.h-h):heur==='blsf'?Math.max(f.w-w,f.h-h):f.y*1e5+f.x; // 'bl' bottom-left-ish
 for(const p of pieces){let best=null;
  for(const b of bins){for(const f of b.free){for(const rot of (opts.rot?[false,true]:[false])){const w=rot?p.h:p.w,h=rot?p.w:p.h;if(w<=f.w&&h<=f.h){const s=score(f,w,h);if(!best||s<best.s)best={b,f,w,h,rot,s}}}}if(best)break}
  if(!best){const b=newBin();const f=b.root;for(const rot of (opts.rot?[false,true]:[false])){const w=rot?p.h:p.w,h=rot?p.w:p.h;if(w<=f.w&&h<=f.h){best={b,f,w,h,rot};break}}
   if(!best)return null}// piece larger than sheet
  const {b,f,w,h,rot}=best;b.free.splice(b.free.indexOf(f),1);
  const across=split==='sas'?(f.w-w)<(f.h-h):split==='las'?(f.w-w)>=(f.h-h):split==='h';// cut across first?
  let A,B,P,R;
  if(across){A={x:f.x,y:f.y,w:f.w,h:h,kids:[]};B={x:f.x,y:f.y+h+k,w:f.w,h:f.h-h-k,kids:[]};f.cut={dir:'across',at:f.y+h,len:f.w,x:f.x,y:f.y+h};
   P={x:f.x,y:f.y,w,h,kids:[]};R={x:f.x+w+k,y:f.y,w:f.w-w-k,h,kids:[]};if(R.w>0)A.cut={dir:'down',at:f.x+w,len:h,x:f.x+w,y:f.y}}
  else{A={x:f.x,y:f.y,w:w,h:f.h,kids:[]};B={x:f.x+w+k,y:f.y,w:f.w-w-k,h:f.h,kids:[]};f.cut={dir:'down',at:f.x+w,len:f.h,x:f.x+w,y:f.y};
   P={x:f.x,y:f.y,w,h,kids:[]};R={x:f.x,y:f.y+h+k,w,h:f.h-h-k,kids:[]};if(R.h>0)A.cut={dir:'across',at:f.y+h,len:w,x:f.x,y:f.y+h}}
  if(B.w<=0||B.h<=0)delete f.cut;
  f.kids=(B.w>0&&B.h>0)?[A,B]:[A];A.kids=(R.w>0&&R.h>0)?[P,R]:[P];if(!A.cut)A.kids=[P];P.piece={...p,rot};
  [B,R].forEach(n=>{if(n.w>0&&n.h>0&&f.kids.concat(A.kids).includes(n))b.free.push(n)});
  b.placed.push({...p,x:P.x,y:P.y,pw:w,ph:h,rot})}
 return bins}
const SORTS={area:(a,b)=>b.w*b.h-a.w*a.h,long:(a,b)=>Math.max(b.w,b.h)-Math.max(a.w,a.h)||b.w*b.h-a.w*a.h,height:(a,b)=>b.h-a.h||b.w-a.w,width:(a,b)=>b.w-a.w||b.h-a.h,perim:(a,b)=>(b.w+b.h)-(a.w+a.h)};
// best single sheet of size S for the remaining panes (tries all heuristics)
function bestOneSheet(pieces,S,opts){let best=null;
 for(const [sn,sf] of Object.entries(SORTS))for(const heur of ['baf','bssf','blsf','bl'])for(const split of ['sas','las']){
  const fits=pieces.filter(p=>(p.w<=S.w-2*opts.trim&&p.h<=S.h-2*opts.trim)||(opts.rot&&p.h<=S.w-2*opts.trim&&p.w<=S.h-2*opts.trim));if(!fits.length)return null;
  const bins=packOnce(fits.slice().sort(sf),S,opts,heur,split);if(!bins)continue;const b=bins[0];const area=b.placed.reduce((a,p)=>a+p.pw*p.ph,0);
  const rem=Math.max(0,...b.free.map(f=>f.w*f.h));if(!best||area>best.area||(area===best.area&&rem>best.rem))best={b,area,rem,how:`${sn}/${heur}/${split}`,all:b.placed.length===pieces.length}}
 return best}
function planWith(pieces,sizes,opts,mode){let left=pieces.slice();const sheets=[];let guard=0;
 while(left.length&&guard++<500){const cands=sizes.map(S=>({S,r:bestOneSheet(left,S,opts)})).filter(c=>c.r);if(!cands.length)return null;
  const finishing=cands.filter(c=>c.r.all).sort((a,b)=>a.S.w*a.S.h-b.S.w*b.S.h);let pick;
  if(finishing.length)pick=finishing[0];// downsize the last sheet
  else if(mode==='yield')pick=cands.sort((a,b)=>b.r.area/(b.S.w*b.S.h)-a.r.area/(a.S.w*a.S.h))[0];
  else if(mode==='area')pick=cands.sort((a,b)=>b.r.area-a.r.area)[0];
  else pick=cands.find(c=>c.S===sizes[+mode])||cands[0];
  const ids=new Set(pick.r.b.placed.map(p=>p.id));left=left.filter(p=>!ids.has(p.id));sheets.push({S:pick.S,b:pick.r.b,how:pick.r.how})}
 return left.length?null:sheets}
function optimiseType(type,panes){const sizes=sheetsFor(type);const opts={trim:+optSet.trim,kerf:+optSet.kerf,rot:canRotate(type)};
 const tooBig=panes.find(p=>!sizes.some(S=>(p.w<=S.w-2*opts.trim&&p.h<=S.h-2*opts.trim)||(opts.rot&&p.h<=S.w-2*opts.trim&&p.w<=S.h-2*opts.trim)));
 if(tooBig)return {type,S:sizes[0],sizes,error:`Pane ${tooBig.w}×${tooBig.h} (${tooBig.id}) is larger than the stock sheet${sizes.length>1?'s':''}${opts.rot?'':' (no rotation)'}`,panes:panes.length,sheets:[]};
 let best=null;const modes=['yield','area',...sizes.map((_,i)=>String(i))];
 for(const m of modes){const sh=planWith(panes,sizes,opts,m);if(!sh)continue;const tot=sh.reduce((a,x)=>a+x.S.w*x.S.h,0);if(!best||tot<best.tot||(tot===best.tot&&sh.length<best.sh.length))best={sh,tot,mode:m}}
 const used=panes.reduce((a,p)=>a+p.w*p.h,0);const mr=+optSet.minRemnant;
 const sheets=best.sh.map((x,i)=>{const b=x.b;const cuts=[];(function walk(n){if(n.cut)cuts.push(n.cut);n.kids.forEach(walk)})(b.root);
  const rem=b.free.filter(f=>f.w>=mr&&f.h>=mr).sort((a,c)=>c.w*c.h-a.w*a.h);const u=b.placed.reduce((a,p)=>a+p.pw*p.ph,0);return {i:i+1,S:x.S,placed:b.placed,cuts,remnants:rem,yield:u/(x.S.w*x.S.h)}});
 const mix={};sheets.forEach(s=>{const k=s.S.w+'x'+s.S.h;mix[k]=(mix[k]||0)+1});
 const mixText=sizes.map(S=>S.w+'x'+S.h).filter(k=>mix[k]).map(k=>`${mix[k]} x ${k}`).join(', ');
 return {type,S:sizes[0],sizes,opts,sheets,mixText,yield:used/best.tot,wasteM2:(best.tot-used)/1e6,usedM2:used/1e6,stockM2:best.tot/1e6,how:best.mode,panes:panes.length}}
function annealedPanes(jobs){const by={};jobs.forEach(j=>j.units.filter(u=>!u.panel).forEach(u=>panesFor(u,j).forEach(p=>{if(isTough(p.type))return;(by[p.type]=by[p.type]||[]).push({w:p.w,h:p.h,id:u.id+' '+p.pane[0],loc:u.loc?`${u.loc} W${u.wno}`:j.no})})));return by}
function optimiseJobs(jobs){const by=annealedPanes(jobs);return Object.keys(by).sort().map(t=>optimiseType(t,by[t]))}
// ---- independent validity checks (tests) ----
function guillotineOK(rects,reg){if(rects.length<=1)return true;const xs=[...new Set(rects.flatMap(r=>[r.x,r.x+r.pw]))],ys=[...new Set(rects.flatMap(r=>[r.y,r.y+r.ph]))];
 for(const x of xs){if(x<=reg.x||x>=reg.x+reg.w)continue;const L=rects.filter(r=>r.x+r.pw<=x),Rr=rects.filter(r=>r.x>=x);if(L.length+Rr.length===rects.length&&L.length&&Rr.length)return guillotineOK(L,{...reg,w:x-reg.x})&&guillotineOK(Rr,{...reg,x,w:reg.x+reg.w-x})}
 for(const y of ys){if(y<=reg.y||y>=reg.y+reg.h)continue;const T=rects.filter(r=>r.y+r.ph<=y),Bm=rects.filter(r=>r.y>=y);if(T.length+Bm.length===rects.length&&T.length&&Bm.length)return guillotineOK(T,{...reg,h:y-reg.y})&&guillotineOK(Bm,{...reg,y,h:reg.y+reg.h-y})}
 return false}
function checkPlan(res){const t=+optSet.trim;let placed=0,overlap=false,outside=false,guill=true;
 res.sheets.forEach(s=>{const P=s.placed;placed+=P.length;P.forEach((a,i)=>{if(a.x<t||a.y<t||a.x+a.pw>s.S.w-t||a.y+a.ph>s.S.h-t)outside=true;if(!res.opts.rot&&a.rot)outside=true;if(!((a.pw===a.w&&a.ph===a.h)||(a.pw===a.h&&a.ph===a.w)))outside=true;
   for(let j=i+1;j<P.length;j++){const b=P[j];if(a.x<b.x+b.pw&&b.x<a.x+a.pw&&a.y<b.y+b.ph&&b.y<a.y+a.ph)overlap=true}});
  if(!guillotineOK(P,{x:t,y:t,w:s.S.w-2*t,h:s.S.h-2*t}))guill=false});
 return {allPlaced:placed===res.panes,overlap,outside,guillotine:guill}}

// ---- views ----
const selJobs=arg=>{if(arg)cutSel=new Set(arg.split(','));if(cutSel===null)cutSel=new Set(db.jobs.filter(j=>j.units.some(u=>u.stage<=1)).map(j=>j.no));return db.jobs.filter(j=>cutSel.has(j.no))};
const jobChips=()=>`<div class="bar">${db.jobs.map(j=>`<label class="chip ${cutSel.has(j.no)?'on':''}" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" data-optjob="${j.no}" ${cutSel.has(j.no)?'checked':''} style="width:22px;min-height:22px;margin:0">${esc(j.extJob||j.no)}</label>`).join('')}</div>`;
function sheetSvg(res,s){const S=s.S,sc=Math.min(180/S.w,230/S.h),Wd=S.w*sc,H=S.h*sc;const col=['#cfe8f3','#d9f2d0','#fde7c8','#e6dcf5','#f8d7da','#e0f0ee'];
 return `<svg viewBox="-8 -8 ${Wd+16} ${H+16}" style="width:100%;max-width:${Math.max(60,Wd+16)}mm;max-height:240mm" font-family="Arial">
 <rect x="0" y="0" width="${Wd}" height="${H}" fill="#f4f4f4" stroke="#000" stroke-width=".4"/>
 <rect x="${res.opts.trim*sc}" y="${res.opts.trim*sc}" width="${(S.w-2*res.opts.trim)*sc}" height="${(S.h-2*res.opts.trim)*sc}" fill="none" stroke="#999" stroke-width=".15" stroke-dasharray="1,1"/>
 ${s.remnants.map(r=>`<rect x="${r.x*sc}" y="${r.y*sc}" width="${r.w*sc}" height="${r.h*sc}" fill="url(#hatch)" stroke="#2e7d32" stroke-width=".3"/><text x="${(r.x+r.w/2)*sc}" y="${(r.y+r.h/2)*sc}" font-size="2.4" text-anchor="middle" fill="#2e7d32">REMNANT ${Math.round(r.w)}×${Math.round(r.h)}</text>`).join('')}
 ${s.placed.map((p,i)=>{const fs=Math.min(3.2,p.pw*sc/9,p.ph*sc/3.5);return `<rect x="${p.x*sc}" y="${p.y*sc}" width="${p.pw*sc}" height="${p.ph*sc}" fill="${col[i%col.length]}" stroke="#000" stroke-width=".3"/>
  <text x="${(p.x+p.pw/2)*sc}" y="${(p.y+p.ph/2)*sc-fs*0.6}" font-size="${fs}" text-anchor="middle" font-weight="bold">${p.pw}×${p.ph}${p.rot?' ⟲':''}</text>
  <text x="${(p.x+p.pw/2)*sc}" y="${(p.y+p.ph/2)*sc+fs*0.5}" font-size="${fs*0.75}" text-anchor="middle">${esc(p.id)}</text><text x="${(p.x+p.pw/2)*sc}" y="${(p.y+p.ph/2)*sc+fs*1.4}" font-size="${fs*0.7}" text-anchor="middle">${esc(p.loc)}</text>`}).join('')}
 ${s.cuts.map((c,i)=>{const x1=c.x*sc,y1=c.y*sc,x2=c.dir==='across'?(c.x+c.len)*sc:x1,y2=c.dir==='across'?y1:(c.y+c.len)*sc;return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#c62828" stroke-width=".35"/><circle cx="${x1}" cy="${y1}" r="2" fill="#c62828"/><text x="${x1}" y="${y1+0.9}" font-size="2.2" fill="#fff" text-anchor="middle" font-weight="bold">${i+1}</text>`}).join('')}
 <defs><pattern id="hatch" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2" stroke="#9ccc9c" stroke-width=".5"/></pattern></defs>
 <text x="${Wd/2}" y="-2.5" font-size="3" text-anchor="middle">${S.w} mm (top edge)</text><text x="-3" y="${H/2}" font-size="3" text-anchor="middle" transform="rotate(-90 -3 ${H/2})">${S.h} mm</text></svg>`}
function sheetsView(arg){const jobs=selJobs(arg);const R=optimiseJobs(jobs);const O=optSet;const tot=R.reduce((a,r)=>a+(r.sheets?r.sheets.length:0),0);
 const num=(k,l)=>`<div><label>${l}<input type="number" data-opt="${k}" value="${esc(O[k])}"></label></div>`;
 const summary=R.map(r=>r.error?`<tr><td>${esc(r.type)}</td><td colspan=7 style="color:#c62828">${r.error}</td></tr>`:`<tr><td><b>${esc(r.type)}</b></td><td><b>${r.mixText}</b></td><td>${r.panes}</td><td class="big">${r.sheets.length}</td><td class="big">${(r.yield*100).toFixed(1)}%</td><td>${r.wasteM2.toFixed(2)} m²</td><td>${r.sheets.flatMap(s=>s.remnants.map(f=>Math.round(f.w)+'×'+Math.round(f.h))).join(', ')||'–'}</td><td>${r.opts.rot?'yes':'<b>no</b> (pattern one way)'}</td></tr>`).join('');
 const pages=R.filter(r=>!r.error).flatMap(r=>r.sheets.map(s=>`<div class="sheetplan"><div class="cuthead">Kearglaze – Sheet cutting plan · <b>${esc(r.type)}</b> · sheet ${s.i} of ${r.sheets.length} (<b>${s.S.w}×${s.S.h}</b>) · yield ${(s.yield*100).toFixed(1)}% · ${jobs.map(j=>esc(j.extJob||j.no)).join(', ')}</div>
  ${/low-?e/i.test(r.type)?'<div class="note">⚠ LOW-E: coated side UP on the table · edge-delete the coating around each pane before assembly.</div>':''}
  ${!r.opts.rot&&/obsc|digital|satin|pattern/i.test(r.type)?'<div class="note">Patterned glass: no rotation – keep the pattern running the same way on every pane.</div>':''}
  <div class="planrow"><div>${sheetSvg(r,s)}</div><div><table class="cut"><tr><th>#</th><th>Cut (score edge to edge)</th></tr>${s.cuts.map((c,i)=>`<tr><td><b>${i+1}</b></td><td>${c.dir==='across'?'ACROSS':'DOWN'} at ${c.dir==='across'?'y':'x'} = <b>${Math.round(c.at)}</b> · length ${Math.round(c.len)}</td></tr>`).join('')}</table>
  <p style="font-size:12px">Edge trim ${r.opts.trim}mm all round first. Cuts listed parent-first: break off each strip, then cut it down. Positions measured from the sheet's top-left corner.</p>
  <table class="cut"><tr><th>Pane</th><th>Size</th><th>Location</th></tr>${s.placed.map(p=>`<tr><td class="ids">${esc(p.id)}</td><td>${p.w}×${p.h}${p.rot?' (rotated)':''}</td><td>${esc(p.loc)}</td></tr>`).join('')}</table>
  ${s.remnants.length?`<p><b>Remnants to keep:</b> ${s.remnants.map(f=>Math.round(f.w)+'×'+Math.round(f.h)).join(', ')}</p>`:''}</div></div></div>`)).join('');
 return `<h1>▦ Sheet cutting plans</h1><div class="card no-print"><b>Jobs:</b>${jobChips()}
 <details><summary style="font-weight:700;cursor:pointer;padding:8px 0">⚙ Optimiser settings</summary><div class="grid">
 <div style="grid-column:1/-1"><label>Stock sheet sizes – one line per glass type: match = W x H[, W x H …] (several sizes = optimiser picks the best mix; * = anything else)<textarea data-opt="sheets" rows="4">${esc(O.sheets)}</textarea></label></div>
 ${num('trim','Edge trim each edge (mm)')}${num('kerf','Cut gap / kerf (mm)')}${num('minRemnant','Keep remnants at least (mm square)')}
 <div><label>Allow rotation<select data-opt="rotate"><option value="1" ${O.rotate?'selected':''}>Yes</option><option value="" ${O.rotate?'':'selected'}>No</option></select></label></div>
 <div><label>Never rotate types matching<input data-opt="noRotate" value="${esc(O.noRotate)}"></label></div></div></details>
 <div class="bar"><button class="btn" id="optPrint">🖨 Print A4 sheet plans</button><a class="btn sec" href="#tough">🛒 Toughened order</a><a class="btn sec" href="#cut">✂ Cutting lists</a></div></div>
 <div class="card"><h2 style="margin-top:0">Summary – ${tot} sheet${tot===1?'':'s'} · toughened panes are excluded (ordered cut-to-size)</h2><table class="cut"><tr><th>Glass</th><th>Stock sheets used</th><th>Panes</th><th>Sheets</th><th>Yield</th><th>Waste</th><th>Remnants (≥ min)</th><th>Rotation</th></tr>${summary||'<tr><td colspan=8>No annealed panes</td></tr>'}</table></div>${pages}`}

// ---- toughened order ----
const TO_KEY='kearglaze-tough-orders';
let toughOrders=Store.getJSON(TO_KEY,[]);const saveTO=()=>Store.setJSON(TO_KEY,toughOrders);
function toughPanes(jobs){const out=[];jobs.forEach(j=>j.units.filter(u=>!u.panel).forEach(u=>panesFor(u,j).forEach(p=>{if(isTough(p.type))out.push({key:u.id+'|'+p.pane,unit:u.id,job:j.extJob||j.no,pane:p.pane,type:p.type,w:p.w,h:p.h,loc:u.loc?`${u.loc} W${u.wno} ${u.pos}`:j.no,glassReq:j.glassReq||j.due})})));return out}
function paneStatus(key){for(const o of toughOrders){const it=o.items.find(i=>i.key===key);if(it)return {o,it}}return null}
function toughDraft(jobs){const panes=toughPanes(jobs).filter(p=>!paneStatus(p.key));const earliest=panes.map(p=>p.glassReq).filter(Boolean).sort()[0];
 let req='';if(earliest){const d=new Date(earliest+'T12:00');d.setDate(d.getDate()-(+optSet.tLeadDays||0));req=d.toISOString().slice(0,10)}
 const n=toughOrders.length+1;return {no:'TO-'+new Date().toISOString().slice(2,10).replace(/-/g,'')+'-'+String(n).padStart(2,'0'),date:new Date().toISOString().slice(0,10),required:req,items:panes}}
function groupTough(items){const g={};items.forEach(p=>{const k=p.type+'|'+p.w+'x'+p.h;(g[k]=g[k]||{type:p.type,w:p.w,h:p.h,qty:0,refs:[],locs:new Set()}).qty++;g[k].refs.push(p.unit+' '+p.pane[0]);g[k].locs.add(p.loc)});return Object.values(g).sort((a,b)=>a.type.localeCompare(b.type)||b.w*b.h-a.w*a.h)}
function toughText(o){const G=groupTough(o.items);const m2=o.items.reduce((a,p)=>a+p.w*p.h,0)/1e6;const S=optSet;
 return `PURCHASE ORDER ${o.no} – TOUGHENED GLASS\nTo: ${S.tSupplier}${S.tEmail?' <'+S.tEmail+'>':''}\nFrom: Kearglaze Ltd · 07850 296733\nOrder date: ${fmtUK(o.date)}\nRequired by: ${o.required?fmtUK(o.required):'ASAP'}\n\n`+
 G.map((g,i)=>`${i+1}. ${g.qty} x ${g.w} x ${g.h} mm  ${g.type}  (ref ${g.refs.join(', ')})`).join('\n')+`\n\nTotal: ${o.items.length} panes, ${m2.toFixed(2)} m²\nSizes are W x H in mm (width first).\nKitemark / EN 12150 stamp required on every pane, positioned in a bottom corner.\nLow-E panes: please confirm coating position (inner pane, coating to cavity).\n\nThank you – Kearglaze Ltd`}
const fmtUK=d=>d?new Date(d+'T12:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'';
let toughCurrent=null;
function toughView(arg){const jobs=selJobs(arg);const d=toughDraft(jobs);toughCurrent=d;const S=optSet;const G=groupTough(d.items);const m2=d.items.reduce((a,p)=>a+p.w*p.h,0)/1e6;
 const fld=(k,l,t='text')=>`<div><label>${l}<input type="${t}" data-opt="${k}" value="${esc(S[k])}"></label></div>`;
 const orderTable=(o,G,edit)=>`<table class="cut"><tr><th>#</th><th>W × H mm</th><th>Glass</th><th>Qty</th><th>m²</th><th>Our refs</th><th>Location</th></tr>${G.map((g,i)=>`<tr><td>${i+1}</td><td class="big">${g.w} × ${g.h}</td><td><b>${esc(g.type)}</b></td><td class="big">${g.qty}</td><td>${(g.w*g.h*g.qty/1e6).toFixed(2)}</td><td class="ids">${g.refs.join(', ')}</td><td>${[...g.locs].map(esc).join('<br>')}</td></tr>`).join('')}
  <tr><td colspan=3><b>Total</b></td><td class="big">${o.items.length}</td><td><b>${(o.items.reduce((a,p)=>a+p.w*p.h,0)/1e6).toFixed(2)} m²</b></td><td colspan=2></td></tr></table>`;
 const open=toughOrders.slice().reverse().map(o=>`<div class="card"><h2 style="margin-top:0">${o.no} · ${esc(o.supplier)} · required ${fmtUK(o.required)||'ASAP'} <span class="sub">${o.items.filter(i=>i.received).length}/${o.items.length} received</span></h2>
  <table class="cut"><tr><th>Received</th><th>Unit</th><th>Pane</th><th>Size</th><th>Glass</th><th>Status</th></tr>${o.items.map(i=>`<tr><td><input type="checkbox" class="tick" data-recv="${o.no}|${i.key}" ${i.received?'checked':''}></td><td class="ids">${i.unit}</td><td>${i.pane}</td><td>${i.w}×${i.h}</td><td>${esc(i.type)}</td><td>${i.received?'<span class="tag" style="background:#2e7d32;color:#fff">READY FOR ASSEMBLY</span>':'<span class="tag soon">ON ORDER</span>'}</td></tr>`).join('')}</table>
  <div class="bar" style="margin-top:8px"><button class="btn small sec" data-copyorder="${o.no}">📋 Copy as text</button><button class="btn small sec" data-printorder="${o.no}">🖨 Print</button><button class="btn small warn" data-delorder="${o.no}">Cancel order</button></div></div>`).join('');
 return `<h1>🛒 Toughened glass order</h1><div class="card no-print"><b>Jobs:</b>${jobChips()}
 <details><summary style="font-weight:700;cursor:pointer;padding:8px 0">⚙ Toughener details</summary><div class="grid">${fld('tSupplier','Supplier name')}${fld('tEmail','Email','email')}${fld('tPhone','Phone')}${fld('tLeadDays','Required-by = earliest glass-required minus (days)','number')}
 <div style="grid-column:1/-1"><label>Address<textarea data-opt="tAddress" rows="2">${esc(S.tAddress)}</textarea></label></div></div></details></div>
 <div class="card toughpo" id="poDraft"><div class="cuthead">PURCHASE ORDER <b>${d.no}</b> – TOUGHENED GLASS (cut to size)</div>
 <div class="grid" style="margin:8px 0"><div><b>To:</b> ${esc(S.tSupplier)}<br>${esc(S.tAddress).replace(/\n/g,'<br>')}${S.tEmail?'<br>'+esc(S.tEmail):''}${S.tPhone?'<br>'+esc(S.tPhone):''}</div><div><b>From:</b> Kearglaze Ltd<br>Tel 07850 296733</div>
 <div><b>Order date:</b> ${fmtUK(d.date)}<br><b>Required by:</b> <input type="date" id="toReq" value="${d.required}" style="width:auto;min-height:40px;padding:4px"></div></div>
 ${d.items.length?orderTable(d,G):'<p>No toughened panes waiting to be ordered for the selected jobs (already on order, or none).</p>'}
 <p class="note"><b>Kitemark / EN 12150 stamp required on every pane, positioned in a bottom corner.</b> Sizes W × H in mm, width first.</p></div>
 <div class="bar no-print">${d.items.length?`<button class="btn go" id="toPlace">✔ Place order &amp; mark ${d.items.length} pane${d.items.length>1?'s':''} ON ORDER</button><button class="btn sec" id="toCopy">📋 Copy as text</button><button class="btn sec" id="toPrint">🖨 Print A4</button>`:''}</div>
 <h2 class="no-print">Orders</h2><div class="no-print">${open||'<p>No orders yet.</p>'}</div><pre id="toText" hidden></pre>`}
async function copyText(t){try{await navigator.clipboard.writeText(t);toast('Copied – paste into email or WhatsApp')}catch(e){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Copied')}window.kgLastCopied=t}
function toughStatusOf(u){const ks=toughOrders.flatMap(o=>o.items.filter(i=>i.unit===u.id));if(!ks.length)return '';return ks.every(i=>i.received)?'Tough: received':'Tough: on order'}
document.addEventListener('change',e=>{const t=e.target;
 if(t.dataset.optjob){t.checked?cutSel.add(t.dataset.optjob):cutSel.delete(t.dataset.optjob);route()}
 else if(t.dataset.opt){const k=t.dataset.opt;optSet[k]=k==='rotate'?!!t.value:(t.type==='number'?+t.value:t.value);saveOpt();const o=document.querySelector('details')?.open;route();if(o)document.querySelector('details').open=true}
 else if(t.dataset.recv){const [no,key]=t.dataset.recv.split(/\|(.+)/);const o=toughOrders.find(x=>x.no===no);const it=o.items.find(i=>i.key===key);it.received=t.checked?new Date().toISOString():null;saveTO();toast(t.checked?it.unit+' '+it.pane+' received – ready for assembly':'Marked on order');route()}});
document.addEventListener('click',e=>{const t=e.target;
 if(t.id==='optPrint'){setPage('cut');document.body.classList.add('print-sheets');window.print()}
 if(t.id==='toPlace'&&toughCurrent){const o={...toughCurrent,required:$('#toReq').value,supplier:optSet.tSupplier,items:toughCurrent.items.map(i=>({...i,received:null}))};toughOrders.push(o);saveTO();toast(o.no+' placed – '+o.items.length+' panes ON ORDER');route()}
 if(t.id==='toCopy'&&toughCurrent)copyText(toughText({...toughCurrent,required:$('#toReq').value}));
 if(t.id==='toPrint'){setPage('cut');window.print()}
 if(t.dataset.copyorder)copyText(toughText(toughOrders.find(o=>o.no===t.dataset.copyorder)));
 if(t.dataset.printorder){const o=toughOrders.find(x=>x.no===t.dataset.printorder);$('#poDraft').innerHTML=`<div class="cuthead">PURCHASE ORDER <b>${o.no}</b> – TOUGHENED GLASS</div><pre style="font-size:14px;white-space:pre-wrap">${esc(toughText(o))}</pre>`;setPage('cut');window.print()}
 if(t.dataset.delorder&&confirm('Cancel order '+t.dataset.delorder+'? Its panes go back to "not ordered".')){toughOrders=toughOrders.filter(o=>o.no!==t.dataset.delorder);saveTO();route()}});

// ---- self-tests (synthetic panes, no customer data) ----
function optSelfTest(){const save={...optSet};optSet={...OPT_DEFAULTS};const out=[];const T=(n,ok,got)=>out.push({ok,got:'OPT '+n+': '+got,exp:'valid'});
 let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 [['random 60 float',60,'4mm Float'],['random 25 obscure (no rotate)',25,'4mm Digital Obscure'],['random 120 low-E',120,'4mm Low-E']].forEach(([n,c,type])=>{const P=[];for(let i=0;i<c;i++)P.push({w:200+Math.round(rnd()*1200),h:200+Math.round(rnd()*1400),id:'T'+i,loc:''});
  const r=optimiseType(type,type.includes('Obscure')?P.map(p=>({...p,w:Math.min(p.w,1200),h:Math.min(p.h,2200)})):P.map(p=>({...p,w:Math.min(p.w,2200),h:Math.min(p.h,1150)})));const c2=checkPlan(r);
  T(n,c2.allPlaced&&!c2.overlap&&!c2.outside&&c2.guillotine,`${r.mixText}, yield ${(r.yield*100).toFixed(1)}%, allPlaced ${c2.allPlaced}, overlap ${c2.overlap}, outside ${c2.outside}, guillotine ${c2.guillotine}`)});
 const big=optimiseType('4mm Float',[{w:2400,h:500,id:'X',loc:''}]);T('oversize pane reported',!!big.error,big.error||'no error');
 const nr=optimiseType('4mm Digital Obscure',[{w:600,h:1500,id:'R',loc:''},{w:1000,h:500,id:'R2',loc:''}]);T('no-rotate obscure respects grain',!!nr.error||nr.sheets[0].placed.every(p=>!p.rot),nr.error||'not rotated');
 optSet.kerf=4;const k=optimiseType('4mm Float',Array.from({length:30},(_,i)=>({w:500+i*10,h:400+i*7,id:'K'+i,loc:''})));T('downsized last sheet / mix',/x 2250x/.test(k.mixText),k.mixText);const ck=checkPlan(k);T('kerf 4mm still valid',ck.allPlaced&&!ck.overlap&&!ck.outside&&ck.guillotine,`${k.mixText}`);
 optSet=save;return out}
