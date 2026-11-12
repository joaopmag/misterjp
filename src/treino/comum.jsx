// treino/comum.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useIsMobile, Select, Input, Field } from '../base/ui';
import { T, body, TEXT_ON_ACCENT } from '../base/tema';
import { todayStr } from '../base/utilidades';
import { jogoNaoJogado } from '../dominio/estadoJogos';
import { useRef, useCallback, useState, useEffect } from 'react';
import { momentosDe } from '../dominio/treino';
import { isFriendlyMatch, FRIENDLY, competitionLabel } from '../dominio/jogos';

// Os mesmos 4 grupos de posição da folha impressa: GR, Defesas, Médios,
// Avançados. Usado só para arrumar a lista de presenças em colunas —
// não mexe em nada da lógica tática (formações, distribuição, etc.).
export const GRUPOS_POSICAO_PRINT = [
  { grupo: 'GR', label: 'GR', posicoes: ['GR'] },
  { grupo: 'DEF', label: 'Defesas', posicoes: ['DD', 'DC', 'DE'] },
  { grupo: 'MEIO', label: 'Médios', posicoes: ['MD', 'MC', 'MOC'] },
  { grupo: 'AVANCADO', label: 'Avançados', posicoes: ['ED', 'EE', 'PL'] },
];

export const PHASES = ['Organização Defensiva', 'Transição Ofensiva', 'Organização Ofensiva', 'Transição Defensiva', 'Bola Parada', 'Preparação Física', 'Ativação', 'Jogo', 'Individual', 'Descanso'];

// Fases de jogo disponíveis na edição de exercícios: "Descanso" é uma fase
// de sessão (dia de folga), não faz sentido classificar um exercício assim.
export const EXERCISE_PHASES = PHASES.filter(p => p !== 'Descanso');

export const INTENSITIES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
];

export const intensityLabel = (v) => INTENSITIES.find(i => i.value === v)?.label || v || '—';

/* MICROCICLOS NUMERADOS — em vez de "Semana de 10/08", cada semana é
   "Microciclo N (10/08)". O 1 é a primeira semana com alguma coisa no
   Planeamento (sessão ou jogo); a contagem segue o calendário, por isso
   uma semana sem nada marcado também conta (não se renumera tudo por
   causa de uma paragem). Semanas antes da primeira ficam sem número. */
export function numeroMicrociclo(monday, primeiraSegunda) {
  if (!monday || !primeiraSegunda) return null;
  const dias = Math.round((new Date(monday + 'T00:00:00') - new Date(primeiraSegunda + 'T00:00:00')) / 86400000);
  return dias >= 0 ? Math.floor(dias / 7) + 1 : null;
}

export function rotuloMicrociclo(monday, primeiraSegunda) {
  const [, m, d] = String(monday).split('-');
  const n = numeroMicrociclo(monday, primeiraSegunda);
  return n ? `Microciclo ${n} (${d}/${m})` : `Semana de ${d}/${m}`;
}

// Cores da carga na Agenda: alta vermelho, média amarelo, baixa verde.
export const COR_INTENSIDADE = { alta: '#D2504A', media: '#E0B12E', baixa: '#4CA86B' };

/* Todos os cartões de um dia na Agenda com a MESMA altura, tenham pouco
   ou muito texto: título até 2 linhas e subtítulo numa linha (o resto
   corta com reticências). */
export const CARTAO_AGENDA = {
  height: 60, boxSizing: 'border-box', overflow: 'hidden', flexShrink: 0,
  display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
  textAlign: 'left', fontSize: 11, borderRadius: 6, padding: '5px 7px', cursor: 'pointer',
  fontFamily: 'inherit', lineHeight: 1.25,
};

// Dias de folga (fase "Descanso") são descanso total: não fazem sentido
// com intensidade nenhuma, por isso esta função devolve '' para eles em
// vez de "Intensidade: —", em qualquer sítio onde a sessão é resumida.
export const intensityText = (s) => s.phase === 'Descanso' ? '' : `Intensidade: ${intensityLabel(s.intensity)}`;

/* TEMPO DE JOGO NAS FICHAS DE AMIGÁVEL.

   Um amigável não tem exercícios, por isso a soma das durações — que é o
   que dá o tempo nas sessões de treino — daria sempre zero. O tempo de
   jogo é, por omissão, os 90 minutos regulamentares; se um dia se quiser
   gravar outro valor (dois tempos de 40, por exemplo), basta pôr
   `tempoJogo` na sessão e esta função passa a usá-lo, sem mais nada
   mudar. Só aparece na fase "Jogo": num treino não significa nada. */
export const TEMPO_JOGO_PADRAO = 90;

export const tempoJogoText = (s) => {
  if (!s || s.phase !== 'Jogo') return '';
  const min = Number(s.tempoJogo);
  return `Tempo: ${min > 0 ? min : TEMPO_JOGO_PADRAO} min`;
};

/* Filtro por momento do jogo.

   Em ecrã largo são botões, que se leem de uma vez. No telemóvel, nove
   botões a 200px ocupavam meio ecrã antes de se ver um único exercício —
   por isso passam a uma lista de escolha com o título "Momento", que
   ocupa uma linha. */
export function MomentoFilter({ value, onChange, options }) {
  const isNarrow = useIsMobile(700);
  const todas = ['Todas', ...options];

  if (isNarrow) {
    // Sem etiqueta por cima: a própria opção já diz o que é, e no
    // telemóvel cada linha a mais empurra a lista para fora do ecrã.
    return (
      <div style={{ marginBottom: 14 }}>
        <Select value={value} onChange={e => onChange(e.target.value)}>
          {todas.map(ph => <option key={ph} value={ph}>{ph === 'Todas' ? 'Momentos' : ph}</option>)}
        </Select>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Momentos</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
        {todas.map(ph => (
          <button key={ph} onClick={() => onChange(ph)} style={{
            padding: '8px 12px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', ...body, textAlign: 'center',
            background: value === ph ? '#B5393F' : 'transparent',
            color: value === ph ? TEXT_ON_ACCENT : T.muted,
            border: `1px solid ${value === ph ? '#B5393F' : T.line}`,
          }}>{ph}</button>
        ))}
      </div>
    </div>
  );
}

/* =====================================================================
   IDEIA DE JOGO vs PLANO DE JOGO.

   · Ideia GERAL — a identidade da equipa. É a que aparece em Ideia de
     Jogo, no Dossier e no Portal → Ideia de Jogo.
   · Ideia PARA UM JOGO (`jogoId`) — criada a pensar num adversário.
     Fica ligada a esse jogo e NÃO aparece na Ideia de Jogo geral.
   · PLANO DE JOGO de um jogo = as ideias criadas para ele + as ideias
     gerais que se juntarem a esse plano (`planosJogo: [jogoId, …]` na
     própria ideia — nada é copiado; melhorar a ideia geral atualiza o
     plano).
   · PORTAL → Plano de Jogo mostra SÓ o plano do PRÓXIMO jogo e, quando
     o jogo passa, sai sozinho: a app mantém o `visivelPlanoJogo` de
     cada ideia igual a "está no plano do próximo jogo" (ver
     `useSincronizarPlanoPortal`). O servidor do Portal não muda — lê o
     mesmo campo de sempre.
   ===================================================================== */

export const ideiaParaJogo = (x) => !!(x && x.jogoId);

export const ideiaNoPlano = (x, jogoId) => !!(x && jogoId && (x.jogoId === jogoId || (Array.isArray(x.planosJogo) && x.planosJogo.includes(jogoId))));

export function planoProximoJogo(matches) {
  const hoje = todayStr();
  return [...(matches || [])]
    .filter(m => m && m.date && m.date >= hoje && !jogoNaoJogado(m))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.hora || '').localeCompare(String(b.hora || '')))[0] || null;
}

export const planoNomeJogo = (m) => (m ? (m.opponent ? `vs ${m.opponent}` : 'Jogo') : 'Jogo');

export const planoFaseDe = (x) => (PHASES.includes(x && x.phase) ? x.phase : 'Sem fase');

/* RODA DO RATO nas linhas de cartões: rodar anda cartão a cartão, sem
   ter de agarrar a barra. Só "prende" a roda quando ainda há cartões
   nesse sentido — no princípio/fim da linha, a página desliza como de
   costume. `passar(dir, soTestar)` devolve se dá para andar. */
export function useRodaDoRato(passar) {
  const passarRef = useRef(passar);
  passarRef.current = passar;
  const elRef = useRef(null);
  const acumulado = useRef(0);
  const aoRodar = useCallback((e) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (!d) return;
    if (!passarRef.current(d > 0 ? 1 : -1, true)) { acumulado.current = 0; return; }
    e.preventDefault();
    const unidade = e.deltaMode === 1 ? 3 : 60; // linhas vs píxeis
    acumulado.current += d;
    if (Math.abs(acumulado.current) >= unidade) {
      passarRef.current(acumulado.current > 0 ? 1 : -1, false);
      acumulado.current = 0;
    }
  }, []);
  return useCallback((el) => {
    if (elRef.current) elRef.current.removeEventListener('wheel', aoRodar);
    elRef.current = el;
    if (el) el.addEventListener('wheel', aoRodar, { passive: false });
  }, [aoRodar]);
}

/* FECHAR SEM SALTAR. Quando uma secção grande se fecha (a lista de
   cartões para copiar), o conteúdo encolhe por baixo e o browser, sem
   página suficiente para manter o scroll onde estava, puxa tudo para
   cima — perde-se o sítio onde se estava. Aqui, mesmo antes de fechar,
   põe-se um espaço vazio no fim da janela do tamanho do ecrã: o scroll
   não tem de recuar e nada mexe. Depois o espaço encolhe sozinho à
   medida que se sobe, e desaparece — nunca se chega a ver.

   Uso: const [fecharSemSaltar, espacoSemSaltar] = useFecharSemSaltar();
        fecharSemSaltar(elementoQueFicaParado, () => setAberto(false));
        … e {espacoSemSaltar} no fim do conteúdo da janela. */
export function useFecharSemSaltar() {
  const espacoRef = useRef(null);
  const fechar = useCallback((ancora, fn) => {
    const esp = espacoRef.current;
    if (!ancora || !esp || typeof window === 'undefined') { fn(); return; }
    let sc = ancora.parentElement;
    while (sc && sc !== document.body) {
      const oy = getComputedStyle(sc).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && sc.scrollHeight > sc.clientHeight) break;
      sc = sc.parentElement;
    }
    const pagina = !sc || sc === document.body;
    if (pagina) sc = document.scrollingElement || document.documentElement;
    const alvo = pagina ? window : sc;
    const st0 = sc.scrollTop;
    const a0 = ancora.getBoundingClientRect().top;
    esp.style.height = `${sc.clientHeight}px`;
    fn();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (sc.scrollTop !== st0) sc.scrollTop = st0;
      // E o elemento tocado fica no MESMO sítio do ecrã (um cabeçalho
      // "pegajoso" que se fecha, por exemplo, voltava ao lugar dele lá
      // em cima e a página saltava).
      if (ancora.isConnected) {
        const d = ancora.getBoundingClientRect().top - a0;
        if (Math.abs(d) > 0.5) sc.scrollTop += d;
      }
      const ajustar = () => {
        const atual = esp.offsetHeight;
        const semEspaco = sc.scrollHeight - atual;
        const preciso = Math.max(0, Math.ceil(sc.scrollTop + sc.clientHeight - semEspaco));
        if (preciso < atual) esp.style.height = `${preciso}px`;
        if (preciso <= 0) alvo.removeEventListener('scroll', ajustar);
      };
      ajustar();
      alvo.addEventListener('scroll', ajustar, { passive: true });
    }));
  }, []);
  const espaco = <div ref={espacoRef} aria-hidden="true" style={{ height: 0, flexShrink: 0 }} />;
  return [fechar, espaco];
}

/* CAMPO DE TEMPO COM CONTA RÁPIDA — aceita escrever direto uma soma ou
   multiplicação ("7+7", "3x5") em vez de fazer a conta de cabeça antes
   de preencher. O resultado só se calcula quando se termina de escrever
   — ao sair do campo, ao carregar Enter, ou ao escrever "=" — nunca a
   meio da digitação. Calcular logo que "15+1" parecesse uma conta
   válida (a cada tecla) trocava o campo a meio de se escrever "15+15":
   mal chegava a "15+1" já virava "15+1=16", e o "5" que faltava ficava
   colado a seguir a esse resultado ("15+1=165"), sem voltar a
   calcular. Só no fim é que se sabe mesmo o que a pessoa quis escrever.

   É o RESULTADO que fica gravado como duração, não o texto — o texto é
   só o que se vê depois de calculado. `value`/`onChange` continuam a
   portar-se como um número normal para quem usa este componente — a
   diferença fica toda por dentro. */
export function TempoInput({ value, onChange, placeholder }) {
  const [texto, setTexto] = useState(value !== null && value !== undefined && value !== '' ? String(value) : '');

  // Sincroniza com o valor de fora (ex.: ao abrir um exercício já
  // existente) — mas nunca por cima de uma conta ainda por terminar,
  // nem por cima de um resultado já calculado (teria o efeito de apagar
  // "7+7=14" mal o 14 chegasse ao componente pai).
  useEffect(() => {
    if (!/[+x×*=]/i.test(texto)) {
      setTexto(value !== null && value !== undefined && value !== '' ? String(value) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const calcular = (t) => {
    const semIgual = t.replace(/=\s*\d*$/, ''); // tanto faz ter escrito o "=" ou não
    const m = semIgual.match(/^\s*(\d+)\s*([+x×*])\s*(\d+)\s*$/i);
    if (!m) return false;
    const a = parseInt(m[1], 10);
    const op = m[2].toLowerCase();
    const b = parseInt(m[3], 10);
    const resultado = (op === '+') ? a + b : a * b;
    setTexto(`${m[1]}${m[2]}${m[3]}=${resultado}`);
    onChange(resultado);
    return true;
  };

  const handleChange = (e) => {
    const t = e.target.value;
    // Distingue escrever de apagar: só um "=" que ACABOU de ser escrito
    // (o texto ficou maior) conta como o sinal de "calcula agora". Sem
    // isto, apagar o resultado de "7+7=14" ficava impossível — mal se
    // chegava a "7+7=" (o "=" que sobra ao apagar o "14") o campo
    // achava que a pessoa tinha acabado de o escrever, e calculava outra
    // vez, sem deixar apagar mais nada.
    const foiEscrito = t.length > texto.length;
    setTexto(t);
    if (/^\d+$/.test(t.trim())) { onChange(Number(t)); return; }
    if (foiEscrito && /=\s*$/.test(t)) calcular(t);
  };

  return (
    <Input
      value={texto} onChange={handleChange} placeholder={placeholder}
      onBlur={() => calcular(texto)}
      onKeyDown={e => { if (e.key === 'Enter') calcular(texto); }}
    />
  );
}

/* Rótulos do momento nos cartões: o dominante como sempre e, se houver,
   o 2.º ao lado, um pouco mais discreto. Cortam com "…" se não couberem. */
export function RotulosMomento({ x }) {
  const ms = momentosDe(x);
  const base = { display: 'inline-block', fontSize: 11, padding: '3px 9px', borderRadius: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 };
  return (
    <span style={{ display: 'flex', gap: 6, minWidth: 0, overflow: 'hidden' }} title={ms.join(' + ')}>
      {ms.map((m, i) => (
        <span key={m} style={{ ...base, flexShrink: i === 0 ? 0.5 : 1, color: T.warn, background: i === 0 ? `${T.crimson}55` : 'transparent', border: i === 0 ? '1px solid transparent' : `1px solid ${T.crimson}88` }}>{m}</span>
      ))}
    </span>
  );
}

/* Campos "Momento" e "2.º momento", sempre os dois e do mesmo tamanho:
   escolher ou não o 2.º não muda nada na página. O 1.º é o dominante; o
   2.º começa em "—" (sem 2.º momento). `celula`: estilo de cada célula
   quando os campos vivem numa grelha (exercício); sem ele, ficam lado a
   lado (ideia). */
export function CamposMomento({ f, setF, rotulo = 'Momento', celula = null }) {
  const primeiro = (
    <Field label={rotulo}>
      <Select value={f.phase} onChange={e => { const v = e.target.value; setF(prev => ({ ...prev, phase: v, phase2: prev.phase2 === v ? '' : (prev.phase2 || '') })); }}>
        {EXERCISE_PHASES.map(p => <option key={p} value={p}>{p}</option>)}
      </Select>
    </Field>
  );
  const segundo = (
    <Field label="2.º momento">
      <Select value={f.phase2 && f.phase2 !== f.phase ? f.phase2 : ''} onChange={e => { const v = e.target.value; setF(prev => ({ ...prev, phase2: v })); }}>
        <option value="">—</option>
        {EXERCISE_PHASES.filter(p => p !== f.phase).map(p => <option key={p} value={p}>{p}</option>)}
      </Select>
    </Field>
  );
  if (celula) return <><div style={celula}>{primeiro}</div><div style={celula}>{segundo}</div></>;
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>{primeiro}</div>
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>{segundo}</div>
    </div>
  );
}

/* O TÍTULO DE UM DIA DE JOGO no Planeamento (ficha impressa e partilhada).
   Antes era sempre "Amigável", mesmo num jogo oficial de campeonato. Agora
   diz o que o jogo é: "Amigável", ou a competição e a jornada. */
export function tituloDiaDeJogo(jogo) {
  if (!jogo || isFriendlyMatch(jogo)) return FRIENDLY;
  const comp = competitionLabel(jogo.competition);
  return [comp, jogo.jornada].filter(Boolean).join(' · ') || 'Jogo';
}

