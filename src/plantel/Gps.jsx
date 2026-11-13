// plantel/Gps.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import JSZip from 'jszip';
import { shortFullName, lastNameOf, firstNameOf, POSITIONS } from '../dominio/jogadores';
import { jogoNaoJogado } from '../dominio/estadoJogos';
import { addDays, todayStr, uid, fmtDate } from '../base/utilidades';
import { estadoClinicoEm } from '../dominio/clinico';
import React, { useState, useEffect, useCallback } from 'react';
import { ensureSession, useCollectionSync } from '../base/sincronizacao';
import { supabase } from '../supabaseClient';
import { T, body, mono, display } from '../base/tema';
import { Btn, EmptyState, askConfirm, removeWithUndo, Select, Panel, Field, Input, Modal } from '../base/ui';
import { RefreshCw, Upload, Download, Trash2, Loader2, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { ChipBtn } from '../base/botoes';
import { offerAviso, rpeContexto, wellnessAvg } from './comum';

/* =====================================================================
   MONITORIZAÇÃO › GPS / CARGA — módulo NOVO e ISOLADO.

   Regra deste módulo: não mexe em NADA do que já existe. Lê o plantel,
   o Planeamento, os Jogos, a Monitorização (PSE/Wellness) e o Boletim
   Clínico, mas só ESCREVE na sua própria tabela (`gps`). Todos os nomes
   começam por `gps`/`Gps` para não colidirem com o resto da app.

   Tabela `gps` (uma só, com dois tipos de registo em `data.kind`):
     · 'sessao' — uma sessão importada (treino ou jogo) com um registo
       por jogador: { date, tipo, sessionId, matchId, titulo, ficheiro,
       demo, importadoEm, registos: [{ playerId, origem, colete,
       minutos, dist, vmax, hsr, sprint, acc, dec, fcMed, fcMax, load }] }
     · 'config' — uma por equipa: colunas reconhecidas por ficheiro
       (`mapeamentos`) e colete/nome ↔ jogador (`pares`).

   Se a tabela ainda não existir no Supabase, o separador mostra só um
   aviso — a leitura nem chega a arrancar, por isso não aparece nenhum
   erro de sincronização no resto da app.
   ===================================================================== */

export const GPS_TABELA = 'gps';

// Indicadores (fotos A–G). `soma`: soma-se quando um jogador tem várias
// linhas (períodos); senão fica o máximo (velocidade, FC máx.).
export const GPS_CAMPOS = [
  { k: 'jogador', label: 'Jogador (nome)', obrig: true, aliases: ['player name', 'player', 'name', 'athlete', 'athlete name', 'jogador', 'nome', 'atleta', 'nome do jogador'] },
  { k: 'colete', label: 'Número / colete', aliases: ['number', 'shirt number', 'jersey', 'jersey number', '#', 'no', 'nº', 'n', 'numero', 'número', 'device', 'device id', 'unit', 'pod', 'colete', 'sensor'] },
  { k: 'periodo', label: 'Período / exercício', aliases: ['period', 'period name', 'drill', 'drill name', 'split', 'split name', 'phase', 'periodo', 'período', 'exercicio', 'exercício', 'bloco'] },
  { k: 'data', label: 'Data', aliases: ['date', 'session date', 'data', 'day', 'dia'] },
  { k: 'minutos', label: 'Duração (min)', soma: true, aliases: ['duration', 'total duration', 'minutes', 'mins', 'time', 'tempo', 'duracao', 'duração', 'minutos', 'field time', 'active time', 'session duration'] },
  { k: 'dist', label: 'Distância total (m)', obrig: true, soma: true, aliases: ['total distance', 'distance', 'dist', 'distancia', 'distância', 'distancia total', 'distância total', 'total dist'] },
  { k: 'vmax', label: 'Velocidade máxima', aliases: ['max speed', 'maximum velocity', 'max velocity', 'top speed', 'speed max', 'speed max.', 'vmax', 'velocidade maxima', 'velocidade máxima', 'vel max', 'max vel', 'peak speed'] },
  { k: 'hsr', label: 'Alta velocidade (m)', soma: true, aliases: ['hsr', 'high speed running', 'hsr distance', 'high speed distance', 'hi speed distance', 'alta velocidade', 'distancia alta velocidade', 'distância alta velocidade', 'hid', 'high intensity distance', 'session hsr'] },
  { k: 'sprint', label: 'Sprint (m)', soma: true, aliases: ['sprint distance', 'sprint meters', 'sprint metres', 'sprinting', 'sprint', 'distancia sprint', 'distância sprint', 'session sprint meters'] },
  { k: 'acc', label: 'Acelerações', soma: true, aliases: ['accelerations', 'accels', 'acc', 'acel', 'aceleracoes', 'acelerações', 'number of accelerations', 'acceleration efforts', 'session accels'] },
  { k: 'dec', label: 'Desacelerações', soma: true, aliases: ['decelerations', 'decels', 'dec', 'desacel', 'desaceleracoes', 'desacelerações', 'number of decelerations', 'deceleration efforts', 'session decels'] },
  { k: 'fcMed', label: 'FC média (bpm)', aliases: ['avg heart rate', 'average heart rate', 'hr avg', 'heart rate avg', 'fc media', 'fc média', 'hr average', 'avg hr', 'mean hr'] },
  { k: 'fcMax', label: 'FC máxima (bpm)', aliases: ['max heart rate', 'maximum heart rate', 'hr max', 'fc maxima', 'fc máxima', 'fc max', 'max hr', 'peak hr'] },
  { k: 'load', label: 'PlayerLoad / carga', soma: true, aliases: ['player load', 'playerload', 'total player load', 'dynamic stress load', 'dsl', 'training load', 'load', 'carga', 'trimp'] },
];

export const GPS_CAMPO = Object.fromEntries(GPS_CAMPOS.map(c => [c.k, c]));

export const GPS_METRICAS = ['minutos', 'dist', 'vmax', 'hsr', 'sprint', 'acc', 'dec', 'fcMed', 'fcMax', 'load'];

// Linhas que não são de um jogador (médias e totais da equipa).
export const GPS_LINHA_EQUIPA = /^(average|media|média|total|totais|team|equipa|all players|squad|grupo)\b/i;

// Num ficheiro por períodos, a linha da sessão inteira.
export const GPS_PERIODO_TOTAL = /^(session|sessao|sessão|total|full session|whole session|entire session|all)$/i;

export function gpsNorm(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9#%/.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function gpsNormSemParenteses(s) {
  return gpsNorm(String(s == null ? '' : s).replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' '));
}

export function gpsNomeChave(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/* Número escrito à portuguesa (4,5 · 4.439,2) ou à inglesa (4,439.2). */
export function gpsNumero(v, separador) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v == null ? '' : v).trim().replace(/\s+/g, '').replace(/[^\d.,:-]/g, '');
  if (!s || s === '-' ) return null;
  // Duração em mm:ss ou hh:mm:ss → minutos.
  if (/^\d+:\d{1,2}(:\d{1,2})?$/.test(s)) {
    const p = s.split(':').map(Number);
    return p.length === 3 ? p[0] * 60 + p[1] + p[2] / 60 : p[0] + p[1] / 60;
  }
  const temPonto = s.includes('.');
  const temVirgula = s.includes(',');
  if (temPonto && temVirgula) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (temVirgula) {
    s = (separador === ',' && /^-?\d{1,3}(,\d{3})+$/.test(s)) ? s.replace(/,/g, '') : s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/* CSV → linhas. Descobre o separador (, ; tab) e respeita aspas. */
export function gpsLerCsv(texto) {
  const t = String(texto || '').replace(/^\uFEFF/, '');
  const amostra = t.split(/\r?\n/).slice(0, 10).join('\n');
  const conta = (c) => (amostra.match(new RegExp(c === '\t' ? '\t' : `\\${c}`, 'g')) || []).length;
  const separador = [';', '\t', ','].sort((a, b) => conta(b) - conta(a))[0];
  const linhas = [];
  let linha = [];
  let campo = '';
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false;
      } else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === separador) { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      if (linha.some(x => String(x).trim() !== '')) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some(x => String(x).trim() !== '')) linhas.push(linha);
  return { linhas, separador };
}

/* Excel (.xlsx) → linhas da primeira folha, com o JSZip que a app já usa
   (sem bibliotecas novas). Lê só valores; formatação é ignorada. */
export async function gpsLerXlsx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const ler = async (p) => { const f = zip.file(p); return f ? f.async('string') : null; };
  const dom = (xml) => new DOMParser().parseFromString(xml, 'application/xml');
  let caminho = 'xl/worksheets/sheet1.xml';
  const wb = await ler('xl/workbook.xml');
  const rels = await ler('xl/_rels/workbook.xml.rels');
  if (wb && rels) {
    const folha = dom(wb).getElementsByTagName('sheet')[0];
    const rid = folha && (folha.getAttribute('r:id') || folha.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
    const rel = rid && Array.from(dom(rels).getElementsByTagName('Relationship')).find(r => r.getAttribute('Id') === rid);
    if (rel) {
      const alvo = rel.getAttribute('Target').replace(/^\//, '');
      caminho = alvo.startsWith('xl/') ? alvo : `xl/${alvo}`;
    }
  }
  const partilhadas = [];
  const ss = await ler('xl/sharedStrings.xml');
  if (ss) {
    Array.from(dom(ss).getElementsByTagName('si')).forEach(si => {
      partilhadas.push(Array.from(si.getElementsByTagName('t')).map(t => t.textContent).join(''));
    });
  }
  const xml = await ler(caminho);
  if (!xml) throw new Error('Não encontrámos nenhuma folha no ficheiro Excel.');
  const colIdx = (ref) => {
    const letras = String(ref || '').replace(/\d+/g, '');
    let n = 0;
    for (let i = 0; i < letras.length; i++) n = n * 26 + (letras.charCodeAt(i) - 64);
    return n - 1;
  };
  const linhas = [];
  Array.from(dom(xml).getElementsByTagName('row')).forEach(row => {
    const linha = [];
    Array.from(row.getElementsByTagName('c')).forEach(c => {
      const i = colIdx(c.getAttribute('r'));
      const tipo = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0];
      let valor = '';
      if (tipo === 's') valor = v ? (partilhadas[Number(v.textContent)] || '') : '';
      else if (tipo === 'inlineStr') valor = Array.from(c.getElementsByTagName('t')).map(t => t.textContent).join('');
      else if (v) {
        const n = Number(v.textContent);
        valor = tipo === 'str' || !Number.isFinite(n) ? v.textContent : n;
      }
      if (i >= 0) linha[i] = valor;
    });
    for (let i = 0; i < linha.length; i++) if (linha[i] === undefined) linha[i] = '';
    if (linha.some(x => String(x).trim() !== '')) linhas.push(linha);
  });
  return { linhas, separador: '.' };
}

// Data do ficheiro (texto ou nº de série do Excel) → 'AAAA-MM-DD'.
export function gpsData(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

/* Linha dos títulos: a que, entre as primeiras 15, reconhece mais campos. */
export function gpsAcharCabecalho(linhas) {
  let melhor = 0;
  let pontos = -1;
  linhas.slice(0, 15).forEach((l, i) => {
    const p = (l || []).reduce((a, cel) => {
      const n = gpsNorm(cel);
      const ns = gpsNormSemParenteses(cel);
      return a + (n && GPS_CAMPOS.some(c => c.aliases.some(al => gpsNorm(al) === n || gpsNorm(al) === ns)) ? 1 : 0);
    }, 0);
    if (p > pontos) { pontos = p; melhor = i; }
  });
  return melhor;
}

/* Reconhece as colunas: primeiro nomes iguais, depois "começa por". */
export function gpsMapeamentoAuto(cabecalho) {
  const cols = cabecalho.map((h, i) => ({ i, n: gpsNorm(h), ns: gpsNormSemParenteses(h) }));
  const mapa = {};
  const usadas = new Set();
  const tentar = (teste) => {
    GPS_CAMPOS.forEach(c => {
      if (mapa[c.k] != null) return;
      const aliases = c.aliases.map(gpsNorm).sort((a, b) => b.length - a.length);
      const col = cols.find(x => !usadas.has(x.i) && aliases.some(al => teste(x, al)));
      if (col) { mapa[c.k] = col.i; usadas.add(col.i); }
    });
  };
  tentar((x, al) => x.n === al || x.ns === al);
  tentar((x, al) => al.length > 3 && (x.ns.startsWith(`${al} `) || x.n.startsWith(`${al} `)));
  return mapa;
}

export const gpsAssinatura = (cabecalho) => cabecalho.map(gpsNorm).join('|');

/* Lê o ficheiro com o mapa de colunas → um registo por jogador.
   Converte unidades (km → m, m/s → km/h) e junta períodos. */
export function gpsExtrair(linhas, iCab, mapa, separador) {
  const cab = linhas[iCab] || [];
  const corpo = linhas.slice(iCab + 1);
  const cel = (l, k) => (mapa[k] == null ? '' : l[mapa[k]]);
  const avisos = [];
  const titulo = (k) => String(mapa[k] == null ? '' : cab[mapa[k]] || '');
  const valores = (k) => corpo.map(l => gpsNumero(cel(l, k), separador)).filter(v => v != null && v > 0);
  const mediana = (arr) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

  const fator = {};
  ['dist', 'hsr', 'sprint'].forEach(k => {
    const t = gpsNorm(titulo(k));
    const km = /\bkm\b/.test(t) && !/km\/h/.test(t);
    if (km || (k === 'dist' && mapa.dist != null && mediana(valores('dist')) > 0 && mediana(valores('dist')) < 30)) {
      fator[k] = 1000;
      if (k === 'dist') avisos.push('A distância vinha em quilómetros — convertida para metros.');
    }
  });
  if (mapa.vmax != null) {
    const t = gpsNorm(titulo('vmax'));
    const vs = valores('vmax');
    if (/m\/s/.test(t) || (vs.length && Math.max(...vs) < 13)) {
      fator.vmax = 3.6;
      avisos.push('A velocidade vinha em m/s — convertida para km/h.');
    }
  }
  if (mapa.minutos != null) {
    const vs = valores('minutos');
    if (vs.length && Math.max(...vs) <= 1.5) { fator.minutos = 1440; avisos.push('A duração vinha em fração de dia (Excel) — convertida para minutos.'); }
    else if (/\b(s|sec|seg|secs|seconds|segundos)\b/.test(gpsNorm(titulo('minutos'))) || mediana(vs) > 400) { fator.minutos = 1 / 60; avisos.push('A duração vinha em segundos — convertida para minutos.'); }
  }

  const porJogador = new Map();
  const datas = new Set();
  corpo.forEach(l => {
    const nome = String(cel(l, 'jogador') || '').trim();
    if (!nome || GPS_LINHA_EQUIPA.test(nome)) return;
    const reg = { origem: nome, colete: String(cel(l, 'colete') || '').trim(), periodo: String(cel(l, 'periodo') || '').trim() };
    GPS_METRICAS.forEach(k => {
      const n = gpsNumero(cel(l, k), separador);
      reg[k] = n == null ? null : n * (fator[k] || 1);
    });
    const d = gpsData(cel(l, 'data'));
    if (d) datas.add(d);
    const chave = gpsNomeChave(nome);
    if (!porJogador.has(chave)) porJogador.set(chave, []);
    porJogador.get(chave).push(reg);
  });

  let juntados = 0;
  const registos = [];
  porJogador.forEach(regs => {
    let usar = regs;
    if (regs.length > 1) {
      const totais = regs.filter(r => GPS_PERIODO_TOTAL.test(r.periodo));
      if (totais.length) usar = [totais[0]];
      else juntados++;
    }
    const r = { origem: usar[0].origem, colete: usar.find(x => x.colete)?.colete || '' };
    GPS_METRICAS.forEach(k => {
      const vs = usar.map(x => x[k]).filter(v => v != null);
      if (!vs.length) { r[k] = null; return; }
      r[k] = GPS_CAMPO[k].soma ? vs.reduce((a, b) => a + b, 0) : (k === 'fcMed' ? vs.reduce((a, b) => a + b, 0) / vs.length : Math.max(...vs));
    });
    GPS_METRICAS.forEach(k => { if (r[k] != null) r[k] = Math.round(r[k] * 10) / 10; });
    registos.push(r);
  });
  if (juntados) avisos.push(`${juntados} jogador(es) aparecem em várias linhas (períodos) — os valores foram somados.`);
  return { registos, avisos, datas: [...datas].sort() };
}

/* Colete/nome do ficheiro → jogador do plantel. */
export function gpsSugerirJogador(reg, players, pares) {
  const kn = `n:${gpsNomeChave(reg.origem)}`;
  const kc = reg.colete ? `c:${gpsNomeChave(reg.colete)}` : null;
  const valido = (id) => id && (id === '__ignorar' || players.some(p => p.id === id));
  if (pares && valido(pares[kn])) return pares[kn];
  if (kc && pares && valido(pares[kc])) return pares[kc];
  const alvo = gpsNomeChave(reg.origem);
  const exato = players.find(p => gpsNomeChave(p.name) === alvo);
  if (exato) return exato.id;
  const curto = players.filter(p => gpsNomeChave(shortFullName(p.name)) === alvo);
  if (curto.length === 1) return curto[0].id;
  if (reg.colete && /^\d+$/.test(reg.colete)) {
    const n = players.filter(p => String(p.number ?? '').trim() === reg.colete);
    if (n.length === 1) return n[0].id;
  }
  const partes = alvo.split(' ');
  const apelido = players.filter(p => gpsNomeChave(lastNameOf(p.name)) === partes[partes.length - 1]);
  if (apelido.length === 1) return apelido[0].id;
  const primeiro = players.filter(p => gpsNomeChave(firstNameOf(p.name)) === partes[0]);
  if (partes.length === 1 && primeiro.length === 1) return primeiro[0].id;
  return '';
}

/* Código do dia face aos jogos: MD (dia de jogo), MD-n, MD+n. */
export function gpsCodigoMD(data, matches) {
  const jogos = [...new Set((matches || []).filter(m => m && m.date && !jogoNaoJogado(m)).map(m => m.date))].sort();
  if (!data || !jogos.length) return '';
  if (jogos.includes(data)) return 'MD';
  const dia = (d) => new Date(`${d}T00:00:00`).getTime() / 86400000;
  const seguinte = jogos.find(d => d > data);
  const anterior = [...jogos].reverse().find(d => d < data);
  const aSeg = seguinte ? Math.round(dia(seguinte) - dia(data)) : Infinity;
  const aAnt = anterior ? Math.round(dia(data) - dia(anterior)) : Infinity;
  if (aAnt <= 2 && aAnt < aSeg) return `MD+${aAnt}`;
  if (aSeg <= 7) return `MD-${aSeg}`;
  if (aAnt <= 7) return `MD+${aAnt}`;
  return '';
}

export function gpsDescarregar(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function gpsModeloCsv(players) {
  const cab = ['Jogador', 'Número', 'Duração (min)', 'Distância total (m)', 'Velocidade máxima (km/h)', 'Alta velocidade (m)', 'Sprint (m)', 'Acelerações', 'Desacelerações', 'FC média (bpm)', 'FC máxima (bpm)', 'Carga'];
  const linhas = [cab, ...[...players].sort((a, b) => gpsOrdemPos(a) - gpsOrdemPos(b)).map(p => [p.name || '', p.number ?? '', '', '', '', '', '', '', '', '', '', ''])];
  const csv = linhas.map(l => l.map(v => {
    const s = String(v ?? '');
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(';')).join('\r\n');
  gpsDescarregar('modelo-gps-misterjp.csv', `\uFEFF${csv}`, 'text/csv;charset=utf-8');
}

export const gpsOrdemPos = (p) => { const i = POSITIONS.indexOf(p && p.position); return i === -1 ? POSITIONS.length : i; };

export const gpsFmt = (v, casas = 0) => (v == null || !Number.isFinite(v) ? '—' : Number(v).toLocaleString('pt-PT', { minimumFractionDigits: casas, maximumFractionDigits: casas }));

export const gpsMedia = (arr) => { const v = arr.filter(x => x != null && Number.isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

export const gpsMmin = (r) => (r && r.dist != null && r.minutos > 0 ? r.dist / r.minutos : null);

/* DADOS DE DEMONSTRAÇÃO — fictícios mas coerentes: perfil por posição,
   carga conforme o dia (MD-4 … MD+1), velocidade máxima estável por
   jogador. Ficam marcados `demo` e apagam-se com um clique. */
export const GPS_PERFIL_JOGO = {
  GR: { dist: 5200, hsr: 110, sprint: 12, acc: 18, dec: 20, vmax: 25.5 },
  DC: { dist: 9100, hsr: 430, sprint: 85, acc: 42, dec: 52, vmax: 29.2 },
  DD: { dist: 10100, hsr: 790, sprint: 215, acc: 58, dec: 63, vmax: 31.0 },
  DE: { dist: 10100, hsr: 790, sprint: 215, acc: 58, dec: 63, vmax: 31.0 },
  MD: { dist: 10900, hsr: 640, sprint: 115, acc: 54, dec: 60, vmax: 29.0 },
  MC: { dist: 10900, hsr: 640, sprint: 115, acc: 54, dec: 60, vmax: 29.0 },
  MOC: { dist: 10500, hsr: 700, sprint: 155, acc: 55, dec: 58, vmax: 30.0 },
  EE: { dist: 9800, hsr: 850, sprint: 255, acc: 60, dec: 61, vmax: 31.6 },
  ED: { dist: 9800, hsr: 850, sprint: 255, acc: 60, dec: 61, vmax: 31.6 },
  PL: { dist: 9300, hsr: 690, sprint: 225, acc: 54, dec: 59, vmax: 31.2 },
};

// Velocidade máxima típica de cada dia, em fração do máximo do jogador.
export const GPS_VMAX_DIA = { 'MD+1': 0.62, 'MD+2': 0.72, 'MD-5': 0.78, 'MD-4': 0.78, 'MD-3': 0.86, 'MD-2': 0.80, 'MD-1': 0.86, outro: 0.78 };

export const GPS_FATOR_DIA = {
  'MD+1': { dist: 0.35, hsr: 0.08, sprint: 0.04, acc: 0.30, min: 55 },
  'MD+2': { dist: 0.50, hsr: 0.25, sprint: 0.15, acc: 0.55, min: 70 },
  'MD-5': { dist: 0.60, hsr: 0.35, sprint: 0.25, acc: 0.70, min: 80 },
  'MD-4': { dist: 0.68, hsr: 0.40, sprint: 0.25, acc: 0.95, min: 85 },
  'MD-3': { dist: 0.85, hsr: 0.80, sprint: 0.55, acc: 0.75, min: 90 },
  'MD-2': { dist: 0.55, hsr: 0.35, sprint: 0.25, acc: 0.60, min: 75 },
  'MD-1': { dist: 0.40, hsr: 0.20, sprint: 0.30, acc: 0.45, min: 60 },
  outro: { dist: 0.60, hsr: 0.40, sprint: 0.30, acc: 0.60, min: 80 },
};

export function gpsAleatorio(semente) {
  let h = 2166136261;
  const s = String(semente);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gpsGerarDemo({ players, sessions, matches, clinico }) {
  // Até ONTEM: o treino de hoje pode ainda nem ter acontecido.
  const hoje = addDays(todayStr(), -1);
  const desde = addDays(hoje, -34);
  const plantel = players.filter(p => p && p.id && p.name);
  const dias = new Map(); // data -> { tipo, sessionId, matchId, titulo }
  (matches || []).filter(m => m.date && m.date >= desde && m.date <= hoje && !jogoNaoJogado(m)).forEach(m => {
    dias.set(m.date, { tipo: 'jogo', matchId: m.id, titulo: m.opponent ? `Jogo vs ${m.opponent}` : 'Jogo' });
  });
  (sessions || []).filter(s => s.date && s.date >= desde && s.date <= hoje && s.phase !== 'Descanso').forEach(s => {
    if (dias.has(s.date)) return;
    dias.set(s.date, s.phase === 'Jogo'
      ? { tipo: 'jogo', sessionId: s.id, titulo: s.focus || 'Jogo' }
      : { tipo: 'treino', sessionId: s.id, titulo: s.focus || s.phase || 'Treino' });
  });
  // Pouco calendário? Semana-tipo das últimas 4 semanas (ter–sex treino, sáb jogo).
  let calendarioFicticio = false;
  if (dias.size < 6) {
    calendarioFicticio = true;
    for (let i = 28; i >= 0; i--) {
      const d = addDays(hoje, -i);
      const dw = new Date(`${d}T00:00:00`).getDay();
      if (dias.has(d)) continue;
      if (dw === 6) dias.set(d, { tipo: 'jogo', titulo: 'Jogo (demonstração)' });
      else if (dw >= 2 && dw <= 5) dias.set(d, { tipo: 'treino', titulo: 'Treino (demonstração)' });
    }
  }
  const datasJogo = [...dias.entries()].filter(([, v]) => v.tipo === 'jogo').map(([d]) => d);
  const mdDe = (d) => (calendarioFicticio ? gpsCodigoMD(d, datasJogo.map(x => ({ date: x }))) : gpsCodigoMD(d, matches)) || 'outro';

  const sessoes = [];
  [...dias.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([data, info]) => {
    const md = info.tipo === 'jogo' ? 'MD' : mdDe(data);
    const f = GPS_FATOR_DIA[md] || GPS_FATOR_DIA.outro;
    const jogo = info.matchId ? (matches || []).find(m => m.id === info.matchId) : null;
    const registos = [];
    plantel.forEach(p => {
      const est = clinico ? estadoClinicoEm(p.id, data, clinico) : null;
      if (est && est.id === 'indisponivel') return;
      const rnd = gpsAleatorio(`${p.id}|${data}`);
      const ind = gpsAleatorio(`${p.id}|perfil`);
      const perfil = GPS_PERFIL_JOGO[p.position] || GPS_PERFIL_JOGO.MC;
      const topo = perfil.vmax + (ind() - 0.5) * 3;
      let minutos;
      let escala = 1;
      if (info.tipo === 'jogo') {
        const m = jogo && jogo.report && jogo.report[p.id] ? Number(jogo.report[p.id].minutes) : NaN;
        if (jogo && jogo.report && Object.keys(jogo.report).length) {
          if (!Number.isFinite(m) || m <= 0) return;
          minutos = m;
        } else {
          const r = rnd();
          if (r < 0.25) return;
          minutos = r < 0.75 ? 90 : Math.round(15 + rnd() * 50);
        }
        escala = minutos / 90;
      } else {
        minutos = Math.round(f.min * (0.92 + rnd() * 0.12));
      }
      const cond = est && est.id === 'condicionado' ? 0.6 : 1;
      const v = (base, fx) => base * fx * escala * cond * (0.85 + rnd() * 0.3);
      const fd = info.tipo === 'jogo' ? { dist: 1, hsr: 1, sprint: 1, acc: 1 } : f;
      const dist = v(perfil.dist, fd.dist);
      registos.push({
        playerId: p.id, origem: p.name, colete: String(p.number ?? ''),
        minutos: Math.round(minutos),
        dist: Math.round(dist),
        vmax: Math.round(topo * (info.tipo === 'jogo' ? 0.9 + rnd() * 0.1 : (GPS_VMAX_DIA[md] || 0.8) + rnd() * 0.08) * 10) / 10,
        hsr: Math.round(v(perfil.hsr, fd.hsr)),
        sprint: Math.round(v(perfil.sprint, fd.sprint)),
        acc: Math.round(v(perfil.acc, fd.acc)),
        dec: Math.round(v(perfil.dec, fd.acc)),
        fcMed: Math.round(info.tipo === 'jogo' ? 160 + rnd() * 12 : 132 + f.dist * 30 + rnd() * 10),
        fcMax: Math.round(184 + rnd() * 14),
        load: Math.round(dist / 10 * (0.95 + rnd() * 0.2)),
      });
    });
    if (!registos.length) return;
    sessoes.push({
      id: `gps_demo_${data}_${uid()}`, kind: 'sessao', demo: true, date: data, tipo: info.tipo,
      sessionId: info.sessionId || null, matchId: info.matchId || null,
      titulo: info.titulo, ficheiro: 'Dados de demonstração', importadoEm: new Date().toISOString(), registos,
    });
  });
  return sessoes;
}

/* ---------- Entrada do separador: confirma que a tabela existe ---------- */
// Equipas em que já se confirmou que a tabela do GPS existe (não se volta
// a perguntar ao servidor de cada vez que se abre o separador).
export const gpsTabelaConfirmada = new Set();

export function MonitorizacaoGps({ players, sessions, matches, monitoring, clinico = [], teamId }) {
  const [estado, setEstado] = useState(() => (gpsTabelaConfirmada.has(teamId) ? 'ok' : 'a-verificar')); // a-verificar | ok | sem-tabela | erro
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let cancelado = false;
    if (!teamId) return undefined;
    if (gpsTabelaConfirmada.has(teamId) && tentativa === 0) { setEstado('ok'); return undefined; }
    setEstado('a-verificar');
    (async () => {
      try {
        await ensureSession();
        const { error } = await supabase.from(GPS_TABELA).select('id').limit(1);
        if (cancelado) return;
        if (!error) { gpsTabelaConfirmada.add(teamId); setEstado('ok'); return; }
        const msg = `${error.code || ''} ${error.message || ''}`;
        setEstado(/42P01|PGRST205|does not exist|Could not find the table/i.test(msg) ? 'sem-tabela' : 'erro');
      } catch (e) {
        if (!cancelado) setEstado('erro');
      }
    })();
    return () => { cancelado = true; };
  }, [teamId, tentativa]);

  if (estado === 'a-verificar') {
    return <div style={{ color: T.mutedDim, fontSize: 13, padding: '20px 4px', ...body }}>A preparar…</div>;
  }
  if (estado === 'sem-tabela') {
    return (
      <EmptyState text="O separador GPS ainda não está ativo nesta base de dados. Falta correr o ficheiro gps.sql no Supabase (SQL Editor) — depois disso, é só voltar a abrir este separador."
        action={<Btn variant="ghost" onClick={() => setTentativa(t => t + 1)}><RefreshCw size={14} /> Verificar outra vez</Btn>} />
    );
  }
  if (estado === 'erro') {
    return (
      <EmptyState text="Não foi possível ligar aos dados de GPS. Verifica a ligação à internet."
        action={<Btn variant="ghost" onClick={() => setTentativa(t => t + 1)}><RefreshCw size={14} /> Tentar outra vez</Btn>} />
    );
  }
  return <GpsPainel players={players} sessions={sessions} matches={matches} monitoring={monitoring} clinico={clinico} teamId={teamId} />;
}

export function GpsPainel({ players, sessions, matches, monitoring, clinico, teamId }) {
  const semAviso = useCallback(() => {}, []);
  const [gps, setGps, gpsPronto, , autorizarApagarGps] = useCollectionSync(GPS_TABELA, semAviso, teamId);
  const [vista, setVista] = useState('sessoes'); // sessoes | carga
  const [importar, setImportar] = useState(false);
  const [selId, setSelId] = useState(null);

  const config = gps.find(x => x.kind === 'config') || null;
  // Demonstração só até ONTEM: sessões Demo com data de hoje ou futura
  // (geradas por versões anteriores) não aparecem nem entram nas contas.
  const hojeGps = todayStr();
  const sessoesGps = React.useMemo(() => gps.filter(x => x.kind === 'sessao' && x.date && !(x.demo && x.date >= hojeGps))
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.importadoEm || '').localeCompare(String(a.importadoEm || ''))), [gps, hojeGps]);
  const temDemo = gps.some(x => x.kind === 'sessao' && x.demo);
  const selecionada = sessoesGps.find(s => s.id === selId) || sessoesGps[0] || null;

  const guardarConfig = (alterar) => {
    setGps(prev => {
      const atual = prev.find(x => x.kind === 'config');
      if (atual) return prev.map(x => (x.kind === 'config' ? alterar({ ...x }) : x));
      return [...prev, alterar({ id: `gpscfg_${teamId}`, kind: 'config', mapeamentos: {}, pares: {} })];
    });
  };

  const gerarDemo = () => {
    const novas = gpsGerarDemo({ players, sessions, matches, clinico });
    if (!novas.length) {
      offerAviso({ message: 'Não há jogadores no Plantel para gerar dados de demonstração.' });
      return;
    }
    // Substituir demonstração antiga apaga várias linhas de uma vez: o
    // travão da sincronização tem de ser autorizado ANTES da gravação.
    if (temDemo) autorizarApagarGps();
    setGps(prev => [...prev.filter(x => !(x.kind === 'sessao' && x.demo)), ...novas]);
    setSelId(null);
    offerAviso({ message: `Criadas ${novas.length} sessões de demonstração (marcadas como Demo).` });
  };
  const apagarDemo = () => {
    askConfirm({
      title: 'Apagar dados de demonstração?',
      label: `${gps.filter(x => x.kind === 'sessao' && x.demo).length} sessões marcadas como Demo`,
      note: 'Os dados importados de ficheiros não são tocados.',
      confirmLabel: 'Apagar demonstração',
      destructive: true,
      onConfirm: () => {
        autorizarApagarGps();
        setGps(prev => prev.filter(x => !(x.kind === 'sessao' && x.demo)));
        setSelId(null);
      },
    });
  };

  if (!gpsPronto) {
    return <div style={{ color: T.mutedDim, fontSize: 13, padding: '20px 4px', ...body }}>A carregar os dados de GPS…</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <ChipBtn active={vista === 'sessoes'} onClick={() => setVista('sessoes')}>Sessões GPS</ChipBtn>
        <ChipBtn active={vista === 'carga'} onClick={() => setVista('carga')}>Carga e cruzamento</ChipBtn>
        <div style={{ flex: 1 }} />
        <Btn onClick={() => setImportar(true)} disabled={players.length === 0}><Upload size={15} /> Importar ficheiro</Btn>
        <Btn variant="ghost" onClick={() => gpsModeloCsv(players)}><Download size={15} /> Modelo</Btn>
      </div>

      {vista === 'sessoes' ? (
        sessoesGps.length === 0 ? (
          <EmptyState
            text="Ainda não há dados de GPS. Importa o ficheiro exportado do software do GPS (CSV ou Excel), ou gera dados de demonstração para experimentar todos os ecrãs."
            action={<div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Btn onClick={() => setImportar(true)} disabled={players.length === 0}><Upload size={15} /> Importar ficheiro</Btn>
              <Btn variant="ghost" onClick={gerarDemo} disabled={players.length === 0}>Gerar dados de demonstração</Btn>
            </div>} />
        ) : (
          <>
            <GpsQuadroSessao sessao={selecionada} todas={sessoesGps} onEscolher={setSelId}
              players={players} matches={matches}
              onApagar={(s) => removeWithUndo(gps, setGps, s.id, `Sessão GPS de ${fmtDate(s.date)}`)} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, justifyContent: 'flex-end' }}>
              {temDemo
                ? <Btn variant="ghost" onClick={apagarDemo}><Trash2 size={14} /> Apagar dados de demonstração</Btn>
                : <Btn variant="ghost" onClick={gerarDemo}>Gerar dados de demonstração</Btn>}
            </div>
          </>
        )
      ) : (
        <GpsCargaCruzada players={players} sessions={sessions} matches={matches} monitoring={monitoring} clinico={clinico} sessoesGps={sessoesGps} />
      )}

      {importar && (
        <GpsImportar players={players} sessions={sessions} matches={matches} config={config}
          onClose={() => setImportar(false)}
          onGuardar={({ sessao, assinatura, mapa, pares }) => {
            setGps(prev => [...prev, sessao]);
            guardarConfig(c => ({
              ...c,
              mapeamentos: { ...(c.mapeamentos || {}), [assinatura]: mapa },
              pares: { ...(c.pares || {}), ...pares },
            }));
            setSelId(sessao.id);
            setVista('sessoes');
            setImportar(false);
          }} />
      )}
    </div>
  );
}

/* ---------- Quadro da sessão (estilo Smartabase) ---------- */
export const GPS_COLUNAS = [
  { k: 'minutos', label: 'Min', casas: 0 },
  { k: 'dist', label: 'Distância', casas: 0 },
  { k: 'mmin', label: 'm/min', casas: 1 },
  { k: 'hsr', label: 'HSR', casas: 0 },
  { k: 'sprint', label: 'Sprint', casas: 0 },
  { k: 'acc', label: 'Acel', casas: 0 },
  { k: 'dec', label: 'Desacel', casas: 0 },
  { k: 'vmax', label: 'Vmáx', casas: 1 },
  { k: 'pvmax', label: '% Vmáx', casas: 0 },
  { k: 'fcMed', label: 'FC méd', casas: 0 },
  { k: 'load', label: 'Carga', casas: 0 },
];

export const GPS_MOSAICO = [
  { k: 'dist', label: 'Distância (m)', cor: '#4CA86B', casas: 0 },
  { k: 'hsr', label: 'Alta velocidade (m)', cor: '#D9A72E', casas: 0 },
  { k: 'sprint', label: 'Sprint (m)', cor: '#8C7BD1', casas: 0 },
  { k: 'acc', label: 'Acelerações', cor: '#D14056', casas: 0 },
  { k: 'dec', label: 'Desacelerações', cor: '#3A8FC4', casas: 0 },
  { k: 'mmin', label: 'm/min', cor: '#E08A3C', casas: 1 },
];

export function GpsQuadroSessao({ sessao, todas, onEscolher, players, matches, onApagar }) {
  const [ordem, setOrdem] = useState({ k: 'pos', desc: false });
  if (!sessao) return null;
  const jogadorDe = (id) => players.find(p => p.id === id);
  const melhorVmax = new Map();
  todas.forEach(s => (s.registos || []).forEach(r => {
    if (r.playerId && r.vmax != null) melhorVmax.set(r.playerId, Math.max(melhorVmax.get(r.playerId) || 0, r.vmax));
  }));
  const linhas = (sessao.registos || []).filter(r => r.playerId).map(r => ({
    ...r, p: jogadorDe(r.playerId), mmin: gpsMmin(r),
    pvmax: r.vmax != null && melhorVmax.get(r.playerId) ? (r.vmax / melhorVmax.get(r.playerId)) * 100 : null,
  }));
  const media = (k) => gpsMedia(linhas.map(l => l[k]));
  // Referência de jogo: média dos jogos (sem contar esta sessão).
  const jogos = todas.filter(s => s.tipo === 'jogo' && s.id !== sessao.id);
  const refJogo = (k) => gpsMedia(jogos.map(s => gpsMedia((s.registos || []).filter(r => r.playerId).map(r => (k === 'mmin' ? gpsMmin(r) : r[k])))));
  const md = gpsCodigoMD(sessao.date, matches) || (sessao.tipo === 'jogo' ? 'MD' : '');

  const ordenadas = [...linhas].sort((a, b) => {
    if (ordem.k === 'pos') return gpsOrdemPos(a.p) - gpsOrdemPos(b.p) || String(a.p?.name || '').localeCompare(String(b.p?.name || ''), 'pt');
    if (ordem.k === 'nome') return String(a.p?.name || '').localeCompare(String(b.p?.name || ''), 'pt') * (ordem.desc ? -1 : 1);
    const va = a[ordem.k] ?? -Infinity;
    const vb = b[ordem.k] ?? -Infinity;
    return ordem.desc ? vb - va : va - vb;
  });
  const clicarColuna = (k) => setOrdem(o => (o.k === k ? { k, desc: !o.desc } : { k, desc: k !== 'nome' && k !== 'pos' }));
  const th = { textAlign: 'right', padding: '9px 10px', fontSize: 10.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${T.line}`, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', ...body };
  const td = { padding: '8px 10px', fontSize: 13, color: T.cream, textAlign: 'right', whiteSpace: 'nowrap', borderBottom: `1px solid ${T.line}`, ...mono };

  return (
    <div style={{ overflowAnchor: 'none' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <Select value={sessao.id} onChange={e => onEscolher(e.target.value)}>
            {todas.map(s => (
              <option key={s.id} value={s.id}>
                {`${fmtDate(s.date)} · ${s.tipo === 'jogo' ? 'Jogo' : 'Treino'}${s.titulo ? ` · ${s.titulo}` : ''}${s.demo ? ' · Demo' : ''}`}
              </option>
            ))}
          </Select>
        </div>
        <Btn variant="ghost" onClick={() => onApagar(sessao)} title="Apagar esta sessão"><Trash2 size={14} /></Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 10 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 10.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', ...body }}>Duração média</div>
          <div style={{ ...display, fontSize: 26, color: T.cream, fontWeight: 600 }}>{gpsFmt(media('minutos'))}<span style={{ fontSize: 13, color: T.mutedDim }}> min</span></div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 10.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', ...body }}>Dia</div>
          <div style={{ ...display, fontSize: 26, color: T.cream, fontWeight: 600 }}>{md || '—'}</div>
          <div style={{ fontSize: 11.5, color: T.mutedDim, ...body }}>{linhas.length} jogadores{sessao.demo ? ' · Demo' : ''}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 6 }}>
        {GPS_MOSAICO.map(m => {
          const v = media(m.k);
          const ref = refJogo(m.k);
          const pct = v != null && ref ? (v / ref) * 100 : null;
          return (
            <div key={m.k} style={{ background: T.surface, border: `1px solid ${T.line}`, borderTop: `3px solid ${m.cor}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', ...body }}>{m.label}</div>
              <div style={{ ...display, fontSize: 26, color: T.cream, fontWeight: 600 }}>{gpsFmt(v, m.casas)}</div>
              <div style={{ fontSize: 11.5, color: T.mutedDim, ...body }}>
                {pct != null ? <><span style={{ color: m.cor, fontWeight: 600 }}>{gpsFmt(pct)}%</span> da média dos jogos</> : 'Sem jogos para comparar'}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11.5, color: T.mutedDim, margin: '0 2px 16px', ...body }}>Valores médios dos jogadores desta sessão.</div>

      <Panel title="Por jogador">
        {/* ALTURA FIXA: a tabela tem sempre a mesma altura (desliza por
            dentro), seja um jogo com 16 jogadores ou um treino com 32.
            Assim, ao trocar de sessão no seletor, a página não muda de
            tamanho e nada salta de sítio. */}
        {/* COLUNAS FIXAS: largura de cada coluna decidida de antemão
            (table-layout fixed) e espaço da barra de deslocamento sempre
            reservado (scrollbar-gutter). Antes, as colunas ajustavam-se
            aos números de cada sessão, e a barra só aparecia nas sessões
            com mais jogadores — as duas coisas faziam a tabela andar
            para os lados ao trocar de dia. */}
        <div style={{ overflow: 'auto', height: 'min(62vh, 640px)', margin: '0 -18px', padding: '0 18px', overflowAnchor: 'none', scrollbarGutter: 'stable' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 900, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 170 }} />
              <col style={{ width: 56 }} />
              {GPS_COLUNAS.map(c => <col key={c.k} />)}
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left', position: 'sticky', left: 0, top: 0, zIndex: 3, background: T.surface }} onClick={() => clicarColuna('nome')}>Jogador</th>
                <th style={{ ...th, textAlign: 'left', position: 'sticky', top: 0, zIndex: 2, background: T.surface }} onClick={() => clicarColuna('pos')}>Pos</th>
                {GPS_COLUNAS.map(c => (
                  <th key={c.k} style={{ ...th, position: 'sticky', top: 0, zIndex: 2, background: T.surface, color: ordem.k === c.k ? T.cream : T.muted }} onClick={() => clicarColuna(c.k)}>
                    {c.label}{ordem.k === c.k ? (ordem.desc ? ' ↓' : ' ↑') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map(l => (
                <tr key={l.playerId}>
                  <td style={{ ...td, ...body, textAlign: 'left', position: 'sticky', left: 0, zIndex: 1, background: T.surface, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.p ? shortFullName(l.p.name) : l.origem}</td>
                  <td style={{ ...td, ...body, textAlign: 'left', color: T.mutedDim }}>{l.p?.position || '—'}</td>
                  {GPS_COLUNAS.map(c => <td key={c.k} style={td}>{gpsFmt(l[c.k], c.casas)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 10, ...body }}>
          HSR e Sprint seguem os limites definidos no software do GPS. % Vmáx compara com o melhor registo do próprio jogador nos dados carregados.
          {sessao.ficheiro ? ` Origem: ${sessao.ficheiro}.` : ''}
        </div>
      </Panel>
    </div>
  );
}

/* ---------- Carga interna (PSE × minutos) cruzada com GPS, Wellness e clínico ---------- */
export function gpsMinutosDoPse(rec, sessions, matches) {
  const ctx = rpeContexto(rec, { matches, sessions });
  if (ctx === 'jogo') {
    const jogo = (matches || []).find(m => m.date === rec.date && m.report && m.report[rec.playerId]);
    const min = jogo ? Number(jogo.report[rec.playerId].minutes) : NaN;
    return Number.isFinite(min) && min > 0 ? min : null;
  }
  const min = (sessions || []).filter(s => s.date === rec.date && s.phase !== 'Descanso')
    .reduce((a, s) => a + (s.exerciseIds || []).reduce((b, e) => b + (Number(e && e.duration) || 0), 0), 0);
  return min > 0 ? min : null;
}

export function gpsEstadoRacio(r) {
  if (r == null) return { label: '—', cor: T.mutedDim };
  if (r < 0.8) return { label: 'Baixo', cor: '#3A8FC4' };
  if (r <= 1.3) return { label: 'Adequado', cor: T.good };
  if (r <= 1.5) return { label: 'Atenção', cor: T.warn };
  return { label: 'Elevado', cor: T.bad };
}

export function GpsCargaCruzada({ players, sessions, matches, monitoring, clinico, sessoesGps }) {
  const [dataRef, setDataRef] = useState(todayStr());
  const d7 = addDays(dataRef, -6);
  const d28 = addDays(dataRef, -27);
  const dentro = (d, de) => d && d >= de && d <= dataRef;

  const linhas = React.useMemo(() => {
    let semDuracao = 0;
    const porJogador = new Map();
    (monitoring || []).forEach(m => {
      if (!m || !m.playerId || !dentro(m.date, d28)) return;
      const j = porJogador.get(m.playerId) || { a7: 0, a28: 0, pse7: 0, well: [] };
      if (typeof m.pse === 'number') {
        const min = gpsMinutosDoPse(m, sessions, matches);
        if (min == null) { if (dentro(m.date, d7)) semDuracao++; } else {
          const ua = m.pse * min;
          j.a28 += ua;
          if (dentro(m.date, d7)) { j.a7 += ua; j.pse7++; }
        }
      }
      const w = wellnessAvg(m);
      if (w != null && dentro(m.date, d7)) j.well.push(w);
      porJogador.set(m.playerId, j);
    });
    const gps7 = new Map();
    sessoesGps.forEach(s => {
      if (!dentro(s.date, d7)) return;
      (s.registos || []).forEach(r => {
        if (!r.playerId) return;
        const g = gps7.get(r.playerId) || { dist: 0, hsr: 0, n: 0 };
        g.dist += r.dist || 0; g.hsr += r.hsr || 0; g.n++;
        gps7.set(r.playerId, g);
      });
    });
    const lista = [...players].sort((a, b) => gpsOrdemPos(a) - gpsOrdemPos(b) || String(a.name).localeCompare(String(b.name), 'pt')).map(p => {
      const j = porJogador.get(p.id) || { a7: 0, a28: 0, pse7: 0, well: [] };
      const cronica = j.a28 / 4;
      const racio = cronica > 0 ? j.a7 / cronica : null;
      return {
        p, aguda: j.a7, cronica, racio, pse7: j.pse7, well: gpsMedia(j.well),
        gps: gps7.get(p.id) || null, clinico: estadoClinicoEm(p.id, dataRef, clinico),
      };
    });
    return { lista, semDuracao };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, sessions, matches, monitoring, clinico, sessoesGps, dataRef]);

  const th = { textAlign: 'right', padding: '9px 10px', fontSize: 10.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${T.line}`, whiteSpace: 'nowrap', ...body };
  const td = { padding: '8px 10px', fontSize: 13, color: T.cream, textAlign: 'right', whiteSpace: 'nowrap', ...mono };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ width: 190 }}>
          <Field label="Data de referência" solto><Input type="date" value={dataRef} onChange={e => setDataRef(e.target.value || todayStr())} /></Field>
        </div>
        <div style={{ fontSize: 12, color: T.mutedDim, flex: '1 1 260px', ...body }}>
          Carga interna = PSE × minutos (treino: duração planeada no Planeamento; jogo: minutos jogados). Aguda = últimos 7 dias; crónica = média semanal dos últimos 28 dias.
        </div>
      </div>

      <Panel title="Carga e estado do plantel">
        <div style={{ overflowX: 'auto', margin: '0 -18px', padding: '0 18px' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 820 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left', position: 'sticky', left: 0, background: T.surface }}>Jogador</th>
                <th style={{ ...th, textAlign: 'left' }}>Pos</th>
                <th style={th}>Aguda (UA)</th>
                <th style={th}>Crónica (UA)</th>
                <th style={th}>Rácio</th>
                <th style={th}>PSE 7d</th>
                <th style={th}>Wellness 7d</th>
                <th style={th}>Dist. GPS 7d</th>
                <th style={th}>HSR GPS 7d</th>
                <th style={{ ...th, textAlign: 'left' }}>Clínico</th>
              </tr>
            </thead>
            <tbody>
              {linhas.lista.map(l => {
                const est = gpsEstadoRacio(l.racio);
                return (
                  <tr key={l.p.id} style={{ borderBottom: `1px solid ${T.line}` }}>
                    <td style={{ ...td, ...body, textAlign: 'left', position: 'sticky', left: 0, background: T.surface }}>{shortFullName(l.p.name)}</td>
                    <td style={{ ...td, ...body, textAlign: 'left', color: T.mutedDim }}>{l.p.position || '—'}</td>
                    <td style={td}>{l.aguda ? gpsFmt(l.aguda) : '—'}</td>
                    <td style={td}>{l.cronica ? gpsFmt(l.cronica) : '—'}</td>
                    <td style={{ ...td, color: est.cor }}>{l.racio != null ? `${gpsFmt(l.racio, 2)} · ${est.label}` : '—'}</td>
                    <td style={td}>{l.pse7 || '—'}</td>
                    <td style={td}>{l.well != null ? gpsFmt(l.well, 1) : '—'}</td>
                    <td style={td}>{l.gps ? gpsFmt(l.gps.dist) : '—'}</td>
                    <td style={td}>{l.gps ? gpsFmt(l.gps.hsr) : '—'}</td>
                    <td style={{ ...td, ...body, textAlign: 'left', color: l.clinico ? l.clinico.cor : T.mutedDim }}>{l.clinico ? l.clinico.curto : 'Disponível'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 10, lineHeight: 1.5, ...body }}>
          Rácio aguda:crónica — referência comum: abaixo de 0,8 baixo; 0,8–1,3 adequado; 1,3–1,5 atenção; acima de 1,5 elevado. É um sinal para a equipa técnica olhar, não uma regra, e só é fiável com pelo menos 3–4 semanas de PSE.
          {linhas.semDuracao ? ` ${linhas.semDuracao} PSE dos últimos 7 dias ficaram fora do cálculo por não haver duração (treino sem exercícios no Planeamento ou jogo sem minutos).` : ''}
        </div>
      </Panel>
    </div>
  );
}

/* ---------- Importar ficheiro: ler → colunas → jogadores → sessão ---------- */
export function GpsImportar({ players, sessions, matches, config, onClose, onGuardar }) {
  const [passo, setPasso] = useState('ficheiro'); // ficheiro | colunas | jogadores
  const [erro, setErro] = useState('');
  const [aLer, setALer] = useState(false);
  const [lido, setLido] = useState(null); // { nome, linhas, separador, iCab }
  const [mapa, setMapa] = useState({});
  const [extraido, setExtraido] = useState(null);
  const [escolhas, setEscolhas] = useState({}); // índice -> playerId | '__ignorar'
  const [data, setData] = useState(todayStr());
  const [ligacao, setLigacao] = useState(''); // 's:<id>' | 'm:<id>' | 'treino' | 'jogo'

  const cabecalho = lido ? (lido.linhas[lido.iCab] || []) : [];
  const plantelOrdenado = [...players].sort((a, b) => gpsOrdemPos(a) - gpsOrdemPos(b) || String(a.name).localeCompare(String(b.name), 'pt'));

  const lerFicheiro = async (f) => {
    if (!f) return;
    setErro(''); setALer(true);
    try {
      const nome = f.name || 'ficheiro';
      let res;
      if (/\.xlsx$/i.test(nome)) res = await gpsLerXlsx(await f.arrayBuffer());
      else if (/\.xls$/i.test(nome)) throw new Error('Ficheiros .xls antigos não são suportados — grava como .xlsx ou exporta em CSV.');
      else res = gpsLerCsv(await f.text());
      if (!res.linhas.length) throw new Error('O ficheiro está vazio.');
      const iCab = gpsAcharCabecalho(res.linhas);
      const cab = res.linhas[iCab] || [];
      const guardado = config && config.mapeamentos && config.mapeamentos[gpsAssinatura(cab)];
      let m = gpsMapeamentoAuto(cab);
      if (guardado) {
        m = {};
        Object.entries(guardado).forEach(([k, titulo]) => {
          const i = cab.findIndex(h => gpsNorm(h) === titulo);
          if (i >= 0) m[k] = i;
        });
      }
      setLido({ nome, linhas: res.linhas, separador: res.separador, iCab });
      setMapa(m);
      setPasso('colunas');
    } catch (e) {
      setErro(e && e.message ? e.message : 'Não foi possível ler o ficheiro.');
    } finally {
      setALer(false);
    }
  };

  const avancarParaJogadores = () => {
    const ex = gpsExtrair(lido.linhas, lido.iCab, mapa, lido.separador);
    if (!ex.registos.length) { setErro('Não encontrámos linhas de jogadores com estas colunas.'); return; }
    setErro('');
    setExtraido(ex);
    const e = {};
    ex.registos.forEach((r, i) => { e[i] = gpsSugerirJogador(r, players, config && config.pares) || ''; });
    setEscolhas(e);
    const d = ex.datas.length === 1 ? ex.datas[0] : todayStr();
    setData(d);
    setLigacao('');
    setPasso('jogadores');
  };

  const opcoesLigacao = [
    ...(matches || []).filter(m => m.date === data && !jogoNaoJogado(m)).map(m => ({ v: `m:${m.id}`, label: `Jogo${m.opponent ? ` vs ${m.opponent}` : ''}` })),
    ...(sessions || []).filter(s => s.date === data && s.phase !== 'Descanso').map(s => ({ v: `s:${s.id}`, label: `${s.phase === 'Jogo' ? 'Jogo' : 'Treino'}${s.focus ? ` · ${s.focus}` : s.phase ? ` · ${s.phase}` : ''}` })),
  ];
  const ligacaoEfetiva = ligacao || (opcoesLigacao[0] ? opcoesLigacao[0].v : 'treino');

  const usados = Object.values(escolhas).filter(v => v && v !== '__ignorar');
  const repetidos = usados.filter((v, i) => usados.indexOf(v) !== i);
  const porResolver = extraido ? extraido.registos.filter((_, i) => !escolhas[i]).length : 0;

  const guardar = () => {
    let tipo = 'treino'; let sessionId = null; let matchId = null; let titulo = 'Treino';
    if (ligacaoEfetiva.startsWith('m:')) {
      matchId = ligacaoEfetiva.slice(2);
      const m = matches.find(x => x.id === matchId);
      tipo = 'jogo'; titulo = m && m.opponent ? `Jogo vs ${m.opponent}` : 'Jogo';
    } else if (ligacaoEfetiva.startsWith('s:')) {
      sessionId = ligacaoEfetiva.slice(2);
      const s = sessions.find(x => x.id === sessionId);
      tipo = s && s.phase === 'Jogo' ? 'jogo' : 'treino';
      titulo = (s && (s.focus || s.phase)) || (tipo === 'jogo' ? 'Jogo' : 'Treino');
    } else {
      tipo = ligacaoEfetiva === 'jogo' ? 'jogo' : 'treino';
      titulo = tipo === 'jogo' ? 'Jogo' : 'Treino';
    }
    const pares = {};
    const registos = [];
    extraido.registos.forEach((r, i) => {
      const pid = escolhas[i];
      if (!pid) return;
      pares[`n:${gpsNomeChave(r.origem)}`] = pid;
      if (r.colete) pares[`c:${gpsNomeChave(r.colete)}`] = pid;
      if (pid === '__ignorar') return;
      registos.push({ ...r, playerId: pid });
    });
    const mapaTitulos = {};
    Object.entries(mapa).forEach(([k, i]) => { if (i != null && cabecalho[i] != null) mapaTitulos[k] = gpsNorm(cabecalho[i]); });
    onGuardar({
      sessao: {
        id: `gps_${uid()}${uid()}`, kind: 'sessao', demo: false, date: data, tipo, sessionId, matchId, titulo,
        ficheiro: lido.nome, importadoEm: new Date().toISOString(), registos,
      },
      assinatura: gpsAssinatura(cabecalho),
      mapa: mapaTitulos,
      pares,
    });
  };

  const amostra = lido ? lido.linhas.slice(lido.iCab + 1, lido.iCab + 4) : [];

  return (
    <Modal title="Importar dados de GPS" subtitle={lido ? lido.nome : 'CSV ou Excel exportado do software do GPS'} onClose={onClose} wide>
      {erro && (
        <div style={{ background: `${T.bad}22`, border: `1px solid ${T.bad}`, color: T.cream, borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 14, ...body }}>{erro}</div>
      )}

      {passo === 'ficheiro' && (
        <div>
          <p style={{ color: T.mutedDim, fontSize: 13.5, marginTop: 0, lineHeight: 1.5, ...body }}>
            No software do GPS (Catapult, STATSports, Polar…), exporta o relatório da sessão com uma linha por jogador e escolhe-o aqui. Na primeira vez confirmas as colunas e os jogadores; nas seguintes, a app já se lembra.
          </p>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: `1px dashed ${T.line}`, borderRadius: 10, padding: '30px 16px', cursor: aLer ? 'wait' : 'pointer', color: T.cream, ...body }}>
            {aLer ? <Loader2 size={22} className="spin" /> : <Upload size={22} />}
            <span style={{ fontSize: 14 }}>{aLer ? 'A ler o ficheiro…' : 'Escolher ficheiro (.csv ou .xlsx)'}</span>
            <input type="file" accept=".csv,.txt,.xlsx" style={{ display: 'none' }} disabled={aLer}
              onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; lerFicheiro(f); }} />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <Btn variant="ghost" onClick={() => gpsModeloCsv(players)}><Download size={14} /> Descarregar modelo</Btn>
          </div>
        </div>
      )}

      {passo === 'colunas' && lido && (
        <div>
          <p style={{ color: T.mutedDim, fontSize: 13.5, marginTop: 0, ...body }}>Confirma que coluna do ficheiro corresponde a cada indicador. Os que não existirem no ficheiro ficam em “Não tem”.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
            {GPS_CAMPOS.map(c => (
              <Field key={c.k} label={`${c.label}${c.obrig ? ' *' : ''}`} solto>
                <Select value={mapa[c.k] == null ? '' : String(mapa[c.k])}
                  onChange={e => { const v = e.target.value; setMapa(m => { const n = { ...m }; if (v === '') delete n[c.k]; else n[c.k] = Number(v); return n; }); }}>
                  <option value="">Não tem</option>
                  {cabecalho.map((h, i) => (
                    <option key={i} value={i}>{String(h || `Coluna ${i + 1}`)}{amostra[0] && amostra[0][i] !== undefined && amostra[0][i] !== '' ? ` — ex.: ${String(amostra[0][i]).slice(0, 18)}` : ''}</option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 18, flexWrap: 'wrap' }}>
            <Btn variant="ghost" onClick={() => { setPasso('ficheiro'); setLido(null); }}>Outro ficheiro</Btn>
            <Btn onClick={avancarParaJogadores} disabled={mapa.jogador == null || mapa.dist == null}>Continuar <ChevronRight size={15} /></Btn>
          </div>
        </div>
      )}

      {passo === 'jogadores' && extraido && (
        <div>
          {extraido.avisos.length > 0 && (
            <div style={{ fontSize: 12.5, color: T.warn, marginBottom: 12, lineHeight: 1.5, ...body }}>{extraido.avisos.map((a, i) => <div key={i}>{a}</div>)}</div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            <Field label="Data da sessão" solto>
              <Input type="date" value={data} onChange={e => { setData(e.target.value || todayStr()); setLigacao(''); }} />
            </Field>
            <Field label="Ligar a" solto>
              <Select value={ligacaoEfetiva} onChange={e => setLigacao(e.target.value)}>
                {opcoesLigacao.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                <option value="treino">Treino (sem ligação ao Planeamento)</option>
                <option value="jogo">Jogo (sem ligação a Jogos)</option>
              </Select>
            </Field>
          </div>

          <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, ...body }}>Jogadores do ficheiro ({extraido.registos.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {extraido.registos.map((r, i) => {
              const repetido = escolhas[i] && escolhas[i] !== '__ignorar' && repetidos.includes(escolhas[i]);
              return (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '6px 0', borderBottom: `1px solid ${T.line}` }}>
                  <div style={{ flex: '1 1 160px', minWidth: 0, fontSize: 13.5, color: T.cream, ...body }}>
                    {r.origem}{r.colete ? <span style={{ color: T.mutedDim }}> · {r.colete}</span> : null}
                    <div style={{ fontSize: 11.5, color: T.mutedDim, ...mono }}>{gpsFmt(r.dist)} m{r.minutos != null ? ` · ${gpsFmt(r.minutos)} min` : ''}</div>
                  </div>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <Select value={escolhas[i] || ''} onChange={e => { const v = e.target.value; setEscolhas(s => ({ ...s, [i]: v })); }}
                      style={{ borderColor: !escolhas[i] || repetido ? T.warn : T.line }}>
                      <option value="">Escolher jogador…</option>
                      {plantelOrdenado.map(p => <option key={p.id} value={p.id}>{p.name}{p.position ? ` (${p.position})` : ''}</option>)}
                      <option value="__ignorar">Ignorar esta linha</option>
                    </Select>
                    {repetido && <div style={{ fontSize: 11.5, color: T.warn, marginTop: 3, ...body }}>Este jogador está escolhido em mais do que uma linha.</div>}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginTop: 18, flexWrap: 'wrap' }}>
            <Btn variant="ghost" onClick={() => setPasso('colunas')}><ChevronLeft size={15} /> Colunas</Btn>
            <span style={{ fontSize: 12.5, color: porResolver ? T.warn : T.mutedDim, ...body }}>
              {porResolver ? `Falta escolher ${porResolver} jogador(es)` : 'Tudo emparelhado'}
            </span>
            <Btn onClick={guardar} disabled={porResolver > 0 || repetidos.length > 0}><Check size={15} /> Guardar sessão</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

