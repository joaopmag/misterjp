// media/MediaModal.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useIsMobile, Modal, Field, Input, FIELD_GRID, Select, Btn } from '../base/ui';
import { useState } from 'react';
import { body, T } from '../base/tema';
import { Trophy, Shield, FolderOpen, Loader2, Upload, Check } from 'lucide-react';
import { fmtDate, semAcentos } from '../base/utilidades';
import { detectSocialEmbed, driveOpenSrc, parseDriveId, parseYouTubeId, socialEmbedSrc } from './social';
import { cleanFolder, numDoJogo } from './organizacao';
import { presentationKind } from './leitores';
import { ficheiroParaAnexo } from '../base/anexos';
import { CamadasFixas } from './acoes';

export function MediaModal({ item, onClose, onSave, folders = [], defaultFolder = '', semCatalogo, modoCanal, matches, adversarios, iniciais, equipasCompeticao, soLink }) {
  // Só para acertar o recuo do rodapé fixo (ver o botão Guardar mais
  // abaixo) com o padding do Modal, que muda entre telemóvel e ecrã
  // largo — tem de ser o mesmo valor dos dois lados.
  const estreito = useIsMobile(620);
  const initialSource = item
    ? (item.drive ? 'drive' : ((item.youtubeId || item.social) ? 'link' : 'file'))
    : 'link';
  const [source, setSource] = useState(initialSource);
  const [f, setF] = useState(item
    ? {
        ...item, pasta: item.pasta || '',
        url: item.youtubeId ? `https://youtu.be/${item.youtubeId}` : (item.social ? socialEmbedSrc(item.social) : ''),
        driveUrl: item.drive ? driveOpenSrc(item.drive) : '',
      }
    : { title: '', jornada: (iniciais && iniciais.jornada) || '', pasta: defaultFolder || '', url: '', driveUrl: '', kind: null, fileName: '', dataUrl: '' });
  // CANAL — em que secção fica o vídeo (ver `categoriaDoItem`), e a que
  // jogo/ficha pertence. Fora do Canal nada disto aparece nem é gravado.
  const [categoria, setCategoria] = useState((iniciais && iniciais.categoria) || 'tema');
  const [jogoId, setJogoId] = useState((iniciais && iniciais.jogoId) || '');
  // Jogo de adversário: as duas equipas (lista das competições).
  const [eqs, setEqs] = useState(() => {
    const ini = ((iniciais && iniciais.equipas) || []).slice(0, 2);
    return [ini[0] || '', ini[1] || ''];
  });
  const nomesEquipas = equipasCompeticao || [];
  const jogosOrdenados = [...(matches || [])].sort((x, y) => String(y.date || '').localeCompare(String(x.date || '')));
  const escolherJogo = (id) => {
    setJogoId(id);
    const m = (matches || []).find(x => x.id === id);
    // A jornada é o que junta os vídeos do mesmo jogo — vem do próprio
    // jogo quando se escolhe um.
    if (m && m.jornada) {
      const n = numDoJogo(m);
      setF(prev => ({ ...prev, jornada: n != null ? `${n}ª Jornada` : String(m.jornada) }));
    }
  };
  // Campos comuns a todas as gravações.
  const comuns = () => {
    const base = { title: f.title, jornada: f.jornada, pasta: cleanFolder(f.pasta) };
    if (!modoCanal) return base;
    return {
      ...base,
      categoria,
      pasta: categoria === 'tema' ? cleanFolder(f.pasta) : '',
      jogoId: categoria === 'jogo' ? (jogoId || null) : null,
      equipas: categoria === 'adversario' ? eqs.map(x => x.trim()).filter(Boolean) : [],
      // As equipas substituem a antiga ligação direta a uma ficha.
      adversarioFichaId: null,
    };
  };
  const [error, setError] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);

  const handleFile = async (file) => {
    setError('');
    if (!file) return;
    const kind = presentationKind(file);
    if (!kind) { setError('Formato não suportado — escolhe um PDF, imagem, PowerPoint (.ppt/.pptx) ou vídeo.'); return; }
    // Vídeos ocupam muito mais espaço em base64 do que PDFs/imagens —
    // limite mais generoso que o dos anexos de exercícios, mas continua
    // a existir para não sobrecarregar a base de dados.
    const maxSize = kind === 'video' ? 60 * 1024 * 1024 : 15 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`Ficheiro demasiado grande (máx. ${Math.round(maxSize / 1024 / 1024)} MB).`);
      return;
    }
    setLoadingFile(true);
    try {
      const { campos, emBase64 } = await ficheiroParaAnexo(file, { pasta: 'sala' });
      setF(prev => ({ ...prev, kind, fileName: file.name, storagePath: null, bucket: null, ...campos, youtubeId: null, drive: null, title: prev.title || file.name.replace(/\.[^.]+$/, '') }));
      // Só no comportamento antigo (base64 dentro da linha da tabela):
      // acima de ~4 MB a gravação começa a ultrapassar o tempo limite do
      // Postgres ("statement timeout"). No Storage não há esse limite.
      if (emBase64 && file.size > 4 * 1024 * 1024) {
        setError(`Atenção: ${Math.round(file.size / 1024 / 1024)} MB é grande para guardar na base de dados — a gravação pode falhar com "statement timeout". Usa antes o separador Google Drive, ou comprime o ficheiro.`);
      }
    } finally {
      setLoadingFile(false);
    }
  };

  const handleSave = () => {
    if (source === 'link') {
      const ytId = parseYouTubeId(f.url);
      if (ytId) {
        onSave({ ...(item || {}), ...comuns(), youtubeId: ytId, social: null, kind: null, fileName: null, dataUrl: null, storagePath: null, bucket: null, drive: null });
        return;
      }
      const social = detectSocialEmbed(f.url);
      if (social) {
        onSave({ ...(item || {}), ...comuns(), youtubeId: null, social, kind: null, fileName: null, dataUrl: null, storagePath: null, bucket: null, drive: null });
        return;
      }
      setError(/fb\.watch/.test(f.url || '')
        ? 'Os links curtos do Facebook (fb.watch) não funcionam. Abre o vídeo no Facebook e copia o link completo (facebook.com/reel/… ou …/videos/…).'
        : 'Não consegui identificar o vídeo — confirma o link do YouTube, Instagram, TikTok ou Facebook (link completo, não o link curto do TikTok ou fb.watch).');
    } else if (source === 'drive') {
      const drive = parseDriveId(f.driveUrl);
      if (!drive) {
        setError('Não consegui identificar o ficheiro — cola o link de partilha do Google Drive (drive.google.com/file/d/…).');
        return;
      }
      onSave({
        ...(item || {}), ...comuns(),
        drive, kind: 'drive', youtubeId: null, social: null, fileName: null, dataUrl: null, storagePath: null, bucket: null,
      });
    } else {
      if (!f.dataUrl || !f.kind) { setError('Carrega um ficheiro antes de guardar.'); return; }
      onSave({ ...(item || {}), ...comuns(), kind: f.kind, fileName: f.fileName, dataUrl: f.dataUrl, storagePath: f.storagePath || null, bucket: f.bucket || null, youtubeId: null, social: null, drive: null });
    }
  };

  const tabBtnStyle = (activeTab) => ({
    flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontSize: 13, ...body,
    border: `1px solid ${source === activeTab ? T.gold : T.line}`,
    background: source === activeTab ? `${T.crimson}33` : 'none',
    color: T.cream,
  });

  return (
    <Modal title={item ? 'Editar item' : 'Novo item'} onClose={onClose}>
      {/* `soLink` (Análise de Vídeo): só link — o ficheiro carrega-se no
          cartão "Adicionar vídeo" da própria Análise. */}
      {!soLink && <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => { setSource('link'); setError(''); }} style={tabBtnStyle('link')}>Vídeo</button>
        <button onClick={() => { setSource('file'); setError(''); }} style={tabBtnStyle('file')}>Ficheiro</button>
        <button onClick={() => { setSource('drive'); setError(''); }} style={tabBtnStyle('drive')}>Google Drive</button>
      </div>}

      {modoCanal && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11.5, color: T.mutedDim, marginBottom: 6 }}>Onde fica no Canal</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { id: 'jogo', label: 'Jogo da equipa', Icon: Trophy },
              { id: 'adversario', label: 'Jogo de adversário', Icon: Shield },
              { id: 'tema', label: 'Outro (tema)', Icon: FolderOpen },
            ].map(o => (
              <button key={o.id} onClick={() => setCategoria(o.id)} style={{
                flex: 1, minWidth: 130, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, ...body, color: T.cream,
                border: `1px solid ${categoria === o.id ? T.gold : T.line}`,
                background: categoria === o.id ? `${T.crimson}33` : 'none',
              }}><o.Icon size={13} /> {o.label}</button>
            ))}
          </div>
        </div>
      )}
      {/* JANELA FIXA — cada opção (tipo de vídeo, fonte) mostra campos
          diferentes; antes a janela crescia e encolhia a cada clique e os
          botões saltavam de sítio. Agora todas as variantes ficam
          desenhadas umas por cima das outras (`CamadasFixas`) e só a
          escolhida se vê: a janela tem sempre a altura da maior. */}
      {(() => {
        const titulo = (
          <div style={{ marginBottom: 12 }}>
            <Field label="Título"><Input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Ex: Jornada 12 vs FC Foz" /></Field>
          </div>
        );
        const descricao = (rotulo, dica) => (
          <div style={{ marginBottom: 12 }}>
            <Field label={rotulo}><Input value={f.jornada} onChange={e => setF({ ...f, jornada: e.target.value })} placeholder="Ex: Jornada 12 · Campeonato" /></Field>
            {dica && <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 6 }}>{dica}</div>}
          </div>
        );
        /* PASTA — a lista escolhe uma das existentes; a caixa ao lado serve
           para criar uma nova. `semCatalogo` esconde tudo isto — não há
           pastas quando os vídeos vivem à parte de um único adversário. */
        const pasta = !semCatalogo && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ ...FIELD_GRID }}>
              <Field label="Pasta existente">
                <Select
                  value={folders.includes(f.pasta) ? f.pasta : ''}
                  onChange={e => setF({ ...f, pasta: e.target.value })}
                >
                  <option value="">— sem pasta —</option>
                  {folders.map(name => <option key={name} value={name}>{name}</option>)}
                </Select>
              </Field>
              <Field label="Ou criar pasta nova">
                <Input
                  value={folders.includes(f.pasta) ? '' : f.pasta}
                  onChange={e => setF({ ...f, pasta: e.target.value })}
                  placeholder="Ex: Adversários"
                />
              </Field>
            </div>
          </div>
        );
        const tema = <>{titulo}{descricao('Descrição / contexto (opcional)')}{pasta}</>;
        if (!modoCanal) return tema;
        return (
          <CamadasFixas ativa={categoria} camadas={[
            { id: 'jogo', conteudo: (
              <>
                <div style={{ marginBottom: 12 }}>
                  <Field label="Jogo (opcional — liga ao módulo Jogos)">
                    <Select value={jogoId} onChange={e => escolherJogo(e.target.value)}>
                      <option value="">— sem ligação —</option>
                      {jogosOrdenados.map(m => (
                        <option key={m.id} value={m.id}>
                          {[m.jornada && (numDoJogo(m) != null ? `J${numDoJogo(m)}` : m.jornada), `vs ${m.opponent || 'Adversário'}`, m.date && fmtDate(m.date)].filter(Boolean).join(' · ')}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                {titulo}
                {descricao('Jornada', 'É pela jornada que as partes do mesmo jogo e os seus cortes ficam juntos (ex.: "2ª Jornada"). Nos amigáveis, escreve "Amigável".')}
              </>
            ) },
            { id: 'adversario', conteudo: (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ ...FIELD_GRID }}>
                    {[0, 1].map(i => (
                      <Field key={i} label={`Equipa ${i + 1}`}>
                        {nomesEquipas.length ? (
                          <Select value={eqs[i]} onChange={e => setEqs(prev => prev.map((x, k) => (k === i ? e.target.value : x)))}>
                            <option value="">— escolher —</option>
                            {(eqs[i] && !nomesEquipas.some(n => semAcentos(n) === semAcentos(eqs[i])) ? [eqs[i], ...nomesEquipas] : nomesEquipas)
                              .map(n => <option key={n} value={n}>{n}</option>)}
                          </Select>
                        ) : (
                          <Input value={eqs[i]} onChange={e => setEqs(prev => prev.map((x, k) => (k === i ? e.target.value : x)))} placeholder="Nome da equipa" />
                        )}
                      </Field>
                    ))}
                  </div>
                  <div style={{ fontSize: 11.5, color: nomesEquipas.length ? T.mutedDim : T.warn, marginTop: 6 }}>
                    {nomesEquipas.length
                      ? 'O vídeo aparece no cartão de cada equipa, e cada uma fica com ficha em Scouting › Adversários (criada sozinha, se ainda não existir).'
                      : 'Ainda não há equipas nas competições — configura-as em Jogos › Competições e jornadas para as escolheres de uma lista.'}
                  </div>
                </div>
                {titulo}
                {descricao('Descrição / contexto (opcional)')}
              </>
            ) },
            { id: 'tema', conteudo: tema },
          ]} />
        );
      })()}

      <CamadasFixas ativa={source} camadas={[
        { id: 'link', conteudo: (
            <div style={{ marginBottom: 8 }}>
              <Field label="Link do vídeo">
                <Input value={f.url} onChange={e => { setF({ ...f, url: e.target.value }); setError(''); }} placeholder="https://youtu.be/... · instagram.com/reel/... · tiktok.com/@user/video/... · facebook.com/reel/..." />
              </Field>
              <p style={{ fontSize: 11.5, color: T.mutedDim, margin: '6px 0 0' }}>
                No TikTok, usa o link completo (com "/video/"), não o link curto (vm.tiktok.com). No Facebook, só vídeos e reels públicos, com o link completo (não fb.watch).
              </p>
            </div>
        ) },
        { id: 'file', conteudo: (
            <div style={{ marginBottom: 8 }}>
              <Field label="Ficheiro" bloco>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                    padding: '8px 14px', borderRadius: 8, border: `1px solid ${T.line}`,
                    background: T.surfaceRaise, color: T.cream, fontSize: 13, ...body,
                  }}>
                    {loadingFile ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {f.fileName ? 'Substituir ficheiro' : 'Carregar ficheiro'}
                    <input
                      type="file"
                      accept="application/pdf,image/*,video/*,.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                      onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {f.fileName && (
                    <span style={{ fontSize: 12, color: T.mutedDim, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fileName}</span>
                  )}
                </div>
              </Field>
            </div>
        ) },
        { id: 'drive', conteudo: (
            <div style={{ marginBottom: 8 }}>
              <Field label="Link de partilha do Google Drive">
                <Input
                  value={f.driveUrl || ''}
                  onChange={e => { setF({ ...f, driveUrl: e.target.value }); setError(''); }}
                  placeholder="https://drive.google.com/file/d/…/view?usp=sharing"
                />
              </Field>
              <div style={{
                fontSize: 11.5, color: T.mutedDim, marginTop: 10, lineHeight: 1.55,
                border: `1px solid ${T.line}`, borderRadius: 8, padding: '10px 12px', background: T.bg,
              }}>
                <div style={{ color: T.warn, marginBottom: 4 }}>Para documentos grandes ou que atualizas com frequência.</div>
                O ficheiro fica no Drive — aqui guarda-se só o link, por isso não há limite de tamanho
                nem risco de a gravação falhar.
                <br /><br />
                <span style={{ color: T.cream }}>Tem de estar partilhado como "qualquer pessoa com o link".</span> Caso contrário
                os teus adjuntos veem um pedido de acesso em vez do documento.
                <br /><br />
                A pré-visualização passa a ser a do próprio Google: a navegação de páginas, o deslize e o
                ecrã inteiro são os deles, não os nossos.
              </div>
            </div>
        ) },
      ]} />

      {error && <p style={{ fontSize: 12, color: T.bad, margin: '0 0 12px' }}>{error}</p>}
      {/* Rodapé fixo — este formulário tem bastantes campos (Canal, Jogo,
         Título, Jornada, link...) e antes disto era fácil perder de vista
         o botão de Guardar lá em baixo, sem se dar conta de que precisava
         de rolar para o encontrar. Fica sempre visível, o resto é que
         rola por baixo dele. O recuo negativo (-14/-22, o mesmo padding
         do Modal) é o que faz colar mesmo ao fundo da janela, sem deixar
         uma faixa escura a aparecer por baixo. */}
      <div style={{
        position: 'sticky', bottom: estreito ? -14 : -22,
        margin: estreito ? '10px -14px -14px' : '10px -22px -22px',
        padding: estreito ? '10px 14px' : '12px 22px',
        background: T.surfaceRaise, borderTop: `1px solid ${T.line}`,
        display: 'flex', justifyContent: 'flex-end', gap: 10,
      }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        {/* A fonte "Google Drive" só precisa do link — antes o botão exigia
            um ficheiro carregado (dataUrl) e ficava sempre desativado. */}
        <Btn
          disabled={!f.title || (source === 'link' ? !f.url : source === 'drive' ? !f.driveUrl : !f.dataUrl)}
          onClick={handleSave}
        ><Check size={15} /> Guardar</Btn>
      </div>
    </Modal>
  );
}

