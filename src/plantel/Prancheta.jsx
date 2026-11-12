// plantel/Prancheta.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { useArrastarParaTrocar } from '../base/arrastar';
import { T, T_ESCURO } from '../base/tema';
import { ASPECT_CAMPO_PRINT, MarcacoesCampoPrint, posCampoPrint } from '../tatico/impressaoCampo';
import { useState } from 'react';
import { distribuirPlantel, TATICA_OMISSAO, TATICAS } from '../tatico/prancheta';
import { Select, Btn } from '../base/ui';
import { RefreshCw } from 'lucide-react';

/* O quadro desenhado. `aoTocar` transforma-o em editável: sem ele é só
   para ler, que é o que a folha impressa precisa. */
export function PrancheteDoPlantel({ lugares, aoTocar, aoArrastar, selecionado, escala = 1, maxLargura = 640, tela = false }) {
  const editavel = typeof aoTocar === 'function';
  const arrasto = useArrastarParaTrocar((origemChave, destinoLugarId) => {
    if (aoArrastar) aoArrastar(origemChave, destinoLugarId);
  });
  if (!lugares || !lugares.length) return null;
  // `escuro` decide as CORES (tema da app vs folha impressa); `editavel`
  // continua a decidir só a interatividade (cliques, contorno de seleção).
  // Um quadro só de consulta no ECRÃ (nem editável nem impresso) tem de
  // ficar escuro na mesma — só a folha em papel é que precisa de fundo
  // branco.
  const escuro = editavel || tela;

  /* QUANTO MAIS GENTE NUM LUGAR SÓ, MAIS PEQUENA A LETRA DE TODOS.

     Um lugar como o DC ou o GR fica perto de outro (o campo tem pouco
     espaço vertical entre eles); com o titular e mais dois ou três
     convidados à experiência empilhados, a lista cresce mais depressa
     do que a distância até ao lugar vizinho e passa a ESCREVER-SE POR
     CIMA dele — foi o que aconteceu com muitos "exp" na mesma zona.

     Reduzir SÓ QUANDO É PRECISO — pelo lugar mais cheio do quadro
     inteiro — mantém a letra normal (a mais legível) num quadro comum,
     e só encolhe quando mesmo é preciso caber mais nomes na mesma
     zona. */
  const maisCheio = Math.max(1, ...lugares.map(l => (l.lista || []).length));
  const fatorNomes = maisCheio <= 2 ? 1 : maisCheio === 3 ? 0.8 : maisCheio === 4 ? 0.72 : maisCheio === 5 ? 0.64 : 0.58;
  const alturaLinha = 1.45 - (1 - fatorNomes) * 0.5;

  /* O GR VOLTA PARA DENTRO DO CAMPO.

     Em TODAS as formações o GR fica a meio da altura (fy≈0,50), perto do
     central mais próximo (que também tem sempre um lugar a essa mesma
     altura). Tirar o GR para uma faixa à parte, fora do retângulo verde,
     resolvia a sobreposição mas deixava-o com ar de "esqueceram-se dele
     ali fora" — um guarda-redes não é uma legenda à parte, é alguém que
     joga dentro do campo, colado à própria baliza.

     Fica então dentro, mas ajustado para colidir o menos possível com o
     central: mais junto à linha de fundo (`GR_FX`, mais perto de 0 do
     que o resto) e com uma caixa mais ESTREITA do que os outros lugares
     (raramente tem mais do que um ou dois guarda-redes, não precisa dos
     mesmos 17%). Os centrais também abrem um pouco mais para a lateral
     (ver TATICAS) — os dois ajustes juntos dão a maior folga possível
     sem inventar posições que não existem numa formação a sério. */
  // Na folha impressa a letra é maior (escala): com 10% o nome do GR
  // saía cortado ("Fon…"). Mais largo só no papel.
  const GR_LARGURA = escuro ? '10%' : '16%';
  /* CONTORNO DA LETRA em vez de caixa por trás: os nomes leem-se por cima
     das linhas do campo sem as apagar (antes, um lugar com 3+ nomes tinha
     um retângulo branco que tapava a grande área e o meio-campo).
     text-shadow imprime-se mesmo com os gráficos de fundo desligados. */
  const halo = escuro ? '#1E3A24' : '#fff';
  const contornoLetra = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
    .map(([x, y]) => `${x}px ${y}px 0 ${halo}`).join(', ') + `, 0 0 3px ${halo}`;

  const corDoTexto = escuro ? '#fff' : T.corEquipa;
  // O CÍRCULO TEM SEMPRE O MESMO TAMANHO, em qualquer sítio da app —
  // não acompanha `escala`. Antes acompanhava, e a mesma bola saía
  // visivelmente maior na folha do Plantel (escala 1.35) do que na do
  // Adversário (escala 1), sem nenhuma razão para serem diferentes: é
  // sempre a mesma sigla de duas letras, só o texto por baixo (os
  // nomes) é que precisa de `escala` para se ler de pé, no campo.
  const tagStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
    width: 20, height: 20, borderRadius: '50%',
    // No ecrã fica preenchido, como sempre. Na folha impressa a maior
    // parte dos telemóveis/impressoras não imprime cor de fundo por
    // omissão ("imprimir gráficos de fundo" desligado) — e um rótulo
    // branco sobre fundo branco desaparece por completo. Por isso,
    // impresso, é uma cor de tinta a sério (contorno + texto), que se
    // vê com ou sem cor de fundo.
    background: escuro ? T.corEquipa : 'transparent',
    border: escuro ? 'none' : `1px solid ${T.corEquipa}`,
    color: corDoTexto, fontSize: 7, fontWeight: 700, letterSpacing: '.01em',
  };
  const nomeStyle = (on) => ({
    /* O tamanho base é o do ECRÃ. A folha impressa passa uma `escala`
       maior — é lá que se lê de pé, no campo, e 8,5 px em papel não se
       lê sentado. Ter um tamanho só para os dois era o erro.
       `fatorNomes` encolhe os DOIS por igual quando o quadro fica
       cheio — ver comentário no topo da função. */
    fontSize: 8.5 * escala * fatorNomes, lineHeight: alturaLinha, fontWeight: 500,
    color: escuro ? (on ? '#0d140e' : T_ESCURO.cream) : '#111',
    background: on ? T.goldFundo : 'transparent',
    textShadow: on ? 'none' : contornoLetra,
    borderRadius: 3, padding: '0 3px', cursor: editavel ? 'pointer' : 'default',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  });

  const conteudoDoLugar = (l, nomesPorCima) => (
    <>
      <div style={{ ...tagStyle, background: escuro ? T.corEquipa : '#fff' }}>{l.rotulo}</div>
      <div style={nomesPorCima ? { marginBottom: 2 } : { marginTop: 2 }}>
        {l.lista.map(j => (
          <div
            key={j.chave}
            onPointerDown={editavel ? arrasto.onPointerDown(j.chave) : undefined}
            onClick={editavel ? (e) => {
              e.stopPropagation();
              /* Com um jogador já escolhido, tocar aqui — mesmo em cima
                 de outro nome, não no fundo vazio — conta como "mover
                 para ESTE lugar", nunca como "escolher este outro nome".
                 Sem isto, um lugar cheio (2-3 nomes empilhados, comum em
                 ecrãs pequenos) tornava quase impossível acertar no
                 fundo vazio, e o toque acabava a trocar de escolhido em
                 vez de mover, sem aviso nenhum de que a mudança não
                 tinha acontecido. */
              if (selecionado && selecionado !== j.chave) aoTocar({ tipo: 'lugar', id: l.id });
              else aoTocar({ tipo: 'jogador', chave: j.chave });
            } : undefined}
            style={{ ...nomeStyle(selecionado === j.chave), touchAction: editavel ? 'none' : undefined, ...(editavel ? arrasto.estiloArrasto(j.chave) : {}) }}
          >
            {j.numero ? <span style={{ color: '#E84A5F', fontWeight: 800, marginRight: '0.25em' }}>{j.numero}</span> : null}{j.nome}{j.exp ? <span style={{ opacity: 0.6 }}> exp</span> : null}
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div
      ref={arrasto.containerRef}
      onPointerMove={editavel ? arrasto.onPointerMove : undefined}
      onPointerUp={editavel ? arrasto.onPointerUp : undefined}
      onPointerCancel={editavel ? arrasto.onPointerCancel : undefined}
      onClickCapture={editavel ? arrasto.onClickCapture : undefined}
      style={{
      position: 'relative', width: '100%', maxWidth: maxLargura, aspectRatio: ASPECT_CAMPO_PRINT,
      background: escuro ? '#1E3A24' : '#fff', margin: '0 auto',
      borderRadius: escuro ? 10 : 0, border: escuro ? `1px solid ${T.line}` : 'none',
    }}>
      <MarcacoesCampoPrint
        traco={escuro ? '#ffffff40' : '#999'}
        baliza={escuro ? '#ffffff66' : '#666'}
      />
      {lugares.map(l => {
        const eGR = l.id === 'GR';
        const [fxT, fyT] = l.ponto;
        /* AJUSTES SÓ DE DESENHO (a tática guardada não muda):
           - nenhuma bola fica em cima das linhas laterais (folga de ~7%);
           - os centrais afastam-se um pouco do GR (e o GR encosta um nada
             à baliza), para os nomes do central não tocarem na bola do GR. */
        const fy = Math.min(0.935, Math.max(0.075, fyT));
        const fx = eGR ? Math.min(fxT, 0.04) : (fxT < 0.2 ? fxT + 0.01 : fxT);
        /* ÂNCORA QUE MUDA PERTO DAS EXTREMIDADES.
           Um lugar como "DE" ou "EE" fica perto do topo/fundo do campo;
           quando lá caem vários jogadores (titular + convidados à
           experiência, por exemplo), o bloco de nomes cresce e, se
           ficar sempre centrado no ponto, metade dele empurra para FORA
           do campo. Perto de uma margem, ancora-se pelo lado de DENTRO
           (o bloco cresce para o centro do campo, nunca para fora); no
           resto do campo mantém-se centrado, como sempre foi. */
        /* A BOLA FICA SEMPRE NO PONTO DA POSIÇÃO, tenha 1 ou 4 nomes: o
           centro da bola é o ponto (translate de metade da bola, 10 px +
           2 px de margem), e os nomes crescem a partir dela. Antes era o
           bloco inteiro (bola + nomes) que se centrava no ponto, por isso
           a bola subia ou descia conforme o número de nomes.
           Junto ao fundo do campo (DD, ED…), os nomes ficam POR CIMA da
           bola, para não saírem do campo. */
        const nomesPorCima = fy > 0.8;
        const deslocY = nomesPorCima ? 'calc(-100% + 12px)' : '-12px';
        return (
          <div
            key={l.id}
            data-slot={l.id}
            onClick={editavel ? () => aoTocar({ tipo: 'lugar', id: l.id }) : undefined}
            style={{
              position: 'absolute', ...posCampoPrint(fx, fy), zIndex: eGR ? 1 : l.lista.length,
              transform: `translate(-50%, ${deslocY})`, textAlign: 'center',
              display: 'flex', flexDirection: nomesPorCima ? 'column-reverse' : 'column', alignItems: 'center',
              // Largura pelo CONTEÚDO, não uma fatia fixa do campo — um
              // lugar com um ou dois nomes curtos não precisa dos mesmos
              // 17% que um lugar cheio, e essa largura a mais era o que
              // apagava marcações do campo que calhassem por baixo (a
              // grande área, um arco de canto), mesmo sem texto nenhum
              // ali para proteger.
              width: 'max-content', maxWidth: eGR ? GR_LARGURA : '22%',
              cursor: editavel && selecionado ? 'pointer' : 'default',
              // Enquanto há alguém escolhido, os lugares acendem-se: sem
              // isso não se percebe que se pode tocar neles.
              outline: editavel && selecionado ? `1px dashed ${T.gold}88` : 'none',
              outlineOffset: 4, borderRadius: 6, padding: '2px 4px', boxSizing: 'border-box',
              /* Um fundo (quase) sólido só no lugar mais cheio evita que,
                 mesmo depois de tudo isto, um resto de transbordo de um
                 lugar vizinho se leia por cima deste. */
              background: 'transparent',
              ...(editavel ? arrasto.estiloAlvo(l.id) : {}),
            }}
          >
            {conteudoDoLugar(l, nomesPorCima)}
          </div>
        );
      })}
    </div>
  );
}

/* O editor: toca-se num nome para o escolher, toca-se num lugar para o
   mover. Escolhi tocar e não arrastar de propósito — arrastar num
   telemóvel, dentro de uma janela que já faz scroll, é uma luta; e com
   nomes de 8 px o alvo é pequeno de mais para o dedo.

   Só o que se move fica guardado. */
export function EditorPrancheta({ players, attendance, convidados, overrides, tatica, onChange, onTatica, titulo = 'Quadro de posições' }) {
  const [escolhido, setEscolhido] = useState(null);
  const lugares = distribuirPlantel({ players, attendance, convidados, overrides, tatica });

  const tocar = (alvo) => {
    if (alvo.tipo === 'jogador') {
      setEscolhido(prev => (prev === alvo.chave ? null : alvo.chave));
      return;
    }
    if (!escolhido) return;
    onChange({ ...(overrides || {}), [escolhido]: alvo.id });
    setEscolhido(null);
  };

  const mexidos = Object.keys(overrides || {}).length;

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          {titulo}
        </span>
        {/* Trocar de táctica muda os lugares, não quem está presente. O
            que arrumaste à mão mantém-se sempre que o lugar continuar a
            existir na táctica nova. */}
        <div style={{ width: 130, marginLeft: 'auto' }}>
          <Select value={tatica || TATICA_OMISSAO} onChange={e => onTatica(e.target.value)}>
            {Object.keys(TATICAS).map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
      </div>
      <PrancheteDoPlantel
        lugares={lugares} aoTocar={tocar} selecionado={escolhido} escala={1.25}
        aoArrastar={(chave, lugarId) => onChange({ ...(overrides || {}), [chave]: lugarId })}
      />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
        <span style={{ fontSize: 11.5, color: T.mutedDim, flex: 1, minWidth: 180, lineHeight: 1.6 }}>
          {escolhido
            ? 'Agora toca no lugar para onde o queres mover.'
            : 'Toca num nome para o escolher e depois no lugar onde o queres. Só o que moveres fica guardado — o resto acompanha as presenças.'}
        </span>
        {mexidos > 0 && (
          <Btn variant="ghost" onClick={() => { onChange({}); setEscolhido(null); }}>
            <RefreshCw size={14} /> Repor ({mexidos})
          </Btn>
        )}
      </div>
    </div>
  );
}

/* Botões pequenos por baixo da ação principal do cabeçalho (Dossier,
   Portal, Exportar CSV): todos com o mesmo tamanho, em todas as páginas. */
// 26 px: cabem no espaço por baixo do cabeçalho, com folga até à linha
// seguinte (os Momentos na Ideia de Jogo, os separadores no Scouting).
export const ESTILO_BOTAO_PEQUENO = { padding: '0 12px', height: 26, fontSize: 12.5, gap: 6, borderRadius: 6, whiteSpace: 'nowrap', lineHeight: 1 };

export const ICONE_BOTAO_PEQUENO = 14;

