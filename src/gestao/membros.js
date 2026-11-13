// gestao/membros.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { supabase } from '../supabaseClient';
import { linkWhatsApp } from '../dominio/mensagens';

/* Exportar / importar — vive no rodapé da barra lateral. */
/* ================================================================
   EQUIPAS — o contexto em que tudo o resto vive
   ================================================================

   Cada registo da app pertence a uma equipa. Quem entra escolhe em qual
   está a trabalhar, e a partir daí não vê mais nada. O isolamento a
   sério é feito pela RLS no Postgres; isto é a camada de cima, a que
   torna a coisa utilizável.

   A equipa ativa vive no localStorage, POR DISPOSITIVO. Escolher Sub-19
   no portátil não muda o telemóvel — e é o que se quer: cada aparelho
   lembra-se do que se estava a fazer nele. */
export const CHAVE_EQUIPA = 'misterjp-equipa';

/* Guardada à parte do componente para o `App` a poder ler no arranque
   sem esperar por nada. */
/* OS MEMBROS DA EQUIPA, COM NOME.

   A `auth.users` não é legível pelo cliente — e não deve ser, senão
   qualquer membro ficava com a lista de contas da plataforma. Por isso o
   nome não vem do email: é um campo que cada pessoa preenche para si na
   vista da equipa.

   Enquanto ninguém o preencher, mostra-se "Membro 3f2a…", que é feio mas
   honesto. Passou a ser preciso a sério a partir das Tarefas: atribuir
   trabalho a "Membro 3f2a…" não é utilizável. */
/* TELEFONE DOS MEMBROS (para lembretes de tarefas por WhatsApp).
   Coluna nova em team_members. Se a base de dados ainda não a tiver
   (código 42703, coluna inexistente), carrega-se sem ela, como antes:
   os nomes e as Tarefas continuam a funcionar, só não há WhatsApp. */
export async function selecionarMembros(teamId) {
  /* Tenta do mais completo para o mais simples: se a base de dados ainda
     não tiver uma das colunas novas (código 42703), cai para a seguinte,
     e a app continua a funcionar só sem essa informação. */
  const tentativas = [
    'user_id, papel, nome, telefone, genero, funcao, created_at',
    'user_id, papel, nome, telefone, genero, created_at',
    'user_id, papel, nome, telefone, created_at',
    'user_id, papel, nome, created_at',
  ];
  let ultimo = null;
  for (const colunas of tentativas) {
    ultimo = await supabase.from('team_members').select(colunas).eq('team_id', teamId).order('created_at');
    if (!ultimo.error) return ultimo;
    if (ultimo.error.code !== '42703' && !/telefone|genero|funcao/.test(ultimo.error.message || '')) return ultimo;
  }
  return ultimo;
}

/* GÉNERO DE CADA MEMBRO ('m' | 'f'), só para as mensagens que a app
   escreve em nome dele concordarem ("Obrigado!" / "Obrigada!"). Sem
   género definido, usa-se "Obrigado/a!". */
export const GENEROS = [['m', 'Masculino'], ['f', 'Feminino']];

/* FUNÇÃO DE CADA MEMBRO NA EQUIPA (Treinador principal, adjunto…). Aparece
   na credencial da porta de entrada. Grava-se como o género: cada um a
   sua, e o responsável a de todos. Coluna nova `funcao` (fase 2 da
   entrada); sem ela, devolve o erro e nada mais muda. */
export async function gravarFuncaoMembro(teamId, userId, funcao) {
  const { error } = await supabase.from('team_members')
    .update({ funcao: funcao || null })
    .eq('team_id', teamId).eq('user_id', userId);
  return error ? (/funcao/.test(error.message || '') ? 'Falta a coluna "funcao" no Supabase (corre o SQL da fase 2).' : error.message) : '';
}

export async function gravarGeneroMembro(teamId, userId, genero) {
  const { error } = await supabase.from('team_members')
    .update({ genero: genero || null })
    .eq('team_id', teamId).eq('user_id', userId);
  if (!error) return null;
  return error.code === '42703' || /genero/.test(error.message || '')
    ? 'A base de dados ainda não tem o campo do género. É preciso correr a atualização (coluna "genero" em team_members).'
    : error.message;
}

/* Grava o telemóvel de um membro. Devolve null se correu bem, ou a
   mensagem de erro a mostrar. Usado pelo próprio, pelo dono da equipa
   para os outros, e logo a seguir a criar ou entrar numa equipa. */
export const telefoneValido = (v) => !String(v || '').trim() || !!linkWhatsApp(v, '');

export async function gravarTelefoneMembro(teamId, userId, valor) {
  const v = String(valor || '').trim();
  if (!telefoneValido(v)) return 'Esse número não parece válido. Inclui o indicativo, por exemplo +351 912 345 678.';
  const { error } = await supabase.from('team_members')
    .update({ telefone: v || null })
    .eq('team_id', teamId).eq('user_id', userId);
  if (!error) return null;
  return error.code === '42703' || /telefone/.test(error.message || '')
    ? 'A base de dados ainda não tem o campo do telemóvel. É preciso correr a atualização (coluna "telefone" em team_members).'
    : error.message;
}

/* Nome a mostrar para um membro. O próprio vê-se como "Tu" — é mais
   curto e evita a estranheza de ler o próprio nome numa lista de
   atribuições. */
export function nomeDoMembro(userId, membros, euId) {
  if (!userId) return 'Sem responsável';
  if (userId === euId) return 'Tu';
  const m = (membros || []).find(x => x.user_id === userId);
  if (m && m.nome) return m.nome;
  return `Membro ${String(userId).slice(0, 6)}`;
}

/* Cor estável por pessoa: a mesma sempre, sem a guardar em lado nenhum.
   Serve só para as iniciais se distinguirem de relance numa lista. */
/* Agora SEM REPETIR dentro da equipa: as pessoas da equipa técnica são
   ordenadas pelo id (a mesma ordem em todos os computadores) e cada uma
   fica com uma cor diferente desta lista, que tem cores bem distintas
   entre si. Só numa equipa com mais de 12 pessoas é que alguma repetiria.
   `registarCoresMembros` é chamado sempre que a lista da equipa chega. */
export const CORES_MEMBRO = ['#C9A227', '#4CA86B', '#D14056', '#3A6FC4', '#8C3F9E', '#3FA7A0', '#D9792E', '#E07BB0', '#8FB339', '#7A8CA3', '#B07A4E', '#5BC0EB'];

export const coresMembroAtribuidas = {};

export function registarCoresMembros(membros) {
  const ids = [...new Set((membros || []).map(m => m && m.user_id).filter(Boolean))].sort();
  ids.forEach((id, i) => { if (i < CORES_MEMBRO.length) coresMembroAtribuidas[id] = CORES_MEMBRO[i]; });
}

export function corDoMembro(userId) {
  if (!userId) return '#6B7A6D';
  if (coresMembroAtribuidas[userId]) return coresMembroAtribuidas[userId];
  let n = 0;
  for (let i = 0; i < String(userId).length; i++) n = (n + String(userId).charCodeAt(i)) % 997;
  return CORES_MEMBRO[n % CORES_MEMBRO.length];
}

