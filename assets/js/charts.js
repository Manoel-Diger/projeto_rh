/* charts.js – criação padronizada de gráficos */
(function (G) {
  const C = { reg: [] };

  C.destroyAll = () => { C.reg.forEach((c) => c.destroy()); C.reg = []; };

  C.cores = () => ({
    atual: U.css("--atual"), proposto: U.css("--proposto"), he: U.css("--he"),
    alerta: U.css("--alerta"), ok: U.css("--ok"), ink: U.css("--ink"), muted: U.css("--muted"),
    line: "#4b628f", ink3: U.css("--proposto"), /* série de DSR: mesmo tom do card DSR */ medio: U.css("--medio"),
    colab: U.css("--colab"),
  });

  // ---- apoio visual: gradiente por barra (não altera dados nem escalas) ----
  const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i; // aceita #rrggbb e #rrggbbaa
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1, 7), 16);
    const base = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${(a * base).toFixed(3)})`;
  };
  const grad = (cor, horizontal) => (ctx) => {
    if (typeof cor !== "string" || !HEX.test(cor) || !ctx.chart.chartArea || !ctx.element) return cor;
    const g = ctx.chart.ctx;
    if (horizontal) {
      const p = ctx.element.getProps(["x", "base"], true);
      if (!isFinite(p.x) || !isFinite(p.base) || p.x === p.base) return cor;
      const f = g.createLinearGradient(p.base, 0, p.x, 0);
      f.addColorStop(0, rgba(cor, 0.5)); f.addColorStop(1, rgba(cor, 1));
      return f;
    }
    const p = ctx.element.getProps(["y", "base"], true);
    if (!isFinite(p.y) || !isFinite(p.base) || p.y === p.base) return cor;
    const f = g.createLinearGradient(0, p.y, 0, p.base);
    f.addColorStop(0, rgba(cor, 1)); f.addColorStop(1, rgba(cor, 0.42));
    return f;
  };
  // lista de cores (uma por barra): escolhe a cor pelo índice dentro de uma única função
  const fill = (c, horizontal) => (Array.isArray(c)
    ? (ctx) => grad(c[ctx.dataIndex], horizontal)(ctx)
    : grad(c, horizontal));

  // legenda: usa a cor sólida da série (o preenchimento das barras é gradiente)
  const legendaSolida = (chart) => {
    const base = Chart.defaults.plugins.legend.labels.__gerarOriginal(chart);
    return base.map((l) => {
      const ds = chart.data.datasets[l.datasetIndex];
      return ds && ds.corBase && typeof ds.corBase === "string" ? { ...l, fillStyle: ds.corBase, strokeStyle: ds.corBase } : l;
    });
  };

  C.init = () => {
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.font.size = 10.5;
    Chart.defaults.color = U.css("--muted");
    Chart.defaults.plugins.legend.labels.__gerarOriginal = Chart.defaults.plugins.legend.labels.generateLabels;
    Chart.defaults.plugins.legend.labels.generateLabels = legendaSolida;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.pointStyle = "circle";
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.legend.labels.boxHeight = 8;
    Chart.defaults.plugins.legend.labels.padding = 14;
    Chart.defaults.plugins.tooltip.backgroundColor = "rgba(6, 11, 26, 0.96)";
    Chart.defaults.plugins.tooltip.borderColor = "rgba(120, 150, 220, 0.30)";
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.titleColor = "#ffffff";
    Chart.defaults.plugins.tooltip.bodyColor = "#cfd9ef";
    Chart.defaults.plugins.tooltip.boxPadding = 4;
    Chart.defaults.plugins.tooltip.usePointStyle = true;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.animation.duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 350;
  };

  C.make = (id, cfg) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const ch = new Chart(el, cfg);
    C.reg.push(ch);
    return ch;
  };

  const eixo = (fmt) => ({
    beginAtZero: true, grid: { color: "rgba(148, 170, 220, 0.09)" },
    border: { display: false }, ticks: fmt ? { callback: fmt, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } : {},
  });

  // barras (vertical ou horizontal) de uma série
  C.barras = (id, labels, valores, { horizontal, cor, fmt, tooltipFmt, cores } = {}) => C.make(id, {
    type: "bar",
    data: { labels, datasets: [{ data: valores, backgroundColor: fill(cores || cor || U.css("--he"), horizontal), borderRadius: 6, maxBarThickness: 34 }] },
    options: {
      indexAxis: horizontal ? "y" : "x", maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => " " + (tooltipFmt || fmt || String)(c.parsed[horizontal ? "x" : "y"]) } } },
      scales: {
        [horizontal ? "x" : "y"]: eixo(fmt),
        [horizontal ? "y" : "x"]: { grid: { display: false }, border: { display: false } },
      },
    },
  });

  // barras empilhadas / agrupadas com várias séries
  C.multi = (id, labels, series, { empilhado, fmt, horizontal } = {}) => C.make(id, {
    type: "bar",
    data: { labels, datasets: series.map((s) => ({ label: s.nome, data: s.dados, corBase: s.cor, backgroundColor: fill(s.cor, horizontal), borderRadius: empilhado ? 0 : 6, maxBarThickness: 40 })) },
    options: {
      indexAxis: horizontal ? "y" : "x", maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${(fmt || String)(c.parsed[horizontal ? "x" : "y"])}` } } },
      scales: {
        x: horizontal ? { ...eixo(fmt), stacked: !!empilhado } : { stacked: !!empilhado, grid: { display: false }, border: { display: false } },
        y: horizontal ? { stacked: !!empilhado, grid: { display: false }, border: { display: false } } : { ...eixo(fmt), stacked: !!empilhado },
      },
    },
  });

  // barras agrupadas por categoria (ex.: mês), uma série por ano, cada uma com sua cor.
  // Séries com valor nulo (mês inexistente naquele ano) simplesmente não desenham barra.
  // comLegenda = true mostra a legenda dos anos e o ano no tooltip.
  C.barrasAgrupadas = (id, labels, series, { fmt, tooltipFmt, comLegenda } = {}) => C.make(id, {
    type: "bar",
    data: {
      labels,
      datasets: series.map((s) => ({
        label: s.nome, data: s.dados, corBase: s.cor, backgroundColor: fill(s.cor, false),
        borderColor: s.borda || s.cor, borderWidth: s.borda ? 1 : 0, borderRadius: 6, maxBarThickness: 34,
        // com poucos meses, aproxima as barras dos anos dentro do mesmo grupo
        categoryPercentage: Math.min(0.8, 0.14 * labels.length + 0.05), barPercentage: 0.95,
      })),
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: !!comLegenda, position: "bottom" },
        tooltip: { callbacks: { label: (c) => ` ${comLegenda ? c.dataset.label + ": " : ""}${(tooltipFmt || fmt || String)(c.parsed.y)}` } },
      },
      scales: { y: eixo(fmt), x: { grid: { display: false }, border: { display: false } } },
    },
  });

  C.rosca = (id, labels, valores, cores, fmt) => C.make(id, {
    type: "doughnut",
    data: { labels, datasets: [{ data: valores, backgroundColor: cores, borderWidth: 0, spacing: 3, borderRadius: 5, hoverOffset: 5 }] },
    options: {
      maintainAspectRatio: false, cutout: "70%",
      plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${(fmt || String)(c.parsed)}` } } },
    },
  });

  C.barrasComparativo = (id, labels, series, { fmt } = {}) => C.make(id, {
    type: "bar",
    data: { labels, datasets: series.map((s) => ({ label: s.nome, data: s.dados, corBase: s.cor, backgroundColor: fill(s.cor, false), borderRadius: 6, maxBarThickness: 42 })) },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${(fmt || String)(c.parsed.y)}` } } },
      scales: { y: eixo(fmt), x: { grid: { display: false }, border: { display: false } } },
    },
  });

  C.linhas = (id, labels, series, { fmt, degrau } = {}) => C.make(id, {
    type: "line",
    data: { labels, datasets: series.map((s) => ({ label: s.nome, data: s.dados, borderColor: s.cor, backgroundColor: s.fundo || s.cor, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 4, tension: 0, stepped: degrau ? "middle" : false, fill: !!s.fundo })) },
    options: {
      maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${(fmt || String)(c.parsed.y)}` } } },
      scales: { y: eixo(fmt), x: { grid: { display: false }, border: { display: false } } },
    },
  });

  C.dispersao = (id, pontos, { xt, yt }) => C.make(id, {
    type: "scatter",
    data: { datasets: [{ data: pontos, backgroundColor: U.css("--he") + "b3", borderColor: U.css("--he"), borderWidth: 1, pointRadius: 5, pointHoverRadius: 8 }] },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.raw.nome}: ${U.n1(c.raw.x)} h · ${U.brl0(c.raw.y)}` } } },
      scales: { x: { ...eixo(), title: { display: true, text: xt } }, y: { ...eixo((v) => U.brlK(v)), title: { display: true, text: yt } } },
    },
  });

  G.C = C;
})(window);
