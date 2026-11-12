// dominio/jogadores.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useIsMobile, askConfirm } from '../base/ui';
import { body, TEXT_ON_ACCENT, T } from '../base/tema';
import { resumoClinico } from './clinico';

export const POSITIONS = ['GR', 'DC', 'DE', 'DD', 'MD', 'MC', 'MOC', 'EE', 'ED', 'PL'];

export function sortByPosition(players) {
  return [...(players || [])].sort((a, b) => {
    const posA = POSITIONS.indexOf(a.position), posB = POSITIONS.indexOf(b.position);
    const diff = (posA === -1 ? POSITIONS.length : posA) - (posB === -1 ? POSITIONS.length : posB);
    return diff !== 0 ? diff : (Number(a.number) || 99) - (Number(b.number) || 99);
  });
}

/* ---------------------------------------------------------------
   MATRIZ WELLNESS × ESFORÇO

   Eixo horizontal: média de Wellness dos últimos 7 dias (1 a 5).
   Eixo vertical:   média de PSE dos últimos 7 dias (0 a 10).

   Os quadrantes lêem-se assim:
     · esforço alto + wellness baixo  → sinal de alerta (canto sup. esq.)
     · esforço alto + wellness bom    → a aguentar bem a carga
     · esforço baixo + wellness baixo → mal-estar sem carga que o explique
     · esforço baixo + wellness bom   → margem para carregar

   Cada ponto mostra só a posição e o primeiro nome, para a matriz não
   ficar ilegível com 25 jogadores. Só entram jogadores com pelo menos
   uma resposta de cada tipo na semana — sem os dois eixos não há sítio
   onde os colocar.
---------------------------------------------------------------- */
export function firstNameOf(name) {
  const parts = String(name || '').trim().split(/\s+/);
  return parts[0] || '—';
}

/* Apelido (último nome): usado nas tabelas de Monitorização e Presenças,
   onde o espaço é apertado e o que identifica o jogador de relance é o
   apelido, não o primeiro nome. */
export function lastNameOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  return parts[parts.length - 1];
}

/* Nome "de cartão": primeiro e último nome, sem os do meio. É o formato
   que se usa a falar do jogador ("Edu Castro") e cabe numa linha sem
   reticências, ao contrário do nome completo do registo. */
export function shortFullName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export function shortPlayerName(player, allPlayers) {
  if (!player) return '—';
  // O nome por que é conhecido (Plantel › "Nome no clube") manda sempre.
  const alcunha = String(player.alcunha || '').trim();
  if (alcunha) return alcunha;
  const lista = allPlayers || [];
  const outros = lista.filter(o => o && o.id !== player.id);

  const primeiro = firstNameOf(player.name);
  if (!outros.some(o => firstNameOf(o.name) === primeiro)) return primeiro;

  /* Havendo outro jogador com o mesmo primeiro nome, mostra-se o apelido
     em vez de uma inicial — identifica sem ambiguidade e sem abreviar
     demasiado (dois "Martim", dois "João" ficam "Sales"/"Costa" em vez
     de "Martim S."/"João C."). */
  const apelido = lastNameOf(player.name);
  if (!outros.some(o => lastNameOf(o.name) === apelido)) return apelido;

  return shortFullName(player.name);
}

/* `estadoClinico` é opcional: uma função (jogador) => estado|null, já
   com a data certa fechada por quem chama. Quando vem, o chip ganha um
   ponto da cor do nível e o motivo no `title`, e selecionar alguém que o
   nível manda avisar pede confirmação — UMA vez, e passa.

   Avisar em vez de bloquear é deliberado. O lançamento é quase sempre
   retroativo (preenche-se o jogo dias depois) e há o caso em que o
   jogador se magoou DURANTE o jogo: tem de estar na convocatória. Um
   bloqueio duro tornava a verdade impossível de registar.

   `avisaEm` diz qual dos dois avisos usar: 'jogo' numa convocatória,
   'treino' no simulador e no resto. É o que faz o "treino condicionado"
   entrar na distribuição de equipas sem chatear, mas continuar a avisar
   quando é para jogar a sério. */
/* ================================================================
   CONVIDADOS À EXPERIÊNCIA
   ================================================================

   Miúdos que aparecem a um treino ou a um amigável sem pertencerem ao
   plantel. Escrevem-se à mão, vivem só naquele dia, e não existem em
   lado nenhum a não ser ali.

   A decisão que faz isto funcionar: NÃO são jogadores. Não entram na
   tabela `players`, não têm id de plantel, não aparecem em listas de
   seleção. Por isso não é preciso excluí-los das médias, das
   estatísticas, da assiduidade ou do desenvolvimento — nunca lá
   estiveram. A alternativa (criar o jogador com um sinalizador
   "experiência") obrigava a lembrar-me dele em cada conta da app, e
   bastava esquecer uma para os números ficarem errados em silêncio.

   Saem nas folhas impressas e no ficheiro partilhado, porque quem leva o
   papel para o campo precisa de os ter na lista.

   Quando um é aceite, o botão Integrar cria o jogador no Plantel a
   partir do nome — e o convidado desaparece dali. O histórico começa
   nesse dia: as presenças anteriores eram de alguém que não existia. */

export const convidadosDe = (registo) => (registo && Array.isArray(registo.convidados) ? registo.convidados : []);

/* O nome mostrado segue sempre o mesmo padrão da Monitorização — nome
   curto (shortPlayerName), não o nome completo do registo. `allPlayers`
   é o universo usado para desambiguar (dois "Pedro" no plantel, por
   exemplo); por omissão é a própria lista mostrada, mas quando essa
   lista já vem filtrada (ex: só os "fora do momento", ou só os
   guarda-redes) quem chama pode passar o plantel completo para a
   desambiguação continuar a funcionar como esperado. */
export function PlayerChipList({ players, allPlayers, isOn, onToggle, estadoClinico, avisaEm = 'treino' }) {
  const isMobile = useIsMobile(560);
  const universo = allPlayers || players;
  /* Ordenação POR COLUNA: com gridAutoFlow "column" e um número de linhas
     fixo, a lista lê-se de cima para baixo em cada coluna (GR, GR, GR, GR,
     DC…) em vez de saltar de coluna em coluna. Para isso é preciso saber
     quantas colunas há, por isso são fixas: 1 no telemóvel, 2 no resto. */
  const cols = isMobile ? 1 : 2;
  const ordered = sortByPosition(players);
  const rows = Math.max(1, Math.ceil(ordered.length / cols));
  return (
    <div style={{
      display: 'grid', gap: 6,
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gridTemplateRows: `repeat(${rows}, auto)`,
      gridAutoFlow: 'column',
    }}>
      {ordered.map(p => {
        const on = isOn(p);
        const clinico = estadoClinico ? estadoClinico(p) : null;
        const avisa = !!clinico && (avisaEm === 'jogo' ? clinico.avisaJogo : clinico.avisaTreino);
        const motivo = clinico ? resumoClinico(clinico) : '';
        const escolher = () => {
          // Só pergunta ao SELECIONAR: tirar alguém da lista nunca precisa
          // de justificação.
          if (avisa && !on) {
            askConfirm({
              title: clinico.label,
              label: `${p.name} · ${resumoClinico(clinico, { comNivel: false })}`,
              note: '',
              confirmLabel: 'Selecionar',
              destructive: false,
              onConfirm: () => onToggle(p),
            });
            return;
          }
          onToggle(p);
        };
        return (
          <button key={p.id} type="button" onClick={escolher} title={motivo || p.name} style={{
            padding: '9px 12px', borderRadius: 16, fontSize: 12.5, cursor: 'pointer', ...body,
            textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            background: on ? '#B5393F' : 'transparent', color: on ? TEXT_ON_ACCENT : T.muted,
            border: `1px solid ${on ? '#B5393F' : T.line}`,
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            {clinico && (
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: clinico.cor, boxShadow: on ? '0 0 0 1.5px rgba(255,255,255,.5)' : 'none',
              }} />
            )}
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {p.position ? `${p.position} · ` : ''}{shortPlayerName(p, universo)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

