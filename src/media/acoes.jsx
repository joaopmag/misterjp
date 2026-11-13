// media/acoes.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { escapeHtmlText, semAcentos } from '../base/utilidades';
import { useState } from 'react';
import { body, T, TEXT_ON_ACCENT } from '../base/tema';
import { Field, Select, Input, Modal, FIELD_GRID, Btn } from '../base/ui';
import { Scissors } from 'lucide-react';
import { ehClipe, fichaDaEquipa } from './organizacao';
import { driveOpenSrc, linkDoCorteYoutube, socialEmbedSrc } from './social';
import { hrefDescarga } from '../base/anexos';

/* ---------------------------------------------------------------
   GOOGLE DRIVE — alternativa ao carregamento de ficheiro.

   Porquê: um PDF carregado fica guardado em base64 dentro da linha da
   tabela. Acima de uns MB, a gravação estoira o tempo limite do Postgres
   ("canceling statement due to statement timeout"). Com um link do Drive,
   a base de dados guarda ~200 bytes e o ficheiro fica onde já está.

   Limitação assumida: o Drive não deixa outro site descarregar o ficheiro
   (bloqueio CORS), por isso NÃO é possível usar o nosso leitor de PDF —
   mostra-se o visualizador da própria Google dentro de um iframe. Isso
   significa que a navegação de páginas, o deslize e o botão de ecrã
   inteiro passam a ser os da Google, não os nossos.

   O ficheiro tem de estar partilhado como "qualquer pessoa com o link".
--------------------------------------------------------------- */
/* Abre o documento num separador novo e pede a impressão. Um PDF não se
   imprime a partir da nossa página — quem o desenha é o leitor do browser
   (ou o do Google, nos ficheiros do Drive), e só esse tem o comando de
   imprimir. Se a janela for bloqueada, fica sempre o botão de abrir. */
/* Partilhar um item da biblioteca.

   Nos links (YouTube, Instagram, TikTok, Drive) partilha-se o endereço,
   que é o que faz sentido enviar. Nos ficheiros carregados tenta-se a
   partilha nativa do sistema com o próprio ficheiro; se o browser não
   suportar (é o caso do Chrome no computador), descarrega-se — o
   utilizador anexa-o depois onde quiser. */
export async function shareMediaItem(item) {
  if (!item) return;
  const titulo = item.title || item.fileName || 'Documento';
  // Um CORTE do YouTube partilha-se só com o intervalo (ver
  // `linkDoCorteYoutube`); um vídeo completo, com o link normal.
  const eCorte = ehClipe(item) && !!item.youtubeId;
  const url = item.drive ? driveOpenSrc(item.drive)
    : eCorte ? linkDoCorteYoutube(item.youtubeId, item.clipInicio, item.clipFim, titulo)
      : item.youtubeId ? `https://youtu.be/${item.youtubeId}`
        : item.social ? socialEmbedSrc(item.social)
          // Clipe de um vídeo carregado: o link do ficheiro só com o troço
          // (#t=início,fim), em vez de descarregar o vídeo completo.
          : (item.clipNoFicheiro && item.dataUrl && ehClipe(item)
            ? `${item.dataUrl}#t=${Math.floor(item.clipInicio)},${Math.ceil(item.clipFim)}` : null);
  // Num corte, a mensagem é o título que lhe deram; num vídeo completo
  // (ou noutro link), o descritivo todo: título e, por baixo, a
  // jornada/descrição. O link vem a seguir.
  const texto = (eCorte || item.clipNoFicheiro) ? titulo : [titulo, item.jornada].filter(Boolean).join('\n');

  if (url) {
    if (navigator.share) {
      try { await navigator.share({ title: titulo, text: texto, url }); return; } catch (e) { /* cancelado */ return; }
    }
    if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(texto ? `${texto}\n${url}` : url); window.alert('Link copiado.'); return; } catch (e) { /* segue para abrir */ }
    }
    window.open(url, '_blank');
    return;
  }

  if (!item.dataUrl) return;
  try {
    const res = await fetch(item.dataUrl);
    const blob = await res.blob();
    const file = new File([blob], item.fileName || 'ficheiro', { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: titulo });
      return;
    }
  } catch (e) { /* cai para o download */ }
  const a = document.createElement('a');
  a.href = hrefDescarga(item.dataUrl, item.fileName || 'ficheiro');
  a.download = item.fileName || 'ficheiro';
  a.click();
}

export function printDocumentItem(item) {
  if (!item) return;
  // As imagens não abrem num leitor com botão de impressão próprio: montamos
  // uma página só com a foto, dimensionada para caber numa folha A4, e
  // mandamos imprimir assim que a imagem estiver carregada.
  if (item.kind === 'image') return printImageItem(item);
  const url = item.kind === 'drive' ? driveOpenSrc(item.drive) : item.dataUrl;
  if (!url) return;
  const win = window.open(url, '_blank');
  if (!win) return;
  setTimeout(() => {
    try { win.focus(); win.print(); } catch (err) { /* o leitor tem o seu próprio botão */ }
  }, 1500);
}

export function printImageItem(item) {
  if (!item || !item.dataUrl) return;
  const win = window.open('', '_blank');
  if (!win) return;
  const titulo = item.title || item.fileName || 'Imagem';
  win.document.write(
    '<!doctype html><html lang="pt"><head><meta charset="utf-8">' +
    `<title>${escapeHtmlText(titulo)}</title>` +
    '<style>' +
    'html,body{margin:0;padding:0;background:#fff;}' +
    'img{display:block;max-width:100%;max-height:100vh;margin:0 auto;}' +
    '@page{margin:10mm;}' +
    '@media print{img{max-height:none;}}' +
    '</style></head><body>' +
    `<img src="${item.dataUrl}" alt="${escapeHtmlText(titulo)}">` +
    '</body></html>'
  );
  win.document.close();
  const imprimir = () => { try { win.focus(); win.print(); } catch (err) { /* o utilizador imprime pelo menu */ } };
  const img = win.document.images && win.document.images[0];
  if (img && !img.complete) {
    img.onload = () => setTimeout(imprimir, 120);
    img.onerror = imprimir;
  } else {
    setTimeout(imprimir, 300);
  }
}

/* Várias variantes de um formulário no MESMO espaço: todas ficam
   desenhadas (a caixa tem a altura da maior), só a `ativa` se vê e recebe
   cliques. Evita que uma janela mude de tamanho — e os botões saltem —
   ao trocar de opção. As escondidas não recebem foco nem teclado. */
export function CamadasFixas({ ativa, camadas }) {
  return (
    <div style={{ display: 'grid' }}>
      {camadas.map(c => {
        const on = c.id === ativa;
        return (
          <div
            key={c.id}
            aria-hidden={!on}
            style={{ gridArea: '1 / 1', minWidth: 0, visibility: on ? 'visible' : 'hidden', pointerEvents: on ? 'auto' : 'none' }}
          >{c.conteudo}</div>
        );
      })}
    </div>
  );
}

/* FICHA DO ADVERSÁRIO, PEDIDA A MEIO DE UM CORTE.

   Um corte feito num jogo completo de um adversário vai para a ficha
   desse adversário (Scouting › Adversários). Quando o vídeo ainda não
   está associado a nenhuma, pergunta-se aqui: escolher uma ficha que já
   existe, ou criar uma nova só com o essencial — o resto (pontos fortes,
   jogadores-chave, dinâmicas) preenche-se depois na própria ficha. */
export function FichaAdversarioRapida({ adversarios, equipasCompeticao, equipasIniciais, equipaInicial, video, onClose, onConfirm }) {
  const lista = [...(adversarios || [])].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt'));
  const nomes = equipasCompeticao || [];
  const jaTemEquipas = (equipasIniciais || []).length > 0;
  const [eq, setEq] = useState(() => {
    const ini = (equipasIniciais || []).slice(0, 2);
    return [ini[0] || '', ini[1] || ''];
  });
  const equipas = eq.map(x => x.trim()).filter(Boolean);
  const [equipa, setEquipa] = useState(equipaInicial || (equipasIniciais || [])[0] || '');
  const equipaEf = equipas.find(e => semAcentos(e) === semAcentos(equipa)) || (equipas.length === 1 ? equipas[0] : '');
  const fichaExistente = equipaEf ? fichaDaEquipa(equipaEf, adversarios) : null;
  const [modo, setModo] = useState('nova');
  const [fichaId, setFichaId] = useState('');
  const [f, setF] = useState({ escalao: '', prova: '' });
  const valido = !!equipaEf && (fichaExistente || (modo === 'existente' ? !!fichaId : true));
  const tab = (on) => ({
    flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontSize: 13, ...body, color: T.cream,
    border: `1px solid ${on ? T.gold : T.line}`, background: on ? `${T.crimson}33` : 'none',
  });
  const pill = (on) => ({
    padding: '5px 12px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', ...body,
    background: on ? '#B5393F' : 'transparent', color: on ? TEXT_ON_ACCENT : T.muted,
    border: `1px solid ${on ? '#B5393F' : T.line}`,
  });
  // Lista de escolha: as equipas da competição, mais o valor atual se não
  // estiver lá (ex.: nome de uma ficha antiga).
  const opcoes = (atual) => {
    const base = [...nomes];
    if (atual && !base.some(n => semAcentos(n) === semAcentos(atual))) base.unshift(atual);
    return base;
  };
  const campoEquipa = (i, rotulo) => (
    <Field label={rotulo}>
      {nomes.length ? (
        <Select value={eq[i]} onChange={e => setEq(prev => prev.map((x, k) => (k === i ? e.target.value : x)))}>
          <option value="">— escolher —</option>
          {opcoes(eq[i]).map(n => <option key={n} value={n}>{n}</option>)}
        </Select>
      ) : (
        <Input value={eq[i]} onChange={e => setEq(prev => prev.map((x, k) => (k === i ? e.target.value : x)))} placeholder="Nome da equipa" />
      )}
    </Field>
  );
  const confirmar = () => {
    if (!valido) return;
    onConfirm({
      equipas, equipa: equipaEf,
      ...(fichaExistente ? {} : (modo === 'existente' ? { fichaExistenteId: fichaId } : { nova: f })),
    });
  };
  return (
    <Modal title="Ficha do adversário" onClose={onClose}>
      <div style={{ fontSize: 12.5, color: T.mutedDim, marginBottom: 14, lineHeight: 1.5 }}>
        Os cortes de jogos de adversários ficam na ficha da equipa sobre a qual é o corte.
        {video && video.title ? <> Vídeo: <span style={{ color: T.cream }}>{video.title}</span>.</> : null}
      </div>
      {!jaTemEquipas && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11.5, color: T.mutedDim, marginBottom: 6 }}>
            Equipas deste jogo — ficam guardadas no vídeo, e ele passa a aparecer no cartão de cada uma.
          </div>
          <div style={{ ...FIELD_GRID }}>
            {campoEquipa(0, 'Equipa 1')}
            {campoEquipa(1, 'Equipa 2')}
          </div>
          {!nomes.length && (
            <div style={{ fontSize: 11.5, color: T.warn, marginTop: 6 }}>
              Ainda não há equipas nas competições — configura-as em Jogos › Competições e jornadas para as escolheres de uma lista.
            </div>
          )}
        </div>
      )}
      {equipas.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: T.mutedDim }}>Este corte é sobre:</span>
          {equipas.map(e => <button key={e} onClick={() => setEquipa(e)} style={pill(semAcentos(e) === semAcentos(equipaEf))}>{e}</button>)}
        </div>
      )}
      {equipaEf && (fichaExistente ? (
        <div style={{ fontSize: 12.5, color: T.cream, marginBottom: 16 }}>
          Vai para a ficha de <b>{fichaExistente.nome}</b>.
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, color: T.warn, marginBottom: 10 }}>{equipaEf} ainda não tem ficha de adversário.</div>
          {lista.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={() => setModo('nova')} style={tab(modo === 'nova')}>Criar ficha</button>
              <button onClick={() => setModo('existente')} style={tab(modo === 'existente')}>Usar ficha existente</button>
            </div>
          )}
          {modo === 'existente' && lista.length > 0 ? (
            <Field label="Ficha (fica associada a esta equipa)">
              <Select value={fichaId} onChange={e => setFichaId(e.target.value)}>
                <option value="">— escolher —</option>
                {lista.map(a => <option key={a.id} value={a.id}>{a.nome || '(sem nome)'}{a.escalao ? ` · ${a.escalao}` : ''}</option>)}
              </Select>
            </Field>
          ) : (
            <div style={{ ...FIELD_GRID }}>
              <Field label="Escalão (opcional)"><Input value={f.escalao} onChange={e => setF({ ...f, escalao: e.target.value })} placeholder="Ex: Sub-19" /></Field>
              <Field label="Prova (opcional)"><Input value={f.prova} onChange={e => setF({ ...f, prova: e.target.value })} placeholder="Ex: Campeonato Nacional" /></Field>
            </div>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn disabled={!valido} onClick={confirmar}><Scissors size={14} /> Gravar corte na ficha</Btn>
      </div>
    </Modal>
  );
}

