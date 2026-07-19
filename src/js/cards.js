// ══════════════════════════════════════════
// CARTÃO DE CRÉDITO
// ══════════════════════════════════════════
function renderCards(){
  const el = document.getElementById('cards-list');
  el.innerHTML = state.creditCards.length ? state.creditCards.map(c => {
    const items = (c.financedItems||[]).map(f => {
      const fPct = f.total ? Math.min(100, ((f.total-f.remaining)/f.total)*100) : 0;
      return `<div class="row" onclick="openFinancedModal(${c.id},${f.id})">
        <div class="row-emoji">📱</div>
        <div class="row-info"><div class="row-name">${esc(f.desc)}</div><div class="row-detail">total ${fmtEUR(f.total)} · ${Math.round(fPct)}% pago${f.installment?` · prestação ${fmtEUR(f.installment)}/mês`:''}</div></div>
        <div class="row-val">${fmtEUR(f.remaining)} em falta</div>
      </div>`;
    }).join('');
    const installmentsSum = (c.financedItems||[]).reduce((a,f)=>a+(f.installment||0),0);
    const monthDue = (c.monthlyDue||0) + installmentsSum;
    let usagePart;
    if (c.limit) {
      const pct = Math.min(100,(c.used/c.limit)*100);
      const cls = pct > 80 ? 'red' : pct > 50 ? 'warn' : '';
      usagePart = `<div class="progress-lbl"><span>Utilizado</span><span>${fmtEUR(c.used)} / ${fmtEUR(c.limit)}</span></div>
        <div class="progress ${cls}"><div style="width:${pct}%"></div></div>
        <div class="row-detail" style="margin-top:6px">Disponível: <b style="color:var(--txt2)">${fmtEUR(c.limit - (c.used||0))}</b></div>`;
    } else {
      usagePart = `<div class="row-detail">Utilizado: <b style="color:var(--txt2)">${fmtEUR(c.used)}</b> (limite não definido)</div>`;
    }
    return `<div class="card">
      <div class="card-title">${esc(c.name)} <span onclick="openCardModal(${c.id})" style="cursor:pointer;font-size:12px;text-transform:none;letter-spacing:0">editar ✎</span></div>
      ${usagePart}
      <div class="stat-box" style="margin-top:10px"><div class="l">A pagar este mês</div><div class="v">${fmtEUR(monthDue)}</div>
        <div class="row-detail">${fmtEUR(c.monthlyDue||0)} despesas do mês${installmentsSum?` + ${fmtEUR(installmentsSum)} prestações`:''} — edita no ✎</div></div>
      <div style="margin-top:12px">${items}</div>
      <button class="btn-secondary" onclick="openFinancedModal(${c.id})">+ Compra financiada</button>
    </div>`;
  }).join('') : '<div class="empty-state"><div class="icon">💳</div><p>Sem cartões registados</p></div>';
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
  } else {
    document.getElementById('fin-desc').value = '';
    document.getElementById('fin-total').value = '';
    document.getElementById('fin-remaining').value = '';
    document.getElementById('fin-installment').value = '';
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
  const data = { desc, total: parseFloat(document.getElementById('fin-total').value)||0,
    remaining: parseFloat(document.getElementById('fin-remaining').value)||0,
    installment: instVal==='' ? null : parseFloat(instVal)||0 };
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

