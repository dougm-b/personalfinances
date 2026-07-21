// ══════════════════════════════════════════
// TRANSAÇÕES
// ══════════════════════════════════════════
let txFilter = 'Todas';
let txMonth = null;  // mês visível na aba Transações (YYYY-MM)
let txSort = 'date'; // 'date' | 'valueDesc' | 'valueAsc'
function txShiftMonth(d){
  const cur = txMonth || todayKey().slice(0,7);
  let [y,m] = cur.split('-').map(Number);
  m += d; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; }
  txMonth = y + '-' + String(m).padStart(2,'0');
  renderTx();
}
function toggleTxSortMenu(e){
  e.stopPropagation();
  const m = document.getElementById('tx-sort-menu');
  m.style.display = m.style.display === 'none' ? '' : 'none';
}
function setTxSort(mode){
  txSort = mode;
  document.getElementById('tx-sort-menu').style.display = 'none';
  renderTx();
}
function populateCategorySelect(el, includeAll){
  el.innerHTML = (includeAll ? ['Todas'] : []).concat(CATEGORIES).map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
}
function renderTxFilters(){
  const el = document.getElementById('tx-filter-chips');
  el.innerHTML = ['Todas'].concat(CATEGORIES).map(c=>`<div class="chip ${c===txFilter?'active':''}" onclick="setTxFilter('${esc(c)}')">${esc(c)}</div>`).join('');
}
function setTxFilter(c){ txFilter = c; renderTx(); renderTxFilters(); }
function renderTx(){
  const M = txMonth || todayKey().slice(0,7);
  txMonth = M;
  document.getElementById('tx-month-label').textContent = fmtMonth(M);
  ['ts-date','ts-desc','ts-asc'].forEach((id,i) => {
    const el = document.getElementById(id);
    if (el) el.style.color = (['date','valueDesc','valueAsc'][i] === txSort) ? 'var(--acc)' : '';
  });
  const list = state.transactions
    .filter(t => monthKey(t.date) === M)
    .filter(t => txFilter==='Todas' || t.category===txFilter)
    .slice();
  if (txSort === 'valueDesc') list.sort((a,b) => Math.abs(b.amount) - Math.abs(a.amount));
  else if (txSort === 'valueAsc') list.sort((a,b) => Math.abs(a.amount) - Math.abs(b.amount));
  else list.sort((a,b) => b.date.localeCompare(a.date));
  const el = document.getElementById('tx-list');
  el.innerHTML = list.length ? list.map(txRow).join('')
    : '<div class="empty-state"><div class="icon">📋</div><p>Sem transações neste mês' + (txFilter!=='Todas' ? ' nesta categoria' : '') + '</p></div>';
}
function onTxKindChange(){
  const isTr = document.getElementById('tx-kind').value === 'transfer';
  document.getElementById('tx-category-group').style.display = isTr ? 'none' : '';
  document.getElementById('tx-account-group').style.display = isTr ? 'none' : '';
  document.getElementById('tx-transfer-fields').style.display = isTr ? '' : 'none';
}
function openTxModal(id){
  populateCategorySelect(document.getElementById('tx-category'), false);
  document.getElementById('tx-account').innerHTML = state.accounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
  const opts = entityOptions().map(o=>`<option value="${esc(o.ref)}">${esc(o.name)}</option>`).join('');
  document.getElementById('tx-from').innerHTML = opts;
  document.getElementById('tx-to').innerHTML = opts;
  document.getElementById('tx-id').value = id||'';
  document.getElementById('tx-modal-title').textContent = id ? 'Editar Transação' : 'Nova Transação';
  document.getElementById('tx-delete-btn').style.display = id ? 'block' : 'none';
  if (id) {
    const t = state.transactions.find(x=>x.id===id);
    document.getElementById('tx-desc').value = t.desc;
    document.getElementById('tx-amount').value = Math.abs(t.amount);
    document.getElementById('tx-kind').value = t.kind;
    document.getElementById('tx-date').value = t.date;
    if (t.kind === 'transfer') {
      document.getElementById('tx-from').value = t.fromRef;
      document.getElementById('tx-to').value = t.toRef;
    } else {
      document.getElementById('tx-category').value = t.category;
      document.getElementById('tx-account').value = t.accountId;
    }
  } else {
    document.getElementById('tx-desc').value = '';
    document.getElementById('tx-amount').value = '';
    document.getElementById('tx-kind').value = 'expense';
    document.getElementById('tx-date').value = todayKey();
    document.getElementById('tx-category').value = 'Outros';
  }
  onTxKindChange();
  document.getElementById('tx-modal').classList.add('open');
}
function saveTx(){
  const id = document.getElementById('tx-id').value;
  const amountAbs = parseFloat(document.getElementById('tx-amount').value);
  const kind = document.getElementById('tx-kind').value;
  const old = id ? state.transactions.find(t=>t.id==id) : null;

  if (kind === 'transfer') {
    const fromRef = document.getElementById('tx-from').value;
    const toRef = document.getElementById('tx-to').value;
    if (!amountAbs) { showToast('Indica o valor'); return; }
    if (fromRef === toRef) { showToast('Origem e destino têm de ser diferentes'); return; }
    const desc = document.getElementById('tx-desc').value.trim() || 'Transferência';
    const data = { desc, kind:'transfer', date: document.getElementById('tx-date').value,
      amount: Math.abs(amountAbs), fromRef, toRef, category:null, accountId:null, ts: Date.now() };
    if (old) {
      if (old.kind === 'transfer') applyTransfer(old, -1); // reverter saldos da versão anterior
      Object.assign(old, data);
      applyTransfer(old, 1);
    } else {
      state.transactions.push({ id: state.nextTxId++, ...data });
      applyTransfer(data, 1);
    }
    closeModal('tx-modal'); save(); showToast('✅ Transferência guardada'); return;
  }

  const desc = document.getElementById('tx-desc').value.trim();
  if (!desc || !amountAbs) { showToast('Preenche descrição e valor'); return; }
  const accountId = parseInt(document.getElementById('tx-account').value);
  const data = {
    desc, kind, date: document.getElementById('tx-date').value,
    category: document.getElementById('tx-category').value,
    accountId, amount: kind==='income' ? Math.abs(amountAbs) : -Math.abs(amountAbs),
    fromRef:null, toRef:null, applied:true, ts: Date.now()
  };
  if (old) {
    if (old.kind === 'transfer') applyTransfer(old, -1); // deixou de ser transferência
    else if (old.applied) applyTxBalance(old, -1);       // reverter efeito anterior no saldo
    Object.assign(old, data);
    applyTxBalance(old, 1);
  } else {
    state.transactions.push({ id: state.nextTxId++, ...data });
    applyTxBalance(data, 1);
  }
  closeModal('tx-modal'); save(); showToast('✅ Transação guardada');
}
function deleteTx(){
  const id = parseInt(document.getElementById('tx-id').value);
  const t = state.transactions.find(x=>x.id===id);
  if (t && t.kind === 'transfer') applyTransfer(t, -1);
  else if (t && t.applied) applyTxBalance(t, -1);
  state.transactions = state.transactions.filter(x=>x.id!==id);
  // se era a transação de uma fixa liquidada, desbloqueia esse mês
  Object.keys(state.billSettlements||{}).forEach(k => { if (state.billSettlements[k].txId === id) delete state.billSettlements[k]; });
  closeModal('tx-modal'); save(); showToast('🗑️ Transação eliminada');
}

