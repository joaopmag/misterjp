// atleta/CheckinApp.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { T, body, FONTS, TEMA_ATUAL } from '../base/tema';
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { todayStr } from '../base/utilidades';
import { equipaGuardada } from '../base/equipaGuardada';
import { PortalEntrada, tirarPrebusca } from './PortalEntrada';
import { CHECKIN_DAYS_BACK } from './janelas';
import { CheckinKiosk } from './CheckinKiosk';

// Ecrã do questionário (Wellness/RPE) para os atletas, acedido pelo link
// partilhado (?checkin=1) — não passa pelo portão de login do treinador:
// carrega só os dados de que precisa (jogadores, sessões, monitorização) e
// autentica cada atleta pelo código pessoal de 4 dígitos dentro do próprio
// CheckinKiosk.
/* O quiosque NÃO lê tabelas.

   Toda a informação passa por duas funções no Supabase (ver
   checkin_rpc.sql): `checkin_bootstrap` valida o código e devolve só o
   jogador, as sessões recentes e os registos DESSE jogador;
   `checkin_save` grava, verificando no servidor de quem é o registo e se
   o dia está dentro da janela.

   Isto substitui o useCollectionSync sobre `players`, `sessions` e
   `monitoring`, que obrigava a ter políticas `anon` de leitura sobre
   essas tabelas — e portanto punha o plantel inteiro e os dados de saúde
   de todos os atletas ao alcance de quem extraísse a chave pública do
   site. O código de 4 dígitos deixa de ser um filtro no browser e passa
   a ser uma credencial verificada na base de dados. */
/* O PORTAL COMO APP NO TELEMÓVEL. Só nas páginas do Portal (não na
   plataforma do staff): liga o manifesto e o ícone, guarda o evento de
   instalação do Chrome e regista um service worker mínimo (só passa os
   pedidos à rede — não guarda nada em cache).
   DOIS MUNDOS:
   · Chrome/Edge (Android e computador): recebem o manifesto, que tem de
     ter start_url para o navegador oferecer "Instalar" direto. O ícone
     abre "/?origem=portal-icone" e aqui redireciona-se para o Portal da
     última equipa (a app instalada partilha a memória com o navegador).
   · iPhone/iPad: NÃO recebem o manifesto — o Safari usaria o start_url e
     o ícone (com memória separada do Safari) não saberia qual é o Portal.
     Sem manifesto, o iOS guarda o endereço exato da página (?portal=…).  Os ficheiros manifest.webmanifest,
   icone-192.png, icone-512.png, apple-touch-icon.png e sw.js vivem na
   pasta public/ do projeto. */
export const PORTAL_ULTIMO = 'mjp-portal-ultimo';

(function prepararPortalInstalavel() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  try {
    /* DUAS APPS NO MESMO ENDEREÇO. O Portal do Atleta vive em /portal/ e a
       plataforma do staff em /. Cada uma tem o seu manifesto, com o seu
       "scope": assim o Chrome trata-as como duas apps diferentes, e o
       "Abrir na app" da plataforma deixa de abrir a janela do Portal.
       Links antigos (/?portal=…, já partilhados e impressos) continuam a
       funcionar: passam para /portal/?portal=… sem recarregar. */
    const naPastaPortal = /^\/portal(\/|$)/.test(window.location.pathname);
    let q = new URLSearchParams(window.location.search);
    if (q.get('origem') === 'portal-icone' && !q.has('portal')) {
      const ultimo = localStorage.getItem(PORTAL_ULTIMO);
      /* Antes fazia-se location.replace: a página carregava DUAS vezes e,
         entre uma e outra, aparecia por instantes o ecrã da plataforma do
         staff. Agora só se reescreve o endereço, sem recarregar: isto corre
         antes de a app desenhar o primeiro ecrã, por isso ela já arranca
         diretamente no Portal. */
      if (ultimo) {
        window.history.replaceState(null, '', `/portal/?portal=${encodeURIComponent(ultimo)}`);
        q = new URLSearchParams(window.location.search);
      }
    }
    const ehPortal = naPastaPortal || q.has('portal') || q.has('checkin') || /portal=|checkin/.test(window.location.hash);
    const ehAppleCedo = /iphone|ipad|ipod/i.test(navigator.userAgent || '') || (/macintosh/i.test(navigator.userAgent || '') && navigator.maxTouchPoints > 1);
    if (!ehPortal) {
      /* A PLATAFORMA VIVE EM /app/. No telemóvel (Android), uma app com
         scope "/" engolia o Portal (que está dentro de "/"): instalar uma
         dava "já instalada" na outra e abria sempre a última usada. Com
         /app/ e /portal/ separados, cada uma é dona só do seu caminho.
         Só se muda a plataforma em si (endereço sem "?…"): as páginas
         públicas de partilha (?clipe=, ?video=, ?junto=…) e os regressos
         do login ficam como estão. */
      const naPastaApp = /^\/app(\/|$)/.test(window.location.pathname);
      if (!naPastaApp && !window.location.search) {
        window.history.replaceState(null, '', `/app/${window.location.hash}`);
      }
      // Plataforma do staff: o seu próprio manifesto ("MisterJP", scope /app/),
      // para se poder instalar à parte do Portal.
      if (!ehAppleCedo && !document.querySelector('link[rel="manifest"]')) {
        const m = document.createElement('link');
        m.setAttribute('rel', 'manifest'); m.setAttribute('href', '/staff.webmanifest');
        document.head.appendChild(m);
      }
      // O Chrome só oferece "Instalar" com um service worker a controlar a
      // página. O do Portal está limitado a /portal/, por isso a plataforma
      // regista o seu (o mesmo sw.js, que só passa os pedidos à rede).
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/app/' }).catch(() => { /* sem service worker: continua tudo a funcionar */ });
      return;
    }
    if (!naPastaPortal) {
      window.history.replaceState(null, '', `/portal/${window.location.search}${window.location.hash}`);
    }
    // Fundo verde desde o primeiro instante: sem clarão branco no arranque e
    // sem faixa branca à direita (o espaço reservado à barra de scroll fica
    // da mesma cor do resto, enquanto os ecrãs ainda carregam).
    const estiloBase = document.createElement('style');
    estiloBase.textContent = `html, body { background: ${T.bg} !important; }`;
    document.head.appendChild(estiloBase);
    const junta = (tag, attrs) => {
      const el = document.createElement(tag);
      Object.keys(attrs).forEach(k => el.setAttribute(k, attrs[k]));
      document.head.appendChild(el);
    };
    const ehApple = /iphone|ipad|ipod/i.test(navigator.userAgent || '') || (/macintosh/i.test(navigator.userAgent || '') && navigator.maxTouchPoints > 1);
    if (!ehApple && !document.querySelector('link[rel="manifest"]')) junta('link', { rel: 'manifest', href: '/portal.webmanifest' });
    // A página da raiz traz o ícone da plataforma: no Portal troca-se pelo do Portal.
    document.querySelectorAll('link[rel="apple-touch-icon"], link[rel="icon"]').forEach(l => l.remove());
    junta('link', { rel: 'icon', type: 'image/png', href: '/icone-192.png' });
    junta('link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' });
    junta('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
    junta('meta', { name: 'mobile-web-app-capable', content: 'yes' });
    junta('meta', { name: 'apple-mobile-web-app-title', content: 'Portal' });
    junta('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' });
    junta('meta', { name: 'theme-color', content: '#182619' });
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      window.__mjpInstalar = e;
      window.dispatchEvent(new Event('mjp-instalavel'));
    });
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/portal/' }).catch(() => { /* sem service worker: continua tudo a funcionar */ });
  } catch (e) { /* nada disto é essencial */ }
})();

export function CheckinApp() {
  const [codigo, setCodigo] = useState(null);
  const [dados, setDados] = useState(null); // { player, sessions, monitoring }
  const [erro, setErro] = useState('');

  /* A EQUIPA VEM NO LINK.

     O código de 4 dígitos só é único dentro de um plantel — nunca foi um
     identificador do mundo inteiro, apesar de estar a ser usado como tal.
     Com clubes diferentes na mesma base, dois acabam com o mesmo código e
     um atleta abriria o questionário de um miúdo de outro clube.

     Cada equipa tem por isso o seu link, com `&e=<id>`. Links antigos, já
     partilhados, vêm sem ele: nesse caso o servidor ainda procura o
     código em todo o lado, mas RECUSA se encontrar mais do que um. Quem
     já tem o link continua a responder; ninguém cai no clube errado. */
  /* A identidade visível da equipa (nome do clube e logótipo), lida a
     partir do id que vem no link. Não é informação sensível — quem tem o
     link já sabe de que clube é — mas a tabela `teams` não é legível sem
     sessão, por isso passa por uma função própria no servidor. */
  const [equipaRemota, setEquipa] = useState(null);

  const equipaDoLink = (() => {
    if (typeof window === 'undefined') return null;
    try {
      // Link novo: ?portal=<id-da-equipa> — o próprio valor já é o id,
      // não precisa de um "e=" à parte.
      // Um segundo "?" colado ao link (ex.: "?portal=ID?testejogo=dia")
      // estragava o id da equipa: corta-se no primeiro "?" ou "&".
      const p = (new URLSearchParams(window.location.search).get('portal') || '').split(/[?&#]/)[0];
      if (p) return p;
      // Link antigo (?checkin=1&e=<id-da-equipa>) — continua a funcionar,
      // para não partir nada que já tenha sido partilhado.
      const q = new URLSearchParams(window.location.search).get('e');
      if (q) return q;
      // Também se aceita no fragmento (#checkin&e=... ou #portal=...),
      // porque é assim que alguns clientes de email reescrevem os
      // endereços.
      const h = window.location.hash.replace('#', '');
      const mPortal = h.match(/(?:^|&)portal=([^&?]+)/);
      if (mPortal) return mPortal[1];
      const m = h.match(/(?:^|&)e=([^&]+)/);
      return m ? m[1] : null;
    } catch (e) { return null; }
  })();

  /* A resposta é normalizada antes de sair daqui, porque o mesmo `jsonb`
     pode chegar de três formas diferentes conforme a versão do PostgREST
     e do SDK: como objeto, como texto por interpretar, ou embrulhado num
     array de uma posição. Aceitar as três aqui evita que o resto do
     quiosque tenha de saber disto. */
  /* EMBLEMA E COR SEM ESPERAR. Pedir a identidade da equipa ao servidor
     demora uns segundos, e até lá a Receção mostrava o escudo provisório e
     depois trocava pelo emblema. Agora o telemóvel guarda a identidade da
     última visita (só o nome, o emblema e a cor — nada pessoal) e o Portal
     abre logo com ela; a resposta do servidor só a atualiza se mudou. */
  const chaveIdentidade = `mjp-equipa:${equipaDoLink || 'sem-equipa'}`;
  const [equipaGuardada] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem(chaveIdentidade) || 'null');
      if (v && v.cor) T.corEquipa = v.cor;
      return v;
    } catch (e) { return null; }
  });
  const equipa = equipaRemota || equipaGuardada;
  useEffect(() => {
    if (!equipaDoLink) return;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('checkin_equipa', { p_team: equipaDoLink });
        if (!error && data) {
          const eq = typeof data === 'string' ? JSON.parse(data) : data;
          // A cor do clube (a mesma das definições da equipa) também no
          // Portal — a camisola dos anos e afins vestem-se dela.
          if (eq && eq.cor) T.corEquipa = eq.cor;
          setEquipa(eq);
          try { localStorage.setItem(chaveIdentidade, JSON.stringify(eq)); } catch (e) { /* sem espaço: fica só nesta visita */ }
          try { localStorage.setItem(PORTAL_ULTIMO, equipaDoLink); } catch (e) { /* idem */ }
        }
      } catch (e) { /* sem identidade, o ecrã fica neutro — não é impeditivo */ }
    })();
  }, [equipaDoLink]); // eslint-disable-line react-hooks/exhaustive-deps

  const buscar = async (code) => {
    const pre = tirarPrebusca('checkin_bootstrap', code, equipaDoLink);
    const { data, error } = pre ? await pre : await supabase.rpc('checkin_bootstrap', {
      p_code: code, p_days: CHECKIN_DAYS_BACK, p_team: equipaDoLink,
    });
    if (error) throw error;

    let d = data;
    if (Array.isArray(d)) d = d[0];
    if (typeof d === 'string') {
      try { d = JSON.parse(d); } catch (e) { /* fica como está e falha a validação abaixo */ }
    }
    if (d === null || d === undefined) return null; // código não existe

    // Se chegou aqui e não tem jogador, a forma é inesperada: não se
    // segue em frente com dados incompletos (era isto que dava ecrã
    // branco, ao tentar ler `player.id` de um `undefined`).
    if (!d || typeof d !== 'object' || !d.player || !d.player.id) {
      const amostra = (() => { try { return JSON.stringify(data).slice(0, 300); } catch (e) { return String(data); } })();
      const err = new Error(`Resposta inesperada do servidor: ${amostra}`);
      err.__forma = true;
      throw err;
    }
    return d;
  };

  const entrar = async (code) => {
    setErro('');
    try {
      const d = await buscar(code);
      if (!d) return false; // código não existe
      // Saiu do clube (Data de saída até hoje): o acesso ao Portal termina.
      if (d.player && d.player.exitDate && d.player.exitDate <= todayStr()) {
        setErro('Este acesso terminou: o jogador já saiu do clube.');
        return 'saiu';
      }
      setCodigo(code);
      setDados(d);
      return true;
    } catch (e) {
      console.error('checkin_bootstrap', e);
      /* "Código ambíguo" é a única mensagem do servidor que o atleta pode
         resolver sozinho — pedindo o link certo. Vale a pena dizê-lo por
         palavras dele, em vez do erro genérico de ligação. */
      const ambiguo = /amb[íi]guo/i.test((e && e.message) || '');
      // Limite de tentativas do servidor (fase 1 da segurança): a mensagem
      // já vem pronta a mostrar ("Demasiadas tentativas. Tenta outra vez…").
      const bloqueado = /tentativas|cart[ãa]o de atleta/i.test((e && e.message) || '');
      setErro(bloqueado
        ? e.message
        : ambiguo
        ? 'Este link não diz de que equipa és. Pede ao treinador o link da tua equipa.'
        : (e && e.__forma
          ? e.message
          : 'Não foi possível ligar. Verifica a internet e tenta outra vez.'));
      return false;
    }
  };

  const sair = () => { setCodigo(null); setDados(null); };

  /* Grava e volta a buscar. O recarregar é de propósito: garante que o
     ecrã mostra o que ficou REALMENTE na base de dados, e não uma versão
     otimista que pode não corresponder (por exemplo se o servidor tiver
     recusado o dia por estar fora da janela). */
  const guardar = async (type, fields, date) => {
    setErro('');
    try {
      const { data: resp, error } = await supabase.rpc('checkin_save', {
        p_code: codigo, p_date: date, p_type: type, p_fields: fields,
        p_days: CHECKIN_DAYS_BACK, p_team: equipaDoLink,
      });
      if (error) throw error;
      // Com o código inválido o servidor já não dá erro (para a tentativa
      // errada ficar registada no limite de tentativas): responde
      // { ok: false }. Isso NÃO é uma gravação — trata-se como falha.
      let r = resp;
      if (Array.isArray(r)) r = r[0];
      if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { /* fica como está */ } }
      if (r && typeof r === 'object' && r.ok === false) throw new Error(r.erro || 'Código inválido');
      const d = await buscar(codigo);
      if (d) setDados(d);
      return true; // confirmação real de que ficou gravado
    } catch (e) {
      console.error('checkin_save', e);
      setErro(/tentativas/i.test((e && e.message) || '')
        ? e.message
        : 'A resposta não ficou guardada. Tenta outra vez ou fala com o staff.');
      return false; // quem chamou (WellnessWizard/RpeWizard/ComposicaoWizard)
      // usa isto para NÃO mostrar "Registado" nem voltar sozinho ao
      // início — sem isto, o atleta via sempre o ecrã de sucesso, quer a
      // gravação tivesse mesmo acontecido quer não.
    }
  };

  const moldura = (conteudo) => (
    <div style={{ background: T.bg, minHeight: '100vh', ...body }}>
      <style>{`
        ${FONTS}
        * { box-sizing: border-box; }
        /* TOQUE NO TELEMÓVEL: sem o retângulo de realce do browser à volta do
           que se toca, e sem o contorno de foco quando se usa o dedo/rato (o
           contorno continua para quem navega com o teclado). */
        * { -webkit-tap-highlight-color: transparent; }
        button, a, [role="button"], summary, label, input[type="checkbox"], input[type="radio"] { touch-action: manipulation; }
        :focus:not(:focus-visible) { outline: none; }
        button:focus:not(:focus-visible), [role="button"]:focus:not(:focus-visible), [tabindex]:focus:not(:focus-visible) { outline: none; }
        svg g[role="button"]:focus { outline: none; }
        ::selection { background: ${T.gold}55; }
        input:focus, select:focus, textarea:focus { border-color: ${T.gold} !important; }
        /* Lista nativa das caixas de escolha (ex.: a nota nas Presenças): sem
           isto, em alguns Windows/Chrome abria BRANCA com o texto claro por
           cima — parecia um "flash" branco vazio. */
        select { color-scheme: ${TEMA_ATUAL === 'claro' ? 'light' : 'dark'}; }
        select option, select optgroup { background-color: ${T.surface}; color: ${T.cream}; } @keyframes mjpEntrar { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
        /* Reserva sempre o espaço da barra de scroll vertical, mesmo
           quando o conteúdo é curto e não precisa dela. Sem isto, uma
           página curta (Portal do Atleta) fica sem barra e uma mais
           comprida (Treino) ganha uma — o conteúdo salta uns pixéis
           para o lado ao trocar de página, porque a largura disponível
           muda. Só afeta desktop (a maioria dos browsers de telemóvel
           já usa uma barra sobreposta, que não ocupa espaço nenhum). */
        html { scrollbar-gutter: stable; }
        /* O espaço da barra fica com a cor da app — nunca uma faixa branca. */
        html, body { background: ${T.bg}; }
      `}</style>
      {erro && (
        <div style={{
          background: T.fundoErro, border: `1px solid ${T.bad}`, color: T.cream,
          fontSize: 13, padding: '10px 14px', textAlign: 'center',
          // O ecrã inicial é fixo (ocupa o ecrã todo): o aviso fica por cima dele.
          position: 'relative', zIndex: 70,
        }}>{erro}</div>
      )}
      {conteudo}
    </div>
  );

  if (!dados) return moldura(
    <>
      <PortalEntrada entrar={entrar} equipa={equipa} teamId={equipaDoLink} />
    </>
  );

  return moldura(
    <CheckinKiosk
      player={dados.player}
      monitoring={dados.monitoring || []}
      sessions={dados.sessions || []}
      diagnostico={{ chavesRecebidas: Object.keys(dados || {}) }}
      onSave={guardar}
      onLogout={sair}
      code={codigo}
      teamId={equipaDoLink}
      equipa={equipa}
    />
  );
}

