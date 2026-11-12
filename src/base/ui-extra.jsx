// base/ui-extra.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useIsMobile, Input, Btn } from './ui';
import { body, TEXT_ON_ACCENT, T, mono } from './tema';
import { useState, useRef, useEffect } from 'react';
import { semAcentos } from './utilidades';
import { ChevronDown, X } from 'lucide-react';

/* SUB-SEPARADORES DENTRO DE UMA SECÇÃO.

   A barra lateral não pode crescer para sempre: cada separador novo
   aproxima-a do scroll, e uma lista que se percorre a rolar deixa de se
   ler de relance. Secções que são duas vistas da mesma coisa passam a
   partilhar um separador e a dividir-se aqui dentro.

   O desenho é o mesmo das pílulas de filtro que já existem nos Jogos e
   nas Estatísticas — de propósito: quem já sabe carregar numa sabe
   carregar nestas. */
export function SubTabs({ value, onChange, tabs, semMargem }) {
  /* No TELEMÓVEL, com até três separadores, ficam os três numa linha,
     a dividir a largura, com letra e margens mais pequenas. */
  const estreito = useIsMobile(560);
  const numaLinha = estreito && tabs.length <= 3;
  return (
    <div style={{ display: 'flex', gap: numaLinha ? 6 : 8, flexWrap: numaLinha ? 'nowrap' : 'wrap', marginBottom: semMargem ? 0 : 18 }}>
      {tabs.map(t => {
        const on = value === t.id;
        return (
          <button key={t.id} type="button" onClick={() => onChange(t.id)} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: numaLinha ? 5 : 7,
            flexShrink: numaLinha ? 1 : 0, flexGrow: numaLinha ? 1 : 0, flexBasis: numaLinha ? 0 : 'auto', minWidth: 0, overflow: 'hidden',
            padding: numaLinha ? '7px 6px' : '7px 14px', borderRadius: 20, fontSize: numaLinha ? 12 : 13, cursor: 'pointer', ...body,
            fontWeight: on ? 600 : 500, whiteSpace: 'nowrap',
            background: on ? '#B5393F' : 'transparent',
            color: on ? TEXT_ON_ACCENT : T.muted,
            border: `1px solid ${on ? '#B5393F' : T.line}`,
          }}>
            {t.icon && !numaLinha ? <t.icon size={14} /> : null}
            <span style={numaLinha ? { overflow: 'hidden', textOverflow: 'ellipsis' } : undefined}>{numaLinha && t.curto ? t.curto : t.label}</span>
            {t.count != null && <span style={{ ...mono, opacity: .75, flexShrink: 0 }}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function ToggleBtn({ children, active, onClick, accent }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '14px', borderRadius: 10, cursor: 'pointer', ...body, fontSize: 14.5, fontWeight: 600,
      border: `1px solid ${active ? (accent ? T.gold : T.cream) : T.line}`,
      background: active ? (accent ? `${T.gold}22` : T.surfaceRaise) : T.surface,
      color: active ? (accent ? T.warn : T.cream) : T.mutedDim,
    }}>{children}</button>
  );
}

// Abrir o separador: a app já segue o #separador do endereço.
// Pede à app para mudar de separador (a app ouve este aviso; alguns
// caminhos, como "estatisticas", abrem mais do que um separador).
export const irParaSeparador = (id) => {
  if (!id || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('mjp-ir-separador', { detail: id }));
};

/* LISTA QUE ABRE, com caixas de seleção — para escolher jogadores ou
   pessoas da equipa técnica. Pesquisa, atalhos (ex.: GR, Defesas) e os
   escolhidos por baixo do campo, com × para tirar. */
export function ListaMultipla({ itens, escolhidos, onAlternar, resumo, atalhos, onLimpar, comProcura, mostrarEtiquetas = true }) {
  const [aberta, setAberta] = useState(false);
  const [procura, setProcura] = useState('');
  const ref = useRef(null);
  /* A lista abre "por cima de tudo" (posição fixa no ecrã), calculada a
     partir do campo: dentro de uma coluna com o seu próprio deslizar, uma
     lista normal ficava cortada. Abre para cima se não houver espaço em
     baixo, e acompanha o campo se a coluna deslizar. */
  const [pos, setPos] = useState(null);
  useEffect(() => {
    if (!aberta) return undefined;
    const calc = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const h = window.innerHeight;
      const emBaixo = h - r.bottom - 12;
      const emCima = r.top - 12;
      const paraCima = emBaixo < 300 && emCima > emBaixo;
      setPos({ left: r.left, width: r.width, ...(paraCima ? { bottom: h - r.top + 4, maxHeight: emCima } : { top: r.bottom + 4, maxHeight: emBaixo }) });
    };
    calc();
    window.addEventListener('resize', calc);
    window.addEventListener('scroll', calc, true);
    return () => { window.removeEventListener('resize', calc); window.removeEventListener('scroll', calc, true); };
  }, [aberta]);
  useEffect(() => {
    if (!aberta) return undefined;
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) { setAberta(false); setProcura(''); } };
    document.addEventListener('mousedown', fora);
    document.addEventListener('touchstart', fora);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('touchstart', fora); };
  }, [aberta]);
  const pequeno = { display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 16, cursor: 'pointer', ...body, fontSize: 11.5, background: 'transparent', color: T.muted, border: `1px solid ${T.line}` };
  const visiveis = itens.filter(it => !procura.trim() || semAcentos(it.rotulo).includes(semAcentos(procura.trim())));
  return (
    <div>
      <div ref={ref} style={{ position: 'relative' }}>
        <button type="button" onClick={() => setAberta(v => !v)} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderRadius: 8, cursor: 'pointer', ...body,
          background: T.bg, border: `1px solid ${aberta ? T.gold : T.line}`, color: escolhidos.length ? T.cream : T.mutedDim, fontSize: 14, textAlign: 'left',
        }}>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resumo}</span>
          <ChevronDown size={16} style={{ flexShrink: 0, transform: aberta ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </button>
        {aberta && pos && (
          <div style={{
            position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight,
            zIndex: 120, background: T.surfaceRaise || T.surface, overflowY: 'auto', boxSizing: 'border-box',
            border: `1px solid ${T.line}`, borderRadius: 10, boxShadow: '0 12px 30px rgba(0,0,0,.45)', padding: 10,
          }}>
            {comProcura && <Input value={procura} onChange={e => setProcura(e.target.value)} placeholder="Procurar" autoFocus style={{ marginBottom: 8 }} />}
            {((atalhos && atalhos.length) || (onLimpar && escolhidos.length > 0)) && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                {(atalhos || []).map(a => <button key={a.rotulo} type="button" onClick={a.onClick} style={pequeno}>{a.rotulo}</button>)}
                {onLimpar && escolhidos.length > 0 && <button type="button" onClick={onLimpar} style={{ ...pequeno, color: T.mutedDim }}>Limpar</button>}
              </div>
            )}
            <div style={{ maxHeight: Math.max(120, Math.min(260, (pos.maxHeight || 400) - 150)), overflowY: 'auto' }}>
              {visiveis.map(it => {
                const on = escolhidos.includes(it.id);
                const bloqueado = !on && !!it.bloqueado;
                return (
                  <label key={it.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 6px', borderRadius: 6, fontSize: 13.5,
                    color: bloqueado ? T.mutedDim : T.cream, cursor: bloqueado ? 'not-allowed' : 'pointer', opacity: bloqueado ? 0.55 : 1,
                    background: on ? 'rgba(181,57,63,.14)' : 'transparent',
                  }}>
                    <input type="checkbox" checked={on} disabled={bloqueado} onChange={() => onAlternar(it.id)}
                      style={{ accentColor: T.crimson, width: 16, height: 16, flexShrink: 0 }} />
                    {it.cor && <span style={{ width: 12, height: 12, borderRadius: '50%', background: it.cor, flexShrink: 0 }} />}
                    {it.prefixo && <span style={{ ...mono, fontSize: 11, color: T.mutedDim, width: 30, flexShrink: 0 }}>{it.prefixo}</span>}
                    <span style={{ flex: 1, minWidth: 0 }}>{it.rotulo}</span>
                    {bloqueado && it.motivo && <span style={{ fontSize: 11, color: T.warn }}>{it.motivo}</span>}
                  </label>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Btn onClick={() => { setAberta(false); setProcura(''); }}>Feito</Btn>
            </div>
          </div>
        )}
      </div>
      {/* Linha de altura FIXA (uma linha, desliza para o lado): escolher ou
          tirar pessoas nunca empurra o resto da página. */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'nowrap', overflowX: 'auto', alignItems: 'center', height: 30, marginTop: 8, scrollbarWidth: 'thin' }}>
        {!escolhidos.length && <span style={{ fontSize: 12, color: T.mutedDim }}>Ninguém escolhido.</span>}
        {!mostrarEtiquetas && escolhidos.length > 0 && <span style={{ fontSize: 12, color: T.mutedDim }}>{resumo}.</span>}
        {mostrarEtiquetas && escolhidos.map(id => {
            const it = itens.find(x => x.id === id);
            if (!it) return null;
            return (
              <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: T.cream, border: `1px solid ${T.line}`, borderRadius: 14, padding: '2px 4px 2px 9px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {it.cor && <span style={{ width: 9, height: 9, borderRadius: '50%', background: it.cor }} />}
                {it.rotulo}
                <button type="button" onClick={() => onAlternar(id)} aria-label={`Tirar ${it.rotulo}`} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 1, display: 'flex' }}><X size={12} /></button>
              </span>
            );
          })}
      </div>
    </div>
  );
}

