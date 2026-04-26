const SUPABASE_URL = 'https://ulepandzutlcxggwclne.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZXBhbmR6dXRsY3hnZ3djbG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDA1NTUsImV4cCI6MjA5MTY3NjU1NX0.g8wjAmCirvto0wThRx7qYjVSBCzoNRRihfDVlMZ-PQw';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const euro = n => new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n||0));
const fmtDate = d => d ? new Date(d).toLocaleDateString('it-IT') : '—';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id'+Date.now()+Math.random().toString(16).slice(2));
const $ = id => document.getElementById(id);
const state = {cars:[], clients:[], deadlines:[], docs:[], settings:{}, editingCar:null, editingClient:null, editingDeadline:null, pendingCover:''};

function persistTheme(){ localStorage.setItem('abg_theme', document.documentElement.dataset.theme); }

// Caricamento Dati
async function hydrate(){
  try{
    const rawTheme=localStorage.getItem('abg_theme'); 
    if(rawTheme) document.documentElement.dataset.theme=rawTheme;
    
    // Recupero dati da Supabase tabella univoca config
    const { data, error } = await supabase.from('config').select('data').eq('id', 1).single();
    if(data && data.data){
       const d = data.data;
       state.cars = d.cars || [];
       state.clients = d.clients || [];
       state.deadlines = d.deadlines || [];
       state.docs = d.docs || [];
       state.settings = d.settings || {};
    }
  }catch(e){ console.error("Errore download Supabase:", e); }
}

// Salvataggio Cloud
let debounceTimer;
async function saveToCloud() {
  state.settings = collectSettings();
  const payload = {
     id: 1,
     data: { cars: state.cars, clients: state.clients, deadlines: state.deadlines, docs: state.docs, settings: state.settings },
     updated_at: new Date().toISOString()
  };
  await supabase.from('config').upsert(payload);
}

function persist() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(saveToCloud, 1200);
}

function collectSettings(){return {capitaleIniziale:Number($('capitaleIniziale').value||0),speseCommercialista:Number($('speseCommercialista').value||0),dataApertura:$('dataApertura').value,partitaIva:$('partitaIva').value.trim(),ragioneSociale:$('ragioneSociale').value.trim(),ateco:$('ateco').value.trim(),email:$('email').value.trim(),pec:$('pec').value.trim(),telefono:$('telefono').value.trim(),coeff:Number($('coeff').value||40),aliquotaImposta:Number($('aliquotaImposta').value||15),tipoInps:$('tipoInps').value,riduzione35:$('riduzione35').value==='si',noteAttivita:$('noteAttivita').value.trim()};}
function fillSettings(){Object.entries(state.settings||{}).forEach(([k,v])=>{if($(k)) $(k).value=v;});}
function calcInps(reddito,tipo,rid35){if(tipo==='zero') return 0; const minRed=18808; const aliq=tipo==='commercianti'?0.2448:0.24; const min=tipo==='commercianti'?4611.64:4521.36; let tot=reddito<=0?0:(reddito<=minRed?min:min+((reddito-minRed)*aliq)); if(rid35) tot*=0.65; return tot;}
function daysInStock(car){const start=car.buyDate?new Date(car.buyDate):null; const end=car.sellDate?new Date(car.sellDate):new Date(); if(!start) return 0; return Math.max(0, Math.round((end-start)/(1000*60*60*24)));}
function totalCarCosts(c){return Number(c.buyPrice||0)+Number(c.passaggio||0)+Number(c.riparazioni||0)+Number(c.carburante||0)+Number(c.altroCosto||0);}
function carMargin(c){return Number(c.sellPrice||0)-totalCarCosts(c);}
function metrics(){const s=collectSettings(); const ricavi=state.cars.reduce((a,c)=>a+Number(c.sellPrice||0),0); const costiReal=state.cars.reduce((a,c)=>a+totalCarCosts(c),0)+Number(s.speseCommercialista||0); const redditoForf=ricavi*((Number(s.coeff||40))/100); const inps=calcInps(redditoForf,s.tipoInps||'commercianti',!!s.riduzione35); const base=Math.max(0,redditoForf-inps); const imposta=base*((Number(s.aliquotaImposta||15))/100); const spendibile=ricavi-costiReal-inps-imposta; const capitale=Number(s.capitaleIniziale||0)+spendibile; const soldCars=state.cars.filter(c=>Number(c.sellPrice||0)>0); const avgMargin=soldCars.length?soldCars.reduce((a,c)=>a+carMargin(c),0)/soldCars.length:0; let soglia='Dentro soglia'; if(ricavi>=51000 && ricavi<68000) soglia='Attenzione: oltre 60%'; if(ricavi>=68000 && ricavi<76500) soglia='Attenzione: oltre 80%'; if(ricavi>=76500 && ricavi<85000) soglia='Quasi al limite'; if(ricavi>=85000) soglia='Soglia superata'; return {s,ricavi,costiReal,redditoForf,inps,base,imposta,spendibile,capitale,avgMargin,soglia,safeBudget:Math.max(0,capitale*0.65)};}
function updateThemeThumb(){ $('themeThumb').textContent = document.documentElement.dataset.theme==='dark' ? '🌙' : '☀️'; }
function openPanel(id){$('drawer').classList.add('open'); document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active')); if(!$(id)) id='dashboardPanel'; $(id).classList.add('active'); document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.panel===id)); const routeMap={dashboardPanel:'/dashboard',autoPanel:'/auto',clientsPanel:'/clienti',deadlinesPanel:'/scadenze',docsPanel:'/documenti',linksPanel:'/link-utili',forfPanel:'/forfettario',ordPanel:'/ordinario',advicePanel:'/consigli',aiPanel:'/ai',settingsPanel:'/impostazioni'}; $('routePath').textContent=routeMap[id]||'/dashboard'; try{location.hash=(routeMap[id]||'/dashboard').replace('/','#/');}catch(e){}}
function setOptionsClients(){const sel=$('clientLink'); const current=sel.value; sel.innerHTML='<option value="">Nessuno</option>'+state.clients.map(c=>`<option value="${c.id}">${c.name}</option>`).join(''); if(current) sel.value=current;}

function readAsDataURL(file){return new Promise((resolve,reject)=>{const fr=new FileReader(); fr.onload=()=>resolve(fr.result); fr.onerror=reject; fr.readAsDataURL(file);});}
async function onCoverChange(e){const file=e.target.files[0]; if(!file){state.pendingCover=''; return;} state.pendingCover=await readAsDataURL(file);}
function resetCarForm(){state.editingCar=null; state.pendingCover=''; $('coverUpload').value=''; ['carName','carPlate','buyDate','sellDate','carNotes'].forEach(id=>$(id).value=''); ['buyPrice','sellPrice','targetPrice','minPrice','passaggio','riparazioni','carburante','altroCosto'].forEach(id=>$(id).value='0'); ['carStatus','carSource','saleChannel'].forEach(id=>$(id).selectedIndex=0); $('clientLink').value=''; $('saveCar').textContent='Salva auto';}
function closeSaleQuick(){ $('carStatus').value='Venduta'; if(!$('sellDate').value) $('sellDate').value = new Date().toISOString().slice(0,10); }

function collectCar(){return {id:state.editingCar||uid(),name:$('carName').value.trim()||'Auto senza nome',plate:$('carPlate').value.trim(),status:$('carStatus').value,source:$('carSource').value,buyDate:$('buyDate').value,sellDate:$('sellDate').value,buyPrice:Number($('buyPrice').value||0),sellPrice:Number($('sellPrice').value||0),targetPrice:Number($('targetPrice').value||0),minPrice:Number($('minPrice').value||0),passaggio:Number($('passaggio').value||0),riparazioni:Number($('riparazioni').value||0),carburante:Number($('carburante').value||0),altroCosto:Number($('altroCosto').value||0),saleChannel:$('saleChannel').value,clientId:$('clientLink').value,notes:$('carNotes').value.trim(),cover:state.pendingCover||((state.cars.find(x=>x.id===state.editingCar)||{}).cover||''),updatedAt:new Date().toLocaleString('it-IT')};}

function saveCar(){
  const car=collectCar(); const snap={...car,snapshotAt:new Date().toLocaleString('it-IT')}; 
  const idx=state.cars.findIndex(c=>c.id===car.id); 
  if(idx>=0){const prev=state.cars[idx]; car.history=[...(prev.history||[]),snap]; state.cars[idx]=car;} 
  else {car.history=[snap]; state.cars.unshift(car);} 
  renderAll(); persist(); resetCarForm();
}
function editCar(id){const c=state.cars.find(x=>x.id===id); if(!c) return; state.editingCar=id; state.pendingCover=c.cover||''; $('carName').value=c.name||''; $('carPlate').value=c.plate||''; $('carStatus').value=c.status||'Da visionare'; $('carSource').value=c.source||'Privato'; $('buyDate').value=c.buyDate||''; $('sellDate').value=c.sellDate||''; $('buyPrice').value=c.buyPrice||0; $('sellPrice').value=c.sellPrice||0; $('targetPrice').value=c.targetPrice||0; $('minPrice').value=c.minPrice||0; $('passaggio').value=c.passaggio||0; $('riparazioni').value=c.riparazioni||0; $('carburante').value=c.carburante||0; $('altroCosto').value=c.altroCosto||0; $('saleChannel').value=c.saleChannel||'Subito'; $('clientLink').value=c.clientId||''; $('carNotes').value=c.notes||''; $('saveCar').textContent='Aggiorna auto'; openPanel('autoPanel');}
function duplicateCar(id){
  const c=state.cars.find(x=>x.id===id); if(!c) return; 
  const copy={...c,id:uid(),plate:'',status:'Da visionare',sellDate:'',sellPrice:0,history:[]}; 
  state.cars.unshift(copy); 
  renderAll(); persist();
}
function deleteCar(id){
  state.cars=state.cars.filter(c=>c.id!==id); 
  renderAll(); persist();
}

function resetClientForm(){state.editingClient=null; ['clientName','clientPhone','clientEmail','clientInterest','clientFollow','clientNotes'].forEach(id=>$(id).value=''); $('clientBudget').value='0'; ['clientStatus','clientSource'].forEach(id=>$(id).selectedIndex=0); $('saveClient').textContent='Salva cliente';}
function collectClient(){return {id:state.editingClient||uid(),name:$('clientName').value.trim()||'Cliente senza nome',phone:$('clientPhone').value.trim(),email:$('clientEmail').value.trim(),budget:Number($('clientBudget').value||0),interest:$('clientInterest').value.trim(),status:$('clientStatus').value,follow:$('clientFollow').value,source:$('clientSource').value,notes:$('clientNotes').value.trim(),updatedAt:new Date().toLocaleString('it-IT')};}

function saveClient(){
  const item=collectClient(); const idx=state.clients.findIndex(c=>c.id===item.id); 
  if(idx>=0) state.clients[idx]=item; else state.clients.unshift(item); 
  renderAll(); persist(); resetClientForm();
}
function editClient(id){const c=state.clients.find(x=>x.id===id); if(!c) return; state.editingClient=id; $('clientName').value=c.name||''; $('clientPhone').value=c.phone||''; $('clientEmail').value=c.email||''; $('clientBudget').value=c.budget||0; $('clientInterest').value=c.interest||''; $('clientStatus').value=c.status||'Nuovo'; $('clientFollow').value=c.follow||''; $('clientSource').value=c.source||'Subito'; $('clientNotes').value=c.notes||''; $('saveClient').textContent='Aggiorna cliente'; openPanel('clientsPanel');}
function deleteClient(id){
  const affected = state.cars.filter(c => c.clientId === id);
  state.clients=state.clients.filter(c=>c.id!==id); 
  state.cars=state.cars.map(c=>c.clientId===id?{...c,clientId:''}:c); 
  renderAll(); persist();
}

function resetDeadlineForm(){state.editingDeadline=null; ['deadlineTitle','deadlineDate','deadlineLink','deadlineNotes'].forEach(id=>$(id).value=''); ['deadlineCategory','deadlinePriority','deadlineStatus'].forEach(id=>$(id).selectedIndex=0); $('saveDeadline').textContent='Salva scadenza';}
function collectDeadline(){return {id:state.editingDeadline||uid(),title:$('deadlineTitle').value.trim()||'Scadenza senza titolo',date:$('deadlineDate').value,category:$('deadlineCategory').value,priority:$('deadlinePriority').value,status:$('deadlineStatus').value,link:$('deadlineLink').value.trim(),notes:$('deadlineNotes').value.trim(),updatedAt:new Date().toLocaleString('it-IT')};}

function saveDeadline(){
  const item=collectDeadline(); const idx=state.deadlines.findIndex(d=>d.id===item.id); 
  if(idx>=0) state.deadlines[idx]=item; else state.deadlines.unshift(item); 
  renderAll(); persist(); resetDeadlineForm();
}
function editDeadline(id){const d=state.deadlines.find(x=>x.id===id); if(!d) return; state.editingDeadline=id; $('deadlineTitle').value=d.title||''; $('deadlineDate').value=d.date||''; $('deadlineCategory').value=d.category||'Fiscale'; $('deadlinePriority').value=d.priority||'Alta'; $('deadlineStatus').value=d.status||'Aperta'; $('deadlineLink').value=d.link||''; $('deadlineNotes').value=d.notes||''; $('saveDeadline').textContent='Aggiorna scadenza'; openPanel('deadlinesPanel');}
function deleteDeadline(id){
  state.deadlines=state.deadlines.filter(d=>d.id!==id); 
  renderAll(); persist();
}
function toggleDeadlineDone(id){
  state.deadlines=state.deadlines.map(d=>d.id===id?{...d,status:d.status==='Fatta'?'Aperta':'Fatta'}:d); 
  renderAll(); persist();
}

async function handleDocs(files){
  const tag=$('docTag').value.trim(); const type=$('docType').value; 
  for(const f of [...files]){
    let preview=''; let image=''; 
    if(f.type.startsWith('image/')){image=await readAsDataURL(f);} 
    else if(/(text|json|csv|html)/i.test(f.type) || /\.(txt|csv|json|html)$/i.test(f.name)){
      try{const txt=await f.text(); preview=txt.slice(0,260).replace(/\s+/g,' ').trim();}catch(e){}
    } 
    const doc = {id:uid(),name:f.name,tag,docType:type,size:f.size,preview,image,createdAt:new Date().toLocaleString('it-IT')};
    state.docs.unshift(doc);
  } 
  $('docUpload').value=''; $('docTag').value=''; 
  renderAll(); persist();
}
function clearDocs(){
  if(confirm('Vuoi svuotare tutto l\'archivio documenti?')){
    state.docs=[]; 
    renderAll(); persist();
  }
}

function renderCars(){const box=$('carList'); const q=$('carSearch').value.trim().toLowerCase(); const f=$('carFilter').value; const filtered=state.cars.filter(c=>{const hay=[c.name,c.plate,c.notes,c.status,c.source,c.saleChannel].join(' ').toLowerCase(); return (!q || hay.includes(q)) && (!f || c.status===f);}); if(!filtered.length){box.innerHTML='<div class="item"><div class="muted">Nessuna auto trovata.</div></div>'; return;} box.innerHTML=filtered.map(c=>{const margin=carMargin(c); const client=state.clients.find(x=>x.id===c.clientId); const color=margin>1000?'green':margin>=0?'orange':'red'; const history=(c.history||[]).slice(-3).reverse().map(h=>`<div class="tl-item">${h.snapshotAt}: acquisto ${euro(h.buyPrice)}, vendita ${euro(h.sellPrice)}, costi ${euro(Number(h.passaggio||0)+Number(h.riparazioni||0)+Number(h.carburante||0)+Number(h.altroCosto||0))}</div>`).join(''); return `<div class="item"><div class="item-top"><div style="display:flex;gap:12px;align-items:flex-start">${c.cover?`<img class="cover" src="${c.cover}" alt="copertina auto">`:''}<div><h4>${c.name}</h4><p>${c.plate||'Nessuna targa'} · ${c.status} · ${c.source}</p><div class="status ${color}">${margin>=0?'Margine positivo':'Margine negativo'} · ${euro(margin)}</div></div></div><div class="actions" style="margin-top:0"><button class="btn secondary" onclick="editCar('${c.id}')">Modifica</button><button class="btn secondary" onclick="duplicateCar('${c.id}')">Duplica</button><button class="btn secondary" onclick="closeCarSale('${c.id}')">Chiudi</button><button class="btn secondary" onclick="deleteCar('${c.id}')">Elimina</button></div></div><div class="item-meta"><div><div class="small">Costo totale</div><strong>${euro(totalCarCosts(c))}</strong></div><div><div class="small">Prezzo vendita</div><strong>${euro(c.sellPrice)}</strong></div><div><div class="small">Giorni fermo</div><strong>${daysInStock(c)}</strong></div><div><div class="small">Prezzo target</div><strong>${euro(c.targetPrice)}</strong></div><div><div class="small">Canale vendita</div><strong>${c.saleChannel}</strong></div><div><div class="small">Cliente</div><strong>${client?client.name:'Nessuno'}</strong></div></div><div class="timeline">${history||'<div class="tl-item">Nessuno storico disponibile.</div>'}${c.notes?`<div class="tl-item">Note: ${c.notes}</div>`:''}</div></div>`;}).join('');}
function closeCarSale(id){
  const c=state.cars.find(x=>x.id===id); if(!c) return; 
  c.status='Venduta'; if(!c.sellDate) c.sellDate=new Date().toISOString().slice(0,10); 
  c.updatedAt=new Date().toLocaleString('it-IT'); 
  c.history=[...(c.history||[]), {...c, snapshotAt:new Date().toLocaleString('it-IT')}]; 
  renderAll(); persist();
}
window.editCar=editCar; window.duplicateCar=duplicateCar; window.deleteCar=deleteCar; window.closeCarSale=closeCarSale;

function renderClients(){const box=$('clientList'); if(!state.clients.length){box.innerHTML='<div class="item"><div class="muted">Nessun cliente inserito.</div></div>'; return;} box.innerHTML=state.clients.map(c=>`<div class="item"><div class="item-top"><div><h4>${c.name}</h4><p>${c.phone||'Senza telefono'} · ${c.status} · ${c.source}</p></div><div class="actions" style="margin-top:0"><button class="btn secondary" onclick="editClient('${c.id}')">Modifica</button><button class="btn secondary" onclick="deleteClient('${c.id}')">Elimina</button></div></div><div class="item-meta"><div><div class="small">Budget</div><strong>${euro(c.budget)}</strong></div><div><div class="small">Interesse</div><strong>${c.interest||'—'}</strong></div><div><div class="small">Follow-up</div><strong>${fmtDate(c.follow)}</strong></div></div>${c.notes?`<div class="timeline"><div class="tl-item">${c.notes}</div></div>`:''}</div>`).join(''); const today = new Date().toISOString().slice(0,10); const due = state.clients.filter(c=>c.follow && c.follow<=today && c.status!=='Chiuso' && c.status!=='Perso'); $('clientReminderList').innerHTML = due.length ? due.map(c=>`<div class="item"><strong>${c.name}</strong><div class="small">Follow-up da fare · ${fmtDate(c.follow)}</div></div>`).join('') : '<div class="item"><div class="muted">Nessun follow-up urgente.</div></div>';}
window.editClient=editClient; window.deleteClient=deleteClient;

function renderDeadlines(){const box=$('deadlineList'); const sorted=[...state.deadlines].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')); if(!sorted.length){box.innerHTML='<div class="item"><div class="muted">Nessuna scadenza inserita.</div></div>'; $('deadlineSoonList').innerHTML='<div class="item"><div class="muted">Nessuna scadenza vicina.</div></div>'; return;} box.innerHTML=sorted.map(d=>`<div class="item"><div class="item-top"><div><h4>${d.title}</h4><p>${d.category} · ${d.priority} · ${d.status}</p></div><div class="actions" style="margin-top:0"><button class="btn secondary" onclick="editDeadline('${d.id}')">Modifica</button><button class="btn secondary" onclick="toggleDeadlineDone('${d.id}')">Fatta</button><button class="btn secondary" onclick="deleteDeadline('${d.id}')">Elimina</button></div></div><div class="item-meta"><div><div class="small">Data</div><strong>${fmtDate(d.date)}</strong></div><div><div class="small">Collegata a</div><strong>${d.link||'—'}</strong></div><div><div class="small">Aggiornata</div><strong>${d.updatedAt}</strong></div></div>${d.notes?`<div class="timeline"><div class="tl-item">${d.notes}</div></div>`:''}</div>`).join(''); const today=new Date(); const soon=sorted.filter(d=>d.status!=='Fatta' && d.date && ((new Date(d.date)-today)/(1000*60*60*24))<=7).slice(0,6); $('deadlineSoonList').innerHTML=soon.length?soon.map(d=>`<div class="item"><strong>${d.title}</strong><div class="small">${fmtDate(d.date)} · ${d.priority}</div></div>`).join(''):'<div class="item"><div class="muted">Nessuna scadenza nei prossimi 7 giorni.</div></div>';}
window.editDeadline=editDeadline; window.deleteDeadline=deleteDeadline; window.toggleDeadlineDone=toggleDeadlineDone;

function renderDocs(){const box=$('docList'); if(!state.docs.length){box.innerHTML='<div class="item"><div class="muted">Nessun documento caricato.</div></div>'; return;} box.innerHTML=state.docs.map(d=>`<div class="upload-item">${d.image?`<img class="cover" src="${d.image}" alt="anteprima documento" style="margin-bottom:8px">`:''}<strong>${d.tag?d.tag+' · ':''}${d.name}</strong><div class="small">${d.docType} · ${d.createdAt}</div>${d.preview?`<div class="small" style="margin-top:6px">${d.preview}</div>`:''}</div>`).join('');}

function renderHome(){const m=metrics(); $('dashRicavi').textContent=euro(m.ricavi); $('dashReddito').textContent=euro(m.redditoForf); $('dashInps').textContent=euro(m.inps); $('dashImposta').textContent=euro(m.imposta); $('dashBase').textContent=euro(m.base); $('dashCoeff').textContent=`${m.s.coeff||40}%`; $('dashAliquota').textContent=`${m.s.aliquotaImposta||15}%`; $('dashSoglia').textContent=m.soglia; $('outCosti').textContent=euro(m.costiReal); $('outSpendibile').textContent=euro(m.spendibile); $('outCapitale').textContent=euro(m.capitale); $('outCount').textContent=state.cars.length; $('avgMargin').textContent=euro(m.avgMargin); $('outClients').textContent=state.clients.length; $('outDeadlines').textContent=state.deadlines.filter(d=>d.status!=='Fatta').length; $('safeBudget').textContent=euro(m.safeBudget);
  const alerts=[]; if(m.ricavi>=76500 && m.ricavi<85000) alerts.push('Sei vicino alla soglia: controlla bene ogni nuova vendita.'); if(m.ricavi>=85000) alerts.push('Hai superato la soglia: verifica subito la situazione con attenzione.'); if(m.capitale<0) alerts.push('Il capitale riutilizzabile è negativo: blocca nuovi acquisti impulsivi.'); if(state.deadlines.some(d=>d.status!=='Fatta' && d.date && d.date<=new Date().toISOString().slice(0,10))) alerts.push('Hai scadenze scadute o in giornata da guardare subito.'); if(state.clients.some(c=>c.follow && c.follow<=new Date().toISOString().slice(0,10) && !['Chiuso','Perso'].includes(c.status))) alerts.push('Hai clienti da ricontattare oggi.'); if(!alerts.length) alerts.push('Situazione sotto controllo: aggiorna i dati e continua a monitorare margini e scadenze.'); $('alertList').innerHTML=alerts.map(a=>`<div class="item"><div class="small">Alert</div><strong>${a}</strong></div>`).join('');
  const grouped={}; state.cars.forEach(c=>{const key=(c.name||'').split(' ').slice(0,2).join(' '); if(!key) return; grouped[key]=(grouped[key]||0)+carMargin(c);}); const tops=Object.entries(grouped).sort((a,b)=>b[1]-a[1]).slice(0,4); $('topModels').innerHTML=tops.length?tops.map(([k,v])=>`<div class="item"><strong>${k}</strong><div class="small">Margine totale ${euro(v)}</div></div>`).join(''):'<div class="item"><div class="muted">Ancora pochi dati per una classifica.</div></div>';
  const todos=[]; const nextDeadline=[...state.deadlines].filter(d=>d.status!=='Fatta'&&d.date).sort((a,b)=>a.date.localeCompare(b.date))[0]; if(nextDeadline) todos.push(`Prima mossa: ${nextDeadline.title} entro ${fmtDate(nextDeadline.date)}.`); const hotClient=state.clients.find(c=>['Caldo','In trattativa','Appuntamento'].includes(c.status)); if(hotClient) todos.push(`Ricontatta ${hotClient.name}: trattativa ${hotClient.status.toLowerCase()}.`); const stuck=state.cars.filter(c=>!['Venduta','Consegnata'].includes(c.status) && daysInStock(c)>30).sort((a,b)=>daysInStock(b)-daysInStock(a))[0]; if(stuck) todos.push(`Controlla ${stuck.name}: ferma da ${daysInStock(stuck)} giorni.`); if(m.capitale>0) todos.push(`Budget prudente per prossimo acquisto: circa ${euro(m.safeBudget)}.`); if(!todos.length) todos.push('Inserisci auto, clienti e scadenze per vedere le prossime mosse.'); $('quickTodos').innerHTML=todos.map(t=>`<div class="item"><strong>${t}</strong></div>`).join('');
}
function renderToday(){const m=metrics(); const hotClients=state.clients.filter(c=>['Caldo','In trattativa','Appuntamento'].includes(c.status)).slice(0,4); const stuckCars=state.cars.filter(c=>!['Venduta','Consegnata'].includes(c.status) && daysInStock(c)>20).sort((a,b)=>daysInStock(b)-daysInStock(a)).slice(0,4); const openDead=state.deadlines.filter(d=>d.status!=='Fatta').sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')).slice(0,4); $('todayFocus').innerHTML = [`<div class="row"><span>Guadagno spendibile</span><span class="value-right">${euro(m.spendibile)}</span></div>`,`<div class="row"><span>Capitale riutilizzabile</span><span class="value-right">${euro(m.capitale)}</span></div>`,`<div class="row"><span>Budget prudente</span><span class="value-right">${euro(m.safeBudget)}</span></div>`,`<div class="row"><span>Stato soglia</span><span class="value-right">${m.soglia}</span></div>`].join(''); const actions=[]; if(openDead[0]) actions.push(`<div class="row"><span>Prima scadenza</span><span class="value-right">${openDead[0].title}</span></div>`); if(hotClients[0]) actions.push(`<div class="row"><span>Cliente da seguire</span><span class="value-right">${hotClients[0].name}</span></div>`); if(stuckCars[0]) actions.push(`<div class="row"><span>Auto da sbloccare</span><span class="value-right">${stuckCars[0].name}</span></div>`); actions.push(`<div class="row"><span>Obiettivo del giorno</span><span class="value-right">Aggiorna trattative e margini</span></div>`); $('todayActions').innerHTML = actions.join(''); $('todayClients').innerHTML = hotClients.length ? hotClients.map(c=>`<div class="item"><strong>${c.name}</strong><div class="small">${c.status} · ${c.interest||'interesse non indicato'}</div></div>`).join('') : '<div class="item"><div class="muted">Nessun cliente caldo al momento.</div></div>'; $('todayCars').innerHTML = stuckCars.length ? stuckCars.map(c=>`<div class="item"><strong>${c.name}</strong><div class="small">Ferma da ${daysInStock(c)} giorni · ${c.status}</div></div>`).join('') : '<div class="item"><div class="muted">Nessuna auto ferma da troppo tempo.</div></div>'; $('todayCash').innerHTML = [`<div class="item"><strong>Puoi reinvestire con prudenza circa ${euro(m.safeBudget)}</strong><div class="small">Mantieni sempre margine per imprevisti, pratiche e preparazione.</div></div>`,`<div class="item"><strong>Controlla il margine reale per auto</strong><div class="small">Non guardare solo il venduto: il capitale si libera davvero quando il margine resta sano.</div></div>`].join('');}

function routeToPanel(){const h=(location.hash||'#/dashboard').replace('#',''); const panelMap={'/dashboard':'dashboardPanel','/auto':'autoPanel','/clienti':'clientsPanel','/scadenze':'deadlinesPanel','/documenti':'docsPanel','/link-utili':'linksPanel','/forfettario':'forfPanel','/ordinario':'ordPanel','/consigli':'advicePanel','/ai':'aiPanel','/impostazioni':'settingsPanel'}; return panelMap[h]||'dashboardPanel';}
function renderOrdinary(){const m=metrics(); const vatSales=Number($('ordVatSales')?.value||22)/100; const vatCosts=Number($('ordVatCosts')?.value||22)/100; const extra=Number($('ordDeductExtra')?.value||0); const irpef=Number($('ordIrpefRate')?.value||23)/100; const ricavi=m.ricavi; const costi=m.costiReal+extra; const ivaVendite=ricavi*vatSales; const ivaCosti=costi*vatCosts; const saldoIva=Math.max(0, ivaVendite-ivaCosti); const reddito=Math.max(0, ricavi-costi); const irpefStim=reddito*irpef; const netto=ricavi-costi-saldoIva-irpefStim; if($('ordRicavi')) $('ordRicavi').textContent=euro(ricavi); if($('ordCosti')) $('ordCosti').textContent=euro(costi); if($('ordIvaVendite')) $('ordIvaVendite').textContent=euro(ivaVendite); if($('ordIvaCosti')) $('ordIvaCosti').textContent=euro(ivaCosti); if($('ordSaldoIva')) $('ordSaldoIva').textContent=euro(saldoIva); if($('ordReddito')) $('ordReddito').textContent=euro(reddito); if($('ordIrpef')) $('ordIrpef').textContent=euro(irpefStim); if($('ordNetto')) $('ordNetto').textContent=euro(netto);}

function renderSimulator(){const total=Number($('simBuy').value||0)+Number($('simPass').value||0)+Number($('simRep').value||0)+Number($('simExtra').value||0); const margin=Number($('simSell').value||0)-total; $('simTotal').textContent=euro(total); $('simMargin').textContent=euro(margin); $('simVerdict').textContent = margin>=1500?'Molto interessante':margin>=500?'Valutabile':margin>=0?'Margine stretto':'Da evitare';}
function askAi(){const q=$('aiQuestion').value.trim().toLowerCase(); if(!q){$('aiAnswer').textContent='Scrivi prima una domanda.'; return;} const m=metrics(); const sold=[...state.cars].sort((a,b)=>carMargin(b)-carMargin(a)); const best=sold[0]; const worst=sold[sold.length-1]; const dueClients=state.clients.filter(c=>c.follow && c.follow<=new Date().toISOString().slice(0,10) && !['Chiuso','Perso'].includes(c.status)); const openDead=state.deadlines.filter(d=>d.status!=='Fatta').length; let ans='';
  if(q.includes('reinvest')||q.includes('budget')||q.includes('comprare')) ans=`Capitale riutilizzabile: ${euro(m.capitale)}. Budget prudente consigliato: ${euro(m.safeBudget)}.\n\nSe vuoi restare prudente, non usare tutto il capitale: lascia sempre margine per passaggi, ripristino e imprevisti.`;
  else if(q.includes('peggiore')||q.includes('migliore')||q.includes('margine')) ans=`Auto migliore: ${best?best.name+' con margine '+euro(carMargin(best)):'nessuna'} .\nAuto peggiore: ${worst?worst.name+' con margine '+euro(carMargin(worst)):'nessuna'} .\n\nGuarda soprattutto le auto con costi extra alti o ferme troppo a lungo.`;
  else if(q.includes('oggi')||q.includes('priorità')||q.includes('fare')) ans=`Priorità di oggi:\n1. ${dueClients[0]?'Ricontatta '+dueClients[0].name:'Controlla follow-up clienti.'}\n2. ${openDead?`Hai ${openDead} scadenze aperte da gestire.`:'Nessuna scadenza aperta urgente.'}\n3. ${state.cars.find(c=>!['Venduta','Consegnata'].includes(c.status) && daysInStock(c)>30)?'Guarda le auto ferme da più di 30 giorni.':'Aggiorna note e stato delle trattative.'}`;
  else if(q.includes('soglia')||q.includes('forfett')) ans=`Ricavi attuali: ${euro(m.ricavi)}. Stato soglia: ${m.soglia}.\n\nControlla bene ogni nuova vendita se sei vicino al limite e usa la home come cruscotto rapido.`;
  else if(q.includes('client')||q.includes('richiama')||q.includes('follow')) ans=`Clienti da ricontattare oggi: ${dueClients.length}.\n\n${dueClients.length?dueClients.map(c=>'- '+c.name+' · '+(c.interest||'interesse non indicato')).join('\n'):'Nessun follow-up urgente segnato.'}`;
  else if(q.includes('document')||q.includes('file')) ans=`Hai ${state.docs.length} documenti salvati.\n\nUsa etichette chiare e fai un export JSON periodico per non perdere il tuo archivio.`;
  else ans=`Situazione attuale:\nRicavi ${euro(m.ricavi)}\nCosti reali ${euro(m.costiReal)}\nGuadagno spendibile ${euro(m.spendibile)}\nCapitale riutilizzabile ${euro(m.capitale)}\nScadenze aperte ${openDead}\nClienti attivi ${state.clients.length}\n\nSe vuoi una risposta più precisa chiedimi budget, margini, clienti da ricontattare o priorità di oggi.`;
  $('aiAnswer').textContent=ans;
}
function copyPrompt(){const m=metrics(); const txt=`Sei un assistente per una rivendita auto. Analizza questi dati e rispondi in italiano semplice. Ricavi ${m.ricavi}, costi reali ${m.costiReal}, reddito forfettario ${m.redditoForf}, INPS ${m.inps}, imposta ${m.imposta}, capitale riutilizzabile ${m.capitale}. Auto: ${state.cars.map(c=>`${c.name} margine ${carMargin(c)} stato ${c.status}`).join(' | ')||'nessuna'}. Clienti: ${state.clients.map(c=>`${c.name} stato ${c.status} follow ${c.follow||'-'}`).join(' | ')||'nessuno'}. Scadenze: ${state.deadlines.map(d=>`${d.title} ${d.date||'-'} ${d.status}`).join(' | ')||'nessuna'}. Documenti: ${state.docs.map(d=>`${d.name} ${d.preview||''}`).join(' | ')||'nessuno'}. Domanda: ${$('aiQuestion').value.trim()||'Riassumi situazione e priorità.'}`; navigator.clipboard.writeText(txt); $('aiAnswer').textContent='Prompt avanzato copiato. Puoi usarlo in un assistente esterno quando vuoi un parere più articolato.'; }
function toCsv(rows){if(!rows.length) return ''; const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))]; return [keys.join(','), ...rows.map(r=>keys.map(k=>JSON.stringify(r[k]??'')).join(','))].join('\n');}
function downloadFile(name,content,type='text/plain'){const blob=new Blob([content],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500);}

// L'esportazione prende tutto lo stato come prima, per salvataggio backup locale
function exportJson(){downloadFile('AutoBroskiGroupV5-backup.json', JSON.stringify({cars:state.cars,clients:state.clients,deadlines:state.deadlines,docs:state.docs,settings:collectSettings()},null,2), 'application/json');}

function importJsonFile(file){
  const fr=new FileReader(); 
  fr.onload=async ()=>{
    try{
      const d=JSON.parse(fr.result); 
      state.cars=d.cars||[]; 
      state.clients=d.clients||[]; 
      state.deadlines=d.deadlines||[]; 
      state.docs=d.docs||[]; 
      state.settings=d.settings||{}; 
      fillSettings(); 
      renderAll(); 
      
      await saveToCloud();
      
      alert('Backup importato e sincronizzato sul cloud (Tabella Config).');
    }catch(e){alert('JSON non valido.');}
  }; 
  fr.readAsText(file);
}

function exportCarsCsv(){downloadFile('AutoBroskiGroupV5-auto.csv', toCsv(state.cars.map(c=>({...c, totalCosts:totalCarCosts(c), margin:carMargin(c), daysInStock:daysInStock(c)}))), 'text/csv');}
function exportClientsCsv(){downloadFile('AutoBroskiGroupV5-clienti.csv', toCsv(state.clients), 'text/csv');}

async function wipeAll(){
  if(confirm('Vuoi cancellare tutti i dati SIA IN LOCALE CHE NEL CLOUD?')){
    localStorage.removeItem('abg_theme'); 
    localStorage.removeItem('abg_v5'); // nel caso fosse rimasto prima
    state.cars = []; state.clients = []; state.deadlines = []; state.docs = []; state.settings = {};
    await saveToCloud();
    location.reload();
  }
}

function renderAll(){
  setOptionsClients(); renderHome(); renderToday(); renderCars(); renderClients(); renderDeadlines(); renderDocs(); renderOrdinary(); renderSimulator(); 
}

$('openDrawer').addEventListener('click', ()=>openPanel('dashboardPanel')); $('closeDrawer').addEventListener('click', ()=>$('drawer').classList.remove('open'));
document.querySelectorAll('.nav button').forEach(b=>b.addEventListener('click',()=>openPanel(b.dataset.panel)));
$('themeSwitch').addEventListener('click', ()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark'; updateThemeThumb(); persistTheme();});
document.querySelectorAll('.tooltip').forEach(t=>t.addEventListener('click',e=>{e.preventDefault(); t.classList.toggle('open');}));
$('saveCar').addEventListener('click', saveCar); $('resetCar').addEventListener('click', resetCarForm); $('closeSaleBtn').addEventListener('click', closeSaleQuick); $('coverUpload').addEventListener('change', onCoverChange); $('carSearch').addEventListener('input', renderCars); $('carFilter').addEventListener('change', renderCars);
$('saveClient').addEventListener('click', saveClient); $('resetClient').addEventListener('click', resetClientForm);
$('saveDeadline').addEventListener('click', saveDeadline); $('resetDeadline').addEventListener('click', resetDeadlineForm);
$('docUpload').addEventListener('change', e=>handleDocs(e.target.files)); $('clearDocs').addEventListener('click', clearDocs);
$('askAi').addEventListener('click', askAi); $('copyPrompt').addEventListener('click', copyPrompt);
$('exportJson').addEventListener('click', exportJson); $('importJsonBtn').addEventListener('click', ()=>$('importJson').click()); $('importJson').addEventListener('change', e=>e.target.files[0]&&importJsonFile(e.target.files[0])); $('exportCarsCsv').addEventListener('click', exportCarsCsv); $('exportClientsCsv').addEventListener('click', exportClientsCsv); $('wipeAll').addEventListener('click', wipeAll);

['simBuy','simSell','simPass','simRep','simExtra','simDays'].forEach(id=>$(id).addEventListener('input', renderSimulator)); ['ordVatSales','ordVatCosts','ordDeductExtra','ordIrpefRate'].forEach(id=>$(id)&&$(id).addEventListener('input', renderOrdinary));

document.querySelectorAll('#settingsPanel input,#settingsPanel select,#settingsPanel textarea').forEach(el=>el.addEventListener('input', persist));

// INIT ASINCRONO
(async function init() {
  updateThemeThumb();
  await hydrate();
  fillSettings();
  renderAll();
  openPanel(routeToPanel());
  window.addEventListener('hashchange', ()=>openPanel(routeToPanel()));
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('SW PWA Ready'))
      .catch(e => console.error('SW err', e));
  }
})();
