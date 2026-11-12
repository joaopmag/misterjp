// base/ui.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, Trash2, MessageCircle, Undo2, X, ChevronLeft } from 'lucide-react';
import { uid } from './utilidades';
import { T, TEXT_ON_ACCENT, T_ESCURO, body, display } from './tema';

/* ---------------------------------------------------------------
   ANULAR — rede de segurança para eliminações acidentais

   Um clique a mais no caixote apagava um exercício, um jogador ou uma
   sessão sem hipótese de recuperar. Em vez de pôr uma confirmação em
   cada botão (que se acaba por carregar em automático e não protege
   nada), o item é removido na mesma e fica uma barra em baixo, durante
   alguns segundos, com a opção "Anular".

   A reposição usa o MESMO id do registo. Isso é importante: o id é o que
   liga um exercício às sessões onde está, um jogador às convocatórias e
   às presenças, um jogo às notas. Repor com id novo partia essas
   ligações; repor com o id original devolve tudo exatamente como estava.
---------------------------------------------------------------- */
export const UNDO_SECONDS = 12;

// Só há uma barra montada de cada vez (fica na App, ao lado do conteúdo).
export let undoHandler = null;

export function offerUndo(message, onUndo) {
  if (typeof undoHandler === 'function') undoHandler({ key: uid(), message, onUndo });
}

/* Pedido de confirmação — a primeira das duas redes. Também é global:
   quem chama não precisa de gerir estado nenhum. */
export let confirmHandler = null;

export function askConfirm(pedido) {
  if (typeof confirmHandler === 'function') { confirmHandler({ key: uid(), ...pedido }); return; }
  // Sem diálogo montado (não devia acontecer), não se apaga nada em
  // silêncio: é preferível não fazer nada do que apagar sem confirmação.
}

export function removeWithUndo(list, setList, id, label, depois) {
  const alvo = (list || []).find(x => x.id === id);
  if (!alvo) return;
  askConfirm({
    label,
    onConfirm: () => {
      setList(prev => prev.filter(x => x.id !== id));
      if (typeof depois === 'function') depois();
      offerUndo(`${label} apagado.`, () => {
        // Funcional e à prova de repetições: se entretanto o registo voltou
        // (por exemplo por sincronização de outro dispositivo), não duplica.
        setList(prev => (prev.some(x => x.id === id) ? prev : [...prev, alvo]));
      });
    },
  });
}

export function ConfirmDialog() {
  const [pedido, setPedido] = useState(null);
  // Só para quando o pedido pede para escrever uma palavra/nome antes de
  // deixar confirmar (ex.: apagar uma equipa). Reinicia sempre que muda
  // o pedido — inclusive quando um pedido é substituído por outro
  // encadeado (ver a nota em `confirmar`), para não sobrar texto escrito
  // no diálogo anterior.
  const [digitado, setDigitado] = useState('');

  useEffect(() => {
    confirmHandler = (next) => { setDigitado(''); setPedido(next); };
    return () => { confirmHandler = null; };
  }, []);

  // Aqui o Esc PODE fechar (ao contrário das janelas de edição): fechar
  // este diálogo é cancelar, nunca destrói nada.
  useEffect(() => {
    if (!pedido) return;
    const onKey = (e) => { if (e.key === 'Escape') setPedido(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pedido]);

  if (!pedido) return null;

  const precisaTexto = !!pedido.confirmText;
  const textoBate = !precisaTexto
    || digitado.trim().toLowerCase() === String(pedido.confirmText).trim().toLowerCase();

  const confirmar = () => {
    if (!textoBate) return;
    /* `onConfirm` pode, ele próprio, chamar `askConfirm` outra vez — é o
       caso de "apagar equipa", que encadeia um segundo diálogo (a última
       confirmação) a seguir a este. Se se fechasse sempre com
       `setPedido(null)` no fim, isso apagava esse segundo diálogo mesmo
       antes de ele chegar a aparecer. Por isso só se fecha AQUI se
       ninguém tiver posto um pedido novo entretanto. */
    const pedidoAntes = pedido;
    try { pedido.onConfirm(); } catch (e) { console.error(e); }
    setPedido(prev => (prev === pedidoAntes ? null : prev));
  };

  return createPortal(
    <div
      onClick={() => setPedido(null)}
      style={{
        // Sempre por cima de tudo (antes ficava escondida atrás do leitor de
        // clipes da Análise, que está a 1000, e só aparecia ao fechá-lo).
        position: 'fixed', inset: 0, background: '#000000bb', zIndex: 3000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.surfaceRaise, border: `1px solid ${T.line}`, borderRadius: 10,
          width: '100%', maxWidth: 460, padding: 22, boxShadow: '0 20px 60px #00000090',
        }}
      >
        <h3 style={{ ...display, color: T.warn, fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>{pedido.title || 'Apagar?'}</h3>
        <p style={{ color: T.cream, fontSize: 13.5, margin: '0 0 4px', ...body }}>{pedido.label}</p>
        {/* Sem `note`, assume-se a rede de anular — é o caso das
            eliminações, que são a maioria. Com `note: ''`, não sai
            parágrafo nenhum: há diálogos em que o título e a linha do meio
            já dizem tudo, e acrescentar texto é só ruído a explicar o
            funcionamento a quem só quer decidir. */}
        {(() => {
          const nota = pedido.note === undefined ? 'Ainda vais poder anular durante alguns segundos.' : pedido.note;
          return nota
            ? <p style={{ color: T.mutedDim, fontSize: 12.5, margin: '0 0 18px', ...body }}>{nota}</p>
            : <div style={{ height: 14 }} />;
        })()}
        {precisaTexto && (
          <div style={{ margin: '0 0 18px' }}>
            <div style={{ color: T.muted, fontSize: 12.5, margin: '0 0 8px', ...body }}>
              Para confirmar, escreve: <strong style={{ color: T.cream }}>{pedido.confirmText}</strong>
            </div>
            <input
              autoFocus
              value={digitado}
              onChange={e => setDigitado(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && textoBate) confirmar(); }}
              placeholder={pedido.confirmText}
              style={{
                width: '100%', boxSizing: 'border-box', background: T.surface,
                border: `1px solid ${T.line}`, borderRadius: 8, padding: '10px 12px',
                color: T.cream, fontSize: 14, outline: 'none', ...body,
              }}
            />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn variant="ghost" onClick={() => setPedido(null)}>Cancelar</Btn>
          <Btn onClick={confirmar} disabled={!textoBate}>
            {pedido.destructive === false ? <Check size={15} /> : <Trash2 size={15} />}
            {pedido.confirmLabel || 'Apagar'}
          </Btn>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Nome legível de um registo, para a mensagem da barra.
export function itemLabel(item, fallback = 'Registo') {
  const nome = item && (item.name || item.title || item.titulo || item.focus || item.opponent || item.adversario);
  return nome ? `${fallback} "${nome}"` : fallback;
}

export function UndoBar() {
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    undoHandler = (next) => setAviso(next);
    return () => { undoHandler = null; };
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), UNDO_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [aviso]);

  if (!aviso) return null;

  return createPortal(
    <div style={{
      position: 'fixed', left: 14, right: 14, bottom: 18, zIndex: 90,
      display: 'flex', justifyContent: 'center', pointerEvents: 'none',
    }}>
      <div style={{
        pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', maxWidth: 520, background: T.surfaceRaise,
        border: `1px solid ${T.line}`, borderRadius: 10, padding: '11px 14px',
        boxShadow: '0 14px 44px #000000a0',
      }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: T.cream, ...body }}>{aviso.message}</span>
        {aviso.acao && aviso.acao.href && (
          <a
            href={aviso.acao.href} target="_blank" rel="noopener noreferrer"
            onClick={() => setAviso(null)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, textDecoration: 'none',
              background: 'transparent', color: T.cream, border: '1px solid #25D366', borderRadius: 7,
              padding: '6px 11px', fontSize: 12.5, fontWeight: 600, ...body,
            }}
          ><MessageCircle size={14} color="#25D366" /> {aviso.acao.label}</a>
        )}
        {aviso.onUndo && <button
          onClick={() => { try { aviso.onUndo(); } catch (e) { console.error(e); } setAviso(null); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
            background: '#B5393F', color: TEXT_ON_ACCENT, border: 'none', borderRadius: 7,
            padding: '7px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', ...body,
          }}
        ><Undo2 size={14} /> Anular</button>}
        <button
          onClick={() => setAviso(null)} title="Dispensar"
          style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}
        ><X size={16} /></button>
      </div>
    </div>,
    document.body
  );
}

export function Btn({ children, onClick, onMouseDown, variant = 'primary', style: s = {}, type = 'button', disabled, title, escuro }) {
  /* PROTEÇÃO CONTRA CLIQUE DUPLO, PARA TODOS OS BOTÕES DA APP DE UMA VEZ SÓ.

     Um "Guardar" que cria um registo novo gera um id novo dentro do
     próprio clique — dois cliques muito seguidos (ecrã lento a reagir,
     dedo a escorregar, duplo toque por acidente no telemóvel) disparavam
     o mesmo código duas vezes e criavam dois registos, um por clique. Foi
     exatamente este tipo de falha que já apanhámos na gravação do
     questionário (`checkin_save`) — em vez de corrigir dezenas de botões
     "Guardar" espalhados pela app um a um, a proteção fica aqui, no botão
     partilhado por todos eles.

     400 ms chega para distinguir um toque duplo por acidente (tipicamente
     bem abaixo de 300 ms de intervalo) de dois cliques a sério em botões
     diferentes ou no mesmo botão com intenção — sem se notar como atraso
     em uso normal, mesmo a navegar depressa (ex.: "Seguinte" numa
     animação). */
  const ultimoClique = useRef(0);
  const handleClick = (e) => {
    const agora = Date.now();
    if (agora - ultimoClique.current < 400) return;
    ultimoClique.current = agora;
    if (onClick) onClick(e);
  };
  const base = {
    ...body, fontSize: 13.5, fontWeight: 600, padding: '9px 16px', borderRadius: 7,
    border: '1px solid transparent', cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all .15s ease',
    opacity: disabled ? 0.5 : 1,
  };
  const variants = {
    primary: { background: '#B5393F', color: TEXT_ON_ACCENT, },
    // `escuro`: botões por cima do vídeo (sempre escuro), também no modo claro.
    ghost: { background: 'transparent', color: escuro ? T_ESCURO.cream : T.cream, border: `1px solid ${escuro ? T_ESCURO.line : T.line}` },
    danger: { background: 'transparent', color: T.bad, border: `1px solid ${T.bad}55` },
  };
  return (
    <button type={type} disabled={disabled} title={title} onMouseDown={onMouseDown} onClick={handleClick} style={{ ...base, ...variants[variant], ...s }}>
      {children}
    </button>
  );
}

/* Grelha-padrão dos formulários. Todas as caixas de um mesmo bloco devem
   viver numa ÚNICA grelha: quando se usam grelhas separadas por linha (uma
   com 3 campos, a seguir outra com 4), as caixas ficam com larguras
   diferentes de linha para linha. Campos que ocupam a linha toda usam
   FIELD_FULL. */
export const FIELD_GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 };

export const FIELD_FULL = { gridColumn: '1 / -1' };

/* `bloco` — para campos que não são uma caixa de texto.

   Um <label> do HTML transfere QUALQUER clique dentro dele para o primeiro
   controlo que contém. Isso é útil num campo normal (clicar na palavra
   "Nome" põe o cursor na caixa) e é um problema em blocos grandes:

   · no Anexo, clicar no espaço vazio ao lado dos botões abria a janela de
     escolher ficheiro — o clique ia parar ao <input type="file">;
   · no Esquema tático, clicar na margem à volta do campo dava foco ao
     primeiro botão da barra de ferramentas, e o browser rolava a janela
     para o trazer à vista — era o "salta para cima".

   Com `bloco`, a etiqueta continua a ser um <label> (para leitores de
   ecrã), mas o conteúdo fica fora dele: os cliques no vazio não vão dar a
   lado nenhum.

   height:100% + marginTop:auto: quando os campos estão lado a lado numa
   grelha e uma etiqueta ocupa duas linhas (ex: "ANO DE NASCIMENTO"), as
   caixas continuam alinhadas em baixo. */
/* `solto` — para um campo que está sozinho numa coluna, e não lado a lado
   com outros numa grelha.

   O `height: 100%` abaixo serve para alinhar as caixas em baixo quando os
   campos estão emparelhados e uma etiqueta ocupa duas linhas. Num campo
   solto dentro de um cartão faz o contrário do que se quer: o campo estica
   até à altura toda do cartão, o `marginTop: auto` empurra a caixa para o
   fundo, e tudo o que vinha a seguir sai para fora do cartão e fica por
   cima do conteúdo seguinte. Era o que acontecia no Simulador, com o
   "Dia do treino" a atirar a lista de exercícios para fora da caixa. */
export function Field({ label, children, labelColor, bloco, solto }) {
  const etiqueta = (
    <span style={{ fontSize: 12, color: labelColor || T.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
  );
  const estilo = { display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, ...(solto ? {} : { height: '100%' }), ...body };

  if (bloco) {
    return (
      <div style={estilo}>
        <label style={{ display: 'block' }}>{etiqueta}</label>
        <div style={solto ? { minWidth: 0 } : { marginTop: 'auto', minWidth: 0 }}>{children}</div>
      </div>
    );
  }

  return (
    <label style={estilo}>
      {etiqueta}
      <div style={solto ? { minWidth: 0 } : { marginTop: 'auto', minWidth: 0 }}>{children}</div>
    </label>
  );
}

export const inputStyle = {
  background: T.bg, border: `1px solid ${T.line}`, borderRadius: 6, padding: '0 10px',
  color: T.cream, fontSize: 14, ...body, outline: 'none',
  width: '100%', height: 40, lineHeight: '38px', boxSizing: 'border-box', minWidth: 0,
};

/* CAMPOS SOBREPOSTOS NO SAFARI / iPAD

   Os `input type=date` e `type=time` do Safari trazem uma largura própria
   imposta pelo aspeto nativo e ignoram o `width: 100%` — passam por cima
   do campo do lado quando estão numa grelha de duas colunas. É o que
   acontecia na Nova convocatória (Data, Hora do jogo, Hora de
   concentração lado a lado) e acontece em qualquer formulário com datas:
   ficha do jogador, sessão, jogo, filtros de monitorização.

   `appearance: none` tira essa largura imposta e o campo passa a respeitar
   a célula. Aplica-se só ao Input: no Select apagaria também a setinha
   nativa, que é a única indicação de que a lista abre. */
export const inputResetStyle = { WebkitAppearance: 'none', appearance: 'none', maxWidth: '100%' };

export function Input(props) { return <input {...props} style={{ ...inputStyle, ...inputResetStyle, ...(props.style || {}) }} />; }

export function Select(props) { return <select {...props} style={{ ...inputStyle, ...(props.style || {}) }} />; }

/* `forwardRef` porque quem usa isto precisa por vezes de chegar ao
   elemento — por exemplo o Diário, que põe o cursor dentro da nota ao
   carregar no lápis. Sem isto a `ref` era simplesmente ignorada. */
export const TextArea = React.forwardRef(function TextArea(props, ref) {
  return <textarea ref={ref} {...props} style={{ ...inputStyle, height: 'auto', lineHeight: 1.5, padding: '9px 10px', resize: 'vertical', minHeight: 70, ...(props.style || {}) }} />;
});

/* `wide` alarga; `xwide` alarga mais ainda — é o tamanho das janelas com
   campo tático, onde a precisão do desenho depende de o campo ser grande
   no ecrã. Nos ecrãs pequenos os três tamanhos dão no mesmo, porque o
   limite passa a ser a largura da janela. */
export function Modal({ title, subtitle, onClose, children, wide, xwide, fullPage, larguraMax }) {
  const estreito = useIsMobile(620);
  const scrollRef = useRef(null);
  useModalHistory(onClose);
  // IMPORTANTE: o clique no fundo escuro NÃO fecha a janela. Estas janelas
  // são quase todas de edição (exercício, sessão, jogo, jogador...) e um
  // clique acidental fora — muito fácil de dar ao arrastar peças no editor
  // tático — deitava fora tudo o que estava a ser preenchido. Fecha-se só
  // pelo X ou pelo botão Cancelar (o Esc também não fecha, pelo mesmo
  // motivo: seria outra forma acidental de perder o que está preenchido).

  /* PÁGINA INTEIRA, EM VEZ DE JANELA FLUTUANTE.

     O editor de exercício e o de ideia de jogo são os formulários mais
     compridos da app (texto, metadados, o editor tático completo por
     baixo) — dentro de uma janela pequena a meio do ecrã, com uma faixa
     escura à volta, ficavam apertados e obrigavam a rolar dentro de uma
     caixa dentro da página. Aqui ocupam o ecrã todo, como se fossem uma
     página própria: mesmo fundo da app, mesmo scroll da página, sem
     caixa nem fundo escurecido — só o cabeçalho com o título e o X a
     fechar, tal como qualquer outra janela. */
  if (fullPage) {
    // Referência ao próprio contentor que rola aqui dentro — é ele que
    // tem overflowY:auto, ao contrário da janela normal que fica presa
    // ao scroll do <main>. Sem isto o botão de "voltar ao topo" nunca
    // saberia até onde se desceu no editor de exercício/ideia de jogo,
    // que são justamente os formulários mais compridos da app (ver
    // comentário acima).
    return (
      <div ref={scrollRef} style={{
        position: 'fixed', inset: 0, background: T.bg, zIndex: 50,
        overflowY: 'auto', overflowX: 'hidden',
        // Reserva sempre o lugar da barra de deslocamento: quando o
        // conteúdo cresce (ex.: mudar o tipo no formulário do Diário) a
        // barra aparece sem empurrar a página para o lado.
        scrollbarGutter: 'stable',
      }}>
        <div style={{
          // `larguraMax`: largura própria, quando nenhuma das três serve
          // (a matriz wellness × esforço).
          maxWidth: larguraMax || (xwide ? 1100 : (wide ? 640 : 460)), margin: '0 auto',
          padding: estreito ? 14 : 22, paddingBottom: 60,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ ...display, color: T.warn, fontSize: 19, fontWeight: 600, margin: 0 }}>{title}</h3>
              {subtitle && <div style={{ color: T.muted, fontSize: 12.5, marginTop: 3 }}>{subtitle}</div>}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}>
              <X size={20} />
            </button>
          </div>
          {children}
        </div>
        <BotaoTopo alvoRef={scrollRef} isMobile={estreito} onFechar={onClose} soAlvo />
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000000aa', zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: estreito ? 8 : 16,
    }}>
      <div
        ref={scrollRef}
        onClick={e => e.stopPropagation()}
        style={{
          background: T.surfaceRaise, border: `1px solid ${T.line}`, borderRadius: 10,
          width: '100%', maxWidth: xwide ? 1100 : (wide ? 640 : 460), maxHeight: '92vh',
          /* `overflowY: auto` SOZINHO não chega — e era esta a origem do
             arrastamento lateral no telemóvel.

             Pelas regras do CSS, quando um dos eixos deixa de ser
             `visible`, o outro passa automaticamente de `visible` a
             `auto`. Ou seja: pedir scroll vertical dava scroll horizontal
             de borla, e bastava um elemento uns pixéis mais largo para a
             janela inteira deslizar de lado.

             Declarar `overflowX: hidden` fecha essa porta. As tabelas que
             precisam mesmo de rolar na horizontal (presenças,
             classificação) têm o seu próprio invólucro com scroll e
             continuam a funcionar. */
          overflowY: 'auto', overflowX: 'hidden',
          padding: estreito ? 14 : 22, boxShadow: '0 20px 60px #00000080',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ ...display, color: T.warn, fontSize: 19, fontWeight: 600, margin: 0 }}>{title}</h3>
            {subtitle && <div style={{ color: T.muted, fontSize: 12.5, marginTop: 3 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
      <BotaoTopo alvoRef={scrollRef} isMobile={estreito} onFechar={onClose} soAlvo />
    </div>
  );
}

export function EmptyState({ text, action }) {
  return (
    <div style={{
      border: `1px dashed ${T.line}`, borderRadius: 10, padding: '36px 20px',
      textAlign: 'center', color: T.mutedDim, ...body, fontSize: 14,
    }}>
      <p style={{ margin: '0 0 12px' }}>{text}</p>
      {action}
    </div>
  );
}

/* ---------------------------------------------------------------
   APP
---------------------------------------------------------------- */
// Deteta ecrãs estreitos (telemóvel) e reage a rotação/redimensionamento,
// para o layout poder trocar a barra lateral fixa por um menu retrátil.
export function useIsMobile(breakpoint = 860) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return isMobile;
}

/* RETROCEDER NO BROWSER DEVOLVE À ABA DE ANTES, NÃO À LISTA DESTA ABA.

   Abrir o perfil de um jogador, a ficha de um jogo, ou qualquer vista
   de detalhe destas — em cheio, a substituir o conteúdo da aba — nunca
   mexia no endereço nem no histórico do browser: era só estado do
   React. Resultado: ao retroceder, o browser ia para a última vez que
   o ENDEREÇO mudou (a última mudança de aba, ex.: #jogos → #plantel),
   nunca para "antes de abrir este jogador" — porque, aos olhos do
   browser, essa abertura nunca tinha acontecido.

   Este hook empurra uma entrada extra no histórico assim que a vista
   de detalhe abre (mesmo endereço, só um marcador). Retroceder nessa
   entrada é o que o browser já sabe fazer sozinho — e é isso que faz
   cair de volta na aba anterior, não na lista desta aba.

   Para o botão "Voltar" DENTRO da app dar o mesmo resultado, ele deve
   chamar `back()` (devolvido por este hook) em vez de fechar a vista
   diretamente — assim há só UM caminho a fechar a vista (retroceder no
   histórico), e os dois gatilhos (botão da app, botão do telemóvel/
   browser) ficam sempre de acordo, sem risco de uma entrada de
   histórico ficar esquecida por trás.

   UMA VISTA DENTRO DE OUTRA (ex.: abrir uma tática de dentro da ficha
   de um adversário) EMPILHA duas destas marcas, uma por cima da outra.
   Sem cuidado, fechar a de dentro dispara UM "popstate" só — e esse
   evento único chega a AMBOS os ouvintes (o de dentro e o de fora), que
   sem saberem distinguir "foi a minha marca que saiu?" fechavam-se os
   dois de uma vez, fazendo saltar duas vistas com um só fecho. Cada
   marca leva por isso um identificador próprio (`marker`); ao ouvir um
   "popstate", compara-se o identificador que ficou no topo do
   histórico com o nosso — só nos fechamos se DEIXOU de ser o nosso
   (sinal de que foi mesmo a nossa entrada, ou algo acima dela, que
   saiu); se ainda é o nosso, foi uma marca mais funda a sair, e não nos
   diz respeito. */
/* TROCAR DE JANELA SEM PASSAR PELO HISTÓRICO NO MEIO.

   Fechar uma janela (Modal ou vista de detalhe) empurra um "voltar"
   pendente no histórico; abrir outra empurra logo a seguir uma marca
   nova. Quando as duas coisas acontecem no MESMO gesto — o botão
   "Editar" de qualquer ficha, que fecha a vista e abre o editor ao
   mesmo tempo — o "voltar" só é processado pelo browser depois de a
   marca nova já lá estar, e acaba por desfazer a marca ERRADA (a da
   janela que acabou de abrir, não a da que fechou). O efeito visto foi
   o editor a abrir e fechar-se sozinho de imediato, voltando à janela
   anterior.

   `modalHandoffAtivo` avisa a próxima janela a montar que está a
   HERDAR a marca da anterior em vez de empilhar uma nova — sem
   empilhar nem desempilhar nada no meio, não há corrida nenhuma.
   `trocarJanela` é o que qualquer botão "Editar" (ou equivalente) deve
   usar em vez de chamar o fecho e a abertura diretamente. */
export let modalHandoffAtivo = false;

// Para quem está noutro ficheiro poder ligar/desligar o aviso (uma variável
// importada não pode ser alterada diretamente por quem a importa).
export function definirModalHandoff(valor) { modalHandoffAtivo = valor; }

export function trocarJanela(fechar, abrir) {
  modalHandoffAtivo = true;
  fechar();
  abrir();
}

export function herdarOuEmpurrarMarca() {
  if (modalHandoffAtivo) {
    modalHandoffAtivo = false;
    const atual = window.history.state && window.history.state.mjpMarker;
    if (atual) return atual;
    // Handoff sem marca nenhuma por baixo (raro): cria uma na mesma,
    // sem empilhar, para não ficar sem histórico nenhum.
  }
  const meuMarker = uid();
  window.history.pushState({ mjpMarker: meuMarker }, '', window.location.hash);
  return meuMarker;
}

/* A MESMA IDEIA, MAS PARA QUALQUER Modal — sem precisar de tocar em
   cada botão "Cancelar"/"Guardar"/X de cada formulário da app, um a
   um.

   Um Modal só existe montado enquanto está aberto (o padrão em toda a
   app é `{modal && <Modal onClose={...}>}`) — ou seja, ABRIR é montar
   e FECHAR é desmontar, seja qual for o botão que o motivou. Aproveita-
   -se exatamente isso: ao montar, empurra-se uma marca no histórico;
   ao desmontar (por QUALQUER motivo — X, Cancelar, Guardar, ou o
   próprio retroceder do browser), confirma-se que essa marca foi
   mesmo consumida. Se ainda lá estiver (fechou-se por um botão da
   app, não pelo browser), consome-se sozinho — assim nunca fica uma
   marca por trás à espera de um retroceder que já não serve para
   nada, e o retroceder do browser passa a fechar QUALQUER janela desta
   app, em qualquer aba, sem precisar de dizer isso janela a janela.

   Mesmo cuidado do `useDetailBack` com marcas identificadas — ver a
   nota lá em cima sobre vistas empilhadas (um Modal aberto de dentro
   de outra vista de detalhe): sem isso, fechar o Modal de dentro fazia
   fechar também a vista de fora, com um só gesto. */
export function useModalHistory(onClose) {
  const markerRef = useRef(null);
  const fechadoPeloPop = useRef(false);
  useEffect(() => {
    const meuMarker = herdarOuEmpurrarMarca();
    markerRef.current = meuMarker;
    const onPop = () => {
      const atual = window.history.state && window.history.state.mjpMarker;
      if (atual === meuMarker) return; // saiu uma marca mais funda, não a nossa
      fechadoPeloPop.current = true;
      onClose();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (fechadoPeloPop.current) return;
      if (modalHandoffAtivo) return; // outra janela vai herdar esta marca, não a desfazer agora
      const atual = window.history.state && window.history.state.mjpMarker;
      if (atual === meuMarker) window.history.back();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function BotaoTopo({ alvoRef, isMobile, onFechar, soAlvo }) {
  /* VOLTAR AO TOPO.

     Numa lista de exercícios ou de jogos de uma época inteira, descer
     dezenas de "gestos" (ou scrolls de rato) para regressar ao início é
     desnecessário. O botão só aparece depois de se ter descido um ecrã
     inteiro — antes disso não serve para nada e só tapava conteúdo.

     Aparece em telemóvel E em desktop: em desktop fica mais junto ao
     canto (sem reservar espaço para a barra de navegação inferior, que
     só existe no telemóvel).

     E FECHAR, logo por baixo (`onFechar`). Nas janelas e páginas
     compridas, o X está lá no topo; depois de descer um ecrã, sair
     obrigava a subir tudo primeiro. Aparece com a mesma regra da seta —
     no topo o X normal está à vista e este não faz falta — e faz
     exatamente o mesmo que o X (nos formulários, o rascunho automático
     continua a guardar o que estava escrito). Só o X, redondo como a
     seta (o nome aparece ao passar o rato).

     `soAlvo`: numa janela por cima da app, só conta o scroll DA JANELA —
     a página por trás pode estar lá em baixo, e isso não é motivo para
     os botões aparecerem mal a janela abre. */
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    /* QUEM É QUE ROLA?

       Em vez de decidir uma única vez, ao arrancar, qual dos dois rola
       (o <main> ou a janela) — o que corria mal se a página ainda não
       tivesse estabilizado nesse instante (ex.: dados ainda a carregar)
       e deixava o botão "surdo" para o resto da sessão — agora ouvem-se
       os dois em simultâneo. Em desktop só o <main> mexe; em telemóvel
       só a janela mexe; o outro fica só a ouvir sem nunca disparar. */
    const el = (alvoRef && alvoRef.current) || null;
    const ler = () => {
      const elY = el ? el.scrollTop : 0;
      if (soAlvo) return elY;
      const winY = window.scrollY || document.documentElement.scrollTop || 0;
      return Math.max(elY, winY);
    };
    // "Um ecrã": a altura de quem rola (uma janela flutuante é mais baixa
    // que o ecrã — com a altura do ecrã os botões quase nunca apareciam).
    const altura = () => (soAlvo && el && el.clientHeight ? el.clientHeight : window.innerHeight);
    const aoRolar = () => setVisivel(ler() > altura() * 0.9);
    aoRolar();
    if (!soAlvo) window.addEventListener('scroll', aoRolar, { passive: true });
    if (el) el.addEventListener('scroll', aoRolar, { passive: true });
    return () => {
      if (!soAlvo) window.removeEventListener('scroll', aoRolar);
      if (el) el.removeEventListener('scroll', aoRolar);
    };
  }, [alvoRef, soAlvo]);

  if (!visivel) return null;

  const subir = () => {
    const el = (alvoRef && alvoRef.current) || null;
    const elRola = !!el && el.scrollHeight > el.clientHeight + 4;
    if (elRola) el.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const lado = isMobile ? 44 : 40;
  const sombra = '0 4px 14px rgba(0,0,0,0.45)';
  return (
    <div style={{
      position: 'fixed', right: 16, bottom: isMobile ? 78 : 24, zIndex: 40,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10,
    }}>
      <button
        onClick={subir}
        aria-label="Voltar ao topo"
        title="Voltar ao topo"
        style={{
          width: lado, height: lado, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: T.surfaceRaise, border: `1px solid ${T.line}`,
          color: T.cream, cursor: 'pointer', boxShadow: sombra,
        }}
      ><ChevronLeft size={isMobile ? 20 : 18} style={{ transform: 'rotate(90deg)' }} /></button>
      {onFechar && (
        <button
          onClick={onFechar}
          aria-label="Fechar"
          title="Fechar"
          style={{
            width: lado, height: lado, borderRadius: '50%', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: T.surfaceRaise, border: `1px solid ${T.line}`,
            color: T.cream, cursor: 'pointer', boxShadow: sombra,
          }}
        ><X size={isMobile ? 20 : 18} /></button>
      )}
    </div>
  );
}

export function Panel({ title, children, action }) {
  /* height:100% — numa grelha, todos os painéis da mesma linha ficam com a
     mesma altura, em vez de cada um terminar onde o seu conteúdo acaba. */
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 18,
      height: '100%', boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 }}>
        <h3 style={{ ...display, color: T.textoForte, fontSize: 15, fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '.04em' }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
      <div>
        {title && <h1 style={{ ...display, color: T.cream, fontSize: 26, fontWeight: 600, margin: 0 }}>{title}</h1>}
        {subtitle && <p style={{ color: T.mutedDim, fontSize: 13.5, margin: '4px 0 0' }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

