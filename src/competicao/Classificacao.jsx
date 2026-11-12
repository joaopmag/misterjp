// competicao/Classificacao.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useState, useEffect } from 'react';
import { useIsMobile, Btn, EmptyState, askConfirm, Modal, Field, Input, Select } from '../base/ui';
import { todayStr, timeAgo, uid, fmtDate } from '../base/utilidades';
import { T, body, TEXT_ON_ACCENT, display, mono } from '../base/tema';
import { Pencil, ChevronLeft, ChevronRight, Plus, X, Trash2, RefreshCw, Check } from 'lucide-react';
import { LegendaZonas, activeCompetitionOf, competitionTable, computeStandingsFromRounds, emptyCompetition, ensureMatchSession, estiloZona, limparEquipaDuplicada, normalizeStandings, parseScore, syncCompetitionConvocatorias, syncCompetitionMatches } from './dados';
import { ToggleBtn } from '../base/ui-extra';

export function LeagueStandings({ standings, setStandings, standingsMeta, matches, setMatches, season, convocatorias, setConvocatorias, sessions, setSessions }) {
  const [editing, setEditing] = useState(false); // false | true | 'config'
  const [roundIdx, setRoundIdx] = useState(0);
  const isNarrow = useIsMobile(560);
  // Repara a equipa duplicada, se existir (ver limparEquipaDuplicada).
  const { competitions } = limparEquipaDuplicada(standings, season);

  /* A reparação também é GRAVADA, e não só mostrada: se ficasse apenas na
     leitura, a linha a mais voltava a aparecer a cada recarregamento. Corre
     uma vez, quando há mesmo alguma coisa a reparar. */
  useEffect(() => {
    if (!setStandings || !season) return;
    const limpo = limparEquipaDuplicada(standings, season);
    if (JSON.stringify(limpo.competitions) !== JSON.stringify(normalizeStandings(standings).competitions)) {
      setStandings({ ...normalizeStandings(standings), ...limpo });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standings, season]);
  // Competição a ver neste painel. Arranca na ativa (a última editada) e
  // pode alternar-se sem abrir a janela de configuração.
  const [viewId, setViewId] = useState(null);
  const comp = competitions.find(c => c.id === viewId) || activeCompetitionOf(standings);
  const teams = competitionTable(comp);
  const rounds = (comp && comp.rounds) || [];
  const round = rounds[roundIdx];

  // A jornada mais recente é a última que já teve jogos com data até
  // hoje — não é sempre a primeira da lista (isso só fazia sentido no
  // início da época). Sem data nenhuma nos jogos, fica-se na primeira.
  const jornadaMaisRecente = (lista) => {
    const hoje = todayStr();
    let melhorIdx = 0, melhorData = null;
    lista.forEach((r, i) => {
      (r.games || []).forEach(g => {
        if (g.date && g.date <= hoje && (melhorData == null || g.date > melhorData)) { melhorData = g.date; melhorIdx = i; }
      });
    });
    return melhorIdx;
  };

  useEffect(() => { setRoundIdx(jornadaMaisRecente(rounds)); }, [comp && comp.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Ao chegarem novas jornadas (ex: outra pessoa acabou de atualizar),
    // mantém-nos na última em vez de saltar para trás.
    if (roundIdx >= rounds.length && rounds.length > 0) setRoundIdx(rounds.length - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounds.length]);

  const hasData = teams.length > 0 || rounds.length > 0;

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ color: T.cream, fontSize: 15, fontWeight: 500 }}>{(comp && comp.name) || 'Classificação da competição'}</div>
          {standingsMeta?.email && (
            <div style={{ fontSize: 11, color: T.mutedDim, marginTop: 2 }}>Atualizado por {standingsMeta.email} · {timeAgo(standingsMeta.at)}</div>
          )}
        </div>
        <Btn variant="ghost" onClick={() => setEditing(true)}><Pencil size={14} /> Competições e jornadas</Btn>
      </div>

      {competitions.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {competitions.map(c => (
            <button key={c.id} type="button" onClick={() => setViewId(c.id)} style={{
              padding: '5px 11px', borderRadius: 16, fontSize: 12, cursor: 'pointer', ...body,
              background: comp && c.id === comp.id ? '#B5393F' : 'transparent',
              color: comp && c.id === comp.id ? TEXT_ON_ACCENT : T.muted,
              border: `1px solid ${comp && c.id === comp.id ? '#B5393F' : T.line}`,
            }}>{c.name || 'Sem nome'}</button>
          ))}
        </div>
      )}

      {!hasData ? (
        <EmptyState text="Ainda sem competições configuradas. Usa 'Competições e jornadas' para criar a competição, as equipas e as jornadas." />
      ) : (
        <>
          {rounds.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 10 }}>
                <button onClick={() => setRoundIdx(i => Math.max(0, i - 1))} disabled={roundIdx === 0}
                  style={{ background: 'none', border: 'none', color: roundIdx === 0 ? T.mutedDim : T.cream, cursor: roundIdx === 0 ? 'default' : 'pointer' }}>
                  <ChevronLeft size={18} />
                </button>
                <span style={{ ...display, fontSize: 14, color: T.cream, textTransform: 'uppercase', letterSpacing: '.06em' }}>{round?.label || `Jornada ${roundIdx + 1}`}</span>
                <button onClick={() => setRoundIdx(i => Math.min(rounds.length - 1, i + 1))} disabled={roundIdx === rounds.length - 1}
                  style={{ background: 'none', border: 'none', color: roundIdx === rounds.length - 1 ? T.mutedDim : T.cream, cursor: roundIdx === rounds.length - 1 ? 'default' : 'pointer' }}>
                  <ChevronRight size={18} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(() => {
                  const jogos = round?.games || [];
                  const dataCurta = (d) => (d
                    ? (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : d)
                    : '');
                  /* A DATA VOLTA À COLUNA PRÓPRIA, MAS SÓ ESCREVE QUANDO MUDA.

                     Como nas listas de resultados (zerozero e semelhantes):
                     uma coluna de data à esquerda, alinhada como qualquer
                     outra — só que fica em branco enquanto o jogo seguinte
                     for do mesmo dia. A data volta a escrever-se assim que
                     mudar, ou se a jornada tiver jogos em dias diferentes.

                     NO TELEMÓVEL a coluna sai da linha e sobe para cima do
                     jogo (ainda só quando muda): a largura já é pouca para
                     duas equipas, e tirar-lhe mais uns pixels para a data
                     era o que forçava os nomes a cortar cedo demais.

                     O "vs" ALINHADO COM O CENTRO DA JORNADA, a sério.

                     Com `flex:1` nos dois nomes, um nome curto de um lado e
                     comprido do outro (frequente — nem todas as equipas têm
                     nomes do mesmo tamanho) fazia o dois lados crescerem de
                     forma desigual assim que um deles batia no limite de
                     largura, empurrando o "vs" para um dos lados. Uma grelha
                     com as duas colunas dos nomes em `1fr` cada garante que
                     ficam SEMPRE com a mesma largura, o que quer que lá
                     esteja escrito — por isso o "vs" cai sempre exatamente a
                     meio, alinhado com o título da jornada por cima (que
                     também está centrado na largura toda). No desktop, a
                     coluna da data (só à esquerda) ganha uma gémea invisível
                     à direita, do mesmo tamanho — sem isso, tirar espaço só
                     de um lado deslocava o centro do resto da linha. */
                  return jogos.map((g, i) => {
                    const mostraData = i === 0 || g.date !== jogos[i - 1].date;
                    const nomeEquipa = (nome, lado) => {
                      const somosNos = /salgueiros/i.test(nome || '');
                      return (
                        <span style={{
                          minWidth: 0, textAlign: lado, color: T.cream, opacity: somosNos ? 1 : 0.72, // a nossa equipa: branco e negrito; as outras, um pouco esbatidas
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          fontWeight: somosNos ? 800 : 400,
                        }} title={nome}>{nome}</span>
                      );
                    };
                    const confronto = (
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
                        columnGap: 8, width: '100%', maxWidth: 420, margin: '0 auto',
                      }}>
                        {nomeEquipa(g.home, 'right')}
                        <span style={{ ...mono, color: T.gold, flexShrink: 0 }}>{g.score || 'vs'}</span>
                        {nomeEquipa(g.away, 'left')}
                      </div>
                    );
                    return (
                      <div key={g.id || i}>
                        {isNarrow && mostraData && dataCurta(g.date) && (
                          <div style={{ ...mono, fontSize: 11, color: T.mutedDim, textAlign: 'center', margin: '8px 0 2px' }}>
                            {dataCurta(g.date)}
                          </div>
                        )}
                        {isNarrow ? (
                          <div style={{ padding: '6px 10px', fontSize: 13, borderBottom: `1px solid ${T.line}` }}>
                            {confronto}
                          </div>
                        ) : (
                          <div style={{
                            display: 'grid', gridTemplateColumns: '40px 1fr 40px', alignItems: 'center',
                            gap: 10, padding: '6px 10px', fontSize: 13, borderBottom: `1px solid ${T.line}`,
                          }}>
                            <span style={{ ...mono, fontSize: 11, color: T.mutedDim }}>
                              {mostraData ? dataCurta(g.date) : ''}
                            </span>
                            {confronto}
                            <span aria-hidden="true" />
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Nomes longos ("FC Paços Ferreira (B)") partiam-se em duas
              linhas e faziam essa linha da tabela ficar mais alta do que as
              outras, desalinhando a coluna dos números. Agora o nome fica
              sempre numa linha, com reticências se não couber, e a tabela
              desliza na horizontal no telemóvel. */}
          {teams.length > 0 && (
            <div className="mjp-scroll-fino" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, tableLayout: 'fixed', minWidth: 460 }}>
                <thead>
                  <tr style={{ color: T.mutedDim, ...mono, fontSize: 11 }}>
                    <th style={{ textAlign: 'left', padding: '4px 6px', width: 30 }}>#</th>
                    <th style={{ textAlign: 'left', padding: '4px 6px' }}>Equipa</th>
                    {['P', 'J', 'V', 'E', 'D', 'GM', 'GS', 'DG'].map(h => (
                      <th key={h} style={{ padding: '4px 6px', width: 34 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t, i) => {
                    const isUs = /salgueiros/i.test(t.name || '');
                    return (
                      <tr key={t.id} style={{ color: isUs ? T.gold : T.cream, background: isUs ? `${T.crimson}22` : 'transparent', borderTop: `1px solid ${T.line}` }}>
                        <td style={{ padding: '5px 6px 5px 9px', ...mono, ...estiloZona(comp, i, teams.length) }}>{i + 1}</td>
                        <td
                          title={t.name}
                          style={{
                            padding: '5px 6px', fontWeight: isUs ? 600 : 400,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 0,
                          }}
                        >{t.name}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono, fontWeight: 600 }}>{t.P}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono }}>{t.J}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono }}>{t.V}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono }}>{t.E}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono }}>{t.D}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono }}>{t.GM}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono }}>{t.GS}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono }}>{t.DG > 0 ? `+${t.DG}` : t.DG}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <LegendaZonas comp={comp} />
              {comp && !comp.campeao && !(parseInt(comp.sobem, 10) > 0) && !(parseInt(comp.descem, 10) > 0) && (
                <button type="button" onClick={() => setEditing('config')} style={{ marginTop: 8, background: 'none', border: 'none', color: T.warn, cursor: 'pointer', padding: 0, fontSize: 12, ...body }}>
                  Definir campeão, subida e descida desta competição
                </button>
              )}
            </div>
          )}
        </>
      )}

      {editing && (
        <StandingsModal
          standings={standings}
          tabInicial={editing === 'config' ? 'config' : 'resultados'}
          competicaoInicial={editing === 'config' && comp ? comp.id : null}
          onClose={() => setEditing(false)}
          onSave={(data) => {
            setStandings(data);
            // Cria/atualiza na lista de Jogos os encontros da nossa equipa.
            if (setMatches) {
              const jogos = syncCompetitionMatches(data.competitions, matches);
              setMatches(jogos);
              // Cada jogo nosso lançado na tabela ganha a sua convocatória,
              // já com a moldura preenchida e os nomes por escolher.
              if (setConvocatorias) setConvocatorias(prev => syncCompetitionConvocatorias(jogos, prev, season));
              // E a sua sessão em Planeamento (ver ensureMatchSession) — sem
              // isto, um jogo que entra sozinho a partir da jornada nunca
              // tinha sessão associada, e o PSE do dia não aparecia no
              // check-in dos atletas a menos que o treinador criasse a
              // sessão à mão.
              if (setSessions) setSessions(prev => jogos.reduce((acc, j) => ensureMatchSession(j, acc), prev));
            }
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

export function StandingsModal({ standings, onClose, onSave, tabInicial, competicaoInicial }) {
  /* No telemóvel a linha de um jogo (equipa, golos, golos, equipa, data,
     apagar) não cabe: são 6 colunas com larguras fixas que somam bem mais
     do que 380 px. Em vez de deixar a janela arrastar-se de lado — o que
     descentra tudo e faz perder a coluna onde se estava —, a linha
     parte-se em duas: equipas e resultado em cima, data e apagar em baixo. */
  const estreito = useIsMobile(620);
  const colunasJogo = estreito ? '1fr 44px 44px 1fr' : '1fr 54px 54px 1fr 150px 24px';
  const initial = normalizeStandings(standings);
  const [competitions, setCompetitions] = useState(
    initial.competitions.length ? initial.competitions : [emptyCompetition('')]
  );
  const [activeId, setActiveId] = useState(
    (competicaoInicial && initial.competitions.some(c => c.id === competicaoInicial) ? competicaoInicial : null)
    || initial.activeId || (initial.competitions[0] && initial.competitions[0].id) || null
  );
  const [tab, setTab] = useState(tabInicial || 'resultados'); // 'config' | 'resultados'
  /* ABRE NA JORNADA QUE ESTÁ A DECORRER: a que tem jogos com a data mais
     perto de hoje (em empate, a que vem a seguir). Antes abria sempre na
     1.ª e era preciso andar jornada a jornada até à atual. */
  const jornadaAtual = (c) => {
    const lista = (c && c.rounds) || [];
    const hoje = new Date(`${todayStr()}T12:00:00`).getTime();
    let melhor = -1, dist = Infinity;
    lista.forEach((r, i) => {
      (r.games || []).forEach(g => {
        const d = String((g && g.date) || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
        const x = Math.abs(new Date(`${d}T12:00:00`).getTime() - hoje);
        if (x < dist || (x === dist && i > melhor)) { dist = x; melhor = i; }
      });
    });
    return melhor >= 0 ? melhor : 0;
  };
  const [roundIdx, setRoundIdx] = useState(() => {
    const id0 = (competicaoInicial && initial.competitions.some(c => c.id === competicaoInicial) ? competicaoInicial : null)
      || initial.activeId || (initial.competitions[0] && initial.competitions[0].id) || null;
    return jornadaAtual(initial.competitions.find(c => c.id === id0) || initial.competitions[0]);
  });
  const [notice, setNotice] = useState('');

  const comp = competitions.find(c => c.id === activeId) || competitions[0];
  useEffect(() => {
    if (comp && !competitions.some(c => c.id === activeId)) setActiveId(comp.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitions.length]);

  const patchComp = (patch) => setCompetitions(cs => cs.map(c => (c.id === comp.id ? { ...c, ...patch } : c)));

  // --- competições -----------------------------------------------
  const addCompetition = () => {
    const nova = emptyCompetition('');
    setCompetitions(cs => [...cs, nova]);
    setActiveId(nova.id);
    setRoundIdx(0);
    setTab('config');
    setNotice('');
  };
  const removeCompetition = (id) => {
    const rest = competitions.filter(c => c.id !== id);
    setCompetitions(rest.length ? rest : [emptyCompetition('')]);
    setActiveId((rest[0] && rest[0].id) || null);
    setRoundIdx(0);
  };

  // --- equipas ----------------------------------------------------
  const teamNames = comp.teamNames || [];
  const setTeamName = (i, name) => {
    const antigo = (teamNames[i] || '').trim();
    const novo = (name || '').trim();
    const patch = { teamNames: teamNames.map((t, j) => (j === i ? name : t)) };
    /* Renomear uma equipa não pode deixar para trás quem já a usava —
       os jogos guardam o nome da equipa como TEXTO em cada linha (não
       uma ligação à lista), e "a minha equipa" também é só um texto.
       Sem isto, mudar "SC Salgueiros" para outra coisa deixava todos os
       jogos já marcados a apontar para um nome que já não existe em
       lado nenhum — ficavam "órfãos", mostrando "— escolher —" em vez
       da equipa certa. Só se troca quando o nome antigo era mesmo
       válido (não vazio) e for diferente do novo — nunca ao escrever
       pela primeira vez numa equipa nova. */
    if (antigo && novo && antigo !== novo) {
      if (comp.myTeam === antigo) patch.myTeam = novo;
      patch.rounds = (comp.rounds || []).map(r => ({
        ...r,
        games: (r.games || []).map(g => ({
          ...g,
          home: g.home === antigo ? novo : g.home,
          away: g.away === antigo ? novo : g.away,
        })),
      }));
    }
    patchComp(patch);
  };
  const addTeamName = () => patchComp({ teamNames: [...teamNames, ''] });
  const removeTeamName = (i) => patchComp({ teamNames: teamNames.filter((_, j) => j !== i) });
  const validTeams = teamNames.map(t => (t || '').trim()).filter(Boolean);

  // --- jornadas ---------------------------------------------------
  const rounds = comp.rounds || [];
  const setRoundsCount = (n) => {
    const target = Math.max(0, Math.min(60, Number(n) || 0));
    if (target > rounds.length) {
      const extra = Array.from({ length: target - rounds.length }, (_, k) => ({
        id: uid(), label: `Jornada ${rounds.length + k + 1}`, games: [],
      }));
      patchComp({ rounds: [...rounds, ...extra] });
      setNotice('');
      return;
    }
    if (target < rounds.length) {
      // Só remove jornadas do fim que ainda não tenham jogos — nunca apaga
      // resultados já introduzidos sem avisar.
      let next = [...rounds];
      while (next.length > target && (next[next.length - 1].games || []).length === 0) next.pop();
      patchComp({ rounds: next });
      setNotice(next.length > target
        ? `Ficaram ${next.length} jornadas: as restantes já têm jogos registados e não foram apagadas.`
        : '');
      setRoundIdx(i => Math.max(0, Math.min(i, next.length - 1)));
    }
  };

  const round = rounds[roundIdx] || null;
  const addGame = () => {
    if (!round) return;
    patchComp({
      rounds: rounds.map((r, i) => (i === roundIdx
        // O id do jogo é o que liga este resultado ao jogo criado na
        // secção Jogos e na agenda do Planeamento (ver syncCompetitionMatches).
        ? { ...r, games: [...(r.games || []), { id: uid(), home: '', away: '', homeGoals: '', awayGoals: '', score: '', date: '' }] }
        : r)),
    });
  };
  /* SEGUNDA VOLTA — as mesmas jornadas outra vez, com as equipas trocadas.

     Num campeonato de duas voltas a segunda metade é a primeira ao
     espelho: se a jornada 1 foi Nogueirense vs Salgueiros, a 18 é
     Salgueiros vs Nogueirense. Escrever isso à mão são 170 linhas em 17
     jornadas de 10 jogos, todas elas já escritas uma vez.

     Jogos sem as duas equipas escolhidas ficam de fora: uma linha vazia
     não tem lado nenhum para trocar. */

  /* A SEGUNDA VOLTA PREENCHE JORNADAS QUE JÁ EXISTEM — NÃO CRIA NENHUMA.

     O calendário costuma ser criado inteiro de uma vez na Configuração
     (34 jornadas), e só a primeira volta é que está escrita. O que falta
     não são jornadas, são os jogos dentro das que já lá estão vazias.

     Como se lê o calendário:
       · a PRIMEIRA VOLTA vai do início até à última jornada com jogos —
         uma jornada vazia pelo meio não a corta ao meio, fica só sem
         espelho (uma jornada vazia espelha-se numa jornada vazia);
       · as jornadas a seguir a essa estão todas vazias, por definição,
         e são elas que recebem o espelho, pela mesma ordem.

     Nada é criado e nada é escrito por cima: se não houver jornadas
     vazias a seguir, o botão fica desligado. É isso que torna dispensável
     qualquer marca de "já foi gerada" — correr outra vez não tem onde
     escrever, porque as jornadas de destino já deixaram de estar vazias. */
  const ultimaComJogos = rounds.reduce((ultimo, r, i) => ((r.games || []).length ? i : ultimo), -1);
  const jornadasPrimeiraVolta = ultimaComJogos + 1;
  const jornadasVazias = rounds.length - jornadasPrimeiraVolta;
  const jornadasAPreencher = Math.max(0, Math.min(jornadasPrimeiraVolta, jornadasVazias));
  const jogosParaEspelhar = rounds.slice(0, jornadasAPreencher).reduce(
    (n, r) => n + (r.games || []).filter(g => g.home && g.away).length, 0,
  );
  const podeGerarSegundaVolta = jornadasAPreencher > 0 && jogosParaEspelhar > 0;
  // Quando as vazias não chegam para toda a primeira volta, diz-se quantas
  // faltam em vez de se inventarem jornadas que o treinador não pediu.
  const jornadasEmFalta = Math.max(0, jornadasPrimeiraVolta - jornadasVazias);

  const gerarSegundaVolta = () => {
    if (!podeGerarSegundaVolta) return;
    const inicio = jornadasPrimeiraVolta;
    const fim = inicio + jornadasAPreencher;
    const nome = (i) => (rounds[i] && rounds[i].label) || `Jornada ${i + 1}`;
    askConfirm({
      title: 'Preencher a segunda volta?',
      label: `${nome(inicio)} a ${nome(fim - 1)} de "${comp.name || 'sem nome'}"`,
      note: [
        `${jogosParaEspelhar} ${jogosParaEspelhar === 1 ? 'jogo copiado' : 'jogos copiados'} de ${nome(0)} a ${nome(jornadasAPreencher - 1)}, pela mesma ordem e com casa e fora trocados. Sem resultados nem datas.`,
        jornadasEmFalta
          ? `Não há jornadas vazias que cheguem: ficam ${jornadasEmFalta} por espelhar. Aumenta o número de jornadas na Configuração se quiseres a volta completa.`
          : '',
      ].filter(Boolean).join(' '),
      confirmLabel: 'Preencher',
      destructive: false,
      onConfirm: () => {
        /* O id e o rótulo da jornada de destino MANTÊM-SE: ela já existe,
           já pode ter sido renomeada, e trocar-lhe o id desligava-a de
           tudo o que lhe aponte. Só os jogos é que entram.

           Ids de jogo novos, e sem resultado nem data: a segunda volta
           ainda não se jogou, e um id repetido ligava dois encontros ao
           mesmo jogo da lista de Jogos (ver syncCompetitionMatches). */
        const espelhar = (jogos) => (jogos || [])
          .filter(g => g.home && g.away)
          .map(g => ({
            id: uid(),
            home: g.away, away: g.home,
            homeGoals: '', awayGoals: '', score: '', date: '',
          }));
        patchComp({
          rounds: rounds.map((r, i) => (
            i >= inicio && i < fim ? { ...r, games: espelhar(rounds[i - inicio].games) } : r
          )),
        });
        setNotice(`Segunda volta preenchida: ${nome(inicio)} a ${nome(fim - 1)}.`);
        setRoundIdx(inicio);
      },
    });
  };

  /* Sem data, um jogo fica sempre no fim (pela ordem em que foi criado);
     com data, ordena cronologicamente. */
  const compararJogosPorData = (a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  };
  const updateGame = (gi, patch) => {
    patchComp({
      rounds: rounds.map((r, i) => {
        if (i !== roundIdx) return r;
        const jogos = r.games.map((g, j) => (j === gi ? { ...g, id: g.id || uid(), ...patch } : g));
        /* A lista ordena-se sozinha pela data, sempre que ela muda: pôr
           uma data mais à frente empurra o jogo para o fim; pôr uma mais
           cedo do que as outras traz para o início — sem ser preciso
           arrastar linhas à mão. Como a chave de cada linha é o `id` do
           jogo (não a posição), reordenar não faz o foco saltar de
           campo enquanto se escreve. */
        return { ...r, games: [...jogos].sort(compararJogosPorData) };
      }),
    });
  };

  /* UMA JORNADA JOGA-SE QUASE SEMPRE NO MESMO DIA.

     Escrever a mesma data dez vezes seguidas, uma por jogo, é o trabalho
     mais repetitivo desta página inteira. Ao pôr a data num jogo,
     pergunta-se se serve para os outros da jornada — e só se pergunta
     quando há mesmo outros com data diferente, para a caixa não aparecer
     por nada.

     A pergunta é sobre a jornada ABERTA e só sobre ela: jornadas
     diferentes jogam-se em fins de semana diferentes.

     O filtro do ano é o que impede o diálogo de saltar a meio da
     escrita. Um campo de data devolve valores completos mas ainda
     absurdos enquanto se escreve o ano a tecla a tecla (0002, 0202, e só
     depois 2026); sem isto a pergunta aparecia antes de a data estar
     escrita. */
  const setGameDate = (gi, valor) => {
    const jogos = (round && round.games) || [];
    const antes = (jogos[gi] || {}).date || '';
    updateGame(gi, { date: valor });
    if (valor === antes) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number(valor.slice(0, 4)) < 1900) return;
    const porPreencher = jogos.filter((g, j) => j !== gi && (g.date || '') !== valor);
    if (!porPreencher.length) return;
    const rotulo = (round && round.label) || `Jornada ${roundIdx + 1}`;
    askConfirm({
      title: 'Mesma data para toda a jornada?',
      label: `${rotulo}: ${porPreencher.length} ${porPreencher.length === 1 ? 'outro jogo fica' : 'outros jogos ficam'} com ${fmtDate(valor)}`,
      note: porPreencher.some(g => g.date)
        ? 'As datas diferentes que já lá estejam são substituídas.'
        : '',
      confirmLabel: 'Preencher',
      destructive: false,
      onConfirm: () => {
        patchComp({
          rounds: rounds.map((r, i) => (i === roundIdx
            ? { ...r, games: (r.games || []).map(g => ({ ...g, id: g.id || uid(), date: valor })) }
            : r)),
        });
      },
    });
  };
  // Os golos são introduzidos em dois seletores numéricos; o campo `score`
  // continua a ser gravado ("2-1") porque é dele que a classificação e os
  // registos antigos dependem.
  const setGoals = (gi, side, val) => {
    const g = (round.games || [])[gi] || {};
    const sc = parseScore(g.score);
    const cur = {
      home: g.homeGoals !== undefined && g.homeGoals !== '' ? g.homeGoals : (sc ? sc.home : ''),
      away: g.awayGoals !== undefined && g.awayGoals !== '' ? g.awayGoals : (sc ? sc.away : ''),
    };
    const clean = val === '' ? '' : Math.max(0, Math.min(99, Number(val) || 0));
    const next = { ...cur, [side]: clean };
    const score = (next.home === '' || next.away === '') ? '' : `${next.home}-${next.away}`;
    updateGame(gi, { homeGoals: next.home, awayGoals: next.away, score });
  };
  const removeGame = (gi) => {
    patchComp({ rounds: rounds.map((r, i) => (i === roundIdx ? { ...r, games: r.games.filter((_, j) => j !== gi) } : r)) });
  };

  // --- classificação ----------------------------------------------
  const previewTeams = competitionTable(comp);
  const gamesCounted = rounds.reduce((n, r) => n + (r.games || []).filter(g => parseScore(g.score) && g.home && g.away).length, 0);
  const gamesTotal = rounds.reduce((n, r) => n + (r.games || []).length, 0);

  const manualTeams = comp.teams && comp.teams.length
    ? comp.teams
    : validTeams.map(n => ({ id: uid(), name: n, J: 0, V: 0, E: 0, D: 0, GM: 0, GS: 0 }));
  const updateManualTeam = (id, field, val) => patchComp({ teams: manualTeams.map(t => (t.id === id ? { ...t, [field]: val } : t)) });

  const save = () => {
    const cleaned = competitions
      .map(c => ({ ...c, name: (c.name || '').trim(), teamNames: (c.teamNames || []).map(t => (t || '').trim()).filter(Boolean) }))
      .filter(c => c.name || (c.rounds || []).length || (c.teamNames || []).length)
      .map(c => ({ ...c, teams: c.auto === false ? (c.teams || []) : computeStandingsFromRounds(c.rounds || [], c.teamNames || []) }));
    const act = cleaned.find(c => c.id === activeId) || cleaned[0] || null;
    onSave({
      competitions: cleaned,
      activeId: act ? act.id : null,
      // Espelho do formato antigo, para leitores que ainda o usem.
      competition: act ? act.name : '',
      teams: act ? act.teams : [],
      rounds: act ? act.rounds : [],
      auto: act ? act.auto !== false : true,
    });
  };

  const tabBtn = (id, label) => (
    <button type="button" onClick={() => setTab(id)} style={{
      padding: '7px 14px', borderRadius: 8, fontSize: 12.5, cursor: 'pointer', ...body,
      background: tab === id ? '#B5393F' : 'transparent',
      color: tab === id ? TEXT_ON_ACCENT : T.muted,
      border: `1px solid ${tab === id ? '#B5393F' : T.line}`,
    }}>{label}</button>
  );

  return (
    <Modal title="Competições e classificação" onClose={onClose} wide xwide fullPage>
      {/* --- seletor de competição --- */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Competição</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {competitions.map(c => (
            <button key={c.id} type="button" onClick={() => { setActiveId(c.id); setRoundIdx(jornadaAtual(c)); setNotice(''); }} style={{
              padding: '6px 12px', borderRadius: 16, fontSize: 12.5, cursor: 'pointer', ...body,
              background: c.id === comp.id ? '#B5393F' : 'transparent',
              color: c.id === comp.id ? TEXT_ON_ACCENT : T.muted,
              border: `1px solid ${c.id === comp.id ? '#B5393F' : T.line}`,
            }}>{c.name || 'Sem nome'}</button>
          ))}
          <Btn variant="ghost" onClick={addCompetition} style={{ padding: '6px 12px', fontSize: 12.5 }}><Plus size={13} /> Nova competição</Btn>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {tabBtn('config', 'Configuração')}
        {tabBtn('resultados', 'Resultados e classificação')}
      </div>

      {notice && (
        <div style={{ fontSize: 12, color: T.warn, marginBottom: 12 }}>{notice}</div>
      )}

      {/* ================= CONFIGURAÇÃO ================= */}
      {tab === 'config' && (
        <>
          <div style={{ marginBottom: 18 }}>
            <Field label="Nome da competição">
              <Input value={comp.name || ''} onChange={e => patchComp({ name: e.target.value })}
                placeholder="Ex: AF Porto · 1ª Divisão Sub-19 · Série 2" />
            </Field>
          </div>

          <div style={{ marginBottom: 18, maxWidth: 220 }}>
            <Field label="Número de jornadas">
              <Input type="number" min="0" max="60" value={rounds.length}
                onChange={e => setRoundsCount(e.target.value)} />
            </Field>
          </div>

          {/* Campeão, subida e descida — ficam marcados na classificação. */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Subida e descida</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ width: 150 }}>
                <Field label="Equipas que sobem">
                  <Input type="number" min="0" max="30" value={comp.sobem ?? 0}
                    onChange={e => patchComp({ sobem: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
                </Field>
              </div>
              <div style={{ width: 150 }}>
                <Field label="Equipas que descem">
                  <Input type="number" min="0" max="30" value={comp.descem ?? 0}
                    onChange={e => patchComp({ descem: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
                </Field>
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.cream, cursor: 'pointer', paddingBottom: 10 }}>
                <input type="checkbox" checked={!!comp.campeao} onChange={e => patchComp({ campeao: e.target.checked })} style={{ accentColor: T.gold }} />
                O 1.º lugar é campeão
              </label>
            </div>
            <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 6 }}>Põe 0 se a competição não tiver subida ou descida. O campeão conta como uma das equipas que sobem.</div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Equipas ({validTeams.length})
              </div>
              <Btn variant="ghost" onClick={addTeamName}><Plus size={13} /> Adicionar equipa</Btn>
            </div>
            {teamNames.length === 0 ? (
              <p style={{ fontSize: 12.5, color: T.mutedDim }}>
                Adiciona aqui todas as equipas da competição — passam a aparecer em lista nos resultados, para não haver nomes escritos de forma diferente.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                {teamNames.map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Input value={t} onChange={e => setTeamName(i, e.target.value)} placeholder={`Equipa ${i + 1}`} />
                    <button onClick={() => removeTeamName(i)} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer' }}><X size={15} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 20, maxWidth: 320 }}>
            <Field label="A minha equipa nesta competição">
              <Select value={comp.myTeam || ''} onChange={e => patchComp({ myTeam: e.target.value })}>
                <option value="">— nenhuma —</option>
                {validTeams.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 6, lineHeight: 1.5 }}>
              É por aqui que a app sabe quais dos jogos são teus, para os criar na lista de Jogos e na agenda semanal.
            </div>
          </div>

          {/* Apagar está sempre disponível. Se for a última, fica uma
              competição vazia no lugar — não se pode ficar sem nenhuma. */}
          <button
            type="button"
            onClick={() => {
              /* Único `window.confirm` que restava na app. Passa a usar o
                 mesmo diálogo das outras confirmações — não é bonito ter
                 uma caixa do browser a meio de tudo o resto. */
              const label = comp.name || 'sem nome';
              const temJogos = (comp.rounds || []).some(r => (r.games || []).length > 0);
              askConfirm({
                label: `Competição "${label}"`,
                // Só se avisa quando há mesmo alguma coisa a perder.
                note: temJogos ? 'Os resultados de todas as jornadas serão perdidos.' : '',
                onConfirm: () => removeCompetition(comp.id),
              });
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'none', border: `1px solid ${T.bad}55`, borderRadius: 8, padding: '7px 12px',
              color: T.bad, cursor: 'pointer', fontSize: 12.5, ...body, marginBottom: 8,
            }}
          >
            <Trash2 size={13} /> Apagar a competição "{comp.name || 'sem nome'}"
          </button>
          <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 6, lineHeight: 1.5 }}>
            Os jogos que já tenham sido criados na lista de Jogos não são apagados — se quiseres, apaga-os lá.
          </div>
        </>
      )}

      {/* ================= RESULTADOS ================= */}
      {tab === 'resultados' && (
        <>
          {rounds.length === 0 || validTeams.length === 0 ? (
            <p style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 18 }}>
              Vai primeiro a "Configuração" e define o nome da competição, as equipas e o número de jornadas.
            </p>
          ) : (
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ maxWidth: 240, flex: 1 }}>
                  <Field label="Jornada">
                    <Select value={roundIdx} onChange={e => setRoundIdx(Number(e.target.value))}>
                      {rounds.map((r, i) => (
                        <option key={r.id} value={i}>
                          {r.label}{(r.games || []).length ? ` (${r.games.length})` : ''}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Fica à vista mesmo quando desligado: um botão que
                      desaparece deixa quem procura a funcionalidade a
                      pensar que ela não existe. O `title` diz porquê. */}
                  <Btn
                    variant="ghost"
                    onClick={gerarSegundaVolta}
                    disabled={!podeGerarSegundaVolta}
                    title={podeGerarSegundaVolta
                      ? `Preenche ${jornadasAPreencher} ${jornadasAPreencher === 1 ? 'jornada vazia' : 'jornadas vazias'} com os jogos da primeira volta, com as equipas trocadas`
                      : jornadasVazias === 0
                        ? 'Não há jornadas vazias para preencher. Aumenta o número de jornadas na Configuração.'
                        : 'Preenche primeiro os jogos da primeira volta'}
                  >
                    <RefreshCw size={13} /> Preencher segunda volta
                  </Btn>
                  <Btn variant="ghost" onClick={addGame}><Plus size={13} /> Adicionar jogo</Btn>
                </div>
              </div>

              <div style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: colunasJogo, gap: 6, fontSize: 10.5, color: T.mutedDim, ...mono, padding: '0 2px 6px' }}>
                  <span>Equipa casa</span><span style={{ textAlign: 'center' }}>GM</span><span style={{ textAlign: 'center' }}>GS</span><span>Equipa fora</span><span>Data</span><span />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  {(round?.games || []).map((g, gi) => {
                    const sc = parseScore(g.score);
                    const gh = g.homeGoals !== undefined && g.homeGoals !== '' ? g.homeGoals : (sc ? sc.home : '');
                    const ga = g.awayGoals !== undefined && g.awayGoals !== '' ? g.awayGoals : (sc ? sc.away : '');
                    return (
                      <div key={g.id || gi} style={{ display: 'grid', gridTemplateColumns: colunasJogo, gap: 6, alignItems: 'center' }}>
                        <Select value={g.home} onChange={e => updateGame(gi, { home: e.target.value })}>
                          <option value="">— escolher —</option>
                          {validTeams.map(t => <option key={t} value={t}>{t}</option>)}
                        </Select>
                        <Input type="number" min="0" max="99" value={gh} onChange={e => setGoals(gi, 'home', e.target.value)} style={{ textAlign: 'center', padding: '0 4px' }} />
                        <Input type="number" min="0" max="99" value={ga} onChange={e => setGoals(gi, 'away', e.target.value)} style={{ textAlign: 'center', padding: '0 4px' }} />
                        <Select value={g.away} onChange={e => updateGame(gi, { away: e.target.value })}>
                          <option value="">— escolher —</option>
                          {validTeams.map(t => <option key={t} value={t}>{t}</option>)}
                        </Select>
                        <Input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(g.date || '') ? g.date : ''} onChange={e => setGameDate(gi, e.target.value)} style={{ padding: '0 6px' }} />
                        <button onClick={() => removeGame(gi)} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer' }}><X size={15} /></button>
                      </div>
                    );
                  })}
                </div>
                {(comp.myTeam || '').trim() ? (
                  <div style={{ fontSize: 11.5, color: T.mutedDim, marginBottom: 10, lineHeight: 1.5 }}>
                    Os jogos de <span style={{ color: T.cream }}>{comp.myTeam}</span> com data preenchida entram automaticamente na lista de Jogos e na agenda do Planeamento.
                  </div>
                ) : (
                  <div style={{ fontSize: 11.5, color: T.warn, marginBottom: 10, lineHeight: 1.5 }}>
                    Escolhe "A minha equipa" na Configuração para os teus jogos entrarem sozinhos na lista de Jogos e na agenda.
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Classificação</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <ToggleBtn active={comp.auto !== false} onClick={() => patchComp({ auto: true })}>Automática</ToggleBtn>
                <ToggleBtn active={comp.auto === false} onClick={() => patchComp({ auto: false, teams: manualTeams })} accent>Manual</ToggleBtn>
              </div>
            </div>

            {comp.auto !== false ? (
              <>
                <div style={{ fontSize: 11.5, color: T.mutedDim, marginBottom: 10, lineHeight: 1.5 }}>
                  Calculada a partir dos resultados acima: {gamesCounted} de {gamesTotal} {gamesTotal === 1 ? 'jogo lido' : 'jogos lidos'}.
                  {gamesTotal > gamesCounted && ' Os jogos sem resultado válido (ex: "2-1") não entram na conta.'}
                </div>
                {previewTeams.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: T.mutedDim }}>Ainda sem equipas nem resultados nesta competição.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: `24px minmax(0, 1fr) repeat(8, ${estreito ? 30 : 40}px)`, gap: 4, fontSize: 10.5, color: T.mutedDim, ...mono, padding: '0 4px', minWidth: 0 }}>
                      <span>#</span><span>Equipa</span>
                      {['J', 'V', 'E', 'D', 'GM', 'GS', 'DG', 'P'].map(h => <span key={h} style={{ textAlign: 'center' }}>{h}</span>)}
                    </div>
                    {previewTeams.map((t, i) => (
                      <div key={t.id} style={{
                        display: 'grid', gridTemplateColumns: `24px minmax(0, 1fr) repeat(8, ${estreito ? 30 : 40}px)`, gap: 4, alignItems: 'center', minWidth: 0,
                        background: T.bg, border: `1px solid ${T.line}`, borderRadius: 6, padding: '6px 4px', fontSize: 12.5, ...mono, color: T.mutedDim,
                      }}>
                        <span style={{ textAlign: 'center' }}>{i + 1}</span>
                        <span style={{ color: T.cream, ...body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                        <span style={{ textAlign: 'center' }}>{t.J}</span>
                        <span style={{ textAlign: 'center' }}>{t.V}</span>
                        <span style={{ textAlign: 'center' }}>{t.E}</span>
                        <span style={{ textAlign: 'center' }}>{t.D}</span>
                        <span style={{ textAlign: 'center' }}>{t.GM}</span>
                        <span style={{ textAlign: 'center' }}>{t.GS}</span>
                        <span style={{ textAlign: 'center' }}>{t.DG > 0 ? `+${t.DG}` : t.DG}</span>
                        <span style={{ textAlign: 'center', color: T.warn, fontWeight: 600 }}>{t.P}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: 11.5, color: T.mutedDim, marginBottom: 10 }}>
                  Introdução manual — os pontos e a diferença de golos continuam a ser calculados a partir de V/E/D e GM/GS.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(6, 52px)', gap: 6, fontSize: 10.5, color: T.mutedDim, ...mono, padding: '0 4px' }}>
                    <span>Equipa</span>
                    {['J', 'V', 'E', 'D', 'GM', 'GS'].map(h => <span key={h} style={{ textAlign: 'center' }}>{h}</span>)}
                  </div>
                  {manualTeams.map(t => (
                    <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1fr repeat(6, 52px)', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: T.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                      {['J', 'V', 'E', 'D', 'GM', 'GS'].map(fld => (
                        <Input key={fld} type="number" min="0" value={t[fld]} onChange={e => updateManualTeam(t.id, fld, e.target.value)} style={{ textAlign: 'center', padding: '0 4px', height: 34, lineHeight: '32px' }} />
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={save}><Check size={15} /> Guardar</Btn>
      </div>
    </Modal>
  );
}

