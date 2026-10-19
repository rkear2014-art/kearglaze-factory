/* Kearglaze Factory – single storage module.
   All reads/writes of saved data go through Store. Today it uses this device's localStorage.
   To add a cloud backend later, provide an adapter with getItem/setItem/removeItem/keys (and optionally a sync hook) and call Store.useAdapter(adapter). */
const Store=(function(){
  const PREFIX='kearglaze-';
  const DB_KEY='kearglaze-factory-v1', BACKUP_KEY='kearglaze-last-backup';
  const local={getItem:k=>{try{return localStorage.getItem(k)}catch(e){return mem[k]??null}},setItem:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){mem[k]=v}},
    removeItem:k=>{try{localStorage.removeItem(k)}catch(e){delete mem[k]}},keys:()=>{try{return Object.keys(localStorage)}catch(e){return Object.keys(mem)}}};
  const mem={};let A=local;const listeners=[];
  const S={
    useAdapter(a){A=a},
    getItem:k=>A.getItem(k), setItem:(k,v)=>{A.setItem(k,v);listeners.forEach(f=>f(k))}, removeItem:k=>A.removeItem(k),
    getJSON(k,def){try{const v=A.getItem(k);return v==null?def:JSON.parse(v)}catch(e){return def}},
    setJSON(k,v){S.setItem(k,JSON.stringify(v))},
    loadDB(){return S.getJSON(DB_KEY,null)}, saveDB(db){S.setJSON(DB_KEY,db)},
    onChange(f){listeners.push(f)},
    // Backup: everything under the kearglaze- prefix (jobs, cutting settings, ticks)
    exportAll(){const data={};A.keys().filter(k=>k.startsWith(PREFIX)&&k!==BACKUP_KEY).forEach(k=>data[k]=A.getItem(k));
      return {app:'Kearglaze Factory',format:1,exported:new Date().toISOString(),data}},
    importAll(obj,mode){if(!obj||obj.app!=='Kearglaze Factory'||!obj.data)throw new Error('This is not a Kearglaze Factory backup file');
      const inc=obj.data;
      if(mode==='replace'){A.keys().filter(k=>k.startsWith(PREFIX)&&k!==BACKUP_KEY).forEach(k=>A.removeItem(k));Object.entries(inc).forEach(([k,v])=>A.setItem(k,v));return {mode,jobs:(JSON.parse(inc[DB_KEY]||'{"jobs":[]}').jobs||[]).length}}
      // merge: jobs merged by job number (incoming wins on clash); other keys only filled if missing
      const cur=S.loadDB()||{jobs:[],nextNo:1001};const incDB=JSON.parse(inc[DB_KEY]||'{"jobs":[]}');let added=0,updated=0;
      (incDB.jobs||[]).forEach(j=>{const i=cur.jobs.findIndex(x=>x.no===j.no);if(i>=0){cur.jobs[i]=j;updated++}else{cur.jobs.push(j);added++}});
      cur.nextNo=Math.max(cur.nextNo||1001,incDB.nextNo||1001);cur.seeded=[...new Set([...(cur.seeded||[]),...(incDB.seeded||[])])];S.saveDB(cur);
      Object.entries(inc).forEach(([k,v])=>{if(k!==DB_KEY&&A.getItem(k)==null)A.setItem(k,v)});return {mode,added,updated}},
    markBackup(){A.setItem(BACKUP_KEY,new Date().toISOString())},
    lastBackup(){const v=A.getItem(BACKUP_KEY);return v?new Date(v):null}
  };return S})();
