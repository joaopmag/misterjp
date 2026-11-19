/* MAIS LINHAS DE JOGADORES NO EXCEL (19/11).

   O modelo "Estatística e Assiduidade" foi desenhado para 30 atletas: 30
   linhas em cada folha de relatório, em cada quadro da ESTATÍSTICA TOTAL e
   em cada mês da Ficha Assiduidade, e os gráficos vão de B6 a B35. Com
   mais jogadores, os que passavam dos 30 ficavam de fora.

   Aqui acrescentam-se as linhas que faltam, como o Excel faria com
   "Inserir linhas" seguido de "copiar a linha de cima":
   1. Em cada folha, as linhas abaixo do ponto de inserção descem.
   2. Todas as fórmulas do livro (e os intervalos dos gráficos) que apontam
      para linhas que desceram são corrigidas; um intervalo que atravessa o
      ponto de inserção (ex.: SUM(H6:H35)) alarga.
   3. As linhas novas são cópias da última linha de jogador antes do ponto
      (a "linha modelo"): mesmo estilo, mesma altura, mesmas fórmulas. Na
      cópia n.º i, uma referência à linha modelo de outra inserção passa
      para a cópia n.º i dessa inserção (o jogador 30+i de uma folha
      aponta para o jogador 30+i da outra, mesmo com $ absolutos, como o
      nome que a Ficha Assiduidade vai buscar à ESTATÍSTICA TOTAL). As
      outras referências relativas descem i linhas, como numa cópia do
      Excel; as absolutas ficam.
   4. O número da coluna A (1, 2, 3…) continua a contar.

   Tudo é feito sobre o XML, sem bibliotecas: o resto da app já trabalha
   assim (JSZip). As fórmulas partilhadas (`t="shared"`) da linha modelo
   passam a fórmulas normais nas cópias. O Excel recalcula tudo ao abrir
   (ver `forcarRecalculoAoAbrir`). */

const desescapar = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const escapar = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const colNum = (letras) => letras.split('').reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0);
const colLetras = (n) => { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };

/* `insercoes`: { [nomeDaFolha]: [{ depoisDe, k }] } em coordenadas
   ORIGINAIS. A linha n de uma folha passa a n + soma dos k cujo depoisDe
   é menor que n. */
function deslocador(insercoes) {
  return (folha, n) => {
    const lista = insercoes[folha];
    if (!lista) return n;
    let s = 0;
    for (const ins of lista) if (n > ins.depoisDe) s += ins.k;
    return n + s;
  };
}

/* Reescreve as referências de uma fórmula (texto já desescapado).
   `folhaAtual`: a folha onde a fórmula está (para referências sem nome de
   folha). `mapear(folha, linha, absoluta)` devolve a linha nova. Não mexe
   em texto entre aspas nem em nomes de funções (LOG10( …). */
export function reescreverReferencias(formula, folhaAtual, mapear, mapearColuna) {
  const partes = formula.split(/("(?:[^"]|"")*")/);
  const re = /(^|[^A-Za-z0-9_.$'!])((?:'((?:[^']|'')+)'|([A-Za-z0-9_.À-ɏ]+))!)?(\$?)([A-Z]{1,3})(\$?)(\d+)(?::(\$?)([A-Z]{1,3})(\$?)(\d+))?(?![A-Za-z0-9_(])/g;
  return partes.map((p, i) => {
    if (i % 2 === 1) return p; // texto entre aspas
    return p.replace(re, (all, pre, prefixo, nomeQ, nomeS, ac1, c1, ar1, r1, ac2, c2, ar2, r2) => {
      const folha = nomeQ != null ? nomeQ.replace(/''/g, "'") : (nomeS != null ? nomeS : folhaAtual);
      const col1 = mapearColuna ? mapearColuna(c1, !!ac1) : c1;
      const n1 = mapear(folha, Number(r1), !!ar1);
      let out = `${pre}${prefixo || ''}${ac1}${col1}${ar1}${n1}`;
      if (c2) {
        const col2 = mapearColuna ? mapearColuna(c2, !!ac2) : c2;
        out += `:${ac2}${col2}${ar2}${mapear(folha, Number(r2), !!ar2, true)}`;
      }
      return out;
    });
  }).join('');
}

/* Insere linhas em várias folhas de uma vez.
   `zip`: JSZip do livro. `folhas`: { nomeDaFolha: caminhoXml }.
   `pedidos`: [{ folha, depoisDe, k }] — as cópias são da linha `depoisDe`
   (a última linha de jogador antes do ponto de inserção). */
export async function inserirLinhasNoLivro(zip, folhas, pedidos) {
  const insercoes = {};
  pedidos.filter(p => p.k > 0).forEach(p => { (insercoes[p.folha] = insercoes[p.folha] || []).push({ depoisDe: p.depoisDe, k: p.k }); });
  if (!Object.keys(insercoes).length) return;
  const desloca = deslocador(insercoes);
  // Linhas modelo por folha: linha original -> posição nova da linha modelo.
  const modelos = {};
  Object.entries(insercoes).forEach(([f, l]) => { modelos[f] = new Map(l.map(ins => [ins.depoisDe, desloca(f, ins.depoisDe)])); });

  const mapearDeslocar = (folha, n) => desloca(folha, n);
  const corrigirFormulas = (x, folhaAtual) => x.replace(/<f([^>]*)>([^<]*)<\/f>/g, (all, at, txt) => {
    const novoAt = at.replace(/\sref="([^"]+)"/, (a, ref) => ` ref="${refDeslocada(ref, folhaAtual)}"`);
    return `<f${novoAt}>${escapar(reescreverReferencias(desescapar(txt), folhaAtual, mapearDeslocar))}</f>`;
  });
  const refDeslocada = (ref, folha) => ref.replace(/([A-Z]+)(\d+)/g, (a, c, n) => `${c}${desloca(folha, Number(n))}`);
  const estilos = await lerEstilos(zip);

  // 1. Gráficos (fórmulas das séries).
  for (const caminho of Object.keys(zip.files).filter(n => /^xl\/charts\/chart\d+\.xml$/.test(n))) {
    const x = await zip.file(caminho).async('string');
    const y = x.replace(/<c:f>([^<]*)<\/c:f>/g, (a, txt) => `<c:f>${escapar(reescreverReferencias(desescapar(txt), null, mapearDeslocar))}</c:f>`);
    if (y !== x) zip.file(caminho, y);
  }

  // 2. Folhas: fórmulas de todas; linhas, células e uniões das que crescem.
  for (const [nome, caminho] of Object.entries(folhas)) {
    const f = zip.file(caminho);
    if (!f) continue;
    let x = await f.async('string');
    const cresce = !!insercoes[nome];
    if (!cresce && !/<f[ >]/.test(x)) continue;

    // Fórmulas partilhadas: o texto da mestra (por si), antes de mexer, para
    // expandir as dependentes que vão ser copiadas.
    const mestras = {};
    if (cresce) {
      for (const m of x.matchAll(/<c r="([A-Z]+)(\d+)"[^>]*>\s*<f([^>]*)>([^<]*)<\/f>/g)) {
        const si = (m[3].match(/\bsi="(\d+)"/) || [])[1];
        if (si != null && /t="shared"/.test(m[3]) && m[4]) mestras[si] = { col: colNum(m[1]), lin: Number(m[2]), txt: desescapar(m[4]) };
      }
    }
    // Guardam-se as linhas modelo ORIGINAIS antes de deslocar.
    const linhasModelo = {};
    if (cresce) {
      for (const ins of insercoes[nome]) {
        const linha = (n) => (x.match(new RegExp(`<row r="${n}"(?:[^>]*/>|[^>]*>[\\s\\S]*?</row>)`)) || [])[0];
        const m = linha(ins.depoisDe);
        if (m) {
          linhasModelo[ins.depoisDe] = m;
          ins.estA = estilosPorColuna(linha(ins.depoisDe - 1));
          ins.estB = estilosPorColuna(m);
          ins.estUltima = estilosPorColuna(linha(ins.depoisDe + 1));
        }
      }
    }

    x = corrigirFormulas(x, nome);
    if (cresce) {
      x = x.replace(/<row r="(\d+)"/g, (a, n) => `<row r="${desloca(nome, Number(n))}"`);
      x = x.replace(/<c r="([A-Z]+)(\d+)"/g, (a, c, n) => `<c r="${c}${desloca(nome, Number(n))}"`);
      x = x.replace(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g, (a, c1, n1, c2, n2) => `<mergeCell ref="${c1}${desloca(nome, Number(n1))}:${c2}${desloca(nome, Number(n2))}"/>`);
      x = x.replace(/<dimension ref="([^"]+)"\/>/, (a, ref) => `<dimension ref="${refDeslocada(ref, nome)}"/>`);

      // 3. As cópias, logo a seguir a cada linha modelo (já deslocada).
      for (const ins of insercoes[nome]) {
        const original = linhasModelo[ins.depoisDe];
        if (!original) continue;
        const posModelo = desloca(nome, ins.depoisDe);
        let novas = '';
        for (let i = 1; i <= ins.k; i++) {
          const nova = copiaDaLinha(original, nome, ins.depoisDe, posModelo + i, i, mestras, modelos, desloca);
          novas += ins.estA && ins.estA.size ? trocarEstilo(nova, i % 2 === 1 ? ins.estA : ins.estB) : nova;
        }
        const reLinha = new RegExp(`(<row r="${posModelo}"(?:[^>]*/>|[^>]*>[\\s\\S]*?</row>))`);
        x = x.replace(reLinha, `$1${novas}`);
        // A última linha da tabela (a que desceu) passa a ter o último número.
        const ultima = desloca(nome, ins.depoisDe + 1);
        x = x.replace(new RegExp(`(<c r="A${ultima}"(?![^>]*t=")[^>]*>)<v>(\\d+)</v>`), (all, ini, v) => `${ini}<v>${Number(v) + ins.k}</v>`);
        // Número ímpar de linhas novas: a última fica com o fundo da B.
        if (ins.k % 2 === 1 && estilos && ins.estB && ins.estUltima && ins.estUltima.size) {
          const comb = new Map();
          ins.estUltima.forEach((sU, col) => { const sB = ins.estB.get(col); comb.set(col, sB != null ? estilos.combinar(sB, sU) : sU); });
          x = x.replace(new RegExp(`<row r="${ultima}"(?:[^>]*/>|[^>]*>[\\s\\S]*?</row>)`), (lin) => trocarEstilo(lin, comb));
        }
      }
    }
    zip.file(caminho, x);

    // 4. Imagens e formas ancoradas na folha (ex.: os emblemas no topo de
    // cada mês da Ficha Assiduidade) descem com as linhas.
    if (cresce) {
      const relsCam = caminho.replace(/worksheets\/(sheet\d+\.xml)$/, 'worksheets/_rels/$1.rels');
      const rels = zip.file(relsCam) ? await zip.file(relsCam).async('string') : '';
      for (const m of rels.matchAll(/<Relationship [^>]*Target="([^"]*drawings\/[^"]+\.xml)"[^>]*\/>/g)) {
        const camDesenho = `xl/${m[1].replace(/^(\.\.\/)+/, '').replace(/^\/?xl\//, '')}`;
        const fd = zip.file(camDesenho);
        if (!fd) continue;
        const d = await fd.async('string');
        // <xdr:row> conta a partir de 0.
        const d2 = d.replace(/(<xdr:(?:from|to)>[\s\S]*?<xdr:row>)(\d+)(<\/xdr:row>)/g, (all, ini, n, fim) => `${ini}${desloca(nome, Number(n) + 1) - 1}${fim}`);
        if (d2 !== d) zip.file(camDesenho, d2);
      }
    }
  }
  if (estilos) estilos.gravar();
}

/* LINHAS ÀS RISCAS (19/11). As tabelas alternam branco e cinzento. As
   cópias levam, coluna a coluna, o estilo da penúltima linha (A) e da
   última antes do ponto (B) alternadamente, a começar pelo da A — como a
   sequência original continuaria. A última linha da tabela (a que desceu,
   com a borda de baixo) fica com a cor que lhe calhar: se o número de
   linhas novas for ímpar, passa a ter o fundo da B com a sua borda (um
   estilo novo, criado em styles.xml). */
const estilosPorColuna = (xmlLinha) => {
  const m = new Map();
  if (!xmlLinha) return m;
  for (const c of xmlLinha.matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>)/g)) m.set(c[1], (c[2].match(/\ss="(\d+)"/) || [])[1] || '0');
  return m;
};
const trocarEstilo = (xmlLinha, estilos) => xmlLinha.replace(/<c r="([A-Z]+)(\d+)"([^>]*?)(\/>|>)/g, (all, col, n, at, fim) => {
  const s = estilos.get(col);
  if (s == null) return all;
  const semS = at.replace(/\ss="\d+"/, '');
  return `<c r="${col}${n}" s="${s}"${semS}${fim}`;
});
async function lerEstilos(zip) {
  const f = zip.file('xl/styles.xml');
  if (!f) return null;
  let xml = await f.async('string');
  const cache = new Map();
  const xfs = () => {
    const m = xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/);
    return m ? [...m[1].matchAll(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)].map(x => x[0]) : [];
  };
  return {
    // O estilo `fundo` com a borda do estilo `borda`.
    combinar(fundo, borda) {
      if (fundo === borda) return fundo;
      const chave = `${fundo}|${borda}`;
      if (cache.has(chave)) return cache.get(chave);
      const lista = xfs();
      const a = lista[Number(fundo)], b = lista[Number(borda)];
      if (!a || !b) return borda;
      const bid = (b.match(/\sborderId="(\d+)"/) || [])[1] || '0';
      const novo = a.replace(/\sborderId="\d+"/, ` borderId="${bid}"`).replace(/\sapplyBorder="\d"/, '').replace(/^<xf\b/, '<xf applyBorder="1"');
      xml = xml.replace(/(<cellXfs\b[^>]*?count=")(\d+)("[^>]*>)([\s\S]*?)(<\/cellXfs>)/, (all, i1, n, i2, dentro, fim) => `${i1}${Number(n) + 1}${i2}${dentro}${novo}${fim}`);
      const id = String(lista.length);
      cache.set(chave, id);
      return id;
    },
    gravar() { zip.file('xl/styles.xml', xml); },
  };
}

/* Uma cópia da linha modelo (XML ORIGINAL) para a linha `destino`. */
function copiaDaLinha(xmlLinha, folha, linhaOriginal, destino, i, mestras, modelos, desloca) {
  // Referências na cópia: à linha modelo de uma inserção -> a cópia n.º i
  // dessa inserção; outras relativas -> deslocadas e mais i; absolutas ->
  // só deslocadas.
  const mapearCopia = (f, n, abs) => {
    const mods = modelos[f];
    if (mods && mods.has(n)) return mods.get(n) + i;
    return desloca(f, n) + (abs ? 0 : i);
  };
  let x = xmlLinha.replace(/^<row r="\d+"/, `<row r="${destino}"`);
  x = x.replace(/<c r="([A-Z]+)\d+"([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g, (all, col, at, fim, dentro) => {
    if (fim === '/>') return `<c r="${col}${destino}"${at}/>`;
    let corpo = dentro;
    const mf = corpo.match(/<f([^>]*)>([^<]*)<\/f>|<f([^>]*)\/>/);
    if (mf) {
      const atF = mf[1] != null ? mf[1] : mf[3];
      let txt = mf[2] != null ? desescapar(mf[2]) : '';
      const si = (atF.match(/\bsi="(\d+)"/) || [])[1];
      if (/t="shared"/.test(atF) && !txt && si != null && mestras[si]) {
        // Dependente: a fórmula da mestra, trazida para esta célula.
        const ms = mestras[si];
        const dr = linhaOriginal - ms.lin, dc = colNum(col) - ms.col;
        txt = reescreverReferencias(ms.txt, folha, (f, n, abs) => (abs ? n : n + dr), (c, abs) => (abs ? c : colLetras(colNum(c) + dc)));
      }
      const novo = txt ? `<f>${escapar(reescreverReferencias(txt, folha, mapearCopia))}</f>` : '';
      corpo = corpo.replace(mf[0], novo);
    } else if (col === 'A' && !/t="/.test(at)) {
      // O número do atleta (1, 2, 3…) continua a contar.
      corpo = corpo.replace(/<v>(\d+)<\/v>/, (a, v) => `<v>${Number(v) + i}</v>`);
    }
    return `<c r="${col}${destino}"${at}>${corpo}</c>`;
  });
  return x;
}

/* { nomeDaFolha: caminhoXml } a partir do workbook. */
export async function folhasPorNome(zip) {
  const wb = await zip.file('xl/workbook.xml').async('string');
  const rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const out = {};
  for (const [tag] of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const nome = (tag.match(/name="([^"]*)"/) || [])[1];
    const rid = (tag.match(/r:id="([^"]*)"/) || [])[1];
    if (!nome || !rid) continue;
    const m = rels.match(new RegExp(`<Relationship [^>]*Id="${rid}"[^>]*Target="([^"]+)"|<Relationship [^>]*Target="([^"]+)"[^>]*Id="${rid}"`));
    if (!m) continue;
    const alvo = (m[1] || m[2]).replace(/^\/?xl\//, '').replace(/^\//, '');
    out[desescapar(nome)] = `xl/${alvo}`;
  }
  return out;
}

/* Garante linhas para `nJogadores` em todas as tabelas de atletas do livro
   (folhas de relatório, quadros da ESTATÍSTICA TOTAL e meses da Ficha
   Assiduidade). Cada tabela reconhece-se pela coluna A numerada 1, 2, 3…:
   a capacidade é o último número (30 no modelo) e as linhas novas entram
   antes da última, copiando a penúltima. Devolve quantas se acrescentaram
   em cada tabela (0 se já chegavam). */
export async function garantirLinhasDeJogadores(zip, nJogadores) {
  const folhas = await folhasPorNome(zip);
  const pedidos = [];
  let capacidade = null;
  for (const [nome, caminho] of Object.entries(folhas)) {
    if (!/^(Relat[óo]rio|ESTAT[ÍI]STICA TOTAL|Ficha Assiduidade)/i.test(nome)) continue;
    const f = zip.file(caminho);
    if (!f) continue;
    const x = await f.async('string');
    // Números (constantes) na coluna A, por linha.
    const nums = new Map();
    for (const m of x.matchAll(/<c r="A(\d+)"([^>]*?)>(?:(?!<\/c>)[\s\S])*?<v>(\d+)<\/v>(?:(?!<\/c>)[\s\S])*?<\/c>/g)) {
      if (/t="/.test(m[2])) continue;
      if (/<f[ >]/.test(m[0])) continue;
      nums.set(Number(m[1]), Number(m[3]));
    }
    // O fim de cada tabela: uma linha com N seguida de uma com N+1, que é
    // o maior da sequência (a seguinte já não é N+2), com N+1 >= 20.
    for (const [linha, v] of nums) {
      if (nums.get(linha + 1) === v + 1 && nums.get(linha + 2) !== v + 2 && v + 1 >= 20 && nums.get(linha - 1) === v - 1) {
        const cap = v + 1;
        capacidade = capacidade == null ? cap : Math.min(capacidade, cap);
        pedidos.push({ folha: nome, depoisDe: linha, cap });
      }
    }
  }
  if (!pedidos.length) return 0;
  const k = Math.max(0, nJogadores - Math.min(...pedidos.map(p => p.cap)));
  if (!k) return 0;
  await inserirLinhasNoLivro(zip, folhas, pedidos.map(p => ({ folha: p.folha, depoisDe: p.depoisDe, k: Math.max(0, nJogadores - p.cap) })));
  return k;
}
