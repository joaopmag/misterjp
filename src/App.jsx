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


const CHECKIN_CODE_MIN = 4; // os códigos antigos ainda são aceites


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

/* Nomes de competição como "Campeonato distrital U19 - 1ª Divisão" ficam
   partidos a meio no telemóvel. Separa-se pelo último hífen: a parte da
   esquerda fica no título e a da direita passa a subtítulo. */
function splitCompetitionName(name) {
  const txt = String(name || '').trim();
  const m = txt.match(/^(.*\S)\s*[-–—]\s*(\S.*)$/);
  return m ? { title: m[1], subtitle: m[2] } : { title: txt, subtitle: '' };
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


function equipaGuardada() {
  try { return window.localStorage.getItem(CHAVE_EQUIPA) || null; } catch (e) { return null; }
}
function guardarEquipa(id) {
  try { window.localStorage.setItem(CHAVE_EQUIPA, id); } catch (e) { /* modo privado */ }
}

/* TROCAR DE EQUIPA RECARREGA A PÁGINA, DE PROPÓSITO.

   A app tem dezenas de componentes com estado próprio — filtros, mês
   escolhido, rascunhos de modais, o simulador a meio. Recarregar em
   memória obrigaria a limpar todos, e um esquecido significa ver dados
   da equipa A dentro da equipa B: exatamente aquilo que esta separação
   existe para impedir. Trocar de equipa é raro; um segundo de espera é
   um preço barato por uma garantia. */
function trocarDeEquipa(id) {
  guardarEquipa(id);
  window.location.reload();
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


// Data de hoje por extenso ("quarta-feira, 3 de setembro"), sempre a
// partir da hora LOCAL de quem está a ver o ecrã — `new Date()` sem mais
// nada usa o fuso horário do próprio aparelho, nunca o do servidor, por
// isso não há risco de mostrar o dia errado a quem está noutro fuso.
function dataDeHojeExtenso() {
  const s = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
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


function greetingNow() {
  const h = new Date().getHours();
  if (h < 6) return 'Boa noite';
  if (h < 13) return 'Bom dia';
  if (h < 20) return 'Boa tarde';
  return 'Boa noite';
}

// Quantos dias para trás (além de hoje) o atleta vê na tira de dias.
// Os dias anteriores servem só para o atleta ver o que já preencheu —
// desde que existem janelas horárias, responder em atraso deixou de ser
// possível no questionário (ver CHECKIN_WINDOWS).
const CHECKIN_DAYS_BACK = 6;
// Muda a cada publicação. Aparece nos ecrãs de erro do quiosque: se o que
// se vê no telemóvel não bater certo com o que está aqui, o browser está
// a servir uma versão em cache e não vale a pena procurar o erro no código.
const APP_BUILD = 'quiosque-rpc-3';

// Com janelas horárias activas, o atleta só responde ao dia de hoje.
// Se algum dia se quiser voltar a permitir preencher em atraso, basta pôr
// esta constante a true (a tira de dias volta a ser clicável).
const CHECKIN_ALLOW_BACKFILL = false;

/* ---------------------------------------------------------------
   JANELAS HORÁRIAS DO QUESTIONÁRIO DOS ATLETAS

   Wellness: das 08:00 às 13:00 do próprio dia.
   PSE/RPE:  das 13:10 às 23:59 do próprio dia.

   IMPORTANTE: estas janelas aplicam-se APENAS ao questionário que os
   atletas abrem pelo link (?checkin=1). O registo manual feito pelo staff
   em Monitorização não tem qualquer restrição de hora nem de dia — é
   precisamente essa a forma de corrigir/preencher fora de horas.
---------------------------------------------------------------- */
const CHECKIN_WINDOWS = {
  wellness: { startMin: 6 * 60 + 30, endMin: 13 * 60, label: 'das 06:30 às 13:00' },
  rpe: { startMin: 13 * 60 + 10, endMin: 23 * 60 + 59, label: 'das 13:10 às 23:59' },
};

function fmtMinutesOfDay(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// Estado da janela para um tipo de questionário num determinado dia.
// Devolve { open, reason } — reason é o texto mostrado ao atleta.
function checkinWindowState(type, dateStr, now = new Date()) {
  const w = CHECKIN_WINDOWS[type];
  if (!w) return { open: true, reason: '' };
  if (dateStr !== todayStr()) {
    return { open: false, reason: `Só pode ser respondido no próprio dia, ${w.label}` };
  }
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < w.startMin) {
    return { open: false, reason: `Ainda fechado - abre às ${fmtMinutesOfDay(w.startMin)} (${w.label})` };
  }
  if (mins > w.endMin) {
    return { open: false, reason: `Já fechou às ${fmtMinutesOfDay(w.endMin)} — fala com o staff para registar` };
  }
  return { open: true, reason: `Disponível hoje ${w.label}` };
}

/* Recebe SÓ o jogador que se autenticou, e não o plantel inteiro.

   Antes, o quiosque carregava a tabela `players` completa para o browser
   do atleta e fazia o `find` pelo código em JavaScript. A interface só
   mostrava o próprio nome, mas os dados de todos estavam na resposta de
   rede — bastava abrir as ferramentas de programador. Agora a validação
   do código acontece no servidor (função checkin_bootstrap) e o que chega
   ao browser é apenas o registo de quem entrou. */
function CheckinKiosk({ player, monitoring, sessions, onSave, onLogout, diagnostico, code, teamId, equipa }) {
  const loggedPlayerId = player && player.id;
  const [activeType, setActiveType] = useState(null); // null = ecrã pessoal, 'wellness' | 'rpe' = questionário aberto
  /* O CACIFO abre-se com a animação só quando se vem do balneário; ao
     voltar de uma área (Treino, Jogo…) já está aberto. Volta a animar
     depois de se regressar ao ecrã inicial. */
  const [cacifoAberto, setCacifoAberto] = useState(false);
  useEffect(() => { if (activeType === null) setCacifoAberto(false); }, [activeType]);
  /* DE ONDE SE VEIO: o "retroceder" de qualquer área (tarefas, missão,
     jogo, Wellness/PSE…) volta ao sítio de onde ela foi aberta.
     null = ecrã inicial (Mister, missões, campo do Wellness/PSE);
     'portal' = cacifo. Dentro de uma área (ex.: das Tarefas para uma
     missão) mantém-se a origem de quem abriu as Tarefas. */
  const [origem, setOrigem] = useState(null);
  /* Voltar do cacifo ao balneário: o ecrã inicial entra a desvanecer (0,3 s)
     em vez de aparecer de golpe. Só opacidade (sem transform), para não
     mexer nos elementos fixos do ecrã. */
  const [voltouCacifo, setVoltouCacifo] = useState(false);
  useEffect(() => { if (!voltouCacifo) return undefined; const t = setTimeout(() => setVoltouCacifo(false), 450); return () => clearTimeout(t); }, [voltouCacifo]);
  /* Missão aberta a partir das Tarefas: o retroceder (ou o X) dessa área
     volta às Tarefas; das Tarefas volta-se depois à origem de antes. */
  const [deTarefas, setDeTarefas] = useState(false);
  const voltar = () => {
    if (deTarefas && activeType !== 'tarefas') { setDeTarefas(false); setActiveType('tarefas'); return; }
    setDeTarefas(false);
    setActiveType(origem);
  };
  // Onde abrir uma área vinda do cacifo (ex.: Competição › estatísticas).
  const [focoArea, setFocoArea] = useState(null);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  // Quando a notificação do ecrã inicial é tocada, guarda aqui a tarefa a
  // abrir de imediato — o PlayerTarefasView lê isto e já entra direto no
  // detalhe, em vez de mostrar primeiro a lista.
  const [tarefaParaAbrir, setTarefaParaAbrir] = useState(null);
  /* GESTO DE RETROCEDER DO TELEMÓVEL (Android) e botão retroceder do
     browser: dentro de uma área do Portal fazem o mesmo que o "Voltar"
     da app, em vez de sair da app. Uma só marca no histórico enquanto se
     está numa área; depois de cada retroceder que ainda deixa o jogador
     dentro do Portal (ex.: de uma missão para as Tarefas), volta a pôr-se
     a marca. Vistas com passos internos (uma ideia aberta em ecrã
     inteiro, o passo 2 do Wellness) registam-se com `useKioskVoltar` e
     o gesto fecha primeiro esse passo. */
  const emArea = activeType !== null;
  const gestoVoltarRef = useRef(null);
  gestoVoltarRef.current = () => {
    const interno = KIOSK_VOLTAR_INTERNO[KIOSK_VOLTAR_INTERNO.length - 1];
    if (interno) { interno(); return true; }
    if (activeType === 'portal') { setVoltouCacifo(true); setActiveType(null); return false; }
    const destino = deTarefas && activeType !== 'tarefas' ? 'tarefas' : origem;
    if (activeType === 'competicao') setFocoArea(null);
    voltar();
    return destino !== null;
  };
  useEffect(() => {
    if (!emArea || typeof window === 'undefined') return undefined;
    let meu = herdarOuEmpurrarMarca();
    let peloPop = false;
    const onPop = () => {
      const atual = window.history.state && window.history.state.mjpMarker;
      if (atual === meu) return; // fechou-se uma janela por cima, não a área
      const fica = gestoVoltarRef.current();
      if (fica) {
        meu = uid();
        window.history.pushState({ mjpMarker: meu }, '', window.location.hash);
      } else peloPop = true;
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (peloPop || modalHandoffAtivo) return;
      const atual = window.history.state && window.history.state.mjpMarker;
      if (atual === meu) window.history.back();
    };
  }, [emArea]);

  // Pedido às tarefas atribuídas a este atleta, feito aqui em cima (e não
  // só dentro de PlayerTarefasView) porque a notificação no ecrã inicial
  // (PlayerKioskHome) também precisa de saber quantas há por fazer — sem
  // isto, o atleta só saberia que tem uma tarefa depois de já ter entrado
  // no Portal, o que não serve de notificação nenhuma.
  const [estadoTarefas, dadosTarefas] = usePortalFetch('checkin_tarefas', code, teamId);
  // Autoavaliação já toda respondida mas por submeter: fecha-se sozinha.
  const autoavaliacaoSubmetidaRef = useRef(null);
  useEffect(() => {
    // Em silêncio: ao entrar, o jogador não deve ver outra vez "Missão cumprida".
    if (code && teamId) submeterAutoavaliacaoSeCompleta(code, teamId).then(ok => { if (ok && autoavaliacaoSubmetidaRef.current) autoavaliacaoSubmetidaRef.current({ silencioso: true }); });
  }, [code, teamId]);
  // Ajustes feitos DEPOIS deste pedido (rascunhos gravados, submissões)
  // ficam aqui por cima — sem isto, sair de Tarefas e voltar a entrar
  // mostrava outra vez os dados de quando o quiosque abriu, como se a
  // nota nunca tivesse sido gravada (o pedido não se repete sozinho).
  const [tarefasAjustes, setTarefasAjustes] = useState({});
  const listaTarefas = ((dadosTarefas && dadosTarefas.tarefas) || [])
    .map(t => (tarefasAjustes[t.id] ? { ...t, ...tarefasAjustes[t.id] } : t));
  // Notificação (bolinha vermelha + banner do ecrã inicial): desliga-se
  // assim que o atleta SUBMETE a nota, mesmo que o staff ainda não tenha
  // marcado a tarefa como concluída — do lado do atleta, a parte dele
  // está feita, não faz sentido continuar a incomodá-lo por causa de uma
  // tarefa que já respondeu.
  const tarefasPorFazer0 = listaTarefas.filter(t => t.estado !== 'feita' && !t.notaSubmetida);
  /* MISSÕES — o destino de cada tarefa chega por uma função própria
     (`checkin_tarefas_destinos`), que só devolve destinos das tarefas que
     a `checkin_tarefas` já mostra a este atleta. Sem ela (SQL por correr),
     tudo funciona como antes. */
  const [, dadosDestinos] = usePortalFetch('checkin_tarefas_destinos', code, teamId);
  const destinosTarefas = (dadosDestinos && dadosDestinos.destinos) || {};
  // A função devolve o destino (texto, versão antiga) ou { destino, missoes }.
  const comDestino = (t) => {
    const info = destinosTarefas[t.id];
    const missoes = info && typeof info === 'object' && Array.isArray(info.missoes) && info.missoes.length ? info.missoes : null;
    const destino = (info && typeof info === 'object' ? info.destino : info) || (missoes && missoes[0].destino)
      || inferirDestinoMissao(`${t.titulo || ''} ${t.notas || ''}`);
    return { ...t, ...(destino ? { destino } : {}), ...(missoes ? { missoes } : {}) };
  };
  const tarefasPorFazer = tarefasPorFazer0.map(comDestino);
  /* PASSOS de uma tarefa (as várias missões dentro dela). Os feitos ficam
     marcados na nota do atleta ("✓ Passo 2 · …"), que a equipa técnica lê;
     a tarefa só é submetida quando o último passo estiver feito. */
  const passosDe = (t) => {
    const lista = (Array.isArray(t.missoes) && t.missoes.length)
      ? t.missoes
      : [{ id: 'unico', destino: t.destino || 'nota', instrucoes: '' }];
    const nota = String(t.notaAtleta || '');
    const varios = lista.length > 1;
    return lista.map((m, k) => ({
      ...m, id: m.id || `p${k}`, ordem: k, total: lista.length,
      feito: varios ? nota.includes(`Passo ${k + 1} ·`) : false,
    }));
  };
  // Cada passo por fazer = uma "missão" (uma folha da prancheta).
  /* "Passo X de Y" conta SÓ os passos que ainda faltam. Se ele fez um
     de dois, saiu e voltou mais tarde, o que sobra aparece como uma
     missão simples, sem "Passo 2 de 2": para ele já é a única. */
  const itemMissao = (t, passo) => {
    const pend = passosDe(t).filter(p => !p.feito);
    const pos = pend.findIndex(p => p.id === passo.id);
    return {
      id: `${t.id}:${passo.id}`, titulo: t.titulo, prazo: t.prazo, destino: passo.destino || 'nota',
      notas: passo.instrucoes || (passo.total === 1 ? t.notas : ''),
      passoTxt: pend.length > 1 && pos >= 0 ? `Passo ${pos + 1} de ${pend.length}` : '',
      _tarefa: t, _passo: passo,
    };
  };
  const missoesPorFazer = tarefasPorFazer.flatMap(t => passosDe(t).filter(p => !p.feito).map(p => itemMissao(t, p)));
  /* VÉSPERA E DIA DE JOGO — missão automática, sem o treinador ter de
     criar nada. Quando há uma convocatória partilhada para AMANHÃ (véspera)
     ou para HOJE (dia de jogo), cada jogador recebe à entrada uma missão
     que o leva a Jogo (convocatória, plano de jogo, adversário), em vez de
     ter de ir à procura. Vai para todos os que a convocatória mostra,
     convocados ou não (os não convocados também devem ver o adversário).
     SÓ JOGOS OFICIAIS: amigável nunca gera a missão. A convocatória que
     chega ao Portal não diz a competição, por isso o jogo só conta se
     estiver no calendário oficial (`checkin_competicao`): um jogo nesse
     dia contra esse adversário. Se não estiver lá (amigável, ou calendário
     por carregar), não há missão. Mais vale faltar do que mandar para um
     amigável.
     APARECE UMA VEZ: uma na véspera, uma no dia. Conta como vista assim
     que aparece no ecrã, carregue ele em "Bora" ou em "Mais tarde".
     No dia do jogo desaparece à hora do jogo: depois disso já não serve.
     Não é uma tarefa: não conta para o limite de duas missões nem aparece
     em Tarefas da equipa técnica. */
  const [estadoConvJogo, dadosConvJogo] = usePortalFetch('checkin_convocatoria', code, teamId);
  const [estadoCompJogo, dadosCompJogo] = usePortalFetch('checkin_competicao', code, teamId);
  // O jogo da competição que corresponde a esta convocatória (mesmo dia,
  // mesmo adversário), com a jornada. null = não está no calendário oficial.
  const jogoDoCalendario = (c) => {
    const norm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim();
    const palavras = (x) => norm(x).split(/\s+/).filter(w => w.length >= 4 && !['clube', 'futebol', 'sport', 'sporting', 'grupo', 'desportivo', 'associacao', 'uniao'].includes(w));
    /* ADVERSÁRIOS DE NOME CURTO. Só contavam palavras com 4+ letras, e um
       nome como "AFS SAD (B)" não tem nenhuma: o jogo nunca era reconhecido
       como oficial e o ecrã de dia de jogo não abria (com ?testejogo abria,
       porque o teste não verifica isto). Agora: palavras longas, se houver;
       senão, todas as palavras do nome (2+ letras) têm de lá estar; e, em
       último caso, basta haver um jogo nosso no calendário nesse dia (numa
       competição não há dois jogos nossos no mesmo dia). */
    const adv = palavras(c.adversario);
    const advCurto = norm(c.adversario).split(/\s+/).filter(w => w.length >= 2);
    if (!c.data) return null;
    const { competitions } = normalizeStandings(dadosCompJogo && dadosCompJogo.standings);
    const daJornada = (rounds, k) => {
      const lbl = String(rounds[k].label || '').trim();
      const num = (/(\d+)/.exec(lbl) || [])[1] || (!lbl ? String(k + 1) : '');
      return { jornada: num ? `${num}.ª jornada` : lbl };
    };
    const nesseDia = (g) => g && String(g.date || '').slice(0, 10) === c.data;
    for (const comp of (competitions || [])) {
      const rounds = comp.rounds || [];
      for (let k = 0; k < rounds.length; k++) {
        const achou = (rounds[k].games || []).some(g => {
          if (!nesseDia(g)) return false;
          const lados = ` ${norm(g.home)} ${norm(g.away)} `;
          if (adv.length) return adv.some(w => lados.includes(w));
          if (advCurto.length) return advCurto.every(w => lados.includes(` ${w} `) || lados.includes(w));
          return false;
        });
        if (achou) return daJornada(rounds, k);
      }
    }
    // Último recurso: um jogo do calendário nesse dia com a nossa equipa.
    const nosso = norm((dadosConvJogo && dadosConvJogo.clube) || '').split(/\s+/).filter(w => w.length >= 4);
    for (const comp of (competitions || [])) {
      const rounds = comp.rounds || [];
      for (let k = 0; k < rounds.length; k++) {
        const achou = (rounds[k].games || []).some(g => {
          if (!nesseDia(g)) return false;
          if (!nosso.length) return true;
          const lados = `${norm(g.home)} ${norm(g.away)}`;
          return nosso.some(w => lados.includes(w));
        });
        if (achou) return daJornada(rounds, k);
      }
    }
    return null;
  };
  const jogoOficial = (c) => (c.competicao ? competitionLabel(c.competicao) !== FRIENDLY : !!jogoDoCalendario(c));
  // Já passou a hora do jogo de hoje? (sem hora, fica o dia todo)
  const jaComecou = (c) => {
    const m = /^(\d{1,2})[:h](\d{2})/.exec(String(c.horaJogo || '').trim());
    if (!m || c.data !== todayStr()) return false;
    const agora = new Date();
    return agora.getHours() * 60 + agora.getMinutes() >= Number(m[1]) * 60 + Number(m[2]);
  };
  const [missoesJogoVistas, setMissoesJogoVistas] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mjp_missoes_jogo_vistas') || '[]'); } catch (e) { return []; }
  });
  const marcarMissaoJogoVista = (id) => setMissoesJogoVistas(prev => {
    if (prev.includes(id)) return prev;
    const novo = [...prev, id].slice(-60);
    try { localStorage.setItem('mjp_missoes_jogo_vistas', JSON.stringify(novo)); } catch (e) { /* sem armazenamento: volta a aparecer, não faz mal */ }
    return novo;
  });
  /* Todas as missões de jogo de hoje/amanhã, vistas ou não. O ecrã inteiro
     (EcraJogo) só usa as ainda não vistas — aparece uma vez —, mas o
     painel LED do mister no ecrã inicial continua a anunciar o jogo o dia
     todo (até à hora do jogo), com o toque a levar à área Jogo. */
  const missoesJogoTodas = (() => {
    const hoje = todayStr();
    const amanha = addDays(hoje, 1);
    const nossoClube = (dadosConvJogo && dadosConvJogo.clube) || 'Nós';
    return ((dadosConvJogo && dadosConvJogo.convocatorias) || [])
      .filter(c => c && c.data && (c.data === hoje || c.data === amanha))
      .filter(c => jogoOficial(c) && !jaComecou(c))
      .map(c => {
        const vespera = c.data === amanha;
        const id = `jogo:${c.id}:${hoje}:${loggedPlayerId || ''}`;
        const jogo = c.casaFora === 'Fora' ? `${c.adversario} vs ${nossoClube}` : `${nossoClube} vs ${c.adversario}`;
        const quando = [c.horaJogo, c.localJogo].filter(Boolean).join(' · ');
        const conc = !vespera && (c.horaConcentracao || c.localConcentracao)
          ? `\nConcentração: ${[c.horaConcentracao, c.localConcentracao].filter(Boolean).join(' · ')}` : '';
        return {
          id, _jogo: true, destino: 'jogos', prazo: c.data, passoTxt: '',
          _info: {
            vespera, nos: nossoClube, adv: c.adversario || 'Adversário', casaFora: c.casaFora || '',
            data: c.data, hora: c.horaJogo || '', local: c.localJogo || '',
            horaConc: c.horaConcentracao || '', localConc: c.localConcentracao || '', convocado: c.convocado === true,
            jornada: (jogoDoCalendario(c) || {}).jornada || '', logo: (equipa && equipa.logo) || '',
          },
          titulo: vespera ? 'Amanhã há jogo' : 'Hoje é dia de jogo',
          acao: 'Preparar o jogo',
          notas: `${jogo}${quando ? `\n${quando}` : ''}${conc}\nVê a convocatória, o plano de jogo e o adversário.`,
        };
      });
  })();
  /* O ecrã do jogo aparece em TODAS as entradas, desde que a convocatória
     fica visível (véspera e dia do jogo) até à hora do jogo. "Bora" ou
     "Mais tarde" só o tiram da frente nesta entrada. */
  const missoesJogo = missoesJogoTodas;
  /* MODO DE TESTE do ecrã de jogo, sem esperar por um jogo a sério:
     abrir o Portal com ?testejogo=vespera ou ?testejogo=dia no fim do
     endereço. Usa a primeira convocatória que houver (ou um jogo de
     exemplo), não verifica se é oficial e não fica marcada como vista,
     por isso aparece em todas as entradas enquanto o endereço o tiver. */
  const modoTesteJogo = (() => {
    /* Lido do endereço inteiro (parte ? ou #), porque o link do Portal já
       traz um "?portal=…": o teste tem de ir com "&", mas se alguém puser
       um segundo "?" também funciona. */
    try {
      const m = /[?&#]testejogo=(vespera|véspera|dia)\b/i.exec(decodeURIComponent(window.location.href));
      return m ? (/^dia$/i.test(m[1]) ? 'dia' : 'vespera') : '';
    } catch (e) { return ''; }
  })();
  if (modoTesteJogo && !missoesJogo.length) {
    const vespera = modoTesteJogo !== 'dia';
    const c = ((dadosConvJogo && dadosConvJogo.convocatorias) || [])[0] || {};
    const hoje = todayStr();
    const daqui = new Date(Date.now() + 3 * 3600000);
    const horaEx = `${String(daqui.getHours()).padStart(2, '0')}:${String(daqui.getMinutes()).padStart(2, '0')}`;
    missoesJogo.push({
      id: `teste:jogo:${modoTesteJogo}`, _jogo: true, _teste: true, destino: 'jogos', prazo: vespera ? addDays(hoje, 1) : hoje, passoTxt: '',
      titulo: vespera ? 'Amanhã há jogo' : 'Hoje é dia de jogo', acao: 'Preparar o jogo',
      _info: {
        vespera, nos: (dadosConvJogo && dadosConvJogo.clube) || 'Nós', adv: c.adversario || 'FC Exemplo', casaFora: c.casaFora || 'Casa',
        data: vespera ? addDays(hoje, 1) : hoje, hora: c.horaJogo || horaEx, local: c.localJogo || 'Estádio de teste',
        horaConc: c.horaConcentracao || '', localConc: c.localConcentracao || '', convocado: c.convocado !== false,
        jornada: (c.adversario && c.data ? (jogoDoCalendario(c) || {}).jornada : '') || '5.ª jornada', logo: (equipa && equipa.logo) || '',
      },
    });
  }
  const [missaoAtiva, setMissaoAtiva] = useState(null); // a tarefa cujo destino está aberto
  const [missaoCumprida, setMissaoCumprida] = useState(null); // título, para o ecrã "Missão cumprida"
  /* "MAIS TARDE" = SÓ AGORA. A missão sai do ecrã nesta entrada no
     Portal; no próximo login (código), aparece outra vez — até estar
     feita. Ir à missão e voltar sem a fazer também não a reabre por cima
     nesta entrada (fica o cartão "Tens uma tarefa nova"). */
  const [missoesAdiadas, setMissoesAdiadas] = useState([]);
  const adiarMissao = (id) => setMissoesAdiadas(prev => (prev.includes(id) ? prev : [...prev, id]));
  // Aniversário: a página da festa aparece em cada entrada nesse dia.
  const [aniversarioVisto, setAniversarioVisto] = useState(false);
  // Sair e voltar a entrar (novo código) recomeça: a missão volta a aparecer.
  useEffect(() => { setMissoesAdiadas([]); setAniversarioVisto(false); }, [loggedPlayerId, code]);
  /* Missão de jogo que apareceu = vista. Grava-se já no dispositivo (para
     não voltar na próxima entrada), mas não sai do ecrã agora: o jogador
     ainda a está a ler. */
  const idsJogoNoEcra = missoesJogo.filter(m => !m._teste).map(m => m.id).join('|');
  useEffect(() => {
    if (!idsJogoNoEcra) return;
    try {
      const ja = JSON.parse(localStorage.getItem('mjp_missoes_jogo_vistas') || '[]');
      const novo = [...ja, ...idsJogoNoEcra.split('|').filter(id => !ja.includes(id))].slice(-60);
      localStorage.setItem('mjp_missoes_jogo_vistas', JSON.stringify(novo));
    } catch (e) { /* sem armazenamento: volta a aparecer, não faz mal */ }
  }, [idsJogoNoEcra]);
  // Nova entrada (outro código / outro jogador): relê o que já foi visto.
  useEffect(() => {
    try { setMissoesJogoVistas(JSON.parse(localStorage.getItem('mjp_missoes_jogo_vistas') || '[]')); } catch (e) { /* fica como está */ }
  }, [loggedPlayerId, code]);
  const missoesEmCurso = useRef(new Set());
  const notasMissaoRef = useRef({});
  // Conclui UM passo (item da missão). Recebe o item ou, por compatibilidade, a tarefa.
  const completarMissao = async (item, texto, { silencioso = false } = {}) => {
    if (!item) return;
    const it = item._tarefa ? item : (() => {
      const pend = passosDe(item).filter(p => !p.feito);
      return pend.length ? itemMissao(item, pend[0]) : null;
    })();
    if (!it || missoesEmCurso.current.has(it.id)) return;
    missoesEmCurso.current.add(it.id);
    const t = it._tarefa, p = it._passo;
    const agora = new Date();
    const quando = `${String(agora.getDate()).padStart(2, '0')}/${String(agora.getMonth() + 1).padStart(2, '0')} ${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
    const acao = texto || destinoMissao(p.destino).acao;
    const linha = p.total > 1 ? `✓ Passo ${p.ordem + 1} · ${acao} — feito na app (${quando})` : `✓ ${acao} — feito na app (${quando})`;
    /* A nota mais recente desta tarefa (também a de um passo acabado de
       fechar nesta mesma ronda, que o estado ainda não mostra). */
    const notaAntes = String(notasMissaoRef.current[t.id] || (tarefasAjustes[t.id] && tarefasAjustes[t.id].notaAtleta) || t.notaAtleta || '').trim();
    const nota = notaAntes ? `${notaAntes}\n${linha}` : linha;
    const restantes = passosDe({ ...t, notaAtleta: nota }).filter(x => !x.feito);
    const submeter = p.total === 1 || restantes.length === 0;
    try {
      const { data, error } = await supabase.rpc('checkin_tarefa_nota', {
        p_code: code, p_team: teamId, p_tarefa_id: t.id, p_nota: nota, p_submeter: submeter,
      });
      if (error || !(data && data.ok)) throw (error || new Error('recusado'));
      notasMissaoRef.current[t.id] = nota;
      setTarefasAjustes(prev => ({ ...prev, [t.id]: { ...prev[t.id], notaAtleta: nota, ...(submeter ? { notaSubmetida: true } : {}) } }));
      setMissaoAtiva(m => (m && m.id === it.id ? null : m));
      if (!silencioso) setMissaoCumprida(submeter
        ? (t.titulo || 'Missão')
        : `${t.titulo || 'Missão'} — passo ${p.ordem + 1} feito. ${restantes.length === 1 ? 'Falta 1 passo.' : `Faltam ${restantes.length} passos.`}`);
      return true;
    } catch (e) {
      missoesEmCurso.current.delete(it.id);
      return false;
    }
  };
  /* CLIPE CRIADO: a missão "Criar um clipe" só fecha quando o clipe fica
     mesmo gravado no servidor. Não há "Já fiz" para carregar. */
  /* Cada clipe fecha UMA missão, e a do jogo certo: se o mister pediu um
     clipe do jogo X, só um clipe feito num vídeo do jogo X a fecha. As
     missões sem jogo escolhido aceitam um clipe de qualquer jogo. Antes,
     dois clipes do mesmo jogo fechavam as duas missões (Lavrense e
     Paredes), mesmo sem nenhum clipe do outro jogo. */
  const clipeCriado = (titulo, jogoId) => {
    const pendentes = missoesPorFazer.filter(x => x.destino === 'clipe');
    const jogoDe = (x) => (x._passo && x._passo.jogoId) || null;
    const it = (jogoId && pendentes.find(x => jogoDe(x) === jogoId)) || pendentes.find(x => !jogoDe(x));
    if (it) completarMissao(it, `Clipe criado: ${titulo}`);
  };
  /* AUTOAVALIAÇÃO SUBMETIDA = FEITA, DE UMA VEZ. Uma submissão fecha TODAS
     as missões de autoavaliação por fazer (a mesma tarefa pode ter mais de
     um passo de autoavaliação, ou haver duas tarefas para o mesmo
     momento). Antes fechava só uma: a outra voltava logo ao ecrã e, no
     login seguinte, aparecia outra vez "Autoavaliação submetida".
     Saem já do ecrã (não piscam enquanto o servidor responde) e há um só
     "Missão cumprida". `silencioso`: ao entrar na app, sem festa. */
  const autoavaliacaoSubmetida = async ({ silencioso = false } = {}) => {
    esquecerCacheCacifo('dev', teamId, code);
    const its = missoesPorFazer.filter(x => x.destino === 'autoavaliacao');
    if (!its.length) return;
    its.forEach(x => adiarMissao(x.id));
    let algum = false;
    for (const it of its) {
      // eslint-disable-next-line no-await-in-loop
      if (await completarMissao(it, 'Autoavaliação submetida', { silencioso: true })) algum = true;
    }
    if (algum && !silencioso) setMissaoCumprida((its[0]._tarefa && its[0]._tarefa.titulo) || 'Autoavaliação submetida');
  };
  /* Missões de autoavaliação que ficaram por fechar de antes (a
     autoavaliação já está submetida): fecham-se em silêncio assim que as
     tarefas chegam. Antes só se verificava uma vez ao abrir, muitas vezes
     ANTES de as tarefas chegarem, e a missão ficava. */
  const idsMissoesAuto = missoesPorFazer.filter(x => x.destino === 'autoavaliacao').map(x => x.id).join('|');
  useEffect(() => {
    if (!idsMissoesAuto || !code || !teamId) return undefined;
    let cancelado = false;
    submeterAutoavaliacaoSeCompleta(code, teamId)
      .then(ok => { if (!cancelado && ok && autoavaliacaoSubmetidaRef.current) autoavaliacaoSubmetidaRef.current({ silencioso: true }); });
    return () => { cancelado = true; };
  }, [idsMissoesAuto, code, teamId]);
  autoavaliacaoSubmetidaRef.current = autoavaliacaoSubmetida;
  useEffect(() => {
    if (!missaoCumprida) return undefined;
    const h = setTimeout(() => setMissaoCumprida(null), 2600);
    return () => clearTimeout(h);
  }, [missaoCumprida]);

  // Sequência do cartão da chama, calculada no servidor (a mesma regra
  // da tarefa da sequência (META_SEQUENCIA dias): autónomo, com o mesmo
  // reinício) — ver o comentário grande junto de `checkin_sequencia_wellness_pse.sql`.
  const [, dadosSequencia] = usePortalFetch('checkin_sequencia_wellness_pse', code, teamId);
  const diasSequenciaChama = (dadosSequencia && dadosSequencia.dias) || 0;

  /* FOTOGRAFIA DO PLANTEL para o cacifo do ecrã inicial. Se a
     `checkin_bootstrap` já a trouxer em `player.photo`, usa-se essa; se
     não, pede-se à parte à `checkin_foto` (ver checkin_foto.sql). Sem a
     função (SQL por correr) ou sem fotografia, o cacifo mostra as
     iniciais — nada parte. */
  const [fotoPlantel, setFotoPlantel] = useState(null);
  const temFotoNoBootstrap = !!(player && player.photo);
  useEffect(() => {
    setFotoPlantel(null);
    if (!code || !teamId || temFotoNoBootstrap) return undefined;
    let cancelado = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('checkin_foto', { p_code: code, p_team: teamId });
        if (cancelado || error) return;
        let d = Array.isArray(data) ? data[0] : data;
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
        if (d && typeof d.photo === 'string' && d.photo) setFotoPlantel(d.photo);
      } catch (e) { /* sem a função: fica com as iniciais */ }
    })();
    return () => { cancelado = true; };
  }, [code, teamId, temFotoNoBootstrap]);

  // Relógio interno: as janelas horárias abrem/fecham sozinhas sem o atleta
  // ter de recarregar a página (ex.: está no ecrã às 12:59 e às 13:00 o
  // Wellness fecha e o PSE passa a estar disponível às 13:10).
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 20000);
    return () => clearInterval(t);
  }, []);

  // Se o dia virar com o ecrã aberto, volta automaticamente para hoje.
  useEffect(() => {
    const today = todayStr();
    if (selectedDate !== today && !CHECKIN_ALLOW_BACKFILL) setSelectedDate(today);
  }, [nowTick]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Cinto de segurança: sem jogador não há nada a mostrar, mas também não
     se deixa a página em branco.

     Fica AQUI, depois de todos os hooks, e não no topo da função: uma
     saída antecipada antes dos hooks faz o número de hooks variar entre
     renderizações, e o React rebenta com isso — trocaríamos um ecrã
     branco por outro. */
  if (!loggedPlayerId) {
    // Mostra-se o que chegou, em vez de só dizer que falhou: sem isto, um
    // erro que só acontece no telemóvel de outra pessoa é indiagnosticável.
    const detalhe = (() => {
      try {
        return JSON.stringify({
          build: APP_BUILD,
          player,
          nMonitoring: Array.isArray(monitoring) ? monitoring.length : typeof monitoring,
          nSessions: Array.isArray(sessions) ? sessions.length : typeof sessions,
          ...(diagnostico || {}),
        }, null, 1).slice(0, 600);
      } catch (e) { return `build ${APP_BUILD} · não foi possível ler os dados`; }
    })();
    return (
      <div style={{ maxWidth: 460, margin: '0 auto', padding: '50px 20px', textAlign: 'center' }}>
        <div style={{ ...display, fontSize: 19, color: T.cream, marginBottom: 8 }}>Não foi possível abrir</div>
        <div style={{ fontSize: 13.5, color: T.mutedDim, marginBottom: 16 }}>
          Os teus dados não chegaram completos. Tenta outra vez ou fala com o staff.
        </div>
        <pre style={{
          background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, padding: 10,
          fontSize: 10.5, color: T.muted, textAlign: 'left', whiteSpace: 'pre-wrap',
          wordBreak: 'break-word', maxHeight: 220, overflow: 'auto', ...mono,
        }}>{detalhe}</pre>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
          <Btn onClick={() => { try { navigator.clipboard.writeText(detalhe); } catch (e) { /* seleciona à mão */ } }}>Copiar</Btn>
          <Btn variant="ghost" onClick={onLogout}>Voltar</Btn>
        </div>
      </div>
    );
  }

  const now = new Date(nowTick);
  const wellnessWindow = checkinWindowState('wellness', selectedDate, now);
  const rpeWindow = checkinWindowState('rpe', selectedDate, now);

  const sessionForDate = sessions.find(s => s.date === selectedDate);

  const hasDate = (type, date) => monitoring.some(m => m.playerId === loggedPlayerId && m.date === date &&
    (type === 'wellness' ? typeof m.sono === 'number' : typeof m.pse === 'number'));

  const recentDates = Array.from({ length: CHECKIN_DAYS_BACK + 1 }, (_, i) => addDays(todayStr(), -(CHECKIN_DAYS_BACK - i)));
  const dayStatus = {};
  recentDates.forEach(d => { dayStatus[d] = { wellness: hasDate('wellness', d), rpe: hasDate('rpe', d) }; });

  // A gravação vai ao servidor: é lá que se verifica de quem é o registo
  // e se o dia está dentro da janela permitida.
  const upsert = (type, fields) => onSave(type, fields, selectedDate);

  /* BARRA DA MISSÃO — por baixo do sítio para onde a missão levou o
     jogador: nas que fecham sozinhas lembra que basta submeter; nas
     outras tem o "Já fiz". */
  const comBarraMissao = (vista) => {
    const m = missaoAtiva;
    // Nas que fecham sozinhas (questionários) não há barra: tapava os
    // botões do próprio questionário, e basta submeter.
    if (!m || m.destino !== 'clipe') return vista;
    const d = destinoMissao(m.destino);
    return (
      <>
        {vista}
        <div style={{
          position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 65, maxWidth: 640, margin: '0 auto',
          background: T.surfaceRaise, border: `1px solid ${T.gold}`, borderRadius: 12, padding: '10px 12px',
          display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.45)', ...body,
        }}>
          <Flame size={18} color={T.warn} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, color: T.warn, textTransform: 'uppercase', letterSpacing: '.08em' }}>Missão</div>
            <div style={{ fontSize: 13, color: T.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.titulo}</div>
          </div>
          <span style={{ fontSize: 11.5, color: T.mutedDim, textAlign: 'right' }}>Fecha sozinha<br />{m.destino === 'clipe' ? 'quando gravares o clipe' : 'quando submeteres'}</span>
          <button type="button" onClick={() => setMissaoAtiva(null)} title="Esconder" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 4 }}><X size={15} /></button>
        </div>
      </>
    );
  };

  const irParaMissao = (alvo) => {
    // Missão automática de véspera / dia de jogo: marca como vista e vai.
    if (alvo && alvo._jogo) {
      marcarMissaoJogoVista(alvo.id);
      adiarMissao(alvo.id); // nesta entrada já não volta a abrir por cima
      setActiveType('jogos');
      return;
    }
    // Pode vir um passo (da prancheta) ou uma tarefa (cartão/lista): na
    // tarefa, vai-se ao primeiro passo por fazer.
    const t = alvo && alvo._tarefa ? alvo : (() => {
      const tt = comDestino(alvo);
      const pend = passosDe(tt).filter(p => !p.feito);
      return pend.length ? itemMissao(tt, pend[0]) : itemMissao(tt, passosDe(tt)[0]);
    })();
    const d = destinoMissao(t.destino);
    if (!t.destino || t.destino === 'nota' || !d.rota) { setTarefaParaAbrir(t._tarefa.id); setActiveType('tarefas'); return; }
    adiarMissao(t.id); // ao voltar, não reabre por cima nesta entrada — fica o cartão
    if (!d.auto) {
      // Leitura: chegar lá É a missão. Fica registado "Abriu …", sem festa.
      completarMissao(t, `Abriu: ${d.rotulo}`, { silencioso: true });
    } else {
      setMissaoAtiva(t);
    }
    setActiveType(d.rota);
  };
  // Missões e mensagens abertas a partir do ecrã inicial voltam ao ecrã inicial.
  const irParaMissaoDoInicio = (alvo) => { setOrigem(null); setDeTarefas(false); irParaMissao(alvo); };
  if (activeType === 'wellness') {
    const existing = monitoring.find(m => m.playerId === loggedPlayerId && m.date === selectedDate && typeof m.sono === 'number');
    const lastWellness = existing || monitoring
      .filter(m => m.playerId === loggedPlayerId && typeof m.sono === 'number')
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    return comBarraMissao(
      <WellnessWizard
        player={player} initial={lastWellness} date={selectedDate}
        onBack={voltar}
        onSubmit={fields => upsert('wellness', fields)}
      />
    );
  }

  if (activeType === 'rpe') {
    return comBarraMissao(
      <RpeWizard
        player={player} session={sessionForDate} date={selectedDate}
        /* O quiosque não conhece a lista de Jogos (ver checkin_rpc.sql:
           só recebe as sessões). A fase "Jogo" na sessão é o que permite
           ao atleta responder ao PSE do jogo em vez do de treino. */
        contexto={sessionForDate && sessionForDate.phase === 'Jogo' ? 'jogo' : 'treino'}
        onBack={voltar}
        onSubmit={fields => upsert('rpe', fields)}
      />
    );
  }

  if (activeType === 'ideiaJogo') {
    return comBarraMissao(<PlayerIdeiaJogoView code={code} teamId={teamId} onBack={voltar} fecharVolta={deTarefas} />);
  }

  if (activeType === 'treino') {
    return comBarraMissao(<PlayerTreinoView code={code} teamId={teamId} onBack={voltar} />);
  }

  if (activeType === 'biblioteca') {
    return comBarraMissao(<PlayerBibliotecaView code={code} teamId={teamId} onBack={voltar} onClipeCriado={clipeCriado} />);
  }

  if (activeType === 'jogos') {
    return comBarraMissao(<PlayerJogosHome code={code} teamId={teamId} onBack={voltar} jogadorId={loggedPlayerId} logo={(equipa && equipa.logo) || ''} infoJogo={jogoDoCalendario} />);
  }

  if (activeType === 'competicao') {
    return <PlayerCompeticaoView code={code} teamId={teamId} foco={focoArea} onBack={() => { setFocoArea(null); voltar(); }} />;
  }

  if (activeType === 'desenvolvimento') {
    return comBarraMissao(<PlayerDesenvolvimentoView code={code} teamId={teamId} onBack={voltar} onSubmetido={autoavaliacaoSubmetida} />);
  }

  if (activeType === 'tarefas') {
    return (
      <PlayerTarefasView
        code={code} teamId={teamId} onBack={voltar}
        tarefas={listaTarefas.map(comDestino)} estado={estadoTarefas}
        onIrMissao={(alvo) => { setDeTarefas(true); irParaMissao(alvo); }}
        tarefaAbrirId={tarefaParaAbrir} onTarefaAberta={() => setTarefaParaAbrir(null)}
        onNotaGravada={(id, patch) => setTarefasAjustes(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))}
      />
    );
  }

  if (activeType === 'portal') {
    return (
      <PlayerCacifo
        player={fotoPlantel ? { ...player, photo: fotoPlantel } : player}
        equipa={equipa} code={code} teamId={teamId}
        animar={!cacifoAberto} onAberto={() => setCacifoAberto(true)}
        onBack={() => { setVoltouCacifo(true); setActiveType(null); }}
        onAbrir={(id, foco) => { setCacifoAberto(true); setOrigem('portal'); setDeTarefas(false); setFocoArea(foco || null); setActiveType(id); }}
        onAbrirWellness={() => { if (wellnessWindow.open) { setCacifoAberto(true); setOrigem('portal'); setActiveType('wellness'); } }}
        onAbrirRpe={() => { if (rpeWindow.open) { setCacifoAberto(true); setOrigem('portal'); setActiveType('rpe'); } }}
        dadosConv={dadosConvJogo} dadosComp={dadosCompJogo}
        missoes={missoesPorFazer} nTarefas={tarefasPorFazer.length}
        session={sessionForDate}
        doneWellness={hasDate('wellness', selectedDate)} doneRpe={hasDate('rpe', selectedDate)}
        wellnessWindow={wellnessWindow} rpeWindow={rpeWindow}
      />
    );
  }

  /* MISSÃO EM ECRÃ INTEIRO — ao entrar, a primeira coisa que o jogador
     vê é a tarefa por fazer, com um botão para o sítio certo. "Mais
     tarde" esconde-a até ao dia seguinte (fica o cartão no ecrã inicial). */
  // A missão de jogo vem primeiro: é a que tem hora marcada.
  const missoesParaMostrar = [...missoesJogo, ...missoesPorFazer]
    .filter(t => !missoesAdiadas.includes(t.id) && !(t._tarefa && missoesAdiadas.includes(t._tarefa.id)));
  const jogoNoEcra = missoesParaMostrar.find(t => t._jogo);
  const tarefasNoEcra = missoesParaMostrar.filter(t => !t._jogo);
  const ecraMissao = jogoNoEcra ? (
    <EcraJogo player={player} missao={jogoNoEcra} onIr={irParaMissaoDoInicio} onAdiar={adiarMissao} />
  ) : tarefasNoEcra.length > 0 ? (
    <EcraMissao
      player={player}
      tarefas={tarefasNoEcra}
      janelas={{ wellness: wellnessWindow, rpe: rpeWindow }}
      onIr={irParaMissaoDoInicio}
      onAdiar={adiarMissao}
    />
  ) : null;
  const toastCumprida = missaoCumprida ? (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80, background: T.veuMissao, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 10, ...body, padding: 24, textAlign: 'center',
    }} onClick={() => setMissaoCumprida(null)}>
      <div style={{ width: 74, height: 74, borderRadius: '50%', background: `${T.good}33`, border: `2px solid ${T.good}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Check size={40} color={T.good} />
      </div>
      <div style={{ ...display, fontSize: 26, color: T.cream }}>Missão cumprida</div>
      <div style={{ fontSize: 14, color: T.muted, maxWidth: 360 }}>{missaoCumprida}</div>
    </div>
  ) : null;

  /* Enquanto as tarefas ainda estão a chegar, não se mostra o ecrã
     inicial (senão aparecia primeiro a página e só depois a missão, aos
     saltos): fica um ecrã de entrada limpo, e a seguir entra-se logo no
     que interessa — a missão, se houver, ou o ecrã inicial. */
  /* Também se espera pela convocatória e pela competição: é delas que vem a
     mensagem do Mister sobre o jogo, e a caixa do Mister só existe quando
     há mensagem — se chegasse depois, o balneário saltava para baixo. */
  if (estadoTarefas === 'a-carregar' || estadoConvJogo === 'a-carregar' || estadoCompJogo === 'a-carregar') {
    if (entradaRecente()) return <PortaAEspera />;
    return (
      <div style={{ position: 'fixed', inset: 0, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, ...body }}>
        <Loader2 size={26} className="animate-spin" color={T.warn} />
        <div style={{ fontSize: 13, color: T.mutedDim }}>A entrar…</div>
      </div>
    );
  }

  // DIA DE ANOS: antes de tudo (até da missão), a página da festa.
  if (player && isBirthdayToday(player.birthdate) && !aniversarioVisto) {
    return <TransicaoEntrada focoInteiro><EcraAniversario player={player} onEntrar={() => setAniversarioVisto(true)} /></TransicaoEntrada>;
  }

  /* PAINEL LED DO MISTER (ecrã inicial) — a voz do mister, por ordem:
     1) véspera / dia de jogo → leva à área Jogo do Portal (convocatória,
        plano de jogo, adversário). Usa as mesmas regras da missão de jogo
        (só jogos oficiais, desaparece à hora do jogo), mas fica o dia todo,
        mesmo depois de o ecrã inteiro já ter sido visto;
     2) cada missão por fazer (passo a passo) → irParaMissao, o mesmo
        caminho da prancheta e de Tarefas;
     3) dia de anos → os parabéns da equipa técnica (sem toque);
     4) nada disto → "Sem missões pendentes · Bom treino" (sem toque). */
  const jogoNoPainel = missoesJogoTodas[0] || missoesJogo.find(m => m._teste) || null;
  const mensagensMister = [];
  // Ordem: o aniversário primeiro, depois o jogo, depois as tarefas.
  if (player && isBirthdayToday(player.birthdate)) {
    // Sem o nome: já aparece no cumprimento por cima.
    mensagensMister.push({ tipo: 'festa', texto: 'Parabéns! Toda a equipa técnica deseja-te um ótimo dia.' });
  }
  if (jogoNoPainel) {
    const i = jogoNoPainel._info || {};
    // Curta, na voz do Mister: quando, contra quem e um empurrão.
    mensagensMister.push({
      tipo: 'jogo',
      texto: `${i.vespera ? 'Amanhã' : 'Hoje'} há jogo${i.adv ? ` vs ${i.adv}` : ''}. ${i.vespera ? 'Prepara-te!' : 'Foco total!'}`,
      onTocar: () => { if (!jogoNoPainel._teste) marcarMissaoJogoVista(jogoNoPainel.id); setOrigem(null); setActiveType('jogos'); },
    });
  }
  missoesPorFazer.forEach(it => {
    mensagensMister.push({
      tipo: 'missao',
      texto: `${it.titulo || 'Missão'}${it.passoTxt ? ` (${it.passoTxt})` : ''} ▸ Toca para começar`,
      onTocar: () => irParaMissaoDoInicio(it),
    });
  });
  if (!jogoNoPainel && !missoesPorFazer.length) {
    mensagensMister.push({ tipo: 'nada', texto: 'Sem missões pendentes · Bom treino' });
  }

  return (
    <TransicaoEntrada focoInteiro={!!ecraMissao}>
    {voltouCacifo && <style>{'@keyframes mjp-voltar { from { opacity: 0; } to { opacity: 1; } }'}</style>}
    <div style={voltouCacifo ? { animation: 'mjp-voltar .32s ease-out both' } : undefined}>
    {ecraMissao}
    {toastCumprida}
    <PlayerKioskHome
      player={fotoPlantel ? { ...player, photo: fotoPlantel } : player}
      equipa={equipa}
      session={sessionForDate}
      selectedDate={selectedDate}
      doneWellness={hasDate('wellness', selectedDate)} doneRpe={hasDate('rpe', selectedDate)}
      wellnessWindow={wellnessWindow} rpeWindow={rpeWindow}
      onOpenWellness={() => { if (wellnessWindow.open) { setOrigem(null); setActiveType('wellness'); } }}
      onOpenRpe={() => { if (rpeWindow.open) { setOrigem(null); setActiveType('rpe'); } }}
      onOpenPortal={() => setActiveType('portal')}
      onLogout={onLogout}
      tarefasPendentes={tarefasPorFazer}
      mensagensMister={mensagensMister}
      diasSequenciaChama={diasSequenciaChama}
    />
    </div>
    </TransicaoEntrada>
  );
}

/* ===================================================================
   DIA DE ANOS — "A CAMISOLA DOS ANOS" + "O GOLO DOS PARABÉNS"
   ===================================================================
   No dia de anos, ao entrar no Portal, o jogador não vê o menu: vê uma
   página só dele.
   · A CAMISOLA: uma camisola do clube, vista de costas, entra a rodar —
     com o nome dele em cima e, no lugar do número, a IDADE que faz hoje.
   · O GOLO: por baixo, uma baliza e uma bola. "Remata para celebrar":
     um toque na bola e ela vai ao fundo das redes — a rede abana, o
     telemóvel vibra, aparece "GOLO!" e rebenta uma chuva de papelinhos
     nas cores do clube. Só depois aparece o "Entrar no Portal".
   · A mensagem da equipa técnica.
   Aparece em cada entrada nesse dia (como a missão), e por cima de tudo. */
// Cores da camisola a partir da cor do clube (T.corEquipa): tecido com
// um degradê da própria cor, e números/nome em branco — ou em escuro,
// quando o clube veste uma cor clara (branco, amarelo…).
function coresCamisola(hex) {
  const h = String(hex || '#B5393F').replace('#', '');
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  const misturar = (f) => `#${[r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v * f)))).map(v => v.toString(16).padStart(2, '0')).join('')}`;
  const luz = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const clara = luz > 0.62;
  return {
    claro: misturar(1.15), base: `#${n}`, escuro: misturar(0.62), contorno: misturar(0.45),
    texto: clara ? '#1B1B1B' : '#FFFFFF', mangas: clara ? misturar(0.55) : '#FFFFFF',
  };
}
// Em claro, o branco e o creme não se viam no fundo claro: trocam por verde e dourado-escuro.
const CORES_FESTA = TEMA_ATUAL === 'claro'
  ? ['#C8102E', '#2E7D4A', '#C9A227', '#E84A5F', '#8A6A0E']
  : ['#C8102E', '#FFFFFF', '#C9A227', '#E84A5F', '#F3E3A0'];

/* Bola de futebol "a sério" (o padrão clássico de pentágonos pretos e
   hexágonos brancos), com sombra para parecer redonda. */
function BolaFutebol({ tamanho = 46 }) {
  const c = 50, R = 46;
  const poli = (cx, cy, r, rot) => Array.from({ length: 5 }, (_, k) => {
    const a = rot + (k * 2 * Math.PI) / 5;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  const centro = poli(c, c, 14, -Math.PI / 2);
  const fora = Array.from({ length: 5 }, (_, k) => {
    const a = -Math.PI / 2 + Math.PI / 5 + (k * 2 * Math.PI) / 5;
    return poli(c + 41 * Math.cos(a), c + 41 * Math.sin(a), 13, a + Math.PI);
  });
  const txt = (pts) => pts.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ');
  return (
    <svg viewBox="0 0 100 100" width={tamanho} height={tamanho}>
      <defs>
        <radialGradient id="bola-luz" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#FFFFFF" /><stop offset=".55" stopColor="#ECECEC" /><stop offset="1" stopColor="#9C9C9C" />
        </radialGradient>
        <radialGradient id="bola-sombra" cx="50%" cy="50%" r="50%">
          <stop offset=".72" stopColor="rgba(0,0,0,0)" /><stop offset="1" stopColor="rgba(0,0,0,.38)" />
        </radialGradient>
        <clipPath id="bola-corte"><circle cx={c} cy={c} r={R} /></clipPath>
      </defs>
      <circle cx={c} cy={c} r={R} fill="url(#bola-luz)" />
      <g clipPath="url(#bola-corte)">
        {/* COSTURAS dos hexágonos brancos:
            · entre cada dois pentágonos de fora, os cantos mais próximos ligam-se;
            · do meio dessa ligação, uma costura até ao canto do pentágono central;
            · dos cantos de fora de cada pentágono, costuras para a borda da bola. */}
        {fora.map((A, k) => {
          const B = fora[(k + 1) % 5];
          let melhor = null;
          A.forEach(pa => B.forEach(pb => {
            const d = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
            if (!melhor || d < melhor.d) melhor = { d, pa, pb };
          }));
          const meio = [(melhor.pa[0] + melhor.pb[0]) / 2, (melhor.pa[1] + melhor.pb[1]) / 2];
          // canto do pentágono central virado para este par
          const ang = Math.atan2(meio[1] - c, meio[0] - c);
          let canto = centro[0], dm = Infinity;
          centro.forEach(q => { const dd = Math.abs(Math.atan2(Math.sin(Math.atan2(q[1] - c, q[0] - c) - ang), Math.cos(Math.atan2(q[1] - c, q[0] - c) - ang))); if (dd < dm) { dm = dd; canto = q; } });
          return (
            <g key={`c${k}`} stroke="#3A3A3A" strokeWidth="1.6" strokeLinecap="round">
              <line x1={melhor.pa[0]} y1={melhor.pa[1]} x2={melhor.pb[0]} y2={melhor.pb[1]} />
              <line x1={canto[0]} y1={canto[1]} x2={meio[0]} y2={meio[1]} />
            </g>
          );
        })}
        {fora.map((A, k) => {
          // os dois cantos mais afastados do centro seguem para a borda
          const ordenados = [...A].sort((p1, p2) => Math.hypot(p2[0] - c, p2[1] - c) - Math.hypot(p1[0] - c, p1[1] - c)).slice(0, 2);
          return ordenados.map((q, j) => {
            const a2 = Math.atan2(q[1] - c, q[0] - c);
            return <line key={`b${k}${j}`} x1={q[0]} y1={q[1]} x2={c + (R + 6) * Math.cos(a2)} y2={c + (R + 6) * Math.sin(a2)} stroke="#3A3A3A" strokeWidth="1.6" />;
          });
        })}
        <polygon points={txt(centro)} fill="#151515" stroke="#151515" strokeWidth="1.5" strokeLinejoin="round" />
        {fora.map((pts, k) => <polygon key={`p${k}`} points={txt(pts)} fill="#151515" stroke="#151515" strokeWidth="1.5" strokeLinejoin="round" />)}
      </g>
      <circle cx={c} cy={c} r={R} fill="url(#bola-sombra)" />
      <circle cx={c} cy={c} r={R} fill="none" stroke="#2A2A2A" strokeWidth="1.5" />
      <ellipse cx="36" cy="28" rx="12" ry="7" fill="#FFFFFF" opacity=".55" transform="rotate(-25 36 28)" />
    </svg>
  );
}
function EcraAniversario({ player, onEntrar }) {
  const [golo, setGolo] = useState(false);
  /* PÁGINA FIXA: nada desliza ao tocar. Em vez de deslizar nos ecrãs
     baixos, o conteúdo encolhe o necessário para caber inteiro. */
  const festaFora = useRef(null), festaDentro = useRef(null);
  const [festaEscala, setFestaEscala] = useState(1);
  React.useLayoutEffect(() => {
    const fora = festaFora.current, dentro = festaDentro.current;
    if (!fora || !dentro) return undefined;
    const medir = () => {
      const h = fora.clientHeight, c = dentro.scrollHeight;
      const e = c > h && c > 0 ? Math.max(0.55, h / c) : 1;
      setFestaEscala(prev => (Math.abs(prev - e) < 0.005 ? prev : e));
    };
    medir();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(medir); ro.observe(fora); ro.observe(dentro);
    return () => ro.disconnect();
  }, []);
  const nome = String(player.name || '').trim();
  const primeiro = nome.split(/\s+/)[0] || 'Campeão';
  // Nas costas da camisola, o MESMO nome da mensagem ("Parabéns, Telmo!").
  const apelido = primeiro.toUpperCase();
  const idade = age(player.birthdate);
  /* GUARDA-REDES: em vez de marcar, DEFENDE. A camisola é de guarda-redes
     (outra cor, como em campo) e o jogo é ao contrário: as luvas estão na
     baliza, o remate vai ao ângulo e um toque nas luvas faz a defesa —
     "DEFESA!" em vez de "GOLO!". */
  const eGR = String(player.position || '').toUpperCase() === 'GR';
  const corGR = (() => {
    // verde de guarda-redes; se o clube já for verde, laranja
    const h = String(T.corEquipa || '').replace('#', '');
    const r = parseInt(h.slice(0, 2), 16) || 0, g = parseInt(h.slice(2, 4), 16) || 0, b = parseInt(h.slice(4, 6), 16) || 0;
    return g > r && g > b ? '#E8833A' : '#2FA866';
  })();
  const cc = coresCamisola(eGR ? corGR : T.corEquipa);
  const papelinhos = React.useMemo(() => Array.from({ length: 46 }, (_, k) => ({
    k, left: Math.random() * 100, atraso: Math.random() * 5, dur: 4 + Math.random() * 4,
    cor: CORES_FESTA[k % CORES_FESTA.length], larg: 6 + Math.random() * 6, rot: Math.random() * 360,
  })), []);
  const explosao = React.useMemo(() => Array.from({ length: 60 }, (_, k) => {
    const ang = (Math.PI * 2 * k) / 60 + Math.random() * 0.3;
    const dist = 120 + Math.random() * 170;
    return { k, dx: Math.cos(ang) * dist, dy: Math.sin(ang) * dist - 60, cor: CORES_FESTA[k % CORES_FESTA.length], rot: Math.random() * 720 };
  }), []);
  const rematar = () => {
    if (golo) return;
    setGolo(true);
    try { if (navigator.vibrate) navigator.vibrate([60, 40, 120]); } catch (e) { /* sem vibração */ }
  };
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 90, overflow: 'hidden', overscrollBehavior: 'none', touchAction: 'manipulation', ...body,
      background: `radial-gradient(circle at 50% 0%, ${cc.contorno} 0%, ${T.bg} 70%)`,
    }} ref={festaFora}>
      <style>{`
        html, body { overflow: hidden !important; overscroll-behavior: none; }
        html { scrollbar-gutter: auto !important; }
        @keyframes festa-cair { 0% { transform: translateY(-10vh) rotate(0deg); } 100% { transform: translateY(110vh) rotate(720deg); } }
        @keyframes festa-camisola { 0% { transform: perspective(700px) rotateY(-180deg) scale(.6); opacity: 0; } 60% { opacity: 1; } 100% { transform: perspective(700px) rotateY(0deg) scale(1); opacity: 1; } }
        @keyframes festa-flutuar { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes festa-remate { 0% { transform: translate(0,0) scale(1) rotate(0); } 100% { transform: translate(94px,-146px) scale(.42) rotate(540deg); } }
        @keyframes festa-rede { 0%,100% { transform: scaleY(1); } 30% { transform: scaleY(1.08) translateY(-3px); } 60% { transform: scaleY(.96); } }
        @keyframes festa-golo { 0% { transform: scale(.3); opacity: 0; } 60% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes festa-explode { 0% { transform: translate(0,0) rotate(0); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; } }
        @keyframes festa-pulsar { 0%,100% { box-shadow: 0 0 0 0 rgba(255,255,255,.45); } 50% { box-shadow: 0 0 0 12px rgba(255,255,255,0); } }
        @keyframes festa-entrar { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: none; } }
        @keyframes festa-voo { 0% { transform: translate(0,0) rotate(0); } 100% { transform: translate(80px,-38px) rotate(-24deg) scale(.88); } }
        /* o remate vai ao ângulo, bate nas luvas e sai PARA FORA da baliza */
        @keyframes festa-remate-gr {
          0% { transform: translate(0,0) scale(1) rotate(0); }
          55% { transform: translate(80px,-134px) scale(.5) rotate(300deg); }
          100% { transform: translate(168px,-92px) scale(.42) rotate(520deg); opacity: .9; }
        }
        @keyframes festa-luvas-espera { 0%,100% { transform: translateX(-6px); } 50% { transform: translateX(6px); } }
      `}</style>
      {/* chuva de papelinhos, sempre */}
      {papelinhos.map(c => (
        <span key={c.k} data-festa-papel="" style={{
          position: 'fixed', top: 0, left: `${c.left}%`, width: c.larg, height: c.larg * 0.45, background: c.cor, borderRadius: 1,
          opacity: 0.85, transform: `rotate(${c.rot}deg)`, animation: `festa-cair ${c.dur}s linear ${c.atraso}s infinite both`, pointerEvents: 'none',
        }} />
      ))}
      {/* Centrado na vertical: em ecrãs altos (iPad ao alto) o conteúdo
          ficava todo em cima, com metade do ecrã vazia por baixo. Em ecrãs
          baixos continua a começar em cima e a deslizar, como antes. */}
      <div ref={festaDentro} style={{
        position: 'relative', maxWidth: 420, minHeight: festaEscala < 1 ? 0 : '100%', boxSizing: 'border-box', margin: '0 auto',
        padding: 'calc(30px + env(safe-area-inset-top, 0px)) 20px calc(40px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 10,
        transform: festaEscala < 1 ? `scale(${festaEscala})` : undefined, transformOrigin: 'top center',
      }}>
        <div style={{ fontSize: 11, color: T.gold, letterSpacing: '.24em', textTransform: 'uppercase' }}>Hoje é dia de festa</div>
        {/* A CAMISOLA DOS ANOS */}
        {/* data-entrada-anima: a camisola entra enquanto a porta abre (é uma
            animação leve), em vez de deixar um buraco vazio até ao fim. */}
        <div data-entrada-anima="" style={{ animation: 'festa-camisola 1.4s cubic-bezier(.2,.8,.2,1) both' }}>
          <div style={{ animation: 'festa-flutuar 3s ease-in-out 1.4s infinite' }}>
            <svg viewBox="0 0 200 210" width="210" height="220" aria-label={`Camisola ${apelido} ${idade ?? ''}`}>
              <defs>
                <linearGradient id="festa-tecido" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor={cc.claro} /><stop offset=".55" stopColor={cc.base} /><stop offset="1" stopColor={cc.escuro} />
                </linearGradient>
              </defs>
              <path d="M60 18 L82 8 Q100 20 118 8 L140 18 L190 48 L172 86 L150 74 L150 200 L50 200 L50 74 L28 86 L10 48 Z"
                fill="url(#festa-tecido)" stroke={cc.contorno} strokeWidth="2" />
              <path d="M10 48 L28 86 L50 74 L50 60 Z M190 48 L172 86 L150 74 L150 60 Z" fill={cc.mangas} opacity=".92" />
              <path d="M82 8 Q100 22 118 8" fill="none" stroke={cc.mangas} strokeWidth="5" />
              <text x="100" y="62" textAnchor="middle" fill={cc.texto} fontSize={apelido.length > 9 ? 13 : 17} fontWeight="800"
                style={{ fontFamily: "'Oswald', 'Inter', sans-serif", letterSpacing: '2px' }}>{apelido}</text>
              <text x="100" y="158" textAnchor="middle" fill={cc.texto} fontSize="86" fontWeight="800"
                style={{ fontFamily: "'Oswald', 'Inter', sans-serif" }} stroke={cc.contorno} strokeWidth="2">{idade ?? '🎉'}</text>
            </svg>
          </div>
        </div>
        {/* No modo claro, os textos brancos passam a dourado (o branco
            desaparecia no fundo claro). No escuro fica tudo como estava. */}
        <div style={{ ...display, fontSize: 34, color: TEMA_ATUAL === 'claro' ? T.gold : '#fff', lineHeight: 1.05, marginTop: 2 }}>Parabéns, {primeiro}!</div>
        {idade ? (
          <div style={{ ...display, fontSize: 22, color: T.gold, letterSpacing: '.04em', textAlign: 'center' }}>{idade} anos</div>
        ) : null}
        {/* A mensagem é CENTRADA, como o resto do ecrã (título, idade,
            camisola, baliza). Alinhada à esquerda nunca ficava bem: o
            navegador dá ao bloco a largura máxima, as linhas acabam antes
            dessa largura, e o texto fica sempre a parecer puxado para a
            esquerda. O `balance` deixa as linhas com comprimentos parecidos,
            para não ficar uma palavra sozinha na última. */}
        <div style={{
          fontSize: 14.5, color: TEMA_ATUAL === 'claro' ? T.gold : 'rgba(255,255,255,.8)', lineHeight: 1.6, maxWidth: 'min(320px, 100%)',
          textAlign: 'center', textWrap: 'balance', margin: '0 auto', alignSelf: 'center',
        }}>
          Esta camisola é só tua. Toda a equipa técnica deseja-te um dia em grande, dentro e fora do campo.
        </div>

        {/* O GOLO DOS PARABÉNS */}
        <div style={{ position: 'relative', width: 280, height: 220, marginTop: 14 }}>
          {/* A BALIZA: postes e trave redondos (com luz e sombra), rede em
              losango com profundidade (fundo e laterais), relva às riscas e
              a linha de golo. Só a rede abana no golo — os postes ficam. */}
          <svg viewBox="0 0 280 130" width="280" height="130" style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
            <defs>
              <linearGradient id="fb-poste" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FFFFFF" /><stop offset=".6" stopColor="#F1F1EE" /><stop offset="1" stopColor="#B9BDC2" /></linearGradient>
              <linearGradient id="fb-trave" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset=".6" stopColor="#F1F1EE" /><stop offset="1" stopColor="#B9BDC2" /></linearGradient>
              <pattern id="fb-rede" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <path d="M0 0 L0 9 M0 0 L9 0" stroke="rgba(255,255,255,.42)" strokeWidth="1" />
              </pattern>
              <linearGradient id="fb-fundo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgba(0,0,0,.35)" /><stop offset="1" stopColor="rgba(0,0,0,.15)" /></linearGradient>
              <linearGradient id="fb-relva" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f7a3c" /><stop offset="1" stopColor="#1f5a2b" /></linearGradient>
              <clipPath id="fb-boca"><rect x="30" y="10" width="220" height="100" /></clipPath>
            </defs>
            <rect x="0" y="108" width="280" height="22" fill="url(#fb-relva)" />
            <g opacity=".25">
              {[0, 80, 160, 240].map(x => <rect key={x} x={x} y="108" width="40" height="22" fill="#5fae5f" />)}
            </g>
            <line x1="0" y1="110" x2="280" y2="110" stroke="#fff" strokeWidth="2" />
            <g style={{ transformOrigin: '50% 0', transformBox: 'fill-box', animation: golo && !eGR ? 'festa-rede .7s ease-out .55s 2' : 'none' }}>
              <rect x="30" y="10" width="220" height="100" fill="url(#fb-fundo)" />
              <polygon points="30,10 52,24 52,106 30,110" fill="rgba(255,255,255,.05)" />
              <polygon points="250,10 228,24 228,106 250,110" fill="rgba(255,255,255,.05)" />
              <g clipPath="url(#fb-boca)"><rect x="30" y="10" width="220" height="100" fill="url(#fb-rede)" /></g>
              <path d="M52 24 L228 24 M52 24 L52 106 M228 24 L228 106 M30 10 L52 24 M250 10 L228 24" stroke="rgba(255,255,255,.35)" strokeWidth="1" fill="none" />
            </g>
            <ellipse cx="140" cy="113" rx="122" ry="4" fill="rgba(0,0,0,.35)" />
            <rect x="24" y="6" width="7" height="105" rx="3" fill="url(#fb-poste)" />
            <rect x="249" y="6" width="7" height="105" rx="3" fill="url(#fb-poste)" />
            <rect x="24" y="5" width="232" height="7" rx="3" fill="url(#fb-trave)" />
          </svg>
          {/* a bola */}
          {/* GR: as luvas na baliza (é nelas que se toca) */}
          {eGR && (
            <button type="button" onClick={rematar} aria-label="Defender" style={{
              position: 'absolute', left: '50%', top: 66, width: 90, height: 57, marginLeft: -45, marginTop: -28, zIndex: 2,
              border: 'none', padding: 0, background: 'transparent', cursor: golo ? 'default' : 'pointer',
              animation: golo ? 'festa-voo .42s cubic-bezier(.2,.8,.3,1) forwards' : 'festa-luvas-espera 1.4s ease-in-out infinite',
            }}>
              {/* Luvas de guarda-redes vistas de frente (as palmas viradas
                  para o remate): um só contorno de mão, com dedos largos e
                  arredondados e o polegar aberto; palma de látex clara com
                  sombra, o rebordo na cor das luvas (como o "roll finger") e
                  o punho com a fita na cor do clube. */}
              <svg viewBox="0 0 120 76" width="90" height="57">
                <defs>
                  <linearGradient id="luva-latex" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#F7F7F4" /><stop offset=".6" stopColor="#E2E3E0" /><stop offset="1" stopColor="#BFC2C4" />
                  </linearGradient>
                  <radialGradient id="luva-palma" cx="50%" cy="60%" r="55%">
                    <stop offset="0" stopColor="rgba(0,0,0,0)" /><stop offset="1" stopColor="rgba(0,0,0,.18)" />
                  </radialGradient>
                </defs>
                {[0, 1].map(k => (
                  <g key={k} transform={k ? 'translate(118,0) scale(-1,1)' : 'translate(2,0)'}>
                    <path d="M15 60 C9 56 4 49 4 42 C4 37 6 33 9.5 32.5 C13 32 15 35 16 39 L15.5 13 C15.5 7.5 24.5 7.5 24.5 13 L24.8 24 L25.2 9 C25.2 3 35 3 35 9 L34.8 24 L35.4 12 C35.4 6.5 44.4 6.5 44.4 12 L44.2 27 L44.8 19 C44.8 14.5 52.6 14.5 52.6 19 L52.6 44 C52.6 52 50 57 46.5 60 Z" fill="url(#luva-latex)" stroke={corGR} strokeWidth="3.2" strokeLinejoin="round" style={{ paintOrder: 'stroke' }} />
                    <path d="M15 60 C9 56 4 49 4 42 C4 37 6 33 9.5 32.5 C13 32 15 35 16 39 L15.5 13 C15.5 7.5 24.5 7.5 24.5 13 L24.8 24 L25.2 9 C25.2 3 35 3 35 9 L34.8 24 L35.4 12 C35.4 6.5 44.4 6.5 44.4 12 L44.2 27 L44.8 19 C44.8 14.5 52.6 14.5 52.6 19 L52.6 44 C52.6 52 50 57 46.5 60 Z" fill="url(#luva-palma)" />
                    <path d="M15 60 C9 56 4 49 4 42 C4 37 6 33 9.5 32.5 C13 32 15 35 16 39 L15.5 13 C15.5 7.5 24.5 7.5 24.5 13 L24.8 24 L25.2 9 C25.2 3 35 3 35 9 L34.8 24 L35.4 12 C35.4 6.5 44.4 6.5 44.4 12 L44.2 27 L44.8 19 C44.8 14.5 52.6 14.5 52.6 19 L52.6 44 C52.6 52 50 57 46.5 60 Z" fill="none" stroke="#14301f" strokeWidth=".8" strokeLinejoin="round" />
                    <path d="M24.8 24 L24.8 34 M34.8 24 L34.8 34 M44.2 27 L44.2 36" stroke="#9aa0a3" strokeWidth=".9" strokeLinecap="round" />
                    <path d="M19 44 Q30 50 46 44" fill="none" stroke="#9aa0a3" strokeWidth=".9" strokeLinecap="round" />
                    <path d="M14.5 58 L47 58 L48 74 Q31 77 14 74 Z" fill={corGR} stroke="#14301f" strokeWidth=".8" />
                    <path d="M14.3 63 L47.6 63 L47.9 68 L14.1 68 Z" fill={T.corEquipa} stroke="#14301f" strokeWidth=".6" />
                  </g>
                ))}
              </svg>
            </button>
          )}
          <button type="button" onClick={eGR ? undefined : rematar} aria-label={eGR ? 'Bola' : 'Rematar'} style={{
            position: 'absolute', left: '50%', top: 170, width: 46, height: 46, marginLeft: -23, marginTop: -23, borderRadius: '50%',
            border: 'none', padding: 0, cursor: golo || eGR ? 'default' : 'pointer', background: 'transparent',
            animation: golo
              ? (eGR ? 'festa-remate-gr .5s cubic-bezier(.3,.6,.4,1) forwards' : 'festa-remate .55s cubic-bezier(.3,.6,.4,1) forwards')
              : (eGR ? 'none' : 'festa-pulsar 1.6s ease-in-out infinite'),
          }}>
            <BolaFutebol tamanho={46} />
          </button>
          {/* explosão de papelinhos no golo */}
          {golo && explosao.map(c => (
            <span key={`e${c.k}`} style={{
              position: 'absolute', left: '50%', top: 60, width: 8, height: 4, background: c.cor, borderRadius: 1, pointerEvents: 'none',
              '--dx': `${c.dx}px`, '--dy': `${c.dy}px`, '--rot': `${c.rot}deg`,
              animation: 'festa-explode 1.3s cubic-bezier(.1,.7,.3,1) .5s both',
            }} />
          ))}
          {golo ? (
            <div style={{ position: 'absolute', left: 0, right: 0, top: 30, ...display, fontSize: 44, color: T.gold, animation: 'festa-golo .5s ease-out .55s both', textShadow: '0 3px 0 #5c0614' }}>{eGR ? 'DEFESA!' : 'GOLO!'}</div>
          ) : (
            <div style={{ position: 'absolute', left: 0, right: 0, top: 200, fontSize: 12.5, color: TEMA_ATUAL === 'claro' ? T.gold : 'rgba(255,255,255,.75)' }}>
              {eGR ? 'Vem aí o remate — toca nas luvas e defende 🧤' : 'Toca na bola — remata para celebrar ⚽'}
            </div>
          )}
        </div>

        {/* Lugar fixo para o botão de baixo: "Saltar" (pequeno) e "Entrar
            no Portal" (grande, depois do golo) ocupam a mesma altura, por
            isso o ecrã não sobe quando se marca o golo. */}
        <div style={{ marginTop: 18, width: '100%', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {golo ? (
            <button type="button" onClick={onEntrar} style={{
              width: '100%', height: '100%', padding: '0 18px', borderRadius: 14, border: 'none', cursor: 'pointer',
              background: '#fff', color: '#7a0c1c', fontSize: 15.5, fontWeight: 800, ...body,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, animation: 'festa-entrar .5s ease-out 1.2s both',
            }}>Entrar no Portal <ArrowRight size={18} /></button>
          ) : (
            <button type="button" onClick={onEntrar} style={{ background: 'none', border: 'none', color: TEMA_ATUAL === 'claro' ? T.gold : 'rgba(255,255,255,.45)', opacity: TEMA_ATUAL === 'claro' ? 0.75 : 1, fontSize: 12, cursor: 'pointer', ...body }}>Saltar</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===================================================================
   A MISSÃO — "A PRANCHETA DO MISTER"
   ===================================================================
   A tarefa chega como chegam as instruções num balneário: numa prancheta.
   · Em cima, o quadro verde com o campo a giz: o íman do jogador (com o
     número dele) e, do outro lado, o OBJETIVO — um círculo com o ícone do
     destino (autoavaliação, wellness, vídeo…). O mister desenha a jogada:
     uma seta de giz vai-se traçando do jogador até ao objetivo.
   · Por baixo, a folha da prancheta (papel pautado) com as instruções:
     o título, as notas, e o prazo carimbado no canto.
   · O botão "Bora! …" leva ao sítio onde se faz. "Mais tarde" esconde
     até à próxima entrada no Portal.
   · Várias missões = várias folhas presas na mola: "1 de 3", e a folha
     vira-se ao passar à seguinte. */
/* ECRÃ DE JOGO — véspera e dia de jogo. Tem de ser diferente da
   prancheta das missões: aquilo é o mister a dar trabalho, isto é o
   jogo a chegar. A ideia é um estádio à noite:
   - as luzes dos postes acendem uma a uma ao entrar (com o tremeluzir
     das lâmpadas de estádio a aquecer);
   - na bancada, flashes de telemóveis a piscar;
   - o PLACARD em luzes LED, com os dois clubes e a contagem decrescente
     para o apito (véspera: horas, minutos e segundos; dia: "apito às");
   - por baixo, o BILHETE do jogador com o nome e o número, o jogo e a
     concentração. Ao carregar em "Bora", o canhoto do bilhete rasga-se
     (como à entrada do estádio) e só depois leva o jogador a Jogo. */
function EcraJogo({ player, missao, onIr, onAdiar }) {
  const info = missao._info || {};
  const [agora, setAgora] = useState(() => Date.now());
  const [rasgar, setRasgar] = useState(false);
  useEffect(() => {
    const h = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(h);
  }, []);
  /* ATÉ AO FUNDO DO ECRÃ NO TELEMÓVEL. Por defeito a página acaba por cima
     da barra de gestos do Android e essa faixa fica com a cor da página
     (escura). Enquanto este ecrã está aberto: desenha-se por baixo das
     barras (viewport-fit=cover), o fundo da página passa a verde-relva e a
     barra de cima fica da cor do céu do estádio. Ao sair repõe-se tudo. */
  React.useLayoutEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const html = document.documentElement, corpo = document.body;
    const vp = document.querySelector('meta[name="viewport"]');
    const tc = document.querySelector('meta[name="theme-color"]');
    const antes = {
      vp: vp && vp.getAttribute('content'), tc: tc && tc.getAttribute('content'),
      html: html.style.getPropertyValue('background'), htmlP: html.style.getPropertyPriority('background'),
      corpo: corpo ? corpo.style.getPropertyValue('background') : '', corpoP: corpo ? corpo.style.getPropertyPriority('background') : '',
    };
    try {
      if (vp && !/viewport-fit/.test(antes.vp || '')) vp.setAttribute('content', `${antes.vp}, viewport-fit=cover`);
      if (tc) tc.setAttribute('content', '#05080b');
      html.style.setProperty('background', '#1f5532', 'important');
      if (corpo) corpo.style.setProperty('background', '#1f5532', 'important');
    } catch (e) { /* sem efeito: fica como estava */ }
    return () => {
      try {
        if (vp && antes.vp != null) vp.setAttribute('content', antes.vp);
        // Se entrou pela porta, a cor guardada era a da porta: volta à da app.
        if (tc && antes.tc != null) tc.setAttribute('content', (antes.tc === PE_TC_PORTA.escuro || antes.tc === PE_TC_PORTA.claro) ? T.bg : antes.tc);
        if (antes.html) html.style.setProperty('background', antes.html, antes.htmlP); else html.style.removeProperty('background');
        if (corpo) { if (antes.corpo) corpo.style.setProperty('background', antes.corpo, antes.corpoP); else corpo.style.removeProperty('background'); }
      } catch (e) { /* nada */ }
    };
  }, []);
  const flashes = React.useMemo(() => Array.from({ length: 46 }, (_, k) => ({
    k, left: Math.random() * 100, top: Math.random() * 100, atraso: Math.random() * 6, dur: 2.5 + Math.random() * 4,
    tam: 1.5 + Math.random() * 2.5, dourado: Math.random() < 0.3,
  })), []);

  const nomeJ = String((player && player.name) || '').trim();
  const primeiro = nomeJ ? nomeJ.split(/\s+/)[0] : 'Jogador';
  const numero = player && player.number ? String(player.number) : '';
  const cor = coresCamisola(T.corEquipa);
  const fora = info.casaFora === 'Fora';
  const nos = String(info.nos || 'Nós');
  const adv = String(info.adv || 'Adversário');
  const casa = fora ? { nome: adv, nosso: false, lado: 'Casa' } : { nome: nos, nosso: true, lado: 'Casa' };
  const vis = fora ? { nome: nos, nosso: true, lado: 'Fora' } : { nome: adv, nosso: false, lado: 'Fora' };

  // Contagem para o apito. Sem hora marcada, conta para a meia-noite do dia do jogo.
  const mh = /^(\d{1,2})[:h](\d{2})/.exec(String(info.hora || '').trim());
  const alvo = info.data ? new Date(`${info.data}T${mh ? `${mh[1].padStart(2, '0')}:${mh[2]}` : '00:00'}:00`).getTime() : null;
  const falta = alvo ? Math.max(0, alvo - agora) : null;
  const dois = (n) => String(n).padStart(2, '0');
  const hh = falta != null ? Math.floor(falta / 3600000) : 0;
  const mm = falta != null ? Math.floor((falta % 3600000) / 60000) : 0;
  const ss = falta != null ? Math.floor((falta % 60000) / 1000) : 0;
  // Igual nos dois dias: a contagem para o apito inicial. Sem hora marcada
  // não há para onde contar, e fica só "Amanhã" / "Hoje".
  const ledLinha2 = !alvo || !mh ? (info.vespera ? 'AMANHÃ' : 'HOJE') : (falta > 0 ? `${dois(hh)}:${dois(mm)}:${dois(ss)}` : 'EM JOGO');
  const ledLegenda = !alvo || !mh ? '' : (falta > 0 ? 'para o apito inicial' : 'a bola já rola');

  const ir = () => {
    if (rasgar) return;
    setRasgar(true);
    setTimeout(() => onIr(missao), 650);
  };
  const led = { fontFamily: "'JetBrains Mono', 'Courier New', monospace", color: '#FFC23D', textShadow: '0 0 6px rgba(255,170,40,.85), 0 0 14px rgba(255,140,20,.45)' };
  /* Sem emblemas: obrigava a carregar o de todos os adversários, e não é
     essa a ideia da app. Cada lado leva só o que um placard a sério tem:
     CASA / FORA por cima e o nome. O nosso lado tem a barra na cor da
     equipa e, se a equipa tiver emblema carregado, o emblema ao lado do
     nome (o do adversário nunca se pede). */
  const ladoPlacard = (eq) => (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {/* O nosso emblema (se a equipa o tiver), centrado por cima do nome.
          Do lado do adversário fica um espaço da mesma altura, para os dois
          nomes ficarem alinhados. Sem emblema, esta linha não existe. */}
      {info.logo ? (
        <div style={{ height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {eq.nosso ? <img src={info.logo} alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} /> : null}
        </div>
      ) : null}
      {/* O nome NUNCA corta: a letra encolhe com o ecrã e, se mesmo assim
          não couber, passa para duas linhas (ex.: "SC" / "SALGUEIROS").
          A barra sublinha o nome à largura do texto, centrada. */}
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'stretch', maxWidth: '100%' }}>
        <div style={{
          ...led, fontSize: 'clamp(11px, 3.5vw, 14px)', lineHeight: 1.25, letterSpacing: '.04em', textTransform: 'uppercase',
          textAlign: 'center', whiteSpace: 'normal', overflowWrap: 'anywhere', textWrap: 'balance',
        }}>{eq.nome}</div>
        <div style={{
          height: 3, borderRadius: 2, marginTop: 4,
          background: eq.nosso ? cor.base : 'rgba(255,194,61,.18)', boxShadow: eq.nosso ? `0 0 8px ${cor.base}` : 'none',
        }} />
      </div>
    </div>
  );

  /* Rótulo e valor numa grelha: a coluna dos rótulos mede o maior
     ("Concentração"), por isso o texto nunca fica por cima do rótulo. */
  const linhaBilhete = (rotulo, valor) => valor ? (
    <React.Fragment key={rotulo}>
      <span style={{ color: '#7a6f5c', fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', paddingTop: 3, whiteSpace: 'nowrap' }}>{rotulo}</span>
      <span style={{ color: '#1d2018', fontWeight: 600, fontSize: 13.5, lineHeight: 1.4, minWidth: 0 }}>{valor}</span>
    </React.Fragment>
  ) : null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 'calc(-1 * env(safe-area-inset-bottom, 0px))', zIndex: 75, overflowY: 'auto', overflowX: 'hidden', ...body,
      background: 'linear-gradient(180deg, #05080b 0%, #0b1712 45%, #10261a 100%)',
    }}>
      <style>{`
        @keyframes ej-acender { 0% { opacity: 0; } 8% { opacity: .9; } 12% { opacity: .1; } 20% { opacity: .8; } 26% { opacity: .25; } 40%, 100% { opacity: 1; } }
        @keyframes ej-flash { 0%, 86%, 100% { opacity: 0; transform: scale(.4); } 90% { opacity: 1; transform: scale(1.4); } 94% { opacity: .2; transform: scale(1); } }
        @keyframes ej-placard { from { opacity: 0; transform: translateY(-16px) scale(.96); } to { opacity: 1; transform: none; } }
        @keyframes ej-bilhete { from { opacity: 0; transform: translateY(40px) rotate(3deg); } to { opacity: 1; transform: rotate(-1.2deg); } }
        @keyframes ej-carimbo { 0% { transform: rotate(-14deg) scale(2); opacity: 0; } 100% { transform: rotate(-14deg) scale(1); opacity: .85; } }
        @keyframes ej-rasgar { 0% { transform: none; } 30% { transform: translateX(6px) rotate(4deg); } 100% { transform: translate(60px, 140px) rotate(38deg); opacity: 0; } }
        @keyframes ej-piscar { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
        @media (prefers-reduced-motion: reduce) { .ej-anim { animation: none !important; opacity: 1 !important; } }
      `}</style>

      {/* A BANCADA: flashes de telemóveis */}
      <div style={{ position: 'fixed', left: 0, right: 0, top: 0, height: '38%', pointerEvents: 'none', opacity: .9 }}>
        {flashes.map(f => (
          <span key={f.k} className="ej-anim" style={{
            position: 'absolute', left: `${f.left}%`, top: `${f.top}%`, width: f.tam, height: f.tam, borderRadius: '50%',
            background: f.dourado ? '#FFD27A' : '#fff', boxShadow: `0 0 ${f.tam * 3}px ${f.dourado ? '#FFC23D' : '#fff'}`,
            opacity: 0, animation: `ej-flash ${f.dur}s ease-in-out ${f.atraso}s infinite`,
          }} />
        ))}
      </div>

      {/* OS POSTES DE LUZ: acendem um de cada vez */}
      {[{ lado: 'left', atraso: 0.1 }, { lado: 'right', atraso: 0.55 }].map(pl => (
        <div key={pl.lado} className="ej-anim" style={{
          position: 'fixed', top: 0, [pl.lado]: 0, width: '62%', height: '78%', pointerEvents: 'none',
          opacity: 0, animation: `ej-acender 1.4s linear ${pl.atraso}s both`,
        }}>
          <div style={{
            position: 'absolute', top: 18, [pl.lado]: 14, display: 'grid', gridTemplateColumns: 'repeat(4, 7px)', gap: 3,
            padding: 4, background: '#1a1f22', borderRadius: 3, boxShadow: '0 0 24px rgba(255,250,225,.55)',
          }}>
            {Array.from({ length: 8 }, (_, k) => <span key={k} style={{ width: 7, height: 7, borderRadius: 2, background: '#FFFBEA', boxShadow: '0 0 6px #fff' }} />)}
          </div>
          <div style={{
            position: 'absolute', top: 30, [pl.lado]: 0, width: '100%', height: '100%',
            background: 'linear-gradient(180deg, rgba(255,250,225,.20) 0%, rgba(255,250,225,0) 80%)',
            clipPath: pl.lado === 'left' ? 'polygon(4% 0, 14% 0, 100% 100%, 20% 100%)' : 'polygon(86% 0, 96% 0, 80% 100%, 0 100%)',
          }} />
        </div>
      ))}

      {/* O RELVADO, em perspetiva, ao fundo. Desce até ao fundo do ecrã
          (por baixo da barra de gestos do telemóvel) e é mais alto no
          telemóvel, para não ficar uma faixa vazia por baixo do bilhete. */}
      <div style={{ position: 'fixed', left: '-20%', right: '-20%', bottom: 'calc(-1 * env(safe-area-inset-bottom, 0px) - 2px)', height: 'calc(min(44%, 380px) + env(safe-area-inset-bottom, 0px))', pointerEvents: 'none', perspective: 400 }}>
        <div style={{
          position: 'absolute', inset: 0, transform: 'rotateX(52deg)', transformOrigin: '50% 100%',
          background: 'repeating-linear-gradient(90deg, #1e5130 0 60px, #23603a 60px 120px)',
          boxShadow: 'inset 0 30px 40px rgba(5,8,11,.9)',
        }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,.45)' }} />
          <div style={{ position: 'absolute', left: '50%', top: '40%', width: 120, height: 120, marginLeft: -60, borderRadius: '50%', border: '2px solid rgba(255,255,255,.4)' }} />
        </div>
      </div>

      <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(56px + env(safe-area-inset-top, 0px)) 16px calc(28px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box', position: 'relative' }}>
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={{ textAlign: 'center', color: T_ESCURO.gold, fontSize: 11.5, fontWeight: 800, letterSpacing: '.26em', textTransform: 'uppercase' }}>
            Jogo{info.jornada ? ` · ${info.jornada}` : ''}{missao._teste ? ' · teste' : ''}
          </div>

          {/* O PLACARD */}
          <div className="ej-anim" style={{
            position: 'relative', borderRadius: 12, padding: '16px 14px 14px', border: '3px solid #2a2f33',
            background: '#07090a', backgroundImage: 'radial-gradient(rgba(255,194,61,.07) 1px, transparent 1.3px)', backgroundSize: '5px 5px',
            boxShadow: '0 18px 40px rgba(0,0,0,.6), inset 0 0 30px rgba(0,0,0,.8)', animation: 'ej-placard .6s ease-out 1s both',
          }}>
            {/* Os dois lados alinham pelo topo (os nomes à mesma altura,
                mesmo que um passe a duas linhas); o VS fica ao meio. */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              {ladoPlacard(casa)}
              <div style={{ ...led, alignSelf: 'center', flexShrink: 0, fontSize: 20, fontWeight: 700, animation: 'ej-piscar 1.6s ease-in-out infinite' }} className="ej-anim">VS</div>
              {ladoPlacard(vis)}
            </div>
            <div style={{ height: 1, background: 'rgba(255,194,61,.18)', margin: '14px 0 10px' }} />
            <div style={{ ...led, textAlign: 'center', fontSize: 30, fontWeight: 700, letterSpacing: '.08em', lineHeight: 1.1 }}>{ledLinha2}</div>
            {ledLegenda && <div style={{ textAlign: 'center', marginTop: 4, fontSize: 11, color: 'rgba(255,194,61,.7)', letterSpacing: '.18em', textTransform: 'uppercase' }}>{ledLegenda}</div>}
          </div>

          {/* O BILHETE */}
          <div className="ej-anim" style={{ display: 'flex', filter: 'drop-shadow(0 14px 26px rgba(0,0,0,.55))', animation: 'ej-bilhete .7s cubic-bezier(.2,.9,.3,1.2) 1.4s both' }}>
            <div style={{
              flex: 1, minWidth: 0, position: 'relative', background: '#F6EEDB', borderRadius: '10px 0 0 10px', padding: '14px 14px 14px 16px',
              backgroundImage: 'repeating-linear-gradient(135deg, rgba(160,130,80,.05) 0 6px, transparent 6px 12px)',
            }}>
              <div style={{ fontSize: 10, color: '#8a7a5c', letterSpacing: '.22em', textTransform: 'uppercase' }}>Bilhete de jogador</div>
              <div style={{ ...display, fontSize: 26, color: '#14231a', lineHeight: 1.15, margin: '2px 0 10px' }}>
                {primeiro}{numero ? <span style={{ color: cor.base, marginLeft: 8 }}>#{numero}</span> : null}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', columnGap: 10, rowGap: 4, alignItems: 'start' }}>
                {/* Só o adversário: o placard por cima já mostra quem joga em casa. */}
                {linhaBilhete('Jogo', `vs ${adv}`)}
                {linhaBilhete('Hora', [info.hora, info.local].filter(Boolean).join(' · '))}
                {linhaBilhete('Concentração', [info.horaConc, info.localConc].filter(Boolean).join(' · '))}
              </div>
              {/* Os três numa só linha, em três caixas iguais. Sem ícones e com a
                  letra a acompanhar a largura do ecrã, o texto cabe sempre
                  dentro da caixa. */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4, marginTop: 12 }}>
                {['Convocatória', 'Plano de jogo', 'Adversário'].map(t => (
                  <span key={t} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minWidth: 0,
                    fontSize: 'clamp(8.5px, 2.5vw, 10.5px)', fontWeight: 600, color: '#3b3a2c', lineHeight: 1.15,
                    border: '1px solid #cfc2a4', borderRadius: 999, padding: '4px 4px', whiteSpace: 'nowrap', overflow: 'hidden',
                  }}>{t}</span>
                ))}
              </div>
              {info.convocado && (
                <div className="ej-anim" style={{
                  position: 'absolute', right: 10, top: 12, border: '2px solid #2E6B3A', color: '#2E6B3A', borderRadius: 6,
                  padding: '2px 8px', fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase',
                  animation: 'ej-carimbo .35s ease-out 2.1s both',
                }}>Convocado</div>
              )}
            </div>
            {/* o canhoto, com o picotado entre os dois */}
            <div className={rasgar ? '' : 'ej-anim'} style={{
              width: 60, flexShrink: 0, background: '#F6EEDB', borderRadius: '0 10px 10px 0', position: 'relative',
              borderLeft: '2px dashed #b9aa88', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0',
              transformOrigin: '0 0', animation: rasgar ? 'ej-rasgar .65s ease-in both' : 'none',
            }}>
              <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 10, letterSpacing: '.3em', color: '#8a7a5c', textTransform: 'uppercase' }}>Entrada</div>
              <div style={{ width: 34, height: 52, background: 'repeating-linear-gradient(90deg, #1d2018 0 2px, transparent 2px 4px, #1d2018 4px 5px, transparent 5px 8px, #1d2018 8px 11px, transparent 11px 12px)' }} />
              <div style={{ ...display, fontSize: 18, color: cor.base }}>{numero || '★'}</div>
            </div>
          </div>

          <button type="button" onClick={ir} style={{
            width: '100%', padding: '15px 18px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: T.crimson, color: TEXT_ON_ACCENT, fontSize: 16, fontWeight: 800, ...body,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 8px 20px rgba(0,0,0,.35)',
          }}>
            Bora! {missao.acao || 'Ver o jogo'} <ArrowRight size={18} />
          </button>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button type="button" onClick={() => onAdiar(missao.id)} style={{
              background: 'none', border: 'none', color: T_ESCURO.mutedDim, cursor: 'pointer', fontSize: 13.5, ...body, padding: 6,
            }}>Mais tarde</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Também serve a EQUIPA TÉCNICA (sem Portal): `destinoDe` troca o destino
   do Portal pelo caminho da app, `cabecalho` o título da prancheta e
   `dicaDe` a frase por baixo do botão. */
function EcraMissao({ player, tarefas, janelas = {}, onIr, onAdiar, destinoDe, cabecalho, dicaDe }) {
  const [i, setI] = useState(0);
  const [folha, setFolha] = useState(0); // muda a cada página → reinicia as animações
  /* O FUNDO DA PÁGINA TODA MEXE, como os papelinhos dos anos — mas aqui
     são as marcas de giz de um quadro tático (cruzes, bolas, setas) a
     subir devagar, a rodar, quase transparentes. */
  const marcasGiz = React.useMemo(() => Array.from({ length: 22 }, (_, k) => ({
    k, tipo: ['bola', 'x', 'seta', 'cone', 'o', 'bola'][k % 6], left: Math.random() * 100, atraso: -Math.random() * 22,
    dur: 16 + Math.random() * 14, tam: 16 + Math.random() * 18, rot: Math.random() * 360, op: 0.08 + Math.random() * 0.12,
  })), []);
  const t = tarefas[Math.min(i, tarefas.length - 1)];
  if (!t) return null;
  const d = destinoDe ? destinoDe(t) : destinoMissao(t.destino);
  const Ic = d.icon;
  const fechadoAgora = (d.rota === 'wellness' && janelas.wellness && !janelas.wellness.open)
    || (d.rota === 'rpe' && janelas.rpe && !janelas.rpe.open);
  const prazoDe = (tt) => {
    if (!tt.prazo) return null;
    const dias = Math.round((new Date(`${tt.prazo}T00:00:00`) - new Date(`${todayStr()}T00:00:00`)) / 86400000);
    if (dias < 0) return { txt: 'Atrasada', cor: '#B3261E' };
    if (dias === 0) return { txt: 'Hoje', cor: '#9A6A00' };
    if (dias === 1) return { txt: 'Amanhã', cor: '#9A6A00' };
    return { txt: `${dias} dias`, cor: '#2E6B3A' };
  };
  const prazo = prazoDe(t);
  const titulo = String(t.titulo || '').trim();
  const tituloBonito = titulo ? titulo.charAt(0).toUpperCase() + titulo.slice(1) : d.rotulo;
  const nomeJ = String((player && player.name) || '').trim();
  const marca = (player && player.number) ? String(player.number) : (nomeJ ? nomeJ.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase() : '★');
  const mudar = (n) => { setI(n); setFolha(f => f + 1); };
  const giz = 'rgba(255,255,255,.82)';
  // Onde está o íman: o guarda-redes na pequena área; os outros, no meio-campo.
  const eGR = String((player && player.position) || '').toUpperCase() === 'GR';
  const pos = eGR ? { x: 21, y: 80 } : { x: 78, y: 112 };
  const corIman = coresCamisola(T.corEquipa);
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 75, overflowY: 'auto', overflowX: 'hidden', ...body,
      background: `radial-gradient(circle at 50% 30%, ${T.brilhoMissao} 0%, ${T.bg} 75%)`,
    }}>
      {marcasGiz.map(m => (
        m.tipo === 'bola' ? (
          // A bola a sério (a mesma dos anos), pequena e quase transparente.
          <div key={m.k} style={{
            position: 'fixed', left: `${m.left}%`, bottom: -40, opacity: m.op + 0.08, pointerEvents: 'none', lineHeight: 0,
            animation: `pr-subir ${m.dur}s linear ${m.atraso}s infinite`, '--rot': `${m.rot}deg`,
          }}><BolaFutebol tamanho={m.tam} /></div>
        ) : (
          <svg key={m.k} viewBox="0 0 24 24" width={m.tam} height={m.tam} style={{
            position: 'fixed', left: `${m.left}%`, bottom: -40, opacity: m.op, pointerEvents: 'none',
            animation: `pr-subir ${m.dur}s linear ${m.atraso}s infinite`, '--rot': `${m.rot}deg`,
          }}>
            <g fill="none" stroke={T.giz} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              {m.tipo === 'x' && <><line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" /></>}
              {m.tipo === 'o' && <circle cx="12" cy="12" r="8" />}
              {m.tipo === 'seta' && <><path d="M4 18 Q10 6 19 7" /><path d="M14 4 L19 7 L15.5 11.5" /></>}
              {m.tipo === 'cone' && <><path d="M12 3 L18 19 L6 19 Z" /><path d="M8.6 12.5 L15.4 12.5" /><path d="M4 21 L20 21" /></>}
            </g>
          </svg>
        )
      ))}
      {/* centrado na página (na vertical e na horizontal); com ecrãs
          baixos, desliza normalmente */}
      <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px 28px', boxSizing: 'border-box', position: 'relative' }}>
      <style>{`
        @keyframes pr-giz { from { stroke-dashoffset: 260; } to { stroke-dashoffset: 0; } }
        @keyframes pr-ponta { 0%, 70% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes pr-alvo { 0%, 55% { transform: scale(.4); opacity: 0; } 80% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes pr-alvo-pulsar { 0%,100% { box-shadow: 0 0 0 0 rgba(255,255,255,.35); } 50% { box-shadow: 0 0 0 10px rgba(255,255,255,0); } }
        @keyframes pr-folha { from { transform: perspective(900px) rotateX(-75deg); opacity: 0; } to { transform: perspective(900px) rotateX(0); opacity: 1; } }
        @keyframes pr-carimbo { 0% { transform: rotate(-12deg) scale(1.8); opacity: 0; } 100% { transform: rotate(-12deg) scale(1); opacity: .9; } }
        @keyframes pr-subir { 0% { transform: translateY(0) rotate(var(--rot)); } 100% { transform: translateY(-120vh) rotate(calc(var(--rot) + 220deg)); } }
        @keyframes pr-entrar { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
      `}</style>
      {/* data-entrada-anima: a prancheta entra enquanto a porta abre (como a
          camisola dos parabéns). Em pausa, ficava invisível até a porta
          acabar e o ecrã parecia vazio durante quase 1 s. */}
      <div data-entrada-anima="" style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 14, animation: 'pr-entrar .5s ease-out both' }}>

        {/* A PRANCHETA */}
        <div style={{ position: 'relative', background: 'linear-gradient(160deg, #3b2a1d 0%, #24180f 100%)', borderRadius: 18, padding: '30px 14px 16px', boxShadow: '0 20px 44px rgba(0,0,0,.5)' }}>
          {/* o título no topo da prancheta: só as letras, a amarelo */}
          <div style={{
            position: 'absolute', top: 9, left: 0, right: 0, textAlign: 'center', whiteSpace: 'nowrap',
            color: T.gold, fontSize: 11, fontWeight: 800, letterSpacing: '.22em', textTransform: 'uppercase',
          }}>{cabecalho || 'Instruções do mister'}{tarefas.length > 1 ? ` · ${i + 1}/${tarefas.length}` : ''}</div>

          {/* o quadro verde, com o campo a giz */}
          <div key={`q${folha}`} style={{ position: 'relative', background: 'linear-gradient(160deg, #2f5d3a 0%, #1f4429 100%)', borderRadius: 10, overflow: 'hidden', border: '3px solid #6b4b2e' }}>
            <svg viewBox="0 0 300 160" width="100%" style={{ display: 'block' }}>
              {/* O campo todo a giz: linhas, meio-campo, grandes e pequenas
                  áreas, marcas e arcos de penálti, cantos e as balizas. */}
              <g stroke={giz} strokeWidth="1.6" fill="none" opacity=".55" strokeLinecap="round">
                <rect x="10" y="10" width="280" height="140" rx="1" />
                <line x1="150" y1="10" x2="150" y2="150" />
                <circle cx="150" cy="80" r="20" />
                {/* grandes áreas */}
                <rect x="10" y="44" width="38" height="72" />
                <rect x="252" y="44" width="38" height="72" />
                {/* pequenas áreas */}
                <rect x="10" y="64" width="14" height="32" />
                <rect x="276" y="64" width="14" height="32" />
                {/* arcos da grande área */}
                <path d="M48 69.5 A16 16 0 0 1 48 90.5" />
                <path d="M252 69.5 A16 16 0 0 0 252 90.5" />
                {/* cantos */}
                <path d="M10 15 A5 5 0 0 0 15 10" /><path d="M285 10 A5 5 0 0 0 290 15" />
                <path d="M10 145 A5 5 0 0 1 15 150" /><path d="M285 150 A5 5 0 0 1 290 145" />
              </g>
              {/* marcas de penálti e o centro */}
              <g fill={giz} opacity=".7">
                <circle cx="36" cy="80" r="1.6" /><circle cx="264" cy="80" r="1.6" /><circle cx="150" cy="80" r="1.6" />
              </g>
              {/* as balizas (fora da linha de fundo, com rede) */}
              <g stroke={giz} fill="none" opacity=".75" strokeWidth="1.6">
                <rect x="3" y="70" width="7" height="20" />
                <rect x="290" y="70" width="7" height="20" />
              </g>
              <g stroke={giz} opacity=".3" strokeWidth=".8">
                {[73.5, 77, 80.5, 84, 87.5].map(y => <g key={y}><line x1="3" y1={y} x2="10" y2={y} /><line x1="290" y1={y} x2="297" y2={y} /></g>)}
              </g>
              {/* os adversários (cruzes de giz) */}
              <g stroke={giz} strokeWidth="2" strokeLinecap="round" opacity=".7">
                {[[160, 52], [185, 118], [210, 82]].map(([x, y], k) => (
                  <g key={k}><line x1={x - 5} y1={y - 5} x2={x + 5} y2={y + 5} /><line x1={x + 5} y1={y - 5} x2={x - 5} y2={y + 5} /></g>
                ))}
              </g>
              {/* a jogada: do jogador ao objetivo */}
              <path d={`M${pos.x} ${pos.y} C ${pos.x + 42} ${pos.y + 23}, 165 30, 228 64`} fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"
                strokeDasharray="6 5" style={{ strokeDasharray: 260, animation: 'pr-giz 1.3s ease-out .35s both' }} />
              <path d="M219 56 L230 65 L216 69" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: 'pr-ponta 1.7s ease-out both' }} />
            </svg>
            {/* o íman do jogador */}
            <div style={{
              position: 'absolute', left: `${(pos.x / 300) * 100}%`, top: `${(pos.y / 160) * 100}%`, transform: 'translate(-50%,-50%)',
              // Íman na cor do clube (a mesma da app): brilho, cor e sombra tirados dela,
              // e o número a branco ou escuro conforme a cor seja escura ou clara.
              width: 34, height: 34, borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, ${corIman.claro}, ${corIman.base} 60%, ${corIman.contorno})`,
              border: '2px solid #fff', boxShadow: '0 3px 6px rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: corIman.texto, fontSize: 13, fontWeight: 800, ...mono,
            }}>{marca}</div>
            {/* o objetivo (o destino da missão) */}
            <div style={{
              position: 'absolute', left: `${(242 / 300) * 100}%`, top: `${(60 / 160) * 100}%`, transform: 'translate(-50%,-50%)',
            }}>
              <div style={{
                width: 46, height: 46, borderRadius: '50%', border: '2.5px dashed #fff', background: 'rgba(255,255,255,.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'pr-alvo 1.9s ease-out both, pr-alvo-pulsar 2s ease-in-out 2s infinite',
              }}><Ic size={22} color="#fff" /></div>
            </div>
          </div>
          {/* O objetivo, escrito na madeira por baixo do quadro (dentro do
              quadro ficava em cima da linha lateral e não se lia). */}
          <div style={{ marginTop: 7, textAlign: 'center', fontSize: 10.5, color: 'rgba(255,255,255,.72)', letterSpacing: '.14em', textTransform: 'uppercase' }}>
            Objetivo
          </div>

          {/* AS FOLHAS — todas empilhadas no mesmo sítio (só a da missão
              atual se vê). Assim a prancheta tem sempre a altura da folha
              mais comprida e a página NÃO MEXE ao passar de uma missão para
              outra; os botões em baixo também ficam sempre no mesmo sítio. */}
          <div style={{ display: 'grid', marginTop: 12 }}>
            {tarefas.map((tt, k) => {
              const ativa = k === Math.min(i, tarefas.length - 1);
              const pz = prazoDe(tt);
              const tit = String(tt.titulo || '').trim();
              const tb = tit ? tit.charAt(0).toUpperCase() + tit.slice(1) : (destinoDe ? destinoDe(tt) : destinoMissao(tt.destino)).rotulo;
              return (
          <div data-entrada-anima="" key={ativa ? `f${folha}` : `o${tt.id}`} aria-hidden={!ativa} style={{
            gridArea: '1 / 1', visibility: ativa ? 'visible' : 'hidden',
            /* ESCRITO NAS LINHAS: a folha tem uma linha a cada 26 px e todo o
               texto anda nesse mesmo passo (altura de linha 26 px, sem margens
               soltas) — as letras assentam nas linhas, como à mão. */
            position: 'relative', background: '#FBF8EF', borderRadius: 6, padding: '8px 16px 26px 26px', color: '#1d2a22',
            /* A risca fica 1 px abaixo da linha de base do texto (≈18 px dentro
               de cada linha de 26 px), para as letras pousarem nela. */
            backgroundImage: 'linear-gradient(180deg, transparent 0, transparent 19.5px, rgba(60,110,170,.26) 19.5px, rgba(60,110,170,.26) 20.5px, transparent 20.5px)',
            backgroundSize: '100% 26px', backgroundPosition: '0 8px', backgroundRepeat: 'repeat-y',
            boxShadow: '0 2px 0 #e7e1cf, 0 4px 0 #ddd6c2', transformOrigin: '50% 0', animation: ativa ? 'pr-folha .55s ease-out both' : 'none',
          }}>
            <div style={{ position: 'absolute', left: 14, top: 0, bottom: 0, width: 1.5, background: 'rgba(200,60,60,.45)' }} />
            {pz && (
              <div style={{
                position: 'absolute', right: 12, top: 12, border: `2px solid ${pz.cor}`, color: pz.cor, borderRadius: 6,
                padding: '2px 8px', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase',
                animation: ativa ? 'pr-carimbo .4s ease-out .9s both' : 'none',
              }}>Prazo · {pz.txt}</div>
            )}
            <div style={{ fontSize: 11, color: '#6b6b5f', letterSpacing: '.12em', textTransform: 'uppercase', lineHeight: '26px' }}>
              Para {nomeJ ? nomeJ.split(/\s+/)[0] : 'ti'}{tt.passoTxt ? ` · ${tt.passoTxt}` : ''}
            </div>
            <div style={{ ...display, fontSize: 23, lineHeight: '26px', color: '#14231a', paddingRight: pz ? 92 : 0, position: 'relative', top: -5 }}>{tb}</div>
            {tt.notas && <div style={{ fontSize: 14.5, lineHeight: '26px', color: '#2b3a30', whiteSpace: 'pre-wrap' }}>{tt.notas}</div>}
          </div>
              );
            })}
          </div>
        </div>

        <button type="button" onClick={() => onIr(t)} disabled={fechadoAgora} style={{
          width: '100%', padding: '15px 18px', borderRadius: 14, border: 'none', cursor: fechadoAgora ? 'default' : 'pointer',
          background: fechadoAgora ? T.surfaceRaise : T.crimson, color: fechadoAgora ? T.mutedDim : TEXT_ON_ACCENT,
          fontSize: 16, fontWeight: 800, ...body, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: fechadoAgora ? 'none' : '0 8px 20px rgba(0,0,0,.35)',
        }}>
          {fechadoAgora ? 'Ainda fechado — volta mais tarde' : <>Bora! {t.acao || d.acao} <ArrowRight size={18} /></>}
        </button>
        {/* sempre no lugar (só se esconde) — para os botões de baixo não saltarem entre missões */}
        {dicaDe ? (
          <div style={{ fontSize: 11.5, color: T.mutedDim, textAlign: 'center', marginTop: -6, minHeight: 17, lineHeight: 1.45 }}>{dicaDe(t) || ''}</div>
        ) : (
          <div style={{ fontSize: 11.5, color: T.mutedDim, textAlign: 'center', marginTop: -6, visibility: d.auto && !t._jogo && !fechadoAgora ? 'visible' : 'hidden' }}>{t.destino === 'clipe' ? 'Fica feita quando gravares o clipe.' : 'Fica feita assim que submeteres.'}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: tarefas.length > 1 ? 'space-between' : 'center', gap: 10 }}>
          <button type="button" onClick={() => { onAdiar(t.id); mudar(0); }} style={{
            background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', fontSize: 13.5, ...body, padding: 6,
          }}>Mais tarde</button>
          {tarefas.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" disabled={i === 0} onClick={() => mudar(Math.max(0, i - 1))} style={{ background: 'none', border: `1px solid ${T.line}`, borderRadius: 8, color: T.cream, padding: 6, cursor: 'pointer', opacity: i === 0 ? 0.35 : 1, display: 'flex' }}><ChevronLeft size={15} /></button>
              <div style={{ display: 'flex', gap: 5 }}>
                {tarefas.map((x, k) => <span key={x.id} style={{ width: 7, height: 7, borderRadius: '50%', background: k === i ? T.warn : T.line }} />)}
              </div>
              <button type="button" disabled={i >= tarefas.length - 1} onClick={() => mudar(Math.min(tarefas.length - 1, i + 1))} style={{ background: 'none', border: `1px solid ${T.line}`, borderRadius: 8, color: T.cream, padding: 6, cursor: 'pointer', opacity: i >= tarefas.length - 1 ? 0.35 : 1, display: 'flex' }}><ChevronRight size={15} /></button>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

/* PORTAL DO ATLETA — a "casa" do que o treinador for partilhando.

   Começa só com "Ideia de Jogo", mas é AQUI que entram Vídeos,
   Composição Corporal, etc., à medida que forem sendo construídos —
   cada um como mais um cartão nesta lista, sem mexer no resto do
   quiosque (Wellness/RPE continuam a viver fora do Portal, são
   questionários, não conteúdo para consultar). */
/* TREINO — "Plano do dia", só consulta.

   Mesmo padrão do Ideia de Jogo, mas sem interruptor nenhum para o
   treinador ligar/desligar: é sempre HOJE, e é sempre o que já está
   no Planeamento — não faz sentido curar isto exercício a exercício,
   muda todos os dias sozinho. Em dia de jogo (amigável ou de
   competição) a função nem devolve nada de propósito: não é
   "emparelhamento" de treino nenhum. */
function PlayerTreinoView({ code, teamId, onBack }) {
  /* O "hoje" tem de ser o do TELEMÓVEL do atleta (p_date), não o do
     servidor — à noite em Portugal ainda mostrava o treino de ontem. */
  const [estado, dadosPlano] = usePortalRpc('checkin_plano_dia', code, teamId, { p_date: todayStr() });
  const sessao = (dadosPlano && dadosPlano.sessao) || null;
  const [aVer, setAVer] = useState(null);

  if (aVer) {
    return (
      <ExercisePresentation
        exercise={{ ...aVer, name: aVer.name || aVer.phase || 'Exercício' }}
        onClose={() => setAVer(null)}
      />
    );
  }

  const eDescanso = sessao && sessao.phase === 'Descanso';
  const exercicios = (sessao && sessao.exercicios) || [];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
        borderRadius: 8, color: T.cream, padding: '8px 14px', cursor: 'pointer', ...body, fontSize: 13.5, marginBottom: 20,
      }}>
        <ChevronLeft size={15} /> Voltar
      </button>

      <div style={{ ...display, fontSize: 20, color: T.cream, marginBottom: 4 }}>Treino</div>
      <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 20 }}>Plano do dia</div>

      {estado === 'a-carregar' && (
        <div className="mjp-carregar" style={{ fontSize: 13, color: T.mutedDim }}>A carregar…</div>
      )}

      {estado === 'erro' && (
        <div style={{ fontSize: 13, color: T.bad }}>Não foi possível carregar. Tenta outra vez ou fala com o staff.</div>
      )}

      {estado === 'pronto' && (
        !sessao ? (
          <div style={{ fontSize: 13, color: T.mutedDim }}>
            Sem treino hoje — ou é dia de jogo, ou ainda não há nada marcado no plano.
          </div>
        ) : eDescanso ? (
          <div style={{ fontSize: 13, color: T.mutedDim }}>Hoje é dia de descanso.</div>
        ) : exercicios.length === 0 ? (
          <div style={{ fontSize: 13, color: T.mutedDim }}>O treino de hoje ainda não tem exercícios marcados.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {exercicios.map((x, i) => (
              <div
                key={x.id || i}
                onClick={() => setAVer(x)}
                // Coluna: o campo vai para o fundo do cartão, para os campos
                // ficarem todos à mesma altura (com títulos de 1 ou 2 linhas).
                style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
              >
                {/* O texto encosta ao campo: o espaço que sobra num cartão com
                    título mais curto fica por cima, e campos e textos ficam
                    todos alinhados entre cartões. */}
                {/* Título em cima, sempre com o espaço de duas linhas (mesmo
                    curto), para os títulos ficarem todos à mesma altura. */}
                <div style={{ color: T.cream, fontWeight: 500, fontSize: 15, lineHeight: 1.35, minHeight: '2.7em', marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{x.name || 'Exercício'}</div>
                <div style={{ marginTop: 'auto' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {x.phase && (
                    <span style={{ display: 'inline-block', fontSize: 11, color: T.warn, background: `${T.crimson}55`, padding: '3px 9px', borderRadius: 12 }}>{momentoTexto(x)}</span>
                  )}
                  {x.duration && (
                    <span style={{ display: 'inline-block', fontSize: 11, color: T.mutedDim, background: T.surfaceRaise, padding: '3px 9px', borderRadius: 12 }}>{x.duration} min</span>
                  )}
                </div>
                {x.description && (
                  <p style={{ color: T.mutedDim, fontSize: 12.5, lineHeight: 1.5, margin: '0 0 8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{x.description}</p>
                )}
                </div>
                {/* Com ▶ no canto para ver a animação ali mesmo, no cartão. */}
                <div style={{ paddingTop: 4 }}>
                  <DiagramThumbAnimado diagram={x.diagram} space={x.space} phase={x.phase} />
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}


/* Um clipe gravado por um jogador (tabela `video_clips`, origem
   'atleta') no formato de um corte do Canal — assim aparece dentro do
   cartão do jogo de onde saiu, com a mesma barra do clipe. */
function clipeAtletaParaCanal(c) {
  return {
    id: c.id,
    title: c.titulo || '(sem título)',
    youtubeId: c.youtubeId,
    clipInicio: Number(c.clipInicio),
    clipFim: Number(c.clipFim),
    clipOrigemId: c.clipOrigemId || c.videoOrigemId || null,
    clipOrigemTitulo: c.originalTitulo || '',
    jogoId: c.jogoId || null,
    jornada: c.jornada || '',
    categoria: 'jogo',
    pasta: '',
    deAtleta: true,
    notaAtleta: c.note || '',
  };
}

// Mensagens da função `checkin_clipe_criar`, nas palavras do jogador.
const ERROS_CLIPE_ATLETA = {
  codigo_invalido: 'O teu código já não é válido. Volta a entrar no Portal.',
  equipa_invalida: 'Este link não diz de que equipa és. Pede ao treinador o link da tua equipa.',
  video_invalido: 'Este vídeo já não está disponível para criar clipes.',
  tempos_invalidos: 'Marca o início e o fim do clipe.',
  duracao_invalida: `O clipe tem de ter entre 1 e ${MAX_CLIPE_ATLETA_SEG} segundos.`,
  titulo_obrigatorio: 'Dá um título ao clipe antes de gravar.',
  clipe_invalido: 'Este clipe já não existe (pode ter sido apagado pelo treinador).',
};

function PlayerBibliotecaView({ code, teamId, onBack, onClipeCriado }) {
  /* Miniaturas: as que já estavam carregadas (cache do browser) ficam
     logo visíveis; as outras entram a desvanecer (ver mjp-bib). Rede de
     segurança: ao fim de 2 s mostram-se todas, aconteça o que acontecer. */
  const marcarMiniaturas = React.useCallback((el) => {
    if (!el) return;
    const ver = () => el.querySelectorAll('img').forEach(im => { if (im.complete) im.classList.add('mjp-ok'); });
    ver();
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(ver) : null;
    if (mo) mo.observe(el, { childList: true, subtree: true });
    setTimeout(() => { el.querySelectorAll('img').forEach(im => im.classList.add('mjp-ok')); if (mo) mo.disconnect(); }, 2000);
  }, []);
  /* Abre logo com o que se viu da última vez (guardado neste aparelho) —
     antes, "Os meus clipes" e a contagem só apareciam uns segundos depois,
     à espera do servidor. Quando o servidor responde, troca-se. */
  const chaveCacheBib = `misterjp:portal-bib:${teamId}:${hashCurto(String(code || ''))}`;
  const cacheBib = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem(chaveCacheBib) || 'null') || null; } catch (e) { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [estado, setEstado] = useState(() => (cacheBib ? 'pronto' : 'a-carregar')); // a-carregar | pronto | erro
  const [videos, setVideosState] = useState(() => (cacheBib && Array.isArray(cacheBib.videos) ? cacheBib.videos : []));
  const [meusClipes, setMeusClipes] = useState(() => (cacheBib && Array.isArray(cacheBib.meus) ? cacheBib.meus : []));
  useEffect(() => {
    try { localStorage.setItem(chaveCacheBib, JSON.stringify({ videos, meus: meusClipes })); } catch (e) { /* sem espaço */ }
  }, [videos, meusClipes, chaveCacheBib]);
  // Se a leitura dos clipes do jogador falhar, diz-se no ecrã (antes
  // falhava em silêncio e os clipes simplesmente não apareciam).
  const [erroMeusClipes, setErroMeusClipes] = useState(false);
  const canalRef = useRef(null);
  // Confirmação depois de gravar um clipe. O Portal não tem a barra de
  // avisos do staff (`UndoBar`), por isso fica aqui.
  const [avisoClipe, setAvisoClipe] = useState(null); // { texto, erro }
  useEffect(() => {
    if (!avisoClipe) return undefined;
    const t = setTimeout(() => setAvisoClipe(null), 5000);
    return () => clearTimeout(t);
  }, [avisoClipe]);

  const lerJson = (data) => {
    let d = data;
    if (Array.isArray(d)) d = d[0];
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { /* fica como está */ } }
    return d;
  };

  useEffect(() => {
    let cancelado = false;
    // Os dois pedidos AO MESMO TEMPO (antes eram um depois do outro).
    (async () => {
      try {
        const { data, error } = await supabase.rpc('checkin_biblioteca', { p_code: code, p_team: teamId });
        if (cancelado) return;
        if (error) throw error;
        const d = lerJson(data);
        // Por ordem de criação, como no Canal — é o próprio visualizador
        // (`recentesPrimeiro`) que mostra o mais recente primeiro.
        setVideosState(((d && d.videos) || []).slice());
        setEstado('pronto');
      } catch (e) {
        if (!cancelado) setEstado(prev => (prev === 'pronto' ? prev : 'erro'));
      }
    })();
    // Os clipes do próprio jogador vêm à parte. Se falharem (por
    // exemplo, função ainda não criada no Supabase), a Biblioteca
    // continua a abrir na mesma, só sem eles.
    (async () => {
      try {
        const { data, error } = await supabase.rpc('checkin_meus_clipes', { p_code: code, p_team: teamId });
        if (cancelado) return;
        if (error) throw error;
        const d = lerJson(data);
        setMeusClipes(((d && d.clipes) || []).filter(c => c && c.youtubeId).map(clipeAtletaParaCanal));
        setErroMeusClipes(false);
      } catch (e) {
        console.error('checkin_meus_clipes', e);
        if (!cancelado) setErroMeusClipes(true);
      }
    })();
    return () => { cancelado = true; };
  }, [code, teamId]);

  // Referência estável: o Canal tem efeitos que dependem da lista.
  const itensPortal = React.useMemo(() => [...videos, ...meusClipes], [videos, meusClipes]);

  const criarClipeAtleta = async ({ videoId, inicio, fim, titulo, nota }) => {
    let resposta;
    try {
      const { data, error } = await supabase.rpc('checkin_clipe_criar', {
        p_code: code, p_team: teamId, p_video_id: videoId,
        p_inicio: inicio, p_fim: fim, p_titulo: titulo, p_nota: nota || '',
      });
      if (error) throw error;
      resposta = lerJson(data);
    } catch (e) {
      throw new Error('Não foi possível ligar. Verifica a internet e tenta outra vez.');
    }
    if (!resposta || !resposta.ok) {
      throw new Error(ERROS_CLIPE_ATLETA[resposta && resposta.erro] || 'O clipe não ficou gravado. Tenta outra vez.');
    }
    if (resposta.clipe) setMeusClipes(prev => [...prev, clipeAtletaParaCanal(resposta.clipe)]);
    setAvisoClipe({ texto: `Clipe "${titulo}" gravado em "Os meus clipes". O treinador já o pode ver.` });
    // Missão "Criar clipe" fecha-se sozinha: a do JOGO deste vídeo, se houver.
    const doVideo = (videos || []).find(v => v.id === videoId) || {};
    const jogoDoClipe = doVideo.jogoId || (resposta.clipe && resposta.clipe.jogoId) || null;
    if (onClipeCriado) onClipeCriado(titulo, jogoDoClipe);
  };

  /* OS MEUS VÍDEOS no servidor (ver os_meus_videos.sql). Cada função
     devolve os dados ou lança um erro; quem chama (CompilacoesAtleta)
     decide o que mostrar. */
  const compilacoesApi = React.useMemo(() => ({
    ler: async () => {
      const { data, error } = await supabase.rpc('checkin_meus_videos', { p_code: code, p_team: teamId });
      if (error) throw error;
      const d = lerJson(data);
      if (!d) throw new Error('codigo_invalido');
      return (d.videos || []).filter(Boolean);
    },
    guardar: async ({ id, nome, ids }) => {
      const { data, error } = await supabase.rpc('checkin_video_guardar', { p_code: code, p_team: teamId, p_id: id || '', p_nome: nome, p_ids: ids });
      if (error) throw error;
      const d = lerJson(data);
      if (!d || !d.ok) throw new Error((d && d.erro) || 'erro');
      return d.video;
    },
    partilhar: async (id) => {
      const { data, error } = await supabase.rpc('checkin_video_partilhar', { p_code: code, p_team: teamId, p_id: id });
      if (error) throw error;
      const d = lerJson(data);
      if (!d || !d.ok) throw new Error((d && d.erro) || 'erro');
      return d.codigo;
    },
    apagar: async (id) => {
      const { data, error } = await supabase.rpc('checkin_video_apagar', { p_code: code, p_team: teamId, p_id: id });
      if (error) throw error;
      const d = lerJson(data);
      if (d && !d.ok && d.erro !== 'video_invalido') throw new Error(d.erro || 'erro');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [code, teamId]);

  // Editar um clipe do próprio jogador (tempos, título e texto).
  const editarClipeAtleta = async ({ clipeId, inicio, fim, titulo, nota }) => {
    let resposta;
    try {
      const { data, error } = await supabase.rpc('checkin_clipe_editar', {
        p_code: code, p_team: teamId, p_clipe_id: clipeId,
        p_inicio: inicio, p_fim: fim, p_titulo: titulo, p_nota: nota || '',
      });
      if (error) throw error;
      resposta = lerJson(data);
    } catch (e) {
      throw new Error('Não foi possível ligar. Verifica a internet e tenta outra vez.');
    }
    if (!resposta || !resposta.ok) {
      throw new Error(ERROS_CLIPE_ATLETA[resposta && resposta.erro] || 'As alterações não ficaram gravadas. Tenta outra vez.');
    }
    if (resposta.clipe) {
      const novo = clipeAtletaParaCanal(resposta.clipe);
      setMeusClipes(prev => prev.map(c => (c.id === novo.id ? novo : c)));
    }
    setAvisoClipe({ texto: `Clipe "${titulo}" atualizado.` });
  };

  // Só apaga clipes do próprio jogador: o servidor volta a confirmar
  // que o clipe é dele antes de apagar.
  const apagarClipeAtleta = async (clipeId) => {
    let resposta;
    try {
      const { data, error } = await supabase.rpc('checkin_clipe_apagar', { p_code: code, p_team: teamId, p_clipe_id: clipeId });
      if (error) throw error;
      resposta = lerJson(data);
    } catch (e) {
      setAvisoClipe({ texto: 'Não foi possível ligar. Verifica a internet e tenta outra vez.', erro: true });
      throw e;
    }
    if (!resposta || !resposta.ok) {
      // Já não existe (apagado pelo treinador, por exemplo): sai da lista na mesma.
      if (resposta && resposta.erro === 'clipe_invalido') {
        setMeusClipes(prev => prev.filter(c => c.id !== clipeId));
        setAvisoClipe({ texto: 'Este clipe já não existia.' });
        return;
      }
      setAvisoClipe({ texto: 'O clipe não foi apagado. Tenta outra vez.', erro: true });
      throw new Error('recusado');
    }
    setMeusClipes(prev => prev.filter(c => c.id !== clipeId));
    setAvisoClipe({ texto: 'Clipe apagado.' });
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 24px 60px' }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
        borderRadius: 8, color: T.cream, padding: '8px 14px', cursor: 'pointer', ...body, fontSize: 13.5, marginBottom: 20,
      }}>
        <ChevronLeft size={15} /> Voltar
      </button>

      <div style={{ ...display, fontSize: 18, color: T.cream, marginBottom: 12 }}>Sala de Vídeo</div>

      {estado === 'a-carregar' && (
        <div className="mjp-carregar" style={{ fontSize: 13, color: T.mutedDim }}>A carregar…</div>
      )}

      {estado === 'erro' && (
        <div style={{ fontSize: 13, color: T.bad }}>Não foi possível carregar. Tenta outra vez ou fala com o staff.</div>
      )}

      {/* O MESMO CANAL do staff (Jogos · Adversários · Temas, cartões por
          jogo, barra do clipe, ecrã inteiro) — em modo só de leitura: sem
          adicionar, editar, mover nem apagar. A única exceção é criar
          clipes nos vídeos de JOGOS (`criarClipeAtleta`), que ficam
          guardados para o jogador e para o staff (Análise de Vídeo ›
          Análise individual em clipes). No Portal, esses clipes ficam
          numa secção própria, "Os meus clipes", a seguir a Temas. */}
      {avisoClipe && (
        <div role="status" style={{
          position: 'fixed', left: '50%', bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', transform: 'translateX(-50%)',
          zIndex: 3000, maxWidth: 'min(520px, 92vw)', padding: '10px 14px', borderRadius: 8, fontSize: 13, color: T.cream,
          background: T.surface, border: `1px solid ${avisoClipe.erro ? T.bad : T.good}`, boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
        }}>{avisoClipe.texto}</div>
      )}

      {estado === 'pronto' && erroMeusClipes && (
        <div style={{ fontSize: 12.5, color: T.bad, marginBottom: 12 }}>
          Não foi possível carregar os teus clipes. Tenta outra vez ou fala com o staff.
        </div>
      )}

      {estado === 'pronto' && (
        <div className="mjp-bib" ref={marcarMiniaturas}
          onLoadCapture={e => { if (e.target && e.target.tagName === 'IMG') e.target.classList.add('mjp-ok'); }}
          onErrorCapture={e => { if (e.target && e.target.tagName === 'IMG') e.target.classList.add('mjp-ok'); }}>
        <MediaLibrary
          ref={canalRef}
          items={itensPortal}
          setItems={() => {}}
          semBotaoTopo
          recentesPrimeiro
          modoCanal
          soLeitura
          criarClipeAtleta={criarClipeAtleta}
          apagarClipeAtleta={apagarClipeAtleta}
          editarClipeAtleta={editarClipeAtleta}
          chaveCompilacoes={`misterjp:compilacoes:${teamId}:${hashCurto(String(code || ''))}`}
          compilacoesApi={compilacoesApi}
          emptyText="Ainda não há nada partilhado aqui. Fala com o treinador se achas que devia haver."
        />
        </div>
      )}
    </div>
  );
}

/* O MEU CACIFO — a página de conteúdos do Portal do Atleta, a seguir ao
   balneário. Ao entrar, a fechadura roda, a porta abre sozinha e a luz do
   cacifo acende; ao voltar de uma área, o cacifo já está aberto.

   · DENTRO DO CACIFO: o caderno (Ideia de Jogo), o tablet (Sala de Vídeo),
     a camisola pendurada (Jogo: convocatória), a caixa das chuteiras com
     as estatísticas da época (Competição) e — só quando há uma janela
     aberta e algo por responder — a garrafa do Wellness/PSE.
   · DENTRO DA PORTA: a folha do treino de hoje, a classificação, a
     prancheta das Tarefas e a ficha do Desenvolvimento.
   · POR FORA: a foto num visor, a placa com o número e o nome, a
     fechadura de código e o emblema.

   Tudo é desenhado num palco de tamanho FIXO (300×480) que depois se
   escala para caber no ecrã — o mesmo desenho no telemóvel, no tablet e
   no computador, sem nada a mexer quando os dados chegam (cada texto tem
   o seu espaço reservado). O cacifo é um objeto escuro de propósito: não
   muda com o modo claro, como o placard e a TV do balneário.

   Os dados vêm do que o quiosque já tem (convocatória, competição,
   tarefas, Wellness/PSE) e de três pedidos pequenos guardados neste
   aparelho (treino do dia, autoavaliação, vídeos), que só se repetem de
   tempos a tempos — para não pesar na Egress. */
const CACIFO_W = 300;
const CACIFO_H = 480;
const CACIFO_CSS = `
  .cf-palco { position: relative; width: ${CACIFO_W}px; height: ${CACIFO_H}px; perspective: 1300px; transform-origin: 0 0; }
  .cf-rig { position: absolute; top: 0; left: 75px; width: 150px; height: ${CACIFO_H}px; transition: left .7s ease .1s; }
  .cf-aberto .cf-rig { left: 150px; }
  .cf-corpo { position: absolute; inset: 0; background: #0f1612; border: 5px solid #2c4336; border-radius: 6px; overflow: hidden; pointer-events: none; }
  .cf-aberto .cf-corpo { pointer-events: auto; }
  .cf-porta { position: absolute; inset: 0; transform-origin: left center; transform-style: preserve-3d; -webkit-transform-style: preserve-3d; transition: transform 1.2s cubic-bezier(.35,.75,.25,1) .45s; z-index: 5; pointer-events: none; }
  .cf-aberto .cf-porta { transform: rotateY(-165deg); }
  .cf-face { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 6px; overflow: hidden; }
  .cf-tras { background: #243a2e; transform: rotateY(180deg); border: 1px solid #4e6a58; }
  .cf-aberto .cf-tras { pointer-events: auto; }
  .cf-roda { transition: transform .8s cubic-bezier(.45,1.5,.5,1); transform-origin: 116px 300px; }
  .cf-aberto .cf-roda { transform: rotate(-290deg); }
  .cf-luz { position: absolute; top: 0; left: 0; display: block; pointer-events: none; opacity: 0; }
  .cf-aberto .cf-luz { opacity: 1; animation: cf-ligar .6s ease-out .55s both; }
  .cf-cone { opacity: 0; }
  .cf-aberto .cf-cone { opacity: 1; animation: cf-cone .5s ease-out .8s both; }
  /* A luz acende SUAVE, à medida que a porta abre. Antes piscava
     (0 → 0,85 → 0,2 → 1), e via-se o interior escuro aos soluços. */
  @keyframes cf-ligar { from { opacity: 0; } to { opacity: 1; } }
  @keyframes cf-cone { from { opacity: 0; } to { opacity: 1; } }
  .cf-ja .cf-luz, .cf-ja .cf-cone { animation: none !important; }
  .cf-it { opacity: 0; transform: translateY(8px); transition: opacity .45s, transform .45s; }
  .cf-aberto .cf-it { opacity: 1; transform: none; }
  .cf-ja .cf-rig, .cf-ja .cf-porta, .cf-ja .cf-roda, .cf-ja .cf-luz, .cf-ja .cf-it { transition: none !important; }
  @media (prefers-reduced-motion: reduce) {
    .cf-rig, .cf-porta, .cf-roda, .cf-luz, .cf-it { transition: none !important; }
    .cf-luz, .cf-cone { animation: none !important; }
    .cf-pisca { animation: none !important; }
  }
  .cf-obj { position: absolute; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; font: inherit; color: inherit;
    text-align: center; -webkit-tap-highlight-color: transparent; touch-action: manipulation;
    display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start; }
  .cf-obj:active { filter: brightness(1.2); }
  .cf-obj:focus-visible { outline: 2px solid #C9A227; outline-offset: 2px; border-radius: 4px; }
  .cf-lab { font-size: 9.5px; font-weight: 600; color: #F1EBDA; line-height: 1.2; overflow-wrap: anywhere; }
  .cf-mini { font-size: 8px; color: #C9A227; line-height: 1.25; margin-top: 1px; overflow-wrap: anywhere; }
  .cf-papel { position: absolute; background: #F4EEDC; color: #2a2418; border-radius: 2px; box-sizing: border-box; }
  .cf-papel small { display: block; font-size: 10.5px; color: #6b5e45; }
  .cf-mao { font-family: 'Caveat', cursive; }
  .cf-iman { position: absolute; top: -4px; left: 50%; margin-left: -6px; width: 12px; height: 8px; border-radius: 3px; background: #C9A227; }
  .cf-pisca { animation: cf-pisca 1.2s infinite; }
  @keyframes cf-pisca { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }
`;
/* A letra manuscrita (Caveat) carrega UMA vez, logo ao abrir a app, e
   fica na página: antes vinha num @import dentro do cacifo, voltava a ser
   pedida cada vez que o cacifo aparecia e os papéis ("Sem treino hoje",
   "Missão cumprida") mudavam de letra à frente do atleta. */
const CACIFO_FONTE = '';
if (typeof document !== 'undefined' && !document.getElementById('mjp-fonte-caveat')) {
  const ln = document.createElement('link');
  ln.id = 'mjp-fonte-caveat'; ln.rel = 'stylesheet';
  ln.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&display=swap';
  document.head.appendChild(ln);
  ln.onload = () => { try { document.fonts && document.fonts.load('700 16px Caveat'); document.fonts && document.fonts.load('500 16px Caveat'); } catch (e) { /* nada */ } };
}

function lerCacheCacifo(chave) {
  try { return JSON.parse(localStorage.getItem(chave) || 'null'); } catch (e) { return null; }
}
function gravarCacheCacifo(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) { /* sem espaço: volta a pedir */ }
}
function chaveCacifo(tipo, teamId, code) {
  return `misterjp:cacifo:${tipo}:${teamId}:${hashCurto(String(code || ''))}`;
}
// Depois de submeter a autoavaliação, a ficha do cacifo tem de mudar logo.
function esquecerCacheCacifo(tipo, teamId, code) {
  try { localStorage.removeItem(chaveCacifo(tipo, teamId, code)); } catch (e) { /* nada */ }
}

/* Um pedido pequeno com cópia neste aparelho: mostra logo o que se viu da
   última vez e só volta a pedir ao servidor quando a cópia tem mais de
   `minutos`. `reduzir` guarda só o que o cacifo precisa. */
function useDadoCacifo(rpc, args, chave, minutos, reduzir) {
  const [dado, setDado] = useState(() => { const c = lerCacheCacifo(chave); return c ? c.d : null; });
  useEffect(() => {
    const c = lerCacheCacifo(chave);
    if (c) setDado(c.d);
    if (c && Date.now() - (c.t || 0) < minutos * 60000) return undefined;
    let cancelado = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc(rpc, args);
        if (cancelado || error) return;
        let d = data;
        if (Array.isArray(d)) d = d[0];
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { /* fica */ } }
        const r = reduzir ? reduzir(d || null) : (d || null);
        setDado(r);
        gravarCacheCacifo(chave, { t: Date.now(), d: r });
      } catch (e) { /* fica com a cópia */ }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return dado;
}

const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
function quandoCurto(data, hora) {
  if (!data) return '';
  const hoje = todayStr();
  const dia = data === hoje ? 'Hoje' : data === addDays(hoje, 1) ? 'Amanhã'
    : DIAS_CURTOS[new Date(`${data}T12:00:00`).getDay()] || '';
  const h = String(hora || '').trim().replace(/^(\d{1,2})[:h](\d{2}).*$/, '$1h$2').replace(/h00$/, 'h');
  return [dia, h].filter(Boolean).join(' ');
}

function PlayerCacifo({
  player, equipa, code, teamId, animar, onAberto, onBack, onAbrir, onAbrirWellness, onAbrirRpe,
  dadosConv, dadosComp, missoes, nTarefas, session, doneWellness, doneRpe, wellnessWindow, rpeWindow,
}) {
  /* ---------- tamanho do ecrã: o mesmo enquadramento da entrada ---------- */
  const largo = usePkhMedia(PKH_LARGO);
  const tablet = usePkhMedia(PKH_TABLET_ALTO);
  const g = usePkhMedia('(min-height: 820px)') && (largo || tablet);
  const areaRef = useRef(null);
  // O cacifo (porta + interior) escala para caber no espaço que sobra.
  const [escala, setEscala] = useState(0);
  React.useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return undefined;
    const medir = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      const v = Math.max(0.5, Math.min(w / CACIFO_W, h / CACIFO_H, 2.6));
      setEscala(prev => (Math.abs(prev - v) < 0.002 ? prev : v));
    };
    medir();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', medir);
      return () => window.removeEventListener('resize', medir);
    }
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // As áreas do cacifo ficam já carregadas enquanto a porta abre.
  useEffect(() => { aquecerPortal(code, teamId); }, [code, teamId]);

  /* ---------- abrir: com animação na entrada, já aberto ao voltar ---------- */
  const [aberto, setAberto] = useState(!animar);
  useEffect(() => {
    if (!animar) return undefined;
    // 0,15 s com o cacifo fechado (antes 0,35 s); o resto da abertura igual.
    const a = setTimeout(() => setAberto(true), 150);
    const b = setTimeout(() => { if (onAberto) onAberto(); }, 2400);
    return () => { clearTimeout(a); clearTimeout(b); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- dados ---------- */
  const hoje = todayStr();
  const plano = useDadoCacifo('checkin_plano_dia', { p_code: code, p_team: teamId, p_date: hoje },
    `${chaveCacifo('treino', teamId, code)}:${hoje}`, 15,
    (d) => {
      const s = d && d.sessao;
      return s ? { phase: s.phase || '', n: (s.exercicios || []).length } : { vazio: true };
    });
  const dev = useDadoCacifo('checkin_desenvolvimento', { p_code: code, p_team: teamId },
    chaveCacifo('dev', teamId, code), 30,
    (d) => ({ registoId: (d && d.registoId) || null, enviado: !!(d && d.enviado) }));

  // Vídeos: a mesma cópia que a Sala de Vídeo usa para abrir logo
  // (`misterjp:portal-bib:…`). Só se pede ao servidor de 30 em 30 minutos.
  const chaveBib = `misterjp:portal-bib:${teamId}:${hashCurto(String(code || ''))}`;
  const chaveVistos = chaveCacifo('vistos', teamId, code);
  const [idsVideos, setIdsVideos] = useState(() => {
    const c = lerCacheCacifo(chaveBib);
    return c && Array.isArray(c.videos) ? c.videos.map(v => v && v.id).filter(Boolean) : null;
  });
  useEffect(() => {
    const chaveT = chaveCacifo('bib-t', teamId, code);
    const t = Number(lerCacheCacifo(chaveT) || 0);
    if (Date.now() - t < 30 * 60000 && idsVideos) return undefined;
    let cancelado = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('checkin_biblioteca', { p_code: code, p_team: teamId });
        if (cancelado || error) return;
        let d = data;
        if (Array.isArray(d)) d = d[0];
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { /* fica */ } }
        const videos = ((d && d.videos) || []).slice();
        const antiga = lerCacheCacifo(chaveBib) || {};
        gravarCacheCacifo(chaveBib, { videos, meus: Array.isArray(antiga.meus) ? antiga.meus : [] });
        gravarCacheCacifo(chaveT, Date.now());
        setIdsVideos(videos.map(v => v && v.id).filter(Boolean));
      } catch (e) { /* fica com a cópia */ }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, code]);
  // Na primeira vez neste aparelho, o que já lá está não conta como novo.
  const [vistos, setVistos] = useState(() => lerCacheCacifo(chaveVistos));
  useEffect(() => {
    if (idsVideos && !Array.isArray(vistos)) { setVistos(idsVideos); gravarCacheCacifo(chaveVistos, idsVideos); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsVideos]);
  const novosVideos = idsVideos && Array.isArray(vistos) ? idsVideos.filter(id => !vistos.includes(id)).length : 0;
  const abrirSalaVideo = () => {
    if (idsVideos) gravarCacheCacifo(chaveVistos, idsVideos.slice(-400));
    onAbrir('biblioteca');
  };

  /* ---------- o que cada objeto mostra ---------- */
  const nomeCompleto = String((player && player.name) || '').trim();
  const primeiro = nomeCompleto ? nomeCompleto.split(/\s+/)[0] : 'Atleta';
  const iniciais = nomeCompleto ? nomeCompleto.split(/\s+/).filter(Boolean).map(p => p[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join('').toUpperCase() : '?';
  const numero = player && player.number != null && String(player.number).trim() !== '' ? String(player.number).trim() : '';
  const cor = coresCamisola(T.corEquipa);
  const foto = (player && player.photo) || '';
  const logo = (equipa && equipa.logo) || '';
  const clube = String((equipa && (equipa.clube || equipa.nome)) || '').trim();
  const sigla = clube ? clube.split(/\s+/).filter(w => w.length > 2 || /^[A-Z]{2,}$/.test(w)).map(w => w[0]).join('').toUpperCase().slice(0, 3) : '';

  // Jogo: a próxima convocatória partilhada (hoje ou depois).
  const proxConv = ((dadosConv && dadosConv.convocatorias) || [])
    .filter(c => c && c.data && c.data >= hoje)
    .sort((a, b) => String(a.data).localeCompare(String(b.data)))[0] || null;

  // Competição: as três linhas à volta da nossa equipa.
  const nossoClube = (dadosComp && dadosComp.clube) || clube;
  const tabela = (() => {
    try {
      const comp = activeCompetitionOf(dadosComp && dadosComp.standings);
      const equipas = competitionTable(comp);
      if (!equipas.length) return [];
      const b = String(nossoClube || '').toLowerCase();
      const eNos = (t) => !!(b && t && t.name && (String(t.name).toLowerCase() === b || String(t.name).toLowerCase().includes(b) || b.includes(String(t.name).toLowerCase())));
      let i = equipas.findIndex(eNos);
      if (i < 0) i = 0;
      const ini = Math.max(0, Math.min(i - 1, equipas.length - 3));
      return equipas.slice(ini, ini + 3).map((t, k) => ({ pos: ini + k + 1, nome: t.name || '', pts: t.P != null ? t.P : '', nos: eNos(t) }));
    } catch (e) { return []; }
  })();
  const est = (dadosComp && dadosComp.estatisticas) || null;

  // Treino de hoje.
  const treinoTxt = !plano ? '…' : plano.vazio ? 'Sem treino hoje'
    : plano.phase === 'Descanso' ? 'Dia de descanso'
      : [plano.phase, plano.n ? `${plano.n} ex.` : ''].filter(Boolean).join(' · ') || 'Ver o plano';

  // Desenvolvimento.
  const devTxt = !dev ? '…' : dev.enviado ? 'Submetida' : dev.registoId ? 'Por fazer' : 'Sem avaliação aberta';
  const devFalta = !!(dev && dev.registoId && !dev.enviado);

  // Garrafa: só com uma janela aberta e algo por responder (regras do ecrã inicial).
  const isRestDay = !!(session && session.phase === 'Descanso');
  const wAberto = !!(wellnessWindow && wellnessWindow.open) && !doneWellness;
  const pAberto = !!(rpeWindow && rpeWindow.open) && !!session && !isRestDay && !doneRpe;
  const mostraGarrafa = wAberto || pAberto;
  const legendaGarrafa = wAberto && pAberto ? 'W · PSE' : wAberto ? 'Wellness' : 'PSE';
  const corPonto = (feito, emFalta) => (feito ? '#1D9E75' : emFalta ? '#D14056' : '#6f7c74');

  const postits = (missoes || []).slice(0, 2).map(m => String(m.titulo || 'Missão'));
  const nT = nTarefas || 0;

  /* Os objetos de dentro entram logo que a porta passa do meio da volta
     (por volta de 1,1 s): antes só apareciam aos 1,8–2,3 s e, com a porta
     já aberta, o cacifo ficava uns instantes vazio. */
  const atraso = (s) => (animar ? { transitionDelay: `${s}s` } : undefined);
  const nomePlaca = primeiro.toUpperCase();
  const tamNome = nomePlaca.length <= 5 ? 15 : nomePlaca.length <= 8 ? 12.5 : 10.5;

  const marcas = Array.from({ length: 40 }, (_, i) => {
    const a = (i * 9 * Math.PI) / 180, longa = i % 5 === 0, r1 = longa ? 9.5 : 11.8, r2 = 14.3;
    return (
      <line key={i} x1={116 + r1 * Math.sin(a)} y1={300 - r1 * Math.cos(a)} x2={116 + r2 * Math.sin(a)} y2={300 - r2 * Math.cos(a)}
        stroke={i === 0 ? '#C9A227' : '#e8e3d2'} strokeWidth={longa ? 1.1 : 0.6} />
    );
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1, background: T.bg, overflow: 'hidden', overscrollBehavior: 'none',
      touchAction: 'manipulation', ...body,
    }}>
      <style>{`${CACIFO_FONTE}${PKH_CSS}${CACIFO_CSS}`}</style>
      {largo && <PkhFaixasLaterais larguraConteudo={PKH_LARGURA_LARGA} />}
      <div style={{
        position: 'relative', height: '100%', maxWidth: largo ? PKH_LARGURA_LARGA : tablet ? PKH_LARGURA_TABLET : 460, margin: '0 auto',
        display: 'flex', flexDirection: 'column', gap: g ? 12 : 8, boxSizing: 'border-box',
        padding: largo
          ? `calc(${g ? 20 : 12}px + env(safe-area-inset-top, 0px)) 0 calc(${g ? 18 : 10}px + env(safe-area-inset-bottom, 0px))`
          : tablet
            ? 'calc(22px + env(safe-area-inset-top, 0px)) 24px calc(18px + env(safe-area-inset-bottom, 0px))'
            : 'calc(14px + env(safe-area-inset-top, 0px)) 14px calc(12px + env(safe-area-inset-bottom, 0px))',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button type="button" onClick={onBack} style={{
            display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: `1px solid ${T.line}`,
            borderRadius: 8, color: T.cream, padding: g ? '8px 14px' : '6px 11px', cursor: 'pointer', ...body, fontSize: g ? 14 : 12.5, flexShrink: 0,
          }}>
            <ChevronLeft size={g ? 16 : 14} /> Balneário
          </button>
        </div>

        <div ref={areaRef} style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: CACIFO_W * escala, height: CACIFO_H * escala, flexShrink: 0, visibility: escala ? 'visible' : 'hidden' }}>
            <div className={`cf-palco${aberto ? ' cf-aberto' : ''}${animar ? '' : ' cf-ja'}`} style={{ transform: `scale(${escala || 1})` }}>
              <div className="cf-rig">
                {/* ---------------- DENTRO DO CACIFO ---------------- */}
                <div className="cf-corpo">
                  {/* LUZ: calha embutida no teto com fita LED quente e brilho
                      difuso, um cone de luz suave a cair pelo cacifo, reflexo nas
                      arestas de cima e cantos mais escuros. Acende com um piscar
                      curto (como um LED a ligar) e o cone aparece a seguir. */}
                  <svg className="cf-luz" width="140" height="470" viewBox="0 0 140 470" aria-hidden="true">
                    <defs>
                      <linearGradient id="cf-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE7A3" stopOpacity=".22" /><stop offset=".55" stopColor="#FFE7A3" stopOpacity=".08" /><stop offset="1" stopColor="#FFE7A3" stopOpacity="0" /></linearGradient>
                      <linearGradient id="cf-aresta" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE7A3" stopOpacity=".45" /><stop offset="1" stopColor="#FFE7A3" stopOpacity="0" /></linearGradient>
                      <radialGradient id="cf-vinheta" cx=".5" cy=".15" r=".95"><stop offset=".55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".45" /></radialGradient>
                      <filter id="cf-brilho" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="2.2" /></filter>
                    </defs>
                    <rect x="0" y="0" width="140" height="470" fill="url(#cf-vinheta)" />
                    <g className="cf-cone">
                      <path d="M10 8 L130 8 L140 330 L0 330 Z" fill="url(#cf-cone)" />
                      <ellipse cx="70" cy="120" rx="58" ry="4" fill="#FFE7A3" opacity=".12" />
                      <rect x="0" y="8" width="2" height="90" fill="url(#cf-aresta)" /><rect x="138" y="8" width="2" height="90" fill="url(#cf-aresta)" />
                    </g>
                    <rect x="6" y="0" width="128" height="9" rx="2" fill="#1b231f" />
                    <rect x="10" y="5" width="120" height="3" rx="1.5" fill="#FFF3CF" />
                    <rect x="10" y="4" width="120" height="5" rx="2.5" fill="#FFE7A3" opacity=".55" filter="url(#cf-brilho)" />
                  </svg>

                  <button type="button" className="cf-obj cf-it" onClick={() => onAbrir('ideiaJogo')} aria-label="Ideia de Jogo"
                    style={{ left: 2, top: 24, width: 68, height: 94, ...atraso(1.05) }}>
                    {/* Caderno e tablet: desenho com a mesma altura (sem encolher)
                        e legenda na mesma linha. O tablet tem ainda, por baixo,
                        a linha dos vídeos novos. */}
                    {/* Caderno tático aberto: notas e uma lâmpada à esquerda,
                        meio campo com cruzes, bola e seta à direita. */}
                    <svg width="54" height="42" viewBox="0 0 64 50" style={{ display: 'block', margin: '3px auto 0', flexShrink: 0 }} aria-hidden="true">
                      <path d="M32 8 L32 46" stroke="#14281f" strokeWidth="2" />
                      <path d="M4 10 Q18 6 32 10 L32 46 Q18 42 4 46 Z" fill="#F4EEDC" />
                      <path d="M32 10 Q46 6 60 10 L60 46 Q46 42 32 46 Z" fill="#ECE5CF" />
                      <g stroke="#c9bfa3" strokeWidth=".8"><path d="M8 18 H28" /><path d="M8 24 H28" /><path d="M8 30 H28" /><path d="M8 36 H24" /></g>
                      <circle cx="14" cy="27" r="5" fill="none" stroke="#C9A227" strokeWidth="1.4" />
                      <path d="M12.5 33 h3" stroke="#C9A227" strokeWidth="1.4" />
                      <rect x="36" y="14" width="20" height="28" fill="none" stroke="#3B6D11" strokeWidth="1" />
                      <path d="M36 28 H56" stroke="#3B6D11" strokeWidth=".8" />
                      <circle cx="46" cy="28" r="3.5" fill="none" stroke="#3B6D11" strokeWidth=".8" />
                      <g stroke="#A6192E" strokeWidth="1.4"><path d="M39 17 l3 3 M42 17 l-3 3" /><path d="M49 33 l3 3 M52 33 l-3 3" /></g>
                      <circle cx="44" cy="37" r="1.8" fill="none" stroke="#1c2226" strokeWidth="1.2" />
                      <path d="M41 21 Q46 26 49 32" fill="none" stroke="#1c2226" strokeWidth="1" strokeDasharray="2 1.5" />
                      <path d="M30 6 L30 2 L34 2 L34 6" fill="#A6192E" />
                    </svg>
                    <div className="cf-lab" style={{ marginTop: 9 }}>Ideia<br />de Jogo</div>
                  </button>

                  <button type="button" className="cf-obj cf-it" onClick={abrirSalaVideo} aria-label="Sala de Vídeo"
                    style={{ left: 72, top: 24, width: 66, height: 94, ...atraso(1.12) }}>
                    {/* Tablet com um lance pausado. */}
                    <svg width="54" height="42" viewBox="0 0 64 50" style={{ display: 'block', margin: '3px auto 0', flexShrink: 0 }} aria-hidden="true">
                      <rect x="3" y="5" width="58" height="40" rx="5" fill="#1c2226" />
                      <rect x="7" y="9" width="50" height="30" rx="1.5" fill="#2E6B3F" />
                      <g stroke="#7FB08A" strokeWidth=".7" fill="none"><path d="M32 9 V39" /><circle cx="32" cy="24" r="5" /><rect x="7" y="17" width="7" height="14" /><rect x="50" y="17" width="7" height="14" /></g>
                      <g fill="#D14056"><circle cx="20" cy="20" r="1.8" /><circle cx="25" cy="30" r="1.8" /></g>
                      <g fill="#F1EBDA"><circle cx="40" cy="16" r="1.8" /><circle cx="44" cy="28" r="1.8" /></g>
                      <circle cx="32" cy="24" r="8" fill="#0f1612" fillOpacity=".55" />
                      <path d="M29.5 20 L36 24 L29.5 28 Z" fill="#C9A227" />
                      <rect x="9" y="35" width="46" height="1.6" rx=".8" fill="#ffffff44" />
                      <rect x="9" y="35" width="19" height="1.6" rx=".8" fill="#C9A227" />
                    </svg>
                    <div className="cf-lab" style={{ marginTop: 9 }}>Sala<br />de Vídeo</div>
                    <div className="cf-mini" style={{ minHeight: 10 }}>{novosVideos > 0 ? `${novosVideos} ${novosVideos === 1 ? 'novo' : 'novos'}` : ''}</div>
                  </button>

                  <div style={{ position: 'absolute', left: 0, right: 0, top: 122, height: 5, background: '#2c4336' }} />
                  {/* VARÃO de lado a lado, cromado, com os dois suportes. */}
                  <div style={{ position: 'absolute', left: 3, top: 141, width: 5, height: 10, borderRadius: 1.5, background: '#3a4a40' }} />
                  <div style={{ position: 'absolute', right: 3, top: 141, width: 5, height: 10, borderRadius: 1.5, background: '#3a4a40' }} />
                  <div style={{ position: 'absolute', left: 4, right: 4, top: 144, height: 4, borderRadius: 2, background: 'linear-gradient(180deg, #E6EAEC, #9AA3A8 50%, #5E676C)' }} />

                  <button type="button" className="cf-obj cf-it" onClick={() => onAbrir('jogos')} aria-label="Jogo"
                    style={{ left: 0, top: 144, width: 140, height: 186, ...atraso(1.2) }}>
                    {/* A CAMISOLA PENDURADA: cruzeta de madeira nos ombros (vê-se
                        pela gola), gancho de balneário em "J" com porca giratória
                        pousado no varão, sombra na parede, volume nas laterais e
                        mangas e ligeira inclinação. Cor da equipa (coresCamisola);
                        nas cores claras, o contorno passa a escuro. */}
                    <svg width="108" height="128" viewBox="0 0 132 156" style={{ display: 'block', margin: '0 auto', overflow: 'visible' }} aria-hidden="true">
                      <defs>
                        <linearGradient id="cf-madeira" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C48A4E" /><stop offset="1" stopColor="#7A4A22" /></linearGradient>
                        <linearGradient id="cf-cromo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F4F6F7" /><stop offset=".5" stopColor="#B8BFC3" /><stop offset="1" stopColor="#E2E6E8" /></linearGradient>
                        <radialGradient id="cf-sombra" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#000" stopOpacity=".55" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
                        <linearGradient id="cf-dobra" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#000" stopOpacity=".22" /><stop offset=".25" stopColor="#000" stopOpacity="0" /><stop offset=".75" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".22" /></linearGradient>
                      </defs>
                      <ellipse cx="70" cy="96" rx="52" ry="62" fill="url(#cf-sombra)" />
                      {(() => {
                        const clara = cor.texto !== '#FFFFFF';
                        const borda = clara ? cor.contorno : '#C9A227';
                        return (
                          <g transform="rotate(-2 66 2.4)">
                            <path d="M51 26 Q66 19 81 26 Q66 39 51 26 Z" fill={cor.contorno} />
                            <path d="M26 44 Q46 31 66 30 Q86 31 106 44" fill="none" stroke="url(#cf-madeira)" strokeWidth="4.5" strokeLinecap="round" />
                            <g transform="translate(0,16)">
                              <path d="M36 16 L52 10 Q66 20 80 10 L96 16 L124 40 L108 58 L98 50 L98 136 L34 136 L34 50 L24 58 L8 40 Z" fill={cor.base} stroke={borda} strokeWidth="2" />
                              <path d="M34 50 L98 50 L98 136 L34 136 Z" fill="url(#cf-dobra)" />
                              <path d="M36 16 L24 58 L8 40 Z" fill="#000" opacity=".12" /><path d="M96 16 L108 58 L124 40 Z" fill="#000" opacity=".12" />
                              <path d="M38 17 L50 12.5 M94 17 L82 12.5" stroke="#000" strokeOpacity=".25" strokeWidth="1.2" />
                              <path d="M52 10 Q66 24 80 10" fill="none" stroke={borda} strokeWidth="3" />
                              <text x="66" y="44" textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize="12.5" letterSpacing="1" fill={cor.texto}>{nomePlaca.slice(0, 12)}</text>
                              <text x="66" y={numero.length > 2 ? 86 : 92} textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize={numero.length > 2 ? 34 : 46} fill={cor.texto}>{numero || iniciais.slice(0, 2)}</text>
                            </g>
                            {/* gancho: porca giratória, haste e "J" de borracha escura pousado no varão */}
                            <rect x="63.2" y="25.5" width="5.6" height="4.6" rx="1" fill="#8d969b" />
                            <path d="M66 26 L66 12.5" stroke="url(#cf-cromo)" strokeWidth="2.6" strokeLinecap="round" />
                            <path d="M66 12.5 C66 2.5 70 -1.6 75 -1.6 C80 -1.6 82.5 1.4 82.5 5.4" fill="none" stroke="#454b50" strokeWidth="4.2" strokeLinecap="round" />
                            <path d="M67.5 9.5 C68 3.5 71 0.4 75 0" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="1.1" strokeLinecap="round" />
                          </g>
                        );
                      })()}
                    </svg>
                    <div style={{ height: 15, marginTop: 3, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      {proxConv && (proxConv.convocado === true ? (
                        <span style={{ background: '#C9A227', color: '#1A2A1F', fontSize: 9, fontWeight: 600, borderRadius: 9, padding: '1px 7px' }}>Convocado</span>
                      ) : proxConv.convocado === false ? (
                        <span style={{ border: '1px solid #6f7c74', color: '#b9c4bc', fontSize: 9, borderRadius: 9, padding: '0 6px' }}>Não convocado</span>
                      ) : null)}
                    </div>
                    <div className="cf-lab" style={{ marginTop: 2, padding: '0 6px' }}>{proxConv ? `Jogo · ${quandoCurto(proxConv.data, proxConv.horaJogo)}` : 'Jogo'}</div>
                    <div className="cf-mini" style={{ padding: '0 6px' }}>{proxConv ? `vs ${proxConv.adversario || 'Adversário'}` : 'Sem jogo marcado'}</div>
                  </button>

                  <div style={{ position: 'absolute', left: 0, right: 0, top: 336, height: 5, background: '#2c4336' }} />

                  <button type="button" className="cf-obj cf-it" onClick={() => onAbrir('competicao', 'estatisticas')} aria-label="Estatísticas da época"
                    style={{ left: mostraGarrafa ? 2 : 6, top: mostraGarrafa ? 356 : 346, width: mostraGarrafa ? 92 : 128, height: mostraGarrafa ? 96 : 120, ...atraso(1.3) }}>
                    {/* A CHUTEIRA DOURADA DA ÉPOCA: troféu num pedestal escuro com a
                        placa dos números (Jogos · Min. · Golos · Assist.). */}
                    {/* Ocupa a largura do compartimento (mais pequena só quando a garrafa
                        do Wellness/PSE também está lá), para os números lerem bem. */}
                    <svg width={mostraGarrafa ? 90 : 126} height={mostraGarrafa ? 66 : 92} viewBox="0 0 166 121" style={{ display: 'block', margin: '0 auto' }} aria-hidden="true">
                      <defs>
                        <linearGradient id="cf-ouro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFF3C4" /><stop offset=".35" stopColor="#F0C94E" /><stop offset=".7" stopColor="#C79A22" /><stop offset="1" stopColor="#7d5d0f" /></linearGradient>
                        <linearGradient id="cf-ouro-esc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b8901f" /><stop offset="1" stopColor="#5e450a" /></linearGradient>
                        <linearGradient id="cf-ouro-br" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".75" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
                        <linearGradient id="cf-ped" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2d3236" /><stop offset="1" stopColor="#111315" /></linearGradient>
                        <radialGradient id="cf-halo" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#FFE6A0" stopOpacity=".35" /><stop offset="1" stopColor="#FFE6A0" stopOpacity="0" /></radialGradient>
                      </defs>
                      <ellipse cx="83" cy="40" rx="70" ry="34" fill="url(#cf-halo)" />
                      <g transform="translate(23,8)">
                        <path d="M6 46 Q4 52 12 53 L104 53 Q118 52 120 45 Q114 47 100 47 L14 47 Z" fill="url(#cf-ouro-esc)" />
                        <g fill="#6b4f0c"><path d="M13 53 L14 58 L18 58 L19 53 Z" /><path d="M27 53 L28 58 L32 58 L33 53 Z" /><path d="M75 53 L76 58 L80 58 L81 53 Z" /><path d="M89 53 L90 58 L94 58 L95 53 Z" /><path d="M103 52 L104 57 L108 57 L109 52 Z" /></g>
                        <path d="M10 47 L9 24 Q9 14 18 13 L30 12 Q36 12 39 17 L44 23 Q58 24 72 27 Q94 31 108 36 Q119 40 120 45 Q114 47 100 47 Z" fill="url(#cf-ouro)" stroke="#6b520c" strokeWidth=".9" />
                        <path d="M30 12 Q34 7 40 9 L48 22 L44 23 Z" fill="url(#cf-ouro-esc)" />
                        <g stroke="#fff8e0" strokeWidth="1.6" strokeLinecap="round"><path d="M41 19 L47 24" /><path d="M47 20 L43 24" /><path d="M47 22 L53 27" /><path d="M53 23 L49 27" /><path d="M53 24 L59 29" /><path d="M59 25 L55 29" /><path d="M59 26 L65 30" /><path d="M65 27 L61 30" /></g>
                        <g fill="#6b520c"><circle cx="41" cy="19" r="1" /><circle cx="47" cy="22" r="1" /><circle cx="53" cy="24" r="1" /><circle cx="59" cy="26" r="1" /><circle cx="65" cy="28" r="1" /></g>
                        <path d="M10 47 L10 26 Q16 30 20 47 Z" fill="url(#cf-ouro-esc)" opacity=".7" />
                        <path d="M96 33 Q112 36 120 45 Q110 46 98 46 Q94 40 96 33 Z" fill="url(#cf-ouro-esc)" opacity=".45" />
                        <path d="M22 40 Q50 30 86 38" fill="none" stroke="#6b520c" strokeWidth="2.2" opacity=".55" />
                        <path d="M12 44 L116 44" stroke="#6b520c" strokeWidth=".6" strokeDasharray="2 1.5" opacity=".7" />
                        <path d="M14 18 Q40 22 70 28 Q95 33 112 40" fill="none" stroke="url(#cf-ouro-br)" strokeWidth="3" opacity=".8" />
                        <circle cx="104" cy="38" r="1.6" fill="#fff" opacity=".9" />
                      </g>
                      <path d="M30 68 L136 68 L142 76 L24 76 Z" fill="#3a3f44" />
                      <rect x="14" y="76" width="138" height="44" rx="3" fill="url(#cf-ped)" />
                      <rect x="20" y="81" width="126" height="34" rx="2" fill="none" stroke="#C9A227" strokeWidth="1" />
                      <g textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="600">
                        <g fontSize="15" fill="#FFD86A">
                          <text x="38" y="100">{est ? (est.jogos || 0) : 0}</text><text x="68" y="100" fontSize={String((est && est.minutos) || 0).length > 3 ? 12 : 15}>{est ? `${est.minutos || 0}'` : "0'"}</text>
                          <text x="98" y="100">{est ? (est.golos || 0) : 0}</text><text x="128" y="100">{est ? (est.assistencias || 0) : 0}</text>
                        </g>
                        <g fontSize="6" fill="#a89a74" fontFamily="Inter, sans-serif" fontWeight="600">
                          <text x="38" y="109">JOGOS</text><text x="68" y="109">MIN.</text><text x="98" y="109">GOLOS</text><text x="128" y="109">ASSIST.</text>
                        </g>
                      </g>
                    </svg>
                    <div className="cf-lab" style={{ marginTop: 4 }}>Estatísticas</div>
                  </button>

                  {mostraGarrafa && (
                    <button type="button" className="cf-obj cf-it" onClick={() => (wAberto ? onAbrirWellness() : onAbrirRpe())}
                      aria-label={wAberto ? 'Responder ao Wellness' : 'Responder à PSE'}
                      style={{ left: 94, top: 356, width: 42, height: 96, ...atraso(1.36) }}>
                      {/* Mesma linha de base da chuteira: a garrafa assenta no fundo do
                          espaço do desenho (66 px) e a legenda fica à altura de "Estatísticas". */}
                      <svg width="25" height="55" viewBox="0 0 34 78" style={{ display: 'block', margin: '11px auto 0' }} aria-hidden="true">
                        <rect x="14" y="0" width="6" height="7" rx="1.5" fill="#1c2226" />
                        <rect x="9" y="6" width="16" height="9" rx="2" fill="#1c2226" />
                        <rect x="8" y="14" width="18" height="3" fill="#C9A227" />
                        <path d="M7 19 Q7 17 10 17 L24 17 Q27 17 27 19 L28 30 Q25 34 25 38 Q25 42 28 46 L28 73 Q28 77 24 77 L10 77 Q6 77 6 73 L6 46 Q9 42 9 38 Q9 34 6 30 Z" fill={cor.base} />
                        <path d="M6.3 30 L27.7 30 M6.3 46 L27.7 46" stroke="#C9A227" strokeWidth="1.5" />
                        <rect x="7" y="51" width="20" height="16" rx="2" fill="#F1EBDA" />
                        <circle cx="12.5" cy="59" r="3.4" fill={corPonto(doneWellness, wAberto)} className={wAberto ? 'cf-pisca' : undefined} />
                        <circle cx="21.5" cy="59" r="3.4" fill={corPonto(doneRpe, pAberto)} className={pAberto ? 'cf-pisca' : undefined} />
                        <path d="M10 20 L10 27" stroke="#ffffff" strokeOpacity=".3" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <div className="cf-lab cf-pisca" style={{ marginTop: 4, color: '#F09595', whiteSpace: 'nowrap' }}>{legendaGarrafa}</div>
                    </button>
                  )}
                </div>

                {/* ---------------- A PORTA ---------------- */}
                <div className="cf-porta">
                  <div className="cf-face">
                    <svg width="150" height={CACIFO_H} viewBox={`0 0 150 ${CACIFO_H}`} style={{ display: 'block' }} aria-hidden="true">
                      <defs>
                        <clipPath id="cf-visor"><rect x="40" y="80" width="70" height="90" rx="4" /></clipPath>
                      </defs>
                      <rect x="0" y="0" width="150" height={CACIFO_H} rx="6" fill="#2c4336" />
                      <rect x="8" y="8" width="134" height={CACIFO_H - 16} rx="4" fill="#33503f" stroke="#4e6a58" />
                      <g fill="#9aa69e"><rect x="0" y="42" width="4" height="26" rx="1" /><rect x="0" y="227" width="4" height="26" rx="1" /><rect x="0" y="412" width="4" height="26" rx="1" /></g>
                      <g fill="#1d2e24"><path d="M28 22 h94 l-4 6 h-94z" /><path d="M28 34 h94 l-4 6 h-94z" /><path d="M28 46 h94 l-4 6 h-94z" /></g>
                      <rect x="33" y="73" width="84" height="104" rx="8" fill="#C9A227" />
                      <rect x="37" y="77" width="76" height="96" rx="6" fill="#8A6A0E" />
                      <rect x="40" y="80" width="70" height="90" rx="4" fill="#5d7266" />
                      {foto ? (
                        <image href={foto} x="40" y="80" width="70" height="90" preserveAspectRatio="xMidYMid slice" clipPath="url(#cf-visor)" />
                      ) : (
                        <g>
                          <circle cx="75" cy="111" r="15" fill="#c8b9a0" />
                          <path d="M47 170 Q49 135 75 132 Q101 135 103 170 Z" fill={cor.base} />
                          <text x="75" y="116" textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize="12" fill="#5d4a2e">{iniciais}</text>
                        </g>
                      )}
                      <path d="M84 80 L110 80 L110 95 L64 170 L46 170 Z" fill="#ffffff" opacity=".07" />
                      <g fill="#8A6A0E"><circle cx="38" cy="78" r="1.6" /><circle cx="112" cy="78" r="1.6" /><circle cx="38" cy="172" r="1.6" /><circle cx="112" cy="172" r="1.6" /></g>
                      <rect x="27" y="190" width="96" height="40" rx="3" fill="#C9A227" />
                      <rect x="31" y="194" width="88" height="32" rx="2" fill="none" stroke="#8A6A0E" />
                      <text x="49" y="219" textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize={numero.length > 2 ? 15 : 22} fill="#1A2A1F">{numero || iniciais.slice(0, 2)}</text>
                      <line x1="62" y1="199" x2="62" y2="221" stroke="#8A6A0E" />
                      <text x="90" y="216" textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize={tamNome} fill="#1A2A1F">{nomePlaca.slice(0, 11)}</text>
                      <circle cx="116" cy="300" r="20" fill="#1d2e24" />
                      <circle cx="116" cy="300" r="18.5" fill="#c3ccc6" />
                      <circle cx="116" cy="300" r="16.5" fill="#7d8a82" />
                      <circle cx="116" cy="300" r="15.5" fill="#121618" />
                      <g className="cf-roda">
                        {marcas}
                        <circle cx="116" cy="300" r="7.5" fill="#2a2f33" />
                        <circle cx="116" cy="300" r="7.5" fill="none" stroke="#6f7c74" strokeWidth="2" strokeDasharray="1.2 1.2" />
                        <circle cx="116" cy="300" r="4.5" fill="#3a4045" />
                      </g>
                      <path d="M116 284 l-2.4 -4 h4.8 z" fill="#C9A227" />
                      {logo ? (
                        <image href={logo} x="55" y="360" width="40" height="40" preserveAspectRatio="xMidYMid meet" opacity=".35" style={{ filter: 'grayscale(1)' }} />
                      ) : (
                        <g>
                          <circle cx="75" cy="380" r="20" fill="none" stroke="#4e6a58" strokeWidth="1.5" />
                          <text x="75" y="385" textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize="13" fill="#4e6a58">{sigla}</text>
                        </g>
                      )}
                      <g fill="#1d2e24"><path d="M28 422 h94 l-4 6 h-94z" /><path d="M28 434 h94 l-4 6 h-94z" /><path d="M28 446 h94 l-4 6 h-94z" /></g>
                    </svg>
                  </div>

                  {/* -------- dentro da porta -------- */}
                  <div className="cf-face cf-tras">
                    <button type="button" className="cf-obj cf-papel" onClick={() => onAbrir('treino')} aria-label="Treino de hoje"
                      style={{ left: 14, top: 14, width: 116, height: 58, padding: '9px 8px 6px', transform: 'rotate(-2deg)', textAlign: 'left' }}>
                      <span className="cf-iman" />
                      <small>Treino de hoje</small>
                      <div className="cf-mao" style={{ fontSize: treinoTxt.length > 20 ? 13.5 : 16, lineHeight: 1.05 }}>{treinoTxt}</div>
                    </button>

                    <button type="button" className="cf-obj cf-papel" onClick={() => onAbrir('competicao')} aria-label="Classificação"
                      style={{ left: 10, top: 117, width: 130, height: 70, padding: '6px 6px 5px', transform: 'rotate(1.5deg)', textAlign: 'left' }}>
                      <span className="cf-iman" />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 600, color: '#6b5e45', marginBottom: 2 }}>
                        <Trophy size={11} color="#8A6A0E" /> Classificação
                      </div>
                      {tabela.length ? tabela.map(l => (
                        <div key={l.pos} style={{ display: 'grid', gridTemplateColumns: '14px 1fr auto', gap: 3, fontSize: 10, padding: '1px 3px', background: l.nos ? '#C9A227' : 'transparent', borderRadius: 2 }}>
                          <span>{l.pos}</span>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', fontWeight: l.nos ? 600 : 400, fontSize: l.nome.length > 17 ? 8 : l.nome.length > 14 ? 9 : 10, alignSelf: 'center' }}>{l.nome}</span>
                          <span>{l.pts}</span>
                        </div>
                      )) : (
                        <div className="cf-mao" style={{ fontSize: 16, marginTop: 6 }}>Ainda sem tabela</div>
                      )}
                    </button>

                    <button type="button" className="cf-obj" onClick={() => onAbrir('tarefas')} aria-label={`Tarefas${nT ? `: ${nT} por fazer` : ''}`}
                      style={{ left: 16, top: 234, width: 118, height: 78 }}>
                      <div style={{ background: '#6b4a2e', borderRadius: 4, padding: '14px 6px 6px', position: 'relative', height: 60, boxSizing: 'border-box', textAlign: 'left', overflow: 'hidden' }}>
                        <span style={{ position: 'absolute', top: -3, left: 45, width: 28, height: 8, background: '#9aa69e', borderRadius: 2 }} />
                        {postits.length ? postits.map((p, k) => (
                          <span key={k} className="cf-mao" style={{
                            display: 'inline-block', width: 50, maxHeight: 34, verticalAlign: 'top', overflow: 'hidden', lineHeight: 1,
                            background: k ? '#9FE1CB' : '#F2D35B', color: k ? '#04342C' : '#3a2e05', fontSize: 13, padding: '2px 4px', marginRight: 4,
                            transform: `rotate(${k ? 3 : -4}deg)`,
                          }}>{p}</span>
                        )) : (
                          <span className="cf-mao" style={{ display: 'inline-block', alignSelf: 'flex-start', background: '#dfe9d6', color: '#27500A', fontSize: 13.5, padding: '1px 6px', whiteSpace: 'nowrap', transform: 'rotate(-2deg)' }}>Missão cumprida</span>
                        )}
                      </div>
                      {nT > 0 && (
                        <span style={{ position: 'absolute', top: -8, right: -6, minWidth: 18, height: 18, borderRadius: 9, background: '#D14056', color: '#fff', fontSize: 10.5, fontWeight: 600, display: 'grid', placeItems: 'center', padding: '0 4px', boxSizing: 'border-box' }}>{nT}</span>
                      )}
                      <div className="cf-lab" style={{ marginTop: 4 }}>Tarefas</div>
                    </button>

                    <button type="button" className="cf-obj" onClick={() => onAbrir('desenvolvimento')} aria-label="Desenvolvimento"
                      style={{ left: 12, top: 357, width: 126, height: 104, background: '#1d2a22', border: '1px solid #4e6a58', borderRadius: 6, padding: 6, boxSizing: 'border-box' }}>
                      <svg width="74" height="64" viewBox="0 0 84 74" style={{ display: 'block', margin: '0 auto' }} aria-hidden="true">
                        <g fill="none" stroke="#4e6a58"><polygon points="42,4 78,28 64,70 20,70 6,28" /><polygon points="42,20 62,33 54,58 30,58 22,33" /></g>
                        <polygon points="42,10 70,30 56,62 26,58 16,32" fill="#C9A22755" stroke="#C9A227" strokeWidth="1.5" />
                        <polygon points="42,16 64,32 50,58 32,62 20,30" fill="none" stroke="#9FE1CB" strokeWidth="1.2" strokeDasharray="3 2" />
                      </svg>
                      <div className="cf-lab">Desenvolvimento</div>
                      <div className="cf-mini" style={{ color: devFalta ? '#F2D35B' : '#9FE1CB' }}>{devTxt}</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* JOGOS, DENTRO DO PORTAL — três separadores independentes:
   Convocatórias, Plano de Jogo, Adversário. Cada um vem de uma função
   própria no servidor (checkin_convocatoria / checkin_plano_jogo /
   checkin_adversario), pela mesma razão de sempre: o atleta nunca lê as
   tabelas diretamente, só o que o treinador marcou como visível. */
function PlayerJogosHome({ code, teamId, onBack, jogadorId, logo, infoJogo }) {
  const [subTab, setSubTab] = useState('convocatorias');
  const abas = [
    { id: 'convocatorias', label: 'Convocatória' },
    { id: 'planoJogo', label: 'Plano de Jogo' },
    { id: 'adversario', label: 'Adversário' },
  ];
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
        borderRadius: 8, color: T.cream, padding: '8px 14px', cursor: 'pointer', ...body, fontSize: 13.5, marginBottom: 20,
      }}>
        <ChevronLeft size={15} /> Voltar
      </button>

      <div style={{ ...display, fontSize: 18, color: T.cream, marginBottom: 12 }}>Jogo</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {abas.map(a => {
          const on = subTab === a.id;
          return (
            <button key={a.id} onClick={() => setSubTab(a.id)} style={{
              flex: 1, padding: '9px 8px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', ...body,
              background: on ? '#B5393F' : 'transparent', color: on ? TEXT_ON_ACCENT : T.muted,
              border: `1px solid ${on ? '#B5393F' : T.line}`, whiteSpace: 'nowrap', textAlign: 'center',
            }}>{a.label}</button>
          );
        })}
      </div>

      {subTab === 'convocatorias' && <PlayerConvocatoriasTab code={code} teamId={teamId} jogadorId={jogadorId} logo={logo} infoJogo={infoJogo} />}
      {subTab === 'planoJogo' && <PlayerPlanoJogoTab code={code} teamId={teamId} />}
      {subTab === 'adversario' && <PlayerAdversarioTab code={code} teamId={teamId} />}
    </div>
  );
}

/* COMPETIÇÃO, DO LADO DO ATLETA — classificação + jornadas da competição
   (mesma tabela que o staff configura em Jogos › Competições e
   jornadas), mais as PRÓPRIAS estatísticas de competição do atleta.

   Só consulta, nunca edição — tal como o resto do Portal. A função do
   servidor (`checkin_competicao`) já devolve as estatísticas calculadas
   e reduzidas ao próprio atleta: nunca chega ao browser o relatório de
   outro colega, mesmo que ele apareça na mesma lista de convocados —
   foi escolha explícita não comparar atletas entre si aqui, ao
   contrário do "Estatísticas" que o staff vê no separador Jogos, que é
   do plantel todo. */
function PlayerCompeticaoView({ code, teamId, onBack, foco }) {
  const [estado, dados] = usePortalFetch('checkin_competicao', code, teamId);
  /* Vindo da caixa das chuteiras (cacifo): mostra SÓ as estatísticas do
     jogador — sem a classificação nem as jornadas por cima. */
  const soEstatisticas = foco === 'estatisticas';
  const isNarrow = useIsMobile(560);
  const [viewId, setViewId] = useState(null);
  const [roundIdx, setRoundIdx] = useState(0);

  const { competitions } = normalizeStandings(dados && dados.standings);
  const comp = competitions.find(c => c.id === viewId) || activeCompetitionOf(dados && dados.standings);
  const teams = competitionTable(comp);
  const rounds = (comp && comp.rounds) || [];
  const round = rounds[roundIdx];
  const nossoClube = (dados && dados.clube) || '';
  const est = (dados && dados.estatisticas) || null;

  /* Antes de pintar (useLayoutEffect): abre logo na jornada mais recente.
     Com useEffect via-se primeiro a Jornada 1 e só depois saltava para a
     certa — os nomes das equipas "piscavam". */
  React.useLayoutEffect(() => {
    const hoje = todayStr();
    let melhorIdx = 0, melhorData = null;
    rounds.forEach((r, i) => {
      (r.games || []).forEach(g => {
        if (g.date && g.date <= hoje && (melhorData == null || g.date > melhorData)) { melhorData = g.date; melhorIdx = i; }
      });
    });
    setRoundIdx(melhorIdx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comp && comp.id]);
  React.useLayoutEffect(() => {
    if (roundIdx >= rounds.length && rounds.length > 0) setRoundIdx(rounds.length - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounds.length]);

  const isUs = (t) => {
    if (!nossoClube || !t || !t.name) return false;
    const a = String(t.name).toLowerCase(), b = nossoClube.toLowerCase();
    return a === b || a.includes(b) || b.includes(a);
  };

  const voltar = (
    <button onClick={onBack} style={{
      display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
      borderRadius: 8, color: T.cream, padding: '8px 14px', cursor: 'pointer', ...body, fontSize: 13.5, marginBottom: 20,
    }}>
      <ChevronLeft size={15} /> Voltar
    </button>
  );

  if (estado === 'a-carregar') {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
        {voltar}
        <div className="mjp-carregar" style={{ fontSize: 13, color: T.mutedDim }}>A carregar…</div>
      </div>
    );
  }
  if (estado === 'erro') {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
        {voltar}
        <div style={{ fontSize: 13, color: T.bad }}>Não foi possível carregar. Tenta outra vez ou fala com o staff.</div>
      </div>
    );
  }

  const nome = splitCompetitionName((comp && comp.name) || 'Competição');

  const hasData = teams.length > 0 || rounds.length > 0;

  const dataCurta = (d) => (d
    ? (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : d)
    : '');

  const tileEstat = (value, label, help) => (
    <div title={help} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: isNarrow ? '14px 10px' : '14px 6px', textAlign: 'center' }}>
      <div style={{ ...display, fontSize: 22, color: T.warn, fontWeight: 600, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: T.mutedDim, marginTop: 5, textTransform: 'uppercase', letterSpacing: '.03em' }}>{label}</div>
    </div>
  );

  const blocoEstatisticas = (
    <>
      {!soEstatisticas && (
        <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
          As tuas estatísticas na competição
        </div>
      )}
      {!est || est.jogos === 0 ? (
        <EmptyState text="Ainda sem jogos de competição registados." />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isNarrow ? 'repeat(auto-fill, minmax(96px, 1fr))' : 'repeat(9, 1fr)',
          gap: 10,
          maxWidth: isNarrow ? 720 : '100%',
        }}>
          {tileEstat(est.jogos, 'Convocatórias')}
          {tileEstat(est.titular, 'Titular')}
          {tileEstat(est.suplenteUtilizado, 'Suplente uti', 'Jogos em que entrou vindo do banco')}
          {tileEstat(est.minutos, 'Minutos')}
          {tileEstat(est.golos, 'Golos')}
          {tileEstat(est.assistencias, 'Assistências')}
          {tileEstat(est.amarelos, 'Amarelos')}
          {tileEstat(est.vermelhos, 'Vermelhos')}
          {tileEstat(est.notaMedia ?? '—', 'Nota média')}
        </div>
      )}
    </>
  );

  if (soEstatisticas) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
        {voltar}
        <div style={{ ...display, fontSize: 20, color: T.cream, marginBottom: 4 }}>As tuas estatísticas</div>
        <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 20 }}>{nome.title ? `${nome.title}${nome.subtitle ? ` · ${nome.subtitle}` : ''}` : 'Competição'}</div>
        {blocoEstatisticas}
      </div>
    );
  }
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
      {voltar}

      <div style={{ ...display, fontSize: 20, color: T.cream, marginBottom: 4 }}>{nome.title || 'Competição'}</div>
      {nome.subtitle && <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 20 }}>{nome.subtitle}</div>}
      {!nome.subtitle && <div style={{ marginBottom: 20 }} />}

      {competitions.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
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

      {!hasData ? (
        <EmptyState text="Ainda sem competição partilhada. Fala com a equipa técnica." />
      ) : (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, marginBottom: 28 }}>
          {rounds.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 10 }}>
                <button onClick={() => setRoundIdx(i => Math.max(0, i - 1))} disabled={roundIdx === 0}
                  style={{ background: 'none', border: 'none', color: roundIdx === 0 ? T.mutedDim : T.cream, cursor: roundIdx === 0 ? 'default' : 'pointer' }}>
                  <ChevronLeft size={18} />
                </button>
                <span style={{ ...display, fontSize: 14, color: T.cream, textTransform: 'uppercase', letterSpacing: '.06em' }}>{round?.label || `Jornada ${roundIdx + 1}`}</span>
                <button onClick={() => setRoundIdx(i => Math.min(rounds.length - 1, i + 1))} disabled={roundIdx === rounds.length - 1}
                  style={{ background: 'none', border: 'none', color: roundIdx === rounds.length - 1 ? T.mutedDim : T.cream, cursor: roundIdx === rounds.length - 1 ? 'default' : 'pointer' }}>
                  <ChevronRight size={18} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(round?.games || []).map((g, i, jogos) => {
                  const mostraData = i === 0 || g.date !== jogos[i - 1].date;
                  const nomeEquipa = (nomeTxt, lado) => {
                    const somosNos = /salgueiros/i.test(nomeTxt || '');
                    return (
                      <span style={{
                        minWidth: 0, textAlign: lado, color: T.cream, opacity: somosNos ? 1 : 0.72, // a nossa equipa: branco e negrito; as outras, um pouco esbatidas
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        fontWeight: somosNos ? 800 : 400,
                      }} title={nomeTxt}>{nomeTxt}</span>
                    );
                  };
                  const confronto = (
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
                      columnGap: 8, width: '100%', maxWidth: 420, margin: '0 auto',
                    }}>
                      {nomeEquipa(g.home, 'right')}
                      <span style={{ ...mono, color: T.gold, flexShrink: 0 }}>{g.score || 'vs'}</span>
                      {nomeEquipa(g.away, 'left')}
                    </div>
                  );
                  return (
                    <div key={g.id || i}>
                      {isNarrow && mostraData && dataCurta(g.date) && (
                        <div style={{ ...mono, fontSize: 11, color: T.mutedDim, textAlign: 'center', margin: '8px 0 2px' }}>
                          {dataCurta(g.date)}
                        </div>
                      )}
                      {isNarrow ? (
                        <div style={{ padding: '6px 10px', fontSize: 13, borderBottom: `1px solid ${T.line}` }}>
                          {confronto}
                        </div>
                      ) : (
                        <div style={{
                          display: 'grid', gridTemplateColumns: '40px 1fr 40px', alignItems: 'center',
                          gap: 10, padding: '6px 10px', fontSize: 13, borderBottom: `1px solid ${T.line}`,
                        }}>
                          <span style={{ ...mono, fontSize: 11, color: T.mutedDim }}>
                            {mostraData ? dataCurta(g.date) : ''}
                          </span>
                          {confronto}
                          <span aria-hidden="true" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {teams.length > 0 && (
            <div className="mjp-scroll-fino" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, tableLayout: 'fixed', minWidth: 460 }}>
                <thead>
                  <tr style={{ color: T.mutedDim, ...mono, fontSize: 11 }}>
                    <th style={{ textAlign: 'left', padding: '4px 6px', width: 30 }}>#</th>
                    <th style={{ textAlign: 'left', padding: '4px 6px' }}>Equipa</th>
                    {['P', 'J', 'V', 'E', 'D', 'GM', 'GS', 'DG'].map(h => (
                      <th key={h} style={{ padding: '4px 6px', width: 34 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t, i) => {
                    const nossa = isUs(t);
                    return (
                      <tr key={t.id} style={{ color: nossa ? T.gold : T.cream, background: nossa ? `${T.crimson}22` : 'transparent', borderTop: `1px solid ${T.line}` }}>
                        <td style={{ padding: '5px 6px 5px 9px', ...mono, ...estiloZona(comp, i, teams.length) }}>{i + 1}</td>
                        <td
                          title={t.name}
                          style={{
                            padding: '5px 6px', fontWeight: nossa ? 600 : 400,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 0,
                          }}
                        >{t.name}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono, fontWeight: 600 }}>{t.P}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono }}>{t.J}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono }}>{t.V}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono }}>{t.E}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono }}>{t.D}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono }}>{t.GM}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono }}>{t.GS}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono }}>{t.DG > 0 ? `+${t.DG}` : t.DG}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <LegendaZonas comp={comp} />
            </div>
          )}
        </div>
      )}

      {blocoEstatisticas}
    </div>
  );
}

/* DESENVOLVIMENTO, DO LADO DO ATLETA — a autoavaliação do Desenvolvimento
   Individual (as mesmas 30 perguntas, os mesmos 6 blocos, a mesma escala
   1-5, reutilizando o `DiQuestionario` já existente do lado do staff).

   Regras deste ecrã:
   · Mostra sempre o momento de avaliação mais recente que tenha uma linha
     de registo para este atleta (a função do servidor já filtra isso).
   · Cada resposta grava-se sozinha, assim que é dada — nada fica só na
     memória do telemóvel à espera de um "Guardar" no fim.
   · Só depois de as 30 estarem respondidas aparece o botão "Submeter",
     com uma confirmação a avisar que deixa de poder editar.
   · Depois de submetido (`enviado`), fica um ecrã de agradecimento — a
     pergunta não volta a aparecer aqui. Quando o staff cria um NOVO
     momento, esse é que passa a ser "o mais recente com registo", e a
     pergunta volta a aparecer, para esse momento.
   · O bloqueio depois de submetido é IMPOSTO NO SERVIDOR (a função
     `checkin_desenvolvimento_responder` recusa qualquer escrita depois
     de `enviado = true`), não só escondido na interface — para não
     bastar reabrir a página antiga para voltar a editar.

   (REVISTO) RESPONDE-SE DE UMA VEZ E SUBMETE-SE. Antes cada resposta
   gravava-se logo no servidor — o atleta podia sair a meio e ir mudando
   respostas ao longo dos dias (e a equipa técnica via essas mudanças a
   acontecer). Agora:
   · As respostas ficam só no telemóvel até ao "Submeter": nada chega à
     equipa técnica antes disso, e o que chega é a versão final.
   · Não se sai a meio sem aviso: "Voltar"/fechar pergunta "se saíres
     agora, as respostas perdem-se" — ou se continua e submete, ou se
     sai e recomeça do zero noutra altura. Fechar o separador também
     avisa (o browser pergunta).
   · Ao submeter, as 30 respostas vão de uma vez e o momento fica
     fechado (o servidor continua a recusar mudanças depois). */
function PlayerDesenvolvimentoView({ code, teamId, onBack, onSubmetido }) {
  const [estado, dados] = usePortalFetch('checkin_desenvolvimento', code, teamId);
  const [auto, setAuto] = useState(null);
  const [enviado, setEnviado] = useState(null);
  const [confirmar, setConfirmar] = useState(false);
  const [aSubmeter, setASubmeter] = useState(false);
  const [erro, setErro] = useState('');
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const fecharDepoisRef = useRef(false);

  useEffect(() => {
    if (dados && dados.registoId && auto === null) {
      setAuto(dados.auto || {});
      setEnviado(!!dados.enviado);
    }
  }, [dados, auto]);

  // A meio do questionário (algo respondido, ainda não submetido)?
  const aMeio = !!(auto && !enviado && diRespondido(auto) > 0);
  // Fechar o separador / recarregar a meio: o browser pede confirmação.
  useEffect(() => {
    if (!aMeio) return undefined;
    const aoSair = (e) => { e.preventDefault(); e.returnValue = ''; return ''; };
    window.addEventListener('beforeunload', aoSair);
    return () => window.removeEventListener('beforeunload', aoSair);
  }, [aMeio]);
  /* SUBMETER É SEMPRE DO JOGADOR: responder à última pergunta já não
     submete sozinho. Se tentar FECHAR com tudo respondido, avisa que as
     respostas vão ser submetidas — e, se aceitar, submete e fecha. */
  const completo = !!(auto && !enviado && diRespondido(auto) === DI_INDICADORES.length);
  const [confirmarFechoCompleto, setConfirmarFechoCompleto] = useState(false);
  const tentarSair = () => {
    if (completo) { setConfirmarFechoCompleto(true); return; }
    if (aMeio) setConfirmarSaida(true); else onBack();
  };
  const autoSubmeter = false;
  const confirmarSubmissaoRef = useRef(null);

  const voltar = (
    <button onClick={onBack} style={{
      display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
      borderRadius: 8, color: T.cream, padding: '8px 14px', cursor: 'pointer', ...body, fontSize: 13.5, marginBottom: 20,
    }}>
      <ChevronLeft size={15} /> Voltar
    </button>
  );

  if (estado === 'a-carregar') {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
        {voltar}
        <div className="mjp-carregar" style={{ fontSize: 13, color: T.mutedDim }}>A carregar…</div>
      </div>
    );
  }
  if (estado === 'erro') {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
        {voltar}
        <div style={{ fontSize: 13, color: T.bad }}>Não foi possível carregar. Tenta outra vez ou fala com o staff.</div>
      </div>
    );
  }

  if (!dados || !dados.momento || !dados.registoId) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
        {voltar}
        <EmptyState text="Não há nenhuma autoavaliação aberta para ti neste momento. Se tens uma tarefa de autoavaliação por fazer, avisa a equipa técnica: o teu nome pode não estar no momento de avaliação." />
      </div>
    );
  }

  // Os dados já chegaram (estado === 'pronto'), mas `auto`/`enviado` só
  // ficam preenchidos no efeito a seguir a este render — sem esta
  // guarda, havia um instante em que se tentava mostrar o questionário
  // com `respostas={null}` (0 de 30, tudo por responder) antes de saber
  // que afinal já tinha sido submetido. Era esse instante a mais que se
  // via como um "piscar" ao entrar de novo neste ecrã.
  if (auto === null) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
        {voltar}
        <div className="mjp-carregar" style={{ fontSize: 13, color: T.mutedDim }}>A carregar…</div>
      </div>
    );
  }

  if (enviado) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
        {voltar}
        <EmptyState text="Obrigado! Já respondeste a este momento de avaliação." />
      </div>
    );
  }

  // Só no telemóvel — chega ao servidor tudo junto, no "Submeter".
  const gravarResposta = (indId, valor) => {
    setAuto(prev => ({ ...(prev || {}), [indId]: valor === undefined ? null : valor }));
    setErro('');
  };

  const confirmarSubmissao = async () => {
    setASubmeter(true);
    setErro('');
    setConfirmarFechoCompleto(false);
    try {
      // 1) as respostas todas de uma vez; 2) fecha o momento.
      const r1 = await supabase.rpc('checkin_desenvolvimento_responder', {
        p_code: code, p_team: teamId, p_registo_id: dados.registoId,
        p_auto: auto || {}, p_submeter: false,
      });
      if (r1.error || !(r1.data && r1.data.ok)) throw (r1.error || new Error('recusado'));
      // As respostas vão também no passo que submete: se o servidor
      // gravasse o `p_auto` deste passo por cima, um objeto vazio apagava
      // tudo o que o jogador respondeu.
      const { data, error } = await supabase.rpc('checkin_desenvolvimento_responder', {
        p_code: code, p_team: teamId, p_registo_id: dados.registoId,
        p_auto: auto || {}, p_submeter: true,
      });
      if (error || !(data && data.ok)) throw (error || new Error('recusado'));
      setEnviado(true);
      if (onSubmetido) onSubmetido(); // missão "Autoavaliação" fecha-se sozinha
      setConfirmar(false);
      /* Submetido = feito: volta logo para dentro (o balneário, ou Tarefas
         se veio de lá), com o "Missão cumprida" por cima. Já não fica no
         ecrã do questionário. */
      fecharDepoisRef.current = false;
      onBack();
    } catch (e) {
      setErro('Não foi possível submeter. Tenta outra vez.');
    } finally {
      setASubmeter(false);
    }
  };

  confirmarSubmissaoRef.current = confirmarSubmissao;
  const respondidos = diRespondido(auto);
  const podeSubmeter = respondidos === DI_INDICADORES.length;

  return (
    <>
      <DiQuestionario
        titulo="Autoavaliação"
        subtitulo={dados.momento.nome}
        posicao={dados.posicao}
        respostas={auto}
        permitirNA={false}
        onChange={gravarResposta}
        onClose={tentarSair}
        onSubmeter={() => setConfirmar(true)}
        podeSubmeter={podeSubmeter}
        aSubmeter={aSubmeter}
      />
      {erro && (
        <div style={{
          position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 70,
          background: T.surfaceRaise, border: `1px solid ${T.bad}`, color: T.bad, borderRadius: 8,
          padding: '9px 16px', fontSize: 12.5, ...body,
        }}>{erro}</div>
      )}
      {autoSubmeter && !enviado && (
        <div style={{
          position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 70,
          background: T.surfaceRaise, border: `1px solid ${T.good}`, color: T.good, borderRadius: 8,
          padding: '10px 18px', fontSize: 13, ...body, display: 'flex', alignItems: 'center', gap: 8,
        }}><Loader2 size={14} className="animate-spin" /> Todas respondidas — a submeter…</div>
      )}
      {confirmarFechoCompleto && (
        <div style={{
          position: 'fixed', inset: 0, background: '#000000aa', zIndex: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{ background: T.surfaceRaise, border: `1px solid ${T.line}`, borderRadius: 10, padding: 20, maxWidth: 400, width: '100%' }}>
            <div style={{ ...display, fontSize: 16, color: T.cream, marginBottom: 8 }}>Já respondeste a todas as perguntas</div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 18, lineHeight: 1.5 }}>
              Se fechares agora, as tuas respostas são submetidas e já não as podes alterar.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <Btn variant="ghost" onClick={() => setConfirmarFechoCompleto(false)} disabled={aSubmeter}>Continuar a rever</Btn>
              <Btn onClick={() => { fecharDepoisRef.current = true; confirmarSubmissao(); }} disabled={aSubmeter}>
                <Check size={15} /> {aSubmeter ? 'A submeter…' : 'Submeter e fechar'}
              </Btn>
            </div>
          </div>
        </div>
      )}
      {confirmarSaida && (
        <div style={{
          position: 'fixed', inset: 0, background: '#000000aa', zIndex: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{ background: T.surfaceRaise, border: `1px solid ${T.line}`, borderRadius: 10, padding: 20, maxWidth: 380, width: '100%' }}>
            <div style={{ ...display, fontSize: 16, color: T.cream, marginBottom: 8 }}>Ainda não submeteste</div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 18, lineHeight: 1.5 }}>
              Respondeste a {diRespondido(auto)} de {DI_INDICADORES.length}. As respostas só contam depois de submeteres —
              se saíres agora, perdem-se e tens de começar de novo.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <Btn variant="ghost" onClick={() => { setConfirmarSaida(false); onBack(); }}>Sair e perder</Btn>
              <Btn onClick={() => setConfirmarSaida(false)}>Continuar a responder</Btn>
            </div>
          </div>
        </div>
      )}
      {confirmar && (
        <div style={{
          position: 'fixed', inset: 0, background: '#000000aa', zIndex: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{ background: T.surfaceRaise, border: `1px solid ${T.line}`, borderRadius: 10, padding: 20, maxWidth: 380, width: '100%' }}>
            <div style={{ ...display, fontSize: 16, color: T.cream, marginBottom: 8 }}>Submeter respostas?</div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 18, lineHeight: 1.5 }}>
              Depois de submeteres não podes voltar a editar nenhuma resposta desta autoavaliação.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Btn variant="ghost" onClick={() => setConfirmar(false)} disabled={aSubmeter}>Cancelar</Btn>
              <Btn onClick={confirmarSubmissao} disabled={aSubmeter}>{aSubmeter ? 'A submeter…' : 'Confirmar'}</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* TAREFAS, DO LADO DO ATLETA — as tarefas que a equipa técnica lhe
   atribuiu (campo `jogadorId`, à parte do "Responsável", que é sempre
   alguém do staff). O atleta só consulta e pode escrever uma nota;
   nunca muda o estado, o prazo, nem apaga — isso continua a ser só do
   staff, em Tarefas.

   A lista já vem pronta do `CheckinKiosk` (o mesmo pedido serve para a
   notificação do ecrã inicial e para este ecrã — não faz sentido pedir
   duas vezes a mesma coisa). Aqui só se guarda localmente a nota que
   vai sendo escrita, otimista, e grava-se ao perder o foco do campo. */
function PlayerTarefasView({ code, teamId, onBack, tarefas, estado, tarefaAbrirId, onTarefaAberta, onNotaGravada, onIrMissao }) {
  const [abertaId, setAbertaId] = useState(null);
  // Gesto de retroceder com uma tarefa aberta: volta à lista das Tarefas.
  useKioskVoltar(!!abertaId, () => setAbertaId(null));
  const [notas, setNotas] = useState({}); // id -> texto local (por cima do que veio do servidor)
  const [aGravar, setAGravar] = useState({});
  const [submetidas, setSubmetidas] = useState({}); // id -> true, depois de submetida nesta sessão
  const [confirmar, setConfirmar] = useState(false);
  const [aSubmeter, setASubmeter] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (tarefaAbrirId) {
      setAbertaId(tarefaAbrirId);
      if (onTarefaAberta) onTarefaAberta();
    }
  }, [tarefaAbrirId]); // eslint-disable-line react-hooks/exhaustive-deps

  const voltar = (label, onClick) => (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
      borderRadius: 8, color: T.cream, padding: '8px 14px', cursor: 'pointer', ...body, fontSize: 13.5, marginBottom: 20,
    }}>
      <ChevronLeft size={15} /> {label}
    </button>
  );

  if (estado === 'a-carregar') {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
        {voltar('Voltar', onBack)}
        <div className="mjp-carregar" style={{ fontSize: 13, color: T.mutedDim }}>A carregar…</div>
      </div>
    );
  }
  if (estado === 'erro') {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
        {voltar('Voltar', onBack)}
        <div style={{ fontSize: 13, color: T.bad }}>Não foi possível carregar. Tenta outra vez ou fala com o staff.</div>
      </div>
    );
  }

  const lista = tarefas || [];
  const aberta = lista.find(t => t.id === abertaId);

  const gravarNota = async (tarefaId, texto) => {
    setAGravar(prev => ({ ...prev, [tarefaId]: true }));
    setErro('');
    try {
      const { data, error } = await supabase.rpc('checkin_tarefa_nota', {
        p_code: code, p_team: teamId, p_tarefa_id: tarefaId, p_nota: texto, p_submeter: false,
      });
      if (error || !(data && data.ok)) throw (error || new Error('recusado'));
      // Sem isto, sair de Tarefas e voltar a entrar mostrava outra vez a
      // nota antiga — o pedido ao servidor só acontece uma vez, quando o
      // quiosque abre, e não se repete sozinho.
      if (onNotaGravada) onNotaGravada(tarefaId, { notaAtleta: texto });
    } catch (e) {
      setErro('A nota não ficou guardada. Tenta outra vez.');
    } finally {
      setAGravar(prev => ({ ...prev, [tarefaId]: false }));
    }
  };

  if (aberta) {
    const notaAtual = notas[aberta.id] !== undefined ? notas[aberta.id] : (aberta.notaAtleta || '');
    const submetida = submetidas[aberta.id] !== undefined ? submetidas[aberta.id] : !!aberta.notaSubmetida;
    const podeSubmeter = notaAtual.trim().length > 0;

    const confirmarSubmissao = async () => {
      setASubmeter(true);
      setErro('');
      try {
        const { data, error } = await supabase.rpc('checkin_tarefa_nota', {
          p_code: code, p_team: teamId, p_tarefa_id: aberta.id, p_nota: notaAtual, p_submeter: true,
        });
        if (error || !(data && data.ok)) throw (error || new Error('recusado'));
        setSubmetidas(prev => ({ ...prev, [aberta.id]: true }));
        if (onNotaGravada) onNotaGravada(aberta.id, { notaAtleta: notaAtual, notaSubmetida: true });
        setConfirmar(false);
      } catch (e) {
        setErro('Não foi possível submeter. Tenta outra vez.');
      } finally {
        setASubmeter(false);
      }
    };

    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '28px 24px 60px' }}>
        {voltar('Tarefas', () => setAbertaId(null))}
        <div style={{ ...display, fontSize: 19, color: T.cream, marginBottom: 4 }}>{aberta.titulo}</div>
        {aberta.prazo && (
          <div style={{ fontSize: 12, color: T.mutedDim, marginBottom: 16 }}>
            {submetida ? 'Prazo: ' : 'Tens até '}{fmtDate(aberta.prazo)}{!submetida && ' para submeter a tua nota.'}
          </div>
        )}
        {!aberta.prazo && <div style={{ marginBottom: 16 }} />}

        {aberta.notas && (
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14, marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: T.mutedDim, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
              Notas da equipa técnica
            </div>
            <div style={{ fontSize: 13.5, color: T.cream, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{aberta.notas}</div>
          </div>
        )}

        {submetida ? (
          <>
            <Field label="A tua nota" solto>
              <div style={{
                background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: '10px 12px',
                fontSize: 13.5, color: T.cream, whiteSpace: 'pre-wrap', lineHeight: 1.5, minHeight: 60,
              }}>{notaAtual || '—'}</div>
            </Field>
            <div style={{ fontSize: 11.5, color: T.good, marginTop: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Check size={13} /> Já submetida — não podes voltar a editar.
            </div>
          </>
        ) : (
          <>
            <Field label="A tua nota" solto>
              <TextArea
                value={notaAtual}
                onChange={e => setNotas(prev => ({ ...prev, [aberta.id]: e.target.value }))}
                onBlur={() => gravarNota(aberta.id, notaAtual)}
                placeholder="Escreve aqui o que quiseres dizer sobre esta tarefa."
                style={{ minHeight: 120 }}
              />
            </Field>
            {/* O BOTÃO NÃO PODE FUGIR DO DEDO. Antes, ao carregar em Submeter
                com o cursor ainda no texto, o campo perdia o foco, gravava, e
                a frase de baixo mudava para "A guardar…" (mais curta): os
                botões saltavam de linha a meio do clique, e o clique perdia-se
                (era preciso carregar duas vezes). Agora: a frase tem uma linha
                só para ela, de altura fixa; os botões ficam sempre no mesmo
                sítio; e carregar neles já não tira o foco ao texto (o
                Submeter envia a nota de qualquer forma). */}
            <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 8, minHeight: 34, lineHeight: 1.45 }}>
              {aGravar[aberta.id] ? 'A guardar…' : 'Guarda-se sozinho ao saíres do campo. Podes continuar mais tarde.'}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Btn variant="ghost" onMouseDown={e => e.preventDefault()} onClick={(ev) => { gravarNota(aberta.id, notaAtual); ev.currentTarget.blur(); }} disabled={aGravar[aberta.id]}>
                Guardar
              </Btn>
              <Btn onMouseDown={e => e.preventDefault()} onClick={(ev) => { setConfirmar(true); ev.currentTarget.blur(); }} disabled={!podeSubmeter}>
                <Check size={15} /> Submeter
              </Btn>
            </div>
          </>
        )}
        {erro && <div style={{ fontSize: 12.5, color: T.bad, marginTop: 10 }}>{erro}</div>}

        {confirmar && (
          <div style={{
            position: 'fixed', inset: 0, background: '#000000aa', zIndex: 60,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}>
            <div style={{ background: T.surfaceRaise, border: `1px solid ${T.line}`, borderRadius: 10, padding: 20, maxWidth: 380, width: '100%' }}>
              <div style={{ ...display, fontSize: 16, color: T.cream, marginBottom: 8 }}>Submeter a nota?</div>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 18, lineHeight: 1.5 }}>
                Depois de submeteres não podes voltar a editar esta nota. A equipa técnica vai poder lê-la.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <Btn variant="ghost" onClick={(ev) => { setConfirmar(false); ev.currentTarget.blur(); }} disabled={aSubmeter}>Cancelar</Btn>
                <Btn onClick={confirmarSubmissao} disabled={aSubmeter}>{aSubmeter ? 'A submeter…' : 'Confirmar'}</Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
      {voltar('Voltar', onBack)}
      <div style={{ ...display, fontSize: 20, color: T.cream, marginBottom: 4 }}>Tarefas</div>
      <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 22 }}>Tarefas que a equipa técnica te atribuiu.</div>

      {lista.length === 0 ? (
        <EmptyState text="Ainda não tens nenhuma tarefa atribuída." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lista.map(t => {
            const feita = t.estado === 'feita';
            return (
              <button key={t.id} onClick={() => {
                // Tarefa com destino (autoavaliação, wellness…): vai direto
                // ao sítio onde se faz, não ao editor de notas.
                if (onIrMissao && t.destino && t.destino !== 'nota' && t.estado !== 'feita' && !t.notaSubmetida) onIrMissao(t);
                else setAbertaId(t.id);
              }} style={{
                display: 'flex', alignItems: 'flex-start', gap: 11, textAlign: 'left', width: '100%',
                padding: '12px 14px', background: T.surface, borderRadius: 10, border: `1px solid ${T.line}`, cursor: 'pointer', ...body,
              }}>
                <span style={{
                  width: 17, height: 17, borderRadius: 5, flexShrink: 0, marginTop: 2,
                  background: feita ? T.good : 'transparent', border: `1.5px solid ${feita ? T.good : T.line}`,
                  display: 'grid', placeItems: 'center',
                }}>{feita && <Check size={11} style={{ color: T.sobreVerde }} />}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: 13.5, color: feita ? T.mutedDim : T.cream, lineHeight: 1.45, display: 'block',
                    textDecoration: feita ? 'line-through' : 'none',
                  }}>{t.titulo}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                    {t.prazo && <span style={{ ...mono, fontSize: 11, color: T.mutedDim }}>{fmtDate(t.prazo)}</span>}
                    {t.notaSubmetida ? (
                      <span style={{ fontSize: 11, color: T.good, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Check size={11} /> concluído
                      </span>
                    ) : t.notaAtleta && (
                      <span style={{ fontSize: 11, color: T.gold, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <FileText size={11} /> rascunho por submeter
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight size={16} color={T.mutedDim} style={{ flexShrink: 0, marginTop: 2 }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* AUTOAVALIAÇÃO COMPLETA = SUBMETIDA. Se as 30 respostas já estão todas
   dadas e o momento ainda não foi submetido (casos de antes desta regra:
   atletas que responderam a tudo mas nunca carregaram em "Submeter"),
   submete-se sozinho. Corre ao entrar no Portal (o atleta entra todos os
   dias para o wellness), por isso estes casos fecham-se sem ele ter de
   voltar ao Desenvolvimento. Devolve true se submeteu. */
async function submeterAutoavaliacaoSeCompleta(code, teamId, dadosConhecidos) {
  try {
    let d = dadosConhecidos;
    if (!d) {
      const { data, error } = await supabase.rpc('checkin_desenvolvimento', { p_code: code, p_team: teamId });
      if (error) return false;
      d = Array.isArray(data) ? data[0] : data;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return false; } }
    }
    if (!d || !d.registoId) return false;
    // Já submetida (pelo jogador noutro dia, ou pela equipa técnica em
    // Desenvolvimento): conta como feita, para a missão "Autoavaliação"
    // do Portal fechar também.
    if (d.enviado) {
      // Só conta como feita se houver mesmo respostas guardadas: uma
      // submissão VAZIA não pode fechar a missão do jogador.
      return diRespondido(d.auto) > 0;
    }
    if (diRespondido(d.auto) !== DI_INDICADORES.length) return false;
    /* ATENÇÃO: enviar as RESPOSTAS ao submeter. Antes ia `p_auto: {}` —
       o servidor gravava esse objeto vazio por cima do que o jogador tinha
       respondido e marcava como submetida, por isso a equipa técnica via
       "Autoavaliação submetida" sem nada respondido. */
    const { data, error } = await supabase.rpc('checkin_desenvolvimento_responder', {
      p_code: code, p_team: teamId, p_registo_id: d.registoId, p_auto: d.auto || {}, p_submeter: true,
    });
    return !error && !!(data && data.ok);
  } catch (e) {
    return false;
  }
}

/* MEMÓRIA DO PORTAL (só nesta sessão). Cada área guarda aqui o que
   recebeu; ao voltar a abri-la mostra logo o que tinha (sem "A carregar…"
   nem o conteúdo a saltar) e atualiza em silêncio por trás. O cacifo
   aquece-a ao abrir (aquecerPortal), por isso a 1.ª visita também é
   imediata na maior parte das vezes. */
const PORTAL_MEM = new Map();
/* Estilos globais do Portal: o "A carregar…" só aparece se demorar mais de
   0,4 s (em pedidos rápidos não pisca), e as miniaturas da Sala de Vídeo
   entram a desvanecer quando acabam de carregar (em vez de passarem de
   uma caixa preta para a imagem de golpe). */
if (typeof document !== 'undefined' && !document.getElementById('mjp-portal-css')) {
  const st = document.createElement('style');
  st.id = 'mjp-portal-css';
  st.textContent = '@keyframes mjp-surgir { from { opacity: 0; } to { opacity: 1; } }'
    + ' .mjp-carregar { animation: mjp-surgir .25s ease-out .4s both; }'
    + ' .mjp-bib img { opacity: 0; transition: opacity .35s ease-out; } .mjp-bib img.mjp-ok { opacity: 1; }';
  document.head.appendChild(st);
}
const chaveMem = (rpc, code, teamId, extra) => `${rpc}|${code}|${teamId}|${extra || ''}`;
function lerMem(k) { const v = PORTAL_MEM.get(k); return v && Date.now() - v.t < 15 * 60000 ? v.d : undefined; }
function gravarMem(k, d) { PORTAL_MEM.set(k, { t: Date.now(), d }); }
function normalizarRpc(data) {
  let d = data;
  if (Array.isArray(d)) d = d[0];
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { /* fica como está */ } }
  return d;
}
const AQUECER_EM_CURSO = new Set();
function aquecerPortal(code, teamId) {
  if (!code || !teamId) return;
  [['checkin_ideia_jogo', {}], ['checkin_plano_dia', { p_date: todayStr() }], ['checkin_convocatoria', {}], ['checkin_competicao', {}]].forEach(([rpc, extra]) => {
    const k = chaveMem(rpc, code, teamId, extra.p_date);
    if (lerMem(k) !== undefined || AQUECER_EM_CURSO.has(k)) return;
    AQUECER_EM_CURSO.add(k);
    Promise.resolve(supabase.rpc(rpc, { p_code: code, p_team: teamId, ...extra }))
      .then(({ data, error }) => { if (!error) gravarMem(k, normalizarRpc(data) || {}); })
      .catch(() => {})
      .finally(() => AQUECER_EM_CURSO.delete(k));
  });
}
/* Pedido de uma área com a memória acima: devolve [estado, dados]. */
function usePortalRpc(rpcName, code, teamId, extra) {
  const k = chaveMem(rpcName, code, teamId, extra && extra.p_date);
  const [estado, setEstado] = useState(() => (lerMem(k) !== undefined ? 'pronto' : 'a-carregar'));
  const [dados, setDados] = useState(() => (lerMem(k) !== undefined ? lerMem(k) : null));
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const pre = !extra ? tirarPrebusca(rpcName, code, teamId) : null;
        const { data, error } = pre ? await pre : await supabase.rpc(rpcName, { p_code: code, p_team: teamId, ...(extra || {}) });
        if (cancelado) return;
        if (error) throw error;
        const d = normalizarRpc(data) || {};
        gravarMem(k, d);
        setDados(d);
        setEstado('pronto');
      } catch (e) {
        // Com dados já à vista, um erro de atualização não os apaga.
        if (!cancelado) setEstado(v => (v === 'pronto' ? v : 'erro'));
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rpcName, code, teamId, k]);
  return [estado, dados];
}
function usePortalFetch(rpcName, code, teamId) {
  return usePortalRpc(rpcName, code, teamId);
}

/* CONVOCATÓRIA NO PORTAL.
   Em cima, o cartão de sempre com a informação do jogo (sem emblemas),
   com o nome do jogo em destaque. Por baixo, os convocados em 4 colunas,
   por número: foto redonda, número na bola e nome por baixo (o próprio
   jogador com anel dourado). No canto, o carimbo redondo do clube, como
   numa folha oficial da equipa técnica. */
function cvDataCurta(iso) {
  return iso ? formatShortDatePt(iso) : '';
}
/* O carimbo da equipa técnica com a faixa "CONVOCADO" (só para quem vai
   ao jogo): selo limpo, numa só letra (Oswald), com o nome do clube no
   arco de cima e "EQUIPA TÉCNICA" no de baixo; a faixa dourada atravessa
   o selo e sai um pouco para fora, com as pontas em cauda de andorinha. */
function CvCarimbo({ clube, tam, data }) {
  const cor = T.gold;
  const dm = /^\d{4}-(\d{2})-(\d{2})/.exec(String(data || ''));
  const id = React.useId().replace(/:/g, '');
  const nome = String(clube || 'Equipa').replace(/\s+(u|sub)-?\d{1,2}\b.*$/i, '').toUpperCase();
  const f = { fontFamily: "'Oswald', sans-serif", fontWeight: 500 };
  const arco = { ...f, fontSize: 10, letterSpacing: '.16em' };
  const longo = nome.length > 13;
  return (
    <svg aria-hidden="true" width={tam} height={tam} viewBox="-8 0 136 120" style={{ display: 'block', transform: 'rotate(-8deg)', pointerEvents: 'none', overflow: 'visible' }}>
      <defs>
        <path id={`cv-cima-${id}`} d="M 21,50 A 40,40 0 0 1 99,50" />
        <path id={`cv-baixo-${id}`} d="M 17,73 A 44,44 0 0 0 103,73" />
      </defs>
      <g fill={cor} stroke={cor}>
        <circle cx="60" cy="60" r="56" fill="none" strokeWidth="1.8" />
        <circle cx="60" cy="60" r="52" fill="none" strokeWidth="0.7" />
        <text stroke="none" style={arco}>
          <textPath href={`#cv-cima-${id}`} startOffset="50%" textAnchor="middle" {...(longo ? { textLength: 96, lengthAdjust: 'spacingAndGlyphs' } : {})}>{nome}</textPath>
        </text>
        <text stroke="none" style={arco}>
          <textPath href={`#cv-baixo-${id}`} startOffset="50%" textAnchor="middle">EQUIPA TÉCNICA</textPath>
        </text>
        {/* A faixa: sai para fora do selo dos dois lados. */}
        <path d="M -6,50 L 126,50 L 119,60 L 126,70 L -6,70 L 1,60 Z" stroke="none" />
        <text x="60" y="64.5" textAnchor="middle" stroke="none" fill="#1B231D" textLength="74" lengthAdjust="spacingAndGlyphs" style={{ ...f, fontSize: 13, fontWeight: 600 }}>CONVOCADO</text>
        {/* Por cima da faixa, a data do jogo: o carimbo fica "datado". */}
        {dm && <text x="60" y="44" textAnchor="middle" stroke="none" style={{ ...f, fontSize: 10, letterSpacing: '.14em' }}>{`${dm[2]}.${dm[1]}`}</text>}
      </g>
    </svg>
  );
}
function CvJogador({ p, eu, tam }) {
  const cor = T.corEquipa || T.crimson;
  const exp = p.id == null;
  const iniciais = String(p.name || '?').split(' ').filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase();
  const num = typeof p.number === 'number' ? p.number : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, minWidth: 0 }}>
      <span style={{ position: 'relative', width: tam, height: tam, flexShrink: 0 }}>
        <span style={{
          position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: cor, color: '#fff', fontSize: tam * 0.3, fontWeight: 700, ...body,
          boxShadow: eu
            ? `0 0 0 2px ${T.surface}, 0 0 0 4.5px ${T.gold}, 0 0 18px ${T.gold}55`
            : `0 0 0 2px ${T.surface}, 0 0 0 3.5px ${exp ? T.mutedDim : '#ffffffcc'}`,
        }}>
          {iniciais}
          {/* Sem a foto (não carregou), ficam as iniciais por baixo. */}
          {p.photo && <img src={p.photo} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#E4E8E3' }} />}
        </span>
        {num != null && (
          <span style={{
            position: 'absolute', right: -4, bottom: -2, minWidth: 24, height: 24, padding: '0 4px', boxSizing: 'border-box', borderRadius: 12,
            background: eu ? T.goldFundo : '#0d1a12', color: eu ? '#1B231D' : '#ECEFEA', border: `2px solid ${T.surface}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, ...mono,
          }}>{num}</span>
        )}
      </span>
      <span style={{ fontSize: 13, fontWeight: eu ? 700 : 500, color: eu ? T.gold : T.cream, textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', ...body }}>
        {/* O nome por que é conhecido, se o servidor o enviar (ver Plantel). */}
        {String(p.alcunha || '').trim() || p.name}{exp && <span style={{ color: T.mutedDim, fontWeight: 400 }}> (exp)</span>}
      </span>
    </div>
  );
}
function PlayerConvocatoriasTab({ code, teamId, jogadorId, logo, infoJogo }) { // eslint-disable-line no-unused-vars
  const [estado, dados] = usePortalFetch('checkin_convocatoria', code, teamId);
  const estreito = useIsMobile(560);
  // No computador, a convocatória ocupa a página toda (sem scroll).
  const largo = !useIsMobile(900);
  if (estado === 'a-carregar') return <div className="mjp-carregar" style={{ fontSize: 13, color: T.mutedDim }}>A carregar…</div>;
  if (estado === 'erro') return <div style={{ fontSize: 13, color: T.bad }}>Não foi possível carregar. Tenta outra vez ou fala com o staff.</div>;
  const lista = (dados && dados.convocatorias) || [];
  const nossoClube = (dados && dados.clube) || 'Equipa';
  if (lista.length === 0) {
    return <div style={{ fontSize: 13, color: T.mutedDim }}>Ainda não há nenhuma convocatória partilhada contigo.</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760, margin: largo ? '0 auto' : 0 }}>
      {lista.map(c => {
        // Por número da camisola — quem não tem número atribuído vai
        // para o fim. Os jogadores à experiência (sem `id`, porque não
        // têm ficha no Plantel) vão sempre a seguir a esses, no fundo
        // de todos — nunca misturados a meio da lista.
        const convocados = [...(c.convocados || [])].sort((a, b) => {
          const expA = a.id == null;
          const expB = b.id == null;
          if (expA !== expB) return expA ? 1 : -1;
          const na = typeof a.number === 'number' ? a.number : Infinity;
          const nb = typeof b.number === 'number' ? b.number : Infinity;
          return na - nb;
        });
        const tamCarimbo = estreito ? 80 : 96;
        let jornada = '';
        try { jornada = (infoJogo && (infoJogo(c) || {}).jornada) || ''; } catch (e) { jornada = ''; }
        const tam = estreito ? 54 : 66;
        return (
          <div key={c.id} style={{ position: 'relative', background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: estreito ? 14 : 20, overflow: 'hidden' }}>
            {/* Carimbo com a faixa "CONVOCADO" (só para quem vai ao jogo). */}
            {c.convocado && (
              <div style={{ position: 'absolute', right: estreito ? 12 : 22, top: estreito ? 12 : 16 }}>
                <CvCarimbo clube={nossoClube} tam={tamCarimbo} data={c.data} />
              </div>
            )}

            {/* No telemóvel só a mensagem fica ao lado do carimbo; o nome do
                jogo usa a largura toda, por baixo dele. */}
            <div>
              {/* TIPOGRAFIA: só duas letras (Inter no texto, Oswald no nome do
                  jogo) e três tamanhos: 11 (rótulos), 13,5 (texto) e o título. */}
              <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.45, color: c.convocado ? T.gold : T.mutedDim, marginBottom: 14, paddingRight: c.convocado ? tamCarimbo + 8 : 0, minHeight: c.convocado && estreito ? tamCarimbo - 6 : 0, ...body }}>
                {c.convocado ? (
                  <>
                    <div>Parabéns estás convocado.</div>
                    <div style={{ marginTop: 2, fontWeight: 400, color: T.cream }}>Estar convocado é o primeiro passo; o foco agora é a vitória da equipa.</div>
                  </>
                ) : (
                  'Desta vez não estás na lista de convocados. Levanta a cabeça e foca-te no próximo treino.'
                )}
              </div>
              {/* Jornada, dia e hora numa só linha, a cinza, por cima do nome do jogo.
                  O local fica só na concentração (sem concentração, vem aqui). */}
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: T.muted, marginBottom: 4, ...body }}>
                {[jornada, cvDataCurta(c.data), c.horaJogo, (c.horaConcentracao || c.localConcentracao) ? '' : c.localJogo].filter(Boolean).join(' · ')}
              </div>
              {/* O nome do jogo, em destaque. */}
              {/* Numa só linha: no telemóvel a letra encolhe com o ecrã. */}
              <div style={{ ...display, fontSize: estreito ? 'clamp(15px, 4.7vw, 20px)' : 24, fontWeight: 600, lineHeight: 1.2, color: T.textoForte, letterSpacing: '.01em', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.casaFora === 'Fora'
                  ? <>{c.adversario} <span style={{ color: T.muted, fontWeight: 400 }}>vs</span> {nossoClube}</>
                  : <>{nossoClube} <span style={{ color: T.muted, fontWeight: 400 }}>vs</span> {c.adversario}</>}
              </div>
              {(c.horaConcentracao || c.localConcentracao) && (
                <div style={{ fontSize: 13.5, lineHeight: 1.45, color: T.gold, marginTop: 2, ...body }}>
                  Concentração: {[c.horaConcentracao, c.localConcentracao].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
            {c.outrasInfo && <div style={{ fontSize: 13.5, color: T.cream, marginTop: 10, lineHeight: 1.45, ...body }}>{c.outrasInfo}</div>}

            {convocados.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.line}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.warn, textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 16, ...body }}>
                  Convocados · {convocados.length}
                </div>
                {/* 4 colunas, por número. A foto vem do servidor (campo
                    `photo`); sem ela, uma bola na cor da equipa com as
                    iniciais. */}
                <div style={{ display: 'grid', gridTemplateColumns: largo ? 'repeat(5, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', columnGap: estreito ? 6 : 14, rowGap: estreito ? 16 : 20 }}>
                  {convocados.map((p, i) => (
                    <CvJogador key={p.id || `x-${i}`} p={p} eu={!!(jogadorId && p.id && p.id === jogadorId)} tam={tam} />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PlayerPlanoJogoTab({ code, teamId }) {
  const [estado, dados] = usePortalFetch('checkin_plano_jogo', code, teamId);
  const [aVer, setAVer] = useState(null);
  if (estado === 'a-carregar') return <div className="mjp-carregar" style={{ fontSize: 13, color: T.mutedDim }}>A carregar…</div>;
  if (estado === 'erro') return <div style={{ fontSize: 13, color: T.bad }}>Não foi possível carregar. Tenta outra vez ou fala com o staff.</div>;
  const ideias = (dados && dados.ideias) || [];
  if (aVer) {
    return <ExercisePresentation exercise={{ ...aVer, name: aVer.name || aVer.phase || 'Ideia de jogo' }} onClose={() => setAVer(null)} />;
  }
  if (ideias.length === 0) {
    return <div style={{ fontSize: 13, color: T.mutedDim }}>Ainda não há nenhum plano de jogo partilhado contigo.</div>;
  }
  // Onze ainda por revelar: o servidor manda as ideias só com as posições.
  const onzeEscondido = ideias.some(x => x && x.onzeEscondido);
  // Mesma organização por momento de jogo do "Ideia de Jogo" — reaproveita
  // `MOMENTOS_JOGO`/`ColunaIdeias`, para o atleta encontrar as coisas nos
  // dois sítios da mesma forma, em vez de teres de aprender duas
  // organizações diferentes.
  //
  // A grelha fixa de 5 colunas (`repeat(5, ...)`) nunca tinha sido
  // corrigida aqui — num ecrã estreito espremia as 5 colunas até
  // ficarem minúsculas e os títulos cortados ("Pr...", "Bl..."). O
  // "Ideia de Jogo" já usava scroll horizontal com largura em `vw` para
  // isto mesmo; aqui é a mesma correção, só que nunca tinha chegado a
  // este sítio (são dois componentes diferentes, mesmo mostrando o
  // mesmo tipo de conteúdo).
  return (
    <>
    {onzeEscondido && (
      <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 12, lineHeight: 1.5, ...body }}>
        Por agora as ideias mostram só as posições. Os números e os nomes aparecem quando o onze for revelado.
      </div>
    )}
    <div style={{
      display: 'flex', flexWrap: 'nowrap', gap: 16, overflowX: 'auto', paddingBottom: 8,
      WebkitOverflowScrolling: 'touch',
    }}>
      {MOMENTOS_JOGO.map(momento => {
        const doMomento = ideias.filter(x => x.phase === momento);
        if (!doMomento.length) return null;
        return (
          <div key={momento} style={{ width: 'clamp(150px, 46vw, 220px)', flexShrink: 0 }}>
            <ColunaIdeias titulo={momento} itens={doMomento} onAbrir={setAVer} />
          </div>
        );
      })}
      {(() => {
        const restantes = ideias.filter(x => !MOMENTOS_JOGO.includes(x.phase));
        if (!restantes.length) return null;
        return (
          <div style={{ width: 'clamp(150px, 46vw, 220px)', flexShrink: 0 }}>
            <ColunaIdeias titulo="Outras" itens={restantes} onAbrir={setAVer} />
          </div>
        );
      })()}
    </div>
    </>
  );
}

function PlayerAdversarioTab({ code, teamId }) {
  const [estado, dados] = usePortalFetch('checkin_adversario', code, teamId);
  const [aVer, setAVer] = useState(null);
  const [taticaViewing, setTaticaViewing] = useState(null);
  const [selecionadoId, setSelecionadoId] = useState(null);

  if (estado === 'a-carregar') return <div className="mjp-carregar" style={{ fontSize: 13, color: T.mutedDim }}>A carregar…</div>;
  if (estado === 'erro') return <div style={{ fontSize: 13, color: T.bad }}>Não foi possível carregar. Tenta outra vez ou fala com o staff.</div>;
  const lista = (dados && dados.adversarios) || [];
  if (lista.length === 0) {
    return <div style={{ fontSize: 13, color: T.mutedDim }}>Ainda não há nenhum adversário partilhado contigo.</div>;
  }
  const a = lista.find(x => x.id === selecionadoId) || lista[0];
  const chave = a.chave || [];
  const taticas = a.taticas || [];
  const labelTatica = (t) => (t.nome && t.nome.trim()) ? t.nome.trim() : `Dinâmica ${taticas.indexOf(t) + 1}`;
  const bloco = (titulo, texto) => texto && (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{titulo}</div>
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: '12px 14px', fontSize: 13, color: T.cream, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{texto}</div>
    </div>
  );

  return (
    <div>
      {/* Mais do que um adversário partilhado — um separador simples
          para trocar entre eles, tal como as pastas na Biblioteca. */}
      {lista.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          {lista.map(x => {
            const on = x.id === a.id;
            return (
              <button key={x.id} onClick={() => setSelecionadoId(x.id)} style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', ...body,
                background: on ? '#B5393F' : 'transparent', color: on ? TEXT_ON_ACCENT : T.muted,
                border: `1px solid ${on ? '#B5393F' : T.line}`,
              }}>{x.nome}</button>
            );
          })}
        </div>
      )}

      {/* MESMA PÁGINA DO ADVERSÁRIO QUE O STAFF VÊ EM SCOUTING — só de
          consulta: sem "Adicionar dinâmica", sem "Adicionar vídeo",
          sem ícones de editar/apagar em lado nenhum. */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ ...display, fontSize: 20, color: T.cream }}>{a.nome}</div>
        <div style={{ color: T.mutedDim, fontSize: 12.5, marginTop: 4 }}>
          {[a.escalao, a.prova, a.quadroTatica].filter(Boolean).join(' · ') || 'Sem detalhes ainda'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Estrutura habitual</div>
          {!a.quadroTatica ? (
            <div style={{ fontSize: 12.5, color: T.mutedDim }}>Ainda sem estrutura marcada para este adversário.</div>
          ) : (
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14 }}>
              <PrancheteDoPlantel
                lugares={distribuirPlantel({
                  players: chave, attendance: chave.map(x => x.id), overrides: a.quadroOverrides, tatica: a.quadroTatica,
                })}
                escala={1.25}
                maxLargura={900}
                tela
              />
            </div>
          )}
        </div>

        <div>
          {bloco('Pontos fortes', a.pontosFortes)}
          {bloco('Pontos fracos', a.pontosFracos)}

          <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
            Jogadores-chave
          </div>
          {chave.length === 0 ? (
            <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 16 }}>Nenhum jogador-chave marcado ainda.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 16 }}>
              {chave.map(x => (
                <div key={x.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ color: T.cream, fontWeight: 500, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {x.camisola ? <span style={{ color: '#E84A5F', fontWeight: 800, marginRight: 6, ...mono }}>{x.camisola}</span> : null}{x.name}
                  </div>
                  <div style={{ color: T.mutedDim, fontSize: 11.5, marginTop: 2 }}>{[x.position, x.dominantFoot ? `pé ${x.dominantFoot.toLowerCase()}` : '', x.club].filter(Boolean).join(' · ')}</div>
                  {/* As características escritas no adversário (que vivem na
                      ficha do jogador) — as primeiras linhas, para ler de
                      relance. */}
                  {x.traits && (
                    <div style={{ color: T.cream, fontSize: 12, lineHeight: 1.45, marginTop: 8, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-wrap' }}>{x.traits}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!a.pontosFortes && !a.pontosFracos && (
        <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 16 }}>Ainda sem notas de análise.</div>
      )}

      <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', margin: '20px 0 10px' }}>Dinâmicas</div>
      {taticas.length === 0 ? (
        <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 16 }}>Ainda sem dinâmicas registadas para este adversário.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
          {taticas.map(t => (
            <div key={t.id} onClick={() => setTaticaViewing(t)} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 12, cursor: 'pointer' }}>
              <div style={{ color: T.cream, fontWeight: 500, fontSize: 13.5, marginBottom: 6 }}>{labelTatica(t)}</div>
              {t.phase && (
                <div style={{ marginBottom: 8 }}>
                  <span style={{ display: 'inline-block', fontSize: 10.5, color: T.warn, background: `${T.crimson}55`, padding: '2px 8px', borderRadius: 12 }}>{t.phase}</span>
                </div>
              )}
              <DiagramThumb diagram={t.diagram} />
            </div>
          ))}
        </div>
      )}
      {taticaViewing && (
        <ExercisePresentation exercise={{ ...taticaViewing, name: labelTatica(taticaViewing) }} onClose={() => setTaticaViewing(null)} />
      )}

      <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', margin: '20px 0 10px' }}>Vídeos</div>
      {(a.videos || []).length === 0 ? (
        <div style={{ fontSize: 12.5, color: T.mutedDim }}>Ainda sem vídeos deste adversário.</div>
      ) : (
        <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {a.videos.map(v => (
            <MediaFeedItem key={v.id} item={v} onOpen={item => setAVer(item)} />
          ))}
        </div>
      )}

      {/* Vídeos do YouTube e das redes sociais não têm `kind` (ou não são
          ficheiros) e o botão "Abrir no visualizador" não fazia nada. Agora
          abrem num visualizador próprio, com ecrã inteiro. Os ficheiros
          (imagem, vídeo carregado, PDF, Drive) continuam como estavam. */}
      {aVer && (aVer.youtubeId || aVer.social) ? (
        <VisualizadorVideoPortal item={aVer} onClose={() => setAVer(null)} />
      ) : aVer && aVer.kind ? (
        <Modal title={aVer.title || aVer.fileName || 'Ficheiro'} onClose={() => setAVer(null)} wide>
          <AttachmentPreview item={aVer} tall />
        </Modal>
      ) : null}
    </div>
  );
}

/* IDEIA DE JOGO, DO LADO DO ATLETA — só consulta, nunca edição.

   Vai buscar tudo a uma função própria (`checkin_ideia_jogo`), pelo
   MESMO código de 4/6 dígitos já validado no login — nada de nova
   sessão, nada de nova credencial. A função só devolve o que o
   treinador marcou como visível: o texto do próximo jogo (se
   partilhado) e as ideias de jogo (esquemas) marcadas como tal. Sem
   nada partilhado, o ecrã diz isso mesmo, em vez de aparecer vazio sem
   explicação. */
// As colunas do quadro tático, do lado do atleta — os mesmos cinco
// momentos de jogo que a app já usa (`PHASES`), pela mesma ordem.
const MOMENTOS_JOGO = ['Organização Defensiva', 'Transição Ofensiva', 'Organização Ofensiva', 'Transição Defensiva', 'Bola Parada'];

function PlayerIdeiaJogoView({ code, teamId, onBack, fecharVolta }) {
  const [estado, dadosIdeia] = usePortalRpc('checkin_ideia_jogo', code, teamId);
  const dados = dadosIdeia ? { proximoJogo: null, ideias: [], ...dadosIdeia } : null;
  const [aVer, setAVer] = useState(null); // ideia aberta em ecrã inteiro
  // Gesto de retroceder com uma ideia aberta: fecha-a (como o X).
  useKioskVoltar(!!aVer, () => { setAVer(null); if (fecharVolta) onBack(); });

  if (aVer) {
    return (
      <ExercisePresentation
        exercise={{ ...aVer, name: aVer.name || aVer.phase || 'Ideia de jogo' }}
        /* Vindo de uma tarefa, fechar a ideia volta às Tarefas. */
        onClose={() => { setAVer(null); if (fecharVolta) onBack(); }}
      />
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
        borderRadius: 8, color: T.cream, padding: '8px 14px', cursor: 'pointer', ...body, fontSize: 13.5, marginBottom: 20,
      }}>
        <ChevronLeft size={15} /> Voltar
      </button>

      <div style={{ ...display, fontSize: 18, color: T.cream, marginBottom: 12 }}>Ideia de Jogo</div>

      {estado === 'a-carregar' && (
        <div className="mjp-carregar" style={{ fontSize: 13, color: T.mutedDim }}>A carregar…</div>
      )}

      {estado === 'erro' && (
        <div style={{ fontSize: 13, color: T.bad }}>Não foi possível carregar. Tenta outra vez ou fala com o staff.</div>
      )}

      {estado === 'pronto' && (
        <>
          {dados.proximoJogo && (
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: '16px 16px', marginBottom: 18, maxWidth: 560 }}>
              <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                Próximo jogo{dados.proximoJogo.opponent ? ` · vs ${dados.proximoJogo.opponent}` : ''}
              </div>
              {dados.proximoJogo.date && (
                <div style={{ fontSize: 12, color: T.mutedDim, marginBottom: 10 }}>{fmtDate(dados.proximoJogo.date)}</div>
              )}
              <p style={{ fontSize: 13.5, color: T.cream, lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap' }}>{dados.proximoJogo.ideias}</p>
            </div>
          )}

          {dados.ideias && dados.ideias.length > 0 ? (
            <div style={{
              display: 'flex', flexWrap: 'nowrap', gap: 16, overflowX: 'auto', paddingBottom: 8,
              WebkitOverflowScrolling: 'touch',
            }}>
              {/* Largura em `vw` (percentagem do ecrã), não em pixels fixos
                 nem a depender de detetar "é telemóvel" em JavaScript —
                 isso podia falhar consoante o browser/webview e dava um
                 cartão largo demais, cortado, sem se perceber que havia
                 mais ao lado. Em `vw`, o tamanho reflete sempre o ecrã a
                 sério: no telemóvel fica compacto (perto de meio ecrã,
                 já mostrando a fatia do cartão seguinte, como pista de
                 que há mais para o lado); no computador cresce até um
                 limite razoável (220px), sem ficar minúsculo num ecrã
                 largo nem gigante num estreito. */}
              {MOMENTOS_JOGO.map(momento => {
                const doMomento = dados.ideias.filter(x => x.phase === momento);
                if (!doMomento.length) return null;
                return (
                  <div key={momento} style={{ width: 'clamp(150px, 46vw, 220px)', flexShrink: 0 }}>
                    <ColunaIdeias titulo={momento} itens={doMomento} onAbrir={setAVer} />
                  </div>
                );
              })}
              {/* Ideias com uma fase fora das cinco categorias (Preparação
                  Física, Ativação, etc.) continuam a aparecer — só não têm
                  uma coluna própria, ficam numa "Outras". */}
              {(() => {
                const restantes = dados.ideias.filter(x => !MOMENTOS_JOGO.includes(x.phase));
                if (!restantes.length) return null;
                return (
                  <div style={{ width: 'clamp(150px, 46vw, 220px)', flexShrink: 0 }}>
                    <ColunaIdeias titulo="Outras" itens={restantes} onAbrir={setAVer} />
                  </div>
                );
              })()}
            </div>
          ) : (
            !dados.proximoJogo && (
              <div style={{ fontSize: 13, color: T.mutedDim }}>
                Ainda não há nada partilhado aqui. Fala com o treinador se achas que devia haver.
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

/* UMA COLUNA DE UM MOMENTO DE JOGO — altura fixa, com setas para cima
   e para baixo por cima/baixo da própria coluna, não do ecrã inteiro.
   Cada coluna pode ter muitas ideias empilhadas; sem isto, era preciso
   arrastar o dedo dentro da coluna para as ver todas, o que no
   quiosque é fácil de confundir com um scroll da página toda. */
// Altura de um cartão (título de 1 linha + miniatura mais pequena +
// padding) — usada para a lista mostrar exatamente 3 cartões de cada
// vez. Reduzida mais uma vez: a coluna inteira (cabeçalho + setas + 3
// cartões) tem de caber na página sem ela própria precisar de scroll.
const ALTURA_CARTAO_IDEIA = 178;
const ALTURA_MINIATURA = 120;
const GAP_CARTOES = 10;

function ColunaIdeias({ titulo, itens, onAbrir }) {
  const listaRef = useRef(null);
  const deslizar = (dy) => { if (listaRef.current) listaRef.current.scrollBy({ top: dy, behavior: 'smooth' }); };
  const setaEstilo = {
    width: 32, height: 22, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: T.surface, border: `1px solid ${T.line}`, color: T.cream, cursor: 'pointer', margin: '0 auto', flexShrink: 0,
  };
  return (
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{titulo}</div>
      {/* As setas aparecem SEMPRE, mesmo com uma única ideia — só ficam
          desativadas (mais apagadas, sem clique) nesse caso. Antes
          desapareciam por completo quando não fazia falta deslizar, e
          isso fazia cada coluna parecer estruturada de forma diferente
          (uma com setas, outra sem). Mostrar sempre a mesma forma,
          ativa ou não, é o que dá o "mesmo comportamento" a todos os
          momentos. */}
      <button
        onClick={() => itens.length > 1 && deslizar(-(ALTURA_CARTAO_IDEIA + GAP_CARTOES))}
        title="Subir"
        disabled={itens.length <= 1}
        style={{ ...setaEstilo, marginBottom: 6, opacity: itens.length > 1 ? 1 : 0.35, cursor: itens.length > 1 ? 'pointer' : 'default' }}
      ><ChevronUp size={13} /></button>
      {/* MOSTRA SEMPRE 3 CARTÕES — nem a quantidade de ideias, nem a
          altura do ecrã, decidem isto; é uma conta fixa (3 cartões + 2
          espaços entre eles). O resto esconde-se por dentro, sem
          barra de scroll visível (`sem-scrollbar-mjp`) — quem manda no
          deslizar são as setas, a barra só distraía. */}
      <div
        ref={listaRef}
        className="sem-scrollbar-mjp"
        style={{
          display: 'flex', flexDirection: 'column', gap: GAP_CARTOES, overflowY: 'auto', scrollBehavior: 'smooth',
          height: ALTURA_CARTAO_IDEIA * 3 + GAP_CARTOES * 2,
        }}
      >
        <style>{'.sem-scrollbar-mjp{scrollbar-width:none;-ms-overflow-style:none;}.sem-scrollbar-mjp::-webkit-scrollbar{display:none;}'}</style>
        {itens.map(x => {
          const temDiagrama = x.diagram && ((x.diagram.elements || []).length || (x.diagram.arrows || []).length);
          return (
          <div
            key={x.id}
            onClick={() => onAbrir(x)}
            style={{
              background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 12, cursor: 'pointer',
              flexShrink: 0, height: ALTURA_CARTAO_IDEIA, overflow: 'hidden', boxSizing: 'border-box',
            }}
          >
            {/* Título com altura fixa (1 linha, sempre) — é a única parte
                de tamanho variável entre cartões; a miniatura do campo já
                tem altura fixa (ver DiagramThumb). Fixar a ALTURA DO
                CARTÃO INTEIRO (não só um mínimo) é o que garante que
                todos ficam mesmo iguais — uma ideia sem esquema nenhum
                (ainda por desenhar) não pode esticar a caixa. */}
            <div style={{
              color: T.cream, fontWeight: 500, fontSize: 14, marginBottom: 7, height: 19,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{x.name || 'Ideia de jogo'}</div>
            {temDiagrama ? (
              /* Com ▶ no canto, como nos cartões do staff: anima ali mesmo,
                 sem abrir a ideia (o toque no resto do cartão abre-a). */
              <DiagramThumbAnimado diagram={x.diagram} phase={x.phase} height={ALTURA_MINIATURA} fill />
            ) : (
              <div style={{
                width: '100%', height: ALTURA_MINIATURA, background: '#1e3a24', borderRadius: 6, marginBottom: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, color: T_ESCURO.mutedDim,
              }}>Sem esquema</div>
            )}
          </div>
          );
        })}
      </div>
      <button
        onClick={() => itens.length > 1 && deslizar(ALTURA_CARTAO_IDEIA + GAP_CARTOES)}
        title="Descer"
        disabled={itens.length <= 1}
        style={{ ...setaEstilo, marginTop: 6, opacity: itens.length > 1 ? 1 : 0.35, cursor: itens.length > 1 ? 'pointer' : 'default' }}
      ><ChevronDown size={13} /></button>
    </div>
  );
}

/* ===================================================================
   ENTRADA DO PORTAL — CARTÃO DE ATLETA (fase 2 da segurança)
   ===================================================================
   O conceito é o centro de treinos do clube:
   · RECEÇÃO (1.ª vez num telemóvel): o jogador escreve o código de
     ativação que o staff lhe deu no Plantel (6 dígitos, uso único,
     expira em 48 h). → `checkin_cartao_ver`
   · CARTÃO DE ATLETA: o cartão "chega-lhe à mão" (cor do clube, foto,
     nome, número) e ele escolhe um PIN pessoal de 6 dígitos, duas vezes.
     → `checkin_cartao_ativar` devolve um TOKEN, guardado só neste
     telemóvel (localStorage, por equipa).
   · PORTA DO BALNEÁRIO (todos os dias): o cartão com o nome no topo, a
     porta de vidro fosco com o emblema e o PIN por baixo. PIN certo →
     `checkin_cartao_entrar` devolve uma CHAVE DE SESSÃO temporária; a
     porta abre para o balneário (a TV diz "Bem-vindo") e entra-se com
     essa chave no lugar do código antigo — por isso todo o resto do
     Portal funciona sem alterações (ver checkin_jogador, fase 2).
   · Os códigos antigos continuam a entrar (ligação "Entrar com o código
     antigo") até o staff ligar "Entrada só com cartão de atleta".
   5 PIN errados bloqueiam o cartão neste telemóvel; o staff gera um
   código novo. Nada disto guarda o PIN no telemóvel. */
const PE_CSS = `
  html, body { overflow: hidden !important; overscroll-behavior: none; }
  html { scrollbar-gutter: auto !important; background: ${T.bg}; }
  body { background: ${T.bg}; }
  @keyframes pe-chega { 0% { transform: translateY(-40px) rotateY(-75deg) rotateX(20deg); opacity: 0; } 70% { transform: translateY(4px) rotateY(6deg) rotateX(-3deg); opacity: 1; } 100% { transform: none; opacity: 1; } }
  @keyframes pe-brilho { 0% { left: -60%; } 100% { left: 130%; } }
  @keyframes pe-treme { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(5px); } }
  @keyframes pe-respira { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
  @keyframes pe-onda { 0% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -60; } }
  @keyframes pe-pulso { 0%,100% { box-shadow: 0 0 0 0 rgba(201,162,39,.55); } 50% { box-shadow: 0 0 0 12px rgba(201,162,39,0); } }
  @keyframes pe-anel { 0% { transform: scale(.55); opacity: .95; } 80% { opacity: 0; } 100% { transform: scale(1.65); opacity: 0; } }
  @keyframes pe-varre { 0% { top: 10%; } 50% { top: 86%; } 100% { top: 10%; } }
  @keyframes pe-dedo { 0% { opacity: 0; transform: translate(26px, 30px); } 15% { opacity: 1; transform: translate(10px, 12px); }
    25% { transform: translate(0, 0) scale(.9); } 32% { transform: translate(0, 0) scale(1); } 42% { transform: translate(0, 0) scale(.9); } 50% { transform: translate(0, 0) scale(1); }
    80% { opacity: 1; transform: translate(0, 0); } 100% { opacity: 0; transform: translate(10px, 14px); } }
`;
/* ONDE O CARTÃO FICA GUARDADO NESTE TELEMÓVEL/COMPUTADOR.
   O Portal e a plataforma do staff partilham o mesmo endereço e, por
   isso, a mesma memória do navegador (localStorage, limitada). Com a
   fotografia junto, o cartão podia não caber e perdia-se sem aviso — e o
   atleta voltava à Receção. Agora:
   · o cartão em si é pequeno (a chave e o nome, sem foto);
   · fica em DOIS sítios: localStorage e um cookie (memória separada, que
     não conta para o mesmo limite) — se um falhar, o outro chega;
   · a fotografia vai à parte e é dispensável (sem ela, mostram-se as
     iniciais). */
const peChave = (teamId) => `mjp-cartao:${teamId || 'sem-equipa'}`;
const peChaveFoto = (teamId) => `mjp-cartao-foto:${teamId || 'sem-equipa'}`;
const peCookie = (teamId) => `mjp_cartao_${String(teamId || 'sem-equipa').replace(/[^a-zA-Z0-9-]/g, '')}`;
function peLerCookie(nome) {
  try {
    const m = document.cookie.split('; ').find(c => c.startsWith(`${nome}=`));
    return m ? decodeURIComponent(m.slice(nome.length + 1)) : null;
  } catch (e) { return null; }
}
function peLerCartao(teamId) {
  let v = null;
  try { v = JSON.parse(localStorage.getItem(peChave(teamId)) || 'null'); } catch (e) { v = null; }
  if (!v || !v.token) { try { v = JSON.parse(peLerCookie(peCookie(teamId)) || 'null'); } catch (e) { v = null; } }
  if (!v || !v.token) return null;
  let foto = null;
  try { foto = localStorage.getItem(peChaveFoto(teamId)); } catch (e) { foto = null; }
  return { ...v, jogador: { ...(v.jogador || {}), foto: (v.jogador && v.jogador.foto) || foto || null } };
}
// Devolve true se ficou guardado em pelo menos um dos dois sítios.
function peGuardarCartao(teamId, cartao) {
  const j = (cartao && cartao.jogador) || {};
  const pequeno = JSON.stringify({ token: cartao.token, bio: !!cartao.bio, jogador: { nome: j.nome || '', numero: j.numero || '', posicao: j.posicao || '' } });
  try { localStorage.setItem(peChave(teamId), pequeno); } catch (e) { /* sem espaço ou modo privado */ }
  try {
    const seguro = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${peCookie(teamId)}=${encodeURIComponent(pequeno)}; Max-Age=${60 * 60 * 24 * 400}; Path=/; SameSite=Lax${seguro}`;
  } catch (e) { /* cookies bloqueados */ }
  try { if (j.foto) localStorage.setItem(peChaveFoto(teamId), j.foto); } catch (e) { /* a foto é dispensável */ }
  const lido = peLerCartao(teamId);
  return !!(lido && lido.token === cartao.token);
}
function peApagarCartao(teamId) {
  try { localStorage.removeItem(peChave(teamId)); localStorage.removeItem(peChaveFoto(teamId)); } catch (e) { /* nada */ }
  try { document.cookie = `${peCookie(teamId)}=; Max-Age=0; Path=/; SameSite=Lax`; } catch (e) { /* nada */ }
}
async function peRpc(nome, args) {
  const { data, error } = await supabase.rpc(nome, args);
  if (error) throw error;
  let d = data;
  if (Array.isArray(d)) d = d[0];
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { /* fica */ } }
  return d || {};
}
function peIniciais(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}
function peEpoca() {
  const h = new Date(); const y = h.getMonth() >= 6 ? h.getFullYear() : h.getFullYear() - 1;
  return `${y}/${String((y + 1) % 100).padStart(2, '0')}`;
}

function PeEmblema({ logo, cor, tam = 40, branco = false }) {
  if (logo) {
    return <img src={logo} alt="" style={{ height: tam, width: 'auto', display: 'block', filter: branco ? 'grayscale(1) brightness(2.4)' : 'none' }} />;
  }
  return (
    <svg viewBox="0 0 40 44" height={tam} aria-hidden="true">
      <path d="M2 2 H38 V22 Q38 36 20 42 Q2 36 2 22 Z" fill={branco ? 'rgba(255,255,255,.28)' : '#fff'} stroke={branco ? 'rgba(255,255,255,.95)' : cor.base} strokeWidth={branco ? 1.2 : 3} />
      <path d="M8 8 H32 V22 Q32 32 20 36 Q8 32 8 22 Z" fill={branco ? 'rgba(255,255,255,.18)' : cor.base} />
    </svg>
  );
}

/* `extra` ocupa a tecla vazia em baixo à esquerda (ex.: a impressão
   digital na porta), como nos teclados de PIN dos bancos: um símbolo no
   próprio teclado em vez de uma frase por baixo. */
function PeTeclado({ onTecla, desativado, extra }) {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7, width: '100%' }}>
      {teclas.map((k, i) => (!k && extra ? (
        <button key={i} type="button" disabled={extra.desativado} onClick={extra.onClick} aria-label={extra.rotulo} title={extra.rotulo} style={{
          height: 'clamp(38px, 5.6dvh, 50px)', borderRadius: 10, background: '#0d120f', border: '1px solid #2a2f33', color: '#FFC23D',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: extra.desativado ? 'default' : 'pointer', opacity: extra.desativado ? 0.5 : 1,
        }}><extra.Icon size={24} strokeWidth={1.7} /></button>
      ) : k ? (
        <button key={i} type="button" disabled={desativado} onClick={() => onTecla(k)} aria-label={k === '⌫' ? 'Apagar' : k} style={{
          height: 'clamp(38px, 5.6dvh, 50px)', borderRadius: 10, background: '#0d120f', border: '1px solid #2a2f33', color: '#FFC23D',
          ...mono, fontSize: 19, fontWeight: 500, cursor: desativado ? 'default' : 'pointer', opacity: desativado ? 0.5 : 1,
        }}>{k}</button>
      ) : <div key={i} />))}
    </div>
  );
}

/* As caixas do código e do PIN: a mesma identidade nas duas (rebordo
   vermelho à medida que se escreve; o PIN mostra pontos). */
function PeCaixas({ valor, ocultar, cor }) {
  return (
    <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} style={{
          width: 30, height: 36, borderRadius: 6, background: '#121815',
          border: `1.5px solid ${cor || (i < valor.length ? '#FF4B5A' : '#3a4440')}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', ...mono, fontWeight: 500, fontSize: 17, color: cor || '#FFC23D',
        }}>{i < valor.length ? (ocultar ? '●' : valor[i]) : ''}</div>
      ))}
    </div>
  );
}
function PePainel({ rotulo, corRotulo, children, tremer }) {
  return (
    <div style={{
      background: 'rgba(7,9,10,.92)', border: '1px solid #3a4440', borderRadius: 10, padding: '7px 10px 9px', textAlign: 'center',
      boxShadow: '0 0 16px rgba(255,75,90,.25)', animation: tremer ? 'pe-treme .45s' : 'none',
    }}>
      <div style={{ fontSize: 11, letterSpacing: '.1em', color: corRotulo || '#9aa8a0', lineHeight: 1.3, marginBottom: 6, textTransform: 'uppercase', ...body }}>{rotulo}</div>
      {children}
    </div>
  );
}

function PeRececao({ cor, logo, clube }) {
  const base = cor.base;
  return (
    <svg viewBox="0 0 300 220" width="100%" style={{ display: 'block' }} aria-hidden="true">
      <defs>
        <radialGradient id="pe-sala" cx="50%" cy="30%" r="80%"><stop offset="0" stopColor="#26342b" /><stop offset="1" stopColor="#0e1310" /></radialGradient>
        <linearGradient id="pe-led" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0d120f" /><stop offset=".5" stopColor={base} /><stop offset="1" stopColor="#0d120f" /></linearGradient>
        <linearGradient id="pe-tampo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f4f2ec" /><stop offset="1" stopColor="#bdb8ad" /></linearGradient>
        <linearGradient id="pe-frente" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1b211e" /><stop offset="1" stopColor="#0b0f0d" /></linearGradient>
        <linearGradient id="pe-chao" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#18201b" /><stop offset="1" stopColor="#0b0f0d" /></linearGradient>
        <filter id="pe-desfoca" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      <rect width="300" height="220" fill="url(#pe-sala)" />
      <ellipse cx="150" cy="10" rx="120" ry="14" fill="none" stroke="#FFE6A0" strokeWidth="3" opacity=".8" />
      <ellipse cx="150" cy="10" rx="120" ry="14" fill="none" stroke="#FFE6A0" strokeWidth="12" opacity=".25" filter="url(#pe-desfoca)" />
      <path d="M40 34 Q150 22 260 34 L260 124 Q150 114 40 124 Z" fill="url(#pe-led)" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => <path key={i} d={`M40 ${40 + i * 10} Q150 ${29 + i * 10} 260 ${40 + i * 10}`} fill="none" stroke="#fff" strokeWidth=".5" opacity=".08" />)}
      <path d="M40 34 Q150 22 260 34 L260 124 Q150 114 40 124 Z" fill="none" stroke="#FFC23D" strokeWidth="1.2" opacity=".6" />
      <g style={{ animation: 'pe-respira 3.5s ease-in-out infinite' }}>
        <circle cx="150" cy="70" r="34" fill="#fff" opacity=".08" />
        {logo
          ? <image href={logo} x="124" y="44" width="52" height="54" preserveAspectRatio="xMidYMid meet" />
          : <g transform="translate(150,70)"><path d="M-20 -24 H20 V2 Q20 20 0 28 Q-20 20 -20 2 Z" fill="#fff" /><path d="M-14 -18 H14 V2 Q14 15 0 21 Q-14 15 -14 2 Z" fill={base} /></g>}
      </g>
      <text x="150" y="114" textAnchor="middle" fontSize="9" fontWeight="600" fill="#F3ECDA" fontFamily="Oswald, sans-serif" letterSpacing="3" opacity=".85">{clube ? String(clube).toUpperCase() : 'CENTRO DE TREINOS'}</text>
      {[16, 278].map(x => (
        <g key={x}><rect x={x} y="30" width="6" height="140" rx="3" fill="#FFE6A0" opacity=".55" /><rect x={x} y="30" width="6" height="140" rx="3" fill="#FFE6A0" opacity=".35" filter="url(#pe-desfoca)" /></g>
      ))}
      <rect x="0" y="168" width="300" height="52" fill="url(#pe-chao)" />
      <ellipse cx="150" cy="190" rx="110" ry="12" fill={base} opacity=".2" filter="url(#pe-desfoca)" />
      <path d="M30 138 Q150 126 270 138 L270 146 Q150 134 30 146 Z" fill="url(#pe-tampo)" />
      <path d="M34 146 Q150 134 266 146 L262 186 Q150 176 38 186 Z" fill="url(#pe-frente)" />
      <path d="M38 180 Q150 170 262 180" fill="none" stroke="#FF4B5A" strokeWidth="2.5" strokeDasharray="40 20" style={{ animation: 'pe-onda 2.5s linear infinite' }} />
      <path d="M38 180 Q150 170 262 180" fill="none" stroke="#FF4B5A" strokeWidth="8" opacity=".35" filter="url(#pe-desfoca)" />
    </svg>
  );
}

function PeCartao({ jogador, cor, logo, clube }) {
  const nome = String((jogador && jogador.nome) || '').trim();
  const partes = nome.split(/\s+/).filter(Boolean);
  const linha1 = partes[0] || '';
  const linha2 = partes.length > 1 ? partes[partes.length - 1] : '';
  const texto = cor.texto || '#fff';
  return (
    <div style={{ perspective: 800 }}>
      <div style={{
        position: 'relative', width: 'min(300px, 86vw)', aspectRatio: '1.586', borderRadius: 14, overflow: 'hidden', color: texto,
        background: `linear-gradient(135deg, ${cor.escuro || cor.base} 0%, ${cor.base} 45%, ${cor.escuro || cor.base} 100%)`,
        boxShadow: '0 16px 34px rgba(0,0,0,.55)', animation: 'pe-chega 1.1s cubic-bezier(.2,.8,.2,1) both', ...body,
      }}>
        <div style={{ position: 'absolute', right: '-10%', top: '-4%', height: '108%', opacity: 0.12, display: 'flex' }}>
          <PeEmblema logo={logo} cor={cor} tam={190} branco />
        </div>
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.04) 0 8px, transparent 8px 16px)' }} />
        <div style={{ position: 'absolute', left: '5%', top: '7%', display: 'flex', alignItems: 'center', gap: 7 }}>
          <PeEmblema logo={logo} cor={cor} tam={24} />
          <div>
            <div style={{ ...display, fontSize: 13, fontWeight: 600, lineHeight: 1.05, letterSpacing: '.04em' }}>{(clube || 'O MEU CLUBE').toUpperCase()}</div>
            <div style={{ fontSize: 11, letterSpacing: '.16em', opacity: 0.85 }}>CARTÃO DE ATLETA</div>
          </div>
        </div>
        <div style={{ position: 'absolute', right: '5%', top: '8%', width: 30, height: 22, borderRadius: 5, background: 'linear-gradient(135deg,#f1d27a,#b8902e)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.25)' }} />
        <div style={{ position: 'absolute', left: '5%', top: '30%', width: '25%', height: '52%', borderRadius: 8, overflow: 'hidden', background: '#1A2A1F', border: '2px solid #F3ECDA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {jogador && jogador.foto
            ? <img src={jogador.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ ...display, fontSize: 26, fontWeight: 600, color: '#FFD86A' }}>{peIniciais(nome)}</span>}
        </div>
        <div style={{ position: 'absolute', left: '34%', top: '31%', right: '26%' }}>
          <div style={{ ...display, fontSize: 21, fontWeight: 600, lineHeight: 1.02, textTransform: 'uppercase', overflow: 'hidden' }}>{linha1}{linha2 && <><br />{linha2}</>}</div>
          {jogador && jogador.posicao && <div style={{ fontSize: 12, opacity: 0.9, marginTop: 5 }}>{jogador.posicao}</div>}
        </div>
        {jogador && jogador.numero && (
          <div style={{ position: 'absolute', right: '6%', top: '32%', ...display, fontSize: 54, fontWeight: 600, lineHeight: 1, color: '#F3ECDA', textShadow: '0 2px 0 rgba(0,0,0,.25)' }}>{jogador.numero}</div>
        )}
        <div style={{ position: 'absolute', left: '34%', bottom: '8%', fontSize: 11, letterSpacing: '.12em', opacity: 0.9 }}>ÉPOCA {peEpoca()}</div>
        <div style={{ position: 'absolute', top: '-20%', bottom: '-20%', width: '40%', background: 'linear-gradient(100deg, transparent, rgba(255,255,255,.35), transparent)', transform: 'skewX(-18deg)', animation: 'pe-brilho 2.8s ease-in-out 1.2s infinite' }} />
      </div>
    </div>
  );
}

/* PASSAGEM DA PORTA PARA O ECRÃ INICIAL. Quando a porta acaba de abrir,
   guarda-se onde está o balneário no ecrã (e o desenho). O ecrã de
   carregamento mostra-o no mesmo sítio e o ecrã inicial faz crescer o
   balneário dali até ao lugar dele — como se fosse o mesmo ecrã. */
/* A ENTRADA PELA PORTA — o ecrã seguinte está mesmo atrás da porta.
   Com o PIN certo (ou a impressão digital), o resto do ecrã da porta
   apaga-se e fica só o vidro. Quando o Portal está pronto, o ecrã que vem
   a seguir (o balneário da página inicial, os parabéns ou a missão) já está
   desenhado ATRÁS do vidro, encaixado no buraco da porta; o vidro abre e,
   ainda a abrir, esse ecrã cresce até à página inteira. É sempre o mesmo
   ecrã, por isso não há imagens trocadas nem paragens a meio. */
let ENTRADA = null; // { rect, fundo: { svg, H }, logo, cor, t }
/* Quando o acesso foi autorizado (para a barra de cima do sistema não
   piscar na passagem da porta para o Portal: ver o ecrã da porta). */
let ENTRADA_T = 0;
const PE_TC_PORTA = { escuro: '#0E1310', claro: '#E8EDE6' };

/* PRÉ-BUSCA: com o PIN certo, os pedidos que o Portal faz ao abrir partem
   todos logo, em paralelo (antes iam um a seguir ao outro, já com a porta
   à espera). Quando o Portal os pede, já estão prontos (ou a caminho). */
const PREBUSCA = new Map();
function prebuscarPortal(code, teamId) {
  if (!code || !teamId) return;
  const chamar = (rpc, args) => {
    const k = `${rpc}|${code}|${teamId}`;
    if (!PREBUSCA.has(k)) PREBUSCA.set(k, { t: Date.now(), p: Promise.resolve(supabase.rpc(rpc, args)) });
  };
  chamar('checkin_bootstrap', { p_code: code, p_days: CHECKIN_DAYS_BACK, p_team: teamId });
  ['checkin_tarefas', 'checkin_tarefas_destinos', 'checkin_convocatoria', 'checkin_competicao']
    .forEach(r => chamar(r, { p_code: code, p_team: teamId }));
}
function tirarPrebusca(rpc, code, teamId) {
  const k = `${rpc}|${code}|${teamId}`;
  const v = PREBUSCA.get(k);
  if (!v) return null;
  PREBUSCA.delete(k);
  return Date.now() - v.t < 30000 ? v.p : null;
}
const entradaRecente = () => !!(ENTRADA && Date.now() - ENTRADA.t < 20000);

// A porta fechada enquanto o Portal acaba de carregar (igual à da entrada).
function PortaAEspera() {
  const [ent] = useState(() => ENTRADA);
  if (!ent) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: T.bg }}>
      <style>{PE_SEM_GUTTER}</style>
      {ent.resto && <PeRestoEntrada html={ent.resto} apagar={false} />}
      <PortaVidroSo rect={ent.rect} aberto={false} logo={ent.logo} cor={ent.cor} fundo={ent.fundo} tamEmblema={ent.tam} />
    </div>
  );
}

/* O RESTO DO ECRÃ DE ENTRADA (cabeçalho com a bola verde, letreiro
   "ACESSO AUTORIZADO", impressão digital…) continua à vista enquanto o
   Portal carrega: é uma cópia fiel do ecrã, tirada no momento da entrada.
   Só se desvanece quando a porta abre, ao mesmo tempo que o vidro. A
   camada isola-se (isolation) para ficar sempre por baixo da porta. */
/* Enquanto a porta está em cena, a página não reserva o espaço da barra de
   scroll. O ecrã de entrada já não o reserva, mas o Portal sim
   ("scrollbar-gutter: stable"): na troca de um para o outro, a largura útil
   encolhia e tudo o que está centrado saltava uns pixéis para a esquerda
   antes de a porta abrir. */
const PE_SEM_GUTTER = `html, body { overflow: hidden !important; } html { scrollbar-gutter: auto !important; background: ${T.bg}; }`;
function PeRestoEntrada({ html, apagar }) {
  return (
    <div aria-hidden="true" data-resto-entrada="" style={{
      position: 'fixed', inset: 0, zIndex: 0, isolation: 'isolate', pointerEvents: 'none',
      opacity: apagar ? 0 : 1, transition: 'opacity .55s cubic-bezier(.4,0,.2,1)', willChange: 'opacity',
    }} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

// O vidro da porta, sozinho, no sítio exato onde estava. Com `caixa`, é
// desenhado noutro referencial (dentro do ecrã que cresce): left/top/
// width/height/tam/raio já vêm nessas unidades.
function PortaVidroSo({ rect, aberto, logo, cor, caixa, fundo, tamEmblema, recolhido }) {
  const c = caixa || { left: rect.left, top: rect.top, width: rect.width, height: rect.height, tam: tamEmblema || Math.round(rect.height * 0.78), raio: 3, fixo: true };
  /* CADA FOLHA LEVA CONSIGO A SUA METADE DO QUE SE VÊ ATRÁS DO VIDRO (o
     balneário, desfocado). Assim a imagem da porta nunca muda: quando as
     folhas deslizam, o ecrã novo vai aparecendo na abertura, à medida que
     a porta abre — como numa porta de verdade. Vale para todos os ecrãs que
     saem da porta (ecrã inicial, parabéns, missão, jogo).
     O desfoque é um filtro fixo na imagem (e não um backdrop-filter, que
     tinha de ser recalculado a cada frame enquanto o ecrã cresce). */
  const folha = {
    position: 'absolute', top: 0, bottom: 0, width: '50%', overflow: 'hidden', willChange: 'transform',
    // Arranca devagar e trava devagar (ease-in-out).
    // No último terço do caminho, a folha também se apaga: não fica um fio
    // branco agarrado às bordas enquanto o ecrã cresce.
    // Folhas mais rápidas (0,65 s) e já invisíveis aos 0,55 s: o desfoque
    // delas a andar por cima do ecrã que cresce custava frames.
    transition: 'transform .65s cubic-bezier(.65,0,.35,1), opacity .25s ease-in .3s',
  };
  const metade = (lado) => (
    <>
      {fundo && (
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: lado === 'E' ? 0 : '-100%', width: '200%', overflow: 'hidden', background: '#121614' }}>
          <svg viewBox={`0 0 300 ${fundo.H}`} preserveAspectRatio="xMidYMid slice" width="100%" height="100%"
            style={{ display: 'block', position: 'absolute', inset: 0, filter: `blur(${c.desfoque || 7}px)`, transform: 'scale(1.06)' }}
            dangerouslySetInnerHTML={{ __html: fundo.svg }} />
        </div>
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(225,240,248,.6), rgba(170,200,215,.4))' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: lado === 'E' ? 0 : '-100%', width: '200%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: logo ? 0.6 : 1 }}>
        <PeEmblema logo={logo} cor={cor} tam={c.tam} branco />
      </div>
    </>
  );
  return (
    /* Dentro do ecrã que cresce (`caixa`), o vidro tem os cantos RETOS: a
       janela por onde se vê o ecrã novo também é reta, e com os cantos
       arredondados o ecrã de trás espreitava pelos quatro cantos (viam-se
       letras) antes de a porta abrir. A janela corta tudo o que passa da
       borda, por isso, de fora, a porta continua igual. */
    <div aria-hidden="true" style={{ position: c.fixo ? 'fixed' : 'absolute', left: c.left, top: c.top, width: c.width, height: c.height, overflow: 'hidden', borderRadius: c.fixo ? c.raio : 0, zIndex: 9999, pointerEvents: 'none' }}>
      {/* Depois de abertas (já fora do buraco da porta), as folhas saem de cena. */}
      {!recolhido && <div data-folha="E" style={{ ...folha, left: 0, transform: aberto ? 'translateX(-101%)' : 'none', opacity: aberto ? 0 : 1 }}>{metade('E')}</div>}
      {!recolhido && <div data-folha="D" style={{ ...folha, right: 0, transform: aberto ? 'translateX(101%)' : 'none', opacity: aberto ? 0 : 1 }}>{metade('D')}</div>}
      {/* A junta das folhas: 1 px no ecrã (nas unidades da caixa, 1/esc0). */}
      {!recolhido && <div data-junta="" style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: c.fixo ? 1 : c.raio / 3, background: 'rgba(255,255,255,.9)', opacity: aberto ? 0 : 1, transition: 'opacity .12s' }} />}
    </div>
  );
}

/* Envolve o primeiro ecrã do Portal. Sem entrada pela porta, não faz nada.
   `focoInteiro`: o ecrã todo vai para o buraco da porta (parabéns, missão);
   senão vai o elemento marcado com data-entrada-foco (o balneário). */
function TransicaoEntrada({ focoInteiro, children }) {
  /* Duas camadas: a "janela" (o buraco da porta, que cresce até ao ecrã) e
     o conteúdo lá dentro (que encolhe na mesma medida e se desloca, para o
     foco ficar sempre certo). Tudo com transform — o browser anima isto sem
     redesenhar o ecrã a cada frame, por isso não engasga mesmo em ecrãs
     pesados como o do jogo. Os passos são calculados à mão (com a curva já
     aplicada) para a janela e o conteúdo andarem sempre certos um com o
     outro. */
  const janelaRef = useRef(null), conteudoRef = useRef(null);
  const [ent] = useState(() => (entradaRecente() ? ENTRADA : null));
  const [ativa, setAtiva] = useState(!!ent);
  const [vidroAberto, setVidroAberto] = useState(false);
  const [vidroRecolhido, setVidroRecolhido] = useState(false);
  const [caixaVidro, setCaixaVidro] = useState(null);
  React.useLayoutEffect(() => {
    if (!ent) return undefined;
    // Onde a porta está agora (o ecrã anterior registou-o ao sair).
    const rectAgora = (ENTRADA && ENTRADA.rect) || ent.rect;
    ENTRADA = null;
    const jan = janelaRef.current, con = conteudoRef.current;
    const reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const acabar = () => { setAtiva(false); window.dispatchEvent(new CustomEvent('mjp-entrada-fim')); };
    if (!jan || !con || reduzir || typeof jan.animate !== 'function') { acabar(); return undefined; }
    // Medidas reais da janela (no telemóvel, 100vh pode não ser a altura visível).
    const vw = jan.clientWidth || window.innerWidth, vh = jan.clientHeight || window.innerHeight;
    const alvoEl = !focoInteiro ? con.querySelector('[data-entrada-foco]') : null;
    const f = alvoEl ? alvoEl.getBoundingClientRect() : { left: 0, top: 0, width: vw, height: vh };
    const d = rectAgora;
    const esc0 = Math.max(d.width / f.width, d.height / f.height);
    const fcx = f.left + f.width / 2, fcy = f.top + f.height / 2;
    const tx0 = (d.left + d.width / 2) - esc0 * fcx, ty0 = (d.top + d.height / 2) - esc0 * fcy;
    const lerp = (a1, b1, p) => a1 + (b1 - a1) * p;
    // Curva suave nas duas pontas (sem arranque seco nem travagem brusca).
    const curva = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
    const passo = (p) => {
      const wl = lerp(d.left, 0, p), wt = lerp(d.top, 0, p), ww = lerp(d.width, vw, p), wh = lerp(d.height, vh, p);
      const sx = ww / vw, sy = wh / vh;
      const esc = lerp(esc0, 1, p), tx = lerp(tx0, 0, p), ty = lerp(ty0, 0, p);
      return {
        janela: `translate(${wl}px, ${wt}px) scale(${sx}, ${sy})`,
        conteudo: `scale(${1 / sx}, ${1 / sy}) translate(${tx - wl}px, ${ty - wt}px) scale(${esc})`,
      };
    };
    const inicio = passo(0);
    jan.style.transform = inicio.janela;
    con.style.transform = inicio.conteudo;
    // O buraco da porta nas medidas do ecrã de trás (antes de encolher).
    setCaixaVidro({
      left: fcx - d.width / 2 / esc0, top: fcy - d.height / 2 / esc0,
      width: d.width / esc0, height: d.height / esc0, tam: (ent.tam || d.height * 0.78) / esc0, raio: 3 / esc0,
      /* O desfoque também tem de estar nestas unidades: o ecrã de trás está
         encolhido (esc0) e, com 7 px fixos, o balneário ficava mais nítido
         (e parecia mais claro) no instante em que a porta passava para aqui. */
      desfoque: 7 / esc0,
    });
    let cancelado = false;
    /* Espera que o ecrã de trás acabe de se montar (o do jogo é pesado)
       antes de abrir: assim a abertura nunca apanha um engasgo.
       Com a porta fechada nada muda: o balneário continua atrás do vidro.
       No MESMO instante: o vidro abre, o balneário dá lugar ao ecrã que
       entra (o jogo, os parabéns, a missão ou o ecrã inicial), o resto do
       ecrã de entrada desvanece-se e a janela cresce até à página inteira. */
    let r1 = 0, r2 = 0, tempo = 0;
    /* SÓ ABRE COM O BROWSER LIVRE. Ecrãs pesados (o do jogo) continuam a
       trabalhar depois de aparecerem (efeitos, contagem, imagens): se a
       porta abrisse logo, a animação corria "às escuras" durante esse
       trabalho e o primeiro frame visível já mostrava o ecrã quase inteiro,
       sem se ver a porta a abrir. Aqui espera-se por 4 frames seguidos
       fluidos (no máximo 2 s), com a porta fechada e o "acesso autorizado"
       à vista; depois a abertura é igual em todos os ecrãs. */
    const esperarCalma = (seguir) => {
      let ult = 0, bons = 0, ini = 0;
      const f = (t) => {
        if (cancelado) return;
        if (!ini) { ini = t; ult = t; r1 = requestAnimationFrame(f); return; }
        bons = (t - ult) < 34 ? bons + 1 : 0;
        ult = t;
        if (bons >= 4 || t - ini > 2000) seguir(); else r1 = requestAnimationFrame(f);
      };
      r1 = requestAnimationFrame(f);
    };
    /* RELÓGIO COM TRAVÃO. A abertura é desenhada frame a frame com um
       relógio próprio que nunca avança mais de 34 ms por frame. Se o
       browser se atrasar (ecrãs pesados, como o do jogo, ainda a ser
       desenhados), a porta abranda nesse instante em vez de saltar para a
       frente; com frames normais, as durações são as de sempre. Assim todos
       os ecrãs que saem da porta se comportam exatamente como o dos
       parabéns.
       Passagem, no relógio da animação:
         0 ms    as folhas começam a abrir (0,65 s), cada uma com a sua
                 metade da imagem da porta (que nunca muda); o ecrã novo vai
                 aparecendo na abertura; o resto do ecrã de entrada
                 desvanece-se (0,55 s);
         300 ms  o ecrã cresce até à página inteira (1 s, a acelerar e a
                 travar devagar); as folhas apagam-se enquanto saem
                 (até aos 550 ms);
         600 ms  as folhas, já invisíveis, saem de cena;
         1300 ms fim. */
    const lim = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
    const entrada = (p) => p * p;
    const saida = (p) => 1 - Math.pow(1 - p, 3);
    esperarCalma(() => {
      if (cancelado) return;
      const folhas = Array.from(con.querySelectorAll('[data-folha]'));
      const junta = con.querySelector('[data-junta]');
      const resto = document.querySelector('[data-resto-entrada]');
      [...folhas, junta, resto].forEach(el => { if (el) el.style.transition = 'none'; });
      let v = 0, ult = 0, recolhidas = false;
      const quadro = (t) => {
        if (cancelado) return;
        if (ult) v += Math.min(t - ult, 34);
        ult = t;
        const pf = curva(lim(v / 650)), of = 1 - entrada(lim((v - 300) / 250));
        if (!recolhidas) folhas.forEach(el => {
          el.style.transform = `translateX(${el.dataset.folha === 'E' ? -101 * pf : 101 * pf}%)`;
          el.style.opacity = String(of);
        });
        if (junta) junta.style.opacity = String(1 - lim(v / 120));
        if (resto) resto.style.opacity = String(1 - saida(lim(v / 550)));
        if (!recolhidas && v >= 600) {
          recolhidas = true;
          folhas.forEach(el => { el.style.display = 'none'; });
          if (junta) junta.style.display = 'none';
        }
        const q = passo(curva(lim((v - 300) / 1000)));
        jan.style.transform = q.janela;
        con.style.transform = q.conteudo;
        if (v >= 1300) { jan.style.transform = ''; con.style.transform = ''; acabar(); return; }
        r2 = requestAnimationFrame(quadro);
      };
      r2 = requestAnimationFrame(quadro);
    });
    return () => { cancelado = true; clearTimeout(tempo); cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      {/* Enquanto a porta abre, as animações do próprio ecrã (flashes do
          estádio, placard a cair, bilhete a entrar…) ficam em pausa: cada uma
          obrigava a redesenhar a camada que está a crescer, e era isso que
          engasgava. Arrancam quando o ecrã já está na página inteira. */}
      {ativa && <style>{PE_SEM_GUTTER}</style>}
      {ativa && <style>{`.mjp-entrada-ativa *, .mjp-entrada-ativa *::before, .mjp-entrada-ativa *::after { animation-play-state: paused !important; } .mjp-entrada-ativa [data-entrada-anima] { animation-play-state: running !important; } .mjp-entrada-ativa [data-festa-papel] { visibility: hidden !important; }`}</style>}
      {/* O resto do ecrã de entrada fica por baixo da janela que cresce e
          desvanece-se enquanto a porta abre. */}
      {ativa && ent && ent.resto && <PeRestoEntrada html={ent.resto} apagar={vidroAberto} />}
      <div ref={janelaRef} className={ativa ? 'mjp-entrada-ativa' : undefined} style={ativa ? { position: 'fixed', inset: 0, overflow: 'hidden', transformOrigin: '0 0', background: T.bg, willChange: 'transform' } : undefined}>
        {/* will-change: as duas camadas ficam prontas (já desenhadas) antes de
            o crescimento arrancar. Sem isto, o browser preparava-as no
            primeiro frame da animação e havia um pequeno engasgo. */}
        <div ref={conteudoRef} style={ativa ? { position: 'absolute', inset: 0, transformOrigin: '0 0', willChange: 'transform' } : undefined}>
          {children}
          {/* O vidro está no mesmo referencial do ecrã: abre, apaga-se e,
              enquanto isso, cresce e é cortado com ele — nada fica preso no
              sítio da porta. */}
          {ativa && ent && <PortaVidroSo rect={ent.rect} caixa={caixaVidro || undefined} aberto={vidroAberto} recolhido={vidroRecolhido} logo={ent.logo} cor={ent.cor} fundo={ent.fundo} />}
        </div>
      </div>
    </>
  );
}

/* Porta automática de vidro fosco com o emblema do clube a toda a altura,
   cada metade do emblema numa folha. Atrás, o balneário da página inicial
   (com o cacifo do jogador) e a TV a dar as boas-vindas. */
function PePorta({ aberta, jogador, cor, logo, clube, largura, altura, faceId = 'desligado', onEmblema, pista }) {
  const caixaRef = useRef(null);
  const portaRef = useRef(null);

  const [tam, setTam] = useState({ w: 260, h: 180 });
  useEffect(() => {
    const el = caixaRef.current;
    if (!el) return undefined;
    const medir = () => { if (el.clientWidth && el.clientHeight) setTam(t => (t.w === el.clientWidth && t.h === el.clientHeight ? t : { w: el.clientWidth, h: el.clientHeight })); };
    medir();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(medir); ro.observe(el); return () => ro.disconnect();
  }, []);
  const H = Math.round(Math.max(215, Math.min(420, (300 * tam.h) / Math.max(1, tam.w))));
  // A porta é agora deitada (como o quadro da equipa técnica): o emblema
  // ocupa 42 % da altura do vidro (o Face ID, à volta, 52 %). O mesmo
  // tamanho passa para a abertura.
  const tamEmblema = Math.round(tam.h * (largura ? 0.42 : 0.78));
  const nome = String((jogador && jogador.nome) || '').trim();
  const primeiro = nome ? nome.split(/\s+/)[0] : '';
  const numero = jogador && jogador.numero != null && String(jogador.numero).trim() !== '' ? String(jogador.numero).trim() : '';
  const svg = React.useMemo(() => pkhBalneario({
    cor, numero, nome: primeiro, foto: (jogador && jogador.foto) || '', iniciais: peIniciais(nome),
    logo: logo || '', inicialClube: clube ? String(clube)[0].toUpperCase() : '', badge: 0, boasVindas: primeiro || 'Atleta',
    // A mesma luz do ecrã inicial (de madrugada, só a luz de presença): a imagem da porta não muda ao abrir.
    apagado: (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() < CHECKIN_WINDOWS.wellness.startMin ? 'presenca' : false; })(),
  }, 300, H), [T.corEquipa, numero, primeiro, jogador && jogador.foto, logo, clube, H]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Acesso autorizado: guarda onde está o vidro (o ecrã seguinte vai
     aparecer atrás dele) e o resto da porta apaga-se. O vidro só abre já
     com o Portal pronto por trás (ver TransicaoEntrada). */
  /* Acesso autorizado: o resto do ecrã apaga-se e a porta fica onde está.
     Guarda-se o sítio do vidro e o que se vê atrás dele (o balneário), para
     o ecrã seguinte começar exatamente daqui. */
  useEffect(() => {
    if (!aberta) { ENTRADA = null; return undefined; }
    const el = caixaRef.current;
    if (!el) return undefined;
    const r = el.getBoundingClientRect();
    ENTRADA_T = Date.now();
    ENTRADA = {
      rect: { left: r.left, top: r.top, width: r.width, height: r.height }, fundo: { svg, H },
      tam: tamEmblema, logo: logo || '', cor, t: Date.now(),
    };
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta]);
  /* Com o acesso autorizado, o letreiro, a moldura e a base ficam à vista
     (o letreiro fica verde). Só se desvanecem quando a porta abre, já no
     Portal (ver PeRestoEntrada). */
  const apagar = {};
  const vidro = {
    position: 'absolute', top: 0, bottom: 0, width: '50%', overflow: 'hidden',
    background: 'linear-gradient(160deg, rgba(225,240,248,.6), rgba(170,200,215,.4))',
    transition: 'transform 1.1s cubic-bezier(.4,.1,.2,1)',
  };
  // O emblema ocupa a porta toda; cada folha mostra a sua metade.
  const emblemaNoVidro = (lado) => (
    <div style={{ position: 'absolute', top: 0, bottom: 0, left: lado === 'E' ? 0 : '-100%', width: '200%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: logo ? 0.6 : 1 }}>
      <PeEmblema logo={logo} cor={cor} tam={tamEmblema} branco />
    </div>
  );
  const corSinal = aberta ? '#4CAF6A' : '#FF5A4E';
  // (o sinal verde e o letreiro mudam no instante em que o acesso é autorizado)
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', ...(largura ? { flex: 'none' } : { flex: 1, minHeight: 0 }) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0d120f', border: '1px solid #3a4440', borderRadius: 8, padding: largura ? '6px 16px' : '5px 12px', boxShadow: '0 0 14px rgba(255,194,61,.15)', marginBottom: largura ? 14 : 8, flexShrink: 0, boxSizing: 'border-box', ...apagar }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: corSinal, boxShadow: `0 0 8px ${corSinal}`, transition: 'all .3s' }} />
        <div style={{ textAlign: 'left', lineHeight: 1.1 }}>
          <div style={{ fontSize: 11, letterSpacing: '.18em', color: aberta ? '#8EE6A0' : '#8A9A8C', transition: 'color .3s', ...body }}>{aberta ? 'ACESSO AUTORIZADO' : 'ACESSO RESERVADO'}</div>
          <div style={{ ...display, fontSize: 17, fontWeight: 600, letterSpacing: largura ? '.3em' : '.24em', color: aberta ? '#8EE6A0' : '#FFC23D', transition: 'color .3s' }}>PLANTEL</div>
        </div>
      </div>
      {/* Proporção de porta (5:6): com menos altura fica mais estreita, em
          vez de achatada (iPad deitado, telemóveis baixos). */}
      <div ref={portaRef} style={largura ? {
        position: 'relative', zIndex: 2, flex: 'none', width: largura + 14, height: altura + 14, borderRadius: 8, padding: 7, boxSizing: 'border-box', display: 'flex',
      } : {
        position: 'relative', zIndex: 2, flex: 1, minHeight: 120, maxHeight: 'min(48dvh, 520px)', aspectRatio: '5 / 6', width: 'auto', maxWidth: '100%', borderRadius: 8, padding: 7, boxSizing: 'border-box', display: 'flex',
      }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: 8, ...(largura && TEMA_ATUAL === 'claro'
          ? { background: 'linear-gradient(90deg,#AEB7B1,#E2E7E3 50%,#AEB7B1)', boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,.8), 0 14px 26px rgba(30,40,30,.28)' }
          : { background: 'linear-gradient(90deg,#3a423d,#59635d 50%,#3a423d)', boxShadow: '0 10px 24px rgba(0,0,0,.45)' }), ...apagar }} />
        <div ref={caixaRef} style={{ position: 'relative', flex: 1, overflow: 'hidden', borderRadius: 3, background: '#121614' }}>
          {/* Desfocado com o MESMO filtro das folhas da porta que abre no
              Portal (PortaVidroSo): a imagem fica idêntica na passagem. */}
          <svg viewBox={`0 0 300 ${H}`} preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ display: 'block', position: 'absolute', inset: 0, filter: 'blur(7px)', transform: 'scale(1.06)' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
          <div style={{ ...vidro, left: 0 }}>{emblemaNoVidro('E')}</div>
          <div style={{ ...vidro, right: 0 }}>{emblemaNoVidro('D')}</div>
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,.9)' }} />
        </div>
        {/* O EMBLEMA É O FACE ID (o "pontapé de saída", como na equipa
            técnica): os quatro cantos, a onda de luz e, nas primeiras vezes,
            um dedo que toca. Saem quando o acesso é autorizado — não vão na
            cópia do ecrã que fica por baixo da porta a abrir. */}
        {largura && !aberta && onEmblema && (() => {
          const t = Math.round(altura * 0.52), c = Math.round(t * 0.22);
          const corC = faceId === 'ok' ? '#8EE6A0' : '#C9A227';
          const canto = (o) => ({ position: 'absolute', width: c, height: c, borderColor: corC, borderStyle: 'solid', borderWidth: 0, boxSizing: 'border-box', ...o });
          return (
            <>
              {faceId !== 'desligado' && (
                <div aria-hidden="true" style={{ position: 'absolute', left: 7 + largura / 2 - t / 2, top: 7 + altura / 2 - t / 2, width: t, height: t, pointerEvents: 'none', zIndex: 3,
                  animation: faceId === 'pronto' ? 'pe-respira 2.2s ease-in-out infinite' : 'none' }}>
                  {faceId === 'pronto' && <div style={{ position: 'absolute', inset: '4%', borderRadius: '50%', boxSizing: 'border-box', border: '2.5px solid rgba(255,214,120,.95)', boxShadow: '0 0 16px rgba(255,214,120,.65), inset 0 0 10px rgba(255,214,120,.35)', animation: 'pe-anel 2.2s cubic-bezier(.2,.6,.3,1) infinite' }} />}
                  <div style={canto({ left: 0, top: 0, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 8 })} />
                  <div style={canto({ right: 0, top: 0, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 8 })} />
                  <div style={canto({ left: 0, bottom: 0, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 8 })} />
                  <div style={canto({ right: 0, bottom: 0, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 8 })} />
                  {pista && faceId === 'pronto' && (
                    <svg width="34" height="40" viewBox="0 0 24 28" aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -4, marginTop: 2, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.6))', animation: 'pe-dedo 2.6s ease-in-out .8s 2 both' }}>
                      <path d="M9 2.5a2 2 0 0 1 4 0V12l1.2-.6a2 2 0 0 1 2.6.9l.3.6 1.4-.4a2 2 0 0 1 2.4 1.5l.1.6.9-.1a2 2 0 0 1 2.1 2v4.3c0 3.9-3.2 7-7.1 7H14c-2.3 0-4.4-1.1-5.7-3L3.6 18.3a2 2 0 0 1 .4-2.8 2 2 0 0 1 2.6.2L9 18V2.5z" fill="#FBF3F0" stroke="#0D120F" strokeWidth="1.1" strokeLinejoin="round" />
                    </svg>
                  )}
                  {faceId === 'a-ler' && <div style={{ position: 'absolute', left: '8%', right: '8%', height: 2, background: '#FFC23D', boxShadow: '0 0 8px #FFC23D', animation: 'pe-varre 1s ease-in-out infinite' }} />}
                </div>
              )}
              <button type="button" onClick={onEmblema} aria-label={faceId === 'desligado' ? 'Entrar com o PIN' : `Entrar com ${PE_BIO_TXT.comArtigo}`}
                style={{ position: 'absolute', left: 7 + largura / 2 - altura * 0.2, top: 7 + altura / 2 - altura * 0.2, width: altura * 0.4, height: altura * 0.4, borderRadius: '50%', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', zIndex: 4 }} />
            </>
          );
        })()}
      </div>
      {!largura && <div style={{ width: 'min(60%, 220px)', height: 8, borderRadius: '0 0 4px 4px', background: '#2a332d', flexShrink: 0, ...apagar }} />}
    </div>
  );
}

/* INSTALAR O PORTAL NO TELEMÓVEL (ícone no ecrã inicial). Assim o atleta
   abre sempre pelo mesmo sítio e o cartão fica lá guardado de vez.
   · Android/Chrome: o navegador oferece "Instalar" (evento guardado em
     window.__mjpInstalar, ver prepararPortalInstalavel).
   · iPhone: não há botão automático — mostram-se os passos (Partilhar →
     Adicionar ao ecrã principal). O ícone do iPhone tem a memória separada
     do Safari: na 1.ª vez que abrir pelo ícone, recupera o cartão com o
     código antigo e o PIN.
   Já instalado (aberto pelo ícone): não aparece. */
function peEstaInstalado() {
  try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (e) { return false; }
}
function PeInstalar({ estilo, aoAbrir }) {
  const [pedido, setPedido] = useState(() => (typeof window !== 'undefined' ? window.__mjpInstalar || null : null));
  const [ajuda, setAjuda] = useState(false);
  useEffect(() => {
    const f = () => setPedido(window.__mjpInstalar || null);
    window.addEventListener('mjp-instalavel', f);
    return () => window.removeEventListener('mjp-instalavel', f);
  }, []);
  if (typeof window === 'undefined' || peEstaInstalado()) return null;
  const ua = navigator.userAgent || '';
  const iphone = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const android = /android/i.test(ua);
  const instalar = async () => {
    if (pedido) {
      try { pedido.prompt(); await pedido.userChoice; } catch (e) { /* cancelado */ }
      window.__mjpInstalar = null; setPedido(null);
      if (aoAbrir) aoAbrir();
      return;
    }
    setAjuda(true);
  };
  return (
    <>
      <button type="button" onClick={instalar} style={estilo}>Instalar app no dispositivo</button>
      {ajuda && (
        <div onClick={() => setAjuda(false)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '18px 18px 14px', color: T.cream, ...body }}>
            <div style={{ ...display, fontSize: 19, fontWeight: 600, marginBottom: 10 }}>Instalar app no dispositivo</div>
            {iphone ? (
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: T.muted }}>
                <li>Abre este link no <strong style={{ color: T.cream }}>Safari</strong>.</li>
                <li>Toca em <strong style={{ color: T.cream }}>Partilhar</strong> (o quadrado com a seta para cima).</li>
                <li>Escolhe <strong style={{ color: T.cream }}>Adicionar ao ecrã principal</strong>.</li>
                <li>Abre o Portal pelo ícone novo. Na primeira vez, usa <strong style={{ color: T.cream }}>Entrar com o código antigo</strong> e o teu PIN.</li>
              </ol>
            ) : android ? (
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: T.muted }}>
                <li>Abre este link no <strong style={{ color: T.cream }}>Chrome</strong> (se estiveres dentro do WhatsApp, toca nos três pontos e escolhe abrir no navegador).</li>
                <li>Toca nos <strong style={{ color: T.cream }}>três pontos</strong> do canto.</li>
                <li>Escolhe <strong style={{ color: T.cream }}>Instalar app</strong> ou <strong style={{ color: T.cream }}>Adicionar ao ecrã principal</strong>.</li>
              </ol>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: T.muted }}>
                <li>Usa o <strong style={{ color: T.cream }}>Chrome</strong> ou o <strong style={{ color: T.cream }}>Edge</strong> (o Safari e o Firefox do computador não instalam apps).</li>
                <li>Na barra do endereço, à direita, toca no ícone de <strong style={{ color: T.cream }}>instalar</strong> (um ecrã com uma seta), ou abre o menu <strong style={{ color: T.cream }}>⋮</strong> e escolhe <strong style={{ color: T.cream }}>Instalar Portal do Atleta</strong>.</li>
                <li>Se não aparecer essa opção, a app já está instalada neste computador: procura <strong style={{ color: T.cream }}>Portal</strong> nas aplicações.</li>
              </ol>
            )}
            <button type="button" onClick={() => setAjuda(false)} style={{ marginTop: 14, width: '100%', padding: 11, borderRadius: 12, border: 'none', background: T.goldFundo, color: '#1A2A1F', ...display, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Percebi</button>
          </div>
        </div>
      )}
    </>
  );
}

/* Gerador de QR code compacto (modo byte, correção L, versões 1–10).
   Chega para o link de ligação do cartão (~90 caracteres). */
function qrMatriz(texto) {
  const bytes = Array.from(new TextEncoder().encode(texto));
  const TAB = { 1: [7, [[1, 19]]], 2: [10, [[1, 34]]], 3: [15, [[1, 55]]], 4: [20, [[1, 80]]], 5: [26, [[1, 108]]], 6: [18, [[2, 68]]], 7: [20, [[2, 78]]], 8: [24, [[2, 97]]], 9: [30, [[2, 116]]], 10: [18, [[2, 68], [2, 69]]] };
  const ALINH = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
  let v = 1, dadosCw = 0;
  for (; v <= 10; v++) {
    dadosCw = TAB[v][1].reduce((s, [n, c]) => s + n * c, 0);
    const bitsConta = v < 10 ? 8 : 16;
    if (4 + bitsConta + bytes.length * 8 <= dadosCw * 8) break;
  }
  if (v > 10) throw new Error('Texto demasiado longo para o QR');
  const bits = [];
  const poe = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  poe(4, 4); poe(bytes.length, v < 10 ? 8 : 16); bytes.forEach(b => poe(b, 8));
  for (let i = 0; i < 4 && bits.length < dadosCw * 8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const cw = [];
  for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let k = 0; cw.length < dadosCw; k++) cw.push(k % 2 ? 0x11 : 0xEC);
  // Reed-Solomon em GF(256)
  const EXP = new Array(512), LOG = new Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
  const ecN = TAB[v][0];
  let gen = [1];
  for (let i = 0; i < ecN; i++) {
    const g = new Array(gen.length + 1).fill(0);
    gen.forEach((c, j) => { g[j] ^= c; g[j + 1] ^= mul(c, EXP[i]); });
    gen = g;
  }
  const blocos = [], ecs = [];
  let pos = 0;
  TAB[v][1].forEach(([n, c]) => {
    for (let b = 0; b < n; b++) {
      const d = cw.slice(pos, pos + c); pos += c; blocos.push(d);
      const r = d.concat(new Array(ecN).fill(0));
      for (let i = 0; i < d.length; i++) { const f = r[i]; if (f) gen.forEach((g, j) => { r[i + j] ^= mul(g, f); }); }
      ecs.push(r.slice(d.length));
    }
  });
  const fim = [];
  const maxD = Math.max(...blocos.map(b => b.length));
  for (let i = 0; i < maxD; i++) blocos.forEach(b => { if (i < b.length) fim.push(b[i]); });
  for (let i = 0; i < ecN; i++) ecs.forEach(e => fim.push(e[i]));
  // matriz
  const N = 17 + 4 * v;
  const M = Array.from({ length: N }, () => new Array(N).fill(null));
  const fixo = Array.from({ length: N }, () => new Array(N).fill(false));
  const set = (r, c, val) => { M[r][c] = val; fixo[r][c] = true; };
  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const rr = r0 + r, cc = c0 + c;
      if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
      const dentro = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const anel = dentro && (r === 0 || r === 6 || c === 0 || c === 6);
      const meio = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      set(rr, cc, dentro && (anel || meio) ? 1 : 0);
    }
  };
  finder(0, 0); finder(0, N - 7); finder(N - 7, 0);
  for (let i = 8; i < N - 8; i++) { set(6, i, i % 2 ? 0 : 1); set(i, 6, i % 2 ? 0 : 1); }
  const al = ALINH[v];
  al.forEach(r => al.forEach(c => {
    if ((r === 6 && c === 6) || (r === 6 && c === N - 7) || (r === N - 7 && c === 6)) return;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) === 1 ? 0 : 1);
  }));
  set(N - 8, 8, 1); // módulo escuro
  for (let i = 0; i < 9; i++) { if (!fixo[8][i]) set(8, i, 0); if (!fixo[i][8]) set(i, 8, 0); }
  for (let i = 0; i < 8; i++) { set(8, N - 1 - i, 0); set(N - 1 - i, 8, 0); }
  if (v >= 7) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { set(i, N - 11 + j, 0); set(N - 11 + j, i, 0); }
  // dados em zigue-zague
  const dbits = [];
  fim.forEach(b => { for (let i = 7; i >= 0; i--) dbits.push((b >> i) & 1); });
  let k = 0, sobe = true;
  for (let c = N - 1; c > 0; c -= 2) {
    if (c === 6) c--;
    for (let i = 0; i < N; i++) {
      const r = sobe ? N - 1 - i : i;
      for (let d = 0; d < 2; d++) {
        const cc = c - d;
        if (!fixo[r][cc]) { M[r][cc] = k < dbits.length ? dbits[k] : 0; k++; }
      }
    }
    sobe = !sobe;
  }
  const mascaras = [(r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0];
  const bch = (dados, polinomio, nBits) => {
    let x = dados << nBits;
    const grau = Math.floor(Math.log2(polinomio));
    while (Math.floor(Math.log2(x || 1)) >= grau && x) x ^= polinomio << (Math.floor(Math.log2(x)) - grau);
    return (dados << nBits) | x;
  };
  const aplica = (m) => {
    const A = M.map(l => l.slice());
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!fixo[r][c] && mascaras[m](r, c)) A[r][c] ^= 1;
    const fmt = bch((0b01 << 3) | m, 0x537, 10) ^ 0x5412;
    const fb = i => (fmt >> i) & 1;
    for (let i = 0; i <= 5; i++) A[8][i] = fb(14 - i);
    A[8][7] = fb(8); A[8][8] = fb(7); A[7][8] = fb(6);
    for (let i = 9; i <= 14; i++) A[14 - i][8] = fb(14 - i);
    for (let i = 0; i <= 7; i++) A[N - 1 - i][8] = fb(14 - i);
    for (let i = 8; i <= 14; i++) A[8][N - 15 + i] = fb(14 - i);
    if (v >= 7) {
      const vi = bch(v, 0x1f25, 12);
      for (let i = 0; i < 18; i++) { const b = (vi >> i) & 1; const a = Math.floor(i / 3), bb = i % 3 + N - 11; A[a][bb] = b; A[bb][a] = b; }
    }
    return A;
  };
  const penal = (A) => {
    let p = 0;
    for (let r = 0; r < N; r++) for (const lin of [A[r], A.map(l => l[r])]) {
      let run = 1;
      for (let i = 1; i < N; i++) { if (lin[i] === lin[i - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
      const s = lin.join('');
      p += 40 * ((s.match(/10111010000/g) || []).length + (s.match(/00001011101/g) || []).length);
    }
    for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) { const s = A[r][c] + A[r + 1][c] + A[r][c + 1] + A[r + 1][c + 1]; if (s === 0 || s === 4) p += 3; }
    const escuros = A.reduce((s, l) => s + l.reduce((a, b) => a + b, 0), 0);
    p += Math.floor(Math.abs(escuros * 100 / (N * N) - 50) / 5) * 10;
    return p;
  };
  let melhor = null, melhorP = Infinity;
  for (let m = 0; m < 8; m++) { const A = aplica(m); const p = penal(A); if (p < melhorP) { melhorP = p; melhor = A; } }
  return melhor;
}

function PeQr({ texto, tam = 180 }) {
  let m = null;
  try { m = qrMatriz(texto); } catch (e) { m = null; }
  if (!m) return null;
  const N = m.length, q = 2; // margem branca de 2 módulos
  let d = '';
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (m[r][c]) d += `M${c + q} ${r + q}h1v1h-1z`;
  return (
    <svg viewBox={`0 0 ${N + 2 * q} ${N + 2 * q}`} width={tam} height={tam} shapeRendering="crispEdges" role="img" aria-label="QR code para ligar o outro aparelho" style={{ display: 'block', background: '#fff', borderRadius: 8 }}>
      <path d={d} fill="#0d120f" />
    </svg>
  );
}

/* O NOME DE CADA APARELHO na lista "Os teus aparelhos", para o atleta
   saber qual remover: sistema e tipo ("iPhone", "Android", "Computador
   Windows", "Computador Mac"…), o modelo quando o navegador o diz (o
   Chrome no Android, via userAgentData — ex.: "Samsung SM-A536B"), o
   navegador, e "ícone" quando o Portal está instalado no ecrã inicial. */
async function peDescricaoAparelho() {
  try {
    const ua = navigator.userAgent || '';
    const ipad = /ipad/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    let aparelho = /iphone/i.test(ua) ? 'iPhone' : ipad ? 'iPad'
      : /android/i.test(ua) ? (/mobile/i.test(ua) ? 'Android' : 'Tablet Android')
        : /windows/i.test(ua) ? 'Computador Windows' : /cros/i.test(ua) ? 'Chromebook'
          : /macintosh|mac os x/i.test(ua) ? 'Computador Mac' : /linux/i.test(ua) ? 'Computador Linux' : 'Computador';
    // Modelo do telemóvel (só o Chrome/Edge no Android o revelam).
    try {
      let modelo = '';
      if (/android/i.test(ua) && navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
        const h = await navigator.userAgentData.getHighEntropyValues(['model']);
        modelo = String((h && h.model) || '').trim();
      }
      if ((!modelo || modelo === 'K') && /android/i.test(ua)) {
        const m = ua.match(/Android [\d.]+; ([^;)]+?)(?: Build|\))/);
        modelo = m ? m[1].trim() : '';
      }
      if (modelo && modelo !== 'K') aparelho = /^SM-/i.test(modelo) ? `Samsung ${modelo}` : modelo;
    } catch (e) { /* sem modelo: fica o tipo */ }
    const nav = /edg\//i.test(ua) ? 'Edge' : /samsungbrowser/i.test(ua) ? 'Samsung Internet' : /opr\//i.test(ua) ? 'Opera'
      : /firefox|fxios/i.test(ua) ? 'Firefox' : /crios|chrome/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : 'navegador';
    return `${aparelho} · ${peEstaInstalado() ? 'ícone' : nav}`;
  } catch (e) { return 'Aparelho'; }
}
// Regista (ou atualiza) o nome deste aparelho no servidor. Nunca falha alto.
function peDescreverAparelho(token, teamId) {
  peDescricaoAparelho()
    .then(d => peRpc('checkin_cartao_descrever', { p_token: token, p_team: teamId, p_descricao: d }))
    .catch(() => {});
}

/* IMPRESSÃO DIGITAL / FACE ID (fase 3). O navegador fala com o leitor do
   aparelho (WebAuthn); a Edge Function "portal-biometria" gera os desafios
   e verifica as assinaturas. Aqui só se convertem os dados entre o formato
   do navegador (bytes) e o do servidor (texto base64url). */
function peB64uParaBuf(s) {
  const b = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b + '==='.slice((b.length + 3) % 4));
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}
function peBufParaB64u(buf) {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function peBioDisponivel() {
  try {
    return !!(window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
      && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch (e) { return false; }
}
/* Erros da Edge Function com o motivo à vista (para se perceber logo se é
   a verificação JWT ligada — 401 —, a função não publicada — 404 — ou
   falta de ligação), em vez de só "não foi possível". */
async function peBioFn(corpo) {
  const { data, error } = await supabase.functions.invoke('portal-biometria', { body: corpo });
  if (error) {
    const estado = error.context && error.context.status;
    let motivo = estado === 401 ? 'erro 401 · verificação JWT da função ligada'
      : estado === 404 ? 'erro 404 · função portal-biometria não encontrada'
        : estado ? `erro ${estado}`
          : /FunctionsFetchError/.test(error.name || '') ? 'sem ligação à função (verificação JWT ou função não publicada)'
            : (error.message || 'erro desconhecido');
    try {
      const corpoErro = error.context && typeof error.context.json === 'function' ? await error.context.json() : null;
      if (corpoErro && (corpoErro.erro || corpoErro.message || corpoErro.msg)) motivo += ` · ${corpoErro.erro || corpoErro.message || corpoErro.msg}`;
    } catch (e) { /* sem corpo */ }
    const e = new Error(motivo); e.diag = motivo; throw e;
  }
  return typeof data === 'string' ? JSON.parse(data) : (data || {});
}
async function peBioRegistar(o) {
  const cred = await navigator.credentials.create({ publicKey: {
    ...o,
    challenge: peB64uParaBuf(o.challenge),
    user: { ...o.user, id: peB64uParaBuf(o.user.id) },
    excludeCredentials: (o.excludeCredentials || []).map(c => ({ ...c, id: peB64uParaBuf(c.id) })),
  } });
  return {
    id: cred.id, rawId: peBufParaB64u(cred.rawId), type: cred.type,
    response: {
      clientDataJSON: peBufParaB64u(cred.response.clientDataJSON),
      attestationObject: peBufParaB64u(cred.response.attestationObject),
      transports: cred.response.getTransports ? cred.response.getTransports() : [],
    },
    clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
    authenticatorAttachment: cred.authenticatorAttachment || undefined,
  };
}
async function peBioAutenticar(o) {
  const cred = await navigator.credentials.get({ publicKey: {
    ...o,
    challenge: peB64uParaBuf(o.challenge),
    allowCredentials: (o.allowCredentials || []).map(c => ({ ...c, id: peB64uParaBuf(c.id) })),
  } });
  return {
    id: cred.id, rawId: peBufParaB64u(cred.rawId), type: cred.type,
    response: {
      clientDataJSON: peBufParaB64u(cred.response.clientDataJSON),
      authenticatorData: peBufParaB64u(cred.response.authenticatorData),
      signature: peBufParaB64u(cred.response.signature),
      userHandle: cred.response.userHandle ? peBufParaB64u(cred.response.userHandle) : undefined,
    },
    clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
    authenticatorAttachment: cred.authenticatorAttachment || undefined,
  };
}
const peBioRecusa = (teamId) => `mjp-bio-recusa:${teamId || 'sem-equipa'}`;
/* Desafio preparado antes do toque: válido por pouco tempo, para não se
   usar um que o servidor já tenha dado como expirado. */
const PE_BIO_VALIDADE_MS = 60 * 1000;
/* Abrir o leitor sozinho só onde o navegador o permite sem toque. No
   iPhone/iPad (todos os navegadores são WebKit) e no Safari do Mac, a
   Apple obriga a que o pedido nasça de um toque. */
function pePodeAutoAbrirBio() {
  try {
    const ua = navigator.userAgent || '';
    const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const safari = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Edg\/|OPR|SamsungBrowser|Android/.test(ua);
    return !ios && !safari;
  } catch (e) { return false; }
}
/* Nome do desbloqueio conforme o aparelho. O site não escolhe entre dedo
   e cara: é o sistema que usa o desbloqueio forte que tiver. No Android
   isso é quase sempre a impressão digital (o desbloqueio facial da maioria
   dos Android não é considerado seguro o suficiente para isto). */
function peBioTextos() {
  try {
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
      return { nome: 'Face ID ou Touch ID', comArtigo: 'o Face ID ou o Touch ID', gesto: 'usar a cara ou o dedo' };
    }
    if (/Macintosh/.test(ua)) return { nome: 'Touch ID', comArtigo: 'o Touch ID', gesto: 'usar o dedo' };
    // "Windows Hello" não diz nada a um jogador: fala-se do gesto que ele já
    // conhece (a cara, o dedo ou o PIN com que desbloqueia o computador).
    if (/Windows/.test(ua)) return { nome: 'desbloqueio do computador', comArtigo: 'o desbloqueio do computador', gesto: 'confirmar como desbloqueias o computador' };
  } catch (e) { /* segue para o habitual */ }
  return { nome: 'impressão digital', comArtigo: 'a impressão digital', gesto: 'usar o dedo' };
}
const PE_BIO_TXT = peBioTextos();
// Uma só abertura automática por carregamento da página: se o atleta
// cancelar, não volta a aparecer sozinho (fica o botão para tocar).
let peBioAutoFeito = false;

/* ===================================================================
   A CAMISOLA DO ATLETA, PENDURADA POR BAIXO DA PORTA (porta do Portal)
   ===================================================================
   É a mesma lógica da credencial da equipa técnica: de costas, a
   identidade (nome em cima, número ao meio) e a impressão digital no
   fundo; virada, o emblema ao peito e o PIN com o teclado (a tecla vazia
   leva a impressão digital e vira a camisola outra vez). Nas cores do
   clube (coresCamisola). Só visual: o PIN e a impressão digital continuam
   a passar pelas mesmas funções de sempre (tecla, entrarComBio).
   Desenhada a 300 × 330 e ajustada ao ecrã com `escala`. */
const PE_FORMA_CAMISOLA = 'M120 32 Q150 42 180 32 L226 52 Q244 60 250 82 L262 156 Q262 162 256 163 L232 168 '
  + 'Q226 168 225 162 L218 118 L220 314 Q150 326 80 314 L82 118 L75 162 Q74 168 68 168 '
  + 'L44 163 Q38 162 38 156 L50 82 Q56 60 74 52 Z';
const PE_ICONE_DEDO = (
  <>
    <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" /><path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
    <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" /><path d="M2 12a10 10 0 0 1 18-6" /><path d="M2 16h.01" />
    <path d="M21.8 16c.2-2 .131-5.354 0-6" /><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
    <path d="M8.65 22c.21-.66.45-1.32.57-2" /><path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
  </>
);
const PE_ICONE_TECLADO = (
  <>
    <rect x="3" y="3" width="5" height="5" rx="1" /><rect x="9.5" y="3" width="5" height="5" rx="1" /><rect x="16" y="3" width="5" height="5" rx="1" />
    <rect x="3" y="9.5" width="5" height="5" rx="1" /><rect x="9.5" y="9.5" width="5" height="5" rx="1" /><rect x="16" y="9.5" width="5" height="5" rx="1" />
    <rect x="9.5" y="16" width="5" height="5" rx="1" />
  </>
);
const PE_ICONE_VIRAR = (<><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></>);

function PeDesenhoCamisola({ cor, lado, id }) {
  const vivo = cor.mangas || '#FFFFFF';
  const frente = lado === 'frente';
  return (
    <svg width="300" height="330" viewBox="0 0 300 330" aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'block', filter: 'drop-shadow(0 16px 20px rgba(0,0,0,.55))' }}>
      <defs>
        <clipPath id={`${id}f`}><path d={PE_FORMA_CAMISOLA} /></clipPath>
        <linearGradient id={`${id}v`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity=".32" /><stop offset=".26" stopColor="#000" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".07" /><stop offset=".74" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".34" />
        </linearGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".1" /><stop offset=".3" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".24" /></linearGradient>
        <pattern id={`${id}m`} width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".55" fill="#000" fillOpacity=".13" /></pattern>
      </defs>
      <g clipPath={`url(#${id}f)`}>
        <rect width="300" height="330" fill={cor.base} />
        <path d="M74 52 Q56 60 50 82 L38 156 Q38 162 44 163 L68 168 Q74 168 75 162 L84 112 Z" fill={cor.escuro} opacity=".5" />
        <path d="M226 52 Q244 60 250 82 L262 156 Q262 162 256 163 L232 168 Q226 168 225 162 L216 112 Z" fill={cor.escuro} opacity=".5" />
        <path d="M74 52 Q86 84 84 118" fill="none" stroke="#000" strokeOpacity=".28" strokeWidth="1.5" />
        <path d="M226 52 Q214 84 216 118" fill="none" stroke="#000" strokeOpacity=".28" strokeWidth="1.5" />
        {!frente && <path d="M86 124 L88 314" fill="none" stroke={vivo} strokeWidth="2" opacity=".85" />}
        {!frente && <path d="M214 124 L212 314" fill="none" stroke={vivo} strokeWidth="2" opacity=".85" />}
        <rect width="300" height="330" fill={`url(#${id}m)`} />
        <rect width="300" height="330" fill={`url(#${id}v)`} />
        <rect width="300" height="330" fill={`url(#${id}l)`} />
        <path d="M112 48 Q118 130 112 300" fill="none" stroke="#000" strokeOpacity=".1" strokeWidth="7" />
        <path d="M190 48 Q182 140 190 300" fill="none" stroke="#000" strokeOpacity=".09" strokeWidth="6" />
      </g>
      <path d="M41 150 Q56 156 72 156" fill="none" stroke={vivo} strokeWidth="6" strokeLinecap="round" />
      <path d="M259 150 Q244 156 228 156" fill="none" stroke={vivo} strokeWidth="6" strokeLinecap="round" />
      <path d="M80 314 Q150 326 220 314" fill="none" stroke={cor.contorno} strokeWidth="3" opacity=".7" />
      {frente
        ? <path d="M122 32 Q150 56 178 32 Q150 24 122 32 Z" fill={cor.contorno} />
        : <path d="M122 32 Q150 18 178 32 Q150 30 122 32 Z" fill={cor.contorno} />}
      <path d={frente ? 'M120 32 Q150 58 180 32' : 'M120 32 Q150 44 180 32'} fill="none" stroke={vivo} strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

/* O GANCHO E O TUBO. O gancho de ferro preto continua preso por baixo da
   porta; da ponta dele (com uma pequena abraçadeira) desce um tubo fino de
   borracha preta transparente até à gola, para a camisola não parecer
   solta no ar. O espaço ocupado é o mesmo de antes (nada mexe no ecrã): o
   tubo passa para dentro da caixa da camisola e acaba escondido atrás da
   gola. `k` é a escala da camisola. */
function PeGancho({ k = 1 }) {
  const fim = 34 + 14 + Math.round(26 * k); // altura do gancho + margem de baixo + até à gola
  return (
    <div aria-hidden="true" style={{ position: 'relative', width: 40, height: 34, flexShrink: 0, margin: '-1px auto 14px', pointerEvents: 'none' }}>
      <svg width="40" height={fim} viewBox={`0 0 40 ${fim}`} style={{ position: 'absolute', left: 0, top: 0, display: 'block', overflow: 'visible' }}>
        {/* o tubo: preto a 50 %, com um reflexo leve de um lado */}
        <rect x="19" y="28" width="2" height={fim - 28} rx="1" fill="#000" fillOpacity=".5" />
        <path d={`M19.6 31 L19.6 ${fim - 2}`} stroke="#fff" strokeOpacity=".22" strokeWidth=".4" strokeLinecap="round" />
        {/* a abraçadeira na ponta do gancho */}
        <rect x="18" y="27" width="4" height="3" rx="1" fill="#1d201f" />
        <rect x="18.3" y="27.5" width="3.4" height=".7" fill="#4A4F4C" />
        {/* o gancho */}
        <rect x="7" y="0" width="26" height="8" rx="2" fill="#141615" />
        <rect x="8" y="1" width="24" height="1.5" rx=".75" fill="#4A4F4C" />
        <path d="M20 8 L20 15" stroke="#141615" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M20 20 q-9 0 -9 -6 q0 -6 8 -6" fill="none" stroke="#141615" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M20 20 L20 28" stroke="#141615" strokeWidth="3.5" />
        <path d="M19 22 L19 27" stroke="#4A4F4C" strokeWidth="1" />
      </svg>
    </div>
  );
}

function PeCamisola({ jogador, cor, logo, virada, sensor, pin, rotulo, corRotulo, aberta, teclado }) {
  const nome = String((jogador && jogador.nome) || '').trim();
  const primeiro = (nome ? nome.split(/\s+/)[0] : 'Atleta').toUpperCase();
  const numero = jogador && jogador.numero != null && String(jogador.numero).trim() !== '' ? String(jogador.numero).trim() : '';
  const corNum = cor.texto || '#FFFFFF';
  const face = { position: 'absolute', inset: 0, WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden' };
  const corSensor = aberta ? '#8EE6A0' : '#C9A227';
  const tecla = (k, i) => {
    const base = {
      height: 34, borderRadius: 8, background: 'rgba(13,18,15,.9)', border: '1px solid #2a2f33', color: '#FFC23D', padding: 0, boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', justifyContent: 'center', ...mono, fontSize: 16, fontWeight: 500,
      cursor: teclado.desativado ? 'default' : 'pointer', opacity: teclado.desativado ? 0.55 : 1,
    };
    if (!k) {
      const ex = teclado.extra;
      return (
        <button key={i} type="button" disabled={!virada || teclado.desativado} onClick={ex.onClick} aria-label={ex.rotulo} title={ex.rotulo} style={base}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C9A227" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ex.icone}</svg>
        </button>
      );
    }
    return <button key={i} type="button" disabled={!virada || teclado.desativado} onClick={() => teclado.onTecla(k)} aria-label={k === '⌫' ? 'Apagar' : k} style={base}>{k}</button>;
  };
  return (
    <div style={{ position: 'relative', width: 300, height: 330, perspective: 1000 }}>
      <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: virada ? 'rotateY(180deg)' : 'none', transition: 'transform .65s cubic-bezier(.4,.1,.2,1)' }}>
        {/* COSTAS: nome, número e o sensor no fundo */}
        <div style={face} aria-hidden={virada}>
          <PeDesenhoCamisola cor={cor} lado="costas" id="pe-cam-c" />
          <div style={{ position: 'absolute', left: 0, right: 0, top: 56, textAlign: 'center', ...display, fontWeight: 600, fontSize: 24, letterSpacing: '.16em', color: corNum, textShadow: '0 1px 0 rgba(0,0,0,.25)', overflow: 'hidden', whiteSpace: 'nowrap', padding: '0 70px', boxSizing: 'border-box', textOverflow: 'ellipsis' }}>{primeiro}</div>
          {numero && <div style={{ position: 'absolute', left: 0, right: 0, top: 88, textAlign: 'center', ...display, fontWeight: 700, fontSize: 104, lineHeight: 1, color: corNum, WebkitTextStroke: `2px ${cor.contorno}`, paintOrder: 'stroke fill', textShadow: '0 3px 0 rgba(0,0,0,.18)' }}>{numero}</div>}
          <button type="button" onClick={sensor.onClick || undefined} disabled={virada || !sensor.onClick} aria-label={sensor.rotulo}
            style={{ position: 'absolute', left: 118, top: 222, width: 64, height: 64, borderRadius: 14, padding: 0, boxSizing: 'border-box', background: '#0D120F', border: `2px solid ${corSensor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: sensor.onClick ? 'pointer' : 'default',
              animation: sensor.pulsar ? 'pe-pulso 2s ease-in-out infinite' : 'none', transition: 'border-color .3s' }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={corSensor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              style={{ animation: sensor.aLer ? 'pe-respira .5s ease-in-out infinite' : 'none' }}>{sensor.icone}</svg>
          </button>
        </div>
        {/* FRENTE: emblema ao peito e o PIN */}
        <div style={{ ...face, transform: 'rotateY(180deg)' }} aria-hidden={!virada}>
          <PeDesenhoCamisola cor={cor} lado="frente" id="pe-cam-f" />
          <div style={{ position: 'absolute', left: 178, top: 64 }}><PeEmblema logo={logo} cor={cor} tam={30} /></div>
          <div style={{ position: 'absolute', left: 84, width: 132, top: 104, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', color: corRotulo || corNum, ...body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', fontWeight: 600 }}>{rotulo}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} style={{ width: 17, height: 21, borderRadius: 4, boxSizing: 'border-box', background: 'rgba(13,18,15,.85)', border: `1.5px solid ${aberta ? '#8EE6A0' : (i < pin.length ? '#FFC23D' : '#3a4440')}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: aberta ? '#8EE6A0' : '#FFC23D' }}>{(aberta || i < pin.length) ? '●' : ''}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, width: '100%', marginTop: 2 }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(tecla)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Medidas da porta e da camisola: tudo cabe no ecrã, sem deslizar, até ao
   "Mais opções". Primeiro encolhe a porta; se ainda não chegar, encolhe a
   camisola (nunca abaixo de 62 %). Em ecrãs altos a camisola cresce até
   15 %, para o teclado ficar mais confortável. */
function usePortaMedidas() {
  /* Medidas da porta e da camisola: tudo cabe no ecrã, sem deslizar, até
     ao "Mais opções", numa coluna de até 420 px. Primeiro encolhe a porta;
     se ainda não chegar, encolhe a camisola (nunca abaixo de 62 %). Em
     ecrãs altos a camisola cresce até 15 %. A porta da equipa técnica
     (AuthScreen) usa EXATAMENTE a mesma regra para o quadro. */
  const medir = () => {
    const vw = Math.min(window.innerWidth, 420), vh = window.innerHeight;
    // Espaço no topo: o mesmo da porta da equipa técnica (mesma grelha).
    const S = Math.max(0, Math.min(28, Math.round((vh - 640) * 0.12)));
    /* A porta e a camisola ocupam TODO o espaço disponível, juntas: a
       camisola tem sempre 330/251 da altura da porta. (Antes reservava-se
       espaço para uma camisola de tamanho normal e depois ela encolhia —
       e esse espaço ficava vazio.) */
    const fixo = 251 + S;
    const hLargura = (vw - 32 - 14) * 254 / 348;
    const H = Math.round(Math.max(120, Math.min(hLargura, (vh - fixo) / (1 + 330 / 251))));
    const k = Math.max(0.55, Math.min(1.15, H / 251));
    return { W: Math.round(H * 348 / 254), H, k, S };
  };
  const [m, setM] = useState(medir);
  useEffect(() => {
    const f = () => setM(medir());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return m;
}

function PortalEntrada({ entrar, equipa, teamId }) {
  const cor = coresCamisola(T.corEquipa);
  const logo = (equipa && equipa.logo) || '';
  const clube = String((equipa && (equipa.clube || equipa.nome)) || '').trim();
  const [cartao, setCartao] = useState(() => peLerCartao(teamId));
  const [ecra, setEcra] = useState(() => {
    if (peLerCartao(teamId)) return 'porta';
    try { if (/^\d{6}$/.test(new URLSearchParams(window.location.search).get('ligar') || '')) return 'ligar-pin'; } catch (e) { /* nada */ }
    return 'rececao';
  });
  const [codigo, setCodigo] = useState('');
  const [jogador, setJogador] = useState(null);
  const [pin, setPin] = useState('');
  const [pin1, setPin1] = useState('');
  const [aviso, setAviso] = useState('');
  const [corAviso, setCorAviso] = useState('');
  const [tremer, setTremer] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aberta, setAberta] = useState(false);
  const ecraRef = useRef(null);
  const [codigoAntigo, setCodigoAntigo] = useState('');
  // Navegador que não guarda nada (janela privada, cookies bloqueados…).
  const [semMemoria, setSemMemoria] = useState(false);
  // Ligar outro aparelho / gerir aparelhos.
  const [codigoLigacao, setCodigoLigacao] = useState(() => {
    try { const c = new URLSearchParams(window.location.search).get('ligar'); return /^\d{6}$/.test(c || '') ? c : ''; } catch (e) { return ''; }
  });
  const [pinOutro, setPinOutro] = useState('');
  const [dadosLigacao, setDadosLigacao] = useState(null); // { codigo, expira_em, cheio, aparelhos }
  const [agora, setAgora] = useState(Date.now());

  const mostrarErro = (msg) => { setAviso(msg); setCorAviso('#FF5A4E'); setTremer(true); setTimeout(() => setTremer(false), 500); };
  const limpar = () => { setAviso(''); setCorAviso(''); };
  const erroDe = (e) => ((e && e.message && /tentativas/i.test(e.message)) ? e.message : 'Não foi possível ligar. Verifica a internet e tenta outra vez.');

  // PIN certo → a porta abre, a TV diz bem-vindo, e entra-se com a sessão.
  const abrirEEntrar = async (sessao) => {
    setAberta(true);
    setAviso('ACESSO AUTORIZADO'); setCorAviso('#8EE6A0');
    // Os pedidos do Portal partem já, todos ao mesmo tempo; enquanto isso,
    // o resto do ecrã apaga-se (0,3 s) e a porta fica fechada no seu sítio.
    // O vidro abre com o ecrã seguinte já pronto atrás dele.
    prebuscarPortal(sessao, teamId);
    /* O estado autorizado (bolas verdes, letreiro e aviso a verde) fica à
       vista pelo menos 0,65 s; os pedidos do Portal já correm em paralelo.
       Depois tira-se uma cópia do ecrã, que fica por baixo da porta até
       ela abrir (ver PeRestoEntrada). */
    await new Promise(r => setTimeout(r, 650));
    try {
      if (ENTRADA && ecraRef.current) {
        // Sem o <style> do ecrã (regras globais do html/body não vão na cópia).
        const copia = ecraRef.current.cloneNode(true);
        copia.querySelectorAll('style').forEach(n => n.remove());
        ENTRADA.resto = copia.outerHTML;
      }
    } catch (e) { /* sem cópia, fica só a porta */ }
    const ok = await entrar(sessao);
    if (!ok || ok === 'saiu') { ENTRADA = null; setAberta(false); setPin(''); mostrarErro(ok === 'saiu' ? 'Este acesso terminou: já saíste do clube.' : 'Não foi possível entrar. Tenta outra vez.'); }
  };

  const validarCodigo = async () => {
    if (codigo.length !== 6 || ocupado) return;
    setOcupado(true); limpar();
    try {
      const r = await peRpc('checkin_cartao_ver', { p_codigo: codigo, p_team: teamId });
      // Código já usado por quem tem o cartão ativo: em vez de "inválido",
      // pede o PIN e liga este aparelho ao mesmo cartão.
      if (r.ja_ativado) { setJogador(r.jogador || {}); setPin(''); setPin1(''); setEcra('reativar'); return; }
      if (!r.ok) { mostrarErro(r.erro || 'Código de ativação inválido.'); setCodigo(''); return; }
      setJogador(r.jogador || {}); setPin(''); setPin1(''); setEcra('cartao');
    } catch (e) { mostrarErro(erroDe(e)); } finally { setOcupado(false); }
  };

  const ativar = async (pinEscolhido) => {
    setOcupado(true); limpar();
    try {
      const r = await peRpc('checkin_cartao_ativar', { p_codigo: codigo, p_team: teamId, p_pin: pinEscolhido });
      if (!r.ok) {
        mostrarErro(r.erro || 'Não foi possível ativar o cartão.');
        setPin(''); setPin1('');
        if (/ativação/i.test(r.erro || '')) { setCodigo(''); setEcra('rececao'); }
        return;
      }
      const novo = { token: r.token, jogador: r.jogador || jogador || {} };
      setSemMemoria(!peGuardarCartao(teamId, novo));
      peDescreverAparelho(r.token, teamId);
      setCartao(novo);
      setCodigo(''); setPin1('');
      setEcra('porta');
      if (!peLerCartao(teamId)) { setPin(''); return; } // não ficou guardado: fica na porta com o aviso
      const e = await peRpc('checkin_cartao_entrar', { p_token: r.token, p_team: teamId, p_pin: pinEscolhido });
      if (e.ok && e.sessao) { setPin(pinEscolhido); await abrirEEntrar(e.sessao); } else { setPin(''); }
    } catch (e) { mostrarErro(erroDe(e)); setPin(''); } finally { setOcupado(false); }
  };

  /* MESMO CARTÃO NOUTRO APARELHO, COM O CÓDIGO DE ATIVAÇÃO JÁ USADO.
     O jogador volta a escrever o código que o staff lhe deu (é o natural)
     e o servidor pede o PIN: código + PIN certos ligam este aparelho ao
     cartão que já tem, sem desligar os outros (máximo de 3, como na
     ligação por QR). PIN errado conta para o bloqueio de 5 tentativas. */
  const reativar = async (valor) => {
    setOcupado(true); limpar();
    try {
      const r = await peRpc('checkin_cartao_reativar', { p_codigo: codigo, p_team: teamId, p_pin: valor });
      if (r.ok && r.token) {
        const novo = { token: r.token, jogador: r.jogador || jogador || {} };
        setSemMemoria(!peGuardarCartao(teamId, novo));
        peDescreverAparelho(r.token, teamId);
        setCartao(novo); setCodigo('');
        setEcra('porta');
        if (!peLerCartao(teamId)) { setPin(''); return; }
        const e = await peRpc('checkin_cartao_entrar', { p_token: r.token, p_team: teamId, p_pin: valor });
        if (e.ok && e.sessao) { setPin(valor); await abrirEEntrar(e.sessao); } else { setPin(''); }
        return;
      }
      setPin('');
      if (r.bloqueado) {
        setCodigo(''); setEcra('rececao');
        setAviso('Por segurança, o teu cartão foi bloqueado. Pede um código de ativação novo ao staff técnico.'); setCorAviso('#FF5A4E');
        return;
      }
      if (r.restantes != null) { mostrarErro(`PIN ERRADO · ${r.restantes} ${r.restantes === 1 ? 'TENTATIVA' : 'TENTATIVAS'}`); return; }
      mostrarErro(r.erro || 'Não foi possível.');
    } catch (e) {
      setPin('');
      mostrarErro(/checkin_cartao_reativar|does not exist|PGRST202/i.test((e && (e.message || e.code)) || '') ? 'Esta opção ainda não está disponível.' : erroDe(e));
    } finally { setOcupado(false); }
  };

  const entrarComPin = async (valor) => {
    if (!cartao || ocupado) return;
    setOcupado(true); limpar();
    try {
      const r = await peRpc('checkin_cartao_entrar', { p_token: cartao.token, p_team: teamId, p_pin: valor });
      if (r.ok && r.sessao) {
        if (r.jogador) { const atual = { ...cartao, jogador: r.jogador }; peGuardarCartao(teamId, atual); setCartao(atual); }
        peDescreverAparelho(cartao.token, teamId); // os aparelhos antigos ganham nome aqui
        let recusou = 0;
        try { recusou = Number(localStorage.getItem(peBioRecusa(teamId)) || 0); } catch (e) { recusou = 0; }
        if (bioSuportada && !cartao.bio && Date.now() - recusou > 30 * 24 * 3600 * 1000) {
          setOferta({ sessao: r.sessao, pin: valor }); setPin(''); setEcra('oferta-bio');
          return;
        }
        await abrirEEntrar(r.sessao);
        return;
      }
      if (r.bloqueado || r.invalido) {
        peApagarCartao(teamId); setCartao(null); setPin(''); setEcra('rececao');
        setAviso(r.bloqueado
          ? 'Por segurança, o teu cartão foi bloqueado neste telemóvel. Pede um código de ativação novo ao staff técnico.'
          : 'O teu cartão já não é válido neste telemóvel. Pede um código de ativação novo ao staff técnico.');
        setCorAviso('#FF5A4E');
        return;
      }
      setPin('');
      mostrarErro(`PIN ERRADO · ${r.restantes} ${r.restantes === 1 ? 'TENTATIVA' : 'TENTATIVAS'}`);
    } catch (e) { setPin(''); mostrarErro(erroDe(e)); } finally { setOcupado(false); }
  };

  /* CÓDIGO ANTIGO → se já tem cartão, pede o PIN e recupera-o neste sítio
     (o cartão fica guardado no "sítio" onde foi ativado; outro navegador,
     o navegador de dentro do WhatsApp ou o ícone do Portal são sítios
     diferentes). Se ainda não tem cartão, entra como antes com o código. */
  const seguirCodigoAntigo = async () => {
    if (codigoAntigo.length < 4 || ocupado) return;
    setOcupado(true); limpar();
    try {
      const r = await peRpc('checkin_cartao_por_codigo', { p_codigo: codigoAntigo, p_team: teamId });
      if (!r.ok) {
        mostrarErro('Este não é um código de acesso válido. Escreve o código que usavas antes do cartão — o PIN só é pedido a seguir. Se não o souberes, pede-o ao staff técnico.');
        setCodigoAntigo('');
        return;
      }
      if (r.tem_cartao) { setJogador(r.jogador || {}); setPin(''); setEcra('recuperar'); return; }
      if (r.so_cartao) { mostrarErro('Ainda não tens cartão de atleta. Pede o código de ativação ao staff técnico.'); return; }
      const ok = await entrar(codigoAntigo);
      if (!ok || ok === 'saiu') mostrarErro(ok === 'saiu' ? 'Este acesso terminou: já saíste do clube.' : 'Não foi possível entrar com esse código.');
    } catch (e) {
      // Sem o SQL da recuperação (fase 2b) ainda corrido: entra como antes.
      if (/checkin_cartao_por_codigo|does not exist|PGRST202/i.test((e && (e.message || e.code)) || '')) {
        const ok = await entrar(codigoAntigo);
        if (!ok || ok === 'saiu') mostrarErro(ok === 'saiu' ? 'Este acesso terminou: já saíste do clube.' : 'Não foi possível entrar com esse código.');
      } else { mostrarErro(erroDe(e)); }
    } finally { setOcupado(false); }
  };
  const recuperarComPin = async (valor) => {
    setOcupado(true); limpar();
    try {
      const r = await peRpc('checkin_cartao_recuperar', { p_codigo: codigoAntigo, p_team: teamId, p_pin: valor });
      if (r.ok && r.token) {
        const novo = { token: r.token, jogador: r.jogador || jogador || {} };
        setSemMemoria(!peGuardarCartao(teamId, novo)); setCartao(novo); setCodigoAntigo(''); setEcra('porta');
        peDescreverAparelho(r.token, teamId);
        const e = await peRpc('checkin_cartao_entrar', { p_token: r.token, p_team: teamId, p_pin: valor });
        if (e.ok && e.sessao) { setPin(valor); await abrirEEntrar(e.sessao); } else { setPin(''); }
        return;
      }
      setPin('');
      if (r.bloqueado) { setEcra('rececao'); setAviso('Por segurança, o teu cartão foi bloqueado. Pede um código de ativação novo ao staff técnico.'); setCorAviso('#FF5A4E'); return; }
      if (r.sem_cartao) { setEcra('codigo'); mostrarErro('Ainda não tens cartão de atleta.'); return; }
      mostrarErro(r.restantes != null ? `PIN ERRADO · ${r.restantes} ${r.restantes === 1 ? 'TENTATIVA' : 'TENTATIVAS'}` : (r.erro || 'Não foi possível recuperar o cartão.'));
    } catch (e) { setPin(''); mostrarErro(erroDe(e)); } finally { setOcupado(false); }
  };

  /* USAR O CARTÃO NOUTRO APARELHO (no aparelho onde já tem cartão):
     PIN → código de ligação de 10 minutos + QR. Com 3 aparelhos, escolhe
     primeiro qual deixa de usar. */
  const pedirLigacao = async (valorPin) => {
    setOcupado(true); limpar();
    try {
      try { await peRpc('checkin_cartao_descrever', { p_token: cartao.token, p_team: teamId, p_descricao: await peDescricaoAparelho() }); } catch (e) { /* nada */ }
      const r = await peRpc('checkin_cartao_ligacao_criar', { p_token: cartao.token, p_team: teamId, p_pin: valorPin });
      if (r.ok) { setPinOutro(valorPin); setDadosLigacao(r); setPin(''); setEcra('outro'); return; }
      setPin('');
      if (r.bloqueado || r.invalido) { usarOutroCartao(); setAviso('Por segurança, o teu cartão foi bloqueado. Pede um código de ativação novo ao staff técnico.'); setCorAviso('#FF5A4E'); return; }
      mostrarErro(r.restantes != null ? `PIN ERRADO · ${r.restantes} ${r.restantes === 1 ? 'TENTATIVA' : 'TENTATIVAS'}` : (r.erro || 'Não foi possível.'));
    } catch (e) { setPin(''); mostrarErro(/does not exist|PGRST202/i.test((e && (e.message || e.code)) || '') ? 'Esta opção ainda não está disponível.' : erroDe(e)); } finally { setOcupado(false); }
  };
  // (No Portal não há o diálogo de confirmação do staff: confirma-se na
  // própria linha do aparelho — ver `aRemover`.)
  const [aRemover, setARemover] = useState(null);
  const [maisOpcoes, setMaisOpcoes] = useState(false);
  // "Perdeste o acesso ao cartão?" na Receção. A opção do código antigo só
  // aparece enquanto os códigos antigos estiverem ligados (atletas novos
  // nunca tiveram um).
  const [perdeuAcesso, setPerdeuAcesso] = useState(false);
  const [semNenhum, setSemNenhum] = useState(false);
  const [codigosAntigosLigados, setCodigosAntigosLigados] = useState(true);
  useEffect(() => {
    peRpc('checkin_portal_config', { p_team: teamId })
      .then(r => { if (r && typeof r.so_cartao === 'boolean') setCodigosAntigosLigados(!r.so_cartao); })
      .catch(() => { /* sem a função: mostra a opção, como antes */ });
  }, [teamId]);
  // Impressão digital / Face ID
  /* null = ainda a verificar. A verificação do leitor é assíncrona: com
     `false` à partida, a porta abria primeiro com o teclado do PIN e só
     depois trocava para a impressão digital (dois ecrãs seguidos). Quem já
     ativou a impressão digital neste aparelho tem leitor, por isso enquanto
     se verifica assume-se que sim; se afinal não houver, passa ao PIN. */
  const [bioSuportada, setBioSuportada] = useState(null);
  const [modoPin, setModoPin] = useState(false);      // com biometria ativa, o PIN é a alternativa
  const [oferta, setOferta] = useState(null);         // { sessao, pin } — perguntar se quer ativar
  useEffect(() => { peBioDisponivel().then(setBioSuportada); }, []);
  // O servidor manda: se a biometria foi desligada (aparelho removido, cartão terminado…), acerta-se aqui.
  useEffect(() => {
    if (!cartao || !cartao.token) return;
    peRpc('checkin_bio_estado', { p_token: cartao.token, p_team: teamId })
      .then(r => { if (r && typeof r.ativa === 'boolean' && r.ativa !== !!cartao.bio) { const novo = { ...cartao, bio: r.ativa }; peGuardarCartao(teamId, novo); setCartao(novo); } })
      .catch(() => {});
  }, [cartao && cartao.token]); // eslint-disable-line react-hooks/exhaustive-deps
  const bioAtiva = !!(cartao && cartao.bio && bioSuportada !== false);

  /* Desafio preparado em segundo plano. Assim que a porta aparece, pede-se
     ao servidor o desafio de segurança; ao tocar no leitor (ou na abertura
     automática), o ecrã do sistema abre logo, sem esperar pela Edge
     Function. Cada desafio serve uma só vez. */
  const bioPronto = useRef(null);      // { o, quando }
  const bioPedido = useRef(null);      // promessa do pedido em curso
  const bioSeq = useRef(0);
  const bioEmCurso = useRef(false);    // leitor aberto: não pedir outro desafio por cima
  const prepararBio = () => {
    if (!cartao || !cartao.token || bioEmCurso.current) return;
    const seq = ++bioSeq.current;
    const p = peBioFn({ acao: 'entrada-opcoes', token: cartao.token, team: teamId })
      .then(o => { if (seq === bioSeq.current) bioPronto.current = { o, quando: Date.now() }; return o; });
    p.catch(() => {}).finally(() => { if (bioPedido.current === p) bioPedido.current = null; });
    bioPedido.current = p;
  };
  const obterOpcoesBio = async () => {
    const pronto = bioPronto.current; bioPronto.current = null;
    if (pronto && Date.now() - pronto.quando < PE_BIO_VALIDADE_MS) return pronto.o;
    if (bioPedido.current) {
      try { const o = await bioPedido.current; bioPronto.current = null; return o; }
      catch (e) { /* o pedido antecipado falhou: tenta-se outra vez já */ }
    }
    return peBioFn({ acao: 'entrada-opcoes', token: cartao.token, team: teamId });
  };
  const naPortaComBio = ecra === 'porta' && bioAtiva && !modoPin && !aberta;
  // A camisola: medidas no ecrã; sem impressão digital ativa, a camisola
  // vira-se para o PIN com um toque (pinVirado).
  const medidasPorta = usePortaMedidas();
  const [pinVirado, setPinVirado] = useState(false);
  // Pista do emblema (o dedo que toca): 5 primeiras visitas deste aparelho
  // com a impressão digital ativa; acaba na primeira entrada pelo emblema.
  const chavePista = `pe-pista-emblema:${teamId}`;
  const [pistaEmblema] = useState(() => {
    if (!(cartao && cartao.bio)) return false;
    try { const v = localStorage.getItem(chavePista); if (v === 'feita' || Number(v || 0) >= 5) return false; localStorage.setItem(chavePista, String(Number(v || 0) + 1)); return true; } catch (e) { return false; }
  });
  const acabarPistaPortal = () => { try { localStorage.setItem(chavePista, 'feita'); } catch (e) { /* nada */ } };
  /* AS BARRAS DO SISTEMA (Chrome no Android) e o fundo da página na cor da
     cena enquanto se está na porta — sem isto ficava uma faixa verde (a cor
     da app) em cima e em baixo. Ao sair da porta, volta tudo à cor da app. */
  useEffect(() => {
    if (ecra !== 'porta') return undefined;
    const claro = TEMA_ATUAL === 'claro';
    const meta = document.querySelector('meta[name="theme-color"]');
    const antes = meta ? meta.getAttribute('content') : null;
    const corPorta = claro ? PE_TC_PORTA.claro : PE_TC_PORTA.escuro;
    if (meta) meta.setAttribute('content', corPorta);
    const st = document.createElement('style');
    st.textContent = `html:root, html:root body { background: ${claro ? '#E3E9E1' : '#0B0F0D'} !important; }`;
    document.head.appendChild(st);
    return () => {
      /* A BARRA DE CIMA NÃO PISCA AO ENTRAR. Com o acesso autorizado, a cor
         da app só volta quando a porta acabou de abrir (e só se nenhum ecrã
         a mudou entretanto, como o estádio do dia de jogo). Antes voltava
         logo: a barra passava a verde por um instante e depois à cor do ecrã
         seguinte. Sem entrada (voltar ao PIN, etc.), repõe-se logo. */
      let feito = false, tempo = 0;
      const repor = () => {
        if (feito) return; feito = true;
        clearTimeout(tempo); window.removeEventListener('mjp-entrada-fim', repor);
        if (meta && antes != null && meta.getAttribute('content') === corPorta) meta.setAttribute('content', antes);
        if (st.parentNode) st.parentNode.removeChild(st);
      };
      if (ENTRADA_T && Date.now() - ENTRADA_T < 20000) {
        window.addEventListener('mjp-entrada-fim', repor);
        tempo = setTimeout(repor, 8000);
      } else repor();
    };
  }, [ecra]);
  useEffect(() => {
    if (!naPortaComBio) { bioPronto.current = null; return undefined; }
    prepararBio();
    // Ao voltar à app (estava em segundo plano), renova o desafio se já for velho.
    const aoVoltar = () => {
      if (document.visibilityState !== 'visible' || bioEmCurso.current) return;
      const pronto = bioPronto.current;
      if (!bioPedido.current && (!pronto || Date.now() - pronto.quando >= PE_BIO_VALIDADE_MS)) prepararBio();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [naPortaComBio, cartao && cartao.token]); // eslint-disable-line react-hooks/exhaustive-deps

  // auto = aberto sozinho ao chegar à porta: falhas silenciosas, o botão fica para tocar.
  const entrarComBio = async (auto = false) => {
    if (!cartao || ocupado || aberta || bioEmCurso.current) return;
    bioEmCurso.current = true;
    setOcupado(true); limpar();
    let renovar = false; // true quando se fica na porta com a impressão digital à espera de novo toque
    try {
      const o = await obterOpcoesBio();
      if (!o.ok) {
        if (o.invalido) { usarOutroCartao(); setAviso('O teu cartão já não é válido neste aparelho. Pede um código de ativação novo ao staff técnico.'); setCorAviso('#FF5A4E'); return; }
        if (o.sem_biometria) { const novo = { ...cartao, bio: false }; peGuardarCartao(teamId, novo); setCartao(novo); setModoPin(true); mostrarErro('Entra com o PIN.'); return; }
        if (!auto) mostrarErro(o.erro || 'Não foi possível.');
        renovar = true; return;
      }
      let resposta;
      try { resposta = await peBioAutenticar(o.opcoes); }
      catch (e) { renovar = true; return; } // cancelado pelo atleta (ou recusado sem toque): fica tudo como estava
      const v = await peBioFn({ acao: 'entrada-verificar', token: cartao.token, team: teamId, resposta });
      if (v.ok && v.sessao) { setPin('●●●●●●'); await abrirEEntrar(v.sessao); return; }
      mostrarErro(v.erro || 'Não foi possível confirmar. Entra com o PIN.');
      renovar = true;
    } catch (e) {
      if (auto) renovar = true;
      else { mostrarErro(`Não foi possível usar ${PE_BIO_TXT.comArtigo} agora${e && e.diag ? ` (${e.diag})` : ''}. Entra com o PIN.`); setModoPin(true); }
    } finally {
      bioEmCurso.current = false;
      setOcupado(false);
      // O desafio usado já não serve: prepara-se outro para o próximo toque.
      if (renovar) prepararBio();
    }
  };
  // Abrir o leitor sozinho (Android e computador). Espera um instante para a
  // porta aparecer e para não chocar com outros painéis abertos.
  useEffect(() => {
    if (!naPortaComBio || ocupado || oferta || maisOpcoes || peBioAutoFeito || !pePodeAutoAbrirBio()) return undefined;
    if (document.visibilityState !== 'visible') return undefined;
    const t = setTimeout(() => {
      if (peBioAutoFeito || document.visibilityState !== 'visible') return;
      peBioAutoFeito = true;
      entrarComBio(true);
    }, 450);
    return () => clearTimeout(t);
  }, [naPortaComBio, ocupado, oferta, maisOpcoes]); // eslint-disable-line react-hooks/exhaustive-deps
  // Ativar neste aparelho (pede o PIN — o servidor confirma-o outra vez).
  const ativarBio = async (valorPin) => {
    const o = await peBioFn({ acao: 'registo-opcoes', token: cartao.token, team: teamId, pin: valorPin });
    if (!o.ok) return o;
    let resposta;
    try { resposta = await peBioRegistar(o.opcoes); } catch (e) { return { ok: false, cancelado: true }; }
    const v = await peBioFn({ acao: 'registo-verificar', token: cartao.token, team: teamId, resposta });
    if (v.ok) { const novo = { ...cartao, bio: true }; peGuardarCartao(teamId, novo); setCartao(novo); setModoPin(false); }
    return v;
  };
  const responderOferta = async (aceita) => {
    const o = oferta; setOferta(null);
    if (aceita) {
      setOcupado(true);
      try { await ativarBio(o.pin); } catch (e) { /* segue com o PIN */ }
      setOcupado(false);
    } else {
      try { localStorage.setItem(peBioRecusa(teamId), String(Date.now())); } catch (e) { /* nada */ }
    }
    setEcra('porta');
    await abrirEEntrar(o.sessao);
  };
  const removerAparelho = async (ap) => {
      setARemover(null);
      try {
        const r = await peRpc('checkin_cartao_remover', { p_token: cartao.token, p_team: teamId, p_pin: pinOutro, p_aparelho: ap.id });
        if (!r.ok) { mostrarErro(r.erro || 'Não foi possível remover.'); return; }
        // Com lugar livre, pede logo o código de ligação.
        const n = await peRpc('checkin_cartao_ligacao_criar', { p_token: cartao.token, p_team: teamId, p_pin: pinOutro });
        if (n.ok) setDadosLigacao(n); else setDadosLigacao(l => ({ ...l, aparelhos: r.aparelhos }));
      } catch (e) { mostrarErro(erroDe(e)); }
  };
  useEffect(() => {
    if (ecra !== 'outro') return undefined;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ecra]);
  // NO APARELHO NOVO: código de ligação + PIN.
  const ligarAparelho = async (valorPin) => {
    setOcupado(true); limpar();
    try {
      const r = await peRpc('checkin_cartao_ligar', { p_codigo: codigoLigacao, p_team: teamId, p_pin: valorPin });
      if (r.ok && r.token) {
        const novo = { token: r.token, jogador: r.jogador || {} };
        setSemMemoria(!peGuardarCartao(teamId, novo)); setCartao(novo); setCodigoLigacao(''); setEcra('porta');
        peDescreverAparelho(r.token, teamId);
        const e = await peRpc('checkin_cartao_entrar', { p_token: r.token, p_team: teamId, p_pin: valorPin });
        if (e.ok && e.sessao) { setPin(valorPin); await abrirEEntrar(e.sessao); } else { setPin(''); }
        return;
      }
      setPin('');
      if (r.bloqueado) { setEcra('rececao'); setAviso('Por segurança, o teu cartão foi bloqueado. Pede um código de ativação novo ao staff técnico.'); setCorAviso('#FF5A4E'); return; }
      if (r.erro) { setCodigoLigacao(''); setEcra('ligar'); mostrarErro(r.erro); return; }
      mostrarErro(`PIN ERRADO · ${r.restantes} ${r.restantes === 1 ? 'TENTATIVA' : 'TENTATIVAS'}`);
    } catch (e) { setPin(''); mostrarErro(erroDe(e)); } finally { setOcupado(false); }
  };

  const tecla = (k) => {
    if (ocupado || aberta) return;
    if (ecra === 'ligar') {
      limpar();
      setCodigoLigacao(c => (k === '⌫' ? c.slice(0, -1) : c.length < 6 ? c + k : c));
      return;
    }
    if (ecra === 'bio-pin') {
      if (k === '⌫') { setPin(p => p.slice(0, -1)); return; }
      if (pin.length >= 6) return;
      const novo = pin + k;
      setPin(novo); limpar();
      if (novo.length === 6) {
        setOcupado(true);
        ativarBio(novo).then(r => {
          setPin('');
          if (r && r.ok) { setEcra('porta'); setAviso('IMPRESSÃO DIGITAL ATIVA'); setCorAviso('#8EE6A0'); return; }
          if (r && r.cancelado) { setEcra('porta'); return; }
          if (r && (r.bloqueado || r.invalido)) { usarOutroCartao(); setAviso('Por segurança, o teu cartão foi bloqueado. Pede um código de ativação novo ao staff técnico.'); setCorAviso('#FF5A4E'); return; }
          mostrarErro(r && r.restantes != null ? `PIN ERRADO · ${r.restantes} ${r.restantes === 1 ? 'TENTATIVA' : 'TENTATIVAS'}` : ((r && r.erro) || 'Não foi possível ativar.'));
        }).catch((e) => { setPin(''); mostrarErro(`Não foi possível ativar agora${e && e.diag ? ` (${e.diag})` : ''}.`); }).finally(() => setOcupado(false));
      }
      return;
    }
    if (ecra === 'ligar-pin' || ecra === 'outro-pin') {
      if (k === '⌫') { setPin(p => p.slice(0, -1)); return; }
      if (pin.length >= 6) return;
      const novo = pin + k;
      setPin(novo); limpar();
      if (novo.length === 6) { if (ecra === 'ligar-pin') ligarAparelho(novo); else pedirLigacao(novo); }
      return;
    }
    if (ecra === 'codigo') {
      limpar();
      setCodigoAntigo(c => (k === '⌫' ? c.slice(0, -1) : c.length < 6 ? c + k : c));
      return;
    }
    if (ecra === 'recuperar') {
      if (k === '⌫') { setPin(p => p.slice(0, -1)); return; }
      if (pin.length >= 6) return;
      const novo = pin + k;
      setPin(novo); limpar();
      if (novo.length === 6) recuperarComPin(novo);
      return;
    }
    if (ecra === 'rececao') {
      limpar();
      setCodigo(c => (k === '⌫' ? c.slice(0, -1) : c.length < 6 ? c + k : c));
      return;
    }
    if (ecra === 'reativar') {
      if (k === '⌫') { setPin(p => p.slice(0, -1)); return; }
      if (pin.length >= 6) return;
      const novo = pin + k;
      setPin(novo); limpar();
      if (novo.length === 6) reativar(novo);
      return;
    }
    if (ecra === 'cartao') {
      if (k === '⌫') { setPin(p => p.slice(0, -1)); return; }
      if (pin.length >= 6) return;
      const novo = pin + k;
      setPin(novo); limpar();
      if (novo.length === 6) {
        if (!pin1) { setTimeout(() => { setPin1(novo); setPin(''); }, 250); }
        else if (novo !== pin1) { setTimeout(() => { setPin(''); setPin1(''); mostrarErro('Os PIN não são iguais. Escolhe outra vez.'); }, 250); }
        else { ativar(novo); }
      }
      return;
    }
    if (ecra === 'porta') {
      if (k === '⌫') { setPin(p => p.slice(0, -1)); return; }
      if (pin.length >= 6) return;
      const novo = pin + k;
      setPin(novo); limpar();
      if (novo.length === 6) entrarComPin(novo);
    }
  };

  const usarOutroCartao = () => {
    peApagarCartao(teamId); setCartao(null); setPin(''); setCodigo(''); limpar(); setEcra('rececao');
  };

  const ecraFixo = {
    position: 'fixed', inset: 0, zIndex: 1, background: T.bg, overflow: 'hidden', overscrollBehavior: 'none', ...body,
  };
  const coluna = {
    height: '100%', maxWidth: 420, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px calc(12px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box', gap: 10,
  };
  const ligacao = { background: 'none', border: 'none', color: T.gold, textDecoration: 'underline', fontSize: 13, cursor: 'pointer', padding: '6px', ...body, flexShrink: 0 };
  const botaoOuro = (ativo) => ({
    width: '100%', padding: 11, borderRadius: 12, border: 'none', background: ativo ? T.goldFundo : T.botaoInativo, color: ativo ? '#1A2A1F' : T.botaoInativoTexto,
    ...display, fontSize: 17, fontWeight: 600, cursor: ativo ? 'pointer' : 'default', flexShrink: 0,
  });

  return (
    <div ref={ecraRef} style={ecraFixo}>
      <style>{PE_CSS}</style>
      {ecra === 'rececao' && (
        <div style={{ ...coluna, justifyContent: 'center' }}>
          <div style={{ ...display, fontSize: 24, fontWeight: 600, color: T.cream, textAlign: 'center' }}>Bem-vindo ao plantel!</div>
          <div style={{ fontSize: 13.5, color: T.mutedDim, textAlign: 'center', marginTop: -6 }}>Levanta aqui o teu cartão de atleta.</div>
          <div style={{ position: 'relative', width: '100%', borderRadius: 14, overflow: 'hidden', flexShrink: 1, minHeight: 0, maxHeight: '34dvh', display: 'flex', alignItems: 'flex-end' }}>
            <PeRececao cor={cor} logo={logo} clube={clube} />
            <div style={{ position: 'absolute', left: '18%', right: '18%', bottom: '8%' }}>
              <PePainel rotulo={aviso && aviso.length <= 32 ? aviso : 'CÓDIGO DE ATIVAÇÃO'} corRotulo={aviso && aviso.length <= 32 ? corAviso : undefined} tremer={tremer}>
                <PeCaixas valor={codigo} />
              </PePainel>
            </div>
          </div>
          {/* Espaço fixo (2 linhas) para avisos longos: aparecer ou desaparecer
              (ex.: ao tocar no primeiro número) já não mexe na página. */}
          <div style={{ fontSize: 12.5, color: corAviso || T.bad, textAlign: 'center', lineHeight: 1.4, height: '2.8em', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{aviso && aviso.length > 32 ? aviso : ''}</div>
          <PeTeclado onTecla={tecla} desativado={ocupado} />
          <button type="button" onClick={validarCodigo} disabled={codigo.length !== 6 || ocupado} style={botaoOuro(codigo.length === 6 && !ocupado)}>
            {ocupado ? 'A verificar…' : 'Levantar o cartão'}
          </button>
          <div style={{ fontSize: 12, color: T.mutedDim, textAlign: 'center', lineHeight: 1.45 }}>O código é dado pelo staff técnico. Já levantaste o cartão? Usa o mesmo código e o teu PIN.</div>
          <button type="button" onClick={() => { limpar(); setCodigoLigacao(''); setPin(''); setEcra('ligar'); }} style={{ ...ligacao, marginTop: -4 }}>Já tenho cartão noutro aparelho</button>
          <button type="button" onClick={() => { limpar(); setSemNenhum(false); setPerdeuAcesso(true); }} style={{ ...ligacao, marginTop: -8 }}>Perdeste o acesso ao cartão?</button>
          {perdeuAcesso && (() => {
            const opcao = { width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 12, background: T.bg, border: `1px solid ${T.line}`, color: T.cream, fontSize: 14.5, cursor: 'pointer', ...body };
            const sub = { display: 'block', fontSize: 12, color: T.mutedDim, marginTop: 2 };
            return (
              <div onClick={() => setPerdeuAcesso(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 'calc(12px + env(safe-area-inset-bottom, 0px)) 12px' }}>
                <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ ...display, fontSize: 19, fontWeight: 600, color: T.cream, marginBottom: 2 }}>Perdeste o acesso ao cartão?</div>
                  {semNenhum ? (
                    <>
                      <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.55 }}>
                        Pede ao <strong style={{ color: T.cream }}>staff técnico</strong> um código de ativação novo. Com ele recebes o cartão outra vez e escolhes um PIN novo.
                        O teu histórico (Wellness, PSE, missões, sequência) mantém-se igual.
                      </div>
                      <button type="button" onClick={() => setPerdeuAcesso(false)} style={botaoOuro(true)}>Percebi</button>
                    </>
                  ) : (
                    <>
                      <button type="button" style={opcao} onClick={() => { setPerdeuAcesso(false); limpar(); setCodigoLigacao(''); setPin(''); setEcra('ligar'); }}>
                        Ainda tenho o cartão noutro aparelho
                        <span style={sub}>Escreve aqui o teu código de ativação e o PIN, ou liga este a partir do outro com o QR code.</span>
                      </button>
                      {codigosAntigosLigados && (
                        <button type="button" style={opcao} onClick={() => { setPerdeuAcesso(false); limpar(); setCodigoAntigo(''); setEcra('codigo'); }}>
                          Tenho o código de acesso antigo
                          <span style={sub}>O código que usavas antes do cartão, com o teu PIN.</span>
                        </button>
                      )}
                      <button type="button" style={opcao} onClick={() => setSemNenhum(true)}>
                        Não tenho nenhum aparelho com o cartão
                        <span style={sub}>Ou esqueci-me do PIN.</span>
                      </button>
                      <button type="button" onClick={() => setPerdeuAcesso(false)} style={{ ...opcao, textAlign: 'center', background: 'none', border: 'none', color: T.mutedDim }}>Fechar</button>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {ecra === 'oferta-bio' && oferta && (
        <div style={coluna}>
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center' }}>
            <div style={{ width: 96, height: 96, borderRadius: 24, background: '#0d120f', border: `2px solid ${T.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Fingerprint size={60} color={T.gold} strokeWidth={1.6} />
            </div>
            <div style={{ ...display, fontSize: 22, fontWeight: 600, color: T.cream }}>Entrar com {PE_BIO_TXT.comArtigo}?</div>
            <div style={{ fontSize: 13.5, color: T.mutedDim, lineHeight: 1.5, maxWidth: 320 }}>
              Da próxima vez, neste aparelho, basta tocar e {PE_BIO_TXT.gesto}. Os teus dados biométricos nunca saem do aparelho. O PIN continua a funcionar.
            </div>
            <button type="button" onClick={() => responderOferta(true)} disabled={ocupado} style={botaoOuro(!ocupado)}>{ocupado ? 'A ativar…' : 'Ativar'}</button>
            <button type="button" onClick={() => responderOferta(false)} disabled={ocupado} style={ligacao}>Agora não</button>
          </div>
        </div>
      )}

      {ecra === 'bio-pin' && (
        <div style={coluna}>
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Fingerprint size={44} color={T.gold} strokeWidth={1.6} />
            <div style={{ ...display, fontSize: 22, fontWeight: 600, color: T.cream, textAlign: 'center' }}>{PE_BIO_TXT.nome.charAt(0).toUpperCase() + PE_BIO_TXT.nome.slice(1)}</div>
            <div style={{ fontSize: 13, color: T.mutedDim, textAlign: 'center', marginTop: -4 }}>Escreve o teu PIN para ativar neste aparelho.</div>
            <div style={{ width: 'min(100%, 300px)' }}>
              <PePainel rotulo={aviso || 'PIN PESSOAL'} corRotulo={aviso ? corAviso : undefined} tremer={tremer}>
                <PeCaixas valor={pin} ocultar />
              </PePainel>
            </div>
            <PeTeclado onTecla={tecla} desativado={ocupado} />
          </div>
          <button type="button" onClick={() => { setPin(''); limpar(); setEcra('porta'); }} style={ligacao}>Voltar</button>
        </div>
      )}

      {ecra === 'ligar' && (
        <div style={coluna}>
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ ...display, fontSize: 22, fontWeight: 600, color: T.cream, textAlign: 'center' }}>Já tenho cartão noutro aparelho</div>
            <div style={{ fontSize: 13, color: T.mutedDim, textAlign: 'center', marginTop: -4, lineHeight: 1.45 }}>
              No equipamento onde já tens o cartão, abre <strong style={{ color: T.cream }}>Mais opções → Utilizar outro equipamento</strong>. Aparece um código de ligação (ou lê o QR code com a câmara deste aparelho).
            </div>
            <div style={{ width: 'min(100%, 300px)' }}>
              <PePainel rotulo={aviso && aviso.length <= 32 ? aviso : 'CÓDIGO DE LIGAÇÃO'} corRotulo={aviso && aviso.length <= 32 ? corAviso : undefined} tremer={tremer}>
                <PeCaixas valor={codigoLigacao} />
              </PePainel>
            </div>
            {/* Espaço fixo (2 linhas) para avisos longos: aparecer ou desaparecer
              (ex.: ao tocar no primeiro número) já não mexe na página. */}
          <div style={{ fontSize: 12.5, color: corAviso || T.bad, textAlign: 'center', lineHeight: 1.4, height: '2.8em', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{aviso && aviso.length > 32 ? aviso : ''}</div>
            <PeTeclado onTecla={tecla} desativado={ocupado} />
            <button type="button" onClick={() => { if (codigoLigacao.length === 6) { limpar(); setPin(''); setEcra('ligar-pin'); } }} disabled={codigoLigacao.length !== 6} style={botaoOuro(codigoLigacao.length === 6)}>Seguinte</button>
          </div>
          <button type="button" onClick={() => { setEcra('rececao'); setCodigoLigacao(''); limpar(); }} style={ligacao}>Voltar à receção</button>
        </div>
      )}

      {(ecra === 'ligar-pin' || ecra === 'outro-pin') && (
        <div style={coluna}>
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ ...display, fontSize: 22, fontWeight: 600, color: T.cream, textAlign: 'center' }}>
              {ecra === 'ligar-pin' ? 'Ligar este aparelho' : 'Utilizar outro equipamento'}
            </div>
            <div style={{ fontSize: 13, color: T.mutedDim, textAlign: 'center', marginTop: -4, lineHeight: 1.45 }}>
              {ecra === 'ligar-pin' ? 'Escreve o teu PIN para o cartão ficar também neste aparelho.' : 'Escreve o teu PIN para receberes o código de ligação.'}
            </div>
            <div style={{ width: 'min(100%, 300px)' }}>
              <PePainel rotulo={aviso || 'PIN PESSOAL'} corRotulo={aviso ? corAviso : undefined} tremer={tremer}>
                <PeCaixas valor={pin} ocultar />
              </PePainel>
            </div>
            <PeTeclado onTecla={tecla} desativado={ocupado} />
          </div>
          <button type="button" onClick={() => { setPin(''); limpar(); setEcra(ecra === 'ligar-pin' ? 'ligar' : 'porta'); }} style={ligacao}>Voltar</button>
        </div>
      )}

      {ecra === 'outro' && dadosLigacao && (() => {
        const restam = dadosLigacao.expira_em ? Math.max(0, Math.floor((new Date(dadosLigacao.expira_em).getTime() - agora) / 1000)) : 0;
        const link = dadosLigacao.codigo ? `${URL_PUBLICA_APP}?portal=${teamId}&ligar=${dadosLigacao.codigo}` : '';
        const aps = dadosLigacao.aparelhos || [];
        const quando = (d) => (d ? new Date(d).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'ainda não entrou');
        return (
          <div style={{ ...coluna, overflowY: 'auto' }}>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, margin: 'auto 0' }}>
              {dadosLigacao.cheio ? (
                <>
                  <div style={{ ...display, fontSize: 21, fontWeight: 600, color: T.cream, textAlign: 'center' }}>Já tens o cartão em 3 aparelhos</div>
                  <div style={{ fontSize: 13, color: T.mutedDim, textAlign: 'center', lineHeight: 1.45 }}>Para ligares outro, escolhe primeiro qual deixas de usar.</div>
                </>
              ) : (
                <>
                  <div style={{ ...display, fontSize: 21, fontWeight: 600, color: T.cream, textAlign: 'center' }}>Liga o teu outro aparelho</div>
                  <div style={{ fontSize: 13, color: T.mutedDim, textAlign: 'center', lineHeight: 1.45 }}>Lê o QR code com a câmara do outro aparelho, ou abre lá o Portal, toca em <strong style={{ color: T.cream }}>Já tenho cartão noutro aparelho</strong> e escreve este código.</div>
                  {restam > 0 ? (
                    <>
                      <PeQr texto={link} tam={168} />
                      <div style={{ ...mono, fontSize: 32, color: T.gold, letterSpacing: '.24em', lineHeight: 1.1 }}>{dadosLigacao.codigo}</div>
                      <div style={{ fontSize: 12, color: T.mutedDim }}>Válido durante {Math.floor(restam / 60)}:{String(restam % 60).padStart(2, '0')} · só serve uma vez</div>
                    </>
                  ) : (
                    <button type="button" onClick={() => pedirLigacao(pinOutro)} style={botaoOuro(true)}>O código expirou · Gerar outro</button>
                  )}
                </>
              )}
              <div style={{ alignSelf: 'stretch', marginTop: 8 }}>
                <div style={{ fontSize: 11, letterSpacing: '.12em', color: T.mutedDim, marginBottom: 6 }}>OS TEUS APARELHOS · {aps.length} DE {dadosLigacao.limite || 3}</div>
                {aps.map(ap => (
                  <div key={ap.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: T.surface, border: `1px solid ${ap.este ? T.gold + '88' : T.line}`, marginBottom: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: T.cream, fontWeight: 500 }}>
                        {ap.descricao && ap.descricao !== 'Aparelho' ? ap.descricao : 'Aparelho sem nome'}
                        {ap.este && <span style={{ color: T.gold, fontWeight: 400 }}> · este aparelho</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: T.mutedDim }}>Ligado em {quando(ap.criado_em)} · último uso: {quando(ap.ultimo_uso)}</div>
                      {(!ap.descricao || ap.descricao === 'Aparelho') && !ap.este && (
                        <div style={{ fontSize: 11, color: T.mutedDim, fontStyle: 'italic' }}>O nome aparece na próxima vez que entrares nesse aparelho.</div>
                      )}
                    </div>
                    {!ap.este && (aRemover === ap.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 12, color: T.muted }}>Remover?</span>
                        <button type="button" onClick={() => removerAparelho(ap)} style={{ background: T.bad, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, padding: '5px 10px', cursor: 'pointer', ...body }}>Sim</button>
                        <button type="button" onClick={() => setARemover(null)} style={{ background: 'none', border: `1px solid ${T.line}`, borderRadius: 8, color: T.cream, fontSize: 12, padding: '5px 10px', cursor: 'pointer', ...body }}>Não</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setARemover(ap.id)} style={{ background: 'none', border: `1px solid ${T.line}`, borderRadius: 8, color: T.cream, fontSize: 12, padding: '5px 10px', cursor: 'pointer', flexShrink: 0, ...body }}>Remover</button>
                    ))}
                  </div>
                ))}
              </div>
              {aviso && <div style={{ fontSize: 12.5, color: corAviso || T.bad, textAlign: 'center' }}>{aviso}</div>}
            </div>
            <button type="button" onClick={() => { setEcra('porta'); setDadosLigacao(null); setPinOutro(''); limpar(); }} style={ligacao}>Concluído</button>
          </div>
        );
      })()}

      {ecra === 'codigo' && (
        <div style={coluna}>
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ ...display, fontSize: 22, fontWeight: 600, color: T.cream, textAlign: 'center' }}>Entrar com o código antigo de acesso</div>
            <div style={{ fontSize: 13, color: T.mutedDim, textAlign: 'center', marginTop: -4, lineHeight: 1.45 }}>
              É o código que usavas <strong style={{ color: T.cream }}>antes do cartão</strong> (4 ou 6 números) — <strong style={{ color: T.cream }}>não é o PIN</strong>.
              Se já tens cartão de atleta, o PIN é pedido a seguir.
            </div>
            <div style={{ width: 'min(100%, 300px)' }}>
              <PePainel rotulo={aviso && aviso.length <= 32 ? aviso : 'CÓDIGO ANTIGO DE ACESSO'} corRotulo={aviso && aviso.length <= 32 ? corAviso : undefined} tremer={tremer}>
                <PeCaixas valor={codigoAntigo} />
              </PePainel>
            </div>
            {/* Espaço fixo (2 linhas) para avisos longos: aparecer ou desaparecer
              (ex.: ao tocar no primeiro número) já não mexe na página. */}
          <div style={{ fontSize: 12.5, color: corAviso || T.bad, textAlign: 'center', lineHeight: 1.4, height: '2.8em', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{aviso && aviso.length > 32 ? aviso : ''}</div>
            <PeTeclado onTecla={tecla} desativado={ocupado} />
            <button type="button" onClick={seguirCodigoAntigo} disabled={codigoAntigo.length < 4 || ocupado} style={botaoOuro(codigoAntigo.length >= 4 && !ocupado)}>
              {ocupado ? 'A verificar…' : 'Seguinte'}
            </button>
          </div>
          <button type="button" onClick={() => { setEcra(cartao ? 'porta' : 'rececao'); setCodigoAntigo(''); limpar(); }} style={ligacao}>Voltar à receção</button>
        </div>
      )}

      {ecra === 'recuperar' && (
        <div style={coluna}>
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <PeCartao jogador={jogador} cor={cor} logo={logo} clube={clube} />
            <div style={{ ...display, fontSize: 19, fontWeight: 600, color: T.cream, marginTop: 14 }}>Já tens cartão de atleta</div>
            <div style={{ fontSize: 12.5, color: T.mutedDim, textAlign: 'center', marginTop: -6 }}>Escreve o teu PIN para o usares também aqui.</div>
            <div style={{ width: 'min(100%, 300px)' }}>
              <PePainel rotulo={aviso || 'PIN PESSOAL'} corRotulo={aviso ? corAviso : undefined} tremer={tremer}>
                <PeCaixas valor={pin} ocultar />
              </PePainel>
            </div>
            <PeTeclado onTecla={tecla} desativado={ocupado} />
          </div>
          <button type="button" onClick={() => { setEcra('codigo'); setPin(''); limpar(); }} style={ligacao}>Voltar</button>
        </div>
      )}

      {ecra === 'reativar' && (
        <div style={coluna}>
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <PeCartao jogador={jogador} cor={cor} logo={logo} clube={clube} />
          <div style={{ ...display, fontSize: 19, fontWeight: 600, color: T.cream, marginTop: 14, textAlign: 'center' }}>Já levantaste o teu cartão</div>
          <div style={{ fontSize: 12.5, color: T.mutedDim, textAlign: 'center', marginTop: -6, lineHeight: 1.45 }}>Escreve o teu PIN para o usares também neste aparelho.</div>
          <div style={{ width: 'min(100%, 300px)' }}>
            <PePainel rotulo={aviso || 'PIN PESSOAL'} corRotulo={aviso ? corAviso : undefined} tremer={tremer}>
              <PeCaixas valor={pin} ocultar />
            </PePainel>
          </div>
          <PeTeclado onTecla={tecla} desativado={ocupado} />
          </div>
          <button type="button" onClick={() => { limpar(); setSemNenhum(true); setPerdeuAcesso(true); setEcra('rececao'); setPin(''); }} style={{ ...ligacao, marginBottom: -6 }}>Esqueci-me do PIN</button>
          <button type="button" onClick={() => { setEcra('rececao'); setPin(''); setCodigo(''); limpar(); }} style={ligacao}>Voltar</button>
        </div>
      )}

      {ecra === 'cartao' && (
        <div style={coluna}>
          {/* O cartão, o PIN e o teclado centrados na altura que sobra; o
              "Voltar" fica sempre no fundo. */}
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <PeCartao jogador={jogador} cor={cor} logo={logo} clube={clube} />
          <div style={{ ...display, fontSize: 19, fontWeight: 600, color: T.cream, marginTop: 14 }}>{pin1 ? 'Confirma o teu PIN' : 'Define o teu PIN de acesso'}</div>
          <div style={{ width: 'min(100%, 300px)' }}>
            <PePainel rotulo={aviso || (pin1 ? 'REPETE O PIN' : 'PIN PESSOAL')} corRotulo={aviso ? corAviso : undefined} tremer={tremer}>
              <PeCaixas valor={pin} ocultar />
            </PePainel>
          </div>
          <PeTeclado onTecla={tecla} desativado={ocupado} />
          </div>
          <button type="button" onClick={() => { setEcra('rececao'); setPin(''); setPin1(''); limpar(); }} style={ligacao}>Voltar</button>
        </div>
      )}

      {ecra === 'porta' && cartao && (() => {
        /* A PORTA DO PLANTEL, COMO A DA EQUIPA TÉCNICA: fundo escuro com o aro
           de luz, a porta de vidro deitada com o Face ID no emblema e, por
           baixo, a camisola do atleta pendurada (de costas: nome, número e
           impressão digital; virada: o PIN). Só muda o visual: o PIN e a
           impressão digital passam pelas mesmas funções (tecla, entrarComBio)
           e a abertura da porta para o Portal é a de sempre. */
        const m = medidasPorta;
        const verBio = bioAtiva && !modoPin;
        const virada = modoPin || (!bioAtiva && pinVirado);
        const faceId = !bioAtiva ? 'desligado' : aberta ? 'ok' : (ocupado && verBio) ? 'a-ler' : verBio ? 'pronto' : 'quieto';
        const irParaPin = () => { limpar(); setPin(''); if (bioAtiva) setModoPin(true); else setPinVirado(true); };
        const voltarCostas = () => { limpar(); setPin(''); if (bioAtiva) { setModoPin(false); entrarComBio(); } else setPinVirado(false); };
        const rotulo = aviso && aviso.length <= 26 ? aviso : 'PIN PESSOAL';
        return (
        <>
        {/* fundo escuro e aro de luz no teto (dentro da cópia do ecrã que
            fica por baixo da porta a abrir: desvanece com o resto) */}
        {/* No modo claro muda o ambiente (fundo e luz); a porta, o letreiro
            e a camisola mantêm os materiais — como na equipa técnica. */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: TEMA_ATUAL === 'claro' ? 'radial-gradient(ellipse at 50% 18%, #FFFFFF 0%, #E3E9E1 75%)' : 'radial-gradient(ellipse at 50% 18%, #26342B 0%, #0B0F0D 75%)' }}>
          <div style={{ position: 'absolute', left: '50%', top: -8, width: 'min(80vw, 420px)', height: 22, boxSizing: 'content-box', transform: 'translateX(-50%)', borderRadius: '50%',
            border: TEMA_ATUAL === 'claro' ? '3px solid rgba(176,138,30,.7)' : '3px solid rgba(255,230,160,.75)',
            boxShadow: TEMA_ATUAL === 'claro' ? '0 0 24px 6px rgba(255,205,110,.35)' : '0 0 24px 6px rgba(255,230,160,.22)' }} />
        </div>
        <div style={{ ...coluna, position: 'relative', gap: 0, maxWidth: Math.max(420, m.W + 14) }}>
          {semMemoria && (
            <div style={{ alignSelf: 'stretch', fontSize: 12.5, lineHeight: 1.45, color: T.cream, background: T.fundoErro, border: `1px solid ${T.bad}`, borderRadius: 10, padding: '8px 12px', flexShrink: 0, marginBottom: 8 }}>
              Este navegador não está a guardar o teu cartão (janela privada ou memória bloqueada). Podes entrar agora com o PIN, mas da próxima vez abre o Portal num navegador normal — ou instala a app no dispositivo (Mais opções).
            </div>
          )}
          <div style={{ height: 8 + m.S, flexShrink: 0 }} />
          <PePorta aberta={aberta} jogador={cartao.jogador} cor={cor} logo={logo} clube={clube}
            largura={m.W} altura={m.H} faceId={faceId} pista={pistaEmblema && verBio && !ocupado}
            onEmblema={bioAtiva ? () => { if (!verBio) { limpar(); setPin(''); setModoPin(false); } acabarPistaPortal(); entrarComBio(); } : irParaPin} />
          <PeGancho k={m.k} />
          <div style={{ position: 'relative', width: 300 * m.k, height: 330 * m.k, flexShrink: 0, animation: tremer ? 'pe-treme .45s' : 'none' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: 300, height: 330, transform: `scale(${m.k})`, transformOrigin: '0 0' }}>
              <PeCamisola jogador={cartao.jogador} cor={cor} logo={logo} virada={virada} pin={pin} aberta={aberta}
                rotulo={rotulo} corRotulo={aviso && aviso.length <= 26 ? corAviso : undefined}
                sensor={bioAtiva
                  ? { icone: PE_ICONE_DEDO, rotulo: `Entrar com ${PE_BIO_TXT.comArtigo}`, pulsar: false, aLer: ocupado && verBio, onClick: (ocupado || aberta) ? null : () => entrarComBio() }
                  : { icone: PE_ICONE_TECLADO, rotulo: 'Entrar com o PIN', pulsar: !aberta, onClick: aberta ? null : irParaPin }}
                teclado={{
                  onTecla: tecla, desativado: !virada || ocupado || aberta,
                  extra: bioAtiva
                    ? { icone: PE_ICONE_DEDO, rotulo: `Entrar com ${PE_BIO_TXT.comArtigo}`, onClick: voltarCostas }
                    : { icone: PE_ICONE_VIRAR, rotulo: 'Ver as costas da camisola', onClick: voltarCostas },
                }} />
            </div>
          </div>
          {/* Avisos longos por baixo da camisola, num espaço fixo (não
              empurram nada). Os curtos vão no letreiro do PIN. */}
          <div style={{ fontSize: 12.5, color: corAviso || T.bad, textAlign: 'center', lineHeight: 1.35, height: '2.7em', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 4, width: 'min(92vw, 380px)' }}>
            {aviso && (aviso.length > 26 || !virada) ? aviso : ''}
          </div>
          {/* Uma só ligação discreta; as opções abrem num painel por baixo,
              para não roubarem altura à porta e ao teclado. */}
          <button type="button" onClick={() => setMaisOpcoes(true)} style={{ ...ligacao, textDecoration: 'none', color: T.mutedDim, display: 'flex', alignItems: 'center', gap: 6, minHeight: 44, flexShrink: 0, fontSize: 14 }}>
            <span style={{ fontSize: 18, lineHeight: 1, letterSpacing: 1 }}>⋯</span> Mais opções
          </button>
          {maisOpcoes && (() => {
            const opcao = { width: '100%', textAlign: 'left', padding: '13px 14px', borderRadius: 12, background: T.bg, border: `1px solid ${T.line}`, color: T.cream, fontSize: 14.5, cursor: 'pointer', ...body };
            return (
              <div onClick={() => setMaisOpcoes(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 'calc(12px + env(safe-area-inset-bottom, 0px)) 12px' }}>
                <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <PeInstalar estilo={opcao} aoAbrir={() => setMaisOpcoes(false)} />
                  {bioAtiva && (
                    <button type="button" style={opcao} onClick={() => { setMaisOpcoes(false); limpar(); setPin(''); setModoPin(true); }}>Entrar com o PIN</button>
                  )}
                  {bioSuportada && !cartao.bio && (
                    <button type="button" style={opcao} onClick={() => { setMaisOpcoes(false); limpar(); setPin(''); setEcra('bio-pin'); }}>Entrar com {PE_BIO_TXT.comArtigo}</button>
                  )}
                  <button type="button" style={opcao} onClick={() => { setMaisOpcoes(false); limpar(); setPin(''); setEcra('outro-pin'); }}>Utilizar outro equipamento</button>
                  <button type="button" style={opcao} onClick={() => { setMaisOpcoes(false); usarOutroCartao(); }}>Usar outro cartão de atleta</button>
                  <button type="button" style={{ ...opcao, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onClick={trocarTema}>
                    {TEMA_ATUAL === 'claro' ? 'Modo escuro' : 'Modo claro'}
                    <span style={{ color: T.muted, display: 'flex' }}><IconeTema size={18} /></span>
                  </button>
                  <button type="button" onClick={() => setMaisOpcoes(false)} style={{ ...opcao, textAlign: 'center', background: 'none', border: 'none', color: T.mutedDim }}>Fechar</button>
                </div>
              </div>
            );
          })()}
        </div>
        </>
        );
      })()}
    </div>
  );
}

/* `onSubmit` devolve uma promessa: true se o código existir, false se
   não. A lista de jogadores já não passa por aqui — quem confirma o
   código é a base de dados. */
function CheckinLogin({ onSubmit, equipa }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [aVerificar, setAVerificar] = useState(false);

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  /* Aceita de 4 a 6 dígitos. Os códigos passaram a ter seis, mas os de
     quatro continuam válidos até serem regenerados — e um plantel não se
     atualiza todo no mesmo dia. Exigir seis deixaria metade da equipa de
     fora sem explicação. */
  const maxLen = CHECKIN_CODE_LEN;
  const minLen = CHECKIN_CODE_MIN;

  const press = (d) => {
    setError(false);
    if (d === '⌫') { setValue(v => v.slice(0, -1)); return; }
    if (d === '') return;
    setValue(v => (v.length < maxLen ? v + d : v));
  };

  const submit = async () => {
    if (aVerificar || value.length < minLen) return;
    setAVerificar(true);
    let ok = false;
    try { ok = await onSubmit(value); } catch (e) { ok = false; }
    setAVerificar(false);
    if (!ok) { setError(true); setValue(''); }
  };

  return (
    <div style={{ maxWidth: 360, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
      {/* SEM EMBLEMA NEM GENTÍLICO FIXOS.

          Este ecrã era do SC Salgueiros: emblema no ficheiro e um
          "Salgueirista!" escrito no código. Com equipas de outros clubes,
          as duas coisas passam a estar erradas — e erradas da pior
          maneira, porque é o primeiro ecrã que um atleta de outro clube
          vê. O nome vem agora da equipa do link; o emblema, se existir,
          também. */}
      {equipa && equipa.logo ? (
        <img src={equipa.logo} alt="" style={{ width: 56, height: 56, objectFit: 'contain', marginBottom: 14 }} />
      ) : null}
      {/* "Boa noite, SC Salgueiros!" era estranho: cumprimentava o clube
          e não o miúdo que está do outro lado. O emblema por cima já diz
          de quem é o ecrã; a saudação é para quem lá chega. */}
      <div style={{ ...display, fontSize: 21, fontWeight: 700, color: T.cream, marginBottom: 6 }}>
        {greetingNow()}, craque!
      </div>
      <div style={{ fontSize: 13.5, color: T.mutedDim, marginBottom: 26 }}>Introduz o teu código pessoal para entrares.</div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 22 }}>
        {[...Array(maxLen)].map((_, i) => (
          <div key={i} style={{
            width: 16, height: 16, borderRadius: '50%',
            // As posições acima do mínimo aparecem mais esbatidas: quem
            // tem um código de quatro percebe que já pode entrar.
            border: `1px solid ${i < minLen ? T.line : T.line + '80'}`,
            background: i < value.length ? T.gold : 'transparent',
          }} />
        ))}
      </div>

      {error && <div style={{ color: T.bad, fontSize: 13, marginBottom: 14 }}>Código inválido — tenta novamente.</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 22 }}>
        {digits.map((d, i) => (
          <button key={i} onClick={() => press(d)} disabled={d === ''} style={{
            padding: '18px 0', borderRadius: 10, cursor: d === '' ? 'default' : 'pointer',
            background: d === '' ? 'transparent' : T.surface, border: d === '' ? 'none' : `1px solid ${T.line}`,
            color: T.cream, ...display, fontSize: 20, fontWeight: 600,
          }}>{d}</button>
        ))}
      </div>

      <BigButton onClick={submit} disabled={value.length < minLen || aVerificar} accent>{aVerificar ? 'A verificar…' : 'Entrar'}</BigButton>
      <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 18 }}>Não sabes o teu código? Pede-o ao staff técnico.</div>
    </div>
  );
}

/* SEQUÊNCIA DE RESPOSTAS — substitui o calendário antigo.

   Sem "responder por trás" (CHECKIN_ALLOW_BACKFILL a false), um
   calendário onde só o dia de hoje é clicável não servia para nada —
   os dias passados eram só histórico visual preso atrás de um
   seletor. Isto é mais direto: conta quantos dias seguidos, a contar
   de hoje para trás, o atleta respondeu ao Wellness (o questionário
   que existe todos os dias, ao contrário do RPE, que só existe em
   dias com sessão). Se hoje ainda não respondeu, a sequência conta a
   partir de ontem — não fica a zero só porque ainda é cedo.

   Limitada aos mesmos `CHECKIN_DAYS_BACK` dias que a app já trazia
   para o histórico — não é preciso pedir mais nada ao servidor. */
/* `sequenciaWellness` deixou de ser usada pelo StreakCard — a chama
   passou a seguir a mesma regra (Wellness + PSE, autónomo, com o mesmo
   reinício) que a tarefa da sequência (META_SEQUENCIA dias), calculada no servidor por
   `checkin_sequencia_wellness_pse` (o "autónomo" depende de
   updated_by_email, que o quiosque não recebe). Fica cá só por se
   algures ainda for útil um dia — não faz mal nenhum ficar sem uso. */
function sequenciaWellness(recentDates, dayStatus) {
  const hoje = todayStr();
  let i = recentDates.length - 1;
  if (recentDates[i] === hoje && !(dayStatus[recentDates[i]] && dayStatus[recentDates[i]].wellness)) i--;
  let count = 0;
  for (; i >= 0; i--) {
    if (dayStatus[recentDates[i]] && dayStatus[recentDates[i]].wellness) count++;
    else break;
  }
  return count;
}

/* Frases motivacionais do cartão da chama — uma por dia, escolhida de
   forma determinística a partir da data (mesmo texto o dia inteiro,
   muda sozinho à meia-noite). Não precisa de nada guardado na base de
   dados: cada telemóvel calcula a mesma conta a partir da mesma data e
   chega sempre à mesma frase. */
const CHAMA_MENSAGENS = [
  'Não deixes a chama apagar hoje!',
  'Um dia de cada vez, a chama continua acesa.',
  'Protege a tua sequência a todo o custo.',
  'O esforço de hoje garante a chama de amanhã.',
  'A chama não se acende sozinha, precisa da tua ação.',
  'Disciplina é manter o fogo aceso mesmo quando não apetece.',
  'Não quebres a corrente. Tu consegues.',
  'A consistência é o que transforma uma faísca numa fogueira.',
  'O teu futuro agradece o esforço que fazes hoje.',
  'Pequenos passos diários criam grandes mudanças.',
  'A chama brilha mais forte a cada dia que vences.',
  'Chama acesa, foco no treino. Só faltas tu responder.',
  'Mantém a corrente. O teu recorde continua hoje.',
  'Minuto 90: Última oportunidade para manter a chama viva!',
  'Atleta de elite não falha a rotina. Mantém o teu fogo aceso.',
  'O teu rendimento começa aqui. Atualiza o teu estado físico.',
  'Evita lesões, joga sempre. Responde ao questionário do dia.',
  'Consistência no telemóvel, consistência no relvado. Segue a sequência.',
  'Mostra a tua disciplina. Alimenta a chama do teu progresso.',
  'Capitão da consistência: mantém a tua chama ao mais alto nível.',
  'A equipa não falha. Garante os teus 3 pontos de hoje no questionário.',
  'Quem tem a chama mais forte no balneário? Não deixes a tua apagar.',
  'Treino invisível: é muito importante para a tua evolução.',
  'Rumo ao topo. Cada dia respondido é uma vitória na tua rotina.',
  'Como acordou o craque? Alimenta a tua chama e avalia o teu sono!',
  'Check-in matinal: diz-nos como te sentes e garante mais um dia rumo ao teu objetivo.',
  'Corpo descansado, chama acesa. Responde ao questionário de hoje.',
  'Mantém o foco: falta pouco para desbloqueares o teu prémio!',
  'A caminho do bónus! Mantém a chama acesa hoje e protege o teu recorde.',
  'Disciplina de elite: quem for mais consistente, vai ter sucesso!',
  'O teu corpo é a tua ferramenta de trabalho. Cuida dele hoje.',
  'Craque não falha nos pormenores. Faz o teu check-in diário.',
  'Dormir bem e recuperar também é treinar.',
  'O profissionalismo mede-se nas pequenas rotinas diárias.',
  'Quem quer jogar ao mais alto nível, não facilita no descanso.',
  'Monitorizar o corpo é o primeiro passo para evitar a bancada.',
  'Não fiques para trás. O balneário já está todo focado!',
  'Ganha a titularidade na disciplina. Alimenta a chama hoje.',
  'No relvado dás tudo, no telemóvel não podes falhar.',
  'Deixas a chama apagar ou vais aguentar a pressão?',
  'Menos desculpas, mais consistência. Responde ao questionário.',
  'Mostra a raça de campeão também fora das quatro linhas.',
  'O esforço de ontem determina a recuperação de hoje. Diz-nos como estás.',
  'Escuta o teu corpo antes que ele te obrigue a parar.',
  'Sentes dores ou cansaço? O mister precisa de saber para te proteger.',
  'Ajustar a carga de treino hoje é garantir o teu golo no fim de semana.',
  'Como está o motor hoje? Regista o teu nível de energia.',
  'A chama continua a arder e o prémio está cada vez mais perto!',
  'Só os mais disciplinados vão receber o prémio final. Vais ser um deles?',
];

function mensagemChamaDoDia(hoje) {
  // Hash simples e estável (não precisa de ser criptográfico, só de dar
  // sempre o mesmo número para a mesma data em qualquer telemóvel).
  let h = 0;
  for (let i = 0; i < hoje.length; i++) h = (h * 31 + hoje.charCodeAt(i)) >>> 0;
  return CHAMA_MENSAGENS[h % CHAMA_MENSAGENS.length];
}

function StreakCard({ dias }) {
  dias = dias || 0;
  const mensagem = mensagemChamaDoDia(todayStr());
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22,
      background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: '14px 16px',
    }}>
      <Flame size={26} color={dias > 0 ? T.gold : T.mutedDim} strokeWidth={1.6} style={{ flexShrink: 0 }} />
      <span>
        <span style={{ display: 'block', fontSize: 13, color: T.cream, lineHeight: 1.4 }}>{mensagem}</span>
        {dias > 0 && (
          <span style={{ display: 'block', fontSize: 11, color: T.mutedDim, marginTop: 3 }}>
            {dias} {dias === 1 ? 'dia seguido' : 'dias seguidos'} a responder ao Wellness.
          </span>
        )}
      </span>
    </div>
  );
}

/* ===================================================================
   PÁGINA INICIAL DO PORTAL — "O DIA É UM JOGO"
   ===================================================================
   O dia do atleta tem a forma de um jogo: o Wellness é a 1.ª parte
   (CHECKIN_WINDOWS.wellness), o PSE é a 2.ª (CHECKIN_WINDOWS.rpe) e os
   minutos entre as duas são o intervalo. Tudo num só ecrã, fixo, sem
   scroll — nada mexe a página quando se toca em alguma coisa.
   · PLACARD: as horas, a parte do dia e quanto falta para fechar; por
     baixo, o resultado Wellness–PSE (cada questionário respondido é um
     golo).
   · PAINEL LED DO MISTER (colado à linha lateral da prancheta): a voz do
     mister, sempre a correr. Em véspera/dia de jogo anuncia o jogo e leva
     à área Jogo do Portal; com missões por fazer, leva a cada missão;
     sem nada, "Sem missões pendentes". Várias mensagens passam uma de
     cada vez e o toque vai para a que está a passar.
   · PRANCHETA: o campo como linha do tempo — o íman do jogador anda com
     a hora do dia; cada baliza é um questionário.
   · GRAFISMO DA SEQUÊNCIA: os dias seguidos da chama + a frase do dia.
   · BALNEÁRIO: a entrada do Portal. A TV da análise ao fundo, e o cacifo
     do próprio jogador iluminado, com a camisola dele (nome e número) e a
     fotografia do plantel.
   Os horários vêm sempre de CHECKIN_WINDOWS: mudar lá muda aqui. */
const PKH_TICKER = 'IDEIA DE JOGO · TREINO · SALA DE VÍDEO · JOGO · COMPETIÇÃO · DESENVOLVIMENTO · TAREFAS';
// Ecrã fixo, sem scroll: não se reserva o espaço da barra de scroll (a regra
// geral do Portal "scrollbar-gutter: stable" deixava aqui uma faixa branca
// à direita, muito visível na app instalada) e o fundo da janela é o da app.
const PKH_CSS = `
  html, body { overflow: hidden !important; overscroll-behavior: none; }
  html { scrollbar-gutter: auto !important; background: ${T.bg}; }
  body { background: ${T.bg}; }
  @keyframes pkh-pulso { 0%,100% { box-shadow: 0 0 0 0 rgba(201,162,39,.55); } 50% { box-shadow: 0 0 0 8px rgba(201,162,39,0); } }
  @keyframes pkh-pisca { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
  @keyframes pkh-subir {
    0% { transform: translateY(calc(108vh - var(--y))) rotate(var(--rot)); }
    100% { transform: translateY(calc(-1 * var(--y) - 12vh)) rotate(calc(var(--rot) + 220deg)); }
  }
`;

function pkhEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// Posição (x) do íman no campo para um minuto do dia; null = antes de abrir.
function pkhXDoMinuto(m) {
  const W = CHECKIN_WINDOWS.wellness, P = CHECKIN_WINDOWS.rpe;
  if (m < W.startMin) return null;
  if (m <= W.endMin) return 12 + ((m - W.startMin) / Math.max(1, W.endMin - W.startMin)) * 134;
  if (m < P.startMin) return 150;
  if (m <= P.endMin) return 154 + ((m - P.startMin) / Math.max(1, P.endMin - P.startMin)) * 134;
  return 288;
}
const pkhY = (x) => 75 + 24 * Math.sin(((x - 12) / 276) * Math.PI * 3);

/* PLACARD (fino): só o que um placard a sério mostra — a hora à esquerda,
   o resultado do dia ao centro (Wellness – PSE) e a chama dos dias
   seguidos à direita. A parte do dia vê-se no campo, logo por baixo. */
function PkhPlacard({ hora, golosW, golosP, dias, g }) {
  const led = { ...mono, color: '#FFC23D' };
  return (
    <div style={{
      flexShrink: 0, height: g ? 46 : 38, boxSizing: 'border-box', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
      padding: g ? '0 16px' : '0 12px', background: '#07090a', border: '3px solid #2a2f33', borderBottom: 0, borderRadius: '12px 12px 0 0',
      backgroundImage: 'radial-gradient(rgba(255,194,61,.08) 1px, transparent 1.3px)', backgroundSize: '5px 5px',
    }}>
      <span style={{ ...led, fontSize: g ? 15 : 12.5, letterSpacing: '.12em', opacity: 0.85 }}>{hora}</span>
      <span style={{ ...led, fontSize: g ? 27 : 21, fontWeight: 700, letterSpacing: '.06em', lineHeight: 1 }} aria-label={`Wellness ${golosW}, PSE ${golosP}`}>{golosW} – {golosP}</span>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }} title={`${dias} ${dias === 1 ? 'dia seguido' : 'dias seguidos'}`}>
        <Flame size={g ? 18 : 15} color={dias > 0 ? '#C9A227' : '#5f6b63'} />
        <span style={{ ...mono, fontSize: g ? 16 : 13, fontWeight: 700, color: dias > 0 ? '#F2EDE0' : '#8A9A8C' }}>{dias}</span>
      </span>
    </div>
  );
}

function PkhBolaMini({ size = 13, color = '#1A2A1F' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="2" />
      <path d="M12 7.5 L16 10.4 L14.5 15 L9.5 15 L8 10.4 Z" fill={color} />
    </svg>
  );
}

/* MISTER — só aparece quando tem algo a dizer (jogo, missão, aniversário).
   Texto parado, numa frase; com mais de uma mensagem, a seta passa à
   seguinte. Tocar no texto leva ao sítio da mensagem. */
function PkhMister({ mensagens, g, estilo }) {
  const lista = (mensagens || []).filter(m => m && m.tipo !== 'nada');
  const [idx, setIdx] = useState(0);
  const chave = lista.map(m => `${m.tipo}:${m.texto}`).join('|');
  useEffect(() => { setIdx(0); }, [chave]);
  if (!lista.length) return null;
  const atual = lista[idx % lista.length];
  const tocavel = typeof atual.onTocar === 'function';
  const frase = String(atual.texto || '').replace(/\s*▸\s*/g, '. ').trim();
  const cor = atual.tipo === 'jogo' ? '#F2EDE0' : '#FFC23D';
  return (
    <div style={{
      flexShrink: 0, display: 'flex', alignItems: 'stretch', minHeight: g ? 44 : 36, background: '#050607', border: '2px solid #2a2f33',
      borderRadius: 8, overflow: 'hidden', ...(estilo || {}),
    }}>
      <span style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: g ? '0 12px' : '0 8px', background: T.goldFundo,
        color: '#1A2A1F', fontSize: g ? 13 : 11, fontWeight: 600, letterSpacing: '.04em', ...body,
      }}>
        {atual.tipo === 'jogo' ? <PkhBolaMini /> : atual.tipo === 'festa' ? <PartyPopper size={13} /> : <Megaphone size={13} />}
        Mister
      </span>
      <button type="button" onClick={() => { if (tocavel) atual.onTocar(); }} style={{
        flex: 1, minWidth: 0, background: 'none', border: 0, padding: g ? '7px 12px' : '5px 10px', textAlign: 'left', cursor: tocavel ? 'pointer' : 'default',
        ...body, fontSize: g ? 14.5 : 12, lineHeight: 1.3, color: cor, display: 'flex', alignItems: 'center',
      }}>
        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{frase}</span>
      </button>
      {lista.length > 1 && (
        <button type="button" onClick={() => setIdx(i => i + 1)} aria-label="Mensagem seguinte" style={{
          flexShrink: 0, background: 'none', border: 0, borderLeft: '1px solid #2a2f33', color: '#8A9A8C', padding: '0 9px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 2, ...mono, fontSize: 11,
        }}>{(idx % lista.length) + 1}/{lista.length}<ChevronRight size={13} /></button>
      )}
    </div>
  );
}

/* O CAMPO = os dois questionários. Cada metade (da linha lateral à linha
   do meio-campo, entre as duas linhas de fundo) é o botão do Wellness e o
   da PSE. A metade por responder AGORA tem contorno dourado e pisca
   devagar; a outra fica escurecida, com o estado escrito. */
function PkhCampo({ apagado, noite, wEstado, wTexto, pEstado, pTexto, semSegunda, onWellness, onPse, g, largo }) {
  /* O CAMPO EM PERSPETIVA, NOITE DE JOGO (a combinar com o balneário
     premium): visto da bancada, com bancada escura e público na cor da
     equipa ao fundo, placas LED douradas, relva às riscas, linhas
     branco-quente com brilho, balizas nas pontas e holofotes quentes nos
     cantos. Cada metade é o botão do Wellness e o da PSE: por responder =
     dourado a pulsar; feito = verde com ✓; fechado = escurecido.
     O desenho continua para os lados do quadro (relva e bancada): em ecrãs
     largos o painel enche-se sem esticar nem achatar o campo. */
  const eq = coresCamisola(T.corEquipa);
  /* Largura do desenho = proporção real do painel (altura fixa 170): em
     ecrãs largos o campo alarga-se em perspetiva (como visto da bancada
     lateral), em vez de ficar pequeno ao centro. */
  const caixaRef = useRef(null);
  const [W, setW] = useState(300);
  /* Medido ANTES de pintar (useLayoutEffect): com useEffect, ao voltar ao
     ecrã inicial via-se primeiro o campo estreito (300) e logo a seguir o
     campo alargado — a imagem dava um salto. */
  React.useLayoutEffect(() => {
    const el = caixaRef.current;
    if (!el) return undefined;
    const medir = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      const nw = Math.round(Math.max(300, Math.min(620, (170 * w) / h)));
      setW(v => (Math.abs(v - nw) > 2 ? nw : v));
    };
    medir();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(medir); ro.observe(el); return () => ro.disconnect();
  }, []);
  const TP = { y: 34, x0: W * 0.193, x1: W * 0.807 }, BT = { y: 162, x0: 6, x1: W - 6 };
  const P = (u, v) => {
    const xt = TP.x0 + (TP.x1 - TP.x0) * u, xb = BT.x0 + (BT.x1 - BT.x0) * u;
    return [xt + (xb - xt) * v, TP.y + (BT.y - TP.y) * v];
  };
  const pp = a => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const quad = (u0, u1, v0, v1) => pp([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)]);
  const elipse = (cu, cv, ru, rv) => pp(Array.from({ length: 41 }, (_, i) => { const t = (i / 40) * 2 * Math.PI; return P(cu + ru * Math.cos(t), cv + rv * Math.sin(t)); }));
  const linhas = (
    <>
      <polygon points={quad(0, 1, 0, 1)} /><polyline points={pp([P(0.5, 0), P(0.5, 1)])} /><polyline points={elipse(0.5, 0.5, 0.075, 0.16)} />
      <polygon points={quad(0, 0.15, 0.22, 0.78)} /><polygon points={quad(0.85, 1, 0.22, 0.78)} />
      <polygon points={quad(0, 0.055, 0.37, 0.63)} /><polygon points={quad(0.945, 1, 0.37, 0.63)} />
    </>
  );
  const baliza = (u, dir) => {
    const a = P(u, 0.42), b = P(u, 0.58), h = (b[1] - a[1]) * 0.55 + 6, d = dir * 7;
    return (
      <g key={u}>
        <polygon points={pp([a, b, [b[0] + d, b[1] - 3], [a[0] + d, a[1] - 3]])} fill="rgba(255,255,255,.12)" />
        <polyline points={pp([a, [a[0], a[1] - h], [b[0], b[1] - h], b])} fill="none" stroke={apagado ? "#5d6b66" : "#fff"} strokeWidth="1.5" />
      </g>
    );
  };
  const metade = (lado, nome, estado, texto, onClick) => {
    const aberto = estado === 'aberto', feito = estado === 'feito';
    const t = String(texto || '');
    const [cx, cy] = P(lado === 'w' ? 0.27 : 0.73, 0.5);
    const corTxt = feito ? '#8EE6A0' : aberto ? '#FFC23D' : 'rgba(255,255,255,.75)';
    const halo = { stroke: apagado ? '#0d2117' : '#163d27', strokeWidth: 3.2, paintOrder: 'stroke', strokeLinejoin: 'round' };
    const zona = lado === 'w' ? quad(0, 0.5, 0, 1) : quad(0.5, 1, 0, 1);
    return (
      <g role="button" tabIndex={aberto ? 0 : -1} aria-label={`${nome}: ${t}`} aria-disabled={!aberto}
        onClick={() => { if (aberto && onClick) onClick(); }}
        onKeyDown={(e) => { if (aberto && onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}
        style={{ cursor: aberto ? 'pointer' : 'default', outline: 'none' }}>
        <polygon points={zona}
          fill={feito ? 'rgba(120,220,140,.16)' : aberto ? 'rgba(201,162,39,.18)' : 'rgba(0,0,0,.28)'}
          stroke={aberto ? '#E9C24A' : feito ? '#8EE6A0' : 'none'} strokeWidth={aberto ? 2.4 : 1.6}>
          {aberto && <animate attributeName="stroke-opacity" values="1;.35;1" dur="1.8s" repeatCount="indefinite" />}
        </polygon>
        <text x={cx} y={cy - 6} dominantBaseline="central" textAnchor="middle" fontSize="16" fontWeight="600" letterSpacing="1"
          fill={feito || aberto ? '#fff' : 'rgba(255,255,255,.82)'} fontFamily="Oswald, sans-serif" style={halo}>{nome}</text>
        <text x={cx} y={cy + 10} dominantBaseline="central" textAnchor="middle" fontSize="8.5" fill={corTxt} fontFamily="Inter, sans-serif" style={halo}>{feito ? `✓ ${t}` : t}</text>
      </g>
    );
  };
  // Público na bancada: pontinhos na cor da equipa (de -300 a 600 para encher ecrãs largos).
  const publico = [];
  for (let i = -60; i < Math.ceil(W / 5) + 60; i++) publico.push(<rect key={i} x={i * 5 + 1} y={15 + (((i % 3) + 3) % 3) * 5} width="3" height="3" fill={apagado ? '#1c211f' : (i % 4 ? eq.escuro : eq.base)} opacity=".8" />);
  return (
    <div style={{
      background: '#0b0d0c', border: '3px solid #2a2f33', borderTop: 0, borderRadius: '0 0 12px 12px', overflow: 'hidden', flexShrink: 0,
      filter: noite ? 'brightness(.5) saturate(.6)' : 'none', transition: 'filter .8s',
    }}>
      <svg ref={caixaRef} viewBox={`0 0 ${W} 170`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', width: '100%', height: largo ? (g ? '24dvh' : '27dvh') : 'auto', aspectRatio: largo ? undefined : '300 / 170', maxHeight: largo ? 280 : '30dvh' }}>
        <defs>
          <filter id="pkh-campo-led" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6" /></filter>
          <radialGradient id="pkh-campo-hol" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#FFE6A0" stopOpacity=".6" /><stop offset="1" stopColor="#FFE6A0" stopOpacity="0" /></radialGradient>
          <linearGradient id="pkh-campo-ceu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b0d0c" /><stop offset="1" stopColor="#151a17" /></linearGradient>
        </defs>
        <g aria-hidden="true">
          <rect x="-300" y="0" width={W + 600} height="170" fill="url(#pkh-campo-ceu)" />
          <rect x="-300" y="12" width={W + 600} height="20" fill="#141a17" />
          {publico}
          <rect x="-300" y="30" width={W + 600} height="5" fill={apagado ? '#2a2618' : '#FFC23D'} />{!apagado && <rect x="-300" y="31.5" width={W + 600} height="2" fill="#FFF4D6" opacity=".6" />}
          <rect x="-300" y="35" width={W + 600} height="135" fill={apagado ? '#132e20' : '#2a6142'} />
          {Array.from({ length: W > 420 ? 16 : 12 }, (_, k, arr) => (k % 2 ? <polygon key={k} points={quad(k / (W > 420 ? 16 : 12), (k + 1) / (W > 420 ? 16 : 12), -0.01, 1.07)} fill={apagado ? '#10281b' : '#24563a'} /> : null))}
          {!apagado && <g fill="none" stroke="#FFF4D6" strokeWidth="3.4" opacity=".35" filter="url(#pkh-campo-led)">{linhas}</g>}
          <g fill="none" stroke={apagado ? '#9fb0c8' : '#FFF4D6'} strokeWidth="1.4" opacity={apagado ? 0.35 : 0.9}>{linhas}</g>
          {baliza(0, -1)}{baliza(1, 1)}
        </g>
        {metade('w', 'WELLNESS', wEstado, wTexto, onWellness)}
        {metade('p', semSegunda ? 'FOLGA' : 'PSE', pEstado, pTexto, onPse)}
        <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
          {!apagado && <><ellipse cx="18" cy="16" rx="60" ry="34" fill="url(#pkh-campo-hol)" /><ellipse cx={W - 18} cy="16" rx="60" ry="34" fill="url(#pkh-campo-hol)" /></>}
          <rect x="8" y="6" width="20" height="7" rx="1.5" fill={apagado ? '#3a3f3c' : '#FFF4D6'} /><rect x={W - 28} y="6" width="20" height="7" rx="1.5" fill={apagado ? '#3a3f3c' : '#FFF4D6'} />
          {apagado && <><circle cx={W / 2 + 70} cy="12" r="5" fill="#dfe6f0" opacity=".85" /><circle cx={W / 2 + 72} cy="10.5" r="4.4" fill="#0b0d0c" /></>}
        </g>
      </svg>
    </div>
  );
}

function PkhBotaoQuestionario({ nome, estado, texto, onClick, g }) {
  // estado: 'feito' | 'aberto' | 'fechado'
  const corBorda = estado === 'feito' ? T.good : estado === 'aberto' ? T.gold : T.line;
  return (
    <button type="button" onClick={onClick} disabled={estado !== 'aberto'} style={{
      flex: 1, minWidth: 0, height: g ? 70 : 54, boxSizing: 'border-box', borderRadius: 12, padding: g ? '10px 16px' : '7px 10px', textAlign: 'left',
      background: T.surface, border: `1px solid ${corBorda}`, cursor: estado === 'aberto' ? 'pointer' : 'default', overflow: 'hidden', ...body,
    }}>
      <div style={{ ...display, fontSize: g ? 23 : 18, fontWeight: 600, color: T.cream, lineHeight: 1.15 }}>{nome}</div>
      <div style={{
        fontSize: g ? 14 : 11.5, lineHeight: 1.3, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        display: 'flex', alignItems: 'center', gap: 4,
        color: estado === 'feito' ? T.good : estado === 'aberto' ? T.gold : T.warn,
      }}>
        {estado === 'feito' ? <Check size={12} style={{ flexShrink: 0 }} /> : estado === 'fechado' ? <Clock size={12} style={{ flexShrink: 0 }} /> : null}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{texto}</span>
        {estado === 'aberto' && <ArrowRight size={12} style={{ flexShrink: 0 }} />}
      </div>
    </button>
  );
}

function PkhSequencia({ dias, g }) {
  const frase = mensagemChamaDoDia(todayStr());
  return (
    <div style={{ flexShrink: 0, height: g ? 64 : 58, display: 'flex', alignItems: 'stretch' }}>
      <div style={{
        flexShrink: 0, width: g ? 104 : 76, background: T.goldFundo, clipPath: 'polygon(0 0,100% 0,84% 100%,0 100%)', borderRadius: '8px 0 0 8px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingRight: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Flame size={18} color={dias > 0 ? '#8a3a12' : '#5f4b10'} />
          <span style={{ ...display, fontSize: g ? 30 : 26, fontWeight: 600, color: '#1A2A1F', lineHeight: 1 }}>{dias}</span>
        </div>
        <div style={{ fontSize: 11, color: '#3b2f0a', lineHeight: 1.1, textAlign: 'center', ...body }}>{dias === 1 ? 'dia seguido' : 'dias seguidos'}</div>
      </div>
      <div style={{
        flex: 1, minWidth: 0, marginLeft: -10, background: '#0d120f', clipPath: 'polygon(13px 0,100% 0,100% 100%,0 100%)',
        padding: '4px 10px 4px 20px', display: 'flex', alignItems: 'center', borderRadius: '0 8px 8px 0',
        borderBottom: `3px solid ${T.gold}`, boxSizing: 'border-box',
      }}>
        <div style={{
          fontSize: g ? 14 : 11.5, color: T_ESCURO.cream, lineHeight: 1.28, ...body,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>«{frase}»</div>
      </div>
    </div>
  );
}

/* Balneário em perspetiva (um só ponto de fuga), desenhado como texto SVG:
   é uma cena estática, recalculada só quando mudam a cor, a camisola, a
   fotografia ou o emblema. Todo o texto que vem de dados passa por pkhEsc. */
/* W = largura do desenho (altura fixa 215). 300 no telemóvel; em ecrã largo
   a sala alarga-se (paredes mais compridas, mais cacifos), em vez de se
   cortar o desenho. */
function pkhBalneario({ cor, numero, nome, foto, iniciais, logo, inicialClube, badge, boasVindas, apagado }, W = 300, H = 215, tv = null) {
  // H > 215 quando o espaço é mais alto do que o desenho: a sala estica na
  // vertical (em vez de se cortar dos lados) e a TV fica sempre ao centro.
  const VX = W / 2, VY = (95 * H) / 215, S = 0.5, BL = VX * S, BR = W - VX * S, BT = VY * S, BB = H - (H - VY) * S;
  const kW = W / 300;
  const yE = ((VY * S) * 22) / 47.5; // altura do emblema no teto (22 no desenho base)
  const wp = (t, v) => { const x = t * BL, yt = t * BT, yb = H - t * (H - BB); return [x, yt + v * (yb - yt)]; };
  const mir = p => [W - p[0], p[1]];
  const pts = ps => ps.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const poly = (ps, f, st, sw) => `<polygon points="${pts(ps)}" fill="${f}"${st ? ` stroke="${st}" stroke-width="${sw || 0.8}"` : ''}/>`;
  const aff = (p00, p10, p01, inner) => `<g transform="matrix(${((p10[0] - p00[0]) / 100).toFixed(4)},${((p10[1] - p00[1]) / 100).toFixed(4)},${((p01[0] - p00[0]) / 100).toFixed(4)},${((p01[1] - p00[1]) / 100).toFixed(4)},${p00[0].toFixed(2)},${p00[1].toFixed(2)})">${inner}</g>`;
  const camisolaParede = n => `<line x1="50" y1="0" x2="50" y2="10" stroke="#9aa39c" stroke-width="2"/><path d="M14 22 L38 10 Q50 20 62 10 L86 22 L98 44 L78 50 L78 98 L22 98 L22 50 L2 44 Z" fill="${cor.base}" stroke="#0d120f" stroke-width="2"/><text x="50" y="80" text-anchor="middle" font-size="34" font-weight="700" fill="${cor.texto}" font-family="JetBrains Mono, monospace">${n}</text>`;
  const quadro = k => {
    let s = `<rect x="0" y="0" width="100" height="100" fill="#9c7f22"/><rect x="7" y="7" width="86" height="86" fill="${k === 1 ? '#26334a' : '#33503c'}"/>`;
    if (k === 0) s += '<path d="M34 24 H66 V44 Q66 62 50 64 Q34 62 34 44 Z" fill="#C9A43A"/><path d="M34 30 Q20 30 24 44 Q28 52 36 50" fill="none" stroke="#C9A43A" stroke-width="5"/><path d="M66 30 Q80 30 76 44 Q72 52 64 50" fill="none" stroke="#C9A43A" stroke-width="5"/><rect x="45" y="64" width="10" height="12" fill="#C9A43A"/><rect x="34" y="76" width="32" height="9" fill="#7a5f14"/>';
    else if (k === 1) s += [20, 50, 80].map(x => `<circle cx="${x}" cy="40" r="8" fill="#cfc2aa"/><path d="M${x - 10} 88 V56 H${x + 10} V88 Z" fill="${cor.base}"/><line x1="${x - 9}" y1="58" x2="${x - 18}" y2="26" stroke="#cfc2aa" stroke-width="5"/><line x1="${x + 9}" y1="58" x2="${x + 18}" y2="26" stroke="#cfc2aa" stroke-width="5"/>`).join('');
    else s += [18, 38, 58, 78].map((x, i) => `<circle cx="${x}" cy="${52 - (i % 2) * 6}" r="7" fill="#cfc2aa"/><rect x="${x - 9}" y="${60 - (i % 2) * 6}" width="18" height="34" fill="${cor.base}"/>`).join('') + '<path d="M38 18 L50 30 L62 18" fill="none" stroke="#C9A43A" stroke-width="4"/>';
    return s;
  };
  const nomeCamisola = pkhEsc(String(nome || '').toUpperCase());
  const camisolaFrente = (() => {
    const fNome = nomeCamisola.length > 9 ? 9 : nomeCamisola.length > 6 ? 11 : 13;
    // Sem cruzeta: a camisola fica logo por baixo da fotografia.
    let s = `<path d="M16 10 L38 0 Q50 10 62 0 L84 10 L100 38 L80 46 L80 104 Q50 108 20 104 L20 46 L0 38 Z" fill="${cor.base}" stroke="#FFD86A" stroke-width="2.5"/>`
      + `<path d="M38 0 Q50 10 62 0" fill="none" stroke="${cor.mangas}" stroke-width="3"/>`
      + `<path d="M0 38 L20 46 M100 38 L80 46" stroke="${cor.mangas}" stroke-width="3"/>`;
    if (numero) {
      s += `<text x="50" y="30" text-anchor="middle" font-size="${fNome}" font-weight="600" fill="${cor.texto}" font-family="Oswald, sans-serif" letter-spacing="1.5">${nomeCamisola}</text>`
        + `<text x="50" y="86" text-anchor="middle" font-size="${numero.length > 2 ? 40 : 54}" font-weight="700" fill="${cor.texto}" stroke="${cor.contorno}" stroke-width="2.5" paint-order="stroke" font-family="Oswald, sans-serif">${pkhEsc(numero)}</text>`;
    } else {
      s += `<text x="50" y="66" text-anchor="middle" font-size="${fNome + 4}" font-weight="600" fill="${cor.texto}" stroke="${cor.contorno}" stroke-width="1.5" paint-order="stroke" font-family="Oswald, sans-serif" letter-spacing="1.5">${nomeCamisola}</text>`;
    }
    return s;
  })();

  let s = '<defs><filter id="pkh-brilho" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.5"/></filter>'
    + '<filter id="pkh-brilho2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>'
    + '<clipPath id="pkh-retrato"><circle cx="0" cy="0" r="50"/></clipPath>'
    + '<clipPath id="pkh-tk"><rect x="91" y="106" width="118" height="11"/></clipPath></defs>';
  // ======== EVOLUÇÃO: balneário de clube moderno ========
  /* BALNEÁRIO "ESCURO PREMIUM": fitas LED douradas no teto, cúpula do
     emblema iluminada a dourado, cacifos da parede direita como nichos com
     luz quente (camisola da equipa + chuteiras), faixa LED por cima,
     assentos estofados com uma risca da cor da equipa e chão em madeira
     escura. Na parede da esquerda está só o cacifo do jogador, largo e com
     luz dourada, com a camisola pendurada numa cruzeta e a foto por cima. */
  const Tm = {
    teto: ['#0b0d0c', '#121614'], chao: ['#151917', '#1d2320'], paredeE: '#171c19', paredeD: '#151a17', fundo: '#1a201c',
    nicho: ['#3a3020', '#2a241a', '#17140f'], cupula: ['#FFE9A8', '#C9A227'], cupulaBorda: '#7a5f14',
    led: '#FFD86A', ledBrilho: '#FFC23D', moldura: '#0b0e0c', assento: '#3a2c1e', assentoFrente: '#22190f', chaoTipo: 'madeira',
  };
  if (apagado) Object.assign(Tm, {
    teto: ['#060807', '#0a0c0b'], chao: ['#0a0c0b', '#0f1210'], paredeE: '#0c0f0d', paredeD: '#0b0e0c', fundo: '#0e1210',
    nicho: ['#14120d', '#0f0e0a', '#090806'], cupula: ['#2a2516', '#16130c'], cupulaBorda: '#2f2814',
    led: apagado === 'presenca' ? '#5a4b22' : '#26221a', ledBrilho: apagado === 'presenca' ? '#7a6224' : 'rgba(0,0,0,0)', moldura: '#060807', assento: '#1a140e', assentoFrente: '#100c08',
  });
  const U = String(cor.base).replace(/[^a-z0-9]/gi, '') + (apagado ? 'x' + apagado : '');
  s += '<defs>'
    + `<linearGradient id="ev-teto${U}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${Tm.teto[0]}"/><stop offset="1" stop-color="${Tm.teto[1]}"/></linearGradient>`
    + `<linearGradient id="ev-chao${U}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${Tm.chao[0]}"/><stop offset="1" stop-color="${Tm.chao[1]}"/></linearGradient>`
    + `<linearGradient id="ev-nicho${U}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${Tm.nicho[0]}"/><stop offset=".6" stop-color="${Tm.nicho[1]}"/><stop offset="1" stop-color="${Tm.nicho[2]}"/></linearGradient>`
    + `<linearGradient id="ev-nichoJ${U}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${apagado ? (apagado === 'presenca' ? '#4a3f22' : '#221e14') : '#FFF6DA'}"/><stop offset=".6" stop-color="${apagado ? (apagado === 'presenca' ? '#3a3119' : '#1a170f') : '#F3D98C'}"/><stop offset="1" stop-color="${apagado ? '#14110b' : '#b8973c'}"/></linearGradient>`
    + `<radialGradient id="ev-cupula${U}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${Tm.cupula[0]}"/><stop offset=".7" stop-color="${Tm.cupula[1]}"/><stop offset="1" stop-color="${Tm.cupulaBorda === 'equipa' ? cor.base : Tm.cupulaBorda}"/></radialGradient>`
    + `<filter id="ev-led${U}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.8"/></filter>`
    + '</defs>';
  s += `<rect width="${W}" height="${H}" fill="#121614"/>`;
  // teto, paredes e chão
  s += poly([[0, 0], [W, 0], [BR, BT], [BL, BT]], `url(#ev-teto${U})`);
  s += poly([[0, 0], [BL, BT], [BL, BB], [0, H]], Tm.paredeE);
  s += poly([[W, 0], [BR, BT], [BR, BB], [W, H]], Tm.paredeD);
  s += poly([[0, H], [W, H], [BR, BB], [BL, BB]], `url(#ev-chao${U})`);
  if (Tm.chaoTipo === 'relva') {
    const nf = 8; for (let k = 0; k < nf; k++) { const x0 = k * W / nf, x1 = (k + 1) * W / nf; const p = (x, t) => [x + (VX + (x - VX) * S - x) * t, H - t * (H - BB)];
      if (k % 2) s += poly([p(x0, 0), p(x1, 0), p(x1, 1), p(x0, 1)], '#000', null).replace('fill="#000"', 'fill="#000" opacity=".12"'); }
  }
  if (Tm.chaoTipo === 'madeira') {
    [-150, -90, -30, 30, 90, 150, 210, 270, 330, 390, 450].map(x => VX + (x - 150) * kW).forEach(x => { s += `<line x1="${x}" y1="${H}" x2="${x + (VX - x) * S}" y2="${BB}" stroke="#000" stroke-opacity=".18" stroke-width=".8"/>`; });
  }
  // chão polido: reflexo das fitas do teto e juntas suaves
  [0.33, 0.66].forEach(t => { const y = H - t * (H - BB); s += `<line x1="${t * BL}" y1="${y}" x2="${W - t * BL}" y2="${y}" stroke="#ffffff" stroke-opacity=".05" stroke-width=".8"/>`; });
  [70, 110, 190, 230].map(x => VX + (x - 150) * kW).forEach(x => { s += `<line x1="${x}" y1="${H}" x2="${x + (VX - x) * S}" y2="${BB}" stroke="${Tm.ledBrilho}" stroke-opacity=".10" stroke-width="2.5" filter="url(#ev-led${U})"/>`; });
  // FITAS LED no teto, a convergir para a cúpula (brancas, com brilho)
  [-30, 30, 90, 210, 270, 330].map(x => VX + (x - 150) * kW).forEach(x => {
    const x2 = x + (VX - x) * S;
    s += `<line x1="${x}" y1="0" x2="${x2}" y2="${BT}" stroke="${Tm.ledBrilho}" stroke-width="4" opacity=".45" filter="url(#ev-led${U})"/>`;
    s += `<line x1="${x}" y1="0" x2="${x2}" y2="${BT}" stroke="${Tm.led}" stroke-width="1.4"/>`; });
  // fita LED a toda a volta da parede de fundo
  s += `<rect x="${BL}" y="${BT}" width="${BR - BL}" height="${BB - BT}" fill="${Tm.fundo}"/>`;
  s += `<line x1="${BL}" y1="${BT + 1}" x2="${BR}" y2="${BT + 1}" stroke="${Tm.led}" stroke-width="1.6"/>`;
  // CÚPULA iluminada com o emblema
  const rxE = Math.min(78 * kW, 112);
  s += `<ellipse cx="${VX}" cy="${yE.toFixed(1)}" rx="${rxE * 1.25}" ry="19" fill="${Tm.ledBrilho}" opacity=".25" filter="url(#pkh-brilho2)"/>`;
  s += `<ellipse cx="${VX}" cy="${yE.toFixed(1)}" rx="${rxE}" ry="15" fill="url(#ev-cupula${U})" stroke="${Tm.led}" stroke-width="1.5"/>`;
  s += logo
    ? `<g transform="translate(${VX},${yE.toFixed(1)}) scale(1.7,.62)"><image href="${pkhEsc(logo)}" x="-14" y="-15" width="28" height="30" preserveAspectRatio="xMidYMid meet"/></g>`
    : `<g transform="translate(${VX},${yE.toFixed(1)}) scale(1.7,.62)"><path d="M-10 -12 H10 V2 Q10 11 0 16 Q-10 11 -10 2 Z" fill="${cor.base}" stroke="#C9A227" stroke-width="1.4"/><text y="5" text-anchor="middle" font-size="11" font-weight="700" fill="${cor.texto}" font-family="Oswald, sans-serif">${pkhEsc(inicialClube)}</text></g>`;
  // CACIFOS nas duas paredes: nichos com luz branca por trás, camisola de
  // frente (em perspetiva) com o número, faixa LED por cima, chuteiras em baixo.
  const T6 = [0.0, 0.3, 0.5, 0.65, 0.77, 0.87, 0.95];
  // parede da esquerda: o cacifo do jogador é largo (está mais perto) e vêm depois três colegas
  const T6L = [0.0, 0.56];
  const decor = ['11', '7', '6', '3', '14', '10', '4', '23', '9', '2', '5', '17'].filter(n => n !== String(numero || ''));
  let nd = 0;
  const camisolaN = n => `<path d="M14 22 L38 10 Q50 20 62 10 L86 22 L98 44 L78 50 L78 98 L22 98 L22 50 L2 44 Z" fill="${cor.base}" stroke="${cor.contorno}" stroke-width="2"/><path d="M38 10 Q50 20 62 10" fill="none" stroke="${cor.mangas}" stroke-width="3"/><text x="50" y="80" text-anchor="middle" font-size="34" font-weight="700" fill="${cor.texto}" font-family="Oswald, sans-serif">${n}</text>`;
  const chuteira = '<path d="M0 10 Q2 2 10 2 L20 4 Q30 6 32 12 L32 14 L0 14 Z" fill="#0d0f0e"/><path d="M6 4 L18 5" stroke="#C9A227" stroke-width="2"/>';
  [false, true].forEach(dir => {
    const M = dir ? mir : (p => p);
    const rel = (a, b, v) => M(wp(a, v));
    // faixa LED por cima dos cacifos
    s += `<polygon points="${pts([wp(0, 0.06), wp(1, 0.06), wp(1, 0.085), wp(0, 0.085)].map(M))}" fill="${Tm.led}" opacity=".9"/>`;
    s += `<polygon points="${pts([wp(0, 0.05), wp(1, 0.05), wp(1, 0.1), wp(0, 0.1)].map(M))}" fill="${Tm.ledBrilho}" opacity=".35" filter="url(#ev-led${U})"/>`;
    const TT = dir ? T6 : T6L;
    for (let i = 0; i < TT.length - 1; i++) {
      const meu = !dir && i === 0;
      const a = TT[i] + 0.015, b = TT[i + 1] - 0.015;
      // moldura escura do cacifo
      s += poly([wp(a - 0.01, 0.11), wp(b + 0.01, 0.11), wp(b + 0.01, 0.74), wp(a - 0.01, 0.74)].map(M), Tm.moldura);
      // nicho iluminado
      const n4 = [wp(a, 0.13), wp(b, 0.13), wp(b, 0.62), wp(a, 0.62)].map(M);
      if (meu) s += `<polygon points="${pts(n4)}" fill="none" stroke="#FFC23D" stroke-width="6" opacity="${apagado ? (apagado === 'presenca' ? .18 : 0) : .5}" filter="url(#pkh-brilho)"/>`;
      s += poly(n4, meu ? `url(#ev-nichoJ${U})` : `url(#ev-nicho${U})`, meu ? '#FFD86A' : Tm.led, meu ? 1.8 : 0.9);
      // camisola (os colegas; a do jogador vai à parte, maior)
      if (!meu) {
        const ia = a + (b - a) * 0.14, ib = b - (b - a) * 0.14;
        const p00 = dir ? M(wp(ib, 0.17)) : wp(ia, 0.17), p10 = dir ? M(wp(ia, 0.17)) : wp(ib, 0.17), p01 = dir ? M(wp(ib, 0.56)) : wp(ia, 0.56);
        s += aff(p00, p10, p01, camisolaN(decor[nd++ % decor.length]));
      }
      // chuteiras no fundo do cacifo
      const ca = a + (b - a) * 0.2, cb = b - (b - a) * 0.2;
      const c00 = dir ? M(wp(cb, 0.645)) : wp(ca, 0.645), c10 = dir ? M(wp(ca, 0.645)) : wp(cb, 0.645), c01 = dir ? M(wp(cb, 0.7)) : wp(ca, 0.7);
      s += aff(c00, c10, c01, '<ellipse cx="28" cy="60" rx="22" ry="34" fill="#0b0d0c"/><rect x="14" y="35" width="26" height="9" fill="#C9A227"/><ellipse cx="72" cy="60" rx="22" ry="34" fill="#0b0d0c"/><rect x="60" y="35" width="26" height="9" fill="#C9A227"/>');
    }
    // ASSENTO estofado contínuo à frente dos cacifos (escuro, com risca da cor da equipa)
    const A = M(wp(0, 0.8)), B = M(wp(1, 0.8)), sg = dir ? -1 : 1;
    const A2 = [A[0] + sg * 32, A[1] + 18], B2 = [B[0] + sg * 6, B[1] + 3];
    s += `<polygon points="${pts([A2, B2, [B2[0] + sg * 3, B2[1] + 10], [A2[0] + sg * 12, A2[1] + 30]])}" fill="#000" opacity=".35" filter="url(#pkh-brilho)"/>`;
    s += poly([A, B, B2, A2], Tm.assento);
    s += `<line x1="${((A[0] + A2[0]) / 2).toFixed(1)}" y1="${((A[1] + A2[1]) / 2).toFixed(1)}" x2="${((B[0] + B2[0]) / 2).toFixed(1)}" y2="${((B[1] + B2[1]) / 2).toFixed(1)}" stroke="${cor.base}" stroke-width="2.2"/>`;
    s += poly([A2, B2, [B2[0], B2[1] + 6], [A2[0], A2[1] + 10]], Tm.assentoFrente);
    s += `<line x1="${A2[0].toFixed(1)}" y1="${(A2[1] + 10).toFixed(1)}" x2="${B2[0].toFixed(1)}" y2="${(B2[1] + 6).toFixed(1)}" stroke="${Tm.ledBrilho}" stroke-opacity=".5" stroke-width="1" filter="url(#ev-led${U})"/>`;
  });
  // O lugar do jogador: camisola pendurada de frente + retrato por cima.
  const gancho = wp((T6L[0] + T6L[1]) / 2, 0.40); // = 0.19 no telemóvel, como antes
  const zoom = Math.min(1.25, 1 + (kW - 1) * 0.35); // 1 no telemóvel
  const cx = gancho[0] + 9 * zoom, cy = gancho[1] - 1, ry = gancho[1] - 22 * zoom, rr = 16 * zoom;
  // Telemóveis baixos: a fotografia e a camisola sobem/encolhem para
  // caberem INTEIRAS (nunca se corta a camisola do jogador).
  const eJog = tv && tv.jogador ? tv.jogador : 1;
  const topoJog = ry - rr - 4;
  s += `<g transform="translate(${cx.toFixed(1)},${topoJog.toFixed(1)}) scale(${eJog.toFixed(3)}) translate(${(-cx).toFixed(1)},${(-topoJog).toFixed(1)})">`;
  s += `<ellipse cx="${cx.toFixed(1)}" cy="${(cy + 4).toFixed(1)}" rx="30" ry="52" fill="#FFC23D" opacity="${apagado ? (apagado === 'presenca' ? .1 : 0) : .32}" filter="url(#pkh-brilho2)"/>`;
  s += `<g transform="translate(${(cx - 22 * zoom).toFixed(1)},${cy.toFixed(1)}) scale(${(0.44 * zoom).toFixed(3)})">${camisolaFrente}</g>`;
  s += `<circle cx="${cx.toFixed(1)}" cy="${(ry + 1.5).toFixed(1)}" r="${rr + 3}" fill="#000" opacity=".35"/>`;
  s += `<g transform="translate(${cx.toFixed(1)},${ry.toFixed(1)}) scale(${rr / 50})">`;
  s += foto
    ? `<rect x="-50" y="-50" width="100" height="100" fill="#cfd9d1" clip-path="url(#pkh-retrato)"/><image href="${pkhEsc(foto)}" x="-50" y="-50" width="100" height="100" preserveAspectRatio="xMidYMin slice" clip-path="url(#pkh-retrato)"/>`
    : `<circle r="50" fill="#1A2A1F"/><text y="17" text-anchor="middle" font-size="${iniciais.length > 2 ? 34 : 46}" font-weight="600" fill="#FFD86A" font-family="Oswald, sans-serif">${pkhEsc(iniciais)}</text>`;
  s += '<circle r="50" fill="none" stroke="#FFD86A" stroke-width="7"/></g>';
  s += '</g>';
  if (apagado) s += `<rect x="0" y="0" width="${W}" height="${H}" fill="#000" opacity="${apagado === 'presenca' ? .38 : .5}"/>`;
  if (apagado) {
    // Com as luzes apagadas, a TV do Portal é a única luz: um brilho verde-frio no chão e nas paredes.
    /* Gradiente radial que se desvanece até zero (sem bordas): o desfoque
       antigo deixava uma mancha de contorno visível, sobretudo no
       telemóvel, onde a sala estica na vertical. Mais ténue no telemóvel. */
    const fT = W <= 300 ? 0.8 : 1;
    s += `<defs><radialGradient id="pkh-tvluz${U}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#9fe0bf" stop-opacity="${(0.13 * fT).toFixed(3)}"/><stop offset=".45" stop-color="#9fe0bf" stop-opacity="${(0.05 * fT).toFixed(3)}"/><stop offset="1" stop-color="#9fe0bf" stop-opacity="0"/></radialGradient></defs>`;
    s += `<ellipse cx="${VX}" cy="${(BB + 10).toFixed(1)}" rx="${(W * 0.42).toFixed(1)}" ry="${Math.min((H - BB) * 0.6, 60).toFixed(1)}" fill="url(#pkh-tvluz${U})"/>`;
    s += `<ellipse cx="${VX}" cy="${((BT + BB) / 2).toFixed(1)}" rx="${((BR - BL) * 0.75).toFixed(1)}" ry="${((BB - BT) * 0.75).toFixed(1)}" fill="url(#pkh-tvluz${U})"/>`;
  }
  // A TV da análise = a entrada do Portal.
  // `tv` (telemóveis baixos): a TV sobe e encolhe o necessário para o botão
  // "Entrar no Portal" caber por baixo dela, sem a tapar.
  const tvTopo = tv ? tv.topo : BT + 8 + (H - 215) * 0.25;
  const tvEscala = zoom * (tv ? tv.escala : 1);
  s += `<g transform="translate(${VX - 150},${tvTopo - 46}) translate(150,46) scale(${tvEscala.toFixed(3)}) translate(-150,-46)">`;
  s += '<rect x="84" y="46" width="132" height="78" rx="3" fill="none" stroke="#FFC23D" stroke-width="2" opacity=".8"/>';
  s += '<rect x="88" y="50" width="124" height="70" rx="2" fill="#07090a"/>';
  s += '<rect x="91" y="53" width="118" height="13" fill="#0d120f"/><text x="150" y="63.3" text-anchor="middle" font-size="10" font-weight="600" fill="#C9A227" font-family="Oswald, sans-serif" letter-spacing="1.4">PORTAL DO ATLETA</text>';
  // TV parada: só a tática, sem rodapé a correr nem jogadores a mexer.
  s += '<rect x="91" y="66" width="118" height="51" fill="#24563a"/>';
  [0, 1, 2].forEach(i => { s += `<rect x="${91 + i * 40}" y="66" width="20" height="51" fill="#2a6142"/>`; });
  s += '<g stroke="#fff" stroke-width=".7" fill="none" opacity=".6"><line x1="150" y1="66" x2="150" y2="117"/><circle cx="150" cy="91" r="7"/></g>';
  s += '<path d="M112 96 Q132 80 156 78" fill="none" stroke="#fff" stroke-width="1" stroke-dasharray="3 2"/><path d="M152 75.5 L157 78 L153 81" fill="none" stroke="#fff" stroke-width="1"/>';
  s += '<path d="M128 74 L170 92" fill="none" stroke="#FFC23D" stroke-width="1" stroke-dasharray="3 2"/>';
  s += `<circle cx="112" cy="96" r="3" fill="${cor.base}" stroke="#fff" stroke-width=".7"/><circle cx="128" cy="74" r="3" fill="${cor.base}" stroke="#fff" stroke-width=".7"/>`;
  s += `<circle cx="186" cy="80" r="3" fill="${cor.base}" stroke="#fff" stroke-width=".7"/><circle cx="196" cy="94" r="3" fill="#f2ede0"/><circle cx="178" cy="98" r="3" fill="#f2ede0"/>`;
  // Porta da entrada do Portal: a TV dá as boas-vindas ao jogador.
  if (boasVindas) {
    // Num grupo próprio: na chegada pela porta, a página inicial desvanece-o
    // (classe pkh-boasvindas) para a TV passar suavemente ao Portal do Atleta.
    s += `<g class="pkh-boasvindas">`
      + `<rect x="88" y="50" width="124" height="70" rx="2" fill="#0d1a12"/>`
      + `<rect x="88" y="50" width="124" height="70" rx="2" fill="${cor.base}" opacity=".35"/>`
      + `<text x="150" y="80" text-anchor="middle" font-size="13" font-weight="600" fill="#FFC23D" font-family="Oswald, sans-serif" letter-spacing="3">BEM-VINDO,</text>`
      + `<text x="150" y="104" text-anchor="middle" font-size="${String(boasVindas).length > 9 ? 16 : 22}" font-weight="600" fill="#fff" font-family="Oswald, sans-serif" letter-spacing="2">${pkhEsc(String(boasVindas).toUpperCase())}!</text>`
      + `</g>`;
  }
  if (badge > 0) s += `<circle cx="212" cy="49" r="7" fill="#E5484D" stroke="#07090a" stroke-width="1.5"/><text x="212" y="52.6" text-anchor="middle" font-size="10" font-weight="700" fill="#fff" font-family="JetBrains Mono, monospace">${badge > 9 ? '9+' : badge}</text>`;
  s += '</g>';
  return s;
}

/* FAIXAS LATERAIS (só em ecrã largo): o mesmo fundo do ecrã inteiro da
   missão — marcas de giz brancas, quase transparentes, a subir devagar e a
   rodar —, aqui com objetos de futebol desenhados a giz (chuteiras, bolas,
   braçadeiras, meias, balizas, apitos, cones, troféus, camisolas) entre as
   cruzes, círculos e setas. Sem cor, como na missão e na credencial. Ficam
   só nas faixas que sobram: nunca passam por cima do conteúdo. Com
   "reduzir movimento", ficam parados onde estão. */
const PKH_OBJETOS = ['bola', 'chuteira', 'luvas', 'x', 'bracadeira', 'meia', 'caneleira', 'seta', 'baliza', 'calcoes', 'apito', 'o', 'garrafa', 'cronometro', 'trofeu', 'camisola', 'bandeirola', 'medalha', 'cone'];
function PkhObjeto({ tipo, tam }) {
  if (tipo === 'bola') return <BolaFutebol tamanho={tam} />;
  const desenho = {
    x: <><line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" /></>,
    o: <circle cx="12" cy="12" r="8" />,
    seta: <><path d="M4 18 Q10 6 19 7" /><path d="M14 4 L19 7 L15.5 11.5" /></>,
    cone: <><path d="M12 3 L18 19 L6 19 Z" /><path d="M8.6 12.5 L15.4 12.5" /><path d="M4 21 L20 21" /></>,
    chuteira: <><path d="M2 15 Q2.5 11 6 10.5 L11 9.5 Q13 7 15 7 L17 7 Q18 10.5 20.5 12 Q23 13.5 22.5 16 L22.5 17 L2.5 17 Q1.6 16.5 2 15 Z" /><path d="M10 12 L14.5 9.6 M12 13.6 L16.5 11.2" /><path d="M4.5 19.5 h1 M9 19.5 h1 M14.5 19.5 h1 M19 19.5 h1" /></>,
    bracadeira: <><path d="M2 9 Q12 6 22 9 L22 15 Q12 18 2 15 Z" /><path d="M14 10.6 Q12.2 9.7 10.8 10.6 Q9.4 12 10.8 13.4 Q12.2 14.3 14 13.4" /></>,
    meia: <><path d="M9 2 H15 V13 Q15 15 16.5 16 L20 18 Q22.5 20 20.5 21.8 Q19 22.8 16.5 21.6 L9.6 18.4 Q8.4 17.6 8.8 15.8 Z" /><path d="M9 5 H15" /></>,
    baliza: <><path d="M3 19 V6 H21 V19" /><path d="M1 19 H23" /><path d="M7.5 6 V19 M12 6 V19 M16.5 6 V19 M3 10.5 H21 M3 15 H21" strokeWidth="1" opacity=".7" /></>,
    apito: <><path d="M9 9.5 H21 V13.5 H13.5" /><circle cx="9" cy="14" r="5" /><circle cx="9" cy="14" r="1.2" /><path d="M6 4 Q2.5 6.5 5.5 9.5" /></>,
    trofeu: <><path d="M7 3 H17 V9 Q17 14 12 14.5 Q7 14 7 9 Z" /><path d="M7 5 Q3 5 4 8.5 Q5 11 7.5 10.5 M17 5 Q21 5 20 8.5 Q19 11 16.5 10.5" /><path d="M12 14.5 V18 M9 18 H15 V21 H9 Z" /></>,
    camisola: <path d="M7.5 3 L4 5 L2 10 L5 11 V21 H19 V11 L22 10 L20 5 L16.5 3 Q12 6 7.5 3 Z" />,
    luvas: <><path d="M7 21 V12 L5 9.5 Q4 8 5.5 7.3 L8 9.5 V4.5 Q8 3 9.3 3 Q10.6 3 10.6 4.5 V9 M10.6 4 Q10.6 2.5 11.9 2.5 Q13.2 2.5 13.2 4 V9 M13.2 4.5 Q13.2 3 14.5 3 Q15.8 3 15.8 4.5 V9.5 M15.8 6 Q15.8 4.8 17 4.8 Q18.2 4.8 18.2 6 V14 Q18.2 18 15 19 V21 Z" /><path d="M7 17.5 H15.5" /></>,
    caneleira: <><path d="M8 3 Q12 1.5 16 3 L17 17 Q12 22.5 7 17 Z" /><path d="M10 7.5 H14 M10.5 11 H13.5" /></>,
    calcoes: <><path d="M4 4 H20 L21.5 19 H14 L12 11 L10 19 H2.5 Z" /><path d="M4 7 H20" /></>,
    garrafa: <><path d="M10 2 H14 V4 L15.5 6.5 V21 H8.5 V6.5 L10 4 Z" /><path d="M8.5 11 H15.5 M8.5 15 H15.5" /></>,
    cronometro: <><circle cx="12" cy="13.5" r="7.5" /><path d="M12 13.5 L15 10.5 M10 2.5 H14 M12 2.5 V6 M18.3 6.2 L19.8 4.7" /></>,
    bandeirola: <><path d="M6 22 V2" /><path d="M6 3 L18.5 6.5 L6 10" /><path d="M3 22 H10" /></>,
    medalha: <><path d="M8 2 L12 9 L16 2" /><circle cx="12" cy="15" r="6" /><path d="M12 12.4 L12.9 14.3 L15 14.5 L13.4 15.9 L13.9 18 L12 16.9 L10.1 18 L10.6 15.9 L9 14.5 L11.1 14.3 Z" strokeWidth="1.2" /></>,
  }[tipo];
  return (
    <svg viewBox="0 0 24 24" width={tam} height={tam} aria-hidden="true">
      <g fill="none" stroke={T.giz} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{desenho}</g>
    </svg>
  );
}

/* As marcas de giz das faixas laterais são as MESMAS em todos os ecrãs do
   Portal (balneário, cacifo…) e o movimento segue o relógio: ao passar de
   um ecrã para o outro continuam exatamente onde estavam, em vez de
   saltarem para posições novas (antes eram sorteadas a cada ecrã). */
const PKH_FAIXAS_ITENS = (() => {
  let semente = 20261017;
  const rnd = () => { semente = (semente * 16807) % 2147483647; return (semente - 1) / 2147483646; };
  return [0, 1].flatMap(lado => Array.from({ length: 17 }, (_, k) => ({
    lado, k,
    tipo: PKH_OBJETOS[(k + lado * 9) % PKH_OBJETOS.length],
    left: 6 + rnd() * 70,
    y: rnd() * 100,
    tam: Math.round(24 + rnd() * 26),
    dur: 18 + rnd() * 14,
    rot: Math.round(rnd() * 360),
    op: 0.12 + rnd() * 0.14,
  })));
})();
function PkhFaixasLaterais({ larguraConteudo }) {
  const itens = PKH_FAIXAS_ITENS;
  // Fase de cada marca a partir do relógio (igual em qualquer ecrã que a desenhe).
  const t0 = React.useMemo(() => Date.now() / 1000, []);
  const larg = `calc((100vw - ${larguraConteudo}) / 2)`;
  return (
    <>
      {[0, 1].map(lado => (
        <div key={lado} aria-hidden="true" style={{
          position: 'absolute', top: 0, bottom: 0, [lado ? 'right' : 'left']: 0, width: larg,
          overflow: 'hidden', pointerEvents: 'none',
        }}>
          {itens.filter(i => i.lado === lado).map(i => (
            <div key={i.k} style={{
              position: 'absolute', left: `${i.left}%`, top: `${i.y}vh`, lineHeight: 0,
              opacity: i.tipo === 'bola' ? i.op + 0.08 : i.op,
              '--y': `${i.y}vh`, '--rot': `${i.rot}deg`,
              // atraso negativo = cada marca já começa a meio do caminho
              animation: `pkh-subir ${i.dur.toFixed(1)}s linear ${(-(((108 - i.y) / 120) * i.dur + t0) % i.dur).toFixed(2)}s infinite`,
            }}>
              <PkhObjeto tipo={i.tipo} tam={i.tam} />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

/* Ecrã largo = computador (ou tablet deitado). Aí a página alarga-se e
   aparecem as faixas laterais; no telemóvel fica tudo como estava. */
const PKH_LARGO = '(min-width: 1000px) and (min-aspect-ratio: 5/4)';
const PKH_LARGURA_LARGA = 'min(41vw, 820px)';
/* Tablet ao alto (iPad na vertical): largo o suficiente para não ficar
   espremido na coluna do telemóvel (460), mas sem as faixas laterais do
   computador. */
const PKH_TABLET_ALTO = '(min-width: 700px) and (max-aspect-ratio: 5/4)';
const PKH_LARGURA_TABLET = 'min(88vw, 720px)';
// Imagens do balneário (emblema, fotografia) já carregadas, por endereço.
// Ao reconstruir o SVG, a <image> nova é trocada pela antiga, que já está
// descodificada e pinta logo, em vez de aparecer só um frame depois.
const PKH_IMG_MEM = new Map();
function pkhReusarImagens(raiz) {
  if (!raiz) return;
  raiz.querySelectorAll('image').forEach(nova => {
    const href = nova.getAttribute('href') || nova.getAttribute('xlink:href');
    if (!href) return;
    const velha = PKH_IMG_MEM.get(href);
    if (!velha || velha === nova) { PKH_IMG_MEM.set(href, nova); return; }
    if (velha.isConnected) return;
    try {
      Array.from(velha.attributes).forEach(at => { if (at.name !== 'href' && at.name !== 'xlink:href' && !nova.hasAttribute(at.name)) velha.removeAttribute(at.name); });
      Array.from(nova.attributes).forEach(at => { if (at.name !== 'href' && at.name !== 'xlink:href') velha.setAttribute(at.name, at.value); });
      nova.replaceWith(velha);
    } catch (e) { PKH_IMG_MEM.set(href, nova); }
  });
}
// Último enquadramento medido do balneário: ao voltar ao ecrã inicial já
// desenha no tamanho certo, sem reajuste no segundo frame.
const PKH_ENQ_MEM = { v: null };
function usePkhMedia(q) {
  const [largo, setLargo] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false));
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const m = window.matchMedia(q);
    const f = () => setLargo(m.matches);
    f();
    if (m.addEventListener) m.addEventListener('change', f); else m.addListener(f);
    return () => { if (m.removeEventListener) m.removeEventListener('change', f); else m.removeListener(f); };
  }, [q]);
  return largo;
}

function PlayerKioskHome({ player, equipa, session, selectedDate, doneWellness, doneRpe, wellnessWindow, rpeWindow, onOpenWellness, onOpenRpe, onOpenPortal, onLogout, tarefasPendentes, mensagensMister, diasSequenciaChama }) {
  const isToday = selectedDate === todayStr();
  const isRestDay = !!(session && session.phase === 'Descanso');
  const W = CHECKIN_WINDOWS.wellness, P = CHECKIN_WINDOWS.rpe;
  const agora = new Date();
  const mins = agora.getHours() * 60 + agora.getMinutes();
  const hora = fmtMinutesOfDay(mins);

  const wWin = wellnessWindow || { open: true, reason: '' };
  const rWin = rpeWindow || { open: true, reason: '' };
  const wellnessEnabled = wWin.open && !doneWellness;
  const rpeEnabled = rWin.open && !!session && !isRestDay && !doneRpe;

  // Estados e textos dos dois botões (mesmas regras de sempre).
  const wEstado = doneWellness ? 'feito' : wellnessEnabled ? 'aberto' : 'fechado';
  const wTexto = doneWellness ? 'Golo! Respondido'
    : wellnessEnabled ? `Responder · até ${fmtMinutesOfDay(W.endMin)}`
      : !isToday ? 'Só no próprio dia'
        : mins < W.startMin ? `Abre às ${fmtMinutesOfDay(W.startMin)}` : 'Fechou · fala com o staff';
  const pEstado = doneRpe ? 'feito' : rpeEnabled ? 'aberto' : 'fechado';
  const pTexto = doneRpe ? 'Golo! Respondido'
    : isRestDay ? 'Folga · sem PSE'
      : rpeEnabled ? `Responder · até ${fmtMinutesOfDay(P.endMin)}`
        : !isToday ? 'Só no próprio dia'
          : mins < P.startMin ? `Abre às ${fmtMinutesOfDay(P.startMin)}`
            : mins > P.endMin ? 'Fechou · fala com o staff'
              : 'Ainda sem sessão para hoje';

  // A linha de cima do placard: a parte do dia e o que falta.
  const legenda = !isToday ? 'DIA JÁ FECHADO · SÓ HOJE'
    : mins < W.startMin ? `ESTÁDIO FECHADO · ABRE ÀS ${fmtMinutesOfDay(W.startMin)}`
      : mins <= W.endMin ? (doneWellness ? '1.ª PARTE · JÁ MARCASTE' : '1.ª PARTE')
        : mins < P.startMin ? (isRestDay ? 'FOLGA · SEM 2.ª PARTE' : `INTERVALO · 2.ª PARTE ÀS ${fmtMinutesOfDay(P.startMin)}`)
          : isRestDay ? 'FOLGA · SEM 2.ª PARTE'
            : doneRpe ? '2.ª PARTE · JÁ MARCASTE'
              : mins > P.endMin ? `FIM DO DIA · VOLTA ÀS ${fmtMinutesOfDay(W.startMin)}`
                : !session ? '2.ª PARTE · AINDA SEM SESSÃO'
                  : '2.ª PARTE';

  /* A frase da chama só aparece quando faz falta: a sequência está em risco
     (Wellness por responder e menos de 2 h para fechar) ou bate um número
     redondo (10, 20, 30…) depois de responder. */
  const dias = diasSequenciaChama || 0;
  const fraseChama = (isToday && wellnessEnabled && dias > 0 && mins >= W.endMin - 120)
    ? `O Wellness fecha às ${fmtMinutesOfDay(W.endMin)}. Responde para manteres ${dias === 1 ? 'o dia seguido' : `os ${dias} dias seguidos`}.`
    : (isToday && doneWellness && dias > 0 && dias % 10 === 0)
      ? `${dias} dias seguidos! ${mensagemChamaDoDia(todayStr())}`
      : '';
  const pendente = wellnessEnabled || rpeEnabled;
  const nomeCompleto = String((player && player.name) || '').trim();
  const primeiro = nomeCompleto ? nomeCompleto.split(/\s+/)[0] : 'Atleta';
  const iniciais = nomeCompleto ? nomeCompleto.split(/\s+/).filter(Boolean).map(p => p[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join('').toUpperCase() : '?';
  const numero = player && player.number != null && String(player.number).trim() !== '' ? String(player.number).trim() : '';
  const cor = coresCamisola(T.corEquipa);
  const clube = String((equipa && (equipa.clube || equipa.nome)) || '').trim();
  const nBadge = (tarefasPendentes || []).length;
  /* ENQUADRAMENTO DO BALNEÁRIO. O desenho tem 300×215 e o espaço que
     sobra no ecrã muda de telemóvel para telemóvel. Cortar sempre ao
     centro levava o teto (e o emblema) nos ecrãs mais largos do que
     altos. Aqui mede-se o espaço e escolhe-se a janela: a faixa que
     interessa (do emblema, em cima, até à camisola do jogador) fica
     sempre à vista; o que sobra corta-se no chão. */
  const largo = usePkhMedia(PKH_LARGO);
  const tablet = usePkhMedia(PKH_TABLET_ALTO);
  // Letra maior só se também houver altura (portáteis baixos ficam com os
  // tamanhos do telemóvel, para tudo caber sem cortar o balneário).
  const g = usePkhMedia('(min-height: 820px)') && (largo || tablet);
  const balRef = useRef(null);
  const [enq, setEnqBase] = useState(() => PKH_ENQ_MEM.v || { W: 300, H: 215, vb: '0 0 300 215' });
  const setEnq = f => setEnqBase(prev => { const n = f(prev); PKH_ENQ_MEM.v = n; return n; });
  /* CHEGADA PELA PORTA: o balneário começa no tamanho e no sítio da porta
     e cresce até ao lugar dele; o resto do ecrã aparece logo a seguir. */
  const [chegada] = useState(() => entradaRecente());
  const [faseChegada, setFaseChegada] = useState(chegada ? 'inicio' : 'fim');
  useEffect(() => {
    if (!chegada) return undefined;
    const fim = () => setFaseChegada('fim');
    window.addEventListener('mjp-entrada-fim', fim);
    const seguranca = setTimeout(fim, 4000);
    return () => { window.removeEventListener('mjp-entrada-fim', fim); clearTimeout(seguranca); };
  }, [chegada]);
  const aparecer = undefined;
  React.useLayoutEffect(() => {
    const el = balRef.current;
    if (!el) return undefined;
    const calcular = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      // Ecrã largo: a sala alarga-se (até 780) em vez de se cortar.
      const W = (largo || tablet) ? Math.round(Math.max(300, Math.min(780, (215 * w) / h))) : 300;
      const alturaVisivel = (W * h) / w;
      // Mais alto do que o desenho: a sala estica na vertical (até 420) —
      // nada se corta dos lados e a TV continua ao centro.
      const novo = alturaVisivel >= 215
        ? { W, H: Math.round(Math.min(420, alturaVisivel)), vb: `0 0 ${W} ${Math.round(Math.min(420, alturaVisivel))}` }
        : {
          W, H: 215,
          // Espaço baixo (não cabe do emblema à camisola): o teto fica
          // sempre inteiro e corta-se só o chão.
          vb: `0 ${(alturaVisivel < 162 ? 3 : Math.max(0, Math.min(215 - alturaVisivel, 84 - alturaVisivel / 2))).toFixed(1)} ${W} ${alturaVisivel.toFixed(1)}`,
        };
      /* O botão "Entrar no Portal" fica SEMPRE ao centro, em baixo, por
         baixo da TV e do rodapé. Se não houver espaço (telemóveis baixos),
         a TV sobe e encolhe o necessário — nunca é o botão a mudar de sítio. */
      novo.tv = null;
      if (alturaVisivel < 215) {
        const y0 = Number(novo.vb.split(' ')[1]);
        const unidadesBotao = (46 * alturaVisivel) / h; // ~31 px de botão + margens
        const limite = y0 + alturaVisivel - unidadesBotao;
        const fundoTv = 47.5 + 8 + 78; // fundo natural da TV no desenho
        const fundoVisivel = y0 + alturaVisivel - 3;
        const jogador = fundoVisivel < 153 ? Math.max(0.55, (fundoVisivel - 48) / (153 - 48)) : 1;
        if (limite < fundoTv || jogador < 1) {
          const topo = limite < fundoTv ? 49.5 : 47.5 + 8;
          const escala = limite < fundoTv ? Math.max(0.55, Math.min(1, (limite - topo) / 78)) : 1;
          novo.tv = { topo, escala, jogador };
        }
      }
      const tvChave = t => (t ? `${t.topo}:${t.escala.toFixed(3)}:${t.jogador.toFixed(3)}` : '');
      setEnq(prev => (prev.W === novo.W && prev.H === novo.H && prev.vb === novo.vb && tvChave(prev.tv) === tvChave(novo.tv) ? prev : novo));
    };
    calcular();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', calcular);
      return () => window.removeEventListener('resize', calcular);
    }
    const ro = new ResizeObserver(calcular);
    ro.observe(el);
    return () => ro.disconnect();
  }, [largo, tablet]);
  const luzesApagadas = isToday && mins < W.startMin;
  const svgBalneario = React.useMemo(() => pkhBalneario({
    cor, numero, nome: primeiro, foto: (player && player.photo) || '', iniciais,
    logo: (equipa && equipa.logo) || '', inicialClube: clube ? clube[0].toUpperCase() : '', badge: nBadge,
    /* Vindo da porta: a TV dá as boas-vindas enquanto o balneário cresce e,
       já com o ecrã inteiro, desvanece-se e deixa ver o Portal do Atleta
       (antes era um corte seco). O desenho não muda no fim — só a
       opacidade do grupo, por CSS — para a transição poder correr. */
    boasVindas: chegada ? primeiro : '',
    apagado: luzesApagadas ? 'presenca' : false,
  }, enq.W, enq.H, enq.tv), [luzesApagadas, T.corEquipa, numero, primeiro, player && player.photo, iniciais, equipa && equipa.logo, clube, nBadge, enq.W, enq.H, enq.tv && enq.tv.escala, enq.tv && enq.tv.jogador, chegada]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Emblema no teto e fotografia: reaproveita as mesmas imagens já
     carregadas da visita anterior, para aparecerem no primeiro frame ao
     voltar ao ecrã inicial (uma imagem nova só pinta um frame depois). */
  const svgBalRef = useRef(null);
  React.useLayoutEffect(() => { pkhReusarImagens(svgBalRef.current); }, [svgBalneario]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1, background: T.bg, overflow: 'hidden', overscrollBehavior: 'none',
      touchAction: 'manipulation', ...body,
    }}>
      <style>{PKH_CSS}</style>
      {chegada && <style>{`.pkh-boasvindas { transition: opacity .7s ease-in-out .35s; opacity: ${faseChegada === 'fim' ? 0 : 1}; }`}</style>}
      {largo && <PkhFaixasLaterais larguraConteudo={PKH_LARGURA_LARGA} />}
      <div style={{
        position: 'relative', height: '100%', maxWidth: largo ? PKH_LARGURA_LARGA : tablet ? PKH_LARGURA_TABLET : 460, margin: '0 auto',
        display: 'flex', flexDirection: 'column', gap: g ? 12 : 8, boxSizing: 'border-box',
        padding: largo
          ? `calc(${g ? 20 : 12}px + env(safe-area-inset-top, 0px)) 0 calc(${g ? 18 : 10}px + env(safe-area-inset-bottom, 0px))`
          : tablet
            ? 'calc(22px + env(safe-area-inset-top, 0px)) 24px calc(18px + env(safe-area-inset-bottom, 0px))'
            : 'calc(14px + env(safe-area-inset-top, 0px)) 14px calc(12px + env(safe-area-inset-bottom, 0px))',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexShrink: 0, ...aparecer }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...display, fontSize: g ? 30 : 22, fontWeight: 600, color: T.cream, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{greetingNow()}, {primeiro}!</div>
            <div style={{ fontSize: g ? 14 : 12, color: T.mutedDim }}>{dataDeHojeExtenso()}</div>
          </div>
          <button type="button" onClick={onLogout} title="Terminar sessão" style={{
            display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: `1px solid ${T.line}`,
            borderRadius: 8, color: T.mutedDim, padding: g ? '8px 14px' : '6px 10px', cursor: 'pointer', ...body, fontSize: g ? 13.5 : 11.5, flexShrink: 0,
          }}>
            <LogOut size={g ? 15 : 13} /> Sair
          </button>
        </div>

        {/* O JOGO DO DIA — placard fino colado ao campo; cada metade do
            campo é o botão do questionário. */}
        <div style={{ flexShrink: 0, ...aparecer }}>
          <PkhPlacard hora={hora} golosW={doneWellness ? 1 : 0} golosP={doneRpe ? 1 : 0} dias={dias} g={g} />
          <PkhCampo
            /* Da meia-noite até abrir o Wellness (06:30) está tudo fechado:
               as luzes do estádio apagam-se (e as do balneário ficam só com
               a luz de presença). */
            apagado={luzesApagadas}
            wEstado={wEstado} wTexto={wTexto} pEstado={pEstado} pTexto={pTexto} semSegunda={isRestDay}
            onWellness={onOpenWellness} onPse={onOpenRpe} g={g} largo={largo}
          />
        </div>

        <PkhMister mensagens={mensagensMister} g={g} estilo={aparecer} />

        {fraseChama && (
          <div style={{ ...aparecer, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7, fontSize: g ? 14 : 12, color: T.muted, lineHeight: 1.3, padding: '0 2px', ...body }}>
            <Flame size={g ? 17 : 15} color={T.gold} style={{ flexShrink: 0 }} />
            <span>{fraseChama}</span>
          </div>
        )}

        {/* BALNEÁRIO — a entrada do Portal (sempre disponível, sem janela horária). */}
        <button ref={balRef} data-entrada-foco="1" type="button" onClick={onOpenPortal} aria-label="Entrar no Portal do Atleta" style={{
          flex: 1, minHeight: g ? 160 : 96, position: 'relative', borderRadius: 12, overflow: 'hidden', border: `1px solid ${T.line}`,
          background: '#121614', padding: 0, cursor: 'pointer', display: 'block', width: '100%',
        }}>
          <svg
            viewBox={enq.vb} preserveAspectRatio="xMinYMid slice" width="100%" height="100%"
            style={{ display: 'block', position: 'absolute', inset: 0 }} aria-hidden="true" ref={svgBalRef}
            dangerouslySetInnerHTML={{ __html: svgBalneario }}
          />
          <span style={{ position: 'absolute', left: 0, right: 0, bottom: enq.tv ? 6 : 9, display: 'flex', justifyContent: 'center' }}>
            <span style={{
              background: pendente ? 'rgba(13,18,15,.82)' : T.goldFundo, color: pendente ? '#F2EDE0' : '#1A2A1F',
              border: `1.5px solid ${T.goldFundo}`, borderRadius: 999, padding: g ? '10px 22px' : enq.tv ? '6px 15px' : '7px 16px', fontSize: g ? 16 : 13.5, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6, animation: pendente ? 'none' : 'pkh-pulso 2s ease-in-out infinite', ...body,
            }}>
              <Play size={14} fill={pendente ? T.goldFundo : '#1A2A1F'} color={pendente ? T.goldFundo : '#1A2A1F'} /> Entrar
            </span>
          </span>
        </button>
      </div>
    </div>
  );
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


/* VISUALIZADOR DE VÍDEO DO PORTAL (YouTube e redes sociais).

   Abre por cima de tudo, com o vídeo o maior possível e um botão de ecrã
   inteiro sempre visível. O ecrã inteiro é pedido à CAIXA (não ao
   iframe), por isso funciona também nos clipes. Onde o browser não deixa
   pôr uma caixa em ecrã inteiro (iPhone), a caixa ocupa o ecrã por CSS.

   CLIPES: nunca se sai do corte. Sem controlos do YouTube (que deixavam
   percorrer e repetir o jogo inteiro), com a barra da app limitada ao
   corte; ao chegar ao fim volta sozinho ao início e continua a tocar,
   sempre no mesmo corte (a mesma lógica da página pública do corte).

   LUPA: em ecrã inteiro dá para aproximar com dois dedos, roda do rato
   ou os botões + e −, e arrastar a imagem; um toque pausa/retoma. */
function VisualizadorVideoPortal({ item, onClose }) {
  const caixaRef = useRef(null);
  const areaRef = useRef(null);
  const iframeRef = useRef(null);
  const [cheio, setCheio] = useState(false);     // ecrã inteiro do browser
  const [cheioCss, setCheioCss] = useState(false); // alternativa por CSS
  const emCheio = cheio || cheioCss;

  const ehYt = !!item.youtubeId;
  const ehClipe = ehYt && typeof item.clipInicio === 'number' && typeof item.clipFim === 'number' && item.clipFim > item.clipInicio;
  const inicio = ehClipe ? Math.max(0, item.clipInicio) : 0;
  const fim = ehClipe ? item.clipFim : 0;
  const duracao = fim - inicio;

  const [tempo, setTempo] = useState(inicio);
  const [aTocar, setATocar] = useState(false);
  const [aArrastarBarra, setAArrastarBarra] = useState(null); // posição durante o arrasto
  const saltoRef = useRef(0);

  const lupa = useLupa(areaRef, ehYt && emCheio);

  const comando = (func, args) => {
    const win = iframeRef.current && iframeRef.current.contentWindow;
    if (win) win.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*');
  };
  const irPara = (seg) => {
    const alvo = ehClipe ? Math.min(fim - 0.2, Math.max(inicio, seg)) : seg;
    saltoRef.current = Date.now();
    comando('seekTo', [alvo, true]);
    setTempo(alvo);
  };
  const alternarPlay = () => comando(aTocar ? 'pauseVideo' : 'playVideo');

  // Mensagens do leitor: estado (a tocar/pausa) e tempo. Num clipe, ao
  // passar o fim (ou se por algum motivo saltar para fora), volta ao
  // início do corte e continua.
  useEffect(() => {
    if (!ehYt) return undefined;
    const aoMsg = (event) => {
      if (!event.origin || !event.origin.includes('youtube.com')) return;
      const win = iframeRef.current && iframeRef.current.contentWindow;
      if (win && event.source !== win) return;
      let data = event.data;
      try { data = typeof data === 'string' ? JSON.parse(data) : data; } catch (e) { return; }
      if (!data) return;
      if (data.event === 'onStateChange' && typeof data.info === 'number') {
        setATocar(data.info === 1 || data.info === 3);
        // Terminou (estado 0) dentro de um clipe: recomeça o corte.
        if (ehClipe && data.info === 0) { irPara(inicio); comando('playVideo'); }
      }
      if (data.event === 'infoDelivery' && data.info) {
        if (typeof data.info.playerState === 'number') setATocar(data.info.playerState === 1 || data.info.playerState === 3);
        const t = data.info.currentTime;
        if (typeof t === 'number') {
          if (!ehClipe) { setTempo(t); return; }
          const aSaltar = Date.now() - saltoRef.current < 800;
          if (!aSaltar && (t >= fim - 0.15 || t < inicio - 0.5)) { irPara(inicio); comando('playVideo'); }
          else setTempo(Math.min(fim, Math.max(inicio, t)));
        }
      }
    };
    window.addEventListener('message', aoMsg);
    return () => window.removeEventListener('message', aoMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehYt, ehClipe, inicio, fim]);

  const aoCarregar = () => {
    if (!ehYt) return;
    const win = iframeRef.current && iframeRef.current.contentWindow;
    if (win) win.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
  };

  // Ao fechar com o ecrã inteiro ligado, sai primeiro dele.
  const fechar = () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (e) { /* nada */ }
    onClose();
  };
  // Gesto de retroceder no Portal: sai do ecrã inteiro ou fecha.
  useKioskVoltar(true, () => { if (cheioCss) setCheioCss(false); else fechar(); });

  useEffect(() => {
    const aoMudar = () => {
      const el = document.fullscreenElement || document.webkitFullscreenElement;
      setCheio(!!el && el === caixaRef.current);
    };
    document.addEventListener('fullscreenchange', aoMudar);
    document.addEventListener('webkitfullscreenchange', aoMudar);
    const aoTecla = (e) => { if (e.key === 'Escape' && !document.fullscreenElement) { if (cheioCss) setCheioCss(false); else onClose(); } };
    window.addEventListener('keydown', aoTecla);
    return () => {
      document.removeEventListener('fullscreenchange', aoMudar);
      document.removeEventListener('webkitfullscreenchange', aoMudar);
      window.removeEventListener('keydown', aoTecla);
    };
  }, [cheioCss, onClose]);

  const alternarEcra = () => {
    if (cheio) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      return;
    }
    if (cheioCss) { setCheioCss(false); return; }
    const el = caixaRef.current;
    const pedir = el && (el.requestFullscreen || el.webkitRequestFullscreen);
    if (pedir) {
      try {
        const r = pedir.call(el);
        if (r && typeof r.catch === 'function') r.catch(() => setCheioCss(true));
      } catch (e) { setCheioCss(true); }
    } else {
      setCheioCss(true);
    }
  };

  // O endereço não muda enquanto o visualizador está aberto (senão o
  // vídeo recomeçava). `fs=0`: o ecrã inteiro é sempre o nosso, com lupa.
  const fonte = React.useMemo(() => {
    if (!ehYt) return socialEmbedSrc(item.social);
    const bits = [`rel=0`, `playsinline=1`, `enablejsapi=1`, `fs=0`, `autoplay=1`, `iv_load_policy=3`];
    if (ehClipe) bits.push(`start=${Math.floor(inicio)}`, 'controls=0', 'disablekb=1');
    return `https://www.youtube.com/embed/${item.youtubeId}?${bits.join('&')}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);
  const externo = ehYt ? `https://www.youtube.com/watch?v=${item.youtubeId}` : socialExternalUrl(item.social);
  const vertical = !!item.social;

  const btn = { background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 };
  const posBarra = aArrastarBarra != null ? aArrastarBarra : Math.max(0, tempo - inicio);

  return createPortal(
    <div
      onClick={fechar}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'max(12px, env(safe-area-inset-top, 0px)) 12px max(12px, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div
        ref={caixaRef}
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex', flexDirection: 'column', background: '#000', overflow: 'hidden',
          ...(emCheio
            ? { position: cheioCss ? 'fixed' : 'relative', inset: cheioCss ? 0 : undefined, zIndex: 9001, width: cheioCss ? '100vw' : '100%', height: cheioCss ? '100dvh' : '100%', borderRadius: 0, paddingBottom: cheioCss ? 'env(safe-area-inset-bottom, 0px)' : 0, boxSizing: 'border-box' }
            : {
                width: vertical ? 'min(100%, calc((100dvh - 160px) * 0.5625))' : 'min(100%, 1280px, calc((100dvh - 160px) * 1.7778))',
                borderRadius: 12, border: `1px solid ${T.line}`,
              }),
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
          background: '#111', borderBottom: `1px solid ${T.line}`, flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, color: T.cream, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...body }}>
              {item.title || item.fileName || 'Vídeo'}
            </div>
            {item.jornada && <div style={{ fontSize: 11.5, color: T.mutedDim, ...body }}>{item.jornada}</div>}
          </div>
          <button onClick={alternarEcra} title={emCheio ? 'Sair de ecrã inteiro' : 'Ecrã inteiro'} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#fff', ...body,
            background: 'rgba(255,255,255,.08)', border: `1px solid ${T.line}`, borderRadius: 8, padding: '7px 11px', cursor: 'pointer', flexShrink: 0,
          }}>
            {emCheio ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {emCheio ? 'Sair' : 'Ecrã inteiro'}
          </button>
          <button onClick={fechar} aria-label="Fechar" title="Fechar" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, flexShrink: 0,
            background: 'rgba(255,255,255,.08)', border: `1px solid ${T.line}`, borderRadius: 8, color: '#fff', cursor: 'pointer',
          }}><X size={16} /></button>
        </div>

        <div ref={areaRef} style={{
          position: 'relative', overflow: 'hidden',
          ...(emCheio ? { flex: 1, minHeight: 0 } : { paddingTop: vertical ? '177.78%' : '56.25%' }),
        }}>
          {fonte ? (
            <div style={{
              position: 'absolute', inset: 0,
              transform: lupa.transform || 'none', transformOrigin: '0 0',
              transition: lupa.aArrastar ? 'none' : 'transform 0.2s ease-out',
            }}>
              <iframe
                ref={iframeRef}
                onLoad={aoCarregar}
                src={fonte}
                title={item.title || 'vídeo'}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                playsInline
                sandbox={item.social && item.social.platform === 'instagram' ? INSTAGRAM_SANDBOX : undefined}
              />
            </div>
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.mutedDim, fontSize: 13 }}>
              Não foi possível abrir este vídeo aqui.
            </div>
          )}
          {/* Clipe fora do ecrã inteiro: um toque no vídeo pausa/retoma
              (o leitor sem controlos não deixa sair do corte). */}
          {ehClipe && !emCheio && (
            <div onClick={alternarPlay} style={{ position: 'absolute', inset: 0, zIndex: 4, cursor: 'pointer' }} />
          )}
          {/* LUPA em ecrã inteiro: camada que apanha a pinça, a roda e o
              arrastar; um toque pausa/retoma. Num vídeo completo, a 100%,
              deixa livre a faixa de baixo com a barra do YouTube. */}
          {ehYt && emCheio && (
            <div {...lupa.handlers(alternarPlay)} style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              bottom: !ehClipe && lupa.lupa.z <= 1 ? '18%' : 0,
              zIndex: 5, touchAction: 'none',
              cursor: lupa.lupa.z > 1 ? (lupa.aArrastar ? 'grabbing' : 'grab') : 'pointer',
            }} />
          )}
          {ehYt && emCheio && <ControlosLupa {...lupa} />}
        </div>

        {/* BARRA DO CLIPE: só anda dentro do corte. */}
        {ehClipe && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#111', borderTop: `1px solid ${T.line}`, flexShrink: 0 }}>
            <button onClick={alternarPlay} title={aTocar ? 'Pausar' : 'Reproduzir'} style={btn}>
              {aTocar ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button onClick={() => irPara(inicio)} title="Voltar ao início do corte" style={btn}><RotateCcw size={16} /></button>
            <input
              type="range" min={0} max={duracao} step={0.1} value={posBarra}
              onChange={e => { const v = Number(e.target.value); setAArrastarBarra(v); irPara(inicio + v); }}
              onPointerUp={() => setAArrastarBarra(null)}
              onTouchEnd={() => setAArrastarBarra(null)}
              onKeyUp={() => setAArrastarBarra(null)}
              aria-label="Posição no corte"
              style={{ flex: 1, minWidth: 0, accentColor: T.gold, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 12, color: '#fff', whiteSpace: 'nowrap', flexShrink: 0, ...mono }}>
              {fmtMMSS(posBarra)} / {fmtMMSS(duracao)}
            </span>
          </div>
        )}

        {externo && !emCheio && !ehClipe && (
          <div style={{ padding: '8px 12px', background: '#111', borderTop: `1px solid ${T.line}`, flexShrink: 0 }}>
            <a href={externo} target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: T.mutedDim, textDecoration: 'none', ...body,
            }}><ExternalLink size={12} /> Abrir original</a>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
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


// "Os meus clipes" (só no Portal) é um cartão dentro de Jogos, não uma secção.

/* OS MEUS VÍDEOS (Portal do Atleta) — juntar clipes num vídeo só.

   O jogador escolhe clipes seus (de um jogo ou de vários), põe-nos pela
   ordem que quer, dá um nome, e "Ver" reproduz tudo seguido — o mesmo
   mecanismo do "Ver cortes em seguida": no fim de um clipe passa sozinho
   ao seguinte, mesmo que seja de outro jogo.

   Não se cria um ficheiro novo: os clipes são cortes de vídeos do
   YouTube, e o vídeo junto é a LISTA deles, por ordem. Fica guardado
   neste aparelho (no browser), por jogador e por equipa. */
function hashCurto(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
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


// Ecrã do questionário (Wellness/RPE) para os atletas, acedido pelo link
// partilhado (?checkin=1) — não passa pelo portão de login do treinador:
// carrega só os dados de que precisa (jogadores, sessões, monitorização) e
// autentica cada atleta pelo código pessoal de 4 dígitos dentro do próprio
// CheckinKiosk.
/* O quiosque NÃO lê tabelas.

   Toda a informação passa por duas funções no Supabase (ver
   checkin_rpc.sql): `checkin_bootstrap` valida o código e devolve só o
   jogador, as sessões recentes e os registos DESSE jogador;
   `checkin_save` grava, verificando no servidor de quem é o registo e se
   o dia está dentro da janela.

   Isto substitui o useCollectionSync sobre `players`, `sessions` e
   `monitoring`, que obrigava a ter políticas `anon` de leitura sobre
   essas tabelas — e portanto punha o plantel inteiro e os dados de saúde
   de todos os atletas ao alcance de quem extraísse a chave pública do
   site. O código de 4 dígitos deixa de ser um filtro no browser e passa
   a ser uma credencial verificada na base de dados. */
/* O PORTAL COMO APP NO TELEMÓVEL. Só nas páginas do Portal (não na
   plataforma do staff): liga o manifesto e o ícone, guarda o evento de
   instalação do Chrome e regista um service worker mínimo (só passa os
   pedidos à rede — não guarda nada em cache).
   DOIS MUNDOS:
   · Chrome/Edge (Android e computador): recebem o manifesto, que tem de
     ter start_url para o navegador oferecer "Instalar" direto. O ícone
     abre "/?origem=portal-icone" e aqui redireciona-se para o Portal da
     última equipa (a app instalada partilha a memória com o navegador).
   · iPhone/iPad: NÃO recebem o manifesto — o Safari usaria o start_url e
     o ícone (com memória separada do Safari) não saberia qual é o Portal.
     Sem manifesto, o iOS guarda o endereço exato da página (?portal=…).  Os ficheiros manifest.webmanifest,
   icone-192.png, icone-512.png, apple-touch-icon.png e sw.js vivem na
   pasta public/ do projeto. */
const PORTAL_ULTIMO = 'mjp-portal-ultimo';
(function prepararPortalInstalavel() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  try {
    /* DUAS APPS NO MESMO ENDEREÇO. O Portal do Atleta vive em /portal/ e a
       plataforma do staff em /. Cada uma tem o seu manifesto, com o seu
       "scope": assim o Chrome trata-as como duas apps diferentes, e o
       "Abrir na app" da plataforma deixa de abrir a janela do Portal.
       Links antigos (/?portal=…, já partilhados e impressos) continuam a
       funcionar: passam para /portal/?portal=… sem recarregar. */
    const naPastaPortal = /^\/portal(\/|$)/.test(window.location.pathname);
    let q = new URLSearchParams(window.location.search);
    if (q.get('origem') === 'portal-icone' && !q.has('portal')) {
      const ultimo = localStorage.getItem(PORTAL_ULTIMO);
      /* Antes fazia-se location.replace: a página carregava DUAS vezes e,
         entre uma e outra, aparecia por instantes o ecrã da plataforma do
         staff. Agora só se reescreve o endereço, sem recarregar: isto corre
         antes de a app desenhar o primeiro ecrã, por isso ela já arranca
         diretamente no Portal. */
      if (ultimo) {
        window.history.replaceState(null, '', `/portal/?portal=${encodeURIComponent(ultimo)}`);
        q = new URLSearchParams(window.location.search);
      }
    }
    const ehPortal = naPastaPortal || q.has('portal') || q.has('checkin') || /portal=|checkin/.test(window.location.hash);
    const ehAppleCedo = /iphone|ipad|ipod/i.test(navigator.userAgent || '') || (/macintosh/i.test(navigator.userAgent || '') && navigator.maxTouchPoints > 1);
    if (!ehPortal) {
      /* A PLATAFORMA VIVE EM /app/. No telemóvel (Android), uma app com
         scope "/" engolia o Portal (que está dentro de "/"): instalar uma
         dava "já instalada" na outra e abria sempre a última usada. Com
         /app/ e /portal/ separados, cada uma é dona só do seu caminho.
         Só se muda a plataforma em si (endereço sem "?…"): as páginas
         públicas de partilha (?clipe=, ?video=, ?junto=…) e os regressos
         do login ficam como estão. */
      const naPastaApp = /^\/app(\/|$)/.test(window.location.pathname);
      if (!naPastaApp && !window.location.search) {
        window.history.replaceState(null, '', `/app/${window.location.hash}`);
      }
      // Plataforma do staff: o seu próprio manifesto ("MisterJP", scope /app/),
      // para se poder instalar à parte do Portal.
      if (!ehAppleCedo && !document.querySelector('link[rel="manifest"]')) {
        const m = document.createElement('link');
        m.setAttribute('rel', 'manifest'); m.setAttribute('href', '/staff.webmanifest');
        document.head.appendChild(m);
      }
      // O Chrome só oferece "Instalar" com um service worker a controlar a
      // página. O do Portal está limitado a /portal/, por isso a plataforma
      // regista o seu (o mesmo sw.js, que só passa os pedidos à rede).
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/app/' }).catch(() => { /* sem service worker: continua tudo a funcionar */ });
      return;
    }
    if (!naPastaPortal) {
      window.history.replaceState(null, '', `/portal/${window.location.search}${window.location.hash}`);
    }
    // Fundo verde desde o primeiro instante: sem clarão branco no arranque e
    // sem faixa branca à direita (o espaço reservado à barra de scroll fica
    // da mesma cor do resto, enquanto os ecrãs ainda carregam).
    const estiloBase = document.createElement('style');
    estiloBase.textContent = `html, body { background: ${T.bg} !important; }`;
    document.head.appendChild(estiloBase);
    const junta = (tag, attrs) => {
      const el = document.createElement(tag);
      Object.keys(attrs).forEach(k => el.setAttribute(k, attrs[k]));
      document.head.appendChild(el);
    };
    const ehApple = /iphone|ipad|ipod/i.test(navigator.userAgent || '') || (/macintosh/i.test(navigator.userAgent || '') && navigator.maxTouchPoints > 1);
    if (!ehApple && !document.querySelector('link[rel="manifest"]')) junta('link', { rel: 'manifest', href: '/portal.webmanifest' });
    // A página da raiz traz o ícone da plataforma: no Portal troca-se pelo do Portal.
    document.querySelectorAll('link[rel="apple-touch-icon"], link[rel="icon"]').forEach(l => l.remove());
    junta('link', { rel: 'icon', type: 'image/png', href: '/icone-192.png' });
    junta('link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' });
    junta('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
    junta('meta', { name: 'mobile-web-app-capable', content: 'yes' });
    junta('meta', { name: 'apple-mobile-web-app-title', content: 'Portal' });
    junta('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' });
    junta('meta', { name: 'theme-color', content: '#182619' });
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      window.__mjpInstalar = e;
      window.dispatchEvent(new Event('mjp-instalavel'));
    });
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/portal/' }).catch(() => { /* sem service worker: continua tudo a funcionar */ });
  } catch (e) { /* nada disto é essencial */ }
})();

function CheckinApp() {
  const [codigo, setCodigo] = useState(null);
  const [dados, setDados] = useState(null); // { player, sessions, monitoring }
  const [erro, setErro] = useState('');

  /* A EQUIPA VEM NO LINK.

     O código de 4 dígitos só é único dentro de um plantel — nunca foi um
     identificador do mundo inteiro, apesar de estar a ser usado como tal.
     Com clubes diferentes na mesma base, dois acabam com o mesmo código e
     um atleta abriria o questionário de um miúdo de outro clube.

     Cada equipa tem por isso o seu link, com `&e=<id>`. Links antigos, já
     partilhados, vêm sem ele: nesse caso o servidor ainda procura o
     código em todo o lado, mas RECUSA se encontrar mais do que um. Quem
     já tem o link continua a responder; ninguém cai no clube errado. */
  /* A identidade visível da equipa (nome do clube e logótipo), lida a
     partir do id que vem no link. Não é informação sensível — quem tem o
     link já sabe de que clube é — mas a tabela `teams` não é legível sem
     sessão, por isso passa por uma função própria no servidor. */
  const [equipaRemota, setEquipa] = useState(null);

  const equipaDoLink = (() => {
    if (typeof window === 'undefined') return null;
    try {
      // Link novo: ?portal=<id-da-equipa> — o próprio valor já é o id,
      // não precisa de um "e=" à parte.
      // Um segundo "?" colado ao link (ex.: "?portal=ID?testejogo=dia")
      // estragava o id da equipa: corta-se no primeiro "?" ou "&".
      const p = (new URLSearchParams(window.location.search).get('portal') || '').split(/[?&#]/)[0];
      if (p) return p;
      // Link antigo (?checkin=1&e=<id-da-equipa>) — continua a funcionar,
      // para não partir nada que já tenha sido partilhado.
      const q = new URLSearchParams(window.location.search).get('e');
      if (q) return q;
      // Também se aceita no fragmento (#checkin&e=... ou #portal=...),
      // porque é assim que alguns clientes de email reescrevem os
      // endereços.
      const h = window.location.hash.replace('#', '');
      const mPortal = h.match(/(?:^|&)portal=([^&?]+)/);
      if (mPortal) return mPortal[1];
      const m = h.match(/(?:^|&)e=([^&]+)/);
      return m ? m[1] : null;
    } catch (e) { return null; }
  })();

  /* A resposta é normalizada antes de sair daqui, porque o mesmo `jsonb`
     pode chegar de três formas diferentes conforme a versão do PostgREST
     e do SDK: como objeto, como texto por interpretar, ou embrulhado num
     array de uma posição. Aceitar as três aqui evita que o resto do
     quiosque tenha de saber disto. */
  /* EMBLEMA E COR SEM ESPERAR. Pedir a identidade da equipa ao servidor
     demora uns segundos, e até lá a Receção mostrava o escudo provisório e
     depois trocava pelo emblema. Agora o telemóvel guarda a identidade da
     última visita (só o nome, o emblema e a cor — nada pessoal) e o Portal
     abre logo com ela; a resposta do servidor só a atualiza se mudou. */
  const chaveIdentidade = `mjp-equipa:${equipaDoLink || 'sem-equipa'}`;
  const [equipaGuardada] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem(chaveIdentidade) || 'null');
      if (v && v.cor) T.corEquipa = v.cor;
      return v;
    } catch (e) { return null; }
  });
  const equipa = equipaRemota || equipaGuardada;
  useEffect(() => {
    if (!equipaDoLink) return;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('checkin_equipa', { p_team: equipaDoLink });
        if (!error && data) {
          const eq = typeof data === 'string' ? JSON.parse(data) : data;
          // A cor do clube (a mesma das definições da equipa) também no
          // Portal — a camisola dos anos e afins vestem-se dela.
          if (eq && eq.cor) T.corEquipa = eq.cor;
          setEquipa(eq);
          try { localStorage.setItem(chaveIdentidade, JSON.stringify(eq)); } catch (e) { /* sem espaço: fica só nesta visita */ }
          try { localStorage.setItem(PORTAL_ULTIMO, equipaDoLink); } catch (e) { /* idem */ }
        }
      } catch (e) { /* sem identidade, o ecrã fica neutro — não é impeditivo */ }
    })();
  }, [equipaDoLink]); // eslint-disable-line react-hooks/exhaustive-deps

  const buscar = async (code) => {
    const pre = tirarPrebusca('checkin_bootstrap', code, equipaDoLink);
    const { data, error } = pre ? await pre : await supabase.rpc('checkin_bootstrap', {
      p_code: code, p_days: CHECKIN_DAYS_BACK, p_team: equipaDoLink,
    });
    if (error) throw error;

    let d = data;
    if (Array.isArray(d)) d = d[0];
    if (typeof d === 'string') {
      try { d = JSON.parse(d); } catch (e) { /* fica como está e falha a validação abaixo */ }
    }
    if (d === null || d === undefined) return null; // código não existe

    // Se chegou aqui e não tem jogador, a forma é inesperada: não se
    // segue em frente com dados incompletos (era isto que dava ecrã
    // branco, ao tentar ler `player.id` de um `undefined`).
    if (!d || typeof d !== 'object' || !d.player || !d.player.id) {
      const amostra = (() => { try { return JSON.stringify(data).slice(0, 300); } catch (e) { return String(data); } })();
      const err = new Error(`Resposta inesperada do servidor: ${amostra}`);
      err.__forma = true;
      throw err;
    }
    return d;
  };

  const entrar = async (code) => {
    setErro('');
    try {
      const d = await buscar(code);
      if (!d) return false; // código não existe
      // Saiu do clube (Data de saída até hoje): o acesso ao Portal termina.
      if (d.player && d.player.exitDate && d.player.exitDate <= todayStr()) {
        setErro('Este acesso terminou: o jogador já saiu do clube.');
        return 'saiu';
      }
      setCodigo(code);
      setDados(d);
      return true;
    } catch (e) {
      console.error('checkin_bootstrap', e);
      /* "Código ambíguo" é a única mensagem do servidor que o atleta pode
         resolver sozinho — pedindo o link certo. Vale a pena dizê-lo por
         palavras dele, em vez do erro genérico de ligação. */
      const ambiguo = /amb[íi]guo/i.test((e && e.message) || '');
      // Limite de tentativas do servidor (fase 1 da segurança): a mensagem
      // já vem pronta a mostrar ("Demasiadas tentativas. Tenta outra vez…").
      const bloqueado = /tentativas|cart[ãa]o de atleta/i.test((e && e.message) || '');
      setErro(bloqueado
        ? e.message
        : ambiguo
        ? 'Este link não diz de que equipa és. Pede ao treinador o link da tua equipa.'
        : (e && e.__forma
          ? e.message
          : 'Não foi possível ligar. Verifica a internet e tenta outra vez.'));
      return false;
    }
  };

  const sair = () => { setCodigo(null); setDados(null); };

  /* Grava e volta a buscar. O recarregar é de propósito: garante que o
     ecrã mostra o que ficou REALMENTE na base de dados, e não uma versão
     otimista que pode não corresponder (por exemplo se o servidor tiver
     recusado o dia por estar fora da janela). */
  const guardar = async (type, fields, date) => {
    setErro('');
    try {
      const { data: resp, error } = await supabase.rpc('checkin_save', {
        p_code: codigo, p_date: date, p_type: type, p_fields: fields,
        p_days: CHECKIN_DAYS_BACK, p_team: equipaDoLink,
      });
      if (error) throw error;
      // Com o código inválido o servidor já não dá erro (para a tentativa
      // errada ficar registada no limite de tentativas): responde
      // { ok: false }. Isso NÃO é uma gravação — trata-se como falha.
      let r = resp;
      if (Array.isArray(r)) r = r[0];
      if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { /* fica como está */ } }
      if (r && typeof r === 'object' && r.ok === false) throw new Error(r.erro || 'Código inválido');
      const d = await buscar(codigo);
      if (d) setDados(d);
      return true; // confirmação real de que ficou gravado
    } catch (e) {
      console.error('checkin_save', e);
      setErro(/tentativas/i.test((e && e.message) || '')
        ? e.message
        : 'A resposta não ficou guardada. Tenta outra vez ou fala com o staff.');
      return false; // quem chamou (WellnessWizard/RpeWizard/ComposicaoWizard)
      // usa isto para NÃO mostrar "Registado" nem voltar sozinho ao
      // início — sem isto, o atleta via sempre o ecrã de sucesso, quer a
      // gravação tivesse mesmo acontecido quer não.
    }
  };

  const moldura = (conteudo) => (
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
        input:focus, select:focus, textarea:focus { border-color: ${T.gold} !important; }
        /* Lista nativa das caixas de escolha (ex.: a nota nas Presenças): sem
           isto, em alguns Windows/Chrome abria BRANCA com o texto claro por
           cima — parecia um "flash" branco vazio. */
        select { color-scheme: ${TEMA_ATUAL === 'claro' ? 'light' : 'dark'}; }
        select option, select optgroup { background-color: ${T.surface}; color: ${T.cream}; } @keyframes mjpEntrar { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
        /* Reserva sempre o espaço da barra de scroll vertical, mesmo
           quando o conteúdo é curto e não precisa dela. Sem isto, uma
           página curta (Portal do Atleta) fica sem barra e uma mais
           comprida (Treino) ganha uma — o conteúdo salta uns pixéis
           para o lado ao trocar de página, porque a largura disponível
           muda. Só afeta desktop (a maioria dos browsers de telemóvel
           já usa uma barra sobreposta, que não ocupa espaço nenhum). */
        html { scrollbar-gutter: stable; }
        /* O espaço da barra fica com a cor da app — nunca uma faixa branca. */
        html, body { background: ${T.bg}; }
      `}</style>
      {erro && (
        <div style={{
          background: T.fundoErro, border: `1px solid ${T.bad}`, color: T.cream,
          fontSize: 13, padding: '10px 14px', textAlign: 'center',
          // O ecrã inicial é fixo (ocupa o ecrã todo): o aviso fica por cima dele.
          position: 'relative', zIndex: 70,
        }}>{erro}</div>
      )}
      {conteudo}
    </div>
  );

  if (!dados) return moldura(
    <>
      <PortalEntrada entrar={entrar} equipa={equipa} teamId={equipaDoLink} />
    </>
  );

  return moldura(
    <CheckinKiosk
      player={dados.player}
      monitoring={dados.monitoring || []}
      sessions={dados.sessions || []}
      diagnostico={{ chavesRecebidas: Object.keys(dados || {}) }}
      onSave={guardar}
      onLogout={sair}
      code={codigo}
      teamId={equipaDoLink}
      equipa={equipa}
    />
  );
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
