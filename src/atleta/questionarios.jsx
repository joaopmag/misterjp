// atleta/questionarios.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { todayStr, formatShortDatePt } from '../base/utilidades';
import { T, body, display, mono } from '../base/tema';
import { ChevronLeft, Check } from 'lucide-react';
import { useState } from 'react';
import { useKioskVoltar } from '../base/kiosk';
import { ToggleBtn } from '../base/ui-extra';
import { ChipBtn } from '../base/botoes';
import { FIELD_GRID, Field, Input } from '../base/ui';

/* ---------------------------------------------------------------
   CHECKIN KIOSK — ecrã público (?checkin=1) para os atletas
   preencherem o Wellness e o RPE. Sem sidebar, mobile-first,
   pensado para ser aberto a partir de um link partilhado.
---------------------------------------------------------------- */
export const RPE_SCALE = [
  { v: 0, label: 'Repouso' },
  { v: 1, label: 'Muito leve' },
  { v: 2, label: 'Leve' },
  { v: 3, label: 'Moderado' },
  { v: 4, label: 'Um pouco intenso' },
  { v: 5, label: 'Intenso' },
  { v: 6, label: 'Entre intenso e muito intenso' },
  { v: 7, label: 'Muito intenso' },
  { v: 8, label: 'Muito intenso perto do máximo' },
  { v: 9, label: 'Quase máximo' },
  { v: 10, label: 'Máximo' },
];

export const PAIN_AREAS = ['Pé', 'Tornozelo', 'Gémeo', 'Joelho', 'Coxa (anterior)', 'Coxa (posterior)', 'Virilha', 'Anca', 'Lombar', 'Ombro', 'Outra'];

export function KioskHeader({ player, step, totalSteps, typeLabel, subLabel, date, onBack }) {
  const isToday = !date || date === todayStr();
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, gap: 10 }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
        borderRadius: 8, color: T.cream, padding: '8px 14px', cursor: 'pointer', ...body, fontSize: 13.5, flexShrink: 0,
      }}>
        <ChevronLeft size={15} /> Voltar
      </button>
      <div style={{ textAlign: 'right' }}>
        <div style={{ ...display, fontSize: 18, fontWeight: 600, color: T.cream }}>{player.position ? `${player.position} · ` : ''}{player.name}</div>
        <div style={{ fontSize: 12, color: T.mutedDim, marginTop: 2 }}>{typeLabel} · {step ? `${step}/${totalSteps} ` : ''}{subLabel}</div>
        {!isToday && <div style={{ fontSize: 11.5, color: T.warn, marginTop: 2 }}>Dia: {formatShortDatePt(date)}</div>}
      </div>
    </div>
  );
}

export function QuestionLabel({ children }) {
  return <div style={{ ...display, fontSize: 17, fontWeight: 600, color: T.cream, marginBottom: 14 }}>{children}</div>;
}

// Aviso no topo do questionário — usado no registo manual, para o staff
// perceber que está a editar uma resposta já dada pelo jogador.
export function KioskNotice({ children }) {
  return (
    <div style={{
      border: `1px solid ${T.warn}66`, background: `${T.warn}14`, borderRadius: 10,
      padding: '10px 12px', color: T.warn, fontSize: 12.5, lineHeight: 1.45, marginBottom: 16, ...body,
    }}>{children}</div>
  );
}

export function ScaleButtons({ value, onChange, lowLabel, highLabel }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => onChange(n)} style={{
            aspectRatio: '1', borderRadius: 10, border: `1px solid ${value === n ? T.cream : T.line}`,
            background: value === n ? T.cream : 'transparent', color: value === n ? T.bg : T.cream,
            ...display, fontSize: 22, fontWeight: 700, cursor: 'pointer',
          }}>{n}</button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: T.mutedDim }}>
        <span>{lowLabel}</span><span>{highLabel}</span>
      </div>
    </div>
  );
}

export function QuestionBlock({ label, lowLabel, highLabel, value, onChange }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <QuestionLabel>{label}</QuestionLabel>
      <ScaleButtons value={value} onChange={onChange} lowLabel={lowLabel} highLabel={highLabel} />
    </div>
  );
}

export function StepperBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: 60, height: 60, borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface,
      color: T.cream, fontSize: 24, cursor: 'pointer', flexShrink: 0,
    }}>{children}</button>
  );
}

export function BigButton({ children, onClick, disabled, accent, style: s = {} }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', padding: '16px', borderRadius: 10, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      background: accent ? T.good : T.line, color: accent ? T.sobreBom : T.cream,
      ...display, fontSize: 16.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      opacity: disabled ? 0.6 : 1, ...s,
    }}>{children}</button>
  );
}

export function DoneScreen({ name, message }) {
  return (
    <div style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20, textAlign: 'center' }}>
      <div style={{ width: 84, height: 84, borderRadius: '50%', background: T.good, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Check size={42} color={T.sobreBom} />
      </div>
      <div style={{ ...display, fontSize: 24, fontWeight: 700, color: T.cream }}>{message}, {name.split(' ')[0]}!</div>
      <div style={{ fontSize: 13.5, color: T.mutedDim }}>A voltar…</div>
    </div>
  );
}

export function WellnessWizard({ player, initial, date, onBack, onSubmit, notice }) {
  const [step, setStep] = useState(1);
  // Gesto de retroceder no 2.º passo: volta ao 1.º (Sono).
  useKioskVoltar(step === 2, () => setStep(1));
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [erroGravar, setErroGravar] = useState('');
  /* Nada vem preenchido por omissão: enquanto o atleta não tocar, cada
     resposta fica a null. Antes abria tudo em 3 (e "Não" na dor), o que
     tornava impossível distinguir uma resposta real de um valor por
     defeito — bastava carregar em Confirmar sem ler nada. Só se carrega
     em `initial` quando o staff está a corrigir um registo existente. */
  const [f, setF] = useState({
    sleepHours: initial?.sleepHours ?? null,
    sono: initial?.sono ?? null,
    fadiga: initial?.fadiga ?? null,
    dor: initial?.dor ?? null,
    humor: initial?.humor ?? null,
    stress: initial?.stress ?? null,
    dorLocalizada: initial?.dorLocalizada ?? null,
    zonasDor: initial?.zonasDor ?? [],
  });

  const toggleZona = (z) => setF(prev => ({ ...prev, zonasDor: prev.zonasDor.includes(z) ? prev.zonasDor.filter(x => x !== z) : [...prev.zonasDor, z] }));
  // Primeiro toque em − ou + arranca nas 8h (valor de partida razoável);
  // a partir daí ajusta meia hora de cada vez.
  const adjustSleep = (delta) => setF(prev => ({
    ...prev,
    sleepHours: prev.sleepHours === null ? 8 : Math.min(14, Math.max(0, Math.round((prev.sleepHours + delta) * 10) / 10)),
  }));

  const step1Done = f.sleepHours !== null && f.sono !== null;
  const step2Done = f.fadiga !== null && f.dor !== null && f.humor !== null && f.stress !== null && f.dorLocalizada !== null;

  const confirm = () => {
    if (!step2Done) return;
    setSaving(true);
    setErroGravar('');
    // Só mostra "Registado" (e só volta sozinho ao início) DEPOIS de o
    // servidor confirmar que gravou de facto — sem isto, uma falha de
    // rede ou uma recusa do servidor (ex.: janela fechada entretanto)
    // mostrava sempre sucesso na mesma, e o ecrã já tinha mudado de
    // página antes de o atleta conseguir ver qualquer aviso de erro.
    setTimeout(async () => {
      const ok = await onSubmit({ ...f });
      setSaving(false);
      if (ok) {
        setDone(true);
        setTimeout(() => onBack(), 1100);
      } else {
        setErroGravar('Não foi possível guardar. Verifica a internet e tenta outra vez.');
      }
    }, 450);
  };

  if (done) return <DoneScreen name={player.name} message="Registado" />;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 18px 60px' }}>
      <KioskHeader player={player} step={step} totalSteps={2} typeLabel="Wellness" subLabel={step === 1 ? 'Sono' : 'Como te sentes'} date={date} onBack={onBack} />
      {notice && <KioskNotice>{notice}</KioskNotice>}

      {step === 1 && (
        <>
          <QuestionLabel>Quantas horas dormiste?</QuestionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 30 }}>
            <StepperBtn onClick={() => adjustSleep(-0.5)}>−</StepperBtn>
            <div style={{ flex: 1, textAlign: 'center', ...display, fontSize: 42, fontWeight: 700, color: f.sleepHours === null ? T.mutedDim : T.cream }}>
              {f.sleepHours === null ? '—' : f.sleepHours.toFixed(1).replace('.', ',')}<span style={{ fontSize: 17, color: T.mutedDim, marginLeft: 4 }}>h</span>
            </div>
            <StepperBtn onClick={() => adjustSleep(0.5)}>+</StepperBtn>
          </div>

          <QuestionLabel>Qualidade do sono</QuestionLabel>
          <ScaleButtons value={f.sono} onChange={v => setF({ ...f, sono: v })} lowLabel="Muito má" highLabel="Excelente" />

          {!step1Done && (
            <div style={{ fontSize: 12, color: T.mutedDim, marginTop: 18, textAlign: 'center' }}>
              Responde às duas perguntas para continuares.
            </div>
          )}
          <BigButton onClick={() => setStep(2)} disabled={!step1Done} style={{ marginTop: step1Done ? 32 : 10 }}>Continuar →</BigButton>
        </>
      )}

      {step === 2 && (
        <>
          <QuestionBlock label="Fadiga" lowLabel="Exausto" highLabel="Fresco" value={f.fadiga} onChange={v => setF({ ...f, fadiga: v })} />
          <QuestionBlock label="Dor muscular" lowLabel="Muita dor" highLabel="Sem dor" value={f.dor} onChange={v => setF({ ...f, dor: v })} />
          <QuestionBlock label="Humor" lowLabel="Em baixo" highLabel="Ótimo" value={f.humor} onChange={v => setF({ ...f, humor: v })} />
          <QuestionBlock label="Stress" lowLabel="Muito stress" highLabel="Relaxado" value={f.stress} onChange={v => setF({ ...f, stress: v })} />

          <QuestionLabel>Tens alguma dor localizada?</QuestionLabel>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <ToggleBtn active={f.dorLocalizada === false} onClick={() => setF({ ...f, dorLocalizada: false, zonasDor: [] })}>Não</ToggleBtn>
            <ToggleBtn active={f.dorLocalizada === true} onClick={() => setF({ ...f, dorLocalizada: true })} accent>Sim</ToggleBtn>
          </div>
          {f.dorLocalizada && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
              {PAIN_AREAS.map(z => (
                <ChipBtn key={z} active={f.zonasDor.includes(z)} onClick={() => toggleZona(z)}>{z}</ChipBtn>
              ))}
            </div>
          )}

          {!step2Done && (
            <div style={{ fontSize: 12, color: T.mutedDim, margin: '4px 0 10px', textAlign: 'center' }}>
              Falta responder a alguma pergunta acima.
            </div>
          )}
          {erroGravar && (
            <div style={{ fontSize: 12.5, color: T.bad, margin: '4px 0 10px', textAlign: 'center' }}>
              {erroGravar}
            </div>
          )}
          <BigButton onClick={confirm} disabled={saving || !step2Done} accent style={{ marginTop: 10 }}>
            {saving ? 'A guardar…' : <>Confirmar <Check size={17} /></>}
          </BigButton>
        </>
      )}
    </div>
  );
}

/* Pesagem de bioimpedância. Ao contrário do Wellness/PSE (escalas
   subjetivas 1-5), aqui os valores vêm de uma balança — por isso é um
   formulário numérico simples, sem passos nem escalas de botões. Só o
   peso é obrigatório: uma balança doméstica só pesa, uma de
   bioimpedância dá mais — o formulário aceita as duas. */
export function ComposicaoWizard({ player, initial, date, onBack, onSubmit, notice }) {
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [erroGravar, setErroGravar] = useState('');
  const [f, setF] = useState({
    peso: initial?.peso ?? '',
    massaGorda: initial?.massaGorda ?? '',
    massaMuscular: initial?.massaMuscular ?? '',
    agua: initial?.agua ?? '',
    notasComposicao: initial?.notasComposicao ?? '',
  });

  const num = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  const pesoNum = num(f.peso);
  const alturaM = player.height ? Number(player.height) / 100 : null;
  const imc = alturaM && pesoNum ? pesoNum / (alturaM * alturaM) : null;
  const podeGuardar = pesoNum !== null;

  const confirm = () => {
    if (!podeGuardar) return;
    setSaving(true);
    setErroGravar('');
    setTimeout(async () => {
      const ok = await onSubmit({
        peso: pesoNum,
        massaGorda: num(f.massaGorda),
        massaMuscular: num(f.massaMuscular),
        agua: num(f.agua),
        notasComposicao: f.notasComposicao.trim() || undefined,
      });
      setSaving(false);
      if (ok) {
        setDone(true);
        setTimeout(() => onBack(), 1100);
      } else {
        setErroGravar('Não foi possível guardar. Verifica a internet e tenta outra vez.');
      }
    }, 350);
  };

  if (done) return <DoneScreen name={player.name} message="Pesagem registada" />;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 18px 60px' }}>
      <KioskHeader player={player} typeLabel="Composição corporal" subLabel="Pesagem" date={date} onBack={onBack} />
      {notice && <KioskNotice>{notice}</KioskNotice>}

      <div style={{ ...FIELD_GRID, marginBottom: 14 }}>
        <Field label="Peso (kg)" solto>
          <Input type="number" step="0.1" inputMode="decimal" value={f.peso}
            onChange={e => setF({ ...f, peso: e.target.value })} placeholder="Ex: 74.5" />
        </Field>
        <Field label="Massa gorda (%)" solto>
          <Input type="number" step="0.1" inputMode="decimal" value={f.massaGorda}
            onChange={e => setF({ ...f, massaGorda: e.target.value })} placeholder="opcional" />
        </Field>
        <Field label="Massa muscular (%)" solto>
          <Input type="number" step="0.1" inputMode="decimal" value={f.massaMuscular}
            onChange={e => setF({ ...f, massaMuscular: e.target.value })} placeholder="opcional" />
        </Field>
        <Field label="Água corporal (%)" solto>
          <Input type="number" step="0.1" inputMode="decimal" value={f.agua}
            onChange={e => setF({ ...f, agua: e.target.value })} placeholder="opcional" />
        </Field>
        <Field label="Notas" solto>
          <Input value={f.notasComposicao} onChange={e => setF({ ...f, notasComposicao: e.target.value })} placeholder="opcional" />
        </Field>
      </div>

      {imc !== null && (
        <div style={{ fontSize: 12, color: T.mutedDim, margin: '4px 0 18px' }}>
          IMC estimado: <span style={{ color: T.cream, ...mono }}>{imc.toFixed(1)}</span>
          {' '}(com base na altura do Plantel — {player.height} cm)
        </div>
      )}

      {!podeGuardar && (
        <div style={{ fontSize: 12, color: T.mutedDim, marginTop: 4, marginBottom: 10, textAlign: 'center' }}>
          Introduz pelo menos o peso para guardar.
        </div>
      )}
      {erroGravar && (
        <div style={{ fontSize: 12.5, color: T.bad, marginTop: 4, marginBottom: 10, textAlign: 'center' }}>
          {erroGravar}
        </div>
      )}
      <BigButton onClick={confirm} disabled={saving || !podeGuardar} accent style={{ marginTop: podeGuardar ? 12 : 0 }}>
        {saving ? 'A guardar…' : <>Confirmar <Check size={17} /></>}
      </BigButton>
    </div>
  );
}

/* `contexto` ('treino' | 'jogo') vem de quem chama, que sabe se houve
   jogo nesse dia. Fica GRAVADO no registo, para a distinção sobreviver
   mesmo que o jogo seja mais tarde apagado da lista de Jogos. */
export function RpeWizard({ player, session, date, onBack, onSubmit, initial, notice, contexto = 'treino' }) {
  const eJogo = contexto === 'jogo';
  // `initial` traz o registo já existente (registo manual a corrigir uma
  // resposta): a opção que o jogador escolheu aparece logo selecionada.
  const [value, setValue] = useState(
    initial && typeof initial.pse === 'number' ? initial.pse : null
  );
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [erroGravar, setErroGravar] = useState('');

  const sessionLabel = session
    ? (session.focus || session.phase || (eJogo ? 'Jogo de hoje' : 'Sessão de hoje'))
    : (eJogo ? 'Jogo' : 'Sem sessão definida');

  const confirm = () => {
    if (value === null) return;
    setSaving(true);
    setErroGravar('');
    setTimeout(async () => {
      const ok = await onSubmit({ pse: value, sessionId: session?.id || null, treino: sessionLabel, contexto });
      setSaving(false);
      if (ok) {
        setDone(true);
        setTimeout(() => onBack(), 1100);
      } else {
        setErroGravar('Não foi possível guardar. Verifica a internet e tenta outra vez.');
      }
    }, 450);
  };

  if (done) return <DoneScreen name={player.name} message={`PSE ${value} — registado`} />;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 18px 60px' }}>
      <KioskHeader player={player} typeLabel={eJogo ? 'PSE · jogo' : 'PSE · treino'} subLabel={sessionLabel} date={date} onBack={onBack} />
      {notice && <KioskNotice>{notice}</KioskNotice>}
      <QuestionLabel>{eJogo ? 'Quão intenso foi o jogo?' : 'Quão intenso foi o treino?'}</QuestionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
        {RPE_SCALE.map(opt => (
          <button key={opt.v} onClick={() => setValue(opt.v)} style={{
            display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left', padding: '13px 16px', borderRadius: 10,
            background: value === opt.v ? `${T.crimson}33` : T.surface,
            border: `1px solid ${value === opt.v ? T.crimsonBright : T.line}`,
            color: value === opt.v ? T.crimsonBright : T.cream, cursor: 'pointer', ...body, fontSize: 14.5,
          }}>
            <span style={{ ...display, fontSize: 21, fontWeight: 700, width: 26, flexShrink: 0 }}>{opt.v}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
      {erroGravar && (
        <div style={{ fontSize: 12.5, color: T.bad, margin: '4px 0 10px', textAlign: 'center' }}>
          {erroGravar}
        </div>
      )}
      <BigButton onClick={confirm} disabled={value === null || saving} accent>
        {saving ? 'A guardar…' : <>Confirmar <Check size={17} /></>}
      </BigButton>
    </div>
  );
}

export function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

