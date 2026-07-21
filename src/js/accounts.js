// ══════════════════════════════════════════
// CONTAS
// ══════════════════════════════════════════
// saldo previsto no último dia do mês: saldo atual + fixas do mês por
// liquidar que afetam esta conta (despesas/receitas e transferências)
function accountEndOfMonth(a){
  const M = todayKey().slice(0,7), today = todayKey();
  let v = a.balance || 0;
  const items = [];
  fixasItemsForMonth(M).forEach(it => {
    if (it.amount == null || settlementOf(it.key, M)) return;
    const dk = M + '-' + String(it.day).padStart(2,'0');
    if (dk < today) return;
    let delta = 0;
    if (it.kind === 'transfer') {
      if (it.fromRef === 'acc:' + a.id) delta -= it.amount;
      if (it.toRef === 'acc:' + a.id) delta += it.amount;
    } else if (it.accountId === a.id) {
      delta = it.kind === 'income' ? it.amount : -it.amount;
    }
    if (delta !== 0) { v = round2(v + delta); items.push({ name: it.name, day: it.day, delta, run: v }); }
  });
  return { v: round2(v), items };
}
let accFlipped = {};
let lastAccSwipe = 0;
function bindAccountSwipes(){
  const list = document.getElementById('accounts-list');
  let sx = null, rowEl = null;
  list.onpointerdown = e => { const r = e.target.closest('.row[data-accid]'); if (r) { sx = e.clientX; rowEl = r; } };
  list.onpointerup = e => {
    if (rowEl && sx != null && Math.abs(e.clientX - sx) > 40) {
      const id = parseInt(rowEl.dataset.accid);
      accFlipped[id] = !accFlipped[id];
      lastAccSwipe = Date.now();
      renderAccounts();
    }
    sx = null; rowEl = null;
  };
}
function accountRow(a){
  const emoji = a.type === 'Profissional' ? '💼' : '🏦';
  if (accFlipped[a.id]) {
    const eom = accountEndOfMonth(a);
    const bg = eom.v >= 0 ? 'var(--good)' : 'var(--red)';
    return `
    <div class="row" data-accid="${a.id}" onclick="openAccountDetail(${a.id})" style="background:${bg};border-color:${bg}">
      <div class="row-emoji">${emoji}</div>
      <div class="row-info"><div class="row-name" style="color:#fff">${esc(a.name)}</div>
        <div class="row-detail" style="color:rgba(255,255,255,.85)">saldo previsto no fim do mês · desliza para voltar</div></div>
      <div class="row-val" style="color:#fff">${fmtEUR(eom.v)}</div>
    </div>`;
  }
  return `
    <div class="row" data-accid="${a.id}" onclick="openAccountDetail(${a.id})">
      <div class="row-emoji">${emoji}</div>
      <div class="row-info"><div class="row-name">${esc(a.name)}</div><div class="row-detail">${esc(a.type)}${a.updatedAt ? ' · atualizada ' + fmtDateTime(a.updatedAt) : ''} · desliza p/ fim do mês</div></div>
      <div class="row-val">${fmtEUR(a.balance)}</div>
    </div>`;
}
function renderAccounts(){
  // contas Profissional ficam à parte e fora do património/fixas
  const pers = state.accounts.filter(a => a.type !== 'Profissional');
  const prof = state.accounts.filter(a => a.type === 'Profissional');
  document.getElementById('acc-total').textContent = fmtEUR(pers.reduce((s,a) => s + (a.balance||0), 0));
  document.getElementById('acc-invest-total').textContent = fmtEUR(totalInvestments());
  const el = document.getElementById('accounts-list');
  el.innerHTML = (pers.length ? pers.map(accountRow).join('') : '<div class="empty-state"><div class="icon">🏦</div><p>Ainda sem contas</p></div>')
    + (prof.length ? `<div class="section-hdr" style="margin-top:20px"><h3>Profissional</h3></div>
      <div class="note-box" style="margin-bottom:8px">Contas da empresa — fora do património líquido e das fixas. Só impactam as tuas contas quando fazes transferências de/para elas (entradas e saídas de capital).</div>`
      + prof.map(accountRow).join('') : '');
  renderTransfersList();
  bindAccountSwipes();
}
function renderTransfersList(){
  const el = document.getElementById('transfers-list');
  const trBills = state.recurringBills.filter(x => x.kind === 'transfer');
  el.innerHTML = trBills.length ? trBills.map(x => `
    <div class="row" onclick="openBillModal(${x.id})">
      <div class="row-emoji">🔁</div>
      <div class="row-info"><div class="row-name">${esc(x.name)}</div>
        <div class="row-detail">todos os dias ${x.day} · ${esc((getEntity(x.fromRef)||{}).name||'?')} → ${esc((getEntity(x.toRef)||{}).name||'?')}${x.to ? ' · até ' + fmtMonth(x.to) : ''}</div></div>
      <div class="row-val" style="color:var(--blue)">${fmtEUR(x.amount)} ⇄</div>
    </div>`).join('') : '<div class="empty-state" style="padding:10px"><p>Sem transferências agendadas</p></div>';
}
function openOneOffTransfer(){
  openTxModal();
  document.getElementById('tx-kind').value = 'transfer';
  onTxKindChange();
}
function openRecurringTransfer(){
  openBillModal();
  document.getElementById('bill-kind').value = 'transfer';
  onBillKindChange();
}
function openAccountDetail(id){
  if (Date.now() - lastAccSwipe < 400) return; // foi um deslize, não um toque
  const a = state.accounts.find(x => x.id === id);
  document.getElementById('acc-detail-title').textContent = a.name;
  const eom = accountEndOfMonth(a);
  let html = `<div class="stat-grid" style="margin-bottom:12px">
    <div class="stat-box"><div class="l">Saldo a hoje</div><div class="v">${fmtEUR(a.balance||0)}</div></div>
    <div class="stat-box"><div class="l">Previsto no fim do mês</div><div class="v" style="color:${eom.v>=0?'var(--good)':'var(--red)'}">${fmtEUR(eom.v)}</div></div>
  </div>`;
  if (eom.items.length) {
    html += '<div class="form-label" style="margin-bottom:4px">Fixas deste mês por liquidar nesta conta:</div><div class="timeline">' + eom.items.map(p => `
      <div class="tl-item"><div class="tl-dot" style="background:${p.delta>=0?'var(--good)':'var(--red)'}"></div>
        <div class="tl-info"><div class="t">${esc(p.name)}</div><div class="s">dia ${p.day} · ${p.delta>=0?'+':'-'}${fmtEUR(Math.abs(p.delta))}</div></div>
        <div class="tl-val" style="color:${p.run>=0?'var(--txt)':'var(--red)'}">${fmtEUR(p.run)}</div>
      </div>`).join('') + '</div>';
  } else {
    html += '<div class="row-detail">Sem fixas por liquidar este mês associadas a esta conta.</div>';
  }
  document.getElementById('acc-detail-body').innerHTML = html;
  document.getElementById('acc-detail-edit').onclick = () => { closeModal('account-detail-modal'); openAccountModal(id); };
  document.getElementById('account-detail-modal').classList.add('open');
}
function openAccountModal(id){
  document.getElementById('acc-id').value = id||'';
  document.getElementById('account-modal-title').textContent = id ? 'Editar Conta' : 'Nova Conta';
  document.getElementById('acc-delete-btn').style.display = id ? 'block' : 'none';
  if (id) {
    const a = state.accounts.find(x=>x.id===id);
    document.getElementById('acc-name').value = a.name;
    document.getElementById('acc-type').value = a.type;
    document.getElementById('acc-balance').value = a.balance;
  } else {
    document.getElementById('acc-name').value = '';
    document.getElementById('acc-type').value = 'À ordem';
    document.getElementById('acc-balance').value = '';
  }
  document.getElementById('account-modal').classList.add('open');
}
function saveAccount(){
  const id = document.getElementById('acc-id').value;
  const name = document.getElementById('acc-name').value.trim();
  if (!name) { showToast('Indica um nome'); return; }
  const data = { name, type: document.getElementById('acc-type').value,
    balance: parseFloat(document.getElementById('acc-balance').value)||0,
    updatedAt: Date.now() }; // atualização manual: passa a ser a verdade — transações anteriores deixam de mexer neste saldo
  if (id) {
    Object.assign(state.accounts.find(a=>a.id==id), data);
  } else {
    state.accounts.push({ id: state.nextAccountId++, ...data });
  }
  closeModal('account-modal'); save(); showToast('✅ Conta guardada');
}
function deleteAccount(){
  const id = parseInt(document.getElementById('acc-id').value);
  state.accounts = state.accounts.filter(a=>a.id!==id);
  closeModal('account-modal'); save(); showToast('🗑️ Conta eliminada');
}

