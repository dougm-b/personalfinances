// ══════════════════════════════════════════
// CONTAS
// ══════════════════════════════════════════
function renderAccounts(){
  document.getElementById('acc-total').textContent = fmtEUR(totalAccounts());
  document.getElementById('acc-invest-total').textContent = fmtEUR(totalInvestments());
  const el = document.getElementById('accounts-list');
  el.innerHTML = state.accounts.length ? state.accounts.map(a => {
    const nPlanned = state.plannedTx.filter(p => p.accountId === a.id).length;
    return `
    <div class="row" onclick="openAccountDetail(${a.id})">
      <div class="row-emoji">🏦</div>
      <div class="row-info"><div class="row-name">${esc(a.name)}</div><div class="row-detail">${esc(a.type)}${a.updatedAt ? ' · atualizada ' + fmtDateTime(a.updatedAt) : ''}${nPlanned ? ` · ${nPlanned} previsto${nPlanned>1?'s':''}` : ''}</div></div>
      <div class="row-val">${fmtEUR(a.balance)}</div>
    </div>`;
  }).join('') : '<div class="empty-state"><div class="icon">🏦</div><p>Ainda sem contas</p></div>';
}
function openAccountDetail(id){
  const a = state.accounts.find(x => x.id === id);
  document.getElementById('acc-detail-title').textContent = a.name;
  const planned = state.plannedTx.filter(p => p.accountId === id).slice().sort((x,y) => x.dueDate.localeCompare(y.dueDate));
  let run = a.balance || 0;
  let html = `<div class="stat-box" style="margin-bottom:12px"><div class="l">Saldo a hoje</div><div class="v">${fmtEUR(run)}</div></div>`;
  if (planned.length) {
    html += '<div class="form-label" style="margin-bottom:4px">Saldo previsto ao longo do tempo:</div><div class="timeline">' + planned.map(p => {
      run += p.amount;
      return `<div class="tl-item" onclick="closeModal('account-detail-modal');openPlannedModal(${p.id})" style="cursor:pointer">
        <div class="tl-dot" style="background:${p.amount>=0?'var(--good)':'var(--red)'}"></div>
        <div class="tl-info"><div class="t">${esc(p.desc)}</div><div class="s">${p.dueDate} · ${p.amount>=0?'+':'-'}${fmtEUR(Math.abs(p.amount))}</div></div>
        <div class="tl-val" style="color:${run>=0?'var(--txt)':'var(--red)'}">${fmtEUR(run)}</div>
      </div>`;
    }).join('') + '</div>';
  } else {
    html += '<div class="empty-state" style="padding:14px"><p>Sem movimentos previstos para esta conta.</p><p style="font-size:12px;margin-top:6px">Adiciona-os na aba Fixas → Movimentos Previstos.</p></div>';
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

