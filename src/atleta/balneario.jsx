// atleta/balneario.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.

export function pkhEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* Balneário em perspetiva (um só ponto de fuga), desenhado como texto SVG:
   é uma cena estática, recalculada só quando mudam a cor, a camisola, a
   fotografia ou o emblema. Todo o texto que vem de dados passa por pkhEsc. */
/* W = largura do desenho (altura fixa 215). 300 no telemóvel; em ecrã largo
   a sala alarga-se (paredes mais compridas, mais cacifos), em vez de se
   cortar o desenho. */
export function pkhBalneario({ cor, numero, nome, foto, iniciais, logo, inicialClube, badge, boasVindas, apagado }, W = 300, H = 215, tv = null) {
  // H > 215 quando o espaço é mais alto do que o desenho: a sala estica na
  // vertical (em vez de se cortar dos lados) e a TV fica sempre ao centro.
  const VX = W / 2, VY = (95 * H) / 215, S = 0.5, BL = VX * S, BR = W - VX * S, BT = VY * S, BB = H - (H - VY) * S;
  const kW = W / 300;
  const yE = ((VY * S) * 22) / 47.5; // altura do emblema no teto (22 no desenho base)
  const wp = (t, v) => { const x = t * BL, yt = t * BT, yb = H - t * (H - BB); return [x, yt + v * (yb - yt)]; };
  const mir = p => [W - p[0], p[1]];
  const pts = ps => ps.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const poly = (ps, f, st, sw) => `<polygon points="${pts(ps)}" fill="${f}"${st ? ` stroke="${st}" stroke-width="${sw || 0.8}"` : ''}/>`;
  const aff = (p00, p10, p01, inner) => `<g transform="matrix(${((p10[0] - p00[0]) / 100).toFixed(4)},${((p10[1] - p00[1]) / 100).toFixed(4)},${((p01[0] - p00[0]) / 100).toFixed(4)},${((p01[1] - p00[1]) / 100).toFixed(4)},${p00[0].toFixed(2)},${p00[1].toFixed(2)})">${inner}</g>`;
  const camisolaParede = n => `<line x1="50" y1="0" x2="50" y2="10" stroke="#9aa39c" stroke-width="2"/><path d="M14 22 L38 10 Q50 20 62 10 L86 22 L98 44 L78 50 L78 98 L22 98 L22 50 L2 44 Z" fill="${cor.base}" stroke="#0d120f" stroke-width="2"/><text x="50" y="80" text-anchor="middle" font-size="34" font-weight="700" fill="${cor.texto}" font-family="JetBrains Mono, monospace">${n}</text>`;
  const quadro = k => {
    let s = `<rect x="0" y="0" width="100" height="100" fill="#9c7f22"/><rect x="7" y="7" width="86" height="86" fill="${k === 1 ? '#26334a' : '#33503c'}"/>`;
    if (k === 0) s += '<path d="M34 24 H66 V44 Q66 62 50 64 Q34 62 34 44 Z" fill="#C9A43A"/><path d="M34 30 Q20 30 24 44 Q28 52 36 50" fill="none" stroke="#C9A43A" stroke-width="5"/><path d="M66 30 Q80 30 76 44 Q72 52 64 50" fill="none" stroke="#C9A43A" stroke-width="5"/><rect x="45" y="64" width="10" height="12" fill="#C9A43A"/><rect x="34" y="76" width="32" height="9" fill="#7a5f14"/>';
    else if (k === 1) s += [20, 50, 80].map(x => `<circle cx="${x}" cy="40" r="8" fill="#cfc2aa"/><path d="M${x - 10} 88 V56 H${x + 10} V88 Z" fill="${cor.base}"/><line x1="${x - 9}" y1="58" x2="${x - 18}" y2="26" stroke="#cfc2aa" stroke-width="5"/><line x1="${x + 9}" y1="58" x2="${x + 18}" y2="26" stroke="#cfc2aa" stroke-width="5"/>`).join('');
    else s += [18, 38, 58, 78].map((x, i) => `<circle cx="${x}" cy="${52 - (i % 2) * 6}" r="7" fill="#cfc2aa"/><rect x="${x - 9}" y="${60 - (i % 2) * 6}" width="18" height="34" fill="${cor.base}"/>`).join('') + '<path d="M38 18 L50 30 L62 18" fill="none" stroke="#C9A43A" stroke-width="4"/>';
    return s;
  };
  const nomeCamisola = pkhEsc(String(nome || '').toUpperCase());
  const camisolaFrente = (() => {
    const fNome = nomeCamisola.length > 9 ? 9 : nomeCamisola.length > 6 ? 11 : 13;
    // Sem cruzeta: a camisola fica logo por baixo da fotografia.
    let s = `<path d="M16 10 L38 0 Q50 10 62 0 L84 10 L100 38 L80 46 L80 104 Q50 108 20 104 L20 46 L0 38 Z" fill="${cor.base}" stroke="#FFD86A" stroke-width="2.5"/>`
      + `<path d="M38 0 Q50 10 62 0" fill="none" stroke="${cor.mangas}" stroke-width="3"/>`
      + `<path d="M0 38 L20 46 M100 38 L80 46" stroke="${cor.mangas}" stroke-width="3"/>`;
    if (numero) {
      s += `<text x="50" y="30" text-anchor="middle" font-size="${fNome}" font-weight="600" fill="${cor.texto}" font-family="Oswald, sans-serif" letter-spacing="1.5">${nomeCamisola}</text>`
        + `<text x="50" y="86" text-anchor="middle" font-size="${numero.length > 2 ? 40 : 54}" font-weight="700" fill="${cor.texto}" stroke="${cor.contorno}" stroke-width="2.5" paint-order="stroke" font-family="Oswald, sans-serif">${pkhEsc(numero)}</text>`;
    } else {
      s += `<text x="50" y="66" text-anchor="middle" font-size="${fNome + 4}" font-weight="600" fill="${cor.texto}" stroke="${cor.contorno}" stroke-width="1.5" paint-order="stroke" font-family="Oswald, sans-serif" letter-spacing="1.5">${nomeCamisola}</text>`;
    }
    return s;
  })();

  let s = '<defs><filter id="pkh-brilho" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.5"/></filter>'
    + '<filter id="pkh-brilho2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>'
    + '<clipPath id="pkh-retrato"><circle cx="0" cy="0" r="50"/></clipPath>'
    + '<clipPath id="pkh-tk"><rect x="91" y="106" width="118" height="11"/></clipPath></defs>';
  // ======== EVOLUÇÃO: balneário de clube moderno ========
  /* BALNEÁRIO "ESCURO PREMIUM": fitas LED douradas no teto, cúpula do
     emblema iluminada a dourado, cacifos da parede direita como nichos com
     luz quente (camisola da equipa + chuteiras), faixa LED por cima,
     assentos estofados com uma risca da cor da equipa e chão em madeira
     escura. Na parede da esquerda está só o cacifo do jogador, largo e com
     luz dourada, com a camisola pendurada numa cruzeta e a foto por cima. */
  const Tm = {
    teto: ['#0b0d0c', '#121614'], chao: ['#151917', '#1d2320'], paredeE: '#171c19', paredeD: '#151a17', fundo: '#1a201c',
    nicho: ['#3a3020', '#2a241a', '#17140f'], cupula: ['#FFE9A8', '#C9A227'], cupulaBorda: '#7a5f14',
    led: '#FFD86A', ledBrilho: '#FFC23D', moldura: '#0b0e0c', assento: '#3a2c1e', assentoFrente: '#22190f', chaoTipo: 'madeira',
  };
  if (apagado) Object.assign(Tm, {
    teto: ['#060807', '#0a0c0b'], chao: ['#0a0c0b', '#0f1210'], paredeE: '#0c0f0d', paredeD: '#0b0e0c', fundo: '#0e1210',
    nicho: ['#14120d', '#0f0e0a', '#090806'], cupula: ['#2a2516', '#16130c'], cupulaBorda: '#2f2814',
    led: apagado === 'presenca' ? '#5a4b22' : '#26221a', ledBrilho: apagado === 'presenca' ? '#7a6224' : 'rgba(0,0,0,0)', moldura: '#060807', assento: '#1a140e', assentoFrente: '#100c08',
  });
  const U = String(cor.base).replace(/[^a-z0-9]/gi, '') + (apagado ? 'x' + apagado : '');
  s += '<defs>'
    + `<linearGradient id="ev-teto${U}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${Tm.teto[0]}"/><stop offset="1" stop-color="${Tm.teto[1]}"/></linearGradient>`
    + `<linearGradient id="ev-chao${U}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${Tm.chao[0]}"/><stop offset="1" stop-color="${Tm.chao[1]}"/></linearGradient>`
    + `<linearGradient id="ev-nicho${U}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${Tm.nicho[0]}"/><stop offset=".6" stop-color="${Tm.nicho[1]}"/><stop offset="1" stop-color="${Tm.nicho[2]}"/></linearGradient>`
    + `<linearGradient id="ev-nichoJ${U}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${apagado ? (apagado === 'presenca' ? '#4a3f22' : '#221e14') : '#FFF6DA'}"/><stop offset=".6" stop-color="${apagado ? (apagado === 'presenca' ? '#3a3119' : '#1a170f') : '#F3D98C'}"/><stop offset="1" stop-color="${apagado ? '#14110b' : '#b8973c'}"/></linearGradient>`
    + `<radialGradient id="ev-cupula${U}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${Tm.cupula[0]}"/><stop offset=".7" stop-color="${Tm.cupula[1]}"/><stop offset="1" stop-color="${Tm.cupulaBorda === 'equipa' ? cor.base : Tm.cupulaBorda}"/></radialGradient>`
    + `<filter id="ev-led${U}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.8"/></filter>`
    + '</defs>';
  s += `<rect width="${W}" height="${H}" fill="#121614"/>`;
  // teto, paredes e chão
  s += poly([[0, 0], [W, 0], [BR, BT], [BL, BT]], `url(#ev-teto${U})`);
  s += poly([[0, 0], [BL, BT], [BL, BB], [0, H]], Tm.paredeE);
  s += poly([[W, 0], [BR, BT], [BR, BB], [W, H]], Tm.paredeD);
  s += poly([[0, H], [W, H], [BR, BB], [BL, BB]], `url(#ev-chao${U})`);
  if (Tm.chaoTipo === 'relva') {
    const nf = 8; for (let k = 0; k < nf; k++) { const x0 = k * W / nf, x1 = (k + 1) * W / nf; const p = (x, t) => [x + (VX + (x - VX) * S - x) * t, H - t * (H - BB)];
      if (k % 2) s += poly([p(x0, 0), p(x1, 0), p(x1, 1), p(x0, 1)], '#000', null).replace('fill="#000"', 'fill="#000" opacity=".12"'); }
  }
  if (Tm.chaoTipo === 'madeira') {
    [-150, -90, -30, 30, 90, 150, 210, 270, 330, 390, 450].map(x => VX + (x - 150) * kW).forEach(x => { s += `<line x1="${x}" y1="${H}" x2="${x + (VX - x) * S}" y2="${BB}" stroke="#000" stroke-opacity=".18" stroke-width=".8"/>`; });
  }
  // chão polido: reflexo das fitas do teto e juntas suaves
  [0.33, 0.66].forEach(t => { const y = H - t * (H - BB); s += `<line x1="${t * BL}" y1="${y}" x2="${W - t * BL}" y2="${y}" stroke="#ffffff" stroke-opacity=".05" stroke-width=".8"/>`; });
  [70, 110, 190, 230].map(x => VX + (x - 150) * kW).forEach(x => { s += `<line x1="${x}" y1="${H}" x2="${x + (VX - x) * S}" y2="${BB}" stroke="${Tm.ledBrilho}" stroke-opacity=".10" stroke-width="2.5" filter="url(#ev-led${U})"/>`; });
  // FITAS LED no teto, a convergir para a cúpula (brancas, com brilho)
  [-30, 30, 90, 210, 270, 330].map(x => VX + (x - 150) * kW).forEach(x => {
    const x2 = x + (VX - x) * S;
    s += `<line x1="${x}" y1="0" x2="${x2}" y2="${BT}" stroke="${Tm.ledBrilho}" stroke-width="4" opacity=".45" filter="url(#ev-led${U})"/>`;
    s += `<line x1="${x}" y1="0" x2="${x2}" y2="${BT}" stroke="${Tm.led}" stroke-width="1.4"/>`; });
  // fita LED a toda a volta da parede de fundo
  s += `<rect x="${BL}" y="${BT}" width="${BR - BL}" height="${BB - BT}" fill="${Tm.fundo}"/>`;
  s += `<line x1="${BL}" y1="${BT + 1}" x2="${BR}" y2="${BT + 1}" stroke="${Tm.led}" stroke-width="1.6"/>`;
  // CÚPULA iluminada com o emblema
  const rxE = Math.min(78 * kW, 112);
  s += `<ellipse cx="${VX}" cy="${yE.toFixed(1)}" rx="${rxE * 1.25}" ry="19" fill="${Tm.ledBrilho}" opacity=".25" filter="url(#pkh-brilho2)"/>`;
  s += `<ellipse cx="${VX}" cy="${yE.toFixed(1)}" rx="${rxE}" ry="15" fill="url(#ev-cupula${U})" stroke="${Tm.led}" stroke-width="1.5"/>`;
  s += logo
    ? `<g transform="translate(${VX},${yE.toFixed(1)}) scale(1.7,.62)"><image href="${pkhEsc(logo)}" x="-14" y="-15" width="28" height="30" preserveAspectRatio="xMidYMid meet"/></g>`
    : `<g transform="translate(${VX},${yE.toFixed(1)}) scale(1.7,.62)"><path d="M-10 -12 H10 V2 Q10 11 0 16 Q-10 11 -10 2 Z" fill="${cor.base}" stroke="#C9A227" stroke-width="1.4"/><text y="5" text-anchor="middle" font-size="11" font-weight="700" fill="${cor.texto}" font-family="Oswald, sans-serif">${pkhEsc(inicialClube)}</text></g>`;
  // CACIFOS nas duas paredes: nichos com luz branca por trás, camisola de
  // frente (em perspetiva) com o número, faixa LED por cima, chuteiras em baixo.
  const T6 = [0.0, 0.3, 0.5, 0.65, 0.77, 0.87, 0.95];
  // parede da esquerda: o cacifo do jogador é largo (está mais perto) e vêm depois três colegas
  const T6L = [0.0, 0.56];
  const decor = ['11', '7', '6', '3', '14', '10', '4', '23', '9', '2', '5', '17'].filter(n => n !== String(numero || ''));
  let nd = 0;
  const camisolaN = n => `<path d="M14 22 L38 10 Q50 20 62 10 L86 22 L98 44 L78 50 L78 98 L22 98 L22 50 L2 44 Z" fill="${cor.base}" stroke="${cor.contorno}" stroke-width="2"/><path d="M38 10 Q50 20 62 10" fill="none" stroke="${cor.mangas}" stroke-width="3"/><text x="50" y="80" text-anchor="middle" font-size="34" font-weight="700" fill="${cor.texto}" font-family="Oswald, sans-serif">${n}</text>`;
  const chuteira = '<path d="M0 10 Q2 2 10 2 L20 4 Q30 6 32 12 L32 14 L0 14 Z" fill="#0d0f0e"/><path d="M6 4 L18 5" stroke="#C9A227" stroke-width="2"/>';
  [false, true].forEach(dir => {
    const M = dir ? mir : (p => p);
    const rel = (a, b, v) => M(wp(a, v));
    // faixa LED por cima dos cacifos
    s += `<polygon points="${pts([wp(0, 0.06), wp(1, 0.06), wp(1, 0.085), wp(0, 0.085)].map(M))}" fill="${Tm.led}" opacity=".9"/>`;
    s += `<polygon points="${pts([wp(0, 0.05), wp(1, 0.05), wp(1, 0.1), wp(0, 0.1)].map(M))}" fill="${Tm.ledBrilho}" opacity=".35" filter="url(#ev-led${U})"/>`;
    const TT = dir ? T6 : T6L;
    for (let i = 0; i < TT.length - 1; i++) {
      const meu = !dir && i === 0;
      const a = TT[i] + 0.015, b = TT[i + 1] - 0.015;
      // moldura escura do cacifo
      s += poly([wp(a - 0.01, 0.11), wp(b + 0.01, 0.11), wp(b + 0.01, 0.74), wp(a - 0.01, 0.74)].map(M), Tm.moldura);
      // nicho iluminado
      const n4 = [wp(a, 0.13), wp(b, 0.13), wp(b, 0.62), wp(a, 0.62)].map(M);
      if (meu) s += `<polygon points="${pts(n4)}" fill="none" stroke="#FFC23D" stroke-width="6" opacity="${apagado ? (apagado === 'presenca' ? .18 : 0) : .5}" filter="url(#pkh-brilho)"/>`;
      s += poly(n4, meu ? `url(#ev-nichoJ${U})` : `url(#ev-nicho${U})`, meu ? '#FFD86A' : Tm.led, meu ? 1.8 : 0.9);
      // camisola (os colegas; a do jogador vai à parte, maior)
      if (!meu) {
        const ia = a + (b - a) * 0.14, ib = b - (b - a) * 0.14;
        const p00 = dir ? M(wp(ib, 0.17)) : wp(ia, 0.17), p10 = dir ? M(wp(ia, 0.17)) : wp(ib, 0.17), p01 = dir ? M(wp(ib, 0.56)) : wp(ia, 0.56);
        s += aff(p00, p10, p01, camisolaN(decor[nd++ % decor.length]));
      }
      // chuteiras no fundo do cacifo
      const ca = a + (b - a) * 0.2, cb = b - (b - a) * 0.2;
      const c00 = dir ? M(wp(cb, 0.645)) : wp(ca, 0.645), c10 = dir ? M(wp(ca, 0.645)) : wp(cb, 0.645), c01 = dir ? M(wp(cb, 0.7)) : wp(ca, 0.7);
      s += aff(c00, c10, c01, '<ellipse cx="28" cy="60" rx="22" ry="34" fill="#0b0d0c"/><rect x="14" y="35" width="26" height="9" fill="#C9A227"/><ellipse cx="72" cy="60" rx="22" ry="34" fill="#0b0d0c"/><rect x="60" y="35" width="26" height="9" fill="#C9A227"/>');
    }
    // ASSENTO estofado contínuo à frente dos cacifos (escuro, com risca da cor da equipa)
    const A = M(wp(0, 0.8)), B = M(wp(1, 0.8)), sg = dir ? -1 : 1;
    const A2 = [A[0] + sg * 32, A[1] + 18], B2 = [B[0] + sg * 6, B[1] + 3];
    s += `<polygon points="${pts([A2, B2, [B2[0] + sg * 3, B2[1] + 10], [A2[0] + sg * 12, A2[1] + 30]])}" fill="#000" opacity=".35" filter="url(#pkh-brilho)"/>`;
    s += poly([A, B, B2, A2], Tm.assento);
    s += `<line x1="${((A[0] + A2[0]) / 2).toFixed(1)}" y1="${((A[1] + A2[1]) / 2).toFixed(1)}" x2="${((B[0] + B2[0]) / 2).toFixed(1)}" y2="${((B[1] + B2[1]) / 2).toFixed(1)}" stroke="${cor.base}" stroke-width="2.2"/>`;
    s += poly([A2, B2, [B2[0], B2[1] + 6], [A2[0], A2[1] + 10]], Tm.assentoFrente);
    s += `<line x1="${A2[0].toFixed(1)}" y1="${(A2[1] + 10).toFixed(1)}" x2="${B2[0].toFixed(1)}" y2="${(B2[1] + 6).toFixed(1)}" stroke="${Tm.ledBrilho}" stroke-opacity=".5" stroke-width="1" filter="url(#ev-led${U})"/>`;
  });
  // O lugar do jogador: camisola pendurada de frente + retrato por cima.
  const gancho = wp((T6L[0] + T6L[1]) / 2, 0.40); // = 0.19 no telemóvel, como antes
  const zoom = Math.min(1.25, 1 + (kW - 1) * 0.35); // 1 no telemóvel
  const cx = gancho[0] + 9 * zoom, cy = gancho[1] - 1, ry = gancho[1] - 22 * zoom, rr = 16 * zoom;
  // Telemóveis baixos: a fotografia e a camisola sobem/encolhem para
  // caberem INTEIRAS (nunca se corta a camisola do jogador).
  const eJog = tv && tv.jogador ? tv.jogador : 1;
  const topoJog = ry - rr - 4;
  s += `<g transform="translate(${cx.toFixed(1)},${topoJog.toFixed(1)}) scale(${eJog.toFixed(3)}) translate(${(-cx).toFixed(1)},${(-topoJog).toFixed(1)})">`;
  s += `<ellipse cx="${cx.toFixed(1)}" cy="${(cy + 4).toFixed(1)}" rx="30" ry="52" fill="#FFC23D" opacity="${apagado ? (apagado === 'presenca' ? .1 : 0) : .32}" filter="url(#pkh-brilho2)"/>`;
  s += `<g transform="translate(${(cx - 22 * zoom).toFixed(1)},${cy.toFixed(1)}) scale(${(0.44 * zoom).toFixed(3)})">${camisolaFrente}</g>`;
  s += `<circle cx="${cx.toFixed(1)}" cy="${(ry + 1.5).toFixed(1)}" r="${rr + 3}" fill="#000" opacity=".35"/>`;
  s += `<g transform="translate(${cx.toFixed(1)},${ry.toFixed(1)}) scale(${rr / 50})">`;
  s += foto
    ? `<rect x="-50" y="-50" width="100" height="100" fill="#cfd9d1" clip-path="url(#pkh-retrato)"/><image href="${pkhEsc(foto)}" x="-50" y="-50" width="100" height="100" preserveAspectRatio="xMidYMin slice" clip-path="url(#pkh-retrato)"/>`
    : `<circle r="50" fill="#1A2A1F"/><text y="17" text-anchor="middle" font-size="${iniciais.length > 2 ? 34 : 46}" font-weight="600" fill="#FFD86A" font-family="Oswald, sans-serif">${pkhEsc(iniciais)}</text>`;
  s += '<circle r="50" fill="none" stroke="#FFD86A" stroke-width="7"/></g>';
  s += '</g>';
  if (apagado) s += `<rect x="0" y="0" width="${W}" height="${H}" fill="#000" opacity="${apagado === 'presenca' ? .38 : .5}"/>`;
  if (apagado) {
    // Com as luzes apagadas, a TV do Portal é a única luz: um brilho verde-frio no chão e nas paredes.
    /* Gradiente radial que se desvanece até zero (sem bordas): o desfoque
       antigo deixava uma mancha de contorno visível, sobretudo no
       telemóvel, onde a sala estica na vertical. Mais ténue no telemóvel. */
    const fT = W <= 300 ? 0.8 : 1;
    s += `<defs><radialGradient id="pkh-tvluz${U}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#9fe0bf" stop-opacity="${(0.13 * fT).toFixed(3)}"/><stop offset=".45" stop-color="#9fe0bf" stop-opacity="${(0.05 * fT).toFixed(3)}"/><stop offset="1" stop-color="#9fe0bf" stop-opacity="0"/></radialGradient></defs>`;
    s += `<ellipse cx="${VX}" cy="${(BB + 10).toFixed(1)}" rx="${(W * 0.42).toFixed(1)}" ry="${Math.min((H - BB) * 0.6, 60).toFixed(1)}" fill="url(#pkh-tvluz${U})"/>`;
    s += `<ellipse cx="${VX}" cy="${((BT + BB) / 2).toFixed(1)}" rx="${((BR - BL) * 0.75).toFixed(1)}" ry="${((BB - BT) * 0.75).toFixed(1)}" fill="url(#pkh-tvluz${U})"/>`;
  }
  // A TV da análise = a entrada do Portal.
  // `tv` (telemóveis baixos): a TV sobe e encolhe o necessário para o botão
  // "Entrar no Portal" caber por baixo dela, sem a tapar.
  const tvTopo = tv ? tv.topo : BT + 8 + (H - 215) * 0.25;
  const tvEscala = zoom * (tv ? tv.escala : 1);
  s += `<g transform="translate(${VX - 150},${tvTopo - 46}) translate(150,46) scale(${tvEscala.toFixed(3)}) translate(-150,-46)">`;
  s += '<rect x="84" y="46" width="132" height="78" rx="3" fill="none" stroke="#FFC23D" stroke-width="2" opacity=".8"/>';
  s += '<rect x="88" y="50" width="124" height="70" rx="2" fill="#07090a"/>';
  s += '<rect x="91" y="53" width="118" height="13" fill="#0d120f"/><text x="150" y="63.3" text-anchor="middle" font-size="10" font-weight="600" fill="#C9A227" font-family="Oswald, sans-serif" letter-spacing="1.4">PORTAL DO ATLETA</text>';
  // TV parada: só a tática, sem rodapé a correr nem jogadores a mexer.
  s += '<rect x="91" y="66" width="118" height="51" fill="#24563a"/>';
  [0, 1, 2].forEach(i => { s += `<rect x="${91 + i * 40}" y="66" width="20" height="51" fill="#2a6142"/>`; });
  s += '<g stroke="#fff" stroke-width=".7" fill="none" opacity=".6"><line x1="150" y1="66" x2="150" y2="117"/><circle cx="150" cy="91" r="7"/></g>';
  s += '<path d="M112 96 Q132 80 156 78" fill="none" stroke="#fff" stroke-width="1" stroke-dasharray="3 2"/><path d="M152 75.5 L157 78 L153 81" fill="none" stroke="#fff" stroke-width="1"/>';
  s += '<path d="M128 74 L170 92" fill="none" stroke="#FFC23D" stroke-width="1" stroke-dasharray="3 2"/>';
  s += `<circle cx="112" cy="96" r="3" fill="${cor.base}" stroke="#fff" stroke-width=".7"/><circle cx="128" cy="74" r="3" fill="${cor.base}" stroke="#fff" stroke-width=".7"/>`;
  s += `<circle cx="186" cy="80" r="3" fill="${cor.base}" stroke="#fff" stroke-width=".7"/><circle cx="196" cy="94" r="3" fill="#f2ede0"/><circle cx="178" cy="98" r="3" fill="#f2ede0"/>`;
  // Porta da entrada do Portal: a TV dá as boas-vindas ao jogador.
  if (boasVindas) {
    // Num grupo próprio: na chegada pela porta, a página inicial desvanece-o
    // (classe pkh-boasvindas) para a TV passar suavemente ao Portal do Atleta.
    s += `<g class="pkh-boasvindas">`
      + `<rect x="88" y="50" width="124" height="70" rx="2" fill="#0d1a12"/>`
      + `<rect x="88" y="50" width="124" height="70" rx="2" fill="${cor.base}" opacity=".35"/>`
      + `<text x="150" y="80" text-anchor="middle" font-size="13" font-weight="600" fill="#FFC23D" font-family="Oswald, sans-serif" letter-spacing="3">BEM-VINDO,</text>`
      + `<text x="150" y="104" text-anchor="middle" font-size="${String(boasVindas).length > 9 ? 16 : 22}" font-weight="600" fill="#fff" font-family="Oswald, sans-serif" letter-spacing="2">${pkhEsc(String(boasVindas).toUpperCase())}!</text>`
      + `</g>`;
  }
  if (badge > 0) s += `<circle cx="212" cy="49" r="7" fill="#E5484D" stroke="#07090a" stroke-width="1.5"/><text x="212" y="52.6" text-anchor="middle" font-size="10" font-weight="700" fill="#fff" font-family="JetBrains Mono, monospace">${badge > 9 ? '9+' : badge}</text>`;
  s += '</g>';
  return s;
}

