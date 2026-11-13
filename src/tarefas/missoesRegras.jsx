// tarefas/missoesRegras.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { ClipboardList, Video, Search, CalendarDays, Trophy, Pencil, MessageCircle, Shield, Lightbulb, BookOpen, Activity, TrendingUp, Dumbbell, UserCheck, Stethoscope, Tv, FileSpreadsheet, Users } from 'lucide-react';
import { shortPlayerName } from '../dominio/jogadores';
import { T } from '../base/tema';
import { LINHAS } from '../dominio/plantel';
import { nomeDoMembro } from '../gestao/membros';

/* ================================================================
   MISSÕES — o modelo novo das Tarefas.
   ================================================================
   Uma missão é a unidade: tem o SEU título, o caminho (para onde leva),
   instruções, prazo ou repetição, e é para uma pessoa. Acabaram os
   "passos" dentro de uma tarefa (o jogador ficava preso no primeiro e o
   título repetia-se em todos).

   A MESMA MISSÃO PARA VÁRIOS: escolhendo vários jogadores (ou várias
   pessoas da equipa técnica), grava-se um registo por pessoa, todos com
   o mesmo `grupoId`. Tem de ser um registo por pessoa porque o Portal e
   as funções do servidor trabalham com um jogador por tarefa. No ecrã
   das Tarefas (Calendário e Por prazo) os registos do mesmo grupo
   aparecem juntos num só cartão ("12 jogadores · 3 feitas"); em
   "Por pessoa" aparece a cópia de cada um.

   As tarefas antigas com vários passos continuam a abrir no editor
   antigo (TarefaModal) até serem concluídas. */

// Para onde leva uma missão da EQUIPA TÉCNICA: um separador da app.
export const CAMINHOS_STAFF = [
  { id: '', rotulo: 'Sem caminho', icon: ClipboardList },
  { id: 'analise', rotulo: 'Análise de Vídeo', acao: 'Análise de vídeo', icon: Video },
  { id: 'scouting', rotulo: 'Scouting / adversário', acao: 'Observar o adversário', icon: Search },
  { id: 'planeamento', rotulo: 'Planeamento', acao: 'Planear a semana', icon: CalendarDays },
  { id: 'jogos', rotulo: 'Jogos / convocatória', acao: 'Preparar a convocatória', icon: Trophy },
  // Abre Jogos já com o editor do último jogo sem estatísticas.
  { id: 'estatisticas', rotulo: 'Relatórios de jogo · preencher estatísticas', acao: 'Introduzir as estatísticas do jogo', icon: Pencil },
  // Abre Relatórios de jogo com a caixa "Análise do jogo" do último jogo
  // ainda sem análise.
  { id: 'analisejogo', rotulo: 'Relatórios de jogo · análise do jogo', acao: 'Escrever a análise do jogo', icon: MessageCircle },
  // Abre Scouting › Adversários.
  { id: 'fichaadversario', rotulo: 'Scouting · ficha do adversário', acao: 'Preparar a ficha do adversário', icon: Shield },
  // Abre a ficha do próximo jogo ainda sem ideias, no campo "Ideias para o jogo".
  { id: 'ideiasjogo', rotulo: 'Jogos · ideias para o jogo', acao: 'Escrever as ideias para o jogo', icon: Lightbulb },
  { id: 'diario', rotulo: 'Diário / ocorrência', acao: 'Registar no Diário', icon: BookOpen },
  { id: 'monitorizacao', rotulo: 'Monitorização', acao: 'Rever a monitorização', icon: Activity },
  { id: 'desenvolvimento', rotulo: 'Desenvolvimento', acao: 'Avaliar o desenvolvimento', icon: TrendingUp },
  { id: 'ideiajogo', rotulo: 'Ideia de Jogo', acao: 'Atualizar a ideia de jogo', icon: Lightbulb },
  { id: 'exercicios', rotulo: 'Exercícios', acao: 'Preparar exercícios', icon: Dumbbell },
  { id: 'presencas', rotulo: 'Presenças', acao: 'Registar presenças', icon: UserCheck },
  { id: 'clinico', rotulo: 'Boletim Clínico', acao: 'Atualizar o boletim clínico', icon: Stethoscope },
  { id: 'biblioteca', rotulo: 'Sala de Vídeo', acao: 'Organizar a Sala de Vídeo', icon: Tv },
  { id: 'documentos', rotulo: 'Documentos', acao: 'Preparar os documentos', icon: FileSpreadsheet },
];

/* MISSÕES DA EQUIPA TÉCNICA QUE SE VERIFICAM SOZINHAS.
   Não há "Concluir" à mão nas missões com caminho: fecham quando a app vê
   o trabalho feito NO SÍTIO CERTO, pela PRÓPRIA pessoa, DEPOIS de a
   missão começar. A prova vem do registo de cada tabela (quem gravou e
   quando: `updated_by_email` / `updated_at`), que a app já guarda.
   - "Relatórios de jogo" é mais exigente: só fecha quando TODOS os jogos
     já realizados (menos os cancelados ou adiados) têm minutos lançados.
   - Quem verifica é a app da pessoa responsável (só ela sabe o próprio
     email). Quando vê a prova, grava a missão como concluída e quem a
     criou recebe o aviso de sempre.
   - Limite honesto: a app sabe que a pessoa gravou alguma coisa naquele
     separador depois de a missão começar; não sabe se ficou bem feito.
   - "Sem caminho" não tem prova possível: fica com "Concluir" à mão. */
export const CRITERIO_STAFF = {
  analise: 'carregares ou editares um vídeo na Análise de Vídeo',
  scouting: 'gravares um relatório de scouting ou de adversário',
  planeamento: 'gravares uma sessão no Planeamento',
  presencas: 'registares presenças de um treino ou jogo',
  jogos: 'gravares a convocatória ou o jogo',
  estatisticas: 'todos os jogos já realizados tiverem minutos lançados',
  analisejogo: 'escreveres a análise de um jogo',
  diario: 'registares uma ocorrência no Diário',
  monitorizacao: 'registares dados na Monitorização',
  desenvolvimento: 'gravares uma avaliação no Desenvolvimento',
  ideiajogo: 'gravares um esquema na Ideia de Jogo',
  exercicios: 'gravares um exercício',
  clinico: 'atualizares o Boletim Clínico',
  biblioteca: 'carregares ou editares algo na Sala de Vídeo',
  documentos: 'carregares ou editares um documento',
  fichaadversario: 'gravares a ficha do adversário',
  ideiasjogo: 'escreveres as ideias para o jogo',
};

export const caminhoVerificavel = (t) => !!(t && !t.jogadorId && t.caminho && CRITERIO_STAFF[t.caminho]);

export const caminhoStaff = (id) => CAMINHOS_STAFF.find(c => c.id === (id || '')) || CAMINHOS_STAFF[0];

/* Junta os registos do mesmo grupo num só cartão (só para mostrar).
   O cartão do grupo tem `_grupo` (os registos) e um id "grupo:…"; as
   ações do ecrã (concluir, arrastar, apagar, abrir) aplicam-se a todos. */
export function agruparMissoes(lista) {
  const porG = new Map();
  const ordem = [];
  (lista || []).forEach(t => {
    if (t.grupoId) {
      if (!porG.has(t.grupoId)) { porG.set(t.grupoId, []); ordem.push({ __g: t.grupoId }); }
      porG.get(t.grupoId).push(t);
    } else ordem.push(t);
  });
  return ordem.map(x => {
    if (!x.__g) return x;
    const rs = porG.get(x.__g);
    if (rs.length === 1) return rs[0];
    const base = rs[0];
    const fez = (r) => r.estado === 'feita' || (!!r.jogadorId && !!r.notaSubmetida);
    const todas = rs.every(fez);
    return {
      ...base, id: `grupo:${x.__g}`, _grupo: rs, _paraJogadores: rs.some(r => r.jogadorId),
      jogadorId: '', notaSubmetida: false, lembrete: null,
      estado: todas ? 'feita' : (rs.some(r => r.estado === 'curso') ? 'curso' : 'aberta'),
      feitaEm: todas ? (rs.map(r => r.feitaEm || r.notaSubmetidaEm || '').sort().pop() || null) : null,
      concluidasEm: base.recorrencia
        ? (base.concluidasEm || []).filter(d => rs.every(r => (r.concluidasEm || []).includes(d)))
        : base.concluidasEm,
    };
  });
}

export const feitaNoGrupo = (r) => r.estado === 'feita' || (!!r.jogadorId && !!r.notaSubmetida);

// A linha "12 jogadores · 3 feitas" dos cartões de grupo.
export function ResumoGrupo({ tarefa, membros, euId, players, pequeno }) {
  const rs = tarefa._grupo || [];
  const feitas = rs.filter(feitaNoGrupo).length;
  const nomes = tarefa._paraJogadores
    ? rs.map(r => shortPlayerName((players || []).find(p => p.id === r.jogadorId) || {}, players))
    : rs.map(r => nomeDoMembro(r.responsavel, membros, euId).split(' ')[0]);
  const quem = tarefa._paraJogadores ? `${rs.length} jogadores` : `${rs.length} pessoas`;
  return (
    <div title={nomes.join(', ')} style={{
      display: 'flex', alignItems: 'center', gap: 4, marginTop: pequeno ? 4 : 3, fontSize: pequeno ? 10.5 : 11.5,
      color: T.gold, fontWeight: 600, minWidth: 0,
    }}>
      <Users size={pequeno ? 10 : 12} style={{ flexShrink: 0 }} />
      <span style={LINHAS(1)}>{quem} · {feitas}/{rs.length} {feitas === 1 ? 'feita' : 'feitas'}</span>
    </div>
  );
}

