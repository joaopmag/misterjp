// base/historico.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useState, useEffect, useRef } from 'react';
import { ensureSession } from './sincronizacao';
import { supabase } from '../supabaseClient';
import { Modal, EmptyState, herdarOuEmpurrarMarca, modalHandoffAtivo } from './ui';
import { T, mono } from './tema';
import { Loader2, ChevronDown } from 'lucide-react';
import { timeAgo } from './utilidades';
import { RELATO_ACOES, RelatoCampo, relatoCampoLabel } from '../dominio/relato';

export const AUDIT_ACTION_LABEL = { criou: 'Criado', editou: 'Editado', apagou: 'Apagado' };

/* Histórico de UM registo (exercício, ideia de jogo…): quem criou,
   editou ou apagou, quando, e o que mudou.

   Lê o `activity_log` (o mesmo do Relato): leve, só com as diferenças.
   Antes lia o `audit_log`, que traz cópias inteiras de cada versão — um
   exercício com diagrama eram centenas de KB por linha — e que nem
   sequer tinha gatilho na tabela das ideias, por isso o histórico delas
   aparecia sempre vazio.

   Se o `activity_log` ainda não existir (SQL por correr), volta ao
   `audit_log` como antes, convertido para o mesmo formato. */
export function HistoryModal({ table, recordId, title, onClose }) {
  const [entries, setEntries] = useState(null); // null = a carregar
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureSession();
      const novo = await supabase
        .from('activity_log')
        .select('id, acao, ator_email, em, campos, origem')
        .eq('tabela', table).eq('registo_id', String(recordId))
        .order('em', { ascending: false }).limit(300);
      if (cancelled) return;
      if (!novo.error) { setEntries(novo.data || []); return; }

      // Plano B: o audit_log antigo, convertido.
      const velho = await supabase
        .from('audit_log')
        .select('id, action, changed_by_email, changed_at, old_data, new_data')
        .eq('table_name', table).eq('record_id', recordId)
        .order('changed_at', { ascending: false }).limit(100);
      if (cancelled) return;
      if (velho.error) { console.error(velho.error); setEntries([]); return; }
      const soData = (x) => (x && typeof x === 'object' && 'data' in x && 'id' in x ? x.data : x);
      setEntries((velho.data || []).map(r => {
        const acao = /^ins/i.test(r.action) ? 'criou' : (/^del/i.test(r.action) ? 'apagou' : 'editou');
        let campos = null;
        if (acao === 'editou') {
          const a = soData(r.old_data) || {}; const b = soData(r.new_data) || {};
          campos = [...new Set([...Object.keys(a), ...Object.keys(b)])]
            .filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
            .map(k => ({ k, ...(a[k] !== undefined ? { de: a[k] } : {}), ...(b[k] !== undefined ? { para: b[k] } : {}) }));
        }
        return { id: r.id, acao, ator_email: r.changed_by_email, em: r.changed_at, campos };
      }));
    })();
    return () => { cancelled = true; };
  }, [table, recordId]);

  const semNome = () => null;

  return (
    <Modal title={title || 'Histórico de alterações'} onClose={onClose}>
      {entries === null ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Loader2 className="animate-spin" color={T.warn} size={20} /></div>
      ) : entries.length === 0 ? (
        <EmptyState text="Ainda sem histórico registado para este registo." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map(e => {
            const campos = (e.campos || []).map(c => ({ ...c, temDe: c.de !== undefined }));
            const isOpen = openId === e.id;
            const cor = (RELATO_ACOES[e.acao] || RELATO_ACOES.editou).cor;
            return (
              <div key={e.id} style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: '10px 12px' }}>
                <div
                  onClick={() => campos.length && setOpenId(isOpen ? null : e.id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, cursor: campos.length ? 'pointer' : 'default' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <span style={{ color: cor, fontSize: 12.5, fontWeight: 600 }}>{AUDIT_ACTION_LABEL[e.acao] || e.acao}</span>
                    <span style={{ color: T.mutedDim, fontSize: 12, marginLeft: 8 }}>{e.ator_email || 'quiosque / automático'}</span>
                    {!isOpen && campos.length > 0 && (
                      <div style={{ color: T.mutedDim, fontSize: 11.5, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {campos.slice(0, 4).map(c => relatoCampoLabel(c.k)).join(', ')}{campos.length > 4 ? ` +${campos.length - 4}` : ''}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ ...mono, color: T.mutedDim, fontSize: 11 }} title={new Date(e.em).toLocaleString('pt-PT')}>{timeAgo(e.em)}</span>
                    {campos.length > 0 && <ChevronDown size={13} color={T.mutedDim} style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} />}
                  </div>
                </div>
                {isOpen && campos.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {campos.map(c => <RelatoCampo key={c.k} c={c} nomeJogador={semNome} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

export function useDetailBack(aberto, fechar) {
  const markerRef = useRef(null);
  const fechadoPeloPop = useRef(false);
  useEffect(() => {
    if (!aberto) return undefined;
    const meuMarker = herdarOuEmpurrarMarca();
    markerRef.current = meuMarker;
    fechadoPeloPop.current = false;
    const onPop = () => {
      const atual = window.history.state && window.history.state.mjpMarker;
      if (atual === meuMarker) return; // saiu uma marca mais funda, não a nossa
      fechadoPeloPop.current = true;
      fechar();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (fechadoPeloPop.current) return; // já foi o próprio retroceder a tratar disto
      if (modalHandoffAtivo) return; // outra janela vai herdar esta marca, não a desfazer agora
      const atual = window.history.state && window.history.state.mjpMarker;
      if (atual === meuMarker) window.history.back();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);
  return () => window.history.back();
}

