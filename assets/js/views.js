/* views.js – renderização de cada aba */
(function (G) {
  const V = {};
  const K = () => C.cores();
  const nome = (c) => U.esc(U.titulo(c.nome));
  const func = (c) => U.esc(U.titulo(c.funcao));

  const kpi = (rot, val, det, cls = "") => `<div class="card kpi ${cls}"><div class="rot">${rot}</div><div class="val num">${val}</div><div class="det">${det || ""}</div></div>`;
  const insight = (i) => `<div class="insight ${i.nivel}"><span class="tag">${U.esc(i.tema)}</span><h4>${U.esc(i.titulo)}</h4><p>${U.esc(i.texto)}</p></div>`;
  const semDados = () => `<div class="card vazio">Nenhum colaborador corresponde aos filtros selecionados.</div>`;

  const barList = (items, fmt, cor) => {
    const max = Math.max(...items.map((i) => i.v), 1);
    return `<div>${items.map((i, n) => `<div style="display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid var(--line-2)">
      <span class="rodape-nota num">${n + 1}</span>
      <div style="min-width:0"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px">${U.esc(U.titulo(i.nome))}</div>
      <div style="height:5px;background:var(--line-2);border-radius:3px;margin-top:3px"><div style="height:5px;width:${(i.v / max) * 100}\%;background:${cor};border-radius:3px"></div></div></div>
      <b class="num" style="font-size:13px">${fmt(i.v)}</b></div>`).join("")}</div>`;
  };

  // Nomes curtos de mês para colunas da tabela comparativa (independe de locale).
  const MES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  // Tabela "COMPARATIVO MENSAL — HE E DSR": indicadores nas linhas, meses do Ano selecionado nas colunas,
  // TOTAL do período e VAR. (último mês disponível vs. anterior). Usa U.comparativoMensal(), que já
  // respeita o filtro de Ano (nunca mistura anos) e os demais filtros (área/turno/situação/função/busca).
  const tabelaComparativoMensalHE = () => {
    const mensal = U.comparativoMensal();
    if (!mensal.length) return "";
    const uniHist = U.kpisHistoricos(U.dadosHistoricosFiltrados()).nComHE; // colaboradores únicos no Ano filtrado
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
    const fmt = (v, tipo) => tipo === "money" ? U.brl(v) : tipo === "h" ? U.n1(v) + " h" : U.n0(v);
    const head = `<th>Indicador</th>` + mensal.map((x) => `<th class="n">${MES_CURTO[+x.mes.split("-")[1] - 1]}</th>`).join("") + `<th class="n">TOTAL</th><th class="n">VAR.</th>`;
    const body = linhas.map((linha) => {
      const valores = mensal.map(linha.f);
      const total = linha.totalFixo != null ? linha.totalFixo : valores.reduce((a, b) => a + b, 0);
      const ult = valores[valores.length - 1], penult = valores.length > 1 ? valores[valores.length - 2] : null;
      const varHtml = penult != null ? (U.delta(ult, penult) || "—") : "";
      return `<tr${linha.dest ? ' class="linha-dest"' : ""}><td>${U.esc(linha.t)}</td>` +
        valores.map((v) => `<td class="n">${fmt(v, linha.tipo)}</td>`).join("") +
        `<td class="n"><b>${fmt(total, linha.tipo)}</b></td><td class="n">${varHtml}</td></tr>`;
    }).join("");
    return `<div class="card"><h3>Comparativo mensal — HE e DSR</h3>
      <p class="sub">Soma por mês, conforme os filtros selecionados (nunca mistura anos). HE Total = HE 50% + HE 100% + HE 50% c/ BH, sem DSR. VAR. compara o último mês disponível com o anterior.</p>
      <div class="tabela-wrap tabela-mensal"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></div>`;
  };

  // ===================== VISÃO EXECUTIVA =====================
  V.exec = (view) => {
    const todos = U.state.mes === "TODOS";
    const L = U.dadosFiltrados();
    if (!L.length) { view.innerHTML = semDados(); return; }
    
    const k = todos ? U.kpisHistoricos(L) : U.kpis(L), c = K();
    const ant = !todos ? U.mesAnterior() : null, ka = ant ? U.kpis(U.dadosFiltrados(ant)) : null;
    const d = (a, b) => (ka ? U.delta(a, b) : "");
    const mDados = U.mesDados();
    
    const rawInsights = mDados && mDados.insights ? mDados.insights : [];
    const ins = rawInsights.filter((i) => i.nivel !== "info").concat(rawInsights.filter((i) => i.nivel === "info")).slice(0, 4);
    
    const mensal = U.comparativoMensal();
    const labels = mensal.map((x) => U.mesLabel(x.mes));
    const mediaPeriodo = L.filter((x) => x.he_h > 0).length ? U.soma(L, "he_h") / L.filter((x) => x.he_h > 0).length : 0;

    view.innerHTML = `
      ${todos ? `<div class="card historico-head"><div><h3>Visão consolidada do histórico</h3><p class="sub">Totais acumulados dos meses do ano selecionado. Os filtros de Área, Turno, Situação, Função e Busca são aplicados ao período inteiro.</p></div><span class="pill">${mensal.length} mês(es)</span></div>` : ""}
      <div class="grid g-kpi">
        ${kpi("HE 50%", U.brl(k.he50_v) + d(k.he50_v, ka && ka.he50_v), `${U.n1(k.he50_h)} h${d(k.he50_h, ka && ka.he50_h)}`)}
        ${kpi("HE 100%", U.brl(k.he100_v) + d(k.he100_v, ka && ka.he100_v), `${U.n1(k.he100_h)} h${d(k.he100_h, ka && ka.he100_h)}`)}
        ${kpi("HE 50% c/ BH", U.brl(k.heBH_v) + d(k.heBH_v, ka && ka.heBH_v), `${U.n1(k.heBH_h)} h${d(k.heBH_h, ka && ka.heBH_h)}`)}
        ${kpi("DSR sobre HE", U.brl(k.dsr) + d(k.dsr, ka && ka.dsr), `${U.n1(k.heV ? (k.dsr / k.heV) * 100 : 0)}% de reflexo sobre a HE`)}
        ${kpi(`HE + DSR <span class="pill he">TOTAL</span>`, U.brl(k.he) + d(k.he, ka && ka.he), `${U.n0(k.heH)} h de HE${todos ? " no período" : " no mês"} (sem encargos) · encargos est. ${U.brl(k.encargos)}`, "dest")}
        ${kpi("Colaboradores com HE", `${k.nComHE} <span style="font-size:15px;color:var(--muted)">${todos ? "únicos" : `de ${k.n}`}</span>` + (!todos ? d(k.nComHE, ka && ka.nComHE) : ""), todos ? `Únicos no período · média ${U.n1(mediaPeriodo)} h por colaborador com HE` : `${U.pct(k.n ? (k.nComHE / k.n) * 100 : 0)} do quadro · média ${U.n1(k.mediaHE)} h`)}
      </div>

      ${todos ? `<div class="grid g-2">
        <div class="card"><h3>Custo de HE + DSR — mês a mês</h3><p class="sub">Comparativo mensal conforme os filtros selecionados.</p><div class="chart"><canvas id="c-mensal-custo"></canvas></div></div>
        <div class="card"><h3>Horas extras — mês a mês</h3><p class="sub">Evolução mensal das horas extras.</p><div class="chart"><canvas id="c-mensal-horas"></canvas></div></div>
      </div>
      <div class="grid g-2">
        <div class="card"><h3>Colaboradores com HE — mês a mês</h3><p class="sub">Quantidade de colaboradores com HE em cada mês.</p><div class="chart"><canvas id="c-mensal-colab"></canvas></div></div>
        <div class="card"><h3>Média de HE por colaborador — mês a mês</h3><p class="sub">Média de horas extras entre os colaboradores que tiveram HE em cada mês.</p><div class="chart"><canvas id="c-mensal-media"></canvas></div></div>
      </div>
      <div class="grid g-2">
        <div class="card"><h3>Acima de 44h — mês a mês</h3><p class="sub">Quantidade de ocorrências mensais acima da referência de 44h.</p><div class="chart"><canvas id="c-mensal-acima"></canvas></div></div>
      </div>` : `
      <div class="grid g-21">
        <div class="card"><h3>O dia da filial</h3>
          <p class="sub">Colaboradores presentes por hora, por tipo de jornada (somente horários já confirmados). Onde a linha cai, a operação depende de horas extras ou de menos gente.</p>
          <div class="chart"><canvas id="c-dia"></canvas></div></div>
        <div class="card"><h3>Custo de HE por área</h3><p class="sub">Inclui DSR.</p><div class="chart"><canvas id="c-area"></canvas></div></div>
      </div>

      <div class="grid g-2">
        <div class="card"><h3>HE média por colaborador, por turno</h3><p class="sub">Horas por pessoa no mês.</p><div class="chart short"><canvas id="c-turno"></canvas></div></div>
        <div class="card"><h3>Distribuição por faixa de HE</h3><p class="sub">Quantos colaboradores em cada faixa de horas extras no mês.</p><div class="chart short"><canvas id="c-faixa"></canvas></div></div>
      </div>`}

      ${tabelaComparativoMensalHE()}

      ${ins.length ? `<div><div class="secao" style="margin-bottom:10px">2>O que merece atenção</h2><p><a href="#" data-aba="problemas" style="color:var(--ink-3)">Ver todos os insights</a></p></div>
        <div class="ins">${ins.map(insight).join("")}</div></div>` : ""}`;

    if (todos) {
      C.barras("c-mensal-custo", labels, mensal.map((x) => Math.round(x.he)), { fmt: (v) => U.brlK(v), tooltipFmt: (v) => U.brl0(v), cor: c.he });
      C.barras("c-mensal-horas", labels, mensal.map((x) => +x.heH.toFixed(1)), { fmt: (v) => v + " h", cor: c.atual });
      C.barras("c-mensal-colab", labels, mensal.map((x) => x.nComHE), { fmt: (v) => v + " col.", cor: c.colab });
      C.barras("c-mensal-media", labels, mensal.map((x) => +x.mediaHE.toFixed(1)), { fmt: (v) => v + " h", cor: c.medio });
      C.barras("c-mensal-acima", labels, mensal.map((x) => x.acima), { fmt: (v) => v + " col.", cor: c.alerta });
      return;
    }

    const cfgSim = mDados && mDados.colaboradores ? Sim.prepara(mDados.colaboradores) : { horarios_que_migram: [] };
    const cob = U.cobertura(L, "atual", cfgSim), c2 = K();
    C.multi("c-dia", cob.map((x) => x.h + "h"), [
      { nome: "Comercial", dados: cob.map((x) => x.comercial), cor: c2.atual },
      { nome: "Tarde", dados: cob.map((x) => x.migra + x.tarde), cor: c2.he },
      { nome: "Parcial", dados: cob.map((x) => x.parcial), cor: U.css("--faint") },
    ], { empilhado: true });

    const porArea = U.agrupa(L, "area").sort((a, b) => b.he - a.he);
    C.multi("c-area", porArea.map((g) => g.chave), [
      { nome: "HE", dados: porArea.map((g) => Math.round(g.heV)), cor: c2.he },
      { nome: "DSR", dados: porArea.map((g) => Math.round(g.dsr)), cor: c2.ink3 },
    ], { empilhado: true, horizontal: true, fmt: (v) => U.brlK(v) });

    const porTurno = U.agrupa(L, "turno");
    C.barras("c-turno", porTurno.map((g) => `${g.chave} (${g.n})`), porTurno.map((g) => +g.mediaH.toFixed(1)), { fmt: (v) => v + " h", cor: c2.atual });

    const faixas = [["Sem HE", 0, 0], ["Até 20 h", 0.01, 20], ["20–40 h", 20.01, 40], ["40–60 h", 40.01, 60], ["Acima de 60 h", 60.01, 1e9]];
    C.barras("c-faixa", faixas.map((f) => f[0]), faixas.map((f) => L.filter((x) => x.he_h >= f[1] && x.he_h <= f[2]).length),
      { cores: [c2.line, c2.he + "99", c2.he, c2.medio, c2.alerta], fmt: (v) => v + " col." });
  };

  // ===================== HORAS EXTRAS =====================
  V.he = (view) => {
    const L0 = U.dadosFiltrados();
    if (!L0.length) { view.innerHTML = semDados(); return; }
    // Com MÊS = TODOS, L0 traz um registro por colaborador/mês; consolida por matrícula
    // para os gráficos e a tabela não repetirem a mesma pessoa uma vez por mês.
    const L = U.state.mes === "TODOS" ? U.consolidaColaboradores(L0) : L0;
    const c = K();
    const t = (f) => U.soma(L, f);
    view.innerHTML = `
      <div class="grid g-3">
        <div class="card"><h3>Composição do custo</h3><p class="sub">Por tipo de evento da folha.</p><div class="chart"><canvas id="c-comp"></canvas></div></div>
        <div class="card" style="grid-column:span 2"><h3>Horas x custo por colaborador</h3><p class="sub">Cada ponto é um colaborador. Pontos no alto e à direita concentram mais HE e mais custo.</p><div class="chart"><canvas id="c-disp"></canvas></div></div>
      </div>
      <div class="grid g-2">
        <div class="card"><h3>Custo de HE por função</h3><p class="sub">HE + DSR. As 10 funções de maior custo.</p><div class="chart tall"><canvas id="c-func"></canvas></div></div>
        <div class="card"><h3>Horas de HE por tipo</h3><p class="sub">Horas extras a 50% (banco), 50% e 100%.</p><div class="chart tall"><canvas id="c-tipo"></canvas></div></div>
      </div>
      <div class="card"><h3>Detalhe por colaborador</h3><p class="sub">Clique no título da coluna para ordenar.</p><div id="t-he"></div></div>`;

    C.rosca("c-comp", ["HE 50% (banco)", "HE 50%", "HE 100%", "DSR sobre HE"], [t("he_bh_v"), t("he50_v"), t("he100_v"), t("dsr_he")].map((v) => Math.round(v)),
      [c.he, c.medio, c.alerta, c.ink3], (v) => U.brl0(v));
    C.dispersao("c-disp", L.filter((x) => x.he_h > 0).map((x) => ({ x: x.he_h, y: x.he_total, nome: U.titulo(x.nome) })), { xt: "Horas de HE no período", yt: "Custo HE + DSR" });
    const pf = U.agrupa(L, "funcao").sort((a, b) => b.he - a.he).slice(0, 10);
    C.barras("c-func", pf.map((g) => U.titulo(g.chave)), pf.map((g) => Math.round(g.he)), { horizontal: true, fmt: (v) => U.brlK(v), tooltipFmt: (v) => U.brl0(v), cor: c.he });
    C.barras("c-tipo", ["50% (banco)", "50%", "100%"], [t("he_bh_h"), t("he50_h"), t("he100_h")].map((v) => +v.toFixed(1)), { fmt: (v) => v + " h", cores: [c.he, c.medio, c.alerta] });

    V.tabelaHE(L);
  };

  V.tabelaHE = (L) => {
    L = L || (U.state.mes === "TODOS" ? U.consolidaColaboradores(U.dadosFiltrados()) : U.dadosFiltrados());
    const el = document.getElementById("t-he");
    if (!el) return;
    el.innerHTML = U.tabela("he", [
      { k: "nome", t: "Colaborador", f: nome },
      { k: "funcao", t: "Função", f: func },
      { k: "area", t: "Área" },
      { k: "turno", t: "Turno", f: (x) => `<span class="pill">${U.esc(x.turno)}</span>` },
      { k: "he_h", t: "HE (h)", n: 1, f: (x) => U.n1(x.he_h) },
      { k: "he_bh_v", t: "50% banco", n: 1, f: (x) => U.brl(x.he_bh_v) },
      { k: "he50_v", t: "50%", n: 1, f: (x) => U.brl(x.he50_v) },
      { k: "he100_v", t: "100%", n: 1, f: (x) => U.brl(x.he100_v) },
      { k: "dsr_he", t: "DSR", n: 1, f: (x) => U.brl(x.dsr_he) },
      { k: "he_total", t: "Total", n: 1, f: (x) => `<b>${U.brl(x.he_total)}</b>` },
      { k: "he_pct_salario", t: "% do salário", n: 1, f: (x) => U.pct(x.he_pct_salario) },
      { k: "acima_limite", t: "Limite", v: (x) => (x.acima_limite ? 1 : 0), f: (x) => (x.acima_limite ? '<span class="pill warn">acima</span>' : '<span class="pill ok">ok</span>') },
    ], L, { sortKey: "he_total" });
  };

  // ===================== CUSTOS =====================
  V.custos = (view) => {
    const L = U.dadosFiltrados();
    if (!L.length) { view.innerHTML = semDados(); return; }
    const k = U.kpis(L), c = K();
    const noturno = U.soma(L, "noturno_v");
    view.innerHTML = `
      <div class="grid g-kpi">
        ${kpi("HE Total (sem DSR)", U.brl(k.heV), `${U.n0(k.heH)} horas · igual à linha "HE Total" da Visão executiva`)}
        ${kpi("DSR sobre HE", U.brl(k.dsr), `${U.n1(k.heV ? (k.dsr / k.heV) * 100 : 0)}% de reflexo`)}
        ${kpi("Encargos estimados", U.brl(k.encargos), `${G.DADOS.config.regras.encargos_sobre_he_pct}% sobre HE + DSR`)}
        ${kpi(`Custo total de HE <span class="pill he">TOTAL</span>`, U.brl(k.he + k.encargos), "HE + DSR + encargos (maior que o card \"HE + DSR\" da Visão executiva, que não soma encargos)", "dest")}
        ${kpi("Adicional noturno", U.brl0(noturno), "adicional + hora reduzida + DSR")}
        ${kpi("HE / remuneração bruta", U.pct(k.pctRem), `Remuneração comparável: ${U.brl0(k.rem)}`)}
      </div>
      <div class="grid g-2">
        <div class="card"><h3>HE como % da remuneração, por área</h3><p class="sub">Mostra onde a HE pesa mais no custo de pessoal.</p><div class="chart"><canvas id="c-pct"></canvas></div></div>
        <div class="card"><h3>Custo médio por hora de HE</h3><p class="sub">HE + DSR ÷ horas, por área. Custo alto por hora indica HE de gente mais bem paga ou com muito reflexo.</p><div class="chart"><canvas id="c-ch"></canvas></div></div>
      </div>
      <div class="card"><h3>Custo por função</h3><p class="sub">Clique no título da coluna para ordenar.</p><div id="t-func"></div></div>`;
    const pa = U.agrupa(L, "area").sort((a, b) => b.pctRem - a.pctRem);
    C.barras("c-pct", pa.map((g) => g.chave), pa.map((g) => +g.pctRem.toFixed(1)), { fmt: (v) => v + "%", cor: c.he });
    C.barras("c-ch", pa.map((g) => g.chave), pa.map((g) => +(g.heH ? g.he / g.heH : 0).toFixed(2)), { fmt: (v) => "R$ " + v, cor: c.atual });
    const pf = U.agrupa(L, "funcao");
    document.getElementById("t-func").innerHTML = U.tabela("func", [
      { k: "chave", t: "Função", f: (x) => U.esc(U.titulo(x.chave)) },
      { k: "n", t: "Colab.", n: 1 },
      { k: "heH", t: "HE (h)", n: 1, f: (x) => U.n1(x.heH) },
      { k: "mediaH", t: "Média h/colab.", n: 1, f: (x) => U.n1(x.mediaH) },
      { k: "heV", t: "HE", n: 1, f: (x) => U.brl(x.heV) },
      { k: "dsr", t: "DSR", n: 1, f: (x) => U.brl(x.dsr) },
      { k: "he", t: "Total", n: 1, f: (x) => `<b>${U.brl(x.he)}</b>` },
      { k: "pctRem", t: "% remuneração", n: 1, f: (x) => U.pct(x.pctRem) },
    ], pf, { sortKey: "he" });
  };

  // ===================== JORNADAS =====================
  V.jornadas = (view) => {
    const L = U.dadosFiltrados();
    if (!L.length) { view.innerHTML = semDados(); return; }
    const c = K(), mDados = U.mesDados();
    const cfgSim = mDados && mDados.colaboradores ? Sim.prepara(mDados.colaboradores) : { horarios_que_migram: [] };
    const pend = L.filter((x) => !x.horario_definido && x.situacao !== "Demitido");
    view.innerHTML = `
      <div class="grid g-2">
        <div class="card"><h3>Colaboradores por horário</h3><p class="sub">Somente horários confirmados na Base Mestra.</p><div class="chart"><canvas id="c-hor"></canvas></div></div>
        <div class="card"><h3>HE média por horário</h3><p class="sub">Horas de HE por colaborador no período.</p><div class="chart"><canvas id="c-hormed"></canvas></div></div>
      </div>
      <div class="card"><h3>Presença ao longo do dia</h3><p class="sub">Contagem por hora (presença nominal, sem descontar intervalos). Considera colaboradores trabalhando ou de férias com horário confirmado.</p><div class="chart"><canvas id="c-cobj"></canvas></div></div>
      <div class="card"><h3>Resumo por horário</h3><div id="t-hor"></div></div>
      ${pend.length ? `<div class="aviso"><b>${pend.length} registros sem horário confirmado</b> (fora dos gráficos acima).</div>` : ""}`;

    const def = L.filter((x) => x.horario_definido);
    const ph = U.agrupa(def, "horario").sort((a, b) => b.n - a.n);
    C.barras("c-hor", ph.map((g) => g.chave), ph.map((g) => g.n), { fmt: (v) => v + " col.", cor: c.atual });
    C.barras("c-hormed", ph.map((g) => g.chave), ph.map((g) => +g.mediaH.toFixed(1)), { fmt: (v) => v + " h", cor: c.he });
    const cob = U.cobertura(L, "atual", cfgSim);
    C.multi("c-cobj", cob.map((x) => x.h + "h"), [
      { nome: "Comercial", dados: cob.map((x) => x.comercial), cor: c.atual },
      { nome: "Tarde (12h–21h)", dados: cob.map((x) => x.migra + x.tarde), cor: c.he },
      { nome: "Parcial", dados: cob.map((x) => x.parcial), cor: U.css("--faint") },
    ], { empilhado: true });
    document.getElementById("t-hor").innerHTML = U.tabela("hor", [
      { k: "chave", t: "Horário" }, { k: "n", t: "Colab.", n: 1 },
      { k: "heH", t: "HE (h)", n: 1, f: (x) => U.n1(x.heH) }, { k: "mediaH", t: "Média h/colab.", n: 1, f: (x) => U.n1(x.mediaH) },
      { k: "he", t: "Custo HE + DSR", n: 1, f: (x) => U.brl(x.he) }, { k: "acima", t: "Acima do limite", n: 1 },
    ], ph, { sortKey: "n" });
  };

  // ===================== RANKINGS =====================
  V.rankings = (view) => {
    const L0 = U.dadosFiltrados();
    if (!L0.length) { view.innerHTML = semDados(); return; }
    // Com MÊS = TODOS, L0 tem um registro por colaborador/mês; consolida por matrícula
    // para que cada pessoa apareça uma vez, com os totais do período filtrado.
    const L = U.state.mes === "TODOS" ? U.consolidaColaboradores(L0) : L0;
    const c = K();
    const top = (arr, f, n = 10) => [...arr].filter((x) => f(x) > 0).sort((a, b) => f(b) - f(a)).slice(0, n).map((x) => ({ nome: x.nome, v: f(x) }));
    const fg = U.agrupa(L.filter((x) => x.situacao !== "Demitido"), "funcao").filter((g) => g.n >= 2).sort((a, b) => b.mediaH - a.mediaH).slice(0, 10).map((g) => ({ nome: `${g.chave} (${g.n})`, v: g.mediaH }));
    view.innerHTML = `
      <div class="grid g-2">
        <div class="card"><h3>Maior custo de HE</h3><p class="sub">HE + DSR no período.</p>${barList(top(L, (x) => x.he_total), U.brl0, c.he)}</div>
        <div class="card"><h3>Mais horas extras</h3><p class="sub">Horas no período.</p>${barList(top(L, (x) => x.he_h), (v) => U.n1(v) + " h", c.medio)}</div>
        <div class="card"><h3>HE mais pesada sobre o salário</h3><p class="sub">HE + DSR como % do salário base.</p>${barList(top(L, (x) => x.he_pct_salario), (v) => U.n1(v) + "%", c.alerta)}</div>
        <div class="card"><h3>Funções com maior média de HE</h3><p class="sub">Horas por colaborador (funções com 2+ pessoas).</p>${barList(fg, (v) => U.n1(v) + " h", c.atual)}</div>
        <div class="card"><h3>Mais atrasos e saídas antecipadas</h3><p class="sub">Horas no período.</p>${barList(top(L, (x) => x.atrasos_h), (v) => U.n1(v) + " h", c.ink3)}</div>
        <div class="card"><h3>Mais horas de falta</h3><p class="sub">Horas faltas descontadas.</p>${barList(top(L, (x) => x.faltas_h), (v) => U.n1(v) + " h", c.muted)}</div>
      </div>`;
  };

  // ===================== PROBLEMAS =====================
  V.problemas = (view) => {
    const m = U.mesDados(), L = U.dadosFiltrados();
    const acima = L.filter((x) => x.acima_limite);
    const rawInsights = m && m.insights ? m.insights : [];
    view.innerHTML = `
      <div><div class="secao" style="margin-bottom:10px"><h2>Insights automáticos</h2><p>Gerados a cada atualização.</p></div>
        <div class="ins">${rawInsights.length ? rawInsights.map(insight).join("") : '<p class="sub">Selecione um mês específico para visualizar insights automáticos detalhados.</p>'}</div></div>
      <div class="card"><h3>Ocorrências acima de ${G.DADOS.config.regras.limite_he_mes_horas} h de HE no período</h3><p class="sub">Segue os filtros da barra superior.</p><div id="t-acima"></div></div>`;
    document.getElementById("t-acima").innerHTML = U.tabela("acima", [
      { k: "nome", t: "Colaborador", f: nome }, { k: "funcao", t: "Função", f: func }, { k: "turno", t: "Turno" },
      { k: "he_h", t: "HE (h)", n: 1, f: (x) => U.n1(x.he_h) },
      { k: "exc", t: "Acima do limite (h)", n: 1, v: (x) => x.he_h - G.DADOS.config.regras.limite_he_mes_horas, f: (x) => U.n1(x.he_h - G.DADOS.config.regras.limite_he_mes_horas) },
      { k: "he_total", t: "Custo HE + DSR", n: 1, f: (x) => U.brl(x.he_total) },
    ], acima, { sortKey: "he_h" });
  };

  // ===================== SIMULAÇÃO =====================
  V.simulacao = (view) => {
    if (U.state.mes === "TODOS") {
      view.innerHTML = `<div class="card vazio">A simulação de horários é realizada com base na jornada de um mês específico. Por favor, selecione um mês na barra superior.</div>`;
      return;
    }
    Sim.render(view);
  };

  // ===================== QUALIDADE =====================
  V.qualidade = (view) => {
    const m = U.mesDados();
    if (U.state.mes === "TODOS" || !m || !m.qualidade) {
      view.innerHTML = `<div class="card vazio">A verificação de qualidade e auditoria da folha é apresentada mês a mês. Selecione um mês específico na barra superior.</div>`;
      return;
    }
    const q = m.qualidade;
    const lista = (arr) => (arr && arr.length ? `<ul class="lista">${arr.map((x) => `<li>${U.esc(typeof x === "string" ? x : JSON.stringify(x))}</li>`).join("")}</ul>` : '<p class="sub">Nenhuma ocorrência.</p>');
    view.innerHTML = `
      <div class="grid g-2">
        <div class="card"><h3>Conferência com o resumo da folha</h3>
          <p class="sub">Soma dos colaboradores lida do PDF x total impresso no "Resumo dos Eventos". Status geral: <span class="pill ${q.reconciliacao_ok ? "ok" : "warn"}">${q.reconciliacao_ok ? "conferido" : "divergente"}</span></p>
          <div class="tabela-wrap"><table><thead><tr><th>Evento</th><th class="n">Colaboradores</th><th class="n">Resumo</th><th>Status</th></tr></thead><tbody>
          ${q.reconciliacao.map((r) => `<tr><td>${U.esc(r.evento)}</td><td class="n">${U.brl(r.valor_colaboradores)}</td><td class="n">${U.brl(r.valor_resumo)}</td><td><span class="pill ${r.ok_valor ? "ok" : "warn"}">${r.ok_valor ? "ok" : "diferente"}</span></td></tr>`).join("")}
          </tbody></table></div>
          <p class="rodape-nota" style="margin-top:8px">${U.esc(q.nota_horas)}</p></div>
        <div class="card"><h3>Fontes desta carga</h3>
          <ul class="lista"><li>Folha: <b>${U.esc(m.fonte.folha)}</b> (${U.esc(m.periodo.inicio)} a ${U.esc(m.periodo.fim)})</li>
          <li>Base Mestra: <b>${U.esc(m.fonte.base_mestra)}</b> (aba ${U.esc(m.fonte.aba)})</li>
          <li>Gerado em: <b>${U.esc(m.gerado_em)}</b></li>
          <li>Colaboradores na folha: <b>${q.colaboradores_folha}</b> · na Base Mestra: <b>${q.colaboradores_base}</b></li>
          <li>Situações: ${Object.entries(q.situacoes).map(([k, v]) => `${U.esc(k)}:${v}`).join(" · ")}</li></ul>
        </div>
      </div>
      <div class="grid g-2">
        <div class="card"><h3>Horários pendentes (${q.horarios_pendentes.length})</h3><p class="sub">Não foram inferidos. Confirme no cartão-ponto.</p>${lista(q.horarios_pendentes.map(U.titulo))}</div>
        <div class="card"><h3>Cruzamento folha x Base Mestra</h3>
          <p class="sub">Na folha e ausentes na Base:</p>${lista(q.sem_base)}
          <p class="sub">Na Base e ausentes na folha:</p>${lista(q.sem_folha)}
          <p class="sub">Salário diferente entre as fontes:</p>${lista(q.salario_divergente.map((x) => `${x.nome}: folha ${U.brl(x.folha)} x base${U.brl(x.base)}`))}</div>
      </div>
      <div class="card"><h3>Matrícula x "F. Reg." da folha (${q.matricula_x_freg.length})</h3><p class="sub">O cruzamento é feito pelo nome. Estes registros têm número de registro diferente da matrícula na folha — apenas informativo.</p>${lista(q.matricula_x_freg.map((x) => `${U.titulo(x.nome)}: matrícula ${x.matricula} · F.Reg ${x.f_reg}`))}</div>`;
  };

  G.V = V;
})(window);