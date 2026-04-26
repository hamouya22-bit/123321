const SUPABASE_URL = 'https://ulepandzutlcxggwclne.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZXBhbmR6dXRsY3hnZ3djbG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDA1NTUsImV4cCI6MjA5MTY3NjU1NX0.g8wjAmCirvto0wThRx7qYjVSBCzoNRRihfDVlMZ-PQw';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const euro = n => new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n||0));
const fmtDate = d => d ? new Date(d).toLocaleDateString('it-IT') : '—';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id'+Date.now()+Math.random().toString(16).slice(2));
const $ = id => document.getElementById(id);
const state = {cars:[], clients:[], deadlines:[], docs:[], settings:{}, editingCar:null, editingClient:null, editingDeadline:null, pendingCover:''};

// --- FUNZIONI CLOUD ---
async function loadAllFromCloud() {
  try {
    const { data, error } = await supabase.from('config').select('data').eq('id', 1).single();
    if (error) throw error;
    if (data && data.data) {
      const cloudState = data.data;
      state.cars = cloudState.cars || [];
      state.clients = cloudState.clients || [];
      state.deadlines = cloudState.deadlines || [];
      state.settings = cloudState.settings || {};
      state.docs = cloudState.docs || [];
      console.log("☁️ Dati sincronizzati dal Cloud");
    }
  } catch (err) {
    console.warn("⚠️ Cloud non disponibile, uso backup locale:", err);
    hydrateLocal();
  }
}

async function saveToCloud() {
  try {
    await supabase.from('config').upsert({ 
      id: 1, 
      data: { cars: state.cars, clients: state.clients, deadlines: state.deadlines, settings: state.settings, docs: state.docs } 
    });
    console.log("☁️ Salvato nel Cloud");
  } catch (err) { console.error("❌ Errore Cloud:", err); }
}

function hydrateLocal(){
  const raw=localStorage.getItem('abg_state'); if(raw) Object.assign(state, JSON.parse(raw));
  const rawTheme=localStorage.getItem('abg_theme'); if(rawTheme) document.documentElement.dataset.theme=rawTheme;
}

function persist(){
  localStorage.setItem('abg_state', JSON.stringify(state));
  saveToCloud();
}
function persistTheme(){ localStorage.setItem('abg_theme', document.documentElement.dataset.theme); }

// --- LOGICA E CALCOLI ---
function collectSettings(){return {capitaleIniziale:Number($('capitaleIniziale').value||0),speseCommercialista:Number($('speseCommercialista').value||0),dataApertura:$('dataApertura').value,partitaIva:$('partitaIva').value.trim(),ragioneSociale:$('ragioneSociale').value.trim(),ateco:$('ateco').value.trim(),email:$('email').value.trim(),pec:$('pec').value.trim(),telefono:$('telefono').value.trim(),coeff:Number($('coeff').value||40),aliquotaImposta:Number($('aliquotaImposta').value||15),tipoInps:$('tipoInps').value,riduzione35:$('riduzione35').value==='si',noteAttivita:$('noteAttivita').value.trim()};}
function fillSettings(){Object.entries(state.settings||{}).forEach(([k,v])=>{if($(k)) $(k).value=v;});}
function calcInps(reddito,tipo,rid35){if(tipo==='zero') return 0; const minRed=18808; const aliq=tipo==='commercianti'?0.2448:0.24; const min=tipo==='commercianti'?4611.64:4521.36; let tot=reddito<=0?0:(reddito<=minRed?min:min+((reddito-minRed)*aliq)); if(rid35) tot*=0.65; return tot;}
function daysInStock(car){const start=car.buyDate?new Date(car.buyDate):null; const end=car.sellDate?new Date(car.sellDate):new Date(); if(!start) return 0; return Math.max(0, Math.round((end-start)/(1000*60*60*24)));}
function totalCarCosts(c){return Number(c.buyPrice||0)+Number(c.passaggio||0)+Number(c.riparazioni||0)+Number(c.carburante||0)+Number(c.altroCosto||0);}
function carMargin(c){return Number(c.sellPrice||0)-totalCarCosts(c);}

function metrics(){
  const s=collectSettings(); const ricavi=state.cars.reduce((a,c)=>a+Number(c.sellPrice||0),0);
  const costiReal=state.cars.reduce((a,c)=>a+totalCarCosts(c),0)+Number(s.speseCommercialista||0);
  const redditoForf=ricavi*((Number(s.coeff||40))/100);
  const inps=calcInps(redditoForf,s.tipoInps||'commercianti',!!s.riduzione35);
  const base=Math.max(0,redditoForf-inps); const imposta=base*((Number(s.aliquotaImposta||15))/100);
  const spendibile=ricavi-costiReal-inps-imposta; const capitale=Number(s.capitaleIniziale||0)+spendibile;
  const soldCars=state.cars.filter(c=>Number(c.sellPrice||0)>0);
  const avgMargin=soldCars.length?soldCars.reduce((a,c)=>a+carMargin(c),0)/soldCars.length:0;
  let soglia='Dentro soglia'; if(ricavi>=85000) soglia='Soglia superata'; else if(ricavi>=76500) soglia='Quasi al limite';
  return {s,ricavi,costiReal,redditoForf,inps,base,imposta,spendibile,capitale,avgMargin,soglia,safeBudget:Math.max(0,capitale*0.65)};
}

// --- INTERFACCIA ---
function updateThemeThumb(){ $('themeThumb').textContent = document.documentElement.dataset.theme==='dark' ? '🌙' : '☀️'; }
function openPanel(id){
  $('drawer').classList.add('open'); document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  if(!$(id)) id='dashboardPanel'; $(id).classList.add('active');
  document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.panel===id));
  const routeMap={dashboardPanel:'/dashboard',autoPanel:'/auto',clientsPanel:'/clienti',deadlinesPanel:'/scadenze',docsPanel:'/documenti',linksPanel:'/link-utili',forfPanel:'/forfettario',ordPanel:'/ordinario',advicePanel:'/consigli',aiPanel:'/ai',settingsPanel:'/impostazioni'};
  $('routePath').textContent=routeMap[id]||'/dashboard'; location.hash=(routeMap[id]||'/dashboard').replace('/','#/');
}

// --- AUTO ---
async function onCoverChange(e){const file=e.target.files[0]; if(!file){state.pendingCover=''; return;} const fr=new FileReader(); fr.onload=()=>state.pendingCover=fr.result; fr.readAsDataURL(file);}
function resetCarForm(){state.editingCar=null; state.pendingCover=''; $('carName').value=''; $('carPlate').value=''; $('saveCar').textContent='Salva auto';}
function saveCar(){
  const car={id:state.editingCar||uid(),name:$('carName').value.trim()||'Auto senza nome',plate:$('carPlate').value.trim(),status:$('carStatus').value,source:$('carSource').value,buyDate:$('buyDate').value,sellDate:$('sellDate').value,buyPrice:Number($('buyPrice').value||0),sellPrice:Number($('sellPrice').value||0),targetPrice:Number($('targetPrice').value||0),minPrice:Number($('minPrice').value||0),passaggio:Number($('passaggio').value||0),riparazioni:Number($('riparazioni').value||0),carburante:Number($('carburante').value||0),altroCosto:Number($('altroCosto').value||0),saleChannel:$('saleChannel').value,clientId:$('clientLink').value,notes:$('carNotes').value.trim(),cover:state.pendingCover||((state.cars.find(x=>x.id===state.editingCar)||{}).cover||''),updatedAt:new Date().toLocaleString('it-IT')};
  const idx=state.cars.findIndex(c=>c.id===car.id); if(idx>=0) state.cars[idx]=car; else state.cars.unshift(car);
  persist(); renderAll(); resetCarForm();
}
function deleteCar(id){ if(confirm('Eliminare auto?')){ state.cars=state.cars.filter(c=>c.id!==id); persist(); renderAll(); } }
function editCar(id){const c=state.cars.find(x=>x.id===id); if(!c) return; state.editingCar=id; $('carName').value=c.name; $('carPlate').value=c.plate; $('carStatus').value=c.status; $('buyPrice').value=c.buyPrice; $('sellPrice').value=c.sellPrice; $('saveCar').textContent='Aggiorna'; openPanel('autoPanel');}

// --- CLIENTI & SCADENZE ---
function saveClient(){
  const item={id:state.editingClient||uid(),name:$('clientName').value.trim()||'Cliente senza nome',phone:$('clientPhone').value,email:$('clientEmail').value,status:$('clientStatus').value,updatedAt:new Date().toLocaleString('it-IT')};
  const idx=state.clients.findIndex(c=>c.id===item.id); if(idx>=0) state.clients[idx]=item; else state.clients.unshift(item);
  persist(); renderAll();
}
function saveDeadline(){
  const item={id:state.editingDeadline||uid(),title:$('deadlineTitle').value.trim(),date:$('deadlineDate').value,status:$('deadlineStatus').value,updatedAt:new Date().toLocaleString('it-IT')};
  const idx=state.deadlines.findIndex(d=>d.id===item.id); if(idx>=0) state.deadlines[idx]=item; else state.deadlines.unshift(item);
  persist(); renderAll();
}

// --- RENDERING INTEGRALE ---
function renderCars(){
  const box=$('carList'); const q=$('carSearch').value.trim().toLowerCase();
  const filtered=state.cars.filter(c=> !q || c.name.toLowerCase().includes(q) || c.plate.toLowerCase().includes(q));
  box.innerHTML=filtered.map(c=>{
    const margin=carMargin(c); const color=margin>0?'green':'red';
    return `<div class="item">
      <div style="display:flex;gap:12px">
        ${c.cover?`<img src="${c.cover}" style="width:60px;height:60px;border-radius:8px;object-fit:cover">`:''}
        <div><h4>${c.name}</h4><p>${c.plate} · <span style="color:var(--${color})">${euro(margin)}</span></p></div>
      </div>
      <div class="actions"><button class="btn secondary" onclick="editCar('${c.id}')">Modifica</button><button class="btn secondary" onclick="deleteCar('${c.id}')">X</button></div>
    </div>`;
  }).join('');
}

function renderHome(){
  const m=metrics();
  $('dashRicavi').textContent=euro(m.ricavi); $('dashReddito').textContent=euro(m.redditoForf);
  $('dashInps').textContent=euro(m.inps); $('dashImposta').textContent=euro(m.imposta);
  $('outCapitale').textContent=euro(m.capitale); $('dashSoglia').textContent=m.soglia;
  
  // Classifica Modelli (Top Models)
  const grouped={}; state.cars.forEach(c=>{const key=c.name.split(' ')[0]; grouped[key]=(grouped[key]||0)+carMargin(c);});
  const tops=Object.entries(grouped).sort((a,b)=>b[1]-a[1]).slice(0,4);
  $('topModels').innerHTML=tops.map(([k,v])=>`<div class="item"><strong>${k}</strong><div class="small">Tot. ${euro(v)}</div></div>`).join('') || 'Nessun dato';
}

function renderAll(){ renderHome(); renderCars(); /* Aggiungi qui gli altri render se necessario */ }

// --- AVVIO ---
(async function init() {
  updateThemeThumb();
  await loadAllFromCloud();
  fillSettings();
  renderAll();
  openPanel(routeToPanel());
  window.addEventListener('hashchange', () => openPanel(routeToPanel()));
  if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js'); }
})();

// Listeners
$('saveCar')?.addEventListener('click', saveCar);
$('coverUpload')?.addEventListener('change', onCoverChange);
$('carSearch')?.addEventListener('input', renderCars);
