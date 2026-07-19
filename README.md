# Finanças

App pessoal de gestão financeira de página única, sem dependências nem build
tooling. `index.html` é aberto diretamente no browser (duplo-clique local, ou
GitHub Pages) e sincroniza dados com `data/finance.json` neste mesmo repo via
GitHub API, usando um Personal Access Token guardado só no `localStorage` do
browser.

## Funcionalidades

- **Dashboard** — património líquido (total investido + contas à ordem) com
  simulação temporal: avança mês a mês para ver o valor previsto assumindo
  que as receitas/despesas do mês atual se mantêm, mais os movimentos
  previstos. Também: receitas/despesas do mês, cartão de crédito, empréstimo
  da casa, despesas por categoria, histórico mensal e próximas despesas
  fixas.
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
  (Deny e Mauricio): valor emprestado e saldo em dívida calculado a partir
  de débitos mensais configuráveis por período (ex: 300 €/mês de Mar 2025 a
  Fev 2026, depois outro valor) com correção manual sempre disponível. O
  card "Recebido" mostra só o total; ao tocar abre o detalhe (transferências
  recebidas, pagamentos feitos e estimativa de quando o empréstimo fica pago
  mantendo o valor do último mês). Renda de quartos configurável: número de
  quartos, nome e renda de cada um, e ajustes pontuais por mês (ex:
  inquilino não pagou este mês e paga dois juntos no seguinte). O botão
  "Registar pagamento" abate o valor no saldo, cria a transação e debita a
  conta escolhida.

As transações de receita/despesa novas afetam o saldo da conta associada
(as antigas, criadas antes desta funcionalidade, não são retroativamente
aplicadas). Pagamentos de despesas fixas e movimentos de investimento também
geram transações e movem o saldo das contas.

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

Cada alteração fica também em cache no `localStorage`: se a gravação no
GitHub falhar (sem rede, ou token sem permissão de escrita), os dados
sobrevivem ao recarregar da página e a app volta a tentar gravá-los
automaticamente no próximo ciclo de sincronização. O indicador no canto
superior direito mostra o estado ("guardado ✓", "erro ao guardar — dados
locais seguros", etc.). Nota: o token precisa da permissão **Contents:
Read and write** — só leitura deixa carregar os dados mas falha ao guardar.

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
