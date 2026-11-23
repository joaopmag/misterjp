// atleta/SalaVideo.jsx (19/11): a Sala de Vídeo do Portal, num ficheiro à
// parte (carrega só quando é precisa: o leitor e a biblioteca são a maior
// parte do código do Portal). Movido de vistas.jsx tal como estava.
import React, { useState, useEffect, useRef } from 'react';
import { T, body, display } from '../base/tema';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { MediaLibrary } from '../media/MediaLibrary';
import { preCarregarJuntos } from '../media/LeitorJunto';
import { hashCurto } from './portalRpc';
import { clipeAtletaParaCanal, ERROS_CLIPE_ATLETA, memoriaPortalBib, pedirSala } from './salaDados';
import { criarApiMeusVideos } from './apiMeusVideos';

export function PlayerBibliotecaView({ code, teamId, onBack, onClipeCriado }) {
  /* Miniaturas: as que já estavam carregadas (cache do browser) ficam
     logo visíveis; as outras entram a desvanecer (ver mjp-bib). Rede de
     segurança: ao fim de 2 s mostram-se todas, aconteça o que acontecer. */
  /* (17/11) O vigia fica ligado o tempo todo (antes desligava aos 2 s):
     ao voltar de um jogo, as miniaturas que já estão em cache aparecem logo,
     sem o desvanecer a partir do escuro. */
  const vistasMini = React.useMemo(() => new WeakMap(), []);
  const miniaturaPronta = React.useCallback((im) => {
    if (!im || im.tagName !== 'IMG' || im.classList.contains('mjp-ok')) return;
    const desde = vistasMini.get(im);
    if (desde == null || performance.now() - desde < 250) im.classList.add('mjp-ja');
    im.classList.add('mjp-ok');
  }, [vistasMini]);
  const marcarMiniaturas = React.useCallback((el) => {
    if (!el) return;
    /* (17/11, 2.ª) As que já estão prontas, ou que ficam prontas nos
       primeiros 250 ms, aparecem DE UMA VEZ (classe mjp-ja, sem transição):
       o desvanecer de 0,35 s fazia a grelha abrir cinzenta mesmo com tudo
       em cache. Só as que chegam tarde da rede entram a desvanecer. */
    const ver = () => el.querySelectorAll('img:not(.mjp-ok)').forEach(im => {
      if (!vistasMini.has(im)) vistasMini.set(im, performance.now());
      if (im.complete && im.naturalWidth) im.classList.add('mjp-ja', 'mjp-ok');
    });
    ver();
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(ver) : null;
    if (mo) mo.observe(el, { childList: true, subtree: true });
    setTimeout(() => { el.querySelectorAll('img').forEach(im => im.classList.add('mjp-ok')); }, 2000);
  }, [vistasMini]);
  /* Abre logo com o que se viu da última vez (guardado neste aparelho) —
     antes, "Os meus clipes" e a contagem só apareciam uns segundos depois,
     à espera do servidor. Quando o servidor responde, troca-se. */
  const chaveCacheBib = `misterjp:portal-bib:${teamId}:${hashCurto(String(code || ''))}`;
  const cacheBib = React.useMemo(() => {
    // Primeiro a cópia em memória (vale mesmo com o armazenamento cheio).
    if (memoriaPortalBib.has(chaveCacheBib)) return memoriaPortalBib.get(chaveCacheBib);
    try { return JSON.parse(localStorage.getItem(chaveCacheBib) || 'null') || null; } catch (e) { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [estado, setEstado] = useState(() => (cacheBib ? 'pronto' : 'a-carregar')); // a-carregar | pronto | erro
  const [videos, setVideosState] = useState(() => (cacheBib && Array.isArray(cacheBib.videos) ? cacheBib.videos : []));
  const [meusClipes, setMeusClipes] = useState(() => (cacheBib && Array.isArray(cacheBib.meus) ? cacheBib.meus : []));
  useEffect(() => {
    if (videos.length || meusClipes.length) memoriaPortalBib.set(chaveCacheBib, { videos, meus: meusClipes });
    /* No aparelho só uma cópia LEVE (17/11): sem ficheiros embutidos
       (data:…) e nunca mais de ~400 mil carateres. Uma cópia grande enchia
       o armazenamento e fazia perder a sessão do staff (mesmo endereço). */
    try {
      const leve = (v) => (v && typeof v.dataUrl === 'string' && v.dataUrl.startsWith('data:') ? { ...v, dataUrl: '' } : v);
      const txt = JSON.stringify({ videos: videos.map(leve), meus: meusClipes.map(leve) });
      if (txt.length < 400000) localStorage.setItem(chaveCacheBib, txt); else localStorage.removeItem(chaveCacheBib);
    } catch (e) { /* sem espaço: fica a de memória */ }
  }, [videos, meusClipes, chaveCacheBib]);
  // Se a leitura dos clipes do jogador falhar, diz-se no ecrã (antes
  // falhava em silêncio e os clipes simplesmente não apareciam).
  const [erroMeusClipes, setErroMeusClipes] = useState(false);
  const canalRef = useRef(null);
  // Confirmação depois de gravar um clipe. O Portal não tem a barra de
  // avisos do staff (`UndoBar`), por isso fica aqui.
  const [avisoClipe, setAvisoClipe] = useState(null); // { texto, erro }
  useEffect(() => {
    if (!avisoClipe) return undefined;
    const t = setTimeout(() => setAvisoClipe(null), 5000);
    return () => clearTimeout(t);
  }, [avisoClipe]);

  const lerJson = (data) => {
    let d = data;
    if (Array.isArray(d)) d = d[0];
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { /* fica como está */ } }
    return d;
  };

  useEffect(() => {
    let cancelado = false;
    // Os dois pedidos AO MESMO TEMPO. Se o cacifo já os fez (aquecerSalaVideo),
    // aproveita-se o que já vai a meio em vez de começar do zero.
    const { vids, meus } = pedirSala(code, teamId, true);
    vids.then((lista) => {
      if (cancelado) return;
      // Por ordem de criação, como no Canal (`recentesPrimeiro` inverte).
      setVideosState(lista);
      setEstado('pronto');
    }).catch(() => {
      if (!cancelado) setEstado(prev => (prev === 'pronto' ? prev : 'erro'));
    });
    // Os clipes do próprio jogador vêm à parte. Se falharem, a Sala abre
    // na mesma, só sem eles (e diz-se no ecrã).
    meus.then((lista) => {
      if (cancelado) return;
      setMeusClipes(lista);
      setErroMeusClipes(false);
    }).catch((e) => {
      console.error('checkin_meus_clipes', e);
      if (!cancelado) setErroMeusClipes(true);
    });
    return () => { cancelado = true; };
  }, [code, teamId]);

  // Referência estável: o Canal tem efeitos que dependem da lista.
  const itensPortal = React.useMemo(() => [...videos, ...meusClipes], [videos, meusClipes]);

  const criarClipeAtleta = async ({ videoId, inicio, fim, titulo, nota }) => {
    let resposta;
    try {
      const { data, error } = await supabase.rpc('checkin_clipe_criar', {
        p_code: code, p_team: teamId, p_video_id: videoId,
        p_inicio: inicio, p_fim: fim, p_titulo: titulo, p_nota: nota || '',
      });
      if (error) throw error;
      resposta = lerJson(data);
    } catch (e) {
      throw new Error('Não foi possível ligar. Verifica a internet e tenta outra vez.');
    }
    if (!resposta || !resposta.ok) {
      throw new Error(ERROS_CLIPE_ATLETA[resposta && resposta.erro] || 'O clipe não ficou gravado. Tenta outra vez.');
    }
    if (resposta.clipe) setMeusClipes(prev => [...prev, clipeAtletaParaCanal(resposta.clipe)]);
    setAvisoClipe({ texto: `Clipe "${titulo}" gravado em "Os meus clipes". O treinador já o pode ver.` });
    // Missão "Criar clipe" fecha-se sozinha: a do JOGO deste vídeo, se houver.
    const doVideo = (videos || []).find(v => v.id === videoId) || {};
    const jogoDoClipe = doVideo.jogoId || (resposta.clipe && resposta.clipe.jogoId) || null;
    if (onClipeCriado) onClipeCriado(titulo, jogoDoClipe);
  };

  /* OS MEUS VÍDEOS no servidor: a API vive em salaDados.js (também a usa o
     acesso depois da saída, VideosAposSaida.jsx). */
  const compilacoesApi = React.useMemo(() => criarApiMeusVideos(code, teamId), [code, teamId]);
  // Os vídeos juntos pedem-se logo ao abrir a Sala do Portal (ver preCarregarJuntos).
  const chaveCompilacoesPortal = `misterjp:compilacoes:${teamId}:${hashCurto(String(code || ''))}`;
  useEffect(() => { if (code && teamId) preCarregarJuntos(chaveCompilacoesPortal, compilacoesApi); }, [chaveCompilacoesPortal, compilacoesApi, code, teamId]);

  // Editar um clipe do próprio jogador (tempos, título e texto).
  const editarClipeAtleta = async ({ clipeId, inicio, fim, titulo, nota }) => {
    let resposta;
    try {
      const { data, error } = await supabase.rpc('checkin_clipe_editar', {
        p_code: code, p_team: teamId, p_clipe_id: clipeId,
        p_inicio: inicio, p_fim: fim, p_titulo: titulo, p_nota: nota || '',
      });
      if (error) throw error;
      resposta = lerJson(data);
    } catch (e) {
      throw new Error('Não foi possível ligar. Verifica a internet e tenta outra vez.');
    }
    if (!resposta || !resposta.ok) {
      throw new Error(ERROS_CLIPE_ATLETA[resposta && resposta.erro] || 'As alterações não ficaram gravadas. Tenta outra vez.');
    }
    if (resposta.clipe) {
      const novo = clipeAtletaParaCanal(resposta.clipe);
      setMeusClipes(prev => prev.map(c => (c.id === novo.id ? novo : c)));
    }
    setAvisoClipe({ texto: `Clipe "${titulo}" atualizado.` });
  };

  // Só apaga clipes do próprio jogador: o servidor volta a confirmar
  // que o clipe é dele antes de apagar.
  const apagarClipeAtleta = async (clipeId) => {
    let resposta;
    try {
      const { data, error } = await supabase.rpc('checkin_clipe_apagar', { p_code: code, p_team: teamId, p_clipe_id: clipeId });
      if (error) throw error;
      resposta = lerJson(data);
    } catch (e) {
      setAvisoClipe({ texto: 'Não foi possível ligar. Verifica a internet e tenta outra vez.', erro: true });
      throw e;
    }
    if (!resposta || !resposta.ok) {
      // Já não existe (apagado pelo treinador, por exemplo): sai da lista na mesma.
      if (resposta && resposta.erro === 'clipe_invalido') {
        setMeusClipes(prev => prev.filter(c => c.id !== clipeId));
        setAvisoClipe({ texto: 'Este clipe já não existia.' });
        return;
      }
      setAvisoClipe({ texto: 'O clipe não foi apagado. Tenta outra vez.', erro: true });
      throw new Error('recusado');
    }
    setMeusClipes(prev => prev.filter(c => c.id !== clipeId));
    setAvisoClipe({ texto: 'Clipe apagado.' });
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 24px 60px' }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
        borderRadius: 8, color: T.cream, padding: '8px 14px', cursor: 'pointer', ...body, fontSize: 13.5, marginBottom: 20,
      }}>
        <ChevronLeft size={15} /> Voltar
      </button>

      <div style={{ ...display, fontSize: 18, color: T.cream, marginBottom: 12 }}>Sala de Vídeo</div>

      {estado === 'a-carregar' && (
        <div className="mjp-carregar" style={{ fontSize: 13, color: T.mutedDim }}>A carregar…</div>
      )}

      {estado === 'erro' && (
        <div style={{ fontSize: 13, color: T.bad }}>Não foi possível carregar. Tenta outra vez ou fala com o staff.</div>
      )}

      {/* O MESMO CANAL do staff (Jogos · Adversários · Temas, cartões por
          jogo, barra do clipe, ecrã inteiro) — em modo só de leitura: sem
          adicionar, editar, mover nem apagar. A única exceção é criar
          clipes nos vídeos de JOGOS (`criarClipeAtleta`), que ficam
          guardados para o jogador e para o staff (Análise de Vídeo ›
          Análise individual em clipes). No Portal, esses clipes ficam
          numa secção própria, "Os meus clipes", a seguir a Temas. */}
      {avisoClipe && (
        <div role="status" style={{
          position: 'fixed', left: '50%', bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', transform: 'translateX(-50%)',
          zIndex: 3000, maxWidth: 'min(520px, 92vw)', padding: '10px 14px', borderRadius: 8, fontSize: 13, color: T.cream,
          background: T.surface, border: `1px solid ${avisoClipe.erro ? T.bad : T.good}`, boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
        }}>{avisoClipe.texto}</div>
      )}

      {estado === 'pronto' && erroMeusClipes && (
        <div style={{ fontSize: 12.5, color: T.bad, marginBottom: 12 }}>
          Não foi possível carregar os teus clipes. Tenta outra vez ou fala com o staff.
        </div>
      )}

      {estado === 'pronto' && (
        <div className="mjp-bib" ref={marcarMiniaturas}
          onLoadCapture={e => miniaturaPronta(e.target)}
          onErrorCapture={e => miniaturaPronta(e.target)}>
        <MediaLibrary
          ref={canalRef}
          items={itensPortal}
          setItems={() => {}}
          semBotaoTopo
          recentesPrimeiro
          modoCanal
          soLeitura
          criarClipeAtleta={criarClipeAtleta}
          apagarClipeAtleta={apagarClipeAtleta}
          editarClipeAtleta={editarClipeAtleta}
          chaveCompilacoes={chaveCompilacoesPortal}
          compilacoesApi={compilacoesApi}
          emptyText="Ainda não há nada partilhado aqui. Fala com o treinador se achas que devia haver."
        />
        </div>
      )}
    </div>
  );
}


export default PlayerBibliotecaView;
