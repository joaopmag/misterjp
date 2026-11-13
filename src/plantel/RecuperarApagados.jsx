// plantel/RecuperarApagados.jsx
//
// REPOR UM JOGADOR APAGADO COMO "SAIU DO CLUBE".
//
// Apagar um jogador (Plantel → lixo) tira-o de todos os jogos, treinos e
// convocatórias (`limparRastoDoJogador`). Quando o que se queria era só
// marcar a saída do clube, isso deixa buracos no passado: lugares vazios
// no onze, minutos e notas que desaparecem das estatísticas.
//
// O Relato (`activity_log`) guarda, para cada gravação, o antes e o depois
// de cada campo. Daí se tira:
//   · a ficha do jogador: os valores dos campos ao longo do tempo (sem a
//     fotografia, que é grande demais para o histórico);
//   · o que a limpeza tirou: as gravações de jogos, treinos e
//     convocatórias feitas logo a seguir ao apagar, com o jogador no
//     "antes".
// Repor = o jogador volta com o MESMO id e com data de saída no dia em que
// foi apagado, e volta a cada registo de onde a limpeza o tirou (lugar no
// onze se estiver livre, titulares, convocados, presenças, notas e
// minutos, quando o histórico os guardou).
//
// Não volta o que a limpeza APAGOU (bem-estar, PSE, boletim clínico,
// desenvolvimento): são dados de saúde, e o histórico só guarda o nome dos
// campos, nunca os valores. Se esses registos ainda existirem (aviso
// "registos de jogadores que já foram apagados" no Plantel), voltam a
// ligar-se ao jogador sozinhos, porque o id é o mesmo.

import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { ensureSession } from '../base/sincronizacao';
import { Btn, Modal } from '../base/ui';
import { T } from '../base/tema';
import { fmtShort } from '../base/utilidades';

const JANELA_MS = 20 * 60 * 1000; // a limpeza corre uns segundos depois de apagar
const TABELAS = ['matches', 'sessions', 'convocatorias'];
const LISTAS = ['convocados', 'starters', 'attendance', 'faltas', 'lesionados', 'escalao'];
const MAPAS = ['report', 'ratings'];

const lista = (v) => (Array.isArray(v) ? v : []);
const objeto = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);

async function lerTudo(consulta) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await consulta().range(de, de + 999);
    if (error) throw error;
    linhas.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return linhas;
}

/* Os campos que o histórico mostra a sair com este jogador. */
function oQueSaiu(campos, id) {
  const saiu = {};
  (Array.isArray(campos) ? campos : []).forEach(c => {
    if (!c || !c.k || c.grande) return;
    if (LISTAS.includes(c.k) && lista(c.de).includes(id) && !lista(c.para).includes(id)) saiu[c.k] = true;
    if (c.k === 'alinhamento' && lista(c.de).includes(id)) saiu.lugar = lista(c.de).indexOf(id);
    if (MAPAS.includes(c.k) && objeto(c.de) && c.de[id] !== undefined) saiu[c.k] = c.de[id];
  });
  return saiu;
}

async function procurarApagados(equipa, existentes) {
  await ensureSession();
  const apagou = await lerTudo(() => supabase.from('activity_log')
    .select('registo_id, em, info, ator_email')
    .eq('team_id', String(equipa)).eq('tabela', 'players').eq('acao', 'apagou')
    .order('em', { ascending: true }));
  const candidatos = apagou.filter(a => a.registo_id && !existentes.has(String(a.registo_id)));
  const resultado = [];
  for (const a of candidatos) {
    const id = String(a.registo_id);
    const t0 = new Date(a.em).getTime();
    const ate = new Date(t0 + JANELA_MS).toISOString();
    const limpeza = await lerTudo(() => supabase.from('activity_log')
      .select('tabela, registo_id, em, campos')
      .eq('team_id', String(equipa)).in('tabela', TABELAS)
      .gte('em', a.em).lte('em', ate)
      .order('em', { ascending: true }));
    const registos = limpeza.map(l => ({ tabela: l.tabela, registoId: String(l.registo_id), saiu: oQueSaiu(l.campos, id) }))
      .filter(r => Object.keys(r.saiu).length);
    if (!registos.length) continue; // não estava em nada: nada a repor
    // A ficha: os valores dos campos ao longo do tempo.
    const hist = await lerTudo(() => supabase.from('activity_log')
      .select('acao, em, info, campos')
      .eq('team_id', String(equipa)).eq('tabela', 'players').eq('registo_id', id)
      .order('em', { ascending: true }));
    const ficha = {};
    hist.forEach(h => {
      const info = objeto(h.info);
      if (info) Object.entries(info).forEach(([k, v]) => { if (ficha[k] === undefined && typeof v !== 'object') ficha[k] = v; });
      (Array.isArray(h.campos) ? h.campos : []).forEach(c => { if (c && c.k && !c.grande && c.para !== undefined) ficha[c.k] = c.para; });
    });
    const info = objeto(a.info) || {};
    const nome = ficha.name || info.name || info.nome || '';
    resultado.push({ id, em: a.em, por: a.ator_email || '', nome, ficha, registos });
  }
  return resultado;
}

function reporNoRegisto(r, id, saiu) {
  const novo = { ...r };
  LISTAS.forEach(k => { if (saiu[k] && !lista(r[k]).includes(id)) novo[k] = [...lista(r[k]), id]; });
  MAPAS.forEach(k => { if (saiu[k] !== undefined) novo[k] = { ...(objeto(r[k]) || {}), [id]: saiu[k] }; });
  if (saiu.lugar !== undefined && Array.isArray(r.alinhamento)) {
    if (!r.alinhamento[saiu.lugar] && !r.alinhamento.includes(id)) {
      novo.alinhamento = r.alinhamento.map((x, i) => (i === saiu.lugar ? id : x));
    } else if (!r.alinhamento.includes(id)) {
      // Lugar já ocupado: fica no banco (convocado, não titular).
      novo.starters = lista(novo.starters).filter(x => x !== id);
    }
  }
  return novo;
}

export function RecuperarApagados({ players, setPlayers, matches, setMatches, sessions, setSessions, convocatorias, setConvocatorias, teamId }) {
  const [apagados, setApagados] = useState(null);
  const [aRepor, setARepor] = useState(null);
  const [feitos, setFeitos] = useState([]);

  useEffect(() => {
    let cancelado = false;
    const equipa = teamId || T.equipaId;
    if (!equipa) return undefined;
    procurarApagados(equipa, new Set((players || []).map(p => String(p.id))))
      .then(r => { if (!cancelado) setApagados(r); })
      .catch(() => { if (!cancelado) setApagados([]); });
    return () => { cancelado = true; };
    // Procura-se uma vez ao abrir o Plantel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const visiveis = (apagados || []).filter(a => !feitos.includes(a.id) && !(players || []).some(p => String(p.id) === a.id));
  if (!visiveis.length) return null;

  const contar = (a) => {
    const n = (t) => new Set(a.registos.filter(r => r.tabela === t).map(r => r.registoId)).size;
    const comMinutos = new Set(a.registos.filter(r => r.tabela === 'matches' && r.saiu.report !== undefined).map(r => r.registoId)).size;
    const noOnze = new Set(a.registos.filter(r => r.tabela === 'matches' && r.saiu.lugar !== undefined).map(r => r.registoId)).size;
    return { jogos: n('matches'), treinos: n('sessions'), convocatorias: n('convocatorias'), comMinutos, noOnze };
  };

  const repor = (a) => {
    const saida = String(a.em).slice(0, 10);
    const { id: _ignorar, ...resto } = a.ficha; // eslint-disable-line no-unused-vars
    const jogador = { ...resto, id: a.id, name: a.nome || resto.name || 'Jogador reposto', exitDate: resto.exitDate || saida };
    setPlayers(prev => (prev.some(p => String(p.id) === a.id) ? prev : [...prev, jogador]));
    const porTabela = (t) => {
      const m = new Map();
      a.registos.filter(r => r.tabela === t).forEach(r => m.set(r.registoId, { ...(m.get(r.registoId) || {}), ...r.saiu }));
      return m;
    };
    const aplicar = (setter, t) => {
      const mapa = porTabela(t);
      if (!mapa.size || !setter) return;
      setter(prev => (prev || []).map(r => (mapa.has(String(r.id)) ? reporNoRegisto(r, a.id, mapa.get(String(r.id))) : r)));
    };
    aplicar(setMatches, 'matches');
    aplicar(setSessions, 'sessions');
    aplicar(setConvocatorias, 'convocatorias');
    setFeitos(f => [...f, a.id]);
    setARepor(null);
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14, padding: '10px 14px', borderRadius: 10, border: `1px solid ${T.gold}`, background: T.surface }}>
        <span style={{ fontSize: 13, color: T.cream, flex: 1, minWidth: 240 }}>
          {visiveis.length === 1 ? 'Há 1 jogador apagado' : `Há ${visiveis.length} jogadores apagados`} que estava{visiveis.length === 1 ? '' : 'm'} em jogos ou treinos.
          Se só saíram do clube, podem voltar como "saiu do clube", com o histórico.
        </span>
        {visiveis.map(a => (
          <Btn key={a.id} variant="ghost" onClick={() => setARepor(a)}><RotateCcw size={14} /> {a.nome || 'Jogador sem nome'}</Btn>
        ))}
      </div>
      {aRepor && (() => {
        const c = contar(aRepor);
        return (
          <Modal title={`Repor ${aRepor.nome || 'jogador'}`} subtitle={`Apagado a ${fmtShort(String(aRepor.em).slice(0, 10))}${aRepor.por ? ` por ${aRepor.por}` : ''}`} onClose={() => setARepor(null)}>
            <div style={{ fontSize: 13.5, color: T.cream, lineHeight: 1.6 }}>
              Volta ao plantel como <strong>saiu do clube</strong> a {fmtShort(String(aRepor.em).slice(0, 10))} (podes mudar a data na ficha), e volta a:
              <ul style={{ margin: '8px 0 12px', paddingLeft: 20 }}>
                {c.jogos > 0 && <li>{c.jogos} {c.jogos === 1 ? 'jogo' : 'jogos'} ({c.noOnze} no onze; minutos e notas recuperados em {c.comMinutos})</li>}
                {c.treinos > 0 && <li>{c.treinos} {c.treinos === 1 ? 'treino' : 'treinos'} (presenças)</li>}
                {c.convocatorias > 0 && <li>{c.convocatorias} {c.convocatorias === 1 ? 'convocatória' : 'convocatórias'}</li>}
              </ul>
              <span style={{ color: T.mutedDim, fontSize: 12.5 }}>
                Não voltam: a fotografia, e o bem-estar, PSE, boletim clínico e desenvolvimento que a limpeza apagou (o histórico não guarda esses valores).
                Se o lugar dele no onze já estiver ocupado, fica no banco.
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <Btn variant="ghost" onClick={() => setARepor(null)}>Cancelar</Btn>
              <Btn onClick={() => repor(aRepor)}><RotateCcw size={14} /> Repor</Btn>
            </div>
          </Modal>
        );
      })()}
    </>
  );
}

// Para testes.
export const _interno = { oQueSaiu, reporNoRegisto };
