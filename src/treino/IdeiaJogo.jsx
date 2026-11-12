// treino/IdeiaJogo.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { stepElements, stepStaticArrows, viewBoxSemBancos, aspetoSemBancos, ESTICAR_IMPRESSAO_MEIO, VistaCampo, PitchMarkings, DiagramElements } from '../tatico/campo';
import { useIsMobile, EmptyState, Btn, trocarJanela, removeWithUndo, itemLabel, SectionHeader } from '../base/ui';
import { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check, Plus, Eye, Pencil, Trash2, X, BookOpen, EyeOff, Share2, Printer, Clock } from 'lucide-react';
import { T, mono, body, T_ESCURO, display } from '../base/tema';
import { ToggleBtn } from '../base/ui-extra';
import { todayStr, fmtDate, uid, timeAgo } from '../base/utilidades';
import { jogoNaoJogado } from '../dominio/estadoJogos';
import { competitionLabel } from '../dominio/jogos';
import { NotasDoJogo } from '../competicao/Escalacao';
import { imprimirComNome } from '../base/impressao';
import { momentoTexto, temMomento } from '../dominio/treino';
import { buildShareableHtmlDoc, shareOrDownloadHtml } from '../base/partilha';
import { createPortal } from 'react-dom';
import { CARTAO_ASPECT, DiagramThumbAnimado, SpaceZonesReadOnly, buildDiagramBlockHtml } from './diagramas';
import { EXERCISE_PHASES, MomentoFilter, PHASES, RotulosMomento, ideiaNoPlano, ideiaParaJogo, planoFaseDe, planoNomeJogo, planoProximoJogo, useRodaDoRato } from './comum';
import { ChipBtn } from '../base/botoes';
import { HistoryModal, useDetailBack } from '../base/historico';
import { ESTILO_BOTAO_PEQUENO, ICONE_BOTAO_PEQUENO } from '../plantel/Prancheta';
import { IdeiaModal } from './IdeiaModal';
import { ExercisePresentation } from './ExercisePresentation';

/* ---------------------------------------------------------------
   IDEIA DE JOGO — biblioteca de esquemas táticos do modelo de jogo.

   Usa exatamente o mesmo método de introdução dos Exercícios (o mesmo
   editor 2D, com animação gravada, importação de um registo existente
   e apresentação passo a passo), mas com muito menos campos: aqui só
   existem a FASE DE JOGO e o ESQUEMA TÁTICO. Não há nome, duração,
   espaço, descrição, nº de jogadores nem material — uma ideia de jogo
   não é um exercício de treino, é um princípio desenhado no campo.
---------------------------------------------------------------- */
/* ================================================================
   DOSSIER DE IDEIAS DE JOGO
   ================================================================

   Uma ideia de jogo isolada explica um momento. O dossier explica o
   modelo: todas as ideias juntas, pela ordem dos momentos de jogo, num
   documento que se imprime e se entrega.

   Duas decisões que valem a pena:

   ORDEM PELOS MOMENTOS, NÃO PELA DATA. As ideias aparecem agrupadas por
   fase e na ordem em que `PHASES` as declara — Organização Defensiva,
   Transição Ofensiva, Organização Ofensiva, Transição Defensiva, Bola
   Parada. É a ordem por que se pensa o jogo, e não a ordem por que
   calhou desenhá-las.

   SEQUÊNCIAS COMO TIRA DE IMAGENS. Uma animação em papel não existe. O
   que existe é a jogada partida em momentos: cada passo dá uma imagem,
   com as posições no início e as setas do que vai acontecer, e uma
   última com o resultado. Lê-se como uma banda desenhada, que é como um
   treinador explica no quadro. */

/* Os momentos de uma ideia, prontos a desenhar. Sem sequência gravada
   devolve uma imagem só.

   SÓ ENTRAM OS PASSOS COM SETAS. Um passo sem seta nenhuma não mostra
   movimento — é só uma posição parada, e uma sequência impressa é
   precisamente "o que se move e para onde"; sem isso, é só mais uma
   imagem igual à anterior a ocupar espaço na folha. Filtra-se primeiro
   e só depois se numeram os "Momento 1, 2, 3..." — senão ficavam
   buracos na numeração (1, 3, 4) sempre que um passo do meio fosse
   descartado, o que lê mal.

   O resultado final entra sempre, com ou sem seta: não é um passo, é
   para onde as setas do último passo apontam — sem ele a última imagem
   com setas nunca mostra onde a jogada chega. */
export function passosDaIdeia(diagram) {
  const seq = (diagram && diagram.sequence) || [];
  if (!seq.length) {
    return [{ elements: (diagram && diagram.elements) || [], arrows: (diagram && diagram.arrows) || [], rotulo: null }];
  }
  const comMovimento = seq
    .map(step => ({ elements: stepElements(step, diagram), arrows: stepStaticArrows(step, diagram) }))
    .filter(p => p.arrows.length > 0)
    .map((p, i) => ({ ...p, rotulo: `${i + 1}` }));
  // O estado final não é um passo: é onde a jogada acaba. Sem ele, a
  // última imagem mostra setas que nunca se vê chegar a lado nenhum.
  comMovimento.push({ elements: (diagram && diagram.elements) || [], arrows: [], rotulo: 'fim' });
  return comMovimento;
}

/* Uma ideia dentro do dossier: cabeçalho, descrição e a tira de imagens.
   `breakInside: avoid` para uma ideia não ficar cortada entre páginas —
   metade da jogada numa folha e metade noutra não se lê. */
export function IdeiaNoDossier({ ideia, numero }) {
  const passos = passosDaIdeia(ideia.diagram);
  const n = passos.length;
  /* IMPRESSÃO ARRUMADA:
     · 1 imagem → largura toda; 2–4 → duas por linha; 5 ou mais → três
       por linha (uma jogada de 12 imagens cabe numa folha, com imagens
       ainda legíveis);
     · flex com quebra de linha em vez de grelha — a grelha não se parte
       bem entre folhas em vários browsers (imagens cortadas ou
       sobrepostas); com flex, cada imagem passa inteira para a folha
       seguinte;
     · a ideia inteira só é "inquebrável" quando cabe numa folha (até 12
       imagens); acima disso parte-se entre imagens, nunca a meio de uma;
     · o título fica sempre agarrado às primeiras imagens. */
  const colunas = n <= 1 ? 1 : n <= 4 ? 2 : 3;
  const cabeNumaFolha = n <= 12;
  const largura = colunas === 1 ? '100%' : colunas === 2 ? 'calc(50% - 5px)' : 'calc(33.333% - 7px)';

  return (
    <div style={{ marginBottom: 22, ...(cabeNumaFolha ? { breakInside: 'avoid', pageBreakInside: 'avoid' } : {}) }}>
      <div style={{ breakAfter: 'avoid', pageBreakAfter: 'avoid', breakInside: 'avoid' }}>
        <h3 style={{ fontSize: 15, margin: '0 0 4px' }}>
          {numero}. {(ideia.name && ideia.name.trim()) || ideia.phase || 'Ideia de jogo'}
        </h3>
        {ideia.description ? (
          <p style={{ fontSize: 12, lineHeight: 1.55, margin: '0 0 8px' }}>{ideia.description}</p>
        ) : null}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {passos.map((p, i) => (
          <div key={i} style={{ width: largura, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
            <svg
              viewBox={viewBoxSemBancos(ideia.diagram && ideia.diagram.vista)}
              style={{
                width: '100%', aspectRatio: aspetoSemBancos(ideia.diagram && ideia.diagram.vista), display: 'block',
                background: '#fff', border: '1px solid #ccc', borderRadius: 6,
              }}
            >
              <VistaCampo esticar={ESTICAR_IMPRESSAO_MEIO} vista={ideia.diagram && ideia.diagram.vista}>
              <PitchMarkings printMode semBancos />
              <SpaceZonesReadOnly diagram={ideia.diagram} printMode />
              <DiagramElements elements={p.elements} arrows={p.arrows} interactive={false} printMode />
              </VistaCampo>
            </svg>
            {p.rotulo ? (
              <div style={{ fontSize: 10, color: '#777', marginTop: 2 }}>
                {p.rotulo === 'fim' ? 'Resultado' : `Momento ${p.rotulo}`}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* UMA LINHA DE CARTÕES (como no "Anexar exercício existente"): cabem
   tantos quantos a largura permite; o resto está nas setas, no gesto de
   deslizar ou na barra. A altura é sempre a de uma linha — trocar de
   momento ou de página não mexe a página. */
export function LinhaCartoes({ itens, renderItem, vazio }) {
  const isMobile = useIsMobile(700);
  const [pagina, setPagina] = useState(0);
  const [largura, setLargura] = useState(0);
  const roRef = useRef(null);
  const gridRef = useCallback((el) => {
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null; }
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => { setLargura(entries[0].contentRect.width); });
    ro.observe(el);
    roRef.current = ro;
  }, []);
  useEffect(() => () => { if (roRef.current) roRef.current.disconnect(); }, []);
  const GAP = 10;
  const MIN = isMobile ? 150 : 190;
  const porLinha = largura ? Math.max(2, Math.min(6, Math.floor((largura + GAP) / (MIN + GAP)))) : (isMobile ? 2 : 5);
  // Cartão a cartão (como no "Anexar exercício existente"): `pagina` é o
  // índice do 1.º cartão visível; as setas andam uma linha e a barra é um
  // polegar do tamanho do que se vê, arrastado suavemente.
  const total = Math.max(1, Math.ceil(itens.length / porLinha));
  const maxInicio = Math.max(0, itens.length - porLinha);
  const pag = Math.min(pagina, maxInicio);
  const daPagina = itens.slice(pag, pag + porLinha);
  const irParaInicio = (i) => setPagina(Math.max(0, Math.min(maxInicio, Math.round(i))));
  const irPara = (passo) => irParaInicio(pag + passo * porLinha);
  const toqueX = useRef(null);
  const barraRef = useRef(null);
  const arrastarRef = useRef(false);
  const agarreRef = useRef(0);
  const [arrastar, setArrastar] = useState(false);
  const fracPolegar = itens.length ? Math.min(1, porLinha / itens.length) : 1;
  const fracInicio = itens.length ? pag / itens.length : 0;
  const fracDoX = (clientX) => {
    const el = barraRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return (clientX - r.left) / r.width;
  };
  const rodaRef = useRodaDoRato((dir, soTestar) => {
    const pode = dir > 0 ? pag < maxInicio : pag > 0;
    if (pode && !soTestar) irParaInicio(pag + dir);
    return pode;
  });
  const seta = (dir) => {
    const off = dir < 0 ? pag === 0 : pag >= maxInicio;
    const Ic = dir < 0 ? ChevronLeft : ChevronRight;
    return (
      <button type="button" disabled={off} onClick={() => irPara(dir)} title={dir < 0 ? 'Anteriores' : 'Seguintes'} style={{
        width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        border: `1px solid ${T.line}`, background: off ? 'transparent' : T.surfaceRaise, color: off ? T.mutedDim : T.cream,
        cursor: off ? 'default' : 'pointer', opacity: off ? 0.4 : 1,
      }}><Ic size={16} /></button>
    );
  };
  return (
    <div ref={rodaRef} style={{ border: `1px solid ${T.line}`, borderRadius: 12, background: T.surface, padding: 10, overflowAnchor: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 10 }}>
        {seta(-1)}
        {/* Largura FIXA: "1–5 de 14" e "11–14 de 14" ocupam o mesmo
            espaço, por isso as setas não andam ao carregar nelas. */}
        <span style={{ ...mono, fontSize: 12, color: T.muted, width: 108, flexShrink: 0, textAlign: 'center', whiteSpace: 'nowrap' }}>
          {itens.length ? `${pag + 1}–${Math.min(itens.length, pag + porLinha)} de ${itens.length}` : '0'}
        </span>
        {seta(1)}
      </div>
      <div ref={gridRef}
        onTouchStart={e => { toqueX.current = e.touches[0].clientX; }}
        onTouchEnd={e => { if (toqueX.current == null) return; const dx = e.changedTouches[0].clientX - toqueX.current; toqueX.current = null; if (Math.abs(dx) > 40) irPara(dx < 0 ? 1 : -1); }}
        style={{ display: 'grid', gridTemplateColumns: `repeat(${porLinha}, minmax(0, 1fr))`, gap: GAP, minHeight: 200 }}>
        {itens.length === 0
          ? <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.mutedDim, fontSize: 13, textAlign: 'center', padding: 20, ...body }}>{vazio}</div>
          : daPagina.map(renderItem)}
      </div>
      {total > 1 && (
        /* BARRA ARRASTÁVEL: carregar ou arrastar para um lado e para o
           outro escolhe a página (zona de toque mais alta do que a
           barra, para se acertar à primeira). */
        <div ref={barraRef}
          onPointerDown={e => {
            e.preventDefault();
            arrastarRef.current = true; setArrastar(true);
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
            const f = fracDoX(e.clientX);
            agarreRef.current = (f >= fracInicio && f <= fracInicio + fracPolegar) ? f - fracInicio : fracPolegar / 2;
            irParaInicio((f - agarreRef.current) * itens.length);
          }}
          onPointerMove={e => { if (arrastarRef.current) irParaInicio((fracDoX(e.clientX) - agarreRef.current) * itens.length); }}
          onPointerUp={() => { arrastarRef.current = false; setArrastar(false); }}
          onPointerCancel={() => { arrastarRef.current = false; setArrastar(false); }}
          title="Arrasta para ver os outros"
          style={{ padding: '7px 0', marginTop: 5, cursor: arrastar ? 'grabbing' : 'pointer', touchAction: 'none', userSelect: 'none' }}>
          <div style={{ position: 'relative', height: 6, borderRadius: 3, background: T.bg }}>
            <div style={{
              position: 'absolute', top: arrastar ? -2 : 0, bottom: arrastar ? -2 : 0, borderRadius: 3, background: T.gold,
              left: `${fracInicio * 100}%`, width: `${Math.max(4, fracPolegar * 100)}%`,
              transition: arrastar ? 'none' : 'left .15s', cursor: arrastar ? 'grabbing' : 'grab',
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

/* Cartão de ideia (miniatura do esquema), usado no Portal e nos Planos. */
export function IdeiaCartaoMini({ x, nome, marcado, corMarca, textoMarca, onMarcar, onVer, extra }) {
  const temEsquema = !!(x.diagram && ((x.diagram.elements || []).length || (x.diagram.arrows || []).length));
  return (
    <div style={{
      background: T.surface, border: `${marcado ? 2 : 1}px solid ${marcado ? corMarca : T.line}`, borderRadius: 10,
      padding: marcado ? 7 : 8, display: 'flex', flexDirection: 'column', minWidth: 0,
    }}>
      <div onClick={onVer} title="Ver a ideia (com a animação)" style={{ cursor: 'pointer' }}>
        {temEsquema
          ? <DiagramThumbAnimado diagram={x.diagram} space={x.space} phase={x.phase} height={110} />
          : <div style={{ aspectRatio: CARTAO_ASPECT, marginBottom: 8, borderRadius: 6, background: '#1e3a24', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T_ESCURO.mutedDim, fontSize: 11 }}>Sem esquema</div>}
        <div style={{ color: T.cream, fontSize: 13, fontWeight: 500, lineHeight: '17px', height: 34, marginTop: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', ...body }}>{nome}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, minHeight: 28 }}>
        {onMarcar ? (
          <button type="button" onClick={onMarcar} style={{
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11.5, ...body, flexShrink: 0,
            color: marcado ? corMarca : T.mutedDim, background: 'none', border: `1px solid ${marcado ? corMarca : T.line}`, borderRadius: 20, padding: '3px 10px 3px 6px',
          }}>
            <span style={{
              width: 14, height: 14, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: marcado ? corMarca : 'transparent', border: `1px solid ${marcado ? corMarca : T.line}`,
            }}>{marcado && <Check size={10} color="#0d140e" />}</span>
            {textoMarca}
          </button>
        ) : null}
        <div style={{ flex: 1 }} />
        {extra}
      </div>
    </div>
  );
}

/* Separadores de momento com a contagem "marcadas/total". */
export function PlanoMomentos({ grupos, momento, onMomento, contaMarcadas }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
      {grupos.map(g => {
        const ativo = g.fase === momento;
        return (
          <button key={g.fase} type="button" onClick={() => onMomento(g.fase)} style={{
            padding: '7px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, ...body,
            background: ativo ? T.crimson : 'transparent', color: ativo ? '#fff' : T.muted,
            border: `1px solid ${ativo ? T.crimson : T.line}`,
          }}>
            {g.fase} <span style={{ ...mono, opacity: 0.8 }}>{contaMarcadas(g.lista)}/{g.lista.length}</span>
          </button>
        );
      })}
    </div>
  );
}

export const planoGrupos = (lista) => {
  const g = PHASES.map(fase => ({ fase, lista: lista.filter(x => planoFaseDe(x) === fase) })).filter(x => x.lista.length);
  const sem = lista.filter(x => planoFaseDe(x) === 'Sem fase');
  if (sem.length) g.push({ fase: 'Sem fase', lista: sem });
  return g;
};

/* ---------- Portal do Atleta: Ideia de Jogo | Plano de Jogo ----------
   Os dois destinos do Portal, cada um no seu separador:
     · Ideia de Jogo — as ideias GERAIS, escolhidas momento a momento;
     · Plano de Jogo — um plano por jogo (o do próximo jogo é o que os
       jogadores veem; quando o jogo passa, sai sozinho). */
export function PortalAtletaIdeias({ ideias, todasIdeias, setIdeias, matches, labelOf, onBack, onVer, planos }) {
  const [aba, setAba] = useState(planos && planos.aberto ? 'plano' : 'ideia');
  const grupos = planoGrupos(ideias);
  const [momento, setMomento] = useState(grupos[0] ? grupos[0].fase : null);
  const atual = grupos.find(g => g.fase === momento) || grupos[0] || null;
  // `prev =>`: nunca escrever por cima de um eco do Realtime mais recente.
  const alternar = (id) => setIdeias(prev => prev.map(x => (x.id === id ? { ...x, visivelAtletas: !x.visivelAtletas } : x)));
  const alternarMomento = (lista) => {
    const todas = lista.every(i => i.visivelAtletas);
    const ids = new Set(lista.map(i => i.id));
    setIdeias(prev => prev.map(x => (ids.has(x.id) ? { ...x, visivelAtletas: !todas } : x)));
  };
  return (
    <div style={{ overflowAnchor: 'none' }}>
      {/* UM SÓ "VOLTAR", que muda conforme onde se está: dentro de um
          plano volta aos Planos de Jogo; no resto, volta à Ideia de Jogo. */}
      {(() => {
        const dentroDePlano = aba === 'plano' && planos && planos.aberto;
        return (
          <button onClick={() => (dentroDePlano ? planos.setAberto(null) : onBack())} style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
            borderRadius: 8, color: T.cream, padding: '7px 13px', cursor: 'pointer', ...body, fontSize: 13, marginBottom: 16,
          }}>
            <ChevronLeft size={15} /> {dentroDePlano ? 'Planos de Jogo' : 'Ideia de Jogo'}
          </button>
        );
      })()}
      <div style={{ ...display, fontSize: 20, color: T.cream, marginBottom: 12 }}>Portal do Atleta</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <ToggleBtn active={aba === 'ideia'} onClick={() => { setAba('ideia'); if (planos) planos.setAberto(null); }}>Ideia de Jogo</ToggleBtn>
        <ToggleBtn active={aba === 'plano'} onClick={() => setAba('plano')}>Plano de Jogo</ToggleBtn>
      </div>

      {aba === 'plano' ? (
        <PlanosDeJogo ideias={todasIdeias || ideias} setIdeias={setIdeias} matches={matches} labelOf={labelOf}
          aberto={planos ? planos.aberto : null} setAberto={planos ? planos.setAberto : () => {}}
          onVer={onVer} onNovaParaJogo={planos ? planos.onNovaParaJogo : () => {}}
          onEditar={planos ? planos.onEditar : () => {}} onRemover={planos ? planos.onRemover : () => {}}
          onIdeiasJogo={planos ? planos.onIdeiasJogo : null} onRevelarOnze={planos ? planos.onRevelarOnze : null} />
      ) : (
        <>
          <div style={{ color: T.mutedDim, fontSize: 12.5, marginBottom: 14, ...body }}>
            Escolhe, momento a momento, que ideias gerais os jogadores veem.
          </div>
          {!atual ? (
            <EmptyState text="Ainda não há ideias gerais." />
          ) : (
            <>
              <PlanoMomentos grupos={grupos} momento={atual.fase} onMomento={setMomento} contaMarcadas={(l) => l.filter(i => i.visivelAtletas).length} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <Btn variant="ghost" onClick={() => alternarMomento(atual.lista)}>
                  {atual.lista.every(i => i.visivelAtletas) ? 'Tirar este momento todo do Portal' : 'Pôr este momento todo no Portal'}
                </Btn>
              </div>
              <LinhaCartoes key={atual.fase} itens={atual.lista} renderItem={x => (
                <IdeiaCartaoMini key={x.id} x={x} nome={labelOf(x)} marcado={!!x.visivelAtletas} corMarca={T.good}
                  textoMarca={x.visivelAtletas ? 'No Portal' : 'Pôr no Portal'}
                  onMarcar={() => alternar(x.id)} onVer={() => onVer(x)} />
              )} />
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- Planos de Jogo ---------- */
export function PlanosDeJogo({ ideias, setIdeias, matches, labelOf, aberto, setAberto, onVer, onNovaParaJogo, onEditar, onRemover, onIdeiasJogo, onRevelarOnze }) {
  const prox = planoProximoJogo(matches);
  const hoje = todayStr();
  const jogos = (matches || []).filter(m => m && m.date && !jogoNaoJogado(m));
  const proximos = jogos.filter(m => m.date >= hoje).sort((a, b) => a.date.localeCompare(b.date));
  const passados = jogos.filter(m => m.date < hoje).sort((a, b) => b.date.localeCompare(a.date));
  const doJogo = (m) => ideias.filter(x => ideiaNoPlano(x, m.id));

  const jogo = aberto ? jogos.find(m => m.id === aberto) || (matches || []).find(m => m.id === aberto) : null;
  if (jogo) {
    return <PlanoDeJogoPagina jogo={jogo} prox={prox} ideias={ideias} setIdeias={setIdeias} labelOf={labelOf}
      onBack={() => setAberto(null)} onVer={onVer} onNovaParaJogo={onNovaParaJogo} onEditar={onEditar} onRemover={onRemover}
      onIdeiasJogo={onIdeiasJogo} onRevelarOnze={onRevelarOnze} />;
  }

  const cartao = (m) => {
    const lista = doJogo(m);
    const proprias = lista.filter(x => x.jogoId === m.id).length;
    const noPortal = prox && prox.id === m.id;
    const passado = m.date < hoje;
    return (
      <div key={m.id} onClick={() => setAberto(m.id)} title="Abrir plano de jogo" style={{
        cursor: 'pointer', background: T.surface, border: `${noPortal ? 2 : 1}px solid ${noPortal ? T.gold : T.line}`, borderRadius: 12,
        padding: noPortal ? '13px 15px' : '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ ...display, fontSize: 17, fontWeight: 600, color: T.cream, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{planoNomeJogo(m)}</span>
          {noPortal
            ? <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, border: `1px solid ${T.gold}`, color: T.gold, whiteSpace: 'nowrap', ...body }}>No Portal agora</span>
            : passado
              ? <span style={{ fontSize: 11, color: T.mutedDim, whiteSpace: 'nowrap', ...body }}>Arquivo</span>
              : <span style={{ fontSize: 11, color: T.mutedDim, whiteSpace: 'nowrap', ...body }}>Mais à frente</span>}
        </div>
        <div style={{ fontSize: 12, color: T.mutedDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...body }}>
          {fmtDate(m.date)}{m.competition ? ` · ${competitionLabel(m.competition)}` : ''}
        </div>
        <div style={{ fontSize: 12.5, color: lista.length ? T.cream : T.mutedDim, ...body }}>
          {lista.length ? `${lista.length} ideia${lista.length === 1 ? '' : 's'} · ${proprias} criada${proprias === 1 ? '' : 's'} para este jogo` : 'Plano por fazer'}
        </div>
      </div>
    );
  };
  const grelha = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 };
  return (
    <div style={{ overflowAnchor: 'none' }}>
      <div style={{ color: T.mutedDim, fontSize: 12.5, marginBottom: 14, lineHeight: 1.5, ...body }}>
        Um plano por jogo. O Portal do Atleta mostra só o plano do próximo jogo.
      </div>
      {proximos.length === 0 && passados.length === 0 ? (
        <EmptyState text="Ainda não há jogos marcados. Os planos de jogo aparecem aqui quando houver jogos em Jogos." />
      ) : (
        <>
          {proximos.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', margin: '4px 0 8px', ...body }}>Próximos jogos</div>
              <div style={{ ...grelha, marginBottom: 20 }}>{proximos.map(cartao)}</div>
            </>
          )}
          {passados.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', margin: '4px 0 8px', ...body }}>Arquivo</div>
              <div style={grelha}>{passados.map(cartao)}</div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export function PlanoDeJogoPagina({ jogo, prox, ideias, setIdeias, labelOf, onBack, onVer, onNovaParaJogo, onEditar, onRemover, onIdeiasJogo, onRevelarOnze }) {
  const [vista, setVista] = useState('plano'); // plano | juntar
  const noPlano = ideias.filter(x => ideiaNoPlano(x, jogo.id));
  const gerais = ideias.filter(x => !ideiaParaJogo(x));
  const gruposPlano = planoGrupos(noPlano);
  const gruposGerais = planoGrupos(gerais);
  const [momento, setMomento] = useState(null);
  const lista = vista === 'plano' ? gruposPlano : gruposGerais;
  const atual = lista.find(g => g.fase === momento) || lista[0] || null;
  const noPortal = prox && prox.id === jogo.id;
  const passado = jogo.date < todayStr();

  const alternarGeral = (id) => setIdeias(prev => prev.map(x => {
    if (x.id !== id) return x;
    const l = Array.isArray(x.planosJogo) ? x.planosJogo : [];
    return { ...x, planosJogo: l.includes(jogo.id) ? l.filter(j => j !== jogo.id) : [...l, jogo.id] };
  }));
  const botaoIcone = { background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 3, display: 'flex' };

  return (
    <div style={{ overflowAnchor: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <div style={{ ...display, fontSize: 22, color: T.cream }}>Plano de jogo · {planoNomeJogo(jogo)}</div>
        {noPortal
          ? <span style={{ fontSize: 11.5, padding: '3px 10px', borderRadius: 999, border: `1px solid ${T.gold}`, color: T.gold, ...body }}>No Portal agora</span>
          : <span style={{ fontSize: 11.5, color: T.mutedDim, ...body }}>{passado ? 'Arquivo — já não está no Portal' : 'Entra no Portal quando for o próximo jogo'}</span>}
        <div style={{ flex: 1 }} />
        <Btn onClick={() => onNovaParaJogo(jogo.id)}><Plus size={15} /> Nova ideia para este jogo</Btn>
      </div>
      <div style={{ color: T.mutedDim, fontSize: 12.5, marginBottom: 14, ...body }}>
        {fmtDate(jogo.date)}{jogo.competition ? ` · ${competitionLabel(jogo.competition)}` : ''} · {noPlano.length} ideia{noPlano.length === 1 ? '' : 's'} no plano
      </div>

      {/* O ONZE NO PORTAL. Até ser revelado, os atletas veem as ideias
          deste plano só com as posições (sem números, nomes nem
          suplentes), para não ficarem a saber o onze antes do tempo. O
          próprio servidor é que tira esses dados (ver
          `checkin_plano_jogo`). Revela-se aqui, ou sozinho à hora da
          concentração da convocatória. */}
      {onRevelarOnze && !passado && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14, padding: '10px 12px',
          background: T.surface, border: `1px solid ${jogo.onzeRevelado ? T.gold : T.line}`, borderRadius: 8, ...body,
        }}>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <div style={{ fontSize: 13, color: T.cream, fontWeight: 600 }}>
              {jogo.onzeRevelado ? 'Onze revelado no Portal' : 'Onze escondido no Portal'}
            </div>
            <div style={{ fontSize: 12, color: T.mutedDim, marginTop: 2, lineHeight: 1.45 }}>
              {jogo.onzeRevelado
                ? `Os atletas veem os números, os nomes e os suplentes${jogo.onzeReveladoEm ? ` desde ${new Date(jogo.onzeReveladoEm).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}.`
                : 'Os atletas veem as ideias só com as posições. Revela-se sozinho à hora da concentração da convocatória.'}
            </div>
          </div>
          {jogo.onzeRevelado
            ? <Btn variant="ghost" onClick={() => onRevelarOnze(jogo.id, false)}>Voltar a esconder</Btn>
            : <Btn onClick={() => onRevelarOnze(jogo.id, true)}><Eye size={14} /> Revelar o onze no Portal</Btn>}
        </div>
      )}

      {onIdeiasJogo && (
        <div style={{ marginBottom: 14 }}>
          <NotasDoJogo valor={jogo.ideias} onGuardar={(t) => onIdeiasJogo(jogo.id, t)} altura={62} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <ChipBtn active={vista === 'plano'} onClick={() => { setVista('plano'); setMomento(null); }}>No plano {noPlano.length}</ChipBtn>
        <ChipBtn active={vista === 'juntar'} onClick={() => { setVista('juntar'); setMomento(null); }}>Juntar ideias gerais</ChipBtn>
      </div>

      {atual && (
        <PlanoMomentos grupos={lista} momento={atual.fase} onMomento={setMomento}
          contaMarcadas={(l) => l.filter(i => ideiaNoPlano(i, jogo.id)).length} />
      )}
      <LinhaCartoes key={`${vista}|${atual ? atual.fase : ''}`} itens={atual ? atual.lista : []}
        vazio={vista === 'plano'
          ? 'Este plano ainda está vazio. Cria uma ideia para este jogo ou junta ideias gerais.'
          : 'Ainda não há ideias gerais.'}
        renderItem={x => {
          const propria = x.jogoId === jogo.id;
          const marcado = ideiaNoPlano(x, jogo.id);
          if (vista === 'juntar') {
            return (
              <IdeiaCartaoMini key={x.id} x={x} nome={labelOf(x)} marcado={marcado} corMarca={T.gold}
                textoMarca={marcado ? 'No plano' : 'Juntar ao plano'} onMarcar={() => alternarGeral(x.id)} onVer={() => onVer(x)} />
            );
          }
          return (
            <IdeiaCartaoMini key={x.id} x={x} nome={labelOf(x)} marcado={false} corMarca={T.gold}
              onVer={() => onVer(x)}
              extra={(
                <>
                  <span style={{ fontSize: 10.5, color: propria ? T.gold : T.mutedDim, whiteSpace: 'nowrap', marginRight: 'auto', ...body }}>{propria ? 'Criada para este jogo' : 'Ideia geral'}</span>
                  {propria ? (
                    <>
                      <button type="button" onClick={() => onEditar(x)} title="Editar" style={botaoIcone}><Pencil size={13} /></button>
                      <button type="button" onClick={() => onRemover(x)} title="Apagar ideia" style={botaoIcone}><Trash2 size={13} /></button>
                    </>
                  ) : (
                    <button type="button" onClick={() => alternarGeral(x.id)} title="Tirar do plano (a ideia geral fica intacta)" style={botaoIcone}><X size={13} /></button>
                  )}
                </>
              )} />
          );
        }} />
    </div>
  );
}

export function IdeiaJogo({ ideias, setIdeias, meta, matches = [], setMatches, planoPedido = null, onPlanoTratado }) {
  const cabecalhoEstreito = useIsMobile(560);
  const [modal, setModal] = useState(null); // null | 'new' | ideia (edição)
  const [viewing, setViewing] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [printIdeia, setPrintIdeia] = useState(null);
  const [dossier, setDossier] = useState(false);
  const [printDossier, setPrintDossier] = useState(null);

  const imprimirDossier = (lista) => {
    // A página do Dossier fica aberta depois de imprimir (volta-se com
    // "‹ Ideia de Jogo", como no Portal).
    setPrintDossier(lista);
    setTimeout(() => window.print(), 120);
  };
  /* A folha sai do body quando o diálogo fecha — senão colava-se à
     impressão seguinte. Mesmo padrão das outras impressões. */
  useEffect(() => {
    if (!printDossier) return undefined;
    const limpar = () => setPrintDossier(null);
    window.addEventListener('afterprint', limpar);
    return () => window.removeEventListener('afterprint', limpar);
  }, [printDossier]);
  const [filter, setFilter] = useState('Todas');
  // Vindo do cartão "Plano de jogo": nasce JÁ no plano pedido (sem mostrar
  // primeiro a grelha e depois saltar — era isso o "piscar").
  const [portalAtleta, setPortalAtleta] = useState(() => !!planoPedido);
  // As ideias criadas para um jogo (`jogoId`) só aparecem no plano desse
  // jogo (Portal › Plano de Jogo), nunca na Ideia de Jogo geral.
  const [planoAberto, setPlanoAberto] = useState(() => planoPedido || null);
  const [jogoNovaIdeia, setJogoNovaIdeia] = useState(null);
  const gerais = ideias.filter(x => !ideiaParaJogo(x));
  // Retroceder no browser tem de fechar o Portal do Atleta e voltar à
  // lista de ideias — sem isto, o "voltar" saltava por cima deste
  // ecrã e ia diretamente para o que estava aberto antes da Ideia de
  // Jogo. Mesmo padrão já usado no resto da app (ver `useDetailBack`).
  const fecharPortalAtleta = useDetailBack(portalAtleta, () => setPortalAtleta(false));
  // Vindo de um "Plano de jogo" de um jogo: abre logo esse plano.
  useEffect(() => {
    if (!planoPedido) return;
    if (planoAberto !== planoPedido) setPlanoAberto(planoPedido);
    if (!portalAtleta) setPortalAtleta(true);
    if (onPlanoTratado) onPlanoTratado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planoPedido]);
  const fecharDossier = useDetailBack(dossier, () => setDossier(false));

  const save = (data) => {
    const isEdicao = !!data.id;
    if (isEdicao) setIdeias(prev => prev.map(x => x.id === data.id ? data : x));
    else setIdeias(prev => [...prev, { ...data, id: uid() }]);
    setJogoNovaIdeia(null);
    if (isEdicao) trocarJanela(() => setModal(null), () => setViewing(data));
    else setModal(null);
  };
  const remove = (id) => removeWithUndo(ideias, setIdeias, id, itemLabel(ideias.find(x => x.id === id), 'Ideia'));

  const doPrint = (x) => {
    setPrintIdeia(x);
    imprimirComNome([labelOf(x), momentoTexto(x)].filter(Boolean).join(' · '));
  };
  const doShare = (x) => {
    const block = buildDiagramBlockHtml(x.diagram, '', 'ideia');
    const title = (x.name && x.name.trim()) || x.phase || 'Ideia de jogo';
    const html = buildShareableHtmlDoc({ title, metaLines: [momentoTexto(x)].filter(Boolean), blocks: [block] });
    shareOrDownloadHtml(`ideia_${title.replace(/[^\w-]+/g, '_')}.html`, html, title);
  };

  // Nome dado pelo treinador. Se ficar vazio (ideias criadas antes de o
  // campo existir), usa um número de ordem estável como identificação.
  const labelOf = (x) => (x.name && x.name.trim())
    ? x.name.trim()
    : `Ideia ${ideias.findIndex(i => i.id === x.id) + 1}`;
  /* Mais recentes primeiro (como nos Exercícios): a lista chega por ordem
     de criação e as novas entram no fim, por isso basta inverter. */
  const visible = (filter === 'Todas' ? gerais : gerais.filter(x => temMomento(x, filter)))
    .slice()
    .reverse();

  /* Dossier e Portal. Só faz sentido com alguma coisa para compilar.
     Passar do Portal para o Dossier (ou ao contrário) usa `trocarJanela`:
     a página nova herda a marca do "voltar" da anterior. Antes, fechar
     uma desfazia a marca e o "voltar" fechava também a que acabava de
     abrir, saltando para a lista das ideias. */
  const estiloBotaoLinha = cabecalhoEstreito
    ? { flex: '1 1 0', minWidth: 0, justifyContent: 'center', whiteSpace: 'nowrap', padding: '9px 6px', fontSize: 13 }
    // Pequenos (cabem nos 22 px entre o cabeçalho e os Momentos).
    : ESTILO_BOTAO_PEQUENO;
  const tamIconeLinha = cabecalhoEstreito ? 15 : ICONE_BOTAO_PEQUENO;
  const botoesDossierPortal = ideias.length > 0 ? (
    <>
      <Btn variant="ghost" onClick={() => { if (dossier) return; if (portalAtleta) trocarJanela(() => setPortalAtleta(false), () => setDossier(true)); else setDossier(true); }} style={estiloBotaoLinha}><BookOpen size={tamIconeLinha} /> Dossier</Btn>
      <Btn variant="ghost" onClick={() => { if (portalAtleta) return; if (dossier) trocarJanela(() => setDossier(false), () => setPortalAtleta(true)); else setPortalAtleta(true); }} style={estiloBotaoLinha}><Eye size={tamIconeLinha} /> Portal</Btn>
    </>
  ) : null;

  return (
    <div>
      <SectionHeader title="Ideia de Jogo" subtitle="A tua ideia de jogo."
        action={(
          /* No telemóvel: Nova ideia, Dossier e Portal numa linha, a dividir a
             largura (como nas outras páginas).
             No computador: SÓ "Nova ideia", no mesmo sítio do "Novo exercício".
             O cabeçalho fica com a mesma altura do dos Exercícios e a página não
             mexe ao trocar entre os dois. Dossier e Portal ficam pequenos logo
             por baixo (ver `botoesDossierPortal`). */
          <div style={cabecalhoEstreito
            ? { display: 'flex', gap: 8, flexWrap: 'nowrap', width: '100%' }
            : { display: 'flex', position: 'relative' }}>
            <Btn onClick={() => setModal('new')} style={cabecalhoEstreito ? { flex: '1 1 0', minWidth: 0, justifyContent: 'center', whiteSpace: 'nowrap', padding: '9px 6px', fontSize: 13 } : undefined}><Plus size={15} /> Nova ideia</Btn>
            {cabecalhoEstreito && botoesDossierPortal}
            {/* No computador, Dossier e Portal pequenos logo por baixo de
                "Nova ideia", no espaço entre o cabeçalho e os Momentos.
                Ficam "por cima" da página (posição absoluta): o cabeçalho
                tem a mesma altura do dos Exercícios e nada mexe. */}
            {!cabecalhoEstreito && botoesDossierPortal && (
              <div style={{ position: 'absolute', top: 'calc(100% + 2px)', right: 0, display: 'flex', gap: 6, zIndex: 1 }}>{botoesDossierPortal}</div>
            )}
          </div>
        )} />

      {dossier ? (
        <DossierIdeias ideias={gerais} labelOf={labelOf} onBack={fecharDossier} onImprimir={imprimirDossier} onVer={setViewing} />
      ) : portalAtleta ? (
        <PortalAtletaIdeias ideias={gerais} todasIdeias={ideias} setIdeias={setIdeias} matches={matches} labelOf={labelOf}
          onBack={() => { setPlanoAberto(null); fecharPortalAtleta(); }} onVer={setViewing}
          planos={{
            aberto: planoAberto, setAberto: setPlanoAberto,
            onNovaParaJogo: (jogoId) => { setJogoNovaIdeia(jogoId); setModal('new'); },
            onEditar: (x) => setModal(x),
            onRemover: (x) => remove(x.id),
            onIdeiasJogo: setMatches ? (jogoId, texto) => setMatches(prev => prev.map(m => (m.id === jogoId ? { ...m, ideias: texto } : m))) : null,
            onRevelarOnze: setMatches ? (jogoId, sim) => setMatches(prev => prev.map(m => (m.id === jogoId ? { ...m, onzeRevelado: !!sim, onzeReveladoEm: sim ? new Date().toISOString() : null } : m))) : null,
          }} />
      ) : (
        <>
      <MomentoFilter value={filter} onChange={setFilter} options={EXERCISE_PHASES} />

      {visible.length === 0 ? (
        <EmptyState text="Ainda sem ideias de jogo aqui." action={<Btn onClick={() => setModal('new')}><Plus size={15} /> Criar ideia</Btn>} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {visible.map(x => {
            const m = meta && meta[x.id];
            return (
              <div key={x.id} onClick={() => setViewing(x)} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
                <div title={labelOf(x)} style={{
                  color: T.cream, fontWeight: 500, fontSize: 15, marginBottom: 10, lineHeight: '20px', height: 20,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{labelOf(x)}</div>
                {(x.diagram && ((x.diagram.elements || []).length || (x.diagram.arrows || []).length)) ? (
                  <DiagramThumbAnimado diagram={x.diagram} height={130} />
                ) : (
                  <div style={{
                    width: '100%', aspectRatio: CARTAO_ASPECT, background: '#1e3a24', borderRadius: 6, marginBottom: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: T_ESCURO.mutedDim,
                  }}>Sem esquema</div>
                )}
                {/* Ícones por baixo da imagem, encostados à margem direita
                    do cartão. */}
                {/* Como nos Exercícios: o MOMENTO em baixo, à esquerda, na
                    linha dos ícones. A visibilidade no Portal vê-se só no
                    olho (verde = visível), sem etiqueta extra. */}
                <div style={{ display: 'flex', gap: 16, marginTop: 8, alignItems: 'center' }}>
                  <RotulosMomento x={x} />
                  <span style={{ flex: 1 }} />
                  <button
                    onClick={(e) => { e.stopPropagation(); setIdeias(prev => prev.map(y => (y.id === x.id ? { ...y, visivelAtletas: !y.visivelAtletas } : y))); }}
                    title={x.visivelAtletas ? 'Visível no Portal → Ideia de Jogo — clicar para esconder' : 'Tornar visível no Portal → Ideia de Jogo'}
                    style={{ background: 'none', border: 'none', color: x.visivelAtletas ? T.good : T.mutedDim, cursor: 'pointer', padding: 0 }}
                  >{x.visivelAtletas ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                  <button onClick={(e) => { e.stopPropagation(); doShare(x); }} title="Partilhar como ficheiro" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0 }}><Share2 size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); doPrint(x); }} title="Imprimir ideia" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0 }}><Printer size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); setHistoryFor(x); }} title="Histórico de alterações" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0 }}><Clock size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); setModal(x); }} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0 }}><Pencil size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); remove(x.id); }} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0 }}><Trash2 size={14} /></button>
                </div>
                {m && m.email && (
                  <div style={{ fontSize: 10.5, color: T.mutedDim, borderTop: `1px solid ${T.line}`, marginTop: 'auto', paddingTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Adicionado/editado por {m.email} · {timeAgo(m.at)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {modal && (
        <IdeiaModal
          ideia={modal === 'new' ? null : modal}
          allIdeias={ideias}
          meta={meta}
          matches={matches}
          jogoInicial={modal === 'new' ? jogoNovaIdeia : null}
          onClose={() => { setJogoNovaIdeia(null); if (modal === 'new') setModal(null); else trocarJanela(() => setModal(null), () => setViewing(modal)); }}
          onSave={save}
        />
      )}
      {historyFor && <HistoryModal table="ideias" recordId={historyFor.id} title={`Histórico · ${labelOf(historyFor)}`} onClose={() => setHistoryFor(null)} />}
      {viewing && (
        // Reaproveita a apresentação dos exercícios: os campos que a ideia
        // não tem (espaço, material, descrição…) simplesmente não aparecem.
        <ExercisePresentation
          exercise={{ ...viewing, name: labelOf(viewing) }}
          onClose={() => setViewing(null)}
          onEdit={() => trocarJanela(() => setViewing(null), () => setModal(viewing))}
        />
      )}


      {printDossier && createPortal(
        (() => {
          /* A ORDEM E A NUMERAÇÃO CALCULAM-SE UMA VEZ SÓ.

             O índice e as secções têm de dizer o mesmo número para a
             mesma ideia — se cada um contasse por sua conta, bastava uma
             ideia sem fase para os dois deixarem de bater certo. Aqui a
             lista sai ordenada e numerada de 1 a N, e tanto o índice como
             o corpo leem dela.

             A numeração é contínua e não reinicia em cada fase: um índice
             com três "1" não serve para encontrar nada. */
          const grupos = [];
          PHASES.forEach(fase => {
            const lista = printDossier.filter(i => i.phase === fase);
            if (lista.length) grupos.push({ fase, lista });
          });
          const semFase = printDossier.filter(i => !PHASES.includes(i.phase));
          if (semFase.length) grupos.push({ fase: 'Outras', lista: semFase });

          let n = 0;
          const numerados = grupos.map(g => ({
            fase: g.fase,
            lista: g.lista.map(i => ({ ideia: i, numero: ++n })),
          }));

          return (
            <div className="print-sheet">
              <h2 style={{ margin: '0 0 4px', fontSize: 26 }}>Ideias de Jogo</h2>
              <p style={{ margin: '0 0 22px', fontSize: 12.5 }}>
                {printDossier.length} {printDossier.length === 1 ? 'ideia' : 'ideias'} · {new Date().toLocaleDateString('pt-PT')}
              </p>

              <h3 style={{ fontSize: 15, margin: '0 0 10px', paddingBottom: 5, borderBottom: '1px solid #111' }}>
                Índice
              </h3>
              {numerados.map(g => (
                <div key={g.fase} style={{ marginBottom: 14, breakInside: 'avoid' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{g.fase}</div>
                  {g.lista.map(({ ideia, numero }) => (
                    <div key={ideia.id} style={{ display: 'flex', gap: 9, alignItems: 'baseline', padding: '3px 0', borderBottom: '1px solid #eee' }}>
                      <span style={{ width: 22, textAlign: 'right', flexShrink: 0, color: '#777', fontSize: 11.5 }}>{numero}</span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                          {(ideia.name && ideia.name.trim()) || ideia.phase || 'Ideia de jogo'}
                        </span>
                        {ideia.description ? (
                          /* Duas linhas no máximo: um índice que traz a
                             descrição inteira deixa de caber numa página e
                             de servir para folhear. */
                          <span style={{
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                            overflow: 'hidden', fontSize: 11.5, color: '#666', lineHeight: 1.45,
                          }}>{ideia.description}</span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              ))}

              {/* O corpo começa em página nova: o índice é para se ver
                  inteiro, não misturado com a primeira jogada. */}
              <div style={{ breakBefore: 'page', pageBreakBefore: 'always' }} />

              {numerados.map((g, gi) => (
                /* Cada momento começa em folha nova (o 1.º já vem depois da
                   quebra do índice): nenhum título de momento fica perdido
                   no fundo de uma folha. */
                <div key={g.fase} style={{ marginBottom: 8, ...(gi > 0 ? { breakBefore: 'page', pageBreakBefore: 'always' } : {}) }}>
                  <h3 style={{
                    fontSize: 17, margin: '0 0 12px', paddingBottom: 5,
                    borderBottom: '2px solid #111', breakAfter: 'avoid', pageBreakAfter: 'avoid',
                  }}>{g.fase}</h3>
                  {g.lista.map(({ ideia, numero }) => (
                    <IdeiaNoDossier key={ideia.id} ideia={ideia} numero={numero} />
                  ))}
                </div>
              ))}
            </div>
          );
        })(),
        document.body,
      )}

      {printIdeia && createPortal(
        <div className="print-sheet">
          <h2 style={{ margin: '0 0 10px', fontSize: 24 }}>{labelOf(printIdeia)}</h2>
          <div style={{ margin: '0 0 14px', fontSize: 12.5, borderTop: '1px solid #ccc', borderBottom: '1px solid #ccc', padding: '8px 0' }}>
            <strong>Fase de jogo:</strong> {momentoTexto(printIdeia)}
          </div>
          <svg viewBox={viewBoxSemBancos(printIdeia.diagram && printIdeia.diagram.vista)} style={{ width: '100%', aspectRatio: aspetoSemBancos(printIdeia.diagram && printIdeia.diagram.vista), display: 'block', background: '#fff', border: '1px solid #ccc', borderRadius: 8 }}>
            <VistaCampo esticar={ESTICAR_IMPRESSAO_MEIO} vista={printIdeia.diagram && printIdeia.diagram.vista}>
            <PitchMarkings printMode semBancos />
            <SpaceZonesReadOnly diagram={printIdeia.diagram} printMode />
            <DiagramElements
              elements={printIdeia.diagram?.elements || []}
              arrows={printIdeia.diagram?.arrows || []}
              interactive={false}
              printMode
            />
            </VistaCampo>
          </svg>
        </div>,
        document.body
      )}
    </div>
  );
}

/* PORTAL DO ATLETA — escolher, de uma assentada, quais as ideias já
   criadas que os atletas veem.

   Antes só dava para ligar isto ideia a ideia, a abrir cada uma para
   editar — lento quando já há uma dúzia feitas e só se quer marcar
   três ou quatro. Aqui é só a lista, com um visto ao lado de cada uma;
   tocar já grava, sem "Guardar" à parte (mesmo padrão do resto da
   app — ver `useCollectionSync`, que grava a cada mudança). */
/* O DOSSIER, NA MESMA EXPERIÊNCIA DO PORTAL: em vez de uma janela por
   cima, abre como uma página dentro da Ideia de Jogo, com o mesmo
   "‹ Ideia de Jogo" para voltar, o mesmo título e a mesma lista por fase.
   No telemóvel, o nome de cada ideia aparece inteiro (sem reticências), e o
   botão "Imprimir dossier" fica preso ao fundo do ecrã. */
export function DossierIdeias({ ideias, labelOf, onBack, onImprimir, onVer }) {
  const estreito = useIsMobile(560);
  const [escolhidas, setEscolhidas] = useState(() => new Set(ideias.map(i => i.id)));
  // Mesma organização do Portal: separadores por momento e uma linha de
  // cartões com o desenho (e ▶), cada um com o visto "No dossier".
  const grupos = planoGrupos(ideias);
  const [momento, setMomento] = useState(grupos[0] ? grupos[0].fase : null);
  const atual = grupos.find(g => g.fase === momento) || grupos[0] || null;
  const alternar = (id) => setEscolhidas(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const alternarFase = (lista) => setEscolhidas(prev => {
    const n = new Set(prev);
    const todas = lista.every(i => n.has(i.id));
    lista.forEach(i => (todas ? n.delete(i.id) : n.add(i.id)));
    return n;
  });
  const total = escolhidas.size;

  return (
    <div style={{ overflowAnchor: 'none' }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
        borderRadius: 8, color: T.cream, padding: '7px 13px', cursor: 'pointer', ...body, fontSize: 13, marginBottom: 16,
      }}>
        <ChevronLeft size={15} /> Ideia de Jogo
      </button>

      <div style={{ ...display, fontSize: 20, color: T.cream, marginBottom: 4 }}>Dossier</div>
      <div style={{ color: T.mutedDim, fontSize: 12.5, marginBottom: 6, ...body }}>
        O modelo de jogo num documento só. Escolhe, momento a momento, as ideias que entram e imprime.
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14, fontSize: 12 }}>
        <span style={{ color: T.good, ...body }}>● {total} de {ideias.length} no dossier</span>
        <span style={{ display: 'flex', gap: 8, marginLeft: estreito ? 0 : 'auto' }}>
          <Btn variant="ghost" onClick={() => setEscolhidas(new Set(ideias.map(i => i.id)))} style={{ padding: '6px 12px', fontSize: 12.5 }}>Todas</Btn>
          <Btn variant="ghost" onClick={() => setEscolhidas(new Set())} style={{ padding: '6px 12px', fontSize: 12.5 }}>Nenhuma</Btn>
          <Btn onClick={() => onImprimir(ideias.filter(i => escolhidas.has(i.id)))} disabled={!total} style={{ padding: '6px 12px', fontSize: 12.5 }}>
            <Printer size={14} /> Imprimir dossier ({total})
          </Btn>
        </span>
      </div>

      {!atual ? (
        <EmptyState text="Ainda não há ideias gerais." />
      ) : (
        <>
          <PlanoMomentos grupos={grupos} momento={atual.fase} onMomento={setMomento} contaMarcadas={(l) => l.filter(i => escolhidas.has(i.id)).length} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <Btn variant="ghost" onClick={() => alternarFase(atual.lista)}>
              {atual.lista.every(i => escolhidas.has(i.id)) ? 'Tirar este momento todo do dossier' : 'Pôr este momento todo no dossier'}
            </Btn>
          </div>
          <LinhaCartoes key={atual.fase} itens={atual.lista} renderItem={x => {
            const on = escolhidas.has(x.id);
            const passos = ((x.diagram && x.diagram.sequence) || []).length;
            return (
              <IdeiaCartaoMini key={x.id} x={x} nome={labelOf(x)} marcado={on} corMarca={T.good}
                textoMarca={on ? 'No dossier' : 'Pôr no dossier'} onMarcar={() => alternar(x.id)}
                onVer={() => (onVer ? onVer(x) : alternar(x.id))}
                extra={passos > 0 ? <span style={{ ...mono, fontSize: 10.5, color: T.mutedDim }}>{passos + 1} img</span> : null} />
            );
          }} />
        </>
      )}
    </div>
  );
}

