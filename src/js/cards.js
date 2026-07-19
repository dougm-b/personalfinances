// ══════════════════════════════════════════
// CARTÃO DE CRÉDITO
// ══════════════════════════════════════════
function renderCards(){
  const el = document.getElementById('cards-list');
  el.innerHTML = state.creditCards.length ? state.creditCards.map(c => {
    const avail = c.limit ? round2(c.limit - (c.used||0)) : null;
    return `<div class="row" onclick="openCardDetail(${c.id})">
      <div class="row-emoji">💳</div>
      <div class="row-info"><div class="row-name">${esc(c.name)}</div>
        <div class="row-detail">${c.limit ? 'disponível ' + fmtEUR(avail) : 'limite não definido'}</div></div>
      <div class="row-val">${fmtEUR(c.used)}${c.limit ? ' / ' + fmtEUR(c.limit) : ''}</div>
    </div>`;
  }).join('') : '<div class="empty-state"><div class="icon">💳</div><p>Sem cartões registados</p></div>';
}
function openCardDetail(id){
  const c = state.creditCards.find(x=>x.id===id);
  document.getElementById('cd-title').textContent = c.name;
  const installmentsSum = (c.financedItems||[]).reduce((a,f)=>a+(f.installment||0),0);
  const monthDue = (c.monthlyDue||0) + installmentsSum;
  let usage;
  if (c.limit) {
    const pct = Math.min(100,(c.used/c.limit)*100);
    const cls = pct > 80 ? 'red' : pct > 50 ? 'warn' : '';
    usage = `<div class="progress-lbl"><span>Utilizado</span><span>${fmtEUR(c.used)} / ${fmtEUR(c.limit)}</span></div>
      <div class="progress ${cls}"><div style="width:${pct}%"></div></div>
      <div class="row-detail" style="margin-top:6px">Disponível: <b style="color:var(--txt2)">${fmtEUR(c.limit-(c.used||0))}</b></div>`;
  } else {
    usage = `<div class="row-detail">Utilizado: <b style="color:var(--txt2)">${fmtEUR(c.used)}</b> (limite não definido)</div>`;
  }
  const items = (c.financedItems||[]).map(f => {
    const end = (f.startMonth && f.months) ? addMonthsKey(f.startMonth, f.months-1) : null;
    return `<div class="row" onclick="closeModal('card-detail-modal');openFinancedModal(${c.id},${f.id})">
      <div class="row-emoji">📱</div>
      <div class="row-info"><div class="row-name">${esc(f.desc)}</div>
        <div class="row-detail">${f.installment ? fmtEUR(f.installment)+'/mês' : 'sem prestação'}${end ? ' até ' + fmtMonth(end) : ''}</div></div>
      <div class="row-val">${fmtEUR(f.remaining)} em falta</div>
    </div>`;
  }).join('');
  const hist = (c.history||[]).slice(-5).reverse().map(h =>
    `<div class="row-detail">${h.date} · ${esc(h.desc)} · ${h.amount>0?'+':''}${fmtEUR(h.amount)}</div>`).join('');
  document.getElementById('cd-body').innerHTML = usage +
    `<div class="stat-box" style="margin:10px 0"><div class="l">A pagar este mês</div><div class="v">${fmtEUR(monthDue)}</div>
      <div class="row-detail">${fmtEUR(c.monthlyDue||0)} despesas do mês${installmentsSum?` + ${fmtEUR(installmentsSum)} prestações`:''}</div></div>` +
    (items ? `<div class="form-label">Compras a prestações (aparecem na aba Fixas até ao último mês):</div>${items}` : '') +
    (hist ? `<div class="form-label" style="margin-top:8px">Últimos movimentos avulsos:</div>${hist}` : '');
  document.getElementById('cd-add-fin').onclick = () => { closeModal('card-detail-modal'); openFinancedModal(id); };
  document.getElementById('cd-add-buy').onclick = () => openCardAdj(id, 1);
  document.getElementById('cd-add-pay').onclick = () => openCardAdj(id, -1);
  document.getElementById('cd-edit').onclick = () => { closeModal('card-detail-modal'); openCardModal(id); };
  document.getElementById('card-detail-modal').classList.add('open');
}
function openCardAdj(cardId, sign){
  closeModal('card-detail-modal');
  document.getElementById('ca-card-id').value = cardId;
  document.getElementById('ca-sign').value = sign;
  document.getElementById('ca-title').textContent = sign > 0 ? 'Compra Avulsa' : 'Pagamento Avulso';
  document.getElementById('ca-desc').value = '';
  document.getElementById('ca-amount').value = '';
  document.getElementById('card-adj-modal').classList.add('open');
}
function saveCardAdj(){
  const c = state.creditCards.find(x=>x.id===parseInt(document.getElementById('ca-card-id').value));
  const sign = parseInt(document.getElementById('ca-sign').value);
  const amt = parseFloat(document.getElementById('ca-amount').value);
  if (!amt || amt <= 0) { showToast('Indica o valor'); return; }
  const desc = document.getElementById('ca-desc').value.trim() || (sign > 0 ? 'Compra avulsa' : 'Pagamento avulso');
  c.used = Math.max(0, round2((c.used||0) + sign*amt));
  c.history = c.history || [];
  c.history.push({ date: todayKey(), desc, amount: sign*amt });
  closeModal('card-adj-modal'); save();
  showToast('✅ ' + (sign>0?'Compra registada':'Pagamento registado') + ' — utilizado: ' + fmtEUR(c.used));
  openCardDetail(c.id);
}
function openCardModal(id){
  document.getElementById('card-id').value = id||'';
  document.getElementById('card-modal-title').textContent = id ? 'Editar Cartão' : 'Novo Cartão';
  document.getElementById('card-delete-btn').style.display = id ? 'block' : 'none';
  if (id) {
    const c = state.creditCards.find(x=>x.id===id);
    document.getElementById('card-name').value = c.name;
    document.getElementById('card-limit').value = c.limit || '';
    document.getElementById('card-used').value = c.used;
    document.getElementById('card-monthly').value = c.monthlyDue || '';
  } else {
    document.getElementById('card-name').value = '';
    document.getElementById('card-limit').value = '';
    document.getElementById('card-used').value = '';
    document.getElementById('card-monthly').value = '';
  }
  document.getElementById('card-modal').classList.add('open');
}
function saveCard(){
  const id = document.getElementById('card-id').value;
  const name = document.getElementById('card-name').value.trim();
  if (!name) { showToast('Indica um nome'); return; }
  const data = { name, limit: parseFloat(document.getElementById('card-limit').value)||0,
    used: parseFloat(document.getElementById('card-used').value)||0,
    monthlyDue: parseFloat(document.getElementById('card-monthly').value)||0 };
  if (id) { Object.assign(state.creditCards.find(c=>c.id==id), data); }
  else { state.creditCards.push({ id: state.nextCardId++, financedItems:[], ...data }); }
  closeModal('card-modal'); save(); showToast('✅ Cartão guardado');
}
function deleteCard(){
  const id = parseInt(document.getElementById('card-id').value);
  state.creditCards = state.creditCards.filter(c=>c.id!==id);
  closeModal('card-modal'); save(); showToast('🗑️ Cartão eliminado');
}
function openFinancedModal(cardId, finId){
  document.getElementById('fin-card-id').value = cardId;
  document.getElementById('fin-id').value = finId||'';
  document.getElementById('financed-modal-title').textContent = finId ? 'Editar Compra Financiada' : 'Nova Compra Financiada';
  document.getElementById('fin-delete-btn').style.display = finId ? 'block' : 'none';
  if (finId) {
    const c = state.creditCards.find(x=>x.id===cardId);
    const f = (c.financedItems||[]).find(x=>x.id===finId);
    document.getElementById('fin-desc').value = f.desc;
    document.getElementById('fin-total').value = f.total;
    document.getElementById('fin-remaining').value = f.remaining;
    document.getElementById('fin-installment').value = f.installment != null ? f.installment : '';
    document.getElementById('fin-start').value = f.startMonth || todayKey().slice(0,7);
    document.getElementById('fin-months').value = f.months != null ? f.months : '';
  } else {
    document.getElementById('fin-desc').value = '';
    document.getElementById('fin-total').value = '';
    document.getElementById('fin-remaining').value = '';
    document.getElementById('fin-installment').value = '';
    document.getElementById('fin-start').value = todayKey().slice(0,7);
    document.getElementById('fin-months').value = '';
  }
  document.getElementById('financed-modal').classList.add('open');
}
function saveFinancedItem(){
  const cardId = parseInt(document.getElementById('fin-card-id').value);
  const finId = document.getElementById('fin-id').value;
  const desc = document.getElementById('fin-desc').value.trim();
  if (!desc) { showToast('Indica uma descrição'); return; }
  const c = state.creditCards.find(x=>x.id===cardId);
  c.financedItems = c.financedItems || [];
  const instVal = document.getElementById('fin-installment').value;
  const monthsVal = document.getElementById('fin-months').value;
  const data = { desc, total: parseFloat(document.getElementById('fin-total').value)||0,
    remaining: parseFloat(document.getElementById('fin-remaining').value)||0,
    installment: instVal==='' ? null : parseFloat(instVal)||0,
    startMonth: document.getElementById('fin-start').value || todayKey().slice(0,7),
    months: monthsVal==='' ? null : parseInt(monthsVal) };
  if (finId) { Object.assign(c.financedItems.find(f=>f.id==finId), data); }
  else { c.financedItems.push({ id: state.nextFinancedId++, ...data }); }
  closeModal('financed-modal'); save(); showToast('✅ Guardado');
}
function deleteFinancedItem(){
  const cardId = parseInt(document.getElementById('fin-card-id').value);
  const finId = parseInt(document.getElementById('fin-id').value);
  const c = state.creditCards.find(x=>x.id===cardId);
  c.financedItems = (c.financedItems||[]).filter(f=>f.id!==finId);
  closeModal('financed-modal'); save(); showToast('🗑️ Eliminado');
}

