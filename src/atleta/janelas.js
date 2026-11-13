// atleta/janelas.js
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { todayStr } from '../base/utilidades';

export const CHECKIN_CODE_MIN = 4; // os códigos antigos ainda são aceites

export function greetingNow() {
  const h = new Date().getHours();
  if (h < 6) return 'Boa noite';
  if (h < 13) return 'Bom dia';
  if (h < 20) return 'Boa tarde';
  return 'Boa noite';
}

// Quantos dias para trás (além de hoje) o atleta vê na tira de dias.
// Os dias anteriores servem só para o atleta ver o que já preencheu —
// desde que existem janelas horárias, responder em atraso deixou de ser
// possível no questionário (ver CHECKIN_WINDOWS).
export const CHECKIN_DAYS_BACK = 6;

// Muda a cada publicação. Aparece nos ecrãs de erro do quiosque: se o que
// se vê no telemóvel não bater certo com o que está aqui, o browser está
// a servir uma versão em cache e não vale a pena procurar o erro no código.
export const APP_BUILD = 'quiosque-rpc-3';

// Com janelas horárias activas, o atleta só responde ao dia de hoje.
// Se algum dia se quiser voltar a permitir preencher em atraso, basta pôr
// esta constante a true (a tira de dias volta a ser clicável).
export const CHECKIN_ALLOW_BACKFILL = false;

/* ---------------------------------------------------------------
   JANELAS HORÁRIAS DO QUESTIONÁRIO DOS ATLETAS

   Wellness: das 08:00 às 13:00 do próprio dia.
   PSE/RPE:  das 13:10 às 23:59 do próprio dia.

   IMPORTANTE: estas janelas aplicam-se APENAS ao questionário que os
   atletas abrem pelo link (?checkin=1). O registo manual feito pelo staff
   em Monitorização não tem qualquer restrição de hora nem de dia — é
   precisamente essa a forma de corrigir/preencher fora de horas.
---------------------------------------------------------------- */
export const CHECKIN_WINDOWS = {
  wellness: { startMin: 6 * 60 + 30, endMin: 13 * 60, label: 'das 06:30 às 13:00' },
  rpe: { startMin: 13 * 60 + 10, endMin: 23 * 60 + 59, label: 'das 13:10 às 23:59' },
};

export function fmtMinutesOfDay(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// Estado da janela para um tipo de questionário num determinado dia.
// Devolve { open, reason } — reason é o texto mostrado ao atleta.
export function checkinWindowState(type, dateStr, now = new Date()) {
  const w = CHECKIN_WINDOWS[type];
  if (!w) return { open: true, reason: '' };
  if (dateStr !== todayStr()) {
    return { open: false, reason: `Só pode ser respondido no próprio dia, ${w.label}` };
  }
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < w.startMin) {
    return { open: false, reason: `Ainda fechado - abre às ${fmtMinutesOfDay(w.startMin)} (${w.label})` };
  }
  if (mins > w.endMin) {
    return { open: false, reason: `Já fechou às ${fmtMinutesOfDay(w.endMin)} — fala com o staff para registar` };
  }
  return { open: true, reason: `Disponível hoje ${w.label}` };
}

