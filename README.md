# Finanças

App pessoal de gestão financeira de página única, sem dependências nem build
tooling. `index.html` é aberto diretamente no browser (duplo-clique local, ou
GitHub Pages) e sincroniza dados com `data/finance.json` neste mesmo repo via
GitHub API, usando um Personal Access Token guardado só no `localStorage` do
browser.

## Funcionalidades

- **Dashboard** — património líquido, receitas/despesas do mês, cartão de
  crédito, empréstimo da casa, despesas por categoria do mês, histórico
  mensal e próximas despesas fixas.
- **Contas** — contas bancárias com saldo a hoje; clicar numa conta mostra a
  projeção do saldo ao longo do tempo, descontando/somando os movimentos
  previstos dessa conta.
- **Transações** — registo de receitas/despesas por categoria e conta, e
  transferências entre contas/investimentos (ex: Millennium → Trading), que
  atualizam os dois saldos automaticamente.
- **Fixas** — despesas fixas mensais (renda, água, luz, seguros, ginásio...)
  com botão para registar o pagamento do mês como transação; e movimentos
  previstos (ex: ordenado a receber) com data de inserção automática
  bloqueada + data de pagamento futura, editáveis até serem confirmados.
- **Cartão** — WiZink, Millennium e ActivoBank: limite (opcional), valor
  utilizado/disponível, valor "a pagar este mês" editável, e compras a
  crédito com prestação mensal fixa configurável.
- **Investir** — contas de investimento (Trading, PPR) com histórico de
  movimentos, e metas de poupança.
- **Casa** — detalhe do financiamento do apartamento e do empréstimo pessoal
  (Deny e Mauricio): valor emprestado, transferências recebidas, e saldo em
  dívida calculado a partir de débitos mensais configuráveis por período
  (ex: 300 €/mês de Mar 2025 a Fev 2026, depois outro valor) com correção
  manual sempre disponível. O botão "Registar pagamento" abate o valor no
  saldo e cria automaticamente a transação correspondente.

## Dados iniciais

Os valores em `data/finance.json` foram extraídos de uma folha de cálculo
antiga (exportada em PDF) cheia de células `#ERROR!`/`#REF!`. Só ficaram como
ponto de partida os números que batiam certo entre si (ex: a soma das 5
transferências da Deny/Mauricio menos a entrada do Douglas dá exatamente o
total do empréstimo; o plano de pagamento 2025–2028 reconcilia com o saldo
remanescente ano a ano). Tudo o resto — saldos de conta, cartão de crédito,
investimentos — está lá como referência e deve ser corrigido/atualizado
diretamente na app conforme a realidade atual.

## Sincronização entre dispositivos

Ao abrir a app pela primeira vez, pede um GitHub Personal Access Token com
permissão de leitura/escrita neste repositório. O token fica guardado só no
browser (`localStorage`, chave `dbfin_ghtoken`) e é usado para ler/escrever
`data/finance.json` via GitHub API — nunca é enviado para mais lado nenhum.
A app faz poll ao GitHub a cada 45s (só quando a aba está visível) e quando o
browser volta a ficar visível, para os dados aparecerem sozinhos quando são
alterados noutro dispositivo.

## Exportar / importar

No ícone de definições (⚙, topo direito) há botões para exportar os dados
para um ficheiro `.json` local (backup) ou importar um ficheiro previamente
exportado.

## Estrutura

```
index.html          app inteira (HTML + CSS + JS num único ficheiro,
                     sem build step)
data/finance.json    dados sincronizados via GitHub API
```

Não há `build.js` nem `src/` — ao contrário do repo `dbfit`, esta app é um
único ficheiro autossuficiente. Para alterar algo, edita `index.html`
diretamente.
