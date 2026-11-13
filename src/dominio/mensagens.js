// dominio/mensagens.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { firstNameOf } from './jogadores';

/* Nome curto "inteligente": só o primeiro nome, e a inicial do apelido
   apenas quando há outro jogador com o mesmo primeiro nome. Evita ter
   "Cadilhe C." quando não há nenhum outro Cadilhe no plantel. */
/* Nome curto que cresce só o necessário para ser único.

   Três níveis, e passa-se ao seguinte apenas se o anterior for ambíguo:

     1. "Pedro"          — se não houver outro Pedro
     2. "Pedro C."       — se houver outro Pedro, mas de apelido diferente
     3. "Pedro Cardoso"  — se houver outro "Pedro C." (Cardoso e Costa)

   O terceiro nível existe porque o segundo não chegava: o plantel tem um
   Pedro Cardoso e um Pedro Costa, e a lista mostrava "Pedro C." duas
   vezes — dois jogadores diferentes com exatamente o mesmo rótulo, que é
   pior do que um nome comprido. */
/* LINK DE WHATSAPP COM MENSAGEM PRONTA — não é envio automático.

   Um envio a sério (sem o treinador ter de tocar em Enviar, um a um)
   precisa da API oficial do WhatsApp Business: conta verificada da
   Meta, mensagens em modelo aprovadas antecipadamente, e um servidor
   próprio a guardar credenciais — nada disto é possível dentro de uma
   app que corre só no browser, sem servidor próprio por trás.

   O que dá para fazer sem nada disso, e que já poupa a maior parte do
   trabalho manual: um link `wa.me` que abre o WhatssApp (app ou web) já
   com o número e a mensagem escritos — só falta tocar em Enviar. É o
   mesmo link que o botão de partilha do WhatsApp usa em qualquer site.

   O campo "Contacto" do jogador é texto livre (pode ter espaços,
   parênteses, o "+" do indicativo, ou nem ser um número de todo) — por
   isso limpa-se para ficar só dígitos e o "+", e só se considera válido
   com pelo menos 8 dígitos. Sem isso, devolve null e quem chamar decide
   o que mostrar (normalmente, nada). */
/* Identifica sempre que é uma mensagem automática do sistema — não uma
   mensagem pessoal do treinador. Importa para o atleta perceber a
   origem (não é o treinador que escreveu isto à mão, é a app), e para
   o treinador não ficar com o nome associado a uma mensagem seca de
   lembrete. Fica no FIM da mensagem, como um rodapé — não tira
   destaque ao pedido em si.

   Sem hora nenhuma na mensagem — o prazo real de cada questionário
   (ver CHECKIN_WINDOWS) é usado só para decidir QUANDO mostrar o
   lembrete (com margem de segurança antes do fecho), não para o
   escrever ao atleta. Dizer uma hora que não é a hora real do fecho
   só confundia; e a hora real muda se um dia se decidir ajustar as
   janelas, sem que seja preciso lembrar de atualizar o texto aqui. */
// Rodapé igual em TODAS as mensagens que a app escreve (Wellness, PSE,
// tarefas), para quem recebe perceber sempre que é o sistema a falar.
export const RODAPE_MENSAGEM_SISTEMA = '\n\n(Mensagem automática enviada pelo sistema de gestão da equipa.)';

export const TEXTO_LEMBRETE_WELLNESS = (p) => (
  `Olá ${firstNameOf(p.name)}! Ainda não respondeste ao questionário de Wellness de hoje. Consegues responder já?${RODAPE_MENSAGEM_SISTEMA}`
);

export const TEXTO_LEMBRETE_PSE = (p) => (
  `Olá ${firstNameOf(p.name)}! Ainda não respondeste ao PSE de hoje. Consegues responder já?${RODAPE_MENSAGEM_SISTEMA}`
);

/* SEM EMOJIS NAS MENSAGENS DE WHATSAPP. Enviados pelo link wa.me a partir
   do computador, os emojis chegavam como "�" (visto na app de WhatsApp
   do computador). Em vez de depender de cada versão do WhatsApp, tiram-se
   todos: dos textos da app e também do que vem de dentro (por exemplo,
   o título "Há aniversário no plantel 🎉"). */
export function semEmojis(texto) {
  return String(texto || '')
    .replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}\uFE0F\u200D\u20E3]/gu, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export function linkWhatsApp(contact, mensagem) {
  if (!contact) return null;
  const limpo = String(contact).replace(/[^\d+]/g, '');
  const digitos = limpo.replace(/\D/g, '');
  if (digitos.length < 8) return null;
  return `https://wa.me/${limpo.replace(/^\+/, '')}?text=${encodeURIComponent(semEmojis(mensagem))}`;
}

