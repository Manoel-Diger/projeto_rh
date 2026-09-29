# RH e Eficiência Operacional – HE Belém

Painel executivo de horas extras (HE), custos, jornadas e simulação do turno 13h–22h da Filial BEL.
HTML + CSS + JavaScript no navegador; Python só para ler a folha e a Base Mestra.

## Como abrir
Dê dois cliques em `index.html`. Não precisa de internet nem de servidor (o Chart.js já está em `assets/vendor/`).

## Atualização mensal (3 passos)
1. Salve o PDF da folha do mês em `data/entrada/folha/` (o mês é lido de dentro do PDF; o nome do arquivo não importa).
2. Se houver horários novos/admissões, atualize a planilha em `data/entrada/base_mestra/` (aba **Base Mestra**, colunas: Colaborador, Função, Horário, Salário).
3. Execute `atualizar.bat` (Windows) ou `./atualizar.sh` (Mac/Linux). Requer Python 3.9+.
   Ou manualmente: `pip install -r requirements.txt` e `python scripts/atualizar_dados.py`.

Cada mês vira um arquivo em `data/processado/AAAA-MM.json`. O histórico cresce sozinho e o seletor "Mês" do painel mostra todos.
Para reprocessar tudo, apague os JSON de `data/processado/` e rode de novo com todos os PDFs na pasta.

## Estrutura
```
rh-eficiencia-he-bel/
├── index.html                 painel
├── atualizar.bat / .sh        atalhos de atualização
├── requirements.txt           pdfplumber, openpyxl
├── scripts/
│   ├── atualizar_dados.py     orquestra a atualização
│   ├── parser_folha.py        lê o PDF da folha (por coordenadas)
│   ├── base_mestra.py         lê a Base Mestra e interpreta horários
│   ├── analises.py            cruzamento, indicadores, conferência e insights
│   └── config.json            regras (códigos de eventos, limites, premissas da simulação)
├── data/
│   ├── entrada/folha/         PDFs da folha
│   ├── entrada/base_mestra/   planilha Base Mestra
│   └── processado/            JSON por mês + dados.js (lido pelo painel)
└── assets/ css/ js/ vendor/
```

## PDFs sem camada de texto (OCR)
Se um PDF da folha chegar sem texto extraível (por exemplo, gerado por "imprimir em PDF" a partir
de uma pré-visualização, sem texto real — apenas imagem/traçado), o script tenta ler essas páginas
por OCR automaticamente, inclusive corrigindo sozinho a rotação da página quando necessário. Isso
exige o **Tesseract OCR instalado na máquina** (além do pacote Python `pytesseract`, já incluso no
`requirements.txt`):
- Windows: instale o Tesseract (build UB-Mannheim) e garanta que fique no PATH.
- Mac: `brew install tesseract`.
Sem o Tesseract instalado, esses PDFs continuam sendo ignorados (com aviso claro no terminal), do
mesmo jeito que qualquer PDF de layout não reconhecido — nenhum outro mês é afetado.

## Filtros de Ano e Mês (seleção múltipla)
Os dois filtros aceitam **mais de uma opção ao mesmo tempo**. Clique no campo e marque o que quiser; o painel só fecha ao clicar fora ou apertar `Esc`.
- **Ano**: restringe os meses oferecidos no filtro de Mês. "Todos os anos" (padrão) mostra o histórico completo.
- **Mês**: lista os meses agrupados por ano, com o mesmo mês alinhado entre os anos. Marque, por exemplo, **Jan/2025 + Jan/2026** para comparar.
  A caixa ao lado de cada ano marca ou desmarca o ano inteiro; "Todos os meses" limpa a seleção.
- **Um único mês** marcado: o painel mostra a visão detalhada de sempre (insights, comparação com o mês anterior, simulação e qualidade dos dados).
- **Vários meses** (ou nenhum): visão consolidada. Cards, tabelas e rankings somam os meses selecionados; Simulação e Qualidade dos dados pedem um único mês.
- **Gráficos "mês a mês"** (Visão executiva): quando a seleção tem mais de um ano, os mesmos meses ficam lado a lado e cada ano tem uma cor, sempre a partir da cor do indicador
  (o ano mais recente usa a cor original; os anteriores usam tons mais claros). Com um só ano, o gráfico segue como antes.
- A coluna **VAR.** da tabela "Comparativo mensal" compara os dois últimos meses cronológicos da tabela (passe o mouse no título para ver quais).
- Os filtros de Área, Turno, Situação e Função voltam para "Todos" sozinhos quando o valor escolhido não existe no período selecionado.

## Regras e premissas (editáveis em `scripts/config.json`)
- **HE** = eventos 34, 36 e 39 da folha; **DSR sobre HE** = evento 65. O custo de HE inclui o DSR.
- Valor/hora = salário ÷ 220. Limite de referência: 44 h de HE/mês (2 h × 22 dias).
- Encargos sobre HE: 8% (FGTS) como padrão; ajuste conforme a controladoria.
- Horários **PENDENTE** nunca são inferidos: esses colaboradores ficam fora das análises de turno e da simulação.
- Aprendizes, liderança, administrativo etc. são classificados por palavra-chave da função (`areas_por_palavra_chave`).
- Rescisões e 13º adiantado ficam fora da "remuneração comparável" usada no % de HE.
- Dados individuais de descontos pessoais (consignado, adiantamento, plano de saúde) **não** são lidos nem guardados.

## Simulação 13h–22h – leia antes de apresentar
A folha diz quantas HE cada pessoa fez, mas não **em que horário**. Por isso o percentual de HE que passa a ser jornada normal
(hora das 21h–22h) é uma **premissa ajustável** (padrão 30%), não um dado medido. Para calibrar, some no cartão-ponto as HE feitas
entre 21h e 22h pelo grupo 12h–21h e informe o percentual. O painel também mostra o ponto de equilíbrio e cenários de 15/30/50%.
O grupo simulado hoje representa cerca de 12% das horas extras da filial.

## Conferência
A aba **Qualidade dos dados** compara os totais lidos por colaborador com o "Resumo dos Eventos" impresso na folha
(valores de HE, DSR e adicional noturno conferem ao centavo em agosto/2026). As horas por colaborador podem diferir
do resumo em menos de 1% por arredondamento de referência do relatório.

## Confidencialidade
O painel contém nomes e valores de folha. Guarde a pasta em local restrito.
