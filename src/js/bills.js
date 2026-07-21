// ══════════════════════════════════════════
// DESPESAS FIXAS
// ══════════════════════════════════════════
let billsMonth = null; // mês selecionado na aba Fixas (YYYY-MM)
let billsSort = 'day'; // 'day' | 'valueDesc' | 'valueAsc'
function toggleBillsSortMenu(e){
  e.stopPropagation();
  const m = document.getElementById('bills-sort-menu');
  m.style.display = m.style.display === 'none' ? '' : 'none';
}
function setBillsSort(mode){
  billsSort = mode;
  document.getElementById('bills-sort-menu').style.display = 'none';
  renderBills();
}
function sortBillItems(arr){
  const a = arr.slice();
  if (billsSort === 'valueDesc') a.sort((x,y) => (y.amount||0) - (x.amount||0));
  else if (billsSort === 'valueAsc') a.sort((x,y) => (x.amount||0) - (y.amount||0));
  else a.sort((x,y) => x.day - y.day);
  return a;
}
function billsShiftMonth(d){
  const cur = billsMonth || todayKey().slice(0,7);
  let [y,m] = cur.split('-').map(Number);
  m += d; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; }
  billsMonth = y + '-' + String(m).padStart(2,'0');
  renderBills();
}
// itens fixos ativos num dado mês: fixas dentro do prazo + prestações de cartão
function fixasItemsForMonth(M){
  const items = [];
  state.recurringBills.forEach(b => {
    if ((b.from || '0000-01') <= M && M <= (b.to || '9999-12'))
      items.push({ key:'bill:'+b.id, name:b.name, day:b.day||1, amount:b.amount,
        kind: b.kind==='income' ? 'income' : b.kind==='transfer' ? 'transfer' : 'expense',
        category:b.category, accountId:b.accountId, fromRef:b.fromRef, toRef:b.toRef, bill:b });
  });
  state.creditCards.forEach(c => (c.financedItems||[]).forEach(f => {
    if (c.professional || !f.installment) return;
    const start = f.startMonth || '0000-01';
    const end = f.months ? addMonthsKey(start, f.months - 1) : '9999-12';
    if (start <= M && M <= end)
      items.push({ key:'fin:'+c.id+':'+f.id, name:f.desc+' ('+c.name+')', day: c.dueDay||1, amount:f.installment,
        kind:'expense', category:'Cartão de Crédito', fin:f, card:c });
  }));
  // compras avulsas do cartão: a fatura do ciclo aparece no mês seguinte ao
  // último movimento avulso, no dia de débito, até ser liquidada
  state.creditCards.forEach(c => {
    if (c.professional) return; // cartões da empresa ficam fora das Fixas
    const s = settlementOf('cardbill:'+c.id, M);
    if (s) {
      // já liquidada neste mês: mantém-se visível (riscada) e desmarcável
      const t = state.transactions.find(x => x.id === s.txId);
      items.push({ key:'cardbill:'+c.id, name:'Fatura '+c.name+' — compras avulsas', day: c.dueDay||1,
        amount: t ? Math.abs(t.amount) : round2(c.used), kind:'expense', category:'Cartão de Crédito', accountId:null, cardBill:c });
      return;
    }
    const amt = cardBillFor(c, M);
    if (amt > 0.005)
      items.push({ key:'cardbill:'+c.id, name:'Fatura '+c.name+' — compras avulsas', day: c.dueDay||1,
        amount: amt, kind:'expense', category:'Cartão de Crédito', accountId:null, cardBill:c });
  });
  // débitos mensais do empréstimo da casa aparecem como despesa fixa no período
  ((state.house.loan||{}).paymentPlans||[]).forEach(p => {
    if (p.from <= M && M <= p.to)
      items.push({ key:'plan:'+p.id, name:'Empréstimo ' + state.house.loan.credor, day: 1, amount: p.amount,
        kind:'expense', category:'Casa', accountId: p.accountId||null, plan:p });
  });
  return items.sort((a,b) => a.day - b.day);
}
function settlementOf(key, M){ return (state.billSettlements||{})[key+'|'+M]; }
function billItemRow(it, M, isFuture){
  const settled = settlementOf(it.key, M);
  const isInc = it.kind === 'income';
  const isTr = it.kind === 'transfer';
  // só o VALOR fica riscado (em cinza); nome e detalhes mantêm as cores normais
  const style = settled ? 'text-decoration:line-through;color:var(--txt3)' : '';
  const check = `<input type="checkbox" ${settled?'checked':''} onclick="event.stopPropagation();toggleFixedItem('${it.key}','${M}')" title="${settled?'Desmarcar (volta a não pago)':'Marcar como liquidado (não mexe no saldo da conta)'}" style="width:18px;height:18px;accent-color:var(--txt3)"/>`;
  const open = it.bill ? `openBillModal(${it.bill.id})` : it.plan ? `openPlanModal(${it.plan.id})` : it.cardBill ? `openCardDetail(${it.cardBill.id})` : `openFinancedModal(${it.card.id},${it.fin.id})`;
  return `<div class="row" onclick="${open}">
    <div class="row-emoji">${isTr?'🔁':(CATEGORY_EMOJI[it.category]||'📄')}</div>
    <div class="row-info"><div class="row-name">${esc(it.name)}</div>
      <div class="row-detail">dia ${it.day} · ${isTr ? esc((getEntity(it.fromRef)||{}).name||'?') + ' → ' + esc((getEntity(it.toRef)||{}).name||'?') : esc(it.category) + ' · ' + (isInc?'credita':'debita')}${it.bill&&it.bill.auto==='rooms'?' · sincronizada com a Casa':''}${it.fin?' · prestação do cartão':''}</div></div>
    <div class="row-val ${settled?'':(isInc?'pos':'')}" style="${style}${isTr&&!settled?'color:var(--blue)':''}">${it.amount!=null ? (isInc?'+':'') + fmtEUR(it.amount) : 'variável'}${isTr?' ⇄':''}</div>
    ${check}
  </div>`;
}
function renderBills(){
  const M = billsMonth || todayKey().slice(0,7);
  billsMonth = M;
  document.getElementById('bills-month-label').textContent = fmtMonth(M);
  const items = fixasItemsForMonth(M);
  const exp = items.filter(i=>i.kind==='expense').reduce((a,i)=>a+(i.amount||0),0);
  const inc = items.filter(i=>i.kind==='income').reduce((a,i)=>a+(i.amount||0),0);
  document.getElementById('bills-total-exp').textContent = fmtEUR(exp);
  document.getElementById('bills-total-inc').textContent = fmtEUR(inc);
  const today = todayKey();
  const past = [], future = [];
  items.forEach(it => {
    const dk = M + '-' + String(it.day).padStart(2,'0');
    (dk <= today ? past : future).push(it);
  });
  ['bs-day','bs-desc','bs-asc'].forEach((id,i) => {
    const el = document.getElementById(id);
    if (el) el.style.color = (['day','valueDesc','valueAsc'][i] === billsSort) ? 'var(--acc)' : '';
  });
  document.getElementById('bills-past').innerHTML = past.length
    ? sortBillItems(past).map(it => billItemRow(it, M, false)).join('')
    : '<div class="empty-state" style="padding:10px"><p>Sem fixas passadas neste mês</p></div>';
  document.getElementById('bills-future').innerHTML = future.length
    ? sortBillItems(future).map(it => billItemRow(it, M, true)).join('')
    : '<div class="empty-state" style="padding:10px"><p>Sem fixas futuras neste mês</p></div>';
}
// marcar/desmarcar liquidação
function toggleFixedItem(key, M){
  const s = settlementOf(key, M);
  if (!s) { settleFixedItem(key, M); return; }
  // desmarcar: remove a liquidação e a transação que a criou (revertendo o
  // saldo se tinha sido debitado/creditado)
  const t = state.transactions.find(x => x.id === s.txId);
  if (t) {
    if (t.kind !== 'transfer' && t.applied) applyTxBalance(t, -1);
    if (key.startsWith('cardbill:')) {
      const c = state.creditCards.find(x => x.id === parseInt(key.split(':')[1]));
      if (c) c.used = round2((c.used||0) + Math.abs(t.amount)); // fatura volta a estar por pagar
    }
    state.transactions = state.transactions.filter(x => x.id !== t.id);
  }
  delete state.billSettlements[key + '|' + M];
  save(); showToast('↩️ Marcado como não pago');
}
// reconcilia liquidações com transações já existentes (mesmo nome, mesmo mês)
// — apanha pagamentos registados antes desta funcionalidade existir
function reconcileSettlements(){
  state.billSettlements = state.billSettlements || {};
  state.recurringBills.forEach(bl => {
    state.transactions.forEach(t => {
      if ((t.kind === 'income' || t.kind === 'expense') && t.desc === bl.name) {
        const k = 'bill:' + bl.id + '|' + monthKey(t.date);
        if (!state.billSettlements[k]) state.billSettlements[k] = { txId: t.id, when: Date.now() };
      }
    });
  });
}
// checkbox "já liquidado": vai para Transações mas NÃO mexe no saldo da conta
// (serve para indicar que o saldo da conta já reflete este pagamento)
function settleFixedItem(key, M){
  if (settlementOf(key, M)) { showToast('⚠️ Já foi liquidado este mês'); return; }
  const it = fixasItemsForMonth(M).find(x => x.key === key);
  if (!it || it.amount == null) { showToast('Define primeiro o valor deste item'); return; }
  const t = it.kind === 'transfer'
    ? { id: state.nextTxId++, desc: it.name, kind:'transfer', amount: Math.abs(it.amount),
        fromRef: it.fromRef, toRef: it.toRef, date: M + '-' + String(it.day).padStart(2,'0'),
        category:null, accountId:null, applied:false, ts: Date.now() }
    : { id: state.nextTxId++, desc: it.name, kind: it.kind,
        amount: it.kind==='income' ? Math.abs(it.amount) : -Math.abs(it.amount),
        date: M + '-' + String(it.day).padStart(2,'0'), category: it.category,
        accountId: it.accountId||null, applied:false, ts: Date.now() };
  state.transactions.push(t);
  state.billSettlements[key+'|'+M] = { txId: t.id, when: Date.now() };
  if (it.cardBill) {
    // fatura (ou parte dela) paga: abate no utilizado do cartão
    it.cardBill.history = it.cardBill.history || [];
    it.cardBill.history.push({ date: todayKey(), desc: 'Fatura de compras avulsas paga (' + fmtMonth(M) + ')', amount: -it.amount });
    it.cardBill.used = round2(Math.max(0, (it.cardBill.used||0) - it.amount));
    if (it.cardBill.rollMonth === M) { it.cardBill.rollAmount = 0; it.cardBill.rollMonth = null; }
  }
  save(); showToast('✅ Liquidado — registado em Transações (saldo da conta não alterado)');
}

function onBillKindChange(){
  const isTr = document.getElementById('bill-kind').value === 'transfer';
  document.getElementById('bill-normal-fields').style.display = isTr ? 'none' : '';
  document.getElementById('bill-transfer-fields').style.display = isTr ? '' : 'none';
}
function openBillModal(id){
  populateCategorySelect(document.getElementById('bill-category'), false);
  const b0 = id ? state.recurringBills.find(x=>x.id===id) : null;
  fillAccountSelect(document.getElementById('bill-account'), b0 ? b0.accountId : null);
  const trOpts = entityOptions().map(o=>`<option value="${esc(o.ref)}">${esc(o.name)}</option>`).join('');
  document.getElementById('bill-tr-from').innerHTML = trOpts;
  document.getElementById('bill-tr-to').innerHTML = trOpts;
  if (b0 && b0.fromRef) document.getElementById('bill-tr-from').value = b0.fromRef;
  if (b0 && b0.toRef) document.getElementById('bill-tr-to').value = b0.toRef;
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
    document.getElementById('bill-from').value = b.from || '';
    document.getElementById('bill-to').value = b.to || '';
  } else {
    document.getElementById('bill-name').value = '';
    document.getElementById('bill-amount').value = '';
    document.getElementById('bill-day').value = '';
    document.getElementById('bill-category').value = 'Utilidades';
    document.getElementById('bill-kind').value = 'expense';
    document.getElementById('bill-from').value = '';
    document.getElementById('bill-to').value = '';
  }
  onBillKindChange();
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
    accountId: parseInt(document.getElementById('bill-account').value)||null,
    fromRef: document.getElementById('bill-tr-from').value || null,
    toRef: document.getElementById('bill-tr-to').value || null,
    from: document.getElementById('bill-from').value || null,
    to: document.getElementById('bill-to').value || null };
  if (data.kind === 'transfer' && data.fromRef === data.toRef) { showToast('Origem e destino têm de ser diferentes'); return; }
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
  const M = billsMonth || todayKey().slice(0,7);
  if (settlementOf('bill:'+b.id, M)) { showToast('⚠️ Já foi realizado um pagamento deste item em ' + fmtMonth(M)); return; }
  const amt = b.amount!=null ? b.amount : parseFloat(document.getElementById('bill-amount').value) || 0;
  if (!amt) { showToast('Indica o valor deste mês'); return; }
  const accountId = parseInt(document.getElementById('bill-account').value)||null;
  const kindNow = document.getElementById('bill-kind').value || b.kind;
  if (kindNow === 'transfer') {
    const t = { id: state.nextTxId++, desc: b.name, kind:'transfer', amount: Math.abs(amt),
      fromRef: b.fromRef, toRef: b.toRef, date: todayKey(), category:null, accountId:null, applied:true, ts: Date.now() };
    state.transactions.push(t);
    applyTransfer(t, 1);
    state.billSettlements['bill:'+b.id+'|'+M] = { txId: t.id, when: Date.now() };
    closeModal('bill-modal'); save(); showToast('✅ Transferência efetuada entre as contas'); return;
  }
  const isInc = kindNow === 'income';
  const t = { id: state.nextTxId++, desc: b.name, kind: isInc?'income':'expense',
    amount: isInc ? Math.abs(amt) : -Math.abs(amt),
    date: todayKey(), category: b.category, accountId, applied:true, ts: Date.now() };
  state.transactions.push(t);
  applyTxBalance(t, 1); // credita/debita a conta escolhida
  state.billSettlements['bill:'+b.id+'|'+M] = { txId: t.id, when: Date.now() };
  closeModal('bill-modal'); save(); showToast(isInc ? '✅ Registado e creditado na conta' : '✅ Registado e debitado da conta');
}

// ══════════════════════════════════════════
// MOVIMENTOS PREVISTOS
// ══════════════════════════════════════════
function renderPlanned(){
  const el = document.getElementById('planned-list');
  if (!el) return; // secção removida da aba Fixas
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

