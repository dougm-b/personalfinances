// ══════════════════════════════════════════
// TRANSAÇÕES
// ══════════════════════════════════════════
let txFilter = 'Todas';
function populateCategorySelect(el, includeAll){
  el.innerHTML = (includeAll ? ['Todas'] : []).concat(CATEGORIES).map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
}
function renderTxFilters(){
  const el = document.getElementById('tx-filter-chips');
  el.innerHTML = ['Todas'].concat(CATEGORIES).map(c=>`<div class="chip ${c===txFilter?'active':''}" onclick="setTxFilter('${esc(c)}')">${esc(c)}</div>`).join('');
}
function setTxFilter(c){ txFilter = c; renderTx(); renderTxFilters(); }
function renderTx(){
  const list = state.transactions
    .filter(t => txFilter==='Todas' || t.category===txFilter)
    .slice().sort((a,b)=>b.date.localeCompare(a.date));
  const el = document.getElementById('tx-list');
  el.innerHTML = list.length ? list.map(txRow).join('')
    : '<div class="empty-state"><div class="icon">📋</div><p>Sem transações nesta categoria</p></div>';
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
      amount: Math.abs(amountAbs), fromRef, toRef, category:null, accountId:null };
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
    fromRef:null, toRef:null, applied:true
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
  closeModal('tx-modal'); save(); showToast('🗑️ Transação eliminada');
}

