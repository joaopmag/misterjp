# servico_seguidor_v2.py
#
# Seguimento de jogador, versão 2. Mesmo pedido e mesma resposta da
# versão 1 (servico_seguidor.py), por isso a app não muda nada. Publica-se
# como uma app NOVA no Modal ("misterjp-seguidor-v2"), ao lado da antiga:
# troca-se o link na Vercel para experimentar e, se não convencer, volta-se
# ao link antigo em segundos.
#
# VERSÃO 2.8 (12/11): mais rápido no "Continuar" e no 2.º "Seguir": o que o
# detetor viu em cada vídeo fica guardado (modal.Dict) e é reutilizado; e
# o serviço fica acordado 5 min depois de cada pedido. A lógica de seguir
# é a mesma da 2.7.
#
# VERSÃO 2.7 (12/11): o diagnóstico do teste real mostrou que o detetor do
# Modal NUNCA perdeu o 10 (mesmo número até ao fim); quem o largou foi a
# regra da cor: um amarelo passou à frente dele e a caixa "ficou amarela"
# por uns fotogramas, o que contava logo como troca de jogador. Agora, se
# o número continua no sítio certo, a cor diferente só conta como troca
# se durar 1 s inteiro; até lá, esses fotogramas ficam sem ponto. Mas se
# ao lado estiver outro número COM A COR DELE, é uma troca a sério (o
# detetor passou o número dele para quem estava ao lado): larga logo.
#
# VERSÃO 2.6 (12/11): espera 2 s (era 1,2) antes de dar o jogador como
# perdido, e a resposta traz "diagnostico": porque parou ("perdido",
# "duvida", "borda", "retoma_nao_confirmada", "fim_do_video"), em que
# segundo, e quem o detetor viu perto nos 2 s seguintes. Serve para repetir
# fora do Modal o que o detetor de lá viu, em vez de adivinhar.
#
# VERSÃO 2.5 (12/11): CONSERVADORA. No teste real, a espera de 4 s da 2.4
# retomou no jogador errado (o detetor do Modal vê o aglomerado de forma
# diferente da cópia de teste). Decisão: o serviço só tapa buracos curtos
# (até 1,2 s, ex.: o jogador tapado por um instante) e, se o perde mais do
# que isso, o tubo PÁRA. Quem continua é o treinador, na app: para o vídeo
# quando o jogador volta a aparecer e toca nele ("Continuar seguimento"),
# e o tubo segue daí, ligado ao anterior. Ficam as regras da 2.4 (borda
# da imagem, dúvida entre dois, tamanho e profundidade).
#
# VERSÃO 2.4 (12/11): a 2.3 desistia 2 s depois de perder o jogador; no
# teste real o detetor só o voltava a ver aos 13,5 s (2,2 s depois). Agora
# espera até 4 s (com os filtros de tamanho e profundidade da 2.3) e acaba
# se o jogador saiu pela borda da imagem. Para a espera longa não apanhar
# colegas: a corrida só se projeta 1 s para a frente, o raio cresce mais
# devagar depois do 1.º segundo, uma retoma que não dura 1 s é apagada e o
# tubo acaba, e uma dúvida entre dois que dure meio segundo também o acaba.
#
# VERSÃO 2.3 (12/11): no teste real, depois de perder o 10 num choque,
# a 2.2 agarrou uma pessoa ao fundo (mais pequena, pés mais acima) e
# seguiu-a até à ponta do ecrã. Agora o tamanho de referência é a
# mediana das últimas alturas, o tamanho aceite é 75%-135% (era 65%-160%)
# e a profundidade aceite é mais curta. Na dúvida, o tubo pára.
#
# O QUE MUDA EM RELAÇÃO À VERSÃO 1 (as causas das trocas de jogador):
#
# 1. TEMPO CERTO AO COMEÇAR A MEIO. A v1 extraía o troço com "-c copy",
#    que começa no fotograma-chave ANTERIOR ao instante pedido (às vezes
#    segundos antes). O jogador era procurado no fotograma errado e todos
#    os pontos ficavam desfasados no tempo: o tubo aparecia noutro jogador
#    e a app cortava-o. Agora, quando se começa a meio, o troço é
#    recodificado a começar exatamente no instante tocado.
#
# 2. ESCOLHA DO JOGADOR SÓ PERTO DO TOQUE. A v1 escolhia "o mais perto",
#    mesmo que estivesse longe (quando o jogador tocado não era detetado
#    no 1.º fotograma). Agora só aceita alguém a uma distância curta do
#    toque, procurando nos primeiros instantes; se não houver ninguém,
#    responde com uma mensagem clara em vez de seguir outro.
#
# 3. DETETOR MAIS FORTE PARA CÂMARAS PANORÂMICAS (Veo). Modelo "s" em vez
#    de "n", imagem a 1920 px (a v1 reduzia para 1280, e os jogadores ao
#    longe ficavam com poucos píxeis) e confiança mínima mais baixa, para
#    não perder jogadores pequenos. Todos os fotogramas são analisados por
#    omissão (a v1 saltava 1 em cada 2, o que piora o seguimento quando a
#    câmara roda). O modelo já vem dentro da imagem: não se descarrega a
#    cada arranque.
#
# 4. SÓ SE SEGUE O JOGADOR ESCOLHIDO, E NA DÚVIDA NÃO SE ADIVINHA. A v1
#    fundia todos os jogadores do vídeo por cor e distância; colegas da
#    mesma equipa têm a mesma cor e estavam muitas vezes perto. Agora:
#    - quando o jogador desaparece, só pode ser "reencontrado" num jogador
#      que apareceu DEPOIS de ele desaparecer (quem já estava em campo ao
#      mesmo tempo que ele é outra pessoa, de certeza);
#    - procura-o onde devia estar, pela velocidade que levava, com a mesma
#      cor de equipamento;
#    - se houver dois candidatos parecidos, não escolhe nenhum: fica um
#      buraco (a app não mostra o tubo nesse bocado) em vez do jogador
#      errado;
#    - um salto impossível dentro do próprio seguimento (o detetor trocar
#      dois jogadores) também é cortado.
#
# 2.1 (depois do 1.º teste real):
#    - a cor do equipamento é verificada também enquanto o seguimento
#      continua (o detetor trocou o 10 vermelho com um amarelo colado a
#      ele, e o salto era pequeno demais para ser apanhado);
#    - buracos curtos (até 1,5 s) entre dois momentos certos são
#      preenchidos em linha reta, para o tubo não piscar quando o jogador
#      está longe ou tapado por instantes;
#    - detetor "m" (mais preciso com jogadores pequenos, junto à bancada)
#      e confiança mínima 0,10.
#
# Publicar (no computador onde publicaste a versão 1):
#   python -m modal deploy servico_seguidor_v2.py
# O link novo será algo como
#   https://joaopmag--misterjp-seguidor-v2-seguir.modal.run

import modal

app = modal.App("misterjp-seguidor-v2")

imagem = (
    modal.Image.debian_slim()
    .apt_install("libgl1", "libglib2.0-0", "ffmpeg")
    .pip_install("ultralytics", "opencv-python-headless", "numpy", "fastapi[standard]", "requests")
    # O modelo fica guardado dentro da imagem (não se descarrega a cada arranque).
    .run_commands("mkdir -p /modelos && cd /modelos && python -c \"from ultralytics import YOLO; YOLO('yolov8m.pt')\"")
)

CAMINHO_MODELO = "/modelos/yolov8m.pt"

# ---------------------------------------------------------------------------
# Lógica de seguimento (Python simples, sem GPU: dá para testar à parte)
# ---------------------------------------------------------------------------

def _centro(b):
    return ((b[0] + b[2]) / 2.0, (b[1] + b[3]) / 2.0)


def _pes(b):
    return ((b[0] + b[2]) / 2.0, b[3])


def _alt(b):
    return max(1.0, b[3] - b[1])


def _dist(p, q):
    return ((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2) ** 0.5


# COR DO EQUIPAMENTO (2.2). A média do tom da camisola (versões
# anteriores) não funcionava: com jogadores pequenos a caixa apanha muito
# fundo, e o vermelho fica nas duas pontas da escala de tons, por isso a
# média dava valores aleatórios (um vermelho parecia amarelo). Agora conta-
# -se, só nos píxeis de cor viva do centro do tronco, quantos caem em cada
# um de 12 grupos de tons. Medido no clipe real: entre vermelhos 0,17-0,25;
# entre o 10 vermelho e um amarelo 0,77-0,84.
BINS_COR = 12


def _dist_cor(a, b):
    """0 = mesma cor, 1 = nada em comum. Se um dos dois quase não tem cor
    viva (camisola branca/preta, ou tapado), não decide: 0,5."""
    if a[-1] < 0.08 or b[-1] < 0.08:
        return 0.5
    return 1.0 - sum(min(x, y) for x, y in zip(a[:-1], b[:-1]))


def escolher_alvo(deteccoes, toque, largura, fps, procurar_seg=0.6):
    """Procura, nos primeiros instantes, a deteção mais perto do toque,
    mas só dentro de um raio curto. Devolve (indice, id) ou None.
    deteccoes: lista ordenada de (indice, [(id, caixa, cor), ...])."""
    limite_indice = None
    for indice, registos in deteccoes:
        if limite_indice is None:
            limite_indice = indice + procurar_seg * fps
        if indice > limite_indice:
            break
        melhor = None
        for id_, caixa, _cor in registos:
            raio = max(0.03 * largura, 1.2 * _alt(caixa))
            d = min(_dist(_centro(caixa), toque), _dist(_pes(caixa), toque))
            if d <= raio and (melhor is None or d < melhor[0]):
                melhor = (d, id_)
        if melhor is not None:
            return indice, melhor[1]
    return None


def _cor_mediana(cores):
    """Cor de referência: a média dos histogramas dos primeiros fotogramas."""
    if not cores:
        return None
    n = len(cores)
    return tuple(sum(c[k] for c in cores) / n for k in range(len(cores[0])))


def seguir_alvo(deteccoes, inicio, id_inicial, largura, fps,
                janela_seg=2.0, limiar_cor=0.45, folga_ambiguidade=0.6,
                limiar_cor_continuar=0.55, info=None):
    """Segue só o jogador escolhido. Devolve [(indice, caixa), ...].
    Regras: continua no mesmo id enquanto não der um salto impossível;
    quando o perde, só o reencontra num id que apareceu depois de ele
    desaparecer, perto de onde devia estar e com a mesma cor; na dúvida
    entre dois candidatos, não escolhe nenhum."""
    if info is None:
        info = {}
    primeiro_visto = {}
    for indice, registos in deteccoes:
        for id_, _c, _cor in registos:
            primeiro_visto.setdefault(id_, indice)

    janela = janela_seg * fps
    trajeto = []
    id_atual = id_inicial
    ultimo = None  # (indice, caixa, cor)
    historico = []  # últimos pés, para a velocidade
    alturas = []  # alturas recentes do alvo (2.3): referência estável de tamanho
    excluidos = set()
    # COR DE REFERÊNCIA do jogador (a do equipamento): mediana dos primeiros
    # fotogramas em que foi visto. Não muda depois, para não "derivar" para
    # a cor de quem estiver ao lado.
    cores_iniciais = []
    cor_ref = None
    troca_em = None  # fotograma em que se detetou uma troca de números
    # (2.4) Retoma depois de mais de 1 s perdido: é uma aposta. Se quem foi
    # apanhado desaparece logo a seguir (menos de 1 s visto), a aposta não
    # se confirmou e não se encadeia outra: o tubo acaba aí.
    vistos_desde_retoma = None
    pos_retoma = None      # onde começou essa aposta no trajeto
    duvidas_seguidas = 0   # fotogramas seguidos com dois candidatos parecidos
    # (2.7) Fotogramas seguidos em que o número dele está no sítio certo mas
    # a cor/forma não bate (alguém passou À FRENTE dele e a caixa apanha a
    # camisola do outro). Não é troca: só se for assim durante 1 s inteiro.
    cor_ruim_seguidos = 0

    def velocidade():
        if len(historico) < 2:
            return (0.0, 0.0)
        (i0, p0), (i1, p1) = historico[0], historico[-1]
        di = max(1, i1 - i0)
        return ((p1[0] - p0[0]) / di, (p1[1] - p0[1]) / di)

    for indice, registos in deteccoes:
        if indice < inicio:
            continue
        por_id = {id_: (caixa, cor) for id_, caixa, cor in registos}

        if ultimo is not None and indice - ultimo[0] > janela:
            info['motivo'] = 'perdido'; break  # perdeu-o há tempo demais: acaba aqui (melhor do que adivinhar)
        # (2.4) Saiu pela borda da imagem: quem aparecer depois é outro.
        if (ultimo is not None and indice - ultimo[0] > 0.5 * fps
                and (ultimo[1][0] <= 0.015 * largura or ultimo[1][2] >= 0.985 * largura)):
            info['motivo'] = 'borda'; break

        aceite = None
        if id_atual is not None and id_atual in por_id:
            caixa, cor = por_id[id_atual]
            if ultimo is None:
                aceite = (caixa, cor)
            else:
                gap = indice - ultimo[0]
                h = _alt(ultimo[1])
                passo_max = min(0.02 * largura * gap, 0.6 * h * gap) + 0.01 * largura
                cor_ok = cor_ref is None or _dist_cor(cor, cor_ref) <= limiar_cor_continuar
                # Caixa com forma de pessoa e tamanho parecido ao anterior
                # (o detetor às vezes deixa uma caixa fina e vazia no fim).
                forma_ok = (caixa[2] - caixa[0]) >= 0.18 * _alt(caixa) and 0.6 * h <= _alt(caixa) <= 1.7 * h
                pos_ok = _dist(_pes(caixa), _pes(ultimo[1])) <= passo_max
                # (2.7) Troca a sério ou só tapado? Numa troca, o jogador
                # continua ali colado, com OUTRO número e com a cor certa.
                colado_com_cor_dele = False
                if pos_ok and not (cor_ok and forma_ok) and cor_ref is not None:
                    raio_colado = 0.6 * h + 0.3 * h * (gap / fps)
                    for id2, (c2, cor2) in por_id.items():
                        if id2 == id_atual or id2 in excluidos:
                            continue
                        if (_dist(_pes(c2), _pes(ultimo[1])) <= raio_colado
                                and _dist_cor(cor2, cor_ref) <= limiar_cor
                                and 0.75 * h <= _alt(c2) <= 1.35 * h):
                            colado_com_cor_dele = True
                            break
                if pos_ok and cor_ok and forma_ok:
                    aceite = (caixa, cor)
                    cor_ruim_seguidos = 0
                elif pos_ok and not colado_com_cor_dele and cor_ruim_seguidos < fps:
                    # (2.7) Tapado por outro: não desenha este fotograma (a
                    # caixa não é fiável), mas continua a confiar no número.
                    # Antes, isto contava logo como troca e o seguimento
                    # largava o jogador certo (teste real, 15,4 s).
                    cor_ruim_seguidos += 1
                else:
                    # O detetor trocou de pessoa debaixo do mesmo número: salto
                    # impossível, ou cor de equipamento diferente (um vermelho
                    # nunca passa a amarelo, mesmo que estejam lado a lado).
                    excluidos.add(id_atual)
                    id_atual = None
                    cor_ruim_seguidos = 0
                    troca_em = indice

        if aceite is None and ultimo is not None and id_atual not in por_id:
            # Perdido: procura quem apareceu depois de ele desaparecer.
            gap = indice - ultimo[0]
            if vistos_desde_retoma is not None and vistos_desde_retoma < fps and gap > 0.3 * fps:
                del trajeto[pos_retoma:]  # a aposta não se confirmou: tira-a
                info['motivo'] = 'retoma_nao_confirmada'; break
            vx, vy = velocidade()
            pe = _pes(ultimo[1])
            # (2.3) Na horizontal projeta-se a corrida como antes; na vertical
            # (profundidade) só metade e até meio segundo: num choque a caixa
            # encolhe e essa "velocidade" é ruído, que puxava para o fundo.
            # (2.4) e só até 1 s na horizontal: projetar uma corrida 2-3 s
            # para a frente põe o "previsto" longe de onde ele reaparece.
            previsto = (pe[0] + vx * min(gap, 1.0 * fps), pe[1] + vy * min(gap, 0.5 * fps) * 0.5)
            # (2.3) Tamanho de referência: mediana das últimas alturas, não a
            # última caixa (que, tapada por outro, pode vir meio cortada).
            h = sorted(alturas)[len(alturas) // 2] if alturas else _alt(ultimo[1])
            # O raio cresce com o tempo perdido: logo a seguir a perdê-lo,
            # só muito perto (senão apanha o colega do lado); passado meio
            # segundo, já pode ter corrido uns metros.
            # (2.4) Depois do 1.º segundo cresce mais devagar (a espera agora
            # vai até 4 s e um raio enorme apanharia qualquer colega).
            seg = gap / fps
            raio = 0.6 * h + 1.5 * h * min(seg, 1.0) + 0.5 * h * max(0.0, seg - 1.0) + 0.01 * largura
            candidatos = []
            # Logo a seguir a uma troca de números, o jogador pode ter ficado
            # com o número de quem estava ao lado: aceita-se um número que já
            # existia, mas só MUITO perto de onde ele estava e com a cor dele.
            logo_apos_troca = troca_em is not None and indice - troca_em <= 2
            for id_, (caixa, cor) in por_id.items():
                if id_ in excluidos:
                    continue
                ja_existia = primeiro_visto.get(id_, 0) <= ultimo[0]
                # Tem de parecer um jogador no mesmo sítio do campo: altura
                # parecida e pés à mesma profundidade. Exclui o público na
                # bancada (sentado, mais pequeno, mais acima), que com
                # cadeiras vermelhas até tem "cor de equipamento".
                hc = _alt(caixa)
                # (2.3) Mais apertado: em 2 s um jogador não muda 35% de
                # tamanho nem de profundidade no campo. Exclui quem está ao
                # fundo (banco, linha lateral do outro lado), que é mais
                # pequeno e tem os pés mais acima.
                if hc < 0.8 * h or hc > 1.35 * h:
                    continue
                if abs(_pes(caixa)[1] - previsto[1]) > 0.4 * h + 0.2 * h * (gap / fps):
                    continue
                d = _dist(_pes(caixa), previsto)
                if ja_existia:
                    if not (logo_apos_troca and cor_ref is not None and d <= 0.5 * h):
                        continue
                elif d > raio:
                    continue
                dc = _dist_cor(cor, cor_ref if cor_ref is not None else ultimo[2])
                if dc > limiar_cor:
                    continue
                candidatos.append((d / raio + dc / limiar_cor, id_, caixa, cor))
            candidatos.sort(key=lambda c: c[0])
            if candidatos and (len(candidatos) == 1 or candidatos[0][0] <= folga_ambiguidade * candidatos[1][0]):
                if duvidas_seguidas >= 0.5 * fps:
                    info['motivo'] = 'duvida'; break  # (2.4) dúvida que durou: qualquer escolha seria sorte
                _custo, id_atual, caixa, cor = candidatos[0]
                aceite = (caixa, cor)
                if gap > fps:
                    vistos_desde_retoma = 0
                    pos_retoma = len(trajeto)
            elif len(candidatos) >= 2:
                duvidas_seguidas += 1
            # senão: dúvida ou ninguém — fica um buraco neste fotograma

        if aceite is not None:
            caixa, cor = aceite
            if cor_ref is None:
                cores_iniciais.append(cor)
                if len(cores_iniciais) >= 8:
                    cor_ref = _cor_mediana(cores_iniciais)
            trajeto.append((indice, caixa))
            duvidas_seguidas = 0
            if vistos_desde_retoma is not None:
                vistos_desde_retoma += 1
            ultimo = (indice, caixa, cor)
            historico.append((indice, _pes(caixa)))
            historico = historico[-6:]
            alturas.append(_alt(caixa))
            alturas = alturas[-15:]

    info.setdefault('motivo', 'fim_do_video')
    return trajeto


def preencher_buracos(pontos, largura, fps, max_seg=1.5):
    """Entre dois momentos em que o jogador foi visto COM CERTEZA, um buraco
    curto (o detetor perdeu-o por instantes, por estar longe ou tapado) é
    preenchido em linha reta, se a distância for possível nesse tempo. A app
    esconde o tubo em buracos acima de 0,7 s; assim deixa de piscar.
    pontos: [(indice, (x, y)), ...] em píxeis."""
    if not pontos:
        return []
    saida = [pontos[0]]
    for (i0, p0), (i1, p1) in zip(pontos, pontos[1:]):
        gap = i1 - i0
        if 1 < gap <= max_seg * fps and _dist(p0, p1) <= 0.02 * largura * gap + 0.01 * largura:
            passo = max(1, int(round(fps / 10)))  # 10 pontos por segundo chegam
            for k in range(passo, gap, passo):
                f = k / gap
                saida.append((i0 + k, (p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f)))
        saida.append((i1, p1))
    return saida


# ---------------------------------------------------------------------------
# Serviço
# ---------------------------------------------------------------------------

# (2.8) Fica "acordado" 5 min depois de cada pedido: o "Continuar" logo a
# seguir não paga outra vez o arranque (carregar a imagem e o modelo).
@app.function(image=imagem, gpu="T4", timeout=600, scaledown_window=300)
@modal.fastapi_endpoint(method="POST", requires_proxy_auth=True)
def seguir(dados: dict):
    """
    Pedido (igual à v1):
      { "video_url": "...", "x_inicial": 0.42, "y_inicial": 0.55, "t_inicial": 0.0, "t_fim": 12.0 }
    Resposta (igual à v1):
      { "pontos": [{"t": 0.0, "x": 0.42, "y": 0.55}, ...], "duracao": 12.4 }
    `t` em segundos desde o início do vídeo original; x/y em fração 0-1,
    nos pés do jogador.
    """
    import subprocess
    import cv2
    import numpy as np
    from fastapi.responses import JSONResponse
    from ultralytics import YOLO

    video_url = dados["video_url"]
    x_inicial = float(dados.get("x_inicial", 0.5))
    y_inicial = float(dados.get("y_inicial", 0.5))
    t_inicial = max(0.0, float(dados.get("t_inicial", 0.0)))
    t_fim = dados.get("t_fim")
    t_fim = float(t_fim) if t_fim is not None else None
    saltar_fotogramas = max(1, int(dados.get("saltar_fotogramas", 1)))

    # (2.8) MEMÓRIA DAS DETEÇÕES. A parte lenta é o detetor passar por todos
    # os fotogramas. Guarda-se o que ele viu em cada vídeo (7 dias sem uso e
    # apaga-se sozinho); um "Continuar" ou outro "Seguir" no mesmo troço do
    # mesmo vídeo usa essa memória e responde em segundos. Os números do
    # detetor vêm do início da análise, por isso continuam coerentes.
    import hashlib, json as _json, zlib
    from urllib.parse import urlsplit
    partes = urlsplit(video_url)
    chave = "det1:" + hashlib.sha1((partes.netloc + partes.path).encode()).hexdigest()
    memoria = None
    try:
        memoria = modal.Dict.from_name("misterjp-seguidor-cache", create_if_missing=True)
    except Exception:
        memoria = None
    guardado = None
    if memoria is not None:
        try:
            guardado = memoria.get(chave)
        except Exception:
            guardado = None
    usou_memoria = False
    if guardado:
        g_t0, g_fps, g_n = guardado["t0"], guardado["fps"], guardado["n"]
        g_fim_t = g_t0 + g_n / g_fps
        cobre_fim = guardado.get("ate_ao_fim") or (t_fim is not None and t_fim <= g_fim_t + 0.05)
        if g_t0 <= t_inicial + 0.02 and t_inicial < g_fim_t - 0.5 and cobre_fim:
            todas = _json.loads(zlib.decompress(guardado["det"]).decode())
            k0 = int(round((t_inicial - g_t0) * g_fps))
            k1 = g_n if t_fim is None else int(round((t_fim - g_t0) * g_fps))
            deteccoes = [(i, [(r[0], r[1], tuple(r[2])) for r in regs]) for i, regs in todas if k0 <= i < k1]
            fps, largura, altura = g_fps, guardado["largura"], guardado["altura"]
            base_t = g_t0
            indice = min(k1, g_n)
            usou_memoria = True

    if not usou_memoria:
        # 1. Extrair o troço. A começar do início do clipe, copia-se (rápido e
        #    exato). A começar a meio, recodifica-se para começar EXATAMENTE no
        #    instante pedido (o "-c copy" começava no fotograma-chave anterior).
        caminho = "/tmp/entrada.mp4"
        comando = ["ffmpeg", "-y"]
        if t_inicial > 0:
            comando += ["-ss", str(t_inicial)]
        comando += ["-i", video_url]
        if t_fim is not None:
            comando += ["-t", str(max(0.5, t_fim - t_inicial))]
        if t_inicial > 0:
            comando += ["-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p"]
        else:
            comando += ["-c", "copy"]
        comando.append(caminho)
        subprocess.run(comando, check=True, capture_output=True)

        cap = cv2.VideoCapture(caminho)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        largura = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        altura = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        tamanho = int(min(1920, max(1280, ((largura + 31) // 32) * 32)))

        modelo = YOLO(CAMINHO_MODELO)

        def cor_torso(frame, caixa):
            x1, y1, x2, y2 = [int(v) for v in caixa]
            w, h = x2 - x1, y2 - y1
            r = frame[max(0, y1 + int(0.18 * h)):max(0, y1 + int(0.5 * h)),
                      max(0, x1 + int(0.25 * w)):max(0, x2 - int(0.25 * w))]
            if r.size == 0:
                return tuple([0.0] * (BINS_COR + 1))
            hsv = cv2.cvtColor(r, cv2.COLOR_BGR2HSV).reshape(-1, 3)
            vivos = hsv[(hsv[:, 1] > 70) & (hsv[:, 2] > 50)]
            if len(vivos) == 0:
                return tuple([0.0] * (BINS_COR + 1))
            hist = np.bincount((vivos[:, 0].astype(int) * BINS_COR // 180) % BINS_COR, minlength=BINS_COR).astype(float)
            hist /= hist.sum()
            return tuple(hist.tolist() + [len(vivos) / len(hsv)])

        # 2. Detetar e seguir todos (BoT-SORT, com compensação do movimento da câmara).
        deteccoes = []
        indice = 0
        while True:
            analisar = indice % saltar_fotogramas == 0
            if analisar:
                ok, frame = cap.read()
            else:
                ok, frame = cap.grab(), None
            if not ok:
                break
            if analisar:
                r = modelo.track(frame, classes=[0], persist=True, tracker="botsort.yaml",
                                 imgsz=tamanho, conf=0.10, verbose=False)[0]
                registos = []
                if r.boxes.id is not None:
                    for caixa, id_ in zip(r.boxes.xyxy.tolist(), r.boxes.id.tolist()):
                        registos.append((int(id_), caixa, cor_torso(frame, caixa)))
                deteccoes.append((indice, registos))
            indice += 1
        cap.release()
        base_t = t_inicial
        # Guarda na memória (só se for mais do que o que lá estava).
        if memoria is not None and deteccoes:
            try:
                novo_fim = t_inicial + indice / fps
                velho = guardado
                melhor = (not velho) or (t_inicial <= velho["t0"] + 0.02 and novo_fim >= velho["t0"] + velho["n"] / velho["fps"] - 0.05)
                if melhor:
                    compacto = [[i, [[id_, [round(v, 1) for v in c], [round(v, 3) for v in cor]] for id_, c, cor in regs]] for i, regs in deteccoes]
                    memoria.put(chave, {
                        "t0": t_inicial, "fps": fps, "n": indice, "largura": largura, "altura": altura,
                        "ate_ao_fim": t_fim is None or (t_inicial + indice / fps) < t_fim - 0.5,
                        "det": zlib.compress(_json.dumps(compacto).encode()),
                    })
            except Exception:
                pass

    duracao = round(base_t + indice / fps, 3)

    # 3. Quem foi tocado (só perto do toque) e o seu percurso.
    escolha = escolher_alvo(deteccoes, (x_inicial * largura, y_inicial * altura), largura, fps)
    if escolha is None:
        return JSONResponse(status_code=422, content={
            "error": "Não encontrei nenhum jogador no sítio tocado. Toca mesmo em cima do jogador, num momento em que se veja bem.",
        })
    inicio, id_inicial = escolha
    info = {}
    trajeto = seguir_alvo(deteccoes, inicio, id_inicial, largura, fps, info=info)

    # DIAGNÓSTICO (2.6): porque parou e quem estava perto nos 2 s seguintes.
    # Pequeno (só vizinhos do alvo), para se poder repetir o caso fora do
    # Modal em vez de adivinhar.
    diagnostico = {"motivo": info.get("motivo"), "id_inicial": id_inicial, "memoria": usou_memoria}
    if trajeto:
        f_ult, c_ult = trajeto[-1]
        diagnostico["parou_em"] = round(base_t + f_ult / fps, 3)
        diagnostico["ultima_caixa"] = [round(v / largura, 4) if k % 2 == 0 else round(v / altura, 4) for k, v in enumerate(c_ult)]
        pe_ult = _pes(c_ult)
        vizinhos = []
        for i, regs in deteccoes:
            if f_ult - 0.3 * fps <= i <= f_ult + 2.0 * fps:
                for id_, caixa, cor in regs:
                    if _dist(_pes(caixa), pe_ult) <= 0.25 * largura:
                        vizinhos.append([i - f_ult, id_, [round(v) for v in caixa], [round(v, 2) for v in cor]])
        diagnostico["vizinhos"] = vizinhos
        diagnostico["tamanho"] = [largura, altura, round(fps, 3)]

    pontos = []
    for i, (px, py) in preencher_buracos([(i, _pes(c)) for i, c in trajeto], largura, fps):
        pontos.append({
            "t": round(base_t + i / fps, 3),
            "x": round(px / largura, 4),
            "y": round(py / altura, 4),
        })
    return {"pontos": pontos, "duracao": duracao, "versao": "2.8", "diagnostico": diagnostico}
