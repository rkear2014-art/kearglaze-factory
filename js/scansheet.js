/* Scan job sheet: photo/PDF -> vision AI (user's own key, stored on this device only) -> review -> save.
   No API key is included in this code. Keys live under the "kgsecret-" prefix so they are NOT included in backups. */
const AI_SET_KEY='kearglaze-ai-settings-v1';
const AI_DEFAULTS={provider:'gemini',geminiModel:'gemini-3.8-flash',openaiModel:'gpt-4o-mini',maxPx:2000,lowConf:0.75};
let aiSet=Object.assign({},AI_DEFAULTS,Store.getJSON(AI_SET_KEY,{}));
const aiKey=p=>(Store.getItem('kgsecret-'+p+'-key')||'').replace(/[^\x21-\x7E]/g,'');
const setAiKey=(p,k)=>k?Store.setItem('kgsecret-'+p+'-key',k.trim()):Store.removeItem('kgsecret-'+p+'-key');
const maskKey=k=>k?k.slice(0,4)+'••••••••'+k.slice(-4):'(none)';

const SHEET_PROMPT=`You are reading a UK window/glass supplier JOB SHEET (photo or PDF) for a sealed glass unit factory.
Header fields (left side, labels may be partly cut off at the left edge): "Customer Details" then customer name (e.g. KEARGLAZE LTD), "Job No:" (e.g. J1234567), "Ref:", "Date Printed:", "Date Job Required:", "Required Week:", "Glass Required:".
Table columns in order: Location, W/No (window number), Position (e.g. "Pane:1(S)", "Pane:2(F)"), Qty, Size written "W x H" in mm (e.g. "475x 708" means width 475, height 708), Description (e.g. "28mm Unglazed", "28mm Flat Panel White 4mm MDF").
Footer: "Total number of Items", "Total square area" (m²), "Total linear length" (m).
Rules:
- One output line per printed table row, in order. Do not merge or split rows.
- Location text is often cut off at the LEFT edge of the photo (e.g. "/Bed & B/Bed", "ounge", "itchen", "/Door"). Give your best full reading (e.g. "B/Bed & B/Bed", "Lounge", "Kitchen", "F/Door"), set locationCutOff=true and lower the location confidence when letters were missing.
- Read HANDWRITTEN notes and highlighter marks beside a row. Put the meaning in "note" using standard terms: "Digital Obs"/"Digital"/"Dig" -> "Digital Obscure"; "Tough"/"Toughd" -> "Toughened"; "Obs" -> "Obscure"; "Lam" -> "Laminated". Put the raw handwriting in "noteRaw" and the highlighter colour (or "") in "highlight".
- panel=true for MDF / Flat Panel / solid panel rows (not glass).
- Dates as ISO YYYY-MM-DD (2-digit years are 20xx).
- confidence values are 0..1 for how sure you are of each field. Use < 0.75 for anything partly unreadable, guessed or cut off.
Return ONLY JSON matching the schema.`;

const SHEET_SCHEMA={type:'OBJECT',properties:{
 header:{type:'OBJECT',properties:{customer:{type:'STRING'},jobNo:{type:'STRING'},ref:{type:'STRING'},datePrinted:{type:'STRING'},dateRequired:{type:'STRING'},requiredWeek:{type:'STRING'},glassRequired:{type:'STRING'},
  confidence:{type:'OBJECT',properties:{customer:{type:'NUMBER'},jobNo:{type:'NUMBER'},ref:{type:'NUMBER'},dateRequired:{type:'NUMBER'},glassRequired:{type:'NUMBER'}}}},required:['customer','jobNo']},
 lines:{type:'ARRAY',items:{type:'OBJECT',properties:{location:{type:'STRING'},locationCutOff:{type:'BOOLEAN'},wno:{type:'STRING'},position:{type:'STRING'},qty:{type:'INTEGER'},width:{type:'INTEGER'},height:{type:'INTEGER'},
  description:{type:'STRING'},note:{type:'STRING'},noteRaw:{type:'STRING'},highlight:{type:'STRING'},panel:{type:'BOOLEAN'},
  confidence:{type:'OBJECT',properties:{location:{type:'NUMBER'},wno:{type:'NUMBER'},position:{type:'NUMBER'},qty:{type:'NUMBER'},size:{type:'NUMBER'},description:{type:'NUMBER'},note:{type:'NUMBER'}}}},
  required:['location','wno','position','qty','width','height','description']}},
 totals:{type:'OBJECT',properties:{items:{type:'NUMBER'},areaM2:{type:'NUMBER'},linearM:{type:'NUMBER'}}}},required:['header','lines','totals']};

// ---------- pure parsing / validation (unit-tested) ----------
function normNote(n){n=String(n||'').trim();if(!n)return '';if(/dig/i.test(n))return 'Digital Obscure';if(/tou?gh/i.test(n))return 'Toughened';if(/obs/i.test(n))return 'Obscure';if(/lam/i.test(n))return 'Laminated';if(/satin/i.test(n))return 'Satin';return n}
function normDate(s){s=String(s||'').trim();if(!s)return '';if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
 const M={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};let m=s.match(/(\d{1,2})\s*([A-Za-z]{3})[a-z]*\.?\s*(\d{2,4})/);
 if(m){const y=m[3].length===2?2000+ +m[3]:+m[3];return `${y}-${String(M[m[2].toLowerCase()]||1).padStart(2,'0')}-${m[1].padStart(2,'0')}`}
 m=s.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);if(m){const y=m[3].length===2?2000+ +m[3]:+m[3];return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`}return ''}
function parseAIText(raw){if(raw&&raw.candidates){raw=raw.candidates[0].content.parts.map(p=>p.text||'').join('')}else if(raw&&raw.choices){raw=raw.choices[0].message.content}
 if(typeof raw==='string'){raw=raw.trim().replace(/^```(json)?/i,'').replace(/```$/,'');return JSON.parse(raw)}return raw}
function normaliseSheet(o){const H=o.header||{},hc=H.confidence||{};const low=+aiSet.lowConf;
 const header={customer:(H.customer||'').trim(),extJob:(H.jobNo||'').trim(),ref:(H.ref||'').trim(),due:normDate(H.dateRequired),glassReq:normDate(H.glassRequired),datePrinted:H.datePrinted||'',requiredWeek:H.requiredWeek||'',
  low:Object.keys(hc).filter(k=>hc[k]<low).map(k=>({jobNo:'extJob',dateRequired:'due',glassRequired:'glassReq'}[k]||k))};
 const lines=(o.lines||[]).map(l=>{const c=l.confidence||{};let w=+l.width,h=+l.height;if((!w||!h)&&l.size){const m=String(l.size).match(/(\d+)\s*[x×X]\s*(\d+)/);if(m){w=+m[1];h=+m[2]}}
  const desc=(l.description||'').trim();const lowF=Object.keys(c).filter(k=>c[k]<low);if(l.locationCutOff&&!lowF.includes('location'))lowF.push('location');
  return {loc:(l.location||'').trim(),cutOff:!!l.locationCutOff,wno:String(l.wno??'').trim(),pos:(l.position||'').replace(/\s+/g,''),qty:Math.max(1,parseInt(l.qty)||1),w,h,desc,
   note:normNote(l.note||l.noteRaw),noteRaw:l.noteRaw||'',highlight:l.highlight||'',panel:!!l.panel||isPanel(desc),low:lowF}});
 const T=o.totals||{};return {header,lines,totals:{items:T.items==null?null:+T.items,areaM2:T.areaM2==null?null:+T.areaM2,linearM:T.linearM==null?null:+T.linearM}}}
function checkTotals(lines,totals){const items=lines.reduce((a,l)=>a+(+l.qty||0),0),area=lines.reduce((a,l)=>a+(l.qty||0)*(l.w||0)*(l.h||0),0)/1e6;
 const okItems=totals.items==null?null:items===totals.items, okArea=totals.areaM2==null?null:Math.abs(+area.toFixed(2)-totals.areaM2)<0.015;
 return {items,area,okItems,okArea,ok:okItems!==false&&okArea!==false&&(okItems||okArea)}}

// ---------- AI calls ----------
async function callGemini(parts){const k=aiKey('gemini');if(!k)throw new Error('No Gemini key – add one in ⚙ Settings → AI job sheet reading');
 const models=[...new Set([aiSet.geminiModel,'gemini-2.5-flash','gemini-2.5-flash-lite','gemini-2.0-flash'])];let last='';
 const body=JSON.stringify({contents:[{role:'user',parts:[{text:SHEET_PROMPT},...parts]}],generationConfig:{temperature:0,responseMimeType:'application/json',responseSchema:SHEET_SCHEMA}});
 for(const m of models){for(let a=0;a<3;a++){
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':k},body});
  const j=await r.json().catch(()=>({}));if(r.ok)return j;last=(j.error&&j.error.message)||r.status;
  if([429,500,503].includes(r.status)){if(a<2){await new Promise(z=>setTimeout(z,2000*(a+1)));continue}break}
  if(r.status===404)break;throw new Error('Gemini: '+last)}}
 throw new Error('Gemini busy on all models, try again in a few minutes ('+last+')')}
async function callOpenAI(images){const k=aiKey('openai');if(!k)throw new Error('No OpenAI key – add one in ⚙ Settings → AI job sheet reading');
 const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+k},
  body:JSON.stringify({model:aiSet.openaiModel,temperature:0,response_format:{type:'json_object'},messages:[{role:'system',content:SHEET_PROMPT+'\nJSON shape: '+JSON.stringify(SHEET_SCHEMA)},
   {role:'user',content:[{type:'text',text:'Read this job sheet.'},...images.map(u=>({type:'image_url',image_url:{url:u,detail:'high'}}))]}]})});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error('OpenAI: '+((j.error&&j.error.message)||r.status));return j}
async function testAiKey(p){const k=aiKey(p);if(!k)return 'No key saved';
 if(p==='gemini'){const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(aiSet.geminiModel),{headers:{'x-goog-api-key':k}});const j=await r.json().catch(()=>({}));return r.ok?'✅ Key works – model '+(j.displayName||aiSet.geminiModel)+' available':'❌ '+((j.error&&j.error.message)||r.status)}
 const r=await fetch('https://api.openai.com/v1/models/'+encodeURIComponent(aiSet.openaiModel),{headers:{Authorization:'Bearer '+k}});const j=await r.json().catch(()=>({}));return r.ok?'✅ Key works – model '+aiSet.openaiModel+' available':'❌ '+((j.error&&j.error.message)||r.status)}

// ---------- file handling ----------
const readAsDataURL=f=>new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(f)});
function downscale(dataUrl,max){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>{const s=Math.min(1,max/Math.max(im.width,im.height));const c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);
 c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',0.85))};im.onerror=()=>rej(new Error('Could not open the photo'));im.src=dataUrl})}
function loadScript(src){return new Promise((res,rej)=>{if(document.querySelector(`script[src="${src}"]`))return res();const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('Could not load '+src));document.head.appendChild(s)})}
async function pdfToImages(file,max){await loadScript('js/vendor/pdf.min.js');const lib=window.pdfjsLib;lib.GlobalWorkerOptions.workerSrc='js/vendor/pdf.worker.min.js';
 const pdf=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;const out=[];
 for(let i=1;i<=Math.min(pdf.numPages,3);i++){const pg=await pdf.getPage(i);const v1=pg.getViewport({scale:1});const vp=pg.getViewport({scale:Math.min(3,max/Math.max(v1.width,v1.height))});
  const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;out.push(c.toDataURL('image/jpeg',0.85))}return out}
async function readSheet(file){const isPdf=/pdf/i.test(file.type)||/\.pdf$/i.test(file.name);let raw;
 if(aiSet.provider==='openai'){const imgs=isPdf?await pdfToImages(file,+aiSet.maxPx):[await downscale(await readAsDataURL(file),+aiSet.maxPx)];raw=await callOpenAI(imgs)}
 else{let part;if(isPdf){const d=await readAsDataURL(file);part={inline_data:{mime_type:'application/pdf',data:d.split(',')[1]}}}else{const d=await downscale(await readAsDataURL(file),+aiSet.maxPx);part={inline_data:{mime_type:'image/jpeg',data:d.split(',')[1]}}}
  raw=await callGemini([part])}
 return normaliseSheet(parseAIText(raw))}

// ---------- UI ----------
let scanFile=null,scanResult=null;
function scanSheetView(){const k=aiKey(aiSet.provider);return `<h1>📷 Scan job sheet</h1>
 ${k?'':`<div class="note">⚠ No ${aiSet.provider==='openai'?'OpenAI':'Gemini'} key on this device yet. Add one in <a href="#settings">⚙ Settings → AI job sheet reading</a>.</div>`}
 <div class="card"><p>Take a clear, flat photo of the whole sheet in good light (all four edges visible), or choose a PDF.</p>
 <div class="bar"><label class="btn" style="cursor:pointer">📷 Take photo<input type="file" id="ssCam" accept="image/*" capture="environment" hidden></label>
 <label class="btn sec" style="cursor:pointer">🖼 Choose photo / PDF<input type="file" id="ssFile" accept="image/*,application/pdf,.pdf" hidden></label></div>
 <div id="ssPrev"></div><div class="bar"><button class="btn go" id="ssRead" ${scanFile?'':'disabled'}>✨ Read sheet with AI</button><span id="ssStatus"></span></div>
 <p style="font-size:13px;color:#667">The image is sent from this tablet directly to ${aiSet.provider==='openai'?'OpenAI':'Google Gemini'} using your own key. You check everything before it is saved.</p></div>`}
let pendingReview=null;function showReview(res){scanResult=res;pendingReview=res;if(location.hash==='#quick')route();else location.hash='#quick'}
function fillReview(res){const f=$('#quickform');if(!f)return;const H=res.header;
 app.querySelector('h1').innerHTML='Review scanned job sheet <span class="sub">check yellow fields, then Save</span>';
 const set=(n,v)=>{const el=f.querySelector(`[name=${n}]`);if(el&&v!=null&&v!=='')el.value=v;if(el&&H.low.includes(n))el.classList.add('lowconf')};
 set('customer',H.customer);set('extJob',H.extJob);set('ref',H.ref);set('due',H.due);set('glassReq',H.glassReq);
 if(H.datePrinted||H.requiredWeek)set('notes',`Scanned job sheet${H.datePrinted?' · printed '+H.datePrinted:''}${H.requiredWeek?' · required week '+H.requiredWeek:''}`);
 const tb=$('#qt tbody');tb.innerHTML='';
 res.lines.forEach(l=>{const r=qRow();const s=(n,v)=>{const el=r.querySelector(`[name=${n}]`);el.value=v};s('loc',l.loc);s('wno',l.wno);s('pos',l.pos);s('qty',l.qty);s('size',`${l.w}x${l.h}`);s('desc',l.desc);s('note',l.note);
  r.querySelector('[name=panel]').checked=l.panel;const map={location:'loc',wno:'wno',position:'pos',qty:'qty',size:'size',description:'desc',note:'note'};
  l.low.forEach(k=>{const el=r.querySelector(`[name=${map[k]||k}]`);if(el){el.classList.add('lowconf');el.title=k==='location'&&l.cutOff?'Location was cut off on the photo – check':'Low confidence – check against the sheet'}});
  if(l.noteRaw&&l.note)r.querySelector('[name=note]').title='Handwritten: '+l.noteRaw+(l.highlight?' ('+l.highlight+' highlighter)':'');if(l.note||l.highlight)r.classList.add('hl')});
 qRow();
 const box=document.createElement('div');box.id='ssCheck';$('#qt').closest('.card').before(box);updateScanCheck();
 const cut=res.lines.filter(l=>l.cutOff).length;if(cut)box.insertAdjacentHTML('afterend',`<div class="note">✂ ${cut} location${cut>1?'s were':' was'} partly cut off on the photo – the AI's best guess is shown in yellow. Please check.</div>`)}
function updateScanCheck(){const b=$('#ssCheck');if(!b||!scanResult)return;const lines=[...document.querySelectorAll('#qt tbody tr')].map(qParse).filter(Boolean);const c=checkTotals(lines,scanResult.totals);const T=scanResult.totals;
 b.className='scancheck '+(c.ok?'ok':'bad');b.innerHTML=`${c.ok?'✅':'⚠'} <b>Totals check:</b> items ${c.items}${T.items!=null?` vs sheet ${T.items} ${c.okItems?'✓':'✗'}`:' (no printed total)'} · area ${c.area.toFixed(2)} m²${T.areaM2!=null?` vs sheet ${T.areaM2} m² ${c.okArea?'✓':'✗'}`:''}${c.ok?'':' – <b>check quantities and sizes against the sheet</b>'}`}
document.addEventListener('input',e=>{if(e.target.closest&&e.target.closest('#qt'))setTimeout(updateScanCheck,0)});
document.addEventListener('change',async e=>{const t=e.target;
 if((t.id==='ssCam'||t.id==='ssFile')&&t.files[0]){scanFile=t.files[0];const pv=$('#ssPrev');const isPdf=/pdf/i.test(scanFile.type);
  pv.innerHTML=isPdf?`<p>📄 ${esc(scanFile.name)} (${Math.round(scanFile.size/1024)} KB)</p>`:`<img src="${URL.createObjectURL(scanFile)}" style="max-width:100%;max-height:420px;border-radius:8px;border:1px solid #ccc">`;$('#ssRead').disabled=false}
 if(t.dataset.ai){aiSet[t.dataset.ai]=t.value;Store.setJSON(AI_SET_KEY,aiSet);if(location.hash==='#settings')route()}
 if(t.dataset.aikey!==undefined&&t.dataset.aikey!==''){setAiKey(t.dataset.aikey,t.value);t.value='';toast('Key saved on this device');route()}});
document.addEventListener('click',async e=>{const t=e.target;
 if(t.id==='ssRead'&&scanFile){const st=$('#ssStatus');t.disabled=true;st.textContent='⏳ Reading sheet… (10–40 s)';
  try{const res=await readSheet(scanFile);if(!res.lines.length)throw new Error('No table lines found – try a clearer photo');showReview(res)}catch(err){st.innerHTML='<span style="color:#c62828;font-weight:700">❌ '+esc(err.message)+'</span>';t.disabled=false}}
 if(t.dataset.aitest){const o=$('#aiTestOut');o.textContent='Testing…';try{o.textContent=await testAiKey(t.dataset.aitest)}catch(err){o.textContent='❌ '+err.message}}
 if(t.dataset.aiclear){setAiKey(t.dataset.aiclear,'');toast('Key removed');route()}});
function aiSettingsCard(){const p=aiSet.provider;return `<div class="card"><h2 style="margin-top:0">✨ AI job sheet reading</h2>
 <p style="font-size:14px">Used by <a href="#scansheet">📷 Scan sheet</a>. Your key is stored <b>only on this tablet</b> (not in backups, not on the website).</p><div class="grid">
 <div><label>Provider<select data-ai="provider"><option value="gemini" ${p==='gemini'?'selected':''}>Google Gemini (free tier)</option><option value="openai" ${p==='openai'?'selected':''}>OpenAI</option></select></label></div>
 ${p==='gemini'?`<div><label>Gemini model<input data-ai="geminiModel" value="${esc(aiSet.geminiModel)}"></label></div>`:`<div><label>OpenAI model<input data-ai="openaiModel" value="${esc(aiSet.openaiModel)}"></label></div>`}
 <div><label>${p==='gemini'?'Gemini':'OpenAI'} API key – saved: ${maskKey(aiKey(p))}<input type="password" autocomplete="off" data-aikey="${p}" placeholder="Paste new key and tap outside"></label></div></div>
 <div class="bar" style="margin-top:8px"><button class="btn sec" data-aitest="${p}">Test key</button><button class="btn sec" data-aiclear="${p}">Remove key</button><span id="aiTestOut" style="font-weight:700"></span></div></div>`}
