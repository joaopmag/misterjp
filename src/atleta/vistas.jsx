// atleta/vistas.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { todayStr, fmtDate } from '../base/utilidades';
import React, { useState, useEffect, useRef } from 'react';
import { ExercisePresentation } from '../treino/ExercisePresentation';
import { T, body, display, TEXT_ON_ACCENT, mono } from '../base/tema';
import { ChevronLeft, ChevronRight, Loader2, Check, FileText } from 'lucide-react';
import { momentoTexto } from '../dominio/treino';
import { DiagramThumbAnimado } from '../treino/diagramas';
import { MAX_CLIPE_ATLETA_SEG } from '../media/organizacao';
import { supabase } from '../supabaseClient';
import { MediaLibrary } from '../media/MediaLibrary';
import { useIsMobile, EmptyState, Btn, Field, TextArea } from '../base/ui';
import { normalizeStandings, activeCompetitionOf, competitionTable, estiloZona, LegendaZonas } from '../competicao/dados';
import { diRespondido, DI_INDICADORES, DiQuestionario } from '../plantel/Desenvolvimento';
import { useKioskVoltar } from '../base/kiosk';
import { hashCurto, usePortalFetch, usePortalRpc } from './portalRpc';
import { PlayerAdversarioTab, PlayerConvocatoriasTab, PlayerPlanoJogoTab } from './separadoresJogo';
import { splitCompetitionName } from '../base/formatos';
import { apagarMp4DoVideo, pedirMp4DoVideo, urlDoServicoVideo } from '../media/videoJunto';

/* PORTAL DO ATLETA — a "casa" do que o treinador for partilhando.

   Começa só com "Ideia de Jogo", mas é AQUI que entram Vídeos,
   Composição Corporal, etc., à medida que forem sendo construídos —
   cada um como mais um cartão nesta lista, sem mexer no resto do
   quiosque (Wellness/RPE continuam a viver fora do Portal, são
   questionários, não conteúdo para consultar). */
/* TREINO — "Plano do dia", só consulta.

   Mesmo padrão do Ideia de Jogo, mas sem interruptor nenhum para o
   treinador ligar/desligar: é sempre HOJE, e é sempre o que já está
   no Planeamento — não faz sentido curar isto exercício a exercício,
   muda todos os dias sozinho. Em dia de jogo (amigável ou de
   competição) a função nem devolve nada de propósito: não é
   "emparelhamento" de treino nenhum. */
export function PlayerTreinoView({ code, teamId, onBack }) {
  /* O "hoje" tem de ser o do TELEMÓVEL do atleta (p_date), não o do
     servidor — à noite em Portugal ainda mostrava o treino de ontem. */
  const [estado, dadosPlano] = usePortalRpc('checkin_plano_dia', code, teamId, { p_date: todayStr() });
  const sessao = (dadosPlano && dadosPlano.sessao) || null;
  const [aVer, setAVer] = useState(null);

  if (aVer) {
    return (
      <ExercisePresentation
        exercise={{ ...aVer, name: aVer.name || aVer.phase || 'Exercício' }}
        onClose={() => setAVer(null)}
      />
    );
  }

  const eDescanso = sessao && sessao.phase === 'Descanso';
  const exercicios = (sessao && sessao.exercicios) || [];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
        borderRadius: 8, color: T.cream, padding: '8px 14px', cursor: 'pointer', ...body, fontSize: 13.5, marginBottom: 20,
      }}>
        <ChevronLeft size={15} /> Voltar
      </button>

      <div style={{ ...display, fontSize: 20, color: T.cream, marginBottom: 4 }}>Treino</div>
      <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 20 }}>Plano do dia</div>

      {estado === 'a-carregar' && (
        <div className="mjp-carregar" style={{ fontSize: 13, color: T.mutedDim }}>A carregar…</div>
      )}

      {estado === 'erro' && (
        <div style={{ fontSize: 13, color: T.bad }}>Não foi possível carregar. Tenta outra vez ou fala com o staff.</div>
      )}

      {estado === 'pronto' && (
        !sessao ? (
          <div style={{ fontSize: 13, color: T.mutedDim }}>
            Sem treino hoje — ou é dia de jogo, ou ainda não há nada marcado no plano.
          </div>
        ) : eDescanso ? (
          <div style={{ fontSize: 13, color: T.mutedDim }}>Hoje é dia de descanso.</div>
        ) : exercicios.length === 0 ? (
          <div style={{ fontSize: 13, color: T.mutedDim }}>O treino de hoje ainda não tem exercícios marcados.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {exercicios.map((x, i) => (
              <div
                key={x.id || i}
                onClick={() => setAVer(x)}
                // Coluna: o campo vai para o fundo do cartão, para os campos
                // ficarem todos à mesma altura (com títulos de 1 ou 2 linhas).
                style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
              >
                {/* O texto encosta ao campo: o espaço que sobra num cartão com
                    título mais curto fica por cima, e campos e textos ficam
                    todos alinhados entre cartões. */}
                {/* Título em cima, sempre com o espaço de duas linhas (mesmo
                    curto), para os títulos ficarem todos à mesma altura. */}
                <div style={{ color: T.cream, fontWeight: 500, fontSize: 15, lineHeight: 1.35, minHeight: '2.7em', marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{x.name || 'Exercício'}</div>
                <div style={{ marginTop: 'auto' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {x.phase && (
                    <span style={{ display: 'inline-block', fontSize: 11, color: T.warn, background: `${T.crimson}55`, padding: '3px 9px', borderRadius: 12 }}>{momentoTexto(x)}</span>
                  )}
                  {x.duration && (
                    <span style={{ display: 'inline-block', fontSize: 11, color: T.mutedDim, background: T.surfaceRaise, padding: '3px 9px', borderRadius: 12 }}>{x.duration} min</span>
                  )}
                </div>
                {x.description && (
                  <p style={{ color: T.mutedDim, fontSize: 12.5, lineHeight: 1.5, margin: '0 0 8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{x.description}</p>
                )}
                </div>
                {/* Com ▶ no canto para ver a animação ali mesmo, no cartão. */}
                <div style={{ paddingTop: 4 }}>
                  <DiagramThumbAnimado diagram={x.diagram} space={x.space} phase={x.phase} />
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

/* Um clipe gravado por um jogador (tabela `video_clips`, origem
   'atleta') no formato de um corte do Canal — assim aparece dentro do
   cartão do jogo de onde saiu, com a mesma barra do clipe. */
export function clipeAtletaParaCanal(c) {
  return {
    id: c.id,
    title: c.titulo || '(sem título)',
    youtubeId: c.youtubeId || undefined,
    // Clipe sobre um vídeo carregado (ficheiro): o mesmo ficheiro, só o troço.
    ...(!c.youtubeId && c.dataUrl ? { kind: 'video', dataUrl: c.dataUrl, clipNoFicheiro: true } : {}),
    clipInicio: Number(c.clipInicio),
    clipFim: Number(c.clipFim),
    clipOrigemId: c.clipOrigemId || c.videoOrigemId || null,
    clipOrigemTitulo: c.originalTitulo || '',
    jogoId: c.jogoId || null,
    jornada: c.jornada || '',
    categoria: 'jogo',
    pasta: '',
    deAtleta: true,
    notaAtleta: c.note || '',
  };
}

// Mensagens da função `checkin_clipe_criar`, nas palavras do jogador.
export const ERROS_CLIPE_ATLETA = {
  codigo_invalido: 'O teu código já não é válido. Volta a entrar no Portal.',
  equipa_invalida: 'Este link não diz de que equipa és. Pede ao treinador o link da tua equipa.',
  video_invalido: 'Este vídeo já não está disponível para criar clipes.',
  tempos_invalidos: 'Marca o início e o fim do clipe.',
  duracao_invalida: `O clipe tem de ter entre 1 e ${MAX_CLIPE_ATLETA_SEG} segundos.`,
  titulo_obrigatorio: 'Dá um título ao clipe antes de gravar.',
  clipe_invalido: 'Este clipe já não existe (pode ter sido apagado pelo treinador).',
};

export function PlayerBibliotecaView({ code, teamId, onBack, onClipeCriado }) {
  /* Miniaturas: as que já estavam carregadas (cache do browser) ficam
     logo visíveis; as outras entram a desvanecer (ver mjp-bib). Rede de
     segurança: ao fim de 2 s mostram-se todas, aconteça o que acontecer. */
  const marcarMiniaturas = React.useCallback((el) => {
    if (!el) return;
    const ver = () => el.querySelectorAll('img').forEach(im => { if (im.complete) im.classList.add('mjp-ok'); });
    ver();
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(ver) : null;
    if (mo) mo.observe(el, { childList: true, subtree: true });
    setTimeout(() => { el.querySelectorAll('img').forEach(im => im.classList.add('mjp-ok')); if (mo) mo.disconnect(); }, 2000);
  }, []);
  /* Abre logo com o que se viu da última vez (guardado neste aparelho) —
     antes, "Os meus clipes" e a contagem só apareciam uns segundos depois,
     à espera do servidor. Quando o servidor responde, troca-se. */
  const chaveCacheBib = `misterjp:portal-bib:${teamId}:${hashCurto(String(code || ''))}`;
  const cacheBib = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem(chaveCacheBib) || 'null') || null; } catch (e) { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [estado, setEstado] = useState(() => (cacheBib ? 'pronto' : 'a-carregar')); // a-carregar | pronto | erro
  const [videos, setVideosState] = useState(() => (cacheBib && Array.isArray(cacheBib.videos) ? cacheBib.videos : []));
  const [meusClipes, setMeusClipes] = useState(() => (cacheBib && Array.isArray(cacheBib.meus) ? cacheBib.meus : []));
  useEffect(() => {
    try { localStorage.setItem(chaveCacheBib, JSON.stringify({ videos, meus: meusClipes })); } catch (e) { /* sem espaço */ }
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
    // Os dois pedidos AO MESMO TEMPO (antes eram um depois do outro).
    (async () => {
      try {
        const { data, error } = await supabase.rpc('checkin_biblioteca', { p_code: code, p_team: teamId });
        if (cancelado) return;
        if (error) throw error;
        const d = lerJson(data);
        // Por ordem de criação, como no Canal — é o próprio visualizador
        // (`recentesPrimeiro`) que mostra o mais recente primeiro.
        // Os jogos só da Análise (`daAnalise`) não são para o Portal (a função
        // da base também os tira; isto é a segunda barreira).
        setVideosState(((d && d.videos) || []).filter(v => v && !v.daAnalise));
        setEstado('pronto');
      } catch (e) {
        if (!cancelado) setEstado(prev => (prev === 'pronto' ? prev : 'erro'));
      }
    })();
    // Os clipes do próprio jogador vêm à parte. Se falharem (por
    // exemplo, função ainda não criada no Supabase), a Biblioteca
    // continua a abrir na mesma, só sem eles.
    (async () => {
      try {
        const { data, error } = await supabase.rpc('checkin_meus_clipes', { p_code: code, p_team: teamId });
        if (cancelado) return;
        if (error) throw error;
        const d = lerJson(data);
        setMeusClipes(((d && d.clipes) || []).filter(c => c && (c.youtubeId || c.dataUrl)).map(clipeAtletaParaCanal));
        setErroMeusClipes(false);
      } catch (e) {
        console.error('checkin_meus_clipes', e);
        if (!cancelado) setErroMeusClipes(true);
      }
    })();
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

  /* OS MEUS VÍDEOS no servidor (ver os_meus_videos.sql). Cada função
     devolve os dados ou lança um erro; quem chama (CompilacoesAtleta)
     decide o que mostrar. */
  const compilacoesApi = React.useMemo(() => ({
    ler: async () => {
      const { data, error } = await supabase.rpc('checkin_meus_videos', { p_code: code, p_team: teamId });
      if (error) throw error;
      const d = lerJson(data);
      if (!d) throw new Error('codigo_invalido');
      return (d.videos || []).filter(Boolean);
    },
    guardar: async ({ id, nome, ids }) => {
      const { data, error } = await supabase.rpc('checkin_video_guardar', { p_code: code, p_team: teamId, p_id: id || '', p_nome: nome, p_ids: ids });
      if (error) throw error;
      const d = lerJson(data);
      if (!d || !d.ok) throw new Error((d && d.erro) || 'erro');
      return d.video;
    },
    partilhar: async (id) => {
      const { data, error } = await supabase.rpc('checkin_video_partilhar', { p_code: code, p_team: teamId, p_id: id });
      if (error) throw error;
      const d = lerJson(data);
      if (!d || !d.ok) throw new Error((d && d.erro) || 'erro');
      return d.codigo;
    },
    apagar: async (id) => {
      const { data, error } = await supabase.rpc('checkin_video_apagar', { p_code: code, p_team: teamId, p_id: id });
      if (error) throw error;
      const d = lerJson(data);
      if (d && !d.ok && d.erro !== 'video_invalido') throw new Error(d.erro || 'erro');
    },
    /* MP4 feito no servidor (ver media/videoJunto.js). Sem o serviço de
       vídeo configurado, não há: o Descarregar grava no browser. */
    ...(urlDoServicoVideo() ? {
      ficheiros: async () => {
        const { data, error } = await supabase.rpc('checkin_video_ficheiros', { p_code: code, p_team: teamId });
        if (error) throw error;
        const d = lerJson(data);
        if (!d || !d.ok) throw new Error((d && d.erro) || 'erro');
        return (d.videos || []).filter(Boolean);
      },
      prepararMp4: (id) => pedirMp4DoVideo(code, teamId, id),
      apagarMp4: (id) => apagarMp4DoVideo(code, teamId, id),
    } : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [code, teamId]);

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
          onLoadCapture={e => { if (e.target && e.target.tagName === 'IMG') e.target.classList.add('mjp-ok'); }}
          onErrorCapture={e => { if (e.target && e.target.tagName === 'IMG') e.target.classList.add('mjp-ok'); }}>
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
          chaveCompilacoes={`misterjp:compilacoes:${teamId}:${hashCurto(String(code || ''))}`}
          compilacoesApi={compilacoesApi}
          emptyText="Ainda não há nada partilhado aqui. Fala com o treinador se achas que devia haver."
        />
        </div>
      )}
    </div>
  );
}

/* JOGOS, DENTRO DO PORTAL — três separadores independentes:
   Convocatórias, Plano de Jogo, Adversário. Cada um vem de uma função
   própria no servidor (checkin_convocatoria / checkin_plano_jogo /
   checkin_adversario), pela mesma razão de sempre: o atleta nunca lê as
   tabelas diretamente, só o que o treinador marcou como visível. */
export function PlayerJogosHome({ code, teamId, onBack, jogadorId, logo, infoJogo }) {
  const [subTab, setSubTab] = useState('convocatorias');
  const abas = [
    { id: 'convocatorias', label: 'Convocatória' },
    { id: 'planoJogo', label: 'Plano de Jogo' },
    { id: 'adversario', label: 'Adversário' },
  ];
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
        borderRadius: 8, color: T.cream, padding: '8px 14px', cursor: 'pointer', ...body, fontSize: 13.5, marginBottom: 20,
      }}>
        <ChevronLeft size={15} /> Voltar
      </button>

      <div style={{ ...display, fontSize: 18, color: T.cream, marginBottom: 12 }}>Jogo</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {abas.map(a => {
          const on = subTab === a.id;
          return (
            <button key={a.id} onClick={() => setSubTab(a.id)} style={{
              flex: 1, padding: '9px 8px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', ...body,
              background: on ? '#B5393F' : 'transparent', color: on ? TEXT_ON_ACCENT : T.muted,
              border: `1px solid ${on ? '#B5393F' : T.line}`, whiteSpace: 'nowrap', textAlign: 'center',
            }}>{a.label}</button>
          );
        })}
      </div>

      {subTab === 'convocatorias' && <PlayerConvocatoriasTab code={code} teamId={teamId} jogadorId={jogadorId} logo={logo} infoJogo={infoJogo} />}
      {subTab === 'planoJogo' && <PlayerPlanoJogoTab code={code} teamId={teamId} />}
      {subTab === 'adversario' && <PlayerAdversarioTab code={code} teamId={teamId} />}
    </div>
  );
}

/* COMPETIÇÃO, DO LADO DO ATLETA — classificação + jornadas da competição
   (mesma tabela que o staff configura em Jogos › Competições e
   jornadas), mais as PRÓPRIAS estatísticas de competição do atleta.

   Só consulta, nunca edição — tal como o resto do Portal. A função do
   servidor (`checkin_competicao`) já devolve as estatísticas calculadas
   e reduzidas ao próprio atleta: nunca chega ao browser o relatório de
   outro colega, mesmo que ele apareça na mesma lista de convocados —
   foi escolha explícita não comparar atletas entre si aqui, ao
   contrário do "Estatísticas" que o staff vê no separador Jogos, que é
   do plantel todo. */
export function PlayerCompeticaoView({ code, teamId, onBack, foco }) {
  const [estado, dados] = usePortalFetch('checkin_competicao', code, teamId);
  /* Vindo da caixa das chuteiras (cacifo): mostra SÓ as estatísticas do
     jogador — sem a classificação nem as jornadas por cima. */
  const soEstatisticas = foco === 'estatisticas';
  const isNarrow = useIsMobile(560);
  const [viewId, setViewId] = useState(null);
  const [roundIdx, setRoundIdx] = useState(0);

  const { competitions } = normalizeStandings(dados && dados.standings);
  const comp = competitions.find(c => c.id === viewId) || activeCompetitionOf(dados && dados.standings);
  const teams = competitionTable(comp);
  const rounds = (comp && comp.rounds) || [];
  const round = rounds[roundIdx];
  const nossoClube = (dados && dados.clube) || '';
  const est = (dados && dados.estatisticas) || null;

  /* Antes de pintar (useLayoutEffect): abre logo na jornada mais recente.
     Com useEffect via-se primeiro a Jornada 1 e só depois saltava para a
     certa — os nomes das equipas "piscavam". */
  React.useLayoutEffect(() => {
    const hoje = todayStr();
    let melhorIdx = 0, melhorData = null;
    rounds.forEach((r, i) => {
      (r.games || []).forEach(g => {
        if (g.date && g.date <= hoje && (melhorData == null || g.date > melhorData)) { melhorData = g.date; melhorIdx = i; }
      });
    });
    setRoundIdx(melhorIdx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comp && comp.id]);
  React.useLayoutEffect(() => {
    if (roundIdx >= rounds.length && rounds.length > 0) setRoundIdx(rounds.length - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounds.length]);

  const isUs = (t) => {
    if (!nossoClube || !t || !t.name) return false;
    const a = String(t.name).toLowerCase(), b = nossoClube.toLowerCase();
    return a === b || a.includes(b) || b.includes(a);
  };

  const voltar = (
    <button onClick={onBack} style={{
      display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
      borderRadius: 8, color: T.cream, padding: '8px 14px', cursor: 'pointer', ...body, fontSize: 13.5, marginBottom: 20,
    }}>
      <ChevronLeft size={15} /> Voltar
    </button>
  );

  if (estado === 'a-carregar') {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
        {voltar}
        <div className="mjp-carregar" style={{ fontSize: 13, color: T.mutedDim }}>A carregar…</div>
      </div>
    );
  }
  if (estado === 'erro') {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
        {voltar}
        <div style={{ fontSize: 13, color: T.bad }}>Não foi possível carregar. Tenta outra vez ou fala com o staff.</div>
      </div>
    );
  }

  const nome = splitCompetitionName((comp && comp.name) || 'Competição');

  const hasData = teams.length > 0 || rounds.length > 0;

  const dataCurta = (d) => (d
    ? (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : d)
    : '');

  const tileEstat = (value, label, help) => (
    <div title={help} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: isNarrow ? '14px 10px' : '14px 6px', textAlign: 'center' }}>
      <div style={{ ...display, fontSize: 22, color: T.warn, fontWeight: 600, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: T.mutedDim, marginTop: 5, textTransform: 'uppercase', letterSpacing: '.03em' }}>{label}</div>
    </div>
  );

  const blocoEstatisticas = (
    <>
      {!soEstatisticas && (
        <div style={{ fontSize: 11, color: T.warn, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
          As tuas estatísticas na competição
        </div>
      )}
      {!est || est.jogos === 0 ? (
        <EmptyState text="Ainda sem jogos de competição registados." />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isNarrow ? 'repeat(auto-fill, minmax(96px, 1fr))' : 'repeat(9, 1fr)',
          gap: 10,
          maxWidth: isNarrow ? 720 : '100%',
        }}>
          {tileEstat(est.jogos, 'Convocatórias')}
          {tileEstat(est.titular, 'Titular')}
          {tileEstat(est.suplenteUtilizado, 'Suplente uti', 'Jogos em que entrou vindo do banco')}
          {tileEstat(est.minutos, 'Minutos')}
          {tileEstat(est.golos, 'Golos')}
          {tileEstat(est.assistencias, 'Assistências')}
          {tileEstat(est.amarelos, 'Amarelos')}
          {tileEstat(est.vermelhos, 'Vermelhos')}
          {tileEstat(est.notaMedia ?? '—', 'Nota média')}
        </div>
      )}
    </>
  );

  if (soEstatisticas) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
        {voltar}
        <div style={{ ...display, fontSize: 20, color: T.cream, marginBottom: 4 }}>As tuas estatísticas</div>
        <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 20 }}>{nome.title ? `${nome.title}${nome.subtitle ? ` · ${nome.subtitle}` : ''}` : 'Competição'}</div>
        {blocoEstatisticas}
      </div>
    );
  }
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
      {voltar}

      <div style={{ ...display, fontSize: 20, color: T.cream, marginBottom: 4 }}>{nome.title || 'Competição'}</div>
      {nome.subtitle && <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 20 }}>{nome.subtitle}</div>}
      {!nome.subtitle && <div style={{ marginBottom: 20 }} />}

      {competitions.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
          {competitions.map(c => (
            <button key={c.id} type="button" onClick={() => setViewId(c.id)} style={{
              padding: '5px 11px', borderRadius: 16, fontSize: 12, cursor: 'pointer', ...body,
              background: comp && c.id === comp.id ? '#B5393F' : 'transparent',
              color: comp && c.id === comp.id ? TEXT_ON_ACCENT : T.muted,
              border: `1px solid ${comp && c.id === comp.id ? '#B5393F' : T.line}`,
            }}>{c.name || 'Sem nome'}</button>
          ))}
        </div>
      )}

      {!hasData ? (
        <EmptyState text="Ainda sem competição partilhada. Fala com a equipa técnica." />
      ) : (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, marginBottom: 28 }}>
          {rounds.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 10 }}>
                <button onClick={() => setRoundIdx(i => Math.max(0, i - 1))} disabled={roundIdx === 0}
                  style={{ background: 'none', border: 'none', color: roundIdx === 0 ? T.mutedDim : T.cream, cursor: roundIdx === 0 ? 'default' : 'pointer' }}>
                  <ChevronLeft size={18} />
                </button>
                <span style={{ ...display, fontSize: 14, color: T.cream, textTransform: 'uppercase', letterSpacing: '.06em' }}>{round?.label || `Jornada ${roundIdx + 1}`}</span>
                <button onClick={() => setRoundIdx(i => Math.min(rounds.length - 1, i + 1))} disabled={roundIdx === rounds.length - 1}
                  style={{ background: 'none', border: 'none', color: roundIdx === rounds.length - 1 ? T.mutedDim : T.cream, cursor: roundIdx === rounds.length - 1 ? 'default' : 'pointer' }}>
                  <ChevronRight size={18} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(round?.games || []).map((g, i, jogos) => {
                  const mostraData = i === 0 || g.date !== jogos[i - 1].date;
                  const nomeEquipa = (nomeTxt, lado) => {
                    const somosNos = /salgueiros/i.test(nomeTxt || '');
                    return (
                      <span style={{
                        minWidth: 0, textAlign: lado, color: T.cream, opacity: somosNos ? 1 : 0.72, // a nossa equipa: branco e negrito; as outras, um pouco esbatidas
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        fontWeight: somosNos ? 800 : 400,
                      }} title={nomeTxt}>{nomeTxt}</span>
                    );
                  };
                  const confronto = (
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
                      columnGap: 8, width: '100%', maxWidth: 420, margin: '0 auto',
                    }}>
                      {nomeEquipa(g.home, 'right')}
                      <span style={{ ...mono, color: T.gold, flexShrink: 0 }}>{g.score || 'vs'}</span>
                      {nomeEquipa(g.away, 'left')}
                    </div>
                  );
                  return (
                    <div key={g.id || i}>
                      {isNarrow && mostraData && dataCurta(g.date) && (
                        <div style={{ ...mono, fontSize: 11, color: T.mutedDim, textAlign: 'center', margin: '8px 0 2px' }}>
                          {dataCurta(g.date)}
                        </div>
                      )}
                      {isNarrow ? (
                        <div style={{ padding: '6px 10px', fontSize: 13, borderBottom: `1px solid ${T.line}` }}>
                          {confronto}
                        </div>
                      ) : (
                        <div style={{
                          display: 'grid', gridTemplateColumns: '40px 1fr 40px', alignItems: 'center',
                          gap: 10, padding: '6px 10px', fontSize: 13, borderBottom: `1px solid ${T.line}`,
                        }}>
                          <span style={{ ...mono, fontSize: 11, color: T.mutedDim }}>
                            {mostraData ? dataCurta(g.date) : ''}
                          </span>
                          {confronto}
                          <span aria-hidden="true" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {teams.length > 0 && (
            <div className="mjp-scroll-fino" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, tableLayout: 'fixed', minWidth: 460 }}>
                <thead>
                  <tr style={{ color: T.mutedDim, ...mono, fontSize: 11 }}>
                    <th style={{ textAlign: 'left', padding: '4px 6px', width: 30 }}>#</th>
                    <th style={{ textAlign: 'left', padding: '4px 6px' }}>Equipa</th>
                    {['P', 'J', 'V', 'E', 'D', 'GM', 'GS', 'DG'].map(h => (
                      <th key={h} style={{ padding: '4px 6px', width: 34 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t, i) => {
                    const nossa = isUs(t);
                    return (
                      <tr key={t.id} style={{ color: nossa ? T.gold : T.cream, background: nossa ? `${T.crimson}22` : 'transparent', borderTop: `1px solid ${T.line}` }}>
                        <td style={{ padding: '5px 6px 5px 9px', ...mono, ...estiloZona(comp, i, teams.length) }}>{i + 1}</td>
                        <td
                          title={t.name}
                          style={{
                            padding: '5px 6px', fontWeight: nossa ? 600 : 400,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 0,
                          }}
                        >{t.name}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono, fontWeight: 600 }}>{t.P}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono }}>{t.J}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono }}>{t.V}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono }}>{t.E}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono }}>{t.D}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono }}>{t.GM}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono }}>{t.GS}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', ...mono }}>{t.DG > 0 ? `+${t.DG}` : t.DG}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <LegendaZonas comp={comp} />
            </div>
          )}
        </div>
      )}

      {blocoEstatisticas}
    </div>
  );
}

/* DESENVOLVIMENTO, DO LADO DO ATLETA — a autoavaliação do Desenvolvimento
   Individual (as mesmas 30 perguntas, os mesmos 6 blocos, a mesma escala
   1-5, reutilizando o `DiQuestionario` já existente do lado do staff).

   Regras deste ecrã:
   · Mostra sempre o momento de avaliação mais recente que tenha uma linha
     de registo para este atleta (a função do servidor já filtra isso).
   · Cada resposta grava-se sozinha, assim que é dada — nada fica só na
     memória do telemóvel à espera de um "Guardar" no fim.
   · Só depois de as 30 estarem respondidas aparece o botão "Submeter",
     com uma confirmação a avisar que deixa de poder editar.
   · Depois de submetido (`enviado`), fica um ecrã de agradecimento — a
     pergunta não volta a aparecer aqui. Quando o staff cria um NOVO
     momento, esse é que passa a ser "o mais recente com registo", e a
     pergunta volta a aparecer, para esse momento.
   · O bloqueio depois de submetido é IMPOSTO NO SERVIDOR (a função
     `checkin_desenvolvimento_responder` recusa qualquer escrita depois
     de `enviado = true`), não só escondido na interface — para não
     bastar reabrir a página antiga para voltar a editar.

   (REVISTO) RESPONDE-SE DE UMA VEZ E SUBMETE-SE. Antes cada resposta
   gravava-se logo no servidor — o atleta podia sair a meio e ir mudando
   respostas ao longo dos dias (e a equipa técnica via essas mudanças a
   acontecer). Agora:
   · As respostas ficam só no telemóvel até ao "Submeter": nada chega à
     equipa técnica antes disso, e o que chega é a versão final.
   · Não se sai a meio sem aviso: "Voltar"/fechar pergunta "se saíres
     agora, as respostas perdem-se" — ou se continua e submete, ou se
     sai e recomeça do zero noutra altura. Fechar o separador também
     avisa (o browser pergunta).
   · Ao submeter, as 30 respostas vão de uma vez e o momento fica
     fechado (o servidor continua a recusar mudanças depois). */
export function PlayerDesenvolvimentoView({ code, teamId, onBack, onSubmetido }) {
  const [estado, dados] = usePortalFetch('checkin_desenvolvimento', code, teamId);
  const [auto, setAuto] = useState(null);
  const [enviado, setEnviado] = useState(null);
  const [confirmar, setConfirmar] = useState(false);
  const [aSubmeter, setASubmeter] = useState(false);
  const [erro, setErro] = useState('');
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const fecharDepoisRef = useRef(false);

  useEffect(() => {
    if (dados && dados.registoId && auto === null) {
      setAuto(dados.auto || {});
      setEnviado(!!dados.enviado);
    }
  }, [dados, auto]);

  // A meio do questionário (algo respondido, ainda não submetido)?
  const aMeio = !!(auto && !enviado && diRespondido(auto) > 0);
  // Fechar o separador / recarregar a meio: o browser pede confirmação.
  useEffect(() => {
    if (!aMeio) return undefined;
    const aoSair = (e) => { e.preventDefault(); e.returnValue = ''; return ''; };
    window.addEventListener('beforeunload', aoSair);
    return () => window.removeEventListener('beforeunload', aoSair);
  }, [aMeio]);
  /* SUBMETER É SEMPRE DO JOGADOR: responder à última pergunta já não
     submete sozinho. Se tentar FECHAR com tudo respondido, avisa que as
     respostas vão ser submetidas — e, se aceitar, submete e fecha. */
  const completo = !!(auto && !enviado && diRespondido(auto) === DI_INDICADORES.length);
  const [confirmarFechoCompleto, setConfirmarFechoCompleto] = useState(false);
  const tentarSair = () => {
    if (completo) { setConfirmarFechoCompleto(true); return; }
    if (aMeio) setConfirmarSaida(true); else onBack();
  };
  const autoSubmeter = false;
  const confirmarSubmissaoRef = useRef(null);

  const voltar = (
    <button onClick={onBack} style={{
      display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
      borderRadius: 8, color: T.cream, padding: '8px 14px', cursor: 'pointer', ...body, fontSize: 13.5, marginBottom: 20,
    }}>
      <ChevronLeft size={15} /> Voltar
    </button>
  );

  if (estado === 'a-carregar') {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
        {voltar}
        <div className="mjp-carregar" style={{ fontSize: 13, color: T.mutedDim }}>A carregar…</div>
      </div>
    );
  }
  if (estado === 'erro') {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
        {voltar}
        <div style={{ fontSize: 13, color: T.bad }}>Não foi possível carregar. Tenta outra vez ou fala com o staff.</div>
      </div>
    );
  }

  if (!dados || !dados.momento || !dados.registoId) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
        {voltar}
        <EmptyState text="Não há nenhuma autoavaliação aberta para ti neste momento. Se tens uma tarefa de autoavaliação por fazer, avisa a equipa técnica: o teu nome pode não estar no momento de avaliação." />
      </div>
    );
  }

  // Os dados já chegaram (estado === 'pronto'), mas `auto`/`enviado` só
  // ficam preenchidos no efeito a seguir a este render — sem esta
  // guarda, havia um instante em que se tentava mostrar o questionário
  // com `respostas={null}` (0 de 30, tudo por responder) antes de saber
  // que afinal já tinha sido submetido. Era esse instante a mais que se
  // via como um "piscar" ao entrar de novo neste ecrã.
  if (auto === null) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
        {voltar}
        <div className="mjp-carregar" style={{ fontSize: 13, color: T.mutedDim }}>A carregar…</div>
      </div>
    );
  }

  if (enviado) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
        {voltar}
        <EmptyState text="Obrigado! Já respondeste a este momento de avaliação." />
      </div>
    );
  }

  // Só no telemóvel — chega ao servidor tudo junto, no "Submeter".
  const gravarResposta = (indId, valor) => {
    setAuto(prev => ({ ...(prev || {}), [indId]: valor === undefined ? null : valor }));
    setErro('');
  };

  const confirmarSubmissao = async () => {
    setASubmeter(true);
    setErro('');
    setConfirmarFechoCompleto(false);
    try {
      // 1) as respostas todas de uma vez; 2) fecha o momento.
      const r1 = await supabase.rpc('checkin_desenvolvimento_responder', {
        p_code: code, p_team: teamId, p_registo_id: dados.registoId,
        p_auto: auto || {}, p_submeter: false,
      });
      if (r1.error || !(r1.data && r1.data.ok)) throw (r1.error || new Error('recusado'));
      // As respostas vão também no passo que submete: se o servidor
      // gravasse o `p_auto` deste passo por cima, um objeto vazio apagava
      // tudo o que o jogador respondeu.
      const { data, error } = await supabase.rpc('checkin_desenvolvimento_responder', {
        p_code: code, p_team: teamId, p_registo_id: dados.registoId,
        p_auto: auto || {}, p_submeter: true,
      });
      if (error || !(data && data.ok)) throw (error || new Error('recusado'));
      setEnviado(true);
      if (onSubmetido) onSubmetido(); // missão "Autoavaliação" fecha-se sozinha
      setConfirmar(false);
      /* Submetido = feito: volta logo para dentro (o balneário, ou Tarefas
         se veio de lá), com o "Missão cumprida" por cima. Já não fica no
         ecrã do questionário. */
      fecharDepoisRef.current = false;
      onBack();
    } catch (e) {
      setErro('Não foi possível submeter. Tenta outra vez.');
    } finally {
      setASubmeter(false);
    }
  };

  confirmarSubmissaoRef.current = confirmarSubmissao;
  const respondidos = diRespondido(auto);
  const podeSubmeter = respondidos === DI_INDICADORES.length;

  return (
    <>
      <DiQuestionario
        titulo="Autoavaliação"
        subtitulo={dados.momento.nome}
        posicao={dados.posicao}
        respostas={auto}
        permitirNA={false}
        onChange={gravarResposta}
        onClose={tentarSair}
        onSubmeter={() => setConfirmar(true)}
        podeSubmeter={podeSubmeter}
        aSubmeter={aSubmeter}
      />
      {erro && (
        <div style={{
          position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 70,
          background: T.surfaceRaise, border: `1px solid ${T.bad}`, color: T.bad, borderRadius: 8,
          padding: '9px 16px', fontSize: 12.5, ...body,
        }}>{erro}</div>
      )}
      {autoSubmeter && !enviado && (
        <div style={{
          position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 70,
          background: T.surfaceRaise, border: `1px solid ${T.good}`, color: T.good, borderRadius: 8,
          padding: '10px 18px', fontSize: 13, ...body, display: 'flex', alignItems: 'center', gap: 8,
        }}><Loader2 size={14} className="animate-spin" /> Todas respondidas — a submeter…</div>
      )}
      {confirmarFechoCompleto && (
        <div style={{
          position: 'fixed', inset: 0, background: '#000000aa', zIndex: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{ background: T.surfaceRaise, border: `1px solid ${T.line}`, borderRadius: 10, padding: 20, maxWidth: 400, width: '100%' }}>
            <div style={{ ...display, fontSize: 16, color: T.cream, marginBottom: 8 }}>Já respondeste a todas as perguntas</div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 18, lineHeight: 1.5 }}>
              Se fechares agora, as tuas respostas são submetidas e já não as podes alterar.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <Btn variant="ghost" onClick={() => setConfirmarFechoCompleto(false)} disabled={aSubmeter}>Continuar a rever</Btn>
              <Btn onClick={() => { fecharDepoisRef.current = true; confirmarSubmissao(); }} disabled={aSubmeter}>
                <Check size={15} /> {aSubmeter ? 'A submeter…' : 'Submeter e fechar'}
              </Btn>
            </div>
          </div>
        </div>
      )}
      {confirmarSaida && (
        <div style={{
          position: 'fixed', inset: 0, background: '#000000aa', zIndex: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{ background: T.surfaceRaise, border: `1px solid ${T.line}`, borderRadius: 10, padding: 20, maxWidth: 380, width: '100%' }}>
            <div style={{ ...display, fontSize: 16, color: T.cream, marginBottom: 8 }}>Ainda não submeteste</div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 18, lineHeight: 1.5 }}>
              Respondeste a {diRespondido(auto)} de {DI_INDICADORES.length}. As respostas só contam depois de submeteres —
              se saíres agora, perdem-se e tens de começar de novo.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <Btn variant="ghost" onClick={() => { setConfirmarSaida(false); onBack(); }}>Sair e perder</Btn>
              <Btn onClick={() => setConfirmarSaida(false)}>Continuar a responder</Btn>
            </div>
          </div>
        </div>
      )}
      {confirmar && (
        <div style={{
          position: 'fixed', inset: 0, background: '#000000aa', zIndex: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{ background: T.surfaceRaise, border: `1px solid ${T.line}`, borderRadius: 10, padding: 20, maxWidth: 380, width: '100%' }}>
            <div style={{ ...display, fontSize: 16, color: T.cream, marginBottom: 8 }}>Submeter respostas?</div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 18, lineHeight: 1.5 }}>
              Depois de submeteres não podes voltar a editar nenhuma resposta desta autoavaliação.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Btn variant="ghost" onClick={() => setConfirmar(false)} disabled={aSubmeter}>Cancelar</Btn>
              <Btn onClick={confirmarSubmissao} disabled={aSubmeter}>{aSubmeter ? 'A submeter…' : 'Confirmar'}</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* TAREFAS, DO LADO DO ATLETA — as tarefas que a equipa técnica lhe
   atribuiu (campo `jogadorId`, à parte do "Responsável", que é sempre
   alguém do staff). O atleta só consulta e pode escrever uma nota;
   nunca muda o estado, o prazo, nem apaga — isso continua a ser só do
   staff, em Tarefas.

   A lista já vem pronta do `CheckinKiosk` (o mesmo pedido serve para a
   notificação do ecrã inicial e para este ecrã — não faz sentido pedir
   duas vezes a mesma coisa). Aqui só se guarda localmente a nota que
   vai sendo escrita, otimista, e grava-se ao perder o foco do campo. */
export function PlayerTarefasView({ code, teamId, onBack, tarefas, estado, tarefaAbrirId, onTarefaAberta, onNotaGravada, onIrMissao }) {
  const [abertaId, setAbertaId] = useState(null);
  // Gesto de retroceder com uma tarefa aberta: volta à lista das Tarefas.
  useKioskVoltar(!!abertaId, () => setAbertaId(null));
  const [notas, setNotas] = useState({}); // id -> texto local (por cima do que veio do servidor)
  const [aGravar, setAGravar] = useState({});
  const [submetidas, setSubmetidas] = useState({}); // id -> true, depois de submetida nesta sessão
  const [confirmar, setConfirmar] = useState(false);
  const [aSubmeter, setASubmeter] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (tarefaAbrirId) {
      setAbertaId(tarefaAbrirId);
      if (onTarefaAberta) onTarefaAberta();
    }
  }, [tarefaAbrirId]); // eslint-disable-line react-hooks/exhaustive-deps

  const voltar = (label, onClick) => (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${T.line}`,
      borderRadius: 8, color: T.cream, padding: '8px 14px', cursor: 'pointer', ...body, fontSize: 13.5, marginBottom: 20,
    }}>
      <ChevronLeft size={15} /> {label}
    </button>
  );

  if (estado === 'a-carregar') {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
        {voltar('Voltar', onBack)}
        <div className="mjp-carregar" style={{ fontSize: 13, color: T.mutedDim }}>A carregar…</div>
      </div>
    );
  }
  if (estado === 'erro') {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
        {voltar('Voltar', onBack)}
        <div style={{ fontSize: 13, color: T.bad }}>Não foi possível carregar. Tenta outra vez ou fala com o staff.</div>
      </div>
    );
  }

  const lista = tarefas || [];
  const aberta = lista.find(t => t.id === abertaId);

  const gravarNota = async (tarefaId, texto) => {
    setAGravar(prev => ({ ...prev, [tarefaId]: true }));
    setErro('');
    try {
      const { data, error } = await supabase.rpc('checkin_tarefa_nota', {
        p_code: code, p_team: teamId, p_tarefa_id: tarefaId, p_nota: texto, p_submeter: false,
      });
      if (error || !(data && data.ok)) throw (error || new Error('recusado'));
      // Sem isto, sair de Tarefas e voltar a entrar mostrava outra vez a
      // nota antiga — o pedido ao servidor só acontece uma vez, quando o
      // quiosque abre, e não se repete sozinho.
      if (onNotaGravada) onNotaGravada(tarefaId, { notaAtleta: texto });
    } catch (e) {
      setErro('A nota não ficou guardada. Tenta outra vez.');
    } finally {
      setAGravar(prev => ({ ...prev, [tarefaId]: false }));
    }
  };

  if (aberta) {
    const notaAtual = notas[aberta.id] !== undefined ? notas[aberta.id] : (aberta.notaAtleta || '');
    const submetida = submetidas[aberta.id] !== undefined ? submetidas[aberta.id] : !!aberta.notaSubmetida;
    const podeSubmeter = notaAtual.trim().length > 0;

    const confirmarSubmissao = async () => {
      setASubmeter(true);
      setErro('');
      try {
        const { data, error } = await supabase.rpc('checkin_tarefa_nota', {
          p_code: code, p_team: teamId, p_tarefa_id: aberta.id, p_nota: notaAtual, p_submeter: true,
        });
        if (error || !(data && data.ok)) throw (error || new Error('recusado'));
        setSubmetidas(prev => ({ ...prev, [aberta.id]: true }));
        if (onNotaGravada) onNotaGravada(aberta.id, { notaAtleta: notaAtual, notaSubmetida: true });
        setConfirmar(false);
      } catch (e) {
        setErro('Não foi possível submeter. Tenta outra vez.');
      } finally {
        setASubmeter(false);
      }
    };

    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '28px 24px 60px' }}>
        {voltar('Tarefas', () => setAbertaId(null))}
        <div style={{ ...display, fontSize: 19, color: T.cream, marginBottom: 4 }}>{aberta.titulo}</div>
        {aberta.prazo && (
          <div style={{ fontSize: 12, color: T.mutedDim, marginBottom: 16 }}>
            {submetida ? 'Prazo: ' : 'Tens até '}{fmtDate(aberta.prazo)}{!submetida && ' para submeter a tua nota.'}
          </div>
        )}
        {!aberta.prazo && <div style={{ marginBottom: 16 }} />}

        {aberta.notas && (
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14, marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: T.mutedDim, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
              Notas da equipa técnica
            </div>
            <div style={{ fontSize: 13.5, color: T.cream, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{aberta.notas}</div>
          </div>
        )}

        {submetida ? (
          <>
            <Field label="A tua nota" solto>
              <div style={{
                background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: '10px 12px',
                fontSize: 13.5, color: T.cream, whiteSpace: 'pre-wrap', lineHeight: 1.5, minHeight: 60,
              }}>{notaAtual || '—'}</div>
            </Field>
            <div style={{ fontSize: 11.5, color: T.good, marginTop: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Check size={13} /> Já submetida — não podes voltar a editar.
            </div>
          </>
        ) : (
          <>
            <Field label="A tua nota" solto>
              <TextArea
                value={notaAtual}
                onChange={e => setNotas(prev => ({ ...prev, [aberta.id]: e.target.value }))}
                onBlur={() => gravarNota(aberta.id, notaAtual)}
                placeholder="Escreve aqui o que quiseres dizer sobre esta tarefa."
                style={{ minHeight: 120 }}
              />
            </Field>
            {/* O BOTÃO NÃO PODE FUGIR DO DEDO. Antes, ao carregar em Submeter
                com o cursor ainda no texto, o campo perdia o foco, gravava, e
                a frase de baixo mudava para "A guardar…" (mais curta): os
                botões saltavam de linha a meio do clique, e o clique perdia-se
                (era preciso carregar duas vezes). Agora: a frase tem uma linha
                só para ela, de altura fixa; os botões ficam sempre no mesmo
                sítio; e carregar neles já não tira o foco ao texto (o
                Submeter envia a nota de qualquer forma). */}
            <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 8, minHeight: 34, lineHeight: 1.45 }}>
              {aGravar[aberta.id] ? 'A guardar…' : 'Guarda-se sozinho ao saíres do campo. Podes continuar mais tarde.'}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Btn variant="ghost" onMouseDown={e => e.preventDefault()} onClick={(ev) => { gravarNota(aberta.id, notaAtual); ev.currentTarget.blur(); }} disabled={aGravar[aberta.id]}>
                Guardar
              </Btn>
              <Btn onMouseDown={e => e.preventDefault()} onClick={(ev) => { setConfirmar(true); ev.currentTarget.blur(); }} disabled={!podeSubmeter}>
                <Check size={15} /> Submeter
              </Btn>
            </div>
          </>
        )}
        {erro && <div style={{ fontSize: 12.5, color: T.bad, marginTop: 10 }}>{erro}</div>}

        {confirmar && (
          <div style={{
            position: 'fixed', inset: 0, background: '#000000aa', zIndex: 60,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}>
            <div style={{ background: T.surfaceRaise, border: `1px solid ${T.line}`, borderRadius: 10, padding: 20, maxWidth: 380, width: '100%' }}>
              <div style={{ ...display, fontSize: 16, color: T.cream, marginBottom: 8 }}>Submeter a nota?</div>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 18, lineHeight: 1.5 }}>
                Depois de submeteres não podes voltar a editar esta nota. A equipa técnica vai poder lê-la.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <Btn variant="ghost" onClick={(ev) => { setConfirmar(false); ev.currentTarget.blur(); }} disabled={aSubmeter}>Cancelar</Btn>
                <Btn onClick={confirmarSubmissao} disabled={aSubmeter}>{aSubmeter ? 'A submeter…' : 'Confirmar'}</Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>
      {voltar('Voltar', onBack)}
      <div style={{ ...display, fontSize: 20, color: T.cream, marginBottom: 4 }}>Tarefas</div>
      <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 22 }}>Tarefas que a equipa técnica te atribuiu.</div>

      {lista.length === 0 ? (
        <EmptyState text="Ainda não tens nenhuma tarefa atribuída." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lista.map(t => {
            const feita = t.estado === 'feita';
            return (
              <button key={t.id} onClick={() => {
                // Tarefa com destino (autoavaliação, wellness…): vai direto
                // ao sítio onde se faz, não ao editor de notas.
                if (onIrMissao && t.destino && t.destino !== 'nota' && t.estado !== 'feita' && !t.notaSubmetida) onIrMissao(t);
                else setAbertaId(t.id);
              }} style={{
                display: 'flex', alignItems: 'flex-start', gap: 11, textAlign: 'left', width: '100%',
                padding: '12px 14px', background: T.surface, borderRadius: 10, border: `1px solid ${T.line}`, cursor: 'pointer', ...body,
              }}>
                <span style={{
                  width: 17, height: 17, borderRadius: 5, flexShrink: 0, marginTop: 2,
                  background: feita ? T.good : 'transparent', border: `1.5px solid ${feita ? T.good : T.line}`,
                  display: 'grid', placeItems: 'center',
                }}>{feita && <Check size={11} style={{ color: T.sobreVerde }} />}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: 13.5, color: feita ? T.mutedDim : T.cream, lineHeight: 1.45, display: 'block',
                    textDecoration: feita ? 'line-through' : 'none',
                  }}>{t.titulo}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                    {t.prazo && <span style={{ ...mono, fontSize: 11, color: T.mutedDim }}>{fmtDate(t.prazo)}</span>}
                    {t.notaSubmetida ? (
                      <span style={{ fontSize: 11, color: T.good, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Check size={11} /> concluído
                      </span>
                    ) : t.notaAtleta && (
                      <span style={{ fontSize: 11, color: T.gold, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <FileText size={11} /> rascunho por submeter
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight size={16} color={T.mutedDim} style={{ flexShrink: 0, marginTop: 2 }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* AUTOAVALIAÇÃO COMPLETA = SUBMETIDA. Se as 30 respostas já estão todas
   dadas e o momento ainda não foi submetido (casos de antes desta regra:
   atletas que responderam a tudo mas nunca carregaram em "Submeter"),
   submete-se sozinho. Corre ao entrar no Portal (o atleta entra todos os
   dias para o wellness), por isso estes casos fecham-se sem ele ter de
   voltar ao Desenvolvimento. Devolve true se submeteu. */
export async function submeterAutoavaliacaoSeCompleta(code, teamId, dadosConhecidos) {
  try {
    let d = dadosConhecidos;
    if (!d) {
      const { data, error } = await supabase.rpc('checkin_desenvolvimento', { p_code: code, p_team: teamId });
      if (error) return false;
      d = Array.isArray(data) ? data[0] : data;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return false; } }
    }
    if (!d || !d.registoId) return false;
    // Já submetida (pelo jogador noutro dia, ou pela equipa técnica em
    // Desenvolvimento): conta como feita, para a missão "Autoavaliação"
    // do Portal fechar também.
    if (d.enviado) {
      // Só conta como feita se houver mesmo respostas guardadas: uma
      // submissão VAZIA não pode fechar a missão do jogador.
      return diRespondido(d.auto) > 0;
    }
    if (diRespondido(d.auto) !== DI_INDICADORES.length) return false;
    /* ATENÇÃO: enviar as RESPOSTAS ao submeter. Antes ia `p_auto: {}` —
       o servidor gravava esse objeto vazio por cima do que o jogador tinha
       respondido e marcava como submetida, por isso a equipa técnica via
       "Autoavaliação submetida" sem nada respondido. */
    const { data, error } = await supabase.rpc('checkin_desenvolvimento_responder', {
      p_code: code, p_team: teamId, p_registo_id: d.registoId, p_auto: d.auto || {}, p_submeter: true,
    });
    return !error && !!(data && data.ok);
  } catch (e) {
    return false;
  }
}

