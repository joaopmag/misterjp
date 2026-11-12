// base/tema.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { Moon, Sun } from 'lucide-react';

/* ---------------------------------------------------------------
   TOKENS — Relvado Multi-acento: dark pitch-green theme with
   Salgueiros crimson as primary accent and blue/gold/purple
   accents borrowed from the alternative jersey graffiti print.
---------------------------------------------------------------- */
export const T = {
  bg: '#182619',
  surface: '#202F22',
  surfaceRaise: '#2B402D',
  line: '#3A4F3D',
  crimson: '#A6192E',
  crimsonBright: '#D14056',
  gold: '#C9A227',
  goldSoft: '#8A6F1C',
  cream: '#ECEFEA',
  muted: '#8FA091',
  mutedDim: '#6B7A6D',
  good: '#4CA86B',
  warn: '#D9A72E',
  bad: '#C25A5A',
  teamA: '#B5393F',
  teamB: '#3A6FC4',
  teamC: '#D9A72E',
  teamD: '#8C3F9E',
  // A COR DA PRÓPRIA EQUIPA nos quadros de posições (Simulador, Ficha
  // de Jogo, Estrutura habitual do Adversário) — bolas vermelhas por
  // omissão, mas cada equipa pode escolher a sua em "Gerir equipa".
  // `App` atualiza isto assim que sabe qual é a equipa ativa (ver mais
  // abaixo); os quadros só leem `T.corEquipa`, nunca um vermelho fixo.
  corEquipa: '#B5393F',
  // Dourado de FUNDO (botões e etiquetas com texto escuro por cima): fica
  // igual nos dois temas, ao contrário de `gold`, que no modo claro
  // escurece para se ler como texto.
  goldFundo: '#C9A227',
  // Cores que eram escritas à mão nos ecrãs (fase 2 do modo claro). No
  // escuro têm exatamente o valor de antes; o modo claro troca-as.
  textoForte: '#FFFFFF',     // títulos de painel e nome da equipa
  sobreCream: '#1B241C',     // texto sobre uma etiqueta com fundo `cream`
  sobreVerde: '#0d140e',     // visto (✓) sobre `good`
  fundoErro: '#3A1F22',      // faixa de erro
  fundoDica: '#0F1A12',      // balão de valor nos gráficos
  linhaAtiva: '#4A6250',     // contorno de um cartão aberto
  epocaRotulo: '#D9A72E',    // "Época" na faixa vermelha da Visão Geral
  epocaNome: '#ECEFEA',      // nome da época na mesma faixa
  // Fase 3 (Portal do Atleta)
  veuMissao: 'rgba(10,20,12,0.92)',   // fundo de "Missão cumprida"
  brilhoMissao: '#2b3a2e',            // halo do ecrã da missão
  brilhoEntrada: '#33463a',           // halo do ecrã de entrada da equipa
  botaoInativo: '#3a4f3d',            // "Levantar o cartão" antes do código
  botaoInativoTexto: '#8A9A8C',
  sobreBom: '#0E1A0E',                // texto sobre o botão verde
  giz: '#FFFFFF',                     // desenhos que sobem no fundo (Portal, missão, credencial)
};

/* A paleta escura, fixa. Os objetos do Portal que são sempre escuros
   (placard, TV do balneário, porta, estádio do dia de jogo) leem daqui,
   para não mudarem com o modo claro. */
export const T_ESCURO = { ...T };

/* ===================================================================
   MODO CLARO
   ===================================================================
   Três escolhas, guardadas em cada aparelho: Escuro (o de sempre, e o
   que fica por omissão), Claro, e Automático (segue o modo do telemóvel
   ou do computador). O tema aplica-se AQUI, antes de qualquer ecrã ou
   estilo ser calculado, trocando os valores de `T`: assim tudo o que lê
   `T` (a grande maioria da app) muda de uma vez, sem mexer em cada ecrã.
   Ao trocar de tema a página recarrega: é a forma de garantir que os
   estilos calculados no arranque também mudam.
   Fase 2 (plataforma) feita com os tokens no fim de `T`. Fase 3: Portal.
   No Portal, o placard, a TV do balneário e a porta ficam escuros de
   propósito. */
/* O Portal e a plataforma são duas apps: cada uma guarda o seu tema
   (mudar para claro na plataforma não muda o Portal, e vice-versa). */
export const TEMA_CHAVE = (() => {
  try {
    const l = window.location;
    const noPortal = /^\/portal(\/|$)/.test(l.pathname) || /[?&](portal|checkin)=?/.test(l.search) || /portal=|checkin/.test(l.hash);
    return noPortal ? 'mjp-tema-portal' : 'mjp-tema';
  } catch (e) { return 'mjp-tema'; }
})();

export const PALETA_CLARA = {
  bg: '#F2F4EF',
  surface: '#FFFFFF',
  surfaceRaise: '#E7ECE4',
  line: '#C9D3C6',
  crimson: '#A6192E',
  crimsonBright: '#B8243A',
  gold: '#8A6A0E',      // dourado mais escuro: legível sobre fundo claro
  goldSoft: '#B08A1E',
  cream: '#1B2A1D',     // o "texto principal" passa a escuro
  muted: '#4F6352',
  mutedDim: '#5F7062',
  good: '#2E7D4A',
  warn: '#A6750F',
  bad: '#B23A3A',
  textoForte: '#132015',
  sobreCream: '#F2F4EF',
  sobreVerde: '#FFFFFF',
  fundoErro: '#FBE9E9',
  fundoDica: '#FFFFFF',
  linhaAtiva: '#9FB29C',
  epocaRotulo: '#F6D88A',
  epocaNome: '#FFFFFF',
  veuMissao: 'rgba(242,244,239,0.96)',
  brilhoMissao: '#DCE5D7',
  brilhoEntrada: '#D5DFD1',
  botaoInativo: '#DDE3DA',
  botaoInativoTexto: '#6F806F',
  sobreBom: '#FFFFFF',
  giz: '#1B2A1D',
};

export function lerPreferenciaTema() {
  try { const v = localStorage.getItem(TEMA_CHAVE); return v === 'claro' || v === 'auto' ? v : 'escuro'; } catch (e) { return 'escuro'; }
}

export function temaEfetivo(pref) {
  if (pref === 'claro' || pref === 'escuro') return pref;
  try { return window.matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'escuro'; } catch (e) { return 'escuro'; }
}

export const TEMA_ATUAL = typeof window !== 'undefined' ? temaEfetivo(lerPreferenciaTema()) : 'escuro';

if (TEMA_ATUAL === 'claro') {
  Object.assign(T, PALETA_CLARA);
  try {
    // O index.html arranca verde-escuro (sem flash branco); aqui acerta-se
    // logo para o fundo claro e para os controlos do navegador em claro.
    document.documentElement.style.background = T.bg;
    // O index.html declara `color-scheme: dark` também no body e no #root;
    // sem isto as caixas de seleção e os calendários nativos ficavam pretos.
    const estilo = document.createElement('style');
    estilo.textContent = `html, body, #root { color-scheme: light !important; background: ${T.bg} !important; }`;
    document.head.appendChild(estilo);
    document.documentElement.style.colorScheme = 'light';
    if (document.body) document.body.style.background = T.bg;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', T.bg);
  } catch (e) { /* sem documento: nada a fazer */ }
}

export function mudarTema(pref) {
  try { localStorage.setItem(TEMA_CHAVE, pref); } catch (e) { /* sem memória: fica só nesta visita */ }
  if (temaEfetivo(pref) !== TEMA_ATUAL) window.location.reload();
}

// Um só toque troca entre claro e escuro. Mostra o modo para onde vai:
// lua no claro (passar a escuro), sol no escuro (passar a claro).
// Uma preferência 'auto' antiga continua a valer até o utilizador tocar.
export function trocarTema() { mudarTema(TEMA_ATUAL === 'claro' ? 'escuro' : 'claro'); }

export function IconeTema({ size = 14 }) {
  return TEMA_ATUAL === 'claro' ? <Moon size={size} /> : <Sun size={size} />;
}

export const ROTULO_TROCA_TEMA = TEMA_ATUAL === 'claro' ? 'Mudar para modo escuro' : 'Mudar para modo claro';

/* Text-on-accent color: light text used on the crimson accent
   backgrounds (buttons, active tabs, badges) — dark pitch-green
   theme, so this is now light instead of dark. */
export const TEXT_ON_ACCENT = '#FBF3F0';

/* O EMBLEMA DEIXOU DE VIVER NO CÓDIGO.

   Estavam aqui 70 KB de PNG em base64 com o emblema do SC Salgueiros —
   razoável quando a app era de uma equipa, errado a partir do momento em
   que há outras. O logótipo passou a ser um campo da equipa (`logo`), e
   quem não tiver nenhum não vê emblema, o que é melhor do que ver o de
   outro clube.

   Sai também de cada carregamento da app: eram 70 KB no ficheiro, para
   toda a gente, sempre. */


export const FONTS = "@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');";

export const display = { fontFamily: "'Oswald', sans-serif" };

export const body = { fontFamily: "'Inter', sans-serif" };

export const mono = { fontFamily: "'JetBrains Mono', monospace" };

