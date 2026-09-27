/* utils.js – formatação, filtros e agregações */
(function (G) {
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const brl0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const n1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const n0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

  const U = {
    brl: (v) => brl.format(v || 0),
    brl0: (v) => brl0.format(v || 0),
    brlK: (v) => (Math.abs(v) >= 1000 ? "R$ " + n1.format(v / 1000) + " mil" : brl0.format(v)),
    n1: (v) => n1.format(v || 0),
    n0: (v) => n0.format(v || 0),
    pct: (v) => n1.format(v || 0) + "%",
    h: (v) => n1.format(v || 0) + " h",
    esc: (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
    titulo: (s) => String(s || "").toLowerCase().replace(/(^|\s|\.)([a-zà-ú])/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Dos|Das|E)\b/g, (x) => x.toLowerCase()),
    soma: (arr, f) => arr.reduce((s, x) => s + (typeof f === "function" ? f(x) : x[f]) || 0, 0),
    css: (nome) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim(),
    mesLabel: (m) => {
      if (!m || m === "TODOS") return "Todos os meses";
      const [a, mm] = m.split("-");
      const nomes = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
      return nomes[+mm - 1] + "/" + a;
    },
  };

  // ---- estado global ----
  U.state = { ano: "TODOS", mes: null, aba: "exec", filtros: { area: "", turno: "", situacao: "", funcao: "", busca: "" }, sort: {} };

  U.mesDados = (m) => {
    const mesAlvo = m || U.state.mes;
    if (mesAlvo === "TODOS") {
      return { mes: "TODOS", colaboradores: U.todosColaboradores() };
    }
    return G.DADOS.meses[mesAlvo];
  };

  // Anos com dados no histórico (não é afetado pelo filtro de Ano — usado para montar o próprio seletor de Ano).
  U.anosDisponiveis = () => [...new Set(Object.keys(G.DADOS.meses).map((m) => m.split("-")[0]))].sort();

  // Meses disponíveis, já restritos ao Ano selecionado em U.state.ano ("TODOS" = todos os anos).
  // Por ser usada por todas as agregações de "Todos os meses" (todosColaboradores, comparativoMensal etc.),
  // o filtro de Ano passa a valer automaticamente em qualquer lugar que já usava mesesOrdenados().
  U.mesesOrdenados = () => Object.keys(G.DADOS.meses)
    .filter((m) => !U.state.ano || U.state.ano === "TODOS" || m.startsWith(U.state.ano + "-"))
    .sort();
  U.todosColaboradores = () => U.mesesOrdenados().flatMap((m) => G.DADOS.meses[m].colaboradores.map((c) => ({ ...c, _mes: m })));
  U.dadosHistoricosFiltrados = () => U.aplicaFiltros(U.todosColaboradores());
  U.kpisHistoricos = (L) => {
    const k = U.kpis(L);
    const unicos = new Set(L.map((c) => c.matricula || c.nome));
    const unicosHE = new Set(L.filter((c) => c.he_h > 0).map((c) => c.matricula || c.nome));
    return { ...k, n: unicos.size, nComHE: unicosHE.size };
  };
  U.comparativoMensal = () => U.mesesOrdenados().map((mes) => {
    const L = U.aplicaFiltros(G.DADOS.meses[mes].colaboradores);
    const k = U.kpis(L);
    return { mes, ...k };
  });
  U.mesAnterior = () => {
    const l = U.mesesOrdenados(), i = l.indexOf(U.state.mes);
    return i > 0 ? l[i - 1] : null;
  };

  U.aplicaFiltros = (lista) => {
    const f = U.state.filtros, b = f.busca.trim().toLowerCase();
    return lista.filter((c) =>
      (!f.area || c.area === f.area) && (!f.turno || c.turno === f.turno) &&
      (!f.situacao || c.situacao === f.situacao) && (!f.funcao || c.funcao === f.funcao) &&
      (!b || c.nome.toLowerCase().includes(b)));
  };
  
  // Consolida uma lista com um registro por colaborador/mês (como a de "Todos os meses")
  // em um registro por colaborador, somando as horas e valores do período filtrado.
  // Usado pelos Rankings quando MÊS = TODOS, para não contar a mesma pessoa uma vez por mês.
  U.CAMPOS_SOMAVEIS = ["he_bh_h", "he_bh_v", "he50_h", "he50_v", "he100_h", "he100_v", "he_h", "he_v",
    "dsr_he", "he_total", "noturno_v", "noturno_h", "atrasos_h", "atrasos_v", "faltas_h", "faltas_v",
    "atestado_h", "multa_v", "horas_normais", "horas_ferias", "remuneracao"];
  U.consolidaColaboradores = (lista) => {
    const m = new Map();
    lista.forEach((c) => {
      const chave = c.matricula || c.nome;
      if (!m.has(chave)) { m.set(chave, { ...c }); return; }
      const g = m.get(chave);
      U.CAMPOS_SOMAVEIS.forEach((campo) => { g[campo] = (g[campo] || 0) + (c[campo] || 0); });
      // dados cadastrais (função, área, turno, situação etc.) ficam com o registro do mês mais recente
      Object.assign(g, { nome: c.nome, funcao: c.funcao, area: c.area, turno: c.turno, situacao: c.situacao });
    });
    return [...m.values()].map((c) => ({ ...c, he_pct_salario: c.remuneracao ? (c.he_total / c.remuneracao) * 100 : 0 }));
  };

  U.dadosFiltrados = (mes) => {
    const m = U.mesDados(mes);
    return m ? U.aplicaFiltros(m.colaboradores) : [];
  };

  // ---- agregações ----
  U.kpis = (L) => {
    const he = U.soma(L, "he_total"), heV = U.soma(L, "he_v"), heH = U.soma(L, "he_h");
    const rem = U.soma(L, "remuneracao");
    const comHE = L.filter((c) => c.he_h > 0);
    return {
      n: L.length, he, heV, heH, dsr: U.soma(L, "dsr_he"), rem,
      he50_v: U.soma(L, "he50_v"), he50_h: U.soma(L, "he50_h"),
      he100_v: U.soma(L, "he100_v"), he100_h: U.soma(L, "he100_h"),
      heBH_v: U.soma(L, "he_bh_v"), heBH_h: U.soma(L, "he_bh_h"),
      pctRem: rem ? (he / rem) * 100 : 0,
      nComHE: comHE.length,
      mediaHE: comHE.length ? heH / comHE.length : 0,
      acima: L.filter((c) => c.acima_limite).length,
      custoHora: heH ? he / heH : 0,
      encargos: he * (G.DADOS.config.regras.encargos_sobre_he_pct / 100),
    };
  };

  U.agrupa = (L, chave, extra) => {
    const m = new Map();
    L.forEach((c) => {
      const k = typeof chave === "function" ? chave(c) : c[chave];
      if (!m.has(k)) m.set(k, { chave: k, n: 0, he: 0, heV: 0, heH: 0, dsr: 0, rem: 0, comHE: 0, acima: 0, itens: [] });
      const g = m.get(k);
      g.n++; g.he += c.he_total; g.heV += c.he_v; g.heH += c.he_h; g.dsr += c.dsr_he; g.rem += c.remuneracao;
      if (c.he_h > 0) g.comHE++;
      if (c.acima_limite) g.acima++;
      g.itens.push(c);
    });
    return [...m.values()].map((g) => ({ ...g, mediaH: g.n ? g.heH / g.n : 0, pctRem: g.rem ? (g.he / g.rem) * 100 : 0 }));
  };

  U.delta = (atual, anterior, inverso) => {
    if (anterior == null || !isFinite(anterior) || anterior === 0) return "";
    const d = ((atual - anterior) / Math.abs(anterior)) * 100;
    if (Math.abs(d) < 0.05) return "";
    const sobe = d > 0;
    return `<span class="delta ${sobe ? "up" : "down"}" title="vs. mês anterior">${sobe ? "▲" : "▼"} ${U.n1(Math.abs(d))}%</span>`;
  };

  // ---- tabela ordenável ----
  // colunas: [{k, t, n(bool numérico), f(fn formata), cls}]
  U.tabela = (id, cols, linhas, opts = {}) => {
    const st = U.state.sort[id] || { k: opts.sortKey || cols[0].k, asc: !!opts.asc };
    U.state.sort[id] = st;
    const col = cols.find((c) => c.k === st.k) || cols[0];
    const sorted = [...linhas].sort((a, b) => {
      const va = col.v ? col.v(a) : a[col.k], vb = col.v ? col.v(b) : b[col.k];
      const r = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
      return st.asc ? r : -r;
    });
    const lim = opts.limite || sorted.length;
    const head = cols.map((c) => `<th class="${c.n ? "n" : ""} ${c.k === st.k ? "sorted" + (st.asc ? " asc" : "") : ""}" data-t="${id}" data-k="${c.k}">${c.t}</th>`).join("");
    const body = sorted.slice(0, lim).map((r) => "<tr>" + cols.map((c) => `<td class="${c.n ? "n" : ""}">${c.f ? c.f(r) : U.esc(r[c.k])}</td>`).join("") + "</tr>").join("");
    U.tabelasReg[id] = { cols, linhas: sorted, opts };
    return `<div class="tools"><small>${sorted.length} registros${lim < sorted.length ? " (mostrando " + lim + ")" : ""}</small>
      <button class="btn" data-csv="${id}" type="button">Exportar CSV</button></div>
      <div class="tabela-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${cols.length}" class="vazio">Nenhum colaborador para os filtros atuais.</td></tr>`}</tbody></table></div>`;
  };
  U.tabelasReg = {};

  U.csv = (id) => {
    const t = U.tabelasReg[id];
    if (!t) return;
    const strip = (s) => String(s).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    const linhas = [t.cols.map((c) => c.t).join(";")].concat(t.linhas.map((r) =>
      t.cols.map((c) => {
        const v = c.v ? c.v(r) : r[c.k];
        return '"' + strip(typeof v === "number" ? String(v).replace(".", ",") : v) + '"';
      }).join(";")));
    const blob = new Blob(["\ufeff" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `he_belem_${id}_${U.state.mes}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // ---- cobertura por hora do dia ----
  U.cobertura = (L, cenario /* 'atual' | 'proposto' */, simCfg) => {
    const horas = [];
    for (let h = 6; h < 24; h++) horas.push({ h, total: 0, comercial: 0, migra: 0, tarde: 0, parcial: 0 });
    const migra = new Set(simCfg.horarios_que_migram);
    const delta = simCfg._deltaEntrada || 1;
    L.filter((c) => c.horario_definido && (c.situacao === "Trabalhando" || c.situacao === "Férias") && c.blocos.length).forEach((c) => {
      const desloca = cenario === "proposto" && migra.has(c.horario);
      const grupo = migra.has(c.horario) ? "migra" : (c.turno === "Tarde" ? "tarde" : c.turno === "Parcial" ? "parcial" : "comercial");
      c.blocos.forEach(([a, b]) => {
        const ini = a + (desloca ? delta : 0), fim = b + (desloca ? delta : 0);
        horas.forEach((x) => { if (x.h >= Math.floor(ini) && x.h + 1 <= Math.ceil(fim) && x.h + 1 > ini && x.h < fim) { x.total++; x[grupo]++; } });
      });
    });
    return horas;
  };

  G.U = U;
})(window);