// tarefas/regras.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { addDays, todayStr, fmtShort } from '../base/utilidades';
import { fichaDaEquipa } from '../media/organizacao';
import { isFriendlyMatch } from '../dominio/jogos';
import { jogoNaoJogado, jogosSemEstatisticas } from '../dominio/estadoJogos';
import { notasDoJogo } from '../competicao/RelatoriosJogo';
import { getMonday } from '../treino/Planeamento';
import { semEmojis, RODAPE_MENSAGEM_SISTEMA, linkWhatsApp } from '../dominio/mensagens';
import { firstNameOf, shortPlayerName } from '../dominio/jogadores';
import { MessageCircle, TrendingUp, CalendarDays, Trophy, Lightbulb, Tv, Scissors } from 'lucide-react';
import { isBirthdayToday } from '../dominio/aniversarios';
import { caminhoVerificavel } from './missoesRegras';
import { nomeDoMembro } from '../gestao/membros';

/* Em que grupo cai uma tarefa. Devolve também a ordem, para os grupos
   aparecerem sempre na mesma sequência mesmo quando algum está vazio. */
/* TAREFAS QUE SE REPETEM SOZINHAS.

   Uma tarefa recorrente não tem prazo fixo — tem uma REGRA que diz em
   que dias está ativa. Em vez de o treinador ter de a recriar todos os
   dias (ou lembrar-se de o fazer), a app decide sozinha, todos os dias,
   se ela está "para fazer hoje" — e a conclusão fica marcada só PARA
   ESSE DIA (`concluidasEm`, uma lista de datas), não como um estado
   único e permanente. Assim, no dia seguinte, se a regra voltar a
   estar ativa, a tarefa reaparece automaticamente por fazer — não
   porque alguém a reabriu, mas porque é um dia novo.

   Quatro tipos de regra:
   - "diaria": todos os dias, sem exceção.
   - "semanal": só nos dias da semana escolhidos (0=domingo…6=sábado).
   - "treino_jogo": só nos dias em que há sessão de treino ou jogo
     marcado — nos dias de folga não há nada que a justifique.
   - "wellness_pse": só enquanto houver, neste preciso momento, algum
     jogador por responder ao Wellness de hoje, ou (havendo treino/jogo
     hoje) por responder ao PSE — a mesma verificação já usada para os
     lembretes de WhatsApp em Monitorização. Assim que todos tiverem
     respondido, a tarefa deixa de estar ativa sozinha, sem ninguém ter
     de a marcar como feita.
   - "aniversario": só nos dias em que algum jogador do plantel faz
     anos (dia/mês do `birthdate` a coincidir com hoje). Uma tarefa só
     — "Há aniversário no plantel" — reaparece sozinha todos os anos,
     sem o treinador ter de se lembrar da data de cada jogador. Só
     conta jogadores com dia completo gravado (`isBirthdayToday`
     devolve sempre falso para registos antigos que só têm o ano). */
export const RECORRENCIA_LABEL = {
  diaria: 'Todos os dias',
  semanal: 'Dias da semana',
  treino_jogo: 'Dias de treino ou jogo',
  wellness_pse: 'Enquanto faltar Wellness/PSE',
  aniversario: 'Aniversário de jogador',
  pos_jogo: 'Depois de cada jogo (até estar feito)',
  adversario_semana: 'A meio da semana, antes de jogo oficial (ficha do adversário)',
  vespera_jogo: 'Na véspera de cada jogo (ideias para o jogo)',
};

// Repetições que só fazem sentido para a equipa técnica.
export const RECORRENCIAS_SO_STAFF = ['adversario_semana', 'vespera_jogo'];

/* Caminho que cada uma destas repetições usa por omissão (a missão leva
   logo ao sítio certo e fecha sozinha quando o trabalho aparece). */
export const CAMINHO_DA_RECORRENCIA = { adversario_semana: 'fichaadversario', vespera_jogo: 'ideiasjogo' };

/* Dados que as regras das tarefas precisam e que não vêm no `ctx` de cada
   ecrã (as fichas de adversário e quando foram gravadas). A app atualiza
   isto em cada renderização. */
export const CTX_TAREFAS_EXTRA = { adversarios: [], adversariosMeta: {} };

/* FICHA DO ADVERSÁRIO, A MEIO DA SEMANA — para cada jogo OFICIAL ainda por
   jogar, a missão abre na quarta-feira antes do jogo (jogos de sexta a
   segunda) ou dois dias antes (jogos a meio da semana: terça a quinta) e
   fica até ao dia do jogo. Está feita quando a ficha desse adversário
   (Scouting › Adversários) foi criada ou gravada desde o dia em que a
   missão abriu. */
export function inicioFichaAdversario(dataJogo) {
  const dow = new Date(`${dataJogo}T00:00:00`).getDay();
  if (dow === 2 || dow === 3 || dow === 4) return addDays(dataJogo, -2);
  const recuo = { 5: 2, 6: 3, 0: 4, 1: 5 }[dow];
  return addDays(dataJogo, -recuo);
}

export function fichaAdversarioFeita(m, inicio, ctx) {
  const lista = (ctx && ctx.adversarios) || CTX_TAREFAS_EXTRA.adversarios;
  const metas = (ctx && ctx.adversariosMeta) || CTX_TAREFAS_EXTRA.adversariosMeta;
  const ficha = fichaDaEquipa(m.opponent, lista);
  if (!ficha) return false;
  const meta = metas && metas[ficha.id];
  if (!meta || !meta.at) return false;
  return new Date(meta.at).getTime() >= new Date(`${inicio}T00:00:00`).getTime();
}

export function jogosParaFichaAdversario(matches, dia, ctx) {
  return (matches || [])
    .filter(m => m && m.date && m.opponent && !isFriendlyMatch(m) && !jogoNaoJogado(m))
    .map(m => ({ m, inicio: inicioFichaAdversario(m.date) }))
    .filter(x => x.inicio <= dia && dia <= x.m.date && !fichaAdversarioFeita(x.m, x.inicio, ctx));
}

/* IDEIAS PARA O JOGO, NA VÉSPERA — para cada jogo (oficial ou amigável),
   abre na véspera e fica até ao dia do jogo enquanto o campo "Ideias para
   o jogo" da ficha do jogo estiver vazio. */
export function jogosSemIdeias(matches, dia) {
  return (matches || [])
    .filter(m => m && m.date && !jogoNaoJogado(m) && !String(m.ideias || '').trim())
    .filter(m => addDays(m.date, -1) <= dia && dia <= m.date);
}

/* Jogos já realizados sem nenhuma análise da equipa técnica. Só contam
   os jogos desde uma semana antes de a missão começar (`desde`): os jogos
   antigos, de antes de haver análises, não podem ficar a gerar a missão
   para sempre. */
export function jogosSemAnalise(matches, hoje, desde) {
  const naoJogado = (m) => /cancel|adiad/i.test(String(m.result || ''));
  const inicio = desde ? addDays(desde, -7) : '';
  return (matches || [])
    .filter(m => m && m.date && m.date < hoje && m.date >= inicio && !naoJogado(m))
    .filter(m => !notasDoJogo(m).length)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

// Jogadores do plantel que fazem anos num dado dia (string 'AAAA-MM-DD').
export function aniversariantesEm(players, diaStr) {
  const d = new Date(`${diaStr}T00:00:00`);
  return (players || []).filter(p => isBirthdayToday(p.birthdate, d));
}

export function tarefaAtivaHoje(tarefa, hoje, ctx) {
  const r = tarefa.recorrencia;
  if (!r) return true; // tarefa normal, sem regra — está sempre "ativa" no sentido de aparecer
  // Uma repetição marcada para começar mais à frente ainda não existe.
  if (r.desde && hoje < r.desde) return false;
  if (r.tipo === 'diaria') return true;
  if (r.tipo === 'semanal') return (r.dias || []).includes(new Date(`${hoje}T00:00:00`).getDay());
  if (r.tipo === 'treino_jogo') {
    return (ctx.sessions || []).some(s => s.date === hoje && s.phase !== 'Descanso')
      || (ctx.matches || []).some(m => m.date === hoje);
  }
  if (r.tipo === 'wellness_pse') {
    const haTreinoOuJogoHoje = (ctx.sessions || []).some(s => s.date === hoje && s.phase !== 'Descanso')
      || (ctx.matches || []).some(m => m.date === hoje);
    return (ctx.players || []).some(p => {
      const doJogadorHoje = (ctx.monitoring || []).filter(m => m.playerId === p.id && m.date === hoje);
      const semWellness = !doJogadorHoje.some(m => typeof m.sono === 'number');
      const semPse = haTreinoOuJogoHoje && !doJogadorHoje.some(m => typeof m.pse === 'number');
      return semWellness || semPse;
    });
  }
  if (r.tipo === 'aniversario') {
    return aniversariantesEm(ctx.players, hoje).length > 0;
  }
  if (r.tipo === 'pos_jogo') {
    /* No dia a seguir a cada jogo sem estatísticas e, enquanto faltarem,
       no próprio dia de hoje. Nunca nos dias futuros: antes, o Calendário
       mostrava-a em todos os dias da semana enquanto faltasse um jogo. */
    const hj = todayStr();
    if (hoje > hj) return false;
    /* O que fica "por fazer" depende do caminho da missão: a análise do
       jogo olha para os jogos sem análise; tudo o resto (estatísticas)
       para os jogos sem minutos lançados. */
    const falta = tarefa.caminho === 'analisejogo'
      ? jogosSemAnalise(ctx.matches, hoje, r.desde)
      : jogosSemEstatisticas(ctx.matches, hoje);
    if (hoje === hj) return falta.length > 0;
    return falta.some(m => addDays(m.date, 1) === hoje);
  }
  if (r.tipo === 'adversario_semana') {
    const hj = todayStr();
    // Dias futuros (Calendário): só no dia em que a missão vai abrir.
    if (hoje > hj) {
      return (ctx.matches || []).some(m => m && m.date && m.opponent && !isFriendlyMatch(m) && !jogoNaoJogado(m)
        && inicioFichaAdversario(m.date) === hoje);
    }
    return jogosParaFichaAdversario(ctx.matches, hoje, ctx).length > 0;
  }
  if (r.tipo === 'vespera_jogo') {
    const hj = todayStr();
    if (hoje > hj) return (ctx.matches || []).some(m => m && m.date && !jogoNaoJogado(m) && addDays(m.date, -1) === hoje);
    return jogosSemIdeias(ctx.matches, hoje).length > 0;
  }
  return true;
}

// Concluída HOJE, para uma recorrente — nunca "para sempre" como numa
// tarefa normal, porque amanhã é outro dia e a regra pode voltar a estar
// ativa.
export const tarefaFeitaHoje = (tarefa, hoje) => (tarefa.concluidasEm || []).includes(hoje);

/* TAREFAS SEMANAIS ("Dias da semana") — uma ocorrência por semana.

   As outras repetições vivem só no dia (amanhã é outro dia, e o que
   ficou por fazer simplesmente desaparece). As semanais funcionam como
   uma missão da semana, porque é assim que a equipa técnica as usa
   ("observar o adversário à quinta", "estatísticas à segunda"):

   - Cada semana gera uma OCORRÊNCIA por cada dia escolhido. A ocorrência
     identifica-se pela data que a regra lhe dá (`base`), mesmo que
     depois mude de dia.
   - MUDAR SÓ UMA SEMANA: `recorrencia.mudancas` guarda { base: novoDia }.
     Arrastar no Calendário (ou escolher no formulário) mexe só nessa
     ocorrência; a regra e as outras semanas ficam iguais.
   - A NOTIFICAÇÃO abre no dia em que a ocorrência cai (o novo, se foi
     mudada) e fica aberta até a pessoa concluir, mesmo que o dia passe:
     passa a "Atrasada", não desaparece.
   - CONCLUIR fecha essa ocorrência (`concluidasEm` guarda a `base`). Na
     semana seguinte a próxima abre sozinha, no dia dela.
   - Só conta ocorrências a partir do início da repetição
     (`recorrencia.desde`). As semanais antigas, criadas antes desta
     lógica e sem `desde`, contam só a partir da semana atual, para não
     aparecerem de repente com semanas de atraso acumulado. */
export const eSemanal = (t) => !!(t && t.recorrencia && t.recorrencia.tipo === 'semanal');

export const diaDaSemanaDe = (d) => new Date(`${d}T00:00:00`).getDay();

export function inicioDasSemanais(t, hoje) {
  const r = t.recorrencia || {};
  if (r.desde) return r.desde;
  const segunda = getMonday(hoje);
  const criada = t.criadoEm ? String(t.criadoEm).slice(0, 10) : '';
  return criada > segunda ? criada : segunda;
}

// Ocorrências cuja data-base cai entre `de` e `ate` (inclusive).
export function ocorrenciasSemanais(t, de, ate, hoje) {
  const r = t.recorrencia || {};
  const dias = r.dias || [];
  if (!dias.length) return [];
  const inicio = inicioDasSemanais(t, hoje);
  const mudancas = r.mudancas || {};
  const out = [];
  let d = inicio > de ? inicio : de;
  for (let n = 0; d <= ate && n < 1200; n++, d = addDays(d, 1)) {
    if (dias.includes(diaDaSemanaDe(d))) out.push({ base: d, dia: mudancas[d] || d });
  }
  return out;
}

// As que já abriram (o dia delas chegou) e ainda não foram concluídas,
// da mais antiga para a mais recente.
export function semanaisPendentes(t, hoje) {
  const feitas = t.concluidasEm || [];
  return ocorrenciasSemanais(t, inicioDasSemanais(t, hoje), addDays(hoje, 7), hoje)
    .filter(o => o.dia <= hoje && !feitas.includes(o.base))
    .sort((a, b) => a.dia.localeCompare(b.dia));
}

// A ocorrência desta semana que já abriu e foi concluída (a mais recente).
export function semanalConcluidaEstaSemana(t, hoje) {
  const seg = getMonday(hoje);
  const feitas = t.concluidasEm || [];
  return ocorrenciasSemanais(t, seg, addDays(seg, 6), hoje)
    .filter(o => feitas.includes(o.base))
    .sort((a, b) => b.dia.localeCompare(a.dia))[0] || null;
}

export function grupoDaTarefa(tarefa, hoje) {
  // Uma recorrente não tem prazo — está sempre "para hoje", porque só
  // aparece nos dias em que a regra dela está mesmo ativa (ver
  // `tarefaAtivaHoje`, que já filtra isto antes de chegar aqui).
  if (eSemanal(tarefa)) {
    const p = semanaisPendentes(tarefa, hoje)[0];
    if (p && p.dia < hoje) return { id: 'atraso', rotulo: 'Atrasadas', ordem: 1 };
    return { id: 'hoje', rotulo: 'Hoje', ordem: 2 };
  }
  if (tarefa.recorrencia) return { id: 'hoje', rotulo: 'Hoje', ordem: 2 };
  if (tarefa.estado === 'feita') return { id: 'feitas', rotulo: 'Concluídas', ordem: 9 };
  if (!tarefa.prazo) return { id: 'sem', rotulo: 'Sem prazo', ordem: 5 };
  const dias = Math.round((new Date(`${tarefa.prazo}T00:00:00`) - new Date(`${hoje}T00:00:00`)) / 86400000);
  if (dias < 0) return { id: 'atraso', rotulo: 'Atrasadas', ordem: 1 };
  if (dias === 0) return { id: 'hoje', rotulo: 'Hoje', ordem: 2 };
  if (dias === 1) return { id: 'amanha', rotulo: 'Amanhã', ordem: 3 };
  if (dias <= 7) return { id: 'semana', rotulo: 'Próximos 7 dias', ordem: 4 };
  return { id: 'depois', rotulo: 'Mais tarde', ordem: 6 };
}

/* O texto do prazo, do ponto de vista de hoje. "sábado" diz mais do que
   "30/08" a quem está a preparar o fim de semana. */
export const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function prazoTexto(prazo, hoje) {
  if (!prazo) return '';
  const dias = Math.round((new Date(`${prazo}T00:00:00`) - new Date(`${hoje}T00:00:00`)) / 86400000);
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  if (dias === -1) return 'ontem';
  if (dias < 0) return `há ${Math.abs(dias)} dias`;
  if (dias <= 6) return DIAS_SEMANA[new Date(`${prazo}T00:00:00`).getDay()];
  return fmtShort(prazo);
}

/* AVISAR QUEM CRIOU QUE A TAREFA ESTÁ CONCLUÍDA.

   Quando a tarefa é concluída por alguém que NÃO a criou, fica marcada
   com `conclusaoPorVer` ({ por, em }) e:
   - quem a criou vê-a em "Concluídas por ver" no topo das Tarefas, e ela
     conta no badge, até a abrir ou carregar em "Visto";
   - quem concluiu recebe na barra de baixo o botão "Avisar …", que abre
     o seu WhatsApp com a mensagem escrita (se quem criou tiver telemóvel
     na ficha da equipa). É opcional: o aviso na app chega sempre.
   Só para tarefas normais e semanais. As diárias, as de dias de treino e
   as automáticas (aniversários, Wellness/PSE) avisariam todos os dias e
   virariam ruído. Reabrir a tarefa apaga o aviso. */
export function avisaCriadorAoConcluir(t, euId) {
  return !!(t && t.criadoPor && t.criadoPor !== euId && !t.jogadorId && (!t.recorrencia || eSemanal(t)));
}

export function conclusaoPorVerPara(t, euId) {
  return !!(t && t.conclusaoPorVer && t.criadoPor === euId && t.conclusaoPorVer.por !== euId);
}

export function TEXTO_AVISO_CONCLUSAO(t, membros) {
  const m = (membros || []).find(x => x.user_id === t.criadoPor);
  const primeiro = m && m.nome ? String(m.nome).trim().split(/\s+/)[0] : '';
  return `Olá${primeiro ? ` ${primeiro}` : ''}! A tarefa "${semEmojis(t.titulo)}"${eSemanal(t) ? ' desta semana' : ''} já está concluída.${RODAPE_MENSAGEM_SISTEMA}`;
}

/* QUEM PODE CONCLUIR UMA TAREFA.

   A conclusão é de quem tem de fazer a tarefa: só o RESPONSÁVEL a pode
   marcar como feita (ou reabrir). Exceções, para ninguém ficar refém de
   uma tarefa quando alguém está ausente ou saiu da equipa:
   - quem a criou;
   - o dono da equipa (papel `owner` em team_members);
   - tarefas sem responsável, que continuam abertas a todos;
   - tarefas atribuídas a um JOGADOR, que têm o seu próprio circuito
     (o atleta submete a nota no Portal e o staff revê) e por isso ficam
     como estavam.
   Qualquer outro membro pode LEMBRAR o responsável, incluindo o dono e
   quem criou a tarefa: esses podem concluí-la, mas são precisamente quem
   mais vai querer cobrar. */
export function podeGerirTarefa(t, euId, souDono) {
  if (!t) return false;
  if (t.jogadorId) return true;
  if (!t.responsavel) return true;
  return t.responsavel === euId || t.criadoPor === euId || !!souDono;
}

export function podeConcluirTarefa(t, euId, souDono) {
  if (!t) return false;
  // Com caminho verificável, ninguém conclui à mão: fecha quando há prova.
  if (caminhoVerificavel(t)) return false;
  if (t.jogadorId) return true;
  if (!t.responsavel) return true;
  return t.responsavel === euId || t.criadoPor === euId || !!souDono;
}

/* LEMBRAR. Fica um único lembrete na tarefa ({ de, em, visto }):
   - o responsável vê-o destacado até abrir a tarefa (fica `visto`) ou a
     concluir (é apagado);
   - quem não é responsável vê "Lembrado há 3h" e o botão fica em pausa
     durante 12 horas, para um lembrete não virar insistência. */
export const LEMBRETE_PAUSA_MS = 12 * 60 * 60 * 1000;

/* Lembra-se o responsável da equipa técnica de uma tarefa que não é
   minha. Não se lembra a si próprio, nem numa tarefa sem responsável, nem
   numa tarefa de jogador (essas têm o lembrete próprio do Portal). */
export const podeLembrarTarefa = (t, euId) => !!(t && t.responsavel && t.responsavel !== euId && !t.jogadorId);

/* LEMBRETE POR WHATSAPP. "Lembrar" abre o WhatsApp de quem lembra, já
   com a conversa e a mensagem escritas (link wa.me, ver `linkWhatsApp`):
   só falta tocar em Enviar. Todas as mensagens acabam com o mesmo rodapé
   do Wellness/PSE (`RODAPE_MENSAGEM_SISTEMA`).

   A quem se lembra (ver `alvoDoLembrete`):
   - Numa tarefa de JOGADOR ainda sem nota submetida: o próprio atleta,
     pelo Contacto da ficha dele. Sem contacto válido, não há botão (o
     atleta não tem outra forma de receber o lembrete).
   - Nas outras: o responsável da equipa técnica, se não for eu. Sem
     telemóvel na ficha da equipa, o lembrete fica só dentro da app. */
export const telefoneDoMembro = (userId, membros) => {
  const m = (membros || []).find(x => x.user_id === userId);
  return m && m.telefone ? m.telefone : '';
};

export function quandoDaTarefa(t, hoje) {
  let dia = '';
  if (eSemanal(t)) { const p = semanaisPendentes(t, hoje)[0]; dia = p ? p.dia : ''; }
  else if (!t.recorrencia) dia = t.prazo || '';
  else dia = hoje;
  if (!dia) return '';
  if (dia === hoje) return 'é para hoje';
  if (dia < hoje) return `estava marcada para ${DIAS_SEMANA[diaDaSemanaDe(dia)]}, ${fmtShort(dia)}`;
  return `está marcada para ${prazoTexto(dia, hoje)}`;
}

// "A, B e C"
export const listaComE = (nomes) => (nomes.length <= 1 ? (nomes[0] || '') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`);

/* O texto do lembrete a um colega depende do tipo de tarefa: nas
   automáticas diz-se logo o que interessa (quem faz anos, o que falta
   responder), em vez de repetir um título genérico. */
/* Quem ENVIA agradece no seu próprio género: "Obrigado!" / "Obrigada!".
   Sem género na ficha da equipa, "Obrigado/a!". */
export function agradecimentoDe(userId, membros) {
  const m = (membros || []).find(x => x.user_id === userId);
  if (m && m.genero === 'f') return 'Obrigada!';
  if (m && m.genero === 'm') return 'Obrigado!';
  return 'Obrigado/a!';
}

export function TEXTO_LEMBRETE_TAREFA(t, membros, hoje, players, remetenteId) {
  const nome = (membros || []).find(x => x.user_id === t.responsavel);
  const primeiro = nome && nome.nome ? String(nome.nome).trim().split(/\s+/)[0] : '';
  const ola = `Olá${primeiro ? ` ${primeiro}` : ''}!`;
  const tipo = t.recorrencia && t.recorrencia.tipo;

  if (tipo === 'aniversario') {
    const nomes = aniversariantesEm(players, hoje).map(p => p.name).filter(Boolean);
    if (nomes.length) {
      return `${ola} Hoje ${nomes.length > 1 ? 'são os aniversários de' : 'é o aniversário de'} ${listaComE(nomes)}. `
        + `Não te esqueças de dar os parabéns em nome da equipa e, depois, marca a tarefa como concluída na app.${RODAPE_MENSAGEM_SISTEMA}`;
    }
  }
  if (tipo === 'wellness_pse') {
    return `${ola} Ainda há jogadores por responder ao Wellness ou ao PSE de hoje. `
      + `Consegues enviar-lhes o lembrete em Monitorização?${RODAPE_MENSAGEM_SISTEMA}`;
  }
  const quando = quandoDaTarefa(t, hoje);
  return `${ola} Só para lembrar a tarefa "${semEmojis(t.titulo)}"${quando ? `, que ${quando}` : ''}. `
    + `Quando estiver feita, marca-a como concluída na app da equipa. ${agradecimentoDe(remetenteId, membros)}${RODAPE_MENSAGEM_SISTEMA}`;
}

export function TEXTO_LEMBRETE_TAREFA_JOGADOR(p, t, hoje) {
  const quando = quandoDaTarefa(t, hoje);
  return `Olá ${firstNameOf(p.name)}! Tens uma tarefa por fazer no Portal do Atleta: "${semEmojis(t.titulo)}"${quando ? `, que ${quando}` : ''}. `
    + `Consegues tratar disso?${RODAPE_MENSAGEM_SISTEMA}`;
}

export function alvoDoLembrete(t, euId, membros, players, hoje) {
  if (!t || t._grupo) return null; // num grupo, lembra-se cada um na sua cópia ("Por pessoa")
  if (t.jogadorId) {
    if (t.notaSubmetida || t.estado === 'feita') return null;
    const p = (players || []).find(x => x.id === t.jogadorId);
    if (!p) return null;
    const link = linkWhatsApp(p.contact, TEXTO_LEMBRETE_TAREFA_JOGADOR(p, t, hoje));
    return link ? { tipo: 'jogador', nome: shortPlayerName(p, players), link } : null;
  }
  if (!podeLembrarTarefa(t, euId)) return null;
  return {
    tipo: 'membro',
    nome: nomeDoMembro(t.responsavel, membros, euId),
    link: linkWhatsApp(telefoneDoMembro(t.responsavel, membros), TEXTO_LEMBRETE_TAREFA(t, membros, hoje, players, euId)),
  };
}

export const lembreteRecente = (t) => !!(t && t.lembrete && t.lembrete.em
  && Date.now() - new Date(t.lembrete.em).getTime() < LEMBRETE_PAUSA_MS);

/* MISSÕES — o destino de uma tarefa atribuída a um jogador.
   Em vez de "abrir a tarefa e ver o que é", o jogador recebe a tarefa como
   uma missão em ecrã inteiro com UM botão para o sítio certo (o
   questionário, o treino, a ideia de jogo…). `auto: true` = a missão fecha
   sozinha quando a ação acontece (submeter o questionário, gravar o
   clipe). Nas de leitura (treino, jogo, ideia de jogo, vídeos) não há
   "Já fiz": não há maneira honesta de provar que leu, por isso a missão
   leva-o ao sítio certo e fica registada como ABERTA ("Abriu o treino do
   dia"), que é exatamente o que se sabe. "nota" = responder por escrito. */
export const DESTINOS_MISSAO = [
  { id: 'nota', rotulo: 'Responder por escrito', acao: 'Responder', icon: MessageCircle },
  { id: 'autoavaliacao', rotulo: 'Autoavaliação', acao: 'Fazer a autoavaliação', icon: TrendingUp, auto: true, rota: 'desenvolvimento' },
  { id: 'treino', rotulo: 'Treino do dia', acao: 'Ver o treino de hoje', icon: CalendarDays, rota: 'treino' },
  { id: 'jogos', rotulo: 'Jogo / convocatória', acao: 'Ver o plano de jogo', icon: Trophy, rota: 'jogos' },
  { id: 'ideiaJogo', rotulo: 'Ideia de Jogo', acao: 'Ler a ideia de jogo', icon: Lightbulb, rota: 'ideiaJogo' },
  { id: 'biblioteca', rotulo: 'Sala de Vídeo', acao: 'Ver os vídeos', icon: Tv, rota: 'biblioteca' },
  /* Fecha sozinha quando o jogador grava um clipe em "Os meus clipes":
     é uma prova real de que fez, ao contrário de um "Já fiz". */
  { id: 'clipe', rotulo: 'Criar clipe', acao: 'Criar um clipe', icon: Scissors, auto: true, rota: 'biblioteca' },
];

export const destinoMissao = (id) => DESTINOS_MISSAO.find(d => d.id === id) || DESTINOS_MISSAO[0];

/* LIMITE DE MISSÕES EM ABERTO. Um jogador não tem mais do que duas missões
   por fazer ao mesmo tempo, somando todas as tarefas que lhe estão
   atribuídas. Mais do que isso deixa de ser uma missão e passa a ser uma
   lista de trabalhos de casa. */
export const MAX_MISSOES_ABERTAS = 2;

/* Passos ainda por fazer numa tarefa (a mesma regra do Portal: com vários
   passos, cada um feito fica marcado na nota do atleta como "Passo N ·").
   Tarefa concluída ou submetida já não conta. */
export function missoesPorFazerDe(t) {
  if (!t || !t.jogadorId || t.estado === 'feita' || t.notaSubmetida) return 0;
  const lista = (Array.isArray(t.missoes) && t.missoes.length) ? t.missoes : [{ destino: t.destino || 'nota' }];
  if (lista.length === 1) return 1;
  const nota = String(t.notaAtleta || '');
  return lista.filter((_, k) => !nota.includes(`Passo ${k + 1} ·`)).length;
}

/* "O QUE É PRECISO FAZER" A PARTIR DAS MISSÕES. Ao escolher o tema
   (Autoavaliação, Vídeos…) o título preenche-se sozinho com a ação
   ("Fazer a autoavaliação", "Ver os vídeos"); com duas, junta as duas.
   "Responder por escrito" não dá título: aí é o treinador quem escreve. */
export function tituloDasMissoes(lista) {
  const acoes = (lista || [])
    .map(m => m.destino)
    .filter(id => id && id !== 'nota')
    .map(id => destinoMissao(id).acao);
  if (!acoes.length) return '';
  return acoes.map((a, k) => (k === 0 ? a : a.charAt(0).toLowerCase() + a.slice(1))).join(' e ');
}

/* Sem destino escolhido (tarefas antigas, ou esquecido), deduz-se pelo
   título/notas: "desenvolvimento" ou "autoavaliação" → a autoavaliação;
   "wellness" → o Wellness; etc. Assim uma tarefa "desenvolvimento" leva
   ao questionário, não a um editor de notas. */
export function inferirDestinoMissao(texto) {
  const s = String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/autoavalia|desenvolviment|auto-avalia/.test(s)) return 'autoavaliacao';
  if (/ideia de jogo|ideia\b|principio/.test(s)) return 'ideiaJogo';
  if (/convocat|plano de jogo|\bjogo\b|adversari/.test(s)) return 'jogos';
  if (/treino|sessao/.test(s)) return 'treino';
  if (/clipe|clip\b|cortar|corte/.test(s)) return 'clipe';
  if (/video|analis|sala de video/.test(s)) return 'biblioteca';
  return null;
}

