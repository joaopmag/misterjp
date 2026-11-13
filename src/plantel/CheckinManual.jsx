// plantel/CheckinManual.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useState, useRef } from 'react';
import { todayStr, formatShortDatePt } from '../base/utilidades';
import { T, body, display } from '../base/tema';
import { BotaoTopo, Field, Input } from '../base/ui';
import { X } from 'lucide-react';
import { ToggleBtn } from '../base/ui-extra';
import { ComposicaoWizard, RpeWizard, WellnessWizard } from '../atleta/questionarios';
import { rpeContexto } from './comum';

/* ---------------------------------------------------------------
   REGISTO MANUAL — grelha de plantel em touchscreen

   Substitui o antigo formulário com sliders. O staff abre o quadro,
   escolhe Wellness ou PSE e a data, e tem o plantel todo à disposição:
   toca no jogador e responde no MESMO questionário que os atletas usam
   (WellnessWizard / RpeWizard). No fim volta à grelha para o jogador
   seguinte — pensado para passar o tablet de mão em mão no balneário.

   Ao contrário do questionário dos atletas, aqui NÃO há janelas
   horárias nem limite de dia: é sempre possível preencher.
---------------------------------------------------------------- */
export function ManualCheckinBoard({ players, monitoring, sessions, matches = [], onClose, onSave, initialType }) {
  const [type, setType] = useState(initialType || 'wellness');
  const [date, setDate] = useState(todayStr());
  const [activeId, setActiveId] = useState(null);

  const session = sessions.find(s => s.date === date);
  const isRestDay = session && session.phase === 'Descanso';
  const sessionLabel = session ? (session.focus || session.phase || 'Sessão do dia') : 'Sem sessão definida';
  const activePlayer = players.find(p => p.id === activeId);

  // Registo já existente para aquele jogador, naquele dia, daquele tipo.
  const recordFor = (playerId, t) => monitoring.find(m => m.playerId === playerId && m.date === date &&
    (t === 'wellness' ? typeof m.sono === 'number' : t === 'composicao' ? typeof m.peso === 'number' : typeof m.pse === 'number'));

  const doneCount = players.filter(p => recordFor(p.id, type)).length;

  const submit = (fields) => {
    if (!activePlayer) return false;
    onSave({ playerId: activePlayer.id, date, type, ...fields });
    // Este caminho (registo manual do staff) grava direto no estado local
    // — sem pedido ao servidor a aguardar, por isso é sempre um sucesso
    // imediato. O `true` aqui é o que os wizards (Wellness/RPE/
    // Composição) agora exigem para mostrarem "Registado" — sem ele,
    // ficavam a mostrar erro de gravação também aqui, por engano.
    return true;
  };

  // `comFechar`: só na grelha do plantel. A meio do questionário de um
  // jogador, fechar deitava fora as respostas — aí sai-se pelo "Voltar".
  const shellRef = useRef(null);
  const shell = (children, comFechar) => (
    <div ref={shellRef} style={{
      position: 'fixed', inset: 0, background: T.bg, zIndex: 60, overflowY: 'auto', overflowX: 'hidden',
      ...body, WebkitOverflowScrolling: 'touch',
    }}>
      {children}
      {comFechar && <BotaoTopo alvoRef={shellRef} isMobile={typeof window !== 'undefined' && window.innerWidth < 760} onFechar={onClose} soAlvo />}
    </div>
  );

  // --- Questionário aberto para um jogador ---------------------------
  if (activePlayer) {
    const back = () => setActiveId(null);
    // IMPORTANTE: aqui só se usa o registo DAQUELE dia. Antes havia um
    // recurso ao último registo de outro dia qualquer, o que dava a
    // impressão de o jogador já ter respondido hoje quando não tinha.
    const existing = recordFor(activePlayer.id, type);
    const notice = existing
      ? 'Este jogador já respondeu neste dia — as respostas dele aparecem selecionadas. Guardar substitui o registo.'
      : null;
    if (type === 'wellness') {
      return shell(
        <WellnessWizard
          player={activePlayer} initial={existing} date={date} notice={notice}
          onBack={back} onSubmit={fields => submit(fields)}
        />
      );
    }
    if (type === 'composicao') {
      return shell(
        <ComposicaoWizard
          player={activePlayer} initial={existing} date={date} notice={notice}
          onBack={back} onSubmit={fields => submit(fields)}
        />
      );
    }
    return shell(
      <RpeWizard
        player={activePlayer} session={session} date={date}
        initial={existing} notice={notice}
        contexto={rpeContexto({ date, contexto: existing && existing.contexto }, { matches, sessions })}
        onBack={back} onSubmit={fields => submit(fields)}
      />
    );
  }

  // --- Grelha do plantel ---------------------------------------------
  return shell(
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '22px 18px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
        <div>
          <div style={{ ...display, fontSize: 23, fontWeight: 700, color: T.cream }}>Registo manual</div>
          <div style={{ fontSize: 13, color: T.mutedDim, marginTop: 3 }}>
            Toca no jogador — {type === 'wellness' ? 'wellness do dia' : type === 'composicao' ? 'pesagem (composição corporal)' : 'intensidade do treino'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ ...display, fontSize: 22, fontWeight: 700, color: doneCount === players.length ? T.good : T.teamB }}>
            {doneCount}/{players.length}
          </div>
          <button onClick={onClose} title="Fechar" style={{
            background: 'none', border: `1px solid ${T.line}`, borderRadius: 8, color: T.mutedDim,
            padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, ...body, fontSize: 12.5,
          }}>
            <X size={15} /> Fechar
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, minWidth: 260, flex: 1, flexWrap: 'wrap' }}>
          <ToggleBtn active={type === 'wellness'} onClick={() => setType('wellness')}>💪 Wellness</ToggleBtn>
          <ToggleBtn active={type === 'rpe'} onClick={() => setType('rpe')} accent>🏋 PSE</ToggleBtn>
          <ToggleBtn active={type === 'composicao'} onClick={() => setType('composicao')}>⚖️ Composição corporal</ToggleBtn>
        </div>
        <div style={{ minWidth: 170 }}>
          <Field label="Data do registo">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </Field>
        </div>
      </div>

      {type === 'rpe' && !session && (
        <div style={{
          border: `1px solid ${T.warn}`, background: `${T.warn}14`, borderRadius: 10,
          padding: '12px 14px', color: T.warn, fontSize: 13, marginBottom: 16, lineHeight: 1.5,
        }}>
          Ainda não há treino registado neste dia — cria a sessão em Planeamento para o PSE ficar associado a ela.
          Podes registar à mesma, mas o registo fica sem sessão ligada.
        </div>
      )}
      {type === 'rpe' && isRestDay && (
        <div style={{
          border: `1px solid ${T.line}`, background: T.surface, borderRadius: 10,
          padding: '12px 14px', color: T.mutedDim, fontSize: 13, marginBottom: 16,
        }}>
          {formatShortDatePt(date)} está marcado como folga. Normalmente não há PSE a registar.
        </div>
      )}
      {type === 'rpe' && session && !isRestDay && (
        <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 16 }}>
          Sessão de {formatShortDatePt(date)}: <span style={{ color: T.cream }}>{sessionLabel}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
        {/* Só aqui (novo registo manual) a grelha ordena e identifica por
            número de camisola em vez de posição — é o que o staff vê no
            banco/campo ao chamar cada atleta para responder. */}
        {[...players].sort((a, b) => (Number(a.number) || 999) - (Number(b.number) || 999)).map(p => {
          const wDone = !!recordFor(p.id, 'wellness');
          const rDone = !!recordFor(p.id, 'rpe');
          const cDone = !!recordFor(p.id, 'composicao');
          const done = type === 'wellness' ? wDone : type === 'composicao' ? cDone : rDone;
          return (
            <button key={p.id} onClick={() => setActiveId(p.id)} style={{
              position: 'relative', textAlign: 'left', padding: '16px 16px 18px', borderRadius: 12,
              background: done ? `${T.good}12` : T.surface,
              border: `1px solid ${done ? T.good : T.line}`,
              cursor: 'pointer', ...body, minHeight: 104,
            }}>
              <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
                <StatusPip emoji="💪" on={wDone} />
                <StatusPip emoji="🏋" on={rDone} />
                <StatusPip emoji="⚖️" on={cDone} />
              </div>
              <div style={{ ...display, fontSize: 30, fontWeight: 700, color: done ? T.good : T.mutedDim, lineHeight: 1 }}>
                {p.number ? `${p.number}` : '–'}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.cream, marginTop: 12 }}>{p.name}</div>
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 22, lineHeight: 1.5 }}>
        O registo manual não tem restrição de horário — podes preencher qualquer dia, a qualquer hora.
        Se o jogador já tiver respondido, um novo registo substitui o anterior desse dia.
      </div>
    </div>,
    true
  );
}

export function StatusPip({ emoji, on }) {
  return (
    <span style={{
      width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, border: `1px solid ${on ? T.good : T.line}`, background: on ? `${T.good}22` : 'transparent',
      opacity: on ? 1 : 0.35,
    }}>{emoji}</span>
  );
}

