// ══════════════════════════════════════════
// EXPORT / IMPORT
// ══════════════════════════════════════════
function exportData(){
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `financas-${todayKey()}.json`;
  a.click();
}
function importData(e){
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state = migrateState(JSON.parse(reader.result));
      save(); closeModal('settings-modal'); showToast('✅ Dados importados');
    } catch(err) { showToast('❌ Ficheiro inválido'); }
  };
  reader.readAsText(file);
}

// ══════════════════════════════════════════
// RENDER ALL / INIT
// ══════════════════════════════════════════
function renderAll(){
  updateDash(); renderAccounts(); renderTxFilters(); renderTx();
  renderBills(); renderPlanned(); renderCards(); renderInvest(); renderGoals(); renderHouse();
}
async function initApp(){
  // se ficou uma gravação pendente (ex: token sem permissão de escrita, sem
  // rede), arranca com os dados locais em cache em vez dos do GitHub
  if (dirty) {
    const cached = loadCachedState();
    if (cached) { state = cached; syncDerived(); } else setDirty(false);
  }
  await loadFromGitHub(); // obtém o sha; nunca sobrepõe alterações locais pendentes
  if (runLoanPlanCharges()) { setDirty(true); cacheState(); } // débitos mensais do empréstimo vencidos
  if (dirty) pushToGitHub(); // tenta gravar já o que ficou pendente
  renderAll();
  startAutoSync();
}
checkToken();
