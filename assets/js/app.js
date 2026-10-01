/* app.js – inicialização, filtros e navegação */
(function () {
  const TITULOS = {
    geral: ["Visão geral", "Custo e volume de horas extras e DSR"],
    he: ["Horas extras", "Composição do custo, distribuição e detalhamento por colaborador"],
    custos: ["Custos", "HE, DSR e encargos em relação à remuneração"],
    jornadas: ["Jornadas e turnos", "Quadro por horário e presença ao longo do dia"],
    rankings: ["Rankings", "Maiores volumes de HE, atrasos e faltas"],
    problemas: ["Problemas e insights", "Alertas e ocorrências para ação ou conferência"],
    simulacao: ["Simulação do turno 13h–22h", "Impacto estimado de deslocar o turno da tarde em 1 hora"],
    qualidade: ["Qualidade dos dados", "Conferência com a folha, pendências e divergências"],
  };
  const $ = (id) => document.getElementById(id);
  const view = () => $("view");
  const SEM_FILTRO = ["simulacao", "qualidade"];

  function opcoes(sel, valores, rotuloTodos, atual) {
    sel.innerHTML = `<option value="">${rotuloTodos}</option>` + valores.map((v) => `<option ${v === atual ? "selected" : ""} value="${U.esc(v)}">${U.esc(v)}</option>`).join("");
  }

  /* ---- seletores de Ano e Mês (seleção múltipla) ---- */
  const CARET = '<svg viewBox="0 0 10 6" width="9" height="6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

  function estruturaMsel(el, idRotulo) {
    el.innerHTML = `<button type="button" class="msel-btn" aria-haspopup="true" aria-expanded="false" aria-labelledby="${idRotulo} ${el.id}-txt"><span class="msel-txt" id="${el.id}-txt"></span>${CARET}</button>
      <div class="msel-pop" role="group" aria-labelledby="${idRotulo}" hidden></div>`;
  }

  function abre(el) {
    document.querySelectorAll(".msel.aberto").forEach((o) => { if (o !== el) fecha(o); });
    const pop = el.querySelector(".msel-pop");
    el.classList.add("aberto");
    el.querySelector(".msel-btn").setAttribute("aria-expanded", "true");
    pop.hidden = false;
    // se não couber à direita da janela, alinha o painel pela borda direita do botão
    pop.classList.remove("dir");
    if (pop.getBoundingClientRect().right > window.innerWidth - 8) pop.classList.add("dir");
  }

  function fecha(el, devolveFoco) {
    el.classList.remove("aberto");
    const b = el.querySelector(".msel-btn");
    b.setAttribute("aria-expanded", "false");
    el.querySelector(".msel-pop").hidden = true;
    if (devolveFoco) b.focus();
  }

  const caixa = (attrs, rotulo, marcado, extra = "") =>
    `<label class="mchk ${extra}"><input type="checkbox" ${attrs} ${marcado ? "checked" : ""}><span>${rotulo}</span></label>`;

  function montaAnos() {
    const anos = U.anosDisponiveis(), sel = U.state.anos;
    $("f-ano").querySelector(".msel-pop").innerHTML =
      caixa('data-todos="1"', "Todos os anos", !sel.length, "todos") +
      anos.slice().reverse().map((a) => caixa(`data-ano="${a}"`, a, sel.includes(a))).join("");
    rotulos();
  }

  // Lista de meses agrupada por ano (só os anos selecionados), 12 posições por ano para que o mesmo
  // mês fique alinhado entre os anos; meses sem dados aparecem desativados.
  function montaMeses() {
    U.sincronizaPeriodo();
    const existentes = new Set(U.todasChaves()), sel = new Set(U.state.meses);
    const anos = [...new Set(U.mesesDisponiveis().map((m) => m.split("-")[0]))];
    $("f-mes").querySelector(".msel-pop").innerHTML =
      caixa('data-todos="1"', "Todos os meses", !U.state.meses.length, "todos") +
      anos.map((a) => {
        const dispo = U.MES_CURTO.map((_, i) => `${a}-${String(i + 1).padStart(2, "0")}`).filter((m) => existentes.has(m));
        const todosAno = dispo.length && dispo.every((m) => sel.has(m));
        return `<div class="mgrupo" data-grupo="${a}">
          ${caixa(`data-grupo-ano="${a}"`, a, todosAno, "ano")}
          <div class="mgrade">${U.MES_CURTO.map((nome, i) => {
            const m = `${a}-${String(i + 1).padStart(2, "0")}`, existe = existentes.has(m);
            return `<label class="mchk mes ${existe ? "" : "vazio"}" title="${U.esc(U.mesLabel(m))}"><input type="checkbox" data-mes="${m}" aria-label="${U.esc(U.mesLabel(m))}" ${sel.has(m) ? "checked" : ""} ${existe ? "" : "disabled"}><span>${nome}</span></label>`;
          }).join("")}</div></div>`;
      }).join("");
    marcaGrupos();
    rotulos();
  }

  // estado "parcial" da caixa de cada ano (alguns meses marcados) e texto dos botões
  function marcaGrupos() {
    document.querySelectorAll("#f-mes .mgrupo").forEach((g) => {
      const ms = [...g.querySelectorAll("input[data-mes]:not(:disabled)")], n = ms.filter((i) => i.checked).length;
      const cab = g.querySelector("input[data-grupo-ano]");
      cab.checked = ms.length > 0 && n === ms.length;
      cab.indeterminate = n > 0 && n < ms.length;
    });
    const t = document.querySelector("#f-mes input[data-todos]");
    if (t) t.checked = !U.state.meses.length;
  }

  function rotulos() {
    const { anos, meses } = U.state;
    const ta = anos.length ? anos.slice().sort().join(", ") : "Todos os anos";
    $("f-ano-txt").textContent = ta;
    $("f-ano").querySelector(".msel-btn").title = ta;
    const tm = !meses.length ? "Todos os meses" : meses.length === 1 ? U.mesLabel(meses[0]) : meses.length <= 3 ? meses.map(U.mesCurto).join(", ") : `${meses.length} meses`;
    $("f-mes-txt").textContent = tm;
    $("f-mes").querySelector(".msel-btn").title = meses.length ? meses.map(U.mesLabel).join(", ") : tm;
  }

  function aoMudarAno(e) {
    const i = e.target;
    if (i.dataset.todos) U.state.anos = [];
    else {
      const a = i.dataset.ano, set = new Set(U.state.anos);
      i.checked ? set.add(a) : set.delete(a);
      U.state.anos = [...set].sort();
    }
    // reflete a seleção nas caixas sem refazer a lista (o foco do teclado não se perde)
    document.querySelectorAll("#f-ano input[data-ano]").forEach((x) => { x.checked = U.state.anos.includes(x.dataset.ano); });
    document.querySelector("#f-ano input[data-todos]").checked = !U.state.anos.length;
    montaMeses();
    montaFiltros();
    render();
  }

  function aoMudarMes(e) {
    const i = e.target, set = new Set(U.state.meses);
    if (i.dataset.todos) set.clear();
    else if (i.dataset.grupoAno) {
      document.querySelectorAll(`#f-mes .mgrupo[data-grupo="${i.dataset.grupoAno}"] input[data-mes]:not(:disabled)`)
        .forEach((x) => (i.checked ? set.add(x.dataset.mes) : set.delete(x.dataset.mes)));
    } else i.checked ? set.add(i.dataset.mes) : set.delete(i.dataset.mes);
    U.state.meses = [...set].sort();
    U.sincronizaPeriodo();
    // reflete a seleção nas caixas sem refazer a lista (o foco do teclado não se perde)
    document.querySelectorAll("#f-mes input[data-mes]").forEach((x) => { x.checked = set.has(x.dataset.mes); });
    marcaGrupos();
    rotulos();
    montaFiltros();
    render();
  }

  function montaFiltros() {
    const L = U.state.mes === "TODOS" ? U.todosColaboradores() : U.mesDados().colaboradores, f = U.state.filtros;
    const uniq = (k) => [...new Set(L.map((c) => c[k]))].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"));
    // se o período mudou e o valor filtrado não existe mais nele, o filtro volta para "Todos/Todas"
    [["area", "area"], ["turno", "turno"], ["situacao", "situacao"], ["funcao", "funcao"]]
      .forEach(([chave, campo]) => { if (f[chave] && !uniq(campo).includes(f[chave])) f[chave] = ""; });
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
    const rotuloPeriodo = U.periodoLabel();
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
    U.state.anos = [];
    U.state.meses = [];
    U.sincronizaPeriodo();
    estruturaMsel($("f-ano"), "l-ano");
    estruturaMsel($("f-mes"), "l-mes");
    montaAnos();
    montaMeses();
    $("side-foot").innerHTML = `Dados gerados em<br>${U.esc(DADOS.gerado_em)}<br>${U.todasChaves().length} ${U.todasChaves().length === 1 ? "mês" : "meses"} no histórico`;
    montaFiltros();

    $("nav").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { U.state.aba = b.dataset.aba; render(); } });
    $("f-ano").addEventListener("change", aoMudarAno);
    $("f-mes").addEventListener("change", aoMudarMes);
    document.querySelectorAll(".msel").forEach((el) => {
      el.querySelector(".msel-btn").addEventListener("click", () => (el.classList.contains("aberto") ? fecha(el) : abre(el)));
      el.addEventListener("keydown", (e) => { if (e.key === "Escape" && el.classList.contains("aberto")) { e.stopPropagation(); fecha(el, true); } });
      el.addEventListener("focusout", (e) => { if (e.relatedTarget && !el.contains(e.relatedTarget)) fecha(el); });
    });
    document.addEventListener("click", (e) => document.querySelectorAll(".msel.aberto").forEach((el) => { if (!el.contains(e.target)) fecha(el); }));
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