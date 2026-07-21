# Finanças

App pessoal de finanças (contas, transações, fixas, cartões, investimentos,
casa/empréstimo) de página única, sem dependências nem build tooling em
runtime. `index.html` é aberto diretamente no browser (duplo-clique local, ou
GitHub Pages) e sincroniza dados com `data/finance.json` neste mesmo repo via
GitHub API, usando um Personal Access Token guardado só no `localStorage` do
browser.

## `index.html` é gerado — nunca o edites diretamente

É montado a partir dos ficheiros em `src/` por `build.js`. Qualquer edição
feita diretamente no `index.html` **é perdida** na próxima vez que alguém
corra o build.

Fluxo de trabalho:
1. Edita os ficheiros relevantes dentro de `src/`.
2. Corre `node build.js` a partir da raiz do repo — regenera `index.html`.
3. Faz commit tanto das fontes (`src/**`) como do `index.html` regenerado —
   têm de ficar sempre sincronizados no mesmo commit.

## `data/finance.json` são os dados reais do utilizador — NUNCA o commits

Este ficheiro é escrito pela app do utilizador via GitHub API (commits
`finance: update ...`). Alterá-lo por git sobrepõe dados reais. Alterações de
esquema fazem-se em `migrateState` (`src/js/core.js`), preferencialmente com
flags únicas em `settings` (ex: `trading212Seeded`, `reservasMerged`) para
migrações que só devem correr uma vez.

## Estrutura de `src/`

```
src/shell.html               esqueleto (doctype, <head>, wrappers) com
                              marcadores <!--INCLUDE:caminho--> → gera index.html
src/css/app.css              todos os estilos (são quase todos partilhados
                              entre abas: cards, rows, modais, timeline...)
src/screens/{dashboard,accounts,tx,bills,cards,invest,house}.html
                              marcação de cada uma das 7 abas (a div .screen)
src/partials/setup.html      ecrã do token + toast + banner de permissão + sync-bar
src/partials/nav.html        menu de navegação inferior
src/partials/modals/*.html   modais agrupados por aba:
                              account (conta + detalhe/projeção), tx, bill
                              (fixa + movimento previsto), card (cartão +
                              compra financiada), invest (movimento +
                              corrigir valor + meta), house (saldo + pagamento
                              + débito mensal + quarto + ajuste + detalhe do
                              empréstimo), settings
src/js/core.js               config GitHub, helpers de datas/formatação,
                              estado por omissão, migrações, sync robusto
                              (cache localStorage, flag dirty, retry com sha),
                              token/permissões, navegação, modais, toast,
                              transferências entre contas/investimentos,
                              export/import — usado por todos os outros
src/js/dashboard.js          Dashboard: património (invest + à ordem),
                              simulação temporal (dashOffset/dashPickMonth),
                              cards de resumo, txRow (linha de transação,
                              também usada pela aba Transações)
src/js/accounts.js           Contas: lista, detalhe com projeção de saldo
src/js/tx.js                 Transações: filtros, CRUD, transferências
src/js/bills.js              Fixas (despesa/receita/transferência, liquidações,
                              ordenação) — Movimentos Previstos removidos da UI
                              (código guardado com null-check)
src/js/cards.js              Cartões de crédito + compras financiadas
src/js/invest.js             Investimentos (movimentos, corrigir valor) +
                              metas de poupança
src/js/house.js              Casa: helpers do empréstimo (computeLoanRemaining,
                              runLoanPlanCharges, projectLoanPayoff,
                              roomsMonthlyTotal, ensureRoomsBill), render,
                              débitos mensais, quartos/ajustes, detalhe
src/js/boot.js               export/import + renderAll + initApp + checkToken()
                              — tem de ser o último ficheiro incluído
```

Os ficheiros JS são concatenados num único `<script>` pela ordem em que
aparecem em `src/shell.html`. Como fica tudo no mesmo scope, declarações
`function` têm hoisting entre ficheiros (o `core.js` pode chamar
`ensureRoomsBill` definida em `house.js`). Mas os `let` de topo de nível
correm por ordem — não uses num ficheiro, em top-level, variáveis `let`
declaradas num ficheiro posterior. `core.js` primeiro e `boot.js` último,
sempre.

## Conceitos do domínio (onde mexer para cada coisa)

- **Sync**: `core.js`. Nunca descarta alterações locais: cache em
  `localStorage` (`dbfin_cache` + flag `dbfin_dirty`), retry automático,
  conflitos 409/422 renovam só o sha. Push falhado por permissão mostra
  banner persistente (`showPermBanner`).
- **Transações** afetam o saldo da conta (`applied:true`; as anteriores a
  essa funcionalidade não têm a flag e nunca são revertidas). Transferências
  usam refs `acc:<id>` / `inv:<id>` (`entityOptions`/`applyTransfer`).
- **Empréstimo da casa**: saldo em dívida = `baseRemaining` (corrigível
  manualmente, fixa `baseMonth`) menos débitos mensais configurados
  (`paymentPlans`, por período `from`/`to`). Cada plano com `accountId` gera
  transações automáticas mensais no arranque (`runLoanPlanCharges`,
  `chargedUntil` evita retroativos e duplicados).
- **Renda dos quartos** (`house.rooms` + ajustes pontuais por mês) sincroniza
  para a fixa `auto:'rooms'` nas Fixas via `ensureRoomsBill` (chamada em
  `syncDerived` após cada load e ao editar quartos).
- **Fixas por mês**: a aba tem um seletor de mês (`billsMonth`); os itens de
  um mês vêm de `fixasItemsForMonth(M)` = fixas dentro do prazo (`from`/`to`
  opcionais) + prestações dos cartões (`financedItems` com `installment`,
  `startMonth`, `months`; dia = `card.dueDay`) + débitos mensais do
  empréstimo (`paymentPlans`, key `plan:<id>`; a cobrança automática regista
  a liquidação do mês para não duplicar com o checkbox). Liquidações em `state.billSettlements`
  (`'<key>|<YYYY-MM>': {txId}`) — bloqueiam pagamentos duplicados no mês e
  riscam o item. O checkbox "liquidado" cria a transação com `applied:false`
  (não mexe no saldo); o botão "Registar pagamento" cria com `applied:true`
  (debita/credita). Apagar a transação em Transações limpa a liquidação.
- **Atualização manual de conta**: `saveAccount` grava `updatedAt`;
  transações com `ts` anterior a esse instante ficam supersedidas
  (`txSuperseded`) e deixam de poder alterar o saldo dessa conta.
- **Simulação do dashboard**: usa os movimentos fixos configurados
  (`fixasItemsForMonth` por cada mês futuro, respeitando prazos) + fixas por
  liquidar do mês atual + movimentos previstos (`plannedTx`) até à data alvo. O modal "Balanço do
  Mês" (clicar em Receitas/Despesas) mostra a composição detalhada e a sobra
  prevista na conta à ordem.

## Depois de qualquer alteração

Corre sempre `node build.js` e confirma que não há erros; valida a sintaxe do
JS gerado com `node --check` sobre o conteúdo do `<script>`. Para validar
visualmente sem um token real, serve a pasta (`python3 -m http.server 8000`)
e usa Playwright para mockar
`https://api.github.com/repos/dougm-b/personalfinances/contents/data/finance.json`
(GET devolve `{sha, content: base64}`, PUT devolve `{content:{sha}}`) e
`https://api.github.com/repos/dougm-b/personalfinances` (devolve
`{permissions:{push:true}}` — usado na validação do token).

## Porquê isto existe

`index.html` tinha ~2.200 linhas (HTML+CSS+JS misturados). Qualquer alteração
— mesmo pequena — exigia ler e editar esse ficheiro inteiro, gastando muito
mais tokens do que necessário. Esta estrutura existe para que uma alteração
numa aba (ex: "muda o texto do botão de guardar quarto") só precise de tocar
em 1–2 ficheiros pequenos.
