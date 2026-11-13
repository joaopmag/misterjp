// media/MediaLibrary.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { gravarClipesDeFicheiro, podeGravarFicheiro } from './gravarFicheiro';
import React, { useState, useRef, useEffect } from 'react';
import { useIsMobile, removeWithUndo, itemLabel, askConfirm, offerUndo, Btn, EmptyState, SectionHeader, Modal } from '../base/ui';
import { COR_DESENHO, matrizDaCalibracao, referenciaForaDeJogo, inverterH, aplicarH, cantosDasLinhas, validarCalibracao, TAMANHO_FONTE_TEXTO, distanciaShape, RAIO_TOQUE, anguloRodarZonaNoChao, desrodarNaZonaNoChao, girar, podeGravarSeparador, prepararGravacaoSeparador, renderShape, pegaZonaNoChao, pegaRodarZonaNoChao, inclinacaoPadrao, FERRAMENTAS as FERRAMENTAS_DESENHO, ToolBtn, PALETA_DESENHO, entregarVideo } from '../AnalisadorVideo';
import { uid, fmtDate, semAcentos } from '../base/utilidades';
import { isFriendlyMatch } from '../dominio/jogos';
import { FileText, Scissors, Share2, Video, Printer, Pencil, Trash2, BookOpen, Play, Presentation, ExternalLink, Image as ImageIcon, Search, X, Plus, ChevronLeft, Check, LayoutGrid, SkipBack, SkipForward, Type, Eraser, Undo2, Redo2, ZoomIn, Pause, RotateCcw, Minimize2, Maximize2, Download } from 'lucide-react';
import { T, body, T_ESCURO, mono, TEXT_ON_ACCENT } from '../base/tema';
import { TATICA_OMISSAO } from '../tatico/prancheta';
import { ControlosLupa, INSTAGRAM_SANDBOX, MediaFeedItem, SOCIAL_CROP, fmtMMSS, socialClipStyle, socialCropKey, socialEmbedSrc, socialExternalUrl, socialInnerStyle, socialMeta, useLupa, youtubeEmbedSrc } from './social';
import { MAX_CLIPE_ATLETA_SEG, NO_FOLDER, SECOES_CANAL, categoriaDoItem, chaveJogoDoItem, cleanFolder, ehClipe, equipasDoItem, fichaDaEquipa, fichaRepetida, idFichaAutomatica, numDoJogo, ordenarDoJogo, seccionarPorJogo, tituloSemParte } from './organizacao';
import { FichaAdversarioRapida, printDocumentItem, shareMediaItem } from './acoes';
import { CompilacoesAtleta, LeitorJunto } from './LeitorJunto';
import { AttachmentPreview, BarraTempoSala, FimDoClipe, LeitorClipeSala } from './leitores';
import { MediaModal } from './MediaModal';

/* VÍDEO CARREGADO COMO FICHEIRO (link http): usa o MESMO leitor da
   Biblioteca que os vídeos do YouTube — barra própria, cortes, cortes em
   seguida, desenhos, ecrã inteiro. Os clipes da Análise de Vídeo também
   têm `clipInicio`, mas são ficheiros próprios (o tempo é o do jogo, não
   o do ficheiro), por isso continuam no leitor de clipes MP4. */
function eVideoFicheiroBib(v) {
  return !!v && !v.youtubeId && v.kind === 'video' && /^https?:/.test(String(v.dataUrl || '')) && (!ehClipe(v) || !!v.clipNoFicheiro);
}
function temLeitorBib(v) { return !!v && (!!v.youtubeId || eVideoFicheiroBib(v)); }
// O vídeo de onde se toca (para reaproveitar o leitor entre cortes do mesmo vídeo).
function fonteBib(v) { return v.youtubeId ? `yt:${v.youtubeId}` : `f:${v.dataUrl}`; }

export const MediaLibrary = React.forwardRef(function MediaLibrary({ items, setItems, addLabel, emptyText, emptyFirstLabel, semBotaoTopo, addButtonVariant, semCatalogo, recentesPrimeiro, modoCanal, matches, adversarios, setAdversarios, todosVideos, setTodosVideos, equipasCompeticao, soLeitura, provaDeEquipa, adversariosProntos, criarClipeAtleta, apagarClipeAtleta, editarClipeAtleta, teamIdFichas, chaveCompilacoes, compilacoesApi }, ref) {
  const [modal, setModal] = useState(null);
  // `irParaItem`: usado pelo Portal ("Os meus clipes") para abrir o jogo
  // certo e selecionar o clipe. `irParaRef` é preenchido mais abaixo,
  // depois de `irPara` existir.
  const irParaRef = React.useRef(null);
  React.useImperativeHandle(ref, () => ({
    abrirNovo: () => setModal('new'),
    irParaItem: (id) => { if (irParaRef.current) irParaRef.current(id); },
  }));
  // Pasta atualmente aberta: null = todas.
  const [folderFilter, setFolderFilter] = useState(null);
  const [renaming, setRenaming] = useState(null); // nome antigo, enquanto se renomeia
  const [renameValue, setRenameValue] = useState('');
  const [activeId, setActiveId] = useState(null);
  const activeIdRefSala = useRef(null);
  activeIdRefSala.current = activeId;
  // youtubeId -> 'embed_disabled' (dono do canal bloqueou a incorporação,
  // erro 101/150) | 'unavailable' (outro erro, ex: vídeo removido/privado).
  // Só nesse caso mostramos o aviso "abre no YouTube" — o resto reproduz
  // sempre dentro do leitor da plataforma.
  const [blockedIds, setBlockedIds] = useState({});
  const isNarrow = useIsMobile(760);

  // NAVEGAÇÃO DO CANAL (só com `modoCanal`) — secção aberta e, dentro de
  // Jogos/Adversários, o jogo/adversário aberto (null = lista de cartões).
  const [secao, setSecao] = useState('jogos');
  const [grupo, setGrupo] = useState(null);
  // "Ver cortes em seguida" — ids dos cortes a reproduzir por ordem.
  const [sequencia, setSequencia] = useState(null);
  // Portal: um dos "Os meus vídeos" aberto no leitor (vários clipes num só).
  const [compAtiva, setCompAtiva] = useState(null); // { id, nome, segmentos }
  const vistaBibRef = useRef(null);
  const [alturaVistaBib, setAlturaVistaBib] = useState(0);
  const ultimaAlturaBibRef = useRef(0);
  // Antes de trocar de vista, guarda-se a altura que estava; ao fim de um
  // instante (a vista nova já desenhada), larga-se.
  useEffect(() => {
    setAlturaVistaBib(ultimaAlturaBibRef.current);
    const t = setTimeout(() => setAlturaVistaBib(0), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secao, grupo]);
  useEffect(() => {
    const el = vistaBibRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => { if (vistaBibRef.current) ultimaAlturaBibRef.current = vistaBibRef.current.getBoundingClientRect().height; });
    ro.observe(el);
    return () => ro.disconnect();
  });
  const leitorColunaRef = useRef(null);
  // Escolher um clipe da lista sai do vídeo junto e volta ao leitor normal.
  useEffect(() => { setCompAtiva(null); }, [activeId]);
  // Corte de um jogo de adversário ainda sem ficha: fica aqui à espera
  // de se escolher/criar a ficha (ver `FichaAdversarioRapida`).
  const [pedirFicha, setPedirFicha] = useState(null);
  const [equipaCorte, setEquipaCorte] = useState('');

  // CRIAR CLIPE — marca início/fim enquanto o vídeo do YouTube toca, e
  // grava um novo item na Biblioteca que reproduz só esse troço (via
  // start/end no embed, ver `youtubeEmbedSrc`). `clipMarcas` só existe
  // fora de null enquanto o modo está ativo; `tituloClipe` é preenchido
  // ao gravar.
  const [clipMode, setClipMode] = useState(false);

  // DESENHAR POR CIMA DE UM CLIPE (Biblioteca) — por agora só nos
  // clipes do YouTube (é onde já temos o tempo real ligado, ver
  // `liveTime`/`enviarComandoYoutube` mais abaixo).
  //
  // MODELO: ao contrário da Análise de Vídeo (onde um desenho fica
  // visível entre dois pontos do vídeo, que continua sempre a tocar),
  // aqui um desenho pertence a uma PAUSA — o treinador desenha com o
  // vídeo parado, diz quantos segundos quer que fique assim parado a
  // mostrar aquilo, e ao fim desse tempo o vídeo continua sozinho e o
  // desenho desaparece. Cada uma dessas pausas fica guardada em
  // `active.anotacoesPausa` — uma lista de { id, tempoVideo,
  // duracaoSegundos, shapes }, uma por cada sítio do vídeo onde se
  // parou para desenhar.
  const [modoDesenhoBib, setModoDesenhoBib] = useState(false);
  const [toolBib, setToolBib] = useState(null); // null = nenhuma ferramenta: tocar no vídeo reproduz/pausa, tocar numa forma move-a
  const [corBib, setCorBib] = useState(COR_DESENHO);
  const [shapesRascunho, setShapesRascunho] = useState([]);
  const DURACAO_PADRAO_BIB = 5; // segundos por defeito de cada desenho (antes 3)
  /* TEMPO POR ITEM, NÃO POR PAUSA. Cada forma guarda os seus próprios
     segundos no ecrã (`seg`). O "Concluído" dá o tempo escolhido só às
     formas desenhadas DESTA vez (as que ainda não têm `seg`); as que já
     lá estavam ficam com o tempo que tinham. Na reprodução aparecem
     todas juntas, cada uma sai quando acaba o seu tempo, e o vídeo
     retoma quando sai a última. Pausas antigas (sem `seg` nas formas)
     usam o `duracaoSegundos` da pausa, como antes. */
  const segDaForma = (f, pausa) => Number(f && f.seg) || Number(pausa && pausa.duracaoSegundos) || DURACAO_PADRAO_BIB;
  const [duracaoPausaBib, setDuracaoPausaBib] = useState(DURACAO_PADRAO_BIB); // segundos no ecrã dos itens desenhados agora (os novos), ao "Concluído"
  const [anotacaoIdEmEdicaoBib, setAnotacaoIdEmEdicaoBib] = useState(null); // null = pausa nova; senão, a editar uma já existente
  const [tempoAnotacaoBib, setTempoAnotacaoBib] = useState(0); // o instante do vídeo a que esta pausa fica ligada
  const [formaEmCursoBib, setFormaEmCursoBib] = useState(null); // { tool, points } — enquanto se arrasta ou se vão acrescentando pontos
  const [formaSelecionadaBib, setFormaSelecionadaBib] = useState(null); // índice em shapesRascunho, para mover
  const [formaTextoBib, setFormaTextoBib] = useState(null); // { pt, xPix, yPix, valor } — campo de texto a meio de ser escrito
  const [historicoBib, setHistoricoBib] = useState([]); // pilha para "Retroceder" — cada entrada é um shapesRascunho anterior
  const [pausaAtivaBib, setPausaAtivaBib] = useState(null); // a pausa (id) que está agora a "segurar" o vídeo, fora do modo de desenho
  const pausaEmCursoRef = useRef(null); // trava para não disparar a mesma pausa duas vezes seguidas
  /* ZOOM NO CÍRCULO. Um círculo pode levar `zoom` (1.5, 2 ou 3): quando a
     pausa o mostra, a imagem aproxima-se suavemente do centro dele —
     como as repetições da TV que "entram" na jogada — e afasta-se quando
     o círculo sai. O vídeo do YouTube não deixa ler os pixéis (não dá
     para uma lupa só dentro do círculo), por isso é a imagem inteira que
     se aproxima, centrada no círculo; o resto do desenho acompanha.
     A desenhar, o "Ver zoom" mostra o efeito uns segundos. */
  const [zoomPreviewBib, setZoomPreviewBib] = useState(null); // forma do círculo em pré-visualização
  const zoomOrigemBib = useRef('50% 50%');
  const formaComZoom = (lista) => (lista || []).find(f => f && f.tool === 'circulo' && Number(f.zoom) > 1 && f.points && f.points[0]);
  // Também a desenhar, quando o vídeo pára sozinho numa pausa (o
  // "congelamento"): é a mesma reprodução, tem de se ver igual.
  const [congeladoDesenhoBib, setCongeladoDesenhoBib] = useState(false);
  // A saída do zoom começa ANTES de o círculo sair (ver a paragem): o
  // vídeo só volta a andar já com a imagem no tamanho normal.
  const [zoomSaidaBib, setZoomSaidaBib] = useState(null); // id da paragem cujo zoom já está a sair
  /* A DESENHAR, A PARAGEM TAMBÉM RESPEITA O TEMPO DE CADA ITEM. Quando o
     vídeo pára sozinho numa pausa com o modo de desenho aberto, cada item
     sai no tempo DELE (antes ficavam todos até ao maior) — assim vê-se
     logo como ficou um tempo mudado (5s → 1s), sem sair do desenho.
     `decorridoCongelBib` = segundos já passados nessa paragem. */
  const [decorridoCongelBib, setDecorridoCongelBib] = useState(0);
  const formasDesenhoVisiveisBib = congeladoDesenhoBib
    ? shapesRascunho.filter(f => (Number(f.seg) || DURACAO_PADRAO_BIB) > decorridoCongelBib)
    : shapesRascunho;
  const circuloZoom = zoomPreviewBib
    || (!modoDesenhoBib && pausaAtivaBib && zoomSaidaBib !== pausaAtivaBib.id ? formaComZoom(pausaAtivaBib.shapes) : null)
    || (modoDesenhoBib && congeladoDesenhoBib && zoomSaidaBib !== 'congelado' ? formaComZoom(formasDesenhoVisiveisBib) : null);
  const zoomBib = circuloZoom ? { f: Number(circuloZoom.zoom) } : null;
  /* SAÍDA DO ZOOM EM "MERGULHO". O vídeo do YouTube vive noutro processo
     do browser; ao REDUZIR a ampliação de forma animada, o browser às
     vezes mostra um fotograma com a imagem antiga encolhida num canto,
     com fundo preto (foi o que se viu ao mexer na barra durante o zoom).
     Por isso a entrada continua suave, mas a saída é como na televisão:
     um escurecer muito rápido, a imagem volta ao tamanho normal por
     baixo (sem animação), e clareia. Nunca se vê o fotograma estragado. */
  /* (Revisto) O escurecer da saída ficava preto demais. Agora a saída é
     animada e suave, mas acontece com o vídeo ainda em câmara lenta e
     acaba ANTES de ele retomar (é marcada ~0,9s antes de o círculo sair)
     — era o retomar a meio do afastamento que estragava a imagem. Só um
     corte brusco (mexer na barra a meio) volta ao normal sem animação. */
  const [zoomVisivelBib, setZoomVisivelBib] = useState(null); // ampliação que está de facto no ecrã
  const saidaSuaveZoomRef = useRef(true);
  // Até quando dura a animação de SAÍDA do zoom (0,75 s). Ver o fim do
  // corte: não se pára o vídeo a meio dela.
  const zoomSaiAteRef = useRef(0);
  const zoomAlvoF = zoomBib ? zoomBib.f : 0;
  useEffect(() => {
    if (zoomAlvoF > 1) { saidaSuaveZoomRef.current = true; setZoomVisivelBib(zoomAlvoF); return; }
    setZoomVisivelBib(prev => { if (prev) zoomSaiAteRef.current = Date.now() + 900; return null; });
  }, [zoomAlvoF]);
  if (circuloZoom) {
    const c = circuloZoom.points[0];
    zoomOrigemBib.current = `${Math.max(0, Math.min(100, c.x))}% ${Math.max(0, Math.min(100, (c.y / 56.25) * 100))}%`;
  }
  // Controlo da pausa em curso: { cancelado }. Vive numa ref (e não no
  // "cleanup" do efeito que vigia o tempo) porque o tempo muda várias
  // vezes por segundo — antes, cada atualização do tempo cancelava a
  // pausa a meio, e ela ficava presa: ou não mostrava nada, ou deixava
  // os desenhos agarrados ao ecrã para sempre, em TODOS os cortes.
  const pausaControloRef = useRef(null);
  const pausasJaMostradasRef = useRef(new Set()); // ids já mostrados nesta passagem pelo corte (limpa-se ao recuar ou ao voltar ao início)
  const tempoAnteriorPausaRef = useRef(null); // última leitura do tempo, para detetar a passagem pelo instante da pausa
  const passagemDesdeRef = useRef(null); // ponto a partir do qual a próxima leitura (a tocar) conta como passagem, sem limite de salto
  const aAbrirDesenhoAposFullscreenRef = useRef(false); // "Desenhar" pediu ecrã inteiro — só abre as ferramentas quando ele estiver mesmo ativo
  const arrastoVerticeBib = useRef(null); // { indiceForma, indicePonto } enquanto se arrasta um vértice de uma forma selecionada
  const arrastoCorpoBib = useRef(null); // { indiceForma, ultimoPonto } enquanto se arrasta uma forma inteira (não só um vértice)
  const arrastoRotacaoBib = useRef(null); // { indiceForma } enquanto se roda uma Zona pela pega de cima
  const arrastoInclinacaoBib = useRef(null); // { indiceForma, y0, inc0, h } enquanto se inclina uma Zona (cima/baixo)
  /* RELVADO CALIBRADO (por pausa). `calibracaoBib` = { tipo, W, D, img:
     [4 pontos no ecrã] } — guarda-se na pausa ao gravar. Com ela, a Zona,
     o Círculo, a Seta e a Linha desenham-se NO CHÃO (ver
     `geometriaNoChao` em AnalisadorVideo.jsx): cada forma leva consigo a
     matriz (`chao.H`), por isso desenha-se igual em qualquer reprodução.
     `calibrandoBib` = a marcar os 4 pontos agora ({ tipo, W, D, pontos }). */
  /* GRAVAR VÍDEO DO CORTE (com desenhos, pausas e zoom) — ver
     `prepararGravacaoSeparador` em AnalisadorVideo.jsx. */
  const [gravacaoBib, setGravacaoBib] = useState(null);
  const gravacaoBibRef = useRef(null);
  const areaVideoBibRef = useRef(null);
  const [avisoGravacaoBib, setAvisoGravacaoBib] = useState('');
  // Menu "como partilhar" de um corte (id do corte com o menu aberto).
  // Posição fixa no ecrã (a lista tem scroll próprio e cortaria o menu
  // das últimas linhas); abre para cima quando não há espaço por baixo.
  const [menuPartilha, setMenuPartilha] = useState(null); // { id, right, top | bottom }
  const menuPartilhaId = menuPartilha ? menuPartilha.id : null;
  useEffect(() => {
    if (!menuPartilha) return undefined;
    const fechar = () => setMenuPartilha(null);
    const aoTeclar = (e) => { if (e.key === 'Escape') fechar(); };
    window.addEventListener('click', fechar);
    window.addEventListener('keydown', aoTeclar);
    window.addEventListener('scroll', fechar, true);
    window.addEventListener('resize', fechar);
    return () => {
      window.removeEventListener('click', fechar);
      window.removeEventListener('keydown', aoTeclar);
      window.removeEventListener('scroll', fechar, true);
      window.removeEventListener('resize', fechar);
    };
  }, [menuPartilha]);
  // Janela da gravação: { fase: 'antes' } | { fase: 'pronto', blob, nome, url }
  const [janelaGravacaoBib, setJanelaGravacaoBib] = useState(null);
  const fecharJanelaGravacaoBib = () => {
    setJanelaGravacaoBib(j => { if (j && j.url) URL.revokeObjectURL(j.url); return null; });
  };
  useEffect(() => {
    if (!avisoGravacaoBib) return undefined;
    const t = setTimeout(() => setAvisoGravacaoBib(''), 5000);
    return () => clearTimeout(t);
  }, [avisoGravacaoBib]);
  const [calibracaoBib, setCalibracaoBib] = useState(null);
  const [calibrandoBib, setCalibrandoBib] = useState(null);
  const [painelRelvadoBib, setPainelRelvadoBib] = useState(false);
  const [grelhaBib, setGrelhaBib] = useState(true);
  const [noChaoBib, setNoChaoBib] = useState(true);
  const ultimaCalibracaoBib = useRef(null); // para "usar a calibração anterior" noutro momento
  const arrastoCalibBib = useRef(null); // índice do ponto de calibração a arrastar
  const matrizRelvadoBib = calibracaoBib ? matrizDaCalibracao(calibracaoBib) : null;
  const FERRAMENTAS_NO_CHAO = ['retangulo', 'circulo', 'seta', 'linha', 'medida'];
  const FERRAMENTAS_SO_CHAO = ['medida']; // só existe com o relvado calibrado
  /* FORA DE JOGO POR REFERÊNCIA (não precisa de calibração): 2 pontos numa
     linha paralela à linha de baliza (e, se der, 2 noutra). Fica na pausa.
     `refFJBib` = { l1: [p,q]?, l2: [p,q]?, pronto } */
  const [refFJBib, setRefFJBib] = useState(null);
  const referenciaFJ = () => {
    if (refFJBib && refFJBib.pronto && refFJBib.l1 && refFJBib.l1.length === 2) {
      return referenciaForaDeJogo(refFJBib.l1, refFJBib.l2 && refFJBib.l2.length === 2 ? refFJBib.l2 : null);
    }
    // Sem referência, mas com o relvado bem calibrado: o ponto de fuga sai da calibração.
    if (matrizRelvadoBib && calibracaoBib && !calibracaoBib.duvidosa) {
      const Hi = inverterH(matrizRelvadoBib);
      const cx = Number(calibracaoBib.W) / 2;
      const pr = (q) => { const r = aplicarH(Hi, q); return r ? { x: r.x, y: r.y } : null; };
      const a1 = pr({ x: cx - 20, y: 0 }), b1 = pr({ x: cx + 20, y: 0 }), a2 = pr({ x: cx - 20, y: 16 }), b2 = pr({ x: cx + 20, y: 16 });
      if (a1 && b1 && a2 && b2) return referenciaForaDeJogo([a1, b1], [a2, b2]);
    }
    return null;
  };
  /* Comprimento do campo (para os terços). Os campos de formação variam;
     por omissão 100 m, ajustável no painel do Relvado. */
  const [comprimentoCampoBib, setComprimentoCampoBib] = useState(100);
  // Onde fica o centro da baliza no referencial da calibração (as áreas
  // são centradas nela), e o comprimento — para as linhas de campo.
  const campoDaCalibracaoBib = () => ({ cx: calibracaoBib ? Number(calibracaoBib.W) / 2 : 0, L: comprimentoCampoBib });
  // As formas novas destas ferramentas nascem no chão, se houver calibração.
  /* A calibração do relvado (e o Medir, o Fora de jogo, os corredores e
     os terços) vive só na Análise de Vídeo, o trabalho mais ao pormenor.
     Na Biblioteca as formas desenham-se no ecrã; as que já tinham sido
     gravadas no chão continuam a aparecer como estavam. */
  const chaoParaNova = () => ({});
  // Corredores / terços: uma "forma" de fundo, ligada e desligada no painel.
  const guiasAtuaisBib = shapesRascunho.find(f => f.tool === 'guias');
  const alternarGuiaBib = (chave) => {
    if (!matrizRelvadoBib) return;
    pushHistoricoBib();
    setShapesRascunho(prev => {
      const atual = prev.find(f => f.tool === 'guias');
      const base = atual || { id: uid(), tool: 'guias', color: '#FFFFFF', points: [{ x: 50, y: 28 }], corredores: false, tercos: false };
      const novo = { ...base, [chave]: !base[chave], chao: { H: matrizRelvadoBib, campo: campoDaCalibracaoBib() } };
      const resto = prev.filter(f => f.tool !== 'guias');
      // Ficam por baixo de tudo (primeiro da lista); sem nada ligado, saem.
      return (novo.corredores || novo.tercos) ? [novo, ...resto] : resto;
    });
  };
  // Marcar por CANTOS (4 toques) ou por LINHAS (2 toques em cada uma das
  // 4 linhas da área — para quando os cantos estão tapados ou fora do ecrã).
  const [modoCalibBib, setModoCalibBib] = useState('cantos');
  const comecarCalibracaoBib = (modelo, W, D, modo = modoCalibBib) => {
    setCalibrandoBib({ tipo: modelo.id, W: modelo.W || W, D: modelo.D || D, pontos: [], modo });
    setToolBib(null);
    setFormaEmCursoBib(null);
    setFormaSelecionadaBib(null);
    cancelarRetomaDesenhoBib();
    if (ytATocarRef.current) enviarComandoYoutube('pauseVideo');
  };
  // Os 4 cantos da calibração em curso (pelas linhas, são os cruzamentos).
  // Os 4 cantos tal como foram marcados (à volta da área, por qualquer ordem).
  const cantosCrusBib = (c) => {
    if (!c) return null;
    return c.modo === 'linhas' ? (c.pontos.length === 8 ? cantosDasLinhas(c.pontos) : null) : (c.pontos.length === 4 ? c.pontos : null);
  };
  /* QUAL É A LINHA DE BALIZA — pergunta-se, não se adivinha. Com a câmara
     na bancada lateral, a área aparece "de lado" e a perspetiva sozinha
     não chega para saber que lados são a largura; adivinhar dava o campo
     "em pé" quando ele estava deitado. Depois dos pontos, um toque no lado
     da área colado à baliza resolve: os cantos passam a contar a partir
     daí (P1–P2 = linha de baliza). */
  const cantosCalibBib = (c) => {
    const crus = cantosCrusBib(c);
    if (!crus || c.ladoBaliza == null) return null;
    const k = c.ladoBaliza;
    return [0, 1, 2, 3].map(i => crus[(k + i) % 4]);
  };
  const confirmarCalibracaoBib = () => {
    const c = calibrandoBib;
    const cantos = cantosCalibBib(c);
    if (!cantos) return;
    // Confirmada COM avisos: guarda-se, mas os desenhos novos não vão para
    // o chão (ficariam tortos) até se recalibrar ou ligar à mão.
    const verif = validarCalibracao(cantos, c.W, c.D);
    const duvidosa = !(verif && verif.ok);
    const cal = { tipo: c.tipo, W: c.W, D: c.D, img: cantos, modo: c.modo || 'cantos', ...(c.modo === 'linhas' ? { pontosLinhas: c.pontos } : {}), ...(duvidosa ? { duvidosa: true } : {}) };
    setNoChaoBib(!duvidosa);
    if (!matrizDaCalibracao(cal)) return;
    setCalibracaoBib(cal);
    ultimaCalibracaoBib.current = cal;
    setCalibrandoBib(null);
    setGrelhaBib(true);
  };
  // Centro de uma Zona (retângulo) — é à volta dele que roda.
  const centroZonaBib = (sh) => {
    const [pa, pb] = sh.points;
    return { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
  };
  const [hoverFormaBib, setHoverFormaBib] = useState(null); // índice da forma que o cursor está a apontar (null = nenhuma) — é essa que se destaca e que se move ao carregar
  const overlayRefBib = useRef(null);
  // Distância para "acertar" numa forma ao MOVER/selecionar. O RAIO_TOQUE
  // partilhado (1,5) é tão exato que, depois do primeiro arrasto, o toque
  // seguinte falhava muitas vezes a forma e começava a desenhar outra —
  // parecia que ela tinha ficado presa.
  const RAIO_MOVER_BIB = 2.2; // mais preciso do que antes (3,2): com itens perto uns dos outros, apanhava o errado. O destaque ao passar o rato mostra qual vai ser.
  const RAIO_PEGA_BIB = 1.8;
  // CURSORES FINOS — os do sistema (mira grossa, setas de mover grandes)
  // tapavam o sítio exato onde se ia tocar. Estes são linhas de 1px com
  // contorno escuro (vêem-se em relva clara e em fundo escuro), e o ponto
  // quente fica mesmo no centro.
  const cursorSvg = (svg, fallback) => `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, ${fallback}`;
  const CURSOR_MIRA_FINA = cursorSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">'
    + '<g stroke="#000" stroke-opacity=".55" stroke-width="3"><path d="M12 2v7M12 15v7M2 12h7M15 12h7"/></g>'
    + '<g stroke="#fff" stroke-width="1"><path d="M12 2v7M12 15v7M2 12h7M15 12h7"/></g>'
    + '<circle cx="12" cy="12" r="1" fill="#fff" stroke="#000" stroke-opacity=".55" stroke-width=".8"/></svg>',
    'crosshair');
  const CURSOR_MOVER_FINO = cursorSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">'
    + '<g fill="none" stroke="#000" stroke-opacity=".55" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18M9.5 5.5 12 3l2.5 2.5M9.5 18.5 12 21l2.5-2.5M5.5 9.5 3 12l2.5 2.5M18.5 9.5 21 12l-2.5 2.5"/></g>'
    + '<g fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18M9.5 5.5 12 3l2.5 2.5M9.5 18.5 12 21l2.5-2.5M5.5 9.5 3 12l2.5 2.5M18.5 9.5 21 12l-2.5 2.5"/></g></svg>',
    'move');
  // Caixa à volta de uma forma, para o destaque "é esta que vais mover".
  const caixaFormaBib = (sh) => {
    const pts = sh.points || [];
    if (!pts.length) return null;
    const [a, b] = pts;
    if (sh.tool === 'texto') {
      const largura = Math.max(TAMANHO_FONTE_TEXTO, (sh.texto || '').length * TAMANHO_FONTE_TEXTO * 0.55);
      return { x: a.x, y: a.y - TAMANHO_FONTE_TEXTO, w: largura, h: TAMANHO_FONTE_TEXTO };
    }
    if (sh.tool === 'circulo' && b) {
      const r = Math.hypot(b.x - a.x, b.y - a.y);
      return { x: a.x - r, y: a.y - r, w: 2 * r, h: 2 * r };
    }
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }; // pegas (pontinhos) de uma forma selecionada
  // Tapa o botão de pausa que o próprio YouTube mostra ao centro
  // durante ~2s sempre que o vídeo recomeça a tocar —
  // não há parâmetro do YouTube para o desligar. Ver "MÁSCARA DE RETOMA".
  // Só no centro — a faixa do topo foi retirada a pedido.
  const [mascaraRetomaBib, setMascaraRetomaBib] = useState(false);
  const mascaraRetomaTimerRef = useRef(null);
  const mostrarMascaraRetomaBib = () => {
    setMascaraRetomaBib(true);
    clearTimeout(mascaraRetomaTimerRef.current);
    mascaraRetomaTimerRef.current = setTimeout(() => setMascaraRetomaBib(false), 4500);
  };
  useEffect(() => () => clearTimeout(mascaraRetomaTimerRef.current), []);

  const getPontoBib = (e) => {
    const rect = overlayRefBib.current.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 56.25 };
  };
  // Chamar SEMPRE antes de mudar shapesRascunho a sério (criar, apagar,
  // mover) — nunca antes de um rascunho ainda a meio (formaEmCursoBib),
  // senão "Retroceder" desfazia passos a mais de cada vez.
  // Retoma automática no modo de desenho (ver "MODO DE DESENHO" no efeito
  // das pausas): qualquer mexida do utilizador durante o congelamento
  // cancela-a, para o vídeo não arrancar a meio de uma edição.
  // COMO SE "SEGURA" O VÍDEO NUM DESENHO (opção B, em teste):
  // 'lento' = em vez de pausar, o vídeo passa a VELOCIDADE_LENTA_BIB
  //           durante os segundos do desenho e depois volta a 1x. Como o
  //           YouTube nunca entra em pausa, não desenha o botão de
  //           pausa/play ao centro quando retoma.
  // 'pausa' = o comportamento anterior (pausa + play). Para voltar atrás,
  //           basta mudar esta linha.
  const MODO_SEGURAR_BIB = 'lento';
  /* RELÓGIO DA PARAGEM — conta o tempo no ecrã de cada item, mas PÁRA
     quando se põe o vídeo em pausa e continua de onde ia ao carregar em
     play. Antes os itens desapareciam com o vídeo parado, porque o tempo
     corria na mesma. */
  const criarRelogioBib = () => {
    const r = { decorrido: 0, desde: Date.now(), parado: false, tarefas: [] };
    const lancar = (t, jaPassou) => {
      t.h = setTimeout(() => { t.feito = true; t.fn(); }, Math.max(0, t.ms - jaPassou));
    };
    r.agendar = (ms, fn) => {
      const t = { ms, fn, feito: false, h: null };
      r.tarefas.push(t);
      if (!r.parado) lancar(t, r.decorrido + (Date.now() - r.desde));
    };
    r.pausar = () => {
      if (r.parado) return;
      r.decorrido += Date.now() - r.desde;
      r.parado = true;
      r.tarefas.forEach(t => clearTimeout(t.h));
    };
    r.retomar = () => {
      if (!r.parado) return;
      r.parado = false;
      r.desde = Date.now();
      r.tarefas.forEach(t => { if (!t.feito) lancar(t, r.decorrido); });
    };
    return r;
  };
  const VELOCIDADE_LENTA_BIB = 0.25; // o mínimo que o YouTube aceita
  const retomaDesenhoRef = useRef(null);
  const congeladasDesenhoRef = useRef(new Set());
  const [apagarTodasBib, setApagarTodasBib] = useState(false); // "Limpar" sem pausa aberta: apagar todos os desenhos do corte ao Guardar // pausas já congeladas nesta passagem (modo de desenho) — evita voltar a congelar logo a seguir a retomar
  const cancelarRetomaDesenhoBib = () => {
    const r = retomaDesenhoRef.current;
    if (r) {
      r.cancelado = true;
      if (r.lento) {
        // Mexeu-se em algo durante a câmara lenta: volta a 1x e pára no
        // instante do desenho, para se poder editar com a imagem certa.
        enviarComandoYoutube('setPlaybackRate', [1]);
        enviarComandoYoutube('pauseVideo');
        enviarComandoYoutube('seekTo', [r.t, true]);
      }
    }
    retomaDesenhoRef.current = null;
    setCongeladoDesenhoBib(false);
  };
  /* RECUAR / AVANÇAR — para tudo, incluindo os pontos da Zona livre e
     do Ligar pontos ainda a meio: um ponto no sítio errado tira-se com
     "Recuar" (sai só esse ponto), e "Avançar" volta a pô-lo. Qualquer
     coisa nova que se faça depois de recuar apaga o que havia para
     avançar (como em qualquer editor). */
  const [futuroBib, setFuturoBib] = useState([]); // { tipo: 'formas', shapes } | { tipo: 'ponto', ponto, tool, color }
  const pushHistoricoBib = () => { cancelarRetomaDesenhoBib(); setHistoricoBib(h => [...h.slice(-19), shapesRascunho]); setFuturoBib([]); };
  const podeRecuarBib = historicoBib.length > 0 || !!(formaEmCursoBib && (formaEmCursoBib.tool === 'zonalivre' || formaEmCursoBib.tool === 'linhaPontos'));
  const retrocederBib = () => {
    const f = formaEmCursoBib;
    if (f && (f.tool === 'zonalivre' || f.tool === 'linhaPontos') && f.points.length > 0) {
      const ponto = f.points[f.points.length - 1];
      setFuturoBib(fu => [...fu, { tipo: 'ponto', ponto, tool: f.tool, color: f.color }]);
      setFormaEmCursoBib(f.points.length > 1 ? { ...f, points: f.points.slice(0, -1) } : null);
      return;
    }
    if (historicoBib.length === 0) return;
    setFuturoBib(fu => [...fu, { tipo: 'formas', shapes: shapesRascunho }]);
    setShapesRascunho(historicoBib[historicoBib.length - 1]);
    setHistoricoBib(h => h.slice(0, -1));
    setFormaSelecionadaBib(null);
    setFormaEmCursoBib(null);
  };
  const avancarBib = () => {
    if (futuroBib.length === 0) return;
    const ult = futuroBib[futuroBib.length - 1];
    setFuturoBib(fu => fu.slice(0, -1));
    if (ult.tipo === 'ponto') {
      setFormaEmCursoBib(prev => (prev && prev.tool === ult.tool
        ? { ...prev, points: [...prev.points, ult.ponto] }
        : { tool: ult.tool, color: ult.color, points: [ult.ponto] }));
      return;
    }
    setHistoricoBib(h => [...h.slice(-19), shapesRascunho]);
    setShapesRascunho(ult.shapes);
    setFormaSelecionadaBib(null);
  };
  // Carrega uma pausa para o rascunho (existente = editar; null = nova
  // no instante `tempo`). Usado ao abrir o desenho e ao escolher uma
  // pausa na lista "Pausas neste corte".
  // Uma pausa mesmo no fim do corte nunca chegava a parar o vídeo: o
  // ciclo do corte voltava ao início no mesmo instante, e os desenhos
  // apareciam por cima do arranque seguinte. Fica sempre meio segundo
  // antes do fim.
  const tempoSeguroNoCorte = (t) => {
    const n = Number(t);
    if (!Number.isFinite(n)) return clipIni;
    return Math.max(clipIni, Math.min(n, clipFimEf - 0.5));
  };
  /* MESMO MOMENTO = MESMA PAUSA; OUTRO MOMENTO = PAUSA NOVA. Desenhar
     onde já há uma pausa (até 2s de distância) junta-se a ela — tudo
     aparece na mesma paragem. Noutro momento do corte, sem nada a ver
     com essa, nasce uma pausa nova nesse instante. As duas disparam na
     mesma reprodução do corte. */
  /* (Revisto) Era 2 s: num corte curto, itens postos a 1 ou 2 s uns dos
     outros juntavam-se na mesma paragem (todos no tempo do primeiro) e o
     de depois nunca aparecia no momento dele. Agora só se juntam itens
     praticamente no mesmo instante; cada momento tem a sua paragem. */
  const JANELA_MESMA_PAUSA_BIB = 0.5;
  /* MAS OS DESENHOS SÓ APARECEM NO MOMENTO DELES. Ao entrar no desenho
     ou escolher uma ferramenta, a pausa que já existe só é aberta (e os
     itens dela só aparecem) se o vídeo estiver MESMO nesse instante. A
     poucos segundos dela começa-se em branco — e é ao gravar que o que
     se desenhou se junta a essa pausa (ver `guardarDesenhoBib`). */
  const JANELA_ABRIR_PAUSA_BIB = 0.35;
  const pausaMaisPertoBib = (t, janela = JANELA_MESMA_PAUSA_BIB) => {
    const lista = (active && active.anotacoesPausa) || [];
    let melhor = null;
    lista.forEach(x => {
      const d = Math.abs(tempoPausaNoCorte(x) - t);
      if (d < janela && (!melhor || d < Math.abs(tempoPausaNoCorte(melhor) - t))) melhor = x;
    });
    return melhor;
  };
  const abrirPausaBib = (existente, tempo) => {
    setCalibrandoBib(null);
    // A calibração é de cada pausa (a câmara pode ter mexido entre pausas).
    setCalibracaoBib(existente && existente.calibracao ? existente.calibracao : null);
    setRefFJBib(existente && existente.refForaJogo ? { ...existente.refForaJogo, pronto: true } : null);
    if (existente) {
      // As formas que já lá estavam ficam com o tempo delas; o contador
      // de segundos começa no valor de sempre, e vale só para as novas.
      setShapesRascunho((existente.shapes || []).map(sh => ({ ...sh, id: sh.id || uid(), seg: segDaForma(sh, existente) })));
      setDuracaoPausaBib(DURACAO_PADRAO_BIB);
      setAnotacaoIdEmEdicaoBib(existente.id);
      // Grava-se com o instante já corrigido para dentro do corte (ver
      // tempoPausaNoCorte) — assim uma pausa antiga, gravada fora do
      // corte, fica reparada assim que é aberta e guardada.
      setTempoAnotacaoBib(tempoPausaNoCorte(existente));
    } else {
      setShapesRascunho([]);
      setDuracaoPausaBib(DURACAO_PADRAO_BIB);
      setAnotacaoIdEmEdicaoBib(null);
      setTempoAnotacaoBib(tempoSeguroNoCorte(tempo));
    }
    setFormaEmCursoBib(null);
    setFormaSelecionadaBib(null);
    setFormaTextoBib(null);
    setHistoricoBib([]);
    setFuturoBib([]);
  };
  // Tempo atual do leitor, garantidamente dentro do corte.
  const tempoAtualNoCorteBib = () => {
    const lido = currentTimeRef.current || liveTime;
    return (lido >= clipIni - 1.25 && lido <= clipFimEf + 0.75)
      ? Math.min(Math.max(lido, clipIni), clipFimEf)
      : clipIni;
  };
  const alternarReproducaoBib = () => {
    cancelarRetomaDesenhoBib();
    if (!ytATocarRef.current && modoDesenhoBib && anotacaoIdEmEdicaoBib) {
      // Carregar em play PARADO numa pausa já aberta: segue em frente sem
      // voltar a congelar nela no mesmo instante.
      const t = currentTimeRef.current || liveTime;
      if (t >= tempoAnotacaoBib - 0.3) congeladasDesenhoRef.current.add(anotacaoIdEmEdicaoBib);
    }
    enviarComandoYoutube(ytATocarRef.current ? 'pauseVideo' : 'playVideo');
  };
  // Escolher uma ferramenta (tocar outra vez na ativa desliga-a). Se o
  // vídeo andou desde que se abriu o desenho (sem ferramenta, a tocar no
  // vídeo), pára-o e muda a pausa para o instante onde ele está agora —
  // mas só enquanto ainda não se desenhou nada nesta pausa.
  // BARRA DE ESPAÇO = reproduzir / pausar o vídeo da Biblioteca.
  // Ignorada enquanto se escreve (campos de texto, texto num desenho) e
  // com Ctrl/Alt/Cmd. preventDefault: sem isto o espaço também fazia a
  // página descer, ou "carregava" no último botão clicado.
  /* TOQUE DUPLO NAS LATERAIS = recuar / avançar 10 s, como no YouTube
     (o leitor incorporado não o faz sempre, sobretudo no computador e
     com o ecrã inteiro do YouTube desligado). Toque simples = pausar /
     reproduzir. Toques seguidos somam (20 s, 30 s…). */
  const [saltoBib, setSaltoBib] = useState(null); // { lado: -1|1, total, k }
  /* As zonas laterais ficam POR CIMA do leitor do YouTube. A arrastar a
     barra do YouTube com o rato, se o cursor passasse por cima de uma
     zona, o YouTube deixava de receber o movimento e o arrasto parava.
     Por isso: as zonas ficam longe da barra (metade de cima do vídeo) e,
     se o rato chegar a uma zona com o botão carregado (= a meio de um
     arrasto), elas desligam-se uns segundos e deixam passar tudo. */
  const [zonasLadoOff, setZonasLadoOff] = useState(false);
  const zonasLadoTimerRef = useRef(null);
  const desligarZonasLado = () => {
    setZonasLadoOff(true);
    if (zonasLadoTimerRef.current) clearTimeout(zonasLadoTimerRef.current);
    zonasLadoTimerRef.current = setTimeout(() => setZonasLadoOff(false), 2500);
  };
  const toqueLadoRef = useRef({ lado: 0, t: 0, timer: null, total: 0, fim: null });
  const tocarLadoBib = (lado) => {
    const agoraMs = Date.now();
    const st = toqueLadoRef.current;
    if (st.lado === lado && agoraMs - st.t < 320) {
      if (st.timer) { clearTimeout(st.timer); st.timer = null; }
      st.total += 10;
      st.t = agoraMs;
      const base = currentTimeRef.current || liveTime || 0;
      let alvo = Math.max(0, base + lado * 10);
      // Num corte, não sai dos limites do corte.
      if (active && typeof active.clipInicio === 'number') {
        const fimC = typeof active.clipFim === 'number' ? active.clipFim : Infinity;
        alvo = Math.min(Math.max(alvo, active.clipInicio), Math.max(active.clipInicio, fimC - 0.3));
      }
      currentTimeRef.current = alvo;
      enviarComandoYoutube('seekTo', [alvo, true]);
      setSaltoBib({ lado, total: st.total, k: agoraMs });
      if (st.fim) clearTimeout(st.fim);
      st.fim = setTimeout(() => { setSaltoBib(null); st.total = 0; st.lado = 0; }, 700);
      return;
    }
    if (st.timer) clearTimeout(st.timer);
    st.lado = lado; st.t = agoraMs; st.total = 0;
    st.timer = setTimeout(() => { st.timer = null; alternarReproducaoBib(); }, 300);
  };
  useEffect(() => () => { const st = toqueLadoRef.current; if (st.timer) clearTimeout(st.timer); if (st.fim) clearTimeout(st.fim); }, []);
  const alternarReproducaoBibRef = useRef(null);
  alternarReproducaoBibRef.current = () => alternarReproducaoBib();
  const temVideoBibRef = useRef(false); // atualizado mais abaixo, depois de `active`/`isBlocked` existirem
  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
      const alvo = e.target;
      const tag = alvo && alvo.tagName ? alvo.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (alvo && alvo.isContentEditable)) return;
      if (!temVideoBibRef.current) return;
      e.preventDefault();
      alternarReproducaoBibRef.current && alternarReproducaoBibRef.current();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  /* "Fechar zona" / "Terminar linha": fecha e passa logo para a MÃO — a
     forma acabada fica selecionada e pronta a arrastar, sem ter de
     escolher outra ferramenta. */
  const fecharEMoverBib = () => {
    const n = shapesRascunho.length;
    if (concluirFormaMultiplaBib()) {
      setToolBib(null);
      setFormaSelecionadaBib(n);
    }
  };
  const escolherFerramentaBib = (id) => {
    cancelarRetomaDesenhoBib();
    const nova = toolBib === id ? null : id;
    // Zona livre / ligar pontos a meio: fecha-se e fica neste momento.
    const fechouUma = concluirFormaMultiplaBib();
    setToolBib(nova);
    setFormaEmCursoBib(null);
    setFormaSelecionadaBib(null);
    setHoverFormaBib(null);
    if (!nova) return;
    const agora = tempoAtualNoCorteBib();
    if (ytATocarRef.current) {
      enviarComandoYoutube('pauseVideo');
      // Volta ao instante exato lido, para a imagem parada ser a mesma
      // em que a pausa vai disparar mais tarde.
      enviarComandoYoutube('seekTo', [agora, true]);
    }
    // Ainda com o que se desenhou por gravar, ou no mesmo instante: fica.
    if (fechouUma || historicoBib.length > 0 || Math.abs(agora - tempoAnotacaoBib) < 0.3) return;
    // Mudou de momento: a pausa que estiver mesmo aqui, ou uma nova.
    const existente = pausaMaisPertoBib(agora, JANELA_ABRIR_PAUSA_BIB);
    abrirPausaBib(existente || null, agora);
  };
  const escolherPausaBib = (a) => {
    cancelarRetomaDesenhoBib();
    enviarComandoYoutube('seekTo', [tempoPausaNoCorte(a), true]);
    abrirPausaBib(a);
  };
  const comecarDesenhoBib = () => {
    enviarComandoYoutube('pauseVideo');
    // O instante da pausa tem de ficar DENTRO do corte. Logo a seguir a
    // abrir um corte, o tempo ainda vale 0 (é reposto ao trocar de
    // vídeo) até o leitor mandar a primeira leitura — uma pausa gravada
    // nesse intervalo ficava no segundo 0 do jogo e nunca disparava.
    const agora = tempoAtualNoCorteBib();
    // Já existe uma pausa guardada bem perto de onde estamos? Abre-a
    // para editar, em vez de criar uma nova ao lado (a 1s de distância
    // já conta como "a mesma", para não ser preciso acertar ao segundo).
    // As restantes ficam acessíveis na lista "Pausas neste corte".
    const anotacoes = active.anotacoesPausa || [];
    // O vídeo fica onde está (já não salta para a primeira pausa). O
    // "Limpar" está disponível logo à entrada sempre que o corte tenha
    // desenhos: sem nenhuma pausa aberta, apaga TODOS os do corte (só a
    // sério ao Guardar — ver `apagarTodasBib`).
    // Só abre (e mostra) a pausa que estiver mesmo neste instante; fora
    // dele começa em branco — nada aparece antes do momento certo.
    const existente = anotacoes.length ? pausaMaisPertoBib(agora, JANELA_ABRIR_PAUSA_BIB) : null;
    cancelarRetomaDesenhoBib();
    // Nenhuma pausa fica de fora: a 1ª reprodução no modo de desenho
    // congela em todas (antes, a pausa aberta à entrada era saltada na 1ª
    // volta — "na primeira reprodução não dá nada").
    congeladasDesenhoRef.current = new Set();
    setApagarTodasBib(false);
    abrirPausaBib(existente || null, agora);
    // Entra SEM ferramenta ativa: assim dá para tocar no vídeo para o pôr
    // a andar/parar e escolher o momento certo antes de desenhar.
    setToolBib(null);
    setFormaEmCursoBib(null);
    setFormaSelecionadaBib(null);
    setFormaTextoBib(null);
    setHoverFormaBib(null);
    setHistoricoBib([]);
    setFuturoBib([]);
    if (ytFull) {
      setModoDesenhoBib(true);
    } else {
      // Ainda não está em ecrã inteiro — só se abrem as ferramentas
      // quando ele estiver mesmo ativo (ver o efeito mais abaixo, que
      // vigia `ytFull`); pedir os dois ao mesmo tempo fazia a barra
      // aparecer um instante antes do ecrã mudar, como um erro.
      aAbrirDesenhoAposFullscreenRef.current = true;
      toggleYtFull();
    }
  };
  const cancelarDesenhoBib = () => { setApagarTodasBib(false); setModoDesenhoBib(false); setFormaEmCursoBib(null); setFormaSelecionadaBib(null); setFormaTextoBib(null); };
  // Esc sai do modo de desenho (como "Cancelar desenho"). A escrever um
  // texto no desenho, o Esc só fecha esse texto.
  const cancelarDesenhoBibRef = useRef(null);
  cancelarDesenhoBibRef.current = cancelarDesenhoBib;
  useEffect(() => {
    if (!modoDesenhoBib) return undefined;
    const aoTeclar = (e) => {
      if (e.key !== 'Escape') return;
      const alvo = e.target;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      cancelarDesenhoBibRef.current();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [modoDesenhoBib]);
  // "Concluído": as formas desta vez (sem `seg`) ficam com o tempo
  // escolhido agora; as que já existiam não mudam.
  const fecharFormasBib = (lista) => (lista || []).map(f => (Number(f.seg) ? f : { ...f, seg: Math.max(1, duracaoPausaBib) }));
  const guardarDesenhoBib = () => {
    // Inclui a zona livre / linha de pontos que ainda estiver a meio.
    const fEmCurso = formaEmCursoBib;
    const rascunho = formaMultiplaValidaBib(fEmCurso)
      ? [...shapesRascunho, { id: uid(), tool: fEmCurso.tool, color: fEmCurso.color, points: fEmCurso.points }]
      : shapesRascunho;
    if (apagarTodasBib) {
      // "Limpar" à entrada: saem todos os desenhos do corte. Se entretanto
      // se desenhou algo novo, fica só essa pausa nova.
      const formas = fecharFormasBib(rascunho);
      const nova = formas.length > 0
        ? [{ id: uid(), tempoVideo: tempoAnotacaoBib, duracaoSegundos: Math.max(...formas.map(f => f.seg)), shapes: formas, ...(calibracaoBib ? { calibracao: calibracaoBib } : {}) }]
        : [];
      nova.forEach(a => pausasJaMostradasRef.current.add(a.id));
      setItensDoAtivo(prev => prev.map(v => (v.id === active.id ? { ...v, anotacoesPausa: nova } : v)));
      setApagarTodasBib(false);
      abrirPausaBib(nova[0] || null, tempoAnotacaoBib); // fica no desenho
      return;
    }
    if (rascunho.length === 0) {
      // Limpaste tudo e gravaste por cima — se isto era uma pausa já
      // existente, conta como quereres apagá-la a sério (não só sair
      // sem gravar, que deixaria a pausa antiga como estava).
      if (anotacaoIdEmEdicaoBib) {
        setItensDoAtivo(prev => prev.map(v => (v.id === active.id ? { ...v, anotacoesPausa: (v.anotacoesPausa || []).filter(a => a.id !== anotacaoIdEmEdicaoBib) } : v)));
      }
      abrirPausaBib(null, tempoAnotacaoBib); // fica no desenho, em branco
      return;
    }
    let formas = fecharFormasBib(rascunho);
    let idPausa = anotacaoIdEmEdicaoBib;
    let tempoPausa = tempoAnotacaoBib;
    // Desenho novo a menos de 2s de uma pausa que já existe: junta-se a
    // ela (mesmo momento = mesma paragem), sem mexer nos itens dela.
    if (!idPausa) {
      const vizinha = pausaMaisPertoBib(tempoAnotacaoBib);
      if (vizinha) {
        idPausa = vizinha.id;
        tempoPausa = vizinha.tempoVideo;
        formas = [...(vizinha.shapes || []).map(f => ({ ...f, seg: segDaForma(f, vizinha) })), ...formas];
      }
    }
    const calPausa = calibracaoBib || (idPausa && ((active.anotacoesPausa || []).find(x => x.id === idPausa) || {}).calibracao) || null;
    const refPausa = refFJBib && refFJBib.pronto ? { l1: refFJBib.l1, l2: refFJBib.l2 } : null;
    const novaAnotacao = { id: idPausa || uid(), tempoVideo: tempoPausa, duracaoSegundos: Math.max(...formas.map(f => f.seg)), shapes: formas, ...(calPausa ? { calibracao: calPausa } : {}), ...(refPausa ? { refForaJogo: refPausa } : {}) };
    // Acabou de a ver ao desenhar — não voltar a parar no mesmo sítio
    // assim que se carrega em reproduzir (só na próxima passagem).
    pausasJaMostradasRef.current.add(novaAnotacao.id);
    setItensDoAtivo(prev => prev.map(v => {
      if (v.id !== active.id) return v;
      const outras = (v.anotacoesPausa || []).filter(a => a.id !== novaAnotacao.id);
      return { ...v, anotacoesPausa: [...outras, novaAnotacao].sort((a, b) => a.tempoVideo - b.tempoVideo) };
    }));
    /* GRAVAR NÃO SAI DO DESENHO. Fica-se na mesma pausa, agora gravada:
       os itens continuam no ecrã, prontos a mexer outra vez (posição,
       cor, tempo…), e pode-se ir a outro minuto desenhar mais. Do modo
       de desenho só se sai com "Cancelar desenho" ou com Esc. */
    abrirPausaBib(novaAnotacao);
  };
  const apagarAnotacaoAtualBib = () => {
    if (anotacaoIdEmEdicaoBib) {
      setItensDoAtivo(prev => prev.map(v => (v.id === active.id ? { ...v, anotacoesPausa: (v.anotacoesPausa || []).filter(a => a.id !== anotacaoIdEmEdicaoBib) } : v)));
    }
    abrirPausaBib(null, tempoAnotacaoBib); // continua no desenho, em branco
  };
  const confirmarTextoBib = () => {
    setFormaTextoBib(t => {
      if (t && t.valor.trim()) {
        pushHistoricoBib();
        setShapesRascunho(prev => [...prev, { id: uid(), tool: 'texto', texto: t.valor.trim(), color: corBib, points: [t.pt] }]);
      }
      return null;
    });
  };
  const iniciarFormaBib = (e) => {
    // CAUSA DO "FICA PRESO": o texto (e as letras dos desenhos) são texto
    // a sério dentro do desenho. Ao carregar e arrastar, o browser às
    // vezes começava o arrasto NATIVO dele (cursor de proibido 🚫 com a
    // letra agarrada), que rouba o gesto à app — a forma parava de
    // seguir o rato. preventDefault aqui desliga a seleção/arrasto nativo.
    if (e.cancelable) e.preventDefault();
    const p = getPontoBib(e);
    // Prende o ponteiro ao desenho enquanto o dedo/rato estiver em baixo:
    // um arrasto rápido que saísse por instantes da área deixava de ser
    // seguido (e parecia que a forma "não queria" mexer).
    try { overlayRefBib.current && overlayRefBib.current.setPointerCapture(e.pointerId); } catch (err) {}
    // Qualquer arrasto que tenha ficado "pendurado" (largar fora da
    // janela, gesto cancelado pelo telemóvel) é descartado aqui — senão o
    // toque seguinte continuava o arrasto antigo em vez de começar outro.
    arrastoVerticeBib.current = null;
    arrastoCorpoBib.current = null;
    arrastoRotacaoBib.current = null;
    arrastoInclinacaoBib.current = null;
    cancelarRetomaDesenhoBib(); // tocou no desenho durante um congelamento: fica parado para editar
    // A calibrar: cada toque é um dos 4 cantos (depois arrastam-se para acertar).
    if (calibrandoBib) {
      const maximo = calibrandoBib.modo === 'linhas' ? 8 : 4;
      if (calibrandoBib.pontos.length < maximo) { setCalibrandoBib(c => ({ ...c, pontos: [...c.pontos, p] })); return; }
      // Pontos todos postos: o toque seguinte escolhe a linha de baliza.
      if (calibrandoBib.ladoBaliza == null) {
        const crus = cantosCrusBib(calibrandoBib);
        if (!crus) return;
        let melhor = -1, dist = Infinity;
        for (let k = 0; k < 4; k++) {
          const p1 = crus[k], p2 = crus[(k + 1) % 4];
          const dx = p2.x - p1.x, dy = p2.y - p1.y, l2 = dx * dx + dy * dy || 1;
          const t = Math.max(0, Math.min(1, ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / l2));
          const d = Math.hypot(p.x - (p1.x + t * dx), p.y - (p1.y + t * dy));
          if (d < dist) { dist = d; melhor = k; }
        }
        if (melhor >= 0 && dist < 8) setCalibrandoBib(c => ({ ...c, ladoBaliza: melhor }));
      }
      return;
    }
    if (formaTextoBib) { confirmarTextoBib(); return; } // um texto a meio de ser escrito fecha-se primeiro
    /* PAUSA NOVA = O MOMENTO DO PRIMEIRO ITEM. O instante de uma pausa em
       branco era o de quando ela foi aberta (às vezes a meio da
       reprodução, antes de se parar no sítio certo). Agora fica o
       instante em que se desenha o primeiro item dela. */
    if (toolBib && toolBib !== 'apagar' && !anotacaoIdEmEdicaoBib && shapesRascunho.length === 0 && !formaEmCursoBib) {
      setTempoAnotacaoBib(tempoSeguroNoCorte(tempoAtualNoCorteBib()));
    }
    if (toolBib === 'apagar') {
      let alvo = -1, melhor = Infinity;
      shapesRascunho.forEach((sh, i) => { const d = distanciaShape(sh, p); if (d < RAIO_TOQUE && d < melhor) { melhor = d; alvo = i; } });
      if (alvo !== -1) {
        pushHistoricoBib();
        setShapesRascunho(prev => prev.filter((_, i) => i !== alvo));
        if (formaSelecionadaBib === alvo) setFormaSelecionadaBib(null);
      }
      return;
    }
    if (toolBib === 'texto') {
      // Tocar em cima de um item já feito (incluindo um texto) seleciona-o
      // e arrasta-o, como nas outras ferramentas; só num sítio vazio é que
      // começa um texto novo. Antes, com o Texto ativo, nada se movia.
      let iTexto = -1, dTexto = Infinity;
      shapesRascunho.forEach((sh, i) => { const d = distanciaShape(sh, p); if (d < RAIO_MOVER_BIB && d < dTexto) { dTexto = d; iTexto = i; } });
      if (iTexto !== -1) {
        setFormaSelecionadaBib(iTexto);
        arrastoCorpoBib.current = { indiceForma: iTexto, ultimoPonto: p, historicoEmpurrado: false };
        return;
      }
      const rect = overlayRefBib.current.getBoundingClientRect();
      setFormaTextoBib({ pt: p, xPix: e.clientX - rect.left, yPix: e.clientY - rect.top, valor: '' });
      return;
    }
    if (toolBib === 'zonalivre' || toolBib === 'linhaPontos') {
      setFuturoBib([]);
      setFormaEmCursoBib(prev => ({
        tool: toolBib, color: corBib,
        points: prev && prev.tool === toolBib ? [...prev.points, p] : [p],
      }));
      return;
    }
    // Antes de começar a desenhar uma forma nova: se houver uma forma
    // selecionada, um toque num dos vértices dela move-o, em vez de
    // criar uma forma nova por cima.
    if (formaSelecionadaBib != null && shapesRascunho[formaSelecionadaBib]) {
      const forma = shapesRascunho[formaSelecionadaBib];
      const iVertice = forma.points.findIndex(pt => Math.hypot(pt.x - p.x, pt.y - p.y) < RAIO_PEGA_BIB);
      // No círculo, o ponto do CENTRO move o círculo inteiro (é onde
      // naturalmente se pega nele). Só o ponto da borda muda o tamanho.
      if (iVertice !== -1 && !(iVertice === 0 && forma.tool === 'circulo')) {
        pushHistoricoBib();
        arrastoVerticeBib.current = { indiceForma: formaSelecionadaBib, indicePonto: iVertice };
        return;
      }
      // A forma que JÁ está selecionada tem prioridade: um toque perto
      // dela move-a, mesmo que haja outra forma ainda mais perto.
      if (iVertice !== -1 || distanciaShape(forma, p) < RAIO_MOVER_BIB) {
        arrastoCorpoBib.current = { indiceForma: formaSelecionadaBib, ultimoPonto: p, historicoEmpurrado: false };
        return;
      }
    }
    // Um toque em cima (ou perto) de uma forma já feita seleciona-a E já
    // começa a arrastá-la — um único gesto (toca e arrasta).
    let indiceAcertado = -1, melhorDist = Infinity;
    shapesRascunho.forEach((sh, i) => { const d = distanciaShape(sh, p); if (d < RAIO_MOVER_BIB && d < melhorDist) { melhorDist = d; indiceAcertado = i; } });
    if (indiceAcertado !== -1) {
      setFormaSelecionadaBib(indiceAcertado);
      arrastoCorpoBib.current = { indiceForma: indiceAcertado, ultimoPonto: p, historicoEmpurrado: false };
      return;
    }
    setFormaSelecionadaBib(null);
    // Sem ferramenta: tocar num sítio vazio do vídeo reproduz/pausa.
    if (!toolBib) { alternarReproducaoBib(); return; }
    // Fora de jogo: primeiro a referência (se faltar), depois um toque nos pés.
    if (toolBib === 'foraDeJogo') {
      const r = referenciaFJ();
      if (!r) {
        setRefFJBib(prev => {
          const ref = prev || { l1: [], l2: [], pronto: false };
          if (ref.l1.length < 2) return { ...ref, l1: [...ref.l1, p] };
          if (ref.l2.length < 2) {
            const l2 = [...ref.l2, p];
            return { ...ref, l2, pronto: l2.length === 2 };
          }
          return ref;
        });
        return;
      }
      pushHistoricoBib();
      const n = shapesRascunho.length;
      setShapesRascunho(prev => [...prev, { id: uid(), tool: 'foraDeJogo', color: corBib, points: [p], fj: r }]);
      setFormaSelecionadaBib(n);
      return;
    }
    if (FERRAMENTAS_SO_CHAO.includes(toolBib) && !matrizRelvadoBib) return;
    setFormaEmCursoBib({ tool: toolBib, color: corBib, points: toolBib === 'livre' ? [p] : [p, p], ...chaoParaNova(toolBib) });
  };
  // ARRASTO FLUIDO — o rato manda dezenas de movimentos por segundo, e
  // cada um redesenhava a Biblioteca inteira (um ecrã muito grande), o
  // que dava solavancos. Agora guarda-se só o último ponto e aplica-se
  // uma vez por fotograma do ecrã (requestAnimationFrame).
  const pontoPendenteBib = useRef(null);
  const rafArrastoBib = useRef(null);
  const aplicarArrastoBib = () => {
    rafArrastoBib.current = null;
    const p = pontoPendenteBib.current;
    pontoPendenteBib.current = null;
    if (!p) return;
    if (arrastoCalibBib.current != null) {
      const k = arrastoCalibBib.current;
      setCalibrandoBib(c => (c ? { ...c, pontos: c.pontos.map((q, i) => (i === k ? p : q)) } : c));
      return;
    }
    if (arrastoInclinacaoBib.current) {
      // Arrastar para cima = o lado de cima foge para o fundo (mais
      // perspetiva); para baixo = endireita e, passando o meio, inverte.
      const { indiceForma, y0, inc0, h } = arrastoInclinacaoBib.current;
      const inc = Math.max(-0.45, Math.min(0.45, inc0 + ((y0 - p.y) / Math.max(4, h)) * 0.5));
      setShapesRascunho(prev => prev.map((sh, i) => (i !== indiceForma ? sh : { ...sh, inclinacao: Math.round(inc * 1000) / 1000 })));
      return;
    }
    if (arrastoRotacaoBib.current) {
      const { indiceForma } = arrastoRotacaoBib.current;
      setShapesRascunho(prev => prev.map((sh, i) => {
        if (i !== indiceForma) return sh;
        // Zona no chão: roda no próprio relvado.
        if (sh.chao) return { ...sh, rotacao: Math.round(anguloRodarZonaNoChao(sh, p) * 10) / 10 };
        const c = centroZonaBib(sh);
        const graus = (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI + 90; // a pega fica por cima do centro
        return { ...sh, rotacao: Math.round(graus * 10) / 10 };
      }));
      return;
    }
    if (arrastoVerticeBib.current) {
      const { indiceForma, indicePonto } = arrastoVerticeBib.current;
      setShapesRascunho(prev => prev.map((sh, i) => {
        if (i !== indiceForma) return sh;
        // Zona rodada: o canto que se vê está rodado — volta-se ao
        // referencial dela antes de o guardar.
        const pLocal = sh.tool === 'retangulo' && sh.rotacao
          ? (sh.chao ? desrodarNaZonaNoChao(sh, p) : girar(p, centroZonaBib(sh), -sh.rotacao))
          : p;
        return { ...sh, points: sh.points.map((pt, pi) => (pi === indicePonto ? pLocal : pt)) };
      }));
      return;
    }
    if (arrastoCorpoBib.current) {
      const estado = arrastoCorpoBib.current;
      const dx = p.x - estado.ultimoPonto.x, dy = p.y - estado.ultimoPonto.y;
      estado.ultimoPonto = p;
      if (dx === 0 && dy === 0) return;
      setShapesRascunho(prev => prev.map((sh, i) => (i !== estado.indiceForma ? sh : { ...sh, points: sh.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) })));
    }
  };
  const moverFormaBib = (e) => {
    const p = getPontoBib(e);
    if (arrastoVerticeBib.current || arrastoCorpoBib.current || arrastoRotacaoBib.current || arrastoInclinacaoBib.current || arrastoCalibBib.current != null) {
      const estado = arrastoCorpoBib.current;
      if (estado && !estado.historicoEmpurrado) { pushHistoricoBib(); estado.historicoEmpurrado = true; } // só regista no undo quando SE MEXE mesmo, não só ao tocar
      pontoPendenteBib.current = p;
      if (!rafArrastoBib.current) rafArrastoBib.current = requestAnimationFrame(aplicarArrastoBib);
      return;
    }
    if (!formaEmCursoBib || formaEmCursoBib.tool === 'zonalivre' || formaEmCursoBib.tool === 'linhaPontos') {
      // Nada a arrastar — só verifica se o cursor está perto de uma
      // forma já feita, para o cursor mudar para "mover" (mãozinha).
      if (toolBib !== 'apagar' && toolBib !== 'zonalivre' && toolBib !== 'linhaPontos') {
        let iPerto = null, dPerto = Infinity;
        shapesRascunho.forEach((sh, i) => { const d = distanciaShape(sh, p); if (d < RAIO_MOVER_BIB && d < dPerto) { dPerto = d; iPerto = i; } });
        setHoverFormaBib(iPerto);
      }
      return;
    }
    setFormaEmCursoBib(prev => (prev.tool === 'livre' ? { ...prev, points: [...prev.points, p] } : { ...prev, points: [prev.points[0], p] }));
  };
  const terminarFormaBib = () => {
    // Aplica já o último movimento que ainda estava à espera do fotograma,
    // para a forma ficar exatamente onde se largou.
    if (rafArrastoBib.current) { cancelAnimationFrame(rafArrastoBib.current); aplicarArrastoBib(); }
    if (arrastoCalibBib.current != null) { arrastoCalibBib.current = null; return; }
    if (arrastoInclinacaoBib.current) { arrastoInclinacaoBib.current = null; return; }
    if (arrastoRotacaoBib.current) { arrastoRotacaoBib.current = null; return; }
    if (arrastoVerticeBib.current) { arrastoVerticeBib.current = null; return; }
    if (arrastoCorpoBib.current) { arrastoCorpoBib.current = null; return; }
    if (!formaEmCursoBib || formaEmCursoBib.tool === 'zonalivre' || formaEmCursoBib.tool === 'linhaPontos') return; // essas só terminam com "Fechar" (ou ao gravar / mudar de ferramenta)
    const { tool, color, points } = formaEmCursoBib;
    // O Tubo também se põe com um toque só (largura por omissão).
    const pontosFinais = tool === 'tubo' && Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) < 1
      ? [points[0], { x: points[0].x + 2.4, y: points[0].y }]
      : points;
    const pequenoDemais = tool === 'livre' ? points.length < 2 : (tool !== 'tubo' && Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) < 1);
    if (pequenoDemais) { setFormaEmCursoBib(null); return; } // só um toque, sem arrastar — ignora
    pushHistoricoBib();
    setShapesRascunho(prev => [...prev, { id: uid(), tool, color, points: pontosFinais, ...(formaEmCursoBib.chao ? { chao: formaEmCursoBib.chao } : {}) }]);
    setFormaEmCursoBib(null);
  };
  /* ZONA LIVRE e LIGAR PONTOS acumulam com o resto. Uma destas a meio
     (pontos postos, ainda sem "Fechar") já não se perde: entra no
     desenho ao mudar de ferramenta e ao gravar ("Concluído"/"Guardar"),
     junto com os outros itens deste momento. Antes desaparecia — e
     parecia que não dava para as juntar a mais nada. */
  const formaMultiplaValidaBib = (f) => !!f && (f.tool === 'zonalivre' || f.tool === 'linhaPontos')
    && f.points.length >= (f.tool === 'zonalivre' ? 3 : 2);
  const concluirFormaMultiplaBib = () => {
    const f = formaEmCursoBib;
    const ok = formaMultiplaValidaBib(f);
    if (ok) {
      pushHistoricoBib();
      setShapesRascunho(prev => [...prev, { id: uid(), tool: f.tool, color: f.color, points: f.points }]);
    }
    setFormaEmCursoBib(null);
    return ok;
  };
  const apagarSelecionadaBib = () => {
    if (formaSelecionadaBib == null) return;
    pushHistoricoBib();
    setShapesRascunho(prev => prev.filter((_, i) => i !== formaSelecionadaBib));
    setFormaSelecionadaBib(null);
  };
  const [clipMarcas, setClipMarcas] = useState({ inicio: null, fim: null });
  const [tituloClipe, setTituloClipe] = useState('');
  /* CLIPE DO ATLETA (Portal) — só existe quando o Portal passa
     `criarClipeAtleta`. O fluxo é o mesmo (marcar início, marcar fim),
     mas para gravar o jogador tem de catalogar: título obrigatório e um
     texto livre. Grava no servidor (função `checkin_clipe_criar`) e não
     na lista local, porque o Portal não escreve nas tabelas. */
  const [notaClipe, setNotaClipe] = useState('');
  const [aGravarClipeAtleta, setAGravarClipeAtleta] = useState(false);
  const [erroClipeAtleta, setErroClipeAtleta] = useState('');
  // Apagar um clipe do próprio atleta (Portal): confirmação na própria
  // linha, porque o Portal não tem o diálogo de confirmação do staff.
  const [confirmarApagarId, setConfirmarApagarId] = useState(null);
  const [aApagarClipeId, setAApagarClipeId] = useState(null);
  const confirmarApagarClipeAtleta = (id) => {
    if (!apagarClipeAtleta || aApagarClipeId) return;
    setAApagarClipeId(id);
    Promise.resolve(apagarClipeAtleta(id))
      .catch(() => { /* o Portal mostra o aviso de erro */ })
      .finally(() => { setAApagarClipeId(null); setConfirmarApagarId(null); });
  };
  // EDITAR um clipe do atleta: o mesmo painel, preenchido com o que o
  // clipe já tem, sobre o vídeo completo de onde saiu (para se poder
  // marcar de novo o início e o fim). `edicaoPendenteRef` guarda o
  // pedido enquanto o vídeo de origem ainda não está aberto — trocar de
  // vídeo limpa o modo clipe (ver o efeito de `activeId`).
  const [edicaoClipeId, setEdicaoClipeId] = useState(null);
  const edicaoPendenteRef = React.useRef(null);
  /* Depois de gravar um clipe, fica-se no MESMO vídeo, ainda no modo de
     corte e com as marcas limpas, para continuar a cortar o jogo. */
  const [clipeGuardadoAviso, setClipeGuardadoAviso] = useState('');
  useEffect(() => { if (!clipeGuardadoAviso) return undefined; const t = setTimeout(() => setClipeGuardadoAviso(''), 2600); return () => clearTimeout(t); }, [clipeGuardadoAviso]);
  const continuarACortar = (titulo) => {
    setClipMode(true); setClipMarcas({ inicio: null, fim: null }); setTituloClipe('');
    setNotaClipe(''); setErroClipeAtleta(''); setAGravarClipeAtleta(false); setEdicaoClipeId(null);
    setClipeGuardadoAviso(titulo ? `Clipe guardado: ${titulo}` : 'Clipe guardado');
  };
  const sairDoModoClipe = () => {
    setClipMode(false); setClipMarcas({ inicio: null, fim: null }); setTituloClipe('');
    setNotaClipe(''); setErroClipeAtleta(''); setAGravarClipeAtleta(false); setEdicaoClipeId(null);
  };
  const aplicarEdicao = (e) => {
    setClipMode(true);
    setClipMarcas({ inicio: e.inicio, fim: e.fim });
    setTituloClipe(e.titulo || '');
    setNotaClipe(e.nota || '');
    setErroClipeAtleta('');
    setEdicaoClipeId(e.clipeId);
  };

  // Comandos ao leitor do YouTube por postMessage "cru" (o mesmo
  // protocolo do handshake 'listening', sem carregar o script oficial da
  // API — ver comentário mais abaixo sobre CSP). Usados pela barra do
  // clipe (reproduzir/pausar/procurar dentro do corte) e pelo ciclo que
  // faz o corte voltar ao início.
  //
  // (A antiga função "Adicionar anotação" — círculo/caixa de texto sobre
  // o vídeo — foi retirada a pedido. Anotações já gravadas em itens
  // antigos ficam no registo, mas deixam de ser desenhadas.)
  const enviarComandoYoutube = (func, args) => {
    /* VÍDEO CARREGADO (ficheiro): o MESMO leitor da Biblioteca, com um
       <video> no lugar do iframe do YouTube. Os comandos são os mesmos
       quatro (saltar, tocar, pausar, velocidade), por isso tudo o resto
       — barra do clipe, cortes em seguida, desenhos, ecrã inteiro — é o
       mesmo código para os dois. */
    const vid = inlineVideoRef.current;
    if (vid) {
      try {
        if (func === 'seekTo') vid.currentTime = Math.max(0, Number(args && args[0]) || 0);
        else if (func === 'playVideo') { const pr = vid.play(); if (pr && pr.catch) pr.catch(() => {}); }
        else if (func === 'pauseVideo') vid.pause();
        else if (func === 'setPlaybackRate') vid.playbackRate = Number(args && args[0]) || 1;
      } catch (e) { /* nada */ }
      return;
    }
    const win = inlineIframeRef.current && inlineIframeRef.current.contentWindow;
    if (!win) return;
    win.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*');
  };

  const inlineIframeRef = React.useRef(null);
  const inlineVideoRef = React.useRef(null);
  const activeYoutubeIdRef = React.useRef(null);

  // Ecrã inteiro para vídeos do Instagram/TikTok: aplica-se ao MESMO
  // elemento que já está a tocar (via API nativa de fullscreen do browser),
  // em vez de criar um segundo iframe — assim a reprodução nunca reinicia.
  const socialBoxRef = React.useRef(null);
  const [isSocialFullscreen, setIsSocialFullscreen] = useState(false);
  // Mede a CAIXA real do leitor (não o window): em ecrã inteiro, 100vh e
  // window.innerHeight nem sempre estão já atualizados no momento em que o
  // evento de fullscreen dispara, e era isso que deixava o vídeo mais
  // pequeno do que devia. Com um ResizeObserver o valor é sempre o real.
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });
  const [socialZoom, setSocialZoom] = useState(1);
  // Ajuste fino vertical do recorte (só é preciso no Instagram, onde a
  // altura do cabeçalho é uma estimativa). 0 = valor calculado.
  const [socialOffset, setSocialOffset] = useState(0);
  useEffect(() => {
    const el = socialBoxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0] && entries[0].contentRect;
      if (r) setBoxSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeId, isSocialFullscreen]);
  // Ao sair do ecrã inteiro, o zoom volta ao normal.
  useEffect(() => { if (!isSocialFullscreen) { setSocialZoom(1); setSocialOffset(0); } }, [isSocialFullscreen]);
  useEffect(() => {
    const onFsChange = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      setIsSocialFullscreen(!!fsEl && fsEl === socialBoxRef.current);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);
  const toggleSocialFullscreen = () => {
    const el = socialBoxRef.current;
    if (!el) return;
    if (isSocialFullscreen) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } else {
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }
  };

  // Deteção de erro via postMessage "cru", sem depender de carregar o
  // script externo https://www.youtube.com/iframe_api (esse script fica
  // bloqueado em ambientes com CSP restrita, como a pré-visualização de
  // Artifacts, deixando o vídeo permanentemente preto). Com enablejsapi=1
  // no src e um "handshake" inicial (evento 'listening'), o próprio player
  // do YouTube passa a enviar-nos eventos — incluindo onError — por
  // postMessage, sem precisar de nenhum script adicional.
  //
  // O mesmo handshake também faz o player começar a mandar 'infoDelivery'
  // sozinho, com o tempo de reprodução atual lá dentro (info.currentTime) —
  // é esse tempo que os botões "Marcar início"/"Marcar fim" do Criar
  // clipe usam. Guarda-se em ref, não em state: chegam vários por segundo
  // enquanto o vídeo toca, e não há razão para voltar a desenhar o ecrã
  // a cada um — só interessa o valor no instante em que se clica.
  const currentTimeRef = React.useRef(0);
  // Só liga os re-renders de tempo ao vivo quando há mesmo alguma coisa a
  // animar (a marcar uma anotação nova, ou o vídeo ativo já tem
  // anotações a desenhar) — nos restantes vídeos, `currentTimeRef` continua
  // a atualizar-se sozinho (para o Criar clipe), sem pedir novo desenho do
  // ecrã a cada mensagem. O efeito que mantém isto atualizado vive mais
  // abaixo, depois de `active` estar definido — precisa de o ler.
  const precisaTempoAoVivoRef = React.useRef(false);
  const precisaTempoJogoRef = React.useRef(false);
  const [tempoJogo, setTempoJogo] = useState(0);
  const [duracaoJogo, setDuracaoJogo] = useState(0);
  const [liveTime, setLiveTime] = useState(0);
  // Estado do leitor (1 = a tocar, 3 = a carregar) — só para o botão
  // reproduzir/pausar da barra do clipe mostrar o ícone certo.
  const [ytATocar, setYtATocar] = useState(false);
  // Versão em ref do mesmo valor — para o código dentro de setTimeout
  // conseguir ler o estado REAL no momento em que corre, não o valor
  // "congelado" de quando a função foi criada.
  const ytATocarRef = useRef(false);
  useEffect(() => { ytATocarRef.current = ytATocar; }, [ytATocar]);
  // Pausa / play durante uma paragem com desenhos: o tempo dos itens
  // acompanha o vídeo.
  useEffect(() => {
    const c = pausaControloRef.current;
    if (!c || !c.relogio || c.cancelado || c.pausaPropria) return;
    if (ytATocar) c.relogio.retomar(); else c.relogio.pausar();
  }, [ytATocar]);
  // Existe agora um único iframe do YouTube (o ecrã inteiro usa o MESMO
  // leitor, ver "ECRÃ INTEIRO" abaixo) — as mensagens de outros iframes
  // do YouTube na página (ex.: vista em coluna) são ignoradas.
  useEffect(() => {
    const onMessage = (event) => {
      if (!event.origin || !event.origin.includes('youtube.com')) return;
      const janelaRelevante = inlineIframeRef.current && inlineIframeRef.current.contentWindow;
      if (janelaRelevante && event.source !== janelaRelevante) return;
      let data = event.data;
      try { data = typeof data === 'string' ? JSON.parse(data) : data; } catch { return; }
      if (data && data.event === 'onError' && activeYoutubeIdRef.current) {
        const code = data.info;
        const reason = (code === 101 || code === 150) ? 'embed_disabled' : 'unavailable';
        setBlockedIds(prev => ({ ...prev, [activeYoutubeIdRef.current]: reason }));
      }
      if (data && data.event === 'onStateChange' && typeof data.info === 'number') {
        setYtATocar(data.info === 1 || data.info === 3);
      }
      if (data && data.event === 'infoDelivery' && data.info) {
        if (typeof data.info.playerState === 'number') {
          setYtATocar(data.info.playerState === 1 || data.info.playerState === 3);
        }
        if (typeof data.info.currentTime === 'number') {
          currentTimeRef.current = data.info.currentTime;
          if (precisaTempoAoVivoRef.current) setLiveTime(data.info.currentTime);
          // Jogo completo: tempo para a barra própria (a mesma dos clipes).
          if (precisaTempoJogoRef.current) setTempoJogo(data.info.currentTime);
        }
        if (typeof data.info.duration === 'number' && data.info.duration > 0) setDuracaoJogo(data.info.duration);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // VÍDEO CARREGADO: o equivalente ao 'infoDelivery' do YouTube.
  const infoDoVideoBib = (vid) => {
    if (!vid) return;
    const t = vid.currentTime;
    currentTimeRef.current = t;
    if (precisaTempoAoVivoRef.current) setLiveTime(t);
    if (precisaTempoJogoRef.current) setTempoJogo(t);
    if (vid.duration > 0) setDuracaoJogo(vid.duration);
  };
  // O 'timeupdate' do browser vem de ~¼ em ¼ de segundo (como o YouTube);
  // a tocar, lê-se também a cada 100 ms, para a barra andar suave.
  useEffect(() => {
    if (!ytATocar) return undefined;
    const h = setInterval(() => { if (inlineVideoRef.current) infoDoVideoBib(inlineVideoRef.current); }, 100);
    return () => clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytATocar]);

  /* ECRÃ INTEIRO DO YOUTUBE — sobre o MESMO leitor que já está a tocar.

     Antes abria-se uma janela ampliada com um SEGUNDO iframe (o vídeo
     recomeçava) e o botão de ecrã inteiro nativo do YouTube ficava
     disponível — mas nesse ecrã inteiro não há como pôr botões nossos,
     por isso não se podia criar clipes a ver em grande. Agora:
     - o botão nativo do YouTube está desligado (fs=0 no embed);
     - o nosso "Ecrã inteiro" põe em ecrã inteiro a CAIXA toda (vídeo +
       barra do clipe + Criar clipe), via API nativa do browser — o
       vídeo não recomeça;
     - onde essa API não existe para elementos (iPhone), a caixa passa a
       cobrir o ecrã por CSS (position: fixed) — mesmo resultado prático. */
  const ytBoxRef = React.useRef(null);
  const [ytFull, setYtFull] = useState(false); // false | 'nativo' | 'css'
  // LUPA em ecrã inteiro (ver useLupa). Desliga-se a desenhar — aí manda o
  // zoom dos círculos — e volta a 100% ao trocar de vídeo ou sair.
  const lupaBib = useLupa(areaVideoBibRef, !!ytFull && !modoDesenhoBib);
  const lupaBibRepor = lupaBib.repor;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { lupaBibRepor(); }, [activeId]);
  const alternarLupaBib = (e) => {
    /* Em ecrã inteiro esta camada fica por cima do vídeo todo: as
       laterais fazem o toque duplo (±10 s), como fora do ecrã inteiro. */
    if (e && e.currentTarget && typeof e.clientX === 'number') {
      const r = e.currentTarget.getBoundingClientRect();
      const fx = r.width ? (e.clientX - r.left) / r.width : 0.5;
      if (fx < 0.3) { tocarLadoBib(-1); return; }
      if (fx > 0.7) { tocarLadoBib(1); return; }
    }
    if (ativoEClipe) alternarReproducaoBib();
    else enviarComandoYoutube(ytATocarRef.current ? 'pauseVideo' : 'playVideo');
  };
  useEffect(() => {
    const onFsChange = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      setYtFull(prev => (fsEl && fsEl === ytBoxRef.current ? 'nativo' : (prev === 'nativo' ? false : prev)));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);
  // Esc também fecha o modo CSS (o nativo já o faz sozinho).
  useEffect(() => {
    if (ytFull !== 'css') return;
    const onKey = (e) => { if (e.key === 'Escape') setYtFull(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ytFull]);
  const toggleYtFull = () => {
    const el = ytBoxRef.current;
    if (ytFull) {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (fsEl) {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
      try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch { /* sem suporte */ }
      setYtFull(false);
      return;
    }
    if (!el) return;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) { setYtFull('css'); return; }
    try {
      const p = req.call(el);
      const rodar = () => {
        // No telemóvel, tenta rodar para horizontal — se o sistema não
        // deixar, fica como está, sem erro.
        try {
          if (isNarrow && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
        } catch { /* sem suporte */ }
      };
      if (p && typeof p.then === 'function') p.then(rodar).catch(() => setYtFull('css'));
      else rodar();
    } catch {
      setYtFull('css');
    }
  };

  // Sair do ecrã inteiro (Esc, gesto do telemóvel, etc.) enquanto se
  // desenha cancela o desenho — como o desenho só faz sentido em ecrã
  // inteiro, não faria sentido continuar "a meio" fora dele. E ao
  // contrário: se foi "Desenhar" que pediu o ecrã inteiro, as
  // ferramentas só abrem quando ele ficar mesmo ativo (nunca antes).
  const ytFullAntesRef = useRef(ytFull);
  useEffect(() => {
    const anterior = ytFullAntesRef.current;
    ytFullAntesRef.current = ytFull;
    if (modoDesenhoBib && anterior && !ytFull) cancelarDesenhoBib();
    if (ytFull && aAbrirDesenhoAposFullscreenRef.current) {
      aAbrirDesenhoAposFullscreenRef.current = false;
      setModoDesenhoBib(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytFull]);

  // Envia o "handshake" ao iframe assim que carrega, para o player começar
  // a reportar-nos eventos (incluindo onError) por postMessage. Fábrica em
  // vez de função fixa porque agora há dois iframes possíveis (o da caixa
  // inline e o da janela ampliada) e cada um precisa do seu próprio ref.
  const tocarAoCarregarRef = useRef(null);
  const handleIframeLoad = (ref) => () => {
    const win = ref.current && ref.current.contentWindow;
    if (!win) return;
    win.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
    // Chegou pelo ⏮ ⏭ / "Clipe seguinte": começa a tocar quando o leitor
    // estiver pronto (umas tentativas, até o YouTube responder).
    const alvo = tocarAoCarregarRef.current;
    if (alvo) {
      tocarAoCarregarRef.current = null;
      [400, 1000, 1800].forEach(ms => setTimeout(() => {
        if (activeIdRefSala.current !== alvo || ytATocarRef.current) return;
        try { win.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*'); } catch (e) { /* nada */ }
      }, ms));
    }
  };

  const save = (data) => {
    if (modoCanal && data.id && data.adversarioId && !items.some(v => v.id === data.id) && setTodosVideos) {
      // Corte da ficha editado a partir do cartão da equipa.
      setTodosVideos(prev => prev.map(v => (v.id === data.id ? data : v)));
      setModal(null);
      return;
    }
    // Depois de guardar, o filtro passa SEMPRE a mostrar o sítio onde o
    // item ficou: a pasta escolhida, ou "Tudo" se não tiver pasta. Assim
    // nunca se guarda alguma coisa e se fica a olhar para uma vista onde
    // ela não aparece.
    const destino = cleanFolder(data.pasta);
    let guardado = data;
    let novaLista;
    if (data.id) {
      novaLista = items.map(v => v.id === data.id ? data : v);
      setItems(prev => prev.map(v => v.id === data.id ? data : v));
    } else {
      guardado = { ...data, id: uid() };
      novaLista = [guardado, ...items];
      setItems(prev => [guardado, ...prev]);
    }
    setActiveId(guardado.id);
    if (modoCanal) irPara(guardado, novaLista);
    else setFolderFilter(destino || null);
    setModal(null);
  };
  const remove = (id) => {
    // Corte que vive na ficha de um adversário (mostrado no cartão da
    // equipa): apaga-se da coleção completa, não da lista do Canal.
    if (!items.some(v => v.id === id) && setTodosVideos) {
      const lista = todosVideos || [];
      removeWithUndo(lista, setTodosVideos, id, itemLabel(lista.find(v => v.id === id), 'Corte'),
        () => { if (activeId === id) setActiveId(null); });
      return;
    }
    removeWithUndo(
      items, setItems, id, itemLabel(items.find(v => v.id === id), 'Ficheiro'),
      () => { if (activeId === id) setActiveId(null); },
    );
  };
  const selectItem = (id) => {
    if (sequencia && !sequencia.includes(id)) setSequencia(null);
    if (modoCanal && termo) { irPara(items.find(v => v.id === id)); return; }
    setActiveId(id);
  };

  // As pastas não são registos próprios: são deduzidas do campo "pasta" dos
  // itens. Consequência a ter em conta — uma pasta existe enquanto tiver
  // conteúdo; se o último item sair dela, a pasta desaparece da lista.
  // Pesquisa por título, subtítulo, nome do ficheiro ou pasta. É o que
  // torna a lista longa navegável sem a esconder atrás de acordeões.
  const [busca, setBusca] = useState('');
  const termo = busca.trim().toLowerCase();

  /* CATÁLOGO (Canal) — ver o comentário de `categoriaDoItem`. Tudo é
     derivado a cada desenho, a partir dos próprios itens: não há
     registos de "jogo" ou "grupo" guardados à parte. */
  const byIdItens = {};
  items.forEach(v => { byIdItens[v.id] = v; });
  const matchesById = {};
  (matches || []).forEach(m => { matchesById[m.id] = m; });
  const fichasById = {};
  (adversarios || []).forEach(f => { fichasById[f.id] = f; });
  const catDe = (v) => categoriaDoItem(v, byIdItens);
  const equipasDe = (v) => equipasDoItem(v, byIdItens, fichasById);
  const itensTema = modoCanal ? items.filter(v => catDe(v) === 'tema') : items;
  // Portal: os clipes do próprio jogador vivem só na secção "Os meus
  // clipes" (não se repetem dentro do cartão do jogo).
  const itensMeus = modoCanal ? items.filter(v => v.deAtleta) : [];
  /* "Os meus clipes" deixou de ser um separador: os clipes do jogador
     cortam-se dos vídeos dos jogos, por isso ficam DENTRO de Jogos, como o
     primeiro cartão. Assim o separador não aparece vazio a quem ainda não
     criou nenhum, e quem cria encontra-os onde os fez. */
  const secoesCanal = SECOES_CANAL;
  const ordemCriacao = {};
  items.forEach((v, i) => { ordemCriacao[v.id] = i + 1; });
  // Rótulo de um jogo dentro de um cartão com vários (Amigáveis/adversário).
  const rotuloSubJogo = (k, ord) => {
    const m = k[0] === 'm' ? matchesById[k.slice(1)] : null;
    if (m) return [`vs ${m.opponent || 'Adversário'}`, m.date && fmtDate(m.date), m.result].filter(Boolean).join(' · ');
    const v = ord.find(x => !ehClipe(x)) || ord[0];
    return tituloSemParte(v ? (ehClipe(v) ? (v.clipOrigemTitulo || v.title) : v.title) : '') || 'Jogo';
  };
  const gruposJogo = [];
  const gruposAdv = [];
  if (modoCanal) {
    const porJogo = {};
    const porAdv = {};
    const nomeEquipa = {};
    items.forEach(v => {
      if (v.deAtleta) return;
      const c = catDe(v);
      if (c === 'jogo') { const k = chaveJogoDoItem(v, byIdItens, matchesById); (porJogo[k] = porJogo[k] || []).push(v); }
      else if (c === 'adversario') {
        // Um jogo tem DUAS equipas: o mesmo vídeo aparece no cartão de
        // cada uma — sem duplicar o registo, só aparece nos dois sítios.
        const eqs = equipasDe(v);
        if (!eqs.length) (porAdv.sem = porAdv.sem || []).push(v);
        const vistos = new Set();
        eqs.forEach(nome => {
          const k = `e:${semAcentos(nome)}`;
          if (vistos.has(k)) return;
          vistos.add(k);
          nomeEquipa[k] = nomeEquipa[k] || nome;
          (porAdv[k] = porAdv[k] || []).push(v);
        });
      }
    });
    // Clipes enviados da Análise de Vídeo para a ficha de um adversário:
    // a equipa ganha cartão no Canal › Adversários mesmo sem outros vídeos
    // (os clipes entram pelos "cortes da ficha", mais abaixo).
    (todosVideos || []).forEach(v => {
      if (!v || !v.adversarioId || !v.origemAnalise) return;
      const f = fichasById[v.adversarioId];
      const nome = f && (f.equipaCompeticao || f.nome);
      if (!nome) return;
      const k = `e:${semAcentos(nome)}`;
      nomeEquipa[k] = nomeEquipa[k] || nome;
      porAdv[k] = porAdv[k] || [];
    });
    Object.entries(porJogo).forEach(([key, lista]) => {
      if (key === 'amigaveis') {
        const secoes = seccionarPorJogo(lista, byIdItens, ordemCriacao, rotuloSubJogo);
        const itens = secoes.flatMap(s => s.itens);
        const completos = itens.filter(v => !ehClipe(v)).length;
        gruposJogo.push({
          key, n: null, match: null, itens, secoes, amigaveis: true,
          completos, cortes: itens.length - completos,
          titulo: 'Amigáveis',
          adversario: `${secoes.length} ${secoes.length === 1 ? 'jogo' : 'jogos'}`,
          resultado: '',
        });
        return;
      }
      const n = key[0] === 'j' ? Number(key.slice(1)) : null;
      const comJogo = lista.find(v => v.jogoId && matchesById[v.jogoId]);
      let match = comJogo ? matchesById[comJogo.jogoId] : null;
      if (!match && n != null) {
        const cands = (matches || []).filter(m => numDoJogo(m) === n && !isFriendlyMatch(m));
        if (cands.length === 1) match = cands[0];
      }
      const itens = ordenarDoJogo(lista);
      const completos = itens.filter(v => !ehClipe(v));
      const cortes = itens.filter(ehClipe);
      gruposJogo.push({
        key, n, match, itens,
        secoes: [
          { key: 'c', titulo: 'Jogo completo', itens: completos },
          { key: 'k', titulo: `Cortes (${cortes.length})`, itens: cortes },
        ].filter(s => s.itens.length),
        completos: completos.length, cortes: cortes.length,
        titulo: n != null ? `${n}ª Jornada` : (match ? fmtDate(match.date) : 'Sem jornada'),
        adversario: match
          ? `${match.opponent || 'Adversário'}${match.atHome === undefined ? '' : (match.atHome ? ' (C)' : ' (F)')}`
          : tituloSemParte((completos[0] && completos[0].title) || (itens[0] && (itens[0].clipOrigemTitulo || itens[0].title)) || ''),
        resultado: match && match.result ? match.result : '',
      });
    });
    // Amigáveis sempre em primeiro (lugar fixo, fácil de encontrar), depois
    // as jornadas da mais recente para a mais antiga; "sem jornada" no fim.
    const pesoJogo = (g) => (g.key === 'amigaveis' ? 0 : g.key === 'sem' ? 3 : g.n != null ? 1 : 2);
    gruposJogo.sort((x, y) => {
      if (pesoJogo(x) !== pesoJogo(y)) return pesoJogo(x) - pesoJogo(y);
      if (x.n != null && y.n != null) return y.n - x.n;
      return String((y.match && y.match.date) || '').localeCompare(String((x.match && x.match.date) || ''));
    });
    Object.entries(porAdv).forEach(([key, lista]) => {
      const nome = key === 'sem' ? '' : nomeEquipa[key];
      const ficha = key === 'sem' ? null : fichaDaEquipa(nome, adversarios);
      // Os cortes gravados na ficha desta equipa também aparecem aqui,
      // junto do jogo de onde saíram — vivem na ficha (Scouting), mas
      // vêem-se a partir da Biblioteca sem ter de lá ir.
      const cortesFicha = ficha ? (todosVideos || []).filter(v => v.adversarioId === ficha.id && ehClipe(v)) : [];
      const secoes = seccionarPorJogo([...lista, ...cortesFicha], byIdItens, ordemCriacao, rotuloSubJogo);
      const itens = secoes.flatMap(s => s.itens);
      const completos = itens.filter(v => !ehClipe(v)).length;
      gruposAdv.push({
        key, nome, ficha, itens, secoes,
        jogos: secoes.length, completos, cortesCanal: itens.filter(v => ehClipe(v) && !v.adversarioId).length,
        cortesNaFicha: ficha ? (todosVideos || []).filter(v => v.adversarioId === ficha.id).length : 0,
        titulo: key === 'sem' ? 'Por associar' : nome,
      });
    });
    gruposAdv.sort((x, y) => (x.key === 'sem' ? -1 : y.key === 'sem' ? 1 : x.titulo.localeCompare(y.titulo, 'pt')));
  }
  const gruposDaSecao = secao === 'jogos' ? gruposJogo : gruposAdv;
  const grupoAtual = modoCanal && secao !== 'temas' && secao !== 'meus' ? (gruposDaSecao.find(g => g.key === grupo) || null) : null;

  const folders = Array.from(new Set(itensTema.map(v => cleanFolder(v.pasta)).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'pt'));
  const countIn = (name) => (name === NO_FOLDER
    ? itensTema.filter(v => !cleanFolder(v.pasta)).length
    : itensTema.filter(v => cleanFolder(v.pasta) === name).length);
  // No Canal não há "Tudo": nos Temas há sempre uma pasta aberta — a
  // escolhida, ou a primeira.
  const pastaTema = !modoCanal ? folderFilter
    : ((folderFilter && (folderFilter === NO_FOLDER ? countIn(NO_FOLDER) > 0 : folders.includes(folderFilter)))
      ? folderFilter
      : (folders[0] || (countIn(NO_FOLDER) > 0 ? NO_FOLDER : null)));
  const filtroPasta = (lista, pasta) => (pasta === null
    ? lista
    : (pasta === NO_FOLDER
      ? lista.filter(v => !cleanFolder(v.pasta))
      : lista.filter(v => cleanFolder(v.pasta) === pasta)));
  let naPastaBase;
  if (!modoCanal) naPastaBase = filtroPasta(items, folderFilter);
  else if (termo) naPastaBase = items; // a pesquisa procura no Canal todo
  else if (secao === 'temas') naPastaBase = filtroPasta(itensTema, pastaTema);
  else if (secao === 'meus') naPastaBase = itensMeus;
  else naPastaBase = grupoAtual ? grupoAtual.itens : [];
  // `items` chega sempre por ordem de criação (mais antigo primeiro —
  // é como a leitura vem da base de dados). No Canal geral faz mais
  // sentido ver o mais recente primeiro; inverte-se só aqui, na leitura
  // — a escrita (criar, mover, apagar) continua a usar `items` tal
  // como veio, por isso não há risco de baralhar a ordem gravada.
  // Dentro de um jogo mantém-se a ordem do jogo (completos, depois cortes).
  const naPasta = recentesPrimeiro && !grupoAtual ? [...naPastaBase].reverse() : naPastaBase;
  /* Duas formas de percorrer a mesma pasta: o visualizador (um ficheiro
     de cada vez, com controlos) ou a coluna contínua, com tudo aberto,
     para rever material a rolar. */
  const [modoFeed, setModoFeed] = useState(false);
  const visibleItems = termo
    ? naPasta.filter(v => [v.title, v.jornada, v.fileName, cleanFolder(v.pasta), v.clipOrigemTitulo]
        .some(campo => String(campo || '').toLowerCase().includes(termo)))
    : naPasta;

  // Onde um item vive, em palavras — para os resultados da pesquisa.
  const lugarDoItem = (v) => {
    if (v.deAtleta) return 'Os meus clipes';
    const c = catDe(v);
    if (c === 'jogo') {
      const g = gruposJogo.find(x => x.itens.includes(v));
      return g ? `Jogos · ${g.titulo}${g.adversario ? ` · ${g.adversario}` : ''}` : 'Jogos';
    }
    if (c === 'adversario') {
      const g = gruposAdv.find(x => x.itens.includes(v));
      return g ? `Adversários · ${g.titulo}` : 'Adversários';
    }
    return `Temas · ${cleanFolder(v.pasta) || 'Sem pasta'}`;
  };

  // Abre o sítio onde o item vive (secção + jogo/adversário/pasta) e
  // seleciona-o. `lista` permite usar a lista acabada de gravar, antes de
  // o estado chegar atualizado.
  const irPara = (v, lista) => {
    if (!v) return;
    if (!modoCanal) { setFolderFilter(cleanFolder(v.pasta) || null); setActiveId(v.id); return; }
    const b = {};
    (lista || items).forEach(x => { b[x.id] = x; });
    const c = categoriaDoItem(v, b);
    setBusca('');
    setModoFeed(false);
    if (v.deAtleta) { setSecao('meus'); setGrupo(null); }
    else if (c === 'jogo') { setSecao('jogos'); setGrupo(chaveJogoDoItem(v, b, matchesById)); }
    else if (c === 'adversario') {
      const eqs = equipasDoItem(v, b, fichasById);
      setSecao('adversarios'); setGrupo(eqs.length ? `e:${semAcentos(eqs[0])}` : 'sem');
    } else { setSecao('temas'); setFolderFilter(cleanFolder(v.pasta) || NO_FOLDER); }
    setActiveId(v.id);
  };
  irParaRef.current = (id) => irPara(items.find(x => x.id === id));

  // Mudar o nome de uma pasta = reescrever o campo em todos os seus itens.
  const applyRename = () => {
    const novo = cleanFolder(renameValue);
    if (!novo || novo === renaming) { setRenaming(null); return; }
    setItems(items.map(v => (cleanFolder(v.pasta) === renaming ? { ...v, pasta: novo } : v)));
    if (folderFilter === renaming) setFolderFilter(novo);
    setRenaming(null);
  };
  // Desfazer a pasta: os itens ficam sem pasta, nada é apagado.
  /* Desfazer uma pasta não apaga ficheiros — tira-lhes o campo `pasta` e a
     pasta deixa de existir por ficar vazia. Mesmo assim leva confirmação:
     o X fica encostado ao lápis e ao próprio nome da pasta, e um toque a
     mais no telemóvel desarrumava a organização toda de uma vez. */
  const dissolveFolder = (name) => {
    const dentro = items.filter(v => cleanFolder(v.pasta) === name).map(v => v.id);
    if (!dentro.length) return;
    askConfirm({
      title: 'Desfazer a pasta?',
      label: `Pasta "${name}" · ${dentro.length} ${dentro.length === 1 ? 'ficheiro' : 'ficheiros'}`,
      note: 'Os ficheiros não são apagados — só deixam de estar nesta pasta. Podes anular a seguir.',
      confirmLabel: 'Desfazer pasta',
      destructive: false,
      onConfirm: () => {
        setItems(prev => prev.map(v => (cleanFolder(v.pasta) === name ? { ...v, pasta: '' } : v)));
        if (folderFilter === name) setFolderFilter(null);
        offerUndo(`Pasta "${name}" desfeita.`, () => {
          setItems(prev => prev.map(v => (dentro.includes(v.id) ? { ...v, pasta: name } : v)));
          setFolderFilter(name);
        });
      },
    });
  };
  // Mover um item para outra pasta a partir da própria lista.
  const moveItem = (id, pasta) => setItems(items.map(v => (v.id === id ? { ...v, pasta: cleanFolder(pasta) } : v)));

  // Rede de segurança: se a pasta aberta deixar de existir (o último item
  // saiu dela, foi renomeada noutro dispositivo, etc.), voltamos a "Tudo"
  // em vez de deixar o ecrã preso numa pasta vazia que já não está na barra.
  useEffect(() => {
    if (folderFilter === null || folderFilter === NO_FOLDER) return;
    if (!items.some(v => cleanFolder(v.pasta) === folderFilter)) setFolderFilter(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, folderFilter]);

  const active = visibleItems.find(v => v.id === activeId) || visibleItems[0];
  /* Os desenhos (pausas) gravam-se no item onde ele vive de facto. Os
     clipes enviados da Análise de Vídeo para a ficha de um adversário
     aparecem aqui, mas vivem na lista geral dos vídeos (têm adversarioId),
     não em `items`: gravar só em `items` não fazia nada e cada pausa nova
     parecia substituir a anterior (nenhuma ficava gravada). */
  const setItensDoAtivo = (fn) => {
    if (modoCanal && active && setTodosVideos && !items.some(v => v.id === active.id)) setTodosVideos(fn);
    else setItems(fn);
  };

  const ativoEClipe = !!(temLeitorBib(active) && typeof active.clipInicio === 'number');
  // Partilhar um corte que não estava aberto: quando o leitor já o tem, arranca.
  useEffect(() => {
    const g = gravacaoBibRef.current;
    if (!g || !g.pendenteId || !active || active.id !== g.pendenteId || !ativoEClipe) return undefined;
    const h = setTimeout(() => {
      if (gravacaoBibRef.current === g && g.pendenteId) arrancarGravacaoBib(g.ctl, g);
    }, 1500);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active && active.id]);
  // A gravar: o início do corte marca o início da gravação (ao instante).
  useEffect(() => {
    const g = gravacaoBibRef.current;
    if (!g || !g.preRoll || g.pendenteId || !ativoEClipe || clipIni - g.arranque < 1) return undefined;
    const falta = clipIni - liveTime;
    if (falta > 1.2) return undefined;
    const h = setTimeout(() => {
      if (gravacaoBibRef.current !== g || !g.preRoll) return;
      g.preRoll = false;
      g.comecouEm = Date.now();
      g.ctl.comecar();
    }, Math.max(0, falta * 1000));
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTime]);
  // A gravar: chegado o fim do corte (sem paragem a decorrer), acaba e entrega.
  useEffect(() => {
    const g = gravacaoBibRef.current;
    if (!g || !g.comecouEm || Date.now() - g.comecouEm < 1500 || !ativoEClipe) return;
    if (pausaEmCursoRef.current) return;
    if (liveTime >= clipFimEf - 0.2) {
      // A gravar UMA LISTA de clipes ("Os meus vídeos"): pausa a gravação,
      // passa ao clipe seguinte e retoma quando ele começar (o mesmo
      // arranque de 4s antes, para não gravar a informação do YouTube).
      const i = g.seq ? g.seq.indexOf(active.id) : -1;
      if (i >= 0 && i < g.seq.length - 1) {
        if (g.ctl.pausar) g.ctl.pausar();
        enviarComandoYoutube('pauseVideo');
        g.comecouEm = 0;
        g.preRoll = true;
        g.pendenteId = g.seq[i + 1];
        setActiveId(g.seq[i + 1]);
        return;
      }
      acabarGravacaoBib();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTime]);
  /* (Fica DEPOIS de `active`/`ativoEClipe`: as dependências do efeito
     leem-se ao desenhar — antes deles dava "Cannot access … before
     initialization".)
     PRECISÃO. O YouTube só diz o tempo de ~¼ em ¼ de segundo; a paragem
     disparava na leitura SEGUINTE ao minuto dela — já passado — e o vídeo
     tinha de voltar atrás (salto visível, zoom a falhar o momento). Agora,
     quando falta menos de 1s para uma paragem, marca-se um relógio para
     o instante exato e a paragem começa a tempo, sem voltar atrás. */
  useEffect(() => {
    if (modoDesenhoBib || !ativoEClipe || !ytATocar || pausaEmCursoRef.current || !active) return undefined;
    const proxima = (active.anotacoesPausa || [])
      .filter(x => !pausasJaMostradasRef.current.has(x.id))
      .map(x => tempoPausaNoCorte(x))
      .filter(t => t > liveTime + 0.02 && t - liveTime < 1)
      .sort((x, y) => x - y)[0];
    if (proxima == null) return undefined;
    const h = setTimeout(() => {
      if (!ytATocarRef.current || pausaEmCursoRef.current) return;
      currentTimeRef.current = proxima;
      setLiveTime(proxima);
    }, (proxima - liveTime) * 1000);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTime, ytATocar, modoDesenhoBib, active && active.id]);
  const clipIni = ativoEClipe ? active.clipInicio : 0;
  const clipFimEf = ativoEClipe
    ? (typeof active.clipFim === 'number' ? active.clipFim : active.clipInicio + 30)
    : 0;
  // Instante EFETIVO de uma pausa, sempre dentro do corte. Pausas
  // gravadas antes da correção podem ter ficado com o tempo errado
  // (segundo 0 do jogo, ou o tempo de outro vídeo) — essas contam como
  // estando no início do corte, em vez de nunca dispararem. E o leitor
  // começa no segundo inteiro antes do corte (start= só aceita inteiros),
  // por isso uma pausa gravada aí também é puxada para o início real.
  const tempoPausaNoCorte = (a) => {
    const t = Number(a && a.tempoVideo);
    if (!Number.isFinite(t) || t < clipIni - 1.25 || t > clipFimEf + 0.75) return clipIni;
    return Math.min(Math.max(t, clipIni), clipFimEf);
  };

  // Só liga os re-renders de tempo ao vivo (ver `precisaTempoAoVivoRef`
  // mais acima) quando há mesmo alguma coisa a vigiar: um clipe a
  // reproduzir (barra própria + limites do corte).
  useEffect(() => {
    precisaTempoAoVivoRef.current = ativoEClipe;
    precisaTempoJogoRef.current = !!(temLeitorBib(active) && !ativoEClipe);
    setTempoJogo(0); setDuracaoJogo(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativoEClipe, active && active.id]);

  // PAUSAS DE DESENHO, durante a reprodução normal (fora do modo de
  // desenho): ao passar pelo instante de uma pausa já guardada, o
  // vídeo pára sozinho, mostra os desenhos dela durante os segundos
  // definidos, e depois retoma sozinho.
  //
  // Em vez de mandar "pausa"/"continua" ao YouTube e confiar às cegas
  // que resultou (foi isso que deixava o vídeo preso, com o símbolo de
  // "a carregar" às vezes visível), confirma-se a sério junto do
  // próprio leitor (`ytATocarRef`, atualizado pelos eventos que ele
  // nos manda) antes de avançar — e só volta a tentar o comando se de
  // facto ainda não tiver resultado.
  //
  // Pausas muito próximas no tempo (menos de 2s de diferença) juntam-se
  // numa só, com a MAIOR duração entre elas para todas.
  //
  // CORREÇÃO (desenhos presos / invisíveis): antes, a sequência
  // pausar → mostrar → retomar vivia dentro deste efeito, que corre
  // outra vez a CADA atualização do tempo — e o "cleanup" cancelava a
  // sequência a meio. Resultado: ou nunca chegava a mostrar os desenhos
  // (e a trava `pausaEmCursoRef` ficava presa, sem mais pausas), ou
  // mostrava-os e nunca os tirava — ficavam no ecrã em todos os cortes.
  // Agora a sequência só é cancelada ao trocar de corte, ao entrar no
  // modo de desenho, ou ao sair da página (efeito logo a seguir).
  //
  // Deteção por PASSAGEM: dispara quando o tempo passa pelo instante da
  // pausa a tocar normalmente (avanço pequeno), em vez de exigir uma
  // leitura dentro de uma janela de 0,25s, que o leitor podia saltar.
  useEffect(() => {
    const anterior = tempoAnteriorPausaRef.current;
    tempoAnteriorPausaRef.current = liveTime;
    // MODO DE DESENHO com o vídeo a andar e nada alterado: comporta-se
    // como a reprodução normal — ao passar por uma pausa gravada, congela
    // o tempo dela com os desenhos à vista (já carregados, com "Limpar"
    // disponível) e depois RETOMA sozinho. Se durante o congelamento se
    // mexer em alguma coisa (ferramenta, forma, Limpar, tocar no vídeo),
    // a retoma é cancelada e o vídeo fica parado para editar.
    if (ativoEClipe && modoDesenhoBib) {
      // Recuou (barra para trás, -2s, volta do corte), mesmo com o vídeo
      // parado: as pausas outra vez à frente voltam TODAS a congelar. Antes
      // só se via isto com o vídeo a tocar, e ao puxar a barra com ele
      // parado as pausas já vistas ficavam de fora até à volta seguinte.
      // (Não durante uma paragem: o pequeno recuo dela própria não conta.)
      if (anterior != null && liveTime < anterior - 0.3 && !retomaDesenhoRef.current) {
        (active.anotacoesPausa || []).forEach(a => { if (tempoPausaNoCorte(a) >= liveTime - 0.5) { congeladasDesenhoRef.current.delete(a.id); pausasJaMostradasRef.current.delete(a.id); } });
        return;
      }
      if (anterior == null || !ytATocarRef.current || historicoBib.length > 0 || formaEmCursoBib || retomaDesenhoRef.current || apagarTodasBib) return;
      const avancoDesenho = liveTime - anterior;
      if (avancoDesenho <= 0 || avancoDesenho >= 2) return;
      // Já saiu do instante da pausa que estava aberta (sem alterações):
      // tira-lhe os desenhos do ecrã enquanto o vídeo anda.
      if (anotacaoIdEmEdicaoBib && Math.abs(liveTime - tempoAnotacaoBib) > 0.6) {
        abrirPausaBib(null, liveTime);
      }
      const alvo = (active.anotacoesPausa || []).find(a => {
        if (congeladasDesenhoRef.current.has(a.id)) return false;
        const t = tempoPausaNoCorte(a);
        return t >= anterior - 0.3 && t <= liveTime + 0.05;
      });
      if (!alvo) return;
      const tAlvo = tempoPausaNoCorte(alvo);
      const grupo = (active.anotacoesPausa || []).filter(a => Math.abs(tempoPausaNoCorte(a) - tAlvo) < JANELA_MESMA_PAUSA_BIB);
      grupo.forEach(a => congeladasDesenhoRef.current.add(a.id));
      const duracao = Math.max(1, ...grupo.flatMap(a => (a.shapes || []).map(f => segDaForma(f, a))), ...grupo.map(a => ((a.shapes || []).length ? 1 : segDaForma(null, a))));
      const lento = MODO_SEGURAR_BIB === 'lento';
      if (liveTime - tAlvo > 0.3) enviarComandoYoutube('seekTo', [tAlvo, true]);
      if (lento) enviarComandoYoutube('setPlaybackRate', [VELOCIDADE_LENTA_BIB]);
      else { enviarComandoYoutube('pauseVideo'); enviarComandoYoutube('seekTo', [tAlvo, true]); }
      abrirPausaBib(alvo);
      setCongeladoDesenhoBib(true);
      setDecorridoCongelBib(0);
      setZoomSaidaBib(null);
      const retoma = { cancelado: false, lento, t: tAlvo };
      retomaDesenhoRef.current = retoma;
      // Cada item sai no tempo dele; o zoom sai ~0,9s antes do círculo.
      const formasGrupo = grupo.flatMap(a => (a.shapes || []).map(f => ({ ...f, seg: segDaForma(f, a) })));
      [...new Set(formasGrupo.map(f => f.seg))].filter(s => s < duracao).forEach(s => {
        setTimeout(() => { if (!retoma.cancelado) setDecorridoCongelBib(d => Math.max(d, s)); }, s * 1000);
      });
      const circZ = formasGrupo.find(f => f.tool === 'circulo' && Number(f.zoom) > 1);
      if (circZ) {
        setTimeout(() => { if (!retoma.cancelado) setZoomSaidaBib('congelado'); }, Math.max(0.4, circZ.seg - 0.9) * 1000);
      }
      setTimeout(() => {
        if (retoma.cancelado) return;
        retomaDesenhoRef.current = null;
        setCongeladoDesenhoBib(false);
        abrirPausaBib(null, tAlvo); // os desenhos saem ao retomar
        enviarComandoYoutube(lento ? 'setPlaybackRate' : 'playVideo', lento ? [1] : undefined);
      }, duracao * 1000);
      return;
    }
    if (!ativoEClipe || modoDesenhoBib) return;
    const anotacoes = active.anotacoesPausa || [];
    if (anotacoes.length === 0) return;
    const dentroDoCorte = (t) => t != null && t >= clipIni - 1.25 && t <= clipFimEf + 0.75;
    if (!dentroDoCorte(liveTime)) return;

    // PRIMEIRA PASSAGEM. Ao abrir um corte (ou ao voltar ao início dele),
    // a primeira leitura do tempo pode chegar já bem depois do instante da
    // pausa — o leitor demora a carregar e só depois começa a reportar.
    // Antes, esse atraso fazia a pausa ser ignorada na 1ª visualização
    // (só aparecia numa 2ª, com o vídeo já em cache e a leitura a chegar
    // mais cedo). Agora, a primeira leitura A TOCAR depois de entrar/recuar
    // apanha qualquer pausa desde esse ponto — e, se o vídeo já a passou,
    // volta atrás até ela antes de congelar.
    if (!dentroDoCorte(anterior)) {
      passagemDesdeRef.current = clipIni;
    } else if (liveTime < anterior - 0.3) {
      // Recuou (fim do corte → início, -2s, barra para trás): as pausas
      // que ficaram outra vez à frente voltam a poder disparar.
      anotacoes.forEach(a => { if (tempoPausaNoCorte(a) >= liveTime - 0.5) pausasJaMostradasRef.current.delete(a.id); });
      passagemDesdeRef.current = liveTime;
      return;
    }
    // Rede de segurança: se o vídeo foi parar longe do minuto da paragem
    // por outra via (não pela nossa barra), os itens também saem.
    const cParagem = pausaControloRef.current;
    if (cParagem && cParagem.tParagem != null && !cParagem.cancelado
      && (liveTime < cParagem.tParagem - 0.6 || liveTime > cParagem.tParagem + cParagem.margemFrente)) {
      largarParagemBib();
      return;
    }
    if (!ytATocarRef.current) return; // parado: espera pelo play (a passagem fica guardada)
    if (pausaEmCursoRef.current) return;
    let desde;
    if (passagemDesdeRef.current != null) {
      desde = passagemDesdeRef.current;
      passagemDesdeRef.current = null;
    } else {
      const avanco = liveTime - anterior;
      if (avanco <= 0 || avanco >= 2) return; // parado, ou salto para a frente (barra) — não é passagem
      desde = anterior;
    }

    const primeira = anotacoes
      .filter(a => !pausasJaMostradasRef.current.has(a.id))
      .map(a => ({ a, t: tempoPausaNoCorte(a) }))
      .filter(x => x.t >= desde - 0.5 && x.t <= liveTime + 0.05)
      .sort((x, y) => x.t - y.t)
      .map(x => x.a)[0];
    if (!primeira) return;
    // O vídeo já passou do instante da pausa (leitura atrasada)? Volta lá.
    if (liveTime - tempoPausaNoCorte(primeira) > 0.3) enviarComandoYoutube('seekTo', [tempoPausaNoCorte(primeira), true]);
    const grupo = anotacoes.filter(a => Math.abs(tempoPausaNoCorte(a) - tempoPausaNoCorte(primeira)) < JANELA_MESMA_PAUSA_BIB);
    grupo.forEach(a => pausasJaMostradasRef.current.add(a.id));
    // Math.max com um valor sempre válido — se por algum motivo uma
    // duração viesse estragada (undefined/NaN), nunca deixar isso
    // transformar-se numa pausa sem fim.
    const todasAsFormas = grupo.flatMap(a => (a.shapes || []).map(f => ({ ...f, seg: segDaForma(f, a) })));
    // O vídeo fica parado até sair a última forma.
    const duracaoComum = Math.max(1, ...todasAsFormas.map(f => f.seg));
    pausaEmCursoRef.current = primeira.id;
    // Janela onde a paragem é "deste minuto": em câmara lenta o vídeo anda
    // no máximo duração × velocidade; mais do que isso foi um salto.
    const controlo = {
      cancelado: false,
      tParagem: tempoPausaNoCorte(primeira),
      margemFrente: duracaoComum * (MODO_SEGURAR_BIB === 'lento' ? VELOCIDADE_LENTA_BIB : 0) + 1.2,
    };
    pausaControloRef.current = controlo;

    // Mostra tudo junto e vai tirando cada forma quando acaba o tempo dela.
    // `agendar` é o relógio da paragem (pausável — ver `criarRelogioBib`).
    const mostrarFormas = (agendar = (ms, fn) => setTimeout(fn, ms)) => {
      setPausaAtivaBib({ id: primeira.id, shapes: todasAsFormas });
      [...new Set(todasAsFormas.map(f => f.seg))].filter(s => s < duracaoComum).forEach(s => {
        agendar(s * 1000, () => {
          if (controlo.cancelado) return;
          setPausaAtivaBib(p => (p && p.id === primeira.id ? { ...p, shapes: p.shapes.filter(f => f.seg > s) } : p));
        });
      });
    };
    const confirmarEstado = (querACorrer, aoConfirmar, tentativasRestantes) => {
      if (controlo.cancelado) return;
      if (ytATocarRef.current === querACorrer) {
        aoConfirmar();
        return;
      }
      if (tentativasRestantes <= 0) {
        // Nunca chegou a confirmação — segue em frente na mesma, em vez
        // de arriscar ficar preso para sempre à espera.
        aoConfirmar();
        return;
      }
      enviarComandoYoutube(querACorrer ? 'playVideo' : 'pauseVideo');
      setTimeout(() => confirmarEstado(querACorrer, aoConfirmar, tentativasRestantes - 1), 300);
    };

    if (MODO_SEGURAR_BIB === 'lento') {
      // Câmara lenta: sem pausa, sem play — o YouTube continua "a tocar".
      /* ZOOM COMO NA TELEVISÃO: numa paragem com círculo de zoom, a
         imagem fica PARADA (não em câmara lenta) — aproxima-se, segura,
         e afasta-se ainda parada; só depois o vídeo retoma, já no tamanho
         normal. Ampliar um vídeo a andar, e voltar a pô-lo a andar a meio
         do afastamento, é o que fazia a imagem tremer e, por um instante,
         aparecer pequena num canto. */
      /* Paragem com zoom: câmara lenta como as outras (pôr o vídeo em
         PAUSA fazia aparecer o botão grande de play do YouTube, ampliado
         3×, por cima da jogada). O zoom sai um instante antes do círculo,
         com a saída suave (ver `saidaSuaveZoomRef`). */
      const circZoom = todasAsFormas.find(f => f.tool === 'circulo' && Number(f.zoom) > 1);
      const relogio = criarRelogioBib();
      controlo.relogio = relogio;
      setZoomSaidaBib(null);
      enviarComandoYoutube('setPlaybackRate', [VELOCIDADE_LENTA_BIB]);
      // Relógio que pára quando o vídeo é posto em pausa (ver o efeito
      // sobre `ytATocar`): os itens ficam no ecrã enquanto estiver
      // parado e retomam o tempo que lhes faltava ao carregar em play.
      if (!ytATocarRef.current) relogio.pausar();
      if (circZoom) {
        relogio.agendar(Math.max(0.4, circZoom.seg - 0.9) * 1000, () => {
          if (!controlo.cancelado) setZoomSaidaBib(primeira.id);
        });
      }
      mostrarFormas(relogio.agendar);
      relogio.agendar(duracaoComum * 1000, () => {
        if (controlo.cancelado) return;
        setPausaAtivaBib(null);
        enviarComandoYoutube('setPlaybackRate', [1]);
        if (pausaControloRef.current === controlo) pausaControloRef.current = null;
        pausaEmCursoRef.current = null;
      });
      return;
    }
    enviarComandoYoutube('pauseVideo');
    setTimeout(() => {
      confirmarEstado(false, () => {
        if (controlo.cancelado) return;
        // Confirmado que pausou (ytATocarRef já é false) — só agora
        // começa a contagem a sério, e só agora mostra os desenhos.
        mostrarFormas();
        setTimeout(() => {
          if (controlo.cancelado) return;
          setPausaAtivaBib(null);
            enviarComandoYoutube('playVideo');
          confirmarEstado(true, () => {
            if (pausaControloRef.current === controlo) pausaControloRef.current = null;
            pausaEmCursoRef.current = null;
          }, 5);
        }, duracaoComum * 1000);
      }, 5);
    }, 150); // um instante para o 1º pedido ter hipótese de chegar, antes de o confirmar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTime, active && active.id]);

  // Trocar de corte, entrar no modo de desenho ou sair da página:
  // cancela a pausa que estiver a meio e tira os desenhos dela do ecrã.
  // É isto que impede os desenhos de um corte de aparecerem noutro.
  useEffect(() => {
    return () => {
      cancelarRetomaDesenhoBib();
      if (pausaControloRef.current && MODO_SEGURAR_BIB === 'lento') enviarComandoYoutube('setPlaybackRate', [1]);
      if (pausaControloRef.current) pausaControloRef.current.cancelado = true;
      pausaControloRef.current = null;
      pausaEmCursoRef.current = null;
      setPausaAtivaBib(null);
    };
  }, [active && active.id, modoDesenhoBib]);
  // A pré-visualização do zoom apaga-se sozinha (e ao trocar de corte).
  useEffect(() => {
    if (!zoomPreviewBib) return undefined;
    const t = setTimeout(() => setZoomPreviewBib(null), 2600);
    return () => clearTimeout(t);
  }, [zoomPreviewBib]);
  useEffect(() => { setZoomPreviewBib(null); }, [active && active.id, modoDesenhoBib]);
  // Ao mudar de corte, a passagem recomeça do zero.
  useEffect(() => {
    pausasJaMostradasRef.current = new Set();
    tempoAnteriorPausaRef.current = null;
    passagemDesdeRef.current = null;
  }, [active && active.id]);

  /* O CLIPE SÓ MOSTRA O CLIPE.

     Antes, a barra nativa do YouTube deixava arrastar para qualquer ponto
     do jogo inteiro (e a regra era de propósito "nunca lutar contra quem
     arrasta"). Pedido novo: dentro de um clipe só se anda para a frente/
     trás DENTRO do corte. Por isso:
     - a barra nativa está escondida nos clipes (controls=0, ver
       `youtubeEmbedSrc`) e a nossa barra só vai de `clipInicio` a
       `clipFim`;
     - este efeito é a rede de segurança: qualquer leitura fora do
       intervalo (ex.: o "repetir" nativo do YouTube, que recomeça o
       vídeo ORIGINAL do zero) volta ao início do corte;
     - ao chegar ao fim A TOCAR NORMALMENTE, volta ao início e continua —
       o ciclo contínuo de sempre. */
  const tempoAnteriorClipeRef = React.useRef(null);
  /* FIM DE CORTE COMO NA ANÁLISE INDIVIDUAL: ao chegar ao fim, o corte
     PÁRA no último instante e aparece "Repetir" / "Corte seguinte" —
     avança-se à mão (antes: um corte sozinho repetia sem parar e, em
     "Ver cortes em seguida", passava sozinho ao seguinte). */
  const [fimCorte, setFimCorte] = useState(null); // id do corte que chegou ao fim
  /* Só se deteta o FIM depois de o leitor ter mesmo ENTRADO no corte novo.
     Ao andar para trás (⏮), o leitor ainda dava por instantes o tempo do
     corte de onde se vinha — já depois do fim deste — e aparecia logo o
     "Repetir / Clipe seguinte", preso. */
  const entrouNoCorteRef = useRef(false);
  const autoplayIdRef = useRef(null); // item que deve arrancar já a tocar ao abrir
  useEffect(() => { setFimCorte(null); entrouNoCorteRef.current = false; }, [activeId]);
  useEffect(() => {
    if (!ativoEClipe) { tempoAnteriorClipeRef.current = null; return; }
    const anterior = tempoAnteriorClipeRef.current;
    tempoAnteriorClipeRef.current = liveTime;
    if (anterior == null) return; // primeira leitura deste corte — sem nada para comparar ainda

    // Parado no fim à espera de "Repetir"/"Seguinte": se carregarem no
    // play do próprio leitor, recomeça o corte do início.
    if (fimCorte === active.id) {
      if (ytATocarRef.current && liveTime >= clipFimEf - 0.05) {
        setFimCorte(null);
        enviarComandoYoutube('seekTo', [clipIni, true]);
        tempoAnteriorClipeRef.current = clipIni;
      }
      return;
    }

    const aTocarNormalmente = Math.abs(liveTime - anterior) < 2;
    if (!entrouNoCorteRef.current && liveTime >= clipIni - 0.5 && liveTime < clipFimEf - 0.2) entrouNoCorteRef.current = true;
    if (aTocarNormalmente && liveTime >= clipFimEf && entrouNoCorteRef.current) {
      // Uma paragem com desenhos a decorrer mesmo no fim: deixa-a acabar.
      if (pausaEmCursoRef.current) return;
      // A gravar o vídeo do corte: não recomeça (a gravação acaba aqui).
      if (gravacaoBibRef.current) return;
      /* ZOOM DE UM CÍRCULO ainda no ecrã ou a sair: espera que acabe. Parar
         o vídeo (ou saltar) a meio da animação de saída fazia o browser
         mostrar um fotograma estragado — a imagem encolhida num quadrado
         com fundo preto — e a imagem "piscava" no fim do clipe. */
      if (zoomVisivelBib || Date.now() < zoomSaiAteRef.current) return;
      // Como na Análise individual: corte SOZINHO repete sem parar; numa
      // lista (vários cortes do jogo/tema) pára no fim e pergunta
      // "Repetir / Clipe seguinte".
      if (seguinteNaSala(active.id).lista.length <= 1) {
        enviarComandoYoutube('seekTo', [clipIni, true]);
        enviarComandoYoutube('playVideo');
        tempoAnteriorClipeRef.current = clipIni;
        return;
      }
      // Só PÁRA, na imagem em que está (como na Análise). O salto para trás
      // que havia aqui (para 0,1 s antes do fim) fazia a imagem recuar um
      // bocadinho depois de parar — o "soluço" no fim de cada clipe.
      enviarComandoYoutube('pauseVideo');
      setFimCorte(active.id);
      tempoAnteriorClipeRef.current = null;
    } else if (liveTime < clipIni - 1.25 || liveTime > clipFimEf + 0.75) {
      // A gravar, os segundos ANTES do corte são de propósito (ver `gravarCorteBib`).
      if (gravacaoBibRef.current && gravacaoBibRef.current.preRoll) return;
      enviarComandoYoutube('seekTo', [clipIni, true]);
      tempoAnteriorClipeRef.current = clipIni;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTime, active && active.id, fimCorte]);

  // BARRA DO CLIPE — enquanto se arrasta, mostra a posição do dedo/rato
  // (e não a do leitor, que chega com atraso e faria o cursor saltar).
  const [arrastoClipe, setArrastoClipe] = useState(null);
  /* ITENS SÓ NO MINUTO DELES. Mexer na barra (ou nos -2s/+2s) durante
     uma paragem com desenhos acaba com ela NA HORA: os itens saem, o
     vídeo volta à velocidade normal, e no sítio para onde se foi não
     fica nada que não seja desse minuto. Antes os itens ficavam presos
     no ecrã até acabar o tempo deles, mesmo já noutro minuto. */
  const largarParagemBib = () => {
    const c = pausaControloRef.current;
    if (c) {
      c.cancelado = true;
      if (c.pausaPropria) enviarComandoYoutube('playVideo'); // paragem de zoom: o vídeo estava parado por nós
      else if (MODO_SEGURAR_BIB === 'lento') enviarComandoYoutube('setPlaybackRate', [1]);
    }
    setZoomSaidaBib(null);
    saidaSuaveZoomRef.current = false; // corte brusco: volta ao normal sem animação
    pausaControloRef.current = null;
    pausaEmCursoRef.current = null;
    setPausaAtivaBib(null);
    // A desenhar: um congelamento a meio também acaba (sem voltar atrás).
    const r = retomaDesenhoRef.current;
    if (r) {
      r.cancelado = true;
      if (r.lento) enviarComandoYoutube('setPlaybackRate', [1]);
      retomaDesenhoRef.current = null;
      setCongeladoDesenhoBib(false);
    }
  };
  const acabarGravacaoBib = async () => {
    const g = gravacaoBibRef.current;
    if (!g) return;
    gravacaoBibRef.current = null;
    setGravacaoBib(null);
    enviarComandoYoutube('pauseVideo');
    const blob = await g.ctl.parar();
    if (!blob || !blob.size) { setAvisoGravacaoBib('A gravação ficou vazia. Tenta outra vez.'); return; }
    // Janela com o resultado: ver, descarregar ou partilhar (o "Partilhar"
    // do telemóvel precisa de um toque — por isso é um botão aqui).
    setProgressoFicheiro(null);
    setJanelaGravacaoBib({ fase: 'pronto', blob, nome: g.nome, url: URL.createObjectURL(blob), ficheiro: !!g.ficheiro });
  };
  /* `item`: o corte a gravar (o botão Partilhar da lista manda o corte
     dessa linha). Se não for o que está aberto, abre-o primeiro e a
     gravação arranca quando o leitor já o tiver (ver o efeito sobre
     `active.id`). O pedido do browser vem logo, no próprio clique —
     depois disso o browser já não o deixaria aparecer. */
  const gravarCorteBib = async (item) => {
    const alvoF = item || active;
    const segsF = alvoF && !semAcessoFicheiroRef.current && podeGravarFicheiro() ? segmentosSoFicheiro([alvoF.id]) : null;
    if (segsF && ehClipe(alvoF)) { gravarFicheiroBib(segsF, alvoF.title || 'Corte'); return; }
    if (!podeGravarSeparador()) {
      setAvisoGravacaoBib('Gravar vídeo só funciona no computador (Chrome, Edge ou Safari).');
      return;
    }
    if (modoDesenhoBib) cancelarDesenhoBib();
    largarParagemBib();
    let ctl;
    try { ctl = await prepararGravacaoSeparador(areaVideoBibRef.current); } catch (e) { return; } // recusou a partilha
    if (item && active && item.id !== active.id) {
      const g = { ctl, nome: item.title || 'Corte', comecouEm: 0, preRoll: true, arranque: 0, pendenteId: item.id };
      gravacaoBibRef.current = g;
      setGravacaoBib({ desde: Date.now() });
      ctl.acabou.then(() => { if (gravacaoBibRef.current === g) acabarGravacaoBib(); });
      setActiveId(item.id);
      return;
    }
    arrancarGravacaoBib(ctl);
  };
  /* GRAVAR UMA LISTA DE CLIPES NUM SÓ FICHEIRO ("Os meus vídeos" do
     Portal). Uma gravação só: em cada clipe grava do início ao fim, pausa
     enquanto o seguinte carrega e retoma no início dele. No fim abre a
     janela de sempre (ver, descarregar, partilhar). Só no computador. */
  /* CLIPES DE VÍDEOS CARREGADOS (sem desenhos): grava-se o próprio vídeo,
     sem partilhar o ecrã (ver media/gravarFicheiro.js). Se o Storage não
     deixar ler a imagem, volta-se à gravação do separador. */
  const [progressoFicheiro, setProgressoFicheiro] = useState(null);
  const semAcessoFicheiroRef = useRef(false);
  const segmentosSoFicheiro = (ids) => {
    const lista = (ids || []).map(id => (items || []).find(v => v.id === id) || (todosVideos || []).find(v => v.id === id));
    if (!lista.length || lista.some(v => !v || v.youtubeId || !eVideoFicheiroBib(v) || (v.anotacoesPausa || []).length)) return null;
    return lista.map(v => (ehClipe(v)
      ? { src: v.dataUrl, inicio: Number(v.clipInicio) || 0, fim: Number(v.clipFim) || 0 }
      : { src: v.dataUrl, inicio: 0, fim: Number.MAX_SAFE_INTEGER }));
  };
  const gravarFicheiroBib = async (segs, nome) => {
    let ctl;
    try {
      ctl = await gravarClipesDeFicheiro(segs, { onProgresso: p => setProgressoFicheiro(p) });
    } catch (e) { setAvisoGravacaoBib('Não foi possível preparar o vídeo. Tenta outra vez.'); return; }
    const g = { ctl, nome: nome || 'O meu vídeo', comecouEm: 0, preRoll: false, pendenteId: null, ficheiro: true };
    gravacaoBibRef.current = g;
    setGravacaoBib({ desde: Date.now() });
    setProgressoFicheiro(0);
    ctl.acabou.then(() => { if (gravacaoBibRef.current === g) acabarGravacaoBib(); }).catch((e) => {
      if (gravacaoBibRef.current === g) { gravacaoBibRef.current = null; setGravacaoBib(null); }
      setProgressoFicheiro(null);
      if (e && e.semAcesso) {
        semAcessoFicheiroRef.current = true;
        setAvisoGravacaoBib('Este vídeo não deixa gravar só a imagem. Carrega outra vez para gravar pelo separador.');
      } else setAvisoGravacaoBib('A gravação falhou. Tenta outra vez.');
    });
  };
  const gravarSequenciaBib = async (ids, nome) => {
    if (!ids || !ids.length) return;
    const segsF = !semAcessoFicheiroRef.current && podeGravarFicheiro() ? segmentosSoFicheiro(ids) : null;
    if (segsF) { gravarFicheiroBib(segsF, nome); return; }
    if (!podeGravarSeparador()) {
      setAvisoGravacaoBib('Gravar vídeo só funciona no computador (Chrome, Edge ou Safari).');
      return;
    }
    if (modoDesenhoBib) cancelarDesenhoBib();
    largarParagemBib();
    let ctl;
    try { ctl = await prepararGravacaoSeparador(areaVideoBibRef.current); } catch (e) { return; }
    setSequencia(ids);
    const g = { ctl, nome: nome || 'O meu vídeo', comecouEm: 0, preRoll: true, arranque: 0, pendenteId: null, seq: ids };
    gravacaoBibRef.current = g;
    setGravacaoBib({ desde: Date.now() });
    ctl.acabou.then(() => { if (gravacaoBibRef.current === g) acabarGravacaoBib(); });
    if (active && active.id === ids[0]) arrancarGravacaoBib(ctl, g);
    else { g.pendenteId = ids[0]; setActiveId(ids[0]); }
  };
  const arrancarGravacaoBib = (ctl, gExistente) => {
    /* SEM A INFORMAÇÃO DO YOUTUBE NO VÍDEO. Ao arrancar, o YouTube mostra
       por uns segundos o título, o canal, o botão de pausa e um
       escurecido por cima da imagem (era o "mais escuro" do início da
       gravação). Por isso o vídeo arranca uns 4s ANTES do corte, sem
       gravar; quando chega ao início do corte essa informação já saiu, e
       só aí começa a gravação. */
    const PRE_ROLL = 4;
    const arranque = Math.max(0, clipIni - PRE_ROLL);
    const g = gExistente || { ctl, nome: active.title || 'Corte', comecouEm: 0 };
    Object.assign(g, { preRoll: true, arranque, pendenteId: null });
    if (!gExistente) {
      gravacaoBibRef.current = g;
      setGravacaoBib({ desde: Date.now() });
      // "Parar partilha" no browser também termina e entrega o que já houver.
      ctl.acabou.then(() => { if (gravacaoBibRef.current === g) acabarGravacaoBib(); });
    }
    // Todas as paragens do corte a contar outra vez.
    pausasJaMostradasRef.current.clear();
    enviarComandoYoutube('pauseVideo');
    enviarComandoYoutube('seekTo', [arranque, true]);
    setTimeout(() => {
      if (gravacaoBibRef.current !== g) return;
      enviarComandoYoutube('playVideo');
      // Corte logo no início do vídeo (sem 4s antes): espera que a
      // informação saia e grava a partir daí.
      if (clipIni - arranque < 1) {
        setTimeout(() => {
          if (gravacaoBibRef.current !== g || !g.preRoll) return;
          g.preRoll = false; g.comecouEm = Date.now(); ctl.comecar();
        }, 3500);
      }
    }, 500);
  };
  const procurarNoClipe = (t) => {
    // Nunca exatamente no fim: aí o ciclo acima recomeçava logo o corte.
    const alvo = Math.min(Math.max(t, clipIni), Math.max(clipIni, clipFimEf - 0.25));
    largarParagemBib();
    // Ir para trás com a barra: todas as pausas que ficam à frente voltam
    // a parar já na próxima reprodução (incluindo as acabadas de gravar e
    // as que já tinham sido vistas), dentro e fora do modo de desenho.
    (active.anotacoesPausa || []).forEach(a => {
      if (tempoPausaNoCorte(a) >= alvo - 0.5) { pausasJaMostradasRef.current.delete(a.id); congeladasDesenhoRef.current.delete(a.id); }
    });
    // A desenhar, sem nada por gravar: os itens da pausa aberta saem se o
    // destino não for o minuto dela (só aparecem no momento certo).
    if (modoDesenhoBib && historicoBib.length === 0 && !formaEmCursoBib && Math.abs(alvo - tempoAnotacaoBib) > JANELA_ABRIR_PAUSA_BIB) {
      const aqui = pausaMaisPertoBib(alvo, JANELA_ABRIR_PAUSA_BIB);
      abrirPausaBib(aqui || null, alvo);
    }
    setArrastoClipe(alvo);
    enviarComandoYoutube('seekTo', [alvo, true]);
  };
  const largarBarraClipe = () => setArrastoClipe(null);
  const recuarClipe = (delta) => procurarNoClipe((arrastoClipe != null ? arrastoClipe : liveTime) + delta);
  // Quando o leitor já está perto do sítio escolhido, larga o valor do
  // arrasto (evita ficar "preso" se o soltar do dedo não chegar).
  useEffect(() => {
    if (arrastoClipe == null) return;
    const t = setTimeout(() => setArrastoClipe(null), 1500);
    return () => clearTimeout(t);
  }, [arrastoClipe]);

  /* Uma linha da lista. Extraída para poder ser usada tanto na lista
     corrida (dentro de uma pasta) como dentro de cada pasta fechada. */
  const renderRow = (v) => {
    const Icon = kindIcon[v.kind] || FileText;
    const naFicha = modoCanal && !!v.adversarioId;
    return (
        <div key={v.id}
          // O CARTÃO TODO abre o item (não só a zona do título); os
          // controlos lá dentro (mover, editar, partilhar, apagar…) fazem
          // o que já faziam.
          onClick={(e) => { if (e.target.closest && e.target.closest('button, select, input, a, textarea, label')) return; selectItem(v.id); }}
          style={{
          cursor: 'pointer',
          display: 'flex', gap: 8, borderRadius: 8, border: `1px solid ${v.id === active?.id ? T.gold : T.line}`,
          background: v.id === active?.id ? `${T.crimson}33` : T.surface, padding: '8px 10px',
          // No telemóvel a linha parte-se em duas: o item em cima e
          // os controlos por baixo. Tudo na mesma linha deixava o
          // título espremido em duas ou três palavras por linha.
          ...(isNarrow
            ? { flexDirection: 'column', alignItems: 'stretch' }
            : { alignItems: 'center' }),
        }}>
          <button onClick={() => selectItem(v.id)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', padding: 0 }}>
            {v.youtubeId ? (
              <img src={`https://img.youtube.com/vi/${v.youtubeId}/default.jpg`} alt="" style={{ width: 44, height: 33, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
            ) : v.thumbUrl ? (
              <img src={v.thumbUrl} alt="" style={{ width: 44, height: 33, objectFit: 'cover', borderRadius: 4, flexShrink: 0, background: '#000' }} />
            ) : eVideoFicheiroBib(v) ? (
              // Vídeo carregado: o fotograma do próprio ficheiro (no início do corte, num clipe).
              <video src={`${v.dataUrl}#t=${(ehClipe(v) ? Number(v.clipInicio) || 0 : 0) + 0.5}`} muted playsInline preload="metadata"
                style={{ width: 44, height: 33, objectFit: 'cover', borderRadius: 4, flexShrink: 0, background: '#000', pointerEvents: 'none' }} />
            ) : v.social ? (
              <div style={{ width: 44, height: 33, borderRadius: 4, flexShrink: 0, background: T.surfaceRaise, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {React.createElement(socialMeta[v.social.platform].Icon, { size: 16, color: socialMeta[v.social.platform].color })}
              </div>
            ) : (
              <div style={{ width: 44, height: 33, borderRadius: 4, flexShrink: 0, background: T.surfaceRaise, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={16} color={T.mutedDim} />
              </div>
            )}
            <span style={{ minWidth: 0 }}>
              {/* Se um item ficar sem título por alguma razão, mostra
                  na mesma alguma coisa — uma linha totalmente em
                  branco não dá para perceber nem para apagar. */}
              <div style={{ fontSize: 12.5, color: v.title ? T.cream : T.mutedDim }}>{v.title || v.fileName || '(sem título)'}</div>
              {modoCanal && ehClipe(v) ? (
                // Dentro de um jogo a jornada é repetida — num corte mostra-se
                // antes o intervalo.
                <div style={{ fontSize: 11, color: T.mutedDim, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Scissors size={10} /> {fmtMMSS(v.clipInicio)}–{fmtMMSS(v.clipFim)}
                  {naFicha && <span style={{ color: T.warn }}>· corte</span>}
                </div>
              ) : (v.jornada || v.fileName) && <div style={{ fontSize: 11, color: T.mutedDim }}>{v.jornada || v.fileName}</div>}
              {/* Só se mostra a pasta quando se está a ver tudo —
                  dentro de uma pasta seria informação repetida. */}
              {!semCatalogo && (modoCanal ? !!termo : (folderFilter === null && !!cleanFolder(v.pasta))) && (
                <div style={{ fontSize: 10.5, color: T.warn, marginTop: 2 }}>{modoCanal ? lugarDoItem(v) : cleanFolder(v.pasta)}</div>
              )}
            </span>
          </button>
          {/* Mover para outra pasta sem abrir a janela de edição. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...(isNarrow ? { justifyContent: 'flex-end' } : {}) }}>
          {!soLeitura && !semCatalogo && modoCanal && (catDe(v) !== 'tema' || naFicha) && (
            // Jogos e adversários não vivem em pastas — mantém-se o lugar
            // do seletor, para os ícones continuarem alinhados em coluna.
            <span style={isNarrow ? { flex: 1 } : { width: 150, flexShrink: 0 }} />
          )}
          {!soLeitura && !semCatalogo && (!modoCanal || (catDe(v) === 'tema' && !naFicha)) && (
          <select
            value={cleanFolder(v.pasta)}
            onChange={e => moveItem(v.id, e.target.value)}
            title="Mover para uma pasta"
            style={{
              background: T.surfaceRaise, color: T.mutedDim, border: `1px solid ${T.line}`,
              // Largura fixa (e não automática): assim os seletores e
              // os ícones ficam todos na mesma coluna, em vez de cada
              // linha os colocar num sítio diferente conforme o
              // comprimento do nome da pasta.
              borderRadius: 6, fontSize: 11, padding: '4px 6px', cursor: 'pointer', ...body,
              ...(isNarrow ? { flex: 1, minWidth: 0 } : { width: 150, flexShrink: 0 }),
            }}
          >
            <option value="">Sem pasta</option>
            {folders.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          )}
          {/* Imprimir sem ter de abrir o item primeiro. Só faz
              sentido em documentos (PDF carregado ou do Drive). */}
          {/* O lugar da impressora existe sempre, mesmo nos itens que
              não se imprimem (vídeos, links) — senão o lápis e o
              caixote saltavam de linha para linha. */}
          {!soLeitura && (
          <span style={{ position: 'relative', width: 20, flexShrink: 0, display: 'inline-flex' }}>
          <button
            /* Num corte do YouTube, "Partilhar" pergunta COMO: o link (abre a
               página do corte, leve) ou o VÍDEO (grava o corte com desenhos,
               pausas e zoom e envia o ficheiro). Nos outros itens, partilha
               logo como sempre. */
            onClick={(e) => {
              e.stopPropagation();
              // No telemóvel (não grava) partilha logo o link, como sempre — sem menu.
              if (ehClipe(v) && temLeitorBib(v) && podeGravarSeparador()) {
                if (menuPartilhaId === v.id) { setMenuPartilha(null); return; }
                const r = e.currentTarget.getBoundingClientRect();
                const cabeBaixo = window.innerHeight - r.bottom > 150;
                setMenuPartilha({
                  id: v.id, right: Math.max(8, window.innerWidth - r.right),
                  ...(cabeBaixo ? { top: r.bottom + 6 } : { bottom: window.innerHeight - r.top + 6 }),
                });
              } else shareMediaItem(v);
            }}
            title="Partilhar"
            style={{ background: 'none', border: 'none', color: menuPartilhaId === v.id ? T.warn : T.mutedDim, cursor: 'pointer', width: 20, padding: 0 }}
          ><Share2 size={13} /></button>
          {menuPartilhaId === v.id && (
            <div onClick={e => e.stopPropagation()} style={{
              position: 'fixed', right: menuPartilha.right, top: menuPartilha.top, bottom: menuPartilha.bottom, zIndex: 60, width: 236,
              background: T.surfaceRaise, border: `1px solid ${T.line}`, borderRadius: 10, padding: 6,
              boxShadow: '0 8px 24px rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column', gap: 2, ...body,
            }}>
              {[
                {
                  k: 'link', Ic: Share2, t: 'Enviar link', s: 'Abre a página do corte (leve, sem ficheiro)',
                  fn: () => { setMenuPartilha(null); shareMediaItem(v); }, on: true,
                },
                {
                  k: 'video', Ic: Video, t: 'Gravar e enviar vídeo', s: 'MP4/WebM com desenhos, pausas e zoom',
                  fn: () => { setMenuPartilha(null); gravarCorteBib(v); }, on: true,
                },
              ].map(o => (
                <button key={o.k} type="button" disabled={!o.on} onClick={o.fn} style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', width: '100%',
                  background: 'transparent', border: 'none', borderRadius: 7, padding: '8px 9px',
                  cursor: o.on ? 'pointer' : 'default', opacity: o.on ? 1 : 0.45, color: T.cream, ...body,
                }}
                  onMouseEnter={e => { if (o.on) e.currentTarget.style.background = T.surface; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <o.Ic size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{o.t}</span>
                    <span style={{ fontSize: 11.5, color: T.mutedDim, lineHeight: 1.35 }}>{o.s}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          </span>
          )}
          {(v.kind === 'pdf' || v.kind === 'drive' || v.kind === 'image') ? (
            <button
              onClick={() => printDocumentItem(v)}
              title="Abrir num separador novo e imprimir"
              style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', width: 20, flexShrink: 0 }}
            ><Printer size={13} /></button>
          ) : (
            <span style={{ width: 20, flexShrink: 0 }} />
          )}
          {soLeitura && v.deAtleta && confirmarApagarId !== v.id && (
            <>
              <button
                onClick={() => shareMediaItem(v)}
                title="Partilhar só o corte"
                aria-label={`Partilhar o clipe ${v.title || ''}`}
                style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', width: 20, flexShrink: 0 }}
              ><Share2 size={13} /></button>
              {editarClipeAtleta && (
                <button
                  onClick={() => iniciarEdicaoClipeAtleta(v)}
                  title="Editar o clipe"
                  aria-label={`Editar o clipe ${v.title || ''}`}
                  style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', width: 20, flexShrink: 0 }}
                ><Pencil size={13} /></button>
              )}
            </>
          )}
          {soLeitura && v.deAtleta && apagarClipeAtleta && (
            confirmarApagarId === v.id ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0, fontSize: 12, ...body }}>
                <span style={{ color: T.cream }}>{aApagarClipeId === v.id ? 'A apagar…' : 'Apagar o clipe?'}</span>
                {aApagarClipeId !== v.id && (
                  <>
                    <button onClick={() => confirmarApagarClipeAtleta(v.id)} style={{ background: 'none', border: `1px solid ${T.bad}`, borderRadius: 6, color: T.bad, cursor: 'pointer', padding: '3px 9px', fontSize: 12, ...body }}>Apagar</button>
                    <button onClick={() => setConfirmarApagarId(null)} style={{ background: 'none', border: `1px solid ${T.line}`, borderRadius: 6, color: T.muted, cursor: 'pointer', padding: '3px 9px', fontSize: 12, ...body }}>Cancelar</button>
                  </>
                )}
              </span>
            ) : (
              <button
                onClick={() => setConfirmarApagarId(v.id)}
                title="Apagar este clipe"
                aria-label={`Apagar o clipe ${v.title || ''}`}
                style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', width: 20, flexShrink: 0 }}
              ><Trash2 size={13} /></button>
            )
          )}
          {!soLeitura && (
            <>
              <button onClick={() => setModal(v)} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer' }}><Pencil size={13} /></button>
              <button onClick={() => remove(v.id)} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer' }}><Trash2 size={13} /></button>
            </>
          )}
          </div>
        </div>
    );
  };

  const isBlocked = active && active.youtubeId && blockedIds[active.youtubeId];
  temVideoBibRef.current = !!(temLeitorBib(active) && !isBlocked); // para a barra de espaço
  const kindIcon = { pdf: BookOpen, video: Play, pptx: Presentation, drive: ExternalLink, image: ImageIcon };

  useEffect(() => {
    activeYoutubeIdRef.current = (active && active.youtubeId) || null;
  }, [active?.youtubeId]);


  // Trocar de vídeo a meio de uma marcação não faz sentido — os
  // marcadores são segundos DENTRO do vídeo que estava a tocar.
  useEffect(() => {
    sairDoModoClipe();
    if (edicaoPendenteRef.current && edicaoPendenteRef.current.abrirEm === activeId) {
      aplicarEdicao(edicaoPendenteRef.current);
      edicaoPendenteRef.current = null;
    }
    // Sem isto, o tempo ficava agarrado ao último valor do vídeo
    // anterior até chegar a primeira atualização do novo — e uma marca
    // de clipe feita nesse intervalo ficava com o tempo errado.
    currentTimeRef.current = 0;
    setLiveTime(0);
    setYtATocar(false);
    setArrastoClipe(null);
    tempoAnteriorClipeRef.current = null;
  }, [activeId]);

  // LEITOR REAPROVEITADO — antes, cada corte tinha o seu próprio leitor
  // (key = id do corte, start= no endereço), por isso trocar de corte
  // recarregava o YouTube inteiro: ecrã preto uns segundos, e a primeira
  // leitura do tempo chegava tarde (ver "PRIMEIRA PASSAGEM"). Agora, se o
  // corte novo é do mesmo vídeo do YouTube que já está aberto, fica o
  // mesmo leitor e salta-se para o início do corte. Calculado durante o
  // render (e guardado numa ref) para o iframe nunca receber, nem por um
  // instante, o endereço do corte anterior.
  const leitorBibRef = useRef(null);
  const leitorBib = (() => {
    if (!temLeitorBib(active)) return null;
    const atual = leitorBibRef.current;
    // O leitor que já está a mostrar ESTE corte mantém-se sempre (senão,
    // pausar depois de uma troca "a tocar" recarregava o leitor).
    if (atual && atual.servindo === active.id) return atual;
    // Só se reaproveita o leitor quando o vídeo está A TOCAR (ou na
    // sequência "em seguida"). Com o vídeo parado, saltar dentro do
    // leitor deixava a pré-visualização PRETA — o YouTube não mostra a
    // imagem nem a miniatura depois de um salto sem reprodução. Parado,
    // recarrega-se como antes: aparece logo a miniatura do corte.
    const emSeqAgora = !!(sequencia && sequencia.includes(active.id));
    const reaproveita = atual && ativoEClipe && atual.eClipe && atual.fonte === fonteBib(active)
      && (ytATocarRef.current || emSeqAgora);
    if (reaproveita) { atual.servindo = active.id; atual.saltarPara = active.id; return atual; }
    const emSeq = sequencia && sequencia.includes(active.id);
    // Chegou aqui pelo ⏮ ⏭ (ou "Clipe seguinte"): arranca logo a tocar,
    // mesmo sendo outro vídeo (antes abria parado e parecia que não
    // tinha avançado).
    // O autoplay do próprio YouTube (autoplay=1) deixava o ecrã PRETO num
    // leitor novo. Agora abre normal (com imagem) e, logo que o leitor
    // está pronto, manda-se tocar (ver `handleIframeLoad`).
    const auto = emSeq;
    if (autoplayIdRef.current === active.id) { tocarAoCarregarRef.current = active.id; autoplayIdRef.current = null; }
    const novo = {
      chave: active.id, servindo: active.id, youtubeId: active.youtubeId, fonte: fonteBib(active), eClipe: ativoEClipe,
      src: active.youtubeId ? youtubeEmbedSrc(active, auto ? 'enablejsapi=1&fs=0&autoplay=1' : 'enablejsapi=1&fs=0') : active.dataUrl,
    };
    leitorBibRef.current = novo;
    return novo;
  })();
  // Corte novo no mesmo leitor: salta para o início dele. Continua a
  // tocar se já estava a tocar (ou se é a sequência "em seguida").
  useEffect(() => {
    // Só quando o leitor foi reaproveitado para ESTE corte (inclui voltar
    // ao corte com que o leitor abriu, que antes não saltava).
    if (!leitorBib || !active || leitorBib.saltarPara !== active.id || !ativoEClipe) return;
    leitorBib.saltarPara = null;
    const estavaATocar = ytATocarRef.current;
    const emSeq = sequencia && sequencia.includes(active.id);
    enviarComandoYoutube('seekTo', [clipIni, true]);
    if (estavaATocar || emSeq) {
      enviarComandoYoutube('playVideo');
      // A troca de corte repõe "a tocar" a falso (pensado para um leitor
      // novo). Com o mesmo leitor, que continua a tocar, o YouTube não
      // volta a avisar — por isso repõe-se aqui o estado verdadeiro.
      setYtATocar(true);
    } else enviarComandoYoutube('pauseVideo');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const marcarInicio = () => setClipMarcas(prev => ({ ...prev, inicio: currentTimeRef.current }));
  const marcarFim = () => setClipMarcas(prev => ({ ...prev, fim: currentTimeRef.current }));

  /* FICHAS CRIADAS SOZINHAS — cada equipa escolhida num jogo de
     adversário passa a ter ficha em Scouting › Adversários, sem perguntar.
     Antes de criar, procura-se uma ficha que já exista com esse nome
     (mesmo escrito de outra forma — ver `fichaDaEquipa`); se existir,
     fica associada à equipa em vez de se criar outra.

     Só corre com as fichas e os vídeos já carregados (`adversariosProntos`)
     — com a lista ainda vazia, pareceria que nenhuma existe e criavam-se
     duplicados. `fichasPedidasRef` evita criar a mesma duas vezes
     enquanto a gravação anterior ainda não voltou. */
  const fichasPedidasRef = React.useRef(new Set());
  const assinaturaEquipas = modoCanal
    ? items.filter(v => catDe(v) === 'adversario').flatMap(equipasDe).map(semAcentos).sort().join('|')
    : '';
  useEffect(() => {
    if (!modoCanal || soLeitura || !setAdversarios || !adversariosProntos || !assinaturaEquipas) return;
    const nomes = new Map();
    items.filter(v => catDe(v) === 'adversario').forEach(v => equipasDe(v).forEach(n => {
      if (!nomes.has(semAcentos(n))) nomes.set(semAcentos(n), n);
    }));
    const novas = [];
    const associar = [];
    nomes.forEach((nome, k) => {
      if (fichasPedidasRef.current.has(k)) return;
      const existente = fichaDaEquipa(nome, [...(adversarios || []), ...novas]);
      if (existente) {
        // Encontrada por nome parecido: grava a ligação, para a partir
        // daqui ser uma correspondência exata.
        if (!existente.equipaCompeticao && semAcentos(existente.nome) !== k && !novas.includes(existente)) {
          associar.push({ id: existente.id, equipa: nome });
        }
        return;
      }
      fichasPedidasRef.current.add(k);
      novas.push({
        id: idFichaAutomatica(teamIdFichas, nome), nome, equipaCompeticao: nome,
        escalao: '', prova: provaDeEquipa ? provaDeEquipa(nome) : '',
        pontosFortes: '', pontosFracos: '', notas: '',
        jogadoresChaveIds: [], quadroTatica: TATICA_OMISSAO, quadroOverrides: {}, taticas: [],
      });
    });
    if (!novas.length && !associar.length) return;
    associar.forEach(x => fichasPedidasRef.current.add(semAcentos(x.equipa)));
    setAdversarios(prev => [
      ...(prev || []).map(a => {
        const lig = associar.find(x => x.id === a.id);
        return lig ? { ...a, equipaCompeticao: lig.equipa } : a;
      }),
      ...novas.filter(n => !fichaDaEquipa(n.nome, prev || []) && !(prev || []).some(a => a.id === n.id)),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinaturaEquipas, adversariosProntos, (adversarios || []).length]);

  // CORTE DE UM JOGO DE ADVERSÁRIO — as duas equipas do jogo, e sobre qual
  // delas é o corte (vai para a ficha dessa). Por omissão, a do cartão
  // que está aberto.
  const eqsAtivo = modoCanal && active && catDe(active) === 'adversario' ? equipasDe(active) : [];
  const mesmaEquipa = (a, b) => !!a && !!b && semAcentos(a) === semAcentos(b);
  const equipaCorteEf = eqsAtivo.find(e => mesmaEquipa(e, equipaCorte))
    || eqsAtivo.find(e => grupoAtual && mesmaEquipa(e, grupoAtual.nome))
    || eqsAtivo[0] || '';

  const guardarClipe = () => {
    if (!temLeitorBib(active) || clipMarcas.inicio == null || clipMarcas.fim == null) return;
    const inicio = Math.min(clipMarcas.inicio, clipMarcas.fim);
    const fim = Math.max(clipMarcas.inicio, clipMarcas.fim);
    if (fim - inicio < 1) return;
    if (criarClipeAtleta) {
      // No Portal: título obrigatório e no máximo MAX_CLIPE_ATLETA_SEG.
      // O servidor volta a validar tudo isto — aqui é só para o botão
      // não deixar tentar.
      if (!tituloClipe.trim() || fim - inicio > MAX_CLIPE_ATLETA_SEG || aGravarClipeAtleta) return;
      setAGravarClipeAtleta(true);
      setErroClipeAtleta('');
      if (edicaoClipeId) {
        const id = edicaoClipeId;
        editarClipeAtleta({ clipeId: id, inicio, fim, titulo: tituloClipe.trim(), nota: notaClipe.trim() })
          .then(() => { sairDoModoClipe(); setSecao('meus'); setGrupo(null); setActiveId(id); })
          .catch(e => {
            setErroClipeAtleta((e && e.message) || 'As alterações não ficaram gravadas. Tenta outra vez.');
            setAGravarClipeAtleta(false);
          });
        return;
      }
      const tituloGravado = tituloClipe.trim();
      criarClipeAtleta({ videoId: active.id, inicio, fim, titulo: tituloGravado, nota: notaClipe.trim() })
        .then(() => continuarACortar(tituloGravado))
        .catch(e => {
          setErroClipeAtleta((e && e.message) || 'O clipe não ficou gravado. Tenta outra vez.');
          setAGravarClipeAtleta(false);
        });
      return;
    }
    const novo = {
      id: uid(),
      title: tituloClipe.trim() || `${active.title || 'Vídeo'} — corte`,
      pasta: 'Cortes',
      jornada: active.jornada || '',
      // Vídeo do YouTube: o corte é o mesmo vídeo com início e fim. Vídeo
      // carregado (ficheiro): também — o clipe aponta para o MESMO ficheiro
      // e toca só esse troço (`clipNoFicheiro`, ver LeitorClipeSala). Não
      // se copia nada no Storage.
      ...(active.youtubeId
        ? { youtubeId: active.youtubeId }
        : { kind: 'video', dataUrl: active.dataUrl, clipNoFicheiro: true, fileName: active.fileName }),
      clipInicio: inicio,
      clipFim: fim,
      // Se o vídeo de origem já era, ele próprio, um clipe, aponta sempre
      // para o vídeo completo original — nunca um clipe de um clipe.
      clipOrigemId: active.clipOrigemId || active.id,
      clipOrigemTitulo: active.clipOrigemTitulo || active.title || '',
    };
    if (!modoCanal) {
      setItems(prev => [novo, ...prev]);
      continuarACortar(novo.title);
      return;
    }

    /* NO CANAL, o corte fica onde o vídeo de origem está:
       - jogo nosso  → no mesmo jogo (não numa pasta "Cortes" gigante);
       - tema        → na mesma pasta do vídeo;
       - adversário  → vai para a FICHA da equipa escolhida no painel (um
         jogo tem duas). Se faltar saber as equipas, ou a equipa ainda não
         tiver ficha, pede-se primeiro. */
    const cat = catDe(active);
    if (cat === 'adversario') {
      const equipa = equipaCorteEf || null;
      const ficha = equipa && fichaDaEquipa(equipa, adversarios);
      if (ficha) { gravarCorteNaFicha(novo, ficha, null, null, equipa); continuarACortar(novo.title); }
      else setPedirFicha({ corte: novo, raizId: novo.clipOrigemId, equipas: eqsAtivo, equipa });
      return;
    }
    const corte = cat === 'jogo'
      ? { ...novo, categoria: 'jogo', pasta: '', jogoId: active.jogoId || (byIdItens[novo.clipOrigemId] || {}).jogoId || null }
      : { ...novo, categoria: 'tema', pasta: cleanFolder(active.pasta) };
    setItems(prev => [corte, ...prev]);
    // Fica no vídeo completo, pronto para o próximo corte.
    continuarACortar(corte.title);
  };

  // Grava o corte na ficha do adversário: leva `adversarioId`, por isso
  // sai do Canal e aparece nos vídeos da ficha (ver `useSubColecao`).
  // `raizId`/`equipas` (opcionais): o vídeo completo passa a guardar as
  // duas equipas do jogo — daí em diante não se volta a perguntar.
  const gravarCorteNaFicha = (corte, ficha, raizId, equipas, equipa) => {
    const naFicha = { ...corte, pasta: '', categoria: undefined, adversarioId: ficha.id, equipa: equipa || ficha.nome || '' };
    setItems(prev => [
      naFicha,
      ...prev.map(v => (raizId && equipas && equipas.length && v.id === raizId
        ? { ...v, categoria: 'adversario', equipas, adversarioFichaId: null }
        : v)),
    ]);
    // O corte já não está na lista do Canal (vive na ficha) — anular tem
    // de o tirar da coleção completa de vídeos.
    offerUndo(`Clipe gravado na ficha do adversário (${ficha.nome || equipa || 'Adversário'}).`, () => {
      if (setTodosVideos) setTodosVideos(prev => prev.filter(v => v.id !== naFicha.id));
    });
  };

  // Resposta da janela "Ficha do adversário".
  const confirmarFicha = ({ equipas, equipa, fichaExistenteId, nova }) => {
    if (!pedirFicha || !equipa) return;
    let ficha = fichaDaEquipa(equipa, adversarios);
    if (!ficha && fichaExistenteId && fichasById[fichaExistenteId]) {
      // Ficha com outro nome (ex.: "Boavista FC" vs "Boavista") — fica
      // associada a esta equipa da competição, para não voltar a perguntar.
      ficha = { ...fichasById[fichaExistenteId], equipaCompeticao: equipa };
      if (setAdversarios) setAdversarios(prev => (prev || []).map(a => (a.id === ficha.id ? { ...a, equipaCompeticao: equipa } : a)));
    }
    if (!ficha && nova) {
      ficha = {
        id: idFichaAutomatica(teamIdFichas, equipa), nome: equipa, equipaCompeticao: equipa,
        escalao: (nova.escalao || '').trim(), prova: (nova.prova || '').trim(),
        pontosFortes: '', pontosFracos: '', notas: '',
        jogadoresChaveIds: [], quadroTatica: TATICA_OMISSAO, quadroOverrides: {}, taticas: [],
      };
      const nova0 = ficha;
      if (setAdversarios) setAdversarios(prev => ((prev || []).some(a => a.id === nova0.id || fichaRepetida(nova0.nome, [a])) ? prev : [...(prev || []), nova0]));
    }
    if (!ficha) return;
    gravarCorteNaFicha(pedirFicha.corte, ficha, pedirFicha.raizId, equipas, equipa);
    setPedirFicha(null);
    setEquipaCorte(equipa);
    sairDoModoClipe();
    setSecao('adversarios');
    setGrupo(`e:${semAcentos(equipa)}`);
  };

  // Quem pode criar clipes neste vídeo: o staff em qualquer vídeo do
  // YouTube; no Portal, o jogador só em vídeos de JOGOS da equipa.
  const podeCriarClipe = !soLeitura
    || (!!criarClipeAtleta && !!active && temLeitorBib(active)
      && (!!edicaoClipeId || (!active.deAtleta && catDe(active) === 'jogo')));

  // Abre a edição de um clipe do atleta: vai para o vídeo completo de
  // origem (se ainda existir); senão, edita sobre o próprio clipe, o que
  // só deixa encurtá-lo.
  const iniciarEdicaoClipeAtleta = (v) => {
    if (!editarClipeAtleta || !v) return;
    const origem = v.clipOrigemId && items.find(x => x.id === v.clipOrigemId && !ehClipe(x));
    const alvo = origem || v;
    const pedido = { abrirEm: alvo.id, clipeId: v.id, inicio: v.clipInicio, fim: v.clipFim, titulo: v.title, nota: v.notaAtleta || '' };
    if (alvo.id === (active && active.id)) { aplicarEdicao(pedido); return; }
    edicaoPendenteRef.current = pedido;
    if (origem) irPara(origem); else { setSecao('meus'); setActiveId(v.id); }
  };
  // Sair do modo clipe; se era uma edição, volta ao clipe em "Os meus clipes".
  const cancelarModoClipe = () => {
    const id = edicaoClipeId;
    sairDoModoClipe();
    if (id) { setSecao('meus'); setGrupo(null); setActiveId(id); }
  };
  const duracaoMarcada = clipMarcas.inicio != null && clipMarcas.fim != null
    ? Math.abs(clipMarcas.fim - clipMarcas.inicio) : null;

  // Painel do Portal: marcar início e fim, depois catalogar (título
  // obrigatório + texto livre) e só então gravar.
  const renderPainelClipeAtleta = (escuro) => {
    const demasiadoLongo = duracaoMarcada != null && duracaoMarcada > MAX_CLIPE_ATLETA_SEG;
    const marcado = duracaoMarcada != null && duracaoMarcada >= 1 && !demasiadoLongo;
    const podeGravar = marcado && !!tituloClipe.trim() && !aGravarClipeAtleta;
    const campo = {
      background: escuro ? '#000' : (escuro ? T_ESCURO : T).bg, border: `1px solid ${(escuro ? T_ESCURO : T).line}`, borderRadius: 8,
      padding: '8px 10px', color: (escuro ? T_ESCURO : T).cream, fontSize: 13, ...body, width: '100%', boxSizing: 'border-box',
    };
    return (
      <div style={escuro ? {
        background: '#111', borderTop: `1px solid ${(escuro ? T_ESCURO : T).line}`, flexShrink: 0,
        padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8,
      } : {
        marginTop: 10, background: (escuro ? T_ESCURO : T).surface, border: `1px solid ${(escuro ? T_ESCURO : T).line}`, borderRadius: 10,
        padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {!escuro && (edicaoClipeId ? (
          <div style={{ fontSize: 12.5, color: (escuro ? T_ESCURO : T).mutedDim }}>
            A editar o clipe. Podes marcar de novo o início e o fim (até {MAX_CLIPE_ATLETA_SEG / 60} minutos),
            ou mudar só o título e o texto. As alterações só ficam quando carregares em Guardar alterações.
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: (escuro ? T_ESCURO : T).mutedDim }}>
            Deixa o vídeo a tocar e marca onde o lance começa e acaba (até {MAX_CLIPE_ATLETA_SEG / 60} minutos).
            Depois dá-lhe um título e escreve o que quiseres sobre ele. O clipe fica guardado para ti e para o treinador.
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Btn escuro={escuro} variant="ghost" onClick={marcarInicio}>Marcar início</Btn>
          <div style={{ fontSize: 13, color: escuro ? '#fff' : (escuro ? T_ESCURO : T).cream, ...mono }}>{clipMarcas.inicio == null ? '—:—' : fmtMMSS(clipMarcas.inicio)}</div>
          <div style={{ color: (escuro ? T_ESCURO : T).mutedDim, fontSize: 12 }}>até</div>
          <Btn escuro={escuro} variant="ghost" onClick={marcarFim} disabled={clipMarcas.inicio == null}>Marcar fim</Btn>
          <div style={{ fontSize: 13, color: escuro ? '#fff' : (escuro ? T_ESCURO : T).cream, ...mono }}>{clipMarcas.fim == null ? '—:—' : fmtMMSS(clipMarcas.fim)}</div>
          {marcado && <div style={{ fontSize: 12, color: (escuro ? T_ESCURO : T).mutedDim }}>{Math.round(duracaoMarcada)}s</div>}
          {clipMarcas.inicio != null && !(active && ehClipe(active)) && (
            <Btn escuro={escuro} variant="ghost" onClick={() => enviarComandoYoutube('seekTo', [Math.min(clipMarcas.inicio, clipMarcas.fim ?? clipMarcas.inicio), true])}>
              Ir para o início marcado
            </Btn>
          )}
        </div>
        {duracaoMarcada != null && duracaoMarcada < 1 && (
          <div style={{ fontSize: 12.5, color: (escuro ? T_ESCURO : T).bad }}>O início e o fim estão demasiado perto. Marca o fim um pouco mais à frente.</div>
        )}
        {demasiadoLongo && (
          <div style={{ fontSize: 12.5, color: (escuro ? T_ESCURO : T).bad }}>
            O clipe tem {Math.round(duracaoMarcada)}s. O máximo são {MAX_CLIPE_ATLETA_SEG} segundos: marca o início ou o fim outra vez.
          </div>
        )}
        {marcado && (
          <>
            <input
              value={tituloClipe} onChange={e => setTituloClipe(e.target.value)} maxLength={120}
              placeholder="Título (obrigatório), ex.: A minha receção orientada"
              style={campo}
            />
            <textarea
              value={notaClipe} onChange={e => setNotaClipe(e.target.value)} maxLength={2000}
              rows={escuro ? 2 : 3}
              placeholder="O que queres dizer sobre este lance? (opcional)"
              style={{ ...campo, resize: 'vertical' }}
            />
            {erroClipeAtleta && <div style={{ fontSize: 12.5, color: (escuro ? T_ESCURO : T).bad }}>{erroClipeAtleta}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Btn onClick={guardarClipe} disabled={!podeGravar}>
                <Scissors size={14} /> {aGravarClipeAtleta ? 'A gravar…' : (edicaoClipeId ? 'Guardar alterações' : 'Gravar clipe')}
              </Btn>
            </div>
          </>
        )}
      </div>
    );
  };

  // Painel "Criar clipe" — o mesmo em modo normal (cartão por baixo do
  // vídeo) e em ecrã inteiro (faixa escura compacta dentro da caixa).
  const renderPainelClipe = (escuro) => criarClipeAtleta ? renderPainelClipeAtleta(escuro) : (
    <div style={escuro ? {
      background: '#111', borderTop: `1px solid ${(escuro ? T_ESCURO : T).line}`, flexShrink: 0,
      padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8,
    } : {
      marginTop: 10, background: (escuro ? T_ESCURO : T).surface, border: `1px solid ${(escuro ? T_ESCURO : T).line}`, borderRadius: 10,
      padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {!escuro && (
        <div style={{ fontSize: 12.5, color: (escuro ? T_ESCURO : T).mutedDim }}>
          Deixa o vídeo a tocar e marca onde o corte começa e acaba — depois dá-lhe um nome
          e o clipe fica gravado à parte, {modoCanal
            ? (eqsAtivo.length || catDe(active) === 'adversario' ? 'na ficha do adversário' : 'junto do vídeo de onde saiu')
            : 'na pasta "Cortes"'}, pronto a rever mais tarde.
        </div>
      )}
      {eqsAtivo.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: (escuro ? T_ESCURO : T).mutedDim }}>Corte sobre:</span>
          {eqsAtivo.map(e => {
            const on = mesmaEquipa(e, equipaCorteEf);
            return (
              <button key={e} onClick={() => setEquipaCorte(e)} style={{
                padding: '4px 11px', borderRadius: 20, fontSize: 12, cursor: 'pointer', ...body,
                background: on ? '#B5393F' : 'transparent', color: on ? TEXT_ON_ACCENT : (escuro ? T_ESCURO : T).muted,
                border: `1px solid ${on ? '#B5393F' : (escuro ? T_ESCURO : T).line}`,
              }}>{e}</button>
            );
          })}
          <span style={{ fontSize: 11.5, color: (escuro ? T_ESCURO : T).mutedDim }}>
            {fichaDaEquipa(equipaCorteEf, adversarios)
              ? `→ ficha de ${fichaDaEquipa(equipaCorteEf, adversarios).nome}`
              : '→ a ficha é criada ao gravar'}
          </span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Btn escuro={escuro} variant="ghost" onClick={marcarInicio}>Marcar início</Btn>
        <div style={{ fontSize: 13, color: escuro ? '#fff' : (escuro ? T_ESCURO : T).cream, ...mono }}>{clipMarcas.inicio == null ? '—:—' : fmtMMSS(clipMarcas.inicio)}</div>
        <div style={{ color: (escuro ? T_ESCURO : T).mutedDim, fontSize: 12 }}>até</div>
        <Btn escuro={escuro} variant="ghost" onClick={marcarFim} disabled={clipMarcas.inicio == null}>Marcar fim</Btn>
        <div style={{ fontSize: 13, color: escuro ? '#fff' : (escuro ? T_ESCURO : T).cream, ...mono }}>{clipMarcas.fim == null ? '—:—' : fmtMMSS(clipMarcas.fim)}</div>
        {clipMarcas.inicio != null && clipMarcas.fim != null && Math.abs(clipMarcas.fim - clipMarcas.inicio) >= 1 && (
          <>
            <input
              value={tituloClipe} onChange={e => setTituloClipe(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') guardarClipe(); }}
              placeholder="Nome do clipe (ex.: Saída de bola sob pressão)"
              style={{
                flex: 1, minWidth: isNarrow ? 160 : 200, background: escuro ? '#000' : (escuro ? T_ESCURO : T).bg, border: `1px solid ${(escuro ? T_ESCURO : T).line}`, borderRadius: 8,
                padding: '8px 10px', color: (escuro ? T_ESCURO : T).cream, fontSize: 13, ...body,
              }}
            />
            <Btn onClick={guardarClipe}><Scissors size={14} /> Guardar clipe</Btn>
          </>
        )}
      </div>
      {clipMarcas.inicio != null && clipMarcas.fim != null && Math.abs(clipMarcas.fim - clipMarcas.inicio) < 1 && (
        <div style={{ fontSize: 12.5, color: (escuro ? T_ESCURO : T).bad }}>O início e o fim estão demasiado perto — marca o fim um pouco mais à frente.</div>
      )}
    </div>
  );

  /* ---------- CANAL: secções, cartões e caminho ---------- */
  const abrirSecao = (id) => { setSecao(id); setGrupo(null); setBusca(''); setSequencia(null); setModoFeed(false); setCompAtiva(null); };
  const abrirGrupo = (key) => {
    setGrupo(key); setSequencia(null); setModoFeed(false);
    const g = gruposDaSecao.find(x => x.key === key);
    if (g && g.itens[0]) setActiveId(g.itens[0].id);
  };
  const cortesDoGrupo = grupoAtual ? grupoAtual.itens.filter(v => ehClipe(v) && temLeitorBib(v)) : [];
  // Tudo o que se reproduz neste jogo/tema, por ordem: cortes do YouTube e
  // clipes em vídeo (MP4, ex.: os enviados da Análise de Vídeo). É a lista
  // do "Corte seguinte" no fim de cada um.
  const eMp4Sala = (v) => !!(v && v.kind === 'video' && !v.youtubeId && !v.storagePath && /^https?:/.test(String(v.dataUrl || '')));
  const reproduziveisDoGrupo = grupoAtual ? grupoAtual.itens.filter(v => (ehClipe(v) && temLeitorBib(v)) || eMp4Sala(v)) : [];
  // Para o ⏮ ⏭ da barra de cima: TUDO o que se vê no jogo/tema, pela ordem
  // da lista — jogos completos, cortes e clipes em vídeo.
  // Pela ordem em que aparecem na lista: primeiro "Jogo completo", depois
  // "Cortes" (antes ficava na ordem interna e não passava dos jogos
  // completos para os cortes).
  const navegaveisDoGrupo = grupoAtual
    ? (grupoAtual.secoes && grupoAtual.secoes.length ? grupoAtual.secoes.flatMap(sc => sc.itens || []) : grupoAtual.itens)
      .filter(v => v && (temLeitorBib(v) || eMp4Sala(v)))
    : [];
  const seguinteNaSala = (id) => {
    const lista = (sequencia && sequencia.includes(id)) ? sequencia : reproduziveisDoGrupo.map(v => v.id);
    const i = lista.indexOf(id);
    return { lista, i, seguinteId: i >= 0 && i < lista.length - 1 ? lista[i + 1] : null };
  };
  const iniciarSequencia = () => {
    if (!cortesDoGrupo.length) return;
    const ids = cortesDoGrupo.map(v => v.id);
    setSequencia(ids);
    const parado = !!(active && fimCorte === active.id);
    setFimCorte(null); // sai o "Repetir / Clipe seguinte" do ecrã
    const iAtual = active ? ids.indexOf(active.id) : -1;
    if (iAtual >= 0 && !parado) {
      // A meio de um corte: continua DAQUI (do sítio onde está) e segue.
      enviarComandoYoutube('playVideo');
      return;
    }
    if (iAtual >= 0 && parado) {
      // Parado no fim de um corte: segue para o seguinte (ou recomeça o
      // último, se já era o último).
      if (iAtual < ids.length - 1) { ytATocarRef.current = true; setActiveId(ids[iAtual + 1]); }
      else { enviarComandoYoutube('seekTo', [cortesDoGrupo[iAtual].clipInicio || 0, true]); enviarComandoYoutube('playVideo'); }
      return;
    }
    // Fora dos cortes (ex.: jogo completo aberto): começa no 1.º.
    ytATocarRef.current = true;
    setActiveId(ids[0]);
  };
  const posSeq = sequencia && active ? sequencia.indexOf(active.id) : -1;

  const pill = (on) => ({
    display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0, whiteSpace: 'nowrap',
    padding: '7px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', ...body,
    background: on ? '#B5393F' : 'transparent',
    color: on ? TEXT_ON_ACCENT : T.muted,
    border: `1px solid ${on ? '#B5393F' : T.line}`,
  });

  const renderSecoesCanal = () => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
      flexDirection: isNarrow ? 'column' : 'row', ...(isNarrow ? { alignItems: 'stretch' } : {}),
    }}>
      {/* No telemóvel os três separadores cabem sempre no ecrã (três colunas
          iguais) — antes deslizavam para o lado e a página mexia. */}
      <div style={{
        display: isNarrow ? 'grid' : 'flex', gap: isNarrow ? 6 : 8, alignItems: 'center',
        ...(isNarrow ? { gridTemplateColumns: `repeat(${secoesCanal.length}, minmax(0, 1fr))` } : {}),
      }}>
        {secoesCanal.map(s => {
          const on = (secao === s.id || (s.id === 'jogos' && secao === 'meus')) && !termo;
          const n = s.id === 'jogos' ? gruposJogo.length
            : s.id === 'adversarios' ? gruposAdv.length
            : s.id === 'meus' ? itensMeus.length
            : itensTema.length;
          return (
            <button key={s.id} onClick={() => abrirSecao(s.id)} style={{
              ...pill(on),
              ...(isNarrow ? { minWidth: 0, justifyContent: 'center', padding: '7px 6px', fontSize: 12.5, gap: 5, whiteSpace: 'nowrap', overflow: 'hidden' } : {}),
            }}>
              {!isNarrow && <s.Icon size={14} />}
              <span style={isNarrow ? { overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 } : undefined}>{s.label}</span>
              <span style={{ ...mono, fontSize: 11.5, opacity: 0.75, flexShrink: 0 }}>{n}</span>
            </button>
          );
        })}
      </div>
      {/* A pesquisa fica aqui (e não na coluna da lista) para ser sempre a
          mesma caixa — ao escrever, a vista troca de cartões para
          resultados sem a caixa perder o foco. Procura no Canal todo. */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, maxWidth: isNarrow ? 'none' : 420, marginLeft: isNarrow ? 0 : 'auto' }}>
        <Search size={14} color={T.mutedDim} style={{ position: 'absolute', left: 10, pointerEvents: 'none' }} />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Procurar em todo o Canal..."
          style={{
            width: '100%', boxSizing: 'border-box', padding: '8px 30px 8px 30px',
            background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8,
            color: T.cream, fontSize: 12.5, outline: 'none', ...body,
          }}
        />
        {busca && (
          <button
            onClick={() => setBusca('')} title="Limpar pesquisa"
            style={{ position: 'absolute', right: 8, background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', display: 'flex', padding: 0 }}
          ><X size={14} /></button>
        )}
      </div>
    </div>
  );

  /* CAPAS DOS CARTÕES — um jogo entre dois adversários aparece no cartão
     de cada um, e os dois cartões ficavam com a mesma imagem. Por isso,
     numa secção:
     1. cada cartão prefere um vídeo que ainda não seja capa de outro
        (uma equipa com vários jogos mostra um diferente);
     2. se o cartão partilha jogos com cartões anteriores (as duas
        equipas do mesmo jogo), usa OUTRA imagem: o YouTube gera três
        fotogramas automáticos de cada vídeo (a cerca de 1/4, 1/2 e 3/4),
        em `hq1`, `hq2` e `hq3`. O primeiro cartão fica com a capa normal
        (`mqdefault`).
     Se um fotograma não existir, volta à capa normal (onError). */
  const FOTOGRAMAS_CAPA = ['mqdefault', 'hq2', 'hq1', 'hq3'];
  const capasDosCartoes = (grupos) => {
    const usos = {};
    const capas = {};
    const anteriores = []; // conjuntos de vídeos dos cartões já tratados
    grupos.forEach(g => {
      const completos = g.itens.filter(v => !ehClipe(v) && v.youtubeId);
      const candidatos = completos.length ? completos : g.itens.filter(v => v.youtubeId);
      const meus = new Set(candidatos.map(v => v.youtubeId));
      if (!candidatos.length) { anteriores.push(meus); return; }
      const livre = candidatos.find(v => !usos[v.youtubeId]);
      const escolhido = livre || [...candidatos].sort((a, b) => (usos[a.youtubeId] || 0) - (usos[b.youtubeId] || 0))[0];
      usos[escolhido.youtubeId] = (usos[escolhido.youtubeId] || 0) + 1;
      /* As duas partes do mesmo jogo são vídeos diferentes mas com a
         mesma câmara — as capas ficavam iguais na mesma. Por isso o
         fotograma conta quantos cartões anteriores partilham vídeos com
         este (as mesmas equipas, os mesmos jogos). */
      const partilhados = anteriores.filter(c => [...meus].some(id => c.has(id))).length;
      anteriores.push(meus);
      capas[g.key] = { youtubeId: escolhido.youtubeId, fotograma: FOTOGRAMAS_CAPA[partilhados % FOTOGRAMAS_CAPA.length] };
    });
    return capas;
  };

  const miniatura = (g, capa) => {
    const comImagem = capa
      || (() => { const v = g.itens.find(x => !ehClipe(x) && x.youtubeId) || g.itens.find(x => x.youtubeId); return v ? { youtubeId: v.youtubeId, fotograma: 'mqdefault' } : null; })();
    return comImagem ? (
      <img
        src={`https://img.youtube.com/vi/${comImagem.youtubeId}/${comImagem.fotograma}.jpg`}
        onError={e => {
          const alvo = `https://img.youtube.com/vi/${comImagem.youtubeId}/mqdefault.jpg`;
          if (e.currentTarget.src !== alvo) e.currentTarget.src = alvo;
        }}
        alt="" style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block', background: '#000' }}
      />
    ) : (() => {
      /* Sem vídeo do YouTube (ex.: só cortes vindos da Análise de Vídeo,
         que são MP4 guardados na app): usa a miniatura de um desses cortes. */
      const comThumb = g.itens.find(x => !ehClipe(x) && x.thumbUrl) || g.itens.find(x => x.thumbUrl);
      // Nem miniatura: o primeiro fotograma do próprio MP4 (só os metadados são lidos).
      const comMp4 = !comThumb && (g.itens.find(x => eVideoFicheiroBib(x) && !ehClipe(x)) || g.itens.find(x => x.kind === 'video' && /^https?:/.test(String(x.dataUrl || '')) && !x.youtubeId && !x.storagePath));
      return comThumb ? (
        <img src={comThumb.thumbUrl} alt="" loading="lazy"
          style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block', background: '#000' }} />
      ) : comMp4 ? (
        <video src={`${comMp4.dataUrl}#t=${comMp4.clipNoFicheiro ? (Number(comMp4.clipInicio) || 0) + 0.5 : 0.5}`} muted playsInline preload="metadata"
          style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block', background: '#000', pointerEvents: 'none' }} />
      ) : (
        <div style={{ width: '100%', aspectRatio: '16 / 9', background: T.surfaceRaise, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Play size={22} color={T.mutedDim} />
        </div>
      );
    })();
  };

  const renderCartoesCanal = () => {
    const eJogos = secao === 'jogos';
    const grupos = gruposDaSecao;
    const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
    const capas = capasDosCartoes(grupos);
    return (
      <div>
        {eJogos && criarClipeAtleta ? (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isNarrow ? 150 : 220}px, 1fr))`, gap: 12 }}>
            {/* O PRIMEIRO CARTÃO: os clipes do próprio jogador. */}
            <button onClick={() => abrirSecao('meus')} style={{
              textAlign: 'left', padding: 0, cursor: 'pointer', overflow: 'hidden', ...body,
              background: T.surface, border: `1px solid ${T.gold}`, borderRadius: 10, display: 'flex', flexDirection: 'column',
            }}>
              {/* A CAPA: os teus próprios lances, em leque, como cromos
                  na mão — os últimos três clipes que fizeste. */}
              <div style={{
                aspectRatio: '16 / 9', position: 'relative', overflow: 'hidden',
                background: 'radial-gradient(120% 90% at 50% 100%, #3a2a12 0%, #1d2a22 70%)',
              }}>
                {itensMeus.length === 0 ? (
                  <div style={{ position: 'absolute', inset: '18% 28%', border: `1.5px dashed ${T.gold}88`, borderRadius: 8, display: 'grid', placeItems: 'center' }}>
                    <Plus size={20} color={T.gold} />
                  </div>
                ) : [...itensMeus].slice(-3).map((c, j, arr) => {
                  const pos = arr.length === 1 ? [0] : arr.length === 2 ? [-1, 1] : [-1, 0, 1];
                  const p = pos[j];
                  const estiloCarta = {
                    position: 'absolute', width: '52%', aspectRatio: '16 / 9', objectFit: 'cover', left: '24%', top: '20%',
                    borderRadius: 6, border: '2px solid #fff', boxShadow: '0 6px 14px rgba(0,0,0,.45)', background: '#000',
                    transform: `translateX(${p * 34}%) translateY(${Math.abs(p) * 7}%) rotate(${p * 9}deg)`,
                    zIndex: p === 0 || arr.length < 3 ? 2 + j : 1,
                  };
                  if (!c.youtubeId && c.dataUrl) {
                    return <video key={c.id} src={`${c.dataUrl}#t=${(Number(c.clipInicio) || 0) + 0.5}`} muted playsInline preload="metadata" style={{ ...estiloCarta, pointerEvents: 'none' }} />;
                  }
                  return (
                    <img key={c.id} alt="" src={`https://img.youtube.com/vi/${c.youtubeId}/mqdefault.jpg`}
                      style={{
                        position: 'absolute', width: '52%', aspectRatio: '16 / 9', objectFit: 'cover', left: '24%', top: '20%',
                        borderRadius: 6, border: '2px solid #fff', boxShadow: '0 6px 14px rgba(0,0,0,.45)', background: '#000',
                        transform: `translateX(${p * 34}%) translateY(${Math.abs(p) * 7}%) rotate(${p * 9}deg)`,
                        zIndex: p === 0 || arr.length < 3 ? 2 + j : 1,
                      }} />
                  );
                })}
                {itensMeus.length > 0 && (
                  <span style={{ position: 'absolute', right: 8, top: 8, zIndex: 5, background: T.gold, color: TEXT_ON_ACCENT, borderRadius: 12, padding: '1px 8px', fontSize: 12, fontWeight: 700, ...mono }}>{itensMeus.length}</span>
                )}
              </div>
              <div style={{ padding: '9px 11px 11px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ fontSize: 13.5, color: T.cream, fontWeight: 600 }}>Os meus clipes</div>
                <div style={{ fontSize: 11.5, color: T.mutedDim }}>
                  {itensMeus.length ? `${itensMeus.length} ${itensMeus.length === 1 ? 'clipe' : 'clipes'}` : 'Abre um jogo e carrega em "Criar clipe"'}
                </div>
              </div>
            </button>
            {grupos.map(g => (
              <button key={g.key} onClick={() => abrirGrupo(g.key)} style={{
                textAlign: 'left', padding: 0, cursor: 'pointer', overflow: 'hidden', ...body,
                background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, display: 'flex', flexDirection: 'column',
              }}>
                {miniatura(g, capas[g.key])}
                <div style={{ padding: '9px 11px 11px', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 11, color: T.warn, ...mono }}>{g.titulo}</span>
                    {g.resultado && <span style={{ fontSize: 11.5, color: T.cream, ...mono }}>{g.resultado}</span>}
                  </div>
                  <div style={{ fontSize: 13.5, color: T.cream, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.adversario || 'Jogo'}</div>
                  <div style={{ fontSize: 11.5, color: T.mutedDim }}>{plural(g.completos, 'vídeo', 'vídeos')} · {plural(g.cortes, 'corte', 'cortes')}</div>
                </div>
              </button>
            ))}
          </div>
        ) : grupos.length === 0 ? (
          <EmptyState
            text={eJogos
              ? (soLeitura ? 'Ainda sem jogos.' : 'Ainda sem jogos. Ao adicionar um vídeo, escolhe "Jogo da equipa" e indica a jornada.')
              : (soLeitura ? 'Ainda sem jogos de adversários.' : 'Ainda sem jogos de adversários. Ao adicionar um vídeo, escolhe "Jogo de adversário".')}
            action={soLeitura ? null : <Btn onClick={() => setModal('new')}><Plus size={15} /> Adicionar vídeo</Btn>}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isNarrow ? 150 : 220}px, 1fr))`, gap: 12 }}>
            {grupos.map(g => (
              <button
                key={g.key}
                onClick={() => abrirGrupo(g.key)}
                style={{
                  textAlign: 'left', padding: 0, cursor: 'pointer', overflow: 'hidden', ...body,
                  background: T.surface, border: `1px solid ${g.key === 'sem' ? T.warn : T.line}`, borderRadius: 10,
                  display: 'flex', flexDirection: 'column',
                }}
              >
                {miniatura(g, capas[g.key])}
                <div style={{ padding: '9px 11px 11px', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  {eJogos ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 11, color: T.warn, ...mono }}>{g.titulo}</span>
                        {g.resultado && <span style={{ fontSize: 11.5, color: T.cream, ...mono }}>{g.resultado}</span>}
                      </div>
                      <div style={{ fontSize: 13.5, color: T.cream, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.adversario || 'Jogo'}
                      </div>
                      <div style={{ fontSize: 11.5, color: T.mutedDim }}>
                        {plural(g.completos, 'vídeo', 'vídeos')} · {plural(g.cortes, 'corte', 'cortes')}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 13.5, color: g.key === 'sem' ? T.warn : T.cream, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.titulo}
                      </div>
                      {!soLeitura && g.key !== 'sem' && (
                        <div style={{ fontSize: 11, color: g.ficha ? T.mutedDim : T.warn }}>
                          {g.ficha
                            ? (semAcentos(g.ficha.nome) !== semAcentos(g.nome) ? `Ficha: ${g.ficha.nome}` : ([g.ficha.escalao, g.ficha.prova].filter(Boolean).join(' · ') || 'Com ficha'))
                            : 'A criar ficha…'}
                        </div>
                      )}
                      <div style={{ fontSize: 11.5, color: T.mutedDim }}>
                        {g.key === 'sem'
                          ? `${plural(g.completos, 'vídeo', 'vídeos')} sem equipas definidas`
                          : `${plural(g.jogos, 'jogo', 'jogos')}${!soLeitura && g.ficha ? ` · ${plural(g.cortesNaFicha, 'corte', 'cortes')} na ficha` : ''}`}
                      </div>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Cortes antigos, feitos antes de os cortes irem para a ficha, que
  // ainda estão no Canal: passam todos para a ficha da equipa do cartão.
  const moverCortesParaFicha = (g) => {
    if (!g || !g.ficha) return;
    const cortes = g.itens.filter(v => ehClipe(v) && !v.adversarioId);
    if (!cortes.length) return;
    const orig = {};
    cortes.forEach(v => { orig[v.id] = v; });
    setItems(prev => prev.map(v => (orig[v.id]
      ? { ...v, adversarioId: g.ficha.id, pasta: '', categoria: undefined, equipa: g.nome }
      : v)));
    offerUndo(`${cortes.length} ${cortes.length === 1 ? 'corte gravado' : 'cortes gravados'} na ficha do adversário (${g.ficha.nome}).`, () => {
      if (setTodosVideos) setTodosVideos(prev => prev.map(v => orig[v.id] || v));
    });
  };

  const renderMigalhas = () => {
    const g = grupoAtual;
    const eJogos = secao === 'jogos';
    const titulo = eJogos
      ? [g.titulo, g.adversario, g.resultado].filter(Boolean).join(' · ')
      : g.titulo;
    const btnIcone = {
      background: 'none', border: `1px solid ${T.line}`, borderRadius: 8, color: T.cream,
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 8px',
    };
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => { setGrupo(null); setSequencia(null); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: `1px solid ${T.line}`,
              borderRadius: 8, color: T.cream, padding: '6px 11px', cursor: 'pointer', ...body, fontSize: 12.5,
            }}
          ><ChevronLeft size={14} /> {eJogos ? 'Jogos' : 'Adversários'}</button>
          <div style={{ fontSize: 15, color: T.cream, fontWeight: 600, minWidth: 0, flex: 1 }}>{titulo}</div>
          {!eJogos && !soLeitura && g.ficha && g.cortesCanal > 0 && (
            <Btn variant="ghost" onClick={() => moverCortesParaFicha(g)}>
              <Scissors size={14} /> Mover {g.cortesCanal} {g.cortesCanal === 1 ? 'corte' : 'cortes'} para a ficha
            </Btn>
          )}
          {/* O botão "Ver cortes em seguida" passou para junto da secção
             dos cortes (na lista). Aqui em cima fica só o controlo da
             sequência enquanto ela está a correr. */}
          {/* O "Clipe X de N" e o ⏮ ⏭ estão na barra de cima do leitor
              (como na Análise). Aqui não aparece nada a meio — isto fazia
              a página mexer ao começar "Ver cortes em seguida". */}
        </div>
        {!eJogos && !soLeitura && (
          <div style={{ fontSize: 12, color: T.mutedDim, marginTop: 8 }}>
            {g.key === 'sem'
              ? 'Estes vídeos ainda não têm as equipas definidas — edita o vídeo (lápis) ou define-as ao gravar o primeiro corte.'
              : g.ficha
                ? `Os cortes sobre ${g.nome} vão para a ficha dele (${g.cortesNaFicha} já lá ${g.cortesNaFicha === 1 ? 'está' : 'estão'}).`
                : `A ficha de ${g.nome} está a ser criada em Scouting › Adversários.`}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Gravação de clipes de vídeos carregados: progresso e resultado
          (fora do leitor, porque não é preciso estar nada aberto). */}
      {progressoFicheiro != null && gravacaoBib && (
        <Modal title="A preparar o vídeo" onClose={() => { if (gravacaoBibRef.current) acabarGravacaoBib(); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: T.muted }}>Só o vídeo, sem o ecrã à volta. Demora o tempo dos clipes; não feches esta página.</div>
            <div style={{ height: 8, borderRadius: 4, background: T.line, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.round(progressoFicheiro * 100)}%`, background: T.gold, transition: 'width .2s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: T.mutedDim, ...mono }}>{Math.round(progressoFicheiro * 100)}%</span>
              <Btn variant="ghost" onClick={() => { if (gravacaoBibRef.current) acabarGravacaoBib(); }}>Parar e ficar com o que já está</Btn>
            </div>
          </div>
        </Modal>
      )}
      {janelaGravacaoBib && janelaGravacaoBib.fase === 'pronto' && janelaGravacaoBib.ficheiro && (
        <Modal title="Vídeo pronto" onClose={fecharJanelaGravacaoBib} wide>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <video src={janelaGravacaoBib.url} controls playsInline style={{ width: '100%', borderRadius: 8, background: '#000', maxHeight: '55vh' }} />
            <div style={{ fontSize: 12, color: T.mutedDim }}>
              {/mp4/.test(janelaGravacaoBib.blob.type) ? 'MP4' : 'WebM'} · {(janelaGravacaoBib.blob.size / 1048576).toFixed(1)} MB
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Btn variant="ghost" onClick={fecharJanelaGravacaoBib}>Fechar</Btn>
              <Btn variant="ghost" onClick={() => entregarVideo(janelaGravacaoBib.blob, janelaGravacaoBib.nome, { soDescarregar: true })}><Download size={14} /> Descarregar</Btn>
              <Btn onClick={() => entregarVideo(janelaGravacaoBib.blob, janelaGravacaoBib.nome)}><Share2 size={14} /> Partilhar vídeo</Btn>
            </div>
          </div>
        </Modal>
      )}
      {avisoGravacaoBib && !temLeitorBib(active) && (
        <div role="status" style={{ marginBottom: 10, fontSize: 12.5, color: T.warn }}>{avisoGravacaoBib}</div>
      )}
      {!semBotaoTopo && (
        <SectionHeader action={<Btn variant={addButtonVariant} onClick={() => setModal('new')}><Plus size={15} /> {addLabel}</Btn>} />
      )}

      {/* PASTAS — filtro por pasta. As pastas criam-se ao escrever o nome
          no campo "Pasta" ao adicionar ou editar um item. `semCatalogo`
          desliga isto: quando os vídeos já vivem à parte de um único
          adversário (ou outro contexto próprio), não há nada para
          catalogar — são sempre só os vídeos dele. */}
      {modoCanal && items.length > 0 && renderSecoesCanal()}

      {!semCatalogo && items.length > 0 && (!modoCanal || (secao === 'temas' && !termo)) && (folders.length > 0 || countIn(NO_FOLDER) > 0) && (
        /* No telemóvel os separadores das pastas ficam numa faixa única que
           desliza na horizontal, em vez de se partirem em três linhas
           desalinhadas que empurravam o conteúdo todo para baixo. A faixa
           sangra até às margens do ecrã (margens negativas) para se
           perceber que continua para lá do que se vê. */
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16,
          ...(isNarrow
            /* Telemóvel: faixa FIXA, sem deslizar. Os separadores cabem
               todos numa linha; se faltar espaço, encolhe o nome (com
               reticências) e o número fica sempre visível. */
            ? { flexWrap: 'nowrap', overflow: 'hidden', gap: 6 }
            : { flexWrap: 'wrap' }),
        }}>
          {!modoCanal && (
          <button onClick={() => setFolderFilter(null)} style={{
            padding: '6px 12px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', ...body,
            flexShrink: 0, whiteSpace: 'nowrap',
            background: folderFilter === null ? '#B5393F' : 'transparent',
            color: folderFilter === null ? TEXT_ON_ACCENT : T.muted,
            border: `1px solid ${folderFilter === null ? '#B5393F' : T.line}`,
          }}>Tudo ({items.length})</button>
          )}

          {folders.map(name => {
            const on = pastaTema === name;
            if (renaming === name) {
              return (
                <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') applyRename(); if (e.key === 'Escape') setRenaming(null); }}
                    style={{
                      padding: '5px 10px', borderRadius: 20, fontSize: 12.5, ...body,
                      border: `1px solid ${T.gold}`, background: T.surfaceRaise, color: T.cream, outline: 'none', width: 150,
                    }}
                  />
                  <button onClick={applyRename} title="Guardar nome" style={{ background: 'none', border: 'none', color: T.warn, cursor: 'pointer' }}><Check size={14} /></button>
                  <button onClick={() => setRenaming(null)} title="Cancelar" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer' }}><X size={14} /></button>
                </span>
              );
            }
            return (
              <button key={name} type="button" onClick={() => setFolderFilter(on && !modoCanal ? null : name)} style={{
                padding: isNarrow ? '6px 10px' : '6px 12px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', ...body,
                flexShrink: isNarrow ? 1 : 0, minWidth: 0, whiteSpace: 'nowrap', display: 'inline-flex', gap: 4,
                background: on ? '#B5393F' : 'transparent',
                color: on ? TEXT_ON_ACCENT : T.muted,
                border: `1px solid ${on ? '#B5393F' : T.line}`,
              }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{name}</span><span style={{ flexShrink: 0 }}>({countIn(name)})</span></button>
            );
          })}

          {countIn(NO_FOLDER) > 0 && folders.length > 0 && (
            <button onClick={() => setFolderFilter(pastaTema === NO_FOLDER && !modoCanal ? null : NO_FOLDER)} style={{
              padding: isNarrow ? '6px 10px' : '6px 12px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', ...body,
              flexShrink: isNarrow ? 1 : 0, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              background: pastaTema === NO_FOLDER ? '#B5393F' : 'transparent',
              color: pastaTema === NO_FOLDER ? TEXT_ON_ACCENT : T.muted,
              border: `1px solid ${pastaTema === NO_FOLDER ? '#B5393F' : T.line}`,
            }}>Sem pasta ({countIn(NO_FOLDER)})</button>
          )}

          {/* AÇÕES DA PASTA ESCOLHIDA (mudar o nome, desfazer): ficam no fim
              da fila, fora dos separadores. Assim os separadores têm sempre
              o mesmo tamanho, compacto, e nada mexe quando se clica. */}
          {!soLeitura && !renaming && pastaTema && pastaTema !== NO_FOLDER && folders.includes(pastaTema) && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0, marginLeft: 2 }}>
              <button onClick={() => { setRenaming(pastaTema); setRenameValue(pastaTema); }} title={`Mudar o nome da pasta «${pastaTema}»`} aria-label="Mudar o nome da pasta"
                style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', display: 'flex', padding: 5, borderRadius: 6 }}><Pencil size={13} /></button>
              <button onClick={() => dissolveFolder(pastaTema)} title={`Desfazer a pasta «${pastaTema}» (os itens ficam sem pasta)`} aria-label="Desfazer a pasta"
                style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', display: 'flex', padding: 5, borderRadius: 6 }}><X size={14} /></button>
            </span>
          )}
        </div>
      )}

      {modoCanal && !termo && grupoAtual && renderMigalhas()}
      {modoCanal && !termo && secao === 'meus' && (
        <button type="button" onClick={() => abrirSecao('jogos')} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12, background: 'none', border: 'none',
          color: T.muted, cursor: 'pointer', fontSize: 13, padding: 0, ...body,
        }}><ChevronLeft size={15} /> Jogos <span style={{ color: T.mutedDim }}>·</span> <span style={{ color: T.cream }}>Os meus clipes</span></button>
      )}
      {/* OS MEUS VÍDEOS — o jogador junta clipes seus (do mesmo jogo ou
          de jogos diferentes) num vídeo e vê-os todos seguidos. */}
      {modoCanal && !termo && secao === 'meus' && chaveCompilacoes && itensMeus.length > 0 && (
        <CompilacoesAtleta
          clipes={itensMeus} chave={chaveCompilacoes} api={compilacoesApi}
          aTocar={sequencia} aGravar={!!gravacaoBib}
          aberto={compAtiva && compAtiva.id}
          onAbrir={(v) => {
            setSequencia(null);
            // Abre no lugar do leitor SEM mexer na página (antes deslizava
            // até ao leitor — o jogador perdia o sítio onde estava).
            setCompAtiva(v);
          }}
          onFecharAberto={() => setCompAtiva(null)}
          onVer={(ids) => { if (!ids.length) return; setSequencia(ids); setActiveId(ids[0]); }}
          onParar={() => setSequencia(null)}
          onGravar={podeGravarSeparador() ? (ids, nome) => gravarSequenciaBib(ids, nome) : null}
        />
      )}

      {/* TROCAR DE SEPARADOR SEM SOLAVANCOS: os cartões de Jogos (deitados)
          e os de Temas/listas têm alturas muito diferentes — a página
          encolhia e saltava. A área guarda a altura que tinha durante a
          troca (só cresce até a nova vista assentar) e a vista nova entra
          num fade curto. */}
      <div key={`${secao}|${grupo || ''}|${termo ? 'p' : ''}`} ref={vistaBibRef} style={{ minHeight: alturaVistaBib || undefined, animation: 'mjpEntrar .18s ease-out' }}>
      {items.length === 0 ? (
        <EmptyState text={emptyText} action={soLeitura ? null : <Btn onClick={() => setModal('new')}><Plus size={15} /> {emptyFirstLabel}</Btn>} />
      ) : modoCanal && !termo && secao !== 'temas' && secao !== 'meus' && !grupoAtual ? (
        renderCartoesCanal()
      ) : visibleItems.length === 0 && !termo ? (
        modoCanal && secao === 'meus'
          ? <EmptyState text={`Ainda não criaste clipes. Abre um jogo em Jogos, carrega em "Criar clipe" e marca o lance (até ${MAX_CLIPE_ATLETA_SEG / 60} minutos).`} />
          : modoCanal
          ? <EmptyState text="Ainda sem vídeos em Temas." action={soLeitura ? null : <Btn onClick={() => setModal('new')}><Plus size={15} /> Adicionar vídeo</Btn>} />
          : <EmptyState text="Esta pasta está vazia." action={<Btn variant="ghost" onClick={() => setFolderFilter(null)}>Ver tudo</Btn>} />
      ) : modoFeed ? (
        /* Largura de leitura, como numa rede social: em ecrã largo um vídeo
           a ocupar 1400 px não se vê melhor, vê-se pior — obriga a mover a
           cabeça e só cabe um por ecrã. 560 px é a medida a que estas
           aplicações assentaram. */
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <Btn variant="ghost" onClick={() => setModoFeed(false)}><LayoutGrid size={14} /> Voltar ao visualizador</Btn>
            <span style={{ ...mono, fontSize: 11.5, color: T.mutedDim }}>
              {visibleItems.length} {visibleItems.length === 1 ? 'ficheiro' : 'ficheiros'}
            </span>
          </div>
          {visibleItems.length === 0 ? (
            <div style={{ fontSize: 12.5, color: T.mutedDim, padding: '10px 2px' }}>Nada encontrado para "{busca}".</div>
          ) : visibleItems.map(v => (
            <MediaFeedItem
              key={v.id}
              item={v}
              onOpen={(it) => { setActiveId(it.id); setModoFeed(false); }}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          <div ref={leitorColunaRef}>
            {/* Portal: "Os meus vídeos" abre AQUI, no lugar do leitor dos
                clipes — os clipes todos num só, com uma barra. */}
            {compAtiva && (
              <LeitorJunto key={compAtiva.id} titulo={compAtiva.nome} segmentos={compAtiva.segmentos} isNarrow={isNarrow} onFechar={() => setCompAtiva(null)} />
            )}
            {!compAtiva && active && (
              <>
                {temLeitorBib(active) ? (
                  // Toca sempre diretamente na caixa (tal como um vídeo
                  // local ou um PDF) em vez de mostrar só uma miniatura
                  // que obriga a um clique extra para abrir a janela
                  // ampliada — essa janela continua disponível através do
                  // botão "Ecrã inteiro" abaixo, para quem quiser um ecrã
                  // maior, mas já não é preciso para simplesmente ver o vídeo.
                  <>
                  <div
                    ref={ytBoxRef}
                    style={{
                      position: 'relative', overflow: 'hidden', background: '#000', display: 'flex', flexDirection: 'column',
                      ...(ytFull
                        ? {
                            // Em ecrã inteiro a caixa ocupa tudo: vídeo em
                            // cima (a crescer), barras em baixo.
                            width: '100%', height: '100%', borderRadius: 0, border: 'none',
                            ...(ytFull === 'css' ? {
                              position: 'fixed', inset: 0, zIndex: 80, width: '100vw', height: '100dvh',
                              paddingBottom: 'env(safe-area-inset-bottom, 0px)', boxSizing: 'border-box',
                            } : {}),
                          }
                        : { borderRadius: 10, border: `1px solid ${T.line}` }),
                    }}
                  >
                    {/* BARRA DE CIMA DO CLIPE — a mesma do leitor da Análise
                        individual em clipes: "Clipe X de N · título ·
                        início–fim (duração)" e ⏮ ⏭. Fica também em ecrã
                        inteiro. Só nos clipes que estão numa lista. */}
                    {/* Sempre presente (jogo completo, clipe sozinho ou numa
                        lista), com a mesma altura: trocar de jogo completo para
                        um corte já não muda o tamanho da caixa. */}
                    {!isBlocked && (() => {
                      const { lista, i } = ativoEClipe ? seguinteNaSala(active.id) : { lista: [], i: -1 };
                      const emLista = ativoEClipe && i >= 0 && lista.length >= 2;
                      const irPara = (id) => {
                        if (!id) return;
                        setFimCorte(null);
                        // Só se diz "a tocar" quando o destino é um corte do MESMO
                        // vídeo (o leitor é o mesmo e continua). Para um jogo
                        // completo/outro vídeo abre um leitor novo, parado — antes
                        // ficava marcado "a tocar" e o 1.º toque no play mandava
                        // PAUSAR (em ecrã inteiro não arrancava).
                        const alvo = (items || []).find(v => v.id === id);
                        const mesmoLeitor = !!(alvo && ehClipe(alvo) && temLeitorBib(alvo) && temLeitorBib(active) && fonteBib(active) === fonteBib(alvo) && ativoEClipe);
                        ytATocarRef.current = mesmoLeitor;
                        // Leitor novo (outro vídeo, ou de/para jogo completo):
                        // abre já a tocar.
                        if (!mesmoLeitor) autoplayIdRef.current = id;
                        setActiveId(id);
                      };
                      // Nos cortes, ⏮ ⏭ andam entre os cortes (ou a sequência);
                      // no jogo completo, entre tudo o que está na lista do jogo
                      // (outra parte do jogo, os cortes…).
                      // Jogo completo e clipes são coisas diferentes: no jogo
                      // completo, ⏮ ⏭ andam SÓ entre as partes do jogo.
                      const navLista = emLista ? lista : navegaveisDoGrupo.filter(v => !ehClipe(v)).map(v => v.id);
                      const iNav = navLista.indexOf(active.id);
                      const temNav = iNav >= 0 && navLista.length >= 2;
                      const btnTopo = { padding: '6px 10px' };
                      return (
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                          padding: '8px 12px', background: T.surface, borderBottom: `1px solid ${T.line}`, flexShrink: 0,
                        }}>
                          <span style={{ fontSize: 12.5, color: T.muted, ...body, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ativoEClipe ? (
                              <>
                                {emLista && <strong style={{ color: T.gold, fontWeight: 700 }}>Clipe {i + 1} de {lista.length} · </strong>}
                                {active.title || 'Clipe'} · {fmtMMSS(clipIni)}–{fmtMMSS(clipFimEf)} ({Math.round(clipFimEf - clipIni)}s)
                              </>
                            ) : (
                              <>
                                <strong style={{ color: T.gold, fontWeight: 700 }}>Jogo completo · </strong>
                                {active.title || 'Vídeo'}{duracaoJogo ? ` · ${fmtMMSS(duracaoJogo)}` : ''}
                              </>
                            )}
                          </span>
                          {/* Os botões ocupam sempre o mesmo espaço (escondidos
                              quando não há lista), para a barra não mudar. */}
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0, visibility: temNav ? 'visible' : 'hidden' }}>
                            <Btn escuro variant="ghost" onClick={() => irPara(navLista[iNav - 1])} disabled={iNav <= 0} style={btnTopo} title={emLista ? 'Clipe anterior' : 'Anterior'}><SkipBack size={14} /></Btn>
                            <Btn escuro variant="ghost" onClick={() => irPara(navLista[iNav + 1])} disabled={iNav >= navLista.length - 1} style={btnTopo} title={emLista ? 'Clipe seguinte' : 'Seguinte'}><SkipForward size={14} /></Btn>
                          </div>
                        </div>
                      );
                    })()}
                    {/* A estrutura é SEMPRE a mesma dentro e fora do ecrã
                        inteiro — só mudam as medidas — para o React nunca
                        voltar a montar o iframe (o vídeo recomeçaria). */}
                    <div ref={areaVideoBibRef} onWheel={ytFull && !modoDesenhoBib && ativoEClipe ? lupaBib.aoRodar : undefined} style={{
                      ...(ytFull
                        ? { position: 'relative', flex: 1, minHeight: 0 }
                        : { position: 'relative', paddingTop: '56.25%' }),
                      overflow: 'hidden',
                    }}>
                      {/* ZOOM DO CÍRCULO — só o vídeo e os desenhos se
                          aproximam (ver `zoomBib`); as barras de ferramentas,
                          menus e botões ficam fora, no sítio de sempre. Esta
                          caixa existe sempre (com ou sem zoom), para o iframe
                          nunca ser remontado. */}
                      <div style={{
                        position: 'absolute', inset: 0,
                        // Mais fluido: camada própria na placa gráfica
                        // (will-change + translate3d), entrada longa e suave a
                        // desacelerar, saída suave nos dois extremos.
                        // Com a LUPA (ecrã inteiro) manda a lupa; senão, o zoom dos círculos.
                        transform: zoomVisivelBib ? `translate3d(0,0,0) scale(${zoomVisivelBib})` : (lupaBib.transform || 'translate3d(0,0,0) scale(1)'),
                        transformOrigin: !zoomVisivelBib && lupaBib.transform ? '0 0' : zoomOrigemBib.current,
                        // Entrada suave; saída suave (ou imediata num corte brusco).
                        transition: zoomVisivelBib
                          ? 'transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)'
                          : lupaBib.transform
                            ? (lupaBib.aArrastar ? 'none' : 'transform 0.2s ease-out')
                            : (saidaSuaveZoomRef.current ? 'transform 0.75s cubic-bezier(0.65, 0, 0.35, 1)' : 'none'),
                        willChange: 'transform',
                      }}>
                      {isBlocked ? (
                        <div style={{
                          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 10,
                          alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center',
                        }}>
                          <div style={{ color: T.bad, fontSize: 13, fontWeight: 500 }}>
                            {isBlocked === 'embed_disabled'
                              ? 'Este vídeo não permite reprodução incorporada — o dono do canal bloqueou-a.'
                              : 'Não foi possível carregar este vídeo (pode ter sido removido ou estar privado).'}
                          </div>
                          <a
                            href={`https://www.youtube.com/watch?v=${active.youtubeId}`}
                            target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: T.warn, textDecoration: 'none' }}
                          >
                            <ExternalLink size={13} /> Abrir no YouTube
                          </a>
                        </div>
                      ) : !active.youtubeId ? (
                        /* VÍDEO CARREGADO: um <video> no lugar do iframe, sem
                           controlos nativos (manda a barra própria, como no
                           YouTube). A mesma chave de `leitorBib`: entre cortes
                           do mesmo ficheiro não recarrega. Os eventos do vídeo
                           fazem o papel das mensagens do YouTube. */
                        <video
                          key={leitorBib ? leitorBib.chave : active.id}
                          ref={inlineVideoRef}
                          src={leitorBib ? leitorBib.src : active.dataUrl}
                          playsInline preload="auto"
                          onLoadedMetadata={(e) => {
                            const vid = e.currentTarget;
                            if (vid.duration > 0) setDuracaoJogo(vid.duration);
                            if (ativoEClipe && vid.currentTime < clipIni) vid.currentTime = clipIni;
                            if (tocarAoCarregarRef.current === active.id) {
                              tocarAoCarregarRef.current = null;
                              const pr = vid.play(); if (pr && pr.catch) pr.catch(() => {});
                            }
                          }}
                          onTimeUpdate={(e) => infoDoVideoBib(e.currentTarget)}
                          onSeeked={(e) => infoDoVideoBib(e.currentTarget)}
                          onPlay={() => setYtATocar(true)}
                          onPause={() => setYtATocar(false)}
                          onEnded={() => setYtATocar(false)}
                          onClick={() => { if (ativoEClipe) alternarReproducaoBib(); else enviarComandoYoutube(ytATocarRef.current ? 'pauseVideo' : 'playVideo'); }}
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#000', objectFit: 'contain', cursor: 'pointer' }}
                        />
                      ) : (
                        <iframe
                          // Chave e endereço vêm de `leitorBib`: entre cortes do
                          // MESMO jogo o leitor não é recarregado (salta-se
                          // dentro dele) — acabou o ecrã preto de ~4s a cada
                          // troca de corte.
                          key={leitorBib ? leitorBib.chave : active.id}
                          ref={inlineIframeRef}
                          onLoad={handleIframeLoad(inlineIframeRef)}
                          // fs=0: sem o ecrã inteiro nativo do YouTube — o
                          // nosso (botão abaixo) mantém o Criar clipe e a
                          // barra do clipe à mão.
                          src={leitorBib ? leitorBib.src : youtubeEmbedSrc(active, 'enablejsapi=1&fs=0')}
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          referrerPolicy="strict-origin-when-cross-origin"
                          title={active.title}
                        />
                      )}
                      {/* Fim do corte: Repetir / Corte seguinte (como na
                          Análise individual em clipes). */}
                      {!isBlocked && ativoEClipe && fimCorte === active.id && (() => {
                        const { lista, i, seguinteId } = seguinteNaSala(active.id);
                        const repetir = () => {
                          setFimCorte(null);
                          enviarComandoYoutube('seekTo', [clipIni, true]);
                          enviarComandoYoutube('playVideo');
                          tempoAnteriorClipeRef.current = clipIni;
                        };
                        const seguinte = () => {
                          if (!seguinteId) return;
                          setFimCorte(null);
                          // O corte seguinte arranca já a tocar (mesmo leitor).
                          ytATocarRef.current = true;
                          setActiveId(seguinteId);
                        };
                        // Igual ao leitor da Análise individual em clipes.
                        return (
                          <FimDoClipe onRepetir={repetir} onSeguinte={seguinteId ? seguinte : null} />
                        );
                      })()}
                      {/* Zonas laterais do toque duplo (±10 s) — só nos vídeos
                          completos; deixam livres o centro, o topo (título,
                          definições) e TODA a metade de baixo (barra do
                          YouTube e a faixa onde ela aparece ao passar o rato). */}
                      {!isBlocked && !modoDesenhoBib && <style>{'@keyframes mjp-salto { 0% { opacity: 0; transform: translateY(-50%) scale(.85); } 20% { opacity: 1; transform: translateY(-50%) scale(1); } 100% { opacity: 0; } }'}</style>}
                      {!isBlocked && !modoDesenhoBib && [-1, 1].map(lado => (
                        <div key={lado} aria-hidden="true" onClick={() => tocarLadoBib(lado)}
                          onDoubleClick={e => e.preventDefault()}
                          onPointerEnter={e => { if (e.pointerType === 'mouse' && e.buttons) desligarZonasLado(); }}
                          onPointerMove={e => { if (e.pointerType === 'mouse' && e.buttons) desligarZonasLado(); }}
                          style={{
                            position: 'absolute', top: '12%', bottom: '42%', [lado < 0 ? 'left' : 'right']: 0, width: '25%',
                            pointerEvents: zonasLadoOff ? 'none' : 'auto',
                            zIndex: 2, cursor: 'pointer', touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none',
                            WebkitTapHighlightColor: 'transparent',
                          }}>
                          {saltoBib && saltoBib.lado === lado && (
                            <div key={saltoBib.k} style={{
                              position: 'absolute', top: '50%', [lado < 0 ? 'left' : 'right']: '18%', transform: 'translateY(-50%)',
                              background: 'rgba(0,0,0,.55)', color: '#fff', borderRadius: 999, padding: '8px 14px',
                              fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none',
                              animation: 'mjp-salto .7s ease-out both',
                            }}>
                              {lado < 0 ? `« ${saltoBib.total} s` : `${saltoBib.total} s »`}
                            </div>
                          )}
                        </div>
                      ))}
                      {clipeGuardadoAviso && (
                        <div role="status" style={{
                          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 6, pointerEvents: 'none',
                          background: 'rgba(0,0,0,.78)', color: '#fff', border: `1px solid ${T.good}`, borderRadius: 999,
                          padding: '6px 14px', fontSize: 12.5, maxWidth: '86%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>✓ {clipeGuardadoAviso} · marca o próximo</div>
                      )}
                      {/* DESENHOS por cima do clipe — só em clipes do YouTube
                         (ver `ativoEClipe`), onde já temos o tempo real do
                         vídeo (`liveTime`). Fora do modo de desenho, só
                         mostra os desenhos da pausa que estiver a segurar o
                         vídeo agora (`pausaAtivaBib`); a desenhar, mostra o
                         rascunho (`shapesRascunho`), que só é gravado a
                         sério ao tocar em "Guardar". */}
                      {ativoEClipe && !isBlocked && (
                        <svg
                          ref={overlayRefBib}
                          viewBox="0 0 100 56.25" preserveAspectRatio="none"
                          style={{
                            position: 'absolute', inset: 0, width: '100%', height: '100%',
                            // SEMPRE a apanhar o rato/dedo nos clipes, mesmo fora do
                            // modo de desenho: se o cursor chegar ao leitor do
                            // YouTube, ele mostra por cima o título e o botão
                            // grande de pausa ao centro (sobretudo ao retomar
                            // depois de uma pausa de desenho). Assim o YouTube
                            // nunca "vê" o rato, e tocar no vídeo reproduz/pausa
                            // através da nossa própria lógica.
                            pointerEvents: 'auto',
                            touchAction: modoDesenhoBib ? 'none' : 'manipulation', // a desenhar, o dedo não pode fazer scroll/zoom
                            // Nada no desenho é selecionável como texto nem
                            // arrastável pelo browser (ver iniciarFormaBib).
                            userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
                            cursor: modoDesenhoBib
                              ? (hoverFormaBib != null && !['apagar', 'zonalivre', 'linhaPontos'].includes(toolBib) ? CURSOR_MOVER_FINO : (toolBib ? CURSOR_MIRA_FINA : 'pointer'))
                              : 'pointer',
                          }}
                          onPointerDown={modoDesenhoBib ? iniciarFormaBib : undefined}
                          onPointerMove={modoDesenhoBib ? moverFormaBib : undefined}
                          onPointerUp={modoDesenhoBib ? terminarFormaBib : undefined}
                          onPointerLeave={modoDesenhoBib ? terminarFormaBib : undefined}
                          onPointerCancel={modoDesenhoBib ? terminarFormaBib : undefined}
                          onLostPointerCapture={modoDesenhoBib ? terminarFormaBib : undefined}
                          onDragStart={e => e.preventDefault()}
                          onClick={modoDesenhoBib ? undefined : alternarReproducaoBib}
                        >
                          {(modoDesenhoBib ? formasDesenhoVisiveisBib : (pausaAtivaBib ? pausaAtivaBib.shapes : []))
                            .map((sh, i) => renderShape(sh, sh.id || i))}
                          {formaEmCursoBib && renderShape(formaEmCursoBib, 'rascunho')}
                          {/* A desenhar: os círculos com zoom levam a etiqueta, para se saber quais são. */}
                          {modoDesenhoBib && !zoomPreviewBib && shapesRascunho.filter(f => f.tool === 'circulo' && Number(f.zoom) > 1 && f.points && f.points[1]).map(f => {
                            const [c, borda] = f.points;
                            const r = Math.hypot(borda.x - c.x, borda.y - c.y);
                            return (
                              <text key={`zoom-${f.id}`} x={c.x + r * 0.72} y={c.y - r * 0.72} fill="#fff" fontSize={2.2} fontWeight={700}
                                style={{ fontFamily: "'Inter', sans-serif", paintOrder: 'stroke', stroke: '#000000aa', strokeWidth: 0.4, pointerEvents: 'none' }}>
                                {String(f.zoom).replace('.', ',')}×
                              </text>
                            );
                          })}
                          {/* DESTAQUE ao passar o rato: moldura tracejada fina à
                             volta da forma que vai ser agarrada — acaba com a
                             dúvida de "qual delas vou mover". */}
                          {modoDesenhoBib && hoverFormaBib != null && hoverFormaBib !== formaSelecionadaBib && shapesRascunho[hoverFormaBib]
                            && !['apagar', 'zonalivre', 'linhaPontos'].includes(toolBib) && (() => {
                              const c = caixaFormaBib(shapesRascunho[hoverFormaBib]);
                              if (!c) return null;
                              const m = 0.8;
                              return (
                                <rect x={c.x - m} y={c.y - m} width={c.w + 2 * m} height={c.h + 2 * m} rx={0.6}
                                  fill="rgba(255,255,255,0.06)" stroke="#fff" strokeOpacity={0.85} strokeWidth={0.15}
                                  strokeDasharray="0.8 0.6" style={{ pointerEvents: 'none' }} />
                              );
                            })()}
                          {/* Pontinhos arrastáveis da forma selecionada — tocar
                             e arrastar um deles move essa ponta da forma. */}
                          {modoDesenhoBib && formaSelecionadaBib != null && shapesRascunho[formaSelecionadaBib] && (() => {
                            const fs = shapesRascunho[formaSelecionadaBib];
                            const zonaRodada = fs.tool === 'retangulo' && fs.rotacao && !fs.chao; // no chão a rotação já vem no desenho
                            const zonaChao = fs.tool === 'retangulo' && fs.chao;
                            const c = fs.tool === 'retangulo' && fs.points[1] ? centroZonaBib(fs) : null;
                            return (
                              <g transform={zonaRodada ? `rotate(${fs.rotacao} ${c.x} ${c.y})` : undefined}>
                              {fs.points.map((ptReal, pi) => { const pt = zonaChao ? pegaZonaNoChao(fs, pi) : ptReal; return (
                                <g key={`vertice-${pi}`}>
                                  <circle cx={pt.x} cy={pt.y} r={0.6} fill={T.crimsonBright} stroke="#fff" strokeWidth={0.15} style={{ pointerEvents: 'none' }} />
                                  {/* Área de toque invisível, bem maior do que o pontinho. */}
                                  <circle cx={pt.x} cy={pt.y} r={RAIO_PEGA_BIB} fill="transparent"
                                    onPointerDown={e => {
                                      e.stopPropagation();
                                      if (e.cancelable) e.preventDefault(); // sem arrasto/seleção nativa do browser
                                      try { overlayRefBib.current && overlayRefBib.current.setPointerCapture(e.pointerId); } catch (err) {}
                                      arrastoVerticeBib.current = null;
                                      arrastoCorpoBib.current = null;
                                      const forma = shapesRascunho[formaSelecionadaBib];
                                      if (pi === 0 && forma && forma.tool === 'circulo') {
                                        // centro do círculo = mover o círculo inteiro
                                        arrastoCorpoBib.current = { indiceForma: formaSelecionadaBib, ultimoPonto: getPontoBib(e), historicoEmpurrado: false };
                                        return;
                                      }
                                      pushHistoricoBib();
                                      arrastoVerticeBib.current = { indiceForma: formaSelecionadaBib, indicePonto: pi };
                                    }}
                                    style={{ cursor: pi === 0 && shapesRascunho[formaSelecionadaBib] && shapesRascunho[formaSelecionadaBib].tool === 'circulo' ? 'move' : 'grab', touchAction: 'none', pointerEvents: 'all' }} />
                                </g>
                              ); })}
                                {/* ZONA: pega de rodar, por cima do centro (como na Análise de Vídeo). */}
                                {fs.tool === 'retangulo' && c && (() => {
                                  // No chão, a pega fica uns metros "à frente" da zona, no relvado.
                                  const rc = zonaChao ? pegaRodarZonaNoChao(fs) : null;
                                  const topo = Math.min(fs.points[0].y, fs.points[1].y);
                                  const base = rc && rc.base ? rc.base : { x: c.x, y: topo };
                                  const pegaP = rc && rc.pega ? rc.pega : { x: c.x, y: topo - 3 };
                                  return (
                                    <g>
                                      <line x1={base.x} y1={base.y} x2={pegaP.x} y2={pegaP.y} stroke="#fff" strokeWidth={0.15} strokeDasharray="0.5 0.4" style={{ pointerEvents: 'none' }} />
                                      <circle cx={pegaP.x} cy={pegaP.y} r={0.75} fill="#fff" stroke={T.crimsonBright} strokeWidth={0.2} style={{ pointerEvents: 'none' }} />
                                      <circle cx={pegaP.x} cy={pegaP.y} r={RAIO_PEGA_BIB} fill="transparent"
                                        onPointerDown={e => {
                                          e.stopPropagation();
                                          if (e.cancelable) e.preventDefault();
                                          try { overlayRefBib.current && overlayRefBib.current.setPointerCapture(e.pointerId); } catch (err) {}
                                          arrastoVerticeBib.current = null;
                                          arrastoCorpoBib.current = null;
                                          pushHistoricoBib();
                                          arrastoRotacaoBib.current = { indiceForma: formaSelecionadaBib };
                                        }}
                                        style={{ cursor: 'grab', touchAction: 'none', pointerEvents: 'all' }} />
                                    </g>
                                  );
                                })()}
                                {/* ZONA: pega de INCLINAR (rodar para cima/baixo), ao lado
                                    direito — arrasta para cima ou para baixo. (No chão não
                                    faz falta: a perspetiva é a verdadeira.) */}
                                {fs.tool === 'retangulo' && c && !zonaChao && (() => {
                                  const [pa, pb] = fs.points;
                                  const direita = Math.max(pa.x, pb.x) + 2.6;
                                  const alturaZona = Math.abs(pb.y - pa.y);
                                  const larguraZona = Math.abs(pb.x - pa.x);
                                  return (
                                    <g>
                                      <rect x={direita - 0.75} y={c.y - 1.6} width={1.5} height={3.2} rx={0.75} fill="#fff" stroke={T.crimsonBright} strokeWidth={0.2} style={{ pointerEvents: 'none' }} />
                                      <path d={`M ${direita - 0.4} ${c.y - 0.6} L ${direita} ${c.y - 1.1} L ${direita + 0.4} ${c.y - 0.6} M ${direita - 0.4} ${c.y + 0.6} L ${direita} ${c.y + 1.1} L ${direita + 0.4} ${c.y + 0.6}`}
                                        fill="none" stroke={T.crimsonBright} strokeWidth={0.18} style={{ pointerEvents: 'none' }} />
                                      <circle cx={direita} cy={c.y} r={RAIO_PEGA_BIB} fill="transparent"
                                        onPointerDown={e => {
                                          e.stopPropagation();
                                          if (e.cancelable) e.preventDefault();
                                          try { overlayRefBib.current && overlayRefBib.current.setPointerCapture(e.pointerId); } catch (err) {}
                                          arrastoVerticeBib.current = null;
                                          arrastoCorpoBib.current = null;
                                          arrastoRotacaoBib.current = null;
                                          pushHistoricoBib();
                                          const inc0 = Number.isFinite(Number(fs.inclinacao)) ? Number(fs.inclinacao) : inclinacaoPadrao(larguraZona, alturaZona);
                                          arrastoInclinacaoBib.current = { indiceForma: formaSelecionadaBib, y0: getPontoBib(e).y, inc0, h: alturaZona };
                                        }}
                                        style={{ cursor: 'ns-resize', touchAction: 'none', pointerEvents: 'all' }} />
                                    </g>
                                  );
                                })()}
                              </g>
                            );
                          })()}
                        </svg>
                      )}
                      </div>
                    {/* LUPA: em ecrã inteiro há SEMPRE uma camada por cima do
                        vídeo que apanha a pinça (para começar o zoom com dois
                        dedos, também a 100%), o arrastar e a roda; um toque
                        pausa/retoma. Nos jogos completos, a 100% deixa livre a
                        faixa de baixo, onde está a barra do próprio YouTube. */}
                    {/* Com o "Repetir / Corte seguinte" no ecrã (fim do corte),
                        esta camada sai: estava POR CIMA dos botões e um toque
                        neles era apanhado aqui como "retomar" — o corte
                        recomeçava em vez de passar ao seguinte. */}
                    {ytFull && !modoDesenhoBib && !isBlocked && !(ativoEClipe && fimCorte === active.id) && (
                      <div {...lupaBib.handlers(alternarLupaBib)} style={{
                        position: 'absolute', top: 0, left: 0, right: 0,
                        bottom: !ativoEClipe && lupaBib.lupa.z <= 1 ? '18%' : 0,
                        zIndex: 5, touchAction: 'none',
                        cursor: lupaBib.lupa.z > 1 ? (lupaBib.aArrastar ? 'grabbing' : 'grab') : 'pointer',
                      }} />
                    )}
                    {ytFull && !modoDesenhoBib && !isBlocked && <ControlosLupa {...lupaBib} />}
                    {/* Campo de texto — aparece exatamente onde se tocou,
                       tal como na Análise de Vídeo. */}
                    {formaTextoBib && (
                      <div onPointerDown={e => e.stopPropagation()}
                        style={{ position: 'absolute', left: formaTextoBib.xPix, top: formaTextoBib.yPix, transform: 'translate(-4px,-50%)', display: 'flex', gap: 4, zIndex: 6 }}>
                        <input
                          autoFocus
                          value={formaTextoBib.valor}
                          onChange={e => setFormaTextoBib(t => ({ ...t, valor: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') confirmarTextoBib(); if (e.key === 'Escape') setFormaTextoBib(null); }}
                          placeholder="Escreve o texto…"
                          style={{
                            background: 'rgba(0,0,0,0.85)', color: '#fff',
                            border: `1px solid ${corBib}`, borderRadius: 4, padding: '3px 7px', fontSize: 14,
                            minWidth: 100, outline: 'none', ...body,
                          }}
                        />
                        <Btn variant="solid" onClick={confirmarTextoBib} style={{ padding: '4px 8px', fontSize: 12 }}>OK</Btn>
                      </div>
                    )}
                    {/* O botão "Desenhar" já não fica aqui sobreposto ao
                       vídeo — passou para a barra de baixo, ao lado de
                       "Criar clipe" (ver mais abaixo). */}
                    {/* A desenhar: ferramentas à esquerda, cores/ações à
                       direita — sobrepostas ao vídeo (tal como na Análise de
                       Vídeo), em vez de uma barra por baixo que empurraria a
                       página e mudaria o tamanho do vídeo a cada vez que se
                       liga/desliga o desenho. */}
                    {ativoEClipe && !isBlocked && modoDesenhoBib && (
                      <>
                        <div style={{
                          position: 'absolute', top: 0, left: 0, bottom: 0, width: 78, zIndex: 5,
                          background: 'rgba(17,17,17,0.88)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, padding: 6,
                        }}>
                          {/* Sem a "Linha" (a Seta e o Traço cobrem esse uso), como na Análise de Vídeo. */}
                          {FERRAMENTAS_DESENHO.filter(([id]) => id !== 'linha').map(([id, Icon, titulo]) => (
                            <ToolBtn key={id} icon={Icon} label={titulo} active={toolBib === id} onClick={() => escolherFerramentaBib(id)} />
                          ))}
                          <ToolBtn icon={Type} label="Texto" active={toolBib === 'texto'} onClick={() => escolherFerramentaBib('texto')} />
                          <ToolBtn icon={Eraser} label="Apagar" active={toolBib === 'apagar'} onClick={() => escolherFerramentaBib('apagar')} />
                        </div>
                        <div style={{
                          position: 'absolute', top: 0, right: 0, bottom: 0, width: 78, zIndex: 5,
                          background: 'rgba(17,17,17,0.88)', overflowY: 'auto',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 8,
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {PALETA_DESENHO.map(p => (
                              <button key={p.id} onClick={() => {
                                setCorBib(p.cor);
                                // Com um item selecionado, muda também a cor dele.
                                if (formaSelecionadaBib != null && shapesRascunho[formaSelecionadaBib]) {
                                  pushHistoricoBib();
                                  setShapesRascunho(prev => prev.map((f, i) => (i === formaSelecionadaBib ? { ...f, color: p.cor } : f)));
                                }
                              }} title={p.id}
                                style={{
                                  width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', padding: 0,
                                  background: p.cor, border: corBib === p.cor ? `2px solid ${T_ESCURO.gold}` : `1px solid ${T_ESCURO.line}`,
                                }} />
                            ))}
                          </div>
                          <div style={{ height: 1, alignSelf: 'stretch', background: T_ESCURO.line }} />
                          {/* Botões simples (não o Btn): o Btn trava cliques
                              seguidos, e aqui recuam-se vários pontos de rajada. */}
                          <div style={{ display: 'flex', gap: 4, width: '100%' }}>
                            {[
                              { on: podeRecuarBib, fn: retrocederBib, Ic: Undo2, t: 'Recuar' },
                              { on: futuroBib.length > 0, fn: avancarBib, Ic: Redo2, t: 'Avançar' },
                            ].map(({ on, fn, Ic, t }) => (
                              <button key={t} type="button" onClick={fn} disabled={!on} title={t} aria-label={t} style={{
                                flex: 1, padding: '8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'transparent', border: `1px solid ${T_ESCURO.line}`, borderRadius: 8,
                                color: on ? T_ESCURO.cream : T_ESCURO.muted, opacity: on ? 1 : 0.6, cursor: on ? 'pointer' : 'default',
                              }}><Ic size={15} /></button>
                            ))}
                          </div>
                          {/* LIMPAR — tira todas as formas desta pausa, incluindo
                             as que já estavam gravadas. Só fica definitivo ao
                             tocar em Guardar/Concluído (Recuar desfaz, Cancelar
                             sai sem mexer no que estava gravado). */}
                          {/* Sem pausa aberta mas com desenhos no corte, Limpar
                             marca TODOS os desenhos do corte para apagar (só a
                             sério ao Guardar; Cancelar ou "Anular" desfazem). */}
                          <Btn escuro variant="ghost" onClick={() => {
                            if (shapesRascunho.length > 0) { pushHistoricoBib(); setShapesRascunho([]); setFormaSelecionadaBib(null); return; }
                            if ((active.anotacoesPausa || []).length > 0) { cancelarRetomaDesenhoBib(); setApagarTodasBib(true); }
                          }} disabled={shapesRascunho.length === 0 && ((active.anotacoesPausa || []).length === 0 || apagarTodasBib)} style={{ padding: '6px 2px', fontSize: 10, width: '100%', flexDirection: 'column', gap: 2 }}>
                            <Trash2 size={14} /> Limpar
                          </Btn>
                          <Btn escuro variant="ghost" onClick={cancelarDesenhoBib} style={{ padding: '6px 2px', fontSize: 10, width: '100%', flexDirection: 'column', gap: 2 }}>
                            <X size={14} /> Cancelar
                          </Btn>
                          <Btn variant="solid" onClick={guardarDesenhoBib} style={{ padding: '6px 2px', fontSize: 10, width: '100%', flexDirection: 'column', gap: 2 }}>
                            <Check size={14} /> Guardar
                          </Btn>
                        </div>
                        {/* Menu da pausa — por cima do vídeo, não na
                           lateral, para ficar sempre bem à vista enquanto
                           se decide quanto tempo o vídeo fica parado. */}
                        <div style={{ position: 'absolute', top: 8, left: 86, right: 86, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          {/* PAUSAS NESTE CORTE — todas as que já existem,
                             para se poder abrir (e limpar/apagar) qualquer
                             uma, esteja o vídeo onde estiver. */}
                          {(active.anotacoesPausa || []).length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', borderRadius: 8, padding: '5px 10px' }}>
                              {apagarTodasBib ? (
                                <>
                                  <span style={{ fontSize: 11.5, color: T_ESCURO.warn }}>Os desenhos deste corte vão ser apagados ao Guardar.</span>
                                  <button onClick={() => setApagarTodasBib(false)} style={{ background: 'none', border: `1px solid ${T_ESCURO.line}`, borderRadius: 4, color: '#fff', padding: '2px 8px', fontSize: 12, cursor: 'pointer' }}>Anular</button>
                                </>
                              ) : <span style={{ fontSize: 11.5, color: T_ESCURO.mutedDim }}>Pausas neste corte:</span>}
                              {[...(active.anotacoesPausa || [])]
                                .sort((a, b) => tempoPausaNoCorte(a) - tempoPausaNoCorte(b))
                                .map(a => {
                                  const emEdicao = a.id === anotacaoIdEmEdicaoBib;
                                  return (
                                    <button key={a.id} onClick={() => escolherPausaBib(a)}
                                      title={`Abrir esta pausa (${(a.shapes || []).length} ${(a.shapes || []).length === 1 ? 'forma' : 'formas'})`}
                                      style={{
                                        background: emEdicao ? T.goldFundo : 'none', color: emEdicao ? '#111' : '#fff',
                                        border: `1px solid ${emEdicao ? T_ESCURO.gold : T_ESCURO.line}`, borderRadius: 4,
                                        padding: '2px 8px', fontSize: 12, cursor: 'pointer', ...mono,
                                      }}>
                                      {fmtMMSS(tempoPausaNoCorte(a) - clipIni)}
                                    </button>
                                  );
                                })}
                            </div>
                          )}
                          {/* Só aparece quando já há alguma coisa para concluir
                              (o primeiro item, uma pausa aberta, ou o "Limpar"). */}
                          {(shapesRascunho.length > 0 || formaEmCursoBib || anotacaoIdEmEdicaoBib || apagarTodasBib) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.85)', borderRadius: 8, padding: '6px 10px' }}>
                            {/* TEMPO NO ECRÃ. Com um item selecionado (novo ou já
                                gravado), o contador é o DESSE item: muda-se e
                                "Concluído" grava. Sem seleção, é o tempo que os
                                itens desenhados agora vão levar. */}
                            {(() => {
                              const sel = formaSelecionadaBib != null ? shapesRascunho[formaSelecionadaBib] : null;
                              const valor = sel ? (Number(sel.seg) || duracaoPausaBib) : duracaoPausaBib;
                              const mudar = (d) => {
                                const novo = Math.max(1, Math.min(60, valor + d));
                                if (sel) {
                                  pushHistoricoBib();
                                  setShapesRascunho(prev => prev.map((f, i) => (i === formaSelecionadaBib ? { ...f, seg: novo } : f)));
                                } else setDuracaoPausaBib(novo);
                              };
                              const b = { background: 'none', border: `1px solid ${T_ESCURO.line}`, borderRadius: 4, color: '#fff', width: 22, height: 22, cursor: 'pointer', fontSize: 14, lineHeight: 1 };
                              return (
                                <>
                                  <span style={{ fontSize: 11.5, color: sel ? T_ESCURO.warn : T_ESCURO.mutedDim }}
                                    title={sel ? 'Tempo no ecrã do item selecionado' : 'Tempo no ecrã dos itens desenhados agora. Os que já lá estavam mantêm o tempo deles.'}>
                                    {sel ? 'Item selecionado:' : (shapesRascunho.some(f => Number(f.seg)) ? 'Novos itens:' : 'No ecrã:')}
                                  </span>
                                  <button onClick={() => mudar(-1)} style={b}>−</button>
                                  <span style={{ fontSize: 13, color: '#fff', minWidth: 30, textAlign: 'center', ...mono }}>{valor}s</span>
                                  <button onClick={() => mudar(1)} style={b}>+</button>
                                </>
                              );
                            })()}
                            {anotacaoIdEmEdicaoBib && (
                              <Btn escuro variant="ghost" onClick={apagarAnotacaoAtualBib} style={{ padding: '4px 8px', fontSize: 11 }}><Trash2 size={11} /> Apagar pausa</Btn>
                            )}
                            <Btn onClick={guardarDesenhoBib} style={{ padding: '4px 10px', fontSize: 11 }}>Concluído</Btn>
                          </div>
                          )}
                        </div>
                        {(toolBib === 'zonalivre' || toolBib === 'linhaPontos') && formaEmCursoBib && (
                          <div style={{ position: 'absolute', top: (active.anotacoesPausa || []).length > 0 ? 84 : 48, left: 86, right: 86, zIndex: 5, display: 'flex', justifyContent: 'center' }}>
                            <Btn onClick={fecharEMoverBib} style={{ padding: '6px 14px', fontSize: 12.5 }}>{formaEmCursoBib.tool === 'zonalivre' ? 'Fechar zona' : 'Terminar linha'}</Btn>
                          </div>
                        )}
                        {/* Forma selecionada — arrasta os pontinhos no vídeo
                           para a mover; aqui só o apagar. */}
                        {formaSelecionadaBib != null && shapesRascunho[formaSelecionadaBib] && (
                          <div style={{
                            position: 'absolute', bottom: 8, left: 86, right: 86, zIndex: 5,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap',
                            background: 'rgba(0,0,0,0.85)', borderRadius: 8, padding: '6px 8px',
                          }}>
                            <span style={{ fontSize: 11.5, color: T_ESCURO.mutedDim }}>Forma selecionada — arrasta os pontos para a mover</span>
                            {shapesRascunho[formaSelecionadaBib].tool === 'circulo' && (() => {
                              const forma = shapesRascunho[formaSelecionadaBib];
                              const atual = Number(forma.zoom) || 1;
                              const por = (z) => setShapesRascunho(prev => prev.map((f, i) => {
                                if (i !== formaSelecionadaBib) return f;
                                const { zoom, ...resto } = f; // eslint-disable-line no-unused-vars
                                return z > 1 ? { ...resto, zoom: z } : resto;
                              }));
                              const op = (z, rotulo) => (
                                <button key={z} onClick={() => por(z)} style={{
                                  background: atual === z ? T.goldFundo : 'none', color: atual === z ? '#111' : '#fff',
                                  border: `1px solid ${atual === z ? T_ESCURO.gold : T_ESCURO.line}`, borderRadius: 4,
                                  padding: '2px 7px', fontSize: 11.5, cursor: 'pointer', ...mono,
                                }}>{rotulo}</button>
                              );
                              return (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title="Ao reproduzir, a imagem aproxima-se deste círculo enquanto ele estiver no ecrã">
                                  <ZoomIn size={13} color={T_ESCURO.mutedDim} />
                                  {op(1, 'Sem')}{op(1.5, '1,5×')}{op(2, '2×')}{op(3, '3×')}
                                  {atual > 1 && (
                                    <button onClick={() => setZoomPreviewBib({ ...forma, zoom: atual })} style={{
                                      background: 'none', border: `1px solid ${T_ESCURO.line}`, borderRadius: 4, color: T_ESCURO.warn,
                                      padding: '2px 7px', fontSize: 11.5, cursor: 'pointer', ...body,
                                    }}>Ver zoom</button>
                                  )}
                                </span>
                              );
                            })()}
                            <Btn escuro variant="ghost" onClick={apagarSelecionadaBib} style={{ padding: '4px 8px', fontSize: 11 }}><Trash2 size={11} /> Apagar</Btn>
                            <Btn escuro variant="ghost" onClick={() => setFormaSelecionadaBib(null)} style={{ padding: '4px 8px', fontSize: 11 }}>Fechar</Btn>
                          </div>
                        )}
                      </>
                    )}
                    </div>
                    {/* BARRA DO CLIPE — só nos clipes. Vai do início ao fim
                        do corte, e nada mais: não há como ver o resto do
                        jogo a partir de um clipe. */}
                    {/* Em ecrã inteiro o painel fica POR CIMA do fundo do vídeo
                        (sem encolher a imagem nem a puxar para cima). */}
                    {ytFull && clipMode && podeCriarClipe && !isBlocked && (
                      <div style={{ position: 'relative', height: 0, flexShrink: 0 }}>
                        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 8 }}>
                          {renderPainelClipe(true)}
                        </div>
                      </div>
                    )}
                    {/* JOGO COMPLETO — a MESMA barra (mesma altura e aspeto),
                        sobre o vídeo todo: trocar entre jogo completo e cortes
                        já não mexe na caixa. ±10 s em vez de ±2 s. */}
                    {!isBlocked && !ativoEClipe && (() => {
                      const dur = duracaoJogo || 0;
                      const agoraJ = Math.min(Math.max(tempoJogo || 0, 0), dur || 0);
                      const ir = (t) => { const alvo = Math.max(0, dur ? Math.min(t, dur - 0.5) : t); enviarComandoYoutube('seekTo', [alvo, true]); setTempoJogo(alvo); };
                      const btnJ = {
                        background: 'none', border: 'none', color: '#fff', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, flexShrink: 0,
                      };
                      return (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: isNarrow ? 6 : 10,
                          padding: '8px 12px', background: '#111', borderTop: `1px solid ${T.line}`, flexShrink: 0,
                        }}>
                          <button onClick={() => enviarComandoYoutube(ytATocar ? 'pauseVideo' : 'playVideo')} title={ytATocar ? 'Pausar' : 'Reproduzir'} style={btnJ}>
                            {ytATocar ? <Pause size={16} /> : <Play size={16} />}
                          </button>
                          <button onClick={() => ir(0)} title="Voltar ao início" style={btnJ}><RotateCcw size={14} /></button>
                          {!isNarrow && <button onClick={() => ir(agoraJ - 10)} title="Recuar 10 segundos" style={{ ...btnJ, fontSize: 11.5, ...mono }}>-10s</button>}
                          <BarraTempoSala min={0} max={dur || 1} value={agoraJ} disabled={!dur}
                            onChange={(t) => ir(t)} rotulo="Posição no vídeo" />
                          {!isNarrow && <button onClick={() => ir(agoraJ + 10)} title="Avançar 10 segundos" style={{ ...btnJ, fontSize: 11.5, ...mono }}>+10s</button>}
                          <span style={{ fontSize: 12, color: '#fff', whiteSpace: 'nowrap', flexShrink: 0, ...mono }}>
                            {fmtMMSS(agoraJ)} / {dur ? fmtMMSS(dur) : '--:--'}
                          </span>
                          <button onClick={toggleYtFull} title={ytFull ? 'Sair do ecrã inteiro' : 'Ecrã inteiro'} style={btnJ}>
                            {ytFull ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                          </button>
                        </div>
                      );
                    })()}
                    {!isBlocked && ativoEClipe && (() => {
                      const dur = Math.max(0.1, clipFimEf - clipIni);
                      // Parado no fim do corte: a barra fica MESMO no fim.
                      const agora = fimCorte === active.id && arrastoClipe == null
                        ? clipFimEf
                        : Math.min(Math.max(arrastoClipe != null ? arrastoClipe : liveTime, clipIni), clipFimEf);
                      const btn = {
                        background: 'none', border: 'none', color: '#fff', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, flexShrink: 0,
                      };
                      return (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: isNarrow ? 6 : 10,
                          padding: '8px 12px', background: '#111', borderTop: `1px solid ${T.line}`, flexShrink: 0,
                        }}>
                          <button
                            onClick={() => {
                              // No fim (à espera de Repetir/Seguinte), o play recomeça o clipe.
                              if (fimCorte === active.id) { setFimCorte(null); procurarNoClipe(clipIni); enviarComandoYoutube('playVideo'); return; }
                              enviarComandoYoutube(ytATocar ? 'pauseVideo' : 'playVideo');
                            }}
                            title={ytATocar ? 'Pausar' : 'Reproduzir'}
                            style={btn}
                          >{ytATocar ? <Pause size={16} /> : <Play size={16} />}</button>
                          <button onClick={() => procurarNoClipe(clipIni)} title="Voltar ao início do clipe" style={btn}><RotateCcw size={14} /></button>
                          {!isNarrow && (
                            <button onClick={() => recuarClipe(-2)} title="Recuar 2 segundos" style={{ ...btn, fontSize: 11.5, ...mono }}>-2s</button>
                          )}
                          <BarraTempoSala min={clipIni} max={clipFimEf} value={agora}
                            onChange={(t) => { if (fimCorte === active.id) setFimCorte(null); procurarNoClipe(t); }}
                            onLargar={largarBarraClipe} rotulo="Posição dentro do clipe" />
                          {!isNarrow && (
                            <button onClick={() => recuarClipe(2)} title="Avançar 2 segundos" style={{ ...btn, fontSize: 11.5, ...mono }}>+2s</button>
                          )}
                          <span style={{ fontSize: 12, color: '#fff', whiteSpace: 'nowrap', flexShrink: 0, ...mono }}>
                            {fmtMMSS(agora - clipIni)} / {fmtMMSS(dur)}
                          </span>
                          {/* Ecrã inteiro no fim da barra, como na Análise. */}
                          <button onClick={toggleYtFull} title={ytFull ? 'Sair do ecrã inteiro' : 'Ecrã inteiro'} style={btn}>
                            {ytFull ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                          </button>
                        </div>
                      );
                    })()}
                    {!isBlocked && (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                        padding: '6px 10px', background: '#111', borderTop: `1px solid ${T.line}`, flexShrink: 0,
                      }}>
                        {ytFull ? (
                          // Em ecrã inteiro não há título por baixo — fica aqui.
                          <span style={{ fontSize: 12, color: '#ffffffcc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                            {active.title}
                          </span>
                        ) : active.youtubeId ? (
                          <a
                            href={`https://www.youtube.com/watch?v=${active.youtubeId}`}
                            target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fff', textDecoration: 'none', flexShrink: 0 }}
                          >
                            <ExternalLink size={13} /> Abrir no YouTube
                          </a>
                        ) : <span />}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                          {podeCriarClipe && (
                          <button
                            onClick={() => (clipMode ? cancelarModoClipe() : setClipMode(true))}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
                              color: clipMode ? T.warn : '#fff',
                              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                            }}
                          >
                            <Scissors size={13} /> {clipMode ? (edicaoClipeId ? 'Cancelar edição' : 'Cancelar clipe') : 'Criar clipe'}
                          </button>
                          )}
                          {/* A gravação começa no Partilhar (menu "Gravar e enviar vídeo");
                              aqui só aparece o progresso, com o "parar". */}
                          {ativoEClipe && !modoDesenhoBib && gravacaoBib && (
                          <button
                            onClick={acabarGravacaoBib}
                            title={gravacaoBib ? 'Parar e entregar o vídeo' : 'Gravar um vídeo do corte com os desenhos, as pausas e o zoom (o browser pede para partilhar este separador)'}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
                              color: gravacaoBib ? T.bad : '#fff',
                              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                            }}
                          >
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: gravacaoBib ? T.bad : '#fff', display: 'inline-block' }} />
                            {gravacaoBib
                              ? (gravacaoBibRef.current && gravacaoBibRef.current.preRoll
                                ? 'A preparar… parar'
                                : `A gravar ${fmtMMSS(Math.max(0, liveTime - clipIni))} / ${fmtMMSS(clipFimEf - clipIni)} · parar`)
                              : 'Gravar vídeo'}
                          </button>
                          )}
                          {avisoGravacaoBib && (
                            <span style={{ fontSize: 11.5, color: T.warn }}>{avisoGravacaoBib}</span>
                          )}
                          {/* JANELA DA GRAVAÇÃO — antes (o que vai acontecer) e depois
                              (ver, descarregar, partilhar). Durante a gravação não há
                              janela nenhuma: ficaria gravada por cima do vídeo. */}
                          {janelaGravacaoBib && janelaGravacaoBib.fase === 'pronto' && !janelaGravacaoBib.ficheiro && (
                            <Modal title="Vídeo pronto" onClose={fecharJanelaGravacaoBib} wide>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <video src={janelaGravacaoBib.url} controls playsInline style={{ width: '100%', borderRadius: 8, background: '#000', maxHeight: '55vh' }} />
                                <div style={{ fontSize: 12, color: T.mutedDim }}>
                                  {/mp4/.test(janelaGravacaoBib.blob.type) ? 'MP4' : 'WebM'} · {(janelaGravacaoBib.blob.size / 1048576).toFixed(1)} MB
                                </div>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                  <Btn variant="ghost" onClick={fecharJanelaGravacaoBib}>Fechar</Btn>
                                  <Btn variant="ghost" onClick={() => entregarVideo(janelaGravacaoBib.blob, janelaGravacaoBib.nome, { soDescarregar: true })}><Download size={14} /> Descarregar</Btn>
                                  <Btn onClick={() => entregarVideo(janelaGravacaoBib.blob, janelaGravacaoBib.nome)}><Share2 size={14} /> Partilhar vídeo</Btn>
                                </div>
                              </div>
                            </Modal>
                          )}
                          {/* Desenhar é só para a equipa técnica — no Portal não. */}
                          {ativoEClipe && !criarClipeAtleta && (
                          <button
                            onClick={modoDesenhoBib ? cancelarDesenhoBib : comecarDesenhoBib}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
                              color: modoDesenhoBib ? T.warn : '#fff',
                              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                            }}
                          >
                            <Pencil size={13} /> {modoDesenhoBib ? 'Cancelar desenho' : `Desenhar${active.anotacoesPausa && active.anotacoesPausa.length > 0 ? ` (${active.anotacoesPausa.length})` : ''}`}
                          </button>
                          )}
                          <button
                            onClick={toggleYtFull}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fff',
                              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                            }}
                          >
                            {ytFull ? <Minimize2 size={14} /> : <Maximize2 size={14} />} {ytFull ? 'Sair' : 'Ecrã inteiro'}
                          </button>
                        </div>
                      </div>
                    )}
                    {/* Criar clipe EM ECRÃ INTEIRO — o mesmo painel, em
                        versão escura e compacta, dentro da caixa que está
                        em ecrã inteiro (fora dela não se veria). */}

                  </div>
                  {/* O painel de criar clipe fica POR CIMA do que está por
                      baixo do leitor (título, descrição), sem empurrar nada:
                      antes a coluna crescia e o leitor subia todo. */}
                  {!ytFull && clipMode && podeCriarClipe && !isBlocked && (
                    <div style={{ position: 'relative', height: 0 }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 6, background: T.bg, borderRadius: '0 0 8px 8px', boxShadow: '0 10px 24px rgba(0,0,0,.45)' }}>
                        {renderPainelClipe(false)}
                      </div>
                    </div>
                  )}
                  </>
                ) : active.social ? (
                  <div style={{ maxWidth: isSocialFullscreen ? 'none' : 320, margin: '0 auto' }}>
                    <div
                      ref={socialBoxRef}
                      style={{
                        position: 'relative',
                        height: isSocialFullscreen ? '100vh' : 560,
                        width: isSocialFullscreen ? '100vw' : 'auto',
                        maxHeight: isSocialFullscreen ? '100vh' : '65vh',
                        borderRadius: isSocialFullscreen ? 0 : 10,
                        overflow: 'hidden',
                        border: isSocialFullscreen ? 'none' : `1px solid ${T.line}`,
                        background: '#000',
                        display: 'flex', flexDirection: 'column',
                      }}
                    >
                      {/* Em ecrã inteiro, a "janela" tem o tamanho exato do
                          vídeo e o iframe está deslocado para cima, de forma a
                          esconder o cabeçalho da plataforma. No TikTok não há
                          cabeçalho, por isso o deslocamento é zero. */}
                      <div style={{
                        flex: 1, minHeight: 0, overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {/* A estrutura (div > div > iframe) é SEMPRE a mesma —
                            só mudam as medidas. Se alternássemos entre árvores
                            diferentes, o React voltava a montar o iframe e o
                            vídeo recomeçava do início ao entrar em ecrã inteiro. */}
                        <div style={socialClipStyle(socialCropKey(active.social), isSocialFullscreen, boxSize, socialZoom, 40)}>
                          <div style={socialInnerStyle(socialCropKey(active.social), isSocialFullscreen, boxSize, socialZoom, 40, socialOffset)}>
                            <iframe
                              key={active.id}
                              src={socialEmbedSrc(active.social)}
                              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                              allow="autoplay; encrypted-media; clipboard-write; picture-in-picture; fullscreen"
                              allowFullScreen
                              scrolling="no"
                              // No iOS, sem isto o vídeo abre em ecrã inteiro
                              // do sistema em vez de tocar dentro da caixa.
                              playsInline
                              sandbox={active.social.platform === 'instagram' ? INSTAGRAM_SANDBOX : undefined}
                              title={active.title}
                            />
                          </div>
                        </div>
                      </div>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
                        height: 40, boxSizing: 'border-box',
                        padding: '6px 10px', background: '#111', borderTop: `1px solid ${T.line}`, flexShrink: 0,
                      }}>
                        {(() => {
                          const ctrlStyle = { width: 24, height: 24, borderRadius: 6, border: '1px solid #333', background: '#1b1b1b', color: '#fff', cursor: 'pointer', fontSize: 13, lineHeight: 1 };
                          const hasChrome = (SOCIAL_CROP[socialCropKey(active.social)] || {}).headerPx > 0;
                          return (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 4 }}>
                              {/* Alinhamento do recorte — só faz falta onde a
                                  plataforma põe cabeçalho por cima do vídeo. */}
                              {hasChrome && (
                                <>
                                  <button onClick={() => setSocialOffset(o => o - 6)} title="Subir o recorte" style={ctrlStyle}>▲</button>
                                  <button onClick={() => setSocialOffset(o => o + 6)} title="Descer o recorte" style={ctrlStyle}>▼</button>
                                  <span style={{ width: 8 }} />
                                </>
                              )}
                              <button
                                onClick={() => setSocialZoom(z => Math.max(0.6, Math.round((z - 0.1) * 10) / 10))}
                                title="Reduzir"
                                style={ctrlStyle}
                              >−</button>
                              <span style={{ fontSize: 11.5, color: '#bbb', minWidth: 34, textAlign: 'center' }}>{Math.round(socialZoom * 100)}%</span>
                              <button
                                onClick={() => setSocialZoom(z => Math.min(1.6, Math.round((z + 0.1) * 10) / 10))}
                                title="Aumentar"
                                style={ctrlStyle}
                              >+</button>
                            </span>
                          );
                        })()}
                        {/* SAÍDA PARA A PLATAFORMA.

                            O Instagram recusa mostrar dentro de outros sites
                            uma parte crescente das publicações — contas
                            privadas sempre, e cada vez mais publicações
                            normais, porque passou a exigir sessão iniciada.
                            Quando isso acontece, o quadrado fica preto ou com
                            um pedido de login e não há nada que se possa fazer
                            do nosso lado: a decisão é da plataforma.

                            Este atalho é a única saída — abre a publicação na
                            app do Instagram, onde a sessão do treinador já
                            está iniciada e o vídeo toca. */}
                        {socialExternalUrl(active.social) && (
                          <a
                            href={socialExternalUrl(active.social)}
                            target="_blank" rel="noopener noreferrer"
                            title="Se o vídeo não aparecer, é a plataforma a bloquear — aqui abre na app"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#bbb',
                              textDecoration: 'none', padding: '2px 4px', marginRight: 'auto',
                            }}
                          ><ExternalLink size={13} /> Abrir original</a>
                        )}
                        <button
                          onClick={toggleSocialFullscreen}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fff',
                            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                          }}
                        >
                          {isSocialFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                          {isSocialFullscreen ? 'Sair de ecrã inteiro' : 'Ecrã inteiro'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : eMp4Sala(active) ? (
                  (() => {
                    const { lista, i, seguinteId } = seguinteNaSala(active.id);
                    const anteriorId = i > 0 ? lista[i - 1] : null;
                    return (
                      <LeitorClipeSala key={active.id} item={active}
                        posicao={i >= 0 && lista.length > 1 ? { indice: i, total: lista.length } : null}
                        onAnterior={anteriorId ? () => { ytATocarRef.current = true; setActiveId(anteriorId); } : null}
                        onSeguinte={seguinteId ? () => { ytATocarRef.current = true; setActiveId(seguinteId); } : null} />
                    );
                  })()
                ) : (
                  <AttachmentPreview item={active} />
                )}
                <div style={{ marginTop: 10, color: T.cream, fontSize: 15, fontWeight: 500 }}>{active.title}</div>
                {/* Por baixo do título, sem partir linhas (também no telemóvel):
                    a jornada à esquerda e o tempo do corte à direita; depois o
                    jogo de onde veio, numa linha só. */}
                {(() => {
                  const eCorte = typeof active.clipInicio === 'number' && typeof active.clipFim === 'number';
                  if (!active.jornada && !eCorte) return null;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2, fontSize: 12.5, color: T.mutedDim }}>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active.jornada || ''}</span>
                      {eCorte && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', flexShrink: 0, ...mono, fontSize: 12 }}>
                          <Scissors size={12} /> {fmtMMSS(active.clipInicio)}–{fmtMMSS(active.clipFim)}
                        </span>
                      )}
                    </div>
                  );
                })()}
                {typeof active.clipInicio === 'number' && typeof active.clipFim === 'number' && active.clipOrigemTitulo && (
                  <div style={{ marginTop: 3, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {items.some(v => v.id === active.clipOrigemId) ? (
                      <button
                        onClick={() => irPara(items.find(v => v.id === active.clipOrigemId))}
                        title={active.clipOrigemTitulo}
                        style={{ background: 'none', border: 'none', color: T.warn, cursor: 'pointer', padding: 0, fontSize: 12.5, ...body, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}
                      >{active.clipOrigemTitulo}</button>
                    ) : (
                      <span style={{ color: T.mutedDim }}>{active.clipOrigemTitulo}</span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          {/* A lista tem scroll próprio em vez de esticar a página: com
              muitos ficheiros, a página inteira ficava com metros de altura
              e o visualizador à esquerda saía do ecrã. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            {!semCatalogo && !modoCanal && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} color={T.mutedDim} style={{ position: 'absolute', left: 10, pointerEvents: 'none' }} />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Procurar por título, pasta ou ficheiro..."
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '8px 30px 8px 30px',
                  background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8,
                  color: T.cream, fontSize: 12.5, outline: 'none', ...body,
                }}
              />
              {busca && (
                <button
                  onClick={() => setBusca('')} title="Limpar pesquisa"
                  style={{ position: 'absolute', right: 8, background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', display: 'flex', padding: 0 }}
                ><X size={14} /></button>
              )}
            </div>
            )}

            {/* Altura FIXA (não só um máximo) — com poucos ou nenhuns
                resultados a lista encolhia, e isso empurrava o resto da
                página, dando a sensação de "saltar" ao escrever. Com
                altura sempre igual, só o que está lá dentro muda. */}
            {visibleItems.length === 0 ? (
              <div style={{ height: '62vh', display: 'flex', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 12.5, color: T.mutedDim, padding: '10px 2px' }}>
                  Nada encontrado para “{busca}”.
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ ...mono, fontSize: 11, color: T.mutedDim }}>
                    {visibleItems.length} {visibleItems.length === 1 ? 'ficheiro' : 'ficheiros'}
                  </span>
                  <button
                    onClick={() => setModoFeed(true)}
                    title="Mostra tudo aberto numa coluna, para rever a rolar"
                    style={{ background: 'none', border: 'none', color: T.gold, cursor: 'pointer', fontSize: 11.5, ...body, padding: 0 }}
                  >Ver tudo aberto</button>
                </div>
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 8,
                  height: '62vh', overflowY: 'auto', overflowX: 'hidden', paddingRight: 4, minWidth: 0,
                }}>
                  {modoCanal && grupoAtual && !termo ? (
                    // Dentro de um cartão: um bloco por secção — "Jogo
                    // completo"/"Cortes" numa jornada, ou um bloco por jogo
                    // nos Amigáveis e nos adversários.
                    grupoAtual.secoes.flatMap((s, si) => {
                      // "Ver cortes em seguida" junto dos cortes: no título da
                      // PRIMEIRA secção que tem cortes ("Cortes" numa jornada;
                      // o primeiro jogo com cortes nos Amigáveis/adversários).
                      const iPrimeiraComCortes = grupoAtual.secoes.findIndex(x => x.itens.some(v => ehClipe(v) && temLeitorBib(v)));
                      // O botão fica SEMPRE (não desaparece ao começar): nada mexe na página.
                      const comBotao = si === iPrimeiraComCortes && cortesDoGrupo.length > 0;
                      return [
                      <div key={`h-${s.key}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: si ? '8px 0 0' : 0 }}>
                        <span style={{ fontSize: 10.5, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.titulo}</span>
                        {comBotao && (
                          <button onClick={iniciarSequencia}
                            title={`Ver os ${cortesDoGrupo.length} cortes um atrás do outro`}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, cursor: 'pointer', ...body,
                              background: 'transparent', border: `1px solid ${T.gold}`, color: T.gold,
                              borderRadius: 999, padding: '4px 10px', fontSize: 11.5, fontWeight: 600,
                            }}>
                            <Play size={12} /> Ver cortes em seguida
                          </button>
                        )}
                      </div>,
                      ...s.itens.map(renderRow),
                      ];
                    })
                  ) : visibleItems.map(renderRow)}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      </div>

      {pedirFicha && (
        <FichaAdversarioRapida
          adversarios={adversarios}
          equipasCompeticao={equipasCompeticao}
          equipasIniciais={pedirFicha.equipas}
          equipaInicial={pedirFicha.equipa}
          video={byIdItens[pedirFicha.raizId]}
          onClose={() => setPedirFicha(null)}
          onConfirm={confirmarFicha}
        />
      )}

      {modal && (
        <MediaModal
          item={modal === 'new' ? null : modal}
          folders={folders}
          // Ao adicionar dentro de uma pasta aberta, já vem preenchida.
          defaultFolder={(modoCanal ? pastaTema : folderFilter) && (modoCanal ? pastaTema : folderFilter) !== NO_FOLDER ? (modoCanal ? pastaTema : folderFilter) : ''}
          semCatalogo={semCatalogo || (modal !== 'new' && !!modal.adversarioId)}
          onClose={() => setModal(null)}
          onSave={save}
          modoCanal={modoCanal && !(modal !== 'new' && modal.adversarioId)}
          matches={matches}
          adversarios={adversarios}
          // O que vem preenchido: num item existente, a categoria que ele
          // tem (mesmo deduzida); num novo, o sítio onde se está.
          iniciais={modal === 'new'
            ? {
                categoria: secao === 'jogos' ? 'jogo' : (secao === 'adversarios' ? 'adversario' : 'tema'),
                jornada: secao === 'jogos' && grupoAtual && grupoAtual.n != null ? `${grupoAtual.n}ª Jornada` : '',
                jogoId: secao === 'jogos' && grupoAtual && grupoAtual.match ? grupoAtual.match.id : '',
                equipas: secao === 'adversarios' && grupoAtual && grupoAtual.nome ? [grupoAtual.nome] : [],
              }
            : { categoria: catDe(modal), equipas: equipasDe(modal), jogoId: modal.jogoId || '' }}
          equipasCompeticao={equipasCompeticao}
        />
      )}

    </div>
  );
});

