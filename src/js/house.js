// ══════════════════════════════════════════
// CASA / EMPRÉSTIMO — helpers (usados também pelo dashboard e pelo arranque)
// ══════════════════════════════════════════
// Saldo em dívida do empréstimo = valor-base (corrigível manualmente) menos os
// débitos mensais configurados nos meses decorridos desde essa correção.
function computeLoanRemaining(){
  const loan = state.house.loan;
  let rem = loan.baseRemaining != null ? loan.baseRemaining : loan.total;
  const cur = todayKey().slice(0,7);
  let m = loan.baseMonth || cur;
  while (m < cur) {
    m = nextMonth(m);
    (loan.paymentPlans||[]).forEach(p => { if (p.from <= m && m <= p.to) rem -= p.amount; });
  }
  return Math.max(0, rem);
}

// total esperado da renda dos quartos num dado mês (rendas base + ajustes)
function roomsMonthlyTotal(mk){
  return round2((state.house.rooms||[]).reduce((s,r) =>
    s + (r.rent||0) + (r.adjustments||[]).filter(a => a.month === mk).reduce((x,a) => x + a.amount, 0), 0));
}

// mantém nas Fixas uma receita "Renda dos Quartos" sincronizada com a aba Casa
function ensureRoomsBill(){
  const total = roomsMonthlyTotal(todayKey().slice(0,7));
  let b = state.recurringBills.find(x => x.auto === 'rooms');
  if (!b) {
    state.nextBillId = state.nextBillId || 1;
    state.recurringBills.push({ id: state.nextBillId++, name:'Renda dos Quartos', category:'Renda Recebida',
      kind:'income', day:5, auto:'rooms', accountId:null, amount: total });
  } else {
    b.amount = total;
    b.kind = 'income';
  }
}

// cria as transações dos débitos mensais do empréstimo nos meses decorridos,
// debitando a conta configurada em cada débito
function runLoanPlanCharges(){
  const loan = state.house.loan;
  const cur = todayKey().slice(0,7);
  let changed = false;
  (loan.paymentPlans||[]).forEach(p => {
    if (!p.chargedUntil) { p.chargedUntil = cur; changed = true; return; } // nunca cobrar retroativamente ao ser criado/migrado
    if (!p.accountId) { if (p.chargedUntil !== cur) { p.chargedUntil = cur; changed = true; } return; }
    let m = p.chargedUntil;
    while (m < cur) {
      m = nextMonth(m);
      if (p.from <= m && m <= p.to && !settlementOf('plan:'+p.id, m)) {
        const t = { id: state.nextTxId++,
          desc: 'Pagamento empréstimo ' + loan.credor + ' (' + fmtMonth(m) + ')',
          kind:'expense', amount:-Math.abs(p.amount), date: m + '-01',
          category:'Casa', accountId: p.accountId, applied:true, ts: Date.now() };
        state.transactions.push(t);
        applyTxBalance(t, 1);
        state.billSettlements['plan:'+p.id+'|'+m] = { txId: t.id, when: Date.now() };
        changed = true;
      }
    }
    if (p.chargedUntil !== cur) { p.chargedUntil = cur; changed = true; }
  });
  return changed;
}

// projeção do fim do empréstimo mantendo os débitos configurados
// (quando os períodos acabam, assume que o último valor se mantém)
function projectLoanPayoff(){
  let rem = computeLoanRemaining();
  if (rem <= 0) return { months: 0 };
  const plans = (state.house.loan.paymentPlans||[]).slice().sort((a,b) => a.from.localeCompare(b.from));
  if (!plans.length) return null;
  const lastAmt = plans[plans.length-1].amount;
  let m = todayKey().slice(0,7), months = 0;
  while (rem > 0 && months < 600) {
    m = nextMonth(m); months++;
    const p = plans.find(x => x.from <= m && m <= x.to);
    const amt = p ? p.amount : lastAmt;
    if (!amt || amt <= 0) return null;
    rem -= amt;
  }
  return { months, end: m, monthly: lastAmt };
}

// ══════════════════════════════════════════
// CASA / EMPRÉSTIMO
// ══════════════════════════════════════════
function openHouseRemainingModal(){
  document.getElementById('house-remaining').value = computeLoanRemaining();
  document.getElementById('house-modal').classList.add('open');
}
function saveHouseRemaining(){
  // correção manual: fixa o valor-base neste mês; débitos futuros descontam a partir daqui
  state.house.loan.baseRemaining = parseFloat(document.getElementById('house-remaining').value)||0;
  state.house.loan.baseMonth = todayKey().slice(0,7);
  closeModal('house-modal'); save(); showToast('✅ Saldo em dívida corrigido');
}
function openLoanPayModal(){
  fillAccountSelect(document.getElementById('loan-pay-account'), null);
  document.getElementById('loan-pay-amount').value = '';
  document.getElementById('loan-pay-date').value = todayKey();
  document.getElementById('loan-pay-modal').classList.add('open');
}
function saveLoanPayment(){
  const amt = parseFloat(document.getElementById('loan-pay-amount').value);
  if (!amt || amt <= 0) { showToast('Indica um valor válido'); return; }
  const date = document.getElementById('loan-pay-date').value || todayKey();
  state.house.loan.baseRemaining = Math.max(0, computeLoanRemaining() - amt);
  state.house.loan.baseMonth = todayKey().slice(0,7);
  const t = { id: state.nextTxId++, desc: 'Pagamento empréstimo ' + state.house.loan.credor,
    kind:'expense', amount:-Math.abs(amt), date, category:'Casa',
    accountId: parseInt(document.getElementById('loan-pay-account').value)||null, applied:true };
  state.transactions.push(t);
  applyTxBalance(t, 1); // debita a conta escolhida
  closeModal('loan-pay-modal'); save();
  showToast('✅ Pagamento registado — saldo em dívida: ' + fmtEUR(computeLoanRemaining()));
}
function openPlanModal(id){
  const loan = state.house.loan;
  const p0 = id ? loan.paymentPlans.find(x=>x.id===id) : null;
  fillAccountSelect(document.getElementById('plan-account'), p0 ? p0.accountId : null);
  document.getElementById('plan-id').value = id||'';
  document.getElementById('plan-modal-title').textContent = id ? 'Editar Débito Mensal' : 'Novo Débito Mensal';
  document.getElementById('plan-delete-btn').style.display = id ? 'block' : 'none';
  if (id) {
    document.getElementById('plan-amount').value = p0.amount;
    document.getElementById('plan-from').value = p0.from;
    document.getElementById('plan-to').value = p0.to;
  } else {
    document.getElementById('plan-amount').value = '';
    document.getElementById('plan-from').value = todayKey().slice(0,7);
    document.getElementById('plan-to').value = '';
  }
  document.getElementById('plan-modal').classList.add('open');
}
function savePlan(){
  const loan = state.house.loan;
  const id = document.getElementById('plan-id').value;
  const amount = parseFloat(document.getElementById('plan-amount').value);
  const from = document.getElementById('plan-from').value;
  const to = document.getElementById('plan-to').value;
  const accountId = parseInt(document.getElementById('plan-account').value)||null;
  if (!amount || !from || !to) { showToast('Preenche valor e período'); return; }
  if (to < from) { showToast('O mês final tem de ser depois do inicial'); return; }
  loan.paymentPlans = loan.paymentPlans || [];
  if (id) { Object.assign(loan.paymentPlans.find(p=>p.id==id), { amount, from, to, accountId }); }
  else {
    loan.nextPlanId = loan.nextPlanId || 1;
    loan.paymentPlans.push({ id: loan.nextPlanId++, amount, from, to, accountId, chargedUntil: todayKey().slice(0,7) });
  }
  closeModal('plan-modal'); save(); showToast('✅ Débito mensal guardado');
}
function deletePlan(){
  const id = parseInt(document.getElementById('plan-id').value);
  state.house.loan.paymentPlans = state.house.loan.paymentPlans.filter(p=>p.id!==id);
  closeModal('plan-modal'); save(); showToast('🗑️ Débito eliminado');
}
function renderHouse(){
  const h = state.house;
  const loan = h.loan;
  document.getElementById('house-loan-detail').innerHTML = `
    <div class="stat-grid">
      <div class="stat-box"><div class="l">Valor Emprestado</div><div class="v">${fmtEUR(loan.total)}</div></div>
      <div class="stat-box"><div class="l">Saldo em Dívida Atual</div><div class="v">${fmtEUR(computeLoanRemaining())}</div></div>
    </div>
    <button class="btn-primary" onclick="openLoanPayModal()">Registar pagamento</button>
    <button class="btn-secondary" onclick="openHouseRemainingModal()">Corrigir saldo em dívida manualmente</button>`;

  const curM = todayKey().slice(0,7);
  const plans = (loan.paymentPlans||[]).slice().sort((a,b)=>a.from.localeCompare(b.from));
  document.getElementById('house-plans').innerHTML = plans.length ? plans.map(p => {
    const status = curM < p.from ? ['badge-blue','futuro'] : curM > p.to ? ['badge-caution','terminado'] : ['badge-ok','ativo'];
    const acc = state.accounts.find(a => a.id === p.accountId);
    return `<div class="row" onclick="openPlanModal(${p.id})">
      <div class="row-emoji">📆</div>
      <div class="row-info"><div class="row-name">${fmtEUR(p.amount)}/mês</div>
        <div class="row-detail">${fmtMonth(p.from)} → ${fmtMonth(p.to)} · ${acc ? 'debita ' + esc(acc.name) : '⚠ define a conta a debitar'}</div></div>
      <span class="stat-badge ${status[0]}">${status[1]}</span>
    </div>`;
  }).join('') : '<div class="empty-state" style="padding:14px"><p>Sem débito mensal configurado</p></div>';

  const totalReceived = loan.transfers.reduce((s,t) => s + t.amount, 0);
  document.getElementById('house-transfers').innerHTML = `
    <div class="row" onclick="openLoanHistory()">
      <div class="row-emoji">💶</div>
      <div class="row-info"><div class="row-name">Total recebido</div><div class="row-detail">toca para ver o detalhe do recebido, do pago e a estimativa de fim</div></div>
      <div class="row-val">${fmtEUR(totalReceived)}</div>
    </div>`;

  renderRooms();
}

function openLoanHistory(){
  const loan = state.house.loan;
  const totalReceived = loan.transfers.reduce((s,t) => s + t.amount, 0);
  const rem = computeLoanRemaining();
  const totalPaid = Math.max(0, loan.total - rem);
  const payTxs = state.transactions
    .filter(t => t.kind === 'expense' && (t.desc||'').startsWith('Pagamento empréstimo'))
    .sort((a,b) => b.date.localeCompare(a.date));
  const curM = todayKey().slice(0,7);
  let estimate;
  if (rem <= 0) estimate = 'Empréstimo pago na totalidade 🎉';
  else {
    // primeiro: manter o débito mensal configurado; senão, o último pagamento registado
    const proj = projectLoanPayoff();
    if (proj && proj.months > 0) {
      estimate = `Mantendo o débito mensal configurado (${fmtEUR(proj.monthly)}/mês), terminas de pagar em ≈ ${fmtMonth(proj.end)} (${proj.months} ${proj.months===1?'mês':'meses'}).`;
    } else if (payTxs.length) {
      const lastPay = Math.abs(payTxs[0].amount);
      const months = Math.ceil(rem / lastPay);
      estimate = `Mantendo ${fmtEUR(lastPay)}/mês (último valor pago), terminas de pagar em ≈ ${fmtMonth(addMonthsKey(curM, months))} (${months} ${months===1?'mês':'meses'}).`;
    } else {
      estimate = 'Regista um pagamento ou configura um débito mensal para calcular a estimativa de fim.';
    }
  }
  const sinceCorrection = round2((loan.baseRemaining != null ? loan.baseRemaining : loan.total) - rem);
  const activePlan = (loan.paymentPlans||[]).find(p => p.from <= curM && curM <= p.to);
  const monthlyNow = activePlan ? activePlan.amount : (payTxs.length ? Math.abs(payTxs[0].amount) : 0);
  document.getElementById('loan-history-body').innerHTML = `
    <div class="stat-grid" style="margin-bottom:12px">
      <div class="stat-box"><div class="l">Recebido</div><div class="v">${fmtEUR(totalReceived)}</div></div>
      <div class="stat-box"><div class="l">Pago até agora</div><div class="v" style="color:var(--good)">${fmtEUR(totalPaid)}</div></div>
      <div class="stat-box"><div class="l">Em dívida</div><div class="v" style="color:var(--warn)">${fmtEUR(rem)}</div></div>
      <div class="stat-box"><div class="l">Débito mensal atual</div><div class="v">${monthlyNow ? fmtEUR(monthlyNow) : '—'}</div></div>
    </div>
    <div class="note-box" style="margin-bottom:12px">${estimate}</div>
    <div class="form-label" style="margin-top:12px">Transferências recebidas (toca em 🗑 para apagar):</div>
    <div class="timeline">${loan.transfers.map((t,i) => `
      <div class="tl-item"><div class="tl-dot"${t.amount<0?' style="background:var(--warn)"':''}></div>
        <div class="tl-info"><div class="t">${esc(t.label || ('Transferência de ' + loan.credor))}</div><div class="s">${t.date}</div></div>
        <div class="tl-val"${t.amount<0?' style="color:var(--warn)"':''}>${fmtEUR(t.amount)}</div>
        <button class="mg-icon-btn" style="background:var(--g3);border:none;color:var(--txt2);border-radius:50%;width:24px;height:24px;cursor:pointer;flex-shrink:0" onclick="deleteLoanTransfer(${i})">🗑</button>
      </div>`).join('')}</div>
    <div class="form-label" style="margin-top:12px">Montantes pagos:</div>
    ${sinceCorrection > 0 ? `<div class="tl-item"><div class="tl-dot" style="background:var(--good)"></div>
      <div class="tl-info"><div class="t">Débitos mensais desde a última correção do saldo</div><div class="s">desde ${fmtMonth(loan.baseMonth||curM)}</div></div>
      <div class="tl-val">${fmtEUR(sinceCorrection)}</div></div>` : ''}
    ${totalPaid - sinceCorrection > 0.005 ? `<div class="tl-item"><div class="tl-dot" style="background:var(--good)"></div>
      <div class="tl-info"><div class="t">Pago antes da última correção do saldo</div><div class="s">já refletido no acerto de ${fmtMonth(loan.baseMonth||curM)}</div></div>
      <div class="tl-val">${fmtEUR(round2(totalPaid - sinceCorrection))}</div></div>` : ''}
    ${payTxs.length ? `<div class="form-label" style="margin-top:12px">Transações de pagamento (detalhe):</div>
    <div class="timeline">${payTxs.map(t => `
      <div class="tl-item"><div class="tl-dot" style="background:var(--good)"></div>
        <div class="tl-info"><div class="t">${esc(t.desc)}</div><div class="s">${t.date}</div></div>
        <div class="tl-val">${fmtEUR(Math.abs(t.amount))}</div>
      </div>`).join('')}</div>` : (totalPaid <= 0 ? '<div class="row-detail">Ainda sem pagamentos.</div>' : '')}`;
  document.getElementById('loan-history-modal').classList.add('open');
}

// ── RENDA DE QUARTOS ──
function renderRooms(){
  const rooms = state.house.rooms || [];
  const curM = todayKey().slice(0,7);
  const el = document.getElementById('house-rooms');
  if (!rooms.length) { el.innerHTML = '<div class="empty-state" style="padding:14px"><p>Sem quartos configurados</p></div>'; return; }
  let totalMonth = 0;
  const rows = rooms.map(r => {
    const adj = (r.adjustments||[]).filter(a => a.month === curM).reduce((s,a) => s + a.amount, 0);
    const eff = (r.rent||0) + adj;
    totalMonth += eff;
    return `<div class="row" onclick="openRoomModal(${r.id})">
      <div class="row-emoji">🛏️</div>
      <div class="row-info"><div class="row-name">${esc(r.name)}</div>
        <div class="row-detail">${fmtEUR(r.rent)}/mês${adj ? ` · ajuste este mês ${adj>0?'+':''}${fmtEUR(adj)}` : ''}</div></div>
      <div class="row-val">${fmtEUR(eff)}</div>
    </div>`;
  }).join('');
  el.innerHTML = `<div class="stat-box" style="margin-bottom:10px"><div class="l">Renda esperada este mês (${fmtMonth(curM)})</div><div class="v">${fmtEUR(totalMonth)}</div></div>` + rows;
}
function openRoomModal(id){
  document.getElementById('room-id').value = id||'';
  document.getElementById('room-modal-title').textContent = id ? 'Editar Quarto' : 'Novo Quarto';
  document.getElementById('room-delete-btn').style.display = id ? 'block' : 'none';
  document.getElementById('room-add-adj').style.display = id ? 'block' : 'none';
  const adjEl = document.getElementById('room-adjustments');
  if (id) {
    const r = state.house.rooms.find(x=>x.id===id);
    document.getElementById('room-name').value = r.name;
    document.getElementById('room-rent').value = r.rent;
    const adjs = (r.adjustments||[]).slice().sort((a,b)=>b.month.localeCompare(a.month));
    adjEl.innerHTML = adjs.length ? '<div class="form-label">Ajustes pontuais:</div>' + adjs.map(a => `
      <div class="row" onclick="openRoomAdjModal(${a.id})">
        <div class="row-emoji">${a.amount>=0?'➕':'➖'}</div>
        <div class="row-info"><div class="row-name">${fmtMonth(a.month)}</div><div class="row-detail">${esc(a.note||'')}</div></div>
        <div class="row-val ${a.amount>=0?'pos':'neg'}">${a.amount>=0?'+':''}${fmtEUR(a.amount)}</div>
      </div>`).join('') : '';
  } else {
    document.getElementById('room-name').value = '';
    document.getElementById('room-rent').value = '';
    adjEl.innerHTML = '';
  }
  document.getElementById('room-modal').classList.add('open');
}
function saveRoom(){
  const id = document.getElementById('room-id').value;
  const name = document.getElementById('room-name').value.trim();
  const rent = parseFloat(document.getElementById('room-rent').value)||0;
  if (!name) { showToast('Indica um nome'); return; }
  const h = state.house;
  if (id) { Object.assign(h.rooms.find(r=>r.id==id), { name, rent }); }
  else { h.nextRoomId = h.nextRoomId || 1; h.rooms.push({ id: h.nextRoomId++, name, rent, adjustments:[] }); }
  ensureRoomsBill(); closeModal('room-modal'); save(); showToast('✅ Quarto guardado');
}
function deleteRoom(){
  const id = parseInt(document.getElementById('room-id').value);
  state.house.rooms = state.house.rooms.filter(r=>r.id!==id);
  ensureRoomsBill(); closeModal('room-modal'); save(); showToast('🗑️ Quarto eliminado');
}
function openRoomAdjModal(adjId){
  const roomId = parseInt(document.getElementById('room-id').value);
  if (!roomId) { showToast('Guarda o quarto primeiro'); return; }
  closeModal('room-modal');
  document.getElementById('adj-room-id').value = roomId;
  document.getElementById('adj-id').value = adjId||'';
  document.getElementById('adj-modal-title').textContent = adjId ? 'Editar Ajuste Pontual' : 'Ajuste Pontual';
  document.getElementById('adj-delete-btn').style.display = adjId ? 'block' : 'none';
  if (adjId) {
    const r = state.house.rooms.find(x=>x.id===roomId);
    const a = r.adjustments.find(x=>x.id===adjId);
    document.getElementById('adj-month').value = a.month;
    document.getElementById('adj-amount').value = a.amount;
    document.getElementById('adj-note').value = a.note||'';
  } else {
    document.getElementById('adj-month').value = todayKey().slice(0,7);
    document.getElementById('adj-amount').value = '';
    document.getElementById('adj-note').value = '';
  }
  document.getElementById('room-adj-modal').classList.add('open');
}
function saveRoomAdj(){
  const roomId = parseInt(document.getElementById('adj-room-id').value);
  const adjId = document.getElementById('adj-id').value;
  const month = document.getElementById('adj-month').value;
  const amount = parseFloat(document.getElementById('adj-amount').value);
  if (!month || !amount) { showToast('Preenche mês e valor (pode ser negativo)'); return; }
  const note = document.getElementById('adj-note').value.trim();
  const r = state.house.rooms.find(x=>x.id===roomId);
  r.adjustments = r.adjustments || [];
  const h = state.house;
  if (adjId) { Object.assign(r.adjustments.find(a=>a.id==adjId), { month, amount, note }); }
  else { h.nextRoomAdjId = h.nextRoomAdjId || 1; r.adjustments.push({ id: h.nextRoomAdjId++, month, amount, note }); }
  ensureRoomsBill(); closeModal('room-adj-modal'); save(); showToast('✅ Ajuste guardado');
  openRoomModal(roomId);
}
function deleteRoomAdj(){
  const roomId = parseInt(document.getElementById('adj-room-id').value);
  const adjId = parseInt(document.getElementById('adj-id').value);
  const r = state.house.rooms.find(x=>x.id===roomId);
  r.adjustments = (r.adjustments||[]).filter(a=>a.id!==adjId);
  ensureRoomsBill(); closeModal('room-adj-modal'); save(); showToast('🗑️ Ajuste eliminado');
  openRoomModal(roomId);
}


// apagar uma transferência recebida (o total emprestado passa a ser a soma das restantes)
function deleteLoanTransfer(i){
  const loan = state.house.loan;
  const t = loan.transfers[i];
  if (!t) return;
  loan.transfers.splice(i, 1);
  loan.total = round2(loan.transfers.reduce((s,x) => s + x.amount, 0));
  save(); showToast('🗑️ Transferência apagada — total emprestado: ' + fmtEUR(loan.total));
  openLoanHistory();
}
