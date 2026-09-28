/* views.js – renderização de cada aba */
(function (G) {
  const V = {};
  const K = () => C.cores();
  const nome = (c) => U.esc(U.titulo(c.nome));
  const func = (c) => U.esc(U.titulo(c.funcao));

  const kpi = (rot, val, det, cls = "") => `<div class="card kpi ${cls}"><div class="rot">${rot}</div><div class="val num">${val}</div><div class="det">${det || ""}</div></div>`;
  const insight = (i) => `<div class="insight ${i.nivel}"><span class="tag">${U.esc(i.tema)}</span><h4>${U.esc(i.titulo)}</h4><p>${U.esc(i.texto)}</p></div>`;
  const semDados = () => `<div class="card vazio">Nenhum colaborador corresponde aos filtros selecionados.</div>`;

  // Ranking em formato de tabela: posição, colaborador (com função/área), barra proporcional e valor.
  const barList = (items, fmt, cor) => {
    const max = Math.max(...items.map((i) => i.v), 1);
    if (!items.length) return `<p class="sub">Sem ocorrências no período.</p>`;
    return `<table class="rk"><tbody>${items.map((i, n) => `<tr>
      <td class="rk-pos num">${n + 1}</td>
      <td class="rk-nome"><span>${U.esc(U.titulo(i.nome))}</span>${i.sub ? `<small>${U.esc(i.sub)}</small>` : ""}</td>
      <td class="rk-barra"><div><i style="width:${(i.v / max) * 100}%;background:${cor}"></i></div></td>
      <td class="rk-val num">${fmt(i.v)}</td></tr>`).join("")}</tbody></table>`;
  };

  // Nomes curtos de mês para colunas da tabela comparativa.
  const MES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  /*
   * Ordenação visual do comparativo mensal:
   * Jan/25, Jan/26, Fev/25, Fev/26...
   *
   * O objeto mensal continua preservando os dados originais.
   * Apenas a ordem de apresentação é alterada.
   */
  const ordenaMensalComparativo = (mensal) => {
    return [...mensal].sort((a, b) => {
      const [aa, ma] = String(a.mes).split("-").map(Number);
      const [ab, mb] = String(b.mes).split("-").map(Number);

      if (ma !== mb) return ma - mb;
      return aa - ab;
    });
  };

  // Retorna o label mês/ano para tabelas e gráficos.
  const mesAnoLabel = (mes) => {
    const partes = String(mes).split("-");
    if (partes.length < 2) return U.mesLabel(mes);

    const ano = Number(partes[0]);
    const numeroMes = Number(partes[1]);

    if (!numeroMes || numeroMes < 1 || numeroMes > 12) {
      return U.mesLabel(mes);
    }

    return `${MES_CURTO[numeroMes - 1]}/${String(ano).slice(-2)}`;
  };

  /*
   * Encontra o último mês cronológico disponível e o mês imediatamente anterior.
   * Isso é separado da ordem visual, pois o comparativo visual fica:
   * Jan/25, Jan/26, Fev/25, Fev/26...
   */
  const mesesCronologicos = (mensal) => {
    return [...mensal].sort((a, b) => String(a.mes).localeCompare(String(b.mes)));
  };

  /*
   * Gráfico mensal das barras de "mês a mês".
   * - Um único ano na seleção: mantém o formato de sempre (uma barra por mês, "Jan/26").
   * - Anos diferentes: os mesmos meses ficam agrupados lado a lado (Jan: 2025 | 2026, Fev: ...),
   *   com uma cor por ano derivada da cor do indicador (o ano mais recente usa a cor original).
   */
  const graficoMensal = (id, mensal, valor, { cor, fmt, tooltipFmt }) => {
    const anos = [...new Set(mensal.map((x) => String(x.mes).split("-")[0]))].sort();

    if (anos.length <= 1) {
      const ord = ordenaMensalComparativo(mensal);
      return C.barras(id, ord.map((x) => mesAnoLabel(x.mes)), ord.map(valor), { fmt, tooltipFmt, cor });
    }

    const nums = [...new Set(mensal.map((x) => +String(x.mes).split("-")[1]))].sort((a, b) => a - b);
    const cores = U.coresPorAno(cor, anos);

    const series = anos.map((a) => ({
      nome: a,
      cor: cores[a],
      borda: cor,
      dados: nums.map((n) => {
        const x = mensal.find((y) => y.mes === `${a}-${String(n).padStart(2, "0")}`);
        return x ? valor(x) : null;
      })
    }));

    return C.barrasAgrupadas(id, nums.map((n) => MES_CURTO[n - 1]), series, { fmt, tooltipFmt, comLegenda: true });
  };

  // Tabela "COMPARATIVO MENSAL — HE E DSR".
  const tabelaComparativoMensalHE = () => {
    const mensalOriginal = U.comparativoMensal();
    if (!mensalOriginal.length) return "";

    const mensal = ordenaMensalComparativo(mensalOriginal);
    const cronologico = mesesCronologicos(mensalOriginal);

    const uniHist = U.kpisHistoricos(U.dadosHistoricosFiltrados()).nComHE;

    const linhas = [
      { t: "HE 50%", f: (x) => x.he50_v, tipo: "money" },
      { t: "HE 100%", f: (x) => x.he100_v, tipo: "money" },
      { t: "HE 50% c/ BH", f: (x) => x.heBH_v, tipo: "money" },
      { t: "HE Total", f: (x) => x.heV, tipo: "money" },
      { t: "DSR sobre HE", f: (x) => x.dsr, tipo: "money" },
      { t: "HE + DSR", f: (x) => x.he, tipo: "money", dest: true },
      { t: "Horas de HE", f: (x) => x.heH, tipo: "h" },
      { t: "Colaboradores com HE", f: (x) => x.nComHE, tipo: "n", totalFixo: uniHist },
      { t: "Acima de 44h", f: (x) => x.acima, tipo: "n" },
    ];

    const fmt = (v, tipo) =>
      tipo === "money"
        ? U.brl(v)
        : tipo === "h"
          ? U.n1(v) + " h"
          : U.n0(v);

    /*
     * A VAR. usa os dois últimos meses cronológicos reais,
     * independentemente da ordem visual da tabela.
     */
    const ultimo = cronologico.length ? cronologico[cronologico.length - 1] : null;
    const penultimo = cronologico.length > 1 ? cronologico[cronologico.length - 2] : null;

    const head =
      `<th scope="col">Indicador</th>` +
      mensal.map((x) => `<th scope="col" class="n">${mesAnoLabel(x.mes)}</th>`).join("") +
      `<th scope="col" class="n">TOTAL</th><th scope="col" class="n"${ultimo && penultimo ? ` title="${U.esc(mesAnoLabel(ultimo.mes))} em relação a ${U.esc(mesAnoLabel(penultimo.mes))}"` : ""}>VAR.</th>`;

    const body = linhas.map((linha) => {
      const valores = mensal.map(linha.f);

      const total =
        linha.totalFixo != null
          ? linha.totalFixo
          : valores.reduce((a, b) => a + b, 0);

      const ult = ultimo ? linha.f(ultimo) : null;
      const penult = penultimo ? linha.f(penultimo) : null;

      const varHtml =
        ult != null && penult != null
          ? (U.delta(ult, penult) || "—")
          : "";

      return `<tr${linha.dest ? ' class="linha-dest"' : ""}>
        <td>${U.esc(linha.t)}</td>
        ${valores.map((v) => `<td class="n">${fmt(v, linha.tipo)}</td>`).join("")}
        <td class="n"><b>${fmt(total, linha.tipo)}</b></td>
        <td class="n">${varHtml}</td>
      </tr>`;
    }).join("");

    return `<div class="card">
      <h3>Comparativo mensal — HE e DSR</h3>
      <p class="sub">Valores somados por mês. HE Total = HE 50% + HE 100% + HE 50% c/ BH, sem DSR. Colaboradores com HE: total de colaboradores únicos. VAR. = último mês x mês anterior.</p>
      <div class="tabela-wrap tabela-mensal">
        <table>
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>`;
  };

  // ===================== VISÃO EXECUTIVA =====================
  V.exec = (view) => {
    const todos = U.state.mes === "TODOS";
    const L = U.dadosFiltrados();

    if (!L.length) {
      view.innerHTML = semDados();
      return;
    }

    const k = todos ? U.kpisHistoricos(L) : U.kpis(L), c = K();
    const ant = !todos ? U.mesAnterior() : null;
    const ka = ant ? U.kpis(U.dadosFiltrados(ant)) : null;
    const d = (a, b) => (ka ? U.delta(a, b) : "");
    const mDados = U.mesDados();

    const rawInsights = mDados && mDados.insights ? mDados.insights : [];
    const ins = rawInsights
      .filter((i) => i.nivel !== "info")
      .concat(rawInsights.filter((i) => i.nivel === "info"))
      .slice(0, 4);

    const mensalOriginal = U.comparativoMensal();
    const mensal = ordenaMensalComparativo(mensalOriginal);


    const mediaPeriodo =
      L.filter((x) => x.he_h > 0).length
        ? U.soma(L, "he_h") / L.filter((x) => x.he_h > 0).length
        : 0;

    view.innerHTML = `
      ${todos ? `<div class="card historico-head">
        <div>
          <h3>Visão consolidada do histórico</h3>
          <p class="sub">Acumulado de ${U.esc(U.periodoLabel())}, com os filtros de Área, Turno, Situação, Função e Busca aplicados.</p>
        </div>
        <span class="pill">${mensal.length} ${mensal.length === 1 ? "mês" : "meses"}</span>
      </div>` : ""}

      <div class="grid g-kpi">
        ${kpi("HE 50%", U.brl(k.he50_v) + d(k.he50_v, ka && ka.he50_v), `${U.n1(k.he50_h)} h${d(k.he50_h, ka && ka.he50_h)}`)}
        ${kpi("HE 100%", U.brl(k.he100_v) + d(k.he100_v, ka && ka.he100_v), `${U.n1(k.he100_h)} h${d(k.he100_h, ka && ka.he100_h)}`)}
        ${kpi("HE 50% c/ BH", U.brl(k.heBH_v) + d(k.heBH_v, ka && ka.heBH_v), `${U.n1(k.heBH_h)} h${d(k.heBH_h, ka && ka.heBH_h)}`)}
        ${kpi("DSR sobre HE", U.brl(k.dsr) + d(k.dsr, ka && ka.dsr), `DSR equivale a ${U.n1(k.heV ? (k.dsr / k.heV) * 100 : 0)}% da HE`)}
        ${kpi(`HE + DSR <span class="pill he">TOTAL</span>`, U.brl(k.he) + d(k.he, ka && ka.he), `${U.n0(k.heH)} h de HE${todos ? " no período" : " no mês"} · encargos estimados de ${U.brl(k.encargos)} não incluídos`, "dest")}
        ${kpi("Colaboradores com HE", `${k.nComHE} <span style="font-size:15px;color:var(--muted)">${todos ? "únicos" : `de ${k.n}`}</span>` + (!todos ? d(k.nComHE, ka && ka.nComHE) : ""), todos ? `Colaboradores únicos no período · média de ${U.n1(mediaPeriodo)} h de HE por colaborador` : `${U.pct(k.n ? (k.nComHE / k.n) * 100 : 0)} do quadro · média de ${U.n1(k.mediaHE)} h de HE por colaborador`)}
      </div>

      ${todos ? `
      <div class="grid g-2">
        <div class="card">
          <h3>Custo de HE + DSR — mês a mês</h3>
          <p class="sub">HE + DSR em R$, por mês.</p>
          <div class="chart"><canvas id="c-mensal-custo"></canvas></div>
        </div>

        <div class="card">
          <h3>Horas extras — mês a mês</h3>
          <p class="sub">Total de horas de HE, por mês.</p>
          <div class="chart"><canvas id="c-mensal-horas"></canvas></div>
        </div>
      </div>

      <div class="grid g-2">
        <div class="card">
          <h3>Colaboradores com HE — mês a mês</h3>
          <p class="sub">Colaboradores com HE, por mês.</p>
          <div class="chart"><canvas id="c-mensal-colab"></canvas></div>
        </div>

        <div class="card">
          <h3>Média de HE por colaborador — mês a mês</h3>
          <p class="sub">Horas de HE ÷ colaboradores com HE, por mês.</p>
          <div class="chart"><canvas id="c-mensal-media"></canvas></div>
        </div>
      </div>

      <div class="grid g-2">
        <div class="card">
          <h3>Acima de 44h — mês a mês</h3>
          <p class="sub">Colaboradores acima de 44 h de HE, por mês.</p>
          <div class="chart"><canvas id="c-mensal-acima"></canvas></div>
        </div>
      </div>` : `

      <div class="grid g-21">
        <div class="card">
          <h3>Presença ao longo do dia</h3>
          <p class="sub">Colaboradores presentes por hora, por tipo de jornada. Considera apenas horários confirmados na Base Mestra.</p>
          <div class="chart"><canvas id="c-dia"></canvas></div>
        </div>

        <div class="card">
          <h3>Custo de HE por área</h3>
          <p class="sub">HE + DSR por área.</p>
          <div class="chart"><canvas id="c-area"></canvas></div>
        </div>
      </div>

      <div class="grid g-2">
        <div class="card">
          <h3>HE média por colaborador, por turno</h3>
          <p class="sub">Média de horas de HE por colaborador no mês. Entre parênteses, o número de colaboradores do turno.</p>
          <div class="chart short"><canvas id="c-turno"></canvas></div>
        </div>

        <div class="card">
          <h3>Distribuição por faixa de HE</h3>
          <p class="sub">Colaboradores por faixa de horas de HE no mês.</p>
          <div class="chart short"><canvas id="c-faixa"></canvas></div>
        </div>
      </div>`}

      ${tabelaComparativoMensalHE()}

      ${ins.length ? `
      <div>
        <div class="secao" style="margin-bottom:10px">
          <h2>Pontos de atenção</h2>
          <p><a href="#" data-aba="problemas" style="color:var(--ink-3)">Ver todos os insights</a></p>
        </div>
        <div class="ins">${ins.map(insight).join("")}</div>
      </div>` : ""}
    `;

    if (todos) {
      graficoMensal("c-mensal-custo", mensalOriginal, (x) => Math.round(x.he), {
        fmt: (v) => U.brlK(v),
        tooltipFmt: (v) => U.brl0(v),
        cor: c.he
      });

      graficoMensal("c-mensal-horas", mensalOriginal, (x) => +x.heH.toFixed(1), {
        fmt: (v) => v + " h",
        cor: c.atual
      });

      graficoMensal("c-mensal-colab", mensalOriginal, (x) => x.nComHE, {
        fmt: (v) => v + " col.",
        cor: c.colab
      });

      graficoMensal("c-mensal-media", mensalOriginal, (x) => +x.mediaHE.toFixed(1), {
        fmt: (v) => v + " h",
        cor: c.medio
      });

      graficoMensal("c-mensal-acima", mensalOriginal, (x) => x.acima, {
        fmt: (v) => v + " col.",
        cor: c.alerta
      });

      return;
    }

    const cfgSim =
      mDados && mDados.colaboradores
        ? Sim.prepara(mDados.colaboradores)
        : { horarios_que_migram: [] };

    const cob = U.cobertura(L, "atual", cfgSim);
    const c2 = K();

    C.multi(
      "c-dia",
      cob.map((x) => x.h + "h"),
      [
        {
          nome: "Comercial",
          dados: cob.map((x) => x.comercial),
          cor: c2.atual
        },
        {
          nome: "Tarde",
          dados: cob.map((x) => x.migra + x.tarde),
          cor: c2.he
        },
        {
          nome: "Parcial",
          dados: cob.map((x) => x.parcial),
          cor: U.css("--faint")
        }
      ],
      { empilhado: true }
    );

    const porArea = U.agrupa(L, "area").sort((a, b) => b.he - a.he);

    C.multi(
      "c-area",
      porArea.map((g) => g.chave),
      [
        {
          nome: "HE",
          dados: porArea.map((g) => Math.round(g.heV)),
          cor: c2.he
        },
        {
          nome: "DSR",
          dados: porArea.map((g) => Math.round(g.dsr)),
          cor: c2.ink3
        }
      ],
      {
        empilhado: true,
        horizontal: true,
        fmt: (v) => U.brlK(v)
      }
    );

    const porTurno = U.agrupa(L, "turno");

    C.barras(
      "c-turno",
      porTurno.map((g) => `${g.chave} (${g.n})`),
      porTurno.map((g) => +g.mediaH.toFixed(1)),
      {
        fmt: (v) => v + " h",
        cor: c2.atual
      }
    );

    const faixas = [
      ["Sem HE", 0, 0],
      ["Até 20 h", 0.01, 20],
      ["20–40 h", 20.01, 40],
      ["40–60 h", 40.01, 60],
      ["Acima de 60 h", 60.01, 1e9]
    ];

    C.barras(
      "c-faixa",
      faixas.map((f) => f[0]),
      faixas.map((f) =>
        L.filter((x) => x.he_h >= f[1] && x.he_h <= f[2]).length
      ),
      {
        cores: [
          c2.line,
          c2.he + "99",
          c2.he,
          c2.medio,
          c2.alerta
        ],
        fmt: (v) => v + " col."
      }
    );
  };

  // ===================== HORAS EXTRAS =====================
  V.he = (view) => {
    const L0 = U.dadosFiltrados();

    if (!L0.length) {
      view.innerHTML = semDados();
      return;
    }

    // Com MÊS = TODOS, L0 traz um registro por colaborador/mês; consolida por matrícula
    // para os gráficos e a tabela não repetirem a mesma pessoa uma vez por mês.
    const L =
      U.state.mes === "TODOS"
        ? U.consolidaColaboradores(L0)
        : L0;

    const c = K();
    const t = (f) => U.soma(L, f);

    view.innerHTML = `
      <div class="grid g-3">
        <div class="card">
          <h3>Composição do custo</h3>
          <p class="sub">HE 50% (banco), HE 50%, HE 100% e DSR sobre HE.</p>
          <div class="chart"><canvas id="c-comp"></canvas></div>
        </div>

        <div class="card" style="grid-column:span 2">
          <h3>Horas x custo por colaborador</h3>
          <p class="sub">Cada ponto é um colaborador: horas de HE no eixo horizontal e custo HE + DSR no vertical.</p>
          <div class="chart"><canvas id="c-disp"></canvas></div>
        </div>
      </div>

      <div class="grid g-2">
        <div class="card">
          <h3>Custo de HE por função</h3>
          <p class="sub">HE + DSR das 10 funções de maior custo.</p>
          <div class="chart tall"><canvas id="c-func"></canvas></div>
        </div>

        <div class="card">
          <h3>Horas de HE por tipo</h3>
          <p class="sub">Horas por tipo de HE: 50% (banco), 50% e 100%.</p>
          <div class="chart tall"><canvas id="c-tipo"></canvas></div>
        </div>
      </div>

      <div class="card">
        <h3>Detalhe por colaborador</h3>
        <p class="sub">Clique no título da coluna para ordenar.</p>
        <div id="t-he"></div>
      </div>`;

    C.rosca(
      "c-comp",
      ["HE 50% (banco)", "HE 50%", "HE 100%", "DSR sobre HE"],
      [t("he_bh_v"), t("he50_v"), t("he100_v"), t("dsr_he")].map((v) =>
        Math.round(v)
      ),
      [c.he, c.medio, c.alerta, c.ink3],
      (v) => U.brl0(v)
    );

    C.dispersao(
      "c-disp",
      L.filter((x) => x.he_h > 0).map((x) => ({
        x: x.he_h,
        y: x.he_total,
        nome: U.titulo(x.nome)
      })),
      {
        xt: "Horas de HE no período",
        yt: "Custo HE + DSR"
      }
    );

    const pf = U.agrupa(L, "funcao")
      .sort((a, b) => b.he - a.he)
      .slice(0, 10);

    C.barras(
      "c-func",
      pf.map((g) => U.titulo(g.chave)),
      pf.map((g) => Math.round(g.he)),
      {
        horizontal: true,
        fmt: (v) => U.brlK(v),
        tooltipFmt: (v) => U.brl0(v),
        cor: c.he
      }
    );

    C.barras(
      "c-tipo",
      ["50% (banco)", "50%", "100%"],
      [t("he_bh_h"), t("he50_h"), t("he100_h")].map((v) =>
        +v.toFixed(1)
      ),
      {
        fmt: (v) => v + " h",
        cores: [c.he, c.medio, c.alerta]
      }
    );

    V.tabelaHE(L);
  };

  V.tabelaHE = (L) => {
    L =
      L ||
      (U.state.mes === "TODOS"
        ? U.consolidaColaboradores(U.dadosFiltrados())
        : U.dadosFiltrados());

    const el = document.getElementById("t-he");

    if (!el) return;

    el.innerHTML = U.tabela(
      "he",
      [
        { k: "nome", t: "Colaborador", f: nome },
        { k: "funcao", t: "Função", f: func },
        { k: "area", t: "Área" },
        {
          k: "turno",
          t: "Turno",
          f: (x) => `<span class="pill">${U.esc(x.turno)}</span>`
        },
        {
          k: "he_h",
          t: "HE (h)",
          n: 1,
          f: (x) => U.n1(x.he_h)
        },
        {
          k: "he_bh_v",
          t: "50% banco",
          n: 1,
          f: (x) => U.brl(x.he_bh_v)
        },
        {
          k: "he50_v",
          t: "50%",
          n: 1,
          f: (x) => U.brl(x.he50_v)
        },
        {
          k: "he100_v",
          t: "100%",
          n: 1,
          f: (x) => U.brl(x.he100_v)
        },
        {
          k: "dsr_he",
          t: "DSR",
          n: 1,
          f: (x) => U.brl(x.dsr_he)
        },
        {
          k: "he_total",
          t: "Total",
          n: 1,
          f: (x) => `<b>${U.brl(x.he_total)}</b>`
        },
        {
          k: "he_pct_salario",
          t: "% do salário",
          n: 1,
          f: (x) => U.pct(x.he_pct_salario)
        },
        {
          k: "acima_limite",
          t: "Limite",
          v: (x) => (x.acima_limite ? 1 : 0),
          f: (x) =>
            x.acima_limite
              ? '<span class="pill warn">acima</span>'
              : '<span class="pill ok">ok</span>'
        }
      ],
      L,
      { sortKey: "he_total" }
    );
  };

  // ===================== CUSTOS =====================
  V.custos = (view) => {
    const L = U.dadosFiltrados();

    if (!L.length) {
      view.innerHTML = semDados();
      return;
    }

    const k = U.kpis(L), c = K();
    const noturno = U.soma(L, "noturno_v");

    view.innerHTML = `
      <div class="grid g-kpi">
        ${kpi("HE Total (sem DSR)", U.brl(k.heV), `${U.n0(k.heH)} h · mesmo valor da linha "HE Total" do comparativo mensal`)}
        ${kpi("DSR sobre HE", U.brl(k.dsr), `DSR equivale a ${U.n1(k.heV ? (k.dsr / k.heV) * 100 : 0)}% da HE`)}
        ${kpi("Encargos estimados", U.brl(k.encargos), `${G.DADOS.config.regras.encargos_sobre_he_pct}% sobre HE + DSR`)}
        ${kpi(`Custo total de HE <span class="pill he">TOTAL</span>`, U.brl(k.he + k.encargos), "HE + DSR + encargos estimados. O card \"HE + DSR\" da Visão executiva não inclui encargos.", "dest")}
        ${kpi("Adicional noturno", U.brl0(noturno), "Adicional noturno, hora reduzida e DSR noturno")}
        ${kpi("HE / remuneração bruta", U.pct(k.pctRem), `Base: remuneração bruta de ${U.brl0(k.rem)}, sem rescisões e 13º adiantado`)}
      </div>

      <div class="grid g-2">
        <div class="card">
          <h3>HE como % da remuneração, por área</h3>
          <p class="sub">HE + DSR sobre a remuneração bruta de cada área.</p>
          <div class="chart"><canvas id="c-pct"></canvas></div>
        </div>

        <div class="card">
          <h3>Custo médio por hora de HE</h3>
          <p class="sub">HE + DSR ÷ horas de HE, por área.</p>
          <div class="chart"><canvas id="c-ch"></canvas></div>
        </div>
      </div>

      <div class="card">
        <h3>Custo por função</h3>
        <p class="sub">Clique no título da coluna para ordenar.</p>
        <div id="t-func"></div>
      </div>`;

    const pa = U.agrupa(L, "area").sort((a, b) => b.pctRem - a.pctRem);

    C.barras(
      "c-pct",
      pa.map((g) => g.chave),
      pa.map((g) => +g.pctRem.toFixed(1)),
      {
        fmt: (v) => v + "%",
        cor: c.he
      }
    );

    C.barras(
      "c-ch",
      pa.map((g) => g.chave),
      pa.map((g) => +(g.heH ? g.he / g.heH : 0).toFixed(2)),
      {
        fmt: (v) => "R$ " + v,
        cor: c.atual
      }
    );

    const pf = U.agrupa(L, "funcao");

    document.getElementById("t-func").innerHTML = U.tabela(
      "func",
      [
        {
          k: "chave",
          t: "Função",
          f: (x) => U.esc(U.titulo(x.chave))
        },
        { k: "n", t: "Colab.", n: 1 },
        {
          k: "heH",
          t: "HE (h)",
          n: 1,
          f: (x) => U.n1(x.heH)
        },
        {
          k: "mediaH",
          t: "Média h/colab.",
          n: 1,
          f: (x) => U.n1(x.mediaH)
        },
        {
          k: "heV",
          t: "HE",
          n: 1,
          f: (x) => U.brl(x.heV)
        },
        {
          k: "dsr",
          t: "DSR",
          n: 1,
          f: (x) => U.brl(x.dsr)
        },
        {
          k: "he",
          t: "Total",
          n: 1,
          f: (x) => `<b>${U.brl(x.he)}</b>`
        },
        {
          k: "pctRem",
          t: "% remuneração",
          n: 1,
          f: (x) => U.pct(x.pctRem)
        }
      ],
      pf,
      { sortKey: "he" }
    );
  };

  // ===================== JORNADAS =====================
  V.jornadas = (view) => {
    const L = U.dadosFiltrados();

    if (!L.length) {
      view.innerHTML = semDados();
      return;
    }

    const c = K(), mDados = U.mesDados();

    const cfgSim =
      mDados && mDados.colaboradores
        ? Sim.prepara(mDados.colaboradores)
        : { horarios_que_migram: [] };

    const pend = L.filter(
      (x) => !x.horario_definido && x.situacao !== "Demitido"
    );

    view.innerHTML = `
      <div class="grid g-2">
        <div class="card">
          <h3>Colaboradores por horário</h3>
          <p class="sub">Somente horários confirmados na Base Mestra.</p>
          <div class="chart"><canvas id="c-hor"></canvas></div>
        </div>

        <div class="card">
          <h3>HE média por horário</h3>
          <p class="sub">Horas de HE por colaborador no período.</p>
          <div class="chart"><canvas id="c-hormed"></canvas></div>
        </div>
      </div>

      <div class="card">
        <h3>Presença ao longo do dia</h3>
        <p class="sub">Colaboradores por hora conforme a jornada cadastrada, sem desconto de intervalos. Inclui as situações Trabalhando e Férias com horário confirmado.</p>
        <div class="chart"><canvas id="c-cobj"></canvas></div>
      </div>

      <div class="card">
        <h3>Resumo por horário</h3>
        <div id="t-hor"></div>
      </div>

      ${pend.length ? `<div class="aviso"><b>${pend.length} registros sem horário confirmado</b>, excluídos dos gráficos e da tabela de horários.</div>` : ""}
    `;

    const def = L.filter((x) => x.horario_definido);
    const ph = U.agrupa(def, "horario").sort((a, b) => b.n - a.n);

    C.barras(
      "c-hor",
      ph.map((g) => g.chave),
      ph.map((g) => g.n),
      {
        fmt: (v) => v + " col.",
        cor: c.atual
      }
    );

    C.barras(
      "c-hormed",
      ph.map((g) => g.chave),
      ph.map((g) => +g.mediaH.toFixed(1)),
      {
        fmt: (v) => v + " h",
        cor: c.he
      }
    );

    const cob = U.cobertura(L, "atual", cfgSim);

    C.multi(
      "c-cobj",
      cob.map((x) => x.h + "h"),
      [
        {
          nome: "Comercial",
          dados: cob.map((x) => x.comercial),
          cor: c.atual
        },
        {
          nome: "Tarde (12h–21h)",
          dados: cob.map((x) => x.migra + x.tarde),
          cor: c.he
        },
        {
          nome: "Parcial",
          dados: cob.map((x) => x.parcial),
          cor: U.css("--faint")
        }
      ],
      {
        empilhado: true
      }
    );

    document.getElementById("t-hor").innerHTML = U.tabela(
      "hor",
      [
        { k: "chave", t: "Horário" },
        { k: "n", t: "Colab.", n: 1 },
        {
          k: "heH",
          t: "HE (h)",
          n: 1,
          f: (x) => U.n1(x.heH)
        },
        {
          k: "mediaH",
          t: "Média h/colab.",
          n: 1,
          f: (x) => U.n1(x.mediaH)
        },
        {
          k: "he",
          t: "Custo HE + DSR",
          n: 1,
          f: (x) => U.brl(x.he)
        },
        {
          k: "acima",
          t: "Acima do limite",
          n: 1
        }
      ],
      ph,
      {
        sortKey: "n"
      }
    );
  };

  // ===================== RANKINGS =====================
  V.rankings = (view) => {
    const L0 = U.dadosFiltrados();

    if (!L0.length) {
      view.innerHTML = semDados();
      return;
    }

    // Com MÊS = TODOS, L0 tem um registro por colaborador/mês; consolida por matrícula
    // para que cada pessoa apareça uma vez, com os totais do período filtrado.
    const L =
      U.state.mes === "TODOS"
        ? U.consolidaColaboradores(L0)
        : L0;

    const c = K();

    const top = (arr, f, n = 10) =>
      [...arr]
        .filter((x) => f(x) > 0)
        .sort((a, b) => f(b) - f(a))
        .slice(0, n)
        .map((x) => ({
          nome: x.nome,
          v: f(x),
          sub: [
            x.funcao ? U.titulo(x.funcao) : "",
            x.area || ""
          ].filter(Boolean).join(" · ")
        }));

    const fg = U.agrupa(
      L.filter((x) => x.situacao !== "Demitido"),
      "funcao"
    )
      .filter((g) => g.n >= 2)
      .sort((a, b) => b.mediaH - a.mediaH)
      .slice(0, 10)
      .map((g) => ({
        nome: `${g.chave} (${g.n})`,
        v: g.mediaH
      }));

    view.innerHTML = `
      <div class="grid g-2">

        <div class="card">
          <h3>Maior custo de HE</h3>
          <p class="sub">HE + DSR no período.</p>
          ${barList(top(L, (x) => x.he_total), U.brl0, c.atual)}
        </div>

        <div class="card">
          <h3>Mais horas extras</h3>
          <p class="sub">Horas de HE no período.</p>
          ${barList(top(L, (x) => x.he_h), (v) => U.n1(v) + " h", c.atual)}
        </div>

        <div class="card">
          <h3>Maior impacto da HE sobre o salário</h3>
          <p class="sub">HE + DSR como % do salário base.</p>
          ${barList(top(L, (x) => x.he_pct_salario), (v) => U.n1(v) + "%", c.atual)}
        </div>

        <div class="card">
          <h3>Funções com maior média de HE</h3>
          <p class="sub">Média de horas de HE por colaborador. Somente funções com 2 ou mais colaboradores.</p>
          ${barList(fg, (v) => U.n1(v) + " h", c.atual)}
        </div>

        <div class="card">
          <h3>Maior volume de atrasos</h3>
          <p class="sub">Horas de atraso e saída antecipada.</p>
          ${barList(top(L, (x) => x.atrasos_h), (v) => U.n1(v) + " h", c.atual)}
        </div>

        <div class="card">
          <h3>Maior volume de faltas</h3>
          <p class="sub">Horas de falta descontadas.</p>
          ${barList(top(L, (x) => x.faltas_h), (v) => U.n1(v) + " h", c.muted)}
        </div>

      </div>`;
  };

  // ===================== PROBLEMAS =====================
  V.problemas = (view) => {
    const m = U.mesDados(), L = U.dadosFiltrados();
    const acima = L.filter((x) => x.acima_limite);
    const rawInsights = m && m.insights ? m.insights : [];

    view.innerHTML = `
      <div>
        <div class="secao" style="margin-bottom:10px">
          <h2>Insights automáticos</h2>
          <p>Calculados a partir da folha do mês selecionado.</p>
        </div>

        <div class="ins">
          ${rawInsights.length
            ? rawInsights.map(insight).join("")
            : '<p class="sub">Os insights são calculados por mês. Selecione um único mês no filtro superior.</p>'}
        </div>
      </div>

      <div class="card">
        <h3>Ocorrências acima de ${G.DADOS.config.regras.limite_he_mes_horas} h de HE no período</h3>
        <p class="sub">Excesso medido sobre o limite de ${G.DADOS.config.regras.limite_he_mes_horas} h/mês.</p>
        <div id="t-acima"></div>
      </div>`;

    document.getElementById("t-acima").innerHTML = U.tabela(
      "acima",
      [
        { k: "nome", t: "Colaborador", f: nome },
        { k: "funcao", t: "Função", f: func },
        { k: "turno", t: "Turno" },
        {
          k: "he_h",
          t: "HE (h)",
          n: 1,
          f: (x) => U.n1(x.he_h)
        },
        {
          k: "exc",
          t: "Acima do limite (h)",
          n: 1,
          v: (x) =>
            x.he_h -
            G.DADOS.config.regras.limite_he_mes_horas,
          f: (x) =>
            U.n1(
              x.he_h -
              G.DADOS.config.regras.limite_he_mes_horas
            )
        },
        {
          k: "he_total",
          t: "Custo HE + DSR",
          n: 1,
          f: (x) => U.brl(x.he_total)
        }
      ],
      acima,
      {
        sortKey: "he_h"
      }
    );
  };

  // ===================== SIMULAÇÃO =====================
  V.simulacao = (view) => {
    if (U.state.mes === "TODOS") {
      view.innerHTML = `<div class="card vazio">A simulação usa os dados de um único mês. Selecione um mês no filtro superior.</div>`;
      return;
    }

    Sim.render(view);
  };

  // ===================== QUALIDADE =====================
  V.qualidade = (view) => {
    const m = U.mesDados();

    if (U.state.mes === "TODOS" || !m || !m.qualidade) {
      view.innerHTML = `<div class="card vazio">A conferência de dados é feita por mês. Selecione um único mês no filtro superior.</div>`;
      return;
    }

    const q = m.qualidade;

    const lista = (arr) =>
      arr && arr.length
        ? `<ul class="lista">${arr.map((x) =>
            `<li>${U.esc(typeof x === "string" ? x : JSON.stringify(x))}</li>`
          ).join("")}</ul>`
        : '<p class="sub">Nenhuma ocorrência.</p>';

    view.innerHTML = `
      <div class="grid g-2">

        <div class="card">
          <h3>Conferência com o resumo da folha</h3>

          <p class="sub">
            Soma por colaborador no PDF x total do "Resumo dos Eventos".
            Status geral:
            <span class="pill ${q.reconciliacao_ok ? "ok" : "warn"}">
              ${q.reconciliacao_ok ? "conferido" : "divergente"}
            </span>
          </p>

          <div class="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Evento</th>
                  <th scope="col" class="n">Colaboradores</th>
                  <th scope="col" class="n">Resumo</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                ${q.reconciliacao.map((r) =>
                  `<tr>
                    <td>${U.esc(r.evento)}</td>
                    <td class="n">${U.brl(r.valor_colaboradores)}</td>
                    <td class="n">${U.brl(r.valor_resumo)}</td>
                    <td>
                      <span class="pill ${r.ok_valor ? "ok" : "warn"}">
                        ${r.ok_valor ? "ok" : "diferente"}
                      </span>
                    </td>
                  </tr>`
                ).join("")}
              </tbody>
            </table>
          </div>

          <p class="rodape-nota" style="margin-top:8px">
            ${U.esc(q.nota_horas)}
          </p>
        </div>

        <div class="card">
          <h3>Fontes desta carga</h3>

          <ul class="lista">
            <li>
              Folha:
              <b>${U.esc(m.fonte.folha)}</b>
              (${U.esc(m.periodo.inicio)} a ${U.esc(m.periodo.fim)})
            </li>

            <li>
              Base Mestra:
              <b>${U.esc(m.fonte.base_mestra)}</b>
              (aba ${U.esc(m.fonte.aba)})
            </li>

            <li>
              Gerado em:
              <b>${U.esc(m.gerado_em)}</b>
            </li>

            <li>
              Colaboradores na folha:
              <b>${q.colaboradores_folha}</b>
              · na Base Mestra:
              <b>${q.colaboradores_base}</b>
            </li>

            <li>
              Situações:
              ${Object.entries(q.situacoes)
                .map(([k, v]) => `${U.esc(k)}:${v}`)
                .join(" · ")}
            </li>
          </ul>
        </div>

      </div>

      <div class="grid g-2">

        <div class="card">
          <h3>Horários pendentes (${q.horarios_pendentes.length})</h3>
          <p class="sub">Horários não cadastrados na Base Mestra. Confirmar no cartão-ponto.</p>
          ${lista(q.horarios_pendentes.map(U.titulo))}
        </div>

        <div class="card">
          <h3>Cruzamento folha x Base Mestra</h3>

          <p class="sub">Na folha e fora da Base Mestra:</p>
          ${lista(q.sem_base)}

          <p class="sub">Na Base Mestra e fora da folha:</p>
          ${lista(q.sem_folha)}

          <p class="sub">Salário divergente entre folha e Base Mestra:</p>
          ${lista(
            q.salario_divergente.map(
              (x) =>
                `${x.nome}: folha ${U.brl(x.folha)} x Base Mestra ${U.brl(x.base)}`
            )
          )}
        </div>

      </div>

      <div class="card">
        <h3>Matrícula x "F. Reg." da folha (${q.matricula_x_freg.length})</h3>
        <p class="sub">
          O cruzamento com a Base Mestra é feito pelo nome. Os registros abaixo têm F. Reg.
          diferente da matrícula; informação para conferência.
        </p>
        ${lista(
          q.matricula_x_freg.map(
            (x) =>
              `${U.titulo(x.nome)}: matrícula ${x.matricula} · F.Reg ${x.f_reg}`
          )
        )}
      </div>`;
  };

  // Expõe as views.
  G.V = V;

})(window);