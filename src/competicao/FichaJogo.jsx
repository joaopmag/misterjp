// competicao/FichaJogo.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { shortPlayerName, sortByPosition } from '../dominio/jogadores';
import { mono, T, display, body, T_ESCURO } from '../base/tema';
import React, { useState } from 'react';
import { LAYOUT_FORMACAO, rotuloDoLugar, distribuirOnzeNoCampo, FORMACOES } from '../tatico/Simulador';
import { fmtDate, escapeHtmlText, todayStr } from '../base/utilidades';
import { competitionLabel, isFriendlyMatch } from '../dominio/jogos';
import { useIsMobile, Modal, Select, Btn, EmptyState } from '../base/ui';
import { useArrastarParaTrocar } from '../base/arrastar';
import { Pencil, Share2, Printer } from 'lucide-react';
import { CartaoPlanoDoJogo, EscalacaoNoCampo, EscalacaoPrint, NotasDoJogo, castigadosParaJogo, comQuemLaEsteve, escalacaoDoJogo, escalacaoNovaFormacao, topNoCampoEcra } from './Escalacao';
import { clubeSemEscalao, eventosDoJogo, tituloDoJogo } from './dados';
import { ASPECT_CAMPO_PRINT, MarcacoesCampoPrint, campoDaEquipaHtml, equipaDoAmigavel, equipaEmColunasHtml, posCampoPrint } from '../tatico/impressaoCampo';
import { nomesDosConvidados } from '../dominio/convidados';
import { buildShareableHtmlDoc } from '../base/partilha';
import { CaptainArmband } from '../dominio/plantel';

/* Números do jogo, para as caixas de resumo. */
export function resumoDoJogo(eventos) {
  const { todos } = eventos;
  const notas = todos.map(x => x.nota).filter(n => Number.isFinite(n));
  return {
    convocados: todos.length,
    minutos: todos.reduce((a, x) => a + (x.minutos || 0), 0),
    golos: todos.reduce((a, x) => a + x.golos, 0),
    assistencias: todos.reduce((a, x) => a + x.assistencias, 0),
    amarelos: todos.filter(x => x.cartao === 'yellow' || x.cartao === 'yellow2').length,
    vermelhos: todos.filter(x => x.cartao === 'red' || x.cartao === 'yellow2').length,
    substituicoes: todos.filter(x => x.entrouAo != null).length,
    semJogar: todos.filter(x => !x.jogou).length,
    notaMedia: notas.length ? notas.reduce((a, n) => a + n, 0) / notas.length : null,
  };
}

/* AS LINHAS DE "DESTAQUES", NUM SÍTIO SÓ.

   São escritas em três lados — a ficha no ecrã, a ficha impressa e o
   ficheiro partilhado. Enquanto o texto estava copiado nos três, bastava
   corrigir um para os outros ficarem a dizer outra coisa. É a mesma razão
   pela qual `textBoxMetrics` existe. */
export function linhasDestaquesJogo(eventos, resumo, players) {
  const linhas = [];
  const nome = (x) => shortPlayerName(x.player, players);
  const comGolos = eventos.todos.filter(x => x.golos > 0);
  const comAssist = eventos.todos.filter(x => x.assistencias > 0);
  const comCartao = eventos.todos.filter(x => x.cartao);
  if (comGolos.length) {
    linhas.push(`${resumo.golos} ${resumo.golos === 1 ? 'golo' : 'golos'} · ${comGolos.map(x => `${nome(x)}${x.golos > 1 ? ` (${x.golos})` : ''}`).join(', ')}`);
  }
  if (comAssist.length) {
    linhas.push(`${resumo.assistencias} ${resumo.assistencias === 1 ? 'assistência' : 'assistências'} · ${comAssist.map(nome).join(', ')}`);
  }
  if (comCartao.length) {
    linhas.push(`${comCartao.length} ${comCartao.length === 1 ? 'cartão' : 'cartões'} · ${comCartao.map(nome).join(', ')}`);
  }
  if (resumo.substituicoes) linhas.push(`${resumo.substituicoes} ${resumo.substituicoes === 1 ? 'substituição' : 'substituições'}`);
  return linhas;
}

/* Ícones de acontecimento ao lado do nome. Pequenos e sempre na mesma
   ordem, para se lerem de relance sem legenda. */
export function EventosDoJogador({ x, compacto }) {
  const tam = compacto ? 10 : 12;
  return (
    <>
      {x.golos > 0 && (
        <span style={{ ...mono, fontSize: tam, color: T.cream }} title={`${x.golos} golo${x.golos > 1 ? 's' : ''}`}>
          {'⚽'.repeat(Math.min(x.golos, 3))}{x.golos > 3 ? `×${x.golos}` : ''}
        </span>
      )}
      {x.assistencias > 0 && (
        <span style={{ ...mono, fontSize: tam, color: T.good }} title={`${x.assistencias} assistência${x.assistencias > 1 ? 's' : ''}`}>
          A{x.assistencias > 1 ? x.assistencias : ''}
        </span>
      )}
      {x.cartao && (
        <span
          title={x.cartao === 'yellow' ? 'Amarelo' : (x.cartao === 'red' ? 'Vermelho' : 'Duplo amarelo')}
          style={{
            display: 'inline-block', width: tam * 0.62, height: tam * 0.9, borderRadius: 1.5,
            background: x.cartao === 'yellow' ? T.goldFundo : (x.cartao === 'red' ? T.bad : T.goldFundo),
            border: x.cartao === 'yellow2' ? `1.5px solid ${T.bad}` : 'none',
          }}
        />
      )}
      {x.saiuAo != null && (
        <span style={{ ...mono, fontSize: tam, color: T.bad }} title={`Saiu aos ${x.saiuAo}'`}>↓{x.saiuAo}</span>
      )}
      {x.entrouAo != null && (
        <span style={{ ...mono, fontSize: tam, color: T.good }} title={`Entrou aos ${x.entrouAo}'`}>↑{x.entrouAo}</span>
      )}
    </>
  );
}

/* SÍMBOLOS DA FICHA IMPRESSA.

   Em papel não há tooltips nem cor de fundo para distinguir o que
   aconteceu a cada jogador: ou se desenha, ou se escreve por extenso — e
   por extenso a lista deixa de caber ao lado do campo. São SVG e não
   emojis de propósito: um emoji imprime-se com a fonte que o sistema
   tiver, muda de aspeto de máquina para máquina e em muitas impressoras
   sai como um quadrado. Um traço desenhado sai sempre igual.

   Tamanho por omissão pequeno (11px) porque vivem colados ao nome, à
   altura de uma maiúscula. */
export function IconeGoloPrint({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ display: 'block' }} aria-hidden="true">
      <circle cx="10" cy="10" r="8.6" fill="#fff" stroke="#111" strokeWidth="1.5" />
      <polygon points="10,4.6 14.7,8 12.9,13.6 7.1,13.6 5.3,8" fill="#111" />
    </svg>
  );
}

/* Chuteira de perfil, para a assistência: calcanhar alto à esquerda,
   bico baixo à direita, sola com pitons por baixo. */
export function IconeAssistenciaPrint({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ display: 'block' }} aria-hidden="true">
      <path d="M2.6 4.2 h3.6 l1.7 4.3 c.5 1.3 1.6 2.2 3 2.4 l4.6 .7 c1.6 .25 2.5 1.2 2.5 2.5 v.7 h-15.4 z" fill="#111" />
      <rect x="1.8" y="15.1" width="16.4" height="1.5" rx=".5" fill="#111" />
      <rect x="4" y="16.9" width="1.6" height="1.6" fill="#111" />
      <rect x="9.2" y="16.9" width="1.6" height="1.6" fill="#111" />
      <rect x="14.4" y="16.9" width="1.6" height="1.6" fill="#111" />
    </svg>
  );
}

/* Substituição: uma seta com dois sentidos — sobe de um lado, desce do
   outro. Serve para os dois casos, porque a coluna já diz qual é: um
   titular com este símbolo saiu, um suplente entrou. */
export function IconeSubstituicaoPrint({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ display: 'block' }} aria-hidden="true">
      <g stroke="#111" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.2 16.4 V4.6" />
        <path d="M3.1 7.7 L6.2 4.6 L9.3 7.7" />
        <path d="M13.8 3.6 V15.4" />
        <path d="M10.7 12.3 L13.8 15.4 L16.9 12.3" />
      </g>
    </svg>
  );
}

/* Cartão: um retângulo com a cor real. Numa impressora a preto e branco
   o amarelo sai cinzento-claro e o vermelho cinzento-escuro — continuam
   a distinguir-se, que é o que interessa. */
export function IconeCartaoPrint({ card, size = 11 }) {
  const vermelho = card === 'red' || card === 'yellow2';
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ display: 'block' }} aria-hidden="true">
      <rect
        x="5.5" y="2.5" width="9" height="15" rx="1.4"
        fill={vermelho ? '#C0392B' : '#E8C33A'} stroke="#111" strokeWidth="1.1"
      />
      {card === 'yellow2' && (
        <rect x="2.6" y="4.6" width="7" height="12.5" rx="1.2" fill="#E8C33A" stroke="#111" strokeWidth="1.1" />
      )}
    </svg>
  );
}

/* Uma linha da lista de jogadores na ficha impressa: número, nome e, à
   direita, o que lhe aconteceu no jogo. Os símbolos ficam todos na mesma
   coluna, encostados à direita, para a lista se ler na vertical sem os
   olhos andarem à procura. */
export function LinhaJogadorPrint({ x, nome, capitaoId, subcapitaoId }) {
  /* Sem dados de jogo (equipa vinda do Simulador, que só guarda nomes)
     resta o nome — mas na MESMA linha, com a mesma altura e o mesmo
     traço em baixo, para as duas folhas não parecerem duas folhas. */
  if (!x || !x.player) {
    if (!nome) return null;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '2.5px 0',
        borderBottom: '1px solid #ececec', fontSize: 11,
      }}>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
      </div>
    );
  }
  const golos = Math.min(x.golos, 3);
  const minuto = x.saiuAo != null ? x.saiuAo : x.entrouAo;
  // (C)/(SC) a seguir ao nome — o mesmo texto simples já usado na folha
  // de convocatória, em vez de um símbolo novo só para esta folha.
  const marca = capitaoId === x.player.id ? ' (C)' : (subcapitaoId === x.player.id ? ' (SC)' : '');
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '2.5px 0',
      borderBottom: '1px solid #ececec', fontSize: 11,
    }}>
      {/* Sem cardinal: o número tem coluna própria, alinhada à direita,
          e nesse contexto o "#" é só ruído a repetir o que a coluna já
          diz. Nas listas em linha corrida (partilha, estatísticas) ele
          fica, porque aí separa o número do nome. */}
      <span style={{ width: 24, flexShrink: 0, textAlign: 'right', color: '#888' }}>
        {x.player.number != null && x.player.number !== '' ? x.player.number : '—'}
      </span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {x.player.name}{marca}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
        {Array.from({ length: golos }).map((_, i) => <IconeGoloPrint key={`g${i}`} />)}
        {x.golos > 3 && <span style={{ fontSize: 9.5 }}>×{x.golos}</span>}
        {Array.from({ length: Math.min(x.assistencias, 3) }).map((_, i) => <IconeAssistenciaPrint key={`a${i}`} />)}
        {x.assistencias > 3 && <span style={{ fontSize: 9.5 }}>×{x.assistencias}</span>}
        {x.cartao && <IconeCartaoPrint card={x.cartao} />}
        {minuto != null && (
          <>
            <IconeSubstituicaoPrint />
            <span style={{ fontSize: 9.5, color: '#555' }}>{minuto}'</span>
          </>
        )}
        {/* Os minutos jogados fecham a linha, sempre no mesmo sítio: é o
            número que se procura primeiro ao rever a gestão do plantel. */}
        <span style={{ width: 30, textAlign: 'right', fontSize: 10, color: x.jogou ? '#111' : '#bbb' }}>
          {x.jogou ? `${x.minutos}'` : '—'}
        </span>
      </span>
    </div>
  );
}

/* A EQUIPA EM DUAS COLUNAS — A MESMA EM TODAS AS FOLHAS.

   Titulares à esquerda, suplentes à direita, um jogador por linha. Estava
   escrito duas vezes: a ficha do jogo em colunas, a folha do amigável do
   Planeamento numa frase corrida com vírgulas. Eram a mesma informação
   com dois aspetos diferentes — e quem imprime as duas nota logo. Agora
   é um componente só, e as folhas ficam irmãs.

   A legenda só aparece quando há símbolos para legendar: numa equipa
   vinda do Simulador (só nomes, sem golos nem minutos) seria uma legenda
   a explicar coisas que não estão na folha. */
export function EquipaEmColunasPrint({ titulares, suplentes, capitaoId, subcapitaoId }) {
  const tituloColuna = { fontSize: 12, fontWeight: 700, borderBottom: '1.5px solid #111', paddingBottom: 3, marginBottom: 3 };
  const vazio = <div style={{ fontSize: 11, color: '#999', paddingTop: 4 }}>—</div>;
  const comSimbolos = [...titulares, ...suplentes].some(l => l && l.x);

  const coluna = (titulo, lista) => (
    <div>
      <div style={tituloColuna}>{titulo} ({lista.length})</div>
      {lista.length
        ? lista.map((l, i) => (
          <LinhaJogadorPrint
            key={(l.x && l.x.player.id) || `${l.nome}-${i}`}
            x={l.x} nome={l.nome} capitaoId={capitaoId} subcapitaoId={subcapitaoId}
          />
        ))
        : vazio}
    </div>
  );

  return (
    <>
      <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Equipa</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, marginBottom: 10, breakInside: 'avoid' }}>
        {coluna('Titulares', titulares)}
        {coluna('Suplentes', suplentes)}
      </div>
      {comSimbolos && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', fontSize: 9.5, color: '#666', marginBottom: 18 }}>
          {[
            [<IconeGoloPrint key="g" size={10} />, 'golo'],
            [<IconeAssistenciaPrint key="a" size={10} />, 'assistência'],
            [<IconeSubstituicaoPrint key="s" size={10} />, 'entrou / saiu ao minuto'],
            [<IconeCartaoPrint key="c" card="yellow" size={10} />, 'cartão'],
          ].map(([icone, texto]) => (
            <span key={texto} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{icone}{texto}</span>
          ))}
          <span>90' minutos jogados</span>
        </div>
      )}
    </>
  );
}

/* A FICHA DO JOGO EM PAPEL.

   Fundo branco, linhas cinzentas, sem botões. O que na ficha do ecrã são
   caixas de "Destaques" e "Números" aparece aqui colado a cada nome, em
   símbolo: numa folha, ler "1 substituição" em baixo obriga a procurar
   quem foi; uma seta ao lado do nome responde de imediato. */
/* ACONTECIMENTOS JUNTO DE CADA JOGADOR (folha impressa e partilha), quando
   o jogo tem o onze no campo com fotos. Antes, essa vista só mostrava
   nomes e fotos: golos, cartões e substituições ficavam de fora da folha.
   Quem substituiu quem: o suplente que entrou ao minuto X troca com o
   titular que saiu nesse minuto (se forem vários, ficam todos). */
function quemSaiuPara(x, eventos, players) {
  if (!x || x.entrouAo == null) return [];
  return eventos.titulares.filter(t => t.saiuAo === x.entrouAo).map(t => shortPlayerName(t.player, players));
}
function extraEventosPrint(eventos, players) {
  const porId = new Map(eventos.todos.map(x => [x.player.id, x]));
  return (pid, onde) => {
    const x = porId.get(pid);
    if (!x || !x.jogou) {
      return onde === 'banco' ? <span style={{ fontSize: '8.5pt', color: '#bbb' }}>não jogou</span> : null;
    }
    const icones = [
      ...Array.from({ length: Math.min(x.golos, 3) }).map((_, i) => <IconeGoloPrint key={`g${i}`} size={9} />),
      x.golos > 3 ? <span key="gx" style={{ fontSize: '7pt' }}>×{x.golos}</span> : null,
      ...Array.from({ length: Math.min(x.assistencias, 3) }).map((_, i) => <IconeAssistenciaPrint key={`a${i}`} size={9} />),
      x.cartao ? <IconeCartaoPrint key="c" card={x.cartao} size={9} /> : null,
    ].filter(Boolean);
    if (onde === 'campo') {
      if (!icones.length && x.saiuAo == null) return null;
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.6mm', marginTop: '0.3mm', background: '#fff', padding: '0 0.8mm', borderRadius: '1mm', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          {icones}
          {x.saiuAo != null && <span style={{ display: 'flex', alignItems: 'center', gap: '0.3mm', fontSize: '7pt', color: '#555' }}><IconeSubstituicaoPrint size={8} />{x.saiuAo}'</span>}
        </span>
      );
    }
    const saiu = quemSaiuPara(x, eventos, players);
    return (
      <>
        {icones}
        {x.entrouAo != null && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.6mm', fontSize: '8.5pt', color: '#555' }}>
            <IconeSubstituicaoPrint size={9} />{x.entrouAo}'{saiu.length ? ` · por ${saiu.join(', ')}` : ''}
          </span>
        )}
        <span style={{ fontSize: '8.5pt', color: '#111', minWidth: '7mm', textAlign: 'right' }}>{x.minutos}'</span>
      </>
    );
  };
}

export function PrintFichaJogo({ match, players: playersAtivosDoJogo, season }) {
  const players = React.useMemo(() => comQuemLaEsteve(playersAtivosDoJogo, match), [playersAtivosDoJogo, match]);
  const nosso = clubeSemEscalao(season && season.club) || 'A nossa equipa';
  /* Campo, titulares e suplentes saem todos da MESMA função que a folha
     do Planeamento usa. Sem isto as duas folhas voltavam a divergir — na
     ordem dos nomes, no formato (com número, sem número) e até em quem
     ficava em que lugar do campo. */
  const { formacao, lugares, titulares, suplentes } = equipaDoAmigavel({ session: null, jogo: match, players });
  const layout = LAYOUT_FORMACAO[formacao] || LAYOUT_FORMACAO['4-3-3'];

  return (
    <div className="print-sheet">
      <h2 style={{ margin: '0 0 4px', fontSize: 24 }}>{tituloDoJogo(match, nosso)}</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13 }}>
        {[
          fmtDate(match.date),
          competitionLabel(match.competition),
          match.jornada,
          match.atHome === undefined ? null : (match.atHome ? 'casa' : 'fora'),
          match.result ? `Resultado: ${match.result}` : null,
        ].filter(Boolean).join(' · ')}
      </p>

      {/* Sem o código da formação no título: a disposição está desenhada
          logo por baixo, e escrever "4-3-3" ao lado é dizer duas vezes a
          mesma coisa — uma delas em pior linguagem. */}
      {(match.starters || []).length > 0 && (() => {
        // Onze no campo com fotos + suplentes com foto, como no ecrã.
        const esc = escalacaoDoJogo(match, players);
        const eventos = eventosDoJogo(match, players);
        const destaques = linhasDestaquesJogo(eventos, resumoDoJogo(eventos), players);
        return (
          <>
            <EscalacaoPrint players={players} formacao={esc.formacao} slots={esc.slots} banco={esc.banco} capitao={match.capitao} subcapitao={match.subcapitao}
              extra={eventos.todos.some(x => x.jogou) ? extraEventosPrint(eventos, players) : undefined} />
            {destaques.length > 0 && (
              <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid', marginBottom: 12 }}>
                <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>Destaques</h3>
                {destaques.map((l, i) => <p key={i} style={{ margin: '0 0 3px', fontSize: 12 }}>{l}</p>)}
              </div>
            )}
          </>
        );
      })()}
      {!(match.starters || []).length && <>
      <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Formação</h3>
      <div style={{
        position: 'relative', width: '100%', maxWidth: 440, aspectRatio: ASPECT_CAMPO_PRINT,
        background: '#fff', margin: '0 auto 16px',
      }}>
        <MarcacoesCampoPrint />
        {lugares.map((l, i) => {
          const [fx, fy] = layout[i] || [0.5, 0.5];
          return (
            <div key={i} style={{
              position: 'absolute', ...posCampoPrint(fx, fy),
              transform: 'translate(-50%, -50%)', textAlign: 'center', maxWidth: '20%',
            }}>
              <div style={{ fontSize: 8.5, color: '#888' }}>{rotuloDoLugar(l.lugar)}</div>
              <div style={{
                fontSize: 10.5, fontWeight: 600, lineHeight: 1.15, whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis', color: l.nome ? '#111' : '#bbb',
              }}>
                {l.nome || '—'}
              </div>
              {/* Os minutos por baixo do nome, como no ecrã: a folha passa a
                  dizer quem jogou E quanto, que é a pergunta seguinte de
                  quem olha para um onze. */}
              {(() => {
                const x = titulares.find(t => t.x && shortPlayerName(t.x.player, players) === l.nome);
                if (!x || !x.x || !x.x.jogou) return null;
                return <div style={{ fontSize: 8, color: '#777', lineHeight: 1.1 }}>{x.x.minutos}'</div>;
              })()}
            </div>
          );
        })}
      </div>

      <EquipaEmColunasPrint titulares={titulares} suplentes={suplentes} capitaoId={match.capitao} subcapitaoId={match.subcapitao} />
      </>}

      {nomesDosConvidados(match).length > 0 && (
        <p style={{ fontSize: 12.5, margin: '0 0 14px' }}>
          <strong>À experiência:</strong> {nomesDosConvidados(match).join(', ')}
        </p>
      )}

      <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Ideias para o jogo</h3>
      <p style={{ fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0, minHeight: 40 }}>
        {String(match.ideias || '').trim() || '—'}
      </p>
    </div>
  );
}

/* A mesma ficha, mas como ficheiro para enviar (WhatsApp, email). Não
   desenha o campo — o HTML partilhável não tem prancheta para jogos — mas
   leva a mesma informação por palavras. */
/* ESCALAÇÃO COM FOTOS, PARA O FICHEIRO PARTILHADO — o mesmo desenho da
   escalação no ecrã: campo vertical com o onze nas bolas com foto e, à
   direita, só os suplentes (também com foto). HTML e CSS simples, sem
   JavaScript, com as fotos dentro do próprio ficheiro. */
export function escalacaoComFotosHtml(match, players) {
  const formacao = match.formacao || '4-3-3';
  const porId = new Map(players.map(p => [p.id, p]));
  const titulares = (match.starters || []).map(id => porId.get(id)).filter(Boolean);
  if (!titulares.length) return '';
  const { lugares, colocados } = distribuirOnzeNoCampo(titulares, formacao, match.alinhamento);
  const layout = LAYOUT_FORMACAO[formacao] || LAYOUT_FORMACAO['4-3-3'];
  const usados = new Set(colocados.filter(Boolean).map(p => p.id));
  const numDe = (p) => (Number.isFinite(Number(p.number)) && String(p.number).trim() !== '' ? Number(p.number) : Infinity);
  const banco = (match.convocados || []).filter(id => !usados.has(id) && !(match.starters || []).includes(id)).map(id => porId.get(id)).filter(Boolean)
    .sort((a, b) => numDe(a) - numDe(b) || String(a.name || '').localeCompare(String(b.name || ''), 'pt'));
  const nomeCurto = (p) => escapeHtmlText(shortPlayerName(p, players));
  /* Acontecimentos junto de cada jogador (só num jogo já com minutos). */
  const eventos = eventosDoJogo(match, players);
  const comEventos = eventos.todos.some(x => x.jogou);
  const evDe = new Map(eventos.todos.map(x => [x.player.id, x]));
  const cartaoHtml = (c) => `<span title="${c === 'yellow' ? 'Amarelo' : c === 'red' ? 'Vermelho' : 'Duplo amarelo'}" style="display:inline-block;width:7px;height:10px;border-radius:1.5px;vertical-align:-1px;background:${c === 'red' ? '#C0392B' : '#E8C33A'};${c === 'yellow2' ? 'box-shadow:2px 0 0 #C0392B;' : ''}"></span>`;
  const iconesHtml = (x) => [
    x.golos ? `<span title="${x.golos} golo${x.golos > 1 ? 's' : ''}">${'⚽'.repeat(Math.min(x.golos, 3))}${x.golos > 3 ? '×' + x.golos : ''}</span>` : '',
    x.assistencias ? `<span title="assistência" style="font-weight:700">A${x.assistencias > 1 ? x.assistencias : ''}</span>` : '',
    x.cartao ? cartaoHtml(x.cartao) : '',
  ].filter(Boolean).join(' ');
  const eventosNoCampo = (p) => {
    const x = comEventos ? evDe.get(p.id) : null;
    if (!x || !x.jogou) return '';
    const partes = [iconesHtml(x), x.saiuAo != null ? `<span style="color:#ffb4b4">↓${x.saiuAo}'</span>` : ''].filter(Boolean).join(' ');
    return partes ? `<span style="font-size:10px;color:#fff;background:#00000066;border-radius:6px;padding:0 4px;margin-top:1px;white-space:nowrap">${partes}</span>` : '';
  };
  const eventosNoBanco = (p) => {
    const x = comEventos ? evDe.get(p.id) : null;
    if (!comEventos) return '';
    if (!x || !x.jogou) return '<span style="display:block;font-size:11px;opacity:.45">não jogou</span>';
    const saiu = eventos.titulares.filter(t => t.saiuAo != null && t.saiuAo === x.entrouAo).map(t => escapeHtmlText(shortPlayerName(t.player, players)));
    const linha = [
      x.entrouAo != null ? `<span style="color:#9fe0b0">↑${x.entrouAo}'</span>${saiu.length ? ` por ${saiu.join(', ')}` : ''}` : '',
      `${x.minutos}' jogados`,
      iconesHtml(x),
    ].filter(Boolean).join(' · ');
    return `<span style="display:block;font-size:11px;opacity:.85">${linha}</span>`;
  };
  const bola = (p, tam) => {
    const conteudo = p.photo
      ? `<img src="${escapeHtmlText(p.photo)}" alt="" style="width:100%;height:100%;object-fit:cover">`
      : escapeHtmlText(String(p.number || (p.name || '?').slice(0, 1)));
    return `<span style="width:${tam}px;height:${tam}px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#9E2B33;color:#fff;font-weight:700;font-size:${Math.round(tam * 0.36)}px;border:2px solid #fff;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,.4)">${conteudo}</span>`;
  };
  const noCampo = lugares.map((lugar, i) => {
    const p = colocados[i];
    const [lx, ly] = layout[i] || [0.5, 0.5];
    const pos = `left:${(6 + ly * 88).toFixed(2)}%;top:${topNoCampoEcra(lx, ly).toFixed(2)}%`;
    if (!p) return `<div style="position:absolute;${pos};transform:translate(-50%,-50%);color:#ffffffaa;font-size:11px">${escapeHtmlText(rotuloDoLugar(lugar))}</div>`;
    return `<div style="position:absolute;${pos};transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;width:76px">${bola(p, 40)}`
      + `<span style="font-size:11px;color:#fff;margin-top:2px;text-shadow:0 1px 2px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:76px">${nomeCurto(p)}</span>${eventosNoCampo(p)}</div>`;
  }).join('');
  const linhas = '<svg viewBox="0 0 68 105" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><g fill="none" stroke="#ffffff88" stroke-width="0.35">'
    + '<rect x="1.5" y="1.5" width="65" height="102"/><line x1="1.5" y1="52.5" x2="66.5" y2="52.5"/><circle cx="34" cy="52.5" r="9.15"/>'
    + '<rect x="13.84" y="1.5" width="40.32" height="16.5"/><rect x="24.84" y="1.5" width="18.32" height="5.5"/>'
    + '<rect x="13.84" y="87" width="40.32" height="16.5"/><rect x="24.84" y="98" width="18.32" height="5.5"/></g></svg>';
  const campo = `<div style="position:relative;width:100%;max-width:340px;aspect-ratio:68/105;border-radius:10px;overflow:hidden;background:repeating-linear-gradient(180deg,#2b5a33 0 7.5%,#275230 7.5% 15%)">${linhas}${noCampo}</div>`;
  const suplentes = banco.length
    ? banco.map(p => `<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border:1px solid #ffffff22;border-radius:8px;background:#ffffff08">${bola(p, 30)}`
      + `<span style="min-width:0"><span style="display:block;font-size:13px">${nomeCurto(p)}</span><span style="display:block;font-size:11px;opacity:.6">${escapeHtmlText([p.position, p.number].filter(Boolean).join(' · '))}</span>${eventosNoBanco(p)}</span></div>`).join('')
    : '<p class="desc">Sem suplentes.</p>';
  return `<div style="display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start">`
    + `<div style="flex:1 1 280px;max-width:340px"><div style="font-size:14px;font-weight:600;margin:0 0 8px">Onze inicial</div>${campo}<div style="font-size:12px;opacity:.6;margin-top:6px">Sistema ${escapeHtmlText(formacao)}</div></div>`
    + `<div style="flex:0 1 260px;min-width:0"><div style="font-size:14px;font-weight:600;margin:0 0 8px">Suplentes (${banco.length})</div><div style="display:flex;flex-direction:column;gap:6px">${suplentes}</div></div>`
    + `</div>`;
}

export function buildMatchShareHtml({ match, players: playersAtivosDoJogo, season }) {
  const players = comQuemLaEsteve(playersAtivosDoJogo, match);
  const nosso = clubeSemEscalao(season && season.club) || 'A nossa equipa';
  const eventos = eventosDoJogo(match, players);
  const resumo = resumoDoJogo(eventos);
  const destaques = linhasDestaquesJogo(eventos, resumo, players);
  /* A MESMA fonte do ecrã e da folha impressa: campo com o onze nos
     lugares e as duas colunas por baixo. Antes eram duas frases com
     vírgulas, e o ficheiro dizia menos do que qualquer das outras vistas
     do mesmo jogo. */
  const equipa = equipaDoAmigavel({ session: null, jogo: match, players });

  // Com onze lançado: campo vertical com fotos + suplentes com fotos.
  // Sem onze, fica o que havia (campo e as duas colunas).
  const comFotos = escalacaoComFotosHtml(match, players);
  const extraHtml = [
    comFotos
      ? `<h2>Onze inicial e suplentes</h2>${comFotos}`
      : `<h2>Formação</h2>${campoDaEquipaHtml(equipa)}<h2>Equipa</h2>${equipaEmColunasHtml(equipa.titulares, equipa.suplentes)}`,
    `<h2>Ideias para o jogo</h2><p class="desc">${escapeHtmlText(String(match.ideias || '').trim() || '—')}</p>`,
    `<h2>Destaques</h2>${destaques.length
      ? destaques.map(l => `<p class="desc">${escapeHtmlText(l)}</p>`).join('')
      : '<p class="desc">Sem acontecimentos registados.</p>'}`,
    `<h2>Números</h2><p class="desc">${escapeHtmlText([
      `${isFriendlyMatch(match) ? 'Presentes' : 'Convocados'}: ${resumo.convocados}`,
      `Minutos dados: ${resumo.minutos}`,
      `Nota média: ${resumo.notaMedia == null ? '—' : resumo.notaMedia.toFixed(1)}`,
      `Sem jogar: ${resumo.semJogar}`,
    ].join(' · '))}</p>`,
  ].join('');

  const metaLines = [
    fmtDate(match.date),
    competitionLabel(match.competition),
    match.jornada,
    match.atHome === undefined ? null : (match.atHome ? 'casa' : 'fora'),
    match.result ? `Resultado: ${match.result}` : null,
  ].filter(Boolean);

  return {
    title: tituloDoJogo(match, nosso),
    html: buildShareableHtmlDoc({
      title: tituloDoJogo(match, nosso),
      metaLines,
      blocks: [],
      extraHtml,
    }),
  };
}

export function FichaJogo({ match, players: playersAtivosDoJogo, season, onClose, onEdit, onShare, onPrint, onFormacao, onAlinhamento, onStarters, onEscalacao, onIdeias, clinico = [], matches = [] }) {
  const players = React.useMemo(() => comQuemLaEsteve(playersAtivosDoJogo, match), [playersAtivosDoJogo, match]);
  const isNarrow = useIsMobile(760);
  const formacao = match.formacao || '4-3-3';
  /* JOGO POR JOGAR (sem resultado e de hoje para a frente): em vez da ficha
     com os acontecimentos, mostra a escalação no campo — a mesma da
     Convocatória — para arrumar o onze e o banco aqui mesmo. Depois do
     jogo, volta a ser a ficha de sempre. */
  const porJogar = !!onEscalacao && !String(match.result || '').trim() && (match.date || '') >= todayStr();
  const escalacao = porJogar ? escalacaoDoJogo(match, players) : null;
  const aplicarEscalacao = ({ slots, banco }) => {
    const starters = slots.filter(Boolean);
    const convocados = [...starters, ...banco];
    const ficam = new Set(convocados);
    const report = Object.fromEntries(Object.entries(match.report || {}).filter(([pid]) => ficam.has(pid)));
    onEscalacao({
      convocados, starters, alinhamento: slots, report,
      capitao: ficam.has(match.capitao) ? match.capitao : undefined,
      subcapitao: ficam.has(match.subcapitao) ? match.subcapitao : undefined,
    });
  };
  const formacaoEscalacao = (fm) => {
    const e = escalacaoNovaFormacao(escalacaoDoJogo(match, players), fm, players);
    const starters = e.slots.filter(Boolean);
    onEscalacao({ formacao: fm, alinhamento: e.slots, starters, convocados: [...starters, ...e.banco] });
  };
  const eventos = eventosDoJogo(match, players);
  const resumo = resumoDoJogo(eventos);
  const { lugares, colocados, sobram } = distribuirOnzeNoCampo(eventos.titulares.map(x => x.player), formacao, match.alinhamento);
  const [trocar, setTrocar] = useState(null); // índice do lugar a mudar
  const layout = LAYOUT_FORMACAO[formacao] || LAYOUT_FORMACAO['4-3-3'];
  const nosso = clubeSemEscalao(season && season.club) || 'A nossa equipa';

  const eventoDe = (p) => eventos.todos.find(x => x.player.id === p.id);
  const golosPorLado = (() => {
    const r = String(match.result || '').match(/^\s*(\d+)\s*[-–:]\s*(\d+)\s*$/);
    if (!r) return null;
    const casa = Number(r[1]);
    const fora = Number(r[2]);
    return match.atHome === false ? { nos: fora, eles: casa } : { nos: casa, eles: fora };
  })();

  const card = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14 };

  /* Arrastar um jogador para cima de outro lugar troca os dois — direto,
     sem passar pelo seletor. `colocados` está sempre na mesma ordem de
     `lugares`/`layout` (índice a índice), por isso a troca é só mexer
     em duas posições do array de ids antes de gravar. */
  const trocarDireto = (origemStr, destinoStr) => {
    const origem = Number(origemStr), destino = Number(destinoStr);
    if (Number.isNaN(origem) || Number.isNaN(destino) || origem === destino) return;
    const ids = colocados.map(v => (v ? v.id : null));
    const tmp = ids[origem];
    ids[origem] = ids[destino];
    ids[destino] = tmp;
    onAlinhamento(ids);
  };
  const arrasto = useArrastarParaTrocar(trocarDireto);

  return (
    <Modal
      title={tituloDoJogo(match, nosso)}
      subtitle={[
        fmtDate(match.date),
        competitionLabel(match.competition),
        match.jornada,
        match.atHome === undefined ? null : (match.atHome ? 'casa' : 'fora'),
      ].filter(Boolean).join(' · ')}
      onClose={onClose}
      wide
      xwide
      fullPage
    >
      {/* Resultado em destaque: é a primeira coisa que se procura. Num jogo
          por jogar não há resultado e o encontro já está no título — a
          linha sai, para a escalação caber no ecrã. */}
      <div style={{ display: porJogar ? 'none' : 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        {/* Casa à esquerda, fora à direita, e o resultado tal como está
            guardado ("casa-fora"): num jogo fora, "Paredes 6 – 0 Salgueiros". */}
        <span style={{ ...display, fontSize: 17, color: T.cream }}>{match.atHome === false ? (match.opponent || '—') : nosso}</span>
        <span style={{ ...mono, fontSize: 24, color: T.warn }}>
          {golosPorLado
            ? (match.atHome === false ? `${golosPorLado.eles} – ${golosPorLado.nos}` : `${golosPorLado.nos} – ${golosPorLado.eles}`)
            : (match.result || '—')}
        </span>
        <span style={{ ...display, fontSize: 17, color: T.cream }}>{match.atHome === false ? nosso : (match.opponent || '—')}</span>
        {!porJogar && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11.5, color: T.mutedDim }}>Formação</span>
          <Select
            value={formacao}
            onChange={e => onFormacao(e.target.value)}
            style={{ width: 96, height: 30, lineHeight: '28px', fontSize: 12, padding: '0 6px' }}
          >
            {Object.keys(FORMACOES).map(f => <option key={f} value={f}>{f}</option>)}
          </Select>
        </div>
        )}
      </div>

      {porJogar ? (
        <div>
          <EscalacaoNoCampo
            acao={<CartaoPlanoDoJogo jogo={match} />}
            players={players}
            formacao={escalacao.formacao}
            slots={escalacao.slots}
            banco={escalacao.banco}
            onChange={aplicarEscalacao}
            onFormacao={formacaoEscalacao}
            clinico={clinico}
            data={match.date}
            castigados={castigadosParaJogo(matches, match.date, match.id)}
          />
          {/* Ideias para o jogo: por baixo do campo. */}
          {onIdeias && (
            <div style={{ marginTop: 10 }}>
              <NotasDoJogo valor={match.ideias} onGuardar={onIdeias} altura={52} />
            </div>
          )}
        </div>
      ) : eventos.titulares.length === 0 ? (
        <EmptyState
          text="Este jogo ainda não tem onze inicial. Marca os titulares na ficha de edição e a equipa aparece aqui no campo."
          action={<Btn onClick={onEdit}><Pencil size={15} /> Editar jogo</Btn>}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: 14 }}>
          {/* ---------- O CAMPO (e, por baixo, as ideias para o jogo) ---------- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          {/* O campo do ecrã tinha só quatro linhas: rectângulo, meio-campo,
              círculo e as duas grandes áreas. Sem balizas, sem pequenas
              áreas, sem marcas de penálti nem cantos — parecia um esquema,
              não um campo. Passa a usar o MESMO desenho da folha impressa,
              com cores claras em vez de cinzentas. */}
          <div
            ref={arrasto.containerRef}
            onPointerMove={arrasto.onPointerMove}
            onPointerUp={arrasto.onPointerUp}
            onPointerCancel={arrasto.onPointerCancel}
            onClickCapture={arrasto.onClickCapture}
            style={{
            position: 'relative', width: '100%', aspectRatio: ASPECT_CAMPO_PRINT,
            background: '#1E3A24', border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden',
          }}>
            <MarcacoesCampoPrint traco="#ffffff40" baliza="#ffffff66" />

            {colocados.map((p, i) => {
              if (!p) return null;
              const [fx, fy] = layout[i] || [0.5, 0.5];
              const x = eventoDe(p) || {};
              const eGR = lugares[i] === 'GR';
              return (
                <button
                  key={p.id}
                  data-slot={i}
                  onPointerDown={arrasto.onPointerDown(String(i))}
                  onClick={() => setTrocar(i)}
                  title={`${lugares[i]} · ${p.name} — arrasta para trocar, ou toca para trocar de jogador`}
                  style={{
                    // Com balizas fora da linha de fundo, o desenho é mais
                    // largo do que o campo — `posCampoPrint` converte.
                    position: 'absolute', ...posCampoPrint(fx, fy),
                    // Só translateX centra na horizontal; na vertical, o
                    // ponto de ancoragem é o CENTRO DO CÍRCULO (11px, metade
                    // dos 22px dele), não do bloco todo. Com
                    // `translate(-50%,-50%)` no bloco inteiro, o nome (e a
                    // braçadeira, quando existe) por baixo do círculo — sem
                    // nada equivalente por cima — puxava o centro visual do
                    // círculo para cima da linha/marca do campo, em vez de
                    // ficar em cima dela.
                    transform: 'translateX(-50%)', marginTop: -11, textAlign: 'center', maxWidth: '22%',
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer', ...body,
                    touchAction: 'none', ...arrasto.estiloArrasto(String(i)), ...arrasto.estiloAlvo(String(i)),
                  }}
                >
                  {/* Círculo com o número — mais compacto do que a etiqueta
                      retangular de antes, e é o que se arrasta para trocar
                      de lugar. O guarda-redes de branco, como no
                      equipamento: é a convenção de qualquer ficha de jogo
                      e distingue-o do resto da equipa sem precisar de
                      legenda. */}
                  <span style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, margin: '0 auto', borderRadius: '50%', ...mono, fontSize: 11,
                    background: eGR ? '#F2F2EE' : T.corEquipa,
                    color: eGR ? '#16281B' : '#fff',
                    border: eGR ? '1px solid #16281B55' : 'none',
                  }}>{p.number || lugares[i]}</span>
                  <div style={{
                    fontSize: 11, color: T_ESCURO.cream, marginTop: 2, lineHeight: 1.2,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {shortPlayerName(p, players)}
                  </div>
                  {/* Braçadeira do jogo (`match.capitao`, escolhida na
                      convocatória) — não confundir com `captainRank`,
                      que é o capitão por omissão do Plantel. Aqui é
                      sempre a escolha específica deste jogo. Fica numa
                      linha própria, por baixo do nome, para não disputar
                      espaço com ele quando o nome já é comprido. */}
                  {(match.capitao === p.id || match.subcapitao === p.id) && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 2 }}>
                      {match.capitao === p.id && <CaptainArmband rank={1} size={13} title="Capitão neste jogo" />}
                      {match.subcapitao === p.id && <CaptainArmband rank={2} size={13} title="Subcapitão neste jogo" />}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 3, justifyContent: 'center', alignItems: 'center', marginTop: 1 }}>
                    <EventosDoJogador x={x} compacto />
                  </div>
                </button>
              );
            })}

            {/* Lugares por preencher: continuam clicáveis, para se poder
                pôr lá alguém sem ter de passar pela ficha de edição. Também
                aceitam um jogador arrastado de outro lugar — é como MOVER
                em vez de trocar (o lugar de origem fica vazio). */}
            {colocados.map((p, i) => {
              if (p) return null;
              const [fx, fy] = layout[i] || [0.5, 0.5];
              return (
                <button
                  key={`vazio-${i}`}
                  data-slot={i}
                  onClick={() => setTrocar(i)}
                  title={`${lugares[i]} — por preencher`}
                  style={{
                    position: 'absolute', ...posCampoPrint(fx, fy),
                    transform: 'translate(-50%, -50%)', cursor: 'pointer', ...body,
                    background: '#00000055', border: `1px dashed ${T_ESCURO.line}`, borderRadius: 6,
                    padding: '4px 7px', color: T_ESCURO.mutedDim, fontSize: 10.5,
                    ...arrasto.estiloAlvo(String(i)),
                  }}
                >{lugares[i]}</button>
              );
            })}
          </div>

            {/* O plano escrito na edição do jogo, ao lado de quem o vai
                executar. Só aparece se lá estiver alguma coisa: um cartão
                vazio por baixo do campo era só ruído. */}
            {String(match.ideias || '').trim() && (
              <div style={card}>
                <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                  Ideias para o jogo
                </div>
                {/* `overflowWrap` para o caso de virem links ou palavras
                    compridas: no telemóvel, sem isto, uma linha sem
                    espaços alarga o cartão e a janela ganha barra
                    horizontal. */}
                <div style={{ fontSize: 12.5, color: T.cream, lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {match.ideias}
                </div>
              </div>
            )}
          </div>

          {/* ---------- BANCO E DESTAQUES ---------- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {sobram.length > 0 && (
              <div style={{ ...card, borderColor: `${T.warn}66` }}>
                <div style={{ fontSize: 11.5, color: T.warn }}>
                  {sobram.length} {sobram.length === 1 ? 'titular não coube' : 'titulares não couberam'} na formação {formacao}:{' '}
                  {sobram.map(p => shortPlayerName(p, players)).join(', ')}. Escolhe outra formação ou revê o onze.
                </div>
              </div>
            )}

            {/* Atalho direto para o plano deste jogo. */}
            <div><CartaoPlanoDoJogo jogo={match} /></div>

            <div style={card}>
              <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                Suplentes ({eventos.suplentes.length})
              </div>
              {eventos.suplentes.length === 0 ? (
                <div style={{ fontSize: 12.5, color: T.mutedDim }}>Sem suplentes registados.</div>
              ) : eventos.suplentes.map(x => (
                <div key={x.player.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5,
                  color: x.jogou ? T.cream : T.mutedDim, lineHeight: 1.9,
                }}>
                  <span style={{ ...mono, fontSize: 11, color: T.mutedDim, width: 22, textAlign: 'right', flexShrink: 0 }}>
                    {x.player.number || '—'}
                  </span>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {shortPlayerName(x.player, players)}{x.player.convidado ? ' (exp)' : ''}
                  </span>
                  {/* O subcapitão pode calhar no banco (não joga sempre
                      quem tem a braçadeira) — por isso a marca fica aqui
                      também, não só no campo. */}
                  {match.subcapitao === x.player.id && <CaptainArmband rank={2} size={13} title="Subcapitão neste jogo" />}
                  {match.capitao === x.player.id && <CaptainArmband rank={1} size={13} title="Capitão neste jogo" />}
                  <EventosDoJogador x={x} />
                </div>
              ))}
            </div>

            <div style={card}>
              <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                Destaques
              </div>
              {(() => {
                const linhas = linhasDestaquesJogo(eventos, resumo, players);
                if (!linhas.length) return <div style={{ fontSize: 12.5, color: T.mutedDim }}>Sem acontecimentos registados.</div>;
                return linhas.map((l, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: T.cream, lineHeight: 1.8 }}>{l}</div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {!porJogar && onIdeias && (
        <div style={{ marginTop: 14 }}>
          <NotasDoJogo valor={match.ideias} onGuardar={onIdeias} />
        </div>
      )}

      {/* ---------- NÚMEROS ---------- (antes do jogo não há minutos nem
          notas — os números saem, para a página caber no ecrã) */}
      <div style={{ display: porJogar ? 'none' : 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginTop: 14 }}>
        {[
          { label: isFriendlyMatch(match) ? 'Presentes' : 'Convocados', valor: resumo.convocados },
          { label: 'Minutos dados', valor: resumo.minutos },
          { label: 'Nota média', valor: resumo.notaMedia == null ? '—' : resumo.notaMedia.toFixed(1), cor: T.warn },
          { label: 'Sem jogar', valor: resumo.semJogar, cor: resumo.semJogar ? T.mutedDim : undefined },
        ].map(x => (
          <div key={x.label} style={{ background: T.bg, borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 11.5, color: T.mutedDim }}>{x.label}</div>
            <div style={{ ...mono, fontSize: 19, color: x.cor || T.cream }}>{x.valor}</div>
          </div>
        ))}
      </div>

      {/* Partilhar/Imprimir à esquerda, fechar/editar à direita: as ações
          que produzem alguma coisa ficam separadas das que fecham a
          janela. `flexWrap` porque no telemóvel os quatro botões não cabem
          numa linha — quebram em vez de encolher até ficarem ilegíveis. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
        {onShare && <Btn variant="ghost" onClick={onShare} style={{ marginRight: 'auto' }}><Share2 size={15} /> Partilhar</Btn>}
        {onPrint && <Btn variant="ghost" onClick={onPrint}><Printer size={15} /> Imprimir</Btn>}
        <Btn variant="ghost" onClick={onClose}>Fechar</Btn>
        <Btn onClick={onEdit}><Pencil size={15} /> Editar jogo</Btn>
      </div>

      {/* TROCAR QUEM OCUPA UM LUGAR.

          Duas coisas diferentes, conforme quem se escolhe:
          · alguém que já está no campo → os dois trocam de lugar, e o onze
            fica igual (é só uma questão de desenho);
          · um suplente → passa a titular e quem lá estava vai para o banco,
            o que muda mesmo a equipa. */}
      {trocar != null && (
        <Modal title="Formação" subtitle={`${lugares[trocar]} · ${formacao}`} onClose={() => setTrocar(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '52vh', overflowY: 'auto', overflowX: 'hidden' }}>
            {/* TITULARES EM CIMA, SUPLENTES EM BAIXO.

                Numa lista ordenada só por posição, quem já está em campo
                aparece salpicado no meio do banco e é preciso ler linha a
                linha para perceber quem é quem. Separados, a lista responde
                de imediato à pergunta que se está a fazer: quem está a
                jogar e quem pode entrar. */}
            {(() => {
              const doJogo = (match.convocados || []).map(id => players.find(p => p.id === id)).filter(Boolean);
              const emCampoIds = new Set(colocados.filter(Boolean).map(p => p.id));
              return [
                ...sortByPosition(doJogo.filter(p => emCampoIds.has(p.id))),
                ...sortByPosition(doJogo.filter(p => !emCampoIds.has(p.id))),
              ];
            })().map(p => {
              const noCampo = colocados.some(v => v && v.id === p.id);
              const aqui = colocados[trocar] && colocados[trocar].id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    const ids = colocados.map(v => (v ? v.id : null));
                    const anterior = ids[trocar];
                    const jaOnde = ids.indexOf(p.id);
                    if (jaOnde >= 0) ids[jaOnde] = anterior;   // trocam de lugar
                    ids[trocar] = p.id;
                    // Lugares e titulares numa SÓ gravação. Eram duas seguidas
                    // (lugares, depois titulares), e a 2.ª levava para a
                    // convocatória os lugares ANTIGOS — o onze trocava
                    // sozinho (ex.: Cadilhe ↔ Cardoso).
                    if (jaOnde < 0 && onEscalacao) {
                      const titulares = ids.filter(Boolean);
                      const banco = (match.convocados || []).filter(id => !titulares.includes(id));
                      onEscalacao({ alinhamento: ids, starters: titulares, convocados: [...titulares, ...banco] });
                    } else {
                      onAlinhamento(ids);
                    }
                    setTrocar(null);
                  }}
                  style={{
                    textAlign: 'left', padding: '8px 10px', borderRadius: 7, cursor: 'pointer', ...body,
                    background: aqui ? '#B5393F22' : 'transparent',
                    border: `1px solid ${aqui ? '#B5393F' : T.line}`,
                    color: T.cream, fontSize: 12.5,
                  }}
                >
                  <span style={{ ...mono, fontSize: 10.5, color: T.mutedDim }}>{p.position || '--'}</span>{' '}
                  {p.name}
                  <span style={{ ...mono, fontSize: 10.5, color: aqui ? T.warn : T.mutedDim, float: 'right' }}>
                    {noCampo ? (aqui ? 'neste lugar' : 'titular') : 'suplente'}
                  </span>
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </Modal>
  );
}

