// media/organizacao.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { semAcentos, uid } from '../base/utilidades';
import { isFriendlyMatch } from '../dominio/jogos';
import { Trophy, Shield, FolderOpen } from 'lucide-react';

/* BIBLIOTECA, DO LADO DO ATLETA — o Canal geral (Biblioteca > Canal) tal
   como o staff o organiza, só consulta. Mostra SEMPRE tudo o que está no
   Canal (ao contrário da Ideia de Jogo, não há marcação vídeo a vídeo) —
   os vídeos de Scouting (adversário ou jogador observado) nunca aparecem
   aqui, porque nunca fizeram parte do Canal geral (ver `checkin_biblioteca`
   e o filtro de `videosGerais` em App: `!v.adversarioId && !v.scoutId`).

   Segue o MESMO modelo de organização do Canal: separadores de pasta em
   cima ("Tudo", cada pasta, "Sem pasta"), e o conteúdo da pasta escolhida
   abre por baixo — mas sem nada de editar, mover ou apagar, que aqui não
   faz sentido nenhum. */
// Duração máxima de um clipe criado por um jogador no Portal. Tem de
// bater certo com o limite da função `checkin_clipe_criar` no Supabase.
export const MAX_CLIPE_ATLETA_SEG = 300; // 5 minutos

/* ---------------------------------------------------------------
   FUTCHANNEL + APRESENTAÇÕES — mesmo componente para ambas as abas:
   cada item pode ser um link do YouTube (jogado sempre dentro da
   app, com deteção de incorporação bloqueada), um link do Instagram
   ou TikTok (Reels/vídeos, tocados também dentro da app), OU um
   ficheiro carregado diretamente (PDF, PowerPoint, vídeo). Layout:
   painel principal grande à esquerda + lista de itens à direita;
   o botão "Ecrã inteiro" põe o próprio leitor em ecrã inteiro.
---------------------------------------------------------------- */
// Normaliza o nome de uma pasta: sem espaços à volta, e vazio significa
// "sem pasta". Fica numa função só para o modal e a biblioteca usarem
// exatamente a mesma regra e não criarem pastas duplicadas por causa de
// um espaço a mais.
export function cleanFolder(name) {
  return (name || '').trim();
}

// Etiqueta usada no filtro para os itens que não estão em nenhuma pasta.
export const NO_FOLDER = '__sem_pasta__';

/* ---------------------------------------------------------------
   CATÁLOGO DO CANAL — Jogos · Adversários · Temas.

   O Canal deixou de ter "Tudo" e pastas soltas lado a lado. Cada vídeo
   pertence a UMA de três secções (`categoria`):
   - 'jogo'       jogos da nossa equipa, agrupados por jornada/jogo, com
                  os cortes desse jogo lá dentro;
   - 'adversario' jogos completos de adversários (para fazer cortes) —
                  agrupados pela ficha do adversário; os CORTES destes
                  vídeos vão para a ficha dele (Scouting › Adversários);
   - 'tema'       tudo o resto, nas pastas de sempre (Ideias, Motivacional…).

   Vídeos antigos não têm `categoria` gravada — deduz-se sem mexer em
   nada: um corte segue o vídeo de onde saiu; a pasta "Adversários" é
   'adversario'; um vídeo com jornada na descrição é 'jogo'; o resto é
   'tema'. Editar o vídeo grava a categoria escolhida. */
export function numJornada(txt) {
  const s = String(txt || '');
  if (!/jornada|^\s*j\s*\d/i.test(s)) return null;
  const m = s.match(/\d+/);
  return m ? Number(m[0]) : null;
}

// Número da jornada de um jogo do módulo Jogos (aí o campo pode ser só "2").
export function numDoJogo(m) {
  const x = String((m && m.jornada) || '').match(/\d+/);
  return x ? Number(x[0]) : null;
}

export function ehClipe(v) { return !!v && typeof v.clipInicio === 'number'; }

// A origem de um corte (se ainda existir na lista), para herdar o sítio.
export function origemDe(v, byId) {
  return ehClipe(v) && v.clipOrigemId && byId[v.clipOrigemId] && byId[v.clipOrigemId] !== v ? byId[v.clipOrigemId] : null;
}

export function categoriaDoItem(v, byId, prof = 0) {
  if (!v) return 'tema';
  if (v.categoria) return v.categoria;
  const o = prof < 4 && origemDe(v, byId);
  if (o) return categoriaDoItem(o, byId, prof + 1);
  if (semAcentos(v.pasta).trim() === 'adversarios') return 'adversario';
  if (numJornada(v.jornada) != null || ehAmigavelTxt(v.jornada)) return 'jogo';
  return 'tema';
}

export function chaveJogoDoItem(v, byId, matchesById, prof = 0) {
  const o = prof < 4 && origemDe(v, byId);
  if (o) return chaveJogoDoItem(o, byId, matchesById, prof + 1);
  const m = v.jogoId && matchesById[v.jogoId];
  // Os amigáveis não têm jornada — ficam todos juntos num cartão só.
  if ((m && isFriendlyMatch(m)) || (!m && ehAmigavelTxt(v.jornada))) return 'amigaveis';
  const n = numJornada(v.jornada) ?? (m ? numDoJogo(m) : null);
  if (n != null) return `j${n}`;
  if (v.jogoId) return `m${v.jogoId}`;
  return 'sem';
}

export function ehAmigavelTxt(txt) { return semAcentos(txt).includes('amig'); }

// JOGO dentro de um cartão com vários jogos (Amigáveis, ou um adversário):
// junta as partes do mesmo vídeo pelo título sem "- parte_N" e sem o
// escalão ("U18"/"U19"), que às vezes vem escrito numa parte e não
// noutra. Um vídeo ligado a um jogo do módulo Jogos usa esse jogo.
/* O número da parte no fim do título, escrito de muitas maneiras:
   "_parte2", "_parte_2", " - parte 2", "_part1", "Part 2", "pt2", "(2.ª parte)"…
   Dantes só se apanhava "parte", e "Amarante vs Paredes_part1" ficava num
   jogo à parte do "_parte2". */
export const RE_PARTE_FIM = /\s*[-_–(]*\s*(?:(?:parte|part|pt)[\s_.-]*(\d+)|(\d+)\s*(?:\.?\s*[ªa°º])?\s*parte)\s*\)?\s*$/i;

export function tituloSemParte(t) {
  return String(t || '').replace(RE_PARTE_FIM, '').replace(/[\s_–-]+$/, '').trim();
}

export function numeroDaParte(t) {
  const m = String(t || '').match(RE_PARTE_FIM);
  return m ? Number(m[1] || m[2]) : 0;
}

/* Chave do jogo pelo título: sem a parte, e cada equipa pelo nome "limpo"
   (sem FC, SC, USC, U19…) — "Amarante vs Padroense FC_parte_2" e
   "Amarante vs Padroense_parte_1" são o MESMO jogo. */
export function subJogoDoItem(v, byId, prof = 0) {
  const o = prof < 4 && origemDe(v, byId);
  if (o) return subJogoDoItem(o, byId, prof + 1);
  if (v.jogoId) return `m${v.jogoId}`;
  const t = ehClipe(v) ? (v.clipOrigemTitulo || v.title) : v.title;
  const base = semAcentos(tituloSemParte(t)).replace(/_/g, ' ');
  const equipas = base.split(/\s+(?:vs\.?|versus|x)\s+/i).map(chaveNomeEquipa).filter(Boolean);
  if (equipas.length >= 2) return equipas.join(' vs ');
  return base.replace(/\bu\d{2}\b/g, '').replace(/\s+/g, ' ').trim() || v.id;
}

// Divide uma lista em jogos (cada um: partes completas, depois cortes),
// o jogo criado mais recentemente primeiro.
export function seccionarPorJogo(lista, byId, ordemCriacao, rotuloDe) {
  const porJogo = {};
  lista.forEach(v => { const k = subJogoDoItem(v, byId); (porJogo[k] = porJogo[k] || []).push(v); });
  return Object.entries(porJogo)
    .map(([k, itens]) => {
      const parte = numeroDaParte;
      const ord = ordenarDoJogo([...itens].sort((a, b) => (parte(a.title) - parte(b.title))
        || String(a.title || '').localeCompare(String(b.title || ''), 'pt', { numeric: true })));
      return { key: k, titulo: rotuloDe(k, ord), itens: ord, recente: Math.max(...itens.map(v => ordemCriacao[v.id] || 0)) };
    })
    .sort((a, b) => b.recente - a.recente);
}

// Equipas de um jogo de adversário (as duas do jogo). Um corte segue o
// vídeo de onde saiu; vídeos antigos, ligados a uma ficha antes de
// existir este campo, usam o nome dessa ficha.
export function equipasDoItem(v, byId, fichasById, prof = 0) {
  if (!v) return [];
  const o = prof < 4 && origemDe(v, byId);
  if (o) return equipasDoItem(o, byId, fichasById, prof + 1);
  if (Array.isArray(v.equipas) && v.equipas.filter(Boolean).length) return v.equipas.filter(Boolean);
  const f = v.adversarioFichaId && fichasById[v.adversarioFichaId];
  return f && f.nome ? [f.nome] : [];
}

// Ficha do adversário que corresponde a uma equipa da competição — pelo
// nome, ou pela equipa a que a ficha foi associada à mão.
//
// Os nomes raramente vêm iguais nos dois sítios ("Padroense" na ficha,
// "Padroense FC" na competição; "Paços Ferreira" / "FC Paços de
// Ferreira"). Por isso, depois da comparação exata, compara-se o nome
// "limpo" — sem siglas de clube (FC, SC, UD, USC…), escalões (U19,
// Sub-19) e palavras de ligação — e, por fim, um nome contido no outro,
// mas só quando há UMA ficha candidata (nunca se adivinha entre duas).
export const PALAVRAS_CLUBE = new Set([
  'fc', 'sc', 'cf', 'ud', 'usc', 'ad', 'gd', 'cd', 'sad', 'ac', 'cfc', 'sl', 'sp', 'ca', 'ss', 'as', 'ug', 'ard', 'gdr', 'adr',
  'clube', 'club', 'futebol', 'football', 'sport', 'desportivo', 'desportiva', 'associacao', 'uniao', 'grupo',
  'de', 'da', 'do', 'das', 'dos', 'e', 'juniores', 'junior', 'formacao', 'sub',
]);

export function chaveNomeEquipa(nome) {
  return semAcentos(nome)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(p => p && !PALAVRAS_CLUBE.has(p) && !/^u\d{1,2}$/.test(p) && !/^\d{1,2}$/.test(p))
    .join(' ');
}

export function fichaDaEquipa(nome, adversarios) {
  const lista = adversarios || [];
  const k = semAcentos(nome);
  if (!k) return null;
  const exata = lista.find(a => semAcentos(a.equipaCompeticao) === k) || lista.find(a => semAcentos(a.nome) === k);
  if (exata) return exata;
  const c = chaveNomeEquipa(nome);
  if (!c) return null;
  const limpas = lista.filter(a => chaveNomeEquipa(a.nome) === c || (a.equipaCompeticao && chaveNomeEquipa(a.equipaCompeticao) === c));
  if (limpas.length === 1) return limpas[0];
  if (limpas.length > 1) return null;
  if (c.length < 4) return null;
  const contidas = lista.filter(a => {
    const ca = chaveNomeEquipa(a.nome);
    return ca.length >= 4 && (ca.includes(c) || c.includes(ca));
  });
  return contidas.length === 1 ? contidas[0] : null;
}

/* FICHA REPETIDA — há já uma ficha para esta equipa? Mais estrito do que
   `fichaDaEquipa` (que também aceita nomes "contidos" noutro): aqui só
   conta o mesmo nome, escrito igual ou com as mesmas palavras depois de
   tirar "FC", "SC", "U19"… ("Amarante FC" = "Amarante" = "F.C. Amarante"),
   para não impedir equipas diferentes como "Amarante B". */
export function fichaRepetida(nome, adversarios, ignorarId) {
  const k = semAcentos(nome);
  if (!k) return null;
  const c = chaveNomeEquipa(nome);
  return (adversarios || []).find(a => a && a.id !== ignorarId && (
    semAcentos(a.nome) === k || semAcentos(a.equipaCompeticao) === k
    || (c && (chaveNomeEquipa(a.nome) === c || (a.equipaCompeticao && chaveNomeEquipa(a.equipaCompeticao) === c)))
  )) || null;
}

/* Id das fichas criadas SOZINHAS (Canal de vídeos). É sempre o mesmo para
   a mesma equipa da mesma equipa técnica: se dois aparelhos criarem a
   ficha ao mesmo tempo — cada um sem ainda ver a do outro — gravam a MESMA
   linha em vez de duas. Foi assim que apareceu o "Amarante FC" repetido. */
export function idFichaAutomatica(teamId, nome) {
  const s = (chaveNomeEquipa(nome) || semAcentos(nome)).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return teamId && s ? `adv-${teamId}-${s}` : uid();
}

// Ordem dentro de um jogo: primeiro os vídeos completos, depois os cortes
// pela ordem em que acontecem (vídeo de origem, depois minuto).
export function ordenarDoJogo(lista) {
  const completos = lista.filter(v => !ehClipe(v));
  const cortes = lista.filter(ehClipe).sort((a, b) =>
    String(a.clipOrigemTitulo || '').localeCompare(String(b.clipOrigemTitulo || ''), 'pt', { numeric: true })
    || a.clipInicio - b.clipInicio);
  return [...completos, ...cortes];
}

export const SECOES_CANAL = [
  { id: 'jogos', label: 'Jogos', cat: 'jogo', Icon: Trophy },
  { id: 'adversarios', label: 'Adversários', cat: 'adversario', Icon: Shield },
  { id: 'temas', label: 'Temas', cat: 'tema', Icon: FolderOpen },
];

export function lerCompilacoes(chave) {
  try { const v = JSON.parse(localStorage.getItem(chave) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}

export function gravarCompilacoes(chave, lista) {
  try { localStorage.setItem(chave, JSON.stringify(lista)); } catch (e) { /* sem espaço / modo privado */ }
}

export const mmss = (s) => { const t = Math.max(0, Math.round(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

