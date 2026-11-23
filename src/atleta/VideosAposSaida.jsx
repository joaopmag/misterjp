// atleta/VideosAposSaida.jsx
//
// O ACESSO DEPOIS DA SAÍDA (23/11).
//
// Quando o jogador sai do clube ("Data de saída" na ficha), o Portal
// fecha: deixa de ver a equipa, os treinos, os jogos e a Sala. Mas os
// vídeos pessoais dele ("Os meus vídeos" e os clipes) só são apagados 30
// dias depois da saída (video-worker, rgpd.js, DIAS_APOS_SAIDA). Durante
// esses 30 dias, ao entrar com o PIN, o jogador vê SÓ este ecrã: os vídeos
// dele, para os descarregar em MP4, e a data em que vão ser apagados.
// Pode juntar todos os clipes num só vídeo, para não perder nenhum.
// Nada da equipa aparece aqui.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { T, body, display } from '../base/tema';
import { assinaturaDoVideoJunto, descarregarMp4, soClipesDeFicheiro } from '../media/videoJunto';
import { lerMeusClipes, ultimoDiaDosVideos } from './salaDados';
import { criarApiMeusVideos } from './apiMeusVideos';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataPorExtenso = (iso) => { const [a, m, d] = String(iso).split('-').map(Number); return `${d} de ${MESES[m - 1]} de ${a}`; };
const fmtDur = (s) => { const t = Math.round(s); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

export default function VideosAposSaida({ code, teamId, player, equipa, onSair }) {
  const api = useMemo(() => criarApiMeusVideos(code, teamId), [code, teamId]);
  const [clipes, setClipes] = useState(null); // null = a carregar
  const [lista, setLista] = useState([]);
  const [mp4, setMp4] = useState({});
  const [mp4Lido, setMp4Lido] = useState(false); // só se pede MP4 depois de saber o que já há
  const [falha, setFalha] = useState('');
  const [aJuntar, setAJuntar] = useState(false);
  const pedidos = useRef(new Set());
  const nome = String((player && player.name) || '').split(' ')[0];
  const ultimoDia = ultimoDiaDosVideos(player.exitDate);

  const lerMp4 = async () => {
    if (!api.ficheiros) return;
    try {
      const l = await api.ficheiros();
      const m = {}; l.forEach(x => { if (x && x.id) m[x.id] = x; });
      setMp4(m); setMp4Lido(true);
    } catch (e) { /* tenta na próxima volta */ }
  };

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [cl, vids] = await Promise.all([lerMeusClipes(code, teamId), api.ler()]);
        if (!vivo) return;
        setClipes(cl); setLista(vids);
        lerMp4();
      } catch (e) {
        if (vivo) { setClipes([]); setFalha('Não foi possível carregar os teus vídeos. Verifica a internet e tenta outra vez.'); }
      }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const porId = useMemo(() => new Map((clipes || []).map(c => [c.id, c])), [clipes]);
  const validos = (ids) => (ids || []).filter(id => porId.has(id));
  const assin = (ids) => assinaturaDoVideoJunto(ids, porId);
  const pronto = (v) => { const ids = validos(v.ids); const f = mp4[v.id]; return f && f.estado === 'pronto' && f.url && f.assinatura === assin(ids) ? f : null; };
  const estado = (v) => {
    const ids = validos(v.ids);
    if (!ids.length) return { tipo: 'vazio', txt: 'Os clipes deste vídeo já não existem.' };
    if (pronto(v)) return { tipo: 'pronto' };
    if (!soClipesDeFicheiro(ids, porId)) return { tipo: 'youtube', txt: 'Tem clipes do YouTube: não dá para descarregar em MP4.' };
    if (!api.prepararMp4) return { tipo: 'sem', txt: 'Descarregar indisponível nesta versão.' };
    const f = mp4[v.id];
    if (f && f.assinatura === assin(ids) && f.estado === 'muito_longo') return { tipo: 'longo', txt: 'Demasiado longo para MP4 (máximo 30 minutos).' };
    if (f && f.assinatura === assin(ids) && f.estado === 'erro') return { tipo: 'erro', txt: 'O MP4 falhou. Volta a entrar mais tarde.' };
    return { tipo: 'a_preparar', txt: 'A preparar o MP4…' };
  };

  // Pede o MP4 dos que ainda não o têm (uma vez por visita).
  useEffect(() => {
    if (!clipes || !api.prepararMp4 || !mp4Lido) return;
    lista.forEach(v => {
      const ids = validos(v.ids);
      if (!ids.length || !soClipesDeFicheiro(ids, porId) || pronto(v)) return;
      const f = mp4[v.id];
      const a = assin(ids);
      if (f && f.assinatura === a && (f.estado === 'a_preparar' || f.estado === 'muito_longo')) return;
      const k = `${v.id}|${a}`;
      if (pedidos.current.has(k)) return;
      pedidos.current.add(k);
      api.prepararMp4(v.id).then(() => setMp4(m => ({ ...m, [v.id]: { ...(m[v.id] || {}), id: v.id, estado: 'a_preparar', assinatura: a } }))).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipes, lista, mp4, mp4Lido]);
  // Enquanto algum estiver a ser preparado, confirma de 8 em 8 segundos.
  const aPreparar = lista.some(v => estado(v).tipo === 'a_preparar');
  useEffect(() => {
    if (!aPreparar) return undefined;
    const t = setTimeout(lerMp4, 8000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aPreparar, mp4]);

  // "Juntar todos os meus clipes num vídeo": os clipes de ficheiro, por ordem.
  const deFicheiro = (clipes || []).filter(c => !c.youtubeId);
  const todosIds = deFicheiro.map(c => c.id);
  const jaHaTodos = lista.some(v => JSON.stringify(validos(v.ids)) === JSON.stringify(todosIds));
  const juntarTodos = async () => {
    if (aJuntar || !todosIds.length) return;
    setAJuntar(true); setFalha('');
    try {
      const v = await api.guardar({ nome: 'Todos os meus clipes', ids: todosIds });
      setLista(prev => [v, ...prev]);
    } catch (e) {
      setFalha('Não foi possível juntar os clipes. Tenta outra vez.');
    }
    setAJuntar(false);
  };

  const botao = (ativo) => ({
    border: `1px solid ${ativo ? T.gold : T.line}`, background: ativo ? T.gold : 'transparent', color: ativo ? T.bg : T.muted,
    borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: ativo ? 'pointer' : 'default', whiteSpace: 'nowrap', ...body,
  });

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, color: T.cream, padding: '28px 16px 40px', ...body }}>
      <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: 1.2, color: T.mutedDim, textTransform: 'uppercase' }}>{(equipa && equipa.nome) || 'Portal do atleta'}</div>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, lineHeight: 1.15, ...display }}>{nome ? `Olá, ${nome}` : 'Olá'}</h1>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16, fontSize: 14, lineHeight: 1.5 }}>
          O teu acesso ao Portal terminou com a saída do clube. Os teus vídeos ficam aqui até <b style={{ color: T.gold }}>{dataPorExtenso(ultimoDia)}</b>, para os descarregares. Depois disso são apagados.
        </div>

        {falha && <div style={{ fontSize: 13, color: T.warn }}>{falha}</div>}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, ...display }}>Os meus vídeos</div>
          {clipes && todosIds.length > 0 && !jaHaTodos && (
            <button type="button" onClick={juntarTodos} disabled={aJuntar} style={botao(!aJuntar)}>
              {aJuntar ? 'A juntar…' : `Juntar os ${todosIds.length} clipes num vídeo`}
            </button>
          )}
        </div>

        {clipes === null && <div style={{ minHeight: 120, color: T.mutedDim, fontSize: 13 }}>A carregar…</div>}
        {clipes !== null && !lista.length && (
          <div style={{ color: T.muted, fontSize: 13.5, lineHeight: 1.5 }}>
            {todosIds.length ? 'Ainda não tens vídeos. Junta os teus clipes num vídeo para o descarregares.' : 'Não tens vídeos nem clipes guardados.'}
          </div>
        )}
        {clipes !== null && lista.map(v => {
          const e = estado(v);
          const ids = validos(v.ids);
          const dur = ids.reduce((t, id) => { const c = porId.get(id); return t + (c ? Math.max(0, (c.clipFim || 0) - (c.clipInicio || 0)) : 0); }, 0);
          const p = pronto(v);
          return (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.nome || 'Vídeo'}</div>
                <div style={{ fontSize: 12, color: T.mutedDim, marginTop: 3 }}>
                  {ids.length} {ids.length === 1 ? 'clipe' : 'clipes'}{dur > 0 ? ` · ${fmtDur(dur)}` : ''}{e.txt && e.tipo !== 'pronto' && e.tipo !== 'a_preparar' ? ` · ${e.txt}` : ''}
                </div>
              </div>
              <button type="button" disabled={!p} onClick={() => p && descarregarMp4(p.url, v.nome)} style={botao(!!p)}>
                {p ? 'Descarregar' : e.tipo === 'a_preparar' ? 'A preparar…' : 'Indisponível'}
              </button>
            </div>
          );
        })}

        <button type="button" onClick={onSair} style={{ alignSelf: 'center', marginTop: 10, background: 'none', border: 'none', color: T.mutedDim, fontSize: 13, textDecoration: 'underline', cursor: 'pointer', ...body }}>Sair</button>
      </div>
    </div>
  );
}
