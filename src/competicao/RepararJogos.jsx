// competicao/RepararJogos.jsx
//
// REPOR JOGADORES QUE SAÍRAM DO ONZE SEM NINGUÉM OS TIRAR.
//
// O que aconteceu (até 13/11): marcar L (Boletim Clínico → "Atualizar as
// presenças") ou falta/escalão nas Presenças num dia de jogo tirava o
// jogador dos convocados, mas deixava-o no onze. Na gravação seguinte do
// jogo, a regra "titular tem de estar convocado" tirava-o também do onze:
// o lugar ficava "livre" e o jogador ia parar a "Não convocados".
//
// Como se encontra: o Relato (`activity_log`) guarda, para cada gravação
// de um jogo, o antes e o depois de cada campo. Procura-se, em cada jogo,
// quem:
//   1. saiu dos convocados numa gravação que NÃO mexeu no onze (foi a
//      marcação nas Presenças ou no Boletim, não o "Editar jogo");
//   2. e depois saiu do onze (ou do banco) numa gravação seguinte;
//   3. e continua fora do jogo agora.
// Nada se repõe sozinho: aparece a lista, e o treinador escolhe o que repor.
//
// Repor = voltar ao mesmo lugar no campo (ou ao banco, se o lugar já
// estiver ocupado), aos titulares e aos convocados, e sair da falta / L /
// escalão desse jogo. Uma lesão do próprio dia continua registada no
// Boletim Clínico; o jogador só não sai do jogo por causa dela.

import { useEffect, useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { ensureSession } from '../base/sincronizacao';
import { Btn, Modal } from '../base/ui';
import { T } from '../base/tema';
import { fmtShort } from '../base/utilidades';
import { shortPlayerName } from '../dominio/jogadores';
import { tamanhoDaFormacao } from '../tatico/Simulador';

const PAGINA = 1000;
let CACHE = null; // { equipa, linhas } — lê-se uma vez por sessão

async function lerHistoricoDosJogos(equipa) {
  if (CACHE && CACHE.equipa === equipa) return CACHE.linhas;
  await ensureSession();
  const linhas = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase.from('activity_log')
      .select('registo_id, em, campos')
      .eq('team_id', String(equipa)).eq('tabela', 'matches')
      .order('em', { ascending: true }).order('id', { ascending: true })
      .range(de, de + PAGINA - 1);
    if (error) throw error;
    linhas.push(...(data || []));
    if (!data || data.length < PAGINA) break;
  }
  CACHE = { equipa, linhas };
  return linhas;
}

const lista = (v) => (Array.isArray(v) ? v : []);
const MOTIVO = { faltas: 'Falta', lesionados: 'Lesionado (L)', escalao: 'Escalão', attendance: 'Presenças' };

/* Para um jogo: quem foi tirado e onde estava. */
function perdidosDoJogo(jogo, linhas) {
  const resultado = new Map(); // pid -> { lugar, titular, motivo }
  const tiradosSemOnze = new Map(); // pid -> motivo (saiu dos convocados sem mexer no onze)
  for (const l of linhas) {
    const campos = Array.isArray(l.campos) ? l.campos : [];
    const c = Object.fromEntries(campos.filter(x => x && x.k).map(x => [x.k, x]));
    const mexeuNoOnze = !!(c.alinhamento || c.starters);
    if (c.convocados && !c.convocados.grande && !mexeuNoOnze) {
      const sairam = lista(c.convocados.de).filter(id => !lista(c.convocados.para).includes(id));
      sairam.forEach(id => {
        const motivo = ['lesionados', 'faltas', 'escalao'].find(k => c[k] && lista(c[k].para).includes(id) && !lista(c[k].de).includes(id));
        tiradosSemOnze.set(id, MOTIVO[motivo] || 'Presenças');
      });
    }
    // Saída do onze/banco DEPOIS de ter sido tirado dos convocados.
    if (mexeuNoOnze) {
      const aliDe = c.alinhamento ? lista(c.alinhamento.de) : null;
      const aliPara = c.alinhamento ? lista(c.alinhamento.para) : null;
      const titDe = c.starters ? lista(c.starters.de) : [];
      const titPara = c.starters ? lista(c.starters.para) : [];
      for (const [id, motivo] of tiradosSemOnze) {
        const saiuDoLugar = aliDe && aliDe.includes(id) && !aliPara.includes(id);
        const saiuDosTitulares = titDe.includes(id) && !titPara.includes(id);
        if (saiuDoLugar || saiuDosTitulares) {
          resultado.set(id, { lugar: aliDe ? aliDe.indexOf(id) : -1, titular: true, motivo });
        }
      }
    }
    // Se voltou a entrar nos convocados (alguém o repôs), deixa de contar.
    if (c.convocados && !c.convocados.grande) {
      lista(c.convocados.para).forEach(id => { if (!lista(c.convocados.de).includes(id)) { tiradosSemOnze.delete(id); resultado.delete(id); } });
    }
  }
  // Só quem continua fora do jogo agora.
  const agora = new Set([...lista(jogo.convocados), ...lista(jogo.starters), ...lista(jogo.alinhamento).filter(Boolean)]);
  return [...resultado].filter(([id]) => !agora.has(id)).map(([id, info]) => ({ id, ...info }));
}

function reporNoJogo(jogo, perdidos) {
  const n = tamanhoDaFormacao(jogo.formacao || '4-3-3') || 11;
  const ali = Array.isArray(jogo.alinhamento) && jogo.alinhamento.length === n ? [...jogo.alinhamento] : null;
  let starters = lista(jogo.starters);
  let convocados = lista(jogo.convocados);
  const ids = new Set(perdidos.map(p => p.id));
  perdidos.forEach(p => {
    if (p.titular) {
      if (ali && p.lugar >= 0 && p.lugar < n && !ali[p.lugar]) ali[p.lugar] = p.id;
      if (ali && ali.includes(p.id)) starters = [...starters.filter(x => x !== p.id), p.id];
      else if (!ali && starters.length < n) starters = [...starters, p.id];
    }
    if (!convocados.includes(p.id)) convocados = [...convocados, p.id];
  });
  const tirar = (v) => lista(v).filter(id => !ids.has(id));
  return {
    ...jogo, alinhamento: ali || jogo.alinhamento, starters, convocados,
    attendance: [...new Set([...lista(jogo.attendance), ...ids])],
    faltas: tirar(jogo.faltas), lesionados: tirar(jogo.lesionados), escalao: tirar(jogo.escalao),
  };
}

export function RepararJogos({ matches, players, onSave }) {
  const [casos, setCasos] = useState(null); // [{ jogo, perdidos }]
  const [aberto, setAberto] = useState(false);
  const [escolhidos, setEscolhidos] = useState({}); // `${jogoId}|${pid}` -> bool
  const [feito, setFeito] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const equipa = T.equipaId;
    if (!equipa || !(matches || []).length) return undefined;
    (async () => {
      try {
        const linhas = await lerHistoricoDosJogos(equipa);
        if (cancelado) return;
        const porJogo = new Map();
        linhas.forEach(l => { const k = String(l.registo_id); if (!porJogo.has(k)) porJogo.set(k, []); porJogo.get(k).push(l); });
        const achados = (matches || []).map(jogo => ({ jogo, perdidos: perdidosDoJogo(jogo, porJogo.get(String(jogo.id)) || []) }))
          .filter(x => x.perdidos.length)
          .sort((a, b) => String(b.jogo.date || '').localeCompare(String(a.jogo.date || '')));
        setCasos(achados);
        const marcar = {};
        achados.forEach(x => x.perdidos.forEach(p => { marcar[`${x.jogo.id}|${p.id}`] = true; }));
        setEscolhidos(marcar);
      } catch (e) {
        setCasos([]); // sem Relato (tabela por criar ou sem acesso): não há nada a propor
      }
    })();
    return () => { cancelado = true; };
    // Só ao abrir: as reposições já feitas tiram os casos da lista sozinhas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!casos || !casos.length || feito) return null;
  const porId = new Map((players || []).map(p => [p.id, p]));
  const nome = (id) => { const p = porId.get(id); return p ? shortPlayerName(p, players) : 'Jogador que já não está no plantel'; };
  const total = casos.reduce((a, x) => a + x.perdidos.length, 0);

  const repor = () => {
    casos.forEach(({ jogo, perdidos }) => {
      const sim = perdidos.filter(p => escolhidos[`${jogo.id}|${p.id}`]);
      if (!sim.length) return;
      const atual = (matches || []).find(m => m.id === jogo.id) || jogo;
      onSave(reporNoJogo(atual, sim));
    });
    CACHE = null;
    setFeito(true); setAberto(false);
  };

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16, padding: '12px 14px', borderRadius: 10,
        background: 'rgba(179,38,30,.10)', border: `1px solid ${T.bad}`,
      }}>
        <AlertTriangle size={18} color={T.bad} style={{ flexShrink: 0 }} />
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: T.cream, fontWeight: 600 }}>
            {total === 1 ? '1 jogador saiu do onze' : `${total} jogadores saíram do onze`} de {casos.length === 1 ? '1 jogo' : `${casos.length} jogos`} sem ninguém os tirar.
          </div>
          <div style={{ fontSize: 12, color: T.mutedDim, marginTop: 2 }}>
            Uma falta ou um L marcado nesse dia tirava-os do jogo. Revê e repõe.
          </div>
        </div>
        <Btn onClick={() => setAberto(true)}>Rever e repor</Btn>
      </div>
      {aberto && (
        <Modal title="Repor jogadores nos jogos" subtitle="Voltam ao mesmo lugar no campo (ou ao banco, se o lugar já estiver ocupado)." onClose={() => setAberto(false)} wide>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {casos.map(({ jogo, perdidos }) => (
              <div key={jogo.id} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: '10px 12px', background: T.bg }}>
                <div style={{ fontSize: 13, color: T.cream, fontWeight: 600, marginBottom: 6 }}>
                  vs {jogo.opponent || 'Adversário'} · {fmtShort(jogo.date)}{jogo.result ? ` · ${jogo.result}` : ''}
                </div>
                {perdidos.map(p => {
                  const k = `${jogo.id}|${p.id}`;
                  return (
                    <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 0', fontSize: 13, color: T.cream, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!escolhidos[k]} onChange={e => setEscolhidos(prev => ({ ...prev, [k]: e.target.checked }))}
                        style={{ accentColor: T.crimson, width: 15, height: 15 }} />
                      <span style={{ flex: 1 }}>{nome(p.id)}</span>
                      <span style={{ fontSize: 11.5, color: T.mutedDim }}>tirado por: {p.motivo}</span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <Btn variant="ghost" onClick={() => setAberto(false)}>Agora não</Btn>
            <Btn onClick={repor} disabled={!Object.values(escolhidos).some(Boolean)}><Check size={15} /> Repor selecionados</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}

// Para testes.
export const _interno = { perdidosDoJogo, reporNoJogo };
