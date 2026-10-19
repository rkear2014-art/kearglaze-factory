// Clearly FAKE demo data – all customers and addresses are made up.
const STAGES=['Cut','Edge','Wash','Assemble','Seal','Ready','Dispatched'];
const GLASS=['4mm float','4mm toughened','6.4mm laminated','4mm low-E','4mm obscure'];
const SPACERS=['Warm edge','Aluminium'];
const GASES=['Argon','Air'];
function demoData(){
  const d=n=>{const x=new Date();x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
  const L=(w,h,qty,outer,inner,spacer,spacerMm,gas,extra={})=>({w,h,qty,outer,inner,spacer,spacerMm,gas,...extra});
  const orders=[
   {customer:'DEMO – Sample Windows Ltd (fake)',due:d(-1),notes:'FAKE DATA. Trade collection.',lines:[L(1200,1050,2,'4mm toughened','4mm low-E','Warm edge',16,'Argon',{stages:[2,1]}),L(600,900,3,'4mm obscure','4mm low-E','Warm edge',16,'Argon',{stages:[3,3,0]})]},
   {customer:'DEMO – Test Conservatories (fake)',due:d(0),notes:'FAKE DATA. Roof panels, handle with care.',lines:[L(1800,700,4,'6.4mm laminated','4mm low-E','Warm edge',20,'Argon',{stages:[4,4,3,1]})]},
   {customer:'DEMO – J. Example (fake)',due:d(2),notes:'FAKE DATA. Triple glazed front door side lights.',lines:[L(350,1950,2,'4mm toughened','4mm low-E','Warm edge',12,'Argon',{centre:'4mm float',stages:[0,0]})]},
   {customer:'DEMO – Placeholder Builders (fake)',due:d(5),notes:'FAKE DATA. Site delivery.',lines:[L(900,1200,3,'4mm float','4mm low-E','Aluminium',16,'Air',{stages:[0,1,5]}),L(1500,1200,1,'4mm toughened','4mm toughened','Warm edge',16,'Argon',{stages:[5]})]},
   {customer:'DEMO – Mock Homes (fake)',due:d(-4),notes:'FAKE DATA.',lines:[L(1000,1000,2,'4mm float','4mm low-E','Warm edge',16,'Argon',{stages:[6,6]})]}
  ];
  const jobs=[];let n=1001;
  orders.forEach(o=>{const job={no:'KG'+(n++),customer:o.customer,due:o.due,notes:o.notes,created:new Date().toISOString(),units:[]};
   o.lines.forEach((l,li)=>{for(let q=0;q<l.qty;q++){const st=(l.stages||[])[q]||0;
    job.units.push(makeUnit(job,li+1,l,st));}});
   jobs.push(job);});
  return {jobs,nextNo:n};
}
function thickness(l){const g=s=>parseFloat(s)||4;let t=g(l.outer)+g(l.inner)+(+l.spacerMm||0);if(l.centre)t+=g(l.centre)+(+l.spacerMm||0);return Math.round(t*10)/10}
const isPanel=d=>/panel|mdf/i.test(d||'');
function sheetJob(r){const job={no:r.no,extJob:r.extJob||'',customer:r.customer,ref:r.ref||'',due:r.due,glassReq:r.glassReq||'',notes:r.notes||'',spacer:r.spacer||'',created:new Date().toISOString(),units:[]};
 r.lines.forEach((x,li)=>{const [loc,wno,pos,qty,w,h,desc,note,panel,bar,geo,pat,leadPat,leadW]=x;for(let q=0;q<qty;q++){const u=makeUnit(job,li+1,{w,h,outer:'',inner:'',spacer:bar||'',spacerMm:0,gas:''});
  Object.assign(u,geoFields(geo,pat),leadFields(leadPat,leadW),{loc,wno,pos,desc,note,panel:panel??isPanel(desc),thick:parseFloat(desc)||u.thick,of:[q+1,qty]});job.units.push(u)}});return job}
function makeUnit(job,line,l,stage=0){
  const id=job.no+'-'+String(job.units.length+1).padStart(2,'0');
  const now=new Date().toISOString();
  return {id,line,w:+l.w,h:+l.h,outer:l.outer,inner:l.inner,centre:l.centre||'',spacer:l.spacer,spacerMm:+l.spacerMm,gas:l.gas,thick:thickness(l),stage,history:[{stage,at:now}]};
}

// Georgian bars: geo = '' | '18' | '25', pattern 'AxU' = squares ACROSS x squares UP
// e.g. '2x4' = 2 across, 4 up -> 1 vertical line, 3 horizontal lines
function parsePat(p){const m=String(p||'').match(/(\d+)\s*[x×X]\s*(\d+)/);return m?[+m[1],+m[2]]:[1,1]}
function geoFields(geo,pat){geo=String(geo||'').replace(/mm/,'');const none={geo:'',geoA:0,geoU:0,geoV:0,geoH:0};if(!geo||geo==='none')return none;
 const [a,u]=parsePat(pat);if(a<1||u<1||(a===1&&u===1))return none;return {geo,geoA:a,geoU:u,geoV:a-1,geoH:u-1}}
const geoText=u=>u.geo?`Georgian ${u.geo}mm ${u.geoA} across x ${u.geoU} up`:'';
const GEO_PRESETS=['2x2','2x3','2x4','3x2','3x3','4x2','4x3','1x2','2x1'];

// Square lead: pattern 'AxU' squares across x up, lead width mm
function leadFields(pat,w){const none={lead:'',leadA:0,leadU:0,leadW:0};if(!pat||pat==='none')return none;const [a,u]=parsePat(pat);if(a<1||u<1||(a===1&&u===1))return none;return {lead:'square',leadA:a,leadU:u,leadW:+w||6}}
const leadText=u=>u.lead?`Square lead ${u.leadA}x${u.leadU} (${u.leadW}mm)`:'';
