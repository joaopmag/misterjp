// tatico/QuadroTaticoLivre.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useSingletonSync } from '../base/sincronizacao';
import { useState, useRef, useEffect } from 'react';
import { uid } from '../base/utilidades';
import { body, T_ESCURO, T, TEXT_ON_ACCENT, display } from '../base/tema';
import { X, Hand, Pencil, Eraser, Trash2 } from 'lucide-react';
import { Btn } from '../base/ui';
import { PitchMarkings, TEAMS, TriondaBall, teamInfo } from './campo';

/* QUADRO TÁTICO LIVRE — ecrã inteiro A SÉRIO (API de Fullscreen do
   browser), sem barra nenhuma por cima do campo — o relvado ocupa o
   ecrã de ponta a ponta. Guarda só a ÚLTIMA coisa desenhada (registo
   único por equipa, como a Época ou a Classificação).

   Três formas de mexer no campo, sem precisar de escolher uma
   ferramenta primeiro (não há barra onde a escolher):
   - Arrastar o dedo/rato numa zona VAZIA do relvado — risca/escreve à
     mão livre. É o comportamento por OMISSÃO, sem precisar de ativar
     nada.
   - Arrastar uma bola já colocada — move-a. Tocar sem arrastar deixa
     escrever outro texto lá dentro.
   - Arrastar uma cor do banco, em baixo — cria uma bola nova dessa
     cor, já com a posição a seguir na sequência (GR, DD, DC, DC, DE,
     MD, MC, MO, EX, EX, PL, recomeçando se passar de 11).

   A Borracha é um interruptor (ícone, canto inferior direito, junto do
   banco): enquanto ativa, arrastar no relvado apaga em vez de
   desenhar — em modo arrasto a sério, não clique a clique. Só grava
   (uma vez) no fim do gesto de apagar — gravar a cada milímetro
   arrastado mandava centenas de escritas por segundo para a base de
   dados. O caixote do lixo, ao lado, limpa tudo de uma vez (com
   confirmação, para não se apagar sem querer com um toque). Sair é só
   o X, canto superior. */
export const SEQUENCIA_POSICOES = ['GR', 'DD', 'DC', 'DC', 'DE', 'MD', 'MC', 'MO', 'EX', 'EX', 'PL'];

export const RAIO_BOLA_QUADRO = 1.85;

export const RAIO_BOLA_FUTEBOL_QUADRO = 1.0;

export const RAIO_BORRACHA_QUADRO = 3.5;

/* Ao tocar numa cor SEM arrastar, a bola tem de nascer num sítio certo
   e sempre DENTRO das 4 linhas — sem isto, toques seguidos na mesma (ou
   noutra) cor nasciam todos quase no mesmo ponto, empilhados uns em
   cima dos outros. O campo divide-se em cruz, 4 quadrantes: vermelho
   (cima-direita) e azul (baixo-direita) partilham o meio-campo direito;
   dourado (cima-esquerda) e branco (baixo-esquerda) partilham o outro.
   Cada bola nova ocupa a fila a seguir no quadrante da sua cor, na
   mesma ordem de GR a PL (`SEQUENCIA_POSICOES`) — nunca cai em cima de
   outra. Arrastar do banco continua a pôr onde se quiser, sem passar
   por isto — isto só serve de posição de partida sensata para um
   toque simples.

   As 4 linhas verdadeiras do campo (não a moldura à volta, que inclui
   bandeirolas/abrigos) vão de x=1 a x=106 e y=1 a y=69 — os quadrantes
   ficam bem dentro dessa caixa, nunca a tocar na borda. */
export const QUADRANTES_POR_COR = {
  A: { x: 82, yBase: 4, yTopo: 32 },   // vermelho — cima-direita
  B: { x: 82, yBase: 37, yTopo: 65 },  // azul — baixo-direita
  C: { x: 25, yBase: 4, yTopo: 32 },   // dourado — cima-esquerda
  D: { x: 25, yBase: 37, yTopo: 65 },  // branco — baixo-esquerda
};

export const FILAS_POR_COR = Object.fromEntries(Object.entries(QUADRANTES_POR_COR).map(([cor, q]) => {
  const passo = (q.yTopo - q.yBase) / (SEQUENCIA_POSICOES.length - 1);
  return [cor, SEQUENCIA_POSICOES.map((_, i) => q.yBase + passo * i)];
}));

export function QuadroTaticoLivre({ teamId, notifyEdit, onClose }) {
  const [quadro, setQuadro, quadroReady] = useSingletonSync(
    'quadro_tatico', { elementos: [], linhas: [], tracos: [] }, notifyEdit, teamId,
  );
  const [emCurso, setEmCurso] = useState(null);
  // Um dos dois está sempre ativo — nunca os dois nem nenhum. Começa em
  // "caneta" (é o que se usa mais tempo, a explicar um lance); trocar
  // para "borracha" fica assim até se voltar a carregar na caneta —
  // não desliga sozinho ao voltar a tocar no mesmo ícone.
  const [modo, setModo] = useState('mao'); // 'caneta' | 'borracha' | 'mao' (mão — só esta move bolas; escolhe-se sempre à mão, nunca liga sozinha)
  const [rascunhoApagar, setRascunhoApagar] = useState(null);
  const [confirmarLimpar, setConfirmarLimpar] = useState(false);
  const [fechando, setFechando] = useState(false);
  const campoRef = useRef(null);
  const quadroRootRef = useRef(null);
  const lixoRef = useRef(null);
  const [sobreLixo, setSobreLixo] = useState(false);

  /* O ponto de corte "mobile" do resto da app (760px) não chega aqui —
     um tablet em paisagem passa nos 760px e cai no visual de desktop
     (botões grandes, sobrepostos ao campo), mesmo não tendo espaço de
     sobra que chegue para isso. O que importa para ESTE quadro não é
     "é telemóvel ou não", é "o ecrã é estreito ou alto de mais para os
     botões vetem sobrepostos ao campo sem atrapalhar" — por isso mede-se
     a proporção do próprio ecrã, em vez de usar um ponto de corte fixo.

     `vertical` decide se o CAMPO roda 90º (ver mais abaixo) — um campo
     é sempre mais largo do que alto; num ecrã em pé, sem rodar, ficava
     pequeno e sobrava imenso verde vazio em cima e em baixo. Rodado,
     passa a ocupar o ecrã quase todo. */
  /* `vertical` decide por CSS (matchMedia), não por medir pixels em
     JavaScript — medir em JS já tinha dado problemas: no instante em
     que este ecrã abre, o browser pode ainda estar a meio da transição
     para ecrã inteiro, e o que se lia era o tamanho da janela ANTIGA,
     antes da transição terminar. `matchMedia('orientation: portrait')`
     não tem esse problema — é o próprio motor do browser a decidir a
     orientação, sempre atualizado, sem depender de medir na hora certa
     nem de ouvir os eventos certos (`resize`/`orientationchange`
     nalguns aparelhos disparam tarde, ou não disparam de todo, à volta
     de mudanças de ecrã inteiro). */
  // O quadro fica sempre na disposição horizontal — sem ecrã vertical
  // nenhum para onde mudar. Tudo o resto (ecrã inteiro, bloqueio de
  // orientação do sistema, medição reativa do campo) continua igual.
  const vertical = false;
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const aoRedimensionar = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', aoRedimensionar);
    return () => window.removeEventListener('resize', aoRedimensionar);
  }, []);
  /* `compacto` só decide o TAMANHO dos ícones (pequenos ou grandes) —
     nunca onde ficam. Onde ficam é só uma pergunta: o ecrã é vertical
     ou não. Em PAISAGEM (mesmo num telemóvel, não só em desktop), os
     ícones sobrepostos aos cantos do campo aproveitam melhor o espaço
     do que uma barra à parte — a barra só compensa em pé, onde já
     sobra altura a mais por baixo do campo rodado. */
  const compacto = vertical || viewport.w < 900;

  /* Cada bola guarda o seu PRÓPRIO lugar (`slot`, um número: 0=GR,
     1=DD... 10=PL, 11=GR outra volta, etc.) — não é só uma contagem.
     Ao criar uma bola nova, procura-se o primeiro lugar dessa cor que
     ainda não está ocupado por NENHUMA bola real e mais nenhum gesto a
     decorrer nesse preciso instante:
     - Se apagares uma bola do meio (ex: um EX), esse lugar fica livre
       — a próxima bola dessa cor cai exatamente aí, não avança para a
       frente cegamente.
     - Se todos os 11 lugares estiverem ocupados, o primeiro livre já é
       o 12º — recomeça a sequência do zero, só que numa fila nova (ver
       `volta`, mais abaixo).
     `slotsPendentes` é só para toques muito rápidos seguidos: reserva o
     lugar assim que o gesto começa (antes de a gravação sequer ter
     acontecido), para dois toques seguidos nunca escolherem o mesmo —
     sem isto, ambos viam o quadro tal como estava ANTES do primeiro
     toque, e caíam os dois no mesmo sítio. Liberta-se sempre no fim do
     gesto (ver `largar`), gravado ou não. */
  const slotsPendentes = useRef({ A: new Set(), B: new Set(), C: new Set(), D: new Set() });

  useEffect(() => {
    // Se já se entrou em ecrã inteiro no próprio clique que abriu este
    // ecrã (ver `abrirQuadroTatico`, no componente App), não se pede
    // outra vez — pedir duas vezes seguidas (uma no clique, outra aqui
    // ao montar) podia competir uma com a outra e, nalguns browsers,
    // fazer o próprio ecrã inteiro pestanejar ao entrar. Só pede aqui
    // como rede de segurança, se por algum motivo ainda não estiver
    // ativo (ex: este ecrã abriu de outro sítio, sem passar por lá).
    const jaEmFullscreen = !!document.fullscreenElement;
    const el = quadroRootRef.current;
    const pedirBloqueioOrientacao = () => {
      // Bloquear a orientação só costuma ser possível DEPOIS de entrar
      // em ecrã inteiro, e só em alguns browsers (ex: falha sempre no
      // Safari/iOS — não há forma de contornar isso a partir daqui, é
      // uma limitação do próprio aparelho). Onde funcionar, o ecrã já
      // não roda sozinho ao virar o telemóvel/tablet.
      //
      // Um pequeno atraso (só um instante, não dá para reparar) separa
      // isto do próprio pedido de ecrã inteiro — pedir os dois colados
      // um ao outro somava duas transições do browser seguidas, o que
      // se via como um "flash".
      setTimeout(() => {
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(() => { /* não suportado neste aparelho — sem alternativa */ });
        }
      }, 250);
    };
    if (jaEmFullscreen) {
      pedirBloqueioOrientacao();
    } else if (el && el.requestFullscreen) {
      el.requestFullscreen()
        .then(pedirBloqueioOrientacao)
        .catch(() => { /* browser recusou o ecrã inteiro — continua na mesma, só sem esconder a barra */ });
    }
    // Nalguns aparelhos, certos gestos de arrastar (mover uma bola,
    // puxar uma cor do banco) fazem o ecrã piscar por uma fração de
    // segundo para fora do modo de ecrã inteiro, sem ser o utilizador a
    // pedir isso — sem esta espera, esse pisco sozinho já fechava e
    // reabria o quadro todo, o que reiniciava tudo (a caneta voltava ao
    // que era por omissão, o contador das posições perdia o sítio onde
    // ia). Só fecha a sério se continuar fora do ecrã inteiro passado
    // um bocadinho — um pisco momentâneo já não chega para isso.
    let temporizador = null;
    const aoSairDoFullscreen = () => {
      if (document.fullscreenElement) {
        if (temporizador) { clearTimeout(temporizador); temporizador = null; }
        return;
      }
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        if (!document.fullscreenElement) onClose();
      }, 400);
    };
    document.addEventListener('fullscreenchange', aoSairDoFullscreen);
    return () => {
      if (temporizador) clearTimeout(temporizador);
      document.removeEventListener('fullscreenchange', aoSairDoFullscreen);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fechar = () => {
    // A mesma ideia da abertura, mas ao contrário: só se muda de ecrã
    // DEPOIS de o browser ter mesmo terminado de sair do ecrã inteiro —
    // não ao mesmo tempo. Antes, `onClose()` corria logo a seguir a
    // pedir a saída (que é assíncrona), por isso o resto da app
    // desenhava-se já no tamanho normal ENQUANTO o ecrã ainda estava em
    // fullscreen — e só depois é que encolhia, dando esse ar de
    // "arrasto"/instável ao fechar.
    //
    // `fechando` esconde já o conteúdo (bolas, campo, tudo) antes
    // sequer de pedir a saída — fica só o fundo escuro. Alguns
    // browsers "congelam" a última imagem vista mesmo antes da
    // transição de ecrã inteiro, e é essa imagem congelada (com a bola
    // lá no meio) que ficava presa por cima do ecrã seguinte por um
    // instante. Sem nada de especial nessa última imagem (só o fundo
    // escuro), não fica nada de marcante para prender.
    setFechando(true);
    requestAnimationFrame(() => {
      if (document.fullscreenElement) {
        document.exitFullscreen().then(onClose).catch(onClose);
      } else {
        onClose();
      }
    });
  };

  const emCursoRef = useRef(null);
  useEffect(() => { emCursoRef.current = emCurso; }, [emCurso]);
  const quadroRef = useRef(quadro);
  useEffect(() => { quadroRef.current = quadro; }, [quadro]);
  const rascunhoApagarRef = useRef(null);
  useEffect(() => { rascunhoApagarRef.current = rascunhoApagar; }, [rascunhoApagar]);

  // O SVG do campo enche o ecrã todo, mas mantém sempre a proporção do
  // relvado (para não o esticar/distorcer) — ou seja, quase sempre
  // sobra uma faixa vazia dos lados (ecrã mais largo que o campo) ou
  // em cima/baixo (ecrã mais alto), consoante o aparelho. Sem contar
  // com essa faixa, um toque perto da borda calculava a posição errada
  // no campo — cada vez mais errada quanto mais perto da borda.
  // Moldura mais apertada do que o resto da app (`PITCH_VIEWBOX`
  // partilhado) — só aqui, para o relvado preencher mais o ecrã. Ainda
  // dá espaço às bandeirolas de canto (chegam a ~0.3/106.7) e aos
  // abrigos por baixo da baliza (chegam a ~80) — só corta a margem a
  // mais que sobrava à volta.
  const VB_X = -1.6, VB_Y = -1.2, VB_W = 109.8, VB_H = 82;
  const QUADRO_VIEWBOX = `${VB_X} ${VB_Y} ${VB_W} ${VB_H}`;
  const pontoDoEvento = (e) => {
    const el = campoRef.current;
    if (!el) return [0, 0];
    const rect = el.getBoundingClientRect();
    if (vertical) {
      // O campo está rodado 90º dentro desta caixa (ver o wrapper do
      // campo, mais abaixo) — a caixa em si fica direita (a proporção
      // dela é alta, não rodada), só o DESENHO lá dentro é que gira 90º
      // para caber melhor num ecrã em pé. A conversão tem de desfazer
      // essa rotação antes de chegar às coordenadas do campo.
      const escala = Math.min(rect.height / VB_W, rect.width / VB_H);
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      // rotate(90deg) do CSS roda no sentido dos ponteiros do relógio —
      // para desfazer, aplica-se o inverso dessa rotação.
      const localX = dy;
      const localY = -dx;
      return [VB_X + VB_W / 2 + localX / escala, VB_Y + VB_H / 2 + localY / escala];
    }
    const escala = Math.min(rect.width / VB_W, rect.height / VB_H);
    const larguraReal = VB_W * escala, alturaReal = VB_H * escala;
    const offsetX = (rect.width - larguraReal) / 2;
    const offsetY = (rect.height - alturaReal) / 2;
    const localX = e.clientX - rect.left - offsetX;
    const localY = e.clientY - rect.top - offsetY;
    return [VB_X + localX / escala, VB_Y + localY / escala];
  };

  /* Tamanho do espaço disponível para o campo, medido a sério em
     pixels — não se deixa ao CSS (aspect-ratio + max-width/max-height)
     calcular isto sozinho. Em vários aparelhos isso não se estava a
     comportar como seria de esperar (o campo ficava com folgas dos
     lados nem sempre justificadas pelo espaço real disponível) — medir
     a sério e calcular o tamanho à mão tira essa incerteza toda: o
     tamanho final do campo passa a ser sempre exatamente o maior
     possível dentro do espaço medido, sem surpresas de motor de CSS. */
  const areaRef = useRef(null);
  const [areaTamanho, setAreaTamanho] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = areaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setAreaTamanho({ w: width, h: height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  // Sem rodar: a caixa do campo é VB_W×VB_H. Rodado 90º (vertical): a
  // caixa final é VB_H×VB_W (trocado) — o campo em pé ocupa o espaço
  // disponível na vertical, e o desenho lá dentro é que roda para caber.
  const largoBase = vertical ? VB_H : VB_W;
  const altoBase = vertical ? VB_W : VB_H;
  const escalaCampo = areaTamanho.w > 0 && areaTamanho.h > 0
    ? Math.min(areaTamanho.w / largoBase, areaTamanho.h / altoBase)
    : 0;
  const campoLargura = largoBase * escalaCampo;
  const campoAltura = altoBase * escalaCampo;

  const distSegmento = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  };
  const apagarPertoDe = (base, x, y) => {
    // Um traço NÃO desaparece inteiro só porque um ponto dele ficou
    // perto da borracha — corta-se só esse troço, e o resto do
    // traço fica dividido em pedaços separados, exatamente como uma
    // borracha a sério apaga só onde passa por cima.
    const novosTracos = [];
    (base.tracos || []).forEach(t => {
      let atual = [];
      t.pontos.forEach(p => {
        const perto = Math.hypot(p[0] - x, p[1] - y) < RAIO_BORRACHA_QUADRO;
        if (perto) {
          if (atual.length > 1) novosTracos.push({ id: uid(), pontos: atual });
          atual = [];
        } else {
          atual.push(p);
        }
      });
      if (atual.length > 1) novosTracos.push({ id: uid(), pontos: atual });
    });
    return {
      elementos: (base.elementos || []).filter(el => Math.hypot(el.x - x, el.y - y) > RAIO_BORRACHA_QUADRO),
      linhas: (base.linhas || []).filter(l => distSegmento(x, y, l.x1, l.y1, l.x2, l.y2) > RAIO_BORRACHA_QUADRO),
      tracos: novosTracos,
    };
  };

  const iniciarNovaBola = (corId) => (e) => {
    e.preventDefault();
    // Primeiro lugar livre desta cor — nem em cima de uma bola real,
    // nem em cima de um gesto ainda a decorrer (ver o comentário grande
    // do `slotsPendentes`, mais acima).
    const ocupados = new Set((quadroRef.current.elementos || []).filter(el => el.cor === corId).map(el => el.slot));
    const pendentes = slotsPendentes.current[corId];
    let slot = 0;
    while (ocupados.has(slot) || pendentes.has(slot)) slot += 1;
    pendentes.add(slot);
    const filas = FILAS_POR_COR[corId] || FILAS_POR_COR.A;
    const volta = Math.floor(slot / filas.length);
    const dentroDaVolta = slot % filas.length;
    const q = QUADRANTES_POR_COR[corId] || QUADRANTES_POR_COR.A;
    // Cada volta completa pela sequência desloca a fila para o lado
    // (mais para fora do meio-campo) — sem isto, ao fim de 11 bolas da
    // mesma cor, a 12ª caía exatamente em cima da 1ª.
    const xSugerido = q.x + (q.x > 53 ? 1 : -1) * volta * 5;
    const ySugerido = filas[dentroDaVolta];
    // A bola em pré-visualização segue o dedo/rato desde o primeiro
    // instante, mesmo que comece em cima da paleta (fora do campo) —
    // sem isto, tocar numa cor fazia "aparecer" uma bola já dentro do
    // campo antes de sequer se ter começado a arrastar, o que parecia
    // um erro. `xSugerido`/`ySugerido` só se usam no fim (ver `largar`),
    // e só se o gesto for mesmo um toque simples, sem arrastar a sério.
    const [x, y] = pontoDoEvento(e);
    setEmCurso({ tipo: 'novaBola', cor: corId, x, y, xInicial: x, yInicial: y, xSugerido, ySugerido, slot });
  };

  // A BOLA DE FUTEBOL — só uma no quadro todo. Um toque simples põe-na
  // no centro do campo; arrastar põe onde se largar. Se já existir uma
  // (de uma vez anterior), esta substitui-a — nunca cria uma segunda.
  const iniciarBola = (e) => {
    e.preventDefault();
    const existente = (quadroRef.current.elementos || []).find(el => el.tipo === 'bola');
    const [x, y] = pontoDoEvento(e);
    setEmCurso({
      tipo: 'novaBolaFutebol', x, y, xInicial: x, yInicial: y,
      idExistente: existente ? existente.id : null,
    });
  };

  // Zona vazia do relvado: apaga (modo borracha), risca à mão (modo
  // caneta), ou nada (modo "mover", que só existe enquanto se está a
  // agarrar numa bola — tocar fora dela não faz nada nesse estado).
  const aoPressionarCampo = (e) => {
    const [x, y] = pontoDoEvento(e);
    if (modo === 'borracha') {
      setRascunhoApagar(apagarPertoDe(quadroRef.current, x, y));
      setEmCurso({ tipo: 'apagar' });
    } else if (modo === 'caneta') {
      setEmCurso({ tipo: 'traco', pontos: [[x, y]] });
    }
  };

  const aoPressionarElemento = (elemento) => (e) => {
    // Só move mesmo se a Mãozinha estiver ativa — com a Caneta ou a
    // Borracha ligadas, tocar em cima de uma bola respeita SEMPRE essa
    // ferramenta (risca por cima, ou apaga), nunca move sozinho. Deixa
    // passar para o campo nesses casos — é lá que a Caneta/Borracha
    // tratam disto.
    if (modo !== 'mao') return;
    e.stopPropagation();
    const [x, y] = pontoDoEvento(e);
    setEmCurso({ tipo: 'mover', id: elemento.id, x, y });
  };

  useEffect(() => {
    if (!emCurso) return undefined;
    const dentroDoLixo = (clientX, clientY) => {
      const el = lixoRef.current;
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
    };
    const mover = (e) => {
      const [x, y] = pontoDoEvento(e);
      const tipoAtual = emCursoRef.current && emCursoRef.current.tipo;
      if (tipoAtual === 'apagar') {
        setRascunhoApagar(r => apagarPertoDe(r || quadroRef.current, x, y));
        return;
      }
      if (tipoAtual === 'mover') setSobreLixo(dentroDoLixo(e.clientX, e.clientY));
      setEmCurso(prev => {
        if (!prev) return prev;
        if (prev.tipo === 'traco') return { ...prev, pontos: [...prev.pontos, [x, y]] };
        return { ...prev, x, y, clientX: e.clientX, clientY: e.clientY };
      });
    };
    const largar = () => {
      const atual = emCursoRef.current;
      if (!atual) return;
      setSobreLixo(false);
      if (atual.tipo === 'apagar') {
        if (rascunhoApagarRef.current) setQuadro(rascunhoApagarRef.current);
        setRascunhoApagar(null);
      } else if (atual.tipo === 'traco') {
        if (atual.pontos.length > 1) {
          setQuadro(prev => ({ ...prev, tracos: [...(prev.tracos || []), { id: uid(), pontos: atual.pontos }] }));
        }
      } else if (atual.tipo === 'novaBola') {
        // Liberta já a reserva deste lugar — quer a bola acabe por ser
        // criada quer não (ex: largou fora do campo), o gesto acabou.
        slotsPendentes.current[atual.cor].delete(atual.slot);
        // Só conta como "arrastado a sério" se saiu mais de ~2 unidades
        // do ponto onde o dedo tocou primeiro — um toque simples, por
        // pequeno que seja o tremor do dedo, ainda usa a posição
        // sugerida (o quadrante), não o ponto exato onde a paleta está.
        const arrastou = Math.hypot(atual.x - atual.xInicial, atual.y - atual.yInicial) > 2;
        const xFinal = arrastou ? atual.x : atual.xSugerido;
        const yFinal = arrastou ? atual.y : atual.ySugerido;
        if (xFinal >= -6 && xFinal <= 113 && yFinal >= -5 && yFinal <= 83) {
          // O `slot` (guardado em `atual`) é o que decide a sigla — o
          // mesmo lugar dá sempre a mesma sigla, esteja ele a ser
          // ocupado pela primeira vez ou a voltar a ser preenchido
          // depois de se ter apagado a bola que lá estava.
          const label = SEQUENCIA_POSICOES[atual.slot % SEQUENCIA_POSICOES.length];
          setQuadro(prev => ({
            ...prev,
            elementos: [...(prev.elementos || []), { id: uid(), tipo: 'equipa', cor: atual.cor, label, slot: atual.slot, x: xFinal, y: yFinal }],
          }));
        }
      } else if (atual.tipo === 'novaBolaFutebol') {
        // Toque simples → centro do campo (metade de 1 a 106 em x, de 1
        // a 69 em y, os limites verdadeiros das 4 linhas). Arrastar →
        // onde se largar.
        const arrastou = Math.hypot(atual.x - atual.xInicial, atual.y - atual.yInicial) > 2;
        const xFinal = arrastou ? atual.x : 53.5;
        const yFinal = arrastou ? atual.y : 35;
        if (xFinal >= -6 && xFinal <= 113 && yFinal >= -5 && yFinal <= 83) {
          setQuadro(prev => {
            // Nunca mais do que uma — se já havia, esta substitui-a (usa
            // o MESMO id, para não deixar duas por engano).
            const outros = (prev.elementos || []).filter(el => el.tipo !== 'bola');
            return {
              ...prev,
              elementos: [...outros, { id: atual.idExistente || uid(), tipo: 'bola', x: xFinal, y: yFinal }],
            };
          });
        }
      } else if (atual.tipo === 'mover') {
        // Largar em cima do caixote apaga só esta bola — sem precisar
        // de trocar para a Borracha para tirar uma só. `atual.clientX`/
        // `clientY` são coordenadas do ecrã (não do relvado), o mesmo
        // sistema que o `lixoRef.getBoundingClientRect()` usa.
        if (dentroDoLixo(atual.clientX, atual.clientY)) {
          setQuadro(prev => ({ ...prev, elementos: (prev.elementos || []).filter(el => el.id !== atual.id) }));
        } else {
          // Um toque simples (sem arrastar) numa bola já não faz nada —
          // a sigla nunca é editável, só o "slot" (ver `iniciarNovaBola`)
          // decide qual é.
          setQuadro(prev => ({
            ...prev,
            elementos: (prev.elementos || []).map(el => (el.id === atual.id ? { ...el, x: atual.x, y: atual.y } : el)),
          }));
        }
      }
      setEmCurso(null);
    };
    window.addEventListener('pointermove', mover, { passive: true });
    window.addEventListener('pointerup', largar);
    window.addEventListener('pointercancel', largar);
    return () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', largar);
      window.removeEventListener('pointercancel', largar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!emCurso]);

  const limparTudo = () => {
    setQuadro({ elementos: [], linhas: [], tracos: [] });
    setConfirmarLimpar(false);
  };

  const fonte = rascunhoApagar || quadro;
  const elementos = fonte.elementos || [];
  const linhas = fonte.linhas || [];
  const tracos = fonte.tracos || [];
  const pathDoTraco = (pontos) => pontos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]},${p[1]}`).join(' ');

  return (
    <div
      ref={quadroRootRef}
      style={{ position: 'fixed', inset: 0, zIndex: 70, background: '#1E3A24', display: 'flex', flexDirection: 'column', ...body }}
    >
      {!fechando && (
        <>
          {/* SAIR — só o X, canto superior. Fixo ao ecrã todo, fora da
              coluna do campo+barra, para nunca se mexer consoante o
              tamanho do campo. */}
          <button
            onClick={fechar}
            title="Fechar"
            style={{
              position: 'absolute', top: 10, right: 10, zIndex: 5, width: 34, height: 34, borderRadius: '50%',
              background: '#00000066', border: `1px solid ${T_ESCURO.line}`, color: T_ESCURO.cream,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
            }}
          ><X size={17} /></button>

          {/* CAMPO — ocupa o espaço disponível a mais (`flex: 1`), a
              barra de baixo fica sempre no fluxo normal, logo a seguir,
              nunca por cima. Isto é o que estava mal antes: a barra
              usava posições em percentagem do ECRÃ TODO, e um campo
              vertical (telemóvel na vertical) é muito mais curto do que
              o ecrã — a barra acabava longe do campo, ou até por cima
              dele consoante a proporção. Assim, a barra fica sempre
              mesmo a seguir ao campo, seja qual for o formato do ecrã. */}
          <div ref={areaRef} style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: vertical ? 3 : 6, overflow: 'hidden' }}>
            <div ref={campoRef} style={{
              width: campoLargura || undefined, height: campoAltura || undefined,
              touchAction: 'none', position: 'relative', overflow: 'hidden',
              visibility: escalaCampo > 0 ? 'visible' : 'hidden',
            }}>
              {/* Sem rodar: o SVG só precisa de encher a caixa (que já
                  tem as dimensões certas, calculadas em pixels acima).
                  Rodado (`vertical`): nasce com a largura/altura
                  trocadas em relação à caixa, à volta do centro; depois
                  de rodar, encaixa exatamente nela. */}
              <svg
                viewBox={QUADRO_VIEWBOX}
                onPointerDown={aoPressionarCampo}
                preserveAspectRatio="xMidYMid meet"
                style={vertical ? {
                  position: 'absolute', top: '50%', left: '50%',
                  width: campoAltura, height: campoLargura,
                  transform: 'translate(-50%, -50%) rotate(90deg)',
                  display: 'block', background: '#1E3A24', cursor: 'crosshair',
                } : { width: '100%', height: '100%', display: 'block', background: '#1E3A24', cursor: 'crosshair' }}
              >
                <PitchMarkings />
                {/* Só fica aqui para setas ANTIGAS (passe/corrida), gravadas
                    antes desta simplificação sem barra de ferramentas — a
                    marca da ponta da seta ainda é precisa para as desenhar
                    corretamente; não há forma nova de criar mais nenhuma. */}
                <marker id="qt-arrow" markerWidth="4.5" markerHeight="4.5" refX="4" refY="2.25" orient="auto">
                  <path d="M0,0 L4.5,2.25 L0,4.5 Z" fill="#F0E7D6" />
                </marker>

                {tracos.map(t => (
                  <path key={t.id} d={pathDoTraco(t.pontos)} fill="none" stroke="#F0E7D6" strokeWidth="0.2" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
                ))}
                {linhas.map(l => {
                  const comSeta = l.tipo === 'passe' || l.tipo === 'corrida';
                  return (
                    <line
                      key={l.id} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#F0E7D6" strokeWidth="0.5"
                      strokeDasharray={l.tipo === 'corrida' ? '2,1.4' : (l.tipo === 'linha-pontilhada' ? '0.15,1.4' : undefined)}
                      markerEnd={comSeta ? 'url(#qt-arrow)' : undefined}
                    />
                  );
                })}
                {emCurso && emCurso.tipo === 'traco' && (
                  <path d={pathDoTraco(emCurso.pontos)} fill="none" stroke="#F0E7D6" strokeWidth="0.2" strokeLinecap="round" strokeLinejoin="round" opacity={0.65} />
                )}

                {elementos.map(el => {
                  const emMovimento = emCurso && emCurso.tipo === 'mover' && emCurso.id === el.id;
                  const x = emMovimento ? emCurso.x : el.x;
                  const y = emMovimento ? emCurso.y : el.y;
                  if (el.tipo === 'bola') {
                    return (
                      <g
                        key={el.id}
                        onPointerDown={aoPressionarElemento(el)}
                        onDragStart={(ev) => ev.preventDefault()}
                        style={{ cursor: modo === 'mao' ? 'grab' : 'crosshair', touchAction: 'none', userSelect: 'none' }}
                      >
                        {/* Área de toque maior do que o desenho — a bola em si
                            é pequena de propósito (do tamanho do editor 2D),
                            mas continua a dar para agarrar bem com o dedo. */}
                        <circle cx={x} cy={y} r={Math.max(RAIO_BOLA_FUTEBOL_QUADRO * 1.8, 1.6)} fill="transparent" />
                        <TriondaBall cx={x} cy={y} r={RAIO_BOLA_FUTEBOL_QUADRO} />
                      </g>
                    );
                  }
                  const tm = teamInfo(el.cor);
                  const ehGR = el.label === 'GR';
                  return (
                    <g
                      key={el.id}
                      onPointerDown={aoPressionarElemento(el)}
                      onDragStart={(ev) => ev.preventDefault()}
                      style={{ cursor: modo === 'mao' ? 'grab' : 'crosshair', touchAction: 'none', userSelect: 'none' }}
                    >
                      {/* Guarda-redes em quadrado (arredondado), tal como no
                          editor 2D — distingue-se das bolas redondas dos
                          demais jogadores, à mesma escala reduzida deste
                          quadro (a proporção largura/curvatura mantém-se
                          igual à do editor, só encolhida). */}
                      {ehGR ? (
                        <rect
                          x={x - RAIO_BOLA_QUADRO} y={y - RAIO_BOLA_QUADRO}
                          width={RAIO_BOLA_QUADRO * 2} height={RAIO_BOLA_QUADRO * 2} rx={RAIO_BOLA_QUADRO * 0.41}
                          fill={tm.fill} stroke="#00000055" strokeWidth="0.18"
                        />
                      ) : (
                        <circle cx={x} cy={y} r={RAIO_BOLA_QUADRO} fill={tm.fill} stroke="#00000055" strokeWidth="0.18" />
                      )}
                      {el.label && (
                        <text
                          x={x} y={y} fontSize={el.label.length > 2 ? 0.95 : 1.3} fontWeight="700" fill={tm.text}
                          textAnchor="middle" dominantBaseline="central" transform={`rotate(-90 ${x} ${y})`}
                          style={{ pointerEvents: 'none', fontFamily: "'Oswald', sans-serif" }}
                        >
                          {el.label}
                        </text>
                      )}
                    </g>
                  );
                })}
                {emCurso && emCurso.tipo === 'novaBola' && (
                  <circle cx={emCurso.x} cy={emCurso.y} r={RAIO_BOLA_QUADRO} fill={teamInfo(emCurso.cor).fill} opacity={0.75} />
                )}
                {emCurso && emCurso.tipo === 'novaBolaFutebol' && (
                  <g opacity={0.75}><TriondaBall cx={emCurso.x} cy={emCurso.y} r={RAIO_BOLA_FUTEBOL_QUADRO} /></g>
                )}
              </svg>

              {/* No DESKTOP, a paleta/bola/ferramentas ficam sobrepostas
                  aos cantos do campo, como sempre estiveram — só em
                  mobile é que passam para a barra separada, por baixo
                  (ver mais abaixo), porque é aí que a proporção do
                  campo é curta de mais para caberem sobrepostas sem
                  atrapalhar. */}
              {!vertical && (
                <>
                  <div style={{
                    position: 'absolute', left: '4%', bottom: '3%',
                    display: 'flex', gap: compacto ? 8 : 12, background: '#00000066', padding: compacto ? '6px 9px' : '10px 14px', borderRadius: 28,
                  }}>
                    {TEAMS.map(t => (
                      <button
                        key={t.id}
                        title={t.label}
                        draggable={false}
                        onDragStart={(ev) => ev.preventDefault()}
                        onPointerDown={iniciarNovaBola(t.id)}
                        style={{
                          width: compacto ? 26 : 44, height: compacto ? 26 : 44, borderRadius: '50%', background: t.fill,
                          border: `2.5px solid ${T_ESCURO.line}`, cursor: 'grab', touchAction: 'none', padding: 0, userSelect: 'none',
                        }}
                      />
                    ))}
                  </div>
                  <button
                    title="Bola"
                    draggable={false}
                    onDragStart={(ev) => ev.preventDefault()}
                    onPointerDown={iniciarBola}
                    style={{
                      position: 'absolute', left: '50%', bottom: '3%', transform: 'translateX(-50%)',
                      width: compacto ? 26 : 34, height: compacto ? 26 : 34, borderRadius: '50%',
                      border: `2px solid ${T_ESCURO.line}`, cursor: 'grab', touchAction: 'none', padding: 0, userSelect: 'none', overflow: 'hidden',
                      background: '#00000066',
                    }}
                  >
                    <svg viewBox="0 0 10 10" width="100%" height="100%"><TriondaBall cx={5} cy={5} r={4.2} /></svg>
                  </button>
                  <div style={{ position: 'absolute', right: '4%', bottom: '2%', display: 'flex', gap: compacto ? 7 : 10 }}>
                    <button
                      onClick={() => setModo('mao')}
                      title="Mão — arrasta as bolas para mover"
                      style={{
                        width: compacto ? 34 : 54, height: compacto ? 34 : 54, borderRadius: '50%',
                        background: modo === 'mao' ? T.goldFundo : '#2B402D', border: `2px solid ${T_ESCURO.gold}`,
                        color: modo === 'mao' ? '#1E3A24' : T_ESCURO.gold, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', padding: 0, boxShadow: '0 3px 10px #00000066',
                      }}
                    ><Hand size={compacto ? 15 : 25} /></button>
                    <button
                      onClick={() => setModo('caneta')}
                      title="Caneta — risca à mão livre"
                      style={{
                        width: compacto ? 34 : 54, height: compacto ? 34 : 54, borderRadius: '50%',
                        background: modo === 'caneta' ? T.goldFundo : '#2B402D', border: `2px solid ${T_ESCURO.gold}`,
                        color: modo === 'caneta' ? '#1E3A24' : T_ESCURO.gold, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', padding: 0, boxShadow: '0 3px 10px #00000066',
                      }}
                    ><Pencil size={compacto ? 15 : 25} /></button>
                    <button
                      onClick={() => setModo('borracha')}
                      title="Borracha — arrasta para apagar"
                      style={{
                        width: compacto ? 34 : 54, height: compacto ? 34 : 54, borderRadius: '50%',
                        background: modo === 'borracha' ? '#B5393F' : '#2B402D', border: `2px solid ${modo === 'borracha' ? '#D14056' : T_ESCURO.gold}`,
                        color: modo === 'borracha' ? TEXT_ON_ACCENT : T_ESCURO.gold, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', padding: 0, boxShadow: '0 3px 10px #00000066',
                      }}
                    ><Eraser size={compacto ? 15 : 25} /></button>
                    <button
                      ref={lixoRef}
                      onClick={() => setConfirmarLimpar(true)}
                      title="Limpar tudo — arrasta uma bola até aqui para apagar só essa"
                      style={{
                        width: sobreLixo ? (compacto ? 42 : 66) : (compacto ? 34 : 54),
                        height: sobreLixo ? (compacto ? 42 : 66) : (compacto ? 34 : 54),
                        borderRadius: '50%', transition: 'width .12s, height .12s',
                        background: sobreLixo ? T_ESCURO.bad : '#2B402D', border: `2px solid ${T_ESCURO.bad}`,
                        color: sobreLixo ? TEXT_ON_ACCENT : T_ESCURO.bad,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
                        boxShadow: '0 3px 10px #00000066',
                      }}
                    ><Trash2 size={compacto ? 15 : 25} /></button>
                  </div>
                </>
              )}
            </div>
          </div>

          {vertical && (
          <>
          {/* BARRA DE BAIXO — palete, bola e ferramentas, tudo no fluxo
              normal, mesmo a seguir ao campo (nunca por cima, nunca
              longe). `flexWrap` deixa passar para uma segunda linha
              sozinho em ecrãs estreitos (telemóvel na vertical), sem
              precisar de nenhuma lógica extra para isso. */}
          <div style={{
            flexShrink: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center',
            gap: 10, rowGap: 6, padding: vertical ? '2px 8px 4px' : (compacto ? '4px 10px 6px' : '8px 14px 12px'),
          }}>
            {/* EQUIPAS */}
            <div style={{ display: 'flex', gap: compacto ? 8 : 12, background: '#00000066', padding: compacto ? '6px 9px' : '10px 14px', borderRadius: 28 }}>
              {TEAMS.map(t => (
                <button
                  key={t.id}
                  title={t.label}
                  draggable={false}
                  onDragStart={(ev) => ev.preventDefault()}
                  onPointerDown={iniciarNovaBola(t.id)}
                  style={{
                    width: compacto ? 26 : 44, height: compacto ? 26 : 44, borderRadius: '50%', background: t.fill,
                    border: `2.5px solid ${T_ESCURO.line}`, cursor: 'grab', touchAction: 'none', padding: 0, userSelect: 'none',
                  }}
                />
              ))}
            </div>

            {/* BOLA — igual à do editor 2D (`TriondaBall`), mas isolada,
                não faz parte da paleta de cores. Só pode existir UMA no
                quadro (ver `iniciarBola`): tocar ou arrastar esta
                sempre substitui a anterior, nunca cria uma segunda. */}
            <button
              title="Bola"
              draggable={false}
              onDragStart={(ev) => ev.preventDefault()}
              onPointerDown={iniciarBola}
              style={{
                width: compacto ? 26 : 34, height: compacto ? 26 : 34, borderRadius: '50%',
                border: `2px solid ${T_ESCURO.line}`, cursor: 'grab', touchAction: 'none', padding: 0, userSelect: 'none', overflow: 'hidden',
                background: '#00000066', flexShrink: 0,
              }}
            >
              <svg viewBox="0 0 10 10" width="100%" height="100%"><TriondaBall cx={5} cy={5} r={4.2} /></svg>
            </button>

            {/* MÃO + CANETA + BORRACHA + LIMPAR. Mão/Caneta/Borracha são
                um MODO exclusivo — um dos três está sempre ativo (começa
                em Caneta), nunca dois nem nenhum; trocar fica assim até
                se voltar a carregar noutro ícone, nunca desliga
                sozinho. Só com a Mão ativa é que tocar numa bola a move
                — com a Caneta ou a Borracha, tocar em cima de uma bola
                respeita sempre essa ferramenta (risca por cima, ou
                apaga-a), nunca a move sem se ter pedido isso. */}
            <div style={{ display: 'flex', gap: compacto ? 7 : 10 }}>
              <button
                onClick={() => setModo('mao')}
                title="Mão — arrasta as bolas para mover"
                style={{
                  width: compacto ? 34 : 54, height: compacto ? 34 : 54, borderRadius: '50%',
                  background: modo === 'mao' ? T.goldFundo : '#2B402D', border: `2px solid ${T_ESCURO.gold}`,
                  color: modo === 'mao' ? '#1E3A24' : T_ESCURO.gold, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0, boxShadow: '0 3px 10px #00000066',
                }}
              ><Hand size={compacto ? 15 : 25} /></button>
              <button
                onClick={() => setModo('caneta')}
                title="Caneta — risca à mão livre"
                style={{
                  width: compacto ? 34 : 54, height: compacto ? 34 : 54, borderRadius: '50%',
                  background: modo === 'caneta' ? T.goldFundo : '#2B402D', border: `2px solid ${T_ESCURO.gold}`,
                  color: modo === 'caneta' ? '#1E3A24' : T_ESCURO.gold, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0, boxShadow: '0 3px 10px #00000066',
                }}
              ><Pencil size={compacto ? 15 : 25} /></button>
              <button
                onClick={() => setModo('borracha')}
                title="Borracha — arrasta para apagar"
                style={{
                  width: compacto ? 34 : 54, height: compacto ? 34 : 54, borderRadius: '50%',
                  background: modo === 'borracha' ? '#B5393F' : '#2B402D', border: `2px solid ${modo === 'borracha' ? '#D14056' : T_ESCURO.gold}`,
                  color: modo === 'borracha' ? TEXT_ON_ACCENT : T_ESCURO.gold, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0, boxShadow: '0 3px 10px #00000066',
                }}
              ><Eraser size={compacto ? 15 : 25} /></button>
              <button
                ref={lixoRef}
                onClick={() => setConfirmarLimpar(true)}
                title="Limpar tudo — arrasta uma bola até aqui para apagar só essa"
                style={{
                  width: sobreLixo ? (compacto ? 42 : 66) : (compacto ? 34 : 54),
                  height: sobreLixo ? (compacto ? 42 : 66) : (compacto ? 34 : 54),
                  borderRadius: '50%', transition: 'width .12s, height .12s',
                  background: sobreLixo ? T_ESCURO.bad : '#2B402D', border: `2px solid ${T_ESCURO.bad}`,
                  color: sobreLixo ? TEXT_ON_ACCENT : T_ESCURO.bad,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
                  boxShadow: '0 3px 10px #00000066',
                }}
              ><Trash2 size={compacto ? 15 : 25} /></button>
            </div>
          </div>
          </>
          )}
        </>
      )}

      {confirmarLimpar && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000aa', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: T.surfaceRaise, border: `1px solid ${T.line}`, borderRadius: 10, padding: 20, maxWidth: 360, width: '100%' }}>
            <div style={{ ...display, fontSize: 16, color: T.cream, marginBottom: 8 }}>Limpar o quadro todo?</div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 18, lineHeight: 1.5 }}>
              Apaga tudo o que está colocado — não dá para desfazer.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Btn variant="ghost" onClick={() => setConfirmarLimpar(false)}>Cancelar</Btn>
              <Btn variant="danger" onClick={limparTudo}>Limpar</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

