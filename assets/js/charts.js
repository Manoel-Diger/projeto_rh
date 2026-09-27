/* charts.js – criação padronizada de gráficos */
(function (G) {
  const C = { reg: [] };

  C.destroyAll = () => { C.reg.forEach((c) => c.destroy()); C.reg = []; };

  C.cores = () => ({
    atual: U.css("--atual"), proposto: U.css("--proposto"), he: U.css("--he"),
    alerta: U.css("--alerta"), ok: U.css("--ok"), ink: U.css("--ink"), muted: U.css("--muted"),
    line: U.css("--line-2"), ink3: U.css("--ink-3"), medio: U.css("--medio"),
    colab: U.css("--colab"),
  });

  C.init = () => {
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.font.size = 12;
    Chart.defaults.color = U.css("--muted");
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.boxHeight = 10;
    Chart.defaults.plugins.tooltip.backgroundColor = U.css("--ink");
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
    beginAtZero: true, grid: { color: U.css("--line-2") },
    border: { display: false }, ticks: fmt ? { callback: fmt, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } : {},
  });

  // barras (vertical ou horizontal) de uma série
  C.barras = (id, labels, valores, { horizontal, cor, fmt, tooltipFmt, cores } = {}) => C.make(id, {
    type: "bar",
    data: { labels, datasets: [{ data: valores, backgroundColor: cores || cor || U.css("--he"), borderRadius: 4, maxBarThickness: 34 }] },
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
    data: { labels, datasets: series.map((s) => ({ label: s.nome, data: s.dados, backgroundColor: s.cor, borderRadius: empilhado ? 0 : 4, maxBarThickness: 40 })) },
    options: {
      indexAxis: horizontal ? "y" : "x", maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${(fmt || String)(c.parsed[horizontal ? "x" : "y"])}` } } },
      scales: {
        x: horizontal ? { ...eixo(fmt), stacked: !!empilhado } : { stacked: !!empilhado, grid: { display: false }, border: { display: false } },
        y: horizontal ? { stacked: !!empilhado, grid: { display: false }, border: { display: false } } : { ...eixo(fmt), stacked: !!empilhado },
      },
    },
  });

  C.rosca = (id, labels, valores, cores, fmt) => C.make(id, {
    type: "doughnut",
    data: { labels, datasets: [{ data: valores, backgroundColor: cores, borderColor: "#fff", borderWidth: 2 }] },
    options: {
      maintainAspectRatio: false, cutout: "62%",
      plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${(fmt || String)(c.parsed)}` } } },
    },
  });

  C.barrasComparativo = (id, labels, series, { fmt } = {}) => C.make(id, {
    type: "bar",
    data: { labels, datasets: series.map((s) => ({ label: s.nome, data: s.dados, backgroundColor: s.cor, borderRadius: 4, maxBarThickness: 42 })) },
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
    data: { datasets: [{ data: pontos, backgroundColor: U.css("--he") + "cc", pointRadius: 5, pointHoverRadius: 7 }] },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.raw.nome}: ${U.n1(c.raw.x)} h · ${U.brl0(c.raw.y)}` } } },
      scales: { x: { ...eixo(), title: { display: true, text: xt } }, y: { ...eixo((v) => U.brlK(v)), title: { display: true, text: yt } } },
    },
  });

  G.C = C;
})(window);
