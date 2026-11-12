// treino/EscolherParaCopiar.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useIsMobile, Btn } from '../base/ui';
import { semAcentos, timeAgo } from '../base/utilidades';
import { T, mono, body } from '../base/tema';
import { momentoTexto } from '../dominio/treino';
import { ChevronLeft, Copy, ChevronRight, Search, Check, Pencil } from 'lucide-react';
import { useRodaDoRato } from './comum';
import { CARTAO_ASPECT, DiagramThumbAnimado } from './diagramas';

/* ESCOLHER DE ONDE COPIAR — ideias e exercícios.

   Só aparecem os da FASE DE JOGO que está escolhida no formulário: quem
   está a criar uma ideia de Organização Defensiva não quer ver as de
   Transição Ofensiva.

   Os nomes, sozinhos, enganam ("Pressão alta…", "Pressão quebrada…"):
   o que um treinador reconhece de relance é o DESENHO. Por isso cada
   opção é um cartão com o esquema tático em miniatura, o nome, quando
   foi mexido pela última vez e, nos exercícios, espaço / jogadores /
   duração.

   Tocar num cartão NÃO copia logo — abre a pré-visualização em grande
   (com a descrição) e só o "Usar" copia. Copiar substitui o esquema que
   já estiver desenhado; um toque ao lado não pode deitar isso fora. */
export const COPIAR_ORDENS = [
  { id: 'az', label: 'A–Z' },
  { id: 'criado', label: 'Criação' },
];

/* MODO ESCOLHA MÚLTIPLA (`onAlternar`): usado na edição da sessão de
   treino. Os mesmos cartões, a mesma procura, ordem e barra; mas tocar
   num cartão junta-o à sessão (ou tira-o), sem abrir a pré-visualização.
   Os escolhidos ficam com o visto e a borda dourada. Sem `onAlternar`,
   tudo funciona exatamente como antes (copiar ideia/exercício). */
export function EscolherParaCopiar({ itens, tipo, fase, meta, nomeDe, detalhesDe, temDesenhoAtual, onUsar, selecionados, onAlternar, minutosDe, onMinutos, onEditar, onLimparTodos }) {
  const multi = typeof onAlternar === 'function';
  const escolhidosSet = React.useMemo(() => new Set(selecionados || []), [selecionados]);
  // Posição de cada escolhido na sessão (1, 2, 3…), para o número no cartão.
  const ordemNaSessao = React.useMemo(() => new Map((selecionados || []).map((id, i) => [id, i + 1])), [selecionados]);
  // "Na sessão": mostra só os escolhidos, pela ordem da sessão.
  const [soNaSessao, setSoNaSessao] = useState(false);
  const [confirmarLimpar, setConfirmarLimpar] = useState(false);
  const limparTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(limparTimerRef.current), []);
  const isMobile = useIsMobile(700);
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState(null);
  const [aberto, setAberto] = useState(null); // cartão debaixo do rato
  const [pagina, setPagina] = useState(0);
  /* ALTURA FIXA entre a lista e a pré-visualização: ao abrir um cartão,
     a pré-visualização fica com a mesma altura da lista (desliza por
     dentro se precisar), por isso os botões de baixo e o resto da
     página não saltam. */
  const alturaListaRef = useRef(0);

  /* ORDEM — A–Z ou por criação (mais recentes primeiro). Fica lembrada
     de uma vez para a outra. A ordem de criação é a
     própria ordem da lista: as coleções chegam do servidor por
     created_at, e os novos entram sempre no fim. */
  const chaveOrdem = 'misterjp:copiar-ordem';
  const [ordem, setOrdemEstado] = useState(() => {
    try { const o = localStorage.getItem(chaveOrdem); return COPIAR_ORDENS.some(x => x.id === o) ? o : 'az'; } catch (e) { return 'az'; }
  });
  const setOrdem = (o) => {
    setOrdemEstado(o); setPagina(0);
    try { localStorage.setItem(chaveOrdem, o); } catch (e) { /* sem memória, sem problema */ }
  };

  /* UMA LINHA DE CADA VEZ. Quantos cartões cabem numa linha depende da
     largura (2 no telemóvel, até 6 num ecrã largo); mede-se a grelha e
     mostra-se só essa linha. Com 1000 exercícios na fase, nunca se
     desenham mais do que esses — o resto está a uma seta (ou um gesto
     de deslizar) de distância. */
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
  const GAP = 8;
  const MIN = isMobile ? 140 : 180;
  const porLinha = largura ? Math.max(2, Math.min(6, Math.floor((largura + GAP) / (MIN + GAP)))) : (isMobile ? 2 : 5);

  const ordenados = React.useMemo(() => {
    if (multi && soNaSessao) {
      const porId = new Map(itens.map(x => [x.id, x]));
      return (selecionados || []).map(id => porId.get(id)).filter(Boolean);
    }
    const lista = itens.map((x, i) => ({ x, i }));
    if (ordem === 'az') {
      lista.sort((p, q) => String(nomeDe(p.x)).localeCompare(String(nomeDe(q.x)), 'pt', { sensitivity: 'base', numeric: true }));
    } else {
      lista.sort((p, q) => q.i - p.i);
    }
    return lista.map(p => p.x);
  }, [itens, ordem, nomeDe, multi, soNaSessao, selecionados]);
  // Sem acentos nem maiúsculas: "pressao" encontra "Pressão".
  const semAcentos = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const q = semAcentos(busca.trim());
  const visiveis = q
    ? ordenados.filter(x => semAcentos([nomeDe(x), x.description, ...(detalhesDe ? detalhesDe(x) : [])].filter(Boolean).join(' ')).includes(q))
    : ordenados;

  /* DESLIZAR CARTÃO A CARTÃO (não aos saltos de linha inteira): o
     `pagina` guarda o índice do PRIMEIRO cartão visível. As setas andam
     uma linha; a barra dourada é um "polegar" do tamanho do que se vê e
     arrasta-se suavemente, cartão a cartão. */
  const totalPaginas = Math.max(1, Math.ceil(visiveis.length / porLinha));
  const maxInicio = Math.max(0, visiveis.length - porLinha);
  const pag = Math.min(pagina, maxInicio); // índice do 1.º cartão visível
  const daPagina = visiveis.slice(pag, pag + porLinha);
  const irParaInicio = (i) => setPagina(Math.max(0, Math.min(maxInicio, Math.round(i))));
  const irPara = (passo) => irParaInicio(pag + passo * porLinha); // passo: -1 / +1 linha
  const barraRef = useRef(null);
  const arrastarRef = useRef(false);
  const agarreRef = useRef(0);
  const [arrastar, setArrastar] = useState(false);
  const fracPolegar = visiveis.length ? Math.min(1, porLinha / visiveis.length) : 1;
  const fracInicio = visiveis.length ? pag / visiveis.length : 0;
  const fracDoX = (clientX) => {
    const el = barraRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return (clientX - r.left) / r.width;
  };
  // Roda do rato: anda cartão a cartão (ver useRodaDoRato).
  const rodaRef = useRodaDoRato((dir, soTestar) => {
    const pode = dir > 0 ? pag < maxInicio : pag > 0;
    if (pode && !soTestar) irParaInicio(pag + dir);
    return pode;
  });

  // Deslizar no telemóvel.
  const toqueX = useRef(null);
  const aoTocar = (e) => { toqueX.current = e.touches[0].clientX; };
  const aoLargar = (e) => {
    if (toqueX.current == null) return;
    const dx = e.changedTouches[0].clientX - toqueX.current;
    toqueX.current = null;
    if (Math.abs(dx) > 40) irPara(dx < 0 ? 1 : -1);
  };

  const atual = escolhido && itens.find(x => x.id === escolhido);
  const editadoHa = (x) => {
    const m = meta && meta[x.id];
    return m && m.at ? `editado ${timeAgo(m.at)}` : '';
  };
  const temEsquema = (x) => !!(x.diagram && ((x.diagram.elements || []).length || (x.diagram.arrows || []).length));

  if (atual) {
    const det = detalhesDe ? detalhesDe(atual) : [];
    return (
      <div style={{ marginTop: 10, border: `1px solid ${T.gold}`, borderRadius: 10, background: T.surface, padding: 12,
        boxSizing: 'border-box', overflowAnchor: 'none',
        ...(alturaListaRef.current ? { height: alturaListaRef.current, overflowY: 'auto' } : {}) }}>
        <div style={{ display: 'flex', gap: 14, flexDirection: isMobile ? 'column' : 'row' }}>
          <div style={{ flex: isMobile ? 'none' : '0 0 46%' }}>
            {temEsquema(atual)
              ? <DiagramThumbAnimado diagram={atual.diagram} space={atual.space} phase={atual.phase} height={isMobile ? 200 : 240} />
              : <div style={{ height: 120, borderRadius: 6, background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.mutedDim, fontSize: 12 }}>Sem esquema desenhado</div>}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ color: T.cream, fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>{nomeDe(atual)}</div>
            <div style={{ color: T.mutedDim, fontSize: 12 }}>{[momentoTexto(atual), editadoHa(atual)].filter(Boolean).join(' · ')}</div>
            {det.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {det.map(d => <span key={d} style={{ fontSize: 11.5, color: T.cream, background: T.bg, border: `1px solid ${T.line}`, borderRadius: 10, padding: '2px 8px' }}>{d}</span>)}
              </div>
            )}
            {atual.description && (
              <div style={{ color: T.muted, fontSize: 12.5, lineHeight: 1.5, maxHeight: 140, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>{atual.description}</div>
            )}
            <div style={{ flex: 1 }} />
            {temDesenhoAtual && (
              <div style={{ fontSize: 11.5, color: T.warn }}>O esquema que já desenhaste aqui vai ser substituído por este.</div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Btn variant="ghost" onClick={() => setEscolhido(null)}><ChevronLeft size={14} /> Voltar à lista</Btn>
              <Btn onClick={() => onUsar(atual)}><Copy size={14} /> Usar {tipo === 'ideia' ? 'esta ideia' : 'este exercício'}</Btn>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
    <div ref={el => { if (el) alturaListaRef.current = el.offsetHeight; rodaRef(el); }}
      style={{ marginTop: 10, border: `1px solid ${T.line}`, borderRadius: 10, background: T.surface, padding: 10, boxSizing: 'border-box', overflowAnchor: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        {/* Na sessão (multi) o rótulo tem LARGURA FIXA: trocar para "todas
            as fases" ou mudar as contagens não empurra a procura. */}
        <div style={{ fontSize: 12, color: T.muted, ...(multi ? {
          flex: isMobile ? '1 1 100%' : '0 0 360px', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        } : {}) }}>
          {multi ? (
            /* Cada parte num espaço de largura fixa: trocar de fase para
               "todas as fases" ou mudar os números não desloca nada. */
            /* Sem o número total: a contagem já está nos cartões ("1–5 de 21"). */
            <>Exercícios de <span style={{ color: T.cream, display: 'inline-block', width: 140, verticalAlign: 'bottom', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fase}</span></>
          ) : (
            <>{tipo === 'ideia' ? 'Ideias' : 'Exercícios'} de <span style={{ color: T.cream }}>{fase}</span> · {itens.length}</>
          )}
          {/* Sempre no lugar (escondido quando é 0) e com largura fixa:
              escolher ou tirar não pode empurrar a caixa da procura. */}
          {multi && (() => {
            const n = itens.filter(x => escolhidosSet.has(x.id)).length;
            return <span style={{ color: T.gold, display: 'inline-block', minWidth: '9.5ch', visibility: n ? 'visible' : 'hidden' }}> · <span style={{ ...mono }}>{n}</span> na sessão</span>;
          })()}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={14} color={T.mutedDim} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={busca}
            onChange={e => { setBusca(e.target.value); setPagina(0); }}
            placeholder={tipo === 'ideia' ? 'Procurar ideia…' : 'Procurar por nome, material, descrição…'}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 30px', borderRadius: 8,
              border: `1px solid ${T.line}`, background: T.surfaceRaise, color: T.cream, fontSize: 13, ...body, outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Ordem + paginação */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: 3 }}>
          {COPIAR_ORDENS.map(o => {
            const on = ordem === o.id && !(multi && soNaSessao);
            return (
            <button key={o.id} type="button" onClick={() => { setOrdem(o.id); setSoNaSessao(false); }} style={{
              padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, ...body,
              background: on ? T.surfaceRaise : 'transparent', color: on ? T.cream : T.mutedDim,
              fontWeight: on ? 600 : 400,
            }}>{o.label}</button>
            );
          })}
          {multi && (
            <button type="button" onClick={() => { setSoNaSessao(true); setPagina(0); }} title="Ver só os exercícios desta sessão, pela ordem" style={{
              padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, ...body,
              background: soNaSessao ? T.surfaceRaise : 'transparent', color: soNaSessao ? T.gold : T.mutedDim,
              fontWeight: soNaSessao ? 600 : 400, whiteSpace: 'nowrap',
            }}>Na sessão <span style={{ ...mono }}>{(selecionados || []).length}</span></button>
          )}
        </div>
        {/* TIRAR TODOS de uma vez. Dois toques (o primeiro pede
            confirmação), porque perde também os minutos de cada um. Fica
            sempre no mesmo sítio e com a mesma largura (apagado sem
            escolhidos), para nada à volta mexer. */}
        {multi && onLimparTodos && (
          <button type="button" disabled={!(selecionados || []).length}
            onClick={() => {
              if (!confirmarLimpar) { setConfirmarLimpar(true); clearTimeout(limparTimerRef.current); limparTimerRef.current = setTimeout(() => setConfirmarLimpar(false), 3000); return; }
              clearTimeout(limparTimerRef.current); setConfirmarLimpar(false); onLimparTodos();
            }}
            title="Tirar todos os exercícios da sessão"
            style={{
              width: 104, padding: '5px 8px', borderRadius: 8, fontSize: 12, ...body, whiteSpace: 'nowrap',
              border: `1px solid ${confirmarLimpar ? T.bad : T.line}`, background: confirmarLimpar ? `${T.bad}22` : 'transparent',
              color: !(selecionados || []).length ? T.mutedDim : (confirmarLimpar ? T.bad : T.muted),
              opacity: (selecionados || []).length ? 1 : 0.45, cursor: (selecionados || []).length ? 'pointer' : 'default',
            }}>{confirmarLimpar ? 'Confirmar' : 'Tirar todos'}</button>
        )}
        <div style={{ flex: 1 }} />
        {/* Sempre presente (mesmo sem resultados): a altura não muda. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {seta(-1)}
          <span style={{ ...mono, fontSize: 12, color: T.muted, width: 108, flexShrink: 0, textAlign: 'center', whiteSpace: 'nowrap' }}>
            {visiveis.length ? `${pag + 1}–${Math.min(visiveis.length, pag + porLinha)}` : '0'} de {visiveis.length}
          </span>
          {seta(1)}
        </div>
      </div>

      {visiveis.length === 0 ? (
        /* Sem resultados: um cartão invisível segura a altura da linha,
           para a página não encolher (e saltar) enquanto se escreve. */
        <div ref={gridRef} style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${porLinha}, minmax(0, 1fr))`, gap: GAP }}>
          <div aria-hidden="true" style={{ visibility: 'hidden', padding: 6, border: '1px solid transparent' }}>
            <div style={{ height: isMobile ? 78 : 92, marginBottom: 8 }} />
            <div style={{ fontSize: 12.5, lineHeight: 1.3, minHeight: 33 }}>&nbsp;</div>
            <div style={{ fontSize: 10.5, padding: '3px 2px 0' }}>&nbsp;</div>
          </div>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, color: T.mutedDim }}>
            Nenhum resultado.
          </div>
        </div>
      ) : (
        <div
          ref={gridRef}
          onTouchStart={aoTocar}
          onTouchEnd={aoLargar}
          style={{ display: 'grid', gridTemplateColumns: `repeat(${porLinha}, minmax(0, 1fr))`, gap: GAP }}
        >
          {daPagina.map(x => {
            const det = detalhesDe ? detalhesDe(x) : [];
            const sobre = aberto === x.id;
            const marcado = multi && escolhidosSet.has(x.id);
            // No modo escolha múltipla o cartão tem um campo de minutos lá
            // dentro: um <input> não pode viver dentro de um <button>, por
            // isso aí o cartão é um <div> com papel de botão.
            const Cartao = multi ? 'div' : 'button';
            return (
              <Cartao
                key={x.id}
                {...(multi
                  ? { role: 'button', tabIndex: 0, onKeyDown: (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onAlternar(x); } } }
                  : { type: 'button' })}
                aria-pressed={multi ? marcado : undefined}
                title={multi ? (marcado ? 'Tirar da sessão' : 'Juntar à sessão') : undefined}
                onClick={() => (multi ? onAlternar(x) : setEscolhido(x.id))}
                onMouseEnter={() => setAberto(x.id)}
                onMouseLeave={() => setAberto(a => (a === x.id ? null : a))}
                style={{
                  display: 'flex', flexDirection: 'column', textAlign: 'left', padding: 6, borderRadius: 8, cursor: 'pointer', ...body,
                  border: `1px solid ${marcado || sobre ? T.gold : T.line}`,
                  background: marcado ? `${T.crimson}40` : T.surfaceRaise, color: T.cream, minWidth: 0,
                  position: 'relative', boxShadow: marcado ? `inset 0 0 0 1px ${T.gold}` : 'none',
                }}
              >
                {multi && (
                  <span aria-hidden="true" style={{
                    position: 'absolute', top: 10, left: 10, zIndex: 2, width: 20, height: 20, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: marcado ? T.gold : 'rgba(0,0,0,0.45)', border: `1.5px solid ${marcado ? T.gold : 'rgba(255,255,255,0.55)'}`,
                    color: '#1a1a1a',
                    ...mono, fontSize: 11, fontWeight: 700,
                  }}>{marcado ? (ordemNaSessao.get(x.id) || <Check size={13} strokeWidth={3} />) : null}</span>
                )}
                {/* LÁPIS: editar o exercício sem sair da sessão. Não junta
                    nem tira o exercício (o toque fica só no lápis). */}
                {multi && onEditar && (
                  <span role="button" tabIndex={0} title="Editar este exercício" aria-label="Editar este exercício"
                    onClick={(e) => { e.stopPropagation(); onEditar(x); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onEditar(x); } }}
                    style={{
                      position: 'absolute', top: 10, right: 10, zIndex: 2, width: 24, height: 24, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.35)', color: '#fff',
                    }}><Pencil size={12} /></span>
                )}
                {temEsquema(x)
                  ? <DiagramThumbAnimado key={`${x.id}|${pag}`} diagram={x.diagram} space={x.space} phase={x.phase} height={isMobile ? 78 : 92} />
                  : <div style={{ aspectRatio: CARTAO_ASPECT, marginBottom: 8, borderRadius: 6, background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.mutedDim, fontSize: 11 }}>Sem esquema</div>}
                <div style={{
                  fontSize: 12.5, color: T.cream, lineHeight: 1.3, padding: '0 2px',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 33,
                }}>{nomeDe(x)}</div>
                {multi ? (
                  /* Altura fixa: com ou sem o campo dos minutos, o cartão
                     tem sempre o mesmo tamanho. */
                  <div style={{ height: 24, display: 'flex', alignItems: 'center', gap: 5, padding: '3px 2px 0', minWidth: 0 }}>
                    {marcado && onMinutos ? (
                      <>
                        <input
                          type="number" min={0} value={minutosDe ? minutosDe(x) : ''}
                          onClick={e => e.stopPropagation()}
                          onKeyDown={e => e.stopPropagation()}
                          onChange={e => onMinutos(x, e.target.value)}
                          title="Minutos deste exercício na sessão"
                          style={{
                            width: 52, height: 22, boxSizing: 'border-box', padding: '1px 5px', borderRadius: 5, fontSize: 12, ...mono,
                            border: `1px solid ${T.gold}88`, background: T.bg, color: T.cream, outline: 'none',
                          }}
                        />
                        <span style={{ fontSize: 10.5, color: T.mutedDim }}>min</span>
                      </>
                    ) : (
                      <span style={{ fontSize: 10.5, color: T.mutedDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[...det, editadoHa(x)].filter(Boolean).join(' · ') || ' '}
                      </span>
                    )}
                  </div>
                ) : (
                <div style={{ fontSize: 10.5, color: T.mutedDim, padding: '3px 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[...det, editadoHa(x)].filter(Boolean).join(' · ') || ' '}
                </div>
                )}
              </Cartao>
            );
          })}
          {/* Lugares vazios na última linha: a altura não muda entre páginas. */}
          {Array.from({ length: porLinha - daPagina.length }, (_, i) => <div key={`v${i}`} />)}
        </div>
      )}

      {/* BARRA DE POSIÇÃO — onde estou na lista. Tocar salta para lá; e
          ARRASTA-SE: carregar e puxar para o lado vai passando as linhas
          (rato e dedo). Está sempre lá, mesmo com uma página só (cheia e
          apagada), para a caixa nunca mudar de altura. */}
      <div style={{ marginTop: 6 }}>
        <div
          ref={barraRef}
          onPointerDown={(e) => {
            if (totalPaginas <= 1) return;
            e.preventDefault();
            arrastarRef.current = true; setArrastar(true);
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* sem captura, segue */ }
            // Agarrar no polegar mantém o ponto agarrado; tocar fora dele
            // centra o polegar onde se tocou.
            const f = fracDoX(e.clientX);
            agarreRef.current = (f >= fracInicio && f <= fracInicio + fracPolegar) ? f - fracInicio : fracPolegar / 2;
            irParaInicio((f - agarreRef.current) * visiveis.length);
          }}
          onPointerMove={(e) => { if (arrastarRef.current) irParaInicio((fracDoX(e.clientX) - agarreRef.current) * visiveis.length); }}
          onPointerUp={() => { arrastarRef.current = false; setArrastar(false); }}
          onPointerCancel={() => { arrastarRef.current = false; setArrastar(false); }}
          title={totalPaginas > 1 ? 'Arrasta ou toca para andar na lista' : undefined}
          style={{
            position: 'relative', height: 18, display: 'flex', alignItems: 'center', touchAction: 'none', userSelect: 'none',
            cursor: totalPaginas > 1 ? (arrastar ? 'grabbing' : 'pointer') : 'default',
          }}
        >
          <div style={{ position: 'relative', width: '100%', height: 6, borderRadius: 3, background: T.bg }}>
            <div style={{
              position: 'absolute', top: arrastar ? -2 : 0, bottom: arrastar ? -2 : 0, borderRadius: 3,
              background: T.gold, opacity: totalPaginas > 1 ? 1 : 0.25,
              left: `${fracInicio * 100}%`, width: `${Math.max(4, fracPolegar * 100)}%`,
              transition: arrastar ? 'none' : 'left .15s', cursor: totalPaginas > 1 ? (arrastar ? 'grabbing' : 'grab') : 'default',
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}

