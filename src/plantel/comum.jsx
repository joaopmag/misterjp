// plantel/comum.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { undoHandler } from '../base/ui';
import { uid } from '../base/utilidades';
import { T, display } from '../base/tema';

/* PSE DE TREINO vs PSE DE JOGO

   A carga de um jogo não é comparável à de um treino: o mesmo 7/10 quer
   dizer coisas diferentes, e misturá-los na mesma média esconde justamente
   o que interessa ver — se a equipa chega ao jogo fresca e se recupera
   depois dele.

   O contexto é gravado no registo (`contexto`), mas os registos antigos não
   o têm. Para esses, deduz-se: se houve jogo nesse dia, o esforço foi de
   jogo. Amigáveis contam como jogo porque são jogos — estão na mesma lista
   de `matches`, não é preciso regra à parte. Uma sessão marcada com a fase
   "Jogo" também conta, para o caso de o jogo não estar lançado em Jogos. */
export function rpeContexto(rec, { matches = [], sessions = [] } = {}) {
  if (rec && (rec.contexto === 'jogo' || rec.contexto === 'treino')) return rec.contexto;
  const d = rec && rec.date;
  if (!d) return 'treino';
  if ((matches || []).some(m => m.date === d)) return 'jogo';
  if ((sessions || []).some(x => x.date === d && x.phase === 'Jogo')) return 'jogo';
  return 'treino';
}

export const RPE_CONTEXTO_LABEL = { treino: 'Treino', jogo: 'Jogo' };

/* A mesma barra, com uma ação extra opcional: um link (por exemplo,
   WhatsApp com a mensagem escrita). É um <a>, não um window.open, para o
   browser o tratar como um toque direto da pessoa e não o bloquear. */
export function offerAviso({ message, onUndo, acao }) {
  if (typeof undoHandler === 'function') undoHandler({ key: uid(), message, onUndo, acao });
}

/* Apaga um item de uma lista sincronizada, com DUAS redes de segurança:
   1) pergunta primeiro, com o nome do registo à frente — para o clique
      acidental no caixote não chegar a apagar nada;
   2) depois de apagado, a barra "Anular" ainda permite repor durante
      alguns segundos, para o caso de a confirmação ter sido dada
      distraidamente.
   `label` é o que aparece nas duas (ex: 'Exercício "1v1 Finalização"').
   `depois` corre só se o utilizador confirmar (ex: fechar o formulário
   aberto desse registo). */
/* APAGAR UM JOGADOR — E TUDO O QUE FICA PARA TRÁS.

   Apagar a linha do `players` deixava o rasto todo na base de dados:
   presenças, notas, minutos, convocatórias, wellness, boletim clínico e
   desenvolvimento. Nada disso volta a aparecer no ecrã — as vistas
   percorrem o plantel, e um id que já não existe não é percorrido —
   portanto o problema é invisível e cresce sozinho.

   São dois problemas, e o segundo é o sério:

   1. As contas ficam erradas. Um jogador apagado continua nos
      `convocados` de vinte jogos, e o denominador de quem sobra muda.

   2. Ficam guardados dados de saúde de um menor que já não está no
      clube. É exatamente o que o RGPD chama a obrigação de eliminação, e
      é o que torna isto mais do que arrumação.

   As dezoito referências estão nesta lista e em mais lado nenhum. Uma
   coleção nova que passe a guardar ids de jogadores tem de ser
   acrescentada AQUI, ou volta o mesmo problema em silêncio. */
export function limparRastoDoJogador({ playerId, sessions, setSessions, matches, setMatches, convocatorias, setConvocatorias, monitoring, setMonitoring, clinico, setClinico, desenvolvimento, setDesenvolvimento, autorizar = {} }) {
  const semId = (arr) => (Array.isArray(arr) ? arr.filter(x => x !== playerId) : arr);
  const semChave = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const copia = { ...obj };
    delete copia[playerId];
    return copia;
  };

  /* Só se grava o que mudou mesmo. Reescrever todas as sessões e todos os
     jogos faria dezenas de gravações por cada jogador apagado — e o
     travão de eliminação em massa está lá precisamente para desconfiar de
     alterações grandes de uma vez. */
  const mudou = (antes, depois) => JSON.stringify(antes) !== JSON.stringify(depois);

  if (setSessions) {
    setSessions(prev => prev.map(s => {
      const novo = {
        ...s,
        attendance: semId(s.attendance),
        faltas: semId(s.faltas),
        lesionados: semId(s.lesionados),
        escalao: semId(s.escalao),
        ratings: semChave(s.ratings),
      };
      return mudou(s, novo) ? novo : s;
    }));
  }

  if (setMatches) {
    setMatches(prev => prev.map(m => {
      const novo = {
        ...m,
        convocados: semId(m.convocados),
        attendance: semId(m.attendance),
        faltas: semId(m.faltas),
        lesionados: semId(m.lesionados),
        escalao: semId(m.escalao),
        starters: semId(m.starters),
        // O alinhamento é posicional: tirar o jogador deixaria os
        // seguintes a escorregar para o lugar errado no campo. Fica o
        // buraco, que é o que aconteceu na realidade.
        alinhamento: Array.isArray(m.alinhamento) ? m.alinhamento.map(x => (x === playerId ? null : x)) : m.alinhamento,
        ratings: semChave(m.ratings),
        report: semChave(m.report),
      };
      return mudou(m, novo) ? novo : m;
    }));
  }

  if (setConvocatorias) {
    setConvocatorias(prev => prev.map(c => {
      const novo = { ...c, convocados: semId(c.convocados) };
      return mudou(c, novo) ? novo : c;
    }));
  }

  /* Estas três são uma linha por registo: apagam-se, não se editam.
     Um jogador tem facilmente dezenas de registos de wellness/PSE, e o
     travão de segurança da gravação (ver useCollectionSync) bloqueia
     apagar 3 ou mais de uma vez. Aqui a remoção é deliberada (o
     treinador confirmou apagar o jogador e TODA a informação dele), por
     isso abre-se a porta para essa gravação — e só quando há mesmo 3 ou
     mais registos a apagar, para a autorização nunca ficar pendurada. */
  const apagarDoJogador = (setter, chave) => {
    if (!setter) return;
    setter(prev => {
      const resto = prev.filter(x => x.playerId !== playerId);
      if (prev.length - resto.length >= 3 && typeof autorizar[chave] === 'function') autorizar[chave]();
      return resto.length === prev.length ? prev : resto;
    });
  };
  apagarDoJogador(setMonitoring, 'monitoring');
  apagarDoJogador(setClinico, 'clinico');
  apagarDoJogador(setDesenvolvimento, 'desenvolvimento');
}

/* Quantos registos é que apagar este jogador vai levar atrás. Serve para
   a confirmação dizer um número em vez de uma vaguidade — "isto apaga 499
   registos de wellness" é uma frase que faz parar quem estava a clicar
   por hábito. */
export function contarRastoDoJogador({ playerId, sessions, matches, convocatorias, monitoring, clinico, desenvolvimento }) {
  const temId = (arr) => Array.isArray(arr) && arr.includes(playerId);
  const temChave = (obj) => !!(obj && typeof obj === 'object' && obj[playerId] !== undefined);

  const dias = (sessions || []).filter(s =>
    temId(s.attendance) || temId(s.faltas) || temId(s.lesionados) || temId(s.escalao) || temChave(s.ratings)).length;
  const jogos = (matches || []).filter(m =>
    temId(m.convocados) || temId(m.attendance) || temId(m.faltas) || temId(m.lesionados)
    || temId(m.escalao) || temId(m.starters) || temChave(m.ratings) || temChave(m.report)).length;

  return {
    dias,
    jogos,
    convocatorias: (convocatorias || []).filter(c => temId(c.convocados)).length,
    wellness: (monitoring || []).filter(m => m.playerId === playerId).length,
    clinico: (clinico || []).filter(o => o.playerId === playerId).length,
    desenvolvimento: (desenvolvimento || []).filter(d => d.playerId === playerId).length,
  };
}

// Calcula a média de bem-estar de um registo de monitorização, usando
// apenas os campos que existirem (compatível com registos antigos, que
// tinham 'hidratação', e novos, que têm 'humor'/'stress' em vez disso).
export function wellnessAvg(rec) {
  if (!rec) return null;
  const keys = ['sono', 'fadiga', 'dor', 'humor', 'stress', 'hidratacao'];
  const vals = keys.map(k => rec[k]).filter(v => typeof v === 'number');
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/* ---------------------------------------------------------------
   SMALL UI PRIMITIVES
---------------------------------------------------------------- */
export function Badge({ number, label }) {
  // `label` tem prioridade: passou a mostrar-se a posição (GR, DC, MOC…)
  // em vez do número de camisola. O número continua suportado para
  // eventuais usos antigos.
  const text = (label ?? number) || '–';
  const long = String(text).length > 2;
  return (
    <div
      style={{
        width: 40, height: 40, borderRadius: '50%',
        background: '#FFFFFF',
        border: `2px solid ${T.gold}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: T.crimson, ...display, fontWeight: 600, fontSize: long ? 12.5 : 15,
        letterSpacing: long ? '-.02em' : 0, flexShrink: 0,
      }}
    >
      {text}
    </div>
  );
}

/* ---------------------------------------------------------------
   DOCUMENTOS — modelos em branco que a app preenche sozinha

   A IDEIA: o clube tem ficheiros próprios (Excel, Word) para preencher
   à mão — e essa informação já está toda na app (presenças, jogos,
   plantel). Em vez de escrever tudo duas vezes, carrega-se o modelo em
   BRANCO uma vez só; sempre que for preciso um preenchido, a app gera-o
   na hora, na memória do browser, e oferece para descarregar. Nada de
   preenchido fica guardado na app — só o modelo original.

   ESTA VERSÃO faz UM preenchimento à medida: a "Ficha Assiduidade" do
   ficheiro modelo "estatística e assiduidade" do SC Salgueiros — 12
   blocos mensais empilhados (Agosto a Julho), cada um com os jogadores
   pela mesma ordem da folha "ESTATÍSTICA TOTAL" e um valor por dia.
   Esse valor é sempre um NÚMERO, nunca uma letra: presente e lesionado
   valem 1; falta e outro escalão valem 0 — é assim que a folha do
   clube soma os totais de cada jogador na própria fórmula do modelo.
   Dá para escolher vários meses de uma vez; saem todos no mesmo
   ficheiro, tal como o modelo já os tem empilhados. Não é um
   preenchedor genérico de qualquer Excel — é talhado a este modelo em
   concreto. Se o clube tiver outros documentos para preencher de forma
   parecida, cada um pede o seu próprio "tradutor" de dados.

   PORQUE NÃO SE USA O SHEETJS PARA REESCREVER O FICHEIRO TODO.

   A primeira versão lia o ficheiro com o SheetJS, mudava os valores, e
   voltava a escrevê-lo do zero com `XLSX.write`. Os valores saíam certos,
   mas as CORES, os BRASÕES e os ESTILOS desapareciam — a versão livre
   do SheetJS não sabe reescrever esses três, só valores e fórmulas.

   A correção: um ficheiro .xlsx é só um .zip com ficheiros XML lá
   dentro — um por folha, mais um de estilos, mais as imagens. Em vez de
   reescrever o ficheiro inteiro, abre-se o .zip, muda-se só o TEXTO das
   células exatas que precisam de mudar dentro do XML da folha certa
   (mantendo o atributo de estilo `s="N"` que já lá estava), e o resto
   do .zip — estilos, imagens, todas as outras folhas — nunca é tocado.
   É por isso que precisa da biblioteca "jszip" (para abrir/fechar o
   .zip) em vez do "xlsx" para esta parte.

   DEPENDÊNCIA NOVA: isto usa a biblioteca "jszip" para abrir e voltar a
   fechar o .xlsx como um .zip. Sem ela instalada no projeto (`npm
   install jszip`), esta função não compila. Já não precisa do "xlsx"
   (SheetJS) — se o tinhas instalado só por causa disto, podes tirá-lo. */

export const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const tdStyle = { padding: '9px 12px', fontSize: 13, color: T.mutedDim };

