// diario/Diario.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useRascunho, BannerRascunho } from '../base/sincronizacao';
import { AlertTriangle, Clock, Users, Dumbbell, Building2, Wrench, FileText, Tag, CheckCircle2, Circle, Plus, Upload, BookOpen, X, Check, Search, Printer, Trophy, Pencil, Trash2 } from 'lucide-react';
import { T, body, mono, display } from '../base/tema';
import { faltaDoAtleta, chaveDoTipo, COR_CARTAO, MiniCartao } from '../dominio/faltas';
import { todayStr, escapeHtmlText, semAcentos, uid, addDays, fmtShort, fmtDate } from '../base/utilidades';
import { useIsMobile, removeWithUndo, itemLabel, Btn, SectionHeader, Modal, Field, Input, TextArea, EmptyState, Select } from '../base/ui';
import { useState, useRef } from 'react';
import { shortPlayerName, sortByPosition } from '../dominio/jogadores';
import { ficheiroParaAnexo, UrlAnexo, hrefDescarga } from '../base/anexos';
import { notasDoJogo, pedirNovaMissao } from '../competicao/RelatoriosJogo';
import { ListaMultipla } from '../base/ui-extra';
import { competitionLabel } from '../dominio/jogos';
import { dataPt } from '../gestao/documentos';

/* DIÁRIO — registo de ocorrências por tipo.

   O Diário era título + texto livre e misturava coisas de natureza
   diferente: disciplina e faltas (sobre um atleta), falhas do clube e
   das instalações (sobre o clube), reuniões, e até notas de jogo. Nada
   disso se cruzava — ninguém sabia quantas vezes um atleta já tinha tido
   problemas, nem quantas falhas do clube houve na época.

   Agora cada registo tem um TIPO, e o formulário muda com ele. Continua a
   viver na mesma coleção (`diario`) e com os mesmos campos de base (data,
   título, nota, anexo, autor), por isso nada do que existe se perde: as
   notas antigas, sem tipo, são classificadas pelo título no momento de
   mostrar (`chaveDoTipo`) e ficam com o tipo certo assim que alguém as
   edita e grava.

   CATEGORIAS NOVAS: não há tabela de categorias. Quem cria uma ocorrência
   pode escrever uma categoria nova (`tipo: 'outra'` + `tipoNome`); a
   partir daí ela aparece como opção para toda a equipa, porque a lista é
   tirada das próprias ocorrências. Se deixar de haver ocorrências dessa
   categoria, ela desaparece sozinha.

   As notas de jogo saíram daqui: vivem agora dentro de cada jogo, em
   Jogos › Relatórios de jogo (o "+" do cartão do jogo). As antigas
   passam-se para lá com o troféu de cada nota livre. */
export const TIPOS_DIARIO = [
  { id: 'disciplina', label: 'Disciplina', icon: AlertTriangle, cor: () => T.bad, texto: 'O que aconteceu', atletas: true },
  { id: 'faltas', label: 'Faltas e atrasos', icon: Clock, cor: () => T.warn, texto: 'Notas (opcional)', atletas: true },
  { id: 'reunioes', label: 'Reuniões', icon: Users, cor: () => T.good, texto: 'Resumo da reunião', atletas: true },
  { id: 'treino', label: 'Treino', icon: Dumbbell, cor: () => '#3FA9B8', texto: 'O que aconteceu no treino', atletas: true },
  { id: 'clube', label: 'Clube', icon: Building2, cor: () => T.teamB, texto: 'O que falhou', estadoInicial: 'aberta' },
  { id: 'infra', label: 'Infraestruturas', icon: Wrench, cor: () => '#A272C4', texto: 'O problema', estadoInicial: 'aberta' },
  { id: 'nota', label: 'Nota livre', icon: FileText, cor: () => T.muted, texto: 'Nota', atletas: true },
];

export const PALETA_CATEGORIAS = ['#5FAE7E', '#C9804F', '#7F93D6', '#B8749F', '#8FA552'];

export const CONSEQUENCIAS_DISCIPLINA = ['Aviso', 'Saiu do treino', 'Não convocado', 'Dispensado do jogo', 'Suspenso', 'Reunião com a família'];

export const COM_QUEM_REUNIAO = ['Equipa técnica', 'Coordenação', 'Direção', 'Encarregados de educação', 'Atleta', 'Outro'];

export const CATEGORIAS_CLUBE = ['Posto médico', 'Horários e marcações', 'Transporte', 'Material', 'Equipamentos', 'Comunicação', 'Outra'];

export const CATEGORIAS_INFRA = ['Campo', 'Balneários', 'Iluminação', 'Ginásio', 'Arrecadação', 'Outra'];

export function infoDoTipo(chave, nomesCustom) {
  const fixo = TIPOS_DIARIO.find(t => t.id === chave);
  if (fixo) return { ...fixo, corHex: fixo.cor() };
  const nome = (nomesCustom && nomesCustom[chave]) || chave.replace(/^c:/, '');
  let h = 0;
  for (let i = 0; i < chave.length; i++) h = (h * 31 + chave.charCodeAt(i)) >>> 0;
  return { id: chave, label: nome, icon: Tag, corHex: PALETA_CATEGORIAS[h % PALETA_CATEGORIAS.length], texto: 'O que aconteceu', atletas: true, custom: true };
}

/* Só o que interessa ao tipo escolhido — trocar de tipo a meio do
   formulário não deixa campos de outro tipo esquecidos no registo. */
export function limparOcorrencia(f) {
  const o = { data: f.data, tipo: f.tipo, titulo: f.titulo || '', nota: f.nota || '', attachment: f.attachment || null };
  const info = TIPOS_DIARIO.find(t => t.id === f.tipo);
  if (f.tipo === 'outra') o.tipoNome = (f.tipoNome || '').trim();
  if (f.tipo === 'outra' || (info && info.atletas)) o.atletas = f.atletas || [];
  if (f.tipo === 'disciplina') { o.cartao = f.cartao || 'amarelo'; o.consequencias = f.consequencias || []; }
  if (f.tipo === 'faltas') {
    o.faltaTipo = f.faltaTipo || 'falta'; o.justificada = !!f.justificada;
    const atl = f.atletas || [];
    if (atl.length >= 2 && f.porAtleta) {
      o.porAtleta = {};
      atl.forEach(pid => {
        const d = faltaDoAtleta(f, pid);
        o.porAtleta[pid] = { faltaTipo: d.faltaTipo, justificada: d.justificada, motivo: (d.motivo || '').trim() };
      });
    }
  }
  if (f.tipo === 'reunioes') { o.comQuem = f.comQuem || ''; o.participantes = f.participantes || ''; o.decisoes = f.decisoes || ''; }
  if (f.tipo === 'clube' || f.tipo === 'infra') o.categoria = f.categoria || '';
  if (f.estado) {
    o.estado = f.estado;
    o.seguimento = f.seguimento || '';
    if (f.estado === 'resolvida') { o.resolvidaEm = f.resolvidaEm || new Date().toISOString(); if (f.resolvidaPor) o.resolvidaPor = f.resolvidaPor; }
  }
  return o;
}

export const EMPTY_OCORRENCIA = () => ({
  data: todayStr(), tipo: '', tipoNome: '', titulo: '', nota: '', attachment: null,
  atletas: [], cartao: 'amarelo', consequencias: [], faltaTipo: 'falta', justificada: false,
  comQuem: '', participantes: '', decisoes: '', categoria: '', estado: '', seguimento: '',
});

/* Seguimento: aberta → (comunicada, só para falhas do clube e
   instalações, que dependem de outros) → resolvida → aberta outra vez. */
export function proximoEstado(chave, estado) {
  const comComunicada = chave === 'clube' || chave === 'infra';
  if (estado === 'aberta') return comComunicada ? 'comunicada' : 'resolvida';
  if (estado === 'comunicada') return 'resolvida';
  return 'aberta';
}

export const ROTULO_ESTADO = { aberta: 'Por resolver', comunicada: 'Comunicada', resolvida: 'Resolvida' };

export function ChipEscolha({ on, cor, onClick, children, title }) {
  const c = cor || T.gold;
  return (
    <button type="button" onClick={onClick} title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 18, cursor: 'pointer', ...body, fontSize: 12.5,
      background: on ? `${c}26` : 'transparent', color: on ? T.cream : T.muted, border: `1px solid ${on ? c : T.line}`,
    }}>{children}</button>
  );
}

/* FALTAS QUE VÊM DAS PRESENÇAS — não se escrevem duas vezes.

   Uma falta marcada em Presenças (o "F" na tabela) aparece sozinha no
   Diário, no tema Faltas e atrasos: um cartão por dia (treino) ou por
   jogo, com os atletas que faltaram. Não é gravada no Diário — é lida
   das Presenças cada vez, por isso tirar a falta lá tira-a daqui.

   Para acrescentar o motivo (ou "justificada"), o cartão tem "Acrescentar
   motivo": cria uma ocorrência normal de Faltas com esses atletas, e a
   partir daí esses atletas, nesse dia, deixam de aparecer no cartão
   automático (já estão no registo com motivo).

   Os registos antigos de faltas, escritos à mão antes disto (sem atletas
   escolhidos, só texto), tapam o cartão automático desse dia — já lá está
   o que aconteceu, contado à mão. */
export function faltasDasPresencas(sessions, matches, diario) {
  const hoje = todayStr();
  const manuais = (diario || []).filter(n => chaveDoTipo(n) === 'faltas');
  const diaTapado = new Set(manuais.filter(n => !(n.atletas || []).length).map(n => n.data));
  const jaRegistado = (data, pid) => manuais.some(n => n.data === data && (n.atletas || []).includes(pid));
  const porDia = {};
  (sessions || []).forEach(s => {
    if (!s || !s.date || s.date > hoje || !(s.faltas || []).length) return;
    (porDia[s.date] = porDia[s.date] || new Set());
    s.faltas.forEach(pid => porDia[s.date].add(pid));
  });
  const lista = [];
  Object.entries(porDia).forEach(([data, ids]) => {
    if (diaTapado.has(data)) return;
    const atletas = [...ids].filter(pid => !jaRegistado(data, pid));
    if (atletas.length) lista.push({ id: `pres-t-${data}`, data, tipo: 'faltas', faltaTipo: 'falta', atletas, derivada: true, origem: 'treino' });
  });
  (matches || []).forEach(m => {
    if (!m || !m.date || m.date > hoje || !(m.faltas || []).length || diaTapado.has(m.date)) return;
    const atletas = m.faltas.filter(pid => !jaRegistado(m.date, pid));
    if (atletas.length) lista.push({ id: `pres-j-${m.id}`, data: m.date, tipo: 'faltas', faltaTipo: 'falta', atletas, derivada: true, origem: 'jogo', adversario: m.opponent || '' });
  });
  return lista;
}

/* RELATÓRIO PARA A COORDENAÇÃO — Clube e Infraestruturas, em PDF.

   Abre uma página própria, limpa e a preto e branco, e chama a impressão:
   no telemóvel ou no computador escolhe-se "Guardar como PDF". Tem o
   resumo (quantas por categoria e por estado) e a lista completa, da mais
   antiga para a mais recente. */
export function exportarRelatorioClube(diario) {
  const itens = (diario || []).filter(n => { const k = chaveDoTipo(n); return k === 'clube' || k === 'infra'; })
    .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')));
  const win = window.open('', '_blank');
  if (!win) { window.alert('O browser bloqueou a janela do relatório. Permite janelas deste site e tenta outra vez.'); return; }
  const esc = escapeHtmlText;
  const dataPt = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
  const estadoTxt = (n) => (n.estado === 'resolvida' ? 'Resolvida' : n.estado === 'comunicada' ? 'Comunicada' : n.estado === 'aberta' ? 'Por resolver' : '—');
  const conta = (f) => itens.filter(f).length;
  const categorias = {};
  itens.forEach(n => { const c = n.categoria || 'Sem categoria'; categorias[c] = (categorias[c] || 0) + 1; });
  const linhasResumo = Object.entries(categorias).sort((a, b) => b[1] - a[1])
    .map(([c, k]) => `<tr><td>${esc(c)}</td><td class="num">${k}</td></tr>`).join('');
  const linhas = itens.map(n => {
    const tipo = chaveDoTipo(n) === 'infra' ? 'Infraestruturas' : 'Clube';
    return `<tr>
      <td class="data">${esc(dataPt(n.data))}</td>
      <td>${esc(tipo)}${n.categoria ? `<br><span class="sub">${esc(n.categoria)}</span>` : ''}</td>
      <td>${n.titulo ? `<strong>${esc(n.titulo)}</strong><br>` : ''}${esc(n.nota || '').replace(/\n/g, '<br>')}${n.seguimento ? `<br><span class="sub">Seguimento: ${esc(n.seguimento)}</span>` : ''}</td>
      <td>${esc(estadoTxt(n))}</td>
    </tr>`;
  }).join('');
  const primeiro = itens[0] ? dataPt(itens[0].data) : '';
  const ultimo = itens.length ? dataPt(itens[itens.length - 1].data) : '';
  const titulo = 'Ocorrências do clube e infraestruturas';
  win.document.write(`<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 11pt; margin: 0; }
  h1 { font-size: 17pt; margin: 0 0 2mm; }
  .periodo { color: #555; margin-bottom: 6mm; }
  .caixas { display: flex; gap: 4mm; margin-bottom: 6mm; }
  .caixa { border: 1px solid #bbb; border-radius: 2mm; padding: 3mm 4mm; flex: 1; }
  .caixa b { display: block; font-size: 16pt; }
  h2 { font-size: 12pt; margin: 6mm 0 2mm; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #ccc; padding: 2mm; text-align: left; vertical-align: top; }
  th { font-size: 9pt; text-transform: uppercase; color: #444; border-bottom: 1.5px solid #333; }
  td.data { white-space: nowrap; }
  td.num { text-align: right; width: 20mm; }
  .sub { color: #666; font-size: 9.5pt; }
  tr { page-break-inside: avoid; }
</style></head><body>
<h1>${esc(titulo)}</h1>
<div class="periodo">${itens.length ? `De ${esc(primeiro)} a ${esc(ultimo)} · ` : ''}gerado a ${esc(dataPt(todayStr()))}</div>
<div class="caixas">
  <div class="caixa"><b>${itens.length}</b>ocorrências</div>
  <div class="caixa"><b>${conta(n => n.estado === 'aberta' || n.estado === 'comunicada')}</b>por resolver</div>
  <div class="caixa"><b>${conta(n => n.estado === 'resolvida')}</b>resolvidas</div>
</div>
${itens.length ? `<h2>Por categoria</h2><table>${linhasResumo}</table>
<h2>Registo</h2>
<table><thead><tr><th>Data</th><th>Tema</th><th>O que aconteceu</th><th>Estado</th></tr></thead><tbody>${linhas}</tbody></table>` : '<p>Sem ocorrências registadas.</p>'}
</body></html>`);
  win.document.close();
  const imprimir = () => { try { win.focus(); win.print(); } catch (err) { /* imprime-se pelo menu */ } };
  setTimeout(imprimir, 400);
}

export function Diario({ diario, setDiario, diarioMeta = {}, userEmail, players = [], matches = [], setMatches, season, sessions = [] }) {
  const isMobile = useIsMobile();
  const [formOpen, setFormOpen] = useState(false);
  // Quando se está a editar uma ocorrência já existente, guarda-se aqui o
  // id dela; a null significa que se está a criar uma nova.
  const [editingId, setEditingId] = useState(null);
  const [f, setF] = useState(EMPTY_OCORRENCIA);
  // Rascunho (área sensível: apaga-se ao sair da sessão; ver useRascunho).
  const { rascunhoEncontrado, restaurar, descartar, limpar } = useRascunho(`rascunho_diario_${editingId || 'novo'}`, f, setF, formOpen, { sensivel: true });
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [attachError, setAttachError] = useState('');
  const [aCarregarAnexo, setACarregarAnexo] = useState(false);
  const [verTudo, setVerTudo] = useState(false);
  const [filtro, setFiltro] = useState(null);
  const [novaCategoria, setNovaCategoria] = useState(false);
  // Nota a mover para as notas da equipa técnica de um jogo: { id, jogo }.
  const [aMover, setAMover] = useState(null);
  // Para levar o cursor direito ao texto ao editar (ver startEdit).
  const notaRef = useRef(null);

  const nomeAtleta = (pid) => {
    const p = players.find(x => x.id === pid);
    return p ? shortPlayerName(p, players) : 'Atleta removido';
  };

  // Categorias criadas pela equipa, tiradas das próprias ocorrências.
  const nomesCustom = {};
  diario.forEach(n => {
    if (n.tipo === 'outra' && n.tipoNome && n.tipoNome.trim()) {
      const k = `c:${semAcentos(n.tipoNome)}`;
      if (!nomesCustom[k]) nomesCustom[k] = n.tipoNome.trim();
    }
  });
  const chavesCustom = Object.keys(nomesCustom).sort((a, b) => nomesCustom[a].localeCompare(nomesCustom[b]));

  /* CADASTRO DISCIPLINAR: para cada atleta, as ocorrências de
     disciplina por ordem de data. Serve para escrever "2.º" no cartão e
     avisar a partir do 3.º amarelo, como na acumulação. */
  const cadastro = {};
  diario.filter(n => chaveDoTipo(n) === 'disciplina')
    .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')) || String(a.criadoEm || '').localeCompare(String(b.criadoEm || '')))
    .forEach(n => (n.atletas || []).forEach(pid => {
      (cadastro[pid] = cadastro[pid] || []).push({ id: n.id, cartao: n.cartao || 'amarelo' });
    }));
  const contagemCartao = (pid, n) => {
    const lista = cadastro[pid] || [];
    const cor = n.cartao || 'amarelo';
    let k = 0;
    for (const x of lista) { if (x.cartao === cor) k++; if (x.id === n.id) break; }
    return k;
  };

  const handleAttachmentFile = async (file) => {
    setAttachError('');
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if (!isImage && !isPdf) {
      setAttachError('Só são aceites fotos/imagens ou ficheiros PDF.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setAttachError('Ficheiro demasiado grande (máx. 8 MB).');
      return;
    }
    setACarregarAnexo(true);
    try {
      const { campos } = await ficheiroParaAnexo(file, { pasta: 'diario', privado: true });
      setF(prev => ({ ...prev, attachment: { name: file.name, type: isPdf ? 'pdf' : 'image', ...campos } }));
    } finally {
      setACarregarAnexo(false);
    }
  };

  const escolherTipo = (id, nome) => setF(prev => {
    const info = TIPOS_DIARIO.find(t => t.id === id);
    const estadoBase = info && info.estadoInicial ? info.estadoInicial : '';
    // Ao mudar de tipo, o seguimento por omissão acompanha o tipo novo —
    // a não ser que já se tenha escrito o que falta fazer.
    const manterEstado = prev.estado && (prev.seguimento || '').trim();
    return { ...prev, tipo: id, tipoNome: id === 'outra' ? (nome || '') : '', estado: manterEstado ? prev.estado : estadoBase };
  });

  const temConteudo = !!(f.nota.trim() || f.attachment || (f.atletas || []).length || f.decisoes.trim());
  const podeGravar = !!f.tipo && (f.tipo !== 'outra' || !!f.tipoNome.trim()) && temConteudo && !aCarregarAnexo;

  const save = () => {
    if (!podeGravar) return;
    limpar();
    const limpo = limparOcorrencia({ ...f, resolvidaPor: f.estado === 'resolvida' ? (f.resolvidaPor || userEmail) : undefined });
    if (editingId) {
      // Ao editar, o autor e a data de criação originais mantêm-se;
      // regista-se quem alterou.
      setDiario(prev => prev.map(n => (n.id === editingId
        ? { ...limpo, id: editingId, autor: n.autor || userEmail, criadoEm: n.criadoEm, editadoPor: userEmail, editadoEm: new Date().toISOString() }
        : n)));
    } else {
      setDiario(prev => [{ ...limpo, id: uid(), autor: userEmail, criadoEm: new Date().toISOString() }, ...prev]);
    }
    closeForm();
  };
  /* Nova ocorrência: o formulário abre logo completo. O tipo vem já
     escolhido — o tema que está filtrado no placard, ou Nota livre — e
     muda-se com um toque nos botões do topo. */
  const abrirNova = () => {
    const base = EMPTY_OCORRENCIA();
    if (filtro && filtro.startsWith('c:')) { base.tipo = 'outra'; base.tipoNome = nomesCustom[filtro] || ''; }
    else {
      base.tipo = filtro || 'nota';
      const info = TIPOS_DIARIO.find(t => t.id === base.tipo);
      if (info && info.estadoInicial) base.estado = info.estadoInicial;
    }
    setF(base);
    setEditingId(null);
    setAttachError('');
    setNovaCategoria(false);
    setFormOpen(true);
  };
  // Cartão automático das Presenças → ocorrência com motivo.
  const acrescentarMotivo = (n) => {
    setF({ ...EMPTY_OCORRENCIA(), tipo: 'faltas', data: n.data, atletas: [...(n.atletas || [])], faltaTipo: 'falta', justificada: false });
    setEditingId(null);
    setAttachError('');
    setNovaCategoria(false);
    setFormOpen(true);
  };
  const closeForm = () => {
    setF(EMPTY_OCORRENCIA());
    setEditingId(null);
    setAttachError('');
    setNovaCategoria(false);
    setFormOpen(false);
  };
  const startEdit = (n) => {
    const chave = chaveDoTipo(n);
    const ehCustom = chave.startsWith('c:');
    setF({
      ...EMPTY_OCORRENCIA(),
      ...n,
      data: n.data || todayStr(),
      tipo: ehCustom ? 'outra' : chave,
      tipoNome: ehCustom ? (n.tipoNome || '') : '',
      titulo: n.titulo || '', nota: n.nota || '', attachment: n.attachment || null,
      atletas: n.atletas || [], consequencias: n.consequencias || [],
      comQuem: n.comQuem || '', participantes: n.participantes || '', decisoes: n.decisoes || '',
      categoria: n.categoria || '', estado: n.estado || '', seguimento: n.seguimento || '',
    });
    setEditingId(n.id);
    setAttachError('');
    setNovaCategoria(false);
    setFormOpen(true);
    /* O cursor vai direito ao texto. O `setTimeout` é preciso porque o
       formulário ainda não existe no ecrã no instante em que se carrega no
       lápis — só depois de o React o desenhar é que há onde pôr o cursor. */
    setTimeout(() => {
      const el = notaRef.current;
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      try { el.focus({ preventScroll: true }); } catch (err) { el.focus(); }
    }, 60);
  };
  const remove = (id) => removeWithUndo(
    diario, setDiario, id, itemLabel(diario.find(n => n.id === id), 'Ocorrência'),
    () => { if (editingId === id) closeForm(); },
  );
  const avancarEstado = (n) => {
    const seguinte = proximoEstado(chaveDoTipo(n), n.estado);
    setDiario(prev => prev.map(x => {
      if (x.id !== n.id) return x;
      const novo = { ...x, estado: seguinte };
      if (seguinte === 'resolvida') { novo.resolvidaEm = new Date().toISOString(); novo.resolvidaPor = userEmail; }
      else { delete novo.resolvidaEm; delete novo.resolvidaPor; }
      return novo;
    }));
  };

  /* MOVER PARA O JOGO — as notas de jogo antigas (escritas aqui antes de
     haver notas nos jogos) passam para o próprio jogo, em Jogos ›
     Relatórios de jogo, com o mesmo autor e a mesma data. Sugere-se o
     jogo cujo adversário aparece no título ou no texto, o mais perto da
     data da nota; se nenhum aparecer, o jogo mais perto da data. */
  const jogosParaMover = (n) => {
    const txt = semAcentos(`${n.titulo || ''} ${n.nota || ''}`);
    const dist = (m) => Math.abs(new Date(m.date) - new Date(n.data || todayStr()));
    const nomeia = (m) => { const o = semAcentos(m.opponent); return o.length > 2 && txt.includes(o); };
    // Só jogos já realizados: é aí que vive a "análise do jogo" (Jogos ›
    // Relatórios de jogo). Um jogo futuro escondia a nota até ao dia do jogo.
    const hoje = todayStr();
    return (matches || []).filter(m => m && m.date && m.date <= hoje)
      .sort((a, b) => (nomeia(b) - nomeia(a)) || (dist(a) - dist(b)));
  };
  const abrirMover = (n) => {
    const lista = jogosParaMover(n);
    setAMover({ id: n.id, jogo: lista[0] ? lista[0].id : '' });
  };
  const confirmarMover = (n) => {
    if (!aMover || !aMover.jogo || !setMatches) return;
    const jogo = (matches || []).find(m => m.id === aMover.jogo);
    if (!jogo) return;
    const titulo = (n.titulo || '').trim();
    // O título só entra se disser mais do que o nome do adversário.
    const tituloUtil = titulo && !semAcentos(jogo.opponent).includes(semAcentos(titulo));
    const texto = [tituloUtil ? titulo : '', n.nota || ''].filter(Boolean).join('\n');
    const autor = n.autor || (diarioMeta[n.id] && diarioMeta[n.id].email) || '';
    const nota = { id: uid(), texto, autor, em: n.criadoEm || `${n.data || todayStr()}T12:00:00.000Z`, ...(n.attachment ? { attachment: n.attachment } : {}) };
    setMatches(prev => prev.map(m => (m.id === jogo.id ? { ...m, notasEquipaTecnica: [...notasDoJogo(m), nota] } : m)));
    setDiario(prev => prev.filter(x => x.id !== n.id));
    setAMover(null);
    if (editingId === n.id) closeForm();
  };

  /* PESQUISA: além do título e do texto, procura nos nomes dos atletas,
     na categoria, no tipo, nas decisões e no seguimento. */
  const textoPesquisavel = (n) => [
    n.titulo, n.nota, n.decisoes, n.seguimento, n.categoria, n.comQuem, n.participantes, n.tipoNome,
    infoDoTipo(chaveDoTipo(n), nomesCustom).label,
    ...(n.atletas || []).map(nomeAtleta),
  ].filter(Boolean).join(' ');
  const todas = [...diario, ...faltasDasPresencas(sessions, matches, diario)];
  const filtered = search
    ? todas.filter(n => semAcentos(textoPesquisavel(n)).includes(semAcentos(search)))
    : todas;

  /* Por omissão só a última semana — é o que se consulta no dia a dia; o
     resto está a um clique. Uma pesquisa mostra sempre tudo. */
  const limiteSemana = addDays(todayStr(), -6);
  /* Também por tema: escolher um tema no placard mostra a última semana
     DESSE tema, e "Ver todas" abre as mais antigas só desse tema (o número
     do botão é o desse tema). */
  const doTema = filtro ? filtered.filter(n => chaveDoTipo(n) === filtro) : filtered;
  const recentes = doTema.filter(n => (n.data || '') >= limiteSemana);
  const antigas = doTema.length - recentes.length;
  const visiveis = (search || verTudo) ? doTema : recentes;
  const sorted = [...visiveis].sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')));

  /* PLACARD: o TOTAL de cada tema (todas as datas; numa pesquisa, só o
     que corresponde), e por baixo quantas foram nos últimos 7 dias. Os
     números não mudam ao abrir as mais antigas, e os temas são sempre os
     mesmos — nada salta de sítio. */
  const contagens = {};
  const contagensSemana = {};
  filtered.forEach(n => {
    const k = chaveDoTipo(n);
    contagens[k] = (contagens[k] || 0) + 1;
    if ((n.data || '') >= limiteSemana) contagensSemana[k] = (contagensSemana[k] || 0) + 1;
  });
  const chavesPlacard = [...TIPOS_DIARIO.map(t => t.id), ...chavesCustom];

  // POR RESOLVER: tudo o que tem seguimento em aberto, de qualquer data.
  const pendentes = diario.filter(n => n.estado === 'aberta' || n.estado === 'comunicada')
    .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')));

  const chaveForm = f.tipo === 'outra' ? `c:${semAcentos(f.tipoNome)}` : f.tipo;
  const infoForm = f.tipo ? infoDoTipo(chaveForm, { [chaveForm]: f.tipoNome || 'Nova categoria' }) : null;
  const mostraAtletas = !!(infoForm && infoForm.atletas);
  const alternarLista = (campo, v) => setF(prev => ({ ...prev, [campo]: (prev[campo] || []).includes(v) ? prev[campo].filter(x => x !== v) : [...(prev[campo] || []), v] }));

  const pillEstado = (n) => {
    if (!n.estado) return null;
    const cor = n.estado === 'resolvida' ? T.good : n.estado === 'comunicada' ? T.teamB : T.warn;
    const seguinte = proximoEstado(chaveDoTipo(n), n.estado);
    return (
      <button type="button" onClick={() => avancarEstado(n)} title={`Marcar como: ${ROTULO_ESTADO[seguinte].toLowerCase()}`} style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 14, cursor: 'pointer', ...body, fontSize: 11.5,
        background: `${cor}22`, color: cor, border: `1px solid ${cor}66`, flexShrink: 0,
      }}>
        {n.estado === 'resolvida' ? <CheckCircle2 size={12} /> : <Circle size={10} />}
        {ROTULO_ESTADO[n.estado]}
      </button>
    );
  };

  return (
    <div>
      <SectionHeader title="Diário" subtitle="O que acontece no dia a dia da equipa."
        action={<Btn onClick={abrirNova}><Plus size={15} /> Nova ocorrência</Btn>} />

      {/* O formulário abre numa janela por cima, e não no topo da página:
          assim abrir, editar ou fechar não empurra nada do que está por
          baixo (placard, por resolver, lista). */}
      {formOpen && (
        <Modal title={editingId ? 'Editar ocorrência' : 'Nova ocorrência'} onClose={closeForm} fullPage larguraMax="860px">
        <BannerRascunho rascunho={rascunhoEncontrado} onRestaurar={restaurar} onDescartar={descartar} />
        <div style={{ borderLeft: `3px solid ${infoForm ? infoForm.corHex : 'transparent'}`, paddingLeft: 14 }}>
          {/* 1. O TIPO — um toque; o resto do formulário depende dele. */}
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 8, ...body }}>Tipo</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: f.tipo ? 16 : 4 }}>
            {TIPOS_DIARIO.map(t => {
              const Ic = t.icon;
              return (
                <ChipEscolha key={t.id} on={f.tipo === t.id} cor={t.cor()} onClick={() => { setNovaCategoria(false); escolherTipo(t.id); }}>
                  <Ic size={14} color={t.cor()} /> {t.label}
                </ChipEscolha>
              );
            })}
            {chavesCustom.map(k => {
              const info = infoDoTipo(k, nomesCustom);
              const on = f.tipo === 'outra' && !novaCategoria && chaveForm === k;
              return (
                <ChipEscolha key={k} on={on} cor={info.corHex} onClick={() => { setNovaCategoria(false); escolherTipo('outra', nomesCustom[k]); }}>
                  <Tag size={13} color={info.corHex} /> {info.label}
                </ChipEscolha>
              );
            })}
            <ChipEscolha on={novaCategoria} onClick={() => { setNovaCategoria(true); escolherTipo('outra', ''); }} title="Criar uma categoria nova, que fica disponível para toda a equipa">
              <Plus size={13} /> Nova categoria
            </ChipEscolha>
          </div>
          {novaCategoria && (
            <div style={{ marginBottom: 16, maxWidth: 360 }}>
              <Field label="Nome da categoria" solto>
                <Input autoFocus value={f.tipoNome} onChange={e => setF({ ...f, tipo: 'outra', tipoNome: e.target.value })} placeholder="Ex.: Transportes, Arbitragem…" />
              </Field>
            </div>
          )}

          {f.tipo && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: 12, marginBottom: 12 }}>
                <Field label="Data"><Input type="date" value={f.data} onChange={e => setF({ ...f, data: e.target.value })} /></Field>
                <Field label="Título (opcional)"><Input value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} /></Field>
              </div>

              {mostraAtletas && (
                <div style={{ marginBottom: 12 }}>
                  <Field label={f.tipo === 'disciplina' || f.tipo === 'faltas' ? 'Atletas' : 'Atletas envolvidos (opcional)'} bloco solto>
                    <ListaMultipla
                      itens={sortByPosition(players).map(p => ({ id: p.id, rotulo: shortPlayerName(p, players), prefixo: p.position || '--' }))}
                      escolhidos={f.atletas}
                      onAlternar={(pid) => alternarLista('atletas', pid)}
                      comProcura
                      resumo={f.atletas.length ? `${f.atletas.length} atleta${f.atletas.length > 1 ? 's' : ''}` : 'Escolher atletas'}
                    />
                  </Field>
                </div>
              )}

              {f.tipo === 'disciplina' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
                  <Field label="Gravidade" bloco solto>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {[['amarelo', 'Amarelo · menos grave'], ['vermelho', 'Vermelho · grave']].map(([id, rot]) => (
                        <ChipEscolha key={id} on={f.cartao === id} cor={COR_CARTAO[id]} onClick={() => setF({ ...f, cartao: id })}>
                          <MiniCartao cor={id} /> {rot}
                        </ChipEscolha>
                      ))}
                    </div>
                  </Field>
                  <Field label="Consequência" bloco solto>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {CONSEQUENCIAS_DISCIPLINA.map(c => (
                        <ChipEscolha key={c} on={f.consequencias.includes(c)} cor={T.bad} onClick={() => alternarLista('consequencias', c)}>{c}</ChipEscolha>
                      ))}
                    </div>
                  </Field>
                </div>
              )}

              {f.tipo === 'faltas' && (() => {
                const varios = (f.atletas || []).length >= 2;
                // Os chips de cima valem para TODOS: mudam também cada atleta.
                const paraTodos = (patch) => {
                  const pa = { ...(f.porAtleta || {}) };
                  (f.atletas || []).forEach(pid => { pa[pid] = { ...faltaDoAtleta(f, pid), ...patch }; });
                  setF({ ...f, ...patch, porAtleta: varios ? pa : f.porAtleta });
                };
                const mudarAtleta = (pid, patch) => {
                  const pa = { ...(f.porAtleta || {}) };
                  pa[pid] = { ...faltaDoAtleta(f, pid), ...patch };
                  setF({ ...f, porAtleta: pa });
                };
                const igual = (campo, v) => !varios ? f[campo] === v || (campo === 'justificada' && !!f.justificada === v)
                  : (f.atletas || []).every(pid => faltaDoAtleta(f, pid)[campo] === v);
                return (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {varios && <span style={{ fontSize: 11.5, color: T.mutedDim, textTransform: 'uppercase', letterSpacing: '.05em' }}>Todos:</span>}
                      {[['falta', 'Falta'], ['atraso', 'Atraso']].map(([id, rot]) => (
                        <ChipEscolha key={id} on={igual('faltaTipo', id)} cor={T.warn} onClick={() => paraTodos({ faltaTipo: id })}>{rot}</ChipEscolha>
                      ))}
                      <span style={{ width: 1, alignSelf: 'stretch', background: T.line, margin: '0 4px' }} />
                      {[[false, 'Injustificada'], [true, 'Justificada']].map(([v, rot]) => (
                        <ChipEscolha key={rot} on={igual('justificada', v)} cor={v ? T.good : T.bad} onClick={() => paraTodos({ justificada: v })}>{rot}</ChipEscolha>
                      ))}
                    </div>
                    {varios && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, padding: 10, borderRadius: 10, background: T.surface, border: `1px solid ${T.line}` }}>
                        <div style={{ fontSize: 11.5, color: T.mutedDim }}>Cada atleta pode ter a sua justificação e o seu motivo:</div>
                        {(f.atletas || []).map(pid => {
                          const d = faltaDoAtleta(f, pid);
                          return (
                            <div key={pid} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                              <span style={{ minWidth: 90, fontSize: 13, color: T.cream, fontWeight: 600 }}>{nomeAtleta(pid)}</span>
                              {[['falta', 'Falta'], ['atraso', 'Atraso']].map(([id, rot]) => (
                                <ChipEscolha key={id} on={d.faltaTipo === id} cor={T.warn} onClick={() => mudarAtleta(pid, { faltaTipo: id })}>{rot}</ChipEscolha>
                              ))}
                              {[[false, 'Injustificada'], [true, 'Justificada']].map(([v, rot]) => (
                                <ChipEscolha key={rot} on={d.justificada === v} cor={v ? T.good : T.bad} onClick={() => mudarAtleta(pid, { justificada: v })}>{rot}</ChipEscolha>
                              ))}
                              <input value={d.motivo} onChange={e => mudarAtleta(pid, { motivo: e.target.value })} placeholder="Motivo (ex.: doente)" maxLength={120}
                                style={{ flex: '1 1 160px', minWidth: 140, background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: '6px 10px', color: T.cream, fontSize: 12.5, ...body }} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {f.tipo === 'reunioes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
                  <Field label="Com quem" bloco solto>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {COM_QUEM_REUNIAO.map(c => (
                        <ChipEscolha key={c} on={f.comQuem === c} cor={T.good} onClick={() => setF({ ...f, comQuem: f.comQuem === c ? '' : c })}>{c}</ChipEscolha>
                      ))}
                    </div>
                  </Field>
                  <Field label="Participantes (opcional)" solto>
                    <Input value={f.participantes} onChange={e => setF({ ...f, participantes: e.target.value })} placeholder="Quem esteve presente" />
                  </Field>
                </div>
              )}

              {(f.tipo === 'clube' || f.tipo === 'infra') && (
                <div style={{ marginBottom: 12 }}>
                  <Field label="Categoria" bloco solto>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(f.tipo === 'clube' ? CATEGORIAS_CLUBE : CATEGORIAS_INFRA).map(c => (
                        <ChipEscolha key={c} on={f.categoria === c} cor={infoForm.corHex} onClick={() => setF({ ...f, categoria: f.categoria === c ? '' : c })}>{c}</ChipEscolha>
                      ))}
                    </div>
                  </Field>
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <Field label={infoForm ? infoForm.texto : 'Nota'}><TextArea ref={notaRef} value={f.nota} onChange={e => setF({ ...f, nota: e.target.value })} style={{ minHeight: 110 }} /></Field>
              </div>

              {f.tipo === 'reunioes' && (
                <div style={{ marginBottom: 14 }}>
                  <Field label="Decisões e próximos passos"><TextArea value={f.decisoes} onChange={e => setF({ ...f, decisoes: e.target.value })} style={{ minHeight: 70 }} placeholder="Uma por linha" /></Field>
                </div>
              )}

              {/* SEGUIMENTO: o que ainda não está fechado aparece em
                  "Por resolver" até alguém o dar por resolvido. */}
              <div style={{ marginBottom: 14, padding: 12, borderRadius: 8, background: T.surfaceRaise, border: `1px solid ${T.line}` }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: T.cream, ...body }}>
                  <input type="checkbox" checked={!!f.estado && f.estado !== 'resolvida'} onChange={e => setF({ ...f, estado: e.target.checked ? 'aberta' : (f.estado ? 'resolvida' : '') })} />
                  Fica por resolver
                </label>
                {f.estado && f.estado !== 'resolvida' && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Input value={f.seguimento} onChange={e => setF({ ...f, seguimento: e.target.value })}
                      placeholder={f.tipo === 'clube' || f.tipo === 'infra' ? 'A quem foi comunicado / o que falta' : 'O que falta fazer (ex.: direção reúne com o pai amanhã)'} />
                    {(f.tipo === 'clube' || f.tipo === 'infra') && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {['aberta', 'comunicada'].map(e => (
                          <ChipEscolha key={e} on={f.estado === e} cor={e === 'aberta' ? T.warn : T.teamB} onClick={() => setF({ ...f, estado: e })}>{e === 'aberta' ? 'Ainda não comunicada' : 'Já comunicada ao clube'}</ChipEscolha>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 14 }}>
                <Field label="Anexo (foto ou PDF, opcional)" bloco>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <label style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                      padding: '8px 14px', borderRadius: 8, border: `1px solid ${T.line}`,
                      background: T.surfaceRaise, color: T.cream, fontSize: 13, ...body,
                    }}>
                      <Upload size={14} />
                      {f.attachment ? 'Substituir anexo' : 'Tirar foto ou carregar ficheiro'}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        capture="environment"
                        onChange={e => { handleAttachmentFile(e.target.files?.[0]); e.target.value = ''; }}
                        style={{ display: 'none' }}
                      />
                    </label>
                    {f.attachment && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {f.attachment.type === 'image' ? (
                          <UrlAnexo anexo={f.attachment}>{url => (
                            <img src={url || undefined} alt={f.attachment.name} style={{ width: 46, height: 46, objectFit: 'cover', borderRadius: 6, border: `1px solid ${T.line}` }} />
                          )}</UrlAnexo>
                        ) : (
                          <div style={{ width: 46, height: 46, borderRadius: 6, border: `1px solid ${T.line}`, background: T.surfaceRaise, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <BookOpen size={18} color={T.mutedDim} />
                          </div>
                        )}
                        <span style={{ fontSize: 12, color: T.mutedDim, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.attachment.name}</span>
                        <button onClick={() => setF(prev => ({ ...prev, attachment: null }))} title="Remover anexo" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer' }}><X size={15} /></button>
                      </div>
                    )}
                  </div>
                  {attachError && <div style={{ fontSize: 12, color: T.bad, marginTop: 6 }}>{attachError}</div>}
                  {aCarregarAnexo && <div style={{ fontSize: 12, color: T.mutedDim, marginTop: 6 }}>A carregar o anexo…</div>}
                </Field>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Btn disabled={!podeGravar} onClick={save}>
                  {editingId ? <><Check size={15} /> Guardar alterações</> : 'Guardar ocorrência'}
                </Btn>
                <Btn variant="ghost" onClick={closeForm}>Cancelar</Btn>
                {f.tipo === 'outra' && !f.tipoNome.trim() && <span style={{ fontSize: 12, color: T.mutedDim }}>Dá um nome à categoria.</span>}
              </div>
            </>
          )}
        </div>
        </Modal>
      )}

      {/* POR RESOLVER — o que precisa de atenção, venha de quando vier. */}
      {pendentes.length > 0 && (
        <div style={{ marginBottom: 18, border: `1px solid ${T.warn}55`, borderRadius: 10, background: T.surface, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', fontSize: 13, color: T.warn, fontWeight: 600, ...body }}>
            Por resolver · {pendentes.length}
          </div>
          {pendentes.map(n => {
            const info = infoDoTipo(chaveDoTipo(n), nomesCustom);
            const resumo = n.seguimento || n.titulo || (n.nota || '').split('\n')[0] || info.label;
            return (
              <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderTop: `1px solid ${T.line}`, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: info.corHex, flexShrink: 0 }} />
                <span style={{ ...mono, fontSize: 11.5, color: T.mutedDim, flexShrink: 0 }}>{fmtShort(n.data)}</span>
                <span style={{ fontSize: 12, color: info.corHex, flexShrink: 0 }}>{info.label}</span>
                <button type="button" onClick={() => startEdit(n)} title="Abrir" style={{ flex: '1 1 160px', minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: T.cream, fontSize: 13, ...body, padding: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resumo}</button>
                {pillEstado(n)}
              </div>
            );
          })}
        </div>
      )}

      {/* PESQUISA — compacta, por cima dos temas. Enter ou a lupa
          pesquisam; o X limpa. */}
      {diario.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <Search size={15} color={T.mutedDim} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setSearch(query); }}
              placeholder="Pesquisar por texto, atleta ou categoria..."
              style={{ width: '100%', paddingLeft: 34, paddingRight: search ? 34 : undefined, height: 38, fontSize: 13.5 }}
            />
            {search && (
              <button type="button" onClick={() => { setQuery(''); setSearch(''); }} title="Limpar pesquisa" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', display: 'flex', padding: 2 }}><X size={15} /></button>
            )}
          </div>
          <Btn variant="ghost" onClick={() => setSearch(query)} style={{ height: 38, padding: '0 14px', fontSize: 13 }}>Pesquisar</Btn>
        </div>
      )}

      {/* PLACARD — o total de cada tema; cada um é um filtro (tocar outra
          vez tira-o). Grelha de colunas iguais: a largura de cada tema não
          depende do número. */}
      {diario.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 14 }}>
          {chavesPlacard.map(k => {
            const info = infoDoTipo(k, nomesCustom);
            const Ic = info.icon;
            const n = contagens[k] || 0;
            const semana = contagensSemana[k] || 0;
            const on = filtro === k;
            return (
              <button key={k} type="button" onClick={() => { setFiltro(on ? null : k); setVerTudo(false); }} title={on ? 'Tocar outra vez para ver todos os temas' : info.label} style={{
                minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, cursor: 'pointer', ...body, textAlign: 'left',
                background: on ? `${info.corHex}2E` : T.surface, border: `1px solid ${on ? info.corHex : T.line}`,
                borderLeft: `3px solid ${info.corHex}`, opacity: n || on ? 1 : 0.55,
              }}>
                <Ic size={15} color={info.corHex} style={{ flexShrink: 0 }} />
                <span style={{ ...display, fontSize: 20, lineHeight: 1, color: T.cream, minWidth: '2ch', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: T.muted, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.label}</span>
                  <span style={{ fontSize: 10.5, color: semana ? info.corHex : T.mutedDim, lineHeight: 1.3, whiteSpace: 'nowrap' }}>{semana ? `${semana} nos últimos 7 dias` : '—'}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* BARRA DO PERÍODO — sempre no mesmo sítio, haja ou não ocorrências
          na lista: à esquerda o que se está a ver, à direita "Ver todas" /
          "Só a última semana". */}
      {doTema.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 28, marginBottom: 10, ...body }}>
          <span style={{ fontSize: 12, color: T.mutedDim, display: 'inline-flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {search ? `Pesquisa: ${doTema.length} resultado${doTema.length === 1 ? '' : 's'}` : verTudo ? 'Todas as datas' : 'Última semana'}
            {(filtro === 'clube' || filtro === 'infra') && (
              <button type="button" onClick={() => exportarRelatorioClube(diario)} title="Relatório de Clube e Infraestruturas (toda a época), para guardar em PDF e levar à coordenação" style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: `1px solid ${T.line}`, borderRadius: 14, padding: '3px 10px', color: T.cream, cursor: 'pointer', fontSize: 12, ...body,
              }}><Printer size={13} /> Relatório PDF</button>
            )}
          </span>
          {!search && !verTudo && antigas > 0 && (
            <button type="button" onClick={() => setVerTudo(true)} style={{ background: 'none', border: 'none', color: T.gold, cursor: 'pointer', fontSize: 12.5, ...body, padding: 0 }}>
              Ver todas ({antigas} mais antigas)
            </button>
          )}
          {!search && verTudo && (
            <button type="button" onClick={() => setVerTudo(false)} style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', fontSize: 12.5, ...body, padding: 0 }}>
              Só a última semana
            </button>
          )}
        </div>
      )}

      {doTema.length === 0 ? (
        <EmptyState text={search ? 'Nenhuma ocorrência encontrada.' : filtro ? 'Ainda não há ocorrências deste tema.' : 'Ainda sem ocorrências. Regista a primeira.'} />
      ) : sorted.length === 0 ? (
        <div style={{ padding: '14px 4px', fontSize: 12.5, color: T.mutedDim }}>
          {filtro ? 'Sem ocorrências deste tema na última semana.' : 'Sem ocorrências na última semana.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(n => {
            const chave = chaveDoTipo(n);
            const info = infoDoTipo(chave, nomesCustom);
            const Ic = info.icon;
            const autor = n.autor || (diarioMeta[n.id] && diarioMeta[n.id].email);
            const editor = n.editadoPor && n.editadoPor !== autor ? n.editadoPor : null;
            const detalhes = [];
            const faltaPorAtleta = chave === 'faltas' && !n.derivada && n.porAtleta && (n.atletas || []).length >= 2;
            if (chave === 'faltas' && n.tipo && !n.derivada && !faltaPorAtleta) detalhes.push(`${n.faltaTipo === 'atraso' ? 'Atraso' : 'Falta'} ${n.justificada ? 'justificada' : 'injustificada'}`);
            if (n.derivada) detalhes.push('Falta marcada nas Presenças · sem motivo registado');
            if (chave === 'disciplina' && (n.consequencias || []).length) detalhes.push(n.consequencias.join(', '));
            if (chave === 'reunioes' && n.comQuem) detalhes.push(`Com: ${n.comQuem}`);
            if (chave === 'reunioes' && n.participantes) detalhes.push(n.participantes);
            if ((chave === 'clube' || chave === 'infra') && n.categoria) detalhes.push(n.categoria);
            return (
              <div key={n.id} style={{ background: T.surface, border: `1px solid ${n.id === editingId ? info.corHex : T.line}`, borderLeft: `3px solid ${info.corHex}`, borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: info.corHex, fontWeight: 600 }}>
                        <Ic size={13} /> {info.label}
                      </span>
                      <span style={{ ...mono, color: T.mutedDim, fontSize: 12 }}>{fmtDate(n.data)}</span>
                      {n.titulo && <span style={{ color: T.cream, fontSize: 14, fontWeight: 500 }}>{n.titulo}</span>}
                    </div>
                    {/* Autor: o que ficou gravado na própria ocorrência; nas
                        antigas, quem gravou a linha na base de dados. */}
                    {n.derivada ? (
                      <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 3 }}>
                        Das Presenças · {n.origem === 'jogo' ? `jogo${n.adversario ? ` vs ${n.adversario}` : ''}` : 'treino'}
                      </div>
                    ) : autor && (
                      <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 3 }}>
                        Por {autor}{editor ? ` · editada por ${editor}` : ''}
                      </div>
                    )}
                  </div>
                  {n.derivada ? (
                    <button type="button" onClick={() => acrescentarMotivo(n)} title="Registar o motivo destas faltas (ou marcá-las como justificadas)" style={{
                      flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: `1px solid ${T.line}`, borderRadius: 14, padding: '4px 10px', color: T.gold, cursor: 'pointer', fontSize: 12, ...body,
                    }}><Plus size={13} /> Acrescentar motivo</button>
                  ) : (
                  <div style={{ display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>
                    {!isMobile && pillEstado(n)}
                    {chave === 'nota' && setMatches && (matches || []).length > 0 && (
                      <button onClick={() => (aMover && aMover.id === n.id ? setAMover(null) : abrirMover(n))} title="Mover para as notas do jogo (Relatórios de jogo)" style={{ background: 'none', border: 'none', color: aMover && aMover.id === n.id ? T.gold : T.mutedDim, cursor: 'pointer' }}><Trophy size={14} /></button>
                    )}
                    <button onClick={() => startEdit(n)} title="Editar" style={{ background: 'none', border: 'none', color: n.id === editingId ? T.warn : T.mutedDim, cursor: 'pointer' }}><Pencil size={14} /></button>
                    <button onClick={() => remove(n.id)} title="Apagar" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer' }}><Trash2 size={14} /></button>
                  </div>
                  )}
                </div>

                {aMover && aMover.id === n.id && (
                  <div style={{ margin: '8px 0 12px', padding: 12, borderRadius: 8, background: T.surfaceRaise, border: `1px solid ${T.gold}55` }}>
                    <div style={{ fontSize: 12.5, color: T.cream, marginBottom: 8 }}>Mover para as notas da equipa técnica do jogo:</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Select value={aMover.jogo} onChange={e => setAMover({ ...aMover, jogo: e.target.value })} style={{ flex: '1 1 220px', minWidth: 0 }}>
                        {jogosParaMover(n).map(m => (
                          <option key={m.id} value={m.id}>{fmtShort(m.date)} · vs {m.opponent || 'Adversário'}{m.competition ? ` (${competitionLabel(m.competition)})` : ''}</option>
                        ))}
                      </Select>
                      <Btn disabled={!aMover.jogo} onClick={() => confirmarMover(n)}><Check size={14} /> Mover</Btn>
                      <Btn variant="ghost" onClick={() => setAMover(null)}>Cancelar</Btn>
                    </div>
                    <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 6 }}>Mantém o autor e a data. Sai do Diário.</div>
                  </div>
                )}

                {(n.atletas || []).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0' }}>
                    {n.atletas.map(pid => {
                      const cor = n.cartao || 'amarelo';
                      const k = chave === 'disciplina' ? contagemCartao(pid, n) : 0;
                      const acumula = chave === 'disciplina' && cor === 'amarelo' && k >= 3;
                      return (
                        <span key={pid} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 12, background: T.surfaceRaise, border: `1px solid ${acumula ? T.bad : T.line}`, fontSize: 12, color: T.cream }}>
                          {chave === 'disciplina' && <MiniCartao cor={cor} />}
                          {nomeAtleta(pid)}
                          {faltaPorAtleta && (() => {
                            const d = faltaDoAtleta(n, pid);
                            return (
                              <span style={{ fontSize: 11, color: d.justificada ? T.good : T.bad }}>
                                · {d.faltaTipo === 'atraso' ? 'Atraso' : 'Falta'} {d.justificada ? 'justificada' : 'injustificada'}{d.motivo ? <span style={{ color: T.mutedDim }}> · {d.motivo}</span> : null}
                              </span>
                            );
                          })()}
                          {chave === 'disciplina' && k > 0 && (
                            <span style={{ ...mono, fontSize: 10.5, color: acumula ? T.bad : T.mutedDim }}
                              title={`${k}.º ${cor} da época`}>
                              {k}.º{acumula ? ' · acumulação' : ''}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}

                {detalhes.length > 0 && <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>{detalhes.join(' · ')}</div>}
                {n.nota && <p style={{ color: T.mutedDim, fontSize: 13.5, lineHeight: 1.6, margin: '0 0 10px', whiteSpace: 'pre-wrap' }}>{n.nota}</p>}
                {n.decisoes && (
                  <div style={{ margin: '0 0 10px', padding: '8px 12px', borderRadius: 8, background: T.surfaceRaise }}>
                    <div style={{ fontSize: 11.5, color: T.good, marginBottom: 6 }}>Decisões e próximos passos</div>
                    {/* Cada linha é uma decisão; "Missão" abre logo a Nova
                        missão (em Tarefas) com a decisão como título — só
                        falta escolher para quem e o prazo. */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {String(n.decisoes).split('\n').map(l => l.replace(/^\s*[-•*·]\s*/, '').trim()).filter(Boolean).map((linha, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: T.cream, lineHeight: 1.5 }}>{linha}</span>
                          <button type="button" onClick={() => pedirNovaMissao({ modo: 'staff', titulo: linha.slice(0, 140) })} title="Criar uma missão com esta decisão" style={{
                            flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: `1px solid ${T.good}66`, borderRadius: 12, padding: '2px 9px', color: T.good, cursor: 'pointer', fontSize: 11.5, ...body,
                          }}><Plus size={12} /> Missão</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(n.seguimento || (isMobile && n.estado)) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '0 0 10px' }}>
                    {isMobile && pillEstado(n)}
                    {n.seguimento && <span style={{ fontSize: 12.5, color: T.muted }}>{n.seguimento}</span>}
                  </div>
                )}
                {n.attachment && (
                  <UrlAnexo anexo={n.attachment}>{url => (
                  n.attachment.type === 'image' ? (
                    <a href={hrefDescarga(url, n.attachment.name) || undefined} download={n.attachment.name}>
                      <img src={url || undefined} alt={n.attachment.name} style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, border: `1px solid ${T.line}`, display: 'block' }} />
                    </a>
                  ) : (
                    <a
                      href={hrefDescarga(url, n.attachment.name) || undefined} download={n.attachment.name}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: T.warn, textDecoration: 'none', border: `1px solid ${T.gold}55`, borderRadius: 8, padding: '6px 12px' }}
                    >
                      <BookOpen size={13} /> {n.attachment.name}
                    </a>
                  )
                  )}</UrlAnexo>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

