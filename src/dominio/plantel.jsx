// dominio/plantel.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { T } from '../base/tema';

// Ordenação-padrão do plantel: por posição (ordem tática de POSITIONS) e,
// dentro da mesma posição, por número de camisola. Mantida tal como estava
// mesmo depois de o crachá passar a mostrar a posição em vez do número.
/* PELO NÚMERO DA CAMISOLA (1, 2, 3…), para as folhas impressas e
   partilhadas: titulares, suplentes e convocados. Quem não tem número vai
   no fim, por nome. SÓ ORDENA O QUE SE ESCREVE NA FOLHA — não mexe na
   ordem guardada dos convocados, nas estatísticas nem no que o Portal
   mostra. */
export function numeroDaCamisola(p) {
  const n = parseInt(String((p && p.number) ?? '').trim(), 10);
  return Number.isFinite(n) ? n : Infinity;
}

export function ordenarPorCamisola(lista) {
  return [...(lista || [])].sort((a, b) => {
    const d = numeroDaCamisola(a) - numeroDaCamisola(b);
    if (d) return d;
    return String((a && a.name) || '').localeCompare(String((b && b.name) || ''), 'pt');
  });
}

export const LINHAS = (n) => ({
  display: '-webkit-box', WebkitLineClamp: n, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word',
});

/* A pergunta certa nunca é "este jogador está lesionado?" — é "este
   jogador estava lesionado NAQUELE dia?". Uma sessão de 12/08 não pode
   ser afetada por uma lesão que começou a 20/08, e o lançamento é quase
   sempre retroativo. Por isso a data é obrigatória e não tem valor por
   omissão: quem chamar esta função tem de dizer de que dia fala.

   Devolve a ocorrência mais recente que cobre esse dia (`null` = sem
   nada). `fim` vazio significa aberta — ainda a decorrer. */
/* Além da ocorrência clínica em si (`estadoClinicoEm`, que trata uma
   ocorrência sem `fim` como aberta indefinidamente — útil para avisos),
   esta função resolve especificamente a pergunta da tabela de
   Presenças: "este jogador estava indisponível, com regresso PREVISTO,
   naquele dia?" Só conta como automaticamente lesionado enquanto
   houver uma data de regresso prevista — sem ela não há até quando
   preencher, e a marcação continua ao critério de quem regista dia a
   dia. Se entretanto foi dada alta mais cedo (`fim` antes da previsão),
   essa alta manda: o preenchimento automático para nesse dia. */
// Mantém em sincronia os dois interruptores "Visível no Portal" de uma
// convocatória — o do próprio jogo (em `matches`) e o da ficha formal
// (em `convocatorias`, no separador Jogos → Convocatórias).
//
// No sentido jogo → convocatória, quem trata disso é `syncMatchConvocatoria`
// (já corre sempre que um jogo é gravado, e cria a convocatória se ainda
// não existir). Esta função aqui é só para o sentido inverso — tocar no
// olho da convocatória tem de acender/apagar também o interruptor do
// lado do jogo, se houver um jogo correspondente (mesmo adversário +
// data, já que são coleções sem ligação direta entre si).
export function sincronizarVisivelNoJogo(data, adversario, visivel, matches, setMatches) {
  if (!setMatches || !matches) return;
  const alvo = matches.find(m => m.date === data && m.opponent === adversario);
  if (alvo && !!alvo.convocatoriaVisivelAtletas !== visivel) {
    // `prev =>` e não `matches.map(...)`: `matches` aqui é só a cópia que
    // chegou por parâmetro, que pode já não ser a mais recente no
    // preciso instante em que esta gravação se aplica.
    setMatches(prev => prev.map(m => (m.id === alvo.id ? { ...m, convocatoriaVisivelAtletas: visivel } : m)));
  }
}

/* CÓDIGO PESSOAL DO ATLETA.

   Foi de quatro dígitos e passou a seis. A razão não é estética: quem
   tiver o link do quiosque pode tentar códigos à sorte, e com quatro
   dígitos há nove mil hipóteses para um plantel de quase quarenta —
   acerta-se num atleta em poucas dezenas de tentativas. Com seis são um
   milhão, e passam a ser precisas dezenas de milhares de tentativas para
   sequer haver hipótese. É a diferença entre uma fechadura e um adereço.

   Continua numérico de propósito: o quiosque tem um teclado de números,
   que é o certo para um miúdo a responder no telemóvel de manhã. Letras
   obrigariam ao teclado do sistema e a distinguir maiúsculas, zero de O,
   um de I — troca má.

   `Math.random` chega aqui: isto protege um questionário de bem-estar,
   não uma conta bancária, e o atacante teria de adivinhar o código, não
   prever a sequência. */
export const CHECKIN_CODE_LEN = 6;

export function genPlayerCode(usedSet) {
  const min = 10 ** (CHECKIN_CODE_LEN - 1);
  const max = 10 ** CHECKIN_CODE_LEN;
  let code;
  do { code = String(Math.floor(min + Math.random() * (max - min))); } while (usedSet.has(code));
  usedSet.add(code);
  return code;
}

export const CAPTAIN_LABEL = { 1: '1º capitão', 2: '2º capitão', 3: '3º capitão', 4: '4º capitão' };

/* Braçadeira: uma faixa com um "C", como no braço.

   Todos os quatro capitães levam "C" — é o que se vê num jogo e é assim
   que o plantel os reconhece. A hierarquia não se perde: fica na COR
   (dourada para o 1º, mais escura para o 2º, discreta para o 3º e 4º) e
   na dica ao passar o rato, que diz qual é qual. Pôr o número no lugar
   do C dava uma leitura que não corresponde a nada no campo. */
export function CaptainArmband({ rank, size = 16, title }) {
  if (!rank) return null;
  return (
    <span
      title={title || CAPTAIN_LABEL[rank] || 'Capitão'}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size * 0.72, borderRadius: 3, flexShrink: 0,
        background: rank === 1 ? T.goldFundo : (rank === 2 ? '#B08A1E' : T.line),
        color: rank <= 2 ? '#1A1A1A' : T.cream,
        border: `1px solid ${rank <= 2 ? '#8A6F1C' : T.line}`,
        fontSize: size * 0.52, fontWeight: 700, lineHeight: 1,
        fontFamily: "'Oswald', sans-serif",
      }}
    >C</span>
  );
}

