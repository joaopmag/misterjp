// competicao/Escalacao.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useIsMobile, Select, TextArea } from '../base/ui';
import { FORMACOES, LAYOUT_FORMACAO, rotuloDoLugar, tamanhoDaFormacao, distribuirOnzeNoCampo } from '../tatico/Simulador';
import React, { useState, useRef, useEffect } from 'react';
import { T, mono, body } from '../base/tema';
import { estadoClinicoParaJogo } from '../dominio/clinico';
import { todayStr } from '../base/utilidades';
import { sortByPosition, shortPlayerName } from '../dominio/jogadores';
import { createPortal } from 'react-dom';
import { Target, ChevronRight } from 'lucide-react';
import { isFriendlyMatch, convocadosDoJogo } from '../dominio/jogos';
import { jogoNaoJogado } from '../dominio/estadoJogos';

/* A convocatória do jogo manda na coluna desse jogo na tabela-resumo das
   Presenças: convocar marca C, desconvocar volta a NC. Guardar o jogo
   passa a alinhar as duas listas, para não ficarem versões diferentes da
   mesma coisa em sítios diferentes. As notas de quem sai da convocatória
   também são retiradas, porque deixaram de ter a que se referir. */
/* =====================================================================
   ESCALAÇÃO NO CAMPO — convocatória feita num campo vertical.

   · Escolhe-se a formação; cada lugar do campo é uma bola com a foto.
   · No computador ARRASTA-SE o jogador (do plantel, do banco ou de outro
     lugar) para o sítio certo; no telemóvel TOCA-SE no jogador e depois
     no sítio (sem arrastar — arrastar numa página que desliza falha).
     O toque também funciona no computador.
   · Largar em cima de um lugar ocupado TROCA os dois.
   · Zonas: lugares do onze · Suplentes · Não convocados. Os
     indisponíveis (Boletim Clínico) aparecem à parte, a vermelho.

   Componente só de ecrã: recebe `slots` (um id por lugar da formação,
   ou null) e `banco` (ids), e devolve tudo por `onChange` — quem o usa
   (ficha de edição do jogo, convocatória) é que traduz para o seu
   formato. Nada é gravado aqui.
   ===================================================================== */
/* `minutos` (opcional): { [pid]: minutos jogados } — aparecem em cada
   cartão e ao lado do nome no campo.
   `amigavel`: num amigável vão todos. Quem não está no onze é suplente
   (sem limite nem vagas reservadas), fizesse ou não minutos; não há caixa
   de "Não convocados". Ficam à parte só os indisponíveis e quem tem
   falta, L ou escalão marcado nas Presenças desse jogo (`ausentes`:
   Map pid → "Falta" | "Lesionado" | "Escalão"). */
export function EscalacaoNoCampo({ players, formacao, slots, banco, onChange, onFormacao, clinico = [], data, maxBanco = null, castigados = null, acao = null, minutos = null, amigavel = false, ausentes = null }) {
  const isMobile = useIsMobile(820);
  const lugares = FORMACOES[formacao] || FORMACOES['4-3-3'];
  const layout = LAYOUT_FORMACAO[formacao] || LAYOUT_FORMACAO['4-3-3'];
  const [sel, setSel] = useState(null); // { de: 'slot'|'banco'|'fora', i?, id }
  const [arrasto, setArrasto] = useState(null); // { id, x, y, de, i }
  const [alvo, setAlvo] = useState(null);
  const estadoRef = useRef(null);
  const raizRef = useRef(null);
  /* CAMPO DA MESMA ALTURA QUE AS LISTAS (no computador): a largura do
     campo acompanha a altura das caixas ao lado (Suplentes, Não
     convocados, Indisponíveis), para os dois lados acabarem à mesma
     altura. Entre 260 e 400 px; só se mexe com diferenças de mais de 4 px.
     As caixas têm sempre 5 colunas (ver `caixa`), por isso a altura delas
     não muda quando o campo alarga — não há efeito bola de neve. */
  const zonasRef = useRef(null);
  const [alturaZonas, setAlturaZonas] = useState(0);
  // Primeira medida ANTES de pintar (useLayoutEffect): ao abrir a janela o
  // campo já aparece com a largura certa, sem "saltar" para a direita.
  React.useLayoutEffect(() => {
    if (isMobile) return;
    const el = zonasRef.current;
    if (!el) return;
    // offsetHeight (e não getBoundingClientRect): não é afetado pela
    // animação de abrir da janela (escala), que dava uma medida errada.
    const h = el.offsetHeight;
    if (h) setAlturaZonas(h);
  }, [isMobile]);
  useEffect(() => {
    if (isMobile) return undefined;
    const el = zonasRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entradas) => {
      const h = Math.round(entradas[0].contentRect.height);
      setAlturaZonas(prev => (Math.abs(prev - h) > 4 ? h : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile]);
  const larguraCampo = alturaZonas ? Math.max(260, Math.min(400, Math.round((alturaZonas - 2) * 68 / 105))) : 320;

  const porId = new Map(players.map(p => [p.id, p]));
  const naEscalacao = new Set([...slots.filter(Boolean), ...banco]);
  // Estado do jogador: castigo (expulsão no último jogo oficial) ou Boletim Clínico.
  const estado = (p) => {
    if (castigados && castigados.has(p.id)) return { id: 'indisponivel', avisaJogo: true, curto: 'Castigo', cor: T.bad, label: castigados.get(p.id) };
    if (ausentes && ausentes.has(p.id)) return { id: 'indisponivel', avisaJogo: true, curto: ausentes.get(p.id), cor: T.bad, label: ausentes.get(p.id) };
    return estadoClinicoParaJogo(p.id, data || todayStr(), clinico);
  };
  const indisponivel = (p) => { const e = estado(p); return !!(e && (e.avisaJogo || e.id === 'indisponivel')); };
  const fora = sortByPosition(players.filter(p => !naEscalacao.has(p.id)));
  const foraDisp = fora.filter(p => !indisponivel(p));
  const foraIndisp = fora.filter(p => indisponivel(p));
  const bancoCheio = maxBanco != null && banco.length >= maxBanco;

  /* Mover `id` (vindo de `origem`) para `destino`. Regras:
     · destino lugar ocupado → troca (o ocupante vai para onde o outro estava);
     · destino banco → fica suplente (se houver lugar);
     · destino fora → deixa de estar convocado. */
  const mover = (origem, destino) => {
    const id = origem.id;
    let s = [...slots];
    let b = banco.filter(x => x !== id);
    const tirarDosLugares = () => { s = s.map(x => (x === id ? null : x)); };
    if (destino.tipo === 'jogador') {
      if (destino.id === id) return;
      if (origem.de === 'slot') {
        // Titular largado em cima de um suplente/não convocado: trocam.
        s[origem.i] = destino.id;
        if (destino.de === 'banco') b = banco.map(x => (x === destino.id ? id : x));
        onChange({ slots: s, banco: b });
        return;
      }
      // Entre banco e fora, conta como largar na zona desse jogador.
      return mover(origem, { tipo: destino.de === 'banco' ? 'banco' : 'fora' });
    }
    if (destino.tipo === 'slot') {
      const ocupante = s[destino.i];
      if (ocupante === id) return;
      tirarDosLugares();
      s[destino.i] = id;
      if (ocupante) {
        if (origem.de === 'slot') s[origem.i] = ocupante;
        else if (origem.de === 'banco') b = [...b, ocupante];
        else b = [...b, ocupante].slice(0, maxBanco == null ? undefined : maxBanco); // vindo de fora: o ocupante vai para o banco
      }
    } else if (destino.tipo === 'banco') {
      if (origem.de === 'banco') return;
      if (maxBanco != null && b.length >= maxBanco) return;
      tirarDosLugares();
      b = [...b, id];
    } else if (destino.tipo === 'fora') {
      if (origem.de === 'fora') return;
      tirarDosLugares();
    }
    onChange({ slots: s, banco: b });
  };

  // ---- Toque: escolher e depois tocar no destino ----
  const tocarJogador = (origem) => {
    if (arrastoFeito.current) { arrastoFeito.current = false; return; }
    if (!sel) { setSel(origem); return; }
    if (sel.id === origem.id) { setSel(null); return; }
    // Tocar noutro jogador: se esse estiver num lugar, troca; senão, muda a escolha.
    if (origem.de === 'slot') { mover(sel, { tipo: 'slot', i: origem.i }); setSel(null); return; }
    if (sel.de === 'slot' && origem.de !== 'slot') { mover(origem, { tipo: 'slot', i: sel.i }); setSel(null); return; }
    setSel(origem);
  };
  const tocarZona = (destino) => {
    if (!sel) return;
    mover(sel, destino);
    setSel(null);
  };

  // ---- Arrastar (só rato) ----
  const arrastoFeito = useRef(false);
  const zonaEm = (x, y) => {
    const raiz = raizRef.current;
    if (!raiz) return null;
    const el = document.elementFromPoint(x, y);
    // Largar em cima de um jogador (no banco ou fora): troca com ele.
    const j = el && el.closest ? el.closest('[data-jogador]') : null;
    if (j && raiz.contains(j)) {
      const [de, id] = String(j.getAttribute('data-jogador')).split('|');
      return { tipo: 'jogador', de, id };
    }
    const z = el && el.closest ? el.closest('[data-zona]') : null;
    if (!z || !raiz.contains(z)) return null;
    const [tipo, i] = String(z.getAttribute('data-zona')).split(':');
    return { tipo, i: i != null ? Number(i) : undefined };
  };
  const aoPrimir = (origem) => (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return; // no toque, só o clique
    // Sem isto, arrastar com o rato começava a SELECIONAR texto e o browser
    // fazia deslizar a janela para acompanhar a seleção — a página mexia.
    e.preventDefault();
    try { window.getSelection && window.getSelection().removeAllRanges(); } catch (err) { /* nada */ }
    document.body.style.userSelect = 'none';
    estadoRef.current = { origem, x0: e.clientX, y0: e.clientY, moveu: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
  };
  const aoMover = (e) => {
    const st = estadoRef.current;
    if (!st) return;
    if (!st.moveu && Math.hypot(e.clientX - st.x0, e.clientY - st.y0) > 6) st.moveu = true;
    if (!st.moveu) return;
    setArrasto({ id: st.origem.id, x: e.clientX, y: e.clientY });
    const z = zonaEm(e.clientX, e.clientY);
    setAlvo(z ? (z.tipo === 'jogador' ? `${z.de}:` : `${z.tipo}:${z.i ?? ''}`) : null);
  };
  const aoLargar = (e) => {
    const st = estadoRef.current;
    estadoRef.current = null;
    document.body.style.userSelect = '';
    setArrasto(null);
    setAlvo(null);
    if (!st || !st.moveu) return;
    arrastoFeito.current = true;
    setTimeout(() => { arrastoFeito.current = false; }, 0);
    // O alvo do largar está por baixo do jogador arrastado (que segue o rato).
    const z = zonaEm(e.clientX, e.clientY);
    if (z) mover(st.origem, z);
    setSel(null);
  };

  const fotoBola = (p, tam, destaque) => {
    const e = estado(p);
    const anel = destaque ? T.gold : (e && e.cor ? e.cor : '#ffffff');
    return (
      <span style={{
        width: tam, height: tam, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
        border: `2px solid ${anel}`, background: T.crimson, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: destaque ? `0 0 0 3px ${T.gold}55` : '0 1px 3px rgba(0,0,0,.4)', fontSize: Math.round(tam * 0.36), fontWeight: 700, ...mono,
      }}>
        {p.photo ? <img src={p.photo} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (p.number || (p.name || '?').slice(0, 1))}
      </span>
    );
  };
  const props = (origem) => ({
    onPointerDown: aoPrimir(origem), onPointerMove: aoMover, onPointerUp: aoLargar, onPointerCancel: aoLargar,
    onClick: (e) => { e.stopPropagation(); tocarJogador(origem); },
  });

  // Cartão compacto: foto, nome e (posição · número) — ou o estado
  // clínico, nos indisponíveis — sempre em duas linhas curtas.
  const minDe = (p) => {
    const v = minutos ? Number(minutos[p.id]) : NaN;
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const cartaoJogador = (p, origem, extra) => {
    const escolhido = sel && sel.id === p.id;
    const min = extra ? null : minDe(p);
    return (
      <button key={p.id} type="button" {...props(origem)} data-jogador={`${origem.de}|${p.id}`}
        title={`${p.name}${p.position ? ` · ${p.position}` : ''}`}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '2px 7px', minWidth: 0, textAlign: 'left',
          background: escolhido ? `${T.gold}22` : T.surfaceRaise, border: `1px solid ${escolhido ? T.gold : T.line}`, borderRadius: 8,
          color: T.cream, cursor: 'pointer', opacity: arrasto && arrasto.id === p.id ? 0.35 : 1, touchAction: 'manipulation', ...body,
        }}>
        {fotoBola(p, 26, escolhido)}
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontSize: 12, lineHeight: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shortPlayerName(p, players)}</span>
          <span style={{ display: 'block', fontSize: 10, lineHeight: '13px', color: extra ? T.bad : T.mutedDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...mono }}>
            {extra || `${p.position || '—'}${p.number ? ` · ${p.number}` : ''}`}
            {min != null && <span style={{ color: T.gold }}>{` · ${min}'`}</span>}
          </span>
        </span>
      </button>
    );
  };
  /* LISTAS QUE NÃO MEXEM. Antes, cada jogador que ia para o campo (ou
     para o banco) saía da lista e os outros escorregavam para o lugar
     dele — e as caixas mudavam de altura, empurrando a página. Agora:
     · quem está na escalação deixa o seu cartão "fantasma" (esbatido, com
       contorno tracejado) no mesmo sítio da lista — nada escorrega;
     · o banco reserva sempre os lugares todos (9), com vagas vazias.
     As caixas ficam sempre com a mesma altura. */
  const cartaoFantasma = (p) => (
    <div key={`f-${p.id}`} aria-hidden="true" title={`${p.name} — na escalação`}
      style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '2px 7px', minWidth: 0,
        border: `1px dashed ${T.line}`, borderRadius: 8, opacity: 0.32, pointerEvents: 'none', ...body,
      }}>
      <span style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, border: `1px dashed ${T.mutedDim}` }} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 12, lineHeight: '15px', color: T.mutedDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shortPlayerName(p, players)}</span>
        <span style={{ display: 'block', fontSize: 10, lineHeight: '13px', color: T.mutedDim, ...mono }}>na escalação</span>
      </span>
    </div>
  );
  const vagaVazia = (k) => (
    <div key={`v-${k}`} aria-hidden="true"
      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '2px 7px', minWidth: 0, border: `1px dashed ${T.line}`, borderRadius: 8, opacity: 0.45, pointerEvents: 'none', ...body }}>
      <span style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, border: `1px dashed ${T.mutedDim}` }} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 12, lineHeight: '15px', color: T.mutedDim }}>Vaga</span>
        <span style={{ display: 'block', fontSize: 10, lineHeight: '13px' }}>&nbsp;</span>
      </span>
    </div>
  );
  const caixa = (zona, titulo, conteudo, vazio, opcoes = {}) => {
    const ativo = alvo === `${zona}:` || (sel && !opcoes.semToque);
    return (
      <div data-zona={opcoes.semZona ? undefined : `${zona}`} onClick={() => !opcoes.semToque && tocarZona({ tipo: zona })}
        style={{
          border: `1px ${ativo && !opcoes.semZona ? 'dashed' : 'solid'} ${alvo === `${zona}:` ? T.gold : (opcoes.cor || T.line)}`,
          borderRadius: 10, padding: '9px 10px', background: alvo === `${zona}:` ? `${T.gold}14` : T.surface, minWidth: 0,
          cursor: sel && !opcoes.semToque ? 'pointer' : 'default',
        }}>
        <div style={{ fontSize: 11, color: opcoes.cor || T.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 7, ...body }}>{titulo}</div>
        {/* Sem deslizar por dentro: a caixa cresce com os jogadores. */}
        {conteudo.length === 0
          ? <div style={{ color: T.mutedDim, fontSize: 12, padding: '8px 4px', textAlign: 'center', ...body }}>{vazio}</div>
          // No computador, sempre 5 colunas: o nº de linhas (e a altura da
          // caixa) não depende da largura — senão alargar o campo estreitava
          // as caixas, criava linhas novas e o campo voltava a crescer.
          : <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(132px, 1fr))' : 'repeat(5, minmax(0, 1fr))', gap: 4 }}>{conteudo}</div>}
      </div>
    );
  };

  const nTitulares = slots.filter(Boolean).length;
  const arrastado = arrasto ? porId.get(arrasto.id) : null;

  return (
    <div ref={raizRef} style={{ overflowAnchor: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ fontSize: 11.5, color: T.mutedDim, ...body }}>Sistema</span>
        <Select value={formacao} onChange={e => onFormacao(e.target.value)} style={{ width: 110 }}>
          {Object.keys(FORMACOES).map(fm => <option key={fm} value={fm}>{fm}</option>)}
        </Select>
        {/* Largura fixa e números de largura igual: "1/11" ou "10/11" não
            empurram nada; a frase da direita ocupa o resto numa só linha. */}
        <span style={{ fontSize: 12, color: nTitulares === lugares.length ? T.good : T.warn, minWidth: '15.5em', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', ...body }}>
          {nTitulares}/{lugares.length} titulares · {banco.length}{maxBanco != null ? `/${maxBanco}` : ''} suplentes
        </span>
        <span style={{ fontSize: 11.5, color: T.mutedDim, flex: '1 1 0', minWidth: 0, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...body }}>
          {sel
            ? <span style={{ color: T.gold }}>{amigavel ? 'Toca no lugar ou no banco' : 'Toca no lugar, no banco ou em "Não convocados"'} para onde vai {porId.get(sel.id) ? shortPlayerName(porId.get(sel.id), players) : 'o jogador'}.</span>
            : (isMobile ? 'Toca num jogador e depois no sítio para onde vai.' : 'Arrasta os jogadores (ou clica num e depois no sítio).')}
        </span>
        {acao}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : `${larguraCampo}px minmax(0, 1fr)`, gap: 14, alignItems: 'start' }}>
        {/* CAMPO VERTICAL (ataque para cima). */}
        <div style={{
          position: 'relative', width: '100%', maxWidth: isMobile ? 320 : larguraCampo, margin: isMobile ? '0 auto' : 0, aspectRatio: '68 / 105', borderRadius: 10, overflow: 'hidden',
          background: 'repeating-linear-gradient(180deg, #2b5a33 0 7.5%, #275230 7.5% 15%)', border: `1px solid ${T.line}`,
        }}>
          <svg viewBox="0 0 68 105" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <g fill="none" stroke="#ffffff88" strokeWidth="0.35">
              <rect x="1.5" y="1.5" width="65" height="102" />
              <line x1="1.5" y1="52.5" x2="66.5" y2="52.5" />
              <circle cx="34" cy="52.5" r="9.15" />
              <rect x="13.84" y="1.5" width="40.32" height="16.5" />
              <rect x="24.84" y="1.5" width="18.32" height="5.5" />
              <rect x="13.84" y="87" width="40.32" height="16.5" />
              <rect x="24.84" y="98" width="18.32" height="5.5" />
              <path d="M 26.69 18 A 9.15 9.15 0 0 0 41.31 18" />
              <path d="M 26.69 87 A 9.15 9.15 0 0 1 41.31 87" />
            </g>
          </svg>
          {lugares.map((lugar, i) => {
            const [lx, ly] = layout[i] || [0.5, 0.5];
            const id = slots[i];
            const p = id ? porId.get(id) : null;
            const escolhido = sel && p && sel.id === p.id;
            const realce = alvo === `slot:${i}`;
            return (
              <div key={i} data-zona={`slot:${i}`}
                onClick={(e) => { e.stopPropagation(); if (p) tocarJogador({ de: 'slot', i, id: p.id }); else tocarZona({ tipo: 'slot', i }); }}
                style={{
                  // Margem dentro do campo: o GR e os avançados (e os nomes
                  // por baixo deles) ficam sempre dentro das linhas.
                  position: 'absolute', left: `${6 + ly * 88}%`, top: `${topNoCampoEcra(lx, ly)}%`, transform: 'translate(-50%, -50%)',
                  width: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', zIndex: escolhido ? 3 : 2,
                }}>
                {p ? (
                  <div {...props({ de: 'slot', i, id: p.id })} onClick={undefined}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: arrasto && arrasto.id === p.id ? 0.35 : 1, touchAction: 'manipulation' }}>
                    <div style={{ outline: realce ? `2px dashed ${T.gold}` : 'none', outlineOffset: 3, borderRadius: '50%' }}>{fotoBola(p, 38, escolhido)}</div>
                    <span style={{ fontSize: 10.5, color: '#fff', marginTop: 2, maxWidth: 70, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 2px #000', ...body }}>{shortPlayerName(p, players)}{minDe(p) != null && <span style={{ color: T.gold, ...mono }}>{` ${minDe(p)}'`}</span>}</span>
                  </div>
                ) : (
                  <>
                    <span style={{
                      width: 38, height: 38, borderRadius: '50%', border: `2px dashed ${realce || sel ? T.gold : '#ffffffaa'}`,
                      background: realce ? `${T.gold}33` : 'rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 10.5, ...mono,
                    }}>{rotuloDoLugar(lugar)}</span>
                    <span style={{ fontSize: 10, color: '#ffffffbb', marginTop: 2, ...body }}>livre</span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* ZONAS À VOLTA DO CAMPO */}
        <div ref={zonasRef} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          {amigavel && (() => {
            const doBanco = sortByPosition(banco.map(id => porId.get(id)).filter(Boolean)).map(p => cartaoJogador(p, { de: 'banco', id: p.id }));
            return caixa('banco', `Suplentes · ${doBanco.length}`, doBanco, 'Todos os disponíveis estão no onze.', { altura: 130 });
          })()}
          {!amigavel && (() => {
            const noBanco = sortByPosition(banco.map(id => porId.get(id)).filter(Boolean)).map(p => cartaoJogador(p, { de: 'banco', id: p.id }));
            const reserva = maxBanco != null ? maxBanco : 9;
            const vagas = Array.from({ length: Math.max(0, reserva - noBanco.length) }, (_, k) => vagaVazia(k));
            return caixa('banco', `Suplentes · ${banco.length}${maxBanco != null ? `/${maxBanco}` : ''}`,
              [...noBanco, ...vagas],
              bancoCheio ? 'Banco completo.' : 'Arrasta (ou toca) para pôr aqui os suplentes.', { altura: 130 });
          })()}
          {!amigavel && (() => {
            // Ordem fixa com TODOS os disponíveis; quem está na escalação fica como fantasma.
            const todosDisp = sortByPosition(players.filter(p => !indisponivel(p)));
            return caixa('fora', `${amigavel ? 'Não presentes' : 'Não convocados'} · ${foraDisp.length}`,
              todosDisp.map(p => (naEscalacao.has(p.id) ? cartaoFantasma(p) : cartaoJogador(p, { de: 'fora', id: p.id }))),
              'Todos os jogadores disponíveis estão na escalação.', { altura: 190 });
          })()}
          {(() => {
            const todosIndisp = sortByPosition(players.filter(p => indisponivel(p)));
            if (!todosIndisp.length) return null;
            return caixa('indisp', `Indisponíveis · ${foraIndisp.length}`,
              todosIndisp.map(p => (naEscalacao.has(p.id) ? cartaoFantasma(p) : cartaoJogador(p, { de: 'fora', id: p.id }, (estado(p) || {}).curto || 'Indisponível'))),
              '', { altura: 80, cor: T.bad, semZona: true, semToque: true });
          })()}
        </div>
      </div>

      {/* O jogador arrastado segue o rato. */}
      {arrastado && arrasto && createPortal(
        <div style={{ position: 'fixed', left: arrasto.x, top: arrasto.y, transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 9999 }}>
          {fotoBola(arrastado, 42, true)}
        </div>,
        document.body,
      )}
    </div>
  );
}

/* Do jogo para o campo: lugares (pelo alinhamento, se houver) + banco. */
export function escalacaoDoJogo(f, players) {
  const formacao = f.formacao || '4-3-3';
  const porId = new Map(players.map(p => [p.id, p]));
  /* Lugares gravados (um por lugar) mandam — como na convocatória. Assim o
     jogo e a convocatória mostram sempre o mesmo onze, mesmo que a lista
     de titulares tenha ficado desencontrada dos lugares. */
  const nLugares = tamanhoDaFormacao(formacao) || 11;
  if (Array.isArray(f.alinhamento) && f.alinhamento.length === nLugares && f.alinhamento.some(Boolean)) {
    // Quem tem minutos no relatório também conta (ver `convocadosDoJogo`).
    const valido = new Set([...convocadosDoJogo(f), ...(f.starters || [])].filter(id => porId.has(id)));
    const slots = f.alinhamento.map(id => (id && valido.has(id) ? id : null));
    const usados = new Set(slots.filter(Boolean));
    const banco = [...(f.starters || []), ...convocadosDoJogo(f)].filter(id => porId.has(id) && !usados.has(id));
    return { formacao, slots, banco: [...new Set(banco)] };
  }
  const titulares = (f.starters || []).map(id => porId.get(id)).filter(Boolean);
  const { colocados, sobram } = distribuirOnzeNoCampo(titulares, formacao, f.alinhamento);
  const slots = colocados.map(p => (p ? p.id : null));
  const usados = new Set(slots.filter(Boolean));
  const banco = [...sobram.map(p => p.id), ...convocadosDoJogo(f).filter(id => !usados.has(id) && !(f.starters || []).includes(id))];
  return { formacao, slots, banco: [...new Set(banco)].filter(id => porId.has(id)) };
}

/* Da convocatória para o campo: os 11 primeiros são o onze. */
export function escalacaoDaConvocatoria(f, players) {
  const formacao = f.formacao || '4-3-3';
  const porId = new Map(players.map(p => [p.id, p]));
  const n = tamanhoDaFormacao(formacao) || 11;
  // Já arrumada no campo: os lugares mandam (mesmo com algum vazio), e o
  // resto dos convocados é banco.
  if (Array.isArray(f.alinhamento) && f.alinhamento.length === n) {
    const conv = new Set((f.convocados || []).filter(id => porId.has(id)));
    const slots = f.alinhamento.map(id => (id && conv.has(id) ? id : null));
    const usados = new Set(slots.filter(Boolean));
    return { formacao, slots, banco: (f.convocados || []).filter(id => conv.has(id) && !usados.has(id)) };
  }
  const titulares = (f.convocados || []).slice(0, n).map(id => porId.get(id)).filter(Boolean);
  const { colocados, sobram } = distribuirOnzeNoCampo(titulares, formacao, f.alinhamento);
  const slots = colocados.map(p => (p ? p.id : null));
  const banco = [...sobram.map(p => p.id), ...(f.convocados || []).slice(n)].filter(id => porId.has(id));
  return { formacao, slots, banco };
}

/* Trocar de formação mantém TODOS os titulares no campo: primeiro cada um
   no lugar da sua posição; quem não tiver lugar da sua posição na nova
   formação fica num dos lugares que sobram, mesmo fora da posição
   principal. Ninguém sai do onze por mudar o sistema. */
export function escalacaoNovaFormacao(esc, novaFormacao, players) {
  const porId = new Map(players.map(p => [p.id, p]));
  const titulares = esc.slots.filter(Boolean).map(id => porId.get(id)).filter(Boolean);
  const { colocados, sobram } = distribuirOnzeNoCampo(titulares, novaFormacao, null);
  const slots = colocados.map(p => (p ? p.id : null));
  const resto = [...sobram];
  for (let i = 0; i < slots.length && resto.length; i++) {
    if (!slots[i]) slots[i] = resto.shift().id;
  }
  return { formacao: novaFormacao, slots, banco: [...resto.map(p => p.id), ...esc.banco] };
}

/* CARTÃO "PLANO DE JOGO" — leva diretamente ao plano deste jogo (Ideia de
   Jogo › Portal › Plano de Jogo). A navegação é pedida por um evento,
   tratado na raiz da app, para não ter de passar funções por todos os
   ecrãs que mostram um jogo. */
/* IDEIAS PARA O JOGO — o texto livre do jogo (`match.ideias`), editável
   na ficha do jogo e no Plano de Jogo. Escreve-se à vontade e grava ao
   sair da caixa (não a cada tecla). */
export function NotasDoJogo({ valor, onGuardar, altura = 90 }) {
  const [texto, setTexto] = useState(valor || '');
  const focadoRef = useRef(false);
  useEffect(() => { if (!focadoRef.current) setTexto(valor || ''); }, [valor]);
  return (
    <div>
      <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, ...body }}>Ideias para o jogo</div>
      <TextArea value={texto}
        onFocus={() => { focadoRef.current = true; }}
        onChange={e => setTexto(e.target.value)}
        onBlur={() => { focadoRef.current = false; if ((texto || '') !== (valor || '')) onGuardar(texto); }}
        placeholder="Ex: pressão alta nos primeiros 15 min · sair a jogar pelo lado do 3 · atenção ao 9 deles nas bolas paradas"
        style={{ minHeight: altura }} />
    </div>
  );
}

export function abrirPlanoDoJogo(jogoId) {
  if (!jogoId || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('mjp:abrir-plano', { detail: { jogoId } }));
}

export function CartaoPlanoDoJogo({ jogo }) {
  // Discreto: um botão pequeno, sem legenda.
  const ok = !!(jogo && jogo.id);
  return (
    <button type="button" disabled={!ok} onClick={() => ok && abrirPlanoDoJogo(jogo.id)}
      title={ok ? `Abrir o plano de jogo${jogo.opponent ? ` vs ${jogo.opponent}` : ''}` : 'Disponível depois de gravar o jogo em Jogos'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, cursor: ok ? 'pointer' : 'default', flexShrink: 0,
        background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 8, padding: '6px 10px 6px 9px',
        color: T.cream, opacity: ok ? 1 : 0.5, fontSize: 12.5, whiteSpace: 'nowrap', ...body,
      }}>
      <Target size={14} color={T.gold} />
      Plano de jogo
      {ok && <ChevronRight size={14} color={T.mutedDim} />}
    </button>
  );
}

/* CASTIGOS — quem foi expulso num jogo OFICIAL fica indisponível nos
   jogos oficiais seguintes (aparece em Indisponíveis, como os lesionados,
   e não entra no "Selecionar todos"). Os amigáveis não contam.
   · 2.º amarelo: 1 jogo, ou o número escolhido no relatório (0 = anulado).
   · Vermelho direto: o número de jogos escrito no relatório desse jogo
     ("Castigo"). Enquanto estiver "Por definir", fica indisponível em
     todos os jogos oficiais seguintes, até alguém o definir. 0 = anulado.
   Cada jogo oficial da equipa depois do da expulsão (já jogado ou só
   marcado) conta como um jogo de castigo cumprido. */
export function jogosDeCastigo(r) {
  if (!r) return 0;
  if (r.card === 'yellow2') {
    // 1 jogo, salvo se o relatório disser outro número (0 = anulado).
    const v = r.castigoJogos;
    if (v === '' || v == null) return 1;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 1;
  }
  if (r.card !== 'red') return 0;
  const v = r.castigoJogos;
  if (v === '' || v == null) return Infinity; // por definir
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : Infinity;
}

export function castigadosParaJogo(matches, data, jogoId) {
  const out = new Map();
  if (!data) return out;
  const oficiais = (matches || [])
    .filter(m => m && m.date && m.id !== jogoId && !isFriendlyMatch(m) && !jogoNaoJogado(m))
    .sort((a, b) => a.date.localeCompare(b.date));
  oficiais.filter(m => m.date < data).forEach(m => {
    Object.entries(m.report || {}).forEach(([pid, r]) => {
      const n = jogosDeCastigo(r);
      if (!n) return;
      // Jogos oficiais entre o da expulsão e este (já cumpridos).
      const cumpridos = oficiais.filter(x => x.date > m.date && x.date < data).length;
      if (cumpridos >= n) return;
      const motivo = `${r.card === 'red' ? 'vermelho' : '2.º amarelo'} vs ${m.opponent || 'jogo anterior'}`;
      out.set(pid, n === Infinity
        ? `Castigo por definir (${motivo})`
        : n === 1 ? `Castigo (${motivo})` : `Castigo · jogo ${cumpridos + 1} de ${n} (${motivo})`);
    });
  });
  return out;
}

/* ONZE NO CAMPO + SUPLENTES COM FOTO, PARA IMPRIMIR (ficha do jogo e
   ficha técnica da convocatória). Campo vertical de linhas finas sobre
   branco (poupa tinta); fotos redondas, número e nome. */
/* Altura de cada lugar no campo impresso (ataque para cima). O GR fica
   em baixo, com o nome dentro da pequena área; quem calha na linha do
   meio-campo sobe um pouco, para o nome ficar ACIMA da linha e não a
   cortá-la. */
/* O mesmo no ecrã (Editar jogo, Convocatória, jogo no Planeamento) e no
   ficheiro partilhado: GR em baixo, com o nome na pequena área; os médios
   que calham na linha do meio sobem, com o nome acima da linha. */
export function topNoCampoEcra(lx, ly) {
  // GR: bola um pouco acima da linha de fundo, com o NOME em cima dela.
  // Médios na linha do meio: bola acima, com o NOME em cima da linha.
  const t = 3 + (1 - lx) * 95;
  if (t > 41 && t < 54) return 44.5;
  /* CENTRAIS (e quem calhar à frente da nossa grande área): o nome fica
     assente logo por cima da linha da grande área (antes cortava-a). Só dentro da largura da área (os laterais, mais
     abertos, ficam onde estão). O nome está ~6 % abaixo do centro da bola. */
  const x = ly == null ? 50 : 6 + ly * 88;
  if (x > 19 && x < 81 && t > 71 && t < 81) return 77.4;
  return t;
}

export function topNoCampoPrint(lx) {
  const t = 2.5 + (1 - lx) * 93;
  return t > 44 && t < 53 ? 44 : t;
}

/* NA FOLHA IMPRESSA, O NOME É QUE MANDA: o GR tem o nome logo POR CIMA
   da linha de fundo e os médios que calham no meio têm o nome logo POR
   CIMA da linha do meio-campo, com a foto por cima do nome. O nome
   leva fundo branco, por isso nenhuma linha do campo o corta. Os outros
   ficam onde estavam (nome por baixo da foto).
   Devolve a altura (em % do campo) do CENTRO do nome. */
export const PRINT_NOME_ABAIXO = 3.6; // da bola ao centro do nome, em % do campo (142 mm)

// Meia altura do nome (7,5 pt ≈ 3,2 mm) + uma folga, em % do campo: o nome
// fica POR CIMA da linha, encostado a ela, sem lhe tocar.
export const PRINT_NOME_ACIMA_LINHA = 1.7;

export function nomeNoCampoPrint(lx) {
  const t = 2.5 + (1 - lx) * 93;
  if (t >= 88) return (103.5 / 105) * 100 - PRINT_NOME_ACIMA_LINHA; // GR: por cima da linha de fundo
  if (t > 44 && t < 53) return 50 - PRINT_NOME_ACIMA_LINHA;          // médios: por cima da linha do meio-campo
  return t + PRINT_NOME_ABAIXO;
}

/* `extra(pid, 'campo' | 'banco')`, opcional: o que se escreve junto de cada
   jogador (ex.: golos, cartões, substituições, na ficha de um jogo já
   jogado). Sem `extra`, a folha fica como sempre foi (convocatória). */
export function EscalacaoPrint({ players, formacao, slots, banco, capitao, subcapitao, extra }) {
  const lugares = FORMACOES[formacao] || FORMACOES['4-3-3'];
  const layout = LAYOUT_FORMACAO[formacao] || LAYOUT_FORMACAO['4-3-3'];
  const porId = new Map(players.map(p => [p.id, p]));
  const marca = (pid) => (pid === capitao ? ' (C)' : pid === subcapitao ? ' (SC)' : '');
  const foto = (p, mm) => (
    <span style={{
      width: `${mm}mm`, height: `${mm}mm`, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center', border: '1px solid #555', background: '#eee', color: '#111', fontWeight: 700, fontSize: `${mm * 1.1}pt`,
    }}>{p.photo ? <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (p.number || '')}</span>
  );
  // Suplentes por número da camisola (sem número, no fim), como na convocatória.
  const porNumero = (a, b) => {
    const na = Number.isFinite(Number(a.number)) && String(a.number).trim() !== '' ? Number(a.number) : Infinity;
    const nb = Number.isFinite(Number(b.number)) && String(b.number).trim() !== '' ? Number(b.number) : Infinity;
    return na - nb || String(a.name || '').localeCompare(String(b.name || ''), 'pt');
  };
  const suplentes = banco.map(id => porId.get(id)).filter(Boolean).sort(porNumero);
  return (
    <div style={{ display: 'flex', gap: '8mm', alignItems: 'flex-start', marginTop: '7mm', marginBottom: 14, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
      <div style={{ flex: '0 0 92mm' }}>
        <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>Onze inicial</h3>
        <div style={{ position: 'relative', width: '92mm', height: '142mm', border: '1px solid #999', borderRadius: 4 }}>
          <svg viewBox="0 0 68 105" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <g fill="none" stroke="#aaa" strokeWidth="0.3">
              <rect x="1.5" y="1.5" width="65" height="102" />
              <line x1="1.5" y1="52.5" x2="66.5" y2="52.5" />
              <circle cx="34" cy="52.5" r="9.15" />
              <rect x="13.84" y="1.5" width="40.32" height="16.5" />
              <rect x="24.84" y="1.5" width="18.32" height="5.5" />
              <rect x="13.84" y="87" width="40.32" height="16.5" />
              <rect x="24.84" y="98" width="18.32" height="5.5" />
            </g>
          </svg>
          {lugares.map((lugar, i) => {
            const [lx, ly] = layout[i] || [0.5, 0.5];
            const p = slots[i] ? porId.get(slots[i]) : null;
            return (
              p ? (
                /* Ancorado no NOME: o centro do nome fica na altura dada;
                   a foto fica logo por cima. */
                <div key={i} style={{ position: 'absolute', left: `${6 + ly * 88}%`, top: `${nomeNoCampoPrint(lx)}%`, transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '24mm' }}>
                  <span style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '0.2mm', display: 'flex' }}>{foto(p, 10)}</span>
                  <span style={{ fontSize: '7.5pt', fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '24mm', textAlign: 'center', background: '#fff', padding: '0 1mm', borderRadius: '1mm', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                    {p.number ? `${p.number} ` : ''}{shortPlayerName(p, players)}{marca(p.id)}
                  </span>
                  {extra ? extra(p.id, 'campo') : null}
                </div>
              ) : (
                <div key={i} style={{ position: 'absolute', left: `${6 + ly * 88}%`, top: `${topNoCampoPrint(lx)}%`, transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '24mm' }}>
                  <span style={{ fontSize: '7pt', color: '#999' }}>{rotuloDoLugar(lugar)}</span>
                </div>
              )
            );
          })}
        </div>
        <div style={{ fontSize: '8pt', color: '#666', marginTop: 3 }}>Sistema {formacao}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>Suplentes ({suplentes.length})</h3>
        {suplentes.length === 0 ? <div style={{ fontSize: '10pt', color: '#777' }}>—</div> : suplentes.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '3mm', padding: '1.2mm 0', borderBottom: '1px solid #e2e2e2', fontSize: '10.5pt', breakInside: 'avoid' }}>
            {foto(p, 8)}
            <span style={{ width: '7mm', textAlign: 'right', color: '#666', ...mono }}>{p.number || ''}</span>
            <span>{p.name}{marca(p.id)}</span>
            {extra ? <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1.2mm', flexShrink: 0 }}>{extra(p.id, 'banco')}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function withConvocadosInAttendance(f) {
  const convocados = f.convocados || [];
  const ratings = { ...(f.ratings || {}) };
  Object.keys(ratings).forEach(pid => { if (!convocados.includes(pid)) delete ratings[pid]; });
  return { ...f, attendance: [...convocados], ratings };
}

/* JOGOS E TREINOS PASSADOS COM OS DADOS VERDADEIROS. Quem saiu do clube
   não aparece na app, MAS um jogo ou treino em que ele esteve tem de se
   ver como foi: lugar no onze, banco, convocatória, minutos, avaliações.
   Junta-se à lista dos ativos quem saiu e está referido neste registo. */
export const TODOS_OS_JOGADORES = { lista: [] };

export function comQuemLaEsteve(ativos, registo) {
  const base = ativos || [];
  if (!registo) return base;
  const ids = new Set(base.map(p => p.id));
  let txt = '';
  try { txt = JSON.stringify(registo); } catch (e) { return base; }
  const extra = (TODOS_OS_JOGADORES.lista || []).filter(p => p && !ids.has(p.id) && p.id && txt.includes(`"${p.id}"`));
  return extra.length ? [...base, ...extra] : base;
}

