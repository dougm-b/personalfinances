// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════
let dashOffset = 0; // meses no futuro para a simulação do património
function dashShift(d){ dashOffset = Math.max(0, dashOffset + d); updateDash(); }
function dashPickMonth(val){
  if (!val) return;
  const [cy,cm] = todayKey().slice(0,7).split('-').map(Number);
  const [ty,tm] = val.split('-').map(Number);
  dashOffset = Math.max(0, (ty-cy)*12 + (tm-cm));
  updateDash();
}

function updateDash(){
  // património = total investido + contas à ordem
  const invTotal = totalInvestments();
  const ordemTotal = state.accounts.filter(a => a.type === 'À ordem').reduce((s,a) => s + (a.balance||0), 0);
  const mIncome = monthTx('income');
  const mExpense = monthTx('expense'); // negativo
  let net = invTotal + ordemTotal;
  const noteEl = document.getElementById('d-sim-note');
  const curMonth = todayKey().slice(0,7);
  const monthInput = document.getElementById('d-sim-month');
  monthInput.min = curMonth;
  if (dashOffset > 0) {
    const targetM = addMonthsKey(curMonth, dashOffset);
    // receitas/despesas do mês atual mantidas + movimentos previstos até lá
    const plannedSum = state.plannedTx
      .filter(p => p.dueDate > todayKey() && p.dueDate <= targetM + '-31')
      .reduce((s,p) => s + p.amount, 0);
    net += dashOffset * (mIncome + mExpense) + plannedSum;
    document.getElementById('d-net-lbl').textContent = 'Património previsto';
    document.getElementById('d-sim-label-txt').textContent = fmtMonth(targetM) + ' ▾';
    monthInput.value = targetM;
    noteEl.style.display = '';
    noteEl.textContent = `Simulação: assume que as receitas (${fmtEUR(mIncome)}/mês) e despesas (${fmtEUR(Math.abs(mExpense))}/mês) do mês atual se mantêm, mais os movimentos previstos até ${fmtMonth(targetM)}. Toca na data para escolher outro mês/ano.`;
  } else {
    document.getElementById('d-net-lbl').textContent = 'Património líquido';
    document.getElementById('d-sim-label-txt').textContent = 'Hoje ▾';
    monthInput.value = curMonth;
    noteEl.style.display = 'none';
  }
  document.getElementById('d-networth').textContent = fmtEUR(net);
  document.getElementById('d-networth').style.color = net >= 0 ? 'var(--txt)' : 'var(--red)';
  document.getElementById('d-invest').textContent = fmtEUR(invTotal);
  document.getElementById('d-ordem').textContent = fmtEUR(ordemTotal);
  document.getElementById('d-income').textContent = fmtEUR(mIncome);
  document.getElementById('d-expense').textContent = fmtEUR(Math.abs(mExpense));

  const cardsEl = document.getElementById('d-cards');
  cardsEl.innerHTML = state.creditCards.length ? state.creditCards.map(c => {
    if (!c.limit) {
      return `<div style="margin-bottom:10px">
        <div class="progress-lbl"><span>${esc(c.name)}</span><span>utilizado ${fmtEUR(c.used)}</span></div>
      </div>`;
    }
    const pct = Math.min(100, (c.used/c.limit)*100);
    const cls = pct > 80 ? 'red' : pct > 50 ? 'warn' : '';
    return `<div style="margin-bottom:10px">
      <div class="progress-lbl"><span>${esc(c.name)}</span><span>${fmtEUR(c.used)} / ${fmtEUR(c.limit)}</span></div>
      <div class="progress ${cls}"><div style="width:${pct}%"></div></div>
    </div>`;
  }).join('') : '<div class="empty-state" style="padding:10px"><p>Sem cartões registados</p></div>';

  const loan = state.house.loan;
  const loanRem = computeLoanRemaining();
  const curM = todayKey().slice(0,7);
  const activePlan = (loan.paymentPlans||[]).find(p => p.from <= curM && curM <= p.to);
  document.getElementById('d-loan').innerHTML = `
    <div class="hero-val" style="font-size:22px">${fmtEUR(loanRem)}</div>
    <div class="row-detail" style="margin-top:4px">em dívida${activePlan ? ` · débito mensal ${fmtEUR(activePlan.amount)} até ${fmtMonth(activePlan.to)}` : ' · sem débito mensal ativo'} — <span onclick="openHouseRemainingModal()" style="text-decoration:underline;cursor:pointer">corrigir</span></div>`;

  // despesas por categoria do mês atual
  const mk = todayKey().slice(0,7);
  const catTotals = {};
  state.transactions.filter(t => t.kind==='expense' && monthKey(t.date)===mk)
    .forEach(t => { catTotals[t.category] = (catTotals[t.category]||0) + Math.abs(t.amount); });
  const cats = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);
  const maxCat = cats.length ? cats[0][1] : 1;
  document.getElementById('d-cats').innerHTML = cats.length ? cats.map(([c,v]) => `
    <div style="margin-bottom:10px">
      <div class="progress-lbl"><span>${CATEGORY_EMOJI[c]||'✨'} ${esc(c)}</span><span>${fmtEUR(v)}</span></div>
      <div class="progress"><div style="width:${(v/maxCat)*100}%"></div></div>
    </div>`).join('') : '<div class="empty-state" style="padding:10px"><p>Sem despesas este mês</p></div>';

  // histórico dos últimos 6 meses (só meses com movimentos)
  const byMonth = {};
  state.transactions.forEach(t => {
    const m = monthKey(t.date);
    if (!byMonth[m]) byMonth[m] = { income:0, expense:0 };
    if (t.kind==='income') byMonth[m].income += t.amount;
    else byMonth[m].expense += Math.abs(t.amount);
  });
  const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const months = Object.keys(byMonth).sort().slice(-6).reverse();
  document.getElementById('d-months').innerHTML = months.length ? months.map(m => {
    const d = byMonth[m], net = d.income - d.expense;
    const [y, mo] = m.split('-');
    return `<div class="tl-item"><div class="tl-dot" style="background:${net>=0?'var(--good)':'var(--red)'}"></div>
      <div class="tl-info"><div class="t">${monthNames[parseInt(mo)-1]} ${y}</div>
        <div class="s">+${fmtEUR(d.income)} · -${fmtEUR(d.expense)}</div></div>
      <div class="tl-val" style="color:${net>=0?'var(--good)':'var(--red)'}">${net>=0?'+':''}${fmtEUR(net)}</div>
    </div>`;
  }).join('') : '<div class="empty-state" style="padding:10px"><p>Sem histórico ainda</p></div>';

  const today = new Date().getDate();
  const upcoming = state.recurringBills.slice().sort((a,b)=>{
    const da = a.day>=today ? a.day-today : a.day-today+31;
    const db = b.day>=today ? b.day-today : b.day-today+31;
    return da-db;
  }).slice(0,5);
  document.getElementById('d-bills').innerHTML = upcoming.length ? upcoming.map(b => `
    <div class="row" onclick="openBillModal(${b.id})">
      <div class="row-emoji">${CATEGORY_EMOJI[b.category]||'📄'}</div>
      <div class="row-info"><div class="row-name">${esc(b.name)}</div><div class="row-detail">dia ${b.day} · ${b.kind==='income'?'credita':'debita'}</div></div>
      <div class="row-val ${b.kind==='income'?'pos':''}">${b.amount!=null ? (b.kind==='income'?'+':'') + fmtEUR(b.amount) : 'variável'}</div>
    </div>`).join('') : '<div class="empty-state" style="padding:10px"><p>Sem movimentos fixos</p></div>';

  const recent = state.transactions.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  document.getElementById('d-recent').innerHTML = recent.length ? recent.map(txRow).join('')
    : '<div class="empty-state" style="padding:10px"><p>Sem transações ainda</p></div>';
}

function txRow(t){
  if (t.kind === 'transfer') {
    const f = getEntity(t.fromRef), to = getEntity(t.toRef);
    return `<div class="row" onclick="openTxModal(${t.id})">
      <div class="row-emoji">🔁</div>
      <div class="row-info"><div class="row-name">${esc(t.desc)}</div><div class="row-detail">${t.date} · ${f?esc(f.name):'?'} → ${to?esc(to.name):'?'}</div></div>
      <div class="row-val" style="color:var(--blue)">${fmtEUR(Math.abs(t.amount))}</div>
    </div>`;
  }
  return `<div class="row" onclick="openTxModal(${t.id})">
    <div class="row-emoji">${CATEGORY_EMOJI[t.category]||'✨'}</div>
    <div class="row-info"><div class="row-name">${esc(t.desc)}</div><div class="row-detail">${t.date} · ${esc(t.category)}</div></div>
    <div class="row-val ${t.kind==='income'?'pos':'neg'}">${t.kind==='income'?'+':'-'}${fmtEUR(Math.abs(t.amount))}</div>
  </div>`;
}


// detalhe das receitas/despesas do mês + sobra prevista na conta à ordem,
// para ser fácil verificar a composição e apanhar duplicações
function openMonthBalance(){
  const M = todayKey().slice(0,7);
  const today = todayKey();
  const txs = state.transactions.filter(t => monthKey(t.date) === M && t.kind !== 'transfer')
    .sort((a,b) => a.date.localeCompare(b.date));
  const txRowMini = t => `<div class="tl-item"><div class="tl-dot" style="background:${t.amount>=0?'var(--good)':'var(--red)'}"></div>
    <div class="tl-info"><div class="t">${esc(t.desc)}</div><div class="s">${t.date}${t.applied===false?' · não mexeu no saldo':''}</div></div>
    <div class="tl-val" style="color:${t.amount>=0?'var(--good)':'var(--red)'}">${t.amount>=0?'+':''}${fmtEUR(t.amount)}</div></div>`;
  const incTx = txs.filter(t => t.kind === 'income');
  const expTx = txs.filter(t => t.kind === 'expense');
  // fixas do mês ainda por liquidar (pendentes)
  const pending = fixasItemsForMonth(M).filter(it => it.amount != null && !settlementOf(it.key, M)
    && (M + '-' + String(it.day).padStart(2,'0')) >= today);
  const pendInc = pending.filter(i => i.kind === 'income');
  const pendExp = pending.filter(i => i.kind !== 'income');
  const pendRowMini = it => `<div class="tl-item"><div class="tl-dot" style="background:var(--txt3)"></div>
    <div class="tl-info"><div class="t">${esc(it.name)}</div><div class="s">previsto dia ${it.day} (fixa por liquidar)</div></div>
    <div class="tl-val">${it.kind==='income'?'+':'-'}${fmtEUR(it.amount)}</div></div>`;
  const sum = arr => arr.reduce((a,x) => a + Math.abs(x.amount), 0);
  const ordem = state.accounts.filter(a => a.type === 'À ordem').reduce((s,a) => s + (a.balance||0), 0);
  const leftover = round2(ordem + sum(pendInc) - sum(pendExp));
  document.getElementById('mb-body').innerHTML = `
    <div class="form-label">Receitas registadas (${fmtEUR(sum(incTx))}):</div>
    ${incTx.length ? '<div class="timeline">'+incTx.map(txRowMini).join('')+'</div>' : '<div class="row-detail">nenhuma</div>'}
    ${pendInc.length ? '<div class="form-label" style="margin-top:8px">Receitas fixas por liquidar ('+fmtEUR(sum(pendInc))+'):</div><div class="timeline">'+pendInc.map(pendRowMini).join('')+'</div>' : ''}
    <div class="form-label" style="margin-top:12px">Despesas registadas (${fmtEUR(sum(expTx))}):</div>
    ${expTx.length ? '<div class="timeline">'+expTx.map(txRowMini).join('')+'</div>' : '<div class="row-detail">nenhuma</div>'}
    ${pendExp.length ? '<div class="form-label" style="margin-top:8px">Despesas fixas por liquidar ('+fmtEUR(sum(pendExp))+'):</div><div class="timeline">'+pendExp.map(pendRowMini).join('')+'</div>' : ''}
    <div class="stat-grid" style="margin-top:14px">
      <div class="stat-box"><div class="l">À ordem agora</div><div class="v">${fmtEUR(ordem)}</div></div>
      <div class="stat-box"><div class="l">Sobra prevista no fim de ${fmtMonth(M)}</div><div class="v" style="color:${leftover>=0?'var(--good)':'var(--red)'}">${fmtEUR(leftover)}</div></div>
    </div>
    <div class="note-box">Sobra = saldo à ordem atual + receitas fixas por liquidar − despesas fixas por liquidar deste mês.</div>`;
  document.getElementById('month-balance-modal').classList.add('open');
}
