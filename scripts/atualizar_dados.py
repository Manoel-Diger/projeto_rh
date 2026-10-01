#!/usr/bin/env python3
"""
atualizar_dados.py  —  ATUALIZAÇÃO MENSAL DO DASHBOARD

Uso mais simples (recomendado):
    1. Coloque o PDF da folha do mês em  data/entrada/folha/
       (qualquer nome; o mês é lido de dentro do PDF)
    2. Se algo mudou (novos horários, admissões), atualize a planilha em
       data/entrada/cadastro/
    3. Execute:   python scripts/atualizar_dados.py
    4. Abra index.html

Opções:
    --folha ARQ.pdf [ARQ2.pdf ...]   processa apenas estes PDFs
    --base  ARQ.xlsx                 usa este cadastro
    --so-mes AAAA-MM                 reprocessa apenas um mês

O script guarda um JSON por mês em data/processado/ e regenera
data/processado/dados.js (lido pelo dashboard). Meses antigos são preservados,
então o histórico cresce sozinho.
"""
import argparse
import glob
import json
import os
import sys
from datetime import datetime

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__))

from parser_folha import ler_folha          # noqa: E402
from cadastro import ler_cadastro     # noqa: E402
from analises import monta_mes              # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def caminho(rel):
    return os.path.join(RAIZ, rel)


def carrega_config():
    with open(os.path.join(os.path.dirname(__file__), "config.json"), encoding="utf-8") as f:
        return json.load(f)


def mais_recente(padrao_lista):
    achados = []
    for p in padrao_lista:
        achados += glob.glob(p)
    achados = [a for a in achados if not os.path.basename(a).startswith("~$")]
    return max(achados, key=os.path.getmtime) if achados else None


def main():
    ap = argparse.ArgumentParser(description="Atualiza os dados do dashboard RH – HE Belém")
    ap.add_argument("--folha", nargs="*", help="PDF(s) da folha")
    ap.add_argument("--base", help="Planilha de cadastro (.xlsx)")
    ap.add_argument("--so-mes", help="Reprocessa apenas o mês AAAA-MM")
    args = ap.parse_args()

    cfg = carrega_config()
    arq = cfg["arquivos"]

    pdfs = args.folha or sorted(glob.glob(caminho(os.path.join(arq["pasta_folhas"], "*.pdf"))))
    if not pdfs:
        sys.exit(f"ERRO: nenhum PDF de folha encontrado em {arq['pasta_folhas']}/")

    base_arq = args.base or mais_recente([caminho(os.path.join(arq["pasta_cadastro"], "*.xlsx")),
                                          caminho(os.path.join(arq["pasta_cadastro"], "*.xlsm"))])
    if not base_arq:
        sys.exit(f"ERRO: nenhum cadastro (.xlsx) encontrada em {arq['pasta_cadastro']}/")

    print(f"Cadastro    : {os.path.relpath(base_arq, RAIZ)}")
    base = ler_cadastro(base_arq, arq["abas_cadastro_aceitas"], cfg["regras"]["intervalo_minutos"])
    pend = sum(1 for r in base["registros"] if not r["horario"]["definido"])
    print(f"  aba '{base['aba']}': {len(base['registros'])} colaboradores, {pend} com horário pendente")

    saida = caminho(arq["pasta_saida"])
    os.makedirs(saida, exist_ok=True)

    for pdf in pdfs:
        print(f"\nFolha       : {os.path.relpath(pdf, RAIZ)}")
        folha = ler_folha(pdf)
        if folha.get("paginas_ocr"):
            print(f"  aviso: {folha['paginas_ocr']} página(s) sem camada de texto — lida(s) via OCR (Tesseract)")
        if folha.get("ocr_divergencia"):
            d = folha["ocr_divergencia"]
            print(f"  aviso: OCR leu {d['lido']} colaborador(es), mas o Resumo dos Eventos indica {d['esperado']} — "
                  "confira este mês na aba Qualidade antes de fechar a folha.")
        if not folha["periodo"] or not folha["colaboradores"]:
            if folha.get("ocr_indisponivel"):
                print("  ! PDF ignorado: este arquivo não tem texto extraível (só imagem/traçado) e o "
                      "Tesseract OCR não foi encontrado nesta máquina.")
                print("    Instale o Tesseract OCR (e rode 'pip install pytesseract') para conseguir ler este PDF; "
                      "veja o README.")
            else:
                print("  ! PDF ignorado: não foi possível ler período/colaboradores (layout diferente?)")
            continue
        mes = folha["periodo"]["mes"]
        if args.so_mes and args.so_mes != mes:
            continue
        dados = monta_mes(folha, base, cfg, os.path.basename(pdf), os.path.basename(base_arq))
        q = dados["qualidade"]
        he = sum(c["he_total"] for c in dados["colaboradores"])
        print(f"  mês {mes}: {len(dados['colaboradores'])} colaboradores | HE + DSR = R$ {he:,.2f}")
        print(f"  conferência com o resumo da folha: {'OK' if q['reconciliacao_ok'] else 'DIVERGENTE'}")
        if q["sem_base"]:
            print(f"  ! {len(q['sem_base'])} da folha não encontrados no cadastro: {q['sem_base'][:5]}")
        if q["sem_folha"]:
            print(f"  ! {len(q['sem_folha'])} do cadastro não estão na folha: {q['sem_folha'][:5]}")
        with open(os.path.join(saida, f"{mes}.json"), "w", encoding="utf-8") as f:
            json.dump(dados, f, ensure_ascii=False, indent=1)

    # ---- consolida todos os meses em dados.js ----
    meses = {}
    for arquivo in sorted(glob.glob(os.path.join(saida, "????-??.json"))):
        with open(arquivo, encoding="utf-8") as f:
            d = json.load(f)
        meses[d["mes"]] = d
    if not meses:
        sys.exit("ERRO: nenhum mês processado.")
    pacote = {
        "gerado_em": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "filial": cfg["filial"],
        "config": {"regras": cfg["regras"], "simulacao": cfg["simulacao_turno"]},
        "ultimo_mes": max(meses),
        "meses": meses,
    }
    js = "window.DADOS = " + json.dumps(pacote, ensure_ascii=False) + ";\n"
    with open(os.path.join(saida, "dados.js"), "w", encoding="utf-8") as f:
        f.write(js)
    with open(os.path.join(saida, "dados.json"), "w", encoding="utf-8") as f:
        json.dump(pacote, f, ensure_ascii=False)
    print(f"\nOK — {len(meses)} mês(es) no dashboard: {', '.join(sorted(meses))}")
    print("Abra index.html no navegador.")


if __name__ == "__main__":
    main()
