// adversarios/comum.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.

/* ---------------------------------------------------------------
   ADVERSÁRIOS — a segunda valência do Scouting.

   Um adversário não duplica nada do que já existe: os "jogadores-chave"
   são as MESMAS fichas da aba "Jogadores" (`scouting`), só marcadas
   como relevantes para este adversário em concreto — por isso um
   jogador observado pode pertencer a vários adversários ao longo da
   época, e editar/apagar a ficha dele em "Jogadores" reflete-se aqui
   sozinho, sem precisar de sincronizar nada.

   Táticas e Vídeos ficam para as próximas fases (reaproveitam,
   respetivamente, o editor de prancheta da Ideia de Jogo e a Biblioteca
   — ver a conversa sobre esta funcionalidade). Por agora, só Resumo e
   Jogadores-chave. */
/* COR DE UM CLUBE — a cor verdadeira, escolhida na ficha do adversário
   (`cor`, em #rrggbb). Sem cor preenchida, cinzento neutro. */
export const COR_CLUBE_OMISSAO = '#6B7280';

export function corDoClube(cor, opacidade = 1) {
  const hex = /^#[0-9a-f]{6}$/i.test(String(cor || '')) ? cor : COR_CLUBE_OMISSAO;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacidade})`;
}

// Texto por cima da cor do clube: escuro nas cores claras (branco,
// amarelo…), branco nas outras.
export function textoSobreCor(cor) {
  const hex = /^#[0-9a-f]{6}$/i.test(String(cor || '')) ? cor : COR_CLUBE_OMISSAO;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 170 ? '#1A1A1A' : '#FFFFFF';
}

// Cores mais comuns nos clubes, para escolher com um toque.
export const CORES_CLUBE = [
  { cor: '#C8102E', nome: 'Vermelho' }, { cor: '#7A1F2B', nome: 'Grená' }, { cor: '#1F4E9C', nome: 'Azul' },
  { cor: '#5DA9E9', nome: 'Azul claro' }, { cor: '#1E7B3A', nome: 'Verde' }, { cor: '#F2C200', nome: 'Amarelo' },
  { cor: '#E87722', nome: 'Laranja' }, { cor: '#5B2C83', nome: 'Roxo' }, { cor: '#111111', nome: 'Preto' },
  { cor: '#F5F5F5', nome: 'Branco' },
];

/* Iniciais para o escudo: ignora as siglas do tipo de clube (FC, UD,
   USC, SC, CD…), que se repetem em quase todos e não distinguem nada.
   "FC Padroense" → "P"; "Rio Ave FC" → "RA". */
export const SIGLAS_CLUBE = new Set(['fc', 'ud', 'usc', 'sc', 'cd', 'ad', 'gd', 'cf', 'ac', 'acd', 'adc', 'gdc', 'udc', 'sl', 'sad', 'cs', 'as', 'cp', 'crc', 'ccd', 'ard', 'gdr', 'clube', 'futebol', 'de', 'da', 'do', 'dos', 'das', 'e']);

export function iniciaisDoClube(nome) {
  const palavras = String(nome || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const uteis = palavras.filter(p => !SIGLAS_CLUBE.has(p.toLowerCase()));
  const base = uteis.length ? uteis : palavras;
  if (!base.length) return '?';
  return base.slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

