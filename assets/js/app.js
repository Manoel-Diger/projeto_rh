/* app.js – inicialização, filtros e navegação */
(function () {
  const TITULOS = {
    exec: ["Visão executiva", "Panorama do mês para a gestão"],
    he: ["Horas extras", "Composição, distribuição e detalhe por colaborador"],
    custos: ["Custos", "Quanto as horas extras pesam na folha"],
    jornadas: ["Jornadas e turnos", "Como a equipe se distribui ao longo do dia"],
    rankings: ["Rankings", "Quem e onde concentram HE, atrasos e faltas"],
    problemas: ["Problemas e insights", "Pontos que pedem decisão ou verificação"],
    simulacao: ["Simulação do turno 13h–22h", "Efeito de mover o turno da tarde em uma hora"],
    qualidade: ["Qualidade dos dados", "Conferências, pendências e como atualizar"],
  };
  const $ = (id) => document.getElementById(id);
  const view = () => $("view");
  const SEM_FILTRO = ["simulacao", "qualidade"];

  function opcoes(sel, valores, rotuloTodos, atual) {
    sel.innerHTML = `<option value="">${rotuloTodos}</option>` + valores.map((v) => `<option ${v === atual ? "selected" : ""} value="${U.esc(v)}">${U.esc(v)}</option>`).join("");
  }

  function montaMeses() {
    const meses = U.mesesOrdenados();
    // se o mês atual não existir mais no ano selecionado, volta para "Todos os meses"
    if (U.state.mes !== "TODOS" && !meses.includes(U.state.mes)) U.state.mes = "TODOS";
    $("f-mes").innerHTML = `<option value="TODOS">Todos os meses</option>` +
      meses.slice().reverse().map((m) => `<option ${m === U.state.mes ? "selected" : ""} value="${m}">${U.mesLabel(m)}</option>`).join("");
  }

  function montaFiltros() {
    const L = U.state.mes === "TODOS" ? U.todosColaboradores() : U.mesDados().colaboradores, f = U.state.filtros;
    const uniq = (k) => [...new Set(L.map((c) => c[k]))].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"));
    opcoes($("f-area"), uniq("area"), "Todas", f.area);
    opcoes($("f-turno"), uniq("turno"), "Todos", f.turno);
    opcoes($("f-sit"), uniq("situacao"), "Todas", f.situacao);
    opcoes($("f-func"), uniq("funcao").map((x) => x), "Todas", f.funcao);
    $("f-busca").value = f.busca;
  }

  function chips() {
    const f = U.state.filtros, itens = [];
    if (f.area) itens.push("Área: " + f.area);
    if (f.turno) itens.push("Turno: " + f.turno);
    if (f.situacao) itens.push("Situação: " + f.situacao);
    if (f.funcao) itens.push("Função: " + U.titulo(f.funcao));
    if (f.busca) itens.push("Busca: " + f.busca);
    const ativo = itens.length && !SEM_FILTRO.includes(U.state.aba);
    $("chips").innerHTML = ativo ? itens.map((i) => `<span class="chip">${U.esc(i)}</span>`).join("") + `<span class="chip">${U.dadosFiltrados().length} colaboradores</span>` : "";
  }

  function render(manterScroll) {
    C.destroyAll();
    const a = U.state.aba, m = U.mesDados();
    document.querySelectorAll("#nav button").forEach((b) => b.setAttribute("aria-current", b.dataset.aba === a ? "page" : "false"));
    $("h-titulo").textContent = TITULOS[a][0];
    const rotuloPeriodo = U.state.mes === "TODOS"
      ? (U.state.ano === "TODOS" ? "Todos os meses" : `Todos os meses de ${U.state.ano}`)
      : U.mesLabel(m.mes);
    $("h-sub").textContent = `${TITULOS[a][1]} · ${rotuloPeriodo} · ${G_nome()}`;
    document.querySelectorAll(".filtro").forEach((el, i) => { if (i > 1) el.style.display = SEM_FILTRO.includes(a) ? "none" : ""; });
    $("b-limpar").style.display = SEM_FILTRO.includes(a) ? "none" : "";
    chips();
    V[a](view());
    if (!manterScroll) window.scrollTo({ top: 0 });
  }
  const G_nome = () => DADOS.filial.nome;

  function init() {
    if (!window.DADOS || !DADOS.meses || !Object.keys(DADOS.meses).length) {
      $("view").innerHTML = `<div class="card vazio"><b>Sem dados carregados.</b><br>Execute <code>atualizar.bat</code> (Windows) ou <code>./atualizar.sh</code> para gerar <code>data/processado/dados.js</code>.</div>`;
      return;
    }
    C.init();
    U.state.ano = "TODOS";
    U.state.mes = "TODOS";
    const anos = U.anosDisponiveis();
    $("f-ano").innerHTML = `<option value="TODOS">Todos os anos</option>` + anos.slice().reverse().map((a) => `<option value="${a}">${a}</option>`).join("");
    const meses = U.mesesOrdenados();
    montaMeses();
    $("side-foot").innerHTML = `Dados gerados em<br>${U.esc(DADOS.gerado_em)}<br>${meses.length} mês(es) no histórico`;
    montaFiltros();

    $("nav").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { U.state.aba = b.dataset.aba; render(); } });
    $("f-ano").addEventListener("change", (e) => { U.state.ano = e.target.value; montaMeses(); montaFiltros(); render(); });
    $("f-mes").addEventListener("change", (e) => { U.state.mes = e.target.value; montaFiltros(); render(); });
    const liga = (id, chave) => $(id).addEventListener("change", (e) => { U.state.filtros[chave] = e.target.value; render(); });
    liga("f-area", "area"); liga("f-turno", "turno"); liga("f-sit", "situacao"); liga("f-func", "funcao");
    let t;
    $("f-busca").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { U.state.filtros.busca = e.target.value; render(); }, 250); });
    $("b-limpar").addEventListener("click", () => { U.state.filtros = { area: "", turno: "", situacao: "", funcao: "", busca: "" }; montaFiltros(); render(); });
    $("b-imprimir").addEventListener("click", () => window.print());

    // ordenação de tabelas, exportação e links internos (delegação)
    document.addEventListener("click", (e) => {
      const th = e.target.closest("th[data-t]");
      if (th) {
        const id = th.dataset.t, st = U.state.sort[id] || {};
        U.state.sort[id] = { k: th.dataset.k, asc: st.k === th.dataset.k ? !st.asc : false };
        if (id === "sim") Sim.resultado();
        else if (id === "he") V.tabelaHE();
        else render(true);
        return;
      }
      const csv = e.target.closest("[data-csv]");
      if (csv) { U.csv(csv.dataset.csv); return; }
      const ir = e.target.closest("a[data-aba]");
      if (ir) { e.preventDefault(); U.state.aba = ir.dataset.aba; render(); }
    });
    render();
  }
  document.addEventListener("DOMContentLoaded", init);
})();