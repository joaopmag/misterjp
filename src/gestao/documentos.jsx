// gestao/documentos.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { semAcentos, todayStr, uid } from '../base/utilidades';
import { MESES_PT } from '../plantel/comum';
import { diaAutoLesionado, recalcularOcorrencia } from '../plantel/clinicoDados';
import { T } from '../base/tema';
import JSZip from 'jszip';
import { isFriendlyMatch } from '../dominio/jogos';
import { parseScore } from '../competicao/dados';
import { fichaDaEquipa } from '../media/organizacao';
import { notasDoJogo } from '../competicao/RelatoriosJogo';
import { avaliacaoBaseDoJogador, estatutoDaAvaliacao } from '../plantel/avaliacao';
import { sortByPosition, POSITIONS, shortPlayerName } from '../dominio/jogadores';
import { FORMACOES, LAYOUT_FORMACAO } from '../tatico/Simulador';
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { FIELD_GRID, Field, Input, Btn, Select, askConfirm, SectionHeader, EmptyState, Modal } from '../base/ui';
import { Loader2, Download, Plus, FileSpreadsheet, FileText, Trash2, Info, Check } from 'lucide-react';
import { nivelClinico } from '../dominio/clinico';

// Largura comum dos botões "Gerar…" em Documentos (cabe o mais comprido,
// "Gerar estatística e assiduidade"); num ecrã estreito não passa da linha.
export const BTN_GERAR_DOC = { width: 'min(300px, 80vw)', justifyContent: 'center', whiteSpace: 'nowrap' };

// Escapa texto para entrar num nó <t> de XML — & < > sempre, e a
// quebra de linha como &#10; (é assim que o Excel guarda um "Alt+Enter"
// dentro de uma célula).
export function escaparXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '').replace(/\n/g, '&#10;');
}

/* Substitui a célula `ref` (ex.: "B6") por uma STRING EMBUTIDA
   ("inlineStr"), preservando o atributo de estilo `s="N"` que a célula
   já tinha — é esse atributo que aponta para a cor de fundo, o negrito,
   os contornos, etc. no styles.xml, e ao mantê-lo intacto o resto do
   aspeto da célula não muda nada.

   Funciona tanto em células vazias (`<c r="C6" s="61"/>`, a forma mais
   comum numa folha em branco) como em células que já tenham conteúdo.
   Se a célula não existir de todo nesta folha, não faz nada — mais
   seguro do que tentar inventar uma linha nova a meio do XML. */
export function definirTextoNaCelula(sheetXml, ref, valor) {
  const re = new RegExp(`<c r="${ref}"([^>]*?)(/>|>[\\s\\S]*?</c>)`);
  const m = sheetXml.match(re);
  if (!m) return sheetXml;
  const sAttr = (m[1].match(/\ss="(\d+)"/) || [])[1];
  const novaCelula = `<c r="${ref}"${sAttr ? ` s="${sAttr}"` : ''} t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`;
  return sheetXml.slice(0, m.index) + novaCelula + sheetXml.slice(m.index + m[0].length);
}

/* Como `definirTextoNaCelula`, mas escreve um NÚMERO em vez de uma
   string embutida — sem atributo `t`, que é como o Excel guarda uma
   célula numérica normal. Preserva o `s="N"` do estilo, tal como a
   função de texto. É esta a versão usada nas células P/F/L/E da Ficha
   Assiduidade, porque o modelo soma essa linha com uma fórmula e uma
   string ("P"/"F") entra nessa soma como zero — só um número a sério
   conta. */
export function definirNumeroNaCelula(sheetXml, ref, numero) {
  const re = new RegExp(`<c r="${ref}"([^>]*?)(/>|>[\\s\\S]*?</c>)`);
  const m = sheetXml.match(re);
  if (!m) return sheetXml;
  const sAttr = (m[1].match(/\ss="(\d+)"/) || [])[1];
  const novaCelula = `<c r="${ref}"${sAttr ? ` s="${sAttr}"` : ''}><v>${numero}</v></c>`;
  return sheetXml.slice(0, m.index) + novaCelula + sheetXml.slice(m.index + m[0].length);
}

/* Só para células com FÓRMULA (ex.: o nome de um jogador na Ficha
   Assiduidade, que vem de `='ESTATÍSTICA TOTAL'!$B$6`): atualiza o
   VALOR EM CACHE sem tocar na fórmula. Sem isto, o nome só apareceria
   certo depois de o Excel recalcular ao abrir — o que normalmente
   acontece sozinho, mas mostrar já o valor certo no ficheiro é mais
   seguro (por exemplo, para quem o abrir num visualizador que não
   recalcula, como alguns leitores rápidos de ficheiros). */
export function definirValorEmCache(sheetXml, ref, valor) {
  const re = new RegExp(`(<c r="${ref}"[^>]*>\\s*<f[^>]*>[\\s\\S]*?</f>)<v>[\\s\\S]*?</v>`);
  const m = sheetXml.match(re);
  if (!m) return sheetXml;
  const novo = `${m[1]}<v>${escaparXml(valor)}</v>`;
  return sheetXml.slice(0, m.index) + novo + sheetXml.slice(m.index + m[0].length);
}

// Letra(s) de coluna a partir de um índice COM BASE EM ZERO (0=A, 1=B,
// 2=C, ...) — o formato que o resto deste ficheiro usa.
export function letraDaColuna(idx0) {
  let n = idx0 + 1, s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/* Todo o texto de um <si> (entrada da tabela de "shared strings") pode
   vir dividido em vários <r> (rich text — ex.: uma parte a negrito,
   outra não), cada um com o seu <t>. Para PROCURAR o texto (não para o
   editar) juntam-se todos. */
export function textoCompletoDoSi(siXml) {
  return [...siXml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('');
}

/* Localiza, dentro do XML da folha "Ficha Assiduidade", a linha onde
   começa o bloco de um mês (título "Ficha Assiduidade\n<Mês> <Ano>").

   Procura só pelo NOME DO MÊS na tabela de shared strings — o ano que
   vem escrito no título de cada bloco é o da época em que o modelo foi
   criado ("2022"/"2023"), gravado como texto fixo, não uma fórmula; só
   comparar pelo mês (cada um só aparece uma vez no ciclo Agosto→Julho,
   sem ambiguidade) encontra o bloco certo em qualquer época. */
export function localizarBlocoAssiduidade(sheetXml, sharedStrings, mes) {
  const alvoMes = semAcentos(MESES_PT[mes]);
  let indiceAlvo = null;
  sharedStrings.forEach((texto, i) => {
    const t = semAcentos(texto);
    if (indiceAlvo === null && t.includes('ficha assiduidade') && t.includes(alvoMes)) indiceAlvo = i;
  });
  if (indiceAlvo === null) return null;
  const cellRe = new RegExp(`<c r="A(\\d+)"[^>]*t="s"[^>]*><v>${indiceAlvo}</v></c>`);
  const m = sheetXml.match(cellRe);
  if (!m) return null;
  const linhaTitulo = parseInt(m[1], 10);
  return { linhaTitulo, primeiraLinhaJogador: linhaTitulo + 5, maxJogadores: 30 };
}

/* Estado de UM jogador, num dia — o mesmo vocabulário que a aba
   "Presenças" usa (`estadoDe`): 'presente', 'falta', 'lesionado',
   'escalao', ou 'ausente' (não marcado explicitamente, mas havia
   sessão/jogo). Devolve `null` se não houve treino nem jogo nenhum
   marcado nesse dia — aí a célula fica em branco, como no modelo
   original, e não se mexe nela.

   Junta sessões de treino E jogos (`matches`) no MESMO dia num único
   estado, porque a Ficha Assiduidade só tem uma célula por dia por
   jogador (ao contrário da tabela "Presenças" no ecrã, que pode ter
   uma coluna para o treino e outra para o jogo nesse mesmo dia). Um
   dia de jogo também é assiduidade. */
export function estadoNoDia(playerId, dateStr, sessions, matches, clinico) {
  const doDia = (sessions || []).filter(s => s.date === dateStr && s.phase !== 'Descanso');
  const jogoDoDia = (matches || []).find(m => m.date === dateStr);
  if (doDia.length === 0 && !jogoDoDia) return null;

  const presenteEmTreino = doDia.some(s => (s.attendance || []).includes(playerId));
  const convocadosJogo = jogoDoDia
    ? (Array.isArray(jogoDoDia.attendance) ? jogoDoDia.attendance : (jogoDoDia.convocados || []))
    : [];
  const presenteEmJogo = convocadosJogo.includes(playerId);
  if (presenteEmTreino || presenteEmJogo) return 'presente';

  const faltas = [...doDia.flatMap(s => s.faltas || []), ...(jogoDoDia ? (jogoDoDia.faltas || []) : [])];
  if (faltas.includes(playerId)) return 'falta';

  const lesionados = [...doDia.flatMap(s => s.lesionados || []), ...(jogoDoDia ? (jogoDoDia.lesionados || []) : [])];
  if (lesionados.includes(playerId)) return 'lesionado';

  const escalao = [...doDia.flatMap(s => s.escalao || []), ...(jogoDoDia ? (jogoDoDia.escalao || []) : [])];
  if (escalao.includes(playerId)) return 'escalao';

  // Preenche-se sozinho a partir do boletim clínico, tal como a aba
  // "Presenças" faz — um jogador indisponível por lesão nem sempre
  // fica marcado sessão a sessão.
  if (diaAutoLesionado(playerId, dateStr, clinico)) return 'lesionado';

  return 'ausente';
}

/* A Ficha Assiduidade em papel usa as letras P/F/L/E, mas a versão
   Excel do SC Salgueiros conta os totais por SOMA da linha — por isso
   as células têm de levar um NÚMERO, não uma letra. Conversão pedida
   pelo clube: P (presente) e L (lesionado) valem 1; F (falta), E
   (escalão) e a ausência não marcada valem 0. */
export const VALOR_ASSIDUIDADE = { presente: 1, lesionado: 1, falta: 0, escalao: 0, ausente: 0 };

/* A COLUNA DO TOTAL (AH) FICAVA COM O VALOR ANTIGO AO ABRIR O FICHEIRO.

   As colunas C..AG são os dias do mês — só essas são reescritas, célula
   a célula, por `definirNumeroNaCelula`. A coluna AH é a soma dessas
   colunas, calculada por uma FÓRMULA do próprio modelo, não por nós; e
   uma fórmula, dentro do .xlsx, guarda dois valores separados: a
   fórmula em si e o ÚLTIMO RESULTADO CALCULADO (`<v>`), que é o que
   fica gravado no ficheiro e o que alguns leitores mostram sem
   recalcular nada. Como só se mexe nas células dos dias, esse `<v>` da
   soma fica parado no valor de quando o modelo estava em branco (0) —
   o ficheiro está correto, mas mostra o total antigo até alguém forçar
   o Excel a recalcular (F9, ou abrir e fechar a célula).

   A correção não é ir calcular a soma nós próprios e escrevê-la à mão
   (isso duplicava a lógica da fórmula do modelo, e desalinhava se um
   dia o clube mudar a fórmula) — é dizer ao workbook para recalcular
   TUDO sozinho assim que o ficheiro abre, pondo `fullCalcOnLoad="1"`
   no `<calcPr>` do workbook.xml. Isto é um sinalizador oficial do
   formato .xlsx, respeitado pelo Excel, Google Sheets e LibreOffice —
   não uma gambiarra. */
export async function forcarRecalculoAoAbrir(zip) {
  const wbFile = zip.file('xl/workbook.xml');
  if (!wbFile) return;
  let wbXml = await wbFile.async('string');

  if (/<calcPr\b/.test(wbXml)) {
    if (/fullCalcOnLoad="/.test(wbXml)) {
      wbXml = wbXml.replace(/fullCalcOnLoad="[^"]*"/, 'fullCalcOnLoad="1"');
    } else {
      wbXml = wbXml.replace(/<calcPr\b/, '<calcPr fullCalcOnLoad="1"');
    }
  } else {
    // Modelo sem <calcPr> nenhum (raro, mas acontece): cria-se um,
    // logo a seguir a </sheets> — é a posição que o esquema do Office
    // Open XML exige para este elemento dentro de <workbook>.
    wbXml = wbXml.replace('</sheets>', '</sheets><calcPr fullCalcOnLoad="1"/>');
  }

  zip.file('xl/workbook.xml', wbXml);
}

/* Resolve o caminho real dentro do .zip para uma folha, a partir do
   NOME dela — precisa de workbook.xml (nome → r:id) e de
   workbook.xml.rels (r:id → ficheiro). Sem isto teria de se adivinhar
   "sheet1.xml", "sheet2.xml"..., que não bate certo com a ordem em que
   as folhas aparecem no ficheiro. */
export async function resolverCaminhoDaFolha(zip, nomeFolha) {
  const wbXml = await zip.file('xl/workbook.xml').async('string');
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const mSheet = wbXml.match(new RegExp(`<sheet name="${nomeFolha.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*r:id="(rId\\d+)"`));
  if (!mSheet) return null;
  const mRel = relsXml.match(new RegExp(`<Relationship Id="${mSheet[1]}"[^>]*Target="([^"]+)"`));
  return mRel ? `xl/${mRel[1]}` : null;
}

/* Gera o Excel preenchido para UM OU VÁRIOS meses de uma só vez, como
   um ficheiro pronto a descarregar (Blob) — sem guardar nada na app.
   `players` já deve vir pela ordem que se quer na folha (a app usa
   `sortByPosition`). `mesesEAnos` é uma lista de `{ mes, ano }` (mes
   com base em zero, Janeiro=0); o modelo já tem os 12 blocos mensais
   estampados de fábrica, por isso preencher vários meses é só repetir
   o mesmo procedimento bloco a bloco, sobre o MESMO .zip, e só no fim
   gerar o ficheiro — assim os meses escolhidos saem todos juntos num
   único Excel, tal como já vinham no modelo original. */
/* MARCA "MisterJP" EM TODOS OS DOCUMENTOS QUE A APP GERA.

   Pequena, cinzenta, no canto inferior direito de cada página:
   · impressões e PDFs da app: um elemento fixo que o browser repete em
     cada folha (ver `.mjp-marca-impressao` no estilo global);
   · Word: no rodapé de cada secção (no que o modelo já tiver, ou num
     rodapé novo só com a marca), por isso aparece em todas as páginas
     sem mexer no corpo do documento;
   · Excel: no rodapé de impressão de cada folha (&R = à direita). */
export const MARCA_APP = '™ Mister JP';

export async function carimbarMarcaWord(zip) {
  const docPath = 'word/document.xml';
  const relsPath = 'word/_rels/document.xml.rels';
  const df = zip.file(docPath);
  if (!df) return;
  const parser = new DOMParser();
  const ser = new XMLSerializer();
  const doc = parser.parseFromString(await df.async('string'), 'application/xml');
  const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const TIPO_RODAPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer';
  const relsDoc = parser.parseFromString(zip.file(relsPath) ? await zip.file(relsPath).async('string') : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}"></Relationships>`, 'application/xml');
  const relsRaiz = relsDoc.documentElement;
  const rels = [...relsRaiz.getElementsByTagNameNS(REL_NS, 'Relationship')];
  const alvoDe = (id) => { const r = rels.find(x => x.getAttribute('Id') === id); return r ? `word/${r.getAttribute('Target').replace(/^\/?word\//, '').replace(/^\.\//, '')}` : null; };
  const paragrafoMarca = (d) => {
    const p = d.createElementNS(W_NS, 'w:p');
    const ppr = d.createElementNS(W_NS, 'w:pPr');
    const sp = d.createElementNS(W_NS, 'w:spacing'); sp.setAttribute('w:before', '0'); sp.setAttribute('w:after', '0'); sp.setAttribute('w:line', '240'); sp.setAttribute('w:lineRule', 'auto');
    const jc = d.createElementNS(W_NS, 'w:jc'); jc.setAttribute('w:val', 'right');
    ppr.appendChild(sp); ppr.appendChild(jc); p.appendChild(ppr);
    const r = d.createElementNS(W_NS, 'w:r');
    const rpr = d.createElementNS(W_NS, 'w:rPr');
    const f = d.createElementNS(W_NS, 'w:rFonts'); ['w:ascii', 'w:hAnsi', 'w:cs'].forEach(a => f.setAttribute(a, 'Arial'));
    const b = d.createElementNS(W_NS, 'w:b');
    const c = d.createElementNS(W_NS, 'w:color'); c.setAttribute('w:val', '9A9A9A');
    const sz = d.createElementNS(W_NS, 'w:sz'); sz.setAttribute('w:val', '12');
    const szc = d.createElementNS(W_NS, 'w:szCs'); szc.setAttribute('w:val', '12');
    [f, b, c, sz, szc].forEach(n => rpr.appendChild(n));
    const t = d.createElementNS(W_NS, 'w:t'); t.textContent = MARCA_APP;
    r.appendChild(rpr); r.appendChild(t); p.appendChild(r);
    return p;
  };
  const jaCarimbados = new Set();
  const carimbarRodape = async (caminho) => {
    if (!caminho || jaCarimbados.has(caminho) || !zip.file(caminho)) return;
    jaCarimbados.add(caminho);
    const fd = parser.parseFromString(await zip.file(caminho).async('string'), 'application/xml');
    const raiz = fd.documentElement;
    if (semAcentosDoc(textoDoNo(raiz)).includes(MARCA_APP.toLowerCase())) return;
    const ps = [...raiz.childNodes].filter(n => n.localName === 'p');
    const marca = paragrafoMarca(fd);
    // Rodapé com um só parágrafo vazio: a marca fica no lugar dele (não cresce).
    if (ps.length === 1 && !textoDoNo(ps[0]).trim() && !ps[0].getElementsByTagNameNS('*', 'drawing').length) raiz.replaceChild(marca, ps[0]);
    else raiz.appendChild(marca);
    zip.file(caminho, ser.serializeToString(fd));
  };
  let caminhoNovo = null;
  const rodapeNovo = async () => {
    if (caminhoNovo) return caminhoNovo.id;
    let n = 1; while (zip.file(`word/footerMJP${n}.xml`)) n++;
    const nome = `footerMJP${n}.xml`;
    zip.file(`word/${nome}`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="${W_NS}"><w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:color w:val="9A9A9A"/><w:sz w:val="12"/><w:szCs w:val="12"/></w:rPr><w:t>${MARCA_APP}</w:t></w:r></w:p></w:ftr>`);
    let id = 1; while (rels.some(x => x.getAttribute('Id') === `rIdMJP${id}`)) id++;
    const rel = relsDoc.createElementNS(REL_NS, 'Relationship');
    rel.setAttribute('Id', `rIdMJP${id}`); rel.setAttribute('Type', TIPO_RODAPE); rel.setAttribute('Target', nome);
    relsRaiz.appendChild(rel); rels.push(rel);
    const ctPath = '[Content_Types].xml';
    let ct = await zip.file(ctPath).async('string');
    if (!ct.includes(`/word/${nome}`)) ct = ct.replace('</Types>', `<Override PartName="/word/${nome}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`);
    zip.file(ctPath, ct);
    caminhoNovo = { id: `rIdMJP${id}` };
    return caminhoNovo.id;
  };
  const settings = zip.file('word/settings.xml') ? await zip.file('word/settings.xml').async('string') : '';
  const parImpar = /<w:evenAndOddHeaders(?![^>]*w:val="(0|false)")/.test(settings);
  for (const sect of [...doc.getElementsByTagNameNS(W_NS, 'sectPr')]) {
    const refs = [...sect.childNodes].filter(n => n.localName === 'footerReference');
    const titulo = [...sect.childNodes].some(n => n.localName === 'titlePg' && !/^(0|false)$/.test(n.getAttribute('w:val') || ''));
    const precisos = ['default', ...(titulo ? ['first'] : []), ...(parImpar ? ['even'] : [])];
    for (const tipo of precisos) {
      const ref = refs.find(r => (r.getAttribute('w:type') || 'default') === tipo);
      if (ref) { await carimbarRodape(alvoDe(ref.getAttributeNS(R_NS, 'id') || ref.getAttribute('r:id'))); continue; }
      const id = await rodapeNovo();
      const nova = doc.createElementNS(W_NS, 'w:footerReference');
      nova.setAttribute('w:type', tipo);
      nova.setAttributeNS(R_NS, 'r:id', id);
      // As referências de cabeçalho e rodapé vêm primeiro no sectPr.
      const depois = [...sect.childNodes].find(n => n.nodeType === 1 && !['headerReference', 'footerReference'].includes(n.localName));
      sect.insertBefore(nova, depois || null);
    }
    // Rodapé encostado ao fundo da folha (distância 0): sobe um pouco, para a marca não ficar fora da zona de impressão.
    const pgMar = [...sect.childNodes].find(n => n.localName === 'pgMar');
    if (pgMar && (Number(pgMar.getAttribute('w:footer')) || 0) < 200) pgMar.setAttribute('w:footer', '200');
  }
  zip.file(docPath, ser.serializeToString(doc));
  zip.file(relsPath, ser.serializeToString(relsDoc));
}

/* Assinatura dos documentos que a app preenche (ex.: relatório de
   ocorrência, na linha "(______)" por cima do departamento). */
export const ASSINATURA_APP = 'Gerado pela app Mister JP';

/* COR DA EQUIPA NOS MODELOS WORD.
   Os modelos base vêm com o vermelho de origem (títulos, faixas, caixas).
   Ao gerar, todos os tons vermelhos passam a ser a cor da equipa (a de
   Gerir equipa, T.corEquipa): um clube novo só tem de pôr o logótipo.
   Cores que o clube tenha escolhido (azul, verde, preto…) não são
   tocadas. Num texto, uma cor de equipa muito clara (amarelo, branco)
   não se lia: aí o texto leva uma versão escurecida dela. O Excel tem a
   sua própria função (`pintarCorEquipaExcel`), que não mexe nas cores das
   faltas nem nos gráficos. */
export function corEquipaParaDocumentos() {
  const c = String(T.corEquipa || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(c)) return null;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16));
  const lin = [r, g, b].map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  const hex = (arr) => arr.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  // Texto: escurece até se ler em papel branco.
  let f = 1, txt = [r, g, b];
  while (lum * f ** 2.2 > 0.25 && f > 0.3) { f -= 0.05; txt = [r * f, g * f, b * f]; }
  return { fundo: c.toUpperCase(), texto: lum > 0.25 ? hex(txt) : c.toUpperCase() };
}

export function ehVermelhoDeModelo(hex) {
  if (!/^[0-9a-f]{6}$/i.test(hex || '')) return false;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0 || max !== r) return false;
  const sat = d / (1 - Math.abs(2 * l - 1));
  let h = ((g - b) / d) * 60; if (h < 0) h += 360;
  return (h <= 15 || h >= 340) && sat >= 0.45 && l >= 0.2 && l <= 0.65;
}

export async function pintarCorEquipaWord(zip) {
  const cor = corEquipaParaDocumentos();
  if (!cor) return;
  const partes = Object.keys(zip.files).filter(n => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n));
  for (const caminho of partes) {
    const xml0 = await zip.file(caminho).async('string');
    let xml = xml0;
    // Cor do texto (tira a cor de tema, senão o Word ignorava a nova).
    xml = xml.replace(/<w:color\b[^>]*\/>/g, (tag) => {
      const m = /w:val="([0-9A-Fa-f]{6})"/.exec(tag);
      if (!m || !ehVermelhoDeModelo(m[1])) return tag;
      return `<w:color w:val="${cor.texto}"/>`;
    });
    // Sombreados de células/parágrafos, formas e caixas (DrawingML e VML).
    xml = xml.replace(/(<w:shd\b[^>]*\bw:fill=")([0-9A-Fa-f]{6})(")/g, (m, a, h, z) => (ehVermelhoDeModelo(h) ? a + cor.fundo + z : m));
    xml = xml.replace(/(<a:srgbClr\b[^>]*\bval=")([0-9A-Fa-f]{6})(")/g, (m, a, h, z) => (ehVermelhoDeModelo(h) ? a + cor.fundo + z : m));
    xml = xml.replace(/(\b(?:fillcolor|strokecolor|color2?)=")#?([0-9A-Fa-f]{6})(")/g, (m, a, h, z) => (ehVermelhoDeModelo(h) ? `${a}#${cor.fundo}${z}` : m));
    if (xml !== xml0) zip.file(caminho, xml);
  }
}

/* LOGÓTIPO E NOME DO CLUBE NOS DOCUMENTOS (Word e Excel).
   Os modelos base trazem imagens de exemplo ("LOGÓTIPO E NOME DO CLUBE",
   "LOGÓTIPOS DO RODAPÉ", escudos "CLUBE"). A app desenha no lugar delas
   uma imagem com o logótipo e o nome do clube (os de Gerir equipa), com o
   mesmo tamanho, por isso ninguém tem de os pôr à mão.

   Que imagens se trocam:
   · as marcadas pela app (texto alternativo começa por MARCA_CLUBE_DOC),
     que voltam a ser desenhadas em cada documento (logótipo, nome ou cor
     novos aparecem logo);
   · as de exemplo: só em tons de cinzento/branco (sem cor nenhuma) ou com
     os nomes dos modelos base (n-cab.png, n-rod.png);
   · ao DESCARREGAR um modelo base Word (`forcar`), também todas as do
     cabeçalho e do rodapé.
   Imagens com cor (o cabeçalho próprio de um clube, o relvado, fotos a
   cores) ficam como estão. Corre logo ao abrir o modelo, antes de se
   meterem as fotos dos jogadores.

   Três desenhos, escolhidos pela imagem de exemplo:
   · "escudo" (imagem quase quadrada): só o logótipo, fundo transparente;
   · "simples" (exemplo cinzento sobre branco): logótipo e nome na cor da
     equipa, sem caixa nem faixa;
   · "sobre" (exemplo com riscos claros, por cima de uma faixa de cor):
     logótipo e nome a branco numa só linha, sem fundo. As caixas "sobre"
     da mesma página (logótipo à esquerda e "OUTROS LOGÓTIPOS" à direita)
     ficam iguais: altura da mais baixa (cabe na faixa), largura à medida
     do nome, e simétricas na folha (mesma distância às duas bordas e à
     mesma altura);
   · "faixa" (exemplo a cores, ex.: a faixa da ficha): faixa na cor da
     equipa com o logótipo numa caixa branca e o nome a branco ao centro. */
export const MARCA_CLUBE_DOC = 'MisterJP: logótipo e nome do clube';

export const IMAGENS_EXEMPLO_MODELO = /^n-(cab|rod)\.png$/i;

export async function carregarLogoEquipaParaDoc() {
  const src = T.logoEquipa;
  if (!src) return null;
  const doImg = (url, cors) => new Promise((res, rej) => {
    const im = new Image();
    if (cors) im.crossOrigin = 'anonymous';
    im.onload = () => res(im); im.onerror = rej; im.src = url;
  });
  try {
    const r = await fetch(src);
    if (!r.ok) throw new Error('logo');
    const url = URL.createObjectURL(await r.blob());
    try { return await doImg(url, false); } finally { setTimeout(() => URL.revokeObjectURL(url), 2000); }
  } catch (e) {
    try { return await doImg(src, true); } catch (e2) { return null; }
  }
}

// Como é a imagem de exemplo: tem cor? é transparente? é clara?
export async function analisarImagemModelo(bytes, ext) {
  if (!/^(png|jpe?g|gif|bmp|webp)$/i.test(ext || '')) return null;
  try {
    const tipo = /png/i.test(ext) ? 'image/png' : /gif/i.test(ext) ? 'image/gif' : /bmp/i.test(ext) ? 'image/bmp' : /webp/i.test(ext) ? 'image/webp' : 'image/jpeg';
    const bmp = await createImageBitmap(new Blob([bytes], { type: tipo }));
    const L = 64;
    const cv = document.createElement('canvas'); cv.width = L; cv.height = L;
    const g = cv.getContext('2d');
    g.drawImage(bmp, 0, 0, L, L);
    const d = g.getImageData(0, 0, L, L).data;
    let opacos = 0, comCor = 0, soma = 0;
    for (let k = 0; k < d.length; k += 4) {
      if (d[k + 3] < 40) continue;
      opacos++;
      const mx = Math.max(d[k], d[k + 1], d[k + 2]), mn = Math.min(d[k], d[k + 1], d[k + 2]);
      if (mx - mn > 28) comCor++;
      soma += (d[k] + d[k + 1] + d[k + 2]) / 3;
    }
    const total = L * L;
    return {
      cinzenta: opacos > 0 && comCor / opacos < 0.02,
      transparente: opacos / total < 0.6,
      clara: opacos > 0 && soma / opacos > 200,
    };
  } catch (e) { return null; }
}

export function estiloImagemClube(info, largura, altura) {
  if (altura >= largura * 0.66) return 'escudo';
  if (info && info.cinzenta) {
    // Riscos claros sobre transparente: está por cima de uma faixa de cor
    // (organização) → nome a branco, sem fundo. Cinzento escuro ou fundo
    // branco (relatório de ocorrência) → nome na cor da equipa, sem fundo.
    if (info.transparente && info.clara) return 'sobre';
    return 'simples';
  }
  return 'faixa';
}

export async function desenharImagemClube({ largura, altura, estilo, logo }) {
  const W = largura, H = altura;
  const fazer = (comLogo) => {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const corDoc = corEquipaParaDocumentos() || { fundo: 'B5393F', texto: 'B5393F' };
    const base = `#${corDoc.fundo}`;
    const [r, gg, b] = [0, 2, 4].map(i => parseInt(corDoc.fundo.slice(i, i + 2), 16));
    const lum = (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255;
    const nome = String(T.nomeClube || '').trim();
    const temLogo = comLogo && logo;
    const raio = (x, y, w, h, rr) => { g.beginPath(); g.moveTo(x + rr, y); g.arcTo(x + w, y, x + w, y + h, rr); g.arcTo(x + w, y + h, x, y + h, rr); g.arcTo(x, y + h, x, y, rr); g.arcTo(x, y, x + w, y, rr); g.closePath(); };
    const desenhaLogo = (x, y, lado) => {
      const lw = logo.naturalWidth || logo.width, lh = logo.naturalHeight || logo.height;
      if (!lw || !lh) return;
      const k = Math.min(lado / lw, lado / lh);
      g.drawImage(logo, x + (lado - lw * k) / 2, y + (lado - lh * k) / 2, lw * k, lh * k);
    };
    const ajustaLetra = (texto, maxW, maxH) => {
      let fs = maxH;
      do { g.font = `bold ${Math.round(fs)}px Arial, Helvetica, sans-serif`; if (g.measureText(texto).width <= maxW) break; fs *= 0.94; } while (fs > maxH * 0.3);
      return fs;
    };
    if (estilo === 'sobre' || estilo === 'sobreLogo') {
      // Por cima de uma faixa de cor: sem fundo, logótipo à medida da
      // altura e o nome a branco, separado dele; tudo ao centro.
      const lado = H * 0.9;
      if (estilo === 'sobreLogo' || !nome) {
        if (temLogo) desenhaLogo((W - lado) / 2, (H - lado) / 2, lado);
      } else {
        // Logótipo à medida da altura e o nome ao lado, numa só linha. A
        // largura da imagem já foi alargada para o nome caber em letra legível.
        const texto = nome.toUpperCase();
        const espaco = temLogo ? lado * 0.18 : 0;
        const maxW = W * 0.96 - (temLogo ? lado + espaco : 0);
        const letra = (fs) => { g.font = `bold ${Math.round(fs)}px Arial, Helvetica, sans-serif`; };
        const caber = (linhas, maxFs) => {
          let fs = maxFs;
          for (; fs > H * 0.08; fs *= 0.95) { letra(fs); if (linhas.every(l => g.measureText(l).width <= maxW)) break; }
          return fs;
        };
        const linhas = [texto];
        const fs = caber(linhas, H * 0.3);
        letra(fs);
        const larguraNome = Math.max(...linhas.map(l => g.measureText(l).width));
        let x = (W - ((temLogo ? lado + espaco : 0) + larguraNome)) / 2;
        if (temLogo) { desenhaLogo(x, (H - lado) / 2, lado); x += lado + espaco; }
        g.fillStyle = lum > 0.6 ? '#14301F' : '#FFFFFF'; g.textAlign = 'left'; g.textBaseline = 'middle';
        const passo = fs * 1.1;
        linhas.forEach((l, k) => g.fillText(l, x, H / 2 + (k - (linhas.length - 1) / 2) * passo));
      }
    } else if (estilo === 'escudo') {
      // Só o logótipo (sem logótipo: a inicial num círculo da cor da equipa).
      const lado = Math.min(W, H) * 0.96;
      if (temLogo) desenhaLogo((W - lado) / 2, (H - lado) / 2, lado);
      else if (nome) {
        g.fillStyle = base; g.beginPath(); g.arc(W / 2, H / 2, lado / 2, 0, Math.PI * 2); g.fill();
        g.font = `bold ${Math.round(lado * 0.5)}px Arial, Helvetica, sans-serif`;
        g.fillStyle = lum > 0.6 ? '#14301F' : '#FFFFFF'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(nome[0].toUpperCase(), W / 2, H / 2 + lado * 0.03);
      }
    } else if (estilo === 'faixa') {
      // Faixa na cor da equipa, logótipo numa caixa branca à esquerda e o nome ao centro.
      const grad = g.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, base);
      grad.addColorStop(1, `rgb(${Math.round(r * 0.72)},${Math.round(gg * 0.72)},${Math.round(b * 0.72)})`);
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
      const pad = H * 0.12;
      const lado = H - pad * 2;
      let xTexto = pad;
      if (temLogo) {
        g.fillStyle = '#FFFFFF'; raio(pad, pad, lado, lado, lado * 0.12); g.fill();
        desenhaLogo(pad + lado * 0.08, pad + lado * 0.08, lado * 0.84);
        xTexto = pad * 2 + lado;
      }
      if (nome) {
        const texto = nome.toUpperCase();
        const larguraTexto = W - xTexto - pad;
        // Letra moderada: no máximo 22% da altura e 6% da largura da faixa.
        ajustaLetra(texto, larguraTexto * 0.9, Math.min(H * 0.22, W * 0.06));
        // Ao centro da faixa inteira; só se chegaria à caixa do logótipo é
        // que vai para o centro do espaço que sobra.
        const meia = g.measureText(texto).width / 2;
        const centro = W / 2 - meia >= xTexto ? W / 2 : xTexto + larguraTexto / 2;
        g.fillStyle = lum > 0.6 ? '#14301F' : '#FFFFFF';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(texto, centro, H / 2 + H * 0.01);
      }
    } else {
      // Simples: sem caixa nem faixa, logótipo e nome na cor da equipa, ao centro.
      const lado = H * 0.8;
      let fs = 0, larguraNome = 0;
      if (nome) {
        fs = ajustaLetra(nome, W * 0.9 - (temLogo ? lado * 1.25 : 0), H * 0.34);
        larguraNome = g.measureText(nome).width;
      }
      const total = (temLogo ? lado : 0) + (nome && temLogo ? lado * 0.25 : 0) + larguraNome;
      let x = (W - total) / 2;
      if (temLogo) { desenhaLogo(x, (H - lado) / 2, lado); x += lado * 1.25; }
      if (nome) {
        g.font = `bold ${Math.round(fs)}px Arial, Helvetica, sans-serif`;
        g.fillStyle = `#${corDoc.texto}`; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillText(nome, x, H / 2);
      }
    }
    return new Promise((res, rej) => {
      try { cv.toBlob(bl => (bl ? res(bl) : rej(new Error('imagem'))), 'image/png'); } catch (e) { rej(e); }
    });
  };
  // Um logótipo de outro site sem permissão (CORS) "suja" a imagem e o
  // browser não a deixa gravar: aí sai só com o nome.
  try { return await fazer(true); } catch (e) { return fazer(false); }
}

/* Núcleo comum ao Word e ao Excel. `partes`: [{ caminho, relsPath,
   pastaMedia, prefixoAlvo, forcar }]. Para cada imagem (pic) decide se é
   de exemplo, desenha a do clube (uma por tamanho e desenho) e troca a
   ligação da imagem para ela. */
export async function trocarImagensDoClube(zip, partes, prefixoMedia) {
  if (!T.nomeClube && !T.logoEquipa) return;
  const parser = new DOMParser();
  const ser = new XMLSerializer();
  const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const TIPO_IMG = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
  const analises = new Map(); // ficheiro da imagem → análise
  const feitas = new Map();   // "LxA:estilo" → nome do png
  let logo; let carregouLogo = false;
  let n = 1;
  for (const parte of partes) {
    if (!zip.file(parte.caminho) || !zip.file(parte.relsPath)) continue;
    const doc = parser.parseFromString(await zip.file(parte.caminho).async('string'), 'application/xml');
    const relsDoc = parser.parseFromString(await zip.file(parte.relsPath).async('string'), 'application/xml');
    const relsRaiz = relsDoc.documentElement;
    const relsLista = () => [...relsRaiz.getElementsByTagNameNS(REL_NS, 'Relationship')];
    let mudou = false;
    const itens = [];
    for (const pic of [...doc.getElementsByTagNameNS('*', 'pic')]) {
      const blip = pic.getElementsByTagNameNS('*', 'blip')[0];
      const cNvPr = pic.getElementsByTagNameNS('*', 'cNvPr')[0];
      if (!blip) continue;
      // Tamanho: o da própria imagem (spPr › xfrm › ext) ou o do desenho Word (extent).
      let cx = 0, cy = 0;
      const xfrm = pic.getElementsByTagNameNS('*', 'xfrm')[0];
      const ext = xfrm ? [...xfrm.childNodes].find(x => x.localName === 'ext') : null;
      if (ext) { cx = Number(ext.getAttribute('cx')) || 0; cy = Number(ext.getAttribute('cy')) || 0; }
      if (!cx || !cy) {
        for (let a = pic.parentNode; a; a = a.parentNode) {
          if (a.localName === 'inline' || a.localName === 'anchor') {
            const e2 = [...a.childNodes].find(x => x.localName === 'extent');
            if (e2) { cx = Number(e2.getAttribute('cx')) || 0; cy = Number(e2.getAttribute('cy')) || 0; }
            break;
          }
        }
      }
      if (!cx || !cy) continue;
      // O texto alternativo: no Word está no docPr do desenho; no Excel no cNvPr.
      let docPr = null, desenhoWord = null;
      for (let a = pic.parentNode; a; a = a.parentNode) {
        if (a.localName === 'inline' || a.localName === 'anchor') { desenhoWord = a; docPr = [...a.childNodes].find(x => x.localName === 'docPr') || null; break; }
      }
      const comDescr = docPr || cNvPr;
      const descr = (comDescr && comDescr.getAttribute('descr')) || '';
      const marcado = descr.startsWith(MARCA_CLUBE_DOC);
      const idAntigo = blip.getAttributeNS(R_NS, 'embed') || blip.getAttribute('r:embed');
      const rel = relsLista().find(x => x.getAttribute('Id') === idAntigo);
      if (!rel) continue;
      let estilo = null;
      if (marcado) {
        const m = /\[v2:(escudo|simples|sobre|faixa)\]/.exec(descr);
        if (m) estilo = m[1];
        else {
          // Marcas das versões anteriores: rodapé e cabeçalho estreito (o
          // do relatório de ocorrência) sem faixa; no corpo da página (a
          // caixa da organização) por cima da faixa; quadradas, escudo.
          const quadrada = cy >= cx * 0.66;
          estilo = quadrada ? 'escudo'
            : (/footer/.test(parte.caminho) || (/header/.test(parte.caminho) && cx < 3000000)) ? 'simples'
            : /document/.test(parte.caminho) ? 'sobre' : 'faixa';
        }
      } else {
        const alvo = rel.getAttribute('Target') || '';
        const ficheiro = alvo.startsWith('/') ? alvo.slice(1) : `${prefixoMedia}${alvo.replace(/^(\.\.\/)+/, '').replace(/^media\//, 'media/')}`;
        const exemploPeloNome = cNvPr && IMAGENS_EXEMPLO_MODELO.test(cNvPr.getAttribute('name') || '');
        if (!analises.has(ficheiro)) {
          const f = zip.file(ficheiro);
          analises.set(ficheiro, f ? await analisarImagemModelo(await f.async('uint8array'), (ficheiro.split('.').pop() || '')) : null);
        }
        const info = analises.get(ficheiro);
        const exemplo = exemploPeloNome || (info && info.cinzenta);
        if (!exemplo && !parte.forcar) continue;
        if (!info && !exemploPeloNome && !parte.forcar) continue;
        estilo = estiloImagemClube(info, cx, cy);
      }
      itens.push({ pic, blip, comDescr, desenhoWord, ext, cx, cy, estilo });
    }
    // Caixas "sobre" da mesma parte: todas com o tamanho da mais baixa
    // (essa cabe na faixa). Mantém-se o topo e o centro na horizontal.
    const sobres = itens.filter(it => it.estilo === 'sobre');
    if (sobres.length > 1) {
      const alvo = sobres.reduce((a, b) => (b.cy < a.cy ? b : a));
      sobres.forEach(it => {
        if (it === alvo || (it.cx === alvo.cx && it.cy === alvo.cy)) return;
        const dx = Math.round((it.cx - alvo.cx) / 2);
        if (it.ext) { it.ext.setAttribute('cx', String(alvo.cx)); it.ext.setAttribute('cy', String(alvo.cy)); }
        if (it.desenhoWord) {
          const e2 = [...it.desenhoWord.childNodes].find(x => x.localName === 'extent');
          if (e2) { e2.setAttribute('cx', String(alvo.cx)); e2.setAttribute('cy', String(alvo.cy)); }
          const posH = [...it.desenhoWord.childNodes].find(x => x.localName === 'positionH');
          const off = posH ? [...posH.childNodes].find(x => x.localName === 'posOffset') : null;
          if (off) off.textContent = String((Number(off.textContent) || 0) + dx);
        }
        it.cx = alvo.cx; it.cy = alvo.cy;
      });
    }
    if (sobres.length) {
      // Largura para o nome caber numa linha ao lado do logótipo (letra a
      // 30% da altura), sem passar de 4,2 vezes a altura.
      const nomeMaius = String(T.nomeClube || '').toUpperCase();
      let porLetra = 0;
      try { const c2 = document.createElement('canvas').getContext('2d'); c2.font = 'bold 100px Arial, Helvetica, sans-serif'; porLetra = c2.measureText(nomeMaius).width / 100; } catch (e) { porLetra = nomeMaius.length * 0.68; }
      const razao = Math.min(4.2, Math.max(1.2, (T.logoEquipa ? 0.9 + 0.18 : 0) + porLetra * 0.3 + 0.1));
      const cyS = sobres[0].cy;
      const cxS = Math.round(cyS * razao);
      sobres.forEach(it => {
        if (it.ext) it.ext.setAttribute('cx', String(cxS));
        if (it.desenhoWord) {
          const e2 = [...it.desenhoWord.childNodes].find(x => x.localName === 'extent');
          if (e2) e2.setAttribute('cx', String(cxS));
        }
        it.cx = cxS;
      });
      // Duas caixas no Word: simétricas na folha (mesma distância à borda
      // esquerda e à direita) e à mesma altura.
      const ws = sobres.filter(it => it.desenhoWord && it.desenhoWord.localName === 'anchor');
      const sect = doc.getElementsByTagNameNS('*', 'sectPr')[0];
      const pgSz = sect ? [...sect.childNodes].find(x => x.localName === 'pgSz') : null;
      const pgMar = sect ? [...sect.childNodes].find(x => x.localName === 'pgMar') : null;
      const pgW = pgSz ? (Number(pgSz.getAttribute('w:w')) || 0) * 635 : 0;
      if (ws.length === 2 && pgW) {
        const margemE = pgMar ? (Number(pgMar.getAttribute('w:left')) || 0) * 635 : 0;
        const filhoDe = (no, nome) => [...no.childNodes].find(x => x.localName === nome) || null;
        const xAbs = (it) => {
          const ph = filhoDe(it.desenhoWord, 'positionH');
          const off = ph ? filhoDe(ph, 'posOffset') : null;
          if (!ph || !off) return null;
          const rf = ph.getAttribute('relativeFrom');
          const dentroCelula = it.desenhoWord.getAttribute('layoutInCell') === '1' && (() => { for (let a = it.desenhoWord.parentNode; a; a = a.parentNode) if (a.localName === 'tc') return true; return false; })();
          if (dentroCelula) return null;
          const v = Number(off.textContent) || 0;
          return rf === 'page' ? v : (rf === 'margin' || rf === 'column') ? margemE + v : null;
        };
        const [a, b] = ws;
        const xa = xAbs(a), xb = xAbs(b);
        const [esq, dir] = xa !== null && xb !== null && xb < xa ? [b, a] : [a, b];
        const xEsq = xAbs(esq);
        const L = xEsq !== null && xEsq >= 0 && xEsq < pgW / 2 - cxS ? xEsq : Math.round(pgW * 0.08);
        const pos = (it, x) => {
          let ph = filhoDe(it.desenhoWord, 'positionH');
          if (!ph) return;
          [...ph.childNodes].forEach(n2 => ph.removeChild(n2));
          ph.setAttribute('relativeFrom', 'page');
          const off = doc.createElementNS(ph.namespaceURI, `${ph.prefix ? ph.prefix + ':' : ''}posOffset`);
          off.textContent = String(Math.round(x));
          ph.appendChild(off);
          // Posição pela folha, não pela célula da tabela.
          it.desenhoWord.setAttribute('layoutInCell', '0');
        };
        pos(esq, L);
        pos(dir, pgW - L - cxS);
        // Mesma altura: a da caixa da esquerda.
        const pvE = filhoDe(esq.desenhoWord, 'positionV');
        const pvD = filhoDe(dir.desenhoWord, 'positionV');
        if (pvE && pvD) dir.desenhoWord.replaceChild(pvE.cloneNode(true), pvD);
        // Por cima do texto, sem o empurrar (senão o título descia).
        [esq, dir].forEach(it => {
          const ww = [...it.desenhoWord.childNodes].find(x => /^wrap/.test(x.localName || ''));
          if (ww && ww.localName !== 'wrapNone') {
            const nn = doc.createElementNS(ww.namespaceURI, `${ww.prefix ? ww.prefix + ':' : ''}wrapNone`);
            it.desenhoWord.replaceChild(nn, ww);
          }
        });
        /* TUDO AO CENTRO DA BARRA. A barra é a linha da tabela onde estão as
           caixas. O título fica centrado na vertical da célula e as caixas
           passam para o parágrafo do título, centradas na altura da linha
           dele: assim acompanham-no, esteja a tabela onde estiver na folha. */
        const acima = (no, nome) => { for (let x = no.parentNode; x; x = x.parentNode) if (x.localName === nome) return x; return null; };
        const tr = acima(esq.desenhoWord, 'tr');
        const titulo = tr ? [...tr.getElementsByTagNameNS(W_NS, 'p')].find(pp => textoDoNo(pp).trim()) : null;
        if (tr && titulo && acima(dir.desenhoWord, 'tr') === tr) {
          {
            // Altura da linha do título: o tamanho da letra (w:sz em meios
            // pontos) × 1,15, em EMU (1 pt = 12700).
            const runTexto = [...titulo.getElementsByTagNameNS(W_NS, 'r')].find(r => textoDoNo(r).trim());
            const szEl = (runTexto && runTexto.getElementsByTagNameNS(W_NS, 'sz')[0]) || titulo.getElementsByTagNameNS(W_NS, 'sz')[0];
            const pt = szEl ? (Number(szEl.getAttribute('w:val')) || 28) / 2 : 14;
            const alturaTitulo = Math.round(pt * 1.15 * 12700);
            // O Word mede a posição a partir do topo da célula, sem contar
            // com o centrar na vertical: com a altura da linha da tabela
            // definida, centra-se na barra inteira; sem ela, na linha do título.
            const trPr = filhoDe(tr, 'trPr');
            const trH = trPr ? filhoDe(trPr, 'trHeight') : null;
            const alturaBarra = trH ? (Number(trH.getAttribute('w:val')) || 0) * 635 : 0;
            const y = Math.round(((alturaBarra > alturaTitulo ? alturaBarra : alturaTitulo) - cyS) / 2);
            [esq, dir].forEach(it => {
              const run = acima(it.desenhoWord, 'r');
              if (run && acima(run, 'p') !== titulo) {
                run.parentNode.removeChild(run);
                const pPr = filhoDe(titulo, 'pPr');
                titulo.insertBefore(run, pPr ? pPr.nextSibling : titulo.firstChild);
              }
              const pv = filhoDe(it.desenhoWord, 'positionV');
              if (!pv) return;
              [...pv.childNodes].forEach(n2 => pv.removeChild(n2));
              pv.setAttribute('relativeFrom', 'paragraph');
              const off = doc.createElementNS(pv.namespaceURI, `${pv.prefix ? pv.prefix + ':' : ''}posOffset`);
              off.textContent = String(y);
              pv.appendChild(off);
            });
            // Título (e o resto da barra) centrado na vertical das células.
            [...tr.childNodes].filter(x => x.localName === 'tc').forEach(tc => {
              let tcPr = filhoDe(tc, 'tcPr');
              const W2 = tc.namespaceURI;
              if (!tcPr) { tcPr = doc.createElementNS(W2, 'w:tcPr'); tc.insertBefore(tcPr, tc.firstChild); }
              let va = filhoDe(tcPr, 'vAlign');
              if (!va) {
                va = doc.createElementNS(W2, 'w:vAlign');
                // vAlign vem depois destes no tcPr (ordem do esquema).
                const depois = [...tcPr.childNodes].find(x => ['hideMark', 'headers', 'cellIns', 'cellDel', 'cellMerge', 'tcPrChange'].includes(x.localName));
                tcPr.insertBefore(va, depois || null);
              }
              va.setAttribute('w:val', 'center');
            });
            // O espaço antes/depois do parágrafo do título desviava-o do centro.
            [...tr.getElementsByTagNameNS(W_NS, 'p')].forEach(pp => {
              if (!textoDoNo(pp).trim()) return;
              const pPr = filhoDe(pp, 'pPr');
              const sp = pPr ? filhoDe(pPr, 'spacing') : null;
              if (sp) { sp.setAttribute('w:before', '0'); sp.setAttribute('w:after', '0'); }
            });
          }
        }
      }
    }
    for (const { blip, comDescr, cx, cy, estilo } of itens) {
      const largura = 1600;
      const altura = Math.max(40, Math.round(largura * cy / cx));
      const desenho = estilo;
      const chave = `${largura}x${altura}:${desenho}`;
      if (!feitas.has(chave)) {
        if (!carregouLogo) { logo = await carregarLogoEquipaParaDoc(); carregouLogo = true; }
        const blob = await desenharImagemClube({ largura, altura, estilo: desenho, logo });
        while (zip.file(`${prefixoMedia}media/mjp-clube-${n}.png`)) n++;
        const nome = `mjp-clube-${n}.png`; n++;
        zip.file(`${prefixoMedia}media/${nome}`, await blob.arrayBuffer());
        feitas.set(chave, nome);
      }
      let k = 1; while (relsLista().some(x => x.getAttribute('Id') === `rIdMJPc${k}`)) k++;
      const novo = relsDoc.createElementNS(REL_NS, 'Relationship');
      novo.setAttribute('Id', `rIdMJPc${k}`); novo.setAttribute('Type', TIPO_IMG); novo.setAttribute('Target', `${parte.prefixoAlvo}${feitas.get(chave)}`);
      relsRaiz.appendChild(novo);
      blip.setAttributeNS(R_NS, 'r:embed', `rIdMJPc${k}`);
      // Um recorte da imagem de exemplo cortaria a nova.
      const blipFill = blip.parentNode;
      [...blipFill.childNodes].filter(x => x.localName === 'srcRect').forEach(x => blipFill.removeChild(x));
      // Efeitos da imagem de exemplo (transparência, brilho, cinzento…)
      // deixavam a nova esbatida.
      [...blip.childNodes].filter(x => x.nodeType === 1 && x.localName !== 'extLst').forEach(x => blip.removeChild(x));
      if (comDescr) comDescr.setAttribute('descr', `${MARCA_CLUBE_DOC} [v2:${estilo}]`);
      mudou = true;
    }
    if (mudou) {
      zip.file(parte.caminho, ser.serializeToString(doc));
      zip.file(parte.relsPath, ser.serializeToString(relsDoc));
    }
  }
  if (feitas.size) {
    const ctPath = '[Content_Types].xml';
    let ct = await zip.file(ctPath).async('string');
    if (!/<Default\b[^>]*Extension="png"/i.test(ct)) ct = ct.replace(/(<Types\b[^>]*>)/, '$1<Default Extension="png" ContentType="image/png"/>');
    zip.file(ctPath, ct);
  }
}

export async function aplicarClubeNosModelosWord(zip, { forcar = false } = {}) {
  const partes = Object.keys(zip.files)
    .filter(n => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n))
    .map(caminho => ({
      caminho,
      relsPath: caminho.replace(/^word\//, 'word/_rels/') + '.rels',
      prefixoAlvo: 'media/',
      // Ao descarregar: tudo o que está no cabeçalho e no rodapé é de exemplo.
      forcar: forcar && /header|footer/.test(caminho),
    }));
  await trocarImagensDoClube(zip, partes, 'word/');
}

/* EXCEL: CABEÇALHOS NA COR DA EQUIPA E COM O CLUBE.
   Só se mexe nos estilos fixos das células (secções <fonts> e <fills>
   do styles.xml), que é onde estão os títulos e cabeçalhos. NÃO se toca:
   · na formatação condicional (<dxfs>), que é onde estão as cores das
     faltas, presenças, lesões…;
   · nos gráficos (xl/charts) nem nos temas.
   As imagens de exemplo (escudos "CLUBE" cinzentos…) passam a ser a
   imagem do clube, como no Word (ver `trocarImagensDoClube`). */
export async function pintarCorEquipaExcel(zip) {
  const cor = corEquipaParaDocumentos();
  const f = zip.file('xl/styles.xml');
  if (!cor || !f) return;
  const xml0 = await f.async('string');
  const trocar = (bloco, nova) => bloco.replace(/(\brgb=")(?:[0-9A-Fa-f]{2})?([0-9A-Fa-f]{6})(")/g, (m, a, h, z) => (ehVermelhoDeModelo(h) ? `${a}FF${nova}${z}` : m));
  const xml = xml0
    .replace(/<fonts\b[\s\S]*?<\/fonts>/, b => trocar(b, cor.texto))
    .replace(/<fills\b[\s\S]*?<\/fills>/, b => trocar(b, cor.fundo));
  if (xml !== xml0) zip.file('xl/styles.xml', xml);
}

export async function aplicarClubeNosModelosExcel(zip) {
  const partes = Object.keys(zip.files)
    .filter(n => /^xl\/drawings\/drawing\d+\.xml$/.test(n))
    .map(caminho => ({ caminho, relsPath: caminho.replace(/^xl\/drawings\//, 'xl/drawings/_rels/') + '.rels', prefixoAlvo: '../media/', forcar: false }));
  await trocarImagensDoClube(zip, partes, 'xl/');
}

/* Descarregar um modelo base já com a imagem do clube: cor da equipa e
   logótipo/nome do clube (Word: cabeçalho e rodapé; Excel: cabeçalhos
   das folhas, sem mexer nas cores das faltas nem nos gráficos). */
export async function descarregarModeloBase(x) {
  const r = await fetch(x.ficheiro);
  if (!r.ok) throw new Error('Não consegui descarregar o modelo.');
  let blob = await r.blob();
  if (x.tipo === 'Word') {
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    await pintarCorEquipaWord(zip);
    await aplicarClubeNosModelosWord(zip, { forcar: true });
    blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  } else if (x.tipo === 'Excel') {
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    await pintarCorEquipaExcel(zip);
    await aplicarClubeNosModelosExcel(zip);
    blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = decodeURIComponent(x.ficheiro.split('/').pop());
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function carimbarMarcaExcel(zip) {
  const codigo = `&amp;R&amp;"Arial,Bold"&amp;7&amp;K999999${MARCA_APP}`;
  const DEPOIS = ['rowBreaks', 'colBreaks', 'customProperties', 'cellWatches', 'ignoredErrors', 'smartTags', 'drawing', 'legacyDrawing', 'legacyDrawingHF', 'drawingHF', 'picture', 'oleObjects', 'controls', 'webPublishItems', 'tableParts', 'extLst'];
  const folhas = Object.keys(zip.files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  for (const caminho of folhas) {
    let xml = await zip.file(caminho).async('string');
    if (xml.includes(MARCA_APP)) continue;
    const hf = xml.match(/<headerFooter\b[^>]*\/>|<headerFooter\b[^>]*>[\s\S]*?<\/headerFooter>/);
    // Já há algo à direita (ex.: n.º da página): a marca junta-se no fim
    // dessa secção, se for a última; senão, fica como está.
    const juntar = (rodape) => {
      if (!/&amp;R/.test(rodape)) return rodape + codigo;
      const resto = rodape.slice(rodape.lastIndexOf('&amp;R'));
      return /&amp;[LC]/.test(resto) ? rodape : `${rodape}  ${codigo.replace('&amp;R', '')}`;
    };
    if (hf) {
      let bloco = hf[0];
      if (/\/>$/.test(bloco)) bloco = bloco.replace(/\/>$/, '></headerFooter>');
      const comRodape = (tag) => {
        if (new RegExp(`<${tag}>`).test(bloco)) bloco = bloco.replace(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`), (m, c) => `<${tag}>${juntar(c)}</${tag}>`);
        else if (tag === 'oddFooter' && /<oddHeader>[\s\S]*?<\/oddHeader>/.test(bloco)) bloco = bloco.replace(/(<oddHeader>[\s\S]*?<\/oddHeader>)/, `$1<oddFooter>${codigo}</oddFooter>`);
        else if (tag === 'oddFooter') bloco = bloco.replace(/(<headerFooter\b[^>]*>)/, `$1<oddFooter>${codigo}</oddFooter>`);
        else bloco = bloco.replace('</headerFooter>', `<${tag}>${codigo}</${tag}>`.replace(/^/, '') + '</headerFooter>');
      };
      comRodape('oddFooter');
      if (/differentOddEven="(1|true)"/.test(bloco)) comRodape('evenFooter');
      if (/differentFirst="(1|true)"/.test(bloco)) comRodape('firstFooter');
      xml = xml.replace(hf[0], bloco);
    } else {
      const novo = `<headerFooter><oddFooter>${codigo}</oddFooter></headerFooter>`;
      const m = xml.match(new RegExp(`<(${DEPOIS.join('|')})\\b`));
      xml = m ? xml.replace(m[0], novo + m[0]) : xml.replace('</worksheet>', `${novo}</worksheet>`);
    }
    zip.file(caminho, xml);
  }
}

/* RELATÓRIOS DAS JORNADAS (o mesmo Excel da estatística da época).

   O modelo tem uma folha por jornada: "Relatório Nª Jornada" (1ª fase,
   1 a 30), "Relatório Nª Jornada (2ª fase)" (1 a 10) e "Relatório Nª
   Jornada (PE)" (11 a 15). A folha ESTATÍSTICA TOTAL soma tudo por
   fórmula, por isso basta preencher cada relatório.

   Que folha recebe cada jogo: a COMPETIÇÃO diz a fase e o NÚMERO DA
   JORNADA diz a folha. A competição oficial mais antiga da época é a 1ª
   fase; a segunda (ou a que tiver "2ª fase", "prova extra", "manutenção",
   "apuramento"… no nome) é a 2ª fase, que continua na PE a partir da 11ª.
   Amigáveis, taças e jogos ainda por jogar ficam de fora.

   O que se escreve por jogo: cabeçalho (treinador, prova, escalão, data,
   hora, local, nº do jogo, equipas e resultado), uma linha por atleta
   (T1 a T4, convocado, titular, suplente utilizado, golos, assistências,
   cartões, rendimento de 1 a 5 e minutos), o sistema usado, as notas da
   equipa técnica e os pontos fortes e fracos da ficha do adversário. As
   análises por fases do jogo ficam em branco para preencher à mão. */
// Taças não têm folhas de relatório no modelo (são eliminatórias): não
// contam como 1ª nem como 2ª fase, mesmo que tenham "jornadas".
export const PISTA_TACA = /(ta[cç]a|supertac|cup\b)/i;

export const PISTA_SEGUNDA_FASE = /(2\s*[ªaº.]?\s*fase|fase\s*2|segunda\s*fase|prova\s*extra|\bpe\b|manuten|apuramento|subida|descida|play.?off)/i;

export function numeroDaJornada(rotulo) {
  const m = String(rotulo || '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// Chave de comparação de um nome de folha: sem acentos, sem espaços e
// com "º" igual a "ª" ("1ª Jornada(2º fase)" e "3ª Jornada (2ª fase)"
// têm grafias diferentes no próprio modelo).
export function chaveDaFolha(nome) {
  return semAcentos(nome).replace(/º/g, 'ª').replace(/\s+/g, '');
}

export async function folhasDoLivro(zip) {
  const wbXml = await zip.file('xl/workbook.xml').async('string');
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const out = {};
  [...wbXml.matchAll(/<sheet\b[^>]*>/g)].forEach(([tag]) => {
    const nome = (tag.match(/name="([^"]*)"/) || [])[1];
    const rid = (tag.match(/r:id="([^"]*)"/) || [])[1];
    if (!nome || !rid) return;
    const mRel = relsXml.match(new RegExp(`<Relationship Id="${rid}"[^>]*Target="([^"]+)"`));
    if (!mRel) return;
    const alvo = mRel[1].replace(/^\/?xl\//, '').replace(/^\//, '');
    out[chaveDaFolha(nome.replace(/&amp;/g, '&'))] = `xl/${alvo}`;
  });
  return out;
}

export function chaveDoRelatorio(fase, n) {
  if (fase === 1) return chaveDaFolha(`Relatório ${n}ª Jornada`);
  return chaveDaFolha(n <= 10 ? `Relatório ${n}ª Jornada (2ª fase)` : `Relatório ${n}ª Jornada (PE)`);
}

// Rendimento da app (0 a 10) para a escala do modelo (1 a 5): metade,
// arredondada, nunca abaixo de 1 nem acima de 5.
export function rendimentoDe1a5(nota) {
  if (nota === '' || nota == null || Number.isNaN(Number(nota))) return null;
  return Math.min(5, Math.max(1, Math.round(Number(nota) / 2)));
}

export function dataPtRelatorio(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/* Escolhe a folha de cada jogo. Devolve { jogos: [{ m, chave, fase, n }],
   ignorados: [{ m, motivo }] }. */
export function planoDosRelatorios(matches, chavesDisponiveis, hoje) {
  const oficiais = (matches || []).filter(m => m && m.date && !isFriendlyMatch(m) && numeroDaJornada(m.jornada));
  const comps = new Map();
  oficiais.forEach(m => {
    const nome = String(m.competition || '').trim();
    const c = comps.get(nome) || { nome, inicio: m.date };
    if (m.date < c.inicio) c.inicio = m.date;
    comps.set(nome, c);
  });
  const lista = [...comps.values()].filter(c => !PISTA_TACA.test(c.nome)).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const semPista = lista.filter(c => !PISTA_SEGUNDA_FASE.test(c.nome));
  const comPista = lista.filter(c => PISTA_SEGUNDA_FASE.test(c.nome));
  const primeira = semPista[0] || null;
  const segunda = comPista[0] || semPista[1] || null;
  const faseDe = (nome) => (primeira && nome === primeira.nome ? 1 : segunda && nome === segunda.nome ? 2 : null);

  const jogos = [];
  const ignorados = [];
  const usadas = new Set();
  [...oficiais].sort((a, b) => a.date.localeCompare(b.date)).forEach(m => {
    const jogado = m.date <= hoje && (parseScore(m.result) || (m.convocados || []).length);
    if (!jogado) return;
    const fase = faseDe(String(m.competition || '').trim());
    const n = numeroDaJornada(m.jornada);
    if (!fase) { ignorados.push({ m, motivo: 'competição sem folha no modelo' }); return; }
    const chave = chaveDoRelatorio(fase, n);
    if (!chavesDisponiveis.has(chave)) { ignorados.push({ m, motivo: 'jornada sem folha no modelo' }); return; }
    if (usadas.has(chave)) { ignorados.push({ m, motivo: 'jornada repetida' }); return; }
    usadas.add(chave);
    jogos.push({ m, chave, fase, n });
  });
  return { jogos, ignorados, primeira: primeira && primeira.nome, segunda: segunda && segunda.nome };
}

/* Os treinos da semana do jogo, por ordem: as sessões dos 7 dias antes
   do jogo (depois do jogo anterior, se foi nesse intervalo), as últimas
   quatro. */
export function treinosDaSemana(m, sessions, matches) {
  const d0 = new Date(`${m.date}T12:00:00`);
  const limite = new Date(d0); limite.setDate(limite.getDate() - 7);
  let desde = limite.toISOString().slice(0, 10);
  (matches || []).forEach(x => { if (x && x.id !== m.id && x.date && x.date < m.date && x.date >= desde) desde = x.date; });
  const datas = [...new Set((sessions || [])
    .filter(s => s && s.date && s.phase !== 'Descanso' && s.date > desde && s.date < m.date)
    .map(s => s.date))].sort();
  return datas.slice(-4);
}

/* Texto longo num relatório (a análise do jogo, os pontos fortes e
   fracos): a célula do modelo não quebra linhas e a linha tem altura
   fixa, por isso um texto grande ficava cortado numa linha só. Cria-se
   (uma vez por estilo) uma cópia do estilo da célula com quebra de linha
   e alinhamento ao cimo, e a linha cresce à medida do texto. */
export async function estilosComQuebra(zip) {
  const f = zip.file('xl/styles.xml');
  let xml = f ? await f.async('string') : '';
  const cache = {};
  let mudou = false;
  const obter = (s) => {
    if (!xml) return s;
    if (cache[s] != null) return cache[s];
    const m = xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/);
    if (!m) return s;
    const xfs = m[1].match(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g) || [];
    const base = xfs[Number(s) || 0];
    if (!base) return s;
    let novo = base.replace(/<alignment\b[^>]*\/>/, '');
    const alinhamento = '<alignment horizontal="left" vertical="top" wrapText="1"/>';
    novo = /\/>$/.test(novo) && !/<\/xf>$/.test(novo)
      ? novo.replace(/\s*\/>$/, `>${alinhamento}</xf>`)
      : novo.replace(/^<xf\b[^>]*>/, t => t + alinhamento);
    novo = novo.replace(/\sapplyAlignment="[^"]*"/, '').replace(/^<xf\b/, '<xf applyAlignment="1"');
    const idx = xfs.length;
    const bloco = m[0].replace(/<\/cellXfs>$/, `${novo}</cellXfs>`).replace(/(<cellXfs\b[^>]*count=")\d+"/, `$1${idx + 1}"`);
    xml = xml.replace(m[0], bloco);
    cache[s] = idx;
    mudou = true;
    return idx;
  };
  return { obter, gravar: () => { if (mudou) zip.file('xl/styles.xml', xml); } };
}

export function linhasDoTexto(texto, porLinha) {
  return String(texto || '').split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / porLinha)), 0);
}

export function definirAlturaDaLinha(sheetXml, linha, pontos) {
  const re = new RegExp(`<row r="${linha}"([^>]*?)(/?)>`);
  const m = sheetXml.match(re);
  if (!m) return sheetXml;
  const attrs = m[1].replace(/\sht="[^"]*"/, '').replace(/\scustomHeight="[^"]*"/, '');
  return sheetXml.replace(re, `<row r="${linha}"${attrs} ht="${pontos}" customHeight="1"${m[2]}>`);
}

export async function preencherRelatoriosJornadas(zip, { players, matches, sessions, clinico, convocatorias, adversarios, scouting, clube, escalao }) {
  const folhas = await folhasDoLivro(zip);
  const hoje = new Date().toISOString().slice(0, 10);
  const plano = planoDosRelatorios(matches, new Set(Object.keys(folhas)), hoje);
  plano.temFolhas = Object.keys(folhas).some(k => k.startsWith('relatorio'));
  const jogadores = players.slice(0, 30);
  const estilos = await estilosComQuebra(zip);

  for (const { m, chave, n } of plano.jogos) {
    const caminho = folhas[chave];
    let x = await zip.file(caminho).async('string');
    const conv = (convocatorias || []).find(c => c && c.data === m.date) || null;
    const sc = parseScore(m.result);
    const nossos = sc ? (m.atHome ? sc.home : sc.away) : null;
    const deles = sc ? (m.atHome ? sc.away : sc.home) : null;
    const ficha = fichaDaEquipa(m.opponent, adversarios);
    const texto = (ref, v) => { if (v !== '' && v != null) x = definirTextoNaCelula(x, ref, String(v)); };
    const numero = (ref, v) => { if (v !== '' && v != null && Number.isFinite(Number(v))) x = definirNumeroNaCelula(x, ref, Number(v)); };
    // Escreve o texto com quebra de linha e devolve quantas linhas ocupa.
    const textoLongo = (ref, v, porLinha) => {
      const t = String(v || '').trim();
      if (!t) return 0;
      texto(ref, t);
      x = x.replace(new RegExp(`<c r="${ref}"( s="(\\d+)")?`), (all, _a, sId) => `<c r="${ref}" s="${estilos.obter(sId || 0)}"`);
      return linhasDoTexto(t, porLinha);
    };
    // 13 pontos por linha de texto (letra 9 com o espaço entre linhas) e
    // nunca acima de 409, o máximo que o Excel aceita numa linha.
    const crescer = (linha, nLinhas, minimo) => {
      if (nLinhas > 0) x = definirAlturaDaLinha(x, linha, Math.min(409, Math.max(minimo, Math.ceil(nLinhas * 13 + 8))));
    };

    texto('C4', conv && conv.treinador);
    texto('J4', String(m.competition || '').trim());
    texto('P4', (conv && conv.escalao) || escalao);
    texto('C5', dataPtRelatorio(m.date));
    texto('J5', conv && conv.horaJogo);
    texto('O5', (conv && conv.localJogo) || (m.atHome ? 'Casa' : 'Fora'));
    numero('C6', n);
    texto('A7', clube);
    numero('G7', nossos);
    numero('I7', deles);
    texto('K7', m.opponent);

    const report = m.report || {};
    const convocados = m.convocados || [];
    const titulares = m.starters || [];
    const datasTreino = treinosDaSemana(m, sessions, matches);
    jogadores.forEach((p, i) => {
      const linha = 11 + i;
      datasTreino.forEach((d, k) => {
        const estado = estadoNoDia(p.id, d, sessions, [], clinico);
        if (estado !== null) numero(`${'CDEF'[k]}${linha}`, VALOR_ASSIDUIDADE[estado]);
      });
      const convocado = convocados.includes(p.id);
      const r = report[p.id] || {};
      const min = Number(r.minutes) || 0;
      const titular = convocado && titulares.includes(p.id);
      numero(`G${linha}`, convocado ? 1 : 0);
      numero(`H${linha}`, titular ? 1 : 0);
      numero(`I${linha}`, convocado && !titular && min > 0 ? 1 : 0);
      if (!convocado) return;
      numero(`J${linha}`, Number(r.goals) || 0);
      numero(`K${linha}`, Number(r.assists) || 0);
      numero(`L${linha}`, r.card === 'yellow' || r.card === 'yellow2' ? 1 : 0);
      numero(`M${linha}`, r.card === 'yellow2' ? 1 : 0);
      numero(`N${linha}`, r.card === 'red' || r.card === 'yellow2' ? 1 : 0);
      const nota = rendimentoDe1a5(r.rating != null && r.rating !== '' ? r.rating : (m.ratings || {})[p.id]);
      if (nota !== null) numero(`O${linha}`, nota);
      numero(`P${linha}`, min);
    });

    if (m.formacao) texto('A49', /^1-/.test(m.formacao) ? m.formacao : `1-${m.formacao}`);
    // Observações gerais: a análise do jogo (Jogos › Relatórios), todas
    // as entradas, uma por parágrafo.
    const notas = notasDoJogo(m).map(nt => String(nt.texto || '').trim()).filter(Boolean);
    crescer(44, textoLongo('A44', notas.join('\n'), 150), 26.25);
    if (ficha) {
      const nF = textoLongo('A64', ficha.pontosFortes, 78);
      const nP = textoLongo('I64', ficha.pontosFracos, 66);
      crescer(64, Math.max(nF, nP), 40.5);
      // Melhores jogadores: os jogadores-chave da ficha do adversário
      // (Scouting), um por linha: "nº Nome (posição)".
      const chave = (ficha.jogadoresChaveIds || [])
        .map(id => (scouting || []).find(j => j && j.id === id))
        .filter(j => j && String(j.name || '').trim())
        .map(j => [j.camisola ? String(j.camisola).trim() : '', String(j.name).trim(), j.position ? `(${j.position})` : ''].filter(Boolean).join(' '));
      crescer(66, textoLongo('I66', chave.join('\n'), 66), 39.75);
    }
    zip.file(caminho, x);
  }
  estilos.gravar();
  return plano;
}

/* GRÁFICOS DA FOLHA "graficos": OS NOMES SAÍAM FORA DO SÍTIO.

   Com 30 atletas no eixo, os nomes inclinados (a 64° a 76°, cada gráfico
   com o seu ângulo) e em letra 10 sobrepunham-se, e o Excel/WPS passava a
   desenhá-los em duas filas desencontradas, longe da barra de cada um.
   Aqui os nomes do eixo ficam na vertical (90°), em letra 8 e sempre
   todos (um por barra), o que cabe sem se sobrepor.

   Mais duas correções: os gráficos de Golos e Assistências começavam no
   4.º atleta (linha 9), por isso os três primeiros da lista nunca
   apareciam; passam a mostrar os 30. E a memória de nomes guardada dentro
   de cada gráfico ("Atleta 1"…) passa a ter os nomes reais, para quem
   abrir o ficheiro num visualizador que não recalcula. */
export async function ajustarGraficosDosJogadores(zip, jogadores) {
  const nomes = Array.from({ length: 30 }, (_, i) => (jogadores[i] ? jogadores[i].name : ''));
  const graficos = Object.keys(zip.files).filter(n => /^xl\/charts\/chart\d+\.xml$/.test(n));
  for (const caminho of graficos) {
    let x = await zip.file(caminho).async('string');
    if (!/ESTAT[ÍI]STICA TOTAL'?!\$?B\$?\d+/.test(x)) continue;
    // Séries que começavam na linha 9 passam a começar na 6 (nomes e valores).
    x = x.replace(/(<c:f>'?ESTAT[ÍI]STICA TOTAL'?!\$?[A-Z]+\$?)9(:\$?[A-Z]+\$?35<\/c:f>)/g, '$16$2');
    // Memória dos nomes do eixo.
    x = x.replace(/(<c:cat>\s*<c:strRef>\s*<c:f>[^<]*<\/c:f>)\s*<c:strCache>[\s\S]*?<\/c:strCache>/g, (all, ini) =>
      `${ini}<c:strCache><c:ptCount val="30"/>${nomes.map((n, i) => `<c:pt idx="${i}"><c:v>${escaparXml(n)}</c:v></c:pt>`).join('')}</c:strCache>`);
    // A memória dos valores deixa de corresponder ao intervalo novo: fica
    // vazia com o tamanho certo e o Excel volta a preenchê-la ao abrir.
    x = x.replace(/(<c:val>\s*<c:numRef>\s*<c:f>[^<]*<\/c:f>\s*<c:numCache>\s*(?:<c:formatCode>[^<]*<\/c:formatCode>)?)\s*<c:ptCount val="\d+"\/>[\s\S]*?(<\/c:numCache>)/g, '$1<c:ptCount val="30"/>$2');
    // Eixo das categorias: nomes na vertical, letra 8, todos.
    x = x.replace(/<c:catAx>[\s\S]*?<\/c:catAx>/g, eixo => {
      let e = eixo.replace(/(<c:txPr>\s*<a:bodyPr\b[^>]*?)\srot="-?\d+"/, '$1').replace(/(<c:txPr>\s*<a:bodyPr)\b/, '$1 rot="-5400000"');
      e = e.replace(/(<c:txPr>[\s\S]*?<a:defRPr\b[^>]*?)\ssz="\d+"/, '$1').replace(/(<c:txPr>[\s\S]*?<a:defRPr)\b/, '$1 sz="800"');
      e = e.replace(/<c:tickLblSkip val="\d+"\/>/, '').replace(/<c:tickMarkSkip val="\d+"\/>/, '');
      e = /<c:lblOffset\b[^>]*\/>/.test(e)
        ? e.replace(/(<c:lblOffset\b[^>]*\/>)/, '$1<c:tickLblSkip val="1"/><c:tickMarkSkip val="1"/>')
        : e.replace(/(<c:noMultiLvlLbl\b[^>]*\/>|<\/c:catAx>)/, '<c:tickLblSkip val="1"/><c:tickMarkSkip val="1"/>$1');
      return e;
    });
    zip.file(caminho, x);
  }
}

export async function gerarFichaAssiduidade(arrayBuffer, players, sessions, matches, clinico, mesesEAnos, anoInicioEpoca, relatorios) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  // Logótipo e nome do clube no lugar das imagens de exemplo (antes de
  // se meter o resto: fotos dos jogadores, escudos do campo…).
  await aplicarClubeNosModelosExcel(zip);

  const estatPath = await resolverCaminhoDaFolha(zip, 'ESTATÍSTICA TOTAL');
  const assidPath = await resolverCaminhoDaFolha(zip, 'Ficha Assiduidade');
  if (!estatPath) throw new Error('A folha "ESTATÍSTICA TOTAL" não existe neste modelo.');
  if (!assidPath) throw new Error('A folha "Ficha Assiduidade" não existe neste modelo.');

  let estatXml = await zip.file(estatPath).async('string');
  let assidXml = await zip.file(assidPath).async('string');

  // Nomes em ESTATÍSTICA TOTAL!B6:B35 — é de lá que TODOS os blocos da
  // Ficha Assiduidade buscam o nome de cada jogador, por fórmula. Só
  // precisa de se escrever uma vez, não por mês.
  const jogadores = players.slice(0, 30);
  jogadores.forEach((p, i) => {
    estatXml = definirTextoNaCelula(estatXml, `B${6 + i}`, p.name);
  });

  // A ESTATÍSTICA TOTAL tem mais dois quadros por baixo (1ª fase e
  // 2ª fase/Prova Extra) com os nomes escritos à mão ("Atleta 1"…). Cada
  // quadro começa numa linha com "Nome" na coluna B; os atletas vêm duas
  // linhas abaixo. O primeiro quadro (linha 4) já foi tratado acima.
  {
    const ssFile = zip.file('xl/sharedStrings.xml');
    const ssXml = ssFile ? await ssFile.async('string') : '';
    const ss = [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => textoCompletoDoSi(m[1]).trim());
    const iNome = ss.findIndex(t => semAcentos(t) === 'nome');
    if (iNome >= 0) {
      [...estatXml.matchAll(new RegExp(`<c r="B(\\d+)"[^>]*t="s"[^>]*><v>${iNome}</v></c>`, 'g'))]
        .map(m => parseInt(m[1], 10))
        .filter(linha => linha > 4)
        .forEach(linha => {
          jogadores.forEach((p, i) => { estatXml = definirTextoNaCelula(estatXml, `B${linha + 2 + i}`, p.name); });
        });
    }
  }

  // A tabela de shared strings só serve para PROCURAR o título de cada
  // bloco; o texto que se escreve vai embutido diretamente na célula,
  // não se toca na tabela partilhada em si.
  const sharedXmlFile = zip.file('xl/sharedStrings.xml');
  const sharedXml = sharedXmlFile ? await sharedXmlFile.async('string') : '';
  const sharedStrings = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => textoCompletoDoSi(m[1]));

  // Localizam-se os 12 blocos ANTES de se escrever qualquer título: a
  // procura é pelo título original (shared string) e, depois de reescrito,
  // o título deixa de lá estar.
  const blocos = {};
  ORDEM_EPOCA.forEach(m => { blocos[m] = localizarBlocoAssiduidade(assidXml, sharedStrings, m); });

  // Todos os 12 títulos passam a ter o ano certo da época (Agosto a
  // Dezembro no ano em que a época começa, Janeiro a Julho no seguinte),
  // mesmo os meses que não se preencheram. O modelo traz anos antigos
  // escritos à mão ("Agosto 2022", e até "Dezembro 2023" por engano).
  const anoBase = Number.isFinite(anoInicioEpoca)
    ? anoInicioEpoca
    : (mesesEAnos && mesesEAnos[0] ? (mesesEAnos[0].mes >= 7 ? mesesEAnos[0].ano : mesesEAnos[0].ano - 1) : null);
  if (anoBase !== null) {
    ORDEM_EPOCA.forEach(m => {
      const b = blocos[m];
      if (b) assidXml = definirTextoNaCelula(assidXml, `A${b.linhaTitulo}`, `Ficha Assiduidade \n${MESES_PT[m]} ${anoDoMesNaEpoca(m, anoBase)}`);
    });
  }

  (mesesEAnos || []).forEach(({ mes, ano }) => {
    const bloco = blocos[mes];
    if (!bloco) throw new Error(`Não encontrei o bloco de ${MESES_PT[mes]} na Ficha Assiduidade — o modelo pode ter mudado.`);

    if (anoBase === null) assidXml = definirTextoNaCelula(assidXml, `A${bloco.linhaTitulo}`, `Ficha Assiduidade \n${MESES_PT[mes]} ${ano}`);

    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    jogadores.forEach((p, i) => {
      const linha = bloco.primeiraLinhaJogador + i;
      // O nome nesta linha vem por FÓRMULA (referencia ESTATÍSTICA TOTAL)
      // — só se atualiza o valor em cache, a fórmula em si fica intacta.
      assidXml = definirValorEmCache(assidXml, `B${linha}`, p.name);
      for (let dia = 1; dia <= diasNoMes; dia++) {
        const ref = letraDaColuna(1 + dia) + linha; // C = dia 1
        const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const estado = estadoNoDia(p.id, dataStr, sessions, matches, clinico);
        // Sem sessão nem jogo marcado nesse dia, a célula fica
        // exatamente como estava no modelo (em branco) — não se mexe
        // nela de todo. Havendo sessão/jogo, escreve-se sempre um
        // NÚMERO (1 ou 0), nunca uma letra — ver `VALOR_ASSIDUIDADE`.
        if (estado !== null) assidXml = definirNumeroNaCelula(assidXml, ref, VALOR_ASSIDUIDADE[estado]);
      }
    });
  });

  zip.file(estatPath, estatXml);
  zip.file(assidPath, assidXml);

  // Relatórios das jornadas, no mesmo ficheiro (só se pedido e se o
  // modelo os tiver). O resultado (jogos preenchidos e ignorados) volta
  // em `relatorios.resumo` para o formulário o mostrar.
  if (relatorios) relatorios.resumo = await preencherRelatoriosJornadas(zip, { players, matches, sessions, clinico, ...relatorios });

  await ajustarGraficosDosJogadores(zip, jogadores);

  // Sem isto, a coluna do total (AH) abre com o valor antigo (0) até
  // alguém forçar o Excel a recalcular — ver o comentário grande em
  // `forcarRecalculoAoAbrir`.
  await forcarRecalculoAoAbrir(zip);
  await pintarCorEquipaExcel(zip);
  await carimbarMarcaExcel(zip);

  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

/* FICHA INDIVIDUAL DO JOGADOR (Word) — UM SÓ .docx COM UMA FICHA POR
   JOGADOR, cada uma numa página.

   Lê o modelo carregado em Documentos (tal como está, com o cabeçalho, as
   cores e a formatação) e encontra cada caixa pelo TEXTO do rótulo, sem
   ser preciso mexer no Word:
   · "Nome Completo": a caixa à direita;
   · "Data nascimento", "Nacionalidade", "Posição", "Clube Anterior",
     "Peso", "Altura", "Lateralidade", "Contacto": a caixa por baixo;
   · "FOTO": a própria caixa, com a fotografia;
   · em cada "Avaliação Inicial / Intermédia / Final": o texto a seguir a
     "Observações:" e o número na caixa à direita de "Nível Atual" e de
     "Potencial" (da Avaliação da época, na ficha do jogador). */
export const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export const semAcentosDoc = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function textoDoNo(no) {
  return [...no.getElementsByTagNameNS(W_NS, 't')].map(t => t.textContent).join('');
}

// Escreve um texto na caixa (no 1.º parágrafo, com o tipo de letra do parágrafo).
export function escreverNaCelula(doc, tc, texto) {
  const p = tc.getElementsByTagNameNS(W_NS, 'p')[0];
  if (!p) return;
  [...p.childNodes].forEach(n => { if (n.localName === 'r' || n.localName === 'hyperlink') p.removeChild(n); });
  const linhas = String(texto == null ? '' : texto).split(/\r?\n/);
  const pPr = p.getElementsByTagNameNS(W_NS, 'pPr')[0];
  const rPrMarca = pPr ? [...pPr.childNodes].find(n => n.localName === 'rPr') : null;
  const r = doc.createElementNS(W_NS, 'w:r');
  if (rPrMarca) {
    // Mantém o tipo e o tamanho de letra, mas não a COR: há modelos em que
    // as caixas vazias guardam o branco dos rótulos, e o texto ficava
    // invisível (branco sobre branco). Sem cor, fica a do documento.
    const rPr = rPrMarca.cloneNode(true);
    [...rPr.childNodes].forEach(n => { if (n.localName === 'color') rPr.removeChild(n); });
    r.appendChild(rPr);
  }
  linhas.forEach((l, i) => {
    if (i > 0) r.appendChild(doc.createElementNS(W_NS, 'w:br'));
    const t = doc.createElementNS(W_NS, 'w:t');
    t.setAttribute('xml:space', 'preserve');
    t.textContent = l;
    r.appendChild(t);
  });
  p.appendChild(r);
}

// Observações: parágrafos novos logo a seguir ao rótulo, sem negrito nem sublinhado.
export function escreverObservacoes(doc, tc, texto) {
  const ps = [...tc.getElementsByTagNameNS(W_NS, 'p')];
  const rotulo = ps.find(p => /observa/i.test(semAcentosDoc(textoDoNo(p)))) || ps[0];
  if (!rotulo) return;
  // Os parágrafos vazios que já lá estavam (o espaço da caixa) ficam.
  const linhas = String(texto || '').split(/\r?\n/);
  let depois = rotulo;
  linhas.forEach(l => {
    const p = doc.createElementNS(W_NS, 'w:p');
    const pPr0 = rotulo.getElementsByTagNameNS(W_NS, 'pPr')[0];
    if (pPr0) {
      const pPr = pPr0.cloneNode(true);
      [...pPr.childNodes].forEach(n => { if (n.localName === 'rPr') pPr.removeChild(n); });
      p.appendChild(pPr);
    }
    const r = doc.createElementNS(W_NS, 'w:r');
    const t = doc.createElementNS(W_NS, 'w:t');
    t.setAttribute('xml:space', 'preserve');
    t.textContent = l;
    r.appendChild(t);
    p.appendChild(r);
    tc.insertBefore(p, depois.nextSibling);
    depois = p;
  });
}

// Grelha de uma tabela: para cada linha, as caixas com a coluna onde começam.
export function grelhaDaTabela(tbl) {
  return [...tbl.childNodes].filter(n => n.localName === 'tr').map(tr => {
    let col = 0;
    return [...tr.childNodes].filter(n => n.localName === 'tc').map(tc => {
      const span = Number((tc.getElementsByTagNameNS(W_NS, 'gridSpan')[0] || { getAttribute: () => 1 }).getAttribute('w:val')) || 1;
      const c = { tc, col, span };
      col += span;
      return c;
    });
  });
}

export function dataPt(d) {
  if (!d) return '';
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d);
}

// dataURL → bytes + tamanho natural (para a foto).
export async function fotoParaWord(src) {
  if (!src || typeof src !== 'string') return null;
  try {
    const resp = await fetch(src);
    const blob = await resp.blob();
    const tipo = /png/i.test(blob.type) ? 'png' : 'jpeg';
    const url = URL.createObjectURL(blob);
    const dim = await new Promise((res) => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res(null); im.src = url; });
    URL.revokeObjectURL(url);
    if (!dim || !dim.w || !dim.h) return null;
    return { bytes: new Uint8Array(await blob.arrayBuffer()), tipo, ...dim };
  } catch (e) { return null; }
}

export async function gerarFichasIndividuais(arrayBuffer, players, epoca) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  // Logótipo e nome do clube no lugar das imagens de exemplo (antes de
  // se meter o resto: fotos dos jogadores, escudos do campo…).
  await aplicarClubeNosModelosWord(zip);
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('Este ficheiro não é um Word (.docx) válido.');
  const xml = await docFile.async('string');
  const parser = new DOMParser();
  const modelo = parser.parseFromString(xml, 'application/xml');
  const corpo = modelo.getElementsByTagNameNS(W_NS, 'body')[0];
  if (!corpo) throw new Error('Não encontrei o conteúdo do Word.');
  if (!/nome completo/.test(semAcentosDoc(textoDoNo(corpo)))) throw new Error('Este Word não tem os campos da Ficha Individual do Jogador ("Nome Completo", "Posição"…).');
  const filhos = [...corpo.childNodes].filter(n => n.nodeType === 1);
  const sectPr = filhos.find(n => n.localName === 'sectPr') || null;
  const conteudo = filhos.filter(n => n !== sectPr);
  conteudo.forEach(n => corpo.removeChild(n));

  // Relações e tipos (para as fotos).
  const relsPath = 'word/_rels/document.xml.rels';
  let rels = zip.file(relsPath) ? await zip.file(relsPath).async('string') : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  let tipos = await zip.file('[Content_Types].xml').async('string');
  const garantirTipo = (ext, mime) => {
    if (!new RegExp(`Extension="${ext}"`, 'i').test(tipos)) tipos = tipos.replace('<Types ', '<Types ').replace(/<Types([^>]*)>/, `<Types$1><Default Extension="${ext}" ContentType="${mime}"/>`);
  };
  let idDesenho = 5000;

  const LABELS_ABAIXO = {
    'data nascimento': (p) => dataPt(p.birthdate),
    'data de nascimento': (p) => dataPt(p.birthdate),
    'nacionalidade': (p) => p.nationality || '',
    'posicao': (p) => [p.position, p.secondaryPosition].filter(Boolean).join('/'),
    'clube anterior': (p) => p.previousClub || '',
    'peso': (p) => (p.weight ? `${p.weight} kg` : ''),
    'altura': (p) => (p.height ? `${p.height} cm` : ''),
    'lateralidade': (p) => p.laterality || '',
    // Sem espaços: "+351 939 433 012" sai "+351939433012" e cabe na célula.
    'contacto': (p) => String(p.contact || '').replace(/\s+/g, ''),
  };
  const FASE_DO_TITULO = (t) => (/avaliacao inicial/.test(t) ? 'inicial' : /avaliacao intermedia/.test(t) ? 'intermedia' : /avaliacao final/.test(t) ? 'final' : null);

  for (let k = 0; k < players.length; k++) {
    const p = players[k];
    const av = avaliacaoBaseDoJogador(p, epoca);
    const copia = conteudo.map(n => n.cloneNode(true));
    const foto = p.photo ? await fotoParaWord(p.photo) : null;
    let fase = null;
    copia.forEach(no => {
      const tabelas = no.localName === 'tbl' ? [no] : [...no.getElementsByTagNameNS(W_NS, 'tbl')];
      tabelas.forEach(tbl => {
        const g = grelhaDaTabela(tbl);
        g.forEach((linha, ri) => {
          linha.forEach((c, ci) => {
            const t = semAcentosDoc(textoDoNo(c.tc));
            const f = FASE_DO_TITULO(t);
            if (f) { fase = f; return; }
            const ao_lado = linha[ci + 1] ? linha[ci + 1].tc : null;
            const abaixo = (g[ri + 1] || []).find(x => x.col === c.col);
            if (t === 'nome completo') { if (ao_lado) escreverNaCelula(modelo, ao_lado, p.name || ''); return; }
            if (LABELS_ABAIXO[t]) { if (abaixo) escreverNaCelula(modelo, abaixo.tc, LABELS_ABAIXO[t](p)); return; }
            if (/^observacoes:?$/.test(t) && fase) { if ((av[fase] || {}).obs) escreverObservacoes(modelo, c.tc, av[fase].obs); return; }
            if (t === 'nivel atual' && fase && ao_lado) { escreverNaCelula(modelo, ao_lado, (av[fase] || {}).nivel ? String(av[fase].nivel) : ''); return; }
            if (t === 'potencial' && fase && ao_lado) { escreverNaCelula(modelo, ao_lado, (av[fase] || {}).potencial ? String(av[fase].potencial) : ''); return; }
            if (t === 'foto') {
              if (!foto) { escreverNaCelula(modelo, c.tc, ''); return; }
              // Tamanho: a largura da caixa (menos margens) e a altura das
              // linhas que ela ocupa; a foto é recortada ao centro para
              // encher esse retângulo, sem esticar.
              const tcW = Number((c.tc.getElementsByTagNameNS(W_NS, 'tcW')[0] || { getAttribute: () => 2000 }).getAttribute('w:w')) || 2000;
              let altTw = 0;
              for (let rj = ri; rj < g.length; rj++) {
                const cel = g[rj].find(x => x.col === c.col);
                if (rj > ri && !(cel && cel.tc.getElementsByTagNameNS(W_NS, 'vMerge')[0])) break;
                const tr = cel ? cel.tc.parentNode : null;
                const trH = tr && tr.getElementsByTagNameNS(W_NS, 'trHeight')[0];
                altTw += trH ? Number(trH.getAttribute('w:val')) || 400 : 400;
              }
              // Retrato (3:4), com a altura das linhas da caixa (as linhas
              // "pelo menos" ficam maiores do que o declarado, por isso usa-se
              // um mínimo de ~3,2 cm) e nunca mais larga do que a caixa.
              const altFoto = Math.max(1800, altTw - 120);
              const largFoto = Math.min(Math.max(600, tcW - 240), Math.round(altFoto * 0.75));
              const caixaW = largFoto * 635;
              const caixaH = Math.round((largFoto / 0.75)) * 635;
              const ratioCaixa = caixaW / caixaH; const ratioFoto = foto.w / foto.h;
              let l = 0, r = 0, tt = 0, b = 0;
              if (ratioFoto > ratioCaixa) { const corte = (1 - ratioCaixa / ratioFoto) / 2; l = r = Math.round(corte * 100000); }
              else { const corte = (1 - ratioFoto / ratioCaixa) / 2; tt = b = Math.round(corte * 100000); }
              const ext = foto.tipo === 'png' ? 'png' : 'jpeg';
              const nomeMedia = `media/mjp_foto_${k + 1}.${ext}`;
              zip.file(`word/${nomeMedia}`, foto.bytes);
              garantirTipo(ext, ext === 'png' ? 'image/png' : 'image/jpeg');
              const rId = `rIdMjpFoto${k + 1}`;
              rels = rels.replace('</Relationships>', `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${nomeMedia}"/></Relationships>`);
              idDesenho += 1;
              const desenhoXml = `<w:r xmlns:w="${W_NS}"><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${caixaW}" cy="${caixaH}"/><wp:docPr id="${idDesenho}" name="Foto ${idDesenho}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${idDesenho}" name="foto"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rId}"/><a:srcRect l="${l}" t="${tt}" r="${r}" b="${b}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${caixaW}" cy="${caixaH}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
              const run = parser.parseFromString(desenhoXml, 'application/xml').documentElement;
              const par = c.tc.getElementsByTagNameNS(W_NS, 'p')[0];
              if (par) {
                [...par.childNodes].forEach(n => { if (n.localName === 'r') par.removeChild(n); });
                // Centrada na caixa.
                let pPr = [...par.childNodes].find(n => n.localName === 'pPr');
                if (!pPr) { pPr = modelo.createElementNS(W_NS, 'w:pPr'); par.insertBefore(pPr, par.firstChild); }
                [...pPr.childNodes].forEach(n => { if (n.localName === 'jc') pPr.removeChild(n); });
                const jc = modelo.createElementNS(W_NS, 'w:jc'); jc.setAttribute('w:val', 'center');
                const depoisDe = [...pPr.childNodes].find(n => n.localName === 'rPr');
                pPr.insertBefore(jc, depoisDe || null);
                par.appendChild(modelo.importNode(run, true));
              }
            }
          });
        });
      });
    });
    /* PÁGINAS E ALINHAMENTO NO WORD.

       1. A tabela de cima do modelo (Nome Completo, foto…) é uma tabela
          "flutuante", posicionada a uma distância fixa do topo. O Word
          alinha uma tabela flutuante pela borda e as tabelas normais pelo
          texto, por isso ela aparecia uns milímetros à direita das de
          baixo. Passa a ser uma tabela normal, e um parágrafo de altura
          exata no início guarda a mesma distância ao topo.
       2. A quebra entre fichas ia num parágrafo próprio. Com a página já
          cheia, o Word punha esse parágrafo na página seguinte e só depois
          quebrava: uma página em branco entre cada jogador. Agora a quebra
          é "começar numa página nova" no parágrafo de abertura da ficha.
       3. O parágrafo vazio do fim de cada ficha fica com 1 pt de altura,
          para nunca transbordar sozinho para uma página nova. */
    const paragrafoExato = (alturaTw, quebra) => {
      const pp = modelo.createElementNS(W_NS, 'w:p');
      const ppr = modelo.createElementNS(W_NS, 'w:pPr');
      if (quebra) ppr.appendChild(modelo.createElementNS(W_NS, 'w:pageBreakBefore'));
      const sp = modelo.createElementNS(W_NS, 'w:spacing');
      sp.setAttribute('w:before', '0'); sp.setAttribute('w:after', '0');
      sp.setAttribute('w:line', String(Math.max(20, Math.round(alturaTw)))); sp.setAttribute('w:lineRule', 'exact');
      ppr.appendChild(sp);
      const rpr = modelo.createElementNS(W_NS, 'w:rPr');
      const sz = modelo.createElementNS(W_NS, 'w:sz'); sz.setAttribute('w:val', '2'); rpr.appendChild(sz);
      ppr.appendChild(rpr);
      pp.appendChild(ppr);
      return pp;
    };
    let distanciaTopo = 0;
    const primeiro = copia[0];
    if (primeiro && primeiro.localName === 'tbl') {
      const tblPr = [...primeiro.childNodes].find(n => n.localName === 'tblPr');
      const tp = tblPr && [...tblPr.childNodes].find(n => n.localName === 'tblpPr');
      if (tp) {
        let y = Number(tp.getAttribute('w:tblpY')) || 0;
        if (tp.getAttribute('w:vertAnchor') === 'page') {
          const pgMar = sectPr && sectPr.getElementsByTagNameNS(W_NS, 'pgMar')[0];
          y -= Number(pgMar && pgMar.getAttribute('w:top')) || 0;
        }
        tblPr.removeChild(tp);
        /* Com a tabela flutuante, os parágrafos vazios que vinham a seguir
           a ela ficavam no espaço de cima, ao lado da distância ao topo, e
           não gastavam altura. Agora vêm depois da tabela: ficam com 1 pt
           e descontam-se da distância, para a ficha ocupar exatamente a
           mesma altura de antes (senão a última linha passava de página). */
        let vazios = 0;
        for (let i = 1; i < copia.length; i++) {
          const n = copia[i];
          if (n.localName !== 'p' || textoDoNo(n).trim() || n.getElementsByTagNameNS(W_NS, 'drawing').length) break;
          const pp = paragrafoExato(20, false);
          [...n.childNodes].forEach(c => n.removeChild(c));
          [...pp.childNodes].forEach(c => n.appendChild(c));
          vazios++;
        }
        distanciaTopo = Math.max(20, y - 20 * vazios);
      }
    }
    const ultimo = copia[copia.length - 1];
    if (ultimo && ultimo.localName === 'p' && !textoDoNo(ultimo).trim() && !ultimo.getElementsByTagNameNS(W_NS, 'drawing').length) {
      const pp = paragrafoExato(20, false);
      [...ultimo.childNodes].forEach(n => ultimo.removeChild(n));
      [...pp.childNodes].forEach(n => ultimo.appendChild(n));
    }
    if (k > 0 || distanciaTopo > 0) {
      if (primeiro && primeiro.localName === 'p' && !distanciaTopo) {
        let ppr = [...primeiro.childNodes].find(n => n.localName === 'pPr');
        if (!ppr) { ppr = modelo.createElementNS(W_NS, 'w:pPr'); primeiro.insertBefore(ppr, primeiro.firstChild); }
        // Ordem do Word: pStyle, keepNext, keepLines e só depois pageBreakBefore.
        const depois = [...ppr.childNodes].find(n => n.nodeType === 1 && !['pStyle', 'keepNext', 'keepLines'].includes(n.localName));
        ppr.insertBefore(modelo.createElementNS(W_NS, 'w:pageBreakBefore'), depois || null);
      } else {
        corpo.insertBefore(paragrafoExato(distanciaTopo || 20, k > 0), sectPr);
      }
    }
    /* 4. Todas as tabelas encostadas à margem, em qualquer programa.
          Word, WPS e LibreOffice não concordam onde pôr a borda esquerda
          de uma tabela: uns encostam a borda à margem, outros encostam o
          TEXTO e empurram a borda para fora tanto quanto a margem
          interior da primeira célula. Com essa margem a zero, as duas
          regras dão o mesmo sítio; o texto das células da primeira coluna
          recebe o mesmo recuo como avanço de parágrafo, por isso continua
          à mesma distância da borda. */
    const ORDEM_DEPOIS_IND = ['contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc', 'textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange'];
    const filhoW = (no, nome) => [...no.childNodes].find(n => n.nodeType === 1 && n.localName === nome) || null;
    /* 5. Recuos diferentes entre tabelas da mesma largura (um modelo
          convertido de .doc trazia a de cima com recuo 100 e as de baixo
          com 0): as tabelas com a largura da mais larga (±5%) ficam
          todas com o recuo dessa. */
    {
      const tabelas = copia.filter(n => n.localName === 'tbl');
      const largura = (t) => { const pr = filhoW(t, 'tblPr'); const w = pr && filhoW(pr, 'tblW'); return Number(w && w.getAttribute('w:w')) || 0; };
      const recuo = (t) => { const pr = filhoW(t, 'tblPr'); return (pr && filhoW(pr, 'tblInd')) || null; };
      const maior = tabelas.reduce((a, t) => (largura(t) > largura(a) ? t : a), tabelas[0]);
      if (maior && largura(maior) > 0) {
        const ref = recuo(maior);
        const valor = ref ? ref.getAttribute('w:w') || '0' : '0';
        tabelas.forEach(t => {
          if (t === maior || Math.abs(largura(t) - largura(maior)) > largura(maior) * 0.05) return;
          const pr = filhoW(t, 'tblPr');
          if (!pr) return;
          let ind = recuo(t);
          if (!ind) {
            ind = modelo.createElementNS(W_NS, 'w:tblInd');
            const antes = [...pr.childNodes].find(n => n.nodeType === 1 && ['tblBorders', 'shd', 'tblLayout', 'tblCellMar', 'tblLook', 'tblCaption', 'tblDescription', 'tblPrChange'].includes(n.localName));
            pr.insertBefore(ind, antes || null);
          }
          ind.setAttribute('w:w', valor); ind.setAttribute('w:type', 'dxa');
        });
      }
    }
    copia.filter(n => n.localName === 'tbl').forEach(tbl => {
      const tblPr = filhoW(tbl, 'tblPr');
      const margemTabela = (() => {
        const m = tblPr && filhoW(tblPr, 'tblCellMar');
        const l = m && (filhoW(m, 'left') || filhoW(m, 'start'));
        return l ? Number(l.getAttribute('w:w')) || 0 : 108;
      })();
      [...tbl.childNodes].filter(n => n.localName === 'tr').forEach(tr => {
        const tc = filhoW(tr, 'tc');
        if (!tc) return;
        let tcPr = filhoW(tc, 'tcPr');
        if (!tcPr) { tcPr = modelo.createElementNS(W_NS, 'w:tcPr'); tc.insertBefore(tcPr, tc.firstChild); }
        let tcMar = filhoW(tcPr, 'tcMar');
        const ex = filhoW(tr, 'tblPrEx');
        const mEx = ex && filhoW(ex, 'tblCellMar');
        const lEx = mEx && (filhoW(mEx, 'left') || filhoW(mEx, 'start'));
        let margem = lEx ? Number(lEx.getAttribute('w:w')) || 0 : margemTabela;
        let esq = tcMar && (filhoW(tcMar, 'left') || filhoW(tcMar, 'start'));
        if (esq) margem = Number(esq.getAttribute('w:w')) || 0;
        if (!margem) return;
        if (!tcMar) {
          tcMar = modelo.createElementNS(W_NS, 'w:tcMar');
          // Ordem do Word dentro de tcPr: tcMar vem antes de textDirection, tcFitText, vAlign, hideMark.
          const antes = [...tcPr.childNodes].find(n => n.nodeType === 1 && ['textDirection', 'tcFitText', 'vAlign', 'hideMark', 'headers', 'cellIns', 'cellDel', 'cellMerge', 'tcPrChange'].includes(n.localName));
          tcPr.insertBefore(tcMar, antes || null);
        }
        if (!esq) {
          esq = modelo.createElementNS(W_NS, 'w:left');
          const antes = [...tcMar.childNodes].find(n => n.nodeType === 1 && ['bottom', 'end', 'right'].includes(n.localName));
          tcMar.insertBefore(esq, antes || null);
        }
        esq.setAttribute('w:w', '0'); esq.setAttribute('w:type', 'dxa');
        [...tc.getElementsByTagNameNS(W_NS, 'p')].forEach(par => {
          let ppr = filhoW(par, 'pPr');
          if (!ppr) { ppr = modelo.createElementNS(W_NS, 'w:pPr'); par.insertBefore(ppr, par.firstChild); }
          const jc = filhoW(ppr, 'jc');
          const alinh = jc ? jc.getAttribute('w:val') : '';
          if (alinh === 'center' || alinh === 'right' || alinh === 'end') return; // centrado: 0,1 mm de diferença, não se nota
          let ind = filhoW(ppr, 'ind');
          if (!ind) {
            ind = modelo.createElementNS(W_NS, 'w:ind');
            const antes = [...ppr.childNodes].find(n => n.nodeType === 1 && ORDEM_DEPOIS_IND.includes(n.localName));
            ppr.insertBefore(ind, antes || null);
          }
          const atr = ind.hasAttribute('w:start') ? 'w:start' : 'w:left';
          ind.setAttribute(atr, String((Number(ind.getAttribute(atr)) || 0) + margem));
        });
      });
    });
    copia.forEach(n => corpo.insertBefore(n, sectPr));
  }
  zip.file('word/document.xml', new XMLSerializer().serializeToString(modelo));
  zip.file(relsPath, rels);
  zip.file('[Content_Types].xml', tipos);
  await carimbarMarcaWord(zip);
  await pintarCorEquipaWord(zip);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

/* QUE MODELO WORD É ESTE? Pelos textos de dentro, não pelo nome do
   ficheiro: a Ficha Individual tem "Nome Completo"; a Organização do
   Plantel tem uma tabela com "Nome" e "Ano Nasc." (e o campo). */
export function tipoDoModeloWord(xml) {
  const t = semAcentosDoc(String(xml || '').replace(/<[^>]+>/g, ' '));
  if (/relatorio de ocorrencia/.test(t)) return 'ocorrencia';
  if (/ano nasc/.test(t) && /\bnome\b/.test(t)) return 'organizacao';
  if (/nome completo/.test(t)) return 'fichas';
  return null;
}

export async function tipoDoDocumentoWord(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const f = zip.file('word/document.xml');
  return f ? tipoDoModeloWord(await f.async('string')) : null;
}

// As duas formações mais usadas nos jogos ("4-3-3" → "1-4-3-3").
export function estruturasMaisUsadas(matches) {
  const conta = new Map();
  (matches || []).forEach(m => { if (m && m.formacao) conta.set(m.formacao, (conta.get(m.formacao) || 0) + 1); });
  const ordem = [...conta.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => (/^1-/.test(f) ? f : `1-${f}`));
  return { principal: ordem[0] || '', secundaria: ordem[1] || '' };
}

/* ORGANIZAÇÃO DO PLANTEL (Word com a tabela e o campo).

   · Tabela: uma linha por jogador ativo, pela ordem das posições. As
     colunas encontram-se pelo texto do cabeçalho (Nome, Ano Nasc.,
     Posição, Lat., Clube anterior, Entrada-Saída, Av. Ini/Int/Final), por
     isso a ordem e a largura podem mudar no modelo. Com mais jogadores do
     que linhas, acrescentam-se linhas e baixa-se a altura de todas para a
     tabela ocupar a mesma altura (a folha continua a ser uma só).
   · Est. Principal / Est. Secundária: a estrutura tática escrita no
     formulário (vem preenchida com as formações mais usadas nos jogos).
   · Campo: desenhado com a estrutura principal, cada jogador uma só vez
     (ver o passo 2, mais abaixo). */
export async function gerarOrganizacaoPlantel(arrayBuffer, players, epoca, estruturas) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  // Logótipo e nome do clube no lugar das imagens de exemplo (antes de
  // se meter o resto: fotos dos jogadores, escudos do campo…).
  await aplicarClubeNosModelosWord(zip);
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('Este ficheiro não é um Word (.docx) válido.');
  const modelo = new DOMParser().parseFromString(await docFile.async('string'), 'application/xml');
  const corpo = modelo.getElementsByTagNameNS(W_NS, 'body')[0];
  if (!corpo) throw new Error('Não encontrei o conteúdo do Word.');
  const MC_NS = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
  const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const WP_NS = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
  const WPS_NS = 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape';
  const filho = (no, nome) => [...no.childNodes].find(n => n.nodeType === 1 && n.localName === nome) || null;
  const dentroDeFallback = (no) => { for (let p = no.parentNode; p; p = p.parentNode) if (p.localName === 'Fallback' && p.namespaceURI === MC_NS) return true; return false; };
  const dataCurta = (d) => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : ''; };
  const nomeTabela = (n) => { const s = String(n || '').trim(); if (s.length <= 24) return s; const pt = s.split(/\s+/); return pt.length > 1 ? `${pt[0]} ${pt[pt.length - 1]}` : s; };

  const hoje = todayStr();
  const ativos = sortByPosition((players || []).filter(p => p && !(p.exitDate && p.exitDate <= hoje)));

  // 1. Tabela.
  const tabelas = [...corpo.getElementsByTagNameNS(W_NS, 'tbl')];
  let feitaTabela = false;
  for (const tbl of tabelas) {
    if (feitaTabela) break;
    const g = grelhaDaTabela(tbl);
    const iCab = g.findIndex(l => l.some(c => semAcentosDoc(textoDoNo(c.tc)) === 'nome') && l.some(c => /^ano nasc/.test(semAcentosDoc(textoDoNo(c.tc)))));
    if (iCab < 0) continue;
    feitaTabela = true;
    const cab = {};
    g[iCab].forEach(c => {
      const t = semAcentosDoc(textoDoNo(c.tc));
      if (t === 'nome') cab.nome = c.col;
      else if (/^ano nasc/.test(t)) cab.ano = c.col;
      else if (/^posic/.test(t)) cab.pos = c.col;
      else if (/^lat/.test(t)) cab.lat = c.col;
      else if (/^clube/.test(t)) cab.clube = c.col;
      else if (/^entrada/.test(t)) cab.datas = c.col;
      else if (/^av\.? ?ini/.test(t)) cab.inicial = c.col;
      else if (/^av\.? ?int/.test(t)) cab.intermedia = c.col;
      else if (/^av\.? ?fin/.test(t)) cab.final = c.col;
      else if (/^est\.? ?principal/.test(t)) cab.estP = c;
      else if (/^est\.? ?secund/.test(t)) cab.estS = c;
    });
    // Estrutura principal / secundária: na célula logo a seguir ao rótulo.
    [['estP', estruturas && estruturas.principal], ['estS', estruturas && estruturas.secundaria]].forEach(([k, v]) => {
      const c = cab[k];
      if (!c) return;
      const lado = g[iCab].find(x => x.col === c.col + c.span);
      if (lado) escreverNaCelula(modelo, lado.tc, v || '');
    });
    const linhasTr = [...tbl.childNodes].filter(n => n.localName === 'tr');
    let dados = linhasTr.slice(iCab + 1);
    if (!dados.length) break;
    // Mais jogadores do que linhas: clona a última e reparte a altura.
    if (ativos.length > dados.length) {
      const alturaDe = (tr) => { const pr = filho(tr, 'trPr'); const h = pr && filho(pr, 'trHeight'); return Number(h && h.getAttribute('w:val')) || 0; };
      /* A altura a repartir é a maior entre a soma das linhas e a da imagem
         do campo (que está numa célula ao lado e ocupa as linhas todas):
         assim a tabela nunca fica mais curta do que o campo. */
      const doCampo = Math.max(0, ...[...tbl.getElementsByTagNameNS(WP_NS, 'inline')].map(inl => {
        const ex = [...inl.childNodes].find(n => n.localName === 'extent');
        if (!ex) return 0;
        const xf = inl.getElementsByTagNameNS(A_NS, 'xfrm')[0];
        const rot = Number(xf && xf.getAttribute('rot')) || 0;
        const deitado = Math.round(rot / 5400000) % 2 === 1;
        return Math.round(Number(ex.getAttribute(deitado ? 'cx' : 'cy')) / 635);
      }));
      const total = Math.max(dados.reduce((s0, tr) => s0 + alturaDe(tr), 0), doCampo);
      const ultima = dados[dados.length - 1];
      while (dados.length < ativos.length) {
        const nova = ultima.cloneNode(true);
        tbl.insertBefore(nova, dados[dados.length - 1].nextSibling);
        dados.push(nova);
      }
      if (total > 0) {
        const cada = Math.max(180, Math.floor(total / dados.length));
        dados.forEach(tr => {
          let pr = filho(tr, 'trPr');
          if (!pr) { pr = modelo.createElementNS(W_NS, 'w:trPr'); tr.insertBefore(pr, filho(tr, 'tblPrEx') ? filho(tr, 'tblPrEx').nextSibling : tr.firstChild); }
          let h = filho(pr, 'trHeight');
          if (!h) { h = modelo.createElementNS(W_NS, 'w:trHeight'); pr.appendChild(h); }
          h.setAttribute('w:val', String(cada)); h.setAttribute('w:hRule', 'exact');
        });
      }
    }
    const gDados = grelhaDaTabela(tbl).slice(iCab + 1);
    gDados.forEach((linha, i) => {
      const p = ativos[i];
      const celula = (col) => (col == null ? null : (linha.find(c => c.col === col) || null));
      const pos0 = linha.find(c => c.col === 0);
      if (pos0 && i >= 25) escreverNaCelula(modelo, pos0.tc, String(i + 1));
      // Dados sempre sem negrito e centrados (o Nome à esquerda), mesmo
      // que uma linha do modelo tenha ficado com outro formato.
      const escrever = (col, v) => {
        const c = celula(col);
        if (!c) return;
        escreverNaCelula(modelo, c.tc, v);
        const par = c.tc.getElementsByTagNameNS(W_NS, 'p')[0];
        if (!par) return;
        [...par.getElementsByTagNameNS(W_NS, 'b'), ...par.getElementsByTagNameNS(W_NS, 'bCs')].forEach(n => n.parentNode.removeChild(n));
        let ppr = filho(par, 'pPr');
        if (!ppr) { ppr = modelo.createElementNS(W_NS, 'w:pPr'); par.insertBefore(ppr, par.firstChild); }
        let jc = filho(ppr, 'jc');
        if (!jc) {
          jc = modelo.createElementNS(W_NS, 'w:jc');
          const antes = [...ppr.childNodes].find(n => n.nodeType === 1 && ['textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange'].includes(n.localName));
          ppr.insertBefore(jc, antes || null);
        }
        jc.setAttribute('w:val', col === cab.nome ? 'left' : 'center');
      };
      if (!p) return;
      const av = avaliacaoBaseDoJogador(p, epoca);
      const lat = String(p.laterality || '').trim();
      escrever(cab.nome, nomeTabela(p.name));
      escrever(cab.ano, (String(p.birthdate || '').match(/^(\d{4})/) || [])[1] || '');
      escrever(cab.pos, [p.position, p.secondaryPosition].filter(Boolean).join('/'));
      escrever(cab.lat, lat ? lat[0].toUpperCase() : '');
      escrever(cab.clube, p.previousClub || '');
      escrever(cab.datas, [dataCurta(p.entryDate), dataCurta(p.exitDate)].filter(Boolean).join(' - '));
      escrever(cab.inicial, (av.inicial || {}).nivel ? String(av.inicial.nivel) : '');
      escrever(cab.intermedia, (av.intermedia || {}).nivel ? String(av.intermedia.nivel) : '');
      escrever(cab.final, (av.final || {}).nivel ? String(av.final.nivel) : '');
    });
  }
  if (!feitaTabela) throw new Error('Este Word não tem a tabela da Organização do Plantel ("Nome", "Ano Nasc."…).');

  /* 2. CAMPO: A ESTRUTURA PRINCIPAL, CADA JOGADOR UMA SÓ VEZ.

     · As caixas seguem a estrutura principal (ex.: 1-4-2-3-1): uma caixa
       por lugar da formação, na posição em que a formação o desenha. As
       caixas do modelo servem de molde (tamanho, letra, cor, escudo) e
       de medida do campo (até onde vão para os lados, para cima e para
       baixo). Se a estrutura escrita não for uma formação que a app
       conheça, ficam as caixas do modelo, cada uma com o seu código.
     · Cada jogador aparece uma vez: na posição principal, se ela existir
       na estrutura; senão na secundária; senão na mais próxima (ex.: um
       MD num 4-2-3-1 vai para MC). Quem não está na principal aparece em
       itálico com a sua posição entre parênteses, ex.: "15 Lisandro (MD)".
     · Dois lugares iguais (dois DC, dois MC) repartem os jogadores. */
  const PROXIMAS = {
    GR: ['GR'],
    DC: ['DC', 'MD', 'DD', 'DE'],
    DD: ['DD', 'AD', 'DC', 'ED', 'MD'],
    DE: ['DE', 'AE', 'DC', 'EE', 'MD'],
    MD: ['MD', 'MC', 'DC', 'MOC'],
    MC: ['MC', 'MD', 'MOC'],
    MOC: ['MOC', 'MC', 'PL', 'ED', 'EE'],
    ED: ['ED', 'AD', 'EE', 'MOC', 'PL', 'DD'],
    EE: ['EE', 'AE', 'ED', 'MOC', 'PL', 'DE'],
    PL: ['PL', 'MOC', 'ED', 'EE'],
  };
  const caixas = [...corpo.getElementsByTagNameNS(W_NS, 'txbxContent')].filter(c => !dentroDeFallback(c));
  const comCodigo = caixas.map(c => ({ c, cod: textoDoNo(c).replace(/[-–\s]/g, '').toUpperCase() })).filter(x => POSITIONS.includes(x.cod));
  const subirAte = (no, local, ns) => { let n = no; while (n && !(n.localName === local && (!ns || n.namespaceURI === ns))) n = n.parentNode; return n; };
  const runDe = (no) => { let n = no; while (n && !(n.localName === 'r' && n.namespaceURI === W_NS && n.parentNode && n.parentNode.localName === 'p')) n = n.parentNode; return n; };
  const pos = (anc, eixo) => {
    const el = [...anc.childNodes].find(n => n.localName === (eixo === 'H' ? 'positionH' : 'positionV'));
    const o = el && [...el.childNodes].find(n => n.localName === 'posOffset');
    return o ? Number(o.textContent) || 0 : 0;
  };
  const extentDe = (anc) => { const e = [...anc.childNodes].find(n => n.localName === 'extent'); return e ? { cx: Number(e.getAttribute('cx')) || 0, cy: Number(e.getAttribute('cy')) || 0 } : { cx: 0, cy: 0 }; };
  const nivelAtual = (p) => { const e = estatutoDaAvaliacao(avaliacaoBaseDoJogador(p, epoca)); return e.nivel || 0; };
  const rotulo = (p) => `${p.number ? `${p.number} ` : ''}${shortPlayerName(p, players)}`;
  const LINHA_EMU = 82000; // uma linha de 6,5 pt, com folga

  // Lugares a preencher: os da estrutura principal, ou as caixas do modelo.
  const chave = String((estruturas && estruturas.principal) || '').trim().replace(/^1-/, '');
  const formacao = FORMACOES[chave] && LAYOUT_FORMACAO[chave] ? chave : null;
  let lugares = comCodigo.map(x => ({ cod: x.cod, caixa: x.c }));
  if (formacao && comCodigo.length) {
    const ancoras = comCodigo.map(x => subirAte(x.c, 'anchor', WP_NS)).filter(Boolean);
    const molde = ancoras[0];
    const runMolde = runDe(molde);
    const paragrafo = runMolde && runMolde.parentNode;
    // Medidas do campo, tiradas das caixas do modelo.
    const centros = ancoras.map(a => pos(a, 'H') + extentDe(a).cx / 2);
    const topos = ancoras.map(a => pos(a, 'V'));
    const larguraMolde = extentDe(molde).cx;
    const alturaMolde = extentDe(molde).cy;
    const xMin = Math.min(...centros); const xMax = Math.max(...centros);
    const yMin = Math.min(...topos); const yMax = Math.max(...topos);
    // Escudos: imagens pequenas no mesmo parágrafo das caixas.
    const runsDoParagrafo = [...paragrafo.childNodes].filter(n => n.localName === 'r');
    const ehEscudo = (r) => {
      const anc = r.getElementsByTagNameNS(WP_NS, 'anchor')[0];
      if (!anc || r.getElementsByTagNameNS(W_NS, 'txbxContent').length) return false;
      const e = extentDe(anc);
      return e.cx > 0 && e.cx < 400000 && e.cy < 500000;
    };
    const escudos = runsDoParagrafo.filter(ehEscudo);
    const moldeEscudo = escudos[0] ? escudos[0].cloneNode(true) : null;
    const moldeCaixa = runMolde.cloneNode(true);
    [...comCodigo.map(x => runDe(x.c)), ...escudos].forEach(r => { if (r && r.parentNode) r.parentNode.removeChild(r); });
    let proximoId = 1 + Math.max(1000, ...[...modelo.getElementsByTagNameNS(WP_NS, 'docPr')].map(d => Number(d.getAttribute('id')) || 0));
    const mexer = (run, H, V, cx, cy, nome) => {
      const anc = run.getElementsByTagNameNS(WP_NS, 'anchor')[0];
      [...run.getElementsByTagNameNS(MC_NS, 'Fallback')].forEach(f => f.parentNode.removeChild(f));
      const ph = [...anc.childNodes].find(n => n.localName === 'positionH');
      const pv = [...anc.childNodes].find(n => n.localName === 'positionV');
      [[ph, H], [pv, V]].forEach(([el, v]) => { const o = el && [...el.childNodes].find(n => n.localName === 'posOffset'); if (o) o.textContent = String(Math.round(v)); });
      const ex = [...anc.childNodes].find(n => n.localName === 'extent');
      if (ex) { ex.setAttribute('cx', String(Math.round(cx))); ex.setAttribute('cy', String(Math.round(cy))); }
      const xf = anc.getElementsByTagNameNS(A_NS, 'xfrm')[0];
      const ext = xf && [...xf.childNodes].find(n => n.localName === 'ext');
      if (ext) { ext.setAttribute('cx', String(Math.round(cx))); ext.setAttribute('cy', String(Math.round(cy))); }
      const id = proximoId++;
      const dp = [...anc.childNodes].find(n => n.localName === 'docPr');
      if (dp) { dp.setAttribute('id', String(id)); dp.setAttribute('name', nome); }
      [...anc.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/picture', 'cNvPr')].forEach(c => { c.setAttribute('id', String(id)); c.setAttribute('name', nome); });
      anc.setAttribute('relativeHeight', String(251700000 + id));
      return run;
    };
    // Onde fica cada lugar: a formação desenha-o deitado (baliza à
    // esquerda, lado direito em baixo); na folha o campo está de pé, com a
    // nossa baliza em baixo e o lado direito à direita.
    const pontos = LAYOUT_FORMACAO[formacao];
    const lugaresF = FORMACOES[formacao].map((cod, i) => ({ cod, fundo: pontos[i][0], lado: pontos[i][1] }));
    const fMin = Math.min(...lugaresF.map(l => l.fundo)); const fMax = Math.max(...lugaresF.map(l => l.fundo));
    const lMin = Math.min(...lugaresF.map(l => l.lado)); const lMax = Math.max(...lugaresF.map(l => l.lado));
    const meioX = (xMin + xMax) / 2;
    const meiaLargura = Math.max(xMax - meioX, larguraMolde);
    const spanLado = Math.max(lMax - 0.5, 0.5 - lMin) || 0.36;
    /* O GR fica sempre onde está a caixa mais baixa do modelo; as outras
       linhas repartem-se entre a segunda linha do modelo (a defesa) e a de
       cima. Uma escala única para todas apertava a defesa contra o GR. */
    const toposModelo = [...new Set(topos.map(t => Math.round(t / 50000)))].map(t => t * 50000).sort((a, b) => b - a);
    // Um pouco acima da defesa do modelo, para a defesa não encostar ao escudo do GR.
    const yDefesa = (toposModelo.length > 2 ? toposModelo[1] : yMin + (yMax - yMin) * 0.8) - 80000;
    const semGR = lugaresF.filter(l => l.cod !== 'GR');
    const gMin = semGR.length ? Math.min(...semGR.map(l => l.fundo)) : fMin;
    lugaresF.forEach(l => {
      l.cx = meioX + ((l.lado - 0.5) / spanLado) * meiaLargura;
      l.top = l.cod === 'GR'
        ? yMax
        : yDefesa - ((l.fundo - gMin) / ((fMax - gMin) || 1)) * (yDefesa - yMin);
    });
    // Caixas na mesma linha não se podem tocar: encolhem até caberem.
    lugaresF.forEach(l => {
      const vizinhos = lugaresF.filter(o => o !== l && Math.abs(o.top - l.top) < alturaMolde);
      const dist = vizinhos.length ? Math.min(...vizinhos.map(o => Math.abs(o.cx - l.cx))) : Infinity;
      l.w = Math.min(larguraMolde, dist - 40000);
    });
    lugares = lugaresF.map(l => {
      if (moldeEscudo) {
        const e = extentDe(moldeEscudo.getElementsByTagNameNS(WP_NS, 'anchor')[0]);
        paragrafo.appendChild(mexer(moldeEscudo.cloneNode(true), l.cx - e.cx / 2, l.top - e.cy - 15000, e.cx, e.cy, `Escudo ${l.cod}`));
      }
      const run = mexer(moldeCaixa.cloneNode(true), l.cx - l.w / 2, l.top, l.w, alturaMolde, `Caixa ${l.cod}`);
      paragrafo.appendChild(run);
      return { cod: l.cod, caixa: run.getElementsByTagNameNS(W_NS, 'txbxContent')[0], cx: l.cx };
    });
  }

  // Cada jogador num só lugar.
  const presentes = new Set(lugares.map(l => l.cod));
  const destino = (p) => {
    if (presentes.has(p.position)) return { cod: p.position, fora: false };
    if (p.secondaryPosition && presentes.has(p.secondaryPosition)) return { cod: p.secondaryPosition, fora: true };
    const alt = (PROXIMAS[p.position] || []).find(c => presentes.has(c));
    return alt ? { cod: alt, fora: true } : null;
  };
  const porCodigo = new Map();
  ativos.forEach(p => {
    const d = destino(p);
    if (!d) return;
    if (!porCodigo.has(d.cod)) porCodigo.set(d.cod, []);
    porCodigo.get(d.cod).push({ p, fora: d.fora });
  });
  const escreverCaixa = (conteudo, linhas) => {
    const ps = [...conteudo.childNodes].filter(n => n.localName === 'p');
    const molde = ps[0];
    const pPr = molde ? filho(molde, 'pPr') : null;
    const rPrBase = (() => {
      const r0 = molde ? [...molde.getElementsByTagNameNS(W_NS, 'r')][0] : null;
      const rp = (r0 && filho(r0, 'rPr')) || (pPr && filho(pPr, 'rPr'));
      if (!rp) return null;
      const c0 = rp.cloneNode(true);
      [...c0.childNodes].forEach(n => { if (['b', 'bCs', 'color'].includes(n.localName)) c0.removeChild(n); });
      return c0;
    })();
    ps.forEach(p => conteudo.removeChild(p));
    (linhas.length ? linhas : [{ t: '–', fora: false }]).forEach(l => {
      const p = modelo.createElementNS(W_NS, 'w:p');
      if (pPr) p.appendChild(pPr.cloneNode(true));
      const r = modelo.createElementNS(W_NS, 'w:r');
      const rp = rPrBase ? rPrBase.cloneNode(true) : modelo.createElementNS(W_NS, 'w:rPr');
      if (l.fora) rp.appendChild(modelo.createElementNS(W_NS, 'w:i'));
      r.appendChild(rp);
      const t = modelo.createElementNS(W_NS, 'w:t');
      t.setAttribute('xml:space', 'preserve'); t.textContent = l.t;
      r.appendChild(t); p.appendChild(r); conteudo.appendChild(p);
    });
  };
  const grupos = new Map();
  lugares.forEach(l => { if (!grupos.has(l.cod)) grupos.set(l.cod, []); grupos.get(l.cod).push(l); });
  grupos.forEach((lista, cod) => {
    // Da esquerda para a direita, para a repartição ser previsível.
    const ordem = lista.every(l => l.cx != null) ? [...lista].sort((a, b) => a.cx - b.cx) : lista;
    const jogadores = [...(porCodigo.get(cod) || [])].sort((a, b) => (a.fora - b.fora) || (nivelAtual(b.p) - nivelAtual(a.p)) || ((Number(a.p.number) || 99) - (Number(b.p.number) || 99)));
    ordem.forEach((lugar, j) => {
      const k = ordem.length;
      const linhas = jogadores.filter((_, i) => i % k === j).map(x => ({ t: x.fora ? `${rotulo(x.p)} (${x.p.position || '?'})` : rotulo(x.p), fora: x.fora }));
      const caixa = lugar.caixa;
      escreverCaixa(caixa, linhas);
      // A mesma caixa na versão de recurso (programas antigos), se houver.
      const alt = subirAte(caixa.parentNode, 'AlternateContent', MC_NS);
      const fb = alt && [...alt.childNodes].find(n => n.localName === 'Fallback');
      const gemea = fb && fb.getElementsByTagNameNS(W_NS, 'txbxContent')[0];
      if (gemea) escreverCaixa(gemea, linhas);
      // Altura da caixa para caberem os nomes (o Word não a recalcula ao abrir).
      const wsp = subirAte(caixa.parentNode, 'wsp', WPS_NS);
      if (wsp) {
        const bodyPr = wsp.getElementsByTagNameNS(WPS_NS, 'bodyPr')[0];
        const ins = bodyPr ? (Number(bodyPr.getAttribute('tIns')) || 45720) + (Number(bodyPr.getAttribute('bIns')) || 45720) : 91440;
        const precisa = ins + Math.max(1, linhas.length) * LINHA_EMU;
        const ext = wsp.getElementsByTagNameNS(A_NS, 'ext')[0];
        if (ext && Number(ext.getAttribute('cy')) < precisa) ext.setAttribute('cy', String(precisa));
        const anc = subirAte(wsp.parentNode, 'anchor', WP_NS);
        const ex = anc && [...anc.childNodes].find(n => n.localName === 'extent');
        if (ex && Number(ex.getAttribute('cy')) < precisa) ex.setAttribute('cy', String(precisa));
      }
    });
  });
  zip.file('word/document.xml', new XMLSerializer().serializeToString(modelo));
  await carimbarMarcaWord(zip);
  await pintarCorEquipaWord(zip);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export function GerarOrganizacaoPlantelForm({ doc, players, matches, epoca, onClose }) {
  const hoje = todayStr();
  const ativos = (players || []).filter(p => p && !(p.exitDate && p.exitDate <= hoje));
  const sugestao = estruturasMaisUsadas(matches);
  const [principal, setPrincipal] = useState(sugestao.principal);
  const [secundaria, setSecundaria] = useState(sugestao.secundaria);
  const [aProcessar, setAProcessar] = useState(false);
  const [erro, setErro] = useState('');
  const chaveEpoca = String(epoca || '').trim() || 'sem-epoca';
  const gerar = async () => {
    setErro(''); setAProcessar(true);
    try {
      const { data: ficheiro, error } = await supabase.storage.from('documentos').download(doc.storagePath);
      if (error) throw error;
      const blob = await gerarOrganizacaoPlantel(await ficheiro.arrayBuffer(), players, chaveEpoca, { principal: principal.trim(), secundaria: secundaria.trim() });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.nome || 'Organização do plantel'} - ${String(epoca || '').replace('/', '-') || 'época'}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      setErro(e.message || 'Não consegui gerar o ficheiro.');
    } finally { setAProcessar(false); }
  };
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.line}` }}>
      <div style={{ fontSize: 12.5, color: T.cream, lineHeight: 1.5 }}>
        {ativos.length} jogador{ativos.length === 1 ? '' : 'es'} do plantel (os que já saíram ficam de fora), na tabela e no campo pelas posições.
      </div>
      <div style={{ fontSize: 12, color: T.mutedDim, marginTop: 4, lineHeight: 1.5 }}>
        Av. Ini, Int e Final: o Nível atual de cada fase do Estatuto na época {epoca || ''}. No campo, com a estrutura principal: cada jogador aparece uma vez; quem não tem lugar na sua posição vai para a secundária ou para a mais próxima, em itálico e com a posição dele entre parênteses.
      </div>
      <div style={{ ...FIELD_GRID, marginTop: 12 }}>
        <Field label="Estrutura principal"><Input value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="Ex.: 1-4-3-3" /></Field>
        <Field label="Estrutura secundária"><Input value={secundaria} onChange={e => setSecundaria(e.target.value)} placeholder="Ex.: 1-4-4-2" /></Field>
      </div>
      {erro && <div style={{ fontSize: 12, color: T.bad, marginTop: 10 }}>{erro}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={gerar} disabled={aProcessar || !ativos.length}>
          {aProcessar ? <Loader2 size={15} className="spin" /> : <Download size={15} />} Gerar e descarregar
        </Btn>
      </div>
    </div>
  );
}

/* Um Word carregado antes de a app saber distinguir os modelos não tem
   `tipoWord`: lê-se o ficheiro uma vez, guarda-se o tipo e abre-se o
   formulário certo. */
export function GerarWordForm({ doc, players, matches, epoca, setDocumentos, onClose, sessions, clinico, convocatorias, escalao }) {
  const [tipo, setTipo] = useState(doc.tipoWord || null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    if (tipo) return undefined;
    let vivo = true;
    (async () => {
      try {
        const { data: ficheiro, error } = await supabase.storage.from('documentos').download(doc.storagePath);
        if (error) throw error;
        const t = (await tipoDoDocumentoWord(await ficheiro.arrayBuffer())) || 'fichas';
        if (!vivo) return;
        setTipo(t);
        if (setDocumentos) setDocumentos(prev => (prev || []).map(d => (d.id === doc.id ? { ...d, tipoWord: t } : d)));
      } catch (e) { if (vivo) setErro(e.message || 'Não consegui ler o modelo.'); }
    })();
    return () => { vivo = false; };
  }, [tipo, doc.id, doc.storagePath, setDocumentos]);
  if (erro) return <div style={{ marginTop: 14, fontSize: 12, color: T.bad }}>{erro}</div>;
  if (!tipo) return <div style={{ marginTop: 14, fontSize: 12, color: T.mutedDim, display: 'flex', alignItems: 'center', gap: 8 }}><Loader2 size={14} className="spin" /> A ler o modelo…</div>;
  if (tipo === 'ocorrencia') {
    return <GerarRelatorioOcorrenciaForm doc={doc} players={players} matches={matches} sessions={sessions} clinico={clinico} convocatorias={convocatorias} escalao={escalao} onClose={onClose} />;
  }
  return tipo === 'organizacao'
    ? <GerarOrganizacaoPlantelForm doc={doc} players={players} matches={matches} epoca={epoca} onClose={onClose} />
    : <GerarFichasIndividuaisForm doc={doc} players={players} epoca={epoca} onClose={onClose} />;
}

/* RELATÓRIO DE OCORRÊNCIA (Word), a partir do Boletim Clínico.

   O modelo encontra-se pelos textos, como os outros:
   · a linha com "horas" tem os espaços "____" para dia, mês, (ano) e hora;
   · a linha com "Atleta:" tem o nome e o número do escalão ("Sub___");
   · a linha "Diretor Desportivo, Sub ___" leva o escalão;
   · cada secção (Contexto, Ocorrência, Exames/ meios diagnóstico,
     Indicações, Previsão de retoma…) é um título seguido de linhas
     "_____". O texto entra na primeira linha e ocupa as que precisar; as
     que sobram ficam por baixo, para acrescentar à mão.
   Os textos vêm propostos a partir da ocorrência e podem ser corrigidos no
   formulário antes de gerar. */
export const SECCOES_OCORRENCIA = [
  { id: 'contexto', rotulo: 'Contexto', re: /^contexto\b/ },
  { id: 'ocorrencia', rotulo: 'Ocorrência', re: /^ocorrencia\b/ },
  { id: 'exames', rotulo: 'Exames / meios de diagnóstico', re: /^exames\b/ },
  { id: 'indicacoes', rotulo: 'Indicações', re: /^indicacoes\b/ },
  { id: 'previsao', rotulo: 'Previsão de retoma e inserção na prática desportiva', re: /^previsao\b/ },
];

export const DIAS_SEMANA_PT = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

export function dataPorExtenso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${Number(m[3])} de ${MESES_PT[Number(m[2]) - 1]} de ${m[1]}` : '';
}

export function textosDaOcorrencia(o0, { matches, sessions, convocatorias }) {
  const o = recalcularOcorrencia(o0 || {});
  const dia = o.inicio || '';
  const jogo = (matches || []).find(m => m && m.date === dia);
  const conv = jogo ? (convocatorias || []).find(c => c && c.data === dia) : null;
  const hora = (conv && conv.horaJogo) || '';
  let contexto = '';
  if (jogo) {
    contexto = `No dia ${dataPorExtenso(dia)}, decorria o jogo ${jogo.atHome ? 'em casa' : 'fora'} contra o ${jogo.opponent || 'adversário'}${hora ? `, pelas ${hora}` : ''}.`;
  } else if ((sessions || []).some(s => s && s.date === dia && s.phase !== 'Descanso')) {
    // Nº do treino na semana (segunda a domingo) até esse dia.
    const d = new Date(`${dia}T12:00:00`);
    const seg = new Date(d); seg.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const iniSemana = seg.toISOString().slice(0, 10);
    const n = new Set((sessions || []).filter(s => s && s.phase !== 'Descanso' && s.date >= iniSemana && s.date <= dia).map(s => s.date)).size;
    contexto = `No dia ${dataPorExtenso(dia)}, decorria o ${n}º treino semanal, ${DIAS_SEMANA_PT[d.getDay()]}.`;
  } else if (dia) {
    contexto = `No dia ${dataPorExtenso(dia)}.`;
  }
  const evolucao = o.evolucao || [];
  const primeira = evolucao.find(e => e && e.data === dia && String(e.texto || '').trim()) || evolucao.find(e => e && String(e.texto || '').trim());
  const frasesNivel = {
    indisponivel: 'Ficou indisponível para treinos e jogos.',
    condicionado: 'Passou a treino condicionado.',
    vigilancia: 'Ficou apto, com vigilância.',
  };
  const ocorrencia = [
    o.tipo ? `O atleta apresentou ${o.tipo.toLowerCase()}${o.zona && o.zona !== 'Outra' ? ` (${o.zona.toLowerCase()})` : ''}.` : '',
    primeira ? String(primeira.texto).trim() : '',
    frasesNivel[o.nivelInicial] || '',
  ].filter(Boolean).join(' ');
  // Exames: as atualizações que falam de consultas ou exames.
  const reExame = /(exame|ecografi|eco\b|raio|rx\b|resson|\brm\b|tac\b|consulta|m[eé]dic|ortoped|fisiatr|diagn)/i;
  // Sem nenhuma referência a exames/consultas nas atualizações, parte-se
  // do princípio de que a avaliação foi feita pelo departamento médico.
  const exames = evolucao
    .filter(e => e && e !== primeira && reExame.test(String(e.texto || '')))
    .map(e => `${dataPtRelatorio(e.data)}: ${String(e.texto).trim()}`)
    .join('\n') || 'Avaliação realizada pelo departamento médico do clube.';
  // Indicações: o nível atribuído à lesão e, por baixo, as restrições.
  const nivelIni = o.nivelInicial ? nivelClinico(o.nivelInicial).label : '';
  const nivelAtual = o.nivel ? nivelClinico(o.nivel).label : '';
  const linhaNivel = nivelIni && nivelAtual && nivelIni !== nivelAtual && !o.fim
    ? `Nível atribuído: ${nivelIni}; atualmente ${nivelAtual.charAt(0).toLowerCase()}${nivelAtual.slice(1)}.`
    : (nivelIni || nivelAtual) ? `Nível atribuído: ${nivelIni || nivelAtual}.` : '';
  const restr = String(o.restricoes || '').trim();
  const indicacoes = [linhaNivel, restr ? `Restrições: ${restr}${/[.!?]$/.test(restr) ? '' : '.'}` : ''].filter(Boolean).join('\n');
  let previsao = '';
  if (o.fim) previsao = `Alta a ${dataPtRelatorio(o.fim)}.`;
  else if (/^\d{4}-\d{2}-\d{2}$/.test(o.previsaoRetorno || '')) {
    // Menos de uma semana conta-se em dias (1 dia não é "cerca de 1 semana").
    const dias = dia ? Math.round((new Date(`${o.previsaoRetorno}T12:00:00`) - new Date(`${dia}T12:00:00`)) / 86400000) : 0;
    const semanas = Math.round(dias / 7);
    const duracao = dias <= 0 ? '' : dias < 7 ? `${dias} ${dias === 1 ? 'dia' : 'dias'}` : `${semanas} ${semanas === 1 ? 'semana' : 'semanas'}`;
    previsao = `Previsão de regresso a ${dataPtRelatorio(o.previsaoRetorno)}${duracao ? ` (cerca de ${duracao})` : ''}.`;
  } else if (o.previsaoRetorno) previsao = String(o.previsaoRetorno);
  return { hora, contexto, ocorrencia, exames, indicacoes, previsao };
}

export async function gerarRelatorioOcorrencia(arrayBuffer, { data, hora, atleta, escalao, textos }) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  // Logótipo e nome do clube no lugar das imagens de exemplo (antes de
  // se meter o resto: fotos dos jogadores, escudos do campo…).
  await aplicarClubeNosModelosWord(zip);
  const xml = await zip.file('word/document.xml').async('string');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const W = W_NS;
  const paragrafos = [...doc.getElementsByTagNameNS(W, 'p')];
  const textoDe = (p) => [...p.getElementsByTagNameNS(W, 't')].map(t => t.textContent).join('');
  const escreverTexto = (p, texto) => {
    const ts = [...p.getElementsByTagNameNS(W, 't')];
    if (!ts.length) return;
    ts[0].textContent = texto;
    ts[0].setAttribute('xml:space', 'preserve');
    ts.slice(1).forEach(t => t.parentNode.removeChild(t));
  };
  // Troca, por ordem, cada "____" da linha pelo valor (vazio: fica a linha).
  const preencherLacunas = (p, valores, comEspaco = false) => {
    const partes = textoDe(p).split(/(_{3,})/);
    let i = 0;
    partes.forEach((pt, k) => {
      if (!/^_{3,}$/.test(pt)) return;
      const v = valores[i++];
      if (!v) return;
      // "Sub___" fica "Sub-19"; um nome seguido de mais texto ("Escalão")
      // guarda um pouco de espaço, que a linha "____" dava.
      if (k > 0 && /sub\s*$/i.test(partes[k - 1]) && /^\d+$/.test(String(v))) {
        partes[k - 1] = partes[k - 1].replace(/\s+$/, '');
        partes[k] = `-${v}`;
      } else {
        partes[k] = String(v) + (comEspaco && k + 1 < partes.length && /^\s*\S/.test(partes[k + 1]) && !/^\s*[,.)]/.test(partes[k + 1]) ? '\u2003\u2003' : '');
      }
    });
    const novo = partes.join('');
    escreverTexto(p, novo.replace(/(\S)(horas)\b/, '$1 $2'));
  };
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(data || ''));
  const dia = m ? String(Number(m[3])) : '';
  const mes = m ? MESES_PT[Number(m[2]) - 1] : '';
  const ano = m ? m[1] : '';
  const numEscalao = (String(escalao || '').match(/\d+/) || [''])[0];

  paragrafos.forEach(p => {
    const t = semAcentos(textoDe(p));
    if (!/_{3,}/.test(textoDe(p))) return;
    const lacunas = (textoDe(p).match(/_{3,}/g) || []).length;
    if (/\bhoras\b/.test(t)) preencherLacunas(p, lacunas >= 4 ? [dia, mes, ano, hora] : [dia, mes, hora]);
    else if (/atleta\s*:/.test(t)) preencherLacunas(p, [atleta, numEscalao], true);
    else if (/diretor desportivo/.test(t) && /\bsub\b/.test(t)) preencherLacunas(p, [numEscalao]);
    // Linha da assinatura "(______)": o documento sai assinado pela app.
    else if (/^\s*\(\s*_{3,}\s*\)\s*$/.test(textoDe(p))) escreverTexto(p, `(${ASSINATURA_APP})`);
  });

  const ehLinha = (p) => /^[\s_]*$/.test(textoDe(p)) && /_{3,}/.test(textoDe(p));
  SECCOES_OCORRENCIA.forEach(sec => {
    const valor = String((textos && textos[sec.id]) || '').trim();
    if (!valor) return;
    const i = paragrafos.findIndex(p => sec.re.test(semAcentos(textoDe(p)).trim()));
    if (i < 0) return;
    const linhas = [];
    for (let k = i + 1; k < paragrafos.length && ehLinha(paragrafos[k]); k++) linhas.push(paragrafos[k]);
    if (!linhas.length) return;
    // Cada parágrafo do texto vai para uma linha do modelo; as linhas que
    // o texto ocupa (cerca de 85 letras cada) saem, as outras ficam.
    const blocos = valor.split('\n').map(s => s.trim()).filter(Boolean);
    const precisa = blocos.reduce((n, b) => n + Math.max(1, Math.ceil(b.length / 85)), 0);
    blocos.forEach((b, k) => {
      const alvo = k < linhas.length ? linhas[k] : null;
      if (alvo) { escreverTexto(alvo, b); return; }
      const novo = linhas[linhas.length - 1].cloneNode(true);
      escreverTexto(novo, b);
      const ref = linhas[linhas.length - 1];
      ref.parentNode.insertBefore(novo, ref.nextSibling);
      linhas.push(novo);
    });
    // Linhas em branco que sobram: tiram-se as que o texto já ocupa.
    const vazias = linhas.slice(blocos.length);
    const aTirar = Math.min(vazias.length, Math.max(0, precisa - blocos.length));
    vazias.slice(0, aTirar).forEach(p => p.parentNode.removeChild(p));
  });

  zip.file('word/document.xml', new XMLSerializer().serializeToString(doc));
  await carimbarMarcaWord(zip);
  await pintarCorEquipaWord(zip);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export function GerarRelatorioOcorrenciaForm({ doc, players, matches, sessions, clinico, convocatorias, escalao, onClose }) {
  const nomeDe = (pid) => ((players || []).find(p => p.id === pid) || {}).name || '';
  const lista = [...(clinico || [])].filter(o => o && o.playerId && o.inicio)
    .sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)));
  const [ocId, setOcId] = useState(lista[0] ? lista[0].id : '');
  const oc = lista.find(o => o.id === ocId) || null;
  const [textos, setTextos] = useState({});
  const [hora, setHora] = useState('');
  const [aProcessar, setAProcessar] = useState(false);
  const [erro, setErro] = useState('');
  useEffect(() => {
    if (!oc) { setTextos({}); setHora(''); return; }
    const t = textosDaOcorrencia(oc, { matches, sessions, convocatorias });
    setTextos(t); setHora(t.hora || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocId]);
  const gerar = async () => {
    if (!oc) return;
    setErro(''); setAProcessar(true);
    try {
      const { data: ficheiro, error } = await supabase.storage.from('documentos').download(doc.storagePath);
      if (error) throw error;
      const atleta = nomeDe(oc.playerId);
      const blob = await gerarRelatorioOcorrencia(await ficheiro.arrayBuffer(), { data: oc.inicio, hora, atleta, escalao, textos });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Relatório de ocorrência - ${atleta || 'atleta'} - ${dataPtRelatorio(oc.inicio).replace(/\//g, '-')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      setErro(e.message || 'Não consegui gerar o ficheiro.');
    } finally { setAProcessar(false); }
  };
  if (!lista.length) {
    return (
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.line}`, fontSize: 12.5, color: T.mutedDim }}>
        Ainda não há ocorrências no Boletim Clínico.
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}><Btn variant="ghost" onClick={onClose}>Fechar</Btn></div>
      </div>
    );
  }
  const area = { width: '100%', minHeight: 58, resize: 'vertical', background: T.bg, color: T.cream, border: `1px solid ${T.line}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, lineHeight: 1.45, fontFamily: 'inherit', boxSizing: 'border-box' };
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.line}` }}>
      <div style={{ ...FIELD_GRID }}>
        <Field label="Ocorrência do Boletim Clínico">
          <Select value={ocId} onChange={e => setOcId(e.target.value)}>
            {lista.map(o => (
              <option key={o.id} value={o.id}>{[nomeDe(o.playerId) || 'Atleta', o.tipo, o.zona, dataPtRelatorio(o.inicio)].filter(Boolean).join(' · ')}</option>
            ))}
          </Select>
        </Field>
        <Field label="Hora">
          <Input type="time" value={hora} onChange={e => setHora(e.target.value)} />
        </Field>
      </div>
      <div style={{ fontSize: 12, color: T.mutedDim, margin: '10px 0 8px', lineHeight: 1.5 }}>
        Os textos vêm da ocorrência e podes corrigi-los aqui antes de gerar. Um campo vazio deixa as linhas do modelo para preencher à mão.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SECCOES_OCORRENCIA.map(s => (
          <label key={s.id} style={{ display: 'block' }}>
            <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{s.rotulo}</div>
            <textarea value={textos[s.id] || ''} onChange={e => setTextos(t => ({ ...t, [s.id]: e.target.value }))} style={area} />
          </label>
        ))}
      </div>
      {erro && <div style={{ fontSize: 12, color: T.bad, marginTop: 10 }}>{erro}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={gerar} disabled={aProcessar || !oc}>
          {aProcessar ? <Loader2 size={15} className="spin" /> : <Download size={15} />} Gerar e descarregar
        </Btn>
      </div>
    </div>
  );
}

export function GerarFichasIndividuaisForm({ doc, players, epoca, onClose }) {
  const hoje = todayStr();
  const ativos = sortByPosition((players || []).filter(p => p && !(p.exitDate && p.exitDate <= hoje)));
  const [aProcessar, setAProcessar] = useState(false);
  const [erro, setErro] = useState('');
  const chaveEpoca = String(epoca || '').trim() || 'sem-epoca';
  const gerar = async () => {
    setErro(''); setAProcessar(true);
    try {
      const { data: ficheiro, error } = await supabase.storage.from('documentos').download(doc.storagePath);
      if (error) throw error;
      const blob = await gerarFichasIndividuais(await ficheiro.arrayBuffer(), ativos, chaveEpoca);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.nome || 'Fichas individuais'} - ${String(epoca || '').replace('/', '-') || 'época'}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      setErro(e.message || 'Não consegui gerar o ficheiro.');
    } finally { setAProcessar(false); }
  };
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.line}` }}>
      <div style={{ fontSize: 12.5, color: T.cream, lineHeight: 1.5 }}>
        Um só Word com uma ficha por página para {ativos.length} jogador{ativos.length === 1 ? '' : 'es'} do plantel (os que já saíram ficam de fora), pela ordem das posições.
      </div>
      <div style={{ fontSize: 12, color: T.mutedDim, marginTop: 4, lineHeight: 1.5 }}>
        Dados da ficha de cada jogador no Plantel e da Avaliação da época {epoca || ''} (Observações, Nível atual e Potencial de cada fase).
      </div>
      {erro && <div style={{ fontSize: 12, color: T.bad, marginTop: 10 }}>{erro}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={gerar} disabled={aProcessar || !ativos.length}>
          {aProcessar ? <Loader2 size={15} className="spin" /> : <Download size={15} />} Gerar e descarregar
        </Btn>
      </div>
    </div>
  );
}

export const DocumentosApp = React.forwardRef(function DocumentosApp({ documentos, setDocumentos, players, sessions, matches, clinico, teamId, semBotaoTopo, epoca, convocatorias, adversarios, scouting, clube, escalao }, ref) {
  const [aGerar, setAGerar] = useState(null); // id do documento com o formulário de geração aberto
  const [aCarregar, setACarregar] = useState(false);
  const [erro, setErro] = useState('');
  const fileInputRef = useRef(null);
  React.useImperativeHandle(ref, () => ({ abrirNovo: () => fileInputRef.current?.click() }));

  /* O FICHEIRO VAI PARA O STORAGE, NÃO PARA A LINHA DA TABELA.

     Um Excel de poucos megabytes já chega para o Postgres recusar a
     gravação ("statement timeout") quando o ficheiro vai espremido em
     base64 dentro da própria linha — o mesmo problema que a app já
     tinha para vídeos grandes. Para vídeo, a solução foi um link do
     Google Drive (só embutir, nunca ler os bytes). Aqui não dá: para
     preencher o Excel, a app tem mesmo de LER o ficheiro por dentro —
     e ler um ficheiro do Drive por código exigiria autorização OAuth
     da Google, uma peça bem maior.

     A correção a sério: o ficheiro vai para o Supabase Storage (feito
     de propósito para ficheiros, sem o limite de tamanho de uma linha
     da base de dados) — e a tabela `documentos` guarda só o CAMINHO
     onde ele está, um texto pequeno. Precisa de um balde ("bucket")
     chamado "documentos" criado no Supabase — ver o SQL fornecido. */
  const carregarFicheiro = async (file) => {
    setErro('');
    setACarregar(true);
    try {
      /* O Supabase Storage recusa acentos e alguns símbolos no caminho
         ("Invalid key"), por isso o nome no Storage vai limpo, como nos
         vídeos. O nome original continua a aparecer na lista. */
      const nomeLimpo = file.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9.\-]/g, '_');
      const caminho = `${teamId}/${uid()}-${nomeLimpo}`;
      /* "FAILED TO FETCH" AO CARREGAR UM FICHEIRO RENOMEADO.

         O browser só lê o ficheiro do disco no momento do envio. Se ele
         foi renomeado ou gravado depois de escolhido, ou ainda está aberto
         no Excel/WPS/Word (no Windows fica bloqueado), ou está numa pasta
         do OneDrive/Drive só "na nuvem", essa leitura falha e o pedido
         morre com um "Failed to fetch" que não diz nada. Por isso lê-se
         o ficheiro TODO para a memória antes de enviar: se falhar, o erro
         diz o que fazer; se ler, envia-se uma cópia em memória, que já não
         depende do disco (e pode repetir-se sem voltar a lê-lo). */
      let bytes;
      try {
        bytes = await file.arrayBuffer();
      } catch (e) {
        throw new Error('o computador não deixou ler o ficheiro. Fecha-o no Excel ou no Word (ou noutro programa onde esteja aberto), confirma que está mesmo guardado no computador e escolhe-o outra vez');
      }
      const tipoMime = file.type
        || (/\.xlsx$/i.test(file.name) ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : /\.docx$/i.test(file.name) ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : /\.pdf$/i.test(file.name) ? 'application/pdf' : 'application/octet-stream');
      const copia = new Blob([bytes], { type: tipoMime });
      let { error } = await supabase.storage.from('documentos').upload(caminho, copia, { upsert: false, contentType: tipoMime });
      // Uma falha de rede pontual: tenta-se mais uma vez, com a mesma cópia.
      if (error && /fetch|network/i.test(String(error.message || error))) {
        ({ error } = await supabase.storage.from('documentos').upload(caminho, copia, { upsert: true, contentType: tipoMime }));
      }
      if (error) throw error;
      // Um Word: vê já que modelo é (Ficha Individual ou Organização do Plantel).
      let tipoWord = null;
      if (/\.docx$/i.test(file.name)) { try { tipoWord = await tipoDoDocumentoWord(bytes); } catch (e) { tipoWord = null; } }
      setDocumentos(prev => [...(prev || []), {
        id: uid(), nome: file.name.replace(/\.[^.]+$/, ''), fileName: file.name,
        storagePath: caminho, tamanho: file.size, criadoEm: new Date().toISOString(),
        ...(tipoWord ? { tipoWord } : {}),
      }]);
    } catch (e) {
      const msg = String((e && e.message) || e || '');
      setErro(/fetch|network/i.test(msg)
        ? 'Não consegui enviar o ficheiro (ligação interrompida). Confirma a internet e que o ficheiro não está aberto no Excel ou no Word, e tenta outra vez.'
        : `Não consegui carregar o ficheiro: ${msg}.${/bucket|not found/i.test(msg) ? ' Confirma que o balde "documentos" existe no Supabase Storage.' : ''}`);
    } finally {
      setACarregar(false);
    }
  };

  const apagar = (doc) => askConfirm({
    title: 'Apagar modelo?',
    label: doc.nome,
    note: 'O modelo em branco é apagado da app. Isto não afeta nenhum ficheiro que já tenhas descarregado.',
    confirmLabel: 'Apagar',
    destructive: true,
    onConfirm: async () => {
      if (doc.storagePath) {
        try { await supabase.storage.from('documentos').remove([doc.storagePath]); } catch (e) { /* apaga o registo à mesma */ }
      }
      setDocumentos(prev => prev.filter(d => d.id !== doc.id));
    },
  });

  return (
    <div>
      {!semBotaoTopo && (
        <SectionHeader
          action={<Btn onClick={() => fileInputRef.current?.click()} disabled={aCarregar}>
            {aCarregar ? <Loader2 size={15} className="spin" /> : <Plus size={15} />} Carregar modelo
          </Btn>} />
      )}
      <input
        ref={fileInputRef} type="file" accept=".xlsx,.xls,.docx,.doc,.pdf" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files[0]; if (f) carregarFicheiro(f); e.target.value = ''; }}
      />

      <div style={{ fontSize: 12.5, color: T.mutedDim, lineHeight: 1.6, marginBottom: 20 }}>
        Carrega aqui o modelo em branco (Excel, Word ou PDF). A app guarda só esse original — nunca guarda
        as cópias preenchidas: cada vez que geras uma, é criada na hora e descarregada logo a seguir.
      </div>
      {erro && <div style={{ fontSize: 12.5, color: T.bad, marginBottom: 16 }}>{erro}</div>}

      {(documentos || []).length === 0 ? (
        <EmptyState text="Ainda sem modelos carregados." action={<Btn onClick={() => fileInputRef.current?.click()}><Plus size={15} /> Carregar modelo</Btn>} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {documentos.map(doc => (
            <div key={doc.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14 }}>
              {/* Duas partes, cada uma com o seu próprio agrupamento: nome
                  do ficheiro (encolhe, com reticências) de um lado, ações
                  (nunca encolhem) do outro. Com `flexWrap`, num ecrã
                  estreito as ações passam para a linha de baixo em vez de
                  se sobreporem ao nome — era isso que estava a acontecer
                  antes, sem nenhum dos dois grupos a ceder espaço ao outro. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 200px', minWidth: 0 }}>
                  <FileSpreadsheet size={20} color={T.mutedDim} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: T.cream, fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nome}</div>
                    <div style={{ fontSize: 11, color: T.mutedDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.fileName}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 'auto' }}>
                  {/* Todos os botões "Gerar…" com a mesma largura (a do texto mais
                      comprido), para ficarem alinhados uns por baixo dos outros. */}
                  {/^\.xlsx?$/i.test(doc.fileName.slice(doc.fileName.lastIndexOf('.'))) && (
                    <Btn variant="ghost" style={BTN_GERAR_DOC} onClick={() => setAGerar(aGerar === doc.id ? null : doc.id)}>
                      <FileSpreadsheet size={14} /> Gerar estatística e assiduidade
                    </Btn>
                  )}
                  {/\.docx$/i.test(doc.fileName) && (
                    <Btn variant="ghost" style={BTN_GERAR_DOC} onClick={() => setAGerar(aGerar === doc.id ? null : doc.id)}>
                      <FileText size={14} /> {doc.tipoWord === 'organizacao' ? 'Gerar organização do plantel' : doc.tipoWord === 'ocorrencia' ? 'Gerar relatório de ocorrência' : 'Gerar fichas dos jogadores'}
                    </Btn>
                  )}
                  {/\.doc$/i.test(doc.fileName) && (
                    <span title="Abre no Word e guarda como .docx, depois carrega esse ficheiro" style={{ fontSize: 11.5, color: T.warn, width: BTN_GERAR_DOC.width, textAlign: 'center' }}>Guarda como .docx para gerar</span>
                  )}
                  <button onClick={() => apagar(doc)} title="Apagar modelo" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 4, flexShrink: 0 }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              {aGerar === doc.id && /\.docx$/i.test(doc.fileName) && (
                <GerarWordForm doc={doc} players={players} matches={matches} epoca={epoca} setDocumentos={setDocumentos} sessions={sessions} clinico={clinico} convocatorias={convocatorias} escalao={escalao} onClose={() => setAGerar(null)} />
              )}
              {aGerar === doc.id && !/\.docx$/i.test(doc.fileName) && (
                <GerarFichaAssiduidadeForm doc={doc} players={players} sessions={sessions} matches={matches} clinico={clinico} convocatorias={convocatorias} adversarios={adversarios} scouting={scouting} clube={clube} escalao={escalao} onClose={() => setAGerar(null)} />
              )}
            </div>
          ))}
        </div>
      )}

      <ModelosBase />
    </div>
  );
});

/* MODELOS BASE. Para um clube que quer usar os seus próprios documentos:
   descarrega o modelo, muda o aspeto à vontade (logótipo, cores, letra,
   tamanhos) e carrega-o em Documentos. A app encontra os campos pelos
   TEXTOS, por isso basta manter os nomes indicados em "Como adaptar".
   Os ficheiros vivem em public/modelos/ do projeto. */
export const MODELOS_BASE = [
  {
    id: 'fichas', nome: 'Ficha individual do jogador', tipo: 'Word', ficheiro: '/modelos/ficha-individual-modelo.docx',
    descricao: 'Uma página por jogador: dados da ficha, foto e as três avaliações da época.',
    regras: [
      ['Nome Completo', 'o nome vai para a célula à direita.'],
      ['Data nascimento, Nacionalidade, Posição, Clube Anterior, Peso, Altura, Lateralidade, Contacto', 'cada valor vai para a célula por baixo do título.'],
      ['FOTO', 'a célula onde entra a fotografia (fica com o tamanho da célula).'],
      ['Avaliação Inicial, Avaliação Intermédia, Avaliação Final', 'em cada uma: "Observações:", e "Nível Atual" e "Potencial" com o número na célula à direita.'],
    ],
  },
  {
    id: 'organizacao', nome: 'Organização do plantel', tipo: 'Word', ficheiro: '/modelos/organizacao-plantel-modelo.docx',
    descricao: 'Uma folha com a tabela do plantel e o campo com a estrutura principal.',
    regras: [
      ['Nome, Ano Nasc., Posição, Lat., Clube anterior, Entrada-Saída, Av. Ini, Av. Int, Av. Final', 'os títulos das colunas da tabela (a ordem pode mudar e podem faltar colunas). As linhas acrescentam-se sozinhas.'],
      ['Est. Principal, Est. Secundária', 'a estrutura tática vai para a célula ao lado de cada um.'],
      ['Caixas de texto no campo com GR, DC, DE, DD, MD, MC, MOC, EE, ED ou PL', 'servem de molde (tamanho, letra, escudo e espaço do campo). A app desenha os lugares da estrutura principal.'],
    ],
  },
  {
    id: 'ocorrencia', nome: 'Relatório de ocorrência', tipo: 'Word', ficheiro: '/modelos/relatorio-ocorrencia-modelo.docx',
    descricao: 'Uma página por ocorrência do Boletim Clínico: contexto, ocorrência, exames, indicações e previsão de retoma.',
    regras: [
      ['Relatório de Ocorrência', 'tem de aparecer no documento: é por este título que a app sabe que modelo é.'],
      ['Linha com "horas"', 'os espaços "____" recebem, por ordem, o dia, o mês, o ano e a hora (com três espaços: dia, mês e hora).'],
      ['Atleta: ____ Escalão: Sub____ e Diretor Desportivo, Sub ____', 'o nome do atleta e o número do escalão.'],
      ['Contexto, Ocorrência, Exames/ meios diagnóstico, Indicações, Previsão de retoma', 'cada título seguido das linhas "_____" onde entra o texto.'],
      ['(_______) por cima do departamento', 'a linha da assinatura: sai "(Gerado pela app Mister JP)".'],
    ],
  },
  {
    id: 'estatistica', nome: 'Estatística e assiduidade da época', tipo: 'Excel', ficheiro: '/modelos/estatistica-assiduidade-modelo.xlsx',
    descricao: 'Assiduidade mês a mês, um relatório por jornada e a estatística total da época, com gráficos.',
    regras: [
      ['Folhas "ESTATÍSTICA TOTAL" e "Ficha Assiduidade"', 'os nomes das folhas. Os atletas entram na coluna "Nome" da estatística e os outros quadros vão buscá-los lá.'],
      ['"Ficha Assiduidade" seguido do mês (Agosto … Julho)', 'o título de cada bloco mensal. A app escreve o ano certo da época; os dias ficam nas colunas a seguir ao nome.'],
      ['Folhas "Relatório 1ª Jornada" … "Relatório 30ª Jornada", "(2ª fase)" de 1 a 10 e "(PE)" de 11 a 15', 'uma folha por jogo oficial. A app usa a competição e o número da jornada para escolher a folha.'],
      ['Posição das células dos relatórios', 'nos relatórios a app escreve por posição (cabeçalho nas linhas 4 a 7, atletas da linha 11 à 40, observações na 44, sistema na 49, adversário na 64). Muda cores e letra, mas não mudes linhas nem colunas de sítio.'],
    ],
  },
];

export function ModelosBase() {
  const [comoDe, setComoDe] = useState(null);
  const [aDescarregar, setADescarregar] = useState(null);
  const [erroDesc, setErroDesc] = useState('');
  const m = MODELOS_BASE.find(x => x.id === comoDe);
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Modelos base da app</div>
      <div style={{ fontSize: 12.5, color: T.mutedDim, lineHeight: 1.6, marginBottom: 12 }}>
        Os modelos descarregam-se já com a imagem do clube: a cor da equipa e o logótipo e o nome do clube
        (os de Gerir equipa) nos cabeçalhos. No Excel, as cores das faltas e dos gráficos não mudam. Muda o que quiseres, guarda no mesmo formato (.docx ou .xlsx)
        e carrega-o aqui em cima. Só tens de manter os nomes dos campos.
      </div>
      {erroDesc && <div style={{ fontSize: 12.5, color: T.bad, marginBottom: 10 }}>{erroDesc}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {MODELOS_BASE.map(x => (
          <div key={x.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {x.tipo === 'Excel'
              ? <FileSpreadsheet size={20} color={T.muted} style={{ flexShrink: 0 }} />
              : <FileText size={20} color={T.muted} style={{ flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 14, color: T.cream }}>{x.nome} <span style={{ fontSize: 11.5, color: T.mutedDim }}>· {x.tipo}</span></div>
              <div style={{ fontSize: 12, color: T.mutedDim, marginTop: 2 }}>{x.descricao}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 'auto' }}>
              <Btn variant="ghost" onClick={() => setComoDe(x.id)}><Info size={14} /> Como adaptar</Btn>
              <Btn variant="ghost" disabled={aDescarregar === x.id} onClick={async () => {
                setErroDesc(''); setADescarregar(x.id);
                try { await descarregarModeloBase(x); } catch (e) { setErroDesc(e.message || 'Não consegui descarregar o modelo.'); } finally { setADescarregar(null); }
              }}>
                {aDescarregar === x.id ? <Loader2 size={14} className="spin" /> : <Download size={14} />} Descarregar modelo
              </Btn>
            </div>
          </div>
        ))}
      </div>
      {m && (
        <Modal title={`Como adaptar · ${m.nome}`} onClose={() => setComoDe(null)} wide>
          <div style={{ fontSize: 13, color: T.cream, lineHeight: 1.6, marginBottom: 12 }}>
            {m.tipo === 'Excel' ? 'Podes mudar à vontade o logótipo, as cores e a letra.' : 'Podes mudar à vontade o logótipo, as cores, a letra, os tamanhos e a posição das caixas.'}
            A app encontra cada campo pelo texto, por isso estes textos têm de ficar escritos tal como estão:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {m.regras.map(([campos, explica]) => (
              <div key={campos} style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: '9px 12px' }}>
                <div style={{ fontSize: 12.5, color: T.warn, fontWeight: 600 }}>{campos}</div>
                <div style={{ fontSize: 12.5, color: T.mutedDim, marginTop: 2 }}>{explica}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12.5, color: T.mutedDim, lineHeight: 1.6, marginTop: 12 }}>
            {m.tipo === 'Excel'
              ? 'No fim, guarda como Excel (.xlsx), não .xls, e carrega-o em Documentos. Ao gerar, os cabeçalhos vermelhos passam para a cor da equipa (as cores das faltas e dos gráficos ficam como estão) e a marca ™ Mister JP é acrescentada no rodapé.'
              : 'No fim, guarda como Word (.docx), não .doc, e carrega-o em Documentos. Ao gerar, os vermelhos do modelo passam para a cor da equipa e a marca ™ Mister JP é acrescentada no rodapé.'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <Btn onClick={() => setComoDe(null)}>Fechar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Ordem "de época" dos meses (Agosto→Julho), tal como os 12 blocos
// vêm empilhados no modelo do SC Salgueiros — ver o comentário grande
// no topo desta secção. Cada entrada é o índice em `MESES_PT`
// (0=Janeiro ... 11=Dezembro).
export const ORDEM_EPOCA = [7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6];

// Ano de calendário de um mês da época, a partir do ano em que a época
// COMEÇA (Agosto). Agosto-Dezembro ficam nesse ano; Janeiro-Julho já
// caem no ano seguinte.
export function anoDoMesNaEpoca(mes, anoInicioEpoca) {
  return mes >= 7 ? anoInicioEpoca : anoInicioEpoca + 1;
}

export function GerarFichaAssiduidadeForm({ doc, players, sessions, matches, clinico, convocatorias, adversarios, scouting, clube, escalao, onClose }) {
  const agora = new Date();
  // Ano em que a época atual começou: se estamos entre Agosto e
  // Dezembro a época começou este ano civil, senão começou no anterior.
  const anoEpocaDefeito = agora.getMonth() >= 7 ? agora.getFullYear() : agora.getFullYear() - 1;
  const [anoInicioEpoca, setAnoInicioEpoca] = useState(anoEpocaDefeito);
  // Pré-seleciona só o mês corrente, mas dá para marcar vários de
  // seguida e descarregar tudo junto num único Excel.
  const [mesesSelecionados, setMesesSelecionados] = useState(() => new Set([agora.getMonth()]));
  const [erro, setErro] = useState('');
  const [aProcessar, setAProcessar] = useState(false);
  // Os relatórios das jornadas vivem no mesmo Excel: preenchem-se todos
  // de uma vez, com os jogos oficiais já realizados.
  const [comRelatorios, setComRelatorios] = useState(true);
  const [resumoRelatorios, setResumoRelatorios] = useState(null);

  const alternarMes = (m) => {
    setMesesSelecionados(prev => {
      const novo = new Set(prev);
      if (novo.has(m)) novo.delete(m); else novo.add(m);
      return novo;
    });
  };

  const mesesOrdenados = [...mesesSelecionados].sort((a, b) => ORDEM_EPOCA.indexOf(a) - ORDEM_EPOCA.indexOf(b));

  const gerar = async () => {
    setErro('');
    if (mesesOrdenados.length === 0 && !comRelatorios) { setErro('Escolhe pelo menos um mês.'); return; }
    setResumoRelatorios(null);
    setAProcessar(true);
    try {
      // O ficheiro vive no Supabase Storage — descarrega-se por dentro
      // do próprio browser, com a mesma sessão já autenticada da app
      // (nada de pedir ao utilizador para se autenticar outra vez).
      const { data: ficheiro, error } = await supabase.storage.from('documentos').download(doc.storagePath);
      if (error) throw error;
      const buffer = await ficheiro.arrayBuffer();

      // A mesma ordem entra nos dois sítios: na coluna dos nomes (para
      // ESTATÍSTICA TOTAL, de onde a Ficha Assiduidade os busca por
      // fórmula) e nas linhas P/F/L/E da própria ficha.
      const ordenados = sortByPosition(players);
      const mesesEAnos = mesesOrdenados.map(mes => ({ mes, ano: anoDoMesNaEpoca(mes, anoInicioEpoca) }));
      const relatorios = comRelatorios ? { convocatorias, adversarios, scouting, clube, escalao } : null;
      const blob = await gerarFichaAssiduidade(buffer, ordenados, sessions, matches, clinico, mesesEAnos, anoInicioEpoca, relatorios);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Um mês só: "Ficha Assiduidade - Agosto 2025.xlsx". Vários:
      // intervalo se forem seguidos na época, senão a lista toda.
      const nomesMeses = mesesEAnos.map(({ mes, ano }) => `${MESES_PT[mes]} ${ano}`);
      const seguidos = mesesOrdenados.length > 1 && mesesOrdenados.every((m, i) => i === 0
        || ORDEM_EPOCA.indexOf(m) === ORDEM_EPOCA.indexOf(mesesOrdenados[i - 1]) + 1);
      const rotulo = nomesMeses.length === 0
        ? `Época ${anoInicioEpoca}-${anoInicioEpoca + 1}`
        : nomesMeses.length === 1
          ? nomesMeses[0]
          : (seguidos ? `${nomesMeses[0]} a ${nomesMeses[nomesMeses.length - 1]}` : nomesMeses.join(', '));
      a.download = `${comRelatorios ? 'Estatística e Assiduidade' : 'Ficha Assiduidade'} - ${rotulo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      // Com relatórios, o formulário fica aberto a mostrar que jogos
      // entraram e quais ficaram de fora (e porquê).
      if (relatorios && relatorios.resumo) setResumoRelatorios(relatorios.resumo);
      else onClose();
    } catch (e) {
      setErro(e.message || 'Não consegui gerar o ficheiro.');
    } finally {
      setAProcessar(false);
    }
  };

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.line}` }}>
      <div style={{ ...FIELD_GRID }}>
        <Field label="Ano de início da época (Agosto)">
          <Input type="number" value={anoInicioEpoca} onChange={e => setAnoInicioEpoca(Number(e.target.value))} />
        </Field>
      </div>

      <div style={{ fontSize: 11, color: T.mutedDim, marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
        Meses a gerar (podes escolher mais do que um — saem todos no mesmo ficheiro)
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {ORDEM_EPOCA.map(m => {
          const ativo = mesesSelecionados.has(m);
          const ano = anoDoMesNaEpoca(m, anoInicioEpoca);
          return (
            <button
              key={m} type="button" onClick={() => alternarMes(m)}
              style={{
                padding: '6px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                background: ativo ? `${T.gold}22` : 'transparent',
                color: ativo ? T.gold : T.mutedDim,
                border: `1px solid ${ativo ? T.gold : T.line}`,
              }}
            >
              {MESES_PT[m]} {ano}
            </button>
          );
        })}
      </div>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, fontSize: 13, color: T.cream, cursor: 'pointer' }}>
        <input type="checkbox" checked={comRelatorios} onChange={e => { setComRelatorios(e.target.checked); setResumoRelatorios(null); }} style={{ marginTop: 2, accentColor: T.gold }} />
        <span>
          Preencher também os relatórios das jornadas
          <span style={{ display: 'block', fontSize: 11.5, color: T.mutedDim, marginTop: 2 }}>
            Todos os jogos oficiais já realizados. As análises por fases do jogo ficam para preencher à mão.
          </span>
        </span>
      </label>

      {resumoRelatorios && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12.5, color: T.cream, lineHeight: 1.5 }}>
          {!resumoRelatorios.temFolhas ? (
            <span style={{ color: T.warn }}>Este modelo não tem folhas "Relatório … Jornada". Saiu só a assiduidade.</span>
          ) : (
            <>
              <div><Check size={13} color={T.good} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                {resumoRelatorios.jogos.length === 0 ? 'Nenhum jogo oficial realizado para preencher.' : `${resumoRelatorios.jogos.length} ${resumoRelatorios.jogos.length === 1 ? 'relatório preenchido' : 'relatórios preenchidos'}.`}
              </div>
              {resumoRelatorios.primeira && <div style={{ color: T.mutedDim }}>1ª fase: {resumoRelatorios.primeira}{resumoRelatorios.segunda ? ` · 2ª fase e PE: ${resumoRelatorios.segunda}` : ''}</div>}
              {resumoRelatorios.ignorados.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ color: T.warn }}>Ficaram de fora:</div>
                  {resumoRelatorios.ignorados.map(({ m, motivo }) => (
                    <div key={m.id} style={{ color: T.mutedDim }}>{[m.competition, m.jornada, `vs ${m.opponent || ''}`].filter(Boolean).join(' · ')}, {motivo}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {erro && <div style={{ fontSize: 12, color: T.bad, marginTop: 10 }}>{erro}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
        <Btn variant="ghost" onClick={onClose}>{resumoRelatorios ? 'Fechar' : 'Cancelar'}</Btn>
        <Btn onClick={gerar} disabled={aProcessar}>
          {aProcessar ? <Loader2 size={15} className="spin" /> : <Download size={15} />} Gerar e descarregar
        </Btn>
      </div>
    </div>
  );
}

