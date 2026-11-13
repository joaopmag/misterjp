// scouting/Necessidades.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { T, body, display, mono } from '../base/tema';
import { todayStr, uid } from '../base/utilidades';
import { estadoClinicoEm } from '../dominio/clinico';
import { STATUS_OPTIONS } from '../plantel/avaliacao';
import { POSITIONS, shortFullName } from '../dominio/jogadores';
import { useState } from 'react';
import { EmptyState, removeWithUndo, Btn, useIsMobile, Select, FIELD_GRID, Field, Input, FIELD_FULL, TextArea } from '../base/ui';
import { Check, Plus, Pencil, Trash2, ChevronLeft, Pin, RefreshCw, X } from 'lucide-react';
import { ChipBtn } from '../base/botoes';
import { pillarAverage } from './comum';
import { SubHeading } from './ScoutSheet';

export const NEC_NOME_POSICAO = {
  GR: 'Guarda-redes', DC: 'Defesa central', DE: 'Lateral esquerdo', DD: 'Lateral direito',
  MD: 'Médio defensivo', MC: 'Médio centro', MOC: 'Médio ofensivo', EE: 'Extremo esquerdo',
  ED: 'Extremo direito', PL: 'Ponta de lança',
};

export const NEC_PRIORIDADES = [
  { id: 'alta', label: 'Prioridade alta', cor: () => T.bad },
  { id: 'media', label: 'Prioridade média', cor: () => T.warn },
  { id: 'baixa', label: 'Prioridade baixa', cor: () => T.muted },
];

export const NEC_ESTADOS = [
  { id: 'aberta', label: 'Aberta', cor: () => T.warn },
  { id: 'analise', label: 'Em análise', cor: () => T.gold },
  { id: 'resolvida', label: 'Resolvida', cor: () => T.good },
  { id: 'cancelada', label: 'Cancelada', cor: () => T.mutedDim },
];

export const necEstaAtiva = (n) => n && (n.estado === 'aberta' || n.estado === 'analise' || !n.estado);

export const necPrioridade = (id) => NEC_PRIORIDADES.find(p => p.id === id) || NEC_PRIORIDADES[1];

export const necEstado = (id) => NEC_ESTADOS.find(e => e.id === id) || NEC_ESTADOS[0];

export const necNorm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/* Os critérios definidos na necessidade (só os preenchidos contam). */
export function necCriterios(n) {
  const c = [];
  if (n.pe) c.push({ id: 'pe', label: `Pé ${n.pe.toLowerCase()}` });
  if (n.anoDe || n.anoAte) c.push({ id: 'ano', label: n.anoDe && n.anoAte ? `Nascidos ${n.anoDe}–${n.anoAte}` : n.anoDe ? `Nascidos a partir de ${n.anoDe}` : `Nascidos até ${n.anoAte}` });
  if (Number(n.potencialMin) > 0) c.push({ id: 'potencial', label: `Potencial ≥ ${n.potencialMin}★` });
  if (Number(n.mediaMin) > 0) c.push({ id: 'media', label: `Média ≥ ${n.mediaMin}` });
  const palavras = String(n.caracteristicas || '').split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  if (palavras.length) c.push({ id: 'carac', label: palavras.join(' · '), palavras });
  return c;
}

/* Um jogador do scouting face a uma necessidade. */
export function necAvaliar(x, n) {
  const pos = n.posicao;
  const aceites = Array.isArray(n.aceites) ? n.aceites : [];
  const principal = x.position === pos;
  const secundaria = !principal && (x.secondaryPosition === pos || aceites.includes(x.position) || aceites.includes(x.secondaryPosition));
  if (!principal && !secundaria) return null;
  const criterios = necCriterios(n);
  const falhas = [];
  criterios.forEach(c => {
    let ok = false;
    if (c.id === 'pe') ok = x.dominantFoot === n.pe || x.dominantFoot === 'Ambidestro';
    else if (c.id === 'ano') {
      const a = Number(x.birthYear);
      ok = !!a && (!n.anoDe || a >= Number(n.anoDe)) && (!n.anoAte || a <= Number(n.anoAte));
    } else if (c.id === 'potencial') ok = (Number(x.potential) || 0) >= Number(n.potencialMin);
    else if (c.id === 'media') { const m = pillarAverage(x); ok = m != null && m >= Number(n.mediaMin); }
    else if (c.id === 'carac') {
      const texto = necNorm(`${x.traits || ''} ${x.notes || ''}`);
      ok = c.palavras.every(p => texto.includes(necNorm(p)));
    }
    if (!ok) falhas.push(c);
  });
  return { x, principal, cumpre: criterios.length - falhas.length, total: criterios.length, falhas, media: pillarAverage(x) };
}

export function necCandidatos(n, scouting) {
  return (scouting || []).map(x => necAvaliar(x, n)).filter(Boolean).sort((a, b) =>
    (b.cumpre - a.cumpre) || ((b.principal ? 1 : 0) - (a.principal ? 1 : 0))
    || ((b.media || 0) - (a.media || 0)) || ((Number(b.x.potential) || 0) - (Number(a.x.potential) || 0)));
}

/* Plantel atual numa posição, com estatuto e estado clínico de hoje.
   Inclui quem a tem como POSIÇÃO SECUNDÁRIA (marcado `secundaria`),
   depois dos de posição principal. */
export function necPlantelNaPosicao(pos, players, clinico) {
  const hoje = todayStr();
  return (players || []).filter(p => p && (p.position === pos || p.secondaryPosition === pos)).map(p => ({
    p, secundaria: p.position !== pos, estado: estadoClinicoEm(p.id, hoje, clinico),
  })).sort((a, b) => ((a.secundaria ? 1 : 0) - (b.secundaria ? 1 : 0))
    || (STATUS_OPTIONS.indexOf(b.p.statusMain) - STATUS_OPTIONS.indexOf(a.p.statusMain)));
}

/* Posições frágeis: menos de 2 disponíveis, ou nenhum Elite/Potencial
   titular disponível. É só sugestão — a decisão é da equipa técnica. */
export function necSugestoes(players, clinico, necessidades) {
  const jaAbertas = new Set((necessidades || []).filter(necEstaAtiva).map(n => n.posicao));
  // Uma posição que já tem necessidade ativa continua na lista (marcada),
  // para o painel não mudar de tamanho quando se lança uma.
  return POSITIONS.map(pos => {
    // Só a posição PRINCIPAL conta para a fragilidade (quem a tem como
    // secundária é recurso, não solução).
    const lista = necPlantelNaPosicao(pos, players, clinico).filter(l => !l.secundaria);
    const disponiveis = lista.filter(l => !(l.estado && l.estado.id === 'indisponivel'));
    const titulares = disponiveis.filter(l => l.p.statusMain === 'Jogador de Elite' || l.p.statusMain === 'Potencial Titular');
    const motivos = [];
    if (disponiveis.length < 2) motivos.push(disponiveis.length === 0 ? 'nenhum disponível' : 'só 1 disponível');
    if (!titulares.length) motivos.push('sem titular (Elite / Potencial titular)');
    return motivos.length ? { pos, motivos, disponiveis: disponiveis.length, jaAberta: jaAbertas.has(pos) } : null;
  }).filter(Boolean);
}

/* Etiqueta no cartão do Scouting: este jogador encaixa em necessidades abertas. */
export function necQueEncaixam(x, necessidades) {
  return (necessidades || []).filter(necEstaAtiva).filter(n => necAvaliar(x, n) && !(n.descartados || []).includes(x.id));
}

/* ---------- Separador ----------
   Três ecrãs, como os outros separadores do Scouting:
     · LISTA — sugestões do plantel + cartões todos iguais (uma grelha);
     · NECESSIDADE — página inteira com plantel, LISTA CURTA (os
       fixados), candidatos e descartados;
     · LANÇAR / EDITAR — página inteira (não janela), com espaço
       reservado para avisos, para nada mexer enquanto se escreve.
   O ecrã aberto (`vista`) vive no Scouting, para o botão "Lançar
   necessidade" do cabeçalho só aparecer na lista. */
export function NecessidadesEquipa({ api, scouting, players, clinico, vista, setVista, onVerJogador }) {
  const [filtro, setFiltro] = useState('ativas'); // ativas | fechadas | todas

  if (api.estado === 'a-verificar' || (api.estado === 'ok' && !api.pronto)) {
    return <div style={{ color: T.mutedDim, fontSize: 13, padding: '20px 4px', ...body }}>A carregar as necessidades…</div>;
  }
  if (api.estado === 'sem-tabela') {
    return <EmptyState text="As Necessidades ainda não estão ativas nesta base de dados. Falta correr o ficheiro necessidades.sql no Supabase (SQL Editor) — depois disso, é só voltar a abrir este separador." />;
  }
  if (api.estado === 'erro') {
    return <EmptyState text="Não foi possível ligar às necessidades. Verifica a ligação à internet e volta a abrir o separador." />;
  }

  const lista = api.itens || [];
  const guardar = (n) => {
    if (n.id) {
      api.set(prev => prev.map(x => (x.id === n.id ? n : x)));
      setVista({ tipo: 'detalhe', id: n.id });
    } else {
      const id = `nec_${uid()}${uid()}`;
      api.set(prev => [...prev, { ...n, id, criadaEm: new Date().toISOString(), fixados: [], descartados: [] }]);
      setVista({ tipo: 'detalhe', id });
    }
  };
  const alterar = (id, mudar) => api.set(prev => prev.map(x => (x.id === id ? mudar({ ...x }) : x)));
  const apagar = (n) => { removeWithUndo(lista, api.set, n.id, `Necessidade ${n.posicao}`); setVista(null); };

  if (vista && vista.tipo === 'form') {
    return <NecessidadeForm inicial={vista.inicial || {}}
      onBack={() => setVista(vista.inicial && vista.inicial.id ? { tipo: 'detalhe', id: vista.inicial.id } : null)}
      onGuardar={guardar} />;
  }
  if (vista && vista.tipo === 'detalhe') {
    const n = lista.find(x => x.id === vista.id);
    if (n) {
      return <NecessidadeDetalhe n={n} scouting={scouting} players={players} clinico={clinico}
        onBack={() => setVista(null)}
        onVerJogador={onVerJogador}
        onEditar={() => setVista({ tipo: 'form', inicial: { ...n } })}
        onApagar={() => apagar(n)}
        onAlterar={(mudar) => alterar(n.id, mudar)} />;
    }
  }

  // Organizadas por POSIÇÃO (GR, DC, DE, DD, MD, MC, MOC, EE, ED, PL);
  // na mesma posição, a mais prioritária primeiro.
  const ordemPos = (n) => { const i = POSITIONS.indexOf(n.posicao); return i === -1 ? POSITIONS.length : i; };
  const visiveis = lista.filter(n => (filtro === 'todas' ? true : filtro === 'ativas' ? necEstaAtiva(n) : !necEstaAtiva(n)))
    .sort((a, b) => ordemPos(a) - ordemPos(b)
      || NEC_PRIORIDADES.findIndex(p => p.id === a.prioridade) - NEC_PRIORIDADES.findIndex(p => p.id === b.prioridade)
      || String(b.criadaEm || '').localeCompare(String(a.criadaEm || '')));
  const sugestoes = necSugestoes(players, clinico, lista);
  const nAtivas = lista.filter(necEstaAtiva).length;

  return (
    <div style={{ overflowAnchor: 'none' }}>
      {sugestoes.length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ ...display, fontSize: 15, fontWeight: 600, color: T.cream, textTransform: 'uppercase', letterSpacing: '.03em' }}>Sugestões do plantel</span>
            <span style={{ fontSize: 12, color: T.mutedDim, ...body }}>Posições com menos de 2 disponíveis ou sem titular. A decisão é da equipa técnica.</span>
          </div>
          {/* Grelha de mosaicos iguais (em vez de pílulas de larguras
              diferentes): primeiro as posições por tratar, depois as que
              já têm necessidade ativa. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
            {[...sugestoes].sort((a, b) => (a.jaAberta ? 1 : 0) - (b.jaAberta ? 1 : 0)).map(sg => (
              <button key={sg.pos} type="button" disabled={sg.jaAberta}
                onClick={() => { if (!sg.jaAberta) setVista({ tipo: 'form', inicial: { posicao: sg.pos, motivo: `Plantel: ${sg.motivos.join('; ')}.` } }); }}
                title={sg.jaAberta ? 'Já há uma necessidade ativa para esta posição' : `Lançar necessidade — ${sg.motivos.join(' · ')}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', minWidth: 0,
                  background: T.surfaceRaise, border: `1px solid ${sg.jaAberta ? T.line : T.gold}`, borderRadius: 10,
                  padding: '8px 12px', color: T.cream, cursor: sg.jaAberta ? 'default' : 'pointer', opacity: sg.jaAberta ? 0.6 : 1, ...body,
                }}>
                <span style={{ ...display, fontSize: 18, fontWeight: 600, width: 40, flexShrink: 0 }}>{sg.pos}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12.5, color: T.cream, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{NEC_NOME_POSICAO[sg.pos]}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: T.mutedDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {sg.jaAberta ? 'Necessidade ativa' : sg.motivos.map(m => (m.startsWith('sem titular') ? 'sem titular' : m)).join(' · ')}
                  </span>
                </span>
                {sg.jaAberta ? <Check size={15} color={T.good} style={{ flexShrink: 0 }} /> : <Plus size={15} color={T.gold} style={{ flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <ChipBtn active={filtro === 'ativas'} onClick={() => setFiltro('ativas')}>Ativas {nAtivas}</ChipBtn>
        <ChipBtn active={filtro === 'fechadas'} onClick={() => setFiltro('fechadas')}>Resolvidas / canceladas {lista.length - nAtivas}</ChipBtn>
        <ChipBtn active={filtro === 'todas'} onClick={() => setFiltro('todas')}>Todas {lista.length}</ChipBtn>
      </div>

      {visiveis.length === 0 ? (
        <EmptyState text={filtro === 'ativas'
          ? 'Sem necessidades ativas. Lança uma necessidade quando a equipa técnica identificar uma lacuna numa posição — a app cruza-a logo com os jogadores do Scouting.'
          : 'Nada para mostrar neste filtro.'}
          action={filtro === 'ativas' ? <Btn onClick={() => setVista({ tipo: 'form', inicial: {} })}><Plus size={15} /> Lançar necessidade</Btn> : null} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {visiveis.map(n => (
            <NecessidadeResumo key={n.id} n={n} scouting={scouting} players={players} clinico={clinico}
              onAbrir={() => setVista({ tipo: 'detalhe', id: n.id })}
              onEditar={() => setVista({ tipo: 'form', inicial: { ...n } })}
              onApagar={() => apagar(n)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function NecPilula({ texto, cor }) {
  return (
    <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, border: `1px solid ${cor}`, color: cor, whiteSpace: 'nowrap', ...body }}>{texto}</span>
  );
}

/* CARTÃO DA NECESSIDADE — todos iguais, como os do Scouting: cada bloco
   tem sempre o mesmo lugar e a mesma altura, preenchido ou não. */
export function NecessidadeResumo({ n, scouting, players, clinico, onAbrir, onEditar, onApagar }) {
  const pr = necPrioridade(n.prioridade);
  const es = necEstado(n.estado);
  const todos = necCandidatos(n, scouting).filter(c => !(n.descartados || []).includes(c.x.id));
  const fixados = todos.filter(c => (n.fixados || []).includes(c.x.id));
  const cumpremTudo = todos.filter(c => c.total > 0 && c.cumpre === c.total).length;
  const plantel = necPlantelNaPosicao(n.posicao, players, clinico);
  const principais = plantel.filter(l => !l.secundaria);
  const disp = principais.filter(l => !(l.estado && l.estado.id === 'indisponivel')).length;
  const secund = plantel.length - principais.length;
  const umaLinha = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 };
  const botaoCartao = { background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 5, display: 'flex', borderRadius: 6 };
  const contador = (rotulo, valor, cor) => (
    <div style={{ background: T.surfaceRaise, borderRadius: 8, padding: '7px 10px 8px', minWidth: 0 }}>
      <div style={{ color: T.mutedDim, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.4, ...umaLinha, ...body }}>{rotulo}</div>
      <div style={{ color: valor ? cor : T.mutedDim, fontWeight: 700, fontSize: 16, ...mono }}>{valor}</div>
    </div>
  );
  return (
    <div onClick={onAbrir} title="Abrir necessidade" style={{
      cursor: 'pointer', minWidth: 0, background: T.surface, border: `1px solid ${T.line}`, borderTop: `3px solid ${pr.cor()}`,
      borderRadius: 12, padding: '14px 12px 16px 16px', display: 'flex', flexDirection: 'column',
    }}>
      {/* 26px de linha (e menos 4px de margem): sem cortar as pernas das letras. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div style={{ flex: 1, color: T.cream, ...display, fontWeight: 600, fontSize: 18, lineHeight: '26px', ...umaLinha }}>
          {n.posicao} · {NEC_NOME_POSICAO[n.posicao] || n.posicao}
        </div>
        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', flexShrink: 0, cursor: 'default' }}>
          <button type="button" onClick={onEditar} title="Editar necessidade" style={botaoCartao}><Pencil size={13} /></button>
          <button type="button" onClick={onApagar} title="Apagar necessidade" style={botaoCartao}><Trash2 size={13} /></button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: 22, overflow: 'hidden' }}>
        <NecPilula texto={pr.label} cor={pr.cor()} />
        <NecPilula texto={es.label} cor={es.cor()} />
        {n.prazo && <span style={{ fontSize: 11.5, color: T.mutedDim, ...umaLinha, ...body }}>{n.prazo}</span>}
      </div>
      <div title={n.motivo || undefined} style={{ color: T.muted, fontSize: 12, lineHeight: '17px', height: 34, marginTop: 8, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', ...body }}>
        {n.motivo || <span style={{ color: T.mutedDim }}>Sem motivo escrito.</span>}
      </div>
      <div style={{ color: T.mutedDim, fontSize: 11.5, lineHeight: '17px', height: 17, marginTop: 6, ...umaLinha, ...body }}>
        Plantel: {principais.length} na posição ({disp} disponíve{disp === 1 ? 'l' : 'is'}){secund ? ` · +${secund} de posição secundária` : ''}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginTop: 12 }}>
        {contador('Lista curta', fixados.length, T.gold)}
        {contador('Candidatos', todos.length, T.cream)}
        {contador('Cumprem tudo', cumpremTudo, T.good)}
      </div>
    </div>
  );
}

/* PÁGINA DA NECESSIDADE */
export function NecessidadeDetalhe({ n, scouting, players, clinico, onBack, onVerJogador, onEditar, onApagar, onAlterar }) {
  const [verDescartados, setVerDescartados] = useState(false);
  const isWide = !useIsMobile(900);
  const pr = necPrioridade(n.prioridade);
  const es = necEstado(n.estado);
  const criterios = necCriterios(n);
  const fixadosIds = n.fixados || [];
  const descartados = n.descartados || [];
  const todos = necCandidatos(n, scouting);
  const listaCurta = todos.filter(c => fixadosIds.includes(c.x.id) && !descartados.includes(c.x.id));
  const candidatos = todos.filter(c => !fixadosIds.includes(c.x.id) && !descartados.includes(c.x.id));
  const descartadosLista = todos.filter(c => descartados.includes(c.x.id));
  const plantel = necPlantelNaPosicao(n.posicao, players, clinico);
  const escolhido = n.escolhidoId ? (scouting || []).find(x => x.id === n.escolhidoId) : null;

  const fixar = (id) => onAlterar(x => ({ ...x, fixados: [...(x.fixados || []).filter(i => i !== id), id] }));
  const desafixar = (id) => onAlterar(x => ({ ...x, fixados: (x.fixados || []).filter(i => i !== id) }));
  const descartar = (id) => onAlterar(x => ({ ...x, descartados: [...(x.descartados || []).filter(i => i !== id), id], fixados: (x.fixados || []).filter(i => i !== id) }));
  const recuperar = (id) => onAlterar(x => ({ ...x, descartados: (x.descartados || []).filter(i => i !== id) }));

  const botaoIcone = { background: 'none', border: `1px solid ${T.line}`, color: T.mutedDim, cursor: 'pointer', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 5, borderRadius: 6, fontSize: 12, ...body };
  const umaLinha = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 };
  const titulo = (txt) => <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, ...body }}>{txt}</div>;
  // Caixa de altura fixa (a lista desliza por dentro): fixar, descartar
  // ou recuperar não muda o tamanho da página.
  const caixa = (altura) => ({ height: altura, overflowY: 'auto', overflowAnchor: 'none', scrollbarGutter: 'stable', border: `1px solid ${T.line}`, borderRadius: 10, background: T.surface });

  const linhaCandidato = (c, acoes) => {
    const tudo = c.cumpre === c.total;
    const corCumpre = c.total === 0 ? T.mutedDim : tudo ? T.good : c.cumpre === 0 ? T.bad : T.warn;
    const info = [c.x.club, `${c.x.position || ''}${c.x.secondaryPosition ? `/${c.x.secondaryPosition}` : ''}`, c.x.birthYear, c.media != null ? `média ${c.media}` : null].filter(Boolean).join(' · ');
    return (
      <div key={c.x.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: `1px solid ${T.line}`, minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onVerJogador(c.x)} title="Ver ficha completa">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ color: T.cream, fontSize: 14, fontWeight: 600, ...umaLinha }}>{c.x.name}</span>
            {!c.principal && <span style={{ fontSize: 10.5, color: T.mutedDim, flexShrink: 0, ...body }}>posição secundária</span>}
          </div>
          <div style={{ fontSize: 12, color: T.mutedDim, ...umaLinha, ...body }}>{info || '—'}</div>
          <div style={{ fontSize: 12, color: corCumpre, ...umaLinha, ...body }}>
            {c.total === 0 ? 'Sem critérios definidos' : `Cumpre ${c.cumpre} de ${c.total}`}
            {c.falhas.length > 0 && <span style={{ color: T.mutedDim }}> · falta: {c.falhas.map(f => f.label).join(', ')}</span>}
          </div>
        </div>
        {acoes}
      </div>
    );
  };

  return (
    <div style={{ overflowAnchor: 'none' }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
        borderRadius: 8, color: T.cream, padding: '7px 13px', cursor: 'pointer', ...body, fontSize: 13, marginBottom: 18,
      }}>
        <ChevronLeft size={15} /> Necessidades
      </button>

      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderTop: `3px solid ${pr.cor()}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ ...display, fontSize: 22, fontWeight: 600, color: T.cream }}>{n.posicao} · {NEC_NOME_POSICAO[n.posicao] || n.posicao}</div>
          <NecPilula texto={pr.label} cor={pr.cor()} />
          {n.prazo && <span style={{ fontSize: 12.5, color: T.mutedDim, ...body }}>{n.prazo}</span>}
          <div style={{ flex: 1 }} />
          <div style={{ width: 150 }}>
            <Select value={n.estado || 'aberta'} onChange={e => onAlterar(x => ({ ...x, estado: e.target.value }))} aria-label="Estado da necessidade"
              style={{ borderColor: es.cor() }}>
              {NEC_ESTADOS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
            </Select>
          </div>
          <Btn variant="ghost" onClick={onEditar}><Pencil size={14} /> Editar</Btn>
          <Btn variant="ghost" onClick={onApagar} title="Apagar necessidade"><Trash2 size={14} /></Btn>
        </div>
        <div style={{ color: T.muted, fontSize: 13.5, marginTop: 8, lineHeight: 1.5, ...body }}>{n.motivo || <span style={{ color: T.mutedDim }}>Sem motivo escrito.</span>}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          {criterios.length === 0
            ? <span style={{ fontSize: 12, color: T.mutedDim, ...body }}>Sem critérios de perfil — contam todos os jogadores da posição.</span>
            : criterios.map(c => (
              <span key={c.id} style={{ fontSize: 12, padding: '3px 9px', borderRadius: 7, border: `1px solid ${T.line}`, color: T.cream, background: T.surfaceRaise, ...body }}>{c.label}</span>
            ))}
          {(n.aceites || []).length > 0 && <span style={{ fontSize: 12, color: T.mutedDim, alignSelf: 'center', ...body }}>Também aceita: {(n.aceites || []).join(', ')}</span>}
        </div>
        {/* A linha do jogador escolhido tem sempre lugar reservado: mudar
            o estado para "Resolvida" não empurra a página. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12, minHeight: 40, visibility: n.estado === 'resolvida' ? 'visible' : 'hidden' }}>
          <span style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', ...body }}>Jogador escolhido</span>
          <div style={{ width: 260, maxWidth: '100%' }}>
            <Select value={n.escolhidoId || ''} onChange={e => onAlterar(x => ({ ...x, escolhidoId: e.target.value || null }))}>
              <option value="">— nenhum / fora do scouting —</option>
              {todos.map(c => <option key={c.x.id} value={c.x.id}>{c.x.name}{c.x.club ? ` (${c.x.club})` : ''}</option>)}
            </Select>
          </div>
          {escolhido && <Btn variant="ghost" onClick={() => onVerJogador(escolhido)}>Ver ficha</Btn>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isWide ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: 16, marginBottom: 16 }}>
        <div>
          {titulo(`No plantel nesta posição (${plantel.length})`)}
          <div style={caixa(220)}>
            {plantel.length === 0 ? (
              <div style={{ color: T.bad, fontSize: 13, padding: 14, ...body }}>Nenhum jogador do plantel faz esta posição.</div>
            ) : plantel.map(l => {
              const indisp = l.estado && l.estado.id === 'indisponivel';
              return (
                <div key={l.p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: `1px solid ${T.line}` }}>
                  <span style={{ color: T.cream, fontSize: 13.5, fontWeight: 600, flex: 1, ...umaLinha, ...body }}>{shortFullName(l.p.name)}</span>
                  {l.secundaria && <span style={{ fontSize: 10.5, color: T.mutedDim, flexShrink: 0, ...body }}>posição secundária ({l.p.position})</span>}
                  <span style={{ fontSize: 12, color: indisp ? T.bad : (l.estado ? l.estado.cor : T.mutedDim), flexShrink: 0, ...body }}>
                    {indisp ? 'Indisponível' : (l.p.statusMain || 'sem estatuto')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          {titulo(`Lista curta (${listaCurta.length})`)}
          <div style={caixa(220)}>
            {listaCurta.length === 0 ? (
              <div style={{ color: T.mutedDim, fontSize: 13, padding: 14, lineHeight: 1.5, ...body }}>
                Os jogadores que fixares nos candidatos aparecem aqui — são os que a equipa técnica quer acompanhar de perto para esta necessidade.
              </div>
            ) : listaCurta.map(c => linhaCandidato(c, (
              <button type="button" onClick={() => desafixar(c.x.id)} title="Tirar da lista curta (volta aos candidatos)" style={{ ...botaoIcone, color: T.gold, borderColor: T.gold }}>
                <Pin size={13} /> Tirar
              </button>
            )))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <ChipBtn active={!verDescartados} onClick={() => setVerDescartados(false)}>Candidatos {candidatos.length}</ChipBtn>
        <ChipBtn active={verDescartados} onClick={() => setVerDescartados(true)}>Descartados {descartadosLista.length}</ChipBtn>
      </div>
      <div style={caixa(300)}>
        {(verDescartados ? descartadosLista : candidatos).length === 0 ? (
          <div style={{ color: T.mutedDim, fontSize: 13, padding: 14, lineHeight: 1.5, ...body }}>
            {verDescartados
              ? 'Sem jogadores descartados.'
              : todos.length
                ? 'Todos os candidatos estão na lista curta ou descartados.'
                : `Ainda não há jogadores no Scouting para ${n.posicao}. Quando acrescentares um, aparece aqui sozinho.`}
          </div>
        ) : (verDescartados ? descartadosLista : candidatos).map(c => linhaCandidato(c, verDescartados ? (
          <button type="button" onClick={() => recuperar(c.x.id)} title="Voltar a pôr nos candidatos" style={botaoIcone}><RefreshCw size={13} /> Recuperar</button>
        ) : (
          <>
            <button type="button" onClick={() => fixar(c.x.id)} title="Passar para a lista curta" style={botaoIcone}><Pin size={13} /> Fixar</button>
            <button type="button" onClick={() => descartar(c.x.id)} title="Descartar desta necessidade (a ficha no Scouting fica intacta)" style={botaoIcone}><X size={13} /></button>
          </>
        )))}
      </div>
    </div>
  );
}

/* LANÇAR / EDITAR — página inteira, como "Adicionar jogador". Os anos
   são caixas de texto (4 algarismos) e o aviso de anos trocados tem
   lugar reservado e só aparece com os dois anos completos — escrever
   não faz a página mexer. */
export function NecessidadeForm({ inicial, onBack, onGuardar }) {
  const [f, setF] = useState({
    posicao: 'DC', aceites: [], prioridade: 'media', estado: 'aberta', pe: '', anoDe: '', anoAte: '',
    potencialMin: 0, mediaMin: '', caracteristicas: '', motivo: '', prazo: '', ...inicial,
  });
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const aceites = Array.isArray(f.aceites) ? f.aceites : [];
  const ano = (v) => String(v || '').replace(/\D/g, '').slice(0, 4);
  const completos = String(f.anoDe).length === 4 && String(f.anoAte).length === 4;
  const anoInvalido = completos && Number(f.anoDe) > Number(f.anoAte);
  const anoIncompleto = (String(f.anoDe).length > 0 && String(f.anoDe).length < 4) || (String(f.anoAte).length > 0 && String(f.anoAte).length < 4);
  return (
    <div style={{ overflowAnchor: 'none' }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
        borderRadius: 8, color: T.cream, padding: '7px 13px', cursor: 'pointer', ...body, fontSize: 13, marginBottom: 14,
      }}>
        <ChevronLeft size={15} /> {f.id ? 'Necessidade' : 'Necessidades'}
      </button>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ ...display, fontSize: 20, color: T.cream }}>{f.id ? 'Editar necessidade' : 'Lançar necessidade'}</div>
        <div style={{ color: T.mutedDim, fontSize: 12.5, ...body }}>Só a posição e a prioridade são obrigatórias. Cada campo do perfil preenchido conta como um critério.</div>
      </div>

      <SubHeading>Necessidade</SubHeading>
      <div style={{ ...FIELD_GRID, marginBottom: 10 }}>
        <Field label="Posição *">
          <Select value={f.posicao} onChange={e => setF(x => ({ ...x, posicao: e.target.value, aceites: (x.aceites || []).filter(a => a !== e.target.value) }))}>
            {POSITIONS.map(p => <option key={p} value={p}>{p} · {NEC_NOME_POSICAO[p]}</option>)}
          </Select>
        </Field>
        <Field label="Prioridade *">
          <Select value={f.prioridade} onChange={e => set('prioridade', e.target.value)}>
            {NEC_PRIORIDADES.map(p => <option key={p.id} value={p.id}>{p.label.replace('Prioridade ', '')}</option>)}
          </Select>
        </Field>
        <Field label="Prazo">
          <Input value={f.prazo} onChange={e => set('prazo', e.target.value)} placeholder="Janela de janeiro" />
        </Field>
      </div>
      <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, ...body }}>Também aceita (opcional)</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {POSITIONS.map(p => {
          if (p === f.posicao) return null;
          const on = aceites.includes(p);
          // Mesmo aspeto dos botões de escolha da app, só mais baixos.
          return (
            <button key={p} type="button" onClick={() => set('aceites', on ? aceites.filter(a => a !== p) : [...aceites, p])}
              style={{ padding: '6px 12px', borderRadius: 8, cursor: 'pointer', ...body, fontSize: 13,
                background: on ? T.surfaceRaise : 'transparent', color: on ? T.gold : T.muted, border: `1px solid ${on ? T.gold : T.line}` }}>
              {p}
            </button>
          );
        })}
      </div>

      <SubHeading>Perfil pretendido (critérios)</SubHeading>
      <div style={{ ...FIELD_GRID }}>
        <Field label="Pé dominante">
          <Select value={f.pe} onChange={e => set('pe', e.target.value)}>
            <option value="">Indiferente</option>
            <option value="Direito">Direito</option>
            <option value="Esquerdo">Esquerdo</option>
          </Select>
        </Field>
        <Field label="Nascidos a partir de">
          <Input inputMode="numeric" maxLength={4} value={f.anoDe} onChange={e => set('anoDe', ano(e.target.value))} placeholder="2007" />
        </Field>
        <Field label="Nascidos até">
          <Input inputMode="numeric" maxLength={4} value={f.anoAte} onChange={e => set('anoAte', ano(e.target.value))} placeholder="2009" />
        </Field>
        <Field label="Potencial mínimo">
          <Select value={String(f.potencialMin || 0)} onChange={e => set('potencialMin', Number(e.target.value))}>
            <option value="0">Indiferente</option>
            {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}★ ou mais</option>)}
          </Select>
        </Field>
        <Field label="Média mínima (1–5)">
          <Select value={String(f.mediaMin || '')} onChange={e => set('mediaMin', e.target.value ? Number(e.target.value) : '')}>
            <option value="">Indiferente</option>
            {[2, 2.5, 3, 3.5, 4, 4.5].map(v => <option key={v} value={v}>{String(v).replace('.', ',')} ou mais</option>)}
          </Select>
        </Field>
      </div>
      <div style={{ ...FIELD_GRID, marginTop: 10 }}>
        <div style={FIELD_FULL}>
          <Field label="Características desejadas (separadas por vírgulas)">
            <Input value={f.caracteristicas} onChange={e => set('caracteristicas', e.target.value)} placeholder="ofensivo, cruzamento" />
          </Field>
        </div>
      </div>
      {/* Lugar reservado (sempre a mesma altura): o aviso dos anos, ou a ajuda. */}
      <div style={{ height: 20, marginTop: 4, marginBottom: 12, fontSize: 11.5, color: anoInvalido ? T.bad : T.mutedDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...body }}>
        {anoInvalido ? 'O ano "a partir de" é maior do que o ano "até".' : 'Procuradas nas Características e Observações da ficha de cada jogador.'}
      </div>

      <SubHeading>Motivo / contexto</SubHeading>
      <TextArea rows={2} value={f.motivo} onChange={e => set('motivo', e.target.value)} placeholder="Só 1 lateral esquerdo disponível até fevereiro." style={{ minHeight: 0 }} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <Btn variant="ghost" onClick={onBack}>Cancelar</Btn>
        <Btn onClick={() => onGuardar({ ...f, aceites })} disabled={!f.posicao || anoInvalido || anoIncompleto}><Check size={15} /> {f.id ? 'Guardar alterações' : 'Lançar necessidade'}</Btn>
      </div>
    </div>
  );
}

