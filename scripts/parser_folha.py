"""
parser_folha.py
Lê o PDF "prévia da folha" (relatório FPRF001) e devolve, por colaborador,
todos os eventos (proventos, vantagens e descontos) com referência e valor.

Estratégia: usa a POSIÇÃO das palavras na página (coordenadas x), e não o
texto corrido. O relatório tem duas tabelas lado a lado (esquerda = proventos,
direita = descontos); separar pelas coordenadas é bem mais confiável do que
depender de espaços no texto.

Fallback por OCR: alguns PDFs chegam sem nenhuma camada de texto (ex.: gerados
por "imprimir em PDF" a partir de uma pré-visualização, com o conteúdo
desenhado como traçado/imagem e, às vezes, rotacionado). Para essas páginas
específicas, o texto é obtido via OCR (Tesseract, através do pacote
`pytesseract`) em vez de `extract_words`. Páginas com texto normal continuam
sendo lidas do jeito de sempre — o OCR só entra quando a extração de texto
não encontra nada.
"""
import re
from collections import defaultdict

import pdfplumber

NUM = re.compile(r"^-?\d{1,3}(?:\.\d{3})*,\d{2}$")
DATA = r"(\d{2}/\d{2}/\d{4})"


def num(txt):
    """'1.728,02' -> 1728.02"""
    return float(txt.replace(".", "").replace(",", "."))


def normalizar_nome(nome):
    """Higieniza o nome para evitar desencontros por falta de espaço ou caixa alta/baixa."""
    if not nome:
        return ""
    nome = re.sub(r"\s+", " ", nome.strip().upper())
    # Trata junções comuns de preposição
    nome = (
        nome.replace(" DEOLIVEIRA ", " DE OLIVEIRA ")
        .replace(" DOSCANTOS ", " DOS SANTOS ")
        .replace(" DASILVA ", " DA SILVA ")
    )
    return nome


def _extrai_palavras_normal(pagina):
    # Desativa processamento de curvas/imagens para acelerar e evitar travamentos do pdfminer
    return pagina.extract_words(
        keep_blank_chars=False,
        use_text_flow=False,
        extra_attrs=[],
        split_at_punctuation=False,
    )


def _ocr_disponivel():
    try:
        import pytesseract  # noqa: F401
        return True
    except ImportError:
        return False


def _ocr_dados_imagem(imagem):
    """Roda o Tesseract sobre a imagem; tenta português e cai para inglês se o
    pacote de idioma 'por' não estiver instalado no sistema."""
    import pytesseract
    for idioma in ("por", "eng"):
        try:
            return pytesseract.image_to_data(imagem, lang=idioma, output_type=pytesseract.Output.DICT)
        except Exception:
            continue
    return None


def _pontua_ocr(dados):
    """Pontua um resultado de OCR pela presença de termos típicos deste relatório —
    usado só para escolher a rotação correta da página, não a leitura final."""
    if not dados:
        return 0
    chaves = ("Colaborador", "Refer", "Valor", "Proventos", "Descontos", "Per", "Sal")
    texto = " ".join(t for t in dados.get("text", []) if t)
    return sum(texto.count(ch) for ch in chaves)


def _detecta_rotacao(pagina, resolution=150):
    """Testa as 4 rotações possíveis em baixa resolução e devolve a que produz
    mais palavras-chave reconhecíveis (0 quando a página já está na orientação certa)."""
    try:
        img = pagina.to_image(resolution=resolution).original
    except Exception:
        return 0
    melhor_angulo, melhor_pontos = 0, -1
    for angulo in (0, 90, 180, 270):
        imagem = img.rotate(-angulo, expand=True) if angulo else img
        pontos = _pontua_ocr(_ocr_dados_imagem(imagem))
        if pontos > melhor_pontos:
            melhor_angulo, melhor_pontos = angulo, pontos
    return melhor_angulo


def _ocr_palavras_pagina(pagina, cache_rotacao, resolution=300):
    """Extrai palavras de uma página sem texto via OCR, devolvendo-as no mesmo
    formato de `extract_words` (x0/x1/top/bottom em pontos) e a largura efetiva
    da página (necessária para separar as duas tabelas lado a lado)."""
    if not _ocr_disponivel():
        cache_rotacao["indisponivel"] = True
        return [], pagina.width
    try:
        img = pagina.to_image(resolution=resolution).original
    except Exception:
        return [], pagina.width

    if not cache_rotacao["detectado"]:
        cache_rotacao["angulo"] = _detecta_rotacao(pagina)
        cache_rotacao["detectado"] = True
    angulo = cache_rotacao["angulo"]

    imagem = img.rotate(-angulo, expand=True) if angulo else img
    dados = _ocr_dados_imagem(imagem)
    if not dados:
        return [], pagina.width

    escala = resolution / 72.0
    palavras = []
    n = len(dados.get("text", []))
    confs = dados.get("conf", ["-1"] * n)
    for i in range(n):
        txt = (dados["text"][i] or "").strip()
        if not txt:
            continue
        try:
            if float(confs[i]) < 0:
                continue
        except (TypeError, ValueError):
            pass
        x, y, w, h = dados["left"][i], dados["top"][i], dados["width"][i], dados["height"][i]
        palavras.append({
            "text": txt,
            "x0": x / escala, "x1": (x + w) / escala,
            "top": y / escala, "bottom": (y + h) / escala,
        })
    largura_pt = imagem.size[0] / escala
    cache_rotacao["paginas_ocr"] = cache_rotacao.get("paginas_ocr", 0) + 1
    return palavras, largura_pt


def _obter_palavras(pagina, cache_rotacao):
    """Palavras da página + largura efetiva + se vieram de OCR (usado para agrupar as
    linhas com tolerância maior, já que caixas do OCR variam mais no eixo vertical
    que as coordenadas exatas do PDF)."""
    palavras = _extrai_palavras_normal(pagina)
    if palavras:
        return palavras, pagina.width, False
    palavras, largura = _ocr_palavras_pagina(pagina, cache_rotacao)
    return palavras, largura, True


def _linhas(palavras, tol=2.5):
    """Agrupa palavras (já extraídas) da página em linhas (mesmo 'top' aproximado)."""
    palavras = sorted(palavras, key=lambda w: (round(w["top"]), w["x0"]))
    linhas, atual, topo = [], [], None
    for w in palavras:
        if topo is None or abs(w["top"] - topo) <= tol:
            atual.append(w)
            topo = w["top"] if topo is None else topo
        else:
            linhas.append(sorted(atual, key=lambda x: x["x0"]))
            atual, topo = [w], w["top"]
    if atual:
        linhas.append(sorted(atual, key=lambda x: x["x0"]))
    return linhas


def _texto(linha):
    return " ".join(w["text"] for w in linha)


def _evento_do_lado(palavras, deslocamento, fator=1.0):
    """
    Converte as palavras de um lado da tabela em um evento:
    Cod | Tp | Descrição... | [Referência] | [Valor]
    Referência e valor são distinguidos pela posição x1 relativa ao lado.
    `fator` reescala os cortes fixos (calibrados para a largura original do
    relatório) quando a página tem outra largura efetiva (ex.: página lida via OCR).
    """
    if len(palavras) < 3:
        return None
    if not (palavras[0]["text"].isdigit() and re.fullmatch(r"\d{2}", palavras[1]["text"])):
        return None
    cod, tp = int(palavras[0]["text"]), int(palavras[1]["text"])
    desc, ref, valor = [], None, None
    for w in palavras[2:]:
        t = w["text"]
        if NUM.match(t) and w["x0"] - deslocamento > 150 * fator:  # já saiu da coluna de descrição
            if (w["x1"] - deslocamento) < 300 * fator:
                ref = num(t)
            else:
                valor = num(t)
        else:
            desc.append(t)
    if valor is None and ref is not None:
        # Só um número na linha e ele caiu na coluna de referência → é valor
        pass
    return {"cod": cod, "tp": tp, "desc": " ".join(desc).strip(), "ref": ref, "valor": valor}


def ler_folha(caminho_pdf):
    """
    Retorna dict:
      periodo: {inicio, fim, mes: 'AAAA-MM'}
      colaboradores: [ {...cabeçalho..., eventos:[...], totais:{...}} ]
      resumo: {cod: {'ref':x,'valor':y}}  (resumo oficial do relatório, p/ conferência)
      situacoes: {...}
    """
    saida = {"periodo": None, "colaboradores": [], "resumo": {}, "situacoes": {}, "paginas": 0,
             "paginas_ocr": 0, "ocr_indisponivel": False}
    atual = None
    em_resumo = False
    resumo_lido = False
    cache_rotacao = {"detectado": False, "angulo": 0, "indisponivel": False}

    # Opções do laparams aceleram a leitura e evitam deadlocks em tabelas pesadas
    laparams = {"line_margin": 0.5, "detect_vertical": False}

    with pdfplumber.open(caminho_pdf, laparams=laparams) as pdf:
        saida["paginas"] = len(pdf.pages)
        for pagina in pdf.pages:
            palavras_pagina, largura, veio_de_ocr = _obter_palavras(pagina, cache_rotacao)
            meio = largura * 0.5  # separa tabela esquerda / direita
            tol = 5.0 if veio_de_ocr else 2.5  # OCR varia mais no eixo vertical (ex.: hífen "baixo")
            for linha in _linhas(palavras_pagina, tol=tol):
                txt = _texto(linha)

                m = re.search(r"Per[ií]odo:\s*" + DATA + r"\s*a\s*" + DATA, txt)
                if m and not saida["periodo"]:
                    d1, d2 = m.group(1), m.group(2)
                    saida["periodo"] = {
                        "inicio": d1,
                        "fim": d2,
                        "mes": f"{d2[6:10]}-{d2[3:5]}",
                    }

                if "Resumo dos Eventos" in txt:
                    em_resumo = True
                    atual = None
                    continue

                if em_resumo:
                    if not resumo_lido:
                        _ler_resumo(linha, saida["resumo"], largura)
                    if txt.startswith("Vantagem"):
                        resumo_lido = True
                    m = re.match(r"^(\d{3})\s+(\w[\w ]+?)\s+(\d+)$", txt)
                    if m and resumo_lido:
                        saida["situacoes"][m.group(2)] = int(m.group(3))
                    continue

                # ---- cabeçalho do colaborador ----
                m = re.search(r"Colaborador:\s*(\d+)\s*-?\s*(.+?)\s+Adm\s*i\s*s\s*s\s*.\s*o\s*:\s*" + DATA, txt)
                if m:
                    atual = {
                        "matricula": m.group(1),
                        "nome": normalizar_nome(m.group(2)),
                        "admissao": m.group(3),
                        "situacao": "",
                        "demissao": None,
                        "cargo": "",
                        "cargo_cod": "",
                        "salario_base": 0.0,
                        "f_reg": "",
                        "eventos": [],
                        "totais": {},
                    }
                    ms = re.search(
                        r"Sit:\s*(.+?)(?:\s+Demiss.o:\s*" + DATA + r")?(?:\s+Causa:\s*\d+)?$", txt
                    )
                    if ms:
                        atual["situacao"] = ms.group(1).strip()
                        atual["demissao"] = ms.group(2)
                    saida["colaboradores"].append(atual)
                    continue
                if atual is None:
                    continue

                m = re.search(r"[CG]argo:\s*(\d+)\s*-?\s*(.+?)\s+Sal.rio Base:\s*([\d.]+,\d{2})", txt)
                if m:
                    atual["cargo_cod"], atual["cargo"] = m.group(1), m.group(2).strip()
                    atual["salario_base"] = num(m.group(3))
                    mf = re.search(r"F\.\s*Reg\.:\s*(\d+)", txt)
                    atual["f_reg"] = mf.group(1) if mf else ""
                    continue

                m = re.search(
                    r"Proventos:\s*([\d.]+,\d{2})\s+Vantagens:\s*([\d.]+,\d{2})\s+Descontos:\s*([\d.]+,\d{2})\s+L[ií]quido:\s*([\d.]+,\d{2})",
                    txt,
                )
                if m:
                    atual["totais"] = {
                        "proventos": num(m.group(1)),
                        "vantagens": num(m.group(2)),
                        "descontos": num(m.group(3)),
                        "liquido": num(m.group(4)),
                    }
                    continue

                # ---- eventos (duas tabelas lado a lado) ----
                esq = [w for w in linha if w["x0"] < meio]
                dir_ = [w for w in linha if w["x0"] >= meio]
                for lado, desloc in ((esq, 0.0), (dir_, meio)):
                    ev = _evento_do_lado(lado, desloc if lado is dir_ else 0.0) if lado else None
                    if ev and ev["cod"] not in (0,):
                        atual["eventos"].append(ev)
    saida["paginas_ocr"] = cache_rotacao.get("paginas_ocr", 0)
    saida["ocr_indisponivel"] = cache_rotacao.get("indisponivel", False)
    # Rede de segurança: se veio de OCR, confere a quantidade de colaboradores lidos
    # contra o total de situações do "Resumo dos Eventos" (que é lido à parte, sem depender
    # do cabeçalho "Colaborador:"). Uma divergência aqui não é fatal — os dados lidos são
    # mantidos — mas fica sinalizada para conferência manual.
    if saida["paginas_ocr"] and saida["situacoes"]:
        esperado = sum(saida["situacoes"].values())
        lido = len(saida["colaboradores"])
        if esperado != lido:
            saida["ocr_divergencia"] = {"esperado": esperado, "lido": lido}
    return saida


LARGURA_REF = 595.32  # largura (pt) do layout original do relatório — usada para escalar cortes fixos


def _ler_resumo(linha, resumo, largura):
    """Lê linhas do 'Resumo dos Eventos' (lado dos proventos) para conferência."""
    corte = 430 * (largura / LARGURA_REF)
    esq = [w for w in linha if w["x0"] < corte]
    if len(esq) < 3 or not esq[0]["text"].isdigit():
        return
    cod = int(esq[0]["text"])
    nums = []
    for w in esq[1:]:
        m = re.match(r"^(-?\d{1,3}(?:\.\d{3})*,\d{2})[A-Z-]*$", w["text"])
        if m:
            nums.append(num(m.group(1)))
    if not nums:
        return
    # 'referência valor' ou apenas 'valor'
    ref, valor = (nums[0], nums[1]) if len(nums) >= 2 else (None, nums[0])
    if cod not in resumo:
        resumo[cod] = {"ref": ref, "valor": valor}


def soma_por_codigo(colaboradores, tp=None):
    """Soma ref/valor de todos os colaboradores por código de evento."""
    tot = defaultdict(lambda: {"ref": 0.0, "valor": 0.0})
    for c in colaboradores:
        for e in c["eventos"]:
            if tp is not None and e["tp"] != tp:
                continue
            tot[e["cod"]]["ref"] += e["ref"] or 0.0
            tot[e["cod"]]["valor"] += e["valor"] or 0.0
    return tot


if __name__ == "__main__":
    import json
    import sys

    r = ler_folha(sys.argv[1])
    print(r["periodo"], len(r["colaboradores"]), "colaboradores")
    print(json.dumps(r["resumo"].get(39)), r["situacoes"])