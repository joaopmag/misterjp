// base/utilidades.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.

export const uid = () => Math.random().toString(36).slice(2, 10);

export const ACTIVITY_LABELS = {
  season_config: 'Época', players: 'Plantel', exercises: 'Exercícios', ideias: 'Ideia de Jogo',
  sessions: 'Planeamento', monitoring: 'Monitorização', matches: 'Jogos',
  scouting: 'Scouting', videos: 'Vídeos', apresentacoes: 'Apresentações', convocatorias: 'Convocatórias', diario: 'Diário',
  league_standings: 'Classificação', clinico: 'Boletim Clínico', tarefas: 'Tarefas',
};

export function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'agora mesmo';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.round(hours / 24);
  return `há ${days}d`;
}

// Normaliza para comparar nomes de mês sem acentos/maiúsculas — o texto
// do ficheiro modelo tem acentos ("Março"), o que se escreve à mão para
// o comparar pode não ter.
export function semAcentos(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short' });
}

export function escapeHtmlText(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Formata uma Date como 'YYYY-MM-DD' usando o calendário LOCAL do browser,
// em vez de toISOString() (que converte para UTC e, em fusos horários
// à frente de UTC como Portugal no verão, "recua" um dia à meia-noite).
export function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr() {
  return toLocalISODate(new Date());
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toLocalISODate(d);
}

export const WEEKDAY_ABBR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function weekdayAbbr(dateStr) {
  return WEEKDAY_ABBR[new Date(dateStr + 'T00:00:00').getDay()];
}

export function formatShortDatePt(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${weekdayAbbr(dateStr)}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function fmtShort(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}

