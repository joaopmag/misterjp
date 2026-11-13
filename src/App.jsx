import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal, flushSync } from 'react-dom';
import ReactDOMServer from 'react-dom/server';
// JSZip — abre/fecha o .xlsx como o que ele realmente é por dentro (um
// .zip com XML lá dentro). É isto que permite mudar só o texto exato
// de uma célula sem reescrever — e sem estragar — o ficheiro inteiro
// (cores, brasões, estilos). Precisa de `npm install jszip`.
import JSZip from 'jszip';
import * as tus from 'tus-js-client';
import AnalisadorVideo, {
  FERRAMENTAS as FERRAMENTAS_DESENHO, ToolBtn, PALETA_DESENHO, COR_DESENHO,
  RAIO_TOQUE, distanciaShape, renderShape, TAMANHO_FONTE_TEXTO, girar, inclinacaoPadrao,
  MODELOS_CALIBRACAO, matrizDaCalibracao, inverterH, aplicarH, planoDaCalibracao,
  validarCalibracao, cantosDasLinhas, LINHAS_CALIBRACAO, ordenarCantosAuto, referenciaForaDeJogo,
  pegaZonaNoChao, desrodarNaZonaNoChao, pegaRodarZonaNoChao, anguloRodarZonaNoChao,
  podeGravarSeparador, prepararGravacaoSeparador, entregarVideo,
  TAGS_ANALISE, ehNossaEquipa,
} from './AnalisadorVideo';
import {
  ZoomIn, Info, Ruler, Flag, Users, CalendarDays, Dumbbell, Activity, LayoutGrid, Plus, X, Trash2,
  Pencil, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Check, Loader2, Clock,
  Moon, Sun, Printer, TrendingUp, Trophy,
  Search, Star, UserCheck, Download, Upload, Tv, RotateCw, Maximize2, Minimize2,
  ExternalLink, ClipboardList, BookOpen, Play, Square, Eye, EyeOff, RefreshCw, LogOut,
  Undo2, Redo2, Copy, Share2, Presentation, FileText, Instagram, Facebook, Music2, Lightbulb,
  Image as ImageIcon, Stethoscope, AlertTriangle, Shuffle, MessageCircle, FileSpreadsheet, Shield,
  HeartPulse, Flame, PartyPopper, Megaphone, Fingerprint, ListOrdered, ArrowRight, PenTool, Eraser, Move, Hand, Scissors, Circle, Type, Pause, RotateCcw, FolderOpen, SkipForward, SkipBack,
  Video, Repeat, Calendar, Bell, Lock,
  Volume2, VolumeX, CheckCircle2, Building2, Wrench, Tag, ZoomOut, Film,
  Target, Pin,
} from 'lucide-react';
// Base movida para src/base/ (divisão do App.jsx, passo 1).
import { FONTS, IconeTema, ROTULO_TROCA_TEMA, T, TEMA_ATUAL, TEXT_ON_ACCENT, T_ESCURO, body, display, mono, trocarTema } from './base/tema';
import { ACTIVITY_LABELS, addDays, escapeHtmlText, fmtDate, fmtShort, formatShortDatePt, semAcentos, timeAgo, toLocalISODate, todayStr, uid } from './base/utilidades';
import { BotaoTopo, Btn, ConfirmDialog, EmptyState, FIELD_FULL, FIELD_GRID, Field, Input, Modal, Panel, SectionHeader, Select, TextArea, UNDO_SECONDS, UndoBar, askConfirm, definirModalHandoff, herdarOuEmpurrarMarca, inputStyle, itemLabel, modalHandoffAtivo, offerUndo, removeWithUndo, trocarJanela, undoHandler, useIsMobile, useModalHistory } from './base/ui';
import { BannerRascunho, SyncErrorBanner, ensureSession, jsonEstavel, loadSingleton, saveSingleton, useCollectionSync, useRascunho, useSingletonSync } from './base/sincronizacao';
// Tático, domínio e base (divisão do App.jsx, passo 2): src/tatico/, src/dominio/, src/base/.
import { momentoTexto, momentosDe, temMomento } from './dominio/treino';
import { NIVEIS_CLINICOS, estadoClinicoEm, nivelClinico, nivelNoDia, ordenarEvolucao, resumoClinico } from './dominio/clinico';
import { FRIENDLY, competitionLabel, isFriendlyMatch, jogoRealDaSessao } from './dominio/jogos';
import { esperarImagensDoStorage, imprimirComNome } from './base/impressao';
import { useArrastarParaTrocar } from './base/arrastar';
import { QuadroTaticoLivre } from './tatico/QuadroTaticoLivre';
import { FORMACOES, LAYOUT_FORMACAO, Simulador, distribuirOnzeNoCampo, preencherPorFamilia, rotuloDoLugar, tamanhoDaFormacao } from './tatico/Simulador';
import { P, TATICAS, TATICA_OMISSAO, TreinosParaEditorCtx, distribuirPlantel } from './tatico/prancheta';
import { DiagramElements, EDITOR_BOX, EDITOR_VIEWBOX, ESTICAR_IMPRESSAO_MEIO, PITCH_ASPECT, PITCH_BOX, PITCH_FIT, PitchMarkings, SpaceZone, TEAMS, VistaCampo, aspetoSemBancos, buildAnimationChainsPure, iconScaleForPhase, nextKeeperNumber, parsePlayersCount, planearCoreografiaAnim, stepElements, stepStaticArrows, viewBoxSemBancos } from './tatico/campo';
import { AnimOverlay, DiagramEditor } from './tatico/DiagramEditor';
import { POSITIONS, PlayerChipList, convidadosDe, firstNameOf, lastNameOf, shortFullName, shortPlayerName, sortByPosition } from './dominio/jogadores';
// Biblioteca de média e anexos (divisão do App.jsx, passo 3): src/media/, src/base/.
import { UrlAnexo, ficheiroParaAnexo, fileToPhotoDataUrl, hrefDescarga } from './base/anexos';
import { KIOSK_VOLTAR_INTERNO, useKioskVoltar } from './base/kiosk';
import { MediaLibrary } from './media/MediaLibrary';
import { FichaAdversarioRapida } from './media/acoes';
import { ControlosLupa, INSTAGRAM_SANDBOX, MediaFeedItem, URL_PUBLICA_APP, VideoComBarra, fmtMMSS, socialEmbedSrc, socialExternalUrl, useLupa } from './media/social';
import { AttachmentPreview, PdfCanvasViewer, loadPdfJs, useBlobUrl } from './media/leitores';
import { MAX_CLIPE_ATLETA_SEG, cleanFolder, ehClipe, fichaDaEquipa, fichaRepetida, idFichaAutomatica, numDoJogo } from './media/organizacao';
import { LeitorJunto } from './media/LeitorJunto';
// Competição (divisão do App.jsx, passo 4): src/competicao/ e partilhados em src/dominio/, src/base/, src/tatico/.
import { NotasDoJogo, TODOS_OS_JOGADORES, comQuemLaEsteve, escalacaoDoJogo, escalacaoNovaFormacao, jogosDeCastigo } from './competicao/Escalacao';
import { buildShareableHtmlDoc, shareOrDownloadHtml } from './base/partilha';
import { dayPresent, dayRating, groupSessionsByDate, playerStats } from './dominio/estatisticas';
import { AlertaRelatorios, PREF_MISSAO_RELATORIOS, consumirMissaoPendente, haMissaoDeRelatorios, missaoPendente, notasDoJogo, pedirNovaMissao, relatoriosEmFalta } from './competicao/RelatoriosJogo';
import { LegendaZonas, activeCompetitionOf, competitionTable, ensureMatchSession, estiloZona, limparEquipaDuplicada, normalizeStandings, parseScore, podarPresencasForaDosConvocados, syncCompetitionConvocatorias, syncCompetitionMatches, syncMatchConvocatoria } from './competicao/dados';
import { CAPTAIN_LABEL, CHECKIN_CODE_LEN, CaptainArmband, LINHAS, genPlayerCode } from './dominio/plantel';
import { ListaMultipla, SubTabs, ToggleBtn, irParaSeparador } from './base/ui-extra';
import { StandingsModal } from './competicao/Classificacao';
import { ConvidadosEditor, SelectAllBar, integrarConvidado, nomesDosConvidados } from './dominio/convidados';
import { jogoNaoJogado, jogosSemEstatisticas } from './dominio/estadoJogos';
import { EquipaEmColunasPrint, FichaJogo, PrintFichaJogo, buildMatchShareHtml } from './competicao/FichaJogo';
import { ASPECT_CAMPO_PRINT, MarcacoesCampoPrint, VIEWBOX_CAMPO_PRINT, campoDaEquipaHtml, equipaDoAmigavel, equipaEmColunasHtml, posCampoPrint } from './tatico/impressaoCampo';
import { MatchModal } from './competicao/MatchModal';
import { Jogos } from './competicao/Jogos';
// Treino (divisão do App.jsx, passo 5): src/treino/, src/plantel/ e partilhados.
import { SessionModal, dayLabel } from './treino/SessionModal';
import { DiagramThumb, DiagramThumbAnimado } from './treino/diagramas';
import { EXERCISE_PHASES, GRUPOS_POSICAO_PRINT, PHASES, ideiaNoPlano, intensityText, planoProximoJogo, useFecharSemSaltar } from './treino/comum';
import { IdeiaJogo } from './treino/IdeiaJogo';
import { ESTILO_BOTAO_PEQUENO, EditorPrancheta, ICONE_BOTAO_PEQUENO, PrancheteDoPlantel } from './plantel/Prancheta';
import { Planeamento, getMonday } from './treino/Planeamento';
import { useDetailBack } from './base/historico';
import { ExercisePresentation } from './treino/ExercisePresentation';
import { RELATO_ACOES, RelatoCampo, ddmm, isoDia, relatoCampoLabel } from './dominio/relato';
import { ChipBtn } from './base/botoes';
import { Exercicios } from './treino/Exercicios';
// Plantel (divisão do App.jsx, passo 6): src/plantel/, src/atleta/ e partilhados.
import { MESES_PT, offerAviso, wellnessAvg } from './plantel/comum';
import { Monitorizacao } from './plantel/Monitorizacao';
import { BigButton, RpeWizard, WellnessWizard, csvEscape } from './atleta/questionarios';
import { RODAPE_MENSAGEM_SISTEMA, linkWhatsApp, semEmojis } from './dominio/mensagens';
import { Presencas } from './plantel/Presencas';
import { BoletimClinico } from './plantel/Clinico';
import { diaAutoLesionado, proximoDiaIso, recalcularOcorrencia } from './plantel/clinicoDados';
import { DI_DIMENSOES, DI_INDICADORES, DesenvolvimentoIndividual, DiQuestionario, diRespondido, diScoreGlobal } from './plantel/Desenvolvimento';
import { PlayerModal, age } from './plantel/PlayerModal';
import { MOBILE_BAR_H, PhotoField } from './base/fotos';
import { COR_CARTAO, MiniCartao, chaveDoTipo, faltaDoAtleta } from './dominio/faltas';
import { Plantel } from './plantel/Plantel';
import { STATUS_OPTIONS, avaliacaoBaseDoJogador, estatutoDaAvaliacao } from './plantel/avaliacao';
// Scouting, Adversários, Tarefas, Diário e Gestão de equipa (divisão do App.jsx, passo 7).
import { DocumentosApp, MARCA_APP } from './gestao/documentos';
import { GestaoEquipa } from './gestao/GestaoEquipa';
import { CHAVE_EQUIPA, GENEROS, corDoMembro, gravarGeneroMembro, gravarTelefoneMembro, registarCoresMembros, selecionarMembros, telefoneValido } from './gestao/membros';
import { CRITERIO_STAFF, caminhoStaff, caminhoVerificavel } from './tarefas/missoesRegras';
import { CTX_TAREFAS_EXTRA, aniversariantesEm, avisaCriadorAoConcluir, conclusaoPorVerPara, destinoMissao, eSemanal, inferirDestinoMissao, jogosParaFichaAdversario, jogosSemIdeias, listaComE, prazoTexto, semanaisPendentes, tarefaAtivaHoje, tarefaFeitaHoje } from './tarefas/regras';
import { isBirthdayToday } from './dominio/aniversarios';
import { Tarefas } from './tarefas/Tarefas';
import { Diario } from './diario/Diario';
import { RATING_LEVELS } from './scouting/comum';
import { useSubColecao } from './base/subcolecao';
import { Scouting } from './scouting/Scouting';
// Atleta: Portal, Check-in e Cacifo (divisão do App.jsx, passo 8).
import { equipaGuardada, guardarEquipa, trocarDeEquipa } from './base/equipaGuardada';
import { CheckinKiosk } from './atleta/CheckinKiosk';
import { splitCompetitionName } from './base/formatos';
import { CheckinApp } from './atleta/CheckinApp';


// Sugestão para o 2.º momento: a transição a seguir ao momento dominante.
const SEGUNDO_MOMENTO_SUGERIDO = {
  'Organização Ofensiva': 'Transição Defensiva', 'Transição Defensiva': 'Organização Defensiva',
  'Organização Defensiva': 'Transição Ofensiva', 'Transição Ofensiva': 'Organização Ofensiva',
};


/* Endereços antigos (#simulador, #convocatorias, #videos, #apresentacoes)
   continuam a abrir alguma coisa em vez de darem página em branco — um
   atalho guardado ou um separador aberto no telemóvel não têm de morrer
   por causa de uma reorganização da navegação. */
const TABS_ANTIGAS = { simulador: 'planeamento', convocatorias: 'jogos', videos: 'biblioteca', apresentacoes: 'biblioteca', estatisticas: 'jogos', analisejogo: 'jogos', fichaadversario: 'scouting', ideiasjogo: 'jogos' };
const tabValida = (id) => TABS_ANTIGAS[id] || id;


/* ---------------------------------------------------------------
   STORAGE HELPERS
---------------------------------------------------------------- */
import { supabase } from './supabaseClient';
import AuthScreen, { PortaStaffAbrir, tirarEntradaStaff, guardarPortaStaff, PEDIU_NOVA_PASSE, staffBioDisponivel, staffBioEstado, staffBioAtivar, staffBioDesativar, staffReporPalavraPasse, FUNCOES_STAFF, BIO_TXT } from './AuthScreen.jsx';


/* Plano da sincronização Análise de Vídeo → fichas (ver o efeito em App). */
function planoSincronizacaoFichas(videos, clipes, adversarios, nomeNossaEquipa) {
  const autos = (videos || []).filter(v => v && v.origemAnalise && v.origemAnalise.auto && v.origemAnalise.clipeId);
  const autoPorClipe = new Map();
  const remover = new Set();
  autos.forEach(v => { if (autoPorClipe.has(v.origemAnalise.clipeId)) remover.add(v.id); else autoPorClipe.set(v.origemAnalise.clipeId, v); });
  const clipesPorId = new Map((clipes || []).filter(Boolean).map(c => [c.id, c]));
  /* Envios À MÃO para a ficha (o botão "Sala de Vídeo › Adversários", de
     antes de os cortes irem sozinhos): passam a ser o mesmo envio. O clipe
     herda a equipa dessa ficha, o vídeo passa a acompanhar o clipe, e se
     já houver os dois na mesma ficha fica só um. */
  const manuaisPorClipe = new Map();
  (videos || []).forEach(v => {
    if (!v || !v.adversarioId || !v.origemAnalise || v.origemAnalise.auto || !v.origemAnalise.clipeId) return;
    const k = v.origemAnalise.clipeId;
    if (!manuaisPorClipe.has(k)) manuaisPorClipe.set(k, []);
    manuaisPorClipe.get(k).push(v);
  });
  const criar = [];
  const atualizar = new Map();
  const marcar = new Map();
  const CAMPOS = ['title', 'dataUrl', 'thumbUrl', 'clipInicio', 'clipFim', 'clipOrigemTitulo', 'adversarioId', 'equipa'];
  (clipes || []).forEach(c => {
    if (!c || c.origem === 'atleta' || !c.publicUrl) return;
    let atual = autoPorClipe.get(c.id);
    const manuais = manuaisPorClipe.get(c.id) || [];
    // Clipe que nunca teve equipa (`equipa` ausente, não null) mas foi
    // enviado à mão para uma ficha: fica com a equipa dessa ficha.
    let equipa = c.equipa;
    let equipaHerdada = null;
    if (equipa === undefined && manuais.length) {
      const f0 = (adversarios || []).find(a => a.id === manuais[0].adversarioId);
      if (f0) { equipa = f0.equipaCompeticao || f0.nome; equipaHerdada = equipa; }
    }
    const ficha = equipa && !ehNossaEquipa(equipa, nomeNossaEquipa) ? fichaDaEquipa(equipa, adversarios) : null;
    if (!ficha) { if (atual) remover.add(atual.id); return; }
    const mesmaFicha = manuais.filter(m => m.adversarioId === ficha.id);
    if (atual) mesmaFicha.forEach(m => remover.add(m.id));
    else if (mesmaFicha.length) {
      // Adota o envio à mão: passa a ser o envio automático deste clipe.
      atual = { ...mesmaFicha[0], origemAnalise: { ...mesmaFicha[0].origemAnalise, auto: true } };
      atualizar.set(atual.id, atual);
      mesmaFicha.slice(1).forEach(m => remover.add(m.id));
    }
    const tag = (TAGS_ANALISE || []).find(t => t.id === c.tagId);
    const titulo = (c.note || '').trim() || (tag && tag.label) || 'Clipe';
    const desejado = {
      title: titulo, kind: 'video', dataUrl: c.publicUrl, thumbUrl: c.thumbUrl || null, fileName: `${titulo}.mp4`,
      clipInicio: typeof c.origemInicio === 'number' ? c.origemInicio : 0,
      clipFim: typeof c.origemFim === 'number' ? c.origemFim : (c.duracao || 0),
      clipOrigemTitulo: c.originalTitulo || '',
      adversarioId: ficha.id, equipa: ficha.equipaCompeticao || ficha.nome || equipa, pasta: '',
    };
    const extra = equipaHerdada ? { equipa: equipaHerdada } : {};
    if (atual) {
      if (atualizar.has(atual.id) || CAMPOS.some(k => (atual[k] ?? null) !== (desejado[k] ?? null))) atualizar.set(atual.id, { ...atual, ...desejado });
      if (equipaHerdada || !c.envioFicha || c.envioFicha.adversarioId !== ficha.id) marcar.set(c.id, { envioFicha: { itemId: atual.id, adversarioId: ficha.id }, ...extra });
      return;
    }
    if (c.envioFicha && c.envioFicha.adversarioId === ficha.id) return; // apagado à mão na ficha: não volta
    const id = uid();
    criar.push({ id, ...desejado, origemAnalise: { clipeId: c.id, auto: true, em: new Date().toISOString() } });
    marcar.set(c.id, { envioFicha: { itemId: id, adversarioId: ficha.id }, ...extra });
  });
  autos.forEach(v => { if (!clipesPorId.has(v.origemAnalise.clipeId)) remover.add(v.id); });
  return { criar, atualizar, remover, marcar };
}

function App({ session, teamId, equipas, equipaAtiva, onNovaEquipa, onEquipasMudaram }) {
  const userId = session.user.id;
  const userEmail = session.user.email;
  const isMobile = useIsMobile();
  const [navOpen, setNavOpen] = useState(false);

  // A app é de uma equipa de cada vez — por isso isto atualiza uma
  // variável partilhada em vez de andar a passar `corEquipa` por
  // props por meia dúzia de componentes (Simulador, Ficha de Jogo,
  // Adversário…). Corre em todos os renders, mas é só atribuir um
  // valor — sem isto, os quadros de posições ficavam sempre com o
  // vermelho de origem, mesmo com outra cor escolhida em "Gerir
  // equipa".
  T.corEquipa = (equipaAtiva && equipaAtiva.cor) || '#B5393F';
  // Pasta da equipa no Storage, para os anexos (ver `enviarAnexoParaStorage`).
  T.equipaId = teamId || '';
  // Logótipo e nome do clube para os documentos Word (cabeçalho/rodapé
  // gerados pela app — ver `aplicarClubeNosModelosWord`).
  T.logoEquipa = (equipaAtiva && equipaAtiva.logo) || '';
  T.nomeClube = String((equipaAtiva && (equipaAtiva.clube || equipaAtiva.nome)) || '').trim();

  /* MENU ABERTO TRANCA A PÁGINA ATRÁS.

     Sem isto, arrastar dentro do menu passava o movimento para a página
     por baixo assim que a lista chegava ao fim — e, no telemóvel, esse
     scroll faz o browser esconder e mostrar a barra do endereço, com o
     ecrã a saltar. `position: fixed` no body é o que trava mesmo em iOS,
     onde só `overflow: hidden` não chega; guardar e repor o `scrollY`
     evita que fechar o menu atire a página para o topo. */
  useEffect(() => {
    if (!navOpen) return undefined;
    const y = window.scrollY;
    const b = document.body.style;
    const antes = { position: b.position, top: b.top, width: b.width, overflow: b.overflow };
    b.position = 'fixed';
    b.top = `-${y}px`;
    b.width = '100%';
    b.overflow = 'hidden';
    return () => {
      b.position = antes.position; b.top = antes.top;
      b.width = antes.width; b.overflow = antes.overflow;
      window.scrollTo(0, y);
    };
  }, [navOpen]);
  /* Ao trocar de secção, voltar ao topo. Sem isto, quem vinha a meio de
     uma lista longa (Planeamento, Jogos) entrava na secção seguinte já
     com o scroll a meio e não via o título nem os botões do topo. Em
     ecrã largo quem faz scroll é o <main>; no telemóvel é a janela. */
  const mainRef = useRef(null);
  /* A secção aberta fica no endereço (#plantel, #jogos…). Assim, ao
     recarregar a página volta-se à mesma secção em vez de ir sempre parar
     à Visão Geral, e os botões de retroceder/avançar do browser passam a
     navegar entre secções. Endereços antigos, sem #, abrem na Visão Geral
     como antes. */
  const [tab, setTab] = useState(() => {
    if (typeof window === 'undefined') return 'geral';
    const fromHash = window.location.hash.replace('#', '').trim();
    return fromHash ? tabValida(fromHash) : 'geral';
  });

  /* Cada secção passa a ser uma entrada no histórico (pushState), para os
     botões de retroceder/avançar do browser andarem entre secções. A
     primeira vez usa replace, para não ficar uma entrada duplicada logo à
     entrada da app. */
  const firstHashRef = useRef(true);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash.replace('#', '') === tab) { firstHashRef.current = false; return; }
    if (firstHashRef.current) {
      window.history.replaceState(null, '', `#${tab}`);
      firstHashRef.current = false;
    } else {
      window.history.pushState(null, '', `#${tab}`);
    }
  }, [tab]);

  // Sempre que muda a secção, o conteúdo recomeça no topo.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (mainRef.current) mainRef.current.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [tab]);

  // Missões com caminho: "Ir para …" pede a troca de separador por aqui.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    // Guarda de onde se saiu (ex.: Tarefas), para fechar a janela da missão e voltar lá.
    const ir = (e) => { if (e && e.detail) { const de = tab; goTab(e.detail); setOrigemMissao(de); } };
    window.addEventListener('mjp-ir-separador', ir);
    return () => window.removeEventListener('mjp-ir-separador', ir);
  });

  // Botões de retroceder/avançar do browser.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onHash = () => {
      const h = window.location.hash.replace('#', '').trim();
      if (h) setTab(tabValida(h));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const [season, setSeason] = useState({ name: '2026/2027', start: '', end: '', club: '' });
  const [seasonReady, setSeasonReady] = useState(false);
  const [previewKiosk, setPreviewKiosk] = useState(false);
  // Quem editou cada secção pela última vez (resumo para a Visão Geral).
  const [lastEdits, setLastEdits] = useState({});
  const notifyEdit = useCallback((table) => {
    setLastEdits(prev => ({ ...prev, [table]: { email: userEmail, at: new Date().toISOString() } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  // Uma linha por registo em cada tabela — dá granularidade de "quem
  // editou ESTE jogador/sessão/jogo", disponível em playersMeta[id], etc.
  const [players, setPlayers, playersReady, playersMeta] = useCollectionSync('players', notifyEdit, teamId);
  /* JOGADORES ATIVOS: quem tem "Data de saída" (até hoje) saiu do clube.
     Fica só no Plantel (ficha + histórico); para tudo o resto — treinos,
     presenças, avaliações, convocatórias, jogos, monitorização, clínico,
     desenvolvimento, tarefas, documentos, Portal… — passa-se esta lista.
     O histórico dele fica gravado nos registos (não se apaga nada). */
  // Todos (com quem saiu), para os jogos/treinos passados mostrarem quem
  // lá esteve de verdade (ver `comQuemLaEsteve`).
  TODOS_OS_JOGADORES.lista = players || [];
  const playersAtivos = React.useMemo(() => {
    const hoje = todayStr();
    return (players || []).filter(p => p && !(p.exitDate && p.exitDate <= hoje));
  }, [players]);
  const [exercises, setExercises, exercisesReady, exercisesMeta] = useCollectionSync('exercises', notifyEdit, teamId);
  // Ideia de Jogo — esquemas táticos do modelo de jogo (tabela "ideias").
  const [ideias, setIdeias, ideiasReady, ideiasMeta] = useCollectionSync('ideias', notifyEdit, teamId);
  const [sessions, setSessions, sessionsReady, sessionsMeta] = useCollectionSync('sessions', notifyEdit, teamId);
  const [monitoring, setMonitoring, monitoringReady, monitoringMeta, autorizarApagarMonitoring] = useCollectionSync('monitoring', notifyEdit, teamId);
  const [matches, setMatches, matchesReady, matchesMeta, autorizarLimparJogos] = useCollectionSync('matches', notifyEdit, teamId);
  // Portal → Plano de Jogo = plano do PRÓXIMO jogo (sai sozinho quando o
  // jogo passa). Só acerta o campo `visivelPlanoJogo` das ideias.
  useSincronizarPlanoPortal(ideias, setIdeias, matches, ideiasReady && matchesReady);
  const [scouting, setScouting, scoutingReady, scoutingMeta] = useCollectionSync('scouting', notifyEdit, teamId);
  // NECESSIDADES (Scouting): ligadas logo ao abrir a app, e não só ao
  // entrar no Scouting — assim a contagem e o 🎯 nos cartões já estão
  // prontos quando se abre o separador (sem aparecerem com atraso).
  const [necApiRaiz, setNecApiRaiz] = useState({ estado: 'a-verificar', itens: [], set: null, pronto: false, autorizar: null });
  const [adversarios, setAdversarios, adversariosReady, adversariosMeta] = useCollectionSync('adversarios', notifyEdit, teamId);
  const [videos, setVideos, videosReady, videosMeta] = useCollectionSync('videos', notifyEdit, teamId);
  const [documentos, setDocumentos, documentosReady, documentosMeta] = useCollectionSync('documentos', notifyEdit, teamId);
  const [videosOriginais, setVideosOriginais, , videosOriginaisMeta] = useCollectionSync('video_originais', notifyEdit, teamId);
  const [clipes, setClipes, clipesReady, clipesMeta] = useCollectionSync('video_clips', notifyEdit, teamId);

  // Upload de vídeo definido aqui (não dentro de AnalisadorVideo) de propósito:
  // este componente nunca desmonta ao trocar de separador, por isso o
  // carregamento continua em segundo plano mesmo que o treinador vá ver
  // outra parte da app enquanto espera.
  const [uploadVideoEstado, setUploadVideoEstado] = useState({ ativo: false, progresso: 0, finalizando: false, erro: '' });
  // O ficheiro já está pronto a servir no Storage? (um link assinado só se
  // consegue criar para um objeto que já existe por inteiro)
  const ficheiroOriginalDisponivel = useCallback(async (caminho) => {
    try {
      const { error } = await supabase.storage.from('videos-originais').createSignedUrl(caminho, 60);
      return !error;
    } catch (e) { return false; }
  }, []);
  /* PREPARAÇÃO (video-worker): pede ao serviço que reorganize o vídeo
     para arrancar depressa. Fogo-e-esquece: não se espera pelo
     processamento (pode demorar minutos), só pela resposta de "aceite".
     Se o serviço não responder ou recusar, o vídeo passa logo a
     disponível tal como veio, em vez de ficar preso em "A preparar…". */
  const prepararOriginal = useCallback(async (novo) => {
    const VIDEO_WORKER_URL = import.meta.env.VITE_VIDEO_WORKER_URL;
    if (!VIDEO_WORKER_URL) {
      setVideosOriginais(prev => (prev || []).map(v => (v.id === novo.id ? { ...v, pronto: true, aguardarStorage: false } : v)));
      return;
    }
    const libertar = (motivo) => setVideosOriginais(prev => (prev || []).map(v => (v.id === novo.id && v.pronto === false
      ? { ...v, pronto: true, aguardarStorage: false, erroPreparacao: motivo }
      : v)));
    const controlo = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const travao = controlo ? setTimeout(() => controlo.abort(), 30000) : null;
    // O serviço só aceita quem tem sessão e é membro da equipa: vai o
    // token da sessão do Supabase (não há chave nenhuma no browser).
    let tokenWorker = '';
    try { const { data: { session: s2 } } = await supabase.auth.getSession(); if (s2 && s2.access_token) tokenWorker = s2.access_token; } catch (e) { /* sem token */ }
    fetch(`${VIDEO_WORKER_URL}/processar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenWorker}` },
      body: JSON.stringify({ teamId, storagePath: novo.storagePath, id: novo.id }),
      ...(controlo ? { signal: controlo.signal } : {}),
    }).then((r) => {
      if (!r.ok) libertar(`O serviço de preparação recusou o vídeo (${r.status}) — ficou disponível tal como foi carregado.`);
    }).catch(() => {
      libertar('O serviço de preparação não respondeu — o vídeo ficou disponível tal como foi carregado.');
    }).finally(() => { if (travao) clearTimeout(travao); });
  }, [teamId, setVideosOriginais]);
  /* CONFIRMAR MAIS TARDE: um vídeo enviado que o Supabase ainda não
     disponibilizou. Volta a confirmar de 15 em 15 segundos durante 30
     minutos; quando aparecer, segue para a preparação normal. Se a
     página for recarregada a meio, o efeito logo abaixo retoma. */
  const aConfirmarRef = useRef(new Set());
  const confirmarOriginalDepois = useCallback((novo) => {
    if (!novo || aConfirmarRef.current.has(novo.id)) return;
    aConfirmarRef.current.add(novo.id);
    const inicio = new Date(novo.criadoEm || Date.now()).getTime();
    const LIMITE_MS = 30 * 60 * 1000;
    const tentar = async () => {
      if (await ficheiroOriginalDisponivel(novo.storagePath)) {
        aConfirmarRef.current.delete(novo.id);
        setVideosOriginais(prev => (prev || []).map(v => (v.id === novo.id ? { ...v, aguardarStorage: false } : v)));
        prepararOriginal(novo);
        return;
      }
      if (Date.now() - inicio > LIMITE_MS) {
        aConfirmarRef.current.delete(novo.id);
        setVideosOriginais(prev => (prev || []).map(v => (v.id === novo.id
          ? { ...v, aguardarStorage: false, pronto: true, erroPreparacao: 'O Supabase não chegou a disponibilizar este ficheiro. Apaga-o e volta a carregar o vídeo.' }
          : v)));
        return;
      }
      setTimeout(tentar, 15000);
    };
    setTimeout(tentar, 15000);
  }, [ficheiroOriginalDisponivel, prepararOriginal, setVideosOriginais]);
  useEffect(() => {
    (videosOriginais || []).filter(v => v && v.aguardarStorage && v.storagePath).forEach(confirmarOriginalDepois);
  }, [videosOriginais, confirmarOriginalDepois]);
  /* RECUPERAR um vídeo que ficou no Storage sem registo (o caso antigo
     acima). Cria o registo e segue para a preparação normal. */
  const recuperarOriginal = useCallback((caminho, titulo, tamanho) => {
    const novo = {
      id: uid(), storagePath: caminho, titulo: titulo || 'Vídeo recuperado', tamanho: tamanho || null,
      criadoEm: new Date().toISOString(), pronto: false,
    };
    setVideosOriginais(prev => [...(prev || []), novo]);
    prepararOriginal(novo);
  }, [setVideosOriginais, prepararOriginal]);
  const iniciarUploadVideo = useCallback(async (file, nomePersonalizado) => {
    setUploadVideoEstado({ ativo: true, progresso: 0, finalizando: false, erro: '' });
    // Pede ao telemóvel para não apagar o ecrã enquanto o vídeo envia — em
    // muitos telemóveis, o ecrã apagar-se corta a ligação de rede do
    // browser a meio do envio. Não existe em todos os browsers/telemóveis;
    // se não estiver disponível, o envio continua na mesma, só sem esta
    // proteção extra. Não ajuda se a pessoa sair da app para outra.
    let wakeLock = null;
    const reAdquirirWakeLock = async () => {
      if (document.visibilityState === 'visible' && 'wakeLock' in navigator) {
        try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* não crítico */ }
      }
    };
    document.addEventListener('visibilitychange', reAdquirirWakeLock);
    try {
      if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) { /* não crítico — segue sem o wake lock */ }
    try {
      const nomeLimpo = file.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9.\-]/g, '_');
      const caminho = `${teamId}/${uid()}-${nomeLimpo}`;
      // Confirma já que o browser consegue ler o ficheiro (renomeado ou
      // mexido depois de escolhido, aberto noutro programa, ou só "na
      // nuvem" do OneDrive/Drive dá "Failed to fetch" sem explicação).
      // Um vídeo pode ter vários GB, por isso só se lê o primeiro bocado.
      try { await file.slice(0, 1024).arrayBuffer(); } catch (e) {
        throw new Error('O computador não deixou ler o vídeo. Fecha-o noutros programas, confirma que está guardado no computador e escolhe-o outra vez.');
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada — sai e entra na app outra vez.');
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      // Endereço direto de storage — evita o gateway (Kong), recomendado
      // pela Supabase para ficheiros grandes. Ajuda tanto à velocidade
      // como à fiabilidade: menos um salto de rede onde algo pode falhar,
      // sobretudo em ligações móveis menos estáveis.
      const SUPABASE_URL_STORAGE_DIRETO = SUPABASE_URL.replace('.supabase.co', '.storage.supabase.co');
      await new Promise((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: `${SUPABASE_URL_STORAGE_DIRETO}/storage/v1/upload/resumable`,
          retryDelays: [0, 1000, 3000, 5000, 10000, 20000, 30000, 60000, 90000, 120000, 120000], // mais paciência — dá até 2 min entre tentativas para quebras de rede mais longas
          headers: { 'x-upsert': 'false' },
          // Um vídeo grande pode demorar mais de uma hora a enviar — e o
          // "bilhete" (token) da sessão expira ao fim de uma hora. Sem
          // isto, o token ficava fixo desde o início e o envio começava a
          // ser recusado a meio, com ficheiros grandes. Assim, pede-se um
          // token válido a cada pedido — o próprio Supabase renova-o
          // sozinho por trás se já estiver perto de expirar.
          onBeforeRequest: async (req) => {
            const { data: { session: sessaoAtual } } = await supabase.auth.getSession();
            if (sessaoAtual?.access_token) req.setHeader('Authorization', `Bearer ${sessaoAtual.access_token}`);
          },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          metadata: { bucketName: 'videos-originais', objectName: caminho, contentType: file.type || 'video/mp4', cacheControl: '3600' },
          chunkSize: 24 * 1024 * 1024, // pedaços maiores — com ligação estável, menos pedidos = menos tempo perdido em conversa com o servidor (3GB a 24MB são pouco mais de 125 pedidos)
          onError: (err) => reject(err),
          onProgress: (enviados, total) => setUploadVideoEstado(s => ({ ...s, progresso: Math.round((enviados / total) * 100) })),
          onSuccess: () => resolve(),
        });
        upload.findPreviousUploads().then((anteriores) => {
          if (anteriores.length) upload.resumeFromPreviousUpload(anteriores[0]);
          upload.start();
        });
      });

      // O tus dá o envio por terminado assim que o último byte chega, mas
      // para ficheiros grandes o Supabase ainda demora um pouco a "arrumar"
      // isso como um objeto pronto a servir. Confirma-se aqui antes de
      // mostrar o vídeo como disponível, em vez de arriscar um "Object not
      // found" logo a seguir.
      setUploadVideoEstado(s => ({ ...s, finalizando: true }));
      let pronto = false;
      for (let tentativa = 0; tentativa < 15 && !pronto; tentativa++) {
        if (await ficheiroOriginalDisponivel(caminho)) { pronto = true; break; }
        await new Promise(r => setTimeout(r, 4000));
      }

      /* ANTES: se o Supabase demorasse mais de 1 minuto a "arrumar" o
         ficheiro (acontece com vídeos grandes), dava erro e o registo do
         vídeo NUNCA era criado: o ficheiro ficava no Storage, enviado, mas
         a app não sabia dele e ele não aparecia sozinho, ao contrário do
         que a mensagem dizia. AGORA o registo é sempre criado; se ainda
         não estiver disponível, fica "A preparar…" e a app continua a
         confirmar em segundo plano (ver `confirmarOriginalDepois`). */
      const novo = {
        id: uid(), storagePath: caminho, titulo: (nomePersonalizado && nomePersonalizado.trim()) || file.name.replace(/\.[^.]+$/, ''),
        tamanho: file.size, criadoEm: new Date().toISOString(),
        // pronto:false até o video-worker (serviço à parte) confirmar que já
        // reorganizou o ficheiro para arrancar depressa. Chega sozinho via
        // Realtime quando o worker atualizar este registo — não é preciso
        // ir consultar nada aqui.
        pronto: false,
        ...(pronto ? {} : { aguardarStorage: true }),
      };
      const VIDEO_WORKER_URL = import.meta.env.VITE_VIDEO_WORKER_URL;
      /* REDE DE SEGURANÇA: sem worker configurado, ninguém viria marcar o
         vídeo como pronto e ele ficava "A preparar…" para sempre no
         Analisador. Nesse caso fica disponível logo, tal como veio. */
      if (!VIDEO_WORKER_URL && pronto) novo.pronto = true;
      setVideosOriginais(prev => [...(prev || []), novo]);
      setUploadVideoEstado({ ativo: false, progresso: 100, finalizando: false, erro: '' });

      if (pronto) prepararOriginal(novo);
      else confirmarOriginalDepois(novo);
    } catch (e) {
      /* 413 = o ficheiro passa o limite de tamanho do Supabase (o limite
         global do projeto em Storage > Settings, ou o do próprio bucket).
         Mensagem clara em vez do texto técnico do tus. */
      const msg = String((e && e.message) || e || '');
      const gb = file && file.size ? (file.size / 1e9).toFixed(2).replace('.', ',') : '';
      const erro = /\b413\b|maximum size exceeded/i.test(msg)
        ? `O vídeo${gb ? ` (${gb} GB)` : ''} é maior do que o limite de tamanho definido no Supabase. Aumenta o limite em Storage › Settings (e no bucket "videos-originais") ou carrega um ficheiro mais pequeno.`
        : `Não consegui carregar o vídeo: ${msg}`;
      setUploadVideoEstado({ ativo: false, progresso: 0, finalizando: false, erro });
    } finally {
      document.removeEventListener('visibilitychange', reAdquirirWakeLock);
      wakeLock?.release().catch(() => {});
    }
  }, [teamId, setVideosOriginais, ficheiroOriginalDisponivel, prepararOriginal, confirmarOriginalDepois]);
  // O Canal (Biblioteca) mostra só os vídeos gerais — os de um adversário
  // (Scouting) ficam de fora daqui, sem se perderem: ver `useSubColecao`.
  const [videosGerais, setVideosGerais] = useSubColecao(videos, setVideos, v => !v.adversarioId && !v.scoutId);
  // Referências para o botão partilhado da Biblioteca (na mesma linha dos
  // separadores) conseguir abrir "adicionar" em quem estiver visível, sem
  // duplicar o botão dentro de cada sub-aba.
  const canalRef = useRef(null);
  const apresentacoesRef = useRef(null);
  const documentosRef = useRef(null);
  const [apresentacoes, setApresentacoes, apresentacoesReady, apresentacoesMeta] = useCollectionSync('apresentacoes', notifyEdit, teamId);
  const [convocatorias, setConvocatorias, convocatoriasReady, convocatoriasMeta, autorizarLimparConvocatorias] = useCollectionSync('convocatorias', notifyEdit, teamId);
  const [diario, setDiario, diarioReady, diarioMeta] = useCollectionSync('diario', notifyEdit, teamId);
  /* Uma ocorrência por registo — poucos campos, poucos bytes. Atenção:
     é preciso criar as políticas RLS da tabela `clinico` no Supabase, ou
     as gravações falham em SILÊNCIO, sem erro nenhum. */
  const [clinico, setClinico, clinicoReady, clinicoMeta, autorizarApagarClinico] = useCollectionSync('clinico', notifyEdit, teamId);
  const [tarefas, setTarefas, tarefasReady] = useCollectionSync('tarefas', notifyEdit, teamId);
  /* ALERTA DE ANIVERSÁRIO — AUTOMÁTICO, SEM NINGUÉM TER DE CRIAR NADA.

     Em vez de pedir ao treinador para criar à mão a tarefa recorrente
     "Aniversário de jogador" (ver `tarefaAtivaHoje`), a app garante
     sozinha que ela existe: assim que as Tarefas desta equipa carregam,
     se não houver nenhuma com essa recorrência, cria-se uma automaticamente.
     A partir daí segue o mecanismo já existente — aparece sozinha,
     com notificação, em qualquer dia em que um jogador faça anos,
     puxando só da data de nascimento em Editar Jogador. Corre uma vez
     por equipa (a própria condição impede duplicar em cada arranque).

     A criação escreve DIRETO no Supabase (`insert`), em vez de passar por
     `setTarefas` — de propósito: `setTarefas` alimenta o efeito de
     gravação genérico de `useCollectionSync`, que no fim chama
     `notifyEdit('tarefas')` e faz esta criação automática aparecer em
     "Última atividade" como se fosse uma ação de quem tem a app aberta
     nesse momento, o que confundia (parecia teres criado uma tarefa sem
     te lembrares). Escrevendo direto, a subscrição de Realtime já
     existente traz a tarefa nova para `tarefas` sozinha, sem passar pelo
     caminho que dispara essa notificação — a tarefa continua a
     criar-se e a funcionar exatamente na mesma, só não aparece ali. */
  useEffect(() => {
    if (!tarefasReady || !teamId) return;
    const jaExiste = (tarefas || []).some(t => t.recorrencia && t.recorrencia.tipo === 'aniversario');
    if (jaExiste) return;
    const registo = {
      titulo: 'Há aniversário no plantel 🎉',
      notas: 'Criada automaticamente pela app — aparece sozinha em qualquer dia em que um jogador do plantel faça anos (precisa da data de nascimento completa em Editar Jogador).',
      responsavel: '',
      estado: 'aberta',
      recorrencia: { tipo: 'aniversario' },
      criadoEm: new Date().toISOString(),
    };
    supabase.from('tarefas').insert([{ id: uid(), data: registo, team_id: teamId }])
      .then(({ error }) => { if (error) console.error('tarefas (auto aniversário)', error); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefasReady, teamId]);

  /* PONTO DE PARTIDA DA CONTAGEM DA SEQUÊNCIA — "a partir de agora", não
     desde sempre. Guardado em `season.streakDesde` (mais um campo na
     Época, que já é um singleton por equipa — não precisa de tabela
     nova). Só se define UMA vez, na primeira vez que a equipa abre a
     app depois desta funcionalidade existir; a partir daí só muda
     quando alguém bate a marca (ver o efeito seguinte), nunca sozinho. */
  useEffect(() => {
    if (!seasonReady) return;
    if (season.streakDesde) return;
    setSeason(prev => ({ ...prev, streakDesde: todayStr() }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonReady]);

  /* PRÉMIO DA SEQUÊNCIA (META_SEQUENCIA dias seguidos — eram 30, agora
     60) — mesmo mecanismo do aniversário: a app garante sozinha que a
     tarefa existe, sem ninguém ter de a criar à mão, e escreve DIRETO no
     Supabase pela mesma razão (ver o comentário grande ali em cima).

     "AUTÓNOMO E DENTRO DO HORÁRIO": um dia conta se houver WELLNESS desse
     dia respondido pelo próprio jogador (o PSE não entra na contagem; ver
     `diaAutonomoCompleto`).
     O quiosque (`?checkin=1`) já só aceita responder no PRÓPRIO dia e
     dentro da janela horária (ver CHECKIN_WINDOWS/CHECKIN_ALLOW_BACKFILL)
     — por isso um Wellness feito por ali já é, por definição, autónomo e
     a horas. O que falta filtrar é só o oposto: um Wellness que o staff
     tenha preenchido à mão em Monitorização.

     Para saber quem gravou cada registo, existe `updated_by_email` —
     confirmado nos dados reais desta equipa: fica vazio quando é o
     quiosque a gravar (sem sessão autenticada) e só tem email quando é
     staff autenticado.

     "O PRIMEIRO A CHEGAR É PREMIADO E A CONTAGEM RECOMEÇA PARA TODOS":
     a contagem de cada jogador nunca olha para trás de `season.streakDesde`.
     O dia do feito de cada jogador é o dia em que completou a meta
     (início da sequência + META − 1). Ganha quem tiver o dia do feito
     mais cedo; se forem vários no MESMO dia, são todos premiados (todos
     chegaram primeiro). Nesse momento a ronda recomeça para a equipa
     inteira a partir do dia seguinte ao feito — não do dia em que a app
     foi aberta: se o staff só abrir a app uns dias depois, quem continuou
     a responder nesses dias não perde esses dias na ronda nova. */
  useEffect(() => {
    if (!tarefasReady || !monitoringReady || !playersReady || !seasonReady || !teamId) return;
    const desde = season.streakDesde || todayStr();
    const chegaram = [];
    (players || []).forEach(p => {
      const { dias, inicio } = sequenciaAutonomaCompleta(p.id, monitoring, monitoringMeta, null, desde);
      if (dias < META_SEQUENCIA) return;
      chegaram.push({ p, dias, inicio, diaFeito: addDays(inicio, META_SEQUENCIA - 1) });
    });
    if (!chegaram.length) return;
    const primeiroDia = chegaram.reduce((min, c) => (c.diaFeito < min ? c.diaFeito : min), chegaram[0].diaFeito);
    chegaram.filter(c => c.diaFeito === primeiroDia).forEach(({ p, inicio }) => {
      // A mesma sequência (mesmo dia de início) só cria a tarefa uma vez.
      const jaExiste = (tarefas || []).some(t => (t.marco === 'streak60' || t.marco === 'streak30') && t.playerId === p.id && t.streakInicio === inicio);
      if (jaExiste) return;
      const registo = {
        titulo: `O jogador chegou aos ${META_SEQUENCIA} dias seguidos a responder ao Wellness. Foi o primeiro — tem de ser premiado`,
        notas: `${p.name} respondeu sozinho, dentro do horário, ao Wellness durante ${META_SEQUENCIA} dias seguidos (de ${formatShortDatePt(inicio)} a ${formatShortDatePt(primeiroDia)}). Foi o primeiro do plantel a chegar à marca; a contagem recomeçou para todos a ${formatShortDatePt(addDays(primeiroDia, 1))}.`,
        responsavel: '',
        estado: 'aberta',
        marco: 'streak60',
        playerId: p.id,
        jogadorNome: p.name,
        streakInicio: inicio,
        diaFeito: primeiroDia,
        criadoEm: new Date().toISOString(),
      };
      supabase.from('tarefas').insert([{ id: uid(), data: registo, team_id: teamId }])
        .then(({ error }) => { if (error) console.error('tarefas (auto streak60)', error); });
    });
    // Recomeça a ronda para toda a equipa no dia seguinte ao feito.
    const novoDesde = addDays(primeiroDia, 1);
    setSeason(prev => (prev.streakDesde === novoDesde ? prev : { ...prev, streakDesde: novoDesde }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefasReady, monitoringReady, playersReady, seasonReady, teamId, monitoring, tarefas, players, season.streakDesde]);

  // Momentos de avaliação do Desenvolvimento Individual. Guarda os
  // momentos e, dentro de cada um, um registo por jogador — não duplica o
  // plantel, referencia-o pelo id.
  /* O quinto valor autoriza uma remoção em massa. É preciso aqui porque
     apagar um momento apaga também a linha de cada jogador — dezenas de
     registos de uma vez, que o travão de segurança bloquearia. */
  const [desenvolvimento, setDesenvolvimento, desenvolvimentoReady, desenvolvimentoMeta, autorizarApagarMomento] = useCollectionSync('desenvolvimento', notifyEdit, teamId);
  // Classificação/resultados da competição — registo único, atualizado
  // manualmente (jornada a jornada), partilhado por toda a equipa técnica.
  const [standings, setStandings, standingsReady, standingsMeta] = useSingletonSync(
    'league_standings', { competition: '', teams: [], rounds: [] }, notifyEdit, teamId
  );

  /* LIMPEZA DOS JOGOS DUPLICADOS — ao nível da app, não de um ecrã.

     Estava dentro do separador Jogos, e por isso só corria quando esse
     separador era aberto: quem entrasse nas Presenças ou nas Convocatórias
     via os duplicados na mesma. Aqui corre uma vez, assim que os dados
     estão carregados, e vale para a app inteira.

     `jogosLimpos` garante que não volta a correr: sem essa marca, cada
     gravação disparava uma nova verificação em cadeia. */
  const jogosLimpos = useRef(false);
  useEffect(() => {
    if (jogosLimpos.current || !matchesReady || !(matches || []).length) return;
    const limpo = limparJogosDuplicados(matches);
    jogosLimpos.current = true;
    if (limpo.length !== matches.length) {
      console.warn(`Jogos duplicados juntados: ${matches.length} → ${limpo.length}`);
      // Esta remoção É deliberada — sem isto, o travão de segurança do
      // useCollectionSync bloqueia sempre que há 3 ou mais duplicados,
      // e a limpeza nunca chega a gravar-se (ver comentário no travão).
      autorizarLimparJogos();
      setMatches(limpo);
    }
  }, [matchesReady, matches, setMatches, autorizarLimparJogos]);

  /* SESSÕES DE JOGO EM FALTA — MESMA IDEIA DA LIMPEZA ALI EM CIMA, AGORA
     PARA SESSÕES.

     `ensureMatchSession` só corre quando um jogo é gravado a partir de
     Jogos ou de Planeamento. Um jogo que entra sozinho a partir das
     jornadas da competição (`syncCompetitionMatches`, ao gravar a
     Classificação) nunca passava por ali — ficava sem sessão associada,
     e sem sessão o PSE do dia não aparece no check-in dos atletas
     (mesmo já se corrigindo isso nesses dois sítios, os jogos criados
     ANTES da correção continuavam por sarar).

     Corre uma vez, assim que jogos e sessões estão carregados, e cobre
     TODOS os jogos já existentes de uma vez — não só os que vierem a
     ser gravados a partir de agora. `sessoesDeJogoGarantidas` garante
     que não volta a correr em cadeia a cada gravação. */
  const sessoesDeJogoGarantidas = useRef(false);
  useEffect(() => {
    if (sessoesDeJogoGarantidas.current || !matchesReady || !sessionsReady) return;
    sessoesDeJogoGarantidas.current = true;
    const antes = sessions || [];
    const depois = (matches || []).reduce((acc, m) => ensureMatchSession(m, acc), antes);
    if (depois.length !== antes.length) {
      console.warn(`Sessões de jogo criadas em falta: ${depois.length - antes.length}`);
      setSessions(depois);
    }
  }, [matchesReady, sessionsReady, matches, sessions, setSessions]);

  const loading = !seasonReady || !playersReady || !exercisesReady || !ideiasReady || !sessionsReady || !monitoringReady
    || !matchesReady || !scoutingReady || !adversariosReady || !videosReady || !apresentacoesReady || !convocatoriasReady || !diarioReady
    || !desenvolvimentoReady || !standingsReady || !clinicoReady || !tarefasReady || !documentosReady;

  // O questionário (Wellness/RPE) abre em ecrã inteiro, sem a barra
  // lateral, quando o link inclui ?checkin=1 (links antigos, já
  // partilhados) ou ?portal=<id-da-equipa> (links novos, mais curtos e
  // com o nome do próprio Portal do Atleta) — é este o link a
  // partilhar com os atletas. O botão "Pré-visualizar" na
  // Monitorização ativa o mesmo ecrã sem precisar de editar o URL
  // (útil para testar aqui).
  const isCheckin = previewKiosk || (typeof window !== 'undefined' &&
    (window.location.search.includes('checkin') || window.location.hash.includes('checkin')
      || window.location.search.includes('portal=') || window.location.hash.includes('portal=')));

  // Mesma protecção contra o ciclo save→realtime→save descrita em
  // useSingletonSync: a Época tem os seus próprios efeitos (é anterior ao
  // hook genérico) e sofria exatamente do mesmo problema.
  const seasonSyncedRef = useRef(null);
  const seasonRowIdRef = useRef(null);

  useEffect(() => {
    if (!teamId) return;
    (async () => {
      /* A época por omissão deixou de nomear um clube. Antes dizia
         "SC Salgueiros · Sub-19", o que era razoável quando havia uma
         equipa só e passaria a ser errado em todas as outras. O clube
         verdadeiro vem da equipa. */
      const s = await loadSingleton('season_config', {
        name: '', start: '', end: '',
        club: [equipaAtiva && equipaAtiva.clube, equipaAtiva && equipaAtiva.escalao].filter(Boolean).join(' · '),
      }, teamId);
      seasonRowIdRef.current = s.rowId;
      seasonSyncedRef.current = jsonEstavel(s.value);
      setSeason(s.value);
      setLastEdits(prev => ({ ...prev, season_config: s.editedBy ? { email: s.editedBy, at: s.editedAt } : undefined }));
      // Mesma regra do useSingletonSync: leitura falhada não autoriza
      // gravar, para a época por omissão não ir por cima da verdadeira.
      if (s.ok) setSeasonReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  useEffect(() => {
    if (!seasonReady || !teamId) return;
    const signature = jsonEstavel(season);
    if (signature === seasonSyncedRef.current) return;
    seasonSyncedRef.current = signature;
    saveSingleton('season_config', season, teamId, seasonRowIdRef.current);
    if (!seasonRowIdRef.current) seasonRowIdRef.current = teamId;
    notifyEdit('season_config');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, seasonReady, teamId]);

  // Recebe em tempo real as alterações à Época feitas por outra pessoa.
  useEffect(() => {
    if (!teamId) return undefined;
    const channel = supabase.channel(`season_config_rt_${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'season_config', filter: `team_id=eq.${teamId}` }, (payload) => {
        const row = payload.new;
        if (!row) return;
        const signature = jsonEstavel(row.data);
        if (signature === seasonSyncedRef.current) return; // eco da nossa própria gravação
        seasonSyncedRef.current = signature;
        seasonRowIdRef.current = row.id;
        setSeason(row.data);
        setLastEdits(prev => ({ ...prev, season_config: { email: row.updated_by_email, at: row.updated_at } }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teamId]);

  // Garante que todos os jogadores têm um código pessoal de acesso ao
  // questionário (login individual, privado — cada atleta só vê o seu
  // próprio nome, nunca a lista do plantel). Atribui automaticamente a
  // quem ainda não tiver.
  useEffect(() => {
    if (loading) return;
    setPlayers(prev => {
      const used = new Set(prev.filter(p => p.code).map(p => p.code));
      let changed = false;
      const next = prev.map(p => {
        if (p.code) return p;
        changed = true;
        return { ...p, code: genPlayerCode(used) };
      });
      return changed ? next : prev;
    });
  }, [players, loading]);

  /* A BARRA LATERAL NÃO PODE CRESCER PARA SEMPRE.

     Com dezasseis separadores a lista já não cabia num portátil e ganhava
     scroll — e uma navegação que se percorre a rolar deixa de se ler de
     relance, que é a única coisa que uma navegação tem de fazer.

     Três saíram daqui, cada uma por uma razão própria e não só por causa
     do espaço:

     · Simulador — nunca foi um destino. Lê a sessão do dia e escreve-lhe
       as equipas de volta. Agora abre-se do cartão do dia, no
       Planeamento, já com a data certa.
     · Convocatórias — nascem com o jogo (ver `syncMatchConvocatoria`, que
       já lhes mantém adversário, data e jornada sincronizados). São a
       outra vista do mesmo jogo, e vivem dentro de Jogos.
     · TV e Apresentações — duas bibliotecas de media com o
       mesmo comportamento. Juntaram-se numa. */
  /* ANTES DO `NAV`, DE PROPÓSITO.

     O `NAV` calcula o badge das Tarefas com `euId`. Um `const` só existe
     a partir da linha onde é declarado — declará-lo depois dava
     "Cannot access before initialization" e a app inteira parava, sem
     pista de onde. Ficam aqui, encostados a quem os usa. */
  const euId = session && session.user && session.user.id;
  const { membros, recarregar: recarregarMembros } = useMembros(teamId);

  /* O QUE A PORTA DA EQUIPA TÉCNICA MOSTRA ANTES DE HAVER SESSÃO (nome,
     clube, cor, emblema, formação do último jogo), guardado neste
     aparelho. Só lê dados; não grava nada no Supabase. */
  useEffect(() => {
    if (!membros || !userEmail) return;
    try {
      const eu = membros.find(m => m.user_id === euId) || {};
      const hoje = todayStr();
      const ultimo = (matches || [])
        .filter(m => m && m.formacao && m.date && m.date <= hoje)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
      // Os números das camisolas do último onze, pela ordem dos lugares da
      // formação (a mesma que a porta usa para pôr os ímanes).
      let numeros = '';
      if (ultimo && Array.isArray(ultimo.starters) && ultimo.starters.length) {
        const titulares = ultimo.starters.map(id => (players || []).find(p => p.id === id)).filter(Boolean);
        const { colocados } = distribuirOnzeNoCampo(titulares, ultimo.formacao, ultimo.alinhamento);
        numeros = colocados.map(p => (p && p.number != null && String(p.number).trim() !== '' ? String(p.number).trim() : '')).join(',');
      }
      const ep = String((season && season.name) || '');
      const mEp = ep.match(/^(\d{4})\/(\d{2})(\d{2})$/);
      guardarPortaStaff({
        email: userEmail,
        uid: euId || '',
        nome: String(eu.nome || '').trim(),
        funcao: String(eu.funcao || '').trim(),
        souDono: eu.papel === 'owner',
        clube: String((equipaAtiva && (equipaAtiva.clube || equipaAtiva.nome)) || '').trim(),
        epoca: mEp ? `${mEp[1]}/${mEp[3]}` : ep,
        cor: (equipaAtiva && equipaAtiva.cor) || '#B5393F',
        logo: (equipaAtiva && equipaAtiva.logo) || '',
        formacao: ultimo ? ultimo.formacao : '',
        numeros,
      });
    } catch (e) { /* a porta fica com o que já tinha */ }
  }, [membros, euId, userEmail, equipaAtiva, matches, season, players]);

  CTX_TAREFAS_EXTRA.adversarios = adversarios || [];
  CTX_TAREFAS_EXTRA.adversariosMeta = adversariosMeta || {};
  const NAV = [
    { id: 'geral', label: 'Visão Geral', icon: LayoutGrid },
    { id: 'plantel', label: 'Plantel', icon: Users },
    { id: 'exercicios', label: 'Exercícios', icon: Dumbbell },
    { id: 'ideiajogo', label: 'Ideia de Jogo', icon: Lightbulb },
    { id: 'planeamento', label: 'Planeamento', icon: CalendarDays },
    { id: 'presencas', label: 'Presenças', icon: UserCheck },
    { id: 'clinico', label: 'Boletim Clínico', icon: Stethoscope },
    { id: 'jogos', label: 'Jogos', icon: Trophy },
    { id: 'analise', label: 'Análise de Vídeo', icon: Video },
    { id: 'monitorizacao', label: 'Monitorização', icon: Activity },
    { id: 'desenvolvimento', label: 'Desenvolvimento', icon: TrendingUp },
    { id: 'scouting', label: 'Scouting', icon: Search },
    { id: 'biblioteca', label: 'Sala de Vídeo', icon: Tv },
    { id: 'tarefas', label: 'Tarefas', icon: ClipboardList, badge: tarefasAMinhaPorta(tarefas, euId, { sessions, matches, players, monitoring }) },
    { id: 'diario', label: 'Diário', icon: BookOpen },
    { id: 'documentos', label: 'Documentos', icon: FileSpreadsheet },
  ];


  /* Qual das duas bibliotecas está aberta. Um #videos ou #apresentacoes
     antigo não só abre a Biblioteca como escolhe a sub-aba certa. */
  const [biblioteca, setBiblioteca] = useState(() => {
    if (typeof window === 'undefined') return 'videos';
    const h = window.location.hash.replace('#', '').trim();
    if (h === 'apresentacoes') return 'apresentacoes';
    return 'videos';
  });
  /* O id pedido ANTES de ser redirecionado. É o que permite a um
     #convocatorias antigo abrir Jogos já na sub-aba certa. */
  /* Separador de onde se abriu uma missão ("Ir para …", ex.: das Tarefas).
     Fechar a janela que a missão abriu volta a esse separador. */
  const [origemMissao, setOrigemMissao] = useState(null);
  const [tabPedida, setTabPedida] = useState(() => {
    if (typeof window === 'undefined') return 'geral';
    return window.location.hash.replace('#', '').trim() || 'geral';
  });
  /* PROVAS das missões da equipa técnica: em que tabelas procurar, por
     caminho. Ver `missaoStaffFeita`. */
  const provasMissoes = {
    email: userEmail,
    matches,
    metas: {
      analise: [videosMeta, videosOriginaisMeta, clipesMeta],
      scouting: [scoutingMeta, adversariosMeta],
      planeamento: [sessionsMeta],
      presencas: [sessionsMeta, matchesMeta],
      jogos: [convocatoriasMeta, matchesMeta],
      monitorizacao: [monitoringMeta],
      desenvolvimento: [desenvolvimentoMeta],
      ideiajogo: [ideiasMeta],
      exercicios: [exercisesMeta],
      clinico: [clinicoMeta],
      biblioteca: [videosMeta, apresentacoesMeta],
      documentos: [documentosMeta],
      fichaadversario: [adversariosMeta],
      ideiasjogo: [matchesMeta],
      diario: [diarioMeta],
    },
  };
  /* FECHO AUTOMÁTICO: na app da pessoa responsável, cada missão sua com
     caminho fecha-se quando aparece a prova. Grava como concluída (com o
     aviso a quem criou), e o resto da equipa vê-a fechada. */
  useEffect(() => {
    if (!tarefasReady || !euId) return;
    const hoje = todayStr();
    const agora = new Date().toISOString();
    const ctxM = { sessions, matches, players, monitoring };
    const fechar = new Map(); // id -> { feita } | { bases: [] }
    (tarefas || []).forEach(t => {
      if (!t || t.jogadorId || t.responsavel !== euId || !caminhoVerificavel(t)) return;
      if (eSemanal(t)) {
        const bases = semanaisPendentes(t, hoje).filter(o => missaoStaffFeita(t, o.base, provasMissoes)).map(o => o.base);
        if (bases.length) fechar.set(t.id, { bases });
      } else if (t.recorrencia) {
        if (tarefaAtivaHoje(t, hoje, ctxM) && !tarefaFeitaHoje(t, hoje) && missaoStaffFeita(t, null, provasMissoes)) fechar.set(t.id, { bases: [hoje] });
      } else if (t.estado !== 'feita' && missaoStaffFeita(t, null, provasMissoes)) {
        fechar.set(t.id, { feita: true });
      }
    });
    if (!fechar.size) return;
    setTarefas(prev => prev.map(r => {
      const f = fechar.get(r.id);
      if (!f) return r;
      const aviso = avisaCriadorAoConcluir(r, euId) ? { conclusaoPorVer: { por: euId, em: agora } } : {};
      if (f.feita) return { ...r, estado: 'feita', feitaEm: agora, fechoAutomatico: true, lembrete: null, ...aviso };
      // O aviso a quem criou também nas que se repetem (antes só nas semanais).
      return { ...r, concluidasEm: [...new Set([...(r.concluidasEm || []), ...f.bases])], lembrete: null, ...aviso };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefas, tarefasReady, euId, userEmail, matches, videosMeta, videosOriginaisMeta, clipesMeta, scoutingMeta, adversariosMeta, sessionsMeta, matchesMeta, convocatoriasMeta, monitoringMeta, desenvolvimentoMeta, ideiasMeta, exercisesMeta, clinicoMeta, apresentacoesMeta, documentosMeta]);

  /* TAREFAS "AUTOAVALIAÇÃO" SEM NADA PARA RESPONDER. Uma tarefa criada
     com um momento do Desenvolvimento fica sem sentido se o momento foi
     apagado, FECHADO, ou se o jogador foi tirado desse momento: no Portal aparecia
     a tarefa, o jogador abria-a e o ecrã dizia que não havia nenhuma
     autoavaliação. Essas tarefas saem sozinhas aqui. Só corre com as
     duas listas carregadas e com o Desenvolvimento não vazio, para nunca
     apagar tarefas por causa de uma lista que ainda não chegou. */
  useEffect(() => {
    if (!tarefasReady || !desenvolvimentoReady) return;
    const dev = desenvolvimento || [];
    if (!dev.length) return;
    // Só contam os momentos ABERTOS: o Portal (checkin_desenvolvimento)
    // não mostra o questionário de um momento fechado.
    const momentos = new Set(dev.filter(x => x && x.tipo === 'momento' && !x.fechado).map(x => x.id));
    const registos = new Set(dev.filter(x => x && x.tipo === 'registo').map(x => `${x.momentoId}|${x.playerId}`));
    const orfa = (t) => t && t.origemMomento && t.jogadorId && t.estado !== 'feita'
      && (!momentos.has(t.origemMomento) || !registos.has(`${t.origemMomento}|${t.jogadorId}`));
    if (!(tarefas || []).some(orfa)) return;
    setTarefas(prev => (prev || []).filter(t => !orfa(t)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefas, tarefasReady, desenvolvimento, desenvolvimentoReady]);

  /* CLIPES DA ANÁLISE DE VÍDEO → SALA DE VÍDEO (Canal).
     O clipe já é um MP4 no Storage (videos-clipes): passa a ser também um
     vídeo do Canal, sem novo upload. Leva os tempos do jogo de onde saiu
     (clipInicio/clipFim = minuto no vídeo original) e o título desse
     vídeo, para aparecer junto do jogo certo. Num adversário, vai para a
     FICHA da equipa — e vê-se também no Canal › Adversários. */
  const destinosSala = React.useMemo(() => {
    const pastas = Array.from(new Set((videos || [])
      .filter(v => v && !v.adversarioId && v.categoria !== 'jogo' && v.categoria !== 'adversario' && cleanFolder(v.pasta) && semAcentos(cleanFolder(v.pasta)) !== 'adversarios')
      .map(v => cleanFolder(v.pasta)))).sort((a, b) => a.localeCompare(b, 'pt'));
    const jogos = [...(matches || [])].filter(m => m && m.opponent)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .map(m => ({ id: m.id, rotulo: [m.jornada, `vs ${m.opponent}`, m.date ? fmtDate(m.date) : ''].filter(Boolean).join(' · ') }));
    const fichas = [...(adversarios || [])].filter(a => a && a.nome)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
      .map(a => ({ id: a.id, rotulo: a.nome }));
    /* Equipas das competições criadas na app que ainda NÃO têm ficha de
       adversário (sem a nossa) — para o "+ Nova equipa" na Análise de Vídeo
       se escolher de uma lista em vez de escrever. */
    const nossa = String((equipaAtiva && (equipaAtiva.clube || equipaAtiva.nome)) || '').trim();
    const equipasSemFicha = Array.from(new Set(nomesEquipasCompeticao(standings) || []))
      .filter(n => n && !ehNossaEquipa(n, nossa) && !fichaDaEquipa(n, adversarios))
      .sort((a, b) => a.localeCompare(b, 'pt'));
    return { pastas, jogos, fichas, equipasSemFicha };
  }, [videos, matches, adversarios, standings, equipaAtiva]);
  // Clipes da Análise que estão a ser usados na Sala de Vídeo (para não
  // se apagar o ficheiro deles quando são apagados na Análise).
  // Os enviados sozinhos para a ficha (origemAnalise.auto) não contam: esses
  // acompanham o clipe, e saem da ficha quando o clipe é apagado.
  const clipesUsadosNaSala = React.useMemo(() => new Set((videos || [])
    .filter(v => v && v.origemAnalise && !v.origemAnalise.auto)
    .map(v => v.origemAnalise.clipeId).filter(Boolean)), [videos]);

  /* CORTES DA ANÁLISE DE VÍDEO → FICHA DO ADVERSÁRIO, SOZINHOS.

     Cada corte com uma equipa (escolhida na Análise ao cortar) tem na
     ficha dessa equipa um vídeo que aponta para o mesmo MP4, marcado
     `origemAnalise.auto`. Esta sincronização mantém os dois iguais:
     corte novo → entra na ficha; corte editado (texto, tempos, etiqueta,
     equipa) → a ficha atualiza; corte apagado → sai da ficha. Se alguém
     apagar o vídeo diretamente na ficha, não volta a ser criado
     (`envioFicha` no clipe lembra-se de que já lá esteve).
     Só corre com as três listas carregadas, para nunca apagar nada por
     causa de uma lista que ainda não chegou. */
  const nomeNossaEquipa = String((equipaAtiva && (equipaAtiva.clube || equipaAtiva.nome)) || '').trim();
  useEffect(() => {
    if (!videosReady || !clipesReady || !adversariosReady) return;
    const { criar, atualizar, remover, marcar } = planoSincronizacaoFichas(videos, clipes, adversarios, nomeNossaEquipa);
    if (!criar.length && !atualizar.size && !remover.size) {
      if (marcar.size) setClipes(prev => (prev || []).map(c => (marcar.has(c.id) ? { ...c, ...marcar.get(c.id) } : c)));
      return;
    }
    setVideos(prev => [...criar, ...(prev || []).filter(v => !remover.has(v.id)).map(v => atualizar.get(v.id) || v)]);
    if (marcar.size) setClipes(prev => (prev || []).map(c => (marcar.has(c.id) ? { ...c, ...marcar.get(c.id) } : c)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos, clipes, adversarios, videosReady, clipesReady, adversariosReady, nomeNossaEquipa]);

  /* Pedido da Análise de Vídeo: "esta equipa tem ficha?". Se tiver,
     responde logo; se não, abre a mesma janela da Sala de Vídeo para a
     criar ou associar a uma ficha com outro nome. */
  const [pedidoFichaAnalise, setPedidoFichaAnalise] = useState(null); // { equipa, equipas, titulo, resolver }
  const garantirFichaAdversario = useCallback(({ equipa, equipas, titulo }) => new Promise((resolver) => {
    if (fichaDaEquipa(equipa, adversarios)) { resolver({ equipa, equipas }); return; }
    setPedidoFichaAnalise({ equipa, equipas, titulo, resolver });
  }), [adversarios]);
  const confirmarFichaAnalise = ({ equipas: eqs, equipa, fichaExistenteId, nova }) => {
    const pedido = pedidoFichaAnalise;
    if (!pedido || !equipa) return;
    let ficha = fichaDaEquipa(equipa, adversarios);
    const existente = !ficha && fichaExistenteId ? (adversarios || []).find(a => a.id === fichaExistenteId) : null;
    if (existente) {
      ficha = { ...existente, equipaCompeticao: equipa };
      setAdversarios(prev => (prev || []).map(a => (a.id === existente.id ? { ...a, equipaCompeticao: equipa } : a)));
    }
    if (!ficha && nova) {
      ficha = {
        id: idFichaAutomatica(teamId, equipa), nome: equipa, equipaCompeticao: equipa,
        escalao: (nova.escalao || '').trim(), prova: (nova.prova || '').trim(),
        pontosFortes: '', pontosFracos: '', notas: '',
        jogadoresChaveIds: [], quadroTatica: TATICA_OMISSAO, quadroOverrides: {}, taticas: [],
      };
      const nova0 = ficha;
      setAdversarios(prev => ((prev || []).some(a => a.id === nova0.id || fichaRepetida(nova0.nome, [a])) ? prev : [...(prev || []), nova0]));
    }
    setPedidoFichaAnalise(null);
    pedido.resolver(ficha ? { equipa, equipas: eqs } : null);
  };
  /* Ficha de adversário criada NA HORA a partir da Análise de Vídeo (envio
     de um clipe para Adversários quando a equipa ainda não tem ficha): só
     o nome. Se já houver uma com esse nome, devolve essa. Devolve o nome
     com que a ficha aparece (o da equipa do clipe). */
  const criarFichaAdversario = (nome) => {
    const n = String(nome || '').trim();
    if (!n) return null;
    let f = fichaDaEquipa(n, adversarios) || (adversarios || []).find(a => fichaRepetida(n, [a])) || null;
    if (!f) {
      f = {
        id: idFichaAutomatica(teamId, n), nome: n, equipaCompeticao: n,
        escalao: '', prova: '', pontosFortes: '', pontosFracos: '', notas: '',
        jogadoresChaveIds: [], quadroTatica: TATICA_OMISSAO, quadroOverrides: {}, taticas: [],
      };
      const nova0 = f;
      setAdversarios(prev => ((prev || []).some(a => a.id === nova0.id || fichaRepetida(nova0.nome, [a])) ? prev : [...(prev || []), nova0]));
    }
    return f.equipaCompeticao || f.nome;
  };
  const enviarClipeParaSala = ({ clip, titulo, destino, pasta, jogoId, fichaId, fichaNova }) => {
    if (!clip || !clip.publicUrl) throw new Error('Este clipe não tem vídeo guardado.');
    const base = {
      id: uid(), title: (titulo || '').trim() || 'Clipe', kind: 'video', dataUrl: clip.publicUrl,
      thumbUrl: clip.thumbUrl || null, fileName: `${(titulo || 'clipe').trim()}.mp4`,
      clipInicio: typeof clip.origemInicio === 'number' ? clip.origemInicio : 0,
      clipFim: typeof clip.origemFim === 'number' ? clip.origemFim : (clip.duracao || 0),
      clipOrigemTitulo: clip.originalTitulo || '',
      origemAnalise: { clipeId: clip.id, em: new Date().toISOString() },
    };
    let item;
    if (destino === 'jogo') {
      const m = (matches || []).find(x => x.id === jogoId);
      if (!m) throw new Error('Escolhe o jogo.');
      item = { ...base, categoria: 'jogo', jogoId: m.id, jornada: m.jornada || '', pasta: '' };
    } else if (destino === 'adversario') {
      /* FICHA NOVA a partir da Análise de Vídeo: só com o nome. Se já houver
         uma ficha com esse nome, usa-se essa (não se duplica). O resto da
         ficha (escalão, prova, jogadores…) preenche-se depois em Scouting ›
         Adversários. */
      let f = (adversarios || []).find(x => x.id === fichaId);
      const nomeNovo = fichaNova && String(fichaNova.nome || '').trim();
      if (!f && nomeNovo) {
        f = fichaDaEquipa(nomeNovo, adversarios) || (adversarios || []).find(a => fichaRepetida(nomeNovo, [a])) || null;
        if (!f) {
          f = {
            id: idFichaAutomatica(teamId, nomeNovo), nome: nomeNovo, equipaCompeticao: nomeNovo,
            escalao: '', prova: '', pontosFortes: '', pontosFracos: '', notas: '',
            jogadoresChaveIds: [], quadroTatica: TATICA_OMISSAO, quadroOverrides: {}, taticas: [],
          };
          const nova0 = f;
          setAdversarios(prev => ((prev || []).some(a => a.id === nova0.id || fichaRepetida(nova0.nome, [a])) ? prev : [...(prev || []), nova0]));
        }
      }
      if (!f) throw new Error(fichaNova ? 'Escreve o nome da equipa.' : 'Escolhe a equipa.');
      item = { ...base, adversarioId: f.id, equipa: f.equipaCompeticao || f.nome, pasta: '' };
    } else {
      if (!(pasta || '').trim()) throw new Error('Escolhe ou escreve a pasta.');
      item = { ...base, categoria: 'tema', pasta: cleanFolder(pasta) };
    }
    setVideos(prev => [item, ...(prev || [])]);
    return item;
  };

  /* Pedido "abrir o plano deste jogo" (CartaoPlanoDoJogo, em qualquer
     ecrã de jogo): vai para Ideia de Jogo e abre lá o Portal › Plano de
     Jogo desse jogo. */
  const [planoPedido, setPlanoPedido] = useState(null);
  const goTabRef = useRef(null);
  useEffect(() => {
    const ao = (e) => {
      const id = e && e.detail && e.detail.jogoId;
      if (!id) return;
      setPlanoPedido(id);
      if (goTabRef.current) goTabRef.current('ideiajogo');
    };
    window.addEventListener('mjp:abrir-plano', ao);
    return () => window.removeEventListener('mjp:abrir-plano', ao);
  }, []);
  const goTab = (id) => {
    setOrigemMissao(null);
    /* Trocar de separador na barra lateral pode desmontar um ecrã que
       tinha uma "marca" própria no histórico do browser (Portal do
       Atleta, um simulador, etc. — ver `useDetailBack`). Ao desmontar,
       esses ecrãs tentam "limpar" a marca deles chamando
       `window.history.back()` sozinhos — o que faz sentido quando se
       fecham por si (o X, ou o próprio botão Voltar deles), mas aqui
       não: era isso que fazia o clique em "Planeamento" saltar de
       volta para "Ideia de Jogo" sozinho, porque o retroceder do
       histórico desfazia a troca de separador que acabou de acontecer.
       `modalHandoffAtivo` avisa esses ecrãs para não tentarem limpar
       nada — a navegação está a ser tratada aqui, pela troca de
       separador em si. */
    definirModalHandoff(true);
    setTimeout(() => { definirModalHandoff(false); }, 0);
    setTabPedida(id);
    if (id === 'videos' || id === 'apresentacoes') setBiblioteca(id);
    setTab(tabValida(id));
    setNavOpen(false);
  };
  goTabRef.current = goTab;

  if (loading) {
    return <LoadingGate />;
  }

  if (isCheckin) {
    return (
      <div style={{ background: T.bg, minHeight: '100vh', ...body }}>
        <style>{`
          ${FONTS}
          * { box-sizing: border-box; }
        /* TOQUE NO TELEMÓVEL: sem o retângulo de realce do browser à volta do
           que se toca, e sem o contorno de foco quando se usa o dedo/rato (o
           contorno continua para quem navega com o teclado). */
        * { -webkit-tap-highlight-color: transparent; }
        button, a, [role="button"], summary, label, input[type="checkbox"], input[type="radio"] { touch-action: manipulation; }
        :focus:not(:focus-visible) { outline: none; }
        button:focus:not(:focus-visible), [role="button"]:focus:not(:focus-visible), [tabindex]:focus:not(:focus-visible) { outline: none; }
        svg g[role="button"]:focus { outline: none; }

          /* ARRASTAMENTO LATERAL NO TELEMÓVEL.

             Basta um elemento a passar uns pixéis da largura do ecrã — uma
             tabela larga, uma imagem — para a página inteira poder ser
             arrastada de lado. Fica com a sensação de estar solta e é
             fácil perder a coluna onde se estava a ler.

             Cortar aqui trava isso de uma vez, em toda a app. As zonas que
             PRECISAM de rolar na horizontal (tabelas de presenças,
             classificação) têm o seu próprio overflow-x:auto e
             continuam a funcionar, porque o corte é só ao nível da
             página. */
          html, body { max-width: 100%; overflow-x: hidden; overscroll-behavior-x: none; background: ${T.bg}; }
          /* Em computador, quem desloca é sempre o <main> (tem o seu
             próprio scroll interno, já sem barra visível — classe
             .mjp-scroll-fino, mais abaixo) — a própria página (html/body)
             nunca precisa de deslocar-se por cima disso, mas às vezes
             ficava 1-2px mais alta do que o ecrã e mostrava a sua
             própria barra, a mais, encostada à borda direita do browser.
             Só se aplica a computador — no telemóvel é a própria página
             que desloca (o <main> não tem scroll próprio aí). */
          @media (min-width: 860px) {
            html, body { overflow-y: hidden; }
          }
          /* Reserva sempre o espaço da barra de scroll vertical — ver o
             mesmo comentário em CheckinApp/moldura. Sem isto, trocar de
             ecrã aqui na pré-visualização (Pré-visualizar, no separador
             Monitorização) também fazia o conteúdo saltar de lado. */
          html { scrollbar-gutter: stable; }
          ::selection { background: ${T.gold}55; }
          input:focus, select:focus, textarea:focus { border-color: ${T.gold} !important; }
          /* Lista nativa das caixas de escolha (ex.: a nota nas Presenças): sem
             isto, em alguns Windows/Chrome abria BRANCA com o texto claro por
             cima — parecia um "flash" branco vazio. */
          select { color-scheme: ${TEMA_ATUAL === 'claro' ? 'light' : 'dark'}; }
          select option, select optgroup { background-color: ${T.surface}; color: ${T.cream}; } @keyframes mjpEntrar { from { opacity: 0; } to { opacity: 1; } }
          @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
          /* Sem barra nenhuma — nem fina, nem grossa. Continua tudo a
             deslocar-se na mesma (arrasto, roda do rato, gesto no
             telemóvel); só deixa de haver qualquer traço a desenhar-se
             por cima da tabela. Usado nas tabelas largas que precisam
             de deslocamento próprio (Presenças, Classificação). */
          .mjp-scroll-fino::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
          .mjp-scroll-fino { scrollbar-width: none !important; -ms-overflow-style: none !important; }
        `}</style>
        {previewKiosk && (
          <button onClick={() => setPreviewKiosk(false)} style={{
            position: 'fixed', top: 14, right: 14, zIndex: 50, display: 'flex', alignItems: 'center', gap: 6,
            background: T.surface, border: `1px solid ${T.line}`, color: T.cream, borderRadius: 8,
            padding: '8px 12px', cursor: 'pointer', ...body, fontSize: 12.5,
          }}>
            <X size={14} /> Fechar pré-visualização
          </button>
        )}
        {/* Pré-visualização para o treinador ver o que o atleta vê.

            Aqui NÃO se passa pelas funções checkin_* — o treinador já está
            autenticado e tem acesso normal às tabelas. Escolhe-se um
            jogador do plantel (o primeiro com código) só para o ecrã ter
            alguém a quem se referir, e grava-se pelo caminho habitual.

            A alternativa seria pedir o código de um atleta ao treinador,
            o que não faz sentido: ele não os sabe de cor e não é esse o
            objetivo da pré-visualização. */}
        <CheckinKiosk
          player={sortByPosition(players)[0]}
          monitoring={monitoring}
          sessions={sessions}
          onSave={(type, fields, date) => {
            const jogador = sortByPosition(players)[0];
            if (!jogador) return;
            setMonitoring(prev => {
              const i = prev.findIndex(m => m.playerId === jogador.id && m.date === date && m.type === type);
              const entrada = { playerId: jogador.id, date, type, ...fields };
              if (i >= 0) {
                const copia = [...prev];
                copia[i] = { ...prev[i], ...entrada };
                return copia;
              }
              return [...prev, { ...entrada, id: uid() }];
            });
          }}
          onLogout={() => setPreviewKiosk(false)}
        />
      </div>
    );
  }

  /* QUADRO TÁTICO — em ecrã inteiro de propósito, sem a barra lateral
     nem o cabeçalho normal: precisa do campo o maior possível, e um
     menu ao lado só tirava espaço a um quadro que é para ser usado ao
     vivo, com o dedo ou a caneta. Por isso este "return" antecipado,
     antes do resto da app com barra lateral — o mesmo truque que o
     ecrã do quiosque (`isCheckin`) já usa ali em cima. */
  if (tab === 'quadrotatico') {
    return (
      <QuadroTaticoLivre
        teamId={teamId}
        notifyEdit={notifyEdit}
        onClose={() => setTab('geral')}
      />
    );
  }

  /* Pede o ecrã inteiro JÁ AQUI, no próprio clique — antes de sequer
     mudar de separador. Se se deixasse para dentro do QuadroTaticoLivre
     (só depois de montar), o ecrã desenhava-se primeiro no tamanho
     normal e só DEPOIS saltava para ecrã inteiro — daí a instabilidade
     ao entrar. Pedir aqui, de forma síncrona dentro do próprio clique
     (o browser só aceita pedidos de ecrã inteiro assim, em resposta
     direta a um gesto do utilizador), evita esse salto: já entra
     diretamente no tamanho final. */
  const abrirQuadroTatico = () => {
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    setTab('quadrotatico');
  };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', ...body }}>
      <style>{`
        ${FONTS}
        * { box-sizing: border-box; }
        /* TOQUE NO TELEMÓVEL: sem o retângulo de realce do browser à volta do
           que se toca, e sem o contorno de foco quando se usa o dedo/rato (o
           contorno continua para quem navega com o teclado). */
        * { -webkit-tap-highlight-color: transparent; }
        button, a, [role="button"], summary, label, input[type="checkbox"], input[type="radio"] { touch-action: manipulation; }
        :focus:not(:focus-visible) { outline: none; }
        button:focus:not(:focus-visible), [role="button"]:focus:not(:focus-visible), [tabindex]:focus:not(:focus-visible) { outline: none; }
        svg g[role="button"]:focus { outline: none; }
        ::selection { background: ${T.gold}55; }
        .navbtn:hover { background: ${T.surfaceRaise}; }
        @keyframes brilhoQuadroTatico {
          0%, 100% { box-shadow: 0 4px 14px rgba(0,0,0,0.45), 0 0 0 0 ${T.gold}55; }
          50% { box-shadow: 0 4px 14px rgba(0,0,0,0.45), 0 0 0 7px ${T.gold}00; }
        }
        .botao-quadro-tatico { animation: brilhoQuadroTatico 2.6s ease-in-out infinite; }
        /* Painel de edição do elemento selecionado (Baliza, Texto, etc.):
           rola na horizontal mas NUNCA cresce na vertical por causa disso.
           Sem isto, quando o conteúdo era mais largo que o ecrã (caso da
           Baliza e da caixa de texto, que têm mais controlos), o browser
           acrescentava uma barra de scroll horizontal e essa barra empurrava
           a altura do painel para além do espaço reservado — o que fazia o
           ResizeObserver do editor recalcular e o campo encolher visivelmente
           mesmo com a altura mínima já reservada. Esconder a barra (o painel
           continua a arrastar-se na horizontal com o dedo) tira essa
           variável da equação. */
        .mjp-painel-selecao { scrollbar-width: none; -ms-overflow-style: none; }
        .mjp-painel-selecao::-webkit-scrollbar { display: none; height: 0; }
        .navbtn.active { background: ${T.surfaceRaise}; border-left: 3px solid ${T.gold}; }
        /* PÁGINAS QUE "SALTAVAM" DE LADO (todas as abas).
           1) O <main> — quem faz o scroll das páginas em computador — usa a
              classe .mjp-scroll-fino para NÃO mostrar barra. Só que as
              regras dessa classe só existiam no ecrã do check-in, não na
              app principal: a barra aparecia sempre que uma página ficava
              mais alta do que o ecrã (abrir "Mostrar mais", mudar um filtro
              nos Exercícios…) e desaparecia ao encolher — e cada vez o
              conteúdo todo encolhia/alargava uns 15px. Agora não há barra:
              o scroll continua igual (roda do rato, trackpad, teclado).
           2) Listas e painéis com scroll próprio (lista de cortes, painéis,
              janelas): passam a reservar SEMPRE o espaço da barra, apareça
              ela ou não — o conteúdo lá dentro deixa de mexer. Apanha
              qualquer contentor com overflow automático, também os que
              venham a ser criados. */
        .mjp-scroll-fino::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
        .mjp-scroll-fino { scrollbar-width: none !important; -ms-overflow-style: none !important; }
        [style*="overflow-y: auto"], [style*="overflow-y: scroll"], [style*="overflow: auto"] { scrollbar-gutter: stable; }
        input:focus, select:focus, textarea:focus { border-color: ${T.gold} !important; }
        /* Lista nativa das caixas de escolha (ex.: a nota nas Presenças): sem
           isto, em alguns Windows/Chrome abria BRANCA com o texto claro por
           cima — parecia um "flash" branco vazio. */
        select { color-scheme: ${TEMA_ATUAL === 'claro' ? 'light' : 'dark'}; }
        select option, select optgroup { background-color: ${T.surface}; color: ${T.cream}; } @keyframes mjpEntrar { from { opacity: 0; } to { opacity: 1; } }
        table { border-collapse: collapse; width: 100%; }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
        html { -webkit-text-size-adjust: 100%; }
        @media (max-width: 860px) { input, select, textarea { font-size: 16px !important; } }
        .print-sheet { display: none; }
        /* Marca MisterJP: só na impressão, no canto inferior direito de
           CADA folha (um elemento fixo repete-se em todas as páginas). */
        .mjp-marca-impressao { display: none; }
        @media print {
          .mjp-marca-impressao {
            display: block !important; position: fixed; right: 0; bottom: 0;
            font: 700 7pt Arial, sans-serif; color: #9a9a9a; letter-spacing: .03em;
            background: transparent; z-index: 2147483647;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          @page { size: A4; margin: 12mm; }

          /* PÁGINA EM BRANCO NO FIM — porquê e como se resolve.

             Antes escondia-se a app com visibility:hidden. Isso torna-a
             invisível mas NÃO a tira do fluxo: continua a ocupar a altura
             toda que ocupava no ecrã, e a impressora conta essa altura como
             papel. Daí sair sempre pelo menos uma folha vazia a seguir ao
             conteúdo.

             display:none tira mesmo do fluxo. A folha de impressão vive
             fora da app (é montada diretamente no body), por isso pode ser
             a única coisa que sobra. */
          html, body {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #fff !important;
          }
          body > *:not(.print-sheet):not(.mjp-marca-impressao) { display: none !important; }

          .print-sheet {
            display: block !important;
            position: static;
            width: 100%; max-width: 172mm; padding: 0; margin: 0;
            color: #111; background: #fff;
          }
          /* Cheguei a pôr aqui um "break-after: avoid" nos títulos, para
             nenhum ficar sozinho no fim de uma folha. Revertido: quando o
             que vem a seguir ao título é grande (um exercício com
             diagrama, por exemplo) e não cabe no resto da folha, o
             browser em vez de só empurrar esse conteúdo, empurra o
             TÍTULO JUNTO — e por vezes isso deixa uma folha praticamente
             em branco, o que é bem pior do que um título sozinho de vez
             em quando. */
          .print-sheet h2, .print-sheet h3 { font-family: 'Oswald', sans-serif; }
          .print-sheet svg { break-inside: avoid; page-break-inside: avoid; }
          /* Nada gera quebra de página por si só; só o conteúdo é que decide. */
          .print-sheet > *:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>
      {/* Marca MisterJP em todas as impressões e PDFs (ver o estilo acima). */}
      {createPortal(<div className="mjp-marca-impressao" aria-hidden="true">{MARCA_APP}</div>, document.body)}

      {/* Em ecrã largo a página não faz scroll: a barra lateral e o conteúdo
          têm cada um o seu próprio scroll, para o menu não fugir enquanto se
          lê uma lista longa. Em mobile mantém-se o scroll normal da página,
          porque o menu é um painel deslizante. */}
      <div style={{
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        ...(isMobile ? { minHeight: '100vh' } : { height: '100vh', overflow: 'hidden' }),
      }}>

        {/* TOP BAR — só em mobile: hamburger + emblema, substitui a barra
            lateral fixa. Usa position:fixed (e não sticky) porque dentro de
            um contentor flex o sticky não segurava a barra ao fazer scroll;
            o espaçador a seguir compensa a altura da barra. */}
        {isMobile && <div style={{ height: MOBILE_BAR_H, flexShrink: 0 }} />}
        {isMobile && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, height: MOBILE_BAR_H,
            zIndex: 40, display: 'flex', alignItems: 'center', gap: 10, boxSizing: 'border-box',
            padding: '12px 14px', background: T.surface, borderBottom: `1px solid ${T.line}`,
          }}>
            <button
              onClick={() => setNavOpen(v => !v)}
              aria-label="Menu"
              style={{
                width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: T.surfaceRaise, border: `1px solid ${T.line}`, borderRadius: 8, color: T.cream, cursor: 'pointer',
              }}
            >
              <LayoutGrid size={18} />
            </button>
            {equipaAtiva && equipaAtiva.logo ? (
              <img data-mjp-logo-equipa="" src={equipaAtiva.logo} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
            ) : null}
            {/* Nome da equipa ativa (era o texto fixo "SC Salgueiros U19", que
                aparecia em todas as equipas). Mesma regra da barra lateral. */}
            <span style={{ ...display, color: T.textoForte, fontSize: 15, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(equipaAtiva && (equipaAtiva.clube || equipaAtiva.nome)) || 'MisterJP'}
            </span>
          </div>
        )}

        <SyncErrorBanner />

        {/* Sombra/overlay atrás do menu retrátil, para fechar ao tocar fora */}
        {isMobile && navOpen && (
          <div onClick={() => setNavOpen(false)} style={{
            position: 'fixed', inset: 0, background: '#000000aa', zIndex: 45,
            touchAction: 'none', overscrollBehavior: 'contain',
          }} />
        )}

        {/* SIDEBAR — fixa em ecrã largo; em mobile passa a painel deslizante (drawer) */}
        <aside style={{
          // 240 em vez de 220: o email, o sol e o Sair cabem na mesma linha sem cortar o email.
          width: 240, background: T.surface, borderRight: `1px solid ${T.line}`,
          flexShrink: 0, display: 'flex', flexDirection: 'column',
          ...(isMobile ? {
            position: 'fixed', top: 0, left: 0, height: '100dvh', zIndex: 50,
            transform: navOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s ease', boxShadow: navOpen ? '4px 0 24px #00000066' : 'none',
            // Trava o encadeamento do scroll: chegar ao fim da lista não
            // passa o movimento para a página por baixo.
            overscrollBehavior: 'contain',
            // Mais largo no telemóvel — com 220 o nome da equipa não cabia
            // ao lado do botão de fechar.
            width: 'min(290px, 86vw)',
          } : { height: '100vh', overflow: 'hidden' }),
        }}>
          <div style={{ padding: '22px 20px 16px', borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* O nome da equipa deixou de estar escrito no código. Vem da
                equipa ativa, e é ao mesmo tempo o seletor — estar sempre
                à vista é a única defesa contra marcar presenças na equipa
                errada, que é um erro silencioso e plausível. */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                {/* O emblema do Salgueiros era uma constante no ficheiro.
                    Agora vem da equipa; sem logótipo definido, não se
                    mostra emblema nenhum — melhor do que mostrar o de
                    outro clube. */}
                {equipaAtiva && equipaAtiva.logo ? (
                  <img data-mjp-logo-equipa="" src={equipaAtiva.logo} alt="" style={{ width: 26, height: 26, objectFit: 'contain', flexShrink: 0 }} />
                ) : null}
                <span style={{ ...display, color: T.textoForte, fontSize: 17, fontWeight: 600, letterSpacing: '.02em', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(equipaAtiva && (equipaAtiva.clube || equipaAtiva.nome)) || 'Mister JP'}
                </span>
              </div>
              <div style={{ marginTop: 6 }}>
                <SeletorEquipa
                  equipas={equipas || []}
                  equipaAtiva={teamId}
                  onNova={onNovaEquipa}
                  onGerir={() => goTab('equipa')}
                />
              </div>
            </div>
            {isMobile && (
              <button onClick={() => setNavOpen(false)} aria-label="Fechar menu" style={{
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 8, color: T.muted, cursor: 'pointer', flexShrink: 0,
              }}><X size={16} /></button>
            )}
          </div>
          <nav className="mjp-scroll-fino" style={{ padding: '10px 0', flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
            {NAV.map(n => (
              <button
                key={n.id}
                className={`navbtn ${tab === n.id ? 'active' : ''}`}
                onClick={() => goTab(n.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                  padding: '9px 20px', background: 'transparent', border: 'none',
                  borderLeft: '3px solid transparent', color: tab === n.id ? T.cream : T.muted,
                  cursor: 'pointer', fontSize: 13.5, fontWeight: 500, textAlign: 'left', ...body,
                }}
              >
                <n.icon size={16} color={tab === n.id ? T.warn : T.mutedDim} />
                {n.label}
                {/* O badge conta todas as tarefas atribuídas a mim (ou
                    sem responsável) que ainda não estão concluídas —
                    é a notificação de "tens tarefas à tua espera"; só
                    desaparece quando a tarefa é marcada como feita,
                    não quando o prazo passa. Ver `tarefasAMinhaPorta`. */}
                {n.badge > 0 && (
                  <span style={{
                    marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9, padding: '0 5px',
                    background: T.crimsonBright, color: TEXT_ON_ACCENT, ...mono, fontSize: 10.5,
                    display: 'grid', placeItems: 'center', flexShrink: 0,
                  }}>{n.badge}</span>
                )}
              </button>
            ))}
            {/* QUADRO TÁTICO — mesmo estilo e sequência dos outros itens
                do menu, com um ícone próprio (quadro tático: X's e seta)
                em vez de um ícone genérico da lib. */}
            <button
              onClick={abrirQuadroTatico}
              aria-label="Abrir o Quadro Tático"
              title="Quadro Tático"
              className="navbtn"
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                padding: '9px 20px', background: 'transparent', border: 'none',
                borderLeft: '3px solid transparent', color: T.muted,
                cursor: 'pointer', fontSize: 13.5, fontWeight: 500, textAlign: 'left', ...body,
              }}
            >
              <svg viewBox="2.5 3.5 19 17" width="16" height="16" fill="none" stroke={T.mutedDim} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 5.5l4 4M8.5 5.5l-4 4" />
                <path d="M15.5 15l4 4M19.5 15l-4 4" />
                <circle cx="5.5" cy="18" r="1.6" />
                <path d="M7.3 16.6c2.5-2 4.3-4.8 6.2-8.9" />
                <path d="M11.9 6.3l2.1-.5.5 2.3" />
              </svg>
              Quadro Tático
            </button>
          </nav>
          <div style={{ padding: '14px 20px', borderTop: `1px solid ${T.line}` }}>
            {/* Email inteiro, sol/lua e Sair na mesma linha. Se um email
                for mais comprido do que o espaço, parte antes do "@"
                (nunca é cortado com reticências). */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
              <div title={session.user.email} style={{ fontSize: 10.5, color: T.mutedDim, lineHeight: 1.35, minWidth: 0, overflowWrap: 'anywhere' }}>
                {(() => { const e = session.user.email || ''; const k = e.indexOf('@'); return k > 0 ? <>{e.slice(0, k)}<wbr />{e.slice(k)}</> : e; })()}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={trocarTema}
                  title={ROTULO_TROCA_TEMA}
                  aria-label={ROTULO_TROCA_TEMA}
                  style={{ color: T.muted, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 6, padding: '4px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <IconeTema size={13} />
                </button>
                <button
                  onClick={() => supabase.auth.signOut()}
                  style={{ fontSize: 10.5, color: T.muted, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', ...body }}
                >
                  Sair
                </button>
              </div>
            </div>
            <DataTools
              season={season} setSeason={setSeason} players={players} setPlayers={setPlayers}
              exercises={exercises} setExercises={setExercises} ideias={ideias} setIdeias={setIdeias}
              sessions={sessions} setSessions={setSessions}
              monitoring={monitoring} setMonitoring={setMonitoring} matches={matches} setMatches={setMatches}
              scouting={scouting} setScouting={setScouting} videos={videos} setVideos={setVideos}
              apresentacoes={apresentacoes} setApresentacoes={setApresentacoes}
              clinico={clinico} setClinico={setClinico}
              desenvolvimento={desenvolvimento} setDesenvolvimento={setDesenvolvimento}
              standings={standings} setStandings={setStandings}
              convocatorias={convocatorias} setConvocatorias={setConvocatorias} diario={diario} setDiario={setDiario}
            />
          </div>
        </aside>

        {/* MAIN */}
        {/* O <main> ocupa toda a largura restante — é ele que faz o scroll,
            por isso a barra de deslocamento fica encostada à direita do
            ecrã. O limite de largura do conteúdo passou para o <div> de
            dentro; antes estava no próprio <main> e sobrava uma faixa
            escura à direita, fora da zona com scroll. */}
        <main ref={mainRef} data-mjp-app="" className="mjp-scroll-fino" style={{
          flex: 1, minWidth: 0,
          ...(isMobile ? {} : { overflowY: 'auto', height: '100vh' }),
        }}>
        {/* Sem limite de largura em ecrã largo: o conteúdo acompanha a
            janela, já que a barra lateral ocupa a parte esquerda. */}
        <div style={{ maxWidth: '100%', padding: isMobile ? '18px 14px 60px' : '28px 32px 60px' }}>
          <TreinosParaEditorCtx.Provider value={{ sessions, players, matches, epoca: season && season.name }}>
          {tab === 'geral' && <Overview season={season} setSeason={setSeason} players={playersAtivos} setPlayers={setPlayers} sessions={sessions} setSessions={setSessions} exercises={exercises} setExercises={setExercises} exercisesMeta={exercisesMeta} monitoring={monitoring} matches={matches} setMatches={setMatches} standings={standings} setStandings={setStandings} convocatorias={convocatorias} setConvocatorias={setConvocatorias} lastEdits={lastEdits} tarefas={tarefas} setTarefas={setTarefas} membros={membros} euId={euId} onVerTarefas={() => goTab('tarefas')} teamId={teamId} onIr={goTab} clipes={clipes} nomeEquipa={equipaAtiva ? (equipaAtiva.clube ? [equipaAtiva.clube, equipaAtiva.escalao].filter(Boolean).join(' · ') : (equipaAtiva.nome || '')) : ''} />}
          {tab === 'plantel' && (
            <Plantel
              players={players} setPlayers={setPlayers}
              sessions={sessions} setSessions={setSessions}
              matches={matches} setMatches={setMatches}
              convocatorias={convocatorias} setConvocatorias={setConvocatorias}
              monitoring={monitoring} setMonitoring={setMonitoring}
              clinico={clinico} setClinico={setClinico}
              desenvolvimento={desenvolvimento} setDesenvolvimento={setDesenvolvimento}
              autorizarApagarRasto={{ monitoring: autorizarApagarMonitoring, clinico: autorizarApagarClinico, desenvolvimento: autorizarApagarMomento }}
              meta={playersMeta}
              teamId={teamId}
              diario={diario}
            />
          )}
          {tab === 'exercicios' && <Exercicios exercises={exercises} setExercises={setExercises} meta={exercisesMeta} />}
          {tab === 'ideiajogo' && <IdeiaJogo ideias={ideias} setIdeias={setIdeias} meta={ideiasMeta} matches={matches} setMatches={setMatches} planoPedido={planoPedido} onPlanoTratado={() => setPlanoPedido(null)} />}
          {tab === 'planeamento' && <Planeamento sessions={sessions} setSessions={setSessions} exercises={exercises} setExercises={setExercises} exercisesMeta={exercisesMeta} players={playersAtivos} setPlayers={setPlayers} matches={matches} setMatches={setMatches} standings={standings} season={season} clinico={clinico} convocatorias={convocatorias} setConvocatorias={setConvocatorias} />}
          {tab === 'presencas' && <Presencas players={playersAtivos} sessions={sessions} setSessions={setSessions} matches={matches} setMatches={setMatches} convocatorias={convocatorias} season={season} clinico={clinico} setClinico={setClinico} />}
          {tab === 'equipa' && (
            <GestaoEquipa
              equipa={equipaAtiva} session={session}
              onPreview={() => setPreviewKiosk(true)}
              onEquipasMudaram={onEquipasMudaram}
              setPlayers={setPlayers}
              dados={{
                season, players, exercises, ideias, sessions, monitoring, matches,
                scouting, videos, apresentacoes, convocatorias, diario,
                clinico, desenvolvimento, standings,
                adversarios, documentos, tarefas, videosOriginais, clipes,
              }}
            />
          )}
          {tab === 'clinico' && <BoletimClinico players={playersAtivos} clinico={clinico} setClinico={setClinico} sessions={sessions} setSessions={setSessions} matches={matches} setMatches={setMatches} />}
          {tab === 'jogos' && <Jogos matches={matches} setMatches={setMatches} players={playersAtivos} setPlayers={setPlayers} standings={standings} setStandings={setStandings} standingsMeta={standingsMeta} season={season} setSeason={setSeason} sessions={sessions} setSessions={setSessions} convocatorias={convocatorias} setConvocatorias={setConvocatorias} autorizarLimparConvocatorias={autorizarLimparConvocatorias} clinico={clinico} abaInicial={tabPedida === 'convocatorias' ? 'convocatorias' : tabPedida === 'estatisticas' ? 'estatisticas' : tabPedida === 'analisejogo' ? 'analisejogo' : tabPedida === 'ideiasjogo' ? 'ideiasjogo' : 'jogos'} voltarOrigem={origemMissao && origemMissao !== 'jogos' ? () => goTab(origemMissao) : null}  tarefas={tarefas} souDono={((membros || []).find(m => m.user_id === euId) || {}).papel === 'owner'} userEmail={userEmail} />}
          {/* Sempre montado, escondido com CSS (não desmontado) — o mesmo
             motivo da Biblioteca logo abaixo: sem isto, trocar de separador
             e voltar perdia o vídeo selecionado, a posição de reprodução e
             qualquer desenho a meio de ser feito. */}
          <div style={{ display: tab === 'analise' ? 'block' : 'none' }}>
            <AnalisadorVideo teamId={teamId} videosOriginais={videosOriginais} setVideosOriginais={setVideosOriginais} clipes={clipes} setClipes={setClipes} uploadVideoEstado={uploadVideoEstado} iniciarUploadVideo={iniciarUploadVideo} askConfirm={askConfirm} destinosSala={destinosSala} enviarParaSala={enviarClipeParaSala} clipesUsadosNaSala={clipesUsadosNaSala} recuperarOriginal={recuperarOriginal} nomeNossaEquipa={nomeNossaEquipa} garantirFichaAdversario={garantirFichaAdversario} criarFichaAdversario={criarFichaAdversario} />
            {/* Por cima da bancada da Análise (z-index alto) e DENTRO do ecrã
                inteiro, se estiver ligado: fora dele a janela não se via e o
                pedido ficava preso em "A preparar a ficha do adversário…". */}
            {pedidoFichaAnalise && createPortal(<div style={{ position: 'relative', zIndex: 2000 }}>
              <FichaAdversarioRapida
                adversarios={adversarios}
                equipasCompeticao={nomesEquipasCompeticao(standings)}
                equipasIniciais={pedidoFichaAnalise.equipas}
                equipaInicial={pedidoFichaAnalise.equipa}
                video={{ title: pedidoFichaAnalise.titulo }}
                onClose={() => { const p0 = pedidoFichaAnalise; setPedidoFichaAnalise(null); p0.resolver(null); }}
                onConfirm={confirmarFichaAnalise}
              />
            </div>, (typeof document !== 'undefined' && document.fullscreenElement) || document.body)}
          </div>
          {tab === 'monitorizacao' && <Monitorizacao players={playersAtivos} setPlayers={setPlayers} monitoring={monitoring} setMonitoring={setMonitoring} sessions={sessions} matches={matches} teamId={teamId} clinico={clinico} />}
          <NecessidadesLigacao key={teamId || 'sem-equipa'} teamId={teamId} onApi={setNecApiRaiz} />
          {tab === 'scouting' && <Scouting abaInicial={tabPedida === 'fichaadversario' ? 'adversarios' : ''} scouting={scouting} setScouting={setScouting} adversarios={adversarios} setAdversarios={setAdversarios} videos={videos} setVideos={setVideos} players={playersAtivos} clinico={clinico} teamId={teamId} necApi={necApiRaiz} />}
          {/* BIBLIOTECA — as duas medialibraries debaixo de um separador só.

             Continuam ambas SEMPRE MONTADAS (escondidas com CSS, não
             desmontadas) em vez de destruídas e recriadas a cada troca —
             assim um vídeo do Instagram/TikTok que esteja a tocar
             continua exatamente onde estava ao voltar. Era verdade quando
             eram dois separadores e continua a ser agora que são duas
             sub-abas: o `display: none` é justamente o que o permite. */}
          <div style={{ display: tab === 'biblioteca' ? 'block' : 'none' }}>
            <SectionHeader title="Sala de Vídeo" subtitle="Vídeos e apresentações da equipa."
              action={biblioteca === 'apresentacoes'
                ? <Btn onClick={() => apresentacoesRef.current?.abrirNovo()}><Plus size={15} /> Adicionar ficheiro</Btn>
                : <Btn onClick={() => canalRef.current?.abrirNovo()}><Plus size={15} /> Adicionar vídeo</Btn>} />
            {/* Um botão só, na mesma linha dos separadores, alinhado à
                direita — o rótulo e o clique mudam consoante a sub-aba
                aberta, mas é sempre este único botão a aparecer, nunca um
                por baixo de cada sub-aba (essas continuam com o botão
                próprio escondido via `semBotaoTopo`, para o caso de o
                voltarmos a mostrar algures). */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
              <SubTabs
                value={biblioteca}
                onChange={setBiblioteca}
                tabs={[
                  { id: 'videos', label: 'Canal', icon: Tv, count: (videos || []).length },
                  { id: 'apresentacoes', label: 'Apresentações', icon: Presentation, count: (apresentacoes || []).length },
                ]}
                semMargem
              />
            </div>
            <div style={{ display: biblioteca === 'videos' ? 'block' : 'none' }}>
              <MediaLibrary
                ref={canalRef}
                items={videosGerais} setItems={setVideosGerais}
                addLabel="Adicionar vídeo" semBotaoTopo recentesPrimeiro
                modoCanal matches={matches} adversarios={adversarios} setAdversarios={setAdversarios} todosVideos={videos} setTodosVideos={setVideos}
                equipasCompeticao={nomesEquipasCompeticao(standings)}
                provaDeEquipa={(nome) => provaDaEquipa(nome, standings)}
                adversariosProntos={!!adversariosReady && !!videosReady}
                teamIdFichas={teamId}
                emptyText="Ainda sem vídeos. Cola o link do YouTube, Instagram, TikTok ou Facebook, ou carrega um ficheiro, para começares."
                emptyFirstLabel="Adicionar o primeiro vídeo"
              />
            </div>
            <div style={{ display: biblioteca === 'apresentacoes' ? 'block' : 'none' }}>
              <MediaLibrary
                ref={apresentacoesRef}
                items={apresentacoes} setItems={setApresentacoes}
                addLabel="Adicionar ficheiro" semBotaoTopo
                emptyText="Ainda sem apresentações. Carrega um PDF ou PowerPoint, cola um link do Google Drive (para ficheiros grandes) ou um link de vídeo, para começares."
                emptyFirstLabel="Adicionar o primeiro ficheiro"
              />
            </div>
          </div>
          {/* DOCUMENTOS — separador próprio outra vez (saiu da Sala de Vídeo,
              que agora é só vídeo e apresentações). Sempre montado, como
              antes, para não perder o que estava aberto ao trocar. */}
          <div style={{ display: tab === 'documentos' ? 'block' : 'none' }}>
            <SectionHeader
              title="Documentos" subtitle="Modelos e documentos da equipa."
              action={<Btn onClick={() => documentosRef.current?.abrirNovo()}><Plus size={15} /> Carregar modelo</Btn>}
            />
            <div>
              <DocumentosApp
                ref={documentosRef}
                documentos={documentos} setDocumentos={setDocumentos} players={playersAtivos} sessions={sessions}
                matches={matches} clinico={clinico} teamId={teamId} semBotaoTopo epoca={season && season.name}
                convocatorias={convocatorias} adversarios={adversarios} scouting={scouting}
                clube={String((equipaAtiva && (equipaAtiva.clube || equipaAtiva.nome)) || '').trim()}
                escalao={String((equipaAtiva && equipaAtiva.escalao) || '').trim()}
              />
            </div>
          </div>
          {tab === 'desenvolvimento' && (
            <DesenvolvimentoIndividual
              players={playersAtivos}
              setPlayers={setPlayers}
              documentos={documentos}
              desenvolvimento={desenvolvimento}
              setDesenvolvimento={setDesenvolvimento}
              autorizarRemocaoEmMassa={autorizarApagarMomento}
              userEmail={session && session.user && session.user.email}
              setTarefas={setTarefas}
            />
          )}
          {tarefasReady && membros && (
            <EcraEntradaEquipa
              tarefas={tarefas} setTarefas={setTarefas} membros={membros} euId={euId}
              ctx={{ sessions, matches, players, monitoring }}
              onIr={(caminho) => goTab(caminho || 'tarefas')}
              equipa={equipaAtiva} epoca={season && season.name}
            />
          )}
          {tab === 'tarefas' && (
            <Tarefas tarefas={tarefas} setTarefas={setTarefas} membros={membros} euId={euId}
              sessions={sessions} matches={matches} players={playersAtivos} monitoring={monitoring} standings={standings} />
          )}
          {tab === 'diario' && <Diario diario={diario} setDiario={setDiario} diarioMeta={diarioMeta} userEmail={userEmail} players={playersAtivos} matches={matches} setMatches={setMatches} season={season} sessions={sessions} />}
          </TreinosParaEditorCtx.Provider>
        </div>
        </main>
        <BotaoTopo alvoRef={mainRef} isMobile={isMobile} />
      </div>
      {/* Dupla rede contra eliminações acidentais, uma só para toda a
          aplicação: primeiro pergunta, depois deixa anular. */}
      <ConfirmDialog />
      <UndoBar />
    </div>
  );
}

/* ---------------------------------------------------------------
   VISÃO GERAL
---------------------------------------------------------------- */
function Overview({ season, setSeason, players, setPlayers, sessions, setSessions, exercises, setExercises, exercisesMeta, monitoring, matches, setMatches, standings, setStandings, convocatorias, setConvocatorias, lastEdits, tarefas, setTarefas, membros, euId, onVerTarefas, teamId, onIr, clipes, nomeEquipa }) {
  const [relatoOpen, setRelatoOpen] = useState(false);
  // Nome da equipa no cabeçalho (clube · escalão de Gerir equipa; sem isso, o clube da Época).
  const nomeEquipaCabecalho = String(nomeEquipa || (season && season.club) || '').trim();
  // Cartões clicáveis: sessão e jogo abrem a respetiva janela de edição
  // aqui mesmo, sem obrigar a ir ao Planeamento ou aos Jogos.
  const [sessionModal, setSessionModal] = useState(null);
  const [matchModal, setMatchModal] = useState(null);
  const [standingsOpen, setStandingsOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  // Edição a partir dos cartões: o jogador (estatuto) e a classificação
  // abrem aqui as mesmas janelas do Plantel e dos Jogos, para não obrigar
  // a sair da Visão Geral só para corrigir um campo.
  const [playerModal, setPlayerModal] = useState(null);
  const [standingsEdit, setStandingsEdit] = useState(false);
  // Número de colunas dos painéis, conforme a largura do ecrã.
  const isMedium = !useIsMobile(700);
  const isWide = !useIsMobile(1180);
  const today = new Date();
  const upcoming = [...sessions]
    .filter(s => new Date(s.date) >= new Date(today.toDateString()))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 4);
  const upcomingMatches = [...matches]
    .filter(m => new Date(m.date) >= new Date(today.toDateString()))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 4);

  const daysTo = (d) => Math.max(0, Math.ceil((new Date(d) - today) / 86400000));

  /* Em ecrã largo, os 3 painéis de baixo ficam um pouco mais altos (mais
     proporcionais aos de cima). Para a página continuar a caber sem
     deslizar, o espaço vazio por baixo do último painel encolhe na mesma
     medida (margem negativa só aqui, na Visão Geral). */
  const ALTURA_EXTRA_BAIXO = 36;
  /* Cor do cabeçalho = cor da equipa. Com uma cor clara (amarelo, branco…)
     o título branco deixava de se ler: aí o título passa a escuro. */
  const corCabecalho = /^#[0-9a-f]{6}$/i.test(String(T.corEquipa || '')) ? T.corEquipa : T.crimson;
  const textoCabecalho = (() => {
    const h = corCabecalho.replace('#', '');
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 0.45 ? '#14301F' : T.epocaNome;
  })();
  const estiloPainelBaixo = isWide ? { minHeight: 300 } : undefined;
  return (
    <div style={isWide ? { marginBottom: -ALTURA_EXTRA_BAIXO } : undefined}>
      {/* CABEÇALHO NUM SÓ CARTÃO: o título e o subtítulo da página entram
          no cartão vermelho (à esquerda), e a época passa para a direita,
          junto aos números. Poupa a faixa do título por cima do cartão,
          para o painel caber no ecrã sem deslizar. */}
      <div style={{
        // Começa na COR DA EQUIPA (a de "Gerir equipa", T.corEquipa) e
        // desvanece para o verde da app, como antes fazia o vermelho fixo.
        background: `linear-gradient(135deg, ${corCabecalho} 0%, ${T.surfaceRaise} 75%)`,
        border: `1px solid ${T.line}`, borderRadius: 12, padding: '18px 24px', marginBottom: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20,
      }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ ...display, color: textoCabecalho, fontSize: 26, fontWeight: 600, margin: 0, lineHeight: 1.1 }}>Visão Geral</h1>
          {/* Nome da equipa ativa no lugar do antigo subtítulo ("O estado da
              época, num único lugar."). Vem do clube e escalão da equipa
              (Gerir equipa); sem eles, usa o clube guardado na Época. */}
          {nomeEquipaCabecalho ? (
            <p style={{ color: textoCabecalho, opacity: 0.9, fontSize: 13.5, fontWeight: 500, margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nomeEquipaCabecalho}
            </p>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: T.epocaRotulo, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>Época</div>
            <input
              value={season.name}
              onChange={e => setSeason({ ...season, name: e.target.value })}
              aria-label="Nome da época"
              style={{ background: 'transparent', border: 'none', ...display, color: T.epocaNome, fontSize: 26, fontWeight: 600, outline: 'none', width: 150, textAlign: 'right', padding: 0, lineHeight: 1 }}
            />
          </div>
          <div style={{ width: 1, alignSelf: 'stretch', background: T.line }} />
          <div style={{ display: 'flex', gap: 28 }}>
            <Stat value={players.length} label="Jogadores" />
            <Stat value={sessions.length} label="Sessões" />
            <Stat value={matches.length} label="Jogos" />
            <Stat value={upcoming.length ? daysTo(upcoming[0].date) : '–'} label="Dias p/ próx. sessão" />
          </div>
        </div>
      </div>

      {/* Colunas de largura igual que ocupam a página toda: três em ecrã
          largo, duas em ecrã médio, uma no telemóvel. Sem alignItems:start,
          para os painéis da mesma linha ficarem todos com a mesma altura. */}
      <div style={{
        display: 'grid', gap: 20,
        gridTemplateColumns: isWide ? 'repeat(3, minmax(0, 1fr))' : isMedium ? 'repeat(2, minmax(0, 1fr))' : '1fr',
      }}>
        <Panel title="Próximas sessões">
          {upcoming.length === 0 ? (
            <EmptyState text="Ainda não há sessões planeadas." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {upcoming.map(s => (
                <div key={s.id} onClick={() => setSessionModal(s)} title="Abrir sessão" style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
                  padding: '10px 14px', background: T.bg, borderRadius: 8, border: `1px solid ${T.line}`,
                }}>
                  <div style={{ minWidth: 0 }}>
                    {/* A sessão de um amigável tem foco "11x11" — o formato do
                        exercício — e saía como título do cartão. Num painel
                        de próximas sessões isso não diz nada: "11x11 · Jogo"
                        obriga a adivinhar contra quem. Num dia de jogo o
                        título é o adversário, que é a única coisa que se
                        quer saber de relance. */}
                    <div style={{ color: T.cream, fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.phase === 'Descanso'
                        ? 'Folga'
                        : jogoRealDaSessao(s, matches)
                          ? (s.opponent ? `vs ${s.opponent}` : 'Jogo')
                          : (s.focus || 'Sessão de treino')}
                    </div>
                    <div style={{ color: T.mutedDim, fontSize: 12 }}>{fmtDate(s.date)} · {s.phase || '—'}</div>
                  </div>
                  <div style={{ ...mono, color: T.warn, fontSize: 13, flexShrink: 0 }}>{daysTo(s.date)}d</div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Próximos jogos">
          {upcomingMatches.length === 0 ? (
            <EmptyState text="Ainda não há jogos agendados." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {upcomingMatches.map(m => (
                <div key={m.id} onClick={() => setMatchModal(m)} title="Abrir jogo" style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 10,
                  padding: '10px 14px', background: T.bg, borderRadius: 8, border: `1px solid ${T.line}`,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: T.cream, fontSize: 14, fontWeight: 500 }}>{matchLabel(m, season)}</div>
                    <div style={{ color: T.mutedDim, fontSize: 12 }}>{fmtDate(m.date)}{m.competition ? ` · ${competitionLabel(m.competition)}` : ''}</div>
                  </div>
                  <div style={{ ...mono, color: T.warn, fontSize: 13, flexShrink: 0 }}>{daysTo(m.date)}d</div>
                </div>
              ))}
            </div>
          )}
        </Panel>


        {/* 1.ª linha: Próximas sessões, Próximos jogos, Estado do plantel
            (matriz Wellness × Esforço). As tarefas saíram da Visão Geral
            (continuam no separador Tarefas). */}
        <Panel title="Estado do plantel">
          {players.length === 0 ? (
            <EmptyState text="Adiciona jogadores no separador Plantel." />
          ) : (
            <WellnessLoadMatrix players={players} monitoring={monitoring} />
          )}
        </Panel>

        <div style={estiloPainelBaixo}>
        <Panel title="Classificação">
          <div onClick={() => setStandingsOpen(true)} title="Ver classificação completa" style={{ cursor: 'pointer' }}>
            {/* Visão Geral compacta: os 3 primeiros e a nossa equipa. */}
            <StandingsSummary standings={standings} season={season} topo={3} />
          </div>
        </Panel>
        </div>

        <div style={estiloPainelBaixo}>
        <Panel title="Estatuto de Plantel">
          {players.length === 0 ? (
            <EmptyState text="Adiciona jogadores no separador Plantel." />
          ) : (
            <div onClick={() => setStatusOpen(true)} title="Ver jogador a jogador" style={{ cursor: 'pointer' }}>
              <PlantelStatusSummary players={players} compacto />
            </div>
          )}
        </Panel>
        </div>

        <div style={estiloPainelBaixo}>
        <Panel title="Última atividade" action={(
          <button type="button" onClick={() => setRelatoOpen(true)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', cursor: 'pointer', ...body,
            border: `1px solid ${T.line}`, borderRadius: 8, color: T.warn, fontSize: 11.5, padding: '4px 9px',
          }}>Relato completo <ArrowRight size={12} /></button>
        )}>
          <div onClick={() => setRelatoOpen(true)} title="Ver toda a atividade" style={{ cursor: 'pointer' }}>
            {/* Só as 3 mais recentes — o resto está no Relato completo. */}
            <LastActivity lastEdits={lastEdits} max={3} />
          </div>
        </Panel>
        </div>
      </div>

      {sessionModal && (
        <SessionModal
          session={sessionModal} exercises={exercises} players={players}
          setExercises={setExercises} exercisesMeta={exercisesMeta}
          sessions={sessions} setSessions={setSessions} matches={matches}
          onClose={() => setSessionModal(null)}
          onSave={(data) => { setSessions(prev => prev.map(x => (x.id === data.id ? data : x))); setSessionModal(null); }}
        />
      )}
      {matchModal && (
        <MatchModal matches={matches}
          match={matchModal} players={players} standings={standings} season={season}
          onClose={() => setMatchModal(null)}
          onSave={(data) => {
            const registo = podarPresencasForaDosConvocados(data);
            setMatches(prev => prev.map(x => (x.id === registo.id ? registo : x)));
            if (setConvocatorias) setConvocatorias(prev => syncMatchConvocatoria(registo, prev, season));
            setMatchModal(null);
          }}
        />
      )}
      {relatoOpen && (
        <RelatoPagina
          teamId={teamId} players={players} membros={membros} euId={euId} lastEdits={lastEdits}
          tarefas={tarefas} clipes={clipes}
          onClose={() => setRelatoOpen(false)} onIr={onIr}
        />
      )}
      {standingsOpen && (
        <StandingsFullModal
          standings={standings} season={season}
          onClose={() => setStandingsOpen(false)}
          onEdit={setStandings ? () => trocarJanela(() => setStandingsOpen(false), () => setStandingsEdit(true)) : null}
        />
      )}
      {standingsEdit && (
        <StandingsModal
          standings={standings}
          onClose={() => trocarJanela(() => setStandingsEdit(false), () => setStandingsOpen(true))}
          onSave={(data) => {
            setStandings(data);
            // Mesma regra dos Jogos: os encontros da nossa equipa acompanham
            // as jornadas da competição.
            if (setMatches) {
              const jogos = syncCompetitionMatches(data.competitions, matches);
              setMatches(jogos);
              // Cada jogo nosso lançado na tabela ganha a sua convocatória,
              // já com a moldura preenchida e os nomes por escolher.
              if (setConvocatorias) setConvocatorias(prev => syncCompetitionConvocatorias(jogos, prev, season));
              // E a sua sessão em Planeamento (ver ensureMatchSession) — sem
              // isto, um jogo que entra sozinho a partir da jornada nunca
              // tinha sessão associada, e o PSE do dia não aparecia no
              // check-in dos atletas a menos que o treinador criasse a
              // sessão à mão.
              if (setSessions) setSessions(prev => jogos.reduce((acc, j) => ensureMatchSession(j, acc), prev));
            }
            trocarJanela(() => setStandingsEdit(false), () => setStandingsOpen(true));
          }}
        />
      )}
      {statusOpen && (
        <PlantelStatusModal
          players={players}
          onClose={() => setStatusOpen(false)}
          onEditPlayer={setPlayers ? (p) => trocarJanela(() => setStatusOpen(false), () => setPlayerModal(p)) : null}
        />
      )}
      {playerModal && (
        <PlayerModal
          player={playerModal}
          onClose={() => trocarJanela(() => setPlayerModal(null), () => setStatusOpen(true))}
          onSave={(data) => {
            setPlayers(prev => prev.map(x => (x.id === data.id ? data : x)));
            trocarJanela(() => setPlayerModal(null), () => setStatusOpen(true));
          }}
        />
      )}
    </div>
  );
}


/* Classificação completa, aberta a partir do cartão da Visão Geral. */
function StandingsFullModal({ standings, season, onClose, onEdit }) {
  const { competitions } = limparEquipaDuplicada(standings, season);
  const [viewId, setViewId] = useState(null);
  const comp = competitions.find(c => c.id === viewId) || activeCompetitionOf(standings);
  const table = competitionTable(comp);
  const ourName = (season && season.club) || '';
  const isUs = (t) => {
    if (!ourName || !t.name) return false;
    const a = t.name.toLowerCase(), b = ourName.toLowerCase();
    return a === b || b.includes(a) || a.includes(b.split('·')[0].trim());
  };
  const th = { textAlign: 'center', padding: '6px 4px', fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em' };
  // Mesmo tratamento em telemóvel e em desktop: se o nome da competição
  // tiver um traço, o que vem depois passa a subtítulo ("Campeonato
  // distrital U19" + "1ª Divisão"). Sem traço, fica tudo no título.
  const nome = splitCompetitionName((comp && comp.name) || 'Classificação');

  return (
    <Modal title={nome.title} subtitle={nome.subtitle} onClose={onClose} wide>
      {competitions.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {competitions.map(c => (
            <button key={c.id} type="button" onClick={() => setViewId(c.id)} style={{
              padding: '5px 11px', borderRadius: 16, fontSize: 12, cursor: 'pointer', ...body,
              background: comp && c.id === comp.id ? '#B5393F' : 'transparent',
              color: comp && c.id === comp.id ? TEXT_ON_ACCENT : T.muted,
              border: `1px solid ${comp && c.id === comp.id ? '#B5393F' : T.line}`,
            }}>{c.name || 'Sem nome'}</button>
          ))}
        </div>
      )}
      {table.length === 0 ? (
        <EmptyState text="Sem classificação nesta competição." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460, tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left', width: 30 }}>#</th>
                <th style={{ ...th, textAlign: 'left' }}>Equipa</th>
                {['J', 'V', 'E', 'D', 'GM', 'GS', 'DG', 'P'].map(h => <th key={h} style={{ ...th, width: 34 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {table.map((t, i) => (
                <tr key={t.id} style={{ borderTop: `1px solid ${T.line}`, background: isUs(t) ? `${T.crimson}33` : 'transparent' }}>
                  <td style={{ ...mono, padding: '7px 4px 7px 7px', fontSize: 12.5, color: isUs(t) ? T.warn : T.mutedDim, ...estiloZona(comp, i, table.length) }}>{i + 1}</td>
                  <td
                    title={t.name}
                    style={{
                      padding: '7px 4px', fontSize: 13, color: isUs(t) ? T.cream : T.muted,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 0,
                    }}
                  >{t.name}</td>
                  {['J', 'V', 'E', 'D', 'GM', 'GS'].map(k => (
                    <td key={k} style={{ ...mono, padding: '7px 4px', fontSize: 12.5, color: T.mutedDim, textAlign: 'center' }}>{t[k]}</td>
                  ))}
                  <td style={{ ...mono, padding: '7px 4px', fontSize: 12.5, color: T.mutedDim, textAlign: 'center' }}>{t.DG > 0 ? `+${t.DG}` : t.DG}</td>
                  <td style={{ ...mono, padding: '7px 4px', fontSize: 13, color: T.warn, fontWeight: 600, textAlign: 'center' }}>{t.P}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <LegendaZonas comp={comp} />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <Btn variant="ghost" onClick={onClose}>Fechar</Btn>
        {onEdit && <Btn onClick={onEdit}><Pencil size={14} /> Editar classificação</Btn>}
      </div>
    </Modal>
  );
}

/* Matriz de estatuto: jogador, estatuto principal e secundário. */
function PlantelStatusModal({ players, onClose, onEditPlayer }) {
  const th = { textAlign: 'left', padding: '7px 8px', fontSize: 10.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${T.line}` };
  const td = { padding: '8px', fontSize: 13, color: T.mutedDim };
  return (
    <Modal
      title="Estatuto de plantel"
      subtitle={onEditPlayer ? 'Toca num jogador para alterar o estatuto.' : ''}
      onClose={onClose}
      wide
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 440 }}>
          <thead>
            <tr>
              <th style={th}>Jogador</th>
              <th style={th}>Estatuto principal</th>
              <th style={th}>Estatuto secundário</th>
              {onEditPlayer && <th style={{ ...th, width: 34 }} />}
            </tr>
          </thead>
          <tbody>
            {sortByPosition(players).map(p => (
              <tr
                key={p.id}
                onClick={onEditPlayer ? () => onEditPlayer(p) : undefined}
                title={onEditPlayer ? 'Editar jogador' : undefined}
                style={{ borderBottom: `1px solid ${T.line}`, cursor: onEditPlayer ? 'pointer' : 'default' }}
              >
                <td style={{ ...td, color: T.cream, whiteSpace: 'nowrap' }}>{p.position ? `${p.position} · ` : ''}{p.name}</td>
                <td style={td}>{p.statusMain || '—'}</td>
                <td style={td}>{p.statusSecondary || '—'}</td>
                {onEditPlayer && (
                  <td style={{ ...td, textAlign: 'right' }}><Pencil size={13} /></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <Btn variant="ghost" onClick={onClose}>Fechar</Btn>
      </div>
    </Modal>
  );
}

/* Resumo da classificação para a Visão Geral. Lê a mesma tabela que é
   preenchida em Jogos (registo único league_standings) — não há aqui
   nenhuma introdução de dados, é só leitura. Destaca a nossa equipa e,
   se ela não estiver entre os primeiros lugares mostrados, acrescenta-a
   no fim para estar sempre visível. */
function StandingsSummary({ standings, season, topo = 6 }) {
  const comp = activeCompetitionOf(standings);
  const all = competitionTable(comp);
  if (all.length === 0) {
    return <EmptyState text="Sem classificação. Configura a competição em Jogos › Competições e jornadas." />;
  }

  const ourName = (season && season.club) || '';
  const isUs = (t) => {
    if (!ourName || !t.name) return false;
    const a = t.name.toLowerCase(), b = ourName.toLowerCase();
    return a === b || b.includes(a) || a.includes(b.split('·')[0].trim());
  };

  const TOP = topo;
  const top = all.slice(0, TOP);
  const ourIdx = all.findIndex(isUs);
  const showExtra = ourIdx >= TOP;

  const th = { textAlign: 'left', padding: '5px 6px', fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em' };
  const td = { padding: '6px', fontSize: 12.5, color: T.mutedDim, whiteSpace: 'nowrap' };

  const row = (t, i) => (
    <tr key={t.id || t.name} style={{ borderTop: `1px solid ${T.line}`, background: isUs(t) ? `${T.crimson}33` : 'transparent' }}>
      <td style={{ ...td, ...mono, width: 22, paddingLeft: 9, color: isUs(t) ? T.warn : T.mutedDim, ...estiloZona(comp, i, all.length) }}>{i + 1}</td>
      <td style={{ ...td, color: isUs(t) ? T.cream : T.muted, whiteSpace: 'normal' }}>{t.name || '—'}</td>
      <td style={{ ...td, ...mono, textAlign: 'right' }}>{t.J}</td>
      <td style={{ ...td, ...mono, textAlign: 'right' }}>{t.DG > 0 ? `+${t.DG}` : t.DG}</td>
      <td style={{ ...td, ...mono, textAlign: 'right', color: isUs(t) ? T.warn : T.cream, fontWeight: 600 }}>{t.P}</td>
    </tr>
  );

  return (
    <div>
      {comp && comp.name && (
        <div style={{ fontSize: 11.5, color: T.mutedDim, marginBottom: 6 }}>{comp.name}</div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>#</th>
            <th style={th}>Equipa</th>
            <th style={{ ...th, textAlign: 'right' }}>J</th>
            <th style={{ ...th, textAlign: 'right' }}>DG</th>
            <th style={{ ...th, textAlign: 'right' }}>P</th>
          </tr>
        </thead>
        <tbody>
          {top.map((t, i) => row(t, i))}
          {showExtra && (
            <>
              <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: T.mutedDim }}>⋯</td></tr>
              {row(all[ourIdx], ourIdx)}
            </>
          )}
        </tbody>
      </table>
      {all.length > TOP && !showExtra && (
        <div style={{ fontSize: 11, color: T.mutedDim, marginTop: 8 }}>
          Tabela completa em Jogos ({all.length} equipas).
        </div>
      )}
    </div>
  );
}


// Mostra quem foi a última pessoa da equipa técnica a editar cada bloco
// de dados (plantel, jogos, sessões, ...) e há quanto tempo.
function LastActivity({ lastEdits, max }) {
  const todas = Object.entries(lastEdits)
    .filter(([, v]) => v && v.email)
    .sort((a, b) => new Date(b[1].at) - new Date(a[1].at));
  const rows = max ? todas.slice(0, max) : todas;
  if (rows.length === 0) return <EmptyState text="Ainda sem alterações registadas." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(([key, v]) => (
        <div key={key} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
          padding: '9px 12px', background: T.bg, borderRadius: 8, border: `1px solid ${T.line}`,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: T.cream, fontSize: 13, fontWeight: 500 }}>{ACTIVITY_LABELS[key] || key}</div>
            <div style={{ color: T.mutedDim, fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.email}</div>
          </div>
          <div style={{ ...mono, color: T.warn, fontSize: 11.5, flexShrink: 0 }}>{timeAgo(v.at)}</div>
        </div>
      ))}
    </div>
  );
}

/* ================================================================
   RELATO — tudo o que a equipa técnica mexeu, minuto a minuto
   ================================================================

   Abre a partir da "Última atividade" da Visão Geral, em ecrã inteiro.
   Lê a tabela `activity_log` (ver activity_log.sql): uma linha por
   alteração, já com a diferença calculada no servidor — nunca cópias
   inteiras dos registos, que com as fotografias dos jogadores davam
   centenas de KB por linha.

   Lê-se como um relato: dia a dia, hora a hora. Vinte toques seguidos
   nas presenças da mesma sessão são UM lance ("×20, desde 14:02"), não
   vinte linhas iguais. Abrir um lance mostra o que mudou, com nomes de
   jogadores em vez de ids ("+ Rios, − Passos", "nota de Reis 6 → 7").

   No Boletim Clínico e na Monitorização (dados de saúde de menores) o
   servidor guarda só QUAIS campos mudaram, nunca os valores — o lance
   diz "editou a lesão de Rios · previsão de retorno", sem a data.

   Mostra sempre tudo, do mais recente para trás, às páginas de 500.
   Pessoa e pesquisa filtram aqui, sobre o que já veio. */
const RELATO_SECOES = {
  players: { label: 'Plantel', tab: 'plantel', icon: Users, art: 'o jogador' },
  exercises: { label: 'Exercícios', tab: 'exercicios', icon: Dumbbell, art: 'o exercício' },
  ideias: { label: 'Ideia de Jogo', tab: 'ideiajogo', icon: Lightbulb, art: 'a ideia' },
  sessions: { label: 'Planeamento', tab: 'planeamento', icon: CalendarDays, art: 'a sessão' },
  monitoring: { label: 'Monitorização', tab: 'monitorizacao', icon: Activity, art: 'o registo de' },
  matches: { label: 'Jogos', tab: 'jogos', icon: Trophy, art: 'o jogo' },
  scouting: { label: 'Scouting', tab: 'scouting', icon: Search, art: 'o observado' },
  adversarios: { label: 'Adversários', tab: 'jogos', icon: Shield, art: 'o adversário' },
  videos: { label: 'Canal', tab: 'biblioteca', icon: Tv, art: 'o vídeo' },
  documentos: { label: 'Documentos', tab: 'documentos', icon: FileSpreadsheet, art: 'o documento' },
  video_originais: { label: 'Análise de Vídeo', tab: 'analise', icon: Video, art: 'o vídeo' },
  video_clips: { label: 'Clipes', tab: 'analise', icon: Scissors, art: 'o clipe' },
  apresentacoes: { label: 'Apresentações', tab: 'biblioteca', icon: Presentation, art: 'a apresentação' },
  convocatorias: { label: 'Convocatórias', tab: 'jogos', icon: ListOrdered, art: 'a convocatória' },
  diario: { label: 'Diário', tab: 'diario', icon: BookOpen, art: 'a entrada do diário' },
  clinico: { label: 'Boletim Clínico', tab: 'clinico', icon: Stethoscope, art: 'a lesão de' },
  tarefas: { label: 'Tarefas', tab: 'tarefas', icon: ClipboardList, art: 'a tarefa' },
  desenvolvimento: { label: 'Desenvolvimento', tab: 'desenvolvimento', icon: TrendingUp, art: 'a avaliação de' },
  league_standings: { label: 'Classificação', tab: 'jogos', icon: ListOrdered, art: 'a classificação' },
  quadro_tatico: { label: 'Quadro Tático', tab: null, icon: PenTool, art: 'o quadro tático' },
  season_config: { label: 'Época', tab: 'geral', icon: LayoutGrid, art: 'a configuração da época' },
};
const relatoSecao = (t) => RELATO_SECOES[t] || { label: ACTIVITY_LABELS[t] || t, tab: null, icon: FileText, art: 'o registo' };


const RELATO_CORES = ['#D14056', '#3A6FC4', '#C9A227', '#4CA86B', '#8C3F9E', '#3FA7A0', '#D9792E'];
const relatoCor = (chave) => {
  let h = 0;
  for (let i = 0; i < String(chave).length; i++) h = (h * 31 + String(chave).charCodeAt(i)) >>> 0;
  return RELATO_CORES[h % RELATO_CORES.length];
};

const RELATO_PAGINA = 500;
const QUIOSQUE = '__quiosque';
/* GRAVAÇÕES AUTOMÁTICAS. Depois de um vídeo ser carregado, o servidor
   prepara-o (miniatura, "pronto", erro de preparação) e escreve isso no
   registo sem nenhuma pessoa por trás. Como não traz email nem id, caía
   em QUIOSQUE e aparecia como "Jogadores editou o vídeo", o que estava
   errado: nenhum jogador mexeu. Uma alteração sem autor em que TODOS os
   campos são destes técnicos passa a contar como automática. */
const AUTOMATICO = '__automatico';
/* ALTERAÇÃO DIRETA NA BASE DE DADOS (por exemplo, um SQL corrido no
   Supabase): não tem email nem id. Antes aparecia como "Um jogador
   respondeu à tarefa". Só conta como jogador quando mexe no que um
   jogador mexe no Portal (a resposta à tarefa, o questionário, o
   wellness/PSE ou os clipes); o resto sem autor é alteração direta. */
const DIRETO = '__direto';
const CAMPOS_DO_JOGADOR = {
  tarefas: ['notaAtleta', 'notaSubmetida', 'notaSubmetidaEm'],
  desenvolvimento: ['auto'],
};
const TABELAS_DO_JOGADOR = new Set(['monitoring', 'video_clips']);
function eDoJogador(e) {
  if (TABELAS_DO_JOGADOR.has(e.tabela)) return true;
  const campos = CAMPOS_DO_JOGADOR[e.tabela];
  if (!campos) return false;
  const ks = (e.campos || []).map(c => c && c.k);
  return ks.some(k => campos.includes(k)) || (e.acao !== 'editou' && e.tabela !== 'tarefas');
}
const CAMPOS_TECNICOS = new Set([
  'pronto', 'thumbUrl', 'thumb_url', 'erroPreparacao', 'erro_preparacao',
]);
const falhouPreparacao = (l) => (l.campos || [])
  .some(c => (c.k === 'erroPreparacao' || c.k === 'erro_preparacao') && c.para);
const soCamposTecnicos = (campos) => Array.isArray(campos) && campos.length > 0
  && campos.every(c => c && CAMPOS_TECNICOS.has(c.k));


const horaMin = (ts) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/* Junta toques seguidos da mesma pessoa no mesmo registo (até 15 min
   entre o primeiro e o último) num só lance. A lista chega do mais
   recente para o mais antigo. Nos campos fica o "para" mais recente e o
   "de" mais antigo — o que interessa é como estava e como ficou. */
function agruparLances(lista, chaveDe) {
  const JANELA = 15 * 60000;
  const lances = [];
  lista.forEach(e => {
    const chave = chaveDe(e);
    const ult = lances[lances.length - 1];
    const junta = ult && ult.chave === chave && ult.tabela === e.tabela && ult.registo_id && ult.registo_id === e.registo_id
      && ult.acao !== 'apagou' && (e.acao === 'editou' || e.acao === 'criou') && (ult.acao === 'editou' || ult.acao === 'criou')
      && (new Date(ult.ate) - new Date(e.em)) <= JANELA;
    if (junta) {
      ult.n += 1;
      ult.de = e.em;
      if (e.acao === 'criou') ult.acao = 'criou';
      (e.campos || []).forEach(c => {
        const ja = ult.campos.find(x => x.k === c.k);
        if (ja) { ja.de = c.de; ja.temDe = c.de !== undefined; ja.grande = ja.grande || c.grande; } else ult.campos.push({ ...c, temDe: c.de !== undefined });
      });
      return;
    }
    lances.push({
      id: e.id, chave, tabela: e.tabela, registo_id: e.registo_id, acao: e.acao,
      ator_id: e.ator_id, ator_email: e.ator_email, origem: e.origem,
      info: e.info || {}, ate: e.em, de: e.em, n: 1,
      campos: (e.campos || []).map(c => ({ ...c, temDe: c.de !== undefined })),
    });
  });
  return lances;
}


function RelatoAvatar({ nome, cor, size = 30 }) {
  const iniciais = String(nome || '?').split(/[\s.@_-]+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('') || '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `${cor}33`, border: `1.5px solid ${cor}`, color: cor,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      ...display, fontSize: size * 0.4, fontWeight: 600, letterSpacing: '.02em',
    }}>{iniciais}</div>
  );
}

function RelatoPagina({ teamId, players, membros, euId, lastEdits, onClose, onIr, tarefas, clipes }) {
  const isMobile = useIsMobile(900);
  const scrollRef = useRef(null);
  useModalHistory(onClose);

  const [linhas, setLinhas] = useState(null); // null = a carregar
  const [erro, setErro] = useState('');
  const [semTabela, setSemTabela] = useState(false);
  const [haMais, setHaMais] = useState(false);
  const [aCarregarMais, setACarregarMais] = useState(false);
  const [pessoa, setPessoa] = useState('');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(null);
  const [aAtualizar, setAAtualizar] = useState(false);

  const buscar = useCallback(async (offset) => {
    await ensureSession();
    // Sempre tudo, do mais recente para trás, às páginas.
    return supabase.from('activity_log')
      .select('id, tabela, registo_id, acao, ator_id, ator_email, em, info, campos, origem')
      .eq('team_id', String(teamId))
      .order('em', { ascending: false }).order('id', { ascending: false })
      .range(offset, offset + RELATO_PAGINA - 1);
  }, [teamId]);

  /* A PÁGINA NÃO MEXE AO CARREGAR. A primeira vez mostra a roda só
     no sítio da lista (o cabeçalho, a pesquisa e as pessoas já estão no
     lugar). O "Atualizar" troca a lista por cima da que lá está, sem a
     esvaziar — antes desaparecia tudo e a página saltava para cima. */
  const carregar = useCallback(async () => {
    setErro(''); setAAtualizar(true);
    try {
      const { data, error } = await buscar(0);
      if (error) throw error;
      setLinhas(data || []);
      setHaMais((data || []).length === RELATO_PAGINA);
      setSemTabela(false);
    } catch (e) {
      const msg = String((e && e.message) || e);
      if ((e && (e.code === '42P01' || e.code === 'PGRST205')) || /activity_log/.test(msg)) setSemTabela(true);
      else setErro(msg);
      setLinhas(prev => prev || []);
    } finally {
      setAAtualizar(false);
    }
  }, [buscar]);

  useEffect(() => { carregar(); }, [carregar]);

  const carregarMais = async () => {
    if (aCarregarMais || !linhas) return;
    setACarregarMais(true);
    try {
      const { data, error } = await buscar(linhas.length);
      if (error) throw error;
      setLinhas(prev => {
        const vistos = new Set((prev || []).map(x => x.id));
        return [...(prev || []), ...(data || []).filter(x => !vistos.has(x.id))];
      });
      setHaMais((data || []).length === RELATO_PAGINA);
    } catch (e) {
      setErro(String((e && e.message) || e));
    } finally {
      setACarregarMais(false);
    }
  };

  /* QUEM É QUEM. A chave de cada pessoa é o email (o histórico antigo
     só tem email); o nome vem da equipa, ligando email → id pelas linhas
     que trazem os dois. Sem email nem id é o quiosque dos atletas (ou uma
     gravação automática). */
  const jogadoresPorId = React.useMemo(() => {
    const m = {};
    (players || []).forEach(p => { m[p.id] = p; });
    return m;
  }, [players]);
  const nomeJogador = useCallback((id) => {
    const p = jogadoresPorId[id];
    return p ? p.name : null;
  }, [jogadoresPorId]);

  const pessoasInfo = React.useMemo(() => {
    const idPorEmail = {};
    (linhas || []).forEach(e => { if (e.ator_email && e.ator_id) idPorEmail[e.ator_email.toLowerCase()] = e.ator_id; });
    const membroPorId = {};
    (membros || []).forEach(m => { membroPorId[m.user_id] = m; });
    return { idPorEmail, membroPorId };
  }, [linhas, membros]);

  /* Marcas que não são pessoas da equipa técnica: as respostas do Portal
     do Atleta chegam com "portal-atleta" (ou outra marca sem "@") no lugar
     do email — contam como o jogador, não como "Alguém da equipa". */
  const chaveDe = useCallback((e) => {
    const em = (e.ator_email || '').toLowerCase();
    const semAutor = !e.ator_id && (!em || !em.includes('@'));
    if (semAutor && e.acao === 'editou' && soCamposTecnicos(e.campos)) return AUTOMATICO;
    if (em && !em.includes('@')) return QUIOSQUE;
    if (!em && !e.ator_id) return eDoJogador(e) ? QUIOSQUE : DIRETO;
    return em || e.ator_id || QUIOSQUE;
  }, []);
  const quemE = useCallback((chave) => {
    if (chave === QUIOSQUE) return { nome: 'Jogadores', cor: T.mutedDim, eu: false, quiosque: true };
    if (chave === AUTOMATICO) return { nome: 'Preparação automática', cor: T.mutedDim, eu: false, quiosque: true };
    if (chave === DIRETO) return { nome: 'Base de dados', cor: T.mutedDim, eu: false, quiosque: true };
    const id = chave.includes('@') ? pessoasInfo.idPorEmail[chave] : chave;
    const m = id && pessoasInfo.membroPorId[id];
    const nomeEmail = chave.includes('@') ? chave.split('@')[0].replace(/[._-]+/g, ' ') : 'Alguém da equipa';
    return { nome: (m && m.nome) || nomeEmail, email: chave.includes('@') ? chave : '', cor: relatoCor(chave), eu: !!euId && id === euId, quiosque: false };
  }, [pessoasInfo, euId]);

  // Tudo o que veio; pessoa e pesquisa filtram por cima.
  const base = linhas || [];
  /* A preparação automática que CORREU BEM não aparece: repetia o
     "criou o vídeo" logo acima e não diz nada a ninguém. Só fica quando
     falha, porque aí sim é preciso alguém voltar a carregar o vídeo. */
  const lancesBase = React.useMemo(() => agruparLances(base, chaveDe)
    .filter(l => l.chave !== AUTOMATICO || falhouPreparacao(l)), [base, chaveDe]);

  const fraseDe = useCallback((l) => {
    const sec = relatoSecao(l.tabela);
    const i = l.info || {};
    /* QUEM FOI: o jogador vem do registo (o servidor nem sempre o guarda
       no histórico). Tarefa → o jogador a quem foi atribuída; clipe → o
       jogador que o criou no Portal. Assim aparece "Rui criou o clipe…"
       em vez de "Jogadores criou o clipe…". */
    const daTarefa = l.tabela === 'tarefas' ? (tarefas || []).find(t => t.id === l.registo_id) : null;
    const doClipe = l.tabela === 'video_clips' ? (clipes || []).find(c => c.id === l.registo_id) : null;
    const jogId = i.playerId || i.jogadorId || i.atletaId || (daTarefa && daTarefa.jogadorId) || (doClipe && doClipe.atletaId) || '';
    const jog = (jogId ? nomeJogador(jogId) : '') || i.atletaNome || (doClipe && doClipe.atletaNome) || '';
    const nome = i.name || i.nome || i.titulo || i.title || i.label || i.tema || i.focus || '';
    const adv = i.opponent || i.adversario || '';
    const dia = isoDia(i.date) || isoDia(i.inicio) || isoDia(i.data);
    let alvo;
    switch (l.tabela) {
      case 'matches': case 'convocatorias': alvo = adv ? `vs ${adv}` : nome; break;
      case 'clinico': case 'monitoring': case 'desenvolvimento': alvo = jog || nome; break;
      case 'sessions': alvo = nome || (adv ? `vs ${adv}` : '') || i.phase || ''; break;
      default: alvo = nome || jog;
    }
    /* Pelo quiosque quem faz é o próprio jogador: "Rios respondeu ao
       wellness", e não "Jogadores editou o registo de Rios". */
    // "Preparação automática preparou o vídeo X" (ou falhou, se houve erro).
    if (l.chave === AUTOMATICO) {
      return { sujeito: null, verbo: falhouPreparacao(l) ? 'não conseguiu preparar' : 'preparou', art: sec.art, alvo, dia, secao: sec };
    }
    // "Base de dados alterou diretamente a tarefa X" (ex.: um SQL no Supabase).
    if (l.chave === DIRETO) {
      return { sujeito: null, verbo: 'alterou diretamente', art: sec.art, alvo, dia, secao: sec };
    }
    if (l.chave === QUIOSQUE) {
      const ks = (l.campos || []).map(c => c.k);
      let oQue;
      if (l.tabela === 'monitoring') oQue = ks.includes('pse') || i.type === 'rpe' ? 'ao PSE' : (ks.includes('sono') || i.type === 'wellness' ? 'ao wellness' : 'ao questionário');
      else if (l.tabela === 'desenvolvimento') oQue = 'ao questionário de desenvolvimento';
      else if (l.tabela === 'tarefas') oQue = 'à tarefa';
      if (oQue) return { sujeito: jog || 'Um jogador', verbo: 'respondeu', art: oQue, alvo: l.tabela === 'tarefas' ? nome : '', dia, secao: sec };
      return { sujeito: jog || null, verbo: (RELATO_ACOES[l.acao] || RELATO_ACOES.editou).verbo, art: sec.art, alvo: jog ? nome : alvo, dia, secao: sec };
    }
    return { sujeito: null, verbo: (RELATO_ACOES[l.acao] || RELATO_ACOES.editou).verbo, art: sec.art, alvo, dia, secao: sec };
  }, [nomeJogador, tarefas, clipes]);

  const textoDe = useCallback((l) => {
    const f = fraseDe(l);
    return [quemE(l.chave).nome, f.sujeito, f.verbo, f.art, f.alvo, f.secao.label, ...(l.campos || []).map(c => relatoCampoLabel(c.k))]
      .filter(Boolean).join(' ').toLowerCase();
  }, [fraseDe, quemE]);

  const filtrados = React.useMemo(() => {
    const b = busca.trim().toLowerCase();
    return lancesBase.filter(l => (!pessoa || l.chave === pessoa)
      && (!b || textoDe(l).includes(b)));
  }, [lancesBase, pessoa, busca, textoDe]);

  // Contagens dos filtros sobre a base, para não sumirem ao filtrar.
  const contar = (campo) => {
    const m = {};
    lancesBase.forEach(l => { m[l[campo]] = (m[l[campo]] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };
  const porPessoa = React.useMemo(() => contar('chave'), [lancesBase]); // eslint-disable-line react-hooks/exhaustive-deps

  const porDia = React.useMemo(() => {
    const dias = [];
    filtrados.forEach(l => {
      const k = toLocalISODate(new Date(l.ate));
      const ult = dias[dias.length - 1];
      if (ult && ult.k === k) ult.itens.push(l); else dias.push({ k, itens: [l] });
    });
    return dias;
  }, [filtrados]);
  const tituloDia = (k) => {
    const hoje = todayStr();
    if (k === hoje) return 'Hoje';
    if (k === proximoDiaIso(hoje, -1)) return 'Ontem';
    const sem = new Date(`${k}T00:00:00`).toLocaleDateString('pt-PT', { weekday: 'long' });
    return `${sem.charAt(0).toUpperCase()}${sem.slice(1)}, ${ddmm(k)}`;
  };

  /* Só HOJE vem aberto; os outros dias ficam fechados (o cabeçalho com
     o número de lances) e abrem-se com um toque. A pesquisa e o filtro
     por pessoa abrem tudo — senão os resultados ficavam escondidos. */
  const [diasAbertos, setDiasAbertos] = useState(() => new Set([todayStr()]));
  const [fecharSemSaltar, espacoSemSaltar] = useFecharSemSaltar();
  const alternarDia = (k) => setDiasAbertos(prev => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });
  const temFiltro = !!(pessoa || busca.trim());
  const limparFiltros = () => { setPessoa(''); setBusca(''); };

  /* ---------- peças ---------- */
  const pill = (on, onClick, conteudo, key, title) => (
    <button key={key} type="button" onClick={onClick} title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0,
      padding: '6px 12px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', ...body,
      fontWeight: on ? 600 : 500, whiteSpace: 'nowrap',
      background: on ? '#B5393F' : 'transparent', color: on ? TEXT_ON_ACCENT : T.muted,
      border: `1px solid ${on ? '#B5393F' : T.line}`,
    }}>{conteudo}</button>
  );
  // Uma só fila, que desliza: altura sempre igual, venha o que vier.
  const fila = (filhos) => (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, minHeight: 36, alignItems: 'center' }}>{filhos}</div>
  );

  const lance = (l) => {
    const q = quemE(l.chave);
    const f = fraseDe(l);
    const ac = RELATO_ACOES[l.acao] || RELATO_ACOES.editou;
    const abre = aberto === l.id;
    const temDetalhe = l.campos.length > 0 || !!f.secao.tab;
    const Ic = f.secao.icon;
    return (
      <div key={l.id} style={{ display: 'flex', gap: isMobile ? 10 : 14 }}>
        <div style={{ width: isMobile ? 40 : 46, flexShrink: 0, textAlign: 'right', paddingTop: 11 }}>
          <div style={{ ...mono, color: T.cream, fontSize: 12.5 }}>{horaMin(l.ate)}</div>
          {l.n > 1 && horaMin(l.de) !== horaMin(l.ate) && <div style={{ ...mono, color: T.mutedDim, fontSize: 9.5, marginTop: 2 }}>desde {horaMin(l.de)}</div>}
        </div>
        <div style={{ position: 'relative', width: 12, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, width: 2, background: T.line }} />
          <div style={{ position: 'relative', marginTop: 14, width: 10, height: 10, borderRadius: '50%', background: ac.cor, boxShadow: `0 0 0 3px ${T.bg}` }} />
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingBottom: 10 }}>
          <div
            onClick={() => temDetalhe && setAberto(abre ? null : l.id)}
            style={{
              background: abre ? T.surfaceRaise : T.surface, border: `1px solid ${abre ? T.linhaAtiva : T.line}`, borderRadius: 10,
              padding: '9px 12px', cursor: temDetalhe ? 'pointer' : 'default',
            }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <RelatoAvatar nome={f.sujeito || q.nome} cor={q.cor} size={28} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.45, color: T.muted }}>
                <span style={{ color: T.cream, fontWeight: 600, textTransform: f.sujeito || q.quiosque ? 'none' : 'capitalize' }}>{f.sujeito || q.nome}</span>
                {' '}<span style={{ color: ac.cor }}>{f.verbo}</span>{' '}{f.art}
                {f.alvo && <> <span style={{ color: T.cream }}>{f.alvo}</span></>}
                {f.dia && <span style={{ color: T.mutedDim }}> · {ddmm(f.dia)}</span>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4, fontSize: 11.5, color: T.mutedDim }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Ic size={12} />{f.secao.label}</span>
                  {l.n > 1 && <span style={{ ...mono, color: T.warn }}>×{l.n} toques</span>}
                  {l.campos.length > 0 && !abre && (
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                      {l.campos.slice(0, 3).map(c => relatoCampoLabel(c.k)).join(', ')}{l.campos.length > 3 ? ` +${l.campos.length - 3}` : ''}
                    </span>
                  )}
                  {l.origem === 'instantaneo' && <span title="De antes do relato existir: só se sabe a última alteração deste registo.">última alteração conhecida</span>}
                </div>
              </div>
              {temDetalhe && <ChevronDown size={15} color={T.mutedDim} style={{ flexShrink: 0, marginTop: 3, transform: abre ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />}
            </div>
            {abre && (
              <div onClick={e => e.stopPropagation()} style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', gap: 7, cursor: 'default' }}>
                {l.campos.map(c => <RelatoCampo key={c.k} c={c} nomeJogador={nomeJogador} />)}
                {l.acao === 'criou' && !l.campos.length && <div style={{ fontSize: 12.5, color: T.muted }}>Registo novo.</div>}
                {l.acao === 'apagou' && <div style={{ fontSize: 12.5, color: T.muted }}>O registo foi apagado.</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                  <span style={{ ...mono, fontSize: 11, color: T.mutedDim }}>
                    {new Date(l.ate).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {q.email ? ` · ${q.email}` : ''}
                  </span>
                  {f.secao.tab && onIr && l.acao !== 'apagou' && (
                    <button type="button" onClick={() => { onIr(f.secao.tab); onClose(); }} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', cursor: 'pointer', ...body,
                      border: `1px solid ${T.line}`, borderRadius: 8, color: T.cream, fontSize: 12, padding: '5px 10px',
                    }}>Ir para {f.secao.label} <ArrowRight size={12} /></button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ---------- estados ---------- */
  let corpo;
  if (semTabela) {
    corpo = (
      <div style={{ maxWidth: 560, margin: '30px auto', textAlign: 'center' }}>
        <div style={{ ...display, color: T.warn, fontSize: 20, marginBottom: 8 }}>O relato ainda não está ligado</div>
        <div style={{ color: T.muted, fontSize: 13.5, lineHeight: 1.6, marginBottom: 20 }}>
          Falta correr o <span style={{ ...mono, color: T.cream }}>1a_activity_log_estrutura.sql</span> no SQL Editor do Supabase.
          A partir daí cada alteração, em qualquer secção, fica registada aqui. Para já, o resumo que existe:
        </div>
        <div style={{ textAlign: 'left' }}><LastActivity lastEdits={lastEdits || {}} /></div>
      </div>
    );
  } else {
    const ultimo = lancesBase[0];
    const nPessoas = porPessoa.filter(([k]) => k !== QUIOSQUE && k !== AUTOMATICO && k !== DIRETO).length;
    const aCarregar = linhas === null;
    corpo = (
      <>
        <div style={{ color: T.muted, fontSize: 12.5, marginBottom: 14, height: 18 }}>
          {aCarregar ? <span style={{ color: T.mutedDim }}>A carregar…</span> : (<>
            <span style={{ ...mono, color: T.cream }}>{lancesBase.length}{haMais ? '+' : ''}</span> {lancesBase.length === 1 ? 'lance' : 'lances'}
            {' · '}<span style={{ ...mono, color: T.cream }}>{nPessoas}</span> {nPessoas === 1 ? 'pessoa' : 'pessoas'}
            {ultimo && <> · último {timeAgo(ultimo.ate)}</>}
          </>)}
        </div>

        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Search size={14} color={T.mutedDim} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Procurar jogador, sessão, adversário, campo…" style={{ paddingLeft: 30, width: '100%', boxSizing: 'border-box' }} />
        </div>

        {/* Só pessoas: a equipa técnica e, juntos, os jogadores (quiosque). */}
        {fila(porPessoa.map(([k, n]) => {
          const q = quemE(k);
          return pill(pessoa === k, () => setPessoa(pessoa === k ? '' : k), <>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: q.cor }} />
            <span style={{ textTransform: q.quiosque ? 'none' : 'capitalize' }}>{q.nome}</span>
            {q.eu && <span style={{ fontSize: 10, opacity: .8 }}>(tu)</span>}
            <span style={{ ...mono, opacity: .75 }}>{n}</span>
          </>, k, k === AUTOMATICO ? 'Alterações feitas pelo servidor ao preparar vídeos' : k === DIRETO ? 'Alterações feitas diretamente na base de dados (ex.: SQL no Supabase)' : q.quiosque ? 'Respostas dos jogadores no quiosque' : (q.email || undefined));
        }))}

        <div style={{ marginTop: 10, minHeight: '60vh' }}>
          {erro && <div style={{ color: T.bad, fontSize: 12.5, marginBottom: 10 }}>{erro}</div>}
          {aCarregar ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 className="animate-spin" color={T.warn} size={22} /></div>
          ) : porDia.length === 0 ? (
            <EmptyState text={temFiltro ? 'Nenhum lance com estes filtros.' : 'Ainda sem alterações registadas.'}
              action={temFiltro ? <Btn variant="ghost" onClick={limparFiltros}>Limpar filtros</Btn> : null} />
          ) : porDia.map(dia => (
            <div key={dia.k} style={{ marginBottom: 8 }}>
              {(() => {
                const aberto = temFiltro || diasAbertos.has(dia.k);
                return (
                  <>
                    <button type="button" disabled={temFiltro}
                      onClick={(e) => {
                        // Fechar um dia: o cabeçalho fica onde está, a página não salta.
                        const el = e.currentTarget;
                        if (aberto) fecharSemSaltar(el, () => alternarDia(dia.k));
                        else alternarDia(dia.k);
                      }}
                      style={{
                      position: 'sticky', top: 0, zIndex: 2, background: T.bg, padding: '8px 0 10px', width: '100%',
                      display: 'flex', alignItems: 'baseline', gap: 10, border: 'none', cursor: temFiltro ? 'default' : 'pointer', textAlign: 'left', ...body,
                    }}>
                      <span style={{ ...display, color: T.cream, fontSize: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{tituloDia(dia.k)}</span>
                      <span style={{ ...mono, color: T.mutedDim, fontSize: 11.5 }}>{dia.itens.length} {dia.itens.length === 1 ? 'lance' : 'lances'}</span>
                      <div style={{ flex: 1, height: 1, background: T.line, alignSelf: 'center' }} />
                      {!temFiltro && <ChevronDown size={16} color={T.mutedDim} style={{ alignSelf: 'center', transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />}
                    </button>
                    {aberto && dia.itens.map(lance)}
                  </>
                );
              })()}
            </div>
          ))}
          {!aCarregar && haMais && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
              <Btn variant="ghost" onClick={carregarMais} disabled={aCarregarMais}>
                {aCarregarMais ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />} Carregar mais antigos
              </Btn>
            </div>
          )}
        </div>
      </>
    );
  }

  const pagina = (
    <div ref={scrollRef} style={{ position: 'fixed', inset: 0, background: T.bg, zIndex: 55, overflowY: 'auto', overflowX: 'hidden', scrollbarGutter: 'stable', ...body }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: isMobile ? 14 : 24, paddingBottom: 70 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ ...display, color: T.cream, fontSize: isMobile ? 24 : 28, fontWeight: 600, margin: 0 }}>Toda a atividade</h1>
            <div style={{ color: T.mutedDim, fontSize: 13, marginTop: 3 }}>Quem mexeu, onde e o quê.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {!semTabela && (
              <button type="button" onClick={carregar} disabled={aAtualizar} title="Atualizar" style={{ background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 8, color: T.muted, cursor: aAtualizar ? 'default' : 'pointer', padding: 8, display: 'flex' }}>
                <RefreshCw size={16} className={aAtualizar ? 'animate-spin' : undefined} />
              </button>
            )}
            <button type="button" onClick={onClose} title="Fechar" style={{ background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 8, color: T.cream, cursor: 'pointer', padding: 8, display: 'flex' }}>
              <X size={16} />
            </button>
          </div>
        </div>
        <div style={{ height: 12 }} />
        {corpo}
        {espacoSemSaltar}
      </div>
      <BotaoTopo alvoRef={scrollRef} isMobile={isMobile} onFechar={onClose} soAlvo />
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(pagina, document.body) : pagina;
}


function useEquipas() {
  const [equipas, setEquipas] = useState(null); // null = ainda a carregar
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      const sessao = await ensureSession();
      if (!sessao) throw new Error('Sem sessão válida.');
      /* A RLS já limita este select às equipas de que sou membro, por
         isso não é preciso filtrar aqui. */
      const { data, error } = await supabase
        .from('teams').select('id, nome, clube, escalao, codigo, logo, cor').order('nome');
      if (error) throw error;
      setEquipas(data || []);
    } catch (e) {
      console.error('Falha a carregar equipas', e);
      setErro(e.message || 'Não foi possível carregar as equipas.');
      setEquipas([]);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  return { equipas, erro, recarregar: carregar };
}


function useMembros(teamId) {
  const [membros, setMembros] = useState(null);

  const carregar = useCallback(async () => {
    if (!teamId) { setMembros([]); return; }
    try {
      const { data, error } = await selecionarMembros(teamId);
      if (error) throw error;
      setMembros(data || []);
    } catch (e) {
      console.error('Falha a carregar membros', e);
      setMembros([]);
    }
  }, [teamId]);

  useEffect(() => { carregar(); }, [carregar]);
  return { membros, recarregar: carregar };
}


/* Ecrã de quem ainda não tem equipa nenhuma: criar ou entrar com código.
   É o primeiro que um treinador novo vê depois de confirmar o email. */
function EscolherEquipa({ onPronto, onSair, temEquipas, equipas }) {
  /* Começa SEM modo escolhido: só as duas opções, sem campos nenhuns.

     Abrir já no formulário de criação decide por quem chega — e quem
     chega com um código na mão via um formulário de criar equipa e um
     botão pequeno ao lado, o que é a leitura errada de um ecrã onde as
     duas hipóteses valem o mesmo. Os campos aparecem depois de a escolha
     ser feita, e são os do caminho escolhido. */
  const [modo, setModo] = useState(null); // null | 'criar' | 'entrar'
  const [nome, setNome] = useState('');
  const [clube, setClube] = useState('');
  const [escalao, setEscalao] = useState('');
  const [logo, setLogo] = useState('');
  const [cor, setCor] = useState('#B5393F');
  const [codigo, setCodigo] = useState('');
  /* O NOME PEDE-SE À ENTRADA.

     Sem ele, quem entra por código fica na lista dos outros como
     "Membro 975c82" — e a atribuir tarefas a um código ninguém percebe
     quem é. Pedi-lo aqui é o único momento em que a pessoa está mesmo a
     apresentar-se; pedir depois significa que quase ninguém o faz. */
  const [meuNome, setMeuNome] = useState('');
  /* O TELEMÓVEL TAMBÉM SE PEDE À ENTRADA, pela mesma razão do nome: é o
     momento em que a pessoa se apresenta à equipa. Serve para os colegas
     lhe lembrarem tarefas por WhatsApp. Obrigatório para quem entra com
     código; opcional para quem cria (pode pô-lo depois, e como dono pode
     pô-lo também pelos outros em "Gerir equipa"). */
  const [meuTelefone, setMeuTelefone] = useState('');
  const [meuGenero, setMeuGenero] = useState('');
  const [aProcessar, setAProcessar] = useState(false);
  const [erro, setErro] = useState('');

  /* Uma equipa igual a outra que já tenho.

     Criar "Sub-19 · SC Salgueiros" duas vezes é fácil e sai caro: os
     dados dividem-se por duas equipas com o mesmo aspeto, e depois de
     haver conteúdo nas duas é trabalhoso arrumar. Compara-se sem
     maiúsculas nem espaços das pontas, porque "sub-19 " e "Sub-19" são a
     mesma coisa para quem escreve.

     Avisa, não bloqueia: um clube pode ter mesmo duas equipas do mesmo
     escalão (A e B), e não me cabe decidir por quem sabe. */
  const igual = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const jaExiste = (equipas || []).find(e => igual(e.nome, nome) && igual(e.clube, clube));

  /* Depois de a equipa existir (criada ou com entrada feita): a função
     do Supabase que cria/entra não conhece o telemóvel, por isso grava-se
     logo a seguir, na própria linha. Se falhar (por exemplo, a coluna
     ainda não existir), a pessoa entra na mesma e só fica um aviso na
     consola; pode pô-lo depois em "Gerir equipa". */
  const gravarMeuTelefoneDepois = async (teamId) => {
    if (!teamId || (!meuTelefone.trim() && !meuGenero)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session && session.user && session.user.id;
      if (!uid) return;
      const msg = await gravarTelefoneMembro(teamId, uid, meuTelefone);
      if (msg) console.error('Não foi possível gravar o telemóvel:', msg);
      if (meuGenero) {
        const msgG = await gravarGeneroMembro(teamId, uid, meuGenero);
        if (msgG) console.error('Não foi possível gravar o género:', msgG);
      }
    } catch (e) { console.error('Não foi possível gravar o telemóvel:', e); }
  };

  const criarMesmoAssim = async () => {
    if (!telefoneValido(meuTelefone)) { setErro('Esse telemóvel não parece válido. Inclui o indicativo, por exemplo +351 912 345 678.'); return; }
    setErro(''); setAProcessar(true);
    try {
      const { data, error } = await supabase.rpc('criar_equipa', {
        p_nome: nome.trim(), p_clube: clube.trim(), p_escalao: escalao.trim(),
        p_logo: logo.trim() || null, p_meu_nome: meuNome.trim() || null,
      });
      if (error) throw error;
      // A cor não faz parte da função que cria a equipa — grava-se logo a
      // seguir, na equipa que acabou de nascer, pelo mesmo caminho usado
      // depois em "Gerir equipa" (a mesma coluna `cor` na tabela `teams`).
      // Não impede a equipa de nascer se isto falhar (por exemplo, a
      // coluna ainda não existir no Supabase) — só avisa.
      if (cor && data) {
        const { error: erroCor } = await supabase.from('teams').update({ cor }).eq('id', data);
        if (erroCor) console.error('Não foi possível gravar a cor da equipa:', erroCor.message);
      }
      await gravarMeuTelefoneDepois(data);
      onPronto(data);
    } catch (e) {
      setErro(e.message || 'Não foi possível criar a equipa.');
      setAProcessar(false);
    }
  };

  const criar = () => {
    if (!nome.trim()) { setErro('Dá um nome à equipa.'); return; }
    if (jaExiste) {
      askConfirm({
        title: 'Já tens uma equipa assim',
        label: [jaExiste.clube, jaExiste.escalao || jaExiste.nome].filter(Boolean).join(' · '),
        note: 'Ficas com duas equipas com o mesmo nome, e os dados divididos entre elas. Se for mesmo uma segunda equipa (por exemplo, a B), continua.',
        confirmLabel: 'Criar mesmo assim',
        destructive: false,
        onConfirm: criarMesmoAssim,
      });
      return;
    }
    criarMesmoAssim();
  };

  const entrar = async () => {
    if (!codigo.trim()) { setErro('Escreve o código que te deram.'); return; }
    if (!meuNome.trim()) { setErro('Escreve o teu nome, para a equipa saber quem és.'); return; }
    if (!meuTelefone.trim()) { setErro('Escreve o teu telemóvel, para os colegas te poderem lembrar de tarefas.'); return; }
    if (!meuGenero) { setErro('Escolhe o teu género, para o texto das mensagens.'); return; }
    if (!telefoneValido(meuTelefone)) { setErro('Esse telemóvel não parece válido. Inclui o indicativo, por exemplo +351 912 345 678.'); return; }
    setErro(''); setAProcessar(true);
    try {
      const { data, error } = await supabase.rpc('entrar_na_equipa', {
        p_codigo: codigo.trim(), p_nome: meuNome.trim() || null,
      });
      if (error) throw error;
      await gravarMeuTelefoneDepois(data);
      onPronto(data);
    } catch (e) {
      setErro(/inválido/i.test(e.message || '') ? 'Código inválido. Confirma as seis letras.' : (e.message || 'Não foi possível entrar.'));
      setAProcessar(false);
    }
  };

  /* Antes de haver escolha, as duas opções pesam o mesmo e são o assunto
     do ecrã — daí serem maiores. Depois de escolhida, encolhem e voltam a
     ser o que são: um separador entre dois caminhos. */
  const aba = (id, texto) => {
    const on = modo === id;
    return (
      <button type="button" onClick={() => { setModo(id); setErro(''); }} style={{
        flex: 1, padding: modo ? '9px 12px' : '13px 12px', borderRadius: 8,
        fontSize: modo ? 13 : 14, fontWeight: on ? 600 : 500, cursor: 'pointer', ...body,
        background: on ? '#B5393F' : 'transparent',
        color: on ? TEXT_ON_ACCENT : T.cream,
        border: `1px solid ${on ? '#B5393F' : T.line}`,
        transition: 'padding .15s, font-size .15s',
      }}>{texto}</button>
    );
  };

  return (
    <div data-mjp-app="" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: T.bg, padding: 20, ...body,
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: T.surface,
        border: `1px solid ${T.line}`, borderRadius: 14, padding: 28,
      }}>
        <h1 style={{ fontSize: 21, color: T.cream, margin: '0 0 6px', ...display }}>
          {temEquipas ? 'Nova equipa' : 'Bem-vindo'}
        </h1>
        <p style={{ fontSize: 13, color: T.muted, margin: '0 0 20px', lineHeight: 1.6 }}>
          {modo === 'criar'
            ? 'Podes mudar tudo isto depois.'
            : modo === 'entrar'
              ? 'São seis letras. Pede-as a quem já está na equipa.'
              : (temEquipas
                ? 'Cria outra equipa ou entra numa com o código que te deram.'
                : 'Cria a tua equipa, ou entra numa existente com o código que o treinador te deu.')}
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {aba('criar', 'Criar equipa')}
          {aba('entrar', 'Entrar com código')}
        </div>

        {modo === 'criar' && (
          <>
            <Field label="Nome da equipa" bloco solto>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Sub-19" />
            </Field>
            <div style={{ height: 12 }} />
            <Field label="Clube" bloco solto>
              <Input value={clube} onChange={e => setClube(e.target.value)} placeholder="Ex: SC Salgueiros" />
            </Field>
            <div style={{ height: 12 }} />
            <Field label="Escalão" bloco solto>
              <Input value={escalao} onChange={e => setEscalao(e.target.value)} placeholder="Ex: Sub-19" />
            </Field>
            <div style={{ height: 12 }} />
            {/* O EMBLEMA PERGUNTA-SE AQUI, E NÃO SÓ DEPOIS.

                Existia apenas dentro da vista da equipa, onde se descobre
                por acaso — e uma equipa sem emblema fica sem ele durante
                meses. Este é o momento em que a pessoa está a pensar no
                clube; é aqui que a resposta está à mão.

                Opcional de propósito: quem só quer começar carrega em
                Criar equipa e resolve isto quando lhe apetecer. */}
            <Field label="Emblema (opcional)" bloco solto>
              <Input
                value={logo}
                onChange={e => setLogo(e.target.value)}
                placeholder="https://… endereço de uma imagem"
              />
            </Field>
            <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 6, lineHeight: 1.6 }}>
              Cola o endereço de uma imagem. É possível alterar depois.
            </div>
            <div style={{ height: 12 }} />
            {/* A COR ESCOLHE-SE JÁ AQUI, tal como o emblema — é o mesmo
                momento em que se pensa na identidade da equipa. As bolas
                dos jogadores nos quadros de posições (Simulador, Ficha de
                Jogo, Estrutura habitual de um adversário) usam-na em vez
                do vermelho de sempre. Também se pode trocar depois, em
                "Gerir equipa". */}
            <Field label="Cor da equipa" bloco solto>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="color"
                  value={cor}
                  onChange={e => setCor(e.target.value)}
                  style={{ width: 44, height: 44, padding: 0, border: `1px solid ${T.line}`, borderRadius: 8, background: 'none', cursor: 'pointer', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Input value={cor} onChange={e => setCor(e.target.value)} placeholder="#B5393F" />
                </div>
              </div>
            </Field>
            <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 6, lineHeight: 1.6 }}>
              Escolhe a cor para o 2D do jogador. É possível alterar depois.
            </div>
            <div style={{ height: 12 }} />
            <Field label="O teu nome" bloco solto>
              <Input value={meuNome} onChange={e => setMeuNome(e.target.value)} placeholder="Nome e apelido" />
            </Field>
            <div style={{ height: 12 }} />
            <Field label="O teu telemóvel (opcional)" bloco solto>
              <Input type="tel" inputMode="tel" autoComplete="tel" value={meuTelefone} onChange={e => setMeuTelefone(e.target.value)} placeholder="+351 912 345 678" />
            </Field>
            <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 6, lineHeight: 1.6 }}>
              Para os colegas te lembrarem de tarefas por WhatsApp. Só a equipa o vê.
            </div>
            <div style={{ height: 12 }} />
            <Field label="Género, para o texto das mensagens (opcional)" bloco solto>
              <Select value={meuGenero} onChange={e => setMeuGenero(e.target.value)}>
                <option value="">Escolher…</option>
                {GENEROS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
          </>
        )}

        {modo === 'entrar' && (
          <Field label="Código da equipa" bloco solto>
            <Input
              value={codigo}
              onChange={e => setCodigo(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              style={{ ...mono, fontSize: 18, letterSpacing: '.18em', textTransform: 'uppercase' }}
              autoFocus
            />
          </Field>
        )}

        {modo === 'entrar' && (
          <>
            <div style={{ height: 12 }} />
            <Field label="O teu nome" bloco solto>
              <Input value={meuNome} onChange={e => setMeuNome(e.target.value)} placeholder="Nome e apelido" />
            </Field>
            <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 6, lineHeight: 1.6 }}>
              É como apareces para o resto da equipa técnica nas tarefas.
            </div>
            <div style={{ height: 12 }} />
            <Field label="O teu telemóvel" bloco solto>
              <Input type="tel" inputMode="tel" autoComplete="tel" value={meuTelefone} onChange={e => setMeuTelefone(e.target.value)} placeholder="+351 912 345 678" />
            </Field>
            <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 6, lineHeight: 1.6 }}>
              Para os colegas te lembrarem de tarefas por WhatsApp. Só a equipa o vê.
            </div>
            <div style={{ height: 12 }} />
            <Field label="Género, para o texto das mensagens" bloco solto>
              <Select value={meuGenero} onChange={e => setMeuGenero(e.target.value)}>
                <option value="">Escolher…</option>
                {GENEROS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
          </>
        )}

        {erro && <div style={{ color: T.bad, fontSize: 12.5, marginTop: 14 }}>{erro}</div>}

        {modo && (
          <div style={{ marginTop: 20 }}>
            <Btn
              onClick={modo === 'criar' ? criar : entrar}
              disabled={aProcessar}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {aProcessar ? 'A processar…' : modo === 'criar' ? 'Criar equipa' : 'Entrar'}
            </Btn>
          </div>
        )}

        <button type="button" onClick={onSair} style={{
          width: '100%', marginTop: 12, padding: 8, background: 'transparent', border: 'none',
          color: T.mutedDim, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline', ...body,
        }}>
          {temEquipas ? 'Voltar' : 'Terminar sessão'}
        </button>
      </div>
    </div>
  );
}


function SeletorEquipa({ equipas, equipaAtiva, onNova, onGerir }) {
  const [aberto, setAberto] = useState(false);
  const atual = equipas.find(e => e.id === equipaAtiva);
  /* Só o escalão, não o clube outra vez.

     O clube está escrito na linha imediatamente acima, em maior. Repeti-lo
     aqui dava "SC Salgueiros · Sub-19" debaixo de "SC Salgueiros" — e no
     telemóvel, com o botão de fechar ao lado, não cabia e cortava
     precisamente na parte que interessa: o escalão. Dentro da lista o
     clube volta, porque aí é onde ele distingue. */
  const rotulo = atual ? (atual.escalao || atual.nome || 'Equipa') : 'Sem equipa';

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setAberto(v => !v)}
        title="Trocar de equipa"
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          color: T.muted, fontSize: 12, textAlign: 'left', ...body,
        }}
      >
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rotulo}</span>
        <ChevronRight size={13} style={{ flexShrink: 0, transform: aberto ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {aberto && (
        <>
          {/* Camada por baixo do menu: clicar fora fecha. */}
          <div onClick={() => setAberto(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8, zIndex: 41,
            background: T.surfaceRaise, border: `1px solid ${T.line}`, borderRadius: 10,
            boxShadow: '0 16px 40px #00000070', overflow: 'hidden',
          }}>
            {equipas.map(e => {
              const on = e.id === equipaAtiva;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => { setAberto(false); if (!on) trocarDeEquipa(e.id); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                    padding: '10px 14px', background: on ? '#B5393F22' : 'transparent', border: 'none',
                    borderBottom: `1px solid ${T.line}`, cursor: on ? 'default' : 'pointer',
                    color: on ? T.cream : T.muted, fontSize: 13, ...body,
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[e.clube, e.escalao || e.nome].filter(Boolean).join(' · ')}
                  </span>
                  {on && <Check size={14} style={{ flexShrink: 0, color: T.gold }} />}
                </button>
              );
            })}
            <button type="button" onClick={() => { setAberto(false); onGerir(); }} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
              padding: '10px 14px', background: 'transparent', border: 'none',
              borderBottom: `1px solid ${T.line}`, cursor: 'pointer', color: T.muted, fontSize: 12.5, ...body,
            }}><Users size={13} /> Membros e convite</button>
            <button type="button" onClick={() => { setAberto(false); onNova(); }} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
              padding: '10px 14px', background: 'transparent', border: 'none',
              cursor: 'pointer', color: T.muted, fontSize: 12.5, ...body,
            }}><Plus size={13} /> Nova equipa</button>
          </div>
        </>
      )}
    </div>
  );
}

function DataTools({ season, setSeason, players, setPlayers, exercises, setExercises, ideias, setIdeias, sessions, setSessions, monitoring, setMonitoring, matches, setMatches, scouting, setScouting, videos, setVideos, apresentacoes, setApresentacoes, convocatorias, setConvocatorias, diario, setDiario, clinico, setClinico, desenvolvimento, setDesenvolvimento, standings, setStandings }) {
  const fileInputRef = React.useRef(null);
  const [importOpen, setImportOpen] = useState(false);
  const [erroImport, setErroImport] = useState('');

  const doExport = () => {
    /* TUDO O QUE A APP GUARDA — SEM EXCEÇÕES.

       Esta lista tem de crescer com cada coleção nova. Já esteve três
       módulos atrás: um ficheiro exportado antes desta correção não
       levava o Boletim Clínico, o Desenvolvimento Individual nem a
       classificação, e ninguém dava por isso até precisar de restaurar. */
    const data = {
      season, players, exercises, ideias, sessions, monitoring, matches,
      scouting, videos, apresentacoes, convocatorias, diario,
      clinico, desenvolvimento, standings,
      exportedAt: new Date().toISOString(),
      versao: 2,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `epoca-${(season?.name || 'dados').replace(/\//g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErroImport('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.season) setSeason(data.season);
        setPlayers(data.players || []);
        setExercises(data.exercises || []);
        // Compatível com backups antigos, feitos antes da Ideia de Jogo existir.
        setIdeias(data.ideias || []);
        setSessions(data.sessions || []);
        setMonitoring(data.monitoring || []);
        setMatches(data.matches || []);
        setScouting(data.scouting || []);
        setVideos(data.videos || []);
        setApresentacoes(data.apresentacoes || []);
        setConvocatorias(data.convocatorias || []);
        setDiario(data.diario || []);
        /* Só se o ficheiro os trouxer. Um backup antigo (versão 1) não os
           tem, e escrever [] apagaria o que está na app — restaurar uma
           coleção não pode significar destruir outra. */
        if (data.clinico && setClinico) setClinico(data.clinico);
        if (data.desenvolvimento && setDesenvolvimento) setDesenvolvimento(data.desenvolvimento);
        if (data.standings && setStandings) setStandings(data.standings);
      } catch (err) {
        // Além da consola (para eu conseguir diagnosticar), a pessoa
        // TEM de ver que a importação falhou — antes disto, um ficheiro
        // corrompido ou do formato errado falhava em silêncio: o botão
        // "Escolher ficheiro" fechava a janela e não acontecia mais nada
        // visível, dando a entender que tinha corrido bem.
        console.error('Importação falhou', err);
        setErroImport('Não foi possível importar este ficheiro. Confirma que é um backup exportado por esta app (Exportar → guarda o .json → Importar esse mesmo ficheiro).');
      }
    };
    reader.onerror = () => setErroImport('Não foi possível ler o ficheiro. Tenta escolher outra vez.');
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', gap: 14 }}>
        <button onClick={doExport} title="Exportar dados" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, ...body }}>
          <Download size={13} /> Exportar
        </button>
        <button onClick={() => setImportOpen(true)} title="Importar dados" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, ...body }}>
          <Upload size={13} /> Importar
        </button>
        <input type="file" accept="application/json" ref={fileInputRef} onChange={handleImportFile} style={{ display: 'none' }} />
      </div>
      {erroImport && (
        <div style={{ fontSize: 11.5, color: T.bad, maxWidth: 320, lineHeight: 1.4, ...body }}>{erroImport}</div>
      )}

      {importOpen && (
        <Modal title="Importar dados" onClose={() => setImportOpen(false)}>
          <p style={{ fontSize: 13, color: T.mutedDim, marginBottom: 18, lineHeight: 1.5 }}>
            Isto substitui todos os dados atuais nesta plataforma (plantel, exercícios, planeamento, jogos, monitorização, scouting, vídeos, apresentações) pelos do ficheiro escolhido. Não pode ser desfeito.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="ghost" onClick={() => setImportOpen(false)}>Cancelar</Btn>
            <Btn onClick={() => { setImportOpen(false); fileInputRef.current?.click(); }}>Escolher ficheiro</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ ...display, fontSize: 26, color: T.warn, fontWeight: 600, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: T.cream, opacity: .75, marginTop: 3, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
    </div>
  );
}


function WellnessSummary({ players, monitoring }) {
  const latestByPlayer = players.map(p => {
    const recs = monitoring.filter(m => m.playerId === p.id).sort((a, b) => new Date(b.date) - new Date(a.date));
    const wellnessRec = recs.find(r => typeof r.sono === 'number');
    const rpeRec = recs.find(r => typeof r.pse === 'number');
    return { player: p, wellnessRec, rpeRec };
  }).filter(x => x.wellnessRec || x.rpeRec);

  if (latestByPlayer.length === 0) return <EmptyState text="Sem registos de monitorização ainda." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {latestByPlayer.slice(0, 6).map(({ player, wellnessRec, rpeRec }) => {
        const avg = wellnessAvg(wellnessRec);
        const color = avg === null ? T.mutedDim : avg >= 4 ? T.good : avg >= 2.5 ? T.warn : T.bad;
        return (
          <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <div style={{ fontSize: 13.5, color: T.cream, flex: 1 }}>{player.name}</div>
            <div style={{ ...mono, fontSize: 12, color: T.mutedDim }}>{rpeRec ? `PSE ${rpeRec.pse}` : '—'}</div>
          </div>
        );
      })}
    </div>
  );
}

/* Recolhe o estatuto principal (statusMain) de cada jogador do plantel e
   mostra a distribuição, da hierarquia mais alta para a mais baixa, com
   uma barra proporcional ao peso de cada estatuto no plantel. */
const STATUS_SUMMARY_COLORS = {
  'Jogador de Elite': T.good,
  'Potencial Titular': T.warn,
  'Alternativa aos Titulares': T.warn,
  'Reserva': T.mutedDim,
  'Dispensável': T.bad,
};


/* Nome curto para tabelas estreitas: primeiro nome + inicial do apelido.
   O apelido entra porque só o primeiro nome cria ambiguidades no plantel
   (dois "Martim", dois "João"). */
function firstNameInitial(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

function matrixPoints(players, monitoring) {
  const end = todayStr();
  const start = addDays(end, -6);
  const inWindow = (d) => d >= start && d <= end;
  return players.map(p => {
    const recs = (monitoring || []).filter(m => m.playerId === p.id && inWindow(m.date));
    const wellVals = recs.filter(m => typeof m.sono === 'number').map(wellnessAvg).filter(v => typeof v === 'number');
    const pseVals = recs.filter(m => typeof m.pse === 'number').map(m => m.pse);
    if (!wellVals.length || !pseVals.length) return null;
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    return {
      id: p.id,
      name: p.name,
      label: `${p.position ? `${p.position} ` : ''}${firstNameOf(p.name)}`,
      // Nome completo para a etiqueta que aparece ao tocar/passar o rato:
      // a abreviatura chega para o gráfico, mas não para identificar.
      nome: `${p.position ? `${p.position} · ` : ''}${p.name}`,
      well: mean(wellVals),
      pse: mean(pseVals),
      dias: Math.max(wellVals.length, pseVals.length),
    };
  }).filter(Boolean);
}

// Quadrante em que cada jogador cai (linhas divisórias: Wellness 3, PSE 5).
function quadrantOf(pt) {
  if (pt.pse >= 5) return pt.well < 3 ? 'alerta' : 'aguenta';
  return pt.well < 3 ? 'malestar' : 'margem';
}
const QUADRANTS = {
  alerta: { label: 'Alerta', color: T.bad, hint: 'Esforço alto com wellness baixo' },
  aguenta: { label: 'Aguenta bem', color: T.good, hint: 'Esforço alto com wellness bom' },
  malestar: { label: 'Mal-estar', color: T.warn, hint: 'Wellness baixo sem carga que o explique' },
  margem: { label: 'Margem para carga', color: T.mutedDim, hint: 'Wellness bom com esforço baixo' },
};

/* O gráfico em si. `scale` amplia tipos de letra e pontos na versão
   grande, sem duplicar o desenho. */
function MatrixChart({ points, W = 320, H = 260, scale = 1, estilo }) {
  /* IDENTIFICAR PONTOS — pelo ponto MAIS PRÓXIMO do cursor, não pelo
     ponto que está por baixo dele.

     Antes, cada ponto tinha o seu próprio alvo invisível (um círculo
     maior) com um <title>. Com o plantel amontoado, os alvos tapavam-se
     uns aos outros: só o de cima respondia, e vários pontos não davam
     nada ao passar o rato. Agora há uma única camada por cima do
     gráfico que, a cada movimento, procura o ponto mais perto; os pontos
     praticamente no mesmo sítio (mesmos valores) aparecem todos juntos
     na mesma etiqueta. O ponto em foco destaca-se sozinho; o resto do
     gráfico não muda, para não piscar.

     No telemóvel não há rato: o toque faz o mesmo e fica fixado até se
     tocar noutro sítio. */
  const svgRef = useRef(null);
  const [emFoco, setEmFoco] = useState(null);   // rato: ids em foco
  const [tocado, setTocado] = useState(null);   // toque: ids fixados
  const ml = 30 * scale, mr = 12 * scale, mt = 12 * scale, mb = 26 * scale;
  const plotW = W - ml - mr, plotH = H - mt - mb;
  const xOf = (well) => ml + ((Math.max(1, Math.min(5, well)) - 1) / 4) * plotW;
  const yOf = (pse) => mt + (1 - Math.max(0, Math.min(10, pse)) / 10) * plotH;
  const midX = xOf(3), midY = yOf(5);
  const fs = 7.5 * scale, fsAxis = 8.5 * scale;

  const posicoes = points.map(pt => ({ pt, x: xOf(pt.well), y: yOf(pt.pse) }));

  // Coordenadas do rato/dedo no sistema do SVG (o SVG é redimensionado).
  const noSvg = (e) => {
    const svg = svgRef.current;
    if (!svg || !svg.getScreenCTM) return null;
    const p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const m = svg.getScreenCTM();
    return m ? p.matrixTransform(m.inverse()) : null;
  };
  // Ids do ponto mais próximo e dos que estão praticamente no mesmo sítio.
  const idsPerto = (e) => {
    const c = noSvg(e);
    if (!c || !posicoes.length) return null;
    let melhor = null;
    posicoes.forEach(q => {
      const d = Math.hypot(q.x - c.x, q.y - c.y);
      if (!melhor || d < melhor.d) melhor = { ...q, d };
    });
    if (!melhor || melhor.d > 18 * scale) return null;
    return posicoes.filter(q => Math.hypot(q.x - melhor.x, q.y - melhor.y) <= 5 * scale).map(q => q.pt.id);
  };
  const mesmos = (a, b) => (a || []).join('|') === (b || []).join('|');
  const ativos = emFoco || tocado;
  const ativosSet = new Set(ativos || []);

  // Afasta etiquetas quase sobrepostas, para os nomes não ficarem uns por
  // cima dos outros. Quando a etiqueta fica longe do ponto, desenha-se
  // um traço fino a ligá-los.
  const placed = [];
  const labelOffset = (x, y) => {
    let dy = -6 * scale;
    while (placed.some(q => Math.abs(q.x - x) < 34 * scale && Math.abs(q.y - (y + dy)) < 8 * scale) && dy > -34 * scale) dy -= 8 * scale;
    placed.push({ x, y: y + dy });
    return dy;
  };

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', touchAction: 'manipulation', ...estilo }}>
      <rect x={ml} y={mt} width={midX - ml} height={midY - mt} fill={`${T.bad}18`} />
      <rect x={midX} y={mt} width={ml + plotW - midX} height={midY - mt} fill={`${T.warn}12`} />
      <rect x={ml} y={midY} width={midX - ml} height={mt + plotH - midY} fill={`${T.warn}10`} />
      <rect x={midX} y={midY} width={ml + plotW - midX} height={mt + plotH - midY} fill={`${T.good}14`} />

      <rect x={ml} y={mt} width={plotW} height={plotH} fill="none" stroke={T.line} strokeWidth={scale} />
      <line x1={midX} y1={mt} x2={midX} y2={mt + plotH} stroke={T.line} strokeWidth={scale} strokeDasharray={`${3 * scale} ${3 * scale}`} />
      <line x1={ml} y1={midY} x2={ml + plotW} y2={midY} stroke={T.line} strokeWidth={scale} strokeDasharray={`${3 * scale} ${3 * scale}`} />

      <text x={ml + 5 * scale} y={mt + 11 * scale} fontSize={fs} fill={T.bad} style={{ fontFamily: "'Inter', sans-serif" }}>Alerta</text>
      <text x={ml + plotW - 5 * scale} y={mt + 11 * scale} fontSize={fs} fill={T.good} textAnchor="end" style={{ fontFamily: "'Inter', sans-serif" }}>Aguenta bem</text>
      <text x={ml + 5 * scale} y={mt + plotH - 5 * scale} fontSize={fs} fill={T.warn} style={{ fontFamily: "'Inter', sans-serif" }}>Mal-estar</text>
      <text x={ml + plotW - 5 * scale} y={mt + plotH - 5 * scale} fontSize={fs} fill={T.mutedDim} textAnchor="end" style={{ fontFamily: "'Inter', sans-serif" }}>Margem p/ carga</text>

      <text x={ml + plotW / 2} y={H - 6 * scale} fontSize={fsAxis} fill={T.muted} textAnchor="middle" style={{ fontFamily: "'Inter', sans-serif" }}>Wellness (1–5) →</text>
      <text x={9 * scale} y={mt + plotH / 2} fontSize={fsAxis} fill={T.muted} textAnchor="middle" transform={`rotate(-90 ${9 * scale} ${mt + plotH / 2})`} style={{ fontFamily: "'Inter', sans-serif" }}>Esforço PSE (0–10) →</text>
      <text x={ml - 4 * scale} y={mt + 4 * scale} fontSize={fs} fill={T.mutedDim} textAnchor="end" style={{ fontFamily: "'JetBrains Mono', monospace" }}>10</text>
      <text x={ml - 4 * scale} y={mt + plotH} fontSize={fs} fill={T.mutedDim} textAnchor="end" style={{ fontFamily: "'JetBrains Mono', monospace" }}>0</text>
      <text x={ml} y={mt + plotH + 10 * scale} fontSize={fs} fill={T.mutedDim} textAnchor="middle" style={{ fontFamily: "'JetBrains Mono', monospace" }}>1</text>
      <text x={ml + plotW} y={mt + plotH + 10 * scale} fontSize={fs} fill={T.mutedDim} textAnchor="middle" style={{ fontFamily: "'JetBrains Mono', monospace" }}>5</text>

      {posicoes.map(({ pt, x, y }) => {
        const color = QUADRANTS[quadrantOf(pt)].color;
        const dy = labelOffset(x, y);
        const anchor = x > ml + plotW - 40 * scale ? 'end' : x < ml + 40 * scale ? 'start' : 'middle';
        const realce = ativosSet.has(pt.id);
        // Só o ponto em foco muda (maior, contornado, nome a negrito). Os
        // outros NÃO se esbatem: ao passar o rato pelo gráfico, o foco
        // entra e sai a cada movimento e o gráfico todo piscava.
        return (
          <g key={pt.id} style={{ pointerEvents: 'none' }}>
            {dy < -8 * scale && (
              <line x1={x} y1={y - 3.2 * scale} x2={x} y2={y + dy + 2 * scale} stroke={T.line} strokeWidth={0.6 * scale} />
            )}
            <circle cx={x} cy={y} r={(realce ? 4.8 : 3.2) * scale} fill={color} stroke={realce ? T.cream : T.bg} strokeWidth={(realce ? 1.1 : 0.8) * scale} />
            <text x={x} y={y + dy} fontSize={fs} fill={T.cream} fontWeight={realce ? 700 : 400} textAnchor={anchor} style={{ fontFamily: "'Inter', sans-serif" }}>{pt.label}</text>
          </g>
        );
      })}

      {/* Camada única que responde ao rato e ao toque (ver o comentário
          no topo). Por cima dos pontos, por baixo da etiqueta. */}
      <rect
        x={0} y={0} width={W} height={H} fill="transparent"
        style={{ cursor: emFoco ? 'pointer' : 'default' }}
        onPointerMove={(e) => {
          if (e.pointerType !== 'mouse') return;
          const ids = idsPerto(e);
          if (!mesmos(ids, emFoco)) setEmFoco(ids);
        }}
        onPointerLeave={() => setEmFoco(null)}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') return;
          const ids = idsPerto(e);
          setTocado(!ids || mesmos(ids, tocado) ? null : ids);
        }}
      />

      {/* Etiqueta do ponto em foco (ou dos pontos no mesmo sítio). */}
      {(() => {
        if (!ativos || !ativos.length) return null;
        const sel = posicoes.filter(q => ativosSet.has(q.pt.id));
        if (!sel.length) return null;
        const { x, y } = sel[0];
        const linhas = sel.map(({ pt }) => `${pt.nome || pt.label} · W ${pt.well.toFixed(1)} · PSE ${pt.pse.toFixed(1)}`);
        const maior = Math.max(...linhas.map(l => l.length));
        const larg = Math.max(70 * scale, maior * 4.6 * scale + 12 * scale);
        const alt = (linhas.length * 11 + 6) * scale;
        const lx = Math.max(2, Math.min(W - larg - 2, x - larg / 2));
        const acima = y > mt + alt + 12 * scale;
        const ly = acima ? y - alt - 8 * scale : y + 9 * scale;
        return (
          <g style={{ pointerEvents: 'none' }}>
            <rect x={lx} y={ly} width={larg} height={alt} rx={3 * scale}
              fill={T.surfaceRaise} stroke={QUADRANTS[quadrantOf(sel[0].pt)].color} strokeWidth={0.8 * scale} />
            {linhas.map((l, i) => (
              <text key={i} x={lx + larg / 2} y={ly + (11 * i + 11) * scale} fontSize={fs} fill={T.cream} textAnchor="middle"
                style={{ fontFamily: "'Inter', sans-serif" }}>{l}</text>
            ))}
          </g>
        );
      })()}
    </svg>
  );
}

function WellnessLoadMatrix({ players, monitoring }) {
  const [open, setOpen] = useState(false);
  // No telemóvel a proporção larga ficaria baixa demais: volta ao 4:3.
  const estreito = useIsMobile(700);
  const points = matrixPoints(players, monitoring);
  const missing = players.length - points.length;

  if (points.length === 0) {
    return (
      <div style={{ fontSize: 12, color: T.mutedDim, lineHeight: 1.5 }}>
        Matriz wellness × esforço: ainda sem respostas suficientes nos últimos 7 dias. É preciso pelo menos um wellness e um PSE por jogador.
      </div>
    );
  }

  return (
    <>
      <div onClick={() => setOpen(true)} title="Abrir em grande" style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 11.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Wellness × esforço · últimos 7 dias
          </div>
          <Maximize2 size={13} color={T.mutedDim} />
        </div>
        <MatrixChart points={points} />
        <div style={{ fontSize: 11, color: T.mutedDim, marginTop: 6, lineHeight: 1.5 }}>
          {points.length} {points.length === 1 ? 'jogador posicionado' : 'jogadores posicionados'}.
          {missing > 0 && ` ${missing} sem wellness e PSE na semana.`}
        </div>
      </div>

      {open && (
        /* Página inteira, com a largura limitada a cerca de 60% do ecrã
           (na largura toda a matriz parecia esticada): a matriz em cima,
           ligeiramente mais larga do que alta, e as listas por quadrante
           por baixo, duas por linha. */
        <Modal title="Wellness × esforço · últimos 7 dias" onClose={() => setOpen(false)} fullPage larguraMax="max(60vw, 720px)">
          {estreito
            ? <MatrixChart points={points} W={640} H={480} scale={2} />
            : <MatrixChart points={points} W={820} H={470} scale={1.6} estilo={{ maxHeight: '68vh' }} />}

          <div style={{ display: 'grid', gridTemplateColumns: estreito ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '8px 20px', marginTop: 24, alignItems: 'start' }}>
            {/* Primeiro os dois quadrantes que pedem atenção (costumam ter
                poucos nomes), lado a lado; depois os dois grandes, também
                lado a lado — assim as colunas ficam com alturas parecidas
                e não sobram buracos. */}
            {['alerta', 'malestar', 'aguenta', 'margem'].map(key => [key, QUADRANTS[key]]).map(([key, q]) => {
              const list = points.filter(pt => quadrantOf(pt) === key)
                .sort((a, b) => b.pse - a.pse || a.well - b.well);
              // Um quadrante vazio fica no lugar (com uma linha a dizê-lo),
              // para a grelha manter sempre a mesma arrumação.
              return (
                <div key={key} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: q.color, flexShrink: 0 }} />
                    <span style={{ color: T.cream, fontSize: 13.5, fontWeight: 500 }}>{q.label}</span>
                    <span style={{ color: T.mutedDim, fontSize: 11.5 }}>· {q.hint}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {list.length === 0 && (
                      <div style={{ padding: '6px 10px', fontSize: 12.5, color: T.mutedDim, border: `1px dashed ${T.line}`, borderRadius: 7 }}>Ninguém neste quadrante.</div>
                    )}
                    {list.map(pt => (
                      <div key={pt.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
                        background: T.surface, border: `1px solid ${T.line}`, borderRadius: 7,
                      }}>
                        <span style={{ flex: 1, fontSize: 13, color: T.cream }}>{pt.name}</span>
                        <span style={{ ...mono, fontSize: 12, color: T.good }}>W {pt.well.toFixed(1)}</span>
                        <span style={{ ...mono, fontSize: 12, color: T.warn }}>PSE {pt.pse.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {missing > 0 && (
            <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 4, lineHeight: 1.5 }}>
              {missing} {missing === 1 ? 'jogador não aparece' : 'jogadores não aparecem'} na matriz — falta-lhes wellness ou PSE nos últimos 7 dias.
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Btn variant="ghost" onClick={() => setOpen(false)}>Fechar</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}

/* Lista de jogadores em "chips" (presenças da sessão, convocados do jogo e
   da convocatória). No telemóvel fica uma linha por jogador — lado a lado
   os nomes longos partiam-se e a lista ficava desalinhada. Mostra sempre a
   posição, nunca o número, e vem ordenada por posição. */
/* Partilhar / Imprimir / Editar no topo das fichas. No telemóvel os
   botões encolhem para caberem os três na mesma linha, em vez de o
   terceiro cair sozinho para baixo. */
function SheetActions({ onShare, onPrint, onEdit }) {
  const isMobile = useIsMobile(560);
  const st = isMobile ? { padding: '8px 10px', fontSize: 12.5, flex: 1, justifyContent: 'center' } : {};
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: isMobile ? 'nowrap' : 'wrap' }}>
      {onShare && <Btn variant="ghost" onClick={onShare} style={st}><Share2 size={14} /> Partilhar</Btn>}
      {onPrint && <Btn variant="ghost" onClick={onPrint} style={st}><Printer size={14} /> Imprimir</Btn>}
      {onEdit && <Btn variant="ghost" onClick={onEdit} style={st}><Pencil size={14} /> Editar</Btn>}
    </div>
  );
}


function PlantelStatusSummary({ players, compacto = false }) {
  const total = players.length;
  const ordered = [...STATUS_OPTIONS].reverse(); // Jogador de Elite primeiro
  const counts = ordered.map(status => ({
    status,
    count: players.filter(p => p.statusMain === status).length,
  }));
  const semEstatuto = players.filter(p => !p.statusMain).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compacto ? 7 : 10 }}>
      {counts.map(({ status, count }) => (
        <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_SUMMARY_COLORS[status], flexShrink: 0 }} />
          <div style={{ fontSize: 13.5, color: T.cream, flex: 1 }}>{status}</div>
          <div style={{ flex: 1.4, background: T.bg, borderRadius: 6, height: 6, overflow: 'hidden' }}>
            <div style={{
              width: total ? `${(count / total) * 100}%` : 0, height: '100%',
              background: STATUS_SUMMARY_COLORS[status], borderRadius: 6,
            }} />
          </div>
          <div style={{ ...mono, fontSize: 12, color: T.mutedDim, width: 18, textAlign: 'right' }}>{count}</div>
        </div>
      ))}
      {semEstatuto > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4, borderTop: `1px solid ${T.line}` }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.line, flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: T.mutedDim, flex: 1 }}>Sem estatuto definido</div>
          <div style={{ ...mono, fontSize: 12, color: T.mutedDim }}>{semEstatuto}</div>
        </div>
      )}
    </div>
  );
}


/* Escolher o que entra. Por omissão entra tudo — é o caso comum, e quem
   quiser um dossier parcial desmarca o que não quer em vez de marcar
   dezenas. */
function DossierModal({ ideias, onClose, onImprimir }) {
  const [escolhidas, setEscolhidas] = useState(() => new Set(ideias.map(i => i.id)));

  const porFase = PHASES
    .map(fase => ({ fase, lista: ideias.filter(i => i.phase === fase) }))
    .filter(g => g.lista.length);
  const semFase = ideias.filter(i => !PHASES.includes(i.phase));
  if (semFase.length) porFase.push({ fase: 'Sem fase', lista: semFase });

  const alternar = (id) => setEscolhidas(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const alternarFase = (lista) => setEscolhidas(prev => {
    const n = new Set(prev);
    const todas = lista.every(i => n.has(i.id));
    lista.forEach(i => (todas ? n.delete(i.id) : n.add(i.id)));
    return n;
  });

  const total = escolhidas.size;

  return (
    <Modal title="Dossier de ideias de jogo" subtitle="O modelo de jogo num documento só." onClose={onClose} wide xwide fullPage>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <Btn variant="ghost" onClick={() => setEscolhidas(new Set(ideias.map(i => i.id)))}>Todas</Btn>
        <Btn variant="ghost" onClick={() => setEscolhidas(new Set())}>Nenhuma</Btn>
        <span style={{ ...mono, fontSize: 12, color: T.mutedDim, alignSelf: 'center', marginLeft: 'auto' }}>
          {total} de {ideias.length}
        </span>
      </div>

      <div style={{ maxHeight: '52vh', overflowY: 'auto', overscrollBehavior: 'contain', paddingRight: 4 }}>
        {porFase.map(({ fase, lista }) => (
          <div key={fase} style={{ marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => alternarFase(lista)}
              title="Marcar ou desmarcar esta fase toda"
              style={{
                display: 'flex', alignItems: 'baseline', gap: 10, width: '100%', textAlign: 'left',
                background: 'none', border: 'none', padding: 0, marginBottom: 8, cursor: 'pointer',
              }}
            >
              <span style={{ ...display, fontSize: 14, fontWeight: 600, color: T.cream }}>{fase}</span>
              <span style={{ ...mono, fontSize: 11, color: T.mutedDim }}>{lista.filter(i => escolhidas.has(i.id)).length}/{lista.length}</span>
              <span style={{ flex: 1, height: 1, background: T.line }} />
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lista.map(i => {
                const on = escolhidas.has(i.id);
                const passos = ((i.diagram && i.diagram.sequence) || []).length;
                return (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => alternar(i.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left',
                      padding: '10px 12px', borderRadius: 8, cursor: 'pointer', ...body,
                      background: T.bg, border: `1px solid ${on ? '#B5393F' : T.line}`,
                    }}
                  >
                    <span style={{
                      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                      background: on ? T.good : 'transparent',
                      border: `1.5px solid ${on ? T.good : T.line}`,
                      display: 'grid', placeItems: 'center',
                    }}>{on && <Check size={11} style={{ color: '#0d140e' }} />}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: T.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(i.name && i.name.trim()) || i.phase || 'Ideia de jogo'}
                    </span>
                    {passos > 0 && (
                      <span style={{ ...mono, fontSize: 11, color: T.mutedDim, flexShrink: 0 }}>
                        {passos + 1} imagens
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={() => onImprimir(ideias.filter(i => escolhidas.has(i.id)))} disabled={!total}>
          <Printer size={15} /> Imprimir dossier
        </Btn>
      </div>
    </Modal>
  );
}


/* Mantém o Portal → Plano de Jogo = plano do próximo jogo. Só mexe no
   campo `visivelPlanoJogo` e só nas ideias em que ele está errado.
   Ideias antigas marcadas à mão (antes dos planos existirem) passam
   para o plano do próximo jogo, para nada desaparecer do Portal sem
   aviso; depois desse jogo, saem sozinhas como as outras. */
function useSincronizarPlanoPortal(ideias, setIdeias, matches, pronto) {
  const [dia, setDia] = useState(todayStr());
  useEffect(() => {
    const t = setInterval(() => { const d = todayStr(); setDia(x => (x === d ? x : d)); }, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!pronto) return;
    const prox = planoProximoJogo(matches);
    const corrigir = (x) => {
      if (!x) return x;
      if (x.visivelPlanoJogo && x.planosJogo === undefined && !x.jogoId) {
        // Marcação antiga, à mão: entra no plano do próximo jogo (se houver).
        return prox ? { ...x, planosJogo: [prox.id] } : x;
      }
      const deve = !!prox && ideiaNoPlano(x, prox.id);
      return !!x.visivelPlanoJogo === deve ? x : { ...x, visivelPlanoJogo: deve };
    };
    if (!(ideias || []).some(x => corrigir(x) !== x)) return;
    setIdeias(prev => prev.map(corrigir));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, ideias, matches, dia]);
}


function pentagon(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

/* Pequenas cunhas escuras à volta do pentágono central, para uma
   bola com mais gomos, mais próxima de uma bola real. */
function ballPanels(cx, cy, r) {
  const panels = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5 + Math.PI / 5;
    const outer = r * 0.98, inner = r * 0.5, spread = 0.34;
    const p1 = [cx + inner * Math.cos(a - spread), cy + inner * Math.sin(a - spread)];
    const p2 = [cx + outer * Math.cos(a), cy + outer * Math.sin(a)];
    const p3 = [cx + inner * Math.cos(a + spread), cy + inner * Math.sin(a + spread)];
    panels.push(`${p1[0].toFixed(2)},${p1[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)} ${p3[0].toFixed(2)},${p3[1].toFixed(2)}`);
  }
  return panels;
}


/* Campo à escala real de um relvado de futebol de 11: 105 × 68 m
   (1 unidade do SVG = 1 metro). Marcações nas medidas oficiais:
   círculo central 9.15 m de raio, grande área 16.5×40.32 m,
   pequena área 5.5×18.32 m, baliza com 7.32 m de largura. */
/* Rede de uma baliza — grelha de linhas finas dentro do retângulo da
   baliza, para dar profundidade em vez de um simples contorno vazio. */
function GoalNet({ x, y, w, h, color }) {
  const cols = 5, rows = 4;
  const lines = [];
  for (let i = 1; i < cols; i++) {
    const gx = x + (w * i) / cols;
    lines.push(<line key={`v${i}`} x1={gx} y1={y} x2={gx} y2={y + h} stroke={color} strokeWidth="0.06" opacity="0.55" />);
  }
  for (let j = 1; j < rows; j++) {
    const gy = y + (h * j) / rows;
    lines.push(<line key={`h${j}`} x1={x} y1={gy} x2={x + w} y2={gy} stroke={color} strokeWidth="0.06" opacity="0.55" />);
  }
  return <>{lines}</>;
}


/* Altura em percentagem da largura — é o truque do "padding-top" que
   reserva o espaço certo antes de o SVG carregar. Calculado a partir do
   enquadramento para nunca poder ficar dessincronizado dele: era um dos
   sítios que ficava para trás quando o viewBox mudava à mão. */
const PITCH_PADDING_TOP = `${(PITCH_BOX.h / PITCH_BOX.w * 100).toFixed(2)}%`;


/* ----------------------------------------------------------------
   EVOLUÇÃO ENTRE MOMENTOS
---------------------------------------------------------------- */
function diEvolucao(registoA, registoB, fonte = 'staff') {
  const a = diScoreGlobal(registoA && registoA[fonte]);
  const b = diScoreGlobal(registoB && registoB[fonte]);
  const dims = DI_DIMENSOES.map(d => {
    const ma = a.medias[d.id].media;
    const mb = b.medias[d.id].media;
    return {
      dim: d.id, label: d.label, antes: ma, depois: mb,
      delta: (ma == null || mb == null) ? null : mb - ma,
    };
  });
  return {
    global: { antes: a.score, depois: b.score, delta: (a.score == null || b.score == null) ? null : b.score - a.score },
    dimensoes: dims,
  };
}


function groupByWeek(sessions) {
  const sorted = [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date));
  const groups = {};
  sorted.forEach(s => {
    const d = new Date(s.date + 'T00:00:00');
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const key = `Semana de ${monday.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}`;
    groups[key] = groups[key] || [];
    groups[key].push(s);
  });
  return groups;
}


/* PRÉMIO DOS 30 DIAS SEGUIDOS — ver o comentário grande junto do efeito
   que usa isto, em `App`. Aqui ficam só as duas funções puras: uma que
   diz se UM dia contou, outra que conta quantos desses dias seguidos há,
   a partir de hoje (ou de ontem, se hoje ainda não estiver completo —
   mesma ideia do `sequenciaWellness` do cartão do quiosque).

   O dia continua a exigir os DOIS questionários (Wellness e PSE), mas só
   o WELLNESS precisa de ser autónomo — o PSE às vezes é preenchido junto
   da equipa técnica (ex.: em grupo, no fim do treino, com o preparador
   físico a ajudar), e isso não deve partir a sequência do atleta. */
/* REGRA DO PRÉMIO: conta o dia em que o jogador respondeu SOZINHO ao
   WELLNESS (no Portal, não preenchido pela equipa técnica). O PSE não
   entra na contagem (antes exigia os dois). */
function diaAutonomoCompleto(playerId, date, monitoring, monitoringMeta) {
  const registos = (monitoring || []).filter(m => m.playerId === playerId && m.date === date);
  if (registos.length === 0) return false;
  const registosWellness = registos.filter(m => typeof m.sono === 'number');
  if (registosWellness.length === 0) return false;
  // Só os registos de Wellness precisam de estar vazios em updated_by_email.
  return registosWellness.every(m => {
    const meta = (monitoringMeta || {})[m.id];
    return !meta || !meta.email;
  });
}

/* Dias seguidos de Wellness autónomo para o prémio da sequência. O
   primeiro a chegar é premiado e a contagem recomeça para todos (ver o
   efeito "PRÉMIO DA SEQUÊNCIA"). Era 30; passou a 60. */
const META_SEQUENCIA = 60;

function sequenciaAutonomaCompleta(playerId, monitoring, monitoringMeta, hoje, desde) {
  hoje = hoje || todayStr();
  const comecaEm = diaAutonomoCompleto(playerId, hoje, monitoring, monitoringMeta) ? hoje : addDays(hoje, -1);
  let dias = 0;
  let d = comecaEm;
  // Nunca conta para trás de `desde` — é o que garante que uma sequência
  // antiga (de antes desta funcionalidade existir, ou de antes da ronda
  // anterior ter sido premiada) não continua a valer para sempre.
  while ((!desde || d >= desde) && diaAutonomoCompleto(playerId, d, monitoring, monitoringMeta)) {
    dias++;
    d = addDays(d, -1);
  }
  return { dias, inicio: dias > 0 ? addDays(comecaEm, -(dias - 1)) : null, fim: dias > 0 ? comecaEm : null };
}


function dayOfMonth(dateStr) {
  return new Date(dateStr + 'T00:00:00').getDate();
}


// Recolhe todos os anexos em PDF dos exercícios de uma ou mais sessões.
// Um PDF é o próprio documento — não dá para "embutir" na folha de
// impressão da app, por isso cada um é aberto e impresso à parte.
function collectPdfAttachments(sessionsArr, exercises) {
  const out = [];
  (sessionsArr || []).forEach(s => (s.exerciseIds || []).forEach(e => {
    const ex = exercises.find(x => x.id === e.exId);
    if (ex?.attachment?.type === 'pdf') out.push(ex.attachment);
  }));
  return out;
}
// Abre cada PDF anexado numa aba própria e despoleta a impressão do
// browser para cada um, com um pequeno desfasamento entre eles para não
// serem todos bloqueados de uma vez como popups.
function openAndPrintPdfSequential(attachments) {
  (attachments || []).forEach((att, i) => {
    setTimeout(() => {
      const w = window.open(att.dataUrl, '_blank');
      if (w) {
        let jaImprimiu = false;
        const tryPrint = () => {
          if (jaImprimiu) return;
          jaImprimiu = true;
          try { w.focus(); w.print(); } catch (e) { /* ignora: alguns browsers bloqueiam print entre origens de data URL */ }
        };
        // O `onload` da aba raramente dispara para um PDF em data URL (o
        // visualizador nativo do browser não é a mesma coisa que carregar
        // uma página) — por isso o tempo de reserva abaixo é que faz o
        // trabalho a sério na maioria dos casos. 800ms era pouco para um
        // PDF maior ou um telemóvel mais lento: a impressão disparava
        // antes de haver alguma coisa desenhada, e via-se a aba em branco.
        w.onload = () => setTimeout(tryPrint, 500);
        setTimeout(tryPrint, 1800);
      }
    }, 900 * i);
  });
}


function cardBadge(card) {
  if (!card || card === 'none') return null;
  const map = {
    yellow: { bg: '#C9A227', label: 'A' },
    yellow2: { bg: '#C9A227', label: '2A' },
    red: { bg: '#A83E3E', label: 'V' },
  };
  const c = map[card];
  if (!c) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 18,
      borderRadius: 2, background: c.bg, color: TEXT_ON_ACCENT, fontSize: 9, fontWeight: 700, ...mono,
    }}>{c.label}</span>
  );
}


/* ---------------------------------------------------------------
   COMPETIÇÕES

   O registo único `league_standings` passou a guardar VÁRIAS
   competições (campeonato, taça, torneio…), cada uma com a sua lista
   de equipas, número de jornadas, resultados e classificação.

   Formato: { competitions: [...], activeId }. Os campos antigos
   (competition/teams/rounds/auto) continuam a ser gravados a espelhar
   a competição ativa, para nada que os leia deixar de funcionar.
---------------------------------------------------------------- */
/* Rótulo do jogo com o nosso clube incluído e do lado certo:
   "SC Salgueiros vs X" em casa, "X vs SC Salgueiros" fora. Sem indicação
   de casa/fora, mantém-se o formato antigo ("vs X"). */
function matchLabel(m, season) {
  const rival = (m && m.opponent) || 'Adversário por definir';
  const usRaw = (season && season.club) || '';
  // "SC Salgueiros · Sub-19" → "SC Salgueiros"
  const us = usRaw.split('·')[0].trim() || usRaw.trim();
  if (!us || m.atHome === undefined || m.atHome === null) return `vs ${rival}`;
  return m.atHome ? `${us} vs ${rival}` : `${rival} vs ${us}`;
}


/* LIMPEZA DOS JOGOS DUPLICADOS

   Uma versão anterior criava dois jogos para o mesmo encontro: o lançado
   à mão e outro gerado pela tabela da competição, por não se
   reconhecerem um ao outro (ver syncMatchIntoCompetition).

   Isto junta-os. Dois jogos são o MESMO encontro quando têm a mesma
   data, o mesmo adversário e a mesma competição — é a combinação que
   identifica um jogo de forma única num calendário real.

   Fica o que tem mais informação, e o que sobrevive herda o que o outro
   tivesse de útil: convocados, titulares, relatório, resultado. Nunca se
   perde trabalho — o pior que pode acontecer é ficar um campo preenchido
   que estava vazio. */
function limparJogosDuplicados(matches) {
  const lista = matches || [];
  /* A CHAVE É A DATA MAIS O ADVERSÁRIO. A competição fica de fora.

     A primeira versão incluía a competição, e por isso NÃO juntava um par
     em que um dos jogos tinha a competição por preencher — que é
     precisamente o caso dos jogos criados a partir de uma convocatória
     incompleta. Ficavam os dois na lista.

     Numa época real, não há duas partidas contra o mesmo adversário no
     mesmo dia. Data e adversário chegam para identificar o encontro, e a
     competição é justamente um dos campos que um dos lados pode ter
     esquecido — usá-la para decidir era pedir ao dado incompleto que
     resolvesse o problema causado por estar incompleto. */
  const chave = (m) => [
    (m.date || '').trim(),
    (m.opponent || '').trim().toLowerCase(),
  ].join('|');

  // Quanta informação tem este jogo? Serve para escolher qual fica.
  const peso = (m) => (
    (m.convocados || []).length * 10
    + (m.starters || []).length * 10
    + Object.keys(m.report || {}).length * 5
    + (String(m.result || '').trim() ? 20 : 0)
    + (m.sourceGameId ? 3 : 0)
    + (m.sourceConvocatoriaId ? 3 : 0)
    + (String(m.competition || '').trim() ? 2 : 0)
    + (m.atHome !== undefined ? 2 : 0)
    + (String(m.jornada || '').trim() ? 1 : 0)
  );

  const grupos = new Map();
  lista.forEach(m => {
    const k = chave(m);
    // Sem data OU sem adversário não há como ter a certeza de que são o
    // mesmo encontro — e juntar por engano é pior do que deixar dois.
    if (!(m.date || '').trim() || !(m.opponent || '').trim()) return;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(m);
  });

  /* A COMPETIÇÃO DESEMPATA, MAS SÓ QUANDO OS DOIS A TÊM.

     Dois jogos na mesma data contra o mesmo adversário são o mesmo
     encontro — exceto se ambos disserem competições diferentes, e nesse
     caso são mesmo dois jogos distintos (campeonato e taça, por exemplo).

     Quando um deles tem a competição por preencher não se pode concluir
     nada: é justamente esse o campo que ficou por preencher, e usá-lo
     para decidir seria pedir ao dado incompleto que resolvesse o
     problema causado por estar incompleto. */
  const separadas = new Map();
  grupos.forEach((g, k) => {
    const comps = new Set(g.map(m => competitionLabel(m.competition).trim().toLowerCase()).filter(Boolean));
    if (comps.size <= 1) { separadas.set(k, g); return; }
    g.forEach(m => {
      const c = competitionLabel(m.competition).trim().toLowerCase();
      const sub = `${k}|${c}`;
      if (!separadas.has(sub)) separadas.set(sub, []);
      separadas.get(sub).push(m);
    });
  });

  const substituir = new Map();
  const remover = new Set();
  separadas.forEach(g => {
    if (g.length < 2) return;
    const vencedor = [...g].sort((a, b) => peso(b) - peso(a))[0];
    const juntado = { ...vencedor };
    g.forEach(m => {
      if (m.id === vencedor.id) return;
      remover.add(m.id);
      // Herda o que o vencedor não tem.
      if (!(juntado.convocados || []).length && (m.convocados || []).length) juntado.convocados = m.convocados;
      if (!(juntado.starters || []).length && (m.starters || []).length) juntado.starters = m.starters;
      if (!Object.keys(juntado.report || {}).length && Object.keys(m.report || {}).length) juntado.report = m.report;
      if (!String(juntado.result || '').trim() && String(m.result || '').trim()) juntado.result = m.result;
      if (!juntado.sourceGameId && m.sourceGameId) juntado.sourceGameId = m.sourceGameId;
      if (!String(juntado.jornada || '').trim() && String(m.jornada || '').trim()) juntado.jornada = m.jornada;
      if (!String(juntado.competition || '').trim() && String(m.competition || '').trim()) juntado.competition = m.competition;
      if (juntado.atHome === undefined && m.atHome !== undefined) juntado.atHome = m.atHome;
      if (!juntado.sourceConvocatoriaId && m.sourceConvocatoriaId) juntado.sourceConvocatoriaId = m.sourceConvocatoriaId;
    });
    substituir.set(vencedor.id, juntado);
  });

  if (!remover.size) return lista;
  return lista.filter(m => !remover.has(m.id)).map(m => substituir.get(m.id) || m);
}


// Mantido por compatibilidade com dados antigos que já usavam esta escala.
const POTENTIAL_LEVELS = RATING_LEVELS.map(r => ({ value: r.value, label: r.label }));


/* =====================================================================
   SCOUTING › NECESSIDADES DA EQUIPA — módulo NOVO e ISOLADO.

   A equipa técnica lança uma necessidade (posição + perfil pretendido)
   e a app cruza-a, sempre na hora, com:
     · os jogadores do Scouting dessa posição (candidatos, com "cumpre
       N de M critérios" e o que falta);
     · o plantel atual nessa posição (estatuto + Boletim Clínico).
   Também sugere posições frágeis do plantel.

   Regras deste módulo: só ESCREVE na sua própria tabela
   (`necessidades`); lê o Scouting, o Plantel e o Boletim Clínico sem
   os alterar. Os candidatos nunca são copiados — a necessidade guarda só
   referências (fixados / descartados / escolhido). Nomes começam por
   `nec`/`Nec`. Dados só da equipa técnica (mesmas regras de acesso do
   Boletim Clínico); nada disto aparece no Portal do Atleta.

   Se a tabela ainda não existir no Supabase, nada arranca: o separador
   mostra só um aviso e o resto do Scouting funciona como sempre.
   ===================================================================== */

const NEC_TABELA = 'necessidades';


/* ---------- Ligação à tabela (com verificação de que existe) ---------- */
function NecessidadesLigacao({ teamId, onApi }) {
  const [estado, setEstado] = useState('a-verificar');
  useEffect(() => {
    let cancelado = false;
    if (!teamId) return undefined;
    (async () => {
      try {
        await ensureSession();
        const { error } = await supabase.from(NEC_TABELA).select('id').limit(1);
        if (cancelado) return;
        if (!error) { setEstado('ok'); return; }
        const msg = `${error.code || ''} ${error.message || ''}`;
        const e = /42P01|PGRST205|does not exist|Could not find the table/i.test(msg) ? 'sem-tabela' : 'erro';
        setEstado(e);
        onApi({ estado: e, itens: [], set: null, pronto: false, autorizar: null });
      } catch (err) {
        if (!cancelado) { setEstado('erro'); onApi({ estado: 'erro', itens: [], set: null, pronto: false, autorizar: null }); }
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);
  return estado === 'ok' ? <NecessidadesSync teamId={teamId} onApi={onApi} /> : null;
}
function NecessidadesSync({ teamId, onApi }) {
  const semAviso = useCallback(() => {}, []);
  const [itens, setItens, pronto, , autorizar] = useCollectionSync(NEC_TABELA, semAviso, teamId);
  useEffect(() => {
    onApi({ estado: 'ok', itens, set: setItens, pronto, autorizar });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, pronto]);
  return null;
}


function descodificarJunto(txt) {
  try {
    const b64 = String(txt || '').replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) { return null; }
}


// Competição (nome) em que a equipa está — vai para a "Prova" da ficha
// criada automaticamente.
function provaDaEquipa(nome, standings) {
  const k = semAcentos(nome);
  const { competitions } = normalizeStandings(standings);
  const c = (competitions || []).find(cc =>
    [...(cc.teamNames || []), ...((cc.teams || []).map(t => t && t.name))].some(n => semAcentos(n) === k));
  return (c && c.name) || '';
}
// Todas as equipas das competições configuradas (Jogos › Competições e
// jornadas) — é a lista de onde se escolhem as equipas de um jogo.
function nomesEquipasCompeticao(standings) {
  const { competitions } = normalizeStandings(standings);
  const nomes = new Map();
  (competitions || []).forEach(c => {
    [...(c.teamNames || []), ...((c.teams || []).map(t => t && t.name))].forEach(n => {
      const t = String(n || '').trim();
      if (t && !nomes.has(semAcentos(t))) nomes.set(semAcentos(t), t);
    });
  });
  return [...nomes.values()].sort((a, b) => a.localeCompare(b, 'pt'));
}


/* ---------------------------------------------------------------
   DIÁRIO — notas datadas do treinador, com pesquisa.
---------------------------------------------------------------- */

/* ================================================================
   TAREFAS DA EQUIPA TÉCNICA
   ================================================================

   Agrupadas por PRAZO e não em colunas de estado.

   Um quadro kanban mostra fluxo — onde é que o trabalho encrava. O
   trabalho de uma equipa técnica não flui, tem data: convocatória até
   quinta, coletes para sábado, vídeo da jornada. Num quadro clássico
   quase tudo saltaria de "por fazer" para "feito" e a coluna do meio
   estaria vazia, o que é sinal de se estar a mostrar o eixo errado.

   As duas perguntas reais são "o que falta antes de sábado?" e "quem
   está a dever o quê?". A primeira é a vista por omissão; a segunda é um
   botão que reagrupa a MESMA lista.

   Há uma terceira vista, "Calendário": a semana de segunda a domingo,
   igual à agenda semanal do Planeamento, com cada tarefa no seu dia e as
   que se repetem todas as semanas no dia delas. Ver a nota junto de
   `TarefasCalendario`. */

const ESTADOS_TAREFA = ['aberta', 'curso', 'feita'];


/* O número do badge: TODAS as tarefas atribuídas a mim (ou sem
   responsável definido) que ainda não estão concluídas — não só as
   atrasadas ou para hoje. A ideia é simples: se alguém me atribuiu uma
   tarefa, quero sabê-lo assim que entro na app, e essa notificação só
   desaparece quando a marco como concluída — não quando o prazo passa
   nem por eu simplesmente ter reparado nela. Prazos distantes ou sem
   prazo continuam a contar, ao contrário do resumo "As minhas tarefas"
   da página principal, que esse sim só mostra o que é urgente.

   UMA TAREFA ATRIBUÍDA A UM JOGADOR é um caso à parte, de propósito:
   NUNCA conta por estar "por fazer" ou por eu ser o Responsável (o
   formulário põe-me como Responsável por defeito, mesmo numa tarefa
   destinada só a um atleta — isso não é motivo de notificação). Só
   conta quando o atleta já submeteu a nota e eu ainda não a li
   (`notaSubmetida && !notaRevista`), e só para quem criou a tarefa. */
function tarefasAMinhaPorta(tarefas, euId, ctx) {
  const hoje = todayStr();
  return (tarefas || []).filter(t => {
    if (conclusaoPorVerPara(t, euId)) return true;
    if (t.jogadorId) return t.notaSubmetida && !t.notaRevista && t.criadoPor === euId;
    if (t.responsavel !== euId && t.responsavel) return false;
    if (eSemanal(t)) return t.estado !== 'feita' && semanaisPendentes(t, hoje).length > 0;
    if (t.recorrencia) return tarefaAtivaHoje(t, hoje, ctx || {}) && !tarefaFeitaHoje(t, hoje);
    return t.estado !== 'feita';
  }).length;
}


function inicioDaMissao(t, base) {
  if (base) return new Date(`${base}T00:00:00`).getTime();
  if (t.recorrencia) return new Date(`${todayStr()}T00:00:00`).getTime();
  if (t.criadoEm) return new Date(t.criadoEm).getTime();
  return new Date(`${t.prazo || todayStr()}T00:00:00`).getTime();
}
// provas = { email, metas: { caminho: [meta, …] }, matches }
function missaoStaffFeita(t, base, provas) {
  if (!caminhoVerificavel(t) || !provas) return false;
  if (t.caminho === 'estatisticas') {
    /* Só fica feita quando NENHUM jogo já realizado, seja ele qual for,
       está sem estatísticas. Antes bastava o ÚLTIMO jogo ter
       minutos: com o Paredes preenchido e o Lavrense por fazer, a missão
       fechava-se sozinha sem ninguém ter lançado nada. */
    const hoje = todayStr();
    const jogados = (provas.matches || []).filter(m => m && m.date && m.date < hoje);
    return jogados.length > 0 && jogosSemEstatisticas(provas.matches, hoje).length === 0;
  }
  /* Ficha do adversário e ideias para o jogo: fechadas quando já não
     falta nenhuma (a regra da repetição), não por qualquer gravação. */
  if (t.caminho === 'fichaadversario' && t.recorrencia) {
    return jogosParaFichaAdversario(provas.matches, todayStr(), null).length === 0;
  }
  if (t.caminho === 'ideiasjogo' && t.recorrencia) {
    return jogosSemIdeias(provas.matches, todayStr()).length === 0;
  }
  const email = String(provas.email || '').toLowerCase();
  if (!email) return false;
  const ini = inicioDaMissao(t, base);
  if (t.caminho === 'analisejogo') {
    // A análise vive dentro do jogo (notasEquipaTecnica), com autor e data.
    return (provas.matches || []).some(m => notasDoJogo(m).some(n =>
      String(n.autor || '').toLowerCase() === email && new Date(n.em).getTime() >= ini));
  }
  return (provas.metas[t.caminho] || []).some(meta => Object.values(meta || {})
    .some(x => x && String(x.email || '').toLowerCase() === email && new Date(x.at).getTime() >= ini));
}


/* ================================================================
   ENTRADA DA EQUIPA TÉCNICA — A CREDENCIAL.
   ================================================================
   No dia de jogo, a equipa técnica anda com uma credencial ao pescoço;
   os jogadores não. Por isso, ao entrar na app, cai do topo do ecrã a
   CREDENCIAL da pessoa, num cordão na sua cor, a balançar: nome, função,
   época, a "fotografia" com as iniciais e um selo holográfico.
   As missões de hoje e as atrasadas são as ZONAS DE ACESSO da credencial
   (como as zonas de um estádio): código da zona, título, para onde leva
   e prazo. Prioritárias com faixa dourada; atrasadas com luz vermelha
   a piscar.
   - "Entrar" leva ao sítio onde a missão se faz. Com caminho, a missão
     fecha sozinha quando a app vê o trabalho feito (`missaoStaffFeita`).
   - Sem caminho, "Concluir" conclui-a e a zona fica CARIMBADA.
   - "Guardar a credencial" fecha o ecrã e regista um adiamento em cada
     missão que ficou por fazer (um por dia; quem criou vê "adiada 3×").
   - Aparece sempre que a app é aberta, enquanto houver missões por
     fazer. Não bloqueia ninguém. Missões sem responsável não entram aqui.
   - Teste: ?testeentrada=1 (aparece sempre; três missões de exemplo se
     não houver; nada é gravado). */
const ZONA_CODIGO = {
  analise: 'AV', scouting: 'SC', planeamento: 'PL', jogos: 'JG', estatisticas: 'ES', monitorizacao: 'MO',
  desenvolvimento: 'DS', ideiajogo: 'IJ', exercicios: 'EX', presencas: 'PR', clinico: 'BC', biblioteca: 'SV', documentos: 'DC', fichaadversario: 'FA', ideiasjogo: 'IP',
  analisejogo: 'AJ', diario: 'DI',
};
function EcraEntradaEquipa({ tarefas, setTarefas, membros, euId, ctx, onIr, equipa, epoca }) {
  const hoje = todayStr();
  const teste = (() => { try { return /[?&#]testeentrada\b/i.test(window.location.href); } catch (e) { return false; } })();
  /* Aparece SEMPRE que a app é aberta ou recarregada, enquanto houver
     missões por fazer (antes era uma vez por dia). "Mais tarde" só a
     esconde até à próxima vez que a app for aberta. */
  const [fechado, setFechado] = useState(false);
  const [carimbadas, setCarimbadas] = useState([]); // concluídas aqui (ficam à vista, carimbadas)
  const [fundo] = useState(() => Array.from({ length: 18 }, (_, k) => ({
    k, i: k % 8, left: Math.random() * 100, atraso: -Math.random() * 24, dur: 18 + Math.random() * 14,
    tam: 16 + Math.random() * 16, rot: Math.random() * 360, op: 0.07 + Math.random() * 0.1,
  })));
  const [inicial] = useState(() => euId ? missoesDoCacifo(tarefas, euId, ctx, hoje).filter(x => !x.futura).map(x => x.t.id) : []);
  const reais = euId ? missoesDoCacifo(tarefas, euId, ctx, hoje).filter(x => !x.futura) : [];
  const exemplos = [
    { t: { id: 'teste-a', titulo: 'Relatório do adversário de sábado', caminho: 'scouting', obrigatoria: true, responsavel: euId, criadoPor: 'outro', notas: 'Foca nas bolas paradas e na saída de jogo.' }, dia: addDays(hoje, -2), atraso: true },
    { t: { id: 'teste-b', titulo: 'Introduzir as estatísticas do jogo', caminho: 'estatisticas', responsavel: euId, criadoPor: euId }, dia: hoje, atraso: false },
    { t: { id: 'teste-c', titulo: 'Confirmar o autocarro para Penafiel', caminho: '', responsavel: euId, criadoPor: euId }, dia: hoje, atraso: false },
  ];
  // As zonas são as da entrada; uma concluída aqui continua à vista, carimbada.
  const zonas = teste && !reais.length && !inicial.length ? exemplos : reais;
  const carimbadasVisiveis = (teste && !reais.length ? [] : (tarefas || []).filter(t => carimbadas.includes(t.id)).map(t => ({ t, dia: hoje, atraso: false, feita: true })));
  const lista = [...zonas, ...carimbadasVisiveis.filter(c => !zonas.some(z => z.t.id === c.t.id))];
  const porFazer = lista.filter(x => !carimbadas.includes(x.t.id) && !x.feita);
  if (!euId || fechado || !lista.length) return null;
  registarCoresMembros(membros);

  const meu = (membros || []).find(m => m.user_id === euId) || {};
  const nome = String(meu.nome || 'Equipa técnica').trim();
  const iniciais = nome.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
  const funcao = meu.papel === 'owner' ? 'Responsável da equipa' : 'Equipa técnica';
  const cor = corDoMembro(euId);
  const clube = (equipa && (equipa.clube || equipa.nome)) || 'Mister JP';
  const escalao = (equipa && equipa.escalao) || '';

  const fechar = () => setFechado(true);
  const concluir = (x) => {
    setCarimbadas(v => [...v, x.t.id]);
    if (teste) return;
    const t = x.t;
    const agora = new Date().toISOString();
    setTarefas(prev => prev.map(r => {
      if (r.id !== t.id) return r;
      if (eSemanal(r)) return { ...r, concluidasEm: [...new Set([...(r.concluidasEm || []), x.base])], lembrete: null, ...(avisaCriadorAoConcluir(r, euId) ? { conclusaoPorVer: { por: euId, em: agora } } : {}) };
      if (r.recorrencia) return { ...r, concluidasEm: [...new Set([...(r.concluidasEm || []), hoje])], lembrete: null };
      return { ...r, estado: 'feita', feitaEm: agora, lembrete: null, ...(avisaCriadorAoConcluir(r, euId) ? { conclusaoPorVer: { por: euId, em: agora } } : {}) };
    }));
  };
  const entrar = (x) => { fechar(); onIr(x.t.caminho); };
  const guardar = () => {
    if (!teste) {
      const ids = new Set(porFazer.map(x => x.t.id));
      /* Um adiamento conta de 3 em 3 horas, no máximo (antes era um por
         dia): carregar várias vezes seguidas em "Mais tarde" não conta
         várias vezes, mas adiar de manhã e outra vez à tarde conta duas.
         Guarda-se a hora; os registos antigos só têm a data, e contam
         como sendo dessa data. */
      const agoraMs = Date.now();
      const TRES_HORAS = 3 * 60 * 60 * 1000;
      const ultimoMs = (r) => Math.max(0, ...(r.adiadaEm || []).map(d => new Date(String(d).length <= 10 ? `${d}T00:00:00` : d).getTime() || 0));
      setTarefas(prev => prev.map(r => (ids.has(r.id) && agoraMs - ultimoMs(r) >= TRES_HORAS
        ? { ...r, adiadaEm: [...(r.adiadaEm || []), new Date(agoraMs).toISOString()].slice(-60) }
        : r)));
    }
    fechar();
  };
  const atrasadas = porFazer.filter(x => x.atraso).length;
  /* O FUNDO MEXE, como no Portal, mas com as ferramentas da equipa
     técnica (cronómetro, prancheta, vídeo, cone, troféu, bandeirola) a
     subir devagar, quase transparentes, por trás da credencial. */
  const ICONES_FUNDO = [Clock, ClipboardList, Video, Dumbbell, Trophy, Flag, Search, Activity];
  const codigoBarras = 'repeating-linear-gradient(90deg, #1a1d1b 0 2px, transparent 2px 4px, #1a1d1b 4px 5px, transparent 5px 8px, #1a1d1b 8px 11px, transparent 11px 12px, #1a1d1b 12px 13px, transparent 13px 16px)';

  return (
    /* TUDO NUM ECRÃ: cordão em cima, o cartão a ocupar o resto da altura e
       o botão em baixo. Só a lista das zonas desliza, por dentro do cartão. */
    <div style={{
      position: 'fixed', inset: 0, zIndex: 90, overflow: 'hidden', ...body, display: 'flex', flexDirection: 'column', alignItems: 'center', isolation: 'isolate',
      background: `radial-gradient(ellipse at 50% -10%, ${T.brilhoEntrada} 0%, ${T.bg} 60%)`,
      padding: '0 14px calc(14px + env(safe-area-inset-bottom, 0px))',
    }}>
      <style>{`
        @keyframes cr-cair { 0% { transform: translateY(-115vh) rotate(-10deg); } 55% { transform: translateY(14px) rotate(4deg); } 72% { transform: translateY(-5px) rotate(-2.5deg); } 86% { transform: translateY(2px) rotate(1deg); } 100% { transform: translateY(0) rotate(0); } }
        @keyframes cr-balancar { 0%, 100% { transform: rotate(-.8deg); } 50% { transform: rotate(.8deg); } }
        @keyframes cr-holo { from { filter: hue-rotate(0deg); } to { filter: hue-rotate(360deg); } }
        @keyframes cr-luz { 0%, 100% { opacity: 1; box-shadow: 0 0 8px #ff4a3d; } 50% { opacity: .25; box-shadow: none; } }
        @keyframes cr-carimbo { 0% { transform: rotate(-12deg) scale(2.2); opacity: 0; } 100% { transform: rotate(-12deg) scale(1); opacity: .9; } }
        @keyframes cr-zona { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }
        @keyframes cr-subir { 0% { transform: translateY(0) rotate(var(--rot)); } 100% { transform: translateY(-120vh) rotate(calc(var(--rot) + 160deg)); } }
        @media (prefers-reduced-motion: reduce) { .cr-anim { animation: none !important; } }
      `}</style>

      {/* o fundo a mexer */}
      {fundo.map(f => {
        const Ic = ICONES_FUNDO[f.i];
        return (
          <div key={f.k} className="cr-anim" aria-hidden="true" style={{
            position: 'absolute', left: `${f.left}%`, bottom: -40, opacity: f.op, pointerEvents: 'none', zIndex: -1, color: T.giz,
            animation: `cr-subir ${f.dur}s linear ${f.atraso}s infinite`, '--rot': `${f.rot}deg`,
          }}><Ic size={f.tam} strokeWidth={1.6} /></div>
        );
      })}

      {/* O CORDÃO CRESCE para a credencial ficar ao meio da página: ele e o
          espaço por baixo do cartão repartem a altura que sobra. */}
      <div className="cr-anim" style={{ flex: '1 1 auto', minHeight: 0, width: 'min(94vw, 400px)', display: 'flex', flexDirection: 'column', animation: 'cr-cair 1.1s cubic-bezier(.25,.8,.35,1) both' }}>
        <div className="cr-anim" style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', transformOrigin: '50% 0', animation: 'cr-balancar 6s ease-in-out 1.2s infinite' }}>
          {/* o cordão e a mola */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 1 0', minHeight: 'calc(34px + env(safe-area-inset-top, 0px))' }}>
            <div style={{
              width: 28, flex: 1, background: cor, position: 'relative', overflow: 'hidden',
              boxShadow: 'inset 5px 0 6px rgba(0,0,0,.25), inset -5px 0 6px rgba(0,0,0,.25)',
            }}>
              <div style={{
                position: 'absolute', left: 0, right: 0, bottom: 8, writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 8.5, fontWeight: 800,
                letterSpacing: '.3em', color: 'rgba(255,255,255,.7)', whiteSpace: 'nowrap', lineHeight: '28px', textTransform: 'uppercase',
              }}>Equipa técnica · {clube} · Equipa técnica</div>
            </div>
            <div style={{ width: 18, height: 18, marginTop: -1, flexShrink: 0, borderRadius: '5px 5px 8px 8px', background: 'linear-gradient(90deg, #8d9093, #e6e8ea 45%, #7d8083)' }} />
          </div>

          {/* o cartão: ocupa a altura que sobra */}
          <div style={{
            flex: '0 1 auto', minHeight: 0, marginTop: -4, borderRadius: 16, overflow: 'hidden', background: '#F7F6F1', position: 'relative',
            display: 'flex', flexDirection: 'column', boxShadow: '0 20px 44px rgba(0,0,0,.55)',
          }}>
            <div style={{ position: 'absolute', top: 7, left: '50%', width: 40, height: 7, marginLeft: -20, borderRadius: 4, background: '#2a2d2b', zIndex: 2 }} />
            {/* faixa do clube */}
            <div style={{ flexShrink: 0, background: `linear-gradient(120deg, ${cor} 0%, color-mix(in srgb, ${cor} 60%, #0d120f) 100%)`, padding: '20px 14px 10px', color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              {equipa && equipa.logo
                ? <img src={equipa.logo} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                : <Shield size={18} />}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clube}</div>
                <div style={{ fontSize: 9.5, letterSpacing: '.18em', textTransform: 'uppercase', opacity: 0.8 }}>{[escalao, epoca].filter(Boolean).join(' · ')}</div>
              </div>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.16em', border: '1.5px solid rgba(255,255,255,.8)', borderRadius: 4, padding: '2px 5px' }}>STAFF</div>
            </div>

            {/* identificação, compacta */}
            <div style={{ flexShrink: 0, display: 'flex', gap: 11, padding: '10px 14px 8px', alignItems: 'center' }}>
              <div style={{
                width: 44, height: 52, borderRadius: 7, flexShrink: 0, display: 'grid', placeItems: 'center',
                background: `color-mix(in srgb, ${cor} 35%, #fff)`, border: '1px solid rgba(0,0,0,.08)',
              }}><span style={{ ...display, fontSize: 20, color: '#14231a' }}>{iniciais}</span></div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ ...display, fontSize: 22, lineHeight: 1.3, margin: '-2px 0', color: '#14231a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</div>
                <div style={{ fontSize: 11.5, color: '#5a5f58' }}>{funcao}{teste ? ' · teste' : ''}</div>
              </div>

            </div>

            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '2px 14px 6px' }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.2em', color: '#14231a', textTransform: 'uppercase' }}>Zonas de acesso</span>
              <span style={{ flex: 1, height: 1, background: '#d8d6cc' }} />
              <span style={{ ...mono, fontSize: 10.5, color: atrasadas ? '#B3261E' : '#7a7a70' }}>{porFazer.length}{atrasadas ? ` · ${atrasadas} em atraso` : ''}</span>
            </div>

            {/* AS ZONAS: uma linha cada, pouco texto. Só esta parte desliza. */}
            <div style={{ flex: '0 1 auto', minHeight: 0, overflowY: 'auto', padding: '2px 14px 8px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {lista.map((x, k) => {
                const t = x.t;
                const c = caminhoStaff(t.caminho);
                /* ANIVERSÁRIO: zona própria (AN, com os papelinhos) e, como
                   instrução, quem faz anos hoje: "Parabéns ao Vasco". */
                const eAniv = !!(t.recorrencia && t.recorrencia.tipo === 'aniversario');
                const Ic = eAniv ? PartyPopper : c.icon;
                const anivNomes = eAniv ? aniversariantesEm(ctx && ctx.players, hoje).map(pl => shortPlayerName(pl, ctx.players)).filter(Boolean) : [];
                const instrucao = eAniv && anivNomes.length
                  ? `Parabéns ${anivNomes.length > 1 ? 'a' : 'ao'} ${listaComE(anivNomes)}, em nome da equipa`
                  : String(t.notas || '').trim();
                const feita = x.feita || carimbadas.includes(t.id);
                /* A FAIXA da zona diz o estado pela cor, e a palavra por baixo
                   do título diz o mesmo por extenso:
                   vermelha = atrasada · preta = prioritária · cor da pessoa = normal. */
                const estado = feita ? 'feita' : x.atraso ? 'atrasada' : t.obrigatoria ? 'prioritaria' : 'normal';
                const faixa = { feita: '#9aa39b', atrasada: '#B3261E', prioritaria: '#14231a', normal: cor }[estado];
                return (
                  <div key={`${t.id}:${x.base || ''}`} className="cr-anim" title={caminhoVerificavel(t) ? `Fecha sozinha quando ${CRITERIO_STAFF[t.caminho]}.` : undefined} style={{
                    position: 'relative', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, flexShrink: 0,
                    padding: '8px 8px 8px 0', background: '#fff', overflow: 'hidden',
                    border: `1.5px solid ${estado === 'atrasada' ? '#e4b4ae' : '#e2dfd4'}`,
                    animation: `cr-zona .35s ease-out ${1.15 + k * 0.08}s both`, opacity: feita ? 0.6 : 1,
                  }}>
                    {/* código da zona */}
                    <div style={{
                      alignSelf: 'stretch', margin: '-8px 0', width: 44, flexShrink: 0, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 2, background: faixa, color: '#fff',
                    }}>
                      <span style={{ ...mono, fontSize: 13, fontWeight: 700 }}>{eAniv ? 'AN' : (ZONA_CODIGO[t.caminho] || 'GL')}</span>
                      <Ic size={11} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#14231a', lineHeight: 1.25, ...LINHAS(2) }}>{t.titulo}</div>
                      {/* As instruções da missão, se houver: uma linha só. */}
                      {instrucao && (
                        <div title={instrucao} style={{ fontSize: 12, color: '#4a4f48', lineHeight: 1.35, marginTop: 1, ...LINHAS(1) }}>{instrucao}</div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                        {estado === 'atrasada' && <span style={{ fontSize: 11, fontWeight: 700, color: '#B3261E' }}>Atrasada · {prazoTexto(x.dia, hoje)}</span>}
                        {t.obrigatoria && !feita && (
                          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#fff', background: '#14231a', borderRadius: 3, padding: '1px 5px' }}>Prioritária</span>
                        )}
                        {estado === 'normal' && <span style={{ fontSize: 11, color: '#7a7a70' }}>Para hoje</span>}
                        {feita && <span style={{ fontSize: 11, color: '#2E6B3A', fontWeight: 700 }}>Feita</span>}
                      </div>
                    </div>
                    {!feita && (t.caminho ? (
                      <button type="button" onClick={() => entrar(x)} aria-label={`Entrar em ${c.rotulo}`} style={{
                        flexShrink: 0, width: 40, height: 40, borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: '#14231a', color: '#F7F6F1', display: 'grid', placeItems: 'center',
                      }}><ArrowRight size={17} /></button>
                    ) : (
                      <button type="button" onClick={() => concluir(x)} aria-label="Concluir" style={{
                        flexShrink: 0, width: 40, height: 40, borderRadius: 10, cursor: 'pointer',
                        background: 'transparent', color: '#14231a', border: '1.5px solid #14231a', display: 'grid', placeItems: 'center',
                      }}><Check size={17} /></button>
                    ))}
                    {feita && (
                      <div className="cr-anim" style={{
                        flexShrink: 0, border: '2px solid #2E6B3A', color: '#2E6B3A', borderRadius: 5, padding: '1px 7px',
                        fontSize: 11, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase', animation: 'cr-carimbo .35s ease-out both',
                      }}>Feita</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* O CÓDIGO DE BARRAS É O DIA DE HOJE: um bloco de barras por zona,
                pela mesma ordem da lista. Fica verde quando a zona está feita.
                À direita, quantas estão feitas. Enche-se à medida que o dia
                avança. */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 12px', borderTop: '1px dashed #d8d6cc' }}>
              <div style={{ flex: 1, display: 'flex', gap: 5, height: 24 }} aria-label={`${lista.length - porFazer.length} de ${lista.length} feitas hoje`}>
                {lista.map(x => {
                  const feitaB = x.feita || carimbadas.includes(x.t.id);
                  return (
                    <div key={`b:${x.t.id}:${x.base || ''}`} style={{
                      flex: 1, borderRadius: 2, transition: 'opacity .3s',
                      background: codigoBarras.replace(/#1a1d1b/g, feitaB ? '#2E6B3A' : '#1a1d1b'),
                      opacity: feitaB ? 1 : 0.3,
                    }} />
                  );
                })}
              </div>
              <div style={{ textAlign: 'right', lineHeight: 1.1 }}>
                <div style={{ ...mono, fontSize: 13, color: '#14231a', fontWeight: 700 }}>{lista.length - porFazer.length}/{lista.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: '1 1 0', minHeight: 64, paddingTop: 12, textAlign: 'center' }}>
        <Btn variant="ghost" onClick={guardar}>{porFazer.length ? 'Mais tarde' : 'Entrar na app'} <ArrowRight size={14} /></Btn>
      </div>
    </div>
  );
}

/* As missões em aberto de uma pessoa da equipa técnica ('' = sem
   responsável): semanais por concluir, repetições ativas hoje, e as
   normais por fazer. Prioritárias e atrasadas primeiro. */
function missoesDoCacifo(tarefas, pessoaId, ctx, hoje) {
  const quem = pessoaId || '';
  return (tarefas || []).filter(t => t && !t.jogadorId && (t.responsavel || '') === quem).map(t => {
    if (eSemanal(t)) {
      const pend = semanaisPendentes(t, hoje);
      if (!pend.length) return null;
      return { t, base: pend[0].base, dia: pend[0].dia, atraso: pend[0].dia < hoje, n: pend.length, futura: false };
    }
    if (t.recorrencia) {
      if (!tarefaAtivaHoje(t, hoje, ctx || {}) || tarefaFeitaHoje(t, hoje)) return null;
      return { t, dia: hoje, atraso: false, n: 1, futura: false };
    }
    if (t.estado === 'feita') return null;
    return { t, dia: t.prazo || '', atraso: !!t.prazo && t.prazo < hoje, n: 1, futura: !t.prazo || t.prazo > hoje };
  }).filter(Boolean).sort((a, b) => {
    const peso = (x) => (x.t.obrigatoria && x.atraso ? 0 : x.atraso ? 1 : x.t.obrigatoria && !x.futura ? 2 : !x.futura ? 3 : 4);
    return peso(a) - peso(b) || String(a.dia || '9999').localeCompare(String(b.dia || '9999'));
  });
}


/* Ecrã de carregamento que não fica preso.

   Uma leitura falhada já não marca a tabela como pronta (é isso que
   impede gravar por cima de dados que não conseguimos ler). O efeito
   colateral é que a app ficaria a rodar a bolinha para sempre, sem
   explicação nenhuma — que é pior do que o problema original.

   Ao fim de 12 segundos assume-se que algo correu mal e diz-se por
   palavras o que fazer. A mensagem é deliberadamente tranquilizadora
   quanto aos dados, porque a causa quase certa é a sessão e não perda de
   conteúdo. */
function LoadingGate() {
  const [demorou, setDemorou] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDemorou(true), 12000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      background: T.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, textAlign: 'center',
    }}>
      <style>{FONTS}</style>
      <Loader2 className="animate-spin" color={T.warn} size={28} />
      {demorou && (
        <div style={{ maxWidth: 420, ...body }}>
          <div style={{ color: T.cream, fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            Está a demorar mais do que devia
          </div>
          <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
            Não foi possível ler alguns dados — quase sempre é a sessão que expirou.
            <strong style={{ color: T.cream }}> Nada foi apagado.</strong> Recarrega a
            página; se continuar, sai da conta e volta a entrar.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Btn onClick={() => window.location.reload()}><RefreshCw size={14} /> Recarregar</Btn>
            <Btn variant="ghost" onClick={async () => {
              await supabase.auth.signOut();
              window.location.reload();
            }}><LogOut size={14} /> Sair da conta</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// Portão de autenticação: mostra o ecrã de login enquanto não há sessão,
// e só monta a app (e começa a carregar dados do Supabase) depois de
// autenticado. Cada conta criada fica com os seus dados isolados na
// tabela por secção, graças às políticas RLS e aos gatilhos de auditoria
// (ver supabase/schema.sql).
/* REDE CONTRA O ECRÃ BRANCO.

   Um erro durante a renderização faz o React desmontar a árvore toda e
   deixar a página em branco. No computador vê-se a causa na consola; no
   telemóvel não se vê nada — e "está tudo branco" é impossível de
   diagnosticar à distância.

   Isto apanha o erro e mostra-o no ecrã, com um botão para copiar. Custa
   trinta linhas e transforma cada avaria futura num relatório em vez de
   um mistério.

   Tem de ser um componente de classe: os hooks não têm equivalente ao
   componentDidCatch. */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { erro: null, pilha: '' };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error('Erro de renderização:', erro, info);
    this.setState({ pilha: (info && info.componentStack) || '' });
  }

  render() {
    if (!this.state.erro) return this.props.children;

    const texto = `${this.state.erro.message || this.state.erro}\n${this.state.pilha}`;
    return (
      <div style={{
        background: '#182619', minHeight: '100vh', padding: 24, color: '#ECEFEA',
        fontFamily: "'Inter', sans-serif", fontSize: 14, lineHeight: 1.6,
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ color: '#C25A5A', fontSize: 18, margin: '0 0 10px' }}>Alguma coisa correu mal</h2>
          <p style={{ color: '#8FA091', margin: '0 0 16px' }}>
            Os teus dados estão seguros — isto é um erro no ecrã, não na base de dados.
            Copia a mensagem abaixo e envia-a, que diz exatamente onde é.
          </p>
          <pre style={{
            background: '#202F22', border: '1px solid #3A4F3D', borderRadius: 8,
            padding: 12, fontSize: 11.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            maxHeight: 300, overflow: 'auto', color: '#ECEFEA',
          }}>{texto}</pre>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button
              onClick={() => { try { navigator.clipboard.writeText(texto); } catch (e) { /* sem clipboard: seleciona à mão */ } }}
              style={{ background: '#B5393F', color: '#FBF3F0', border: 'none', borderRadius: 7, padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}
            >Copiar mensagem</button>
            <button
              onClick={() => window.location.reload()}
              style={{ background: 'transparent', color: '#8FA091', border: '1px solid #3A4F3D', borderRadius: 7, padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}
            >Recarregar</button>
          </div>
        </div>
      </div>
    );
  }
}

/* PÁGINA PÚBLICA DE UM CLIPE CORTADO (?clipe=<id>)

   Destino dos links "Partilhar" dos clipes cortados no Analisador de
   Vídeo (ficheiros). Abre sem login: pede à função `clipe_publico` o
   endereço do ficheiro e o texto desse clipe, e mostra-o com a barra
   amarela. Os desenhos feitos no Analisador não aparecem aqui. */
const ETIQUETAS_CLIPE = {
  golo: 'Golo', remate: 'Remate', bp: 'Esquemas Táticos', perda: 'Perda',
  recuperacao: 'Recuperação', transicao: 'Transição', individual: 'Ação Individual', erro: 'Erro',
  posicionamento: 'Posicionamento', cobertura: 'Cobertura', duelo: 'Duelo',
  org_of: 'Organização Ofensiva', org_def: 'Organização Defensiva',
  trans_of: 'Transição Ofensiva', trans_def: 'Transição Defensiva',
};
function PaginaClipe() {
  const id = (new URLSearchParams(window.location.search).get('clipe') || '').trim();
  const [estado, setEstado] = useState('a-carregar'); // a-carregar | pronto | erro
  const [clipe, setClipe] = useState(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        if (!/^[A-Za-z0-9_-]{4,64}$/.test(id)) throw new Error('id');
        const { data, error } = await supabase.rpc('clipe_publico', { p_clipe_id: id });
        if (cancelado) return;
        if (error) throw error;
        let d = data;
        if (Array.isArray(d)) d = d[0];
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { /* fica */ } }
        if (!d || !d.ok || !d.clipe || !d.clipe.publicUrl) throw new Error('sem clipe');
        setClipe(d.clipe);
        setEstado('pronto');
        const t = (d.clipe.note || '').trim() || ETIQUETAS_CLIPE[d.clipe.tagId] || 'Clipe';
        document.title = t;
      } catch (e) {
        if (!cancelado) setEstado('erro');
      }
    })();
    return () => { cancelado = true; };
  }, [id]);

  const titulo = clipe ? ((clipe.note || '').trim() || ETIQUETAS_CLIPE[clipe.tagId] || 'Clipe') : '';
  const etiqueta = clipe && ETIQUETAS_CLIPE[clipe.tagId];

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.cream, ...body, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 900 }}>
        {estado === 'a-carregar' && <div style={{ fontSize: 13, color: T.mutedDim, padding: '40px 0', textAlign: 'center' }}>A carregar…</div>}
        {estado === 'erro' && <div style={{ fontSize: 14, color: T.bad, padding: '40px 0', textAlign: 'center' }}>Este clipe já não existe ou o link não é válido.</div>}
        {estado === 'pronto' && (
          <>
            <h1 style={{ ...display, fontSize: 22, fontWeight: 600, margin: '0 0 4px', whiteSpace: 'pre-wrap' }}>{titulo}</h1>
            {clipe.originalTitulo && (
              <div style={{ fontSize: 14, color: T.muted, marginBottom: 4 }}>{clipe.originalTitulo}</div>
            )}
            <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 14 }}>
              {[etiqueta && etiqueta !== titulo ? etiqueta : null, clipe.duracao ? `${Math.round(clipe.duracao)}s` : null].filter(Boolean).join(' · ')}
            </div>
            <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden' }}>
              <VideoComBarra src={clipe.publicUrl} preload="metadata" videoStyle={{ maxHeight: '75vh' }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* PÁGINA PÚBLICA DE UM VÍDEO JUNTO (?junto=<lista em base64>) — o destino
   do "Partilhar" de Os meus vídeos. O mesmo leitor do Portal (clipes
   seguidos, passagem contínua, uma barra só), sem login. */
function PaginaVideoJunto() {
  const params = new URLSearchParams(window.location.search);
  const codigo = params.get('video');
  const dadosLink = codigo ? null : descodificarJunto(params.get('junto'));
  // Link curto (?video=código): o vídeo vem do servidor (video_publico).
  const [doServidor, setDoServidor] = useState(codigo ? 'a-carregar' : null);
  useEffect(() => {
    if (!codigo) return;
    supabase.rpc('video_publico', { p_codigo: codigo }).then(({ data, error }) => {
      const d = !error && data ? (typeof data === 'string' ? JSON.parse(data) : data) : null;
      setDoServidor(d && Array.isArray(d.segmentos) ? d : 'invalido');
    }).catch(() => setDoServidor('invalido'));
  }, [codigo]);
  const dados = codigo
    ? (doServidor && typeof doServidor === 'object' ? { n: doServidor.nome, s: doServidor.segmentos.map(x => [x.youtubeId, x.inicio, x.fim, x.titulo]) } : null)
    : dadosLink;
  const nome = dados && typeof dados.n === 'string' ? dados.n : '';
  const segmentos = React.useMemo(() => ((dados && Array.isArray(dados.s)) ? dados.s : [])
    .filter(x => Array.isArray(x) && /^[A-Za-z0-9_-]{6,20}$/.test(String(x[0])) && Number(x[2]) > Number(x[1]))
    .slice(0, 60)
    .map(x => ({ youtubeId: String(x[0]), inicio: Math.max(0, Number(x[1])), fim: Number(x[2]), titulo: String(x[3] || '') })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [doServidor]);
  const estreito = typeof window !== 'undefined' && window.innerWidth < 600;
  useEffect(() => { document.title = nome ? `${nome} · Vídeo` : 'Vídeo'; }, [nome]);
  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.cream, ...body, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 900 }}>
        {doServidor === 'a-carregar' ? (
          <div style={{ fontSize: 14, color: T.mutedDim, padding: '40px 0', textAlign: 'center' }}>A abrir o vídeo…</div>
        ) : !segmentos.length ? (
          <div style={{ fontSize: 14, color: T.bad, padding: '40px 0', textAlign: 'center' }}>Este link de vídeo não é válido.</div>
        ) : (
          <LeitorJunto titulo={nome || 'Vídeo'} segmentos={segmentos} isNarrow={estreito} />
        )}
      </div>
    </div>
  );
}

/* PÁGINA PÚBLICA DE UM CORTE (?corte=<youtubeId>&i=<início>&f=<fim>&t=<título>)

   É o destino dos links "Partilhar" dos cortes do YouTube. Abre sem
   login e sem tocar na base de dados: só mostra o intervalo do vídeo,
   sem os controlos do YouTube (que deixavam percorrer o jogo todo), com
   a barra amarela da app limitada ao corte e a voltar ao início no fim.

   Nota: isto limita o que se VÊ aqui, não é uma proteção do vídeo — o
   vídeo continua no YouTube, e quem tiver o id pode abri-lo lá. */
function PaginaCorte() {
  const params = new URLSearchParams(window.location.search);
  const youtubeId = (params.get('corte') || '').trim();
  const idValido = /^[A-Za-z0-9_-]{6,20}$/.test(youtubeId);
  const inicio = Math.max(0, Number(params.get('i')) || 0);
  const fim = Math.max(inicio + 1, Number(params.get('f')) || inicio + 1);
  const titulo = (params.get('t') || '').slice(0, 200);
  const duracao = fim - inicio;

  const iframeRef = useRef(null);
  const [tempo, setTempo] = useState(inicio);
  const [aTocar, setATocar] = useState(false);
  const saltoRef = useRef(0);

  useEffect(() => {
    document.title = titulo ? `${titulo} · Corte` : 'Corte';
  }, [titulo]);

  const comando = (func, args) => {
    const win = iframeRef.current && iframeRef.current.contentWindow;
    if (win) win.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*');
  };
  const irPara = (seg) => { saltoRef.current = Date.now(); comando('seekTo', [seg, true]); setTempo(seg); };

  useEffect(() => {
    const onMessage = (event) => {
      if (!event.origin || !event.origin.includes('youtube.com')) return;
      const win = iframeRef.current && iframeRef.current.contentWindow;
      if (win && event.source !== win) return;
      let data = event.data;
      try { data = typeof data === 'string' ? JSON.parse(data) : data; } catch (e) { return; }
      if (!data) return;
      if (data.event === 'onStateChange' && typeof data.info === 'number') setATocar(data.info === 1 || data.info === 3);
      if (data.event === 'infoDelivery' && data.info) {
        if (typeof data.info.playerState === 'number') setATocar(data.info.playerState === 1 || data.info.playerState === 3);
        const t = data.info.currentTime;
        if (typeof t === 'number') {
          const aSaltar = Date.now() - saltoRef.current < 800;
          if (!aSaltar && (t >= fim - 0.15 || t < inicio - 0.5)) irPara(inicio);
          else setTempo(Math.min(fim, Math.max(inicio, t)));
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeId, inicio, fim]);

  const aoCarregar = () => {
    const win = iframeRef.current && iframeRef.current.contentWindow;
    if (win) win.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
  };

  const btn = { background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.cream, ...body, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 900 }}>
        {!idValido ? (
          <div style={{ fontSize: 14, color: T.bad, padding: '40px 0', textAlign: 'center' }}>Este link de corte não é válido.</div>
        ) : (
          <>
            {titulo && <h1 style={{ ...display, fontSize: 22, fontWeight: 600, margin: '0 0 4px' }}>{titulo}</h1>}
            <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 14, ...mono }}>
              {fmtMMSS(inicio)}–{fmtMMSS(fim)} ({Math.round(duracao)}s)
            </div>
            <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden', background: '#000' }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
                <iframe
                  ref={iframeRef} onLoad={aoCarregar} title={titulo || 'Corte'}
                  src={`https://www.youtube.com/embed/${youtubeId}?start=${Math.floor(inicio)}&rel=0&playsinline=1&controls=0&disablekb=1&enablejsapi=1&fs=0`}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#111', borderTop: `1px solid ${T.line}` }}>
                <button onClick={() => comando(aTocar ? 'pauseVideo' : 'playVideo')} title={aTocar ? 'Pausar' : 'Reproduzir'} style={btn}>
                  {aTocar ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button onClick={() => irPara(inicio)} title="Voltar ao início do corte" style={btn}><RotateCcw size={16} /></button>
                <input
                  type="range" min={0} max={duracao} step={0.1} value={Math.max(0, tempo - inicio)}
                  onChange={e => irPara(inicio + Number(e.target.value))}
                  aria-label="Posição no corte"
                  style={{ flex: 1, minWidth: 0, accentColor: T.gold, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 12, color: '#fff', whiteSpace: 'nowrap', flexShrink: 0, ...mono }}>
                  {fmtMMSS(tempo - inicio)} / {fmtMMSS(duracao)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ECRÃ SEMPRE LIGADO ENQUANTO SE VÊ UM VÍDEO EM ECRÃ INTEIRO.

   Vale para toda a app de uma vez (Biblioteca, Jogos, Adversários,
   Análise de Vídeo, Portal do Atleta, cortes partilhados…), sem mexer em
   cada leitor: escuta o documento.

   · Ecrã inteiro com um <video> nosso: mantém o ecrã ligado enquanto o
     vídeo está a tocar; em pausa ou no fim, deixa-o apagar como sempre.
   · Ecrã inteiro com o YouTube (iframe): de fora não se sabe se está a
     tocar ou em pausa, por isso mantém ligado enquanto estiver em ecrã
     inteiro. Sair do ecrã inteiro devolve o comportamento normal.
   · Ecrã inteiro sem vídeo (o Quadro Tático) fica como sempre esteve.
   · iPhone: o leitor nativo em ecrã inteiro não dispara o
     "fullscreenchange" — apanha-se pelos eventos webkit*fullscreen do
     próprio <video>.

   Usa a Screen Wake Lock API. O sistema solta o pedido quando a app vai
   para segundo plano; ao voltar, volta a pedir se ainda estiver a ver.
   Em browsers sem esta API (iPhone com iOS anterior a 16.4) não faz
   nada — mas aí o leitor nativo do iPhone já impede o ecrã de apagar. */
function useEcraLigadoEmVideo() {
  useEffect(() => {
    if (typeof document === 'undefined' || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return undefined;
    let lock = null;
    let aPedir = false;
    let nativoIOS = null;

    const elementoEcraInteiro = () => document.fullscreenElement || document.webkitFullscreenElement || nativoIOS;
    const deveManter = () => {
      if (document.visibilityState !== 'visible') return false;
      const el = elementoEcraInteiro();
      if (!el) return false;
      const procurar = (sel) => Array.from(el.querySelectorAll ? el.querySelectorAll(sel) : []);
      const videos = el.tagName === 'VIDEO' ? [el] : procurar('video');
      if (videos.length) return videos.some(v => !v.paused && !v.ended);
      // YouTube (iframe): em ecrã inteiro conta como a ver. Ecrã inteiro
      // sem vídeo nenhum (o Quadro Tático, por exemplo) não conta.
      return el.tagName === 'IFRAME' || procurar('iframe').length > 0;
    };
    const soltar = () => {
      const l = lock; lock = null;
      if (l) l.release().catch(() => {});
    };
    const atualizar = async () => {
      if (!deveManter()) { soltar(); return; }
      if (lock || aPedir) return;
      aPedir = true;
      try {
        const l = await navigator.wakeLock.request('screen');
        l.addEventListener('release', () => { if (lock === l) lock = null; });
        lock = l;
      } catch (e) {
        /* recusado (bateria fraca, separador escondido…) — segue sem ele */
      } finally {
        aPedir = false;
      }
      // Pode ter saído do ecrã inteiro ou posto em pausa durante o pedido.
      if (!deveManter()) soltar();
    };
    const inicioIOS = (e) => { nativoIOS = e.target; atualizar(); };
    const fimIOS = () => { nativoIOS = null; atualizar(); };

    const doc = ['fullscreenchange', 'webkitfullscreenchange', 'visibilitychange'];
    // Os eventos de <video> não sobem na árvore: apanham-se na captura.
    const media = ['play', 'playing', 'pause', 'ended', 'emptied'];
    doc.forEach(ev => document.addEventListener(ev, atualizar));
    media.forEach(ev => document.addEventListener(ev, atualizar, true));
    document.addEventListener('webkitbeginfullscreen', inicioIOS, true);
    document.addEventListener('webkitendfullscreen', fimIOS, true);
    return () => {
      doc.forEach(ev => document.removeEventListener(ev, atualizar));
      media.forEach(ev => document.removeEventListener(ev, atualizar, true));
      document.removeEventListener('webkitbeginfullscreen', inicioIOS, true);
      document.removeEventListener('webkitendfullscreen', fimIOS, true);
      soltar();
    };
  }, []);
}

/* ATUALIZAÇÃO AUTOMÁTICA. Depois de cada publicação, quem tinha a app
   aberta continuava com a versão antiga até a fechar e voltar a abrir.
   (Foi assim que a missão das estatísticas do Castro se fechou sozinha
   outra vez: a app dele ainda tinha a regra antiga.) Agora a app vê, de 5
   em 5 minutos e sempre que se volta a ela, se há versão nova publicada
   (os ficheiros da app mudam de nome a cada publicação):
   - se a pessoa estava noutra app e volta, recarrega logo (não estava a
     escrever nada);
   - se está a usar a app, aparece um aviso pequeno em baixo, "Há uma
     versão nova", com o botão Atualizar, para não lhe apagar o que está
     a escrever. */
function scriptsDaApp(doc) {
  return [...doc.querySelectorAll('script[src]')]
    .map(s => { try { return new URL(s.getAttribute('src'), window.location.origin).pathname; } catch (e) { return ''; } })
    .filter(p => /\/(assets|static)\//.test(p))
    .sort().join('|');
}
function useAtualizacaoAutomatica() {
  /* OBRIGATÓRIA a partir desta versão: quando há versão nova, a app
     recarrega-se sozinha. Se a pessoa está noutra app e volta, recarrega
     logo. Se está a usar a app, aparece "A app vai atualizar em 30 s"
     (com "Atualizar já") e recarrega no fim da contagem. Só espera se a
     pessoa estiver a ESCREVER num campo, para não lhe apagar o texto:
     nesse caso atualiza assim que ela sair do campo. */
  useEffect(() => {
    if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return undefined;
    const atual = scriptsDaApp(document);
    if (!atual) return undefined; // em desenvolvimento não há ficheiros com nome de versão
    let novaVersao = false;
    let aviso = null;
    let contagem = null;
    const aEscrever = () => {
      const a = document.activeElement;
      return !!a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit'].includes(a.type)) || a.isContentEditable);
    };
    const recarregar = () => { window.location.reload(); };
    const tentarRecarregar = () => {
      if (aEscrever()) {
        // Espera que saia do campo e atualiza logo a seguir.
        document.addEventListener('focusout', () => setTimeout(() => { if (!aEscrever()) recarregar(); }, 300), { once: true });
        return;
      }
      recarregar();
    };
    const mostrarAviso = () => {
      if (aviso || document.visibilityState !== 'visible') return;
      let falta = 30;
      aviso = document.createElement('div');
      aviso.setAttribute('role', 'status');
      aviso.style.cssText = 'position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2147483000;'
        + 'display:flex;align-items:center;gap:12px;padding:10px 12px 10px 16px;border-radius:12px;background:#14231a;color:#F3ECDA;'
        + 'border:1px solid #C9A227;box-shadow:0 10px 30px rgba(0,0,0,.45);font:14px system-ui,sans-serif;max-width:calc(100vw - 24px);';
      const texto = document.createElement('span');
      const escrever = () => { texto.textContent = `Há uma versão nova. A app vai atualizar em ${falta} s.`; };
      escrever();
      aviso.appendChild(texto);
      const bt = document.createElement('button');
      bt.textContent = 'Atualizar já';
      bt.style.cssText = 'border:none;border-radius:8px;padding:7px 12px;background:#C9A227;color:#14231a;font-weight:700;cursor:pointer;font:inherit;white-space:nowrap;';
      bt.onclick = recarregar;
      aviso.appendChild(bt);
      document.body.appendChild(aviso);
      contagem = setInterval(() => {
        falta -= 1;
        if (falta > 0) { escrever(); return; }
        clearInterval(contagem); contagem = null;
        texto.textContent = 'A atualizar…';
        tentarRecarregar();
      }, 1000);
    };
    const verificar = async () => {
      if (novaVersao) { mostrarAviso(); return; }
      try {
        const r = await fetch(`${window.location.origin}/?v=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) return;
        const html = await r.text();
        const publicado = scriptsDaApp(new DOMParser().parseFromString(html, 'text/html'));
        if (publicado && publicado !== atual) {
          novaVersao = true;
          if (document.visibilityState === 'visible') mostrarAviso();
        }
      } catch (e) { /* sem rede: tenta-se na próxima */ }
    };
    const aoVoltar = () => {
      if (document.visibilityState !== 'visible') return;
      // Voltou à app e já se sabia que havia versão nova: recarrega já.
      if (novaVersao) { tentarRecarregar(); return; }
      verificar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', verificar);
    const intervalo = setInterval(verificar, 5 * 60 * 1000);
    const primeira = setTimeout(verificar, 20 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', verificar);
      clearInterval(intervalo); clearTimeout(primeira);
      if (contagem) clearInterval(contagem);
      if (aviso && aviso.parentNode) aviso.parentNode.removeChild(aviso);
    };
  }, []);
}

/* LIMITE DE TEMPO DA EQUIPA TÉCNICA.
   A sessão do Supabase fica guardada no navegador e renova-se sozinha: sem
   isto, a app ficava aberta para sempre nesse aparelho — num computador
   partilhado do clube, com os dados de saúde do plantel inteiro à vista.
   Agora, se a app não for aberta neste aparelho durante 7 dias, a sessão
   termina e, da próxima vez, aparece a porta (com o Face ID / a impressão
   digital, se estiver ativa, entra-se num toque).
   · Conta como atividade abrir a app e tê-la à vista (marca de 5 em 5 min).
   · Só sai NESTE aparelho (scope 'local'): os outros aparelhos da mesma
     pessoa continuam como estão.
   · A porta guardada (nome, emblema, formação) e a entrada rápida não se
     apagam — é só voltar a entrar.
   · Na primeira vez com esta versão não há marca guardada: conta-se a
     partir de agora (ninguém é posto fora de repente).
   O Portal do Atleta não é afetado: continua a pedir o PIN em cada visita. */
const STAFF_LIMITE_DIAS = 7;
const STAFF_ATIVIDADE = 'mjp-staff-ultima-atividade';
function marcarAtividadeStaff() {
  try { localStorage.setItem(STAFF_ATIVIDADE, String(Date.now())); } catch (e) { /* sem memória: não há limite neste aparelho */ }
}
function staffInativoDemais() {
  try {
    const t = Number(localStorage.getItem(STAFF_ATIVIDADE) || 0);
    return !!t && Date.now() - t > STAFF_LIMITE_DIAS * 24 * 3600 * 1000;
  } catch (e) { return false; }
}
async function sairPorInatividade() {
  try { localStorage.removeItem(STAFF_ATIVIDADE); } catch (e) { /* nada */ }
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  } catch (e) {
    // Versão antiga do supabase-js sem `scope`, ou sem rede: apaga a sessão guardada à mão.
    try { Object.keys(localStorage).filter(k => /^sb-.*-auth-token$/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e2) { /* nada */ }
  }
}

export default function AppRoot() {
  const [session, setSession] = useState(undefined); // undefined = a verificar
  /* A PORTA DA EQUIPA TÉCNICA (ver AuthScreen.jsx). Quando a sessão começa
     a partir do ecrã de entrada, a porta (o quadro tático) abre por cima
     da app já montada. `novaPasse`: chegou-se pelo link de "Perdi a
     palavra-passe" e falta escolher a nova. */
  const [entradaStaff, setEntradaStaff] = useState(null);
  const [novaPasse, setNovaPasse] = useState(PEDIU_NOVA_PASSE);
  useEcraLigadoEmVideo();
  useAtualizacaoAutomatica();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      // Sessão parada há demasiado tempo neste aparelho: sai antes de mostrar a app.
      if (data.session && staffInativoDemais()) { await sairPorInatividade(); setSession(null); return; }
      if (data.session) marcarAtividadeStaff();
      setSession(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (_event === 'SIGNED_IN') { marcarAtividadeStaff(); const e = tirarEntradaStaff(); if (e) setEntradaStaff(e); }
      if (_event === 'PASSWORD_RECOVERY') setNovaPasse(true);
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /* Enquanto a app está aberta e à vista, conta como atividade (de 5 em 5
     minutos e sempre que se volta à app). Se a app ficou esquecida num
     separador e se volta a ela depois do limite, sai nesse momento. */
  useEffect(() => {
    if (!session) return undefined;
    const aoVoltar = async () => {
      if (document.visibilityState !== 'visible') return;
      if (staffInativoDemais()) { await sairPorInatividade(); setSession(null); return; }
      marcarAtividadeStaff();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    const intervalo = setInterval(() => { if (document.visibilityState === 'visible') marcarAtividadeStaff(); }, 5 * 60 * 1000);
    return () => { document.removeEventListener('visibilitychange', aoVoltar); clearInterval(intervalo); };
  }, [session]);

  // O link do questionário (?checkin=1, dos links antigos, ou
  // ?portal=<id-da-equipa>, dos novos) é para os atletas, que não têm
  // (nem devem precisar de) conta de treinador — por isso esta
  // verificação acontece ANTES do portão de login, e nunca mostra o ecrã
  // de autenticação da plataforma.
  // Link partilhado de um vídeo junto (Os meus vídeos): página pública.
  if (typeof window !== 'undefined' && (new URLSearchParams(window.location.search).has('junto') || new URLSearchParams(window.location.search).has('video'))) {
    return <ErrorBoundary><PaginaVideoJunto /></ErrorBoundary>;
  }
  // Link partilhado de um corte: página pública, sem login (ver PaginaCorte).
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('corte')) {
    return <ErrorBoundary><PaginaCorte /></ErrorBoundary>;
  }
  // Link partilhado de um clipe cortado no Analisador (ver PaginaClipe).
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('clipe')) {
    return <ErrorBoundary><PaginaClipe /></ErrorBoundary>;
  }

  const isCheckin = typeof window !== 'undefined' &&
    (window.location.search.includes('checkin') || window.location.hash.includes('checkin')
      || window.location.search.includes('portal=') || window.location.hash.includes('portal='));
  if (isCheckin) return <ErrorBoundary><CheckinApp /></ErrorBoundary>;

  if (session === undefined) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, color: T.muted }}>
        A carregar…
      </div>
    );
  }
  if (!session) return <AuthScreen />;
  if (novaPasse) return <ErrorBoundary><AuthScreen modo="nova-passe" /></ErrorBoundary>;
  return (
    <ErrorBoundary>
      <PortaoEquipa session={session} />
      {entradaStaff && <PortaStaffAbrir entrada={entradaStaff} onFim={() => setEntradaStaff(null)} />}
    </ErrorBoundary>
  );
}

/* O PORTÃO ENTRE TER SESSÃO E TER CONTEXTO.

   Estar autenticado não chega: sem equipa escolhida não há nada para
   mostrar, e o `App` inteiro depende de um `teamId` para saber o que
   ler. Este componente resolve essa pergunta antes de o `App` existir —
   é a razão de ser um componente à parte e não um `useEffect` lá dentro.

   Três estados: a carregar, sem equipa nenhuma (ecrã de criar/entrar), e
   com equipa (a app). O quarto caso — ter equipas mas a guardada já não
   existir, porque saíste dela noutro dispositivo — resolve-se caindo na
   primeira da lista, em vez de mostrar um ecrã vazio. */
function PortaoEquipa({ session }) {
  const { equipas, erro, recarregar } = useEquipas();
  const [aCriarNova, setACriarNova] = useState(false);

  if (equipas === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, color: T.muted }}>
        A carregar…
      </div>
    );
  }

  if (erro && equipas.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', justifyContent: 'center', background: T.bg, color: T.muted, padding: 24, textAlign: 'center', ...body }}>
        <div style={{ color: T.bad, fontSize: 14 }}>{erro}</div>
        <Btn variant="ghost" onClick={recarregar}><RefreshCw size={15} /> Tentar de novo</Btn>
      </div>
    );
  }

  const escolhida = equipaGuardada();
  const ativa = equipas.find(e => e.id === escolhida) || equipas[0];

  if (!ativa || aCriarNova) {
    return (
      <EscolherEquipa
        temEquipas={equipas.length > 0}
        equipas={equipas}
        onPronto={(id) => { if (id) trocarDeEquipa(id); }}
        onSair={() => { if (equipas.length > 0) setACriarNova(false); else supabase.auth.signOut(); }}
      />
    );
  }

  // A guardada já não servia (saíste dela, ou nunca escolheste): fixa a
  // que vai ser usada, para o próximo arranque não voltar a decidir.
  if (escolhida !== ativa.id) guardarEquipa(ativa.id);

  return (
    <App
      session={session}
      teamId={ativa.id}
      equipas={equipas}
      equipaAtiva={ativa}
      onNovaEquipa={() => setACriarNova(true)}
      onEquipasMudaram={recarregar}
    />
  );
}
