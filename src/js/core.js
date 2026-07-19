// ══════════════════════════════════════════
// GITHUB API CONFIG
// ══════════════════════════════════════════
const GH_OWNER = 'dougm-b';
const GH_REPO  = 'personalfinances';
const GH_FILE  = 'data/finance.json';
const GH_API   = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_FILE}`;

let ghToken = localStorage.getItem('dbfin_ghtoken') || '';
let dbSha = null;

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtEUR(n){ n = Number(n)||0; return n.toLocaleString('pt-PT', {style:'currency', currency:'EUR'}); }
function todayKey(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function monthKey(dateStr){ return (dateStr||'').slice(0,7); }

const CATEGORIES = ['Salário','Renda Recebida','Alimentação','Casa','Utilidades','Seguros','Saúde',
  'Subscrições','Transporte','Lazer','Poupança','Investimento','Cartão de Crédito','Outros'];
const CATEGORY_EMOJI = {
  'Salário':'💼','Renda Recebida':'🏠','Alimentação':'🛒','Casa':'🏡','Utilidades':'💡','Seguros':'🛡️',
  'Saúde':'💪','Subscrições':'📺','Transporte':'🚗','Lazer':'🎬','Poupança':'🐷','Investimento':'📈',
  'Cartão de Crédito':'💳','Outros':'✨'
};
const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
function fmtMonth(m){ const [y,mo] = m.split('-'); return MONTHS_PT[parseInt(mo)-1] + ' ' + y; }
function nextMonth(m){
  let [y,mo] = m.split('-').map(Number);
  mo++; if (mo > 12) { mo = 1; y++; }
  return y + '-' + String(mo).padStart(2,'0');
}

// contas + investimentos como origem/destino de transferências
function entityOptions(){
  return state.accounts.map(a => ({ref:'acc:'+a.id, name:a.name}))
    .concat(state.investments.map(i => ({ref:'inv:'+i.id, name:i.name})));
}
function getEntity(ref){
  if (!ref) return null;
  const idx = ref.indexOf(':');
  const t = ref.slice(0,idx), id = ref.slice(idx+1);
  if (t === 'acc') return state.accounts.find(a => String(a.id) === id);
  return state.investments.find(i => String(i.id) === id);
}
function round2(n){ return Math.round(n*100)/100; }
function applyTransfer(t, sign){
  const from = getEntity(t.fromRef), to = getEntity(t.toRef);
  if (from) from.balance = round2((from.balance||0) - sign*Math.abs(t.amount));
  if (to)   to.balance   = round2((to.balance||0)   + sign*Math.abs(t.amount));
}
// aplica (sign=1) ou reverte (sign=-1) o efeito de uma receita/despesa no
// saldo da conta associada — só usado em transações com applied:true
function applyTxBalance(t, sign){
  const a = state.accounts.find(x => x.id === t.accountId);
  if (a) a.balance = round2((a.balance||0) + sign*(t.amount||0));
}
function addMonthsKey(m, n){
  let x = m;
  for (let i = 0; i < n; i++) x = nextMonth(x);
  return x;
}

function fillAccountSelect(el, selectedId){
  el.innerHTML = state.accounts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
  const def = state.accounts.find(a => a.type === 'À ordem');
  el.value = selectedId != null ? selectedId : (def ? def.id : (state.accounts[0] && state.accounts[0].id));
}

// ══════════════════════════════════════════
// DEFAULT STATE — semeado com os dados reconciliáveis do PDF
// (o ficheiro original tinha muitas células #ERROR!/#REF!; só os valores
// que batiam certo entre si foram usados como ponto de partida)
// ══════════════════════════════════════════
function defaultState(){
  return {
    accounts: [
      {id:1, name:'Millennium bcp', type:'À ordem', balance:222.14},
      {id:2, name:'ActivoBank', type:'Poupança', balance:49.27},
      {id:3, name:'Revolut', type:'À ordem', balance:0},
      {id:5, name:'Trading 212', type:'À ordem', balance:0},
    ],
    nextAccountId:6,
    transactions: [],
    nextTxId:1,
    recurringBills: [
      {id:1, name:'Prestação / Renda da Casa', category:'Casa', amount:580, day:8},
      {id:2, name:'Água (Agere)', category:'Utilidades', amount:41.65, day:20},
      {id:3, name:'Eletricidade (Endesa)', category:'Utilidades', amount:null, day:15},
      {id:4, name:'Seguro Ocidental — Casa', category:'Seguros', amount:18.35, day:5},
      {id:5, name:'Seguro Ocidental — Saúde', category:'Seguros', amount:17.18, day:5},
      {id:6, name:'Vodafone', category:'Subscrições', amount:15, day:10},
      {id:7, name:'Ginásio', category:'Saúde', amount:25, day:1},
      {id:8, name:'Deco Proteste', category:'Subscrições', amount:8.6, day:12},
      {id:9, name:'MyHome', category:'Casa', amount:null, day:20},
    ],
    nextBillId:10,
    creditCards: [
      {id:1, name:'WiZink', limit:3500, used:1472.08, monthlyDue:0, financedItems:[
        {id:1, desc:'iPhone (crédito)', total:1026.99, remaining:445.09, installment:null}
      ]},
      {id:2, name:'Millennium bcp', limit:0, used:0, monthlyDue:0, financedItems:[]},
      {id:3, name:'ActivoBank', limit:0, used:0, monthlyDue:0, financedItems:[]}
    ],
    nextCardId:4, nextFinancedId:2,
    plannedTx: [],
    nextPlannedId:1,
    investments: [
      {id:'trading', name:'Trading (Ações/ETFs)', balance:0, contributions:[]},
      {id:'ppr', name:'PPR — Plano Poupança Reforma', balance:1250, contributions:[
        {date:'2024-01-01', amount:1250, note:'Valor inicial (do histórico)'}
      ]}
    ],
    savingsGoals: [
      {id:1, name:'Fundo de Emergência', target:5000, current:0}
    ],
    nextGoalId:2,
    house: {
      apartmentValue:172500, entrada:37500, financiado:135000, sinal:17250,
      loan:{
        credor:'Deny e Mauricio',
        total:30757.19,
        baseRemaining:30757.19,
        baseMonth:'2025-02',
        paymentPlans:[
          {id:1, amount:300, from:'2025-03', to:'2026-02'}
        ],
        nextPlanId:2,
        transfers:[
          {date:'2024-11-12', amount:9604},
          {date:'2024-11-13', amount:4815},
          {date:'2024-11-14', amount:4835},
          {date:'2024-11-18', amount:9667.19},
          {date:'2024-11-21', amount:4836},
          {date:'2024-11-21', amount:-3000, label:'Dinheiro do Douglas (descontado do empréstimo)'},
        ]
      },
      bankComparison:{
        variable:{avgMonthly:296.25, total120:35550},
        fixed:{avgMonthly:295.03, total120:35403.6}
      },
      rooms:[
        {id:1, name:'Quarto 1', rent:320, adjustments:[]},
        {id:2, name:'Quarto 2', rent:320, adjustments:[]},
        {id:3, name:'Quarto 3', rent:320, adjustments:[]},
        {id:4, name:'Quarto 4', rent:320, adjustments:[]},
      ],
      nextRoomId:5,
      nextRoomAdjId:1
    },
    settings:{ currency:'EUR', trading212Seeded:true, reservasMerged:true }
  };
}

let state = defaultState();

function migrateState(loaded){
  const base = defaultState();
  if (!loaded) return base;
  const s = Object.assign({}, base, loaded);
  s.accounts = (loaded.accounts && loaded.accounts.length) ? loaded.accounts : base.accounts;
  s.transactions = loaded.transactions || [];
  s.recurringBills = (loaded.recurringBills && loaded.recurringBills.length) ? loaded.recurringBills : base.recurringBills;
  s.creditCards = loaded.creditCards || base.creditCards;
  s.investments = (loaded.investments && loaded.investments.length) ? loaded.investments : base.investments;
  s.savingsGoals = loaded.savingsGoals || base.savingsGoals;
  s.plannedTx = loaded.plannedTx || [];
  s.nextPlannedId = loaded.nextPlannedId || base.nextPlannedId;
  s.house = Object.assign({}, base.house, loaded.house || {});
  s.house.loan = Object.assign({}, base.house.loan, (loaded.house && loaded.house.loan) || {});
  const ln = s.house.loan;
  // migrar esquema antigo (currentRemaining fixo) para o novo (base + débitos mensais)
  if (loaded.house && loaded.house.loan && loaded.house.loan.baseRemaining == null) {
    ln.baseRemaining = loaded.house.loan.currentRemaining != null ? loaded.house.loan.currentRemaining : ln.total;
    ln.baseMonth = todayKey().slice(0,7);
    ln.paymentPlans = [];
    ln.nextPlanId = 1;
  }
  delete ln.currentRemaining;
  delete ln.schedule;
  if (!s.house.rooms || !s.house.rooms.length) s.house.rooms = base.house.rooms;
  if (!s.house.nextRoomId) s.house.nextRoomId = base.house.nextRoomId;
  if (!s.house.nextRoomAdjId) s.house.nextRoomAdjId = base.house.nextRoomAdjId;
  delete s.house.roomRental;
  s.creditCards.forEach(c => { if (c.monthlyDue == null) c.monthlyDue = 0; });
  s.recurringBills.forEach(b => { if (!b.kind) b.kind = 'expense'; });
  s.settings = Object.assign({}, base.settings, { trading212Seeded:false, reservasMerged:false }, loaded.settings || {});
  // acrescentar a conta Trading 212 uma única vez a dados antigos
  if (!s.settings.trading212Seeded) {
    if (!s.accounts.some(a => /trading\s*212/i.test(a.name))) {
      s.nextAccountId = s.nextAccountId || 1;
      s.accounts.push({ id: s.nextAccountId++, name:'Trading 212', type:'À ordem', balance:0 });
    }
    s.settings.trading212Seeded = true;
  }
  // a conta "Reservas (poupança automática)" duplicava o dinheiro que já está
  // nos investimentos (Trading 212 + PPR) — remover uma única vez
  if (!s.settings.reservasMerged) {
    s.accounts = s.accounts.filter(a => !(/reservas/i.test(a.name) && /poupança autom/i.test(a.name)));
    s.settings.reservasMerged = true;
  }
  return s;
}
// sincronizações derivadas do estado — correm após cada load
function syncDerived(){
  ensureRoomsBill();
}

// ══════════════════════════════════════════
// TOKEN SETUP
// ══════════════════════════════════════════
function checkToken(){
  if (ghToken) { document.getElementById('token-setup').style.display = 'none'; initApp(); }
}
function showPermBanner(){
  const b = document.getElementById('perm-banner');
  b.innerHTML = `<button class="close" onclick="this.parentElement.style.display='none'">✕</button>
    <b>⚠️ O token não tem permissão de escrita</b> — nada se perde: os dados ficam neste browser e sobem sozinhos assim que corrigires.<br>
    Em <a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noopener">github.com/settings → Personal access tokens</a>,
    abre o teu token → <b>Repository permissions</b> → <b>Contents</b> → <b>Read and write</b> → Save.
    Não precisas de gerar token novo nem de o voltar a colar aqui.`;
  b.style.display = 'block';
}
function hidePermBanner(){
  const b = document.getElementById('perm-banner');
  if (b) b.style.display = 'none';
}
// GET /repos devolve as permissões efetivas do token; push=false → só leitura
async function tokenCanWrite(token){
  try {
    const res = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}?t=` + Date.now(), {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
    });
    if (!res.ok) return null; // não deu para verificar — não bloquear por isto
    const info = await res.json();
    if (info.permissions && info.permissions.push === false) return false;
    return true;
  } catch(e) { return null; }
}
async function saveToken(){
  const val = document.getElementById('token-input').value.trim();
  const err = document.getElementById('setup-error');
  if (!val.startsWith('github_pat_') && !val.startsWith('ghp_')) {
    err.textContent = '❌ Token inválido. Deve começar com github_pat_ ou ghp_'; return;
  }
  err.textContent = 'A verificar token...';
  const canWrite = await tokenCanWrite(val);
  if (canWrite === false) {
    err.textContent = '❌ O token só tem permissão de LEITURA. Edita-o no GitHub: Repository permissions → Contents → "Read and write".';
    return;
  }
  try {
    const res = await fetch(GH_API, { headers: { Authorization: `token ${val}`, Accept: 'application/vnd.github.v3+json' } });
    if (res.status === 404) {
      err.textContent = '⚠️ Token válido mas data/finance.json não encontrado. A criar...';
      ghToken = val; localStorage.setItem('dbfin_ghtoken', ghToken);
      state = defaultState();
      await pushToGitHub();
      document.getElementById('token-setup').style.display = 'none'; initApp();
      return;
    }
    if (!res.ok) { err.textContent = '❌ Token inválido ou sem permissões.'; return; }
    ghToken = val; localStorage.setItem('dbfin_ghtoken', ghToken);
    err.style.color = 'var(--acc)'; err.textContent = '✅ Token válido! A carregar dados...';
    setTimeout(() => { document.getElementById('token-setup').style.display = 'none'; initApp(); }, 800);
  } catch(e) { err.textContent = '❌ Erro de rede. Verifica a ligação.'; }
}
function resetToken(){
  localStorage.removeItem('dbfin_ghtoken');
  ghToken = '';
  closeModal('settings-modal');
  document.getElementById('token-setup').style.display = 'flex';
  document.getElementById('token-input').value = '';
  document.getElementById('setup-error').textContent = '';
}

// ══════════════════════════════════════════
// GITHUB SYNC
// ══════════════════════════════════════════
function setSyncStatus(status, label){
  const dot = document.getElementById('sync-dot'), lbl = document.getElementById('sync-label');
  if (!dot || !lbl) return;
  dot.className = 'sync-dot ' + status; lbl.className = 'sync-label ' + status; lbl.textContent = label;
}
let syncBusy = false;    // a carregar do GitHub
let pushBusy = false;    // a gravar no GitHub
let pushQueued = false;  // gravação pedida enquanto outra decorria
let dirty = localStorage.getItem('dbfin_dirty') === '1'; // alterações locais ainda não confirmadas no GitHub

// Cache local: cada estado carregado/alterado fica no localStorage, para que
// uma falha de rede ou de permissões do token nunca faça perder dados ao
// recarregar a página.
function cacheState(){
  try { localStorage.setItem('dbfin_cache', JSON.stringify(state)); } catch(e) {}
}
function setDirty(v){
  dirty = v;
  try { v ? localStorage.setItem('dbfin_dirty','1') : localStorage.removeItem('dbfin_dirty'); } catch(e) {}
}
function loadCachedState(){
  try {
    const raw = localStorage.getItem('dbfin_cache');
    return raw ? migrateState(JSON.parse(raw)) : null;
  } catch(e) { return null; }
}

async function loadFromGitHub(opts){
  opts = opts || {};
  // nunca sobrepor alterações locais por gravar com uma leitura em segundo plano
  if (opts.skipIfBusy && (syncBusy || pushBusy || dirty)) return false;
  syncBusy = true;
  if (!opts.silent) setSyncStatus('syncing', 'a carregar...');
  try {
    const res = await fetch(GH_API + '?t=' + Date.now(), { headers: { Authorization: `token ${ghToken}`, Accept: 'application/vnd.github.v3+json' } });
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    dbSha = data.sha;
    const content = JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))));
    if (dirty) {
      // há alterações locais por gravar: não as descartar — só atualizar o sha
      setSyncStatus('ok', 'alterações por guardar');
      return false;
    }
    state = migrateState(content);
    syncDerived();
    cacheState();
    setSyncStatus('ok', 'sincronizado');
    renderAll();
    return true;
  } catch(e) {
    if (!opts.silent) {
      const cached = loadCachedState();
      if (cached) {
        state = cached;
        syncDerived();
        setSyncStatus('error', 'offline — dados locais');
        showToast('⚠️ Sem ligação ao GitHub — a usar os dados guardados neste browser');
      } else {
        state = migrateState(null);
        setSyncStatus('error', 'erro ao carregar');
        showToast('⚠️ Erro ao carregar dados do GitHub');
      }
    } else {
      setSyncStatus('ok', 'sincronizado');
    }
    return false;
  } finally { syncBusy = false; }
}
async function silentSync(){
  if (!ghToken || document.visibilityState === 'hidden') return;
  if (dirty && !pushBusy) { pushToGitHub(); return; } // tentar de novo gravações falhadas
  const ok = await loadFromGitHub({ silent:true, skipIfBusy:true });
  if (ok) renderAll();
}
let autoSyncTimer = null;
function startAutoSync(){
  if (autoSyncTimer) return;
  autoSyncTimer = setInterval(silentSync, 45000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') silentSync(); });
}
async function fetchRemoteSha(){
  const res = await fetch(GH_API + '?t=' + Date.now(), { headers: { Authorization: `token ${ghToken}`, Accept: 'application/vnd.github.v3+json' } });
  if (!res.ok) throw new Error('não foi possível obter a versão atual do ficheiro');
  return (await res.json()).sha;
}
async function pushToGitHub(){
  if (pushBusy) { pushQueued = true; return true; }
  pushBusy = true;
  setSyncStatus('syncing', 'a guardar...');
  try {
    for (let attempt = 0; ; attempt++) {
      const content = btoa(unescape(encodeURIComponent(JSON.stringify(state, null, 2))));
      const body = { message: `finance: update ${new Date().toISOString()}`, content, ...(dbSha ? {sha: dbSha} : {}) };
      const res = await fetch(GH_API, {
        method:'PUT',
        headers:{ Authorization:`token ${ghToken}`, Accept:'application/vnd.github.v3+json', 'Content-Type':'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const data = await res.json();
        dbSha = data.content.sha;
        break;
      }
      const err = await res.json().catch(() => ({}));
      // conflito de versão (outro dispositivo gravou entretanto): atualizar só
      // o sha e voltar a gravar o estado LOCAL — nunca descartar alterações locais
      if ((res.status === 409 || res.status === 422) && attempt < 3) { dbSha = await fetchRemoteSha(); continue; }
      if (res.status === 403 || res.status === 404) {
        showPermBanner();
        throw new Error('o token não tem permissão de escrita neste repositório (Contents → Read and write)');
      }
      throw new Error(err.message || ('HTTP ' + res.status));
    }
    setDirty(false);
    hidePermBanner();
    setSyncStatus('ok', 'guardado ✓');
    setTimeout(() => setSyncStatus('ok', 'sincronizado'), 2000);
    return true;
  } catch(e) {
    setSyncStatus('error', 'erro ao guardar — dados locais seguros');
    showToast('❌ Erro ao guardar: ' + e.message, 6000);
    return false;
  } finally {
    pushBusy = false;
    if (pushQueued) { pushQueued = false; pushToGitHub(); }
  }
}
function save(){ setDirty(true); cacheState(); pushToGitHub(); renderAll(); }

// ══════════════════════════════════════════
// MODALS / TOAST / NAV
// ══════════════════════════════════════════
function closeModal(id){ document.getElementById(id).classList.remove('open'); }
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(m => { m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); }); });
});
function showToast(msg, duration = 2500){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id + '-screen').classList.add('active');
  document.getElementById('nav-' + id).classList.add('active');
  document.getElementById('content').scrollTop = 0;
  silentSync();
}
function openSettingsModal(){ document.getElementById('settings-modal').classList.add('open'); }

// ══════════════════════════════════════════
// HELPERS: totals
// ══════════════════════════════════════════
function totalAccounts(){ return state.accounts.reduce((a,c)=>a+(c.balance||0),0); }
function totalInvestments(){ return state.investments.reduce((a,c)=>a+(c.balance||0),0); }
function totalCardDebt(){ return state.creditCards.reduce((a,c)=>a+(c.used||0),0); }
function monthTx(kind){
  const mk = todayKey().slice(0,7);
  return state.transactions.filter(t => t.kind===kind && monthKey(t.date)===mk).reduce((a,t)=>a+t.amount,0);
}

