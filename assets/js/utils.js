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
  // anos / meses: seleção múltipla (lista vazia = "Todos"). Os meses são chaves "AAAA-MM", o que permite
  // combinar meses de anos diferentes (ex.: 2025-01 + 2026-01).
  // mes: valor derivado (ver U.sincronizaPeriodo) — a chave do mês quando há exatamente UM mês selecionado
  // e "TODOS" em qualquer outro caso (nenhum ou vários meses). É o que as telas já usavam para escolher
  // entre a visão de um mês e a visão consolidada.
  U.state = { anos: [], meses: [], mes: "TODOS", aba: "geral", filtros: { area: "", turno: "", situacao: "", funcao: "", busca: "" }, sort: {} };

  U.mesDados = (m) => {
    const mesAlvo = m || U.state.mes;
    if (mesAlvo === "TODOS") {
      return { mes: "TODOS", colaboradores: U.todosColaboradores() };
    }
    return G.DADOS.meses[mesAlvo];
  };

  // Anos com dados no histórico (não é afetado pela seleção — usado para montar o próprio seletor de Ano).
  U.anosDisponiveis = () => [...new Set(Object.keys(G.DADOS.meses).map((m) => m.split("-")[0]))].sort();
  U.todasChaves = () => Object.keys(G.DADOS.meses).sort();

  // Meses que o seletor de Mês oferece: restritos aos Anos selecionados (lista vazia = todos os anos).
  U.mesesDisponiveis = () => U.todasChaves()
    .filter((m) => !U.state.anos.length || U.state.anos.includes(m.split("-")[0]));

  // Meses efetivamente em análise: os marcados no seletor de Mês; se nenhum estiver marcado, todos os
  // disponíveis. É usada por todas as agregações consolidadas (todosColaboradores, comparativoMensal etc.).
  U.mesesOrdenados = () => {
    const disp = U.mesesDisponiveis();
    return U.state.meses.length ? disp.filter((m) => U.state.meses.includes(m)) : disp;
  };

  // Mantém a seleção coerente: descarta meses fora dos Anos selecionados e recalcula U.state.mes.
  U.sincronizaPeriodo = () => {
    const disp = new Set(U.mesesDisponiveis());
    U.state.meses = U.state.meses.filter((m) => disp.has(m)).sort();
    U.state.mes = U.state.meses.length === 1 ? U.state.meses[0] : "TODOS";
  };

  U.MES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  U.mesCurto = (m) => { const [a, mm] = String(m).split("-"); return `${U.MES_CURTO[+mm - 1]}/${a.slice(-2)}`; };

  // Texto do período em análise (subtítulo e botão do seletor).
  U.periodoLabel = () => {
    const { anos, meses, mes } = U.state;
    if (mes !== "TODOS") return U.mesLabel(mes);
    if (!meses.length) return anos.length ? `Todos os meses de ${anos.join(" e ")}` : "Todos os meses";
    return meses.length <= 4 ? meses.map(U.mesCurto).join(", ") : `${meses.length} meses selecionados`;
  };

  // true quando há mais de um mês em análise (ou nenhum filtrado): visão consolidada, sem detalhe de um mês.
  U.multiplosMeses = () => U.state.mes === "TODOS";

  // Cores por ano para os gráficos mensais: o ano mais recente usa a cor do indicador e os anteriores
  // usam tons progressivamente mais claros dela, para que cada indicador mantenha sua identidade visual.
  U.clareia = (hex, f) => {
    const m = /^#([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return hex;
    const n = parseInt(m[1], 16), mix = (c) => Math.round(c + (255 - c) * f);
    return "#" + [n >> 16 & 255, n >> 8 & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, "0")).join("");
  };
  U.coresPorAno = (base, anos) => {
    const ord = [...anos].sort(), passos = [0, 0.45, 0.68, 0.8];
    const r = {};
    ord.forEach((a, i) => { r[a] = U.clareia(base, passos[Math.min(ord.length - 1 - i, passos.length - 1)]); });
    return r;
  };

  U.colaboradoresDosMeses = (lista) => lista.flatMap((m) => G.DADOS.meses[m].colaboradores.map((c) => ({ ...c, _mes: m })));
  U.todosColaboradores = () => U.colaboradoresDosMeses(U.mesesOrdenados());

  // Meses da tabela/comparativo mensal e do total histórico: com vários meses (ou nenhum) selecionados,
  // são os meses selecionados; com UM mês selecionado, a tabela continua mostrando todo o histórico do
  // Ano filtrado como contexto (comportamento original), e o mês escolhido é o que alimenta cards e gráficos.
  U.mesesComparativo = () => (U.state.mes === "TODOS" ? U.mesesOrdenados() : U.mesesDisponiveis());
  U.dadosHistoricosFiltrados = () => U.aplicaFiltros(U.colaboradoresDosMeses(U.mesesComparativo()));
  U.kpisHistoricos = (L) => {
    const k = U.kpis(L);
    const unicos = new Set(L.map((c) => c.matricula || c.nome));
    const unicosHE = new Set(L.filter((c) => c.he_h > 0).map((c) => c.matricula || c.nome));
    return { ...k, n: unicos.size, nComHE: unicosHE.size };
  };
  U.comparativoMensal = () => U.mesesComparativo().map((mes) => {
    const L = U.aplicaFiltros(G.DADOS.meses[mes].colaboradores);
    const k = U.kpis(L);
    return { mes, ...k };
  });
  U.mesAnterior = () => {
    // usa a lista de meses disponíveis (restrita só pelo Ano), não a seleção — com um único mês
    // selecionado a seleção teria só ele mesmo e a comparação com o mês anterior deixaria de existir
    const l = U.mesesDisponiveis(), i = l.indexOf(U.state.mes);
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
    const head = cols.map((c) => `<th scope="col" class="${c.n ? "n" : ""} ${c.k === st.k ? "sorted" + (st.asc ? " asc" : "") : ""}" data-t="${id}" data-k="${c.k}">${c.t}</th>`).join("");
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
    a.download = `he_belem_${id}_${U.state.mes !== "TODOS" ? U.state.mes : (U.state.meses.length ? "selecao" : "todos")}.csv`;
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