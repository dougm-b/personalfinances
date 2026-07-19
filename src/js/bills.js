// ══════════════════════════════════════════
// DESPESAS FIXAS
// ══════════════════════════════════════════
function renderBills(){
  const exp = state.recurringBills.filter(b=>b.kind!=='income').reduce((a,b)=>a+(b.amount||0),0);
  const inc = state.recurringBills.filter(b=>b.kind==='income').reduce((a,b)=>a+(b.amount||0),0);
  document.getElementById('bills-total-exp').textContent = fmtEUR(exp);
  document.getElementById('bills-total-inc').textContent = fmtEUR(inc);
  const el = document.getElementById('bills-list');
  const list = state.recurringBills.slice().sort((a,b)=>a.day-b.day);
  el.innerHTML = list.length ? list.map(b => {
    const isInc = b.kind === 'income';
    return `
    <div class="row" onclick="openBillModal(${b.id})">
      <div class="row-emoji">${CATEGORY_EMOJI[b.category]||'📄'}</div>
      <div class="row-info"><div class="row-name">${esc(b.name)}</div><div class="row-detail">dia ${b.day} · ${esc(b.category)} · ${isInc?'credita':'debita'}${b.auto==='rooms'?' · sincronizada com a Casa':''}</div></div>
      <div class="row-val ${isInc?'pos':''}">${b.amount!=null ? (isInc?'+':'') + fmtEUR(b.amount) : 'variável'}</div>
    </div>`;
  }).join('') : '<div class="empty-state"><div class="icon">📅</div><p>Sem movimentos fixos</p></div>';
}
function openBillModal(id){
  populateCategorySelect(document.getElementById('bill-category'), false);
  const b0 = id ? state.recurringBills.find(x=>x.id===id) : null;
  fillAccountSelect(document.getElementById('bill-account'), b0 ? b0.accountId : null);
  // a receita "Renda dos Quartos" e sincronizada com a aba Casa - valor nao editavel aqui
  document.getElementById('bill-amount').disabled = !!(b0 && b0.auto === 'rooms');
  document.getElementById('bill-id').value = id||'';
  document.getElementById('bill-modal-title').textContent = id ? 'Editar Movimento Fixo' : 'Novo Movimento Fixo';
  document.getElementById('bill-delete-btn').style.display = id ? 'block' : 'none';
  if (id) {
    const b = state.recurringBills.find(x=>x.id===id);
    document.getElementById('bill-name').value = b.name;
    document.getElementById('bill-amount').value = b.amount!=null ? b.amount : '';
    document.getElementById('bill-day').value = b.day;
    document.getElementById('bill-category').value = b.category;
    document.getElementById('bill-kind').value = b.kind || 'expense';
  } else {
    document.getElementById('bill-name').value = '';
    document.getElementById('bill-amount').value = '';
    document.getElementById('bill-day').value = '';
    document.getElementById('bill-category').value = 'Utilidades';
    document.getElementById('bill-kind').value = 'expense';
  }
  document.getElementById('bill-modal').classList.add('open');
}
function saveBill(){
  const id = document.getElementById('bill-id').value;
  const name = document.getElementById('bill-name').value.trim();
  const day = parseInt(document.getElementById('bill-day').value);
  if (!name || !day) { showToast('Preenche nome e dia'); return; }
  const amountVal = document.getElementById('bill-amount').value;
  const data = { name, day, category: document.getElementById('bill-category').value,
    amount: amountVal==='' ? null : parseFloat(amountVal),
    kind: document.getElementById('bill-kind').value,
    accountId: parseInt(document.getElementById('bill-account').value)||null };
  if (id) {
    const b = state.recurringBills.find(x=>x.id==id);
    if (b.auto === 'rooms') { data.amount = b.amount; data.kind = 'income'; } // valor vem da aba Casa
    Object.assign(b, data);
  }
  else { state.recurringBills.push({ id: state.nextBillId++, ...data }); }
  closeModal('bill-modal'); save(); showToast('✅ Movimento fixo guardado');
}
function deleteBill(){
  const id = parseInt(document.getElementById('bill-id').value);
  state.recurringBills = state.recurringBills.filter(b=>b.id!==id);
  closeModal('bill-modal'); save(); showToast('🗑️ Eliminada');
}
function registerBillPayment(){
  const id = parseInt(document.getElementById('bill-id').value);
  const b = state.recurringBills.find(x=>x.id===id);
  if (!b) { showToast('Guarda a despesa fixa primeiro'); return; }
  const amt = b.amount!=null ? b.amount : parseFloat(document.getElementById('bill-amount').value) || 0;
  if (!amt) { showToast('Indica o valor deste mês'); return; }
  const accountId = parseInt(document.getElementById('bill-account').value)||null;
  const isInc = (document.getElementById('bill-kind').value || b.kind) === 'income';
  const t = { id: state.nextTxId++, desc: b.name, kind: isInc?'income':'expense',
    amount: isInc ? Math.abs(amt) : -Math.abs(amt),
    date: todayKey(), category: b.category, accountId, applied:true };
  state.transactions.push(t);
  applyTxBalance(t, 1); // credita/debita a conta escolhida
  closeModal('bill-modal'); save(); showToast(isInc ? '✅ Registado e creditado na conta' : '✅ Registado e debitado da conta');
}

// ══════════════════════════════════════════
// MOVIMENTOS PREVISTOS
// ══════════════════════════════════════════
function renderPlanned(){
  const el = document.getElementById('planned-list');
  const list = state.plannedTx.slice().sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  el.innerHTML = list.length ? list.map(p => {
    const acc = state.accounts.find(a=>a.id===p.accountId);
    return `<div class="row" onclick="openPlannedModal(${p.id})">
      <div class="row-emoji">${p.amount>=0?'📥':'📤'}</div>
      <div class="row-info"><div class="row-name">${esc(p.desc)}</div><div class="row-detail">pagamento a ${p.dueDate}${acc?' · '+esc(acc.name):''}</div></div>
      <div class="row-val ${p.amount>=0?'pos':'neg'}">${p.amount>=0?'+':'-'}${fmtEUR(Math.abs(p.amount))}</div>
    </div>`;
  }).join('') : '<div class="empty-state" style="padding:14px"><p>Sem movimentos previstos</p></div>';
}
function openPlannedModal(id){
  document.getElementById('pl-account').innerHTML = state.accounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
  document.getElementById('pl-id').value = id||'';
  document.getElementById('planned-modal-title').textContent = id ? 'Editar Movimento Previsto' : 'Novo Movimento Previsto';
  document.getElementById('pl-delete-btn').style.display = id ? 'block' : 'none';
  document.getElementById('pl-confirm-btn').style.display = id ? 'block' : 'none';
  if (id) {
    const p = state.plannedTx.find(x=>x.id===id);
    document.getElementById('pl-desc').value = p.desc;
    document.getElementById('pl-amount').value = Math.abs(p.amount);
    document.getElementById('pl-kind').value = p.amount>=0 ? 'income' : 'expense';
    document.getElementById('pl-created').value = p.createdDate;
    document.getElementById('pl-due').value = p.dueDate;
    document.getElementById('pl-account').value = p.accountId;
  } else {
    document.getElementById('pl-desc').value = '';
    document.getElementById('pl-amount').value = '';
    document.getElementById('pl-kind').value = 'income';
    document.getElementById('pl-created').value = todayKey();
    document.getElementById('pl-due').value = '';
  }
  document.getElementById('planned-modal').classList.add('open');
}
function savePlanned(){
  const id = document.getElementById('pl-id').value;
  const desc = document.getElementById('pl-desc').value.trim();
  const amountAbs = parseFloat(document.getElementById('pl-amount').value);
  const dueDate = document.getElementById('pl-due').value;
  if (!desc || !amountAbs || !dueDate) { showToast('Preenche descrição, valor e data de pagamento'); return; }
  const kind = document.getElementById('pl-kind').value;
  const accountId = parseInt(document.getElementById('pl-account').value);
  const amount = kind==='income' ? Math.abs(amountAbs) : -Math.abs(amountAbs);
  if (id) {
    // a data de inserção original mantém-se — só o resto é editável
    Object.assign(state.plannedTx.find(p=>p.id==id), { desc, amount, dueDate, accountId });
  } else {
    state.plannedTx.push({ id: state.nextPlannedId++, desc, amount, dueDate, accountId, createdDate: todayKey() });
  }
  closeModal('planned-modal'); save(); showToast('✅ Movimento previsto guardado');
}
function confirmPlanned(){
  const id = parseInt(document.getElementById('pl-id').value);
  const p = state.plannedTx.find(x=>x.id===id);
  if (!p) return;
  const t = { id: state.nextTxId++, desc: p.desc,
    kind: p.amount>=0 ? 'income' : 'expense', amount: p.amount,
    date: p.dueDate, category: p.amount>=0 ? 'Salário' : 'Outros', accountId: p.accountId, applied:true };
  state.transactions.push(t);
  applyTxBalance(t, 1); // reflete na conta associada
  state.plannedTx = state.plannedTx.filter(x=>x.id!==id);
  closeModal('planned-modal'); save(); showToast('✅ Confirmado — movido para Transações e refletido na conta');
}
function deletePlanned(){
  const id = parseInt(document.getElementById('pl-id').value);
  state.plannedTx = state.plannedTx.filter(p=>p.id!==id);
  closeModal('planned-modal'); save(); showToast('🗑️ Eliminado');
}

