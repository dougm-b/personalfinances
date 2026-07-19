// ══════════════════════════════════════════
// INVESTIMENTOS + METAS
// ══════════════════════════════════════════
let activeInvestId = null;
function renderInvest(){
  document.getElementById('invest-total').textContent = fmtEUR(totalInvestments());
  const el = document.getElementById('invest-list');
  el.innerHTML = state.investments.map(inv => {
    const hist = (inv.contributions||[]).slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4)
      .map(c => `<div class="row-detail">${c.date} · ${c.amount>=0?'+':''}${fmtEUR(c.amount)}${c.note?' · '+esc(c.note):''}</div>`).join('');
    return `<div class="card">
      <div class="card-title">${esc(inv.name)}
        <span style="display:flex;gap:6px">
          <button class="add-btn" style="background:var(--g3);color:var(--txt2)" onclick="openInvestFixModal('${inv.id}')">✎ Corrigir valor</button>
          <button class="add-btn" onclick="openInvestModal('${inv.id}')">+ Movimento</button>
        </span></div>
      <div class="hero-val" style="font-size:22px">${fmtEUR(inv.balance)}</div>
      <div style="margin-top:8px">${hist || '<div class="row-detail">Sem movimentos registados</div>'}</div>
    </div>`;
  }).join('');
}
function openInvestModal(id){
  activeInvestId = id;
  fillAccountSelect(document.getElementById('invest-account'), null);
  document.getElementById('invest-amount').value = '';
  document.getElementById('invest-note').value = '';
  document.getElementById('invest-modal').classList.add('open');
}
function saveInvestContribution(){
  const inv = state.investments.find(i=>i.id===activeInvestId);
  const amount = parseFloat(document.getElementById('invest-amount').value);
  if (!amount) { showToast('Indica um valor'); return; }
  const accId = parseInt(document.getElementById('invest-account').value);
  const note = document.getElementById('invest-note').value.trim();
  const accRef = 'acc:' + accId, invRef = 'inv:' + inv.id;
  // reforço: conta → investimento; levantamento: investimento → conta
  const t = { id: state.nextTxId++,
    desc: (amount >= 0 ? 'Reforço ' : 'Levantamento ') + inv.name + (note ? ' — ' + note : ''),
    kind:'transfer', date: todayKey(), amount: Math.abs(amount),
    fromRef: amount >= 0 ? accRef : invRef, toRef: amount >= 0 ? invRef : accRef,
    category:null, accountId:null };
  state.transactions.push(t);
  applyTransfer(t, 1); // atualiza saldo da conta e do investimento
  inv.contributions = inv.contributions || [];
  inv.contributions.push({ date: todayKey(), amount, note });
  closeModal('invest-modal'); save(); showToast('✅ Movimento registado em Transações');
}
function openInvestFixModal(id){
  activeInvestId = id;
  const inv = state.investments.find(i=>i.id===id);
  document.getElementById('invfix-value').value = inv.balance || 0;
  document.getElementById('invfix-note').value = '';
  document.getElementById('invest-fix-modal').classList.add('open');
}
function saveInvestFix(){
  const inv = state.investments.find(i=>i.id===activeInvestId);
  const val = parseFloat(document.getElementById('invfix-value').value);
  if (isNaN(val)) { showToast('Indica o valor'); return; }
  const delta = round2(val - (inv.balance||0));
  inv.balance = round2(val);
  if (delta !== 0) {
    inv.contributions = inv.contributions || [];
    inv.contributions.push({ date: todayKey(), amount: delta,
      note: document.getElementById('invfix-note').value.trim() || 'correção manual de valor' });
  }
  closeModal('invest-fix-modal'); save(); showToast('✅ Valor corrigido (sem mexer nas contas)');
}
function renderGoals(){
  const el = document.getElementById('goals-list');
  el.innerHTML = state.savingsGoals.length ? state.savingsGoals.map(g => {
    const pct = g.target ? Math.min(100,(g.current/g.target)*100) : 0;
    return `<div class="row" style="flex-direction:column;align-items:stretch;cursor:pointer" onclick="openGoalModal(${g.id})">
      <div style="display:flex;justify-content:space-between;width:100%">
        <div class="row-name">${esc(g.name)}</div><div class="row-val">${fmtEUR(g.current)} / ${fmtEUR(g.target)}</div>
      </div>
      <div class="progress" style="margin-top:6px"><div style="width:${pct}%"></div></div>
    </div>`;
  }).join('') : '<div class="empty-state"><div class="icon">🎯</div><p>Sem metas definidas</p></div>';
}
function openGoalModal(id){
  document.getElementById('goal-id').value = id||'';
  document.getElementById('goal-modal-title').textContent = id ? 'Editar Meta' : 'Nova Meta';
  document.getElementById('goal-delete-btn').style.display = id ? 'block' : 'none';
  if (id) {
    const g = state.savingsGoals.find(x=>x.id===id);
    document.getElementById('goal-name').value = g.name;
    document.getElementById('goal-target').value = g.target;
    document.getElementById('goal-current').value = g.current;
  } else {
    document.getElementById('goal-name').value = '';
    document.getElementById('goal-target').value = '';
    document.getElementById('goal-current').value = '';
  }
  document.getElementById('goal-modal').classList.add('open');
}
function saveGoal(){
  const id = document.getElementById('goal-id').value;
  const name = document.getElementById('goal-name').value.trim();
  if (!name) { showToast('Indica um nome'); return; }
  const data = { name, target: parseFloat(document.getElementById('goal-target').value)||0, current: parseFloat(document.getElementById('goal-current').value)||0 };
  if (id) { Object.assign(state.savingsGoals.find(g=>g.id==id), data); }
  else { state.savingsGoals.push({ id: state.nextGoalId++, ...data }); }
  closeModal('goal-modal'); save(); showToast('✅ Meta guardada');
}
function deleteGoal(){
  const id = parseInt(document.getElementById('goal-id').value);
  state.savingsGoals = state.savingsGoals.filter(g=>g.id!==id);
  closeModal('goal-modal'); save(); showToast('🗑️ Meta eliminada');
}

