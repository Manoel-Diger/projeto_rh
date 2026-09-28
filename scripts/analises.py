"""
analises.py
Cruza folha (PDF) x Base Mestra (Excel), calcula os indicadores por colaborador,
confere os totais com o resumo oficial da folha e gera os insights automáticos.
"""
from collections import defaultdict
from datetime import datetime

from base_mestra import normaliza_nome
from parser_folha import soma_por_codigo


def _soma(eventos, codigos, campo, tp=None):
    return round(sum((e[campo] or 0.0) for e in eventos
                     if e["cod"] in codigos and (tp is None or e["tp"] == tp)), 2)


def classifica_area(funcao, regras):
    f = (funcao or "").upper()
    for area, palavras in regras.items():
        if area.startswith("_"):
            continue
        if any(p in f for p in palavras):
            return area
    return "Outros"


def consolida(folha, base, cfg):
    ev, rg = cfg["eventos_folha"], cfg["regras"]
    base_por_nome = {r["chave"]: r for r in base["registros"]}
    usados = set()
    lista, sem_base, sal_div = [], [], []

    for c in folha["colaboradores"]:
        chave = normaliza_nome(c["nome"])
        b = base_por_nome.get(chave)
        if b:
            usados.add(chave)
        else:
            sem_base.append(c["nome"])
        e = c["eventos"]
        salario = c["salario_base"] or (b["salario"] if b else 0.0)
        if b and b["salario"] and abs(b["salario"] - c["salario_base"]) > 0.01:
            sal_div.append({"nome": c["nome"], "folha": c["salario_base"], "base": b["salario"]})

        he_bh_h, he_bh_v = _soma(e, ev["he_banco_horas_50"], "ref"), _soma(e, ev["he_banco_horas_50"], "valor")
        he50_cods = [x for x in ev["he_50"] if x not in ev["he_banco_horas_50"]]
        he50_h, he50_v = _soma(e, he50_cods, "ref"), _soma(e, he50_cods, "valor")
        he100_h, he100_v = _soma(e, ev["he_100"], "ref"), _soma(e, ev["he_100"], "valor")
        he_h = round(he_bh_h + he50_h + he100_h, 2)
        he_v = round(he_bh_v + he50_v + he100_v, 2)
        dsr = _soma(e, ev["dsr_he"], "valor")
        proventos = c["totais"].get("proventos", 0.0) + c["totais"].get("vantagens", 0.0)
        resc = _soma(e, ev["rescisao"], "valor")
        d13 = _soma(e, ev["decimo_terceiro_adiantado"], "valor")
        remun = round(proventos - resc - d13, 2)
        hor = b["horario"] if b else {"texto": "", "definido": False, "turno": "Pendente",
                                      "entrada": None, "saida": None, "horas_dia": None, "blocos": []}
        funcao = c["cargo"] or (b["funcao"] if b else "")
        he_total = round(he_v + dsr, 2)
        lista.append({
            "matricula": c["matricula"], "nome": c["nome"], "funcao": funcao,
            "area": classifica_area(funcao, cfg["areas_por_palavra_chave"]),
            "situacao": c["situacao"], "admissao": c["admissao"], "demissao": c["demissao"],
            "horario": hor["texto"], "horario_definido": hor["definido"], "turno": hor["turno"],
            "entrada": hor["entrada"], "saida": hor["saida"], "horas_dia": hor["horas_dia"],
            "blocos": hor["blocos"],
            "salario": salario,
            "valor_hora": round(salario / rg["divisor_hora_mensal"], 4) if salario else 0.0,
            "he_bh_h": he_bh_h, "he_bh_v": he_bh_v, "he50_h": he50_h, "he50_v": he50_v,
            "he100_h": he100_h, "he100_v": he100_v,
            "he_h": he_h, "he_v": he_v, "dsr_he": dsr, "he_total": he_total,
            "he_pct_salario": round(he_total / salario * 100, 1) if salario else 0.0,
            "acima_limite": he_h > rg["limite_he_mes_horas"],
            "noturno_v": _soma(e, ev["adicional_noturno"] + ev["hora_reduzida_noturna"] + ev["dsr_noturno"], "valor"),
            "noturno_h": _soma(e, ev["adicional_noturno"], "ref"),
            "atrasos_h": _soma(e, ev["atrasos"], "ref"), "atrasos_v": _soma(e, ev["atrasos"], "valor"),
            "faltas_h": _soma(e, ev["faltas"], "ref"),
            "faltas_v": round(_soma(e, ev["faltas"], "valor") + _soma(e, ev["faltas_dsr"], "valor"), 2),
            "atestado_h": _soma(e, ev["atestado"], "ref"),
            "multa_v": _soma(e, ev["multa_transito"], "valor"),
            "horas_normais": _soma(e, ev["horas_normais"], "ref"),
            "horas_ferias": _soma(e, ev["horas_ferias"], "ref"),
            "remuneracao": remun, "rescisao": resc,
            "f_reg": c["f_reg"],
        })

    sem_folha = [r["nome"] for r in base["registros"] if r["chave"] not in usados]
    return lista, {"sem_base": sem_base, "sem_folha": sem_folha, "salario_divergente": sal_div}


def confere_resumo(folha, cfg):
    """Compara soma dos colaboradores com o 'Resumo dos Eventos' impresso pela folha."""
    soma = soma_por_codigo(folha["colaboradores"])
    nomes = {34: "Horas Extras 50%", 36: "Horas Extras 100%", 39: "Horas Extras c/ 50% BH",
             65: "DSR sobre HE", 60: "Adicional Noturno", 126: "Saldo de Salário"}
    saida = []
    for cod, nome in nomes.items():
        r = folha["resumo"].get(cod)
        if not r:
            continue
        saida.append({
            "cod": cod, "evento": nome,
            "valor_colaboradores": round(soma[cod]["valor"], 2), "valor_resumo": r["valor"],
            "ok_valor": abs(soma[cod]["valor"] - r["valor"]) < 0.05,
            "horas_colaboradores": round(soma[cod]["ref"], 2), "horas_resumo": r["ref"],
        })
    return saida


def _fmt(v):
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _n(v, casas=1):
    """Número no padrão pt-BR (vírgula decimal, ponto de milhar)."""
    return f"{v:,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def gera_insights(lista, cfg, qual):
    rg = cfg["regras"]
    lim = rg["limite_he_mes_horas"]
    ativos = [c for c in lista if c["situacao"] != "Demitido"]
    total_he = sum(c["he_total"] for c in lista)
    he_v = sum(c["he_v"] for c in lista)
    dsr = sum(c["dsr_he"] for c in lista)
    remun = sum(c["remuneracao"] for c in lista) or 1
    ins = []

    ins.append({"nivel": "info", "tema": "Custos", "titulo": f"HE + DSR equivalem a {_n(total_he / remun * 100)}% da remuneração bruta",
                "texto": f"Total de {_fmt(total_he)}: {_fmt(he_v)} em HE e {_fmt(dsr)} em DSR. "
                         f"O DSR adiciona R$ {_n(dsr / he_v, 2)} para cada R$ 1,00 pago em HE."})

    com_he = sorted([c for c in lista if c["he_total"] > 0], key=lambda c: -c["he_total"])
    if com_he:
        top = com_he[:10]
        top10 = sum(c["he_total"] for c in top)
        ins.append({"nivel": "alto" if top10 / total_he > 0.3 else "medio", "tema": "Concentração",
                    "titulo": f"{len(top)} colaboradores concentram {top10 / total_he * 100:.0f}% do custo de HE",
                    "texto": f"Os {len(top)} maiores custos somam {_fmt(top10)} de {_fmt(total_he)}. "
                             f"{len(com_he)} de {len(lista)} colaboradores tiveram HE no mês. "
                             f"Maior custo individual: {com_he[0]['nome'].title()} ({_fmt(com_he[0]['he_total'])})."})

    acima = [c for c in lista if c["acima_limite"]]
    if acima:
        exc = sum(c["he_h"] - lim for c in acima)
        ins.append({"nivel": "alto", "tema": "Conformidade", "titulo": f"{len(acima)} colaboradores acima de {lim} h de HE no mês",
                    "texto": f"Excesso total de {exc:.0f} h sobre a referência de {lim} h/mês (2 h por dia útil). "
                             "Verificar enquadramento em acordo de compensação ou banco de horas."})

    por_turno = defaultdict(lambda: {"n": 0, "he": 0.0, "h": 0.0})
    for c in ativos:
        t = por_turno[c["turno"]]
        t["n"] += 1; t["he"] += c["he_total"]; t["h"] += c["he_h"]
    tarde, manha = por_turno.get("Tarde"), por_turno.get("Manhã/Comercial")
    if tarde and manha and tarde["n"] and manha["n"]:
        mt, mm = tarde["h"] / tarde["n"], manha["h"] / manha["n"]
        ins.append({"nivel": "medio", "tema": "Jornadas", "titulo": f"HE por colaborador: tarde {_n(mt)} h x comercial {_n(mm)} h",
                    "texto": f"Tarde (12h–21h e similares): {tarde['n']} colaboradores, média de {_n(mt)} h de HE. "
                             f"Comercial: {manha['n']} colaboradores, média de {_n(mm)} h. Considera apenas horários confirmados."})

    por_hor = defaultdict(lambda: {"n": 0, "h": 0.0})
    for c in ativos:
        if c["horario_definido"]:
            por_hor[c["horario"]]["n"] += 1
            por_hor[c["horario"]]["h"] += c["he_h"]
    tot_h_def = sum(v["h"] for v in por_hor.values())
    if por_hor and tot_h_def:
        hor, d = max(por_hor.items(), key=lambda kv: kv[1]["h"])
        ins.append({"nivel": "alto", "tema": "Jornadas", "titulo": f"{hor} concentra {d['h'] / tot_h_def * 100:.0f}% das horas de HE entre os horários confirmados",
                    "texto": f"{d['n']} colaboradores em {hor} somam {d['h']:.0f} h de HE, média de {_n(d['h'] / d['n'])} h por colaborador."})

    por_area = defaultdict(lambda: {"n": 0, "h": 0.0, "v": 0.0})
    for c in ativos:
        a = por_area[c["area"]]
        a["n"] += 1; a["h"] += c["he_h"]; a["v"] += c["he_total"]
    if por_area:
        area, d = max(por_area.items(), key=lambda kv: kv[1]["v"])
        ins.append({"nivel": "info", "tema": "Áreas", "titulo": f"{area} tem o maior custo de HE",
                    "texto": f"{area} soma {_fmt(d['v'])} ({d['v'] / total_he * 100:.0f}% do total), com média de {_n(d['h'] / d['n'])} h de HE por colaborador."})

    pend = [c for c in lista if not c["horario_definido"] and c["situacao"] != "Demitido"]
    if pend:
        ins.append({"nivel": "medio", "tema": "Dados", "titulo": f"{len(pend)} colaboradores sem horário confirmado",
                    "texto": f"Correspondem a {len(pend) / len(ativos) * 100:.0f}% do quadro ativo e ficam fora das análises de turno e da simulação "
                             "até o horário ser confirmado no cartão-ponto e cadastrado na Base Mestra."})

    ausencia_v = sum(c["atrasos_v"] + c["faltas_v"] for c in lista)
    atrasos_h = sum(c["atrasos_h"] for c in lista)
    n_atr = len([c for c in lista if c["atrasos_h"] > 0])
    ins.append({"nivel": "info", "tema": "Absenteísmo", "titulo": "Faltas, atrasos e atestados",
                "texto": f"{n_atr} colaboradores com atraso ou saída antecipada ({atrasos_h:.0f} h no total). "
                         f"Desconto de faltas e atrasos: {_fmt(ausencia_v)}. Atestados: {sum(c['atestado_h'] for c in lista):.0f} h."})

    multas = [c for c in lista if c["multa_v"] > 0]
    if multas:
        ins.append({"nivel": "medio", "tema": "Frota", "titulo": "Multas de trânsito descontadas em folha",
                    "texto": f"{len(multas)} colaboradores com desconto de multa, total de {_fmt(sum(c['multa_v'] for c in multas))}."})

    ap = [c for c in lista if c["area"] == "Aprendizes" and c["he_h"] > 0]
    if ap:
        ins.append({"nivel": "alto", "tema": "Conformidade", "titulo": "Aprendiz com horas extras",
                    "texto": f"{len(ap)} colaborador(es) da área Aprendizes com HE lançada ({sum(c['he_h'] for c in ap):.0f} h). "
                             "A prorrogação de jornada de aprendiz é vedada, salvo exceções legais. Revisar os lançamentos."})

    n100 = [c for c in lista if c["he100_h"] > 0]
    if n100:
        ins.append({"nivel": "info", "tema": "Custos", "titulo": "HE a 100%",
                    "texto": f"{len(n100)} colaboradores com HE a 100% ({sum(c['he100_h'] for c in n100):.0f} h, {_fmt(sum(c['he100_v'] for c in n100))}). "
                             "Validar se correspondem a trabalho programado em domingos e feriados."})

    desl = [c for c in lista if c["situacao"] == "Demitido"]
    adm_mes = [c for c in lista if c["admissao"][3:] == cfg["_mes_ref"][5:7] + "/" + cfg["_mes_ref"][:4]]
    if desl or adm_mes:
        ins.append({"nivel": "info", "tema": "Pessoas", "titulo": "Movimentação do quadro no mês",
                    "texto": f"{len(adm_mes)} admissões e {len(desl)} desligamentos. "
                             f"Rescisões: {_fmt(sum(c['rescisao'] for c in lista))} (fora da remuneração bruta de referência)."})

    if not qual["reconciliacao_ok"]:
        ins.insert(0, {"nivel": "alto", "tema": "Dados", "titulo": "Conferência da folha com divergência",
                       "texto": "A soma por colaborador diverge do Resumo dos Eventos da folha em ao menos um evento. Detalhes na aba Qualidade dos dados."})
    return ins


def monta_mes(folha, base, cfg, arquivo_pdf, arquivo_base):
    mes = folha["periodo"]["mes"]
    cfg = {**cfg, "_mes_ref": mes}
    lista, cruz = consolida(folha, base, cfg)
    rec = confere_resumo(folha, cfg)
    freg = [{"nome": c["nome"], "matricula": c["matricula"], "f_reg": c["f_reg"]}
            for c in lista if c["f_reg"] and int(c["f_reg"]) != int(c["matricula"])]
    qual = {
        "reconciliacao": rec,
        "reconciliacao_ok": all(r["ok_valor"] for r in rec),
        "colaboradores_folha": len(folha["colaboradores"]),
        "colaboradores_base": len(base["registros"]),
        "situacoes": folha["situacoes"],
        "sem_base": cruz["sem_base"], "sem_folha": cruz["sem_folha"],
        "salario_divergente": cruz["salario_divergente"],
        "horarios_pendentes": [c["nome"] for c in lista if not c["horario_definido"]],
        "matricula_x_freg": freg,
        "nota_horas": "Conferência feita sobre os valores em R$. As horas por colaborador podem divergir do resumo da folha em menos de 1%, por arredondamento do relatório de origem.",
    }
    return {
        "mes": mes, "periodo": folha["periodo"],
        "gerado_em": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "fonte": {"folha": arquivo_pdf, "base_mestra": arquivo_base, "aba": base["aba"]},
        "colaboradores": lista, "qualidade": qual,
        "insights": gera_insights(lista, cfg, qual),
    }
