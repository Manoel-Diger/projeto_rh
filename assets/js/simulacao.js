/* simulacao.js – simulação da mudança de turno 12h–21h → 13h–22h */
(function (G) {
  const Sim = { p: null };

  Sim.cfg = () => ({ ...G.DADOS.config.simulacao, encargos: G.DADOS.config.regras.encargos_sobre_he_pct });

  Sim.reset = () => {
    const c = Sim.cfg();
    Sim.p = {
      abs: c.pct_he_absorvida, apos22: c.pct_he_restante_apos_22h, adic: c.adicional_noturno_pct,
      dias: c.dias_uteis_mes, janela: c.janela_absorvivel_horas_dia, custoDia: c.custo_extra_dia_por_colaborador, enc: c.encargos,
    };
  };

  Sim.grupo = (L) => {
    const migra = new Set(Sim.cfg().horarios_que_migram);
    return L.filter((c) => migra.has(c.horario) && (c.situacao === "Trabalhando" || c.situacao === "Férias"));
  };

  Sim.calcular = (L, p) => {
    const g = Sim.grupo(L);
    let eco = 0, noturno = 0, absH = 0, heH = 0, heAtual = 0;
    const linhas = g.map((c) => {
      const ratio = c.he_v ? c.dsr_he / c.he_v : 0;
      const vhe = c.he_h ? c.he_v / c.he_h : 0;
      const a = Math.min(c.he_h * (p.abs / 100), p.janela * p.dias);
      const e = a * vhe * (1 + ratio) * (1 + p.enc / 100);
      const resto = (c.he_h - a) * (p.apos22 / 100);
      const nt = resto * c.valor_hora * 1.5 * (p.adic / 100) * (1 + p.enc / 100);
      eco += e; noturno += nt; absH += a; heH += c.he_h; heAtual += c.he_total;
      return { nome: c.nome, funcao: c.funcao, he_h: c.he_h, he_total: c.he_total, absH: a, eco: e, noturno: nt, liquido: e - nt };
    });
    const extraDia = g.length * p.dias * p.custoDia;
    const liquido = eco - noturno - extraDia;
    return { n: g.length, heAtual, heH, absH, eco, noturno, extraDia, liquido, anual: liquido * 12, linhas };
  };

  Sim.equilibrio = (L, p) => {
    for (let x = 0; x <= 100; x++) if (Sim.calcular(L, { ...p, abs: x }).liquido >= 0) return x;
    return null;
  };

  Sim.prepara = (L) => {
    const c = Sim.cfg();
    const ex = L.find((x) => c.horarios_que_migram.includes(x.horario) && x.entrada != null);
    const m = /(\d{1,2})h/.exec(c.horario_proposto || "13h");
    c._deltaEntrada = ex && m ? +m[1] - ex.entrada : 1;
    return c;
  };

  const slider = (id, rot, min, max, step, val, sufixo) => `
    <div class="linha"><label for="${id}">${rot}<b id="${id}-v">${val}${sufixo}</b></label>
    <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-sufixo="${sufixo}"></div>`;

  Sim.render = (view) => {
    if (!Sim.p) Sim.reset();
    const L = U.mesDados().colaboradores, cfg = Sim.prepara(L), g = Sim.grupo(L);
    const pend = L.filter((c) => !c.horario_definido && c.situacao !== "Demitido").length;
    const p = Sim.p;

    view.innerHTML = `
      <div class="aviso"><b>Premissa central.</b> A folha registra <i>quantas</i> horas extras cada colaborador fez, mas não <i>em que horário</i>. O percentual das HE do grupo 12h–21h
      absorvido pela jornada normal das 21h–22h é, portanto, uma <b>premissa ajustável</b> (barra abaixo), não um dado medido. Para calibrar, apurar no cartão-ponto as HE realizadas
      entre 21h e 22h pelo grupo e informar o percentual. ${pend ? `${pend} colaboradores sem horário confirmado ficam fora do grupo.` : ""}</div>

      <div class="sim-layout">
        <div class="card ctl">
          <div><h3>Premissas</h3><p class="sub">O resultado é recalculado a cada alteração.</p></div>
          ${slider("s-abs", "HE absorvidas pela jornada normal (21h–22h)", 0, 100, 1, p.abs, "%")}
          ${slider("s-apos", "HE restantes realizadas após 22h (noturnas)", 0, 100, 1, p.apos22, "%")}
          ${slider("s-adic", "Adicional noturno", 0, 50, 1, p.adic, "%")}
          ${slider("s-dias", "Dias trabalhados no mês", 18, 26, 1, p.dias, "")}
          <div class="linha"><label for="s-custo">Custo adicional por colaborador/dia (jantar, transporte)</label><input id="s-custo" type="number" min="0" step="0.5" value="${p.custoDia}"></div>
          <div class="linha"><label for="s-enc">Encargos sobre HE (%)</label><input id="s-enc" type="number" min="0" step="0.5" value="${p.enc}"></div>
          <button class="btn" id="s-reset" type="button">Voltar às premissas padrão</button>
          <div class="rodape-nota">Grupo simulado: <b>${g.length}</b> colaboradores em <b>${U.esc(cfg.horarios_que_migram.join(", "))}</b> → <b>${U.esc(cfg.horario_proposto)}</b>.
          Demais horários (08h–17h etc.) mantidos.</div>
        </div>

        <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
          <div id="sim-res" style="display:flex;flex-direction:column;gap:16px"></div>
          <div class="card">
            <h3>Cobertura ao longo do dia</h3>
            <p class="sub">Colaboradores por hora: cenário atual (08h–17h + 12h–21h) x proposto (08h–17h + 13h–22h). Presença nominal, sem desconto de intervalos.</p>
            <div class="chart"><canvas id="c-cob"></canvas></div>
            <div id="sim-cob-nota" class="rodape-nota" style="margin-top:8px"></div>
          </div>
          <div class="card">
            <h3>Pontos de atenção</h3>
            <ul class="lista">
              <li><b>Saída da faixa 12h–13h</b>: reduz a cobertura no início da tarde (ver gráfico).</li>
              <li><b>Entrada da faixa 21h–22h</b> na jornada normal, hoje coberta por HE ou sem cobertura.</li>
              <li><b>Após as 22h incide adicional noturno</b> (20%) e hora reduzida de 52min30s. HE mantidas depois desse horário têm custo por hora maior.</li>
              <li>Custos fora da folha: <b>transporte e segurança no retorno noturno</b>, jantar e eventual revisão do vale-transporte.</li>
              <li>A alteração de horário depende de validação com Jurídico/RH, do acordo coletivo (se aplicável) e de comunicação prévia à equipe.</li>
            </ul>
          </div>
        </div>
      </div>`;

    // cobertura (não depende dos sliders)
    const at = U.cobertura(L, "atual", cfg), pr = U.cobertura(L, "proposto", cfg);
    const K = C.cores();
    C.multi("c-cob", at.map((x) => x.h + "h"), [
      { nome: "Atual (12h–21h)", dados: at.map((x) => x.total), cor: K.atual },
      { nome: "Proposto (13h–22h)", dados: pr.map((x) => x.total), cor: K.proposto },
    ]);
    const dif = pr.map((x, i) => ({ h: x.h, d: x.total - at[i].total })).filter((x) => x.d !== 0);
    document.getElementById("sim-cob-nota").textContent = dif.length
      ? "Diferenças: " + dif.map((x) => `${x.h}h ${x.d > 0 ? "+" : ""}${x.d}`).join(" · ")
      : "Sem diferença de cobertura entre os cenários (horários confirmados).";

    const ligar = (id, chave, num) => {
      const el = document.getElementById(id);
      el.addEventListener("input", () => {
        Sim.p[chave] = parseFloat(el.value) || 0;
        const v = document.getElementById(id + "-v");
        if (v) v.textContent = el.value + (el.dataset.sufixo || "");
        Sim.resultado();
      });
    };
    ligar("s-abs", "abs"); ligar("s-apos", "apos22"); ligar("s-adic", "adic"); ligar("s-dias", "dias");
    ligar("s-custo", "custoDia"); ligar("s-enc", "enc");
    document.getElementById("s-reset").addEventListener("click", () => { Sim.reset(); Sim.render(view); });
    Sim.resultado();
  };

  Sim.resultado = () => {
    const L = U.mesDados().colaboradores, p = Sim.p;
    const r = Sim.calcular(L, p), totH = U.soma(L, "he_h");
    const eq = Sim.equilibrio(L, p);
    const cen = [15, 30, 50].map((x) => ({ x, r: Sim.calcular(L, { ...p, abs: x }) }));
    const cls = r.liquido >= 0 ? "pos" : "neg";
    const tabela = U.tabela("sim", [
      { k: "nome", t: "Colaborador", f: (x) => U.esc(U.titulo(x.nome)) },
      { k: "funcao", t: "Função", f: (x) => U.esc(U.titulo(x.funcao)) },
      { k: "he_h", t: "HE atuais (h)", n: 1, f: (x) => U.n1(x.he_h) },
      { k: "he_total", t: "Custo HE atual", n: 1, f: (x) => U.brl(x.he_total) },
      { k: "absH", t: "HE absorvidas (h)", n: 1, f: (x) => U.n1(x.absH) },
      { k: "eco", t: "Economia", n: 1, f: (x) => U.brl(x.eco) },
      { k: "noturno", t: "Custo noturno", n: 1, f: (x) => U.brl(x.noturno) },
      { k: "liquido", t: "Resultado", n: 1, f: (x) => `<b>${U.brl(x.liquido)}</b>` },
    ], r.linhas, { sortKey: "liquido" });

    document.getElementById("sim-res").innerHTML = `
      <div class="card">
        <div class="secao"><h3>Resultado estimado por mês</h3><span class="pill ${r.liquido >= 0 ? "ok" : "warn"}">${r.liquido >= 0 ? "Economia" : "Custo adicional"}</span></div>
        <div class="resultado ${cls} num">${U.brl(r.liquido)}</div>
        <p class="sub" style="margin-top:2px">≈ ${U.brl0(r.anual)} em 12 meses, mantido o padrão do mês. Base: HE atual do grupo = ${U.brl(r.heAtual)} (${U.n1(r.heH)} h), equivalente a <b>${U.pct(totH ? (r.heH / totH) * 100 : 0)}</b> das horas de HE da filial, que é o alcance máximo da mudança.</p>
        <div class="grid g-3" style="margin-top:6px">
          <div><small class="rodape-nota">Economia com HE absorvidas</small><div><b class="num">${U.brl(r.eco)}</b></div><small class="rodape-nota">${U.n1(r.absH)} h passam para a jornada normal</small></div>
          <div><small class="rodape-nota">Custo de HE noturnas (após 22h)</small><div><b class="num">${U.brl(r.noturno)}</b></div></div>
          <div><small class="rodape-nota">Custos adicionais de operação</small><div><b class="num">${U.brl(r.extraDia)}</b></div></div>
        </div>
        <p class="rodape-nota" style="margin-top:10px">${eq === null ? "Com estas premissas, nenhum percentual de absorção equilibra o resultado." : eq === 0 ? "Resultado positivo mesmo com 0% de absorção." : `Ponto de equilíbrio: absorção mínima de <b>${eq}%</b> das HE do grupo.`}</p>
      </div>
      <div class="card">
        <h3>Cenários de absorção</h3><p class="sub">Mesmas premissas de custo; varia apenas o percentual de HE absorvidas.</p>
        <div class="cen">${cen.map((c) => `<div class="${Math.round(p.abs) === c.x ? "ativo" : ""}"><small>${c.x}% absorvido</small><b class="num" style="color:${c.r.liquido >= 0 ? "var(--ok)" : "var(--alerta)"}">${U.brl0(c.r.liquido)}</b><small>/mês · ${U.brl0(c.r.anual)}/ano</small></div>`).join("")}</div>
      </div>
      <div class="card"><h3>Efeito por colaborador do grupo</h3><p class="sub">Colaboradores atualmente em ${U.esc(Sim.cfg().horarios_que_migram.join(", "))}.</p>${tabela}</div>`;
  };

  G.Sim = Sim;
})(window);
