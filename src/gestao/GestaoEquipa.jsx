// gestao/GestaoEquipa.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { todayStr, fmtDate } from '../base/utilidades';
import { useIsMobile, askConfirm, offerUndo, SectionHeader, Panel, Btn, Input, Field, Select } from '../base/ui';
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { firstNameOf, sortByPosition, shortPlayerName } from '../dominio/jogadores';
import { RODAPE_MENSAGEM_SISTEMA, linkWhatsApp, semEmojis } from '../dominio/mensagens';
import { URL_PUBLICA_APP, fmtMMSS } from '../media/social';
import { staffBioEstado, staffBioDisponivel, staffBioAtivar, staffBioDesativar, staffReporPalavraPasse, FUNCOES_STAFF, BIO_TXT } from '../AuthScreen.jsx';
import JSZip from 'jszip';
import { CHECKIN_CODE_LEN, genPlayerCode } from '../dominio/plantel';
import { T, mono, body } from '../base/tema';
import { Check, Copy, RefreshCw, Fingerprint, MessageCircle, Pencil, Lock, Star, Trash2, LogOut, Play, X, EyeOff, Eye, AlertTriangle, Download } from 'lucide-react';
import { CHAVE_EQUIPA, GENEROS, gravarFuncaoMembro, gravarGeneroMembro, gravarTelefoneMembro, selecionarMembros } from './membros';

/* Seletor no cabeçalho da barra lateral, onde antes estava o nome do
   clube fixo. Com uma equipa só, é texto — não vale a pena um menu para
   uma opção. Com mais, abre a lista.

   Este é o elemento mais perigoso da app: marcar presenças na equipa
   errada é silencioso e plausível. Daí estar sempre visível, e daí a
   equipa ativa aparecer a cheio e não como uma linha entre outras. */
/* Membros, código de convite, sair, e os poderes de quem criou a equipa.
   Não é um separador da navegação — chega-se aqui pelo seletor de
   equipa, que é onde a pergunta "quem mais tem acesso a isto?" nasce. */
/* ================================================================
   DADOS PESSOAIS — EXPORTAR, APAGAR, RETER
   ================================================================

   A app guarda dados de saúde de menores: wellness, RPE e o boletim
   clínico. No RGPD isso é categoria especial (artigo 9.º), e traz três
   obrigações que não se resolvem com boa vontade — têm de existir como
   funcionalidade:

   · PORTABILIDADE — o clube tem de conseguir levar os seus dados embora,
     num formato que outra pessoa consiga ler.
   · ELIMINAÇÃO — apagar tem de apagar mesmo, e não esconder.
   · RETENÇÃO — não se guardam dados para sempre "por via das dúvidas".

   O que isto NÃO é: aconselhamento jurídico. É a parte técnica, que é a
   que eu posso construir. O contrato de subcontratação com cada clube, a
   base legal e a política de privacidade são de um advogado, e são
   necessários antes do primeiro clube que não seja o teu. */

/* Tudo o que a app guarda sobre uma equipa, num ficheiro. Serve para os
   três casos ao mesmo tempo: pedido de portabilidade de um clube, cópia
   de segurança por equipa, e prova do que existia numa data. */
export function exportarDadosDaEquipa({ equipa, season, players, exercises, ideias, sessions, monitoring, matches, scouting, videos, apresentacoes, convocatorias, diario, clinico, desenvolvimento, standings, adversarios, documentos, tarefas, videosOriginais, clipes }) {
  /* Versão 2: passou a levar TAMBÉM as fichas de adversários, os
     documentos, as tarefas/missões e a Análise de Vídeo (os registos dos
     vídeos originais e dos cortes, com desenhos e etiquetas). Os ficheiros
     de vídeo em si ficam no Storage; aqui vão os endereços. */
  const dados = {
    formato: 'misterjp-equipa',
    versao: 2,
    exportadoEm: new Date().toISOString(),
    equipa: { id: equipa.id, nome: equipa.nome, clube: equipa.clube, escalao: equipa.escalao },
    season, players, exercises, ideias, sessions, monitoring, matches,
    scouting, videos, apresentacoes, convocatorias, diario,
    clinico, desenvolvimento, standings,
    adversarios: adversarios || [], documentos: documentos || [], tarefas: tarefas || [],
    videosOriginais: videosOriginais || [], clipes: clipes || [],
  };
  const nome = `${(equipa.clube || 'equipa').replace(/[^\w-]+/g, '_')}_${(equipa.escalao || equipa.nome || '').replace(/[^\w-]+/g, '_')}_${todayStr()}.json`;
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return nome;
}

/* Quantos dados pessoais é que esta equipa guarda, e desde quando.

   Um número não obriga a nada, mas responde à pergunta que se faz uma vez
   por ano e que de outra forma não se faz: "ainda faz sentido guardar
   isto?". É a diferença entre ter uma política de retenção e ter uma
   intenção de retenção. */
export function retratoDeDados({ players, monitoring, clinico, sessions, matches, desenvolvimento }) {
  const datas = [
    ...(sessions || []).map(s => s.date),
    ...(matches || []).map(m => m.date),
    ...(monitoring || []).map(m => m.date),
  ].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d || '')).sort();

  return {
    jogadores: (players || []).length,
    // Estes três são os que pesam no artigo 9.º: são dados de saúde.
    wellness: (monitoring || []).length,
    clinico: (clinico || []).length,
    desenvolvimento: (desenvolvimento || []).length,
    maisAntigo: datas[0] || null,
    maisRecente: datas[datas.length - 1] || null,
  };
}

export function GestaoEquipa({ equipa, session, onEquipasMudaram, dados, setPlayers, onPreview }) {
  const players = (dados && dados.players) || [];
  const estreito = useIsMobile(640);

  /* UMA REGRA SÓ PARA TODOS OS BOTÕES DESTE ECRÃ.

     Estavam três barras de ação com três alinhamentos diferentes:
     "Guardar" à esquerda, "Sair desta equipa" à direita, "Exportar" à
     esquerda outra vez. Cada uma parecia certa isolada; juntas, o olho
     não encontra padrão nenhum e a página lê-se como remendos.

     No telemóvel empilham a toda a largura — é o que se toca melhor e
     evita meias-larguras aleatórias. Em ecrã largo encostam à direita,
     como o resto da app já faz nos rodapés das fichas. */
  const barraAcoes = {
    display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap',
    ...(estreito ? { flexDirection: 'column' } : { justifyContent: 'flex-end' }),
  };
  const botaoAcao = estreito ? { width: '100%', justifyContent: 'center' } : {};

  const [membros, setMembros] = useState(null);
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [logo, setLogo] = useState(equipa.logo || '');
  const [cor, setCor] = useState(equipa.cor || '#B5393F');
  const [aGuardarCor, setAGuardarCor] = useState(false);
  const [meuNome, setMeuNome] = useState('');
  const [meuTelefone, setMeuTelefone] = useState('');
  const [meuGenero, setMeuGenero] = useState('');
  const [telefoneGuardado, setTelefoneGuardado] = useState(false);
  const [aGuardarLogo, setAGuardarLogo] = useState(false);
  // Códigos de acesso individuais dos atletas — mudou-se para aqui a
  // partir de Monitorização: é informação tão reservada como o próprio
  // código de convite (dá entrada na plataforma), por isso faz mais
  // sentido viver ao lado dele do que entre gráficos de wellness.
  // Fechados por omissão, pela mesma razão que o código de convite só
  // aparece a quem administra.
  const [showCodes, setShowCodes] = useState(false);

  /* CARTÕES DE ATLETA (fase 2 da segurança do Portal). O staff gera um
     código de ativação por jogador (6 dígitos, uso único, 48 h); o jogador
     usa-o na Receção do Portal e escolhe o seu PIN. Tudo passa por funções
     do servidor que só aceitam o dono da equipa (staff_*). Se o SQL da
     fase 2 ainda não tiver sido corrido, o painel diz isso e não parte nada. */
  const [cartoes, setCartoes] = useState(null); // { so_cartao, jogadores: [...] } | { erro }
  const [codigoGerado, setCodigoGerado] = useState(null); // { playerId, codigo, expira_em }
  const [cartaoCopiado, setCartaoCopiado] = useState(false);
  const rpcStaff = async (nome, args) => {
    const { data, error } = await supabase.rpc(nome, args);
    if (error) throw error;
    let d = data;
    if (Array.isArray(d)) d = d[0];
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { /* fica */ } }
    return d;
  };
  const carregarCartoes = async () => {
    try { setCartoes(await rpcStaff('staff_cartoes_estado', { p_team: equipa.id })); }
    catch (e) {
      const semSql = /does not exist|não existe|PGRST202|function/i.test((e && (e.message || e.code)) || '');
      setCartoes({ erro: semSql ? 'sql' : ((e && e.message) || 'Não foi possível ler os cartões.') });
    }
  };
  const estadoCartao = (playerId) => ((cartoes && cartoes.jogadores) || []).find(j => j.player_id === String(playerId)) || null;
  const gerarCodigoCartao = (p) => {
    const est = estadoCartao(p.id);
    const fazer = async () => {
      try {
        const r = await rpcStaff('staff_cartao_gerar', { p_team: equipa.id, p_player: String(p.id) });
        setCodigoGerado({ playerId: p.id, nome: p.name, contacto: p.contact || '', codigo: r.codigo, expira_em: r.expira_em });
        setCartaoCopiado(false);
        carregarCartoes();
      } catch (e) { setErro((e && e.message) || 'Não foi possível gerar o código.'); }
    };
    if (est && est.ativo) {
      askConfirm({
        title: 'Gerar um código de ativação novo?',
        label: p.name,
        note: 'Este jogador já tem o cartão ativo num telemóvel. Quando usar o código novo, esse telemóvel deixa de entrar (útil se trocou ou perdeu o telemóvel).',
        confirmLabel: 'Gerar código',
        destructive: false,
        onConfirm: fazer,
      });
    } else {
      fazer();
    }
  };
  // A mesma mensagem para "Copiar" e para "Enviar por WhatsApp", com o link
  // do Portal para o atleta tocar e ir direto à Receção.
  const mensagemAtivacao = (cg) => (
    `Olá ${firstNameOf(cg.nome)}! O teu código de ativação do Portal do Atleta é ${cg.codigo}.\n\n`
    + `Abre o Portal${linkPortal ? ` (${linkPortal})` : ''}, escreve o código na Receção, recebe o teu cartão de atleta e escolhe o teu PIN pessoal. `
    + `Tens 48 horas para levantar o cartão. Depois, se quiseres o Portal noutro telemóvel ou computador, usa este mesmo código e o teu PIN. Guarda esta mensagem.${RODAPE_MENSAGEM_SISTEMA}`
  );
  const linkWhatsAppAtivacao = (cg) => (
    linkWhatsApp(cg.contacto, mensagemAtivacao(cg))
    // sem contacto na ficha: abre o WhatsApp com a mensagem e escolhe-se a conversa
    || `https://wa.me/?text=${encodeURIComponent(semEmojis(mensagemAtivacao(cg)))}`
  );
  const terminarCartao = (p) => askConfirm({
    title: 'Terminar o cartão deste jogador?',
    label: p.name,
    note: 'Deixa de entrar no Portal de imediato, em todos os aparelhos, e o código de acesso antigo também deixa de servir. Para voltar a entrar precisa de um código de ativação novo; o histórico dele mantém-se.',
    confirmLabel: 'Terminar cartão',
    onConfirm: async () => {
      try { await rpcStaff('staff_cartao_terminar', { p_team: equipa.id, p_player: String(p.id) }); carregarCartoes(); }
      catch (e) { setErro((e && e.message) || 'Não foi possível terminar o cartão.'); }
    },
  });
  const mudarSoCartao = (ligar) => {
    const semCartao = players.filter(p => !(estadoCartao(p.id) || {}).ativo).length;
    const fazer = async () => {
      try { await rpcStaff('staff_portal_so_cartao', { p_team: equipa.id, p_ligar: ligar }); carregarCartoes(); }
      catch (e) { setErro((e && e.message) || 'Não foi possível mudar esta opção.'); }
    };
    if (!ligar) { fazer(); return; }
    askConfirm({
      title: 'Desligar os códigos antigos?',
      label: semCartao ? `${semCartao} ${semCartao === 1 ? 'jogador ainda não tem' : 'jogadores ainda não têm'} cartão de atleta` : 'Todos os jogadores já têm cartão',
      note: semCartao
        ? 'Quem ainda não tem cartão deixa de conseguir entrar até ativar o seu. Podes voltar a ligar os códigos antigos a qualquer momento.'
        : 'A partir de agora só se entra no Portal com o cartão de atleta e o PIN. Podes voltar a ligar os códigos antigos a qualquer momento.',
      confirmLabel: 'Só cartão de atleta',
      destructive: semCartao > 0,
      onConfirm: fazer,
    });
  };

  /* LINK DO PORTAL DO ATLETA — veio de Monitorização. Fica aqui, logo
     antes dos códigos de acesso: o link é a porta, o código é a chave de
     cada atleta. Leva a equipa (?portal=<id>), para o servidor não ter de
     adivinhar de quem é o código. Os links antigos (?checkin=1&e=...)
     continuam a funcionar (ver `equipaDoLink`). Usa o endereço público
     da app, como os outros links partilhados. */
  const [linkPortalCopiado, setLinkPortalCopiado] = useState(false);
  const linkPortal = `${URL_PUBLICA_APP}?portal=${equipa.id}`;
  const copiarLinkPortal = async () => {
    try { await navigator.clipboard.writeText(linkPortal); } catch (e) { /* o campo fica selecionável */ }
    setLinkPortalCopiado(true);
    setTimeout(() => setLinkPortalCopiado(false), 2000);
  };

  /* O LOGÓTIPO É UM ENDEREÇO, NÃO UM FICHEIRO.

     A tentação é deixar carregar a imagem e guardá-la em base64 na base
     de dados — foi o que se fez com os vídeos e as apresentações, e é a
     razão pela qual a cópia de segurança dos dados pesa 91 MB. Com uma
     equipa era um incómodo; com cinquenta seria um problema de custo e de
     velocidade em cada arranque da app.

     Um link do Drive, do site do clube ou de onde for resolve o mesmo com
     zero bytes na base de dados. */
  const guardarLogo = async () => {
    setAGuardarLogo(true); setErro('');
    const { error } = await supabase.from('teams').update({ logo: logo.trim() || null }).eq('id', equipa.id);
    setAGuardarLogo(false);
    if (error) { setErro(error.message); return; }
    if (onEquipasMudaram) onEquipasMudaram();
  };

  /* A COR DA EQUIPA — usada nos quadros de posições (Simulador, Ficha
     de Jogo, Estrutura habitual do Adversário) em vez do vermelho fixo
     de sempre. Uma equipa nova que jogue de azul, por exemplo, vê as
     suas bolas a azul em todo o lado onde a app desenha o onze. */
  const guardarCor = async () => {
    setAGuardarCor(true); setErro('');
    const { error } = await supabase.from('teams').update({ cor: cor || null }).eq('id', equipa.id);
    setAGuardarCor(false);
    if (error) { setErro(error.message); return; }
    if (onEquipasMudaram) onEquipasMudaram();
  };

  const carregar = useCallback(async () => {
    try {
      const { data, error } = await selecionarMembros(equipa.id);
      if (error) throw error;
      setMembros(data || []);
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar os membros.');
      setMembros([]);
    }
  }, [equipa.id]);
  useEffect(() => { carregar(); }, [carregar]);

  /* O NOME É DE CADA UM, E CADA UM ESCREVE O SEU.

     Não vem do email — a `auth.users` não é legível pelo cliente, e
     torná-la legível daria a lista de contas da plataforma a qualquer
     membro. Também não o escreve o administrador pelos outros: quem
     sabe como se quer ser chamado é a própria pessoa.

     Enquanto ninguém escrever, as Tarefas mostram "Membro 3f2a…", que é
     feio o suficiente para se resolver depressa. */
  const guardarNome = async () => {
    setErro('');
    const { error } = await supabase.from('team_members')
      .update({ nome: meuNome.trim() || null })
      .eq('team_id', equipa.id).eq('user_id', euId);
    if (error) { setErro(error.message); return; }
    carregar();
  };

  const euId = session && session.user && session.user.id;
  const eu = (membros || []).find(m => m.user_id === euId);
  const souDono = eu && eu.papel === 'owner';
  // Cartões de atleta: só quem administra a equipa os vê e gere.
  useEffect(() => { if (souDono) carregarCartoes(); }, [equipa.id, souDono]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (eu) setMeuNome(eu.nome || ''); }, [eu && eu.nome]);
  useEffect(() => { if (eu) setMeuTelefone(eu.telefone || ''); }, [eu && eu.telefone]);
  useEffect(() => { if (eu) setMeuGenero(eu.genero || ''); }, [eu && eu.genero]);

  /* O TELEMÓVEL TAMBÉM É DE CADA UM. Só serve para os colegas poderem
     mandar um lembrete de tarefa por WhatsApp (ver `lembrar` nas
     Tarefas). Fica visível aos membros desta equipa, e só a eles. É
     opcional: sem ele, o lembrete fica só dentro da app. */
  const guardarTelefone = async () => {
    setErro(''); setTelefoneGuardado(false);
    const msg = await gravarTelefoneMembro(equipa.id, euId, meuTelefone);
    if (msg) { setErro(msg); return; }
    if ((eu && eu.genero || '') !== meuGenero) {
      const msgG = await gravarGeneroMembro(equipa.id, euId, meuGenero);
      if (msgG) { setErro(msgG); return; }
    }
    setTelefoneGuardado(true);
    carregar();
  };

  /* O DONO PODE PÔR O TELEMÓVEL DOS OUTROS. É a exceção à regra "cada um
     escreve o seu": há quem entre na equipa e nunca o preencha, e sem ele
     os lembretes por WhatsApp não funcionam. O dono já gere a equipa
     (código, remover membros, passar a administração), por isso faz
     sentido que também possa completar este contacto. */
  const [telOutro, setTelOutro] = useState(null); // { userId, valor, genero, generoAntes }
  const guardarTelefoneOutro = async () => {
    if (!telOutro) return;
    setErro('');
    const msg = await gravarTelefoneMembro(equipa.id, telOutro.userId, telOutro.valor);
    if (msg) { setErro(msg); return; }
    if ((telOutro.genero || '') !== (telOutro.generoAntes || '')) {
      const msgG = await gravarGeneroMembro(equipa.id, telOutro.userId, telOutro.genero);
      if (msgG) { setErro(msgG); return; }
    }
    if (telOutro.funcao !== undefined && (telOutro.funcao || '') !== (telOutro.funcaoAntes || '')) {
      const msgF = await gravarFuncaoMembro(equipa.id, telOutro.userId, telOutro.funcao);
      if (msgF) { setErro(msgF); return; }
    }
    setTelOutro(null);
    carregar();
  };

  /* A MINHA FUNÇÃO NA EQUIPA (aparece na credencial da porta de entrada).
     Grava logo ao escolher, como uma preferência. */
  const [minhaFuncao, setMinhaFuncao] = useState('');
  const [funcaoGuardada, setFuncaoGuardada] = useState(false);
  useEffect(() => { if (eu) setMinhaFuncao(eu.funcao || ''); }, [eu && eu.funcao]); // eslint-disable-line react-hooks/exhaustive-deps
  const escolherMinhaFuncao = async (valor) => {
    setMinhaFuncao(valor); setFuncaoGuardada(false); setErro('');
    const msg = await gravarFuncaoMembro(equipa.id, euId, valor);
    if (msg) { setErro(msg); return; }
    setFuncaoGuardada(true);
    carregar();
  };

  /* ENTRADA RÁPIDA NESTE APARELHO (Face ID / impressão digital). A porta
     pergunta depois de entrar; aqui pode-se ativar mais tarde ou
     desativar. Fica ligada a este aparelho e a esta conta. */
  const [bioPossivel, setBioPossivel] = useState(false);
  const [bioAqui, setBioAqui] = useState(() => !!staffBioEstado(euId));
  const [bioMsg, setBioMsg] = useState('');
  const [bioOcupado, setBioOcupado] = useState(false);
  useEffect(() => { let vivo = true; staffBioDisponivel().then(d => { if (vivo) setBioPossivel(d); }); return () => { vivo = false; }; }, []);
  useEffect(() => { setBioAqui(!!staffBioEstado(euId)); }, [euId]);
  const ativarBioAqui = async () => {
    setBioMsg(''); setBioOcupado(true);
    try { await staffBioAtivar(eu && eu.nome); setBioAqui(true); setBioMsg('Ativado. Da próxima vez, entra no emblema da porta.'); }
    catch (e) { if (!(e && (e.name === 'NotAllowedError' || e.name === 'AbortError'))) setBioMsg((e && e.message) || 'Não foi possível ativar.'); }
    setBioOcupado(false);
  };
  const desativarBioAqui = async () => {
    setBioMsg(''); setBioOcupado(true);
    await staffBioDesativar();
    setBioAqui(false); setBioOcupado(false); setBioMsg('Desativado neste aparelho.');
  };

  /* O RESPONSÁVEL ESCOLHE UMA PALAVRA-PASSE NOVA PARA UM MEMBRO. As contas
     da equipa técnica usam emails sem caixa de correio, por isso o link de
     recuperação por email não chega a ninguém: é aqui que se repõe. A
     Edge Function staff-acesso só deixa o responsável desta equipa fazê-lo. */
  const [passeOutro, setPasseOutro] = useState(null); // { userId, valor, aGravar, msg }
  const gravarPasseOutro = async () => {
    if (!passeOutro) return;
    if (String(passeOutro.valor || '').length < 6) { setPasseOutro({ ...passeOutro, msg: 'Usa 6 ou mais caracteres.' }); return; }
    setPasseOutro({ ...passeOutro, aGravar: true, msg: '' });
    try {
      await staffReporPalavraPasse(equipa.id, passeOutro.userId, passeOutro.valor);
      setPasseOutro({ ...passeOutro, aGravar: false, feito: true, msg: 'Mudada. Diz-lhe a nova palavra-passe.' });
    } catch (e) {
      setPasseOutro({ ...passeOutro, aGravar: false, msg: (e && e.message) || 'Não foi possível mudar.' });
    }
  };

  /* Só se veem os ids dos outros, não os emails: a tabela `auth.users`
     não é legível pelo cliente, e expô-la seria dar a lista de contas da
     plataforma a qualquer membro. O próprio reconhece-se por "tu". */
  const rotulo = (m) => (m.nome
    ? m.nome
    : (m.user_id === euId ? (session.user.email || 'Tu') : `Membro ${String(m.user_id).slice(0, 6)}`));

  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(equipa.codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (e) { /* sem permissão para a área de transferência */ }
  };

  /* PORQUE É QUE ISTO PRECISA DE EXISTIR.

     O código de convite não expira nem fica associado a quem o usou —
     é só uma palavra-passe da equipa. Isso quer dizer que alguém que
     saia (ou seja removido) e que tenha guardado o código continua, tecnicamente,
     capaz de voltar a entrar sozinho mais tarde: sair da equipa tira o
     acesso a quem já lá estava, mas não invalida o código em si.

     Gerar um código novo é a forma de cortar isso: quem já é membro
     não é afetado (a ligação já está feita, não depende do código
     continuar válido), mas o código antigo deixa de servir para
     ENTRAR — nem para quem nunca esteve na equipa, nem para quem já
     saiu e ainda o tinha guardado. */
  const gerarCodigoEquipa = () => {
    // Sem I nem O, para não se confundirem com 1 e 0 ao ditar o código
    // em voz alta ou ao escrevê-lo à mão.
    const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let s = '';
    for (let i = 0; i < 6; i++) s += letras[Math.floor(Math.random() * letras.length)];
    return s;
  };

  const regenerarCodigo = () => askConfirm({
    title: 'Gerar um novo código de convite?',
    label: `${[equipa.clube, equipa.escalao || equipa.nome].filter(Boolean).join(' · ')} · código atual ${equipa.codigo}`,
    note: 'O código atual deixa de servir para entrar na equipa — quem já é membro continua a sê-lo, mas quem só tinha o código (incluindo alguém que já tenha saído) já não consegue entrar com ele. Terás de enviar o novo código a quem precisar de entrar a partir de agora.',
    confirmLabel: 'Gerar novo código',
    destructive: true,
    onConfirm: async () => {
      const novo = gerarCodigoEquipa();
      const { error } = await supabase.from('teams').update({ codigo: novo }).eq('id', equipa.id);
      if (error) { setErro(error.message); return; }
      if (onEquipasMudaram) onEquipasMudaram();
    },
  });

  const remover = (m) => askConfirm({
    title: 'Remover da equipa?',
    label: rotulo(m),
    note: 'Deixa de ver os dados desta equipa. Nada do que criou é apagado.',
    confirmLabel: 'Remover',
    onConfirm: async () => {
      const { error } = await supabase.from('team_members').delete()
        .eq('team_id', equipa.id).eq('user_id', m.user_id);
      if (error) setErro(error.message); else carregar();
    },
  });

  const passarPosse = (m) => askConfirm({
    title: 'Passar a administração da equipa?',
    label: rotulo(m),
    note: 'Passa a ser esta pessoa a administrar a equipa e a poder remover membros. Tu ficas membro e não podes desfazer isto sozinho.',
    confirmLabel: 'Passar administração',
    onConfirm: async () => {
      const a = await supabase.from('team_members').update({ papel: 'owner' })
        .eq('team_id', equipa.id).eq('user_id', m.user_id);
      if (a.error) { setErro(a.error.message); return; }
      const b = await supabase.from('team_members').update({ papel: 'member' })
        .eq('team_id', equipa.id).eq('user_id', euId);
      if (b.error) setErro(b.error.message);
      carregar();
    },
  });

  const souUnico = (membros || []).length <= 1;
  const retrato = retratoDeDados(dados || {});

  /* CÓPIA DOS CLIPES DA SALA DE VÍDEO. Os clipes enviados da Análise de
     Vídeo para a Sala de Vídeo são MP4 no Storage (videos-clipes): a
     exportação dos dados só leva o link. Aqui descarregam-se os próprios
     ficheiros para um .zip, com um índice (titulo, destino, minutos do
     jogo) — um de cada vez, para não pesar no telemóvel/computador. */
  const clipesSala = ((dados && dados.videos) || []).filter(v => v && v.origemAnalise && v.kind === 'video' && /^https?:/.test(v.dataUrl || ''));
  const [zipClipes, setZipClipes] = useState(null); // { feitos, total, erro }
  const descarregarClipesSala = async () => {
    if (!clipesSala.length || (zipClipes && zipClipes.aCorrer)) return;
    const zip = new JSZip();
    const usados = new Set();
    const nomeLimpo = (t) => String(t || 'clipe').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '_').slice(0, 60) || 'clipe';
    const fichas = Object.fromEntries(((dados && dados.adversarios) || []).map(a => [a.id, a.nome]));
    const jogos = Object.fromEntries(((dados && dados.matches) || []).map(m => [m.id, `${m.jornada ? `${m.jornada} · ` : ''}vs ${m.opponent || ''}`]));
    const indice = [];
    const falhados = [];
    setZipClipes({ aCorrer: true, feitos: 0, total: clipesSala.length });
    for (let i = 0; i < clipesSala.length; i++) {
      const v = clipesSala[i];
      const destino = v.adversarioId ? `Adversários › ${fichas[v.adversarioId] || v.equipa || ''}`
        : v.categoria === 'jogo' ? `Jogos › ${jogos[v.jogoId] || v.jornada || ''}` : `Temas › ${v.pasta || ''}`;
      const pasta = v.adversarioId ? `adversarios/${nomeLimpo(fichas[v.adversarioId] || v.equipa)}`
        : v.categoria === 'jogo' ? `jogos/${nomeLimpo(jogos[v.jogoId] || v.jornada)}` : `temas/${nomeLimpo(v.pasta)}`;
      let nome = `${pasta}/${nomeLimpo(v.title)}.mp4`;
      for (let k = 2; usados.has(nome); k++) nome = `${pasta}/${nomeLimpo(v.title)}_${k}.mp4`;
      usados.add(nome);
      try {
        const resp = await fetch(v.dataUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        zip.file(nome, await resp.blob(), { compression: 'STORE' });
        indice.push({ ficheiro: nome, titulo: v.title || '', destino, minutosNoJogo: `${fmtMMSS(v.clipInicio || 0)}–${fmtMMSS(v.clipFim || 0)}`, videoOriginal: v.clipOrigemTitulo || '', link: v.dataUrl });
      } catch (e) {
        falhados.push({ titulo: v.title || '', destino, link: v.dataUrl, erro: String((e && e.message) || e) });
      }
      setZipClipes({ aCorrer: true, feitos: i + 1, total: clipesSala.length });
    }
    zip.file('indice.json', JSON.stringify({ exportadoEm: new Date().toISOString(), equipa: equipa && equipa.nome, clipes: indice, falhados }, null, 2));
    try {
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `clipes_sala_de_video_${todayStr()}.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setZipClipes({ aCorrer: false, feitos: indice.length, total: clipesSala.length, falhados: falhados.length });
    } catch (e) {
      setZipClipes({ aCorrer: false, erro: 'Não consegui criar o ficheiro .zip. Tenta no computador, que tem mais memória.' });
    }
  };

  const exportar = () => {
    const nome = exportarDadosDaEquipa({ equipa, ...(dados || {}) });
    offerUndo(`Exportado: ${nome}`, null);
  };

  /* APAGAR A EQUIPA APAGA A EQUIPA.

     O `on delete cascade` das colunas `team_id` leva atrás plantel,
     sessões, jogos, presenças, wellness, boletim clínico e
     desenvolvimento. Não há aqui um "arquivo" nem uma lixeira: é o que a
     obrigação de eliminação exige, e é o que o clube tem direito a pedir.

     Três travões, porque isto não tem anular nenhum:
     · só o administrador;
     · só quando não há mais ninguém na equipa, senão apagava-se o
       trabalho de outra pessoa sem ela saber;
     · e obriga a escrever o nome do clube à mão. Um clique dado por
       distração não chega para destruir uma época. */
  const apagarEquipa = () => {
    const alvo = (equipa.clube || equipa.nome || '').trim();
    askConfirm({
      title: 'Apagar esta equipa?',
      label: `Vais apagar esta equipa e TODOS os seus dados: ${retrato.jogadores} jogadores, ${retrato.wellness} registos de bem-estar, ${retrato.clinico} do boletim clínico.`,
      note: 'Isto não tem volta e não há cópia.',
      confirmText: alvo,
      confirmLabel: 'Continuar',
      onConfirm: () => {
        askConfirm({
          title: 'Apagar definitivamente?',
          label: alvo,
          note: 'Última confirmação. Depois disto os dados não se recuperam.',
          confirmLabel: 'Apagar tudo',
          onConfirm: async () => {
            const { error } = await supabase.from('teams').delete().eq('id', equipa.id);
            if (error) { setErro(error.message); return; }
            try { window.localStorage.removeItem(CHAVE_EQUIPA); } catch (e) { /* modo privado */ }
            window.location.reload();
          },
        });
      },
    });
  };

  const sairDaEquipa = () => askConfirm({
    title: 'Sair desta equipa?',
    label: [equipa.clube, equipa.escalao || equipa.nome].filter(Boolean).join(' · '),
    note: souDono
      ? 'És a administradora desta equipa. Passa a administração a outra pessoa antes de saíres, ou ninguém poderá gerir membros.'
      : 'Deixas de ver os dados desta equipa. Podes voltar a entrar com o código.',
    confirmLabel: 'Sair',
    onConfirm: async () => {
      const { error } = await supabase.from('team_members').delete()
        .eq('team_id', equipa.id).eq('user_id', euId);
      if (error) { setErro(error.message); return; }
      try { window.localStorage.removeItem(CHAVE_EQUIPA); } catch (e) { /* modo privado */ }
      window.location.reload();
    },
  });

  /* Gerar um código novo invalida o antigo: o atleta deixa de conseguir
     entrar até alguém lhe dar o novo. É destrutivo o suficiente para
     merecer confirmação — e o botão fica ao lado do código, fácil de
     acertar sem querer. */
  /* Quem ainda tem código curto, e a forma de atualizar todos de uma vez.
     Um a um seriam quarenta confirmações; mas continua a ser uma ação
     deliberada, com aviso, porque todos esses atletas ficam sem conseguir
     entrar até receberem o novo. */
  const curtos = players.filter(p => p.code && String(p.code).length < CHECKIN_CODE_LEN);

  const atualizarCodigosCurtos = () => askConfirm({
    title: 'Atualizar os códigos antigos?',
    label: `${curtos.length} ${curtos.length === 1 ? 'atleta' : 'atletas'}`,
    note: 'Os códigos atuais deixam de funcionar. Tens de enviar o novo a cada um antes do próximo questionário.',
    confirmLabel: 'Atualizar códigos',
    destructive: false,
    onConfirm: () => {
      // `prev =>`: o conjunto de códigos já usados também tem de vir da
      // versão mais recente, não da que estava no ecrã quando se clicou.
      setPlayers(prev => {
        const used = new Set(prev.map(p => p.code).filter(Boolean));
        return prev.map(p => {
          if (!p.code || String(p.code).length >= CHECKIN_CODE_LEN) return p;
          used.delete(p.code);
          return { ...p, code: genPlayerCode(used) };
        });
      });
    },
  });

  const regenerateCode = (playerId) => {
    const jogador = players.find(p => p.id === playerId);
    if (!jogador) return;
    askConfirm({
      title: 'Gerar um código novo?',
      label: `${jogador.name}${jogador.code ? ` · código atual ${jogador.code}` : ''}`,
      note: 'O código atual deixa de funcionar. Tens de enviar o novo ao atleta para ele voltar a conseguir responder.',
      confirmLabel: 'Gerar novo código',
      destructive: false,
      onConfirm: () => {
        setPlayers(prev => {
          const used = new Set(prev.filter(p => p.id !== playerId && p.code).map(p => p.code));
          return prev.map(p => (p.id === playerId ? { ...p, code: genPlayerCode(used) } : p));
        });
      },
    });
  };

  const th2 = { textAlign: 'left', padding: '9px 12px', fontSize: 10.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${T.line}` };
  const td2 = { padding: '9px 12px', fontSize: 13, color: T.mutedDim };

  return (
    <div>
      <SectionHeader title="Equipa" subtitle="Quem tem acesso e como convidar." />

      <Panel title={[equipa.clube, equipa.escalao || equipa.nome].filter(Boolean).join(' · ') || 'Equipa'}>
        <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
          Código de convite
        </div>
        {/* Só quem administra vê o código — não só quem o pode gerar de
            novo. Quantas mais pessoas o veem (e o podem fotografar,
            copiar, reencaminhar), mais difícil é saber por onde é que
            ele "vazou" — e menos vale a pena gerar um novo, se os
            outros membros continuam todos a poder vê-lo e partilhá-lo
            à mesma. */}
        {souDono ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ ...mono, fontSize: 26, color: T.gold, letterSpacing: '.22em' }}>{equipa.codigo}</span>
              <Btn variant="ghost" onClick={copiarCodigo}>
                {copiado ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar</>}
              </Btn>
              <Btn variant="ghost" onClick={regenerarCodigo}>
                <RefreshCw size={15} /> Gerar novo código
              </Btn>
            </div>
            {/* Isto é uma consequência que não se adivinha, por isso fica. */}
            <div style={{ fontSize: 12, color: T.mutedDim, lineHeight: 1.6, marginBottom: 20 }}>
              Quem tiver este código entra na equipa e vê tudo — plantel, presenças, boletim clínico.
              Trata-o como uma palavra-passe. Só tu o vês, e é assim de propósito — se alguém sair da
              equipa e ainda tiver o código guardado, gera um código novo para lhe cortar essa entrada;
              quem já é membro não é afetado.
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12.5, color: T.mutedDim, lineHeight: 1.6, marginBottom: 20 }}>
            Só quem administra a equipa vê o código de convite. Se precisares de convidar alguém,
            pede-o a essa pessoa.
          </div>
        )}

        <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
          Emblema
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {equipa.logo ? (
            <img src={equipa.logo} alt="" style={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0 }} />
          ) : null}
          <div style={{ flex: 1, minWidth: 180 }}>
            <Input
              value={logo}
              onChange={e => setLogo(e.target.value)}
              placeholder="https://… endereço da imagem"
            />
          </div>
        </div>
        {/* A explicação antes do botão, e não depois: quem lê de cima para
            baixo precisa de saber o que colar ANTES de decidir guardar. */}
        <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 8, lineHeight: 1.6 }}>
          Cola o endereço de uma imagem já publicada — do site do clube, do Drive com partilha
          aberta, de onde for. Aparece na barra lateral e no ecrã do questionário dos atletas.
        </div>
        <div style={barraAcoes}>
          <Btn variant="ghost" onClick={guardarLogo} disabled={aGuardarLogo} style={botaoAcao}>
            {aGuardarLogo ? 'A guardar…' : 'Guardar emblema'}
          </Btn>
        </div>
      </Panel>

      <div style={{ height: 16 }} />

      <Panel title="Cor da equipa">
        <div style={{ fontSize: 12, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
          Bolas dos jogadores
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="color"
            value={cor}
            onChange={e => setCor(e.target.value)}
            style={{ width: 44, height: 44, padding: 0, border: `1px solid ${T.line}`, borderRadius: 8, background: 'none', cursor: 'pointer', flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 180 }}>
            <Input
              value={cor}
              onChange={e => setCor(e.target.value)}
              placeholder="#B5393F"
            />
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 8, lineHeight: 1.6 }}>
          A cor das bolas dos jogadores no Simulador, na Ficha de Jogo e na Estrutura habitual
          de um adversário. Uma equipa que jogue de azul, por exemplo, pode trocar aqui o
          vermelho de origem.
        </div>
        <div style={barraAcoes}>
          <Btn variant="ghost" onClick={guardarCor} disabled={aGuardarCor} style={botaoAcao}>
            {aGuardarCor ? 'A guardar…' : 'Guardar cor'}
          </Btn>
        </div>
      </Panel>

      <div style={{ height: 16 }} />

      <Panel title={`Membros${membros ? ` (${membros.length})` : ''}`}>
        {erro && <div style={{ color: T.bad, fontSize: 12.5, marginBottom: 12 }}>{erro}</div>}

        <Field label="O teu nome nesta equipa" bloco solto>
          <Input value={meuNome} onChange={e => setMeuNome(e.target.value)} placeholder="Ex: JP" />
        </Field>
        <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 8, lineHeight: 1.6 }}>
          É como apareces nas tarefas para os outros. Sem isto, veem-te como um código.
        </div>
        <div style={{ ...barraAcoes, marginBottom: 18 }}>
          <Btn variant="ghost" onClick={guardarNome} style={botaoAcao}>Guardar nome</Btn>
        </div>

        <Field label="O teu telemóvel (opcional)" bloco solto>
          <Input
            type="tel" inputMode="tel" autoComplete="tel"
            value={meuTelefone}
            onChange={e => { setMeuTelefone(e.target.value); setTelefoneGuardado(false); }}
            placeholder="Ex: +351 912 345 678"
          />
        </Field>
        <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 8, lineHeight: 1.6 }}>
          Serve para os colegas te lembrarem de uma tarefa por WhatsApp, com a mensagem já escrita.
          Só os membros desta equipa o veem. Sem ele, os lembretes ficam só dentro da app.
        </div>
        <div style={{ height: 12 }} />
        <Field label="Género, para o texto das mensagens" bloco solto>
          <Select value={meuGenero} onChange={e => { setMeuGenero(e.target.value); setTelefoneGuardado(false); }}>
            <option value="">Sem género (Obrigado/a)</option>
            {GENEROS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <div style={{ ...barraAcoes, marginBottom: 18 }}>
          {telefoneGuardado && <span style={{ fontSize: 12, color: T.good, alignSelf: 'center' }}>Guardado.</span>}
          <Btn variant="ghost" onClick={guardarTelefone} style={botaoAcao}>Guardar contacto</Btn>
        </div>

        <Field label="A tua função na equipa" bloco solto>
          <Select value={minhaFuncao} onChange={e => escolherMinhaFuncao(e.target.value)}>
            <option value="">Sem função definida</option>
            {FUNCOES_STAFF.map(f => <option key={f} value={f}>{f}</option>)}
          </Select>
        </Field>
        <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 8, lineHeight: 1.6 }}>
          Aparece na tua credencial, na porta de entrada da app.
          {funcaoGuardada && <span style={{ color: T.good }}> Guardado.</span>}
        </div>
        <div style={{ height: 14 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 14px', background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, marginBottom: 18 }}>
          <Fingerprint size={18} color={bioAqui ? T.good : T.muted} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ color: T.cream, fontSize: 13.5 }}>Entrada rápida neste aparelho</div>
            <div style={{ color: T.mutedDim, fontSize: 12, marginTop: 2, lineHeight: 1.5 }}>
              {!bioPossivel ? 'Este aparelho não tem Face ID nem impressão digital disponíveis.'
                : bioAqui ? `Ativa: entras com ${BIO_TXT.comArtigo}, no emblema da porta.`
                  : `Entra com ${BIO_TXT.comArtigo}, sem escrever a palavra-passe.`}
              {bioMsg && <span style={{ color: T.muted }}> {bioMsg}</span>}
            </div>
          </div>
          {bioPossivel && (bioAqui
            ? <Btn variant="ghost" onClick={desativarBioAqui} disabled={bioOcupado}>Desativar</Btn>
            : <Btn onClick={ativarBioAqui} disabled={bioOcupado}>{bioOcupado ? 'A ativar…' : 'Ativar'}</Btn>)}
        </div>

        {membros === null ? (
          <div style={{ fontSize: 12.5, color: T.mutedDim }}>A carregar…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {membros.map(m => (
              <div key={m.user_id} style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                padding: '11px 14px', background: T.bg, borderRadius: 8, border: `1px solid ${T.line}`,
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: T.cream, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rotulo(m)}
                  </div>
                  <div style={{ color: T.mutedDim, fontSize: 12, marginTop: 2 }}>
                    {m.papel === 'owner' ? 'Administrador' : 'Membro'}
                    {m.funcao ? ` · ${m.funcao}` : ''}
                    {m.created_at ? ` · desde ${fmtDate(String(m.created_at).slice(0, 10))}` : ''}
                  </div>
                  {telOutro && telOutro.userId === m.user_id ? (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                        <Input
                          type="tel" inputMode="tel" autoFocus
                          value={telOutro.valor}
                          onChange={e => setTelOutro({ ...telOutro, valor: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') guardarTelefoneOutro(); if (e.key === 'Escape') setTelOutro(null); }}
                          placeholder="+351 912 345 678"
                        />
                      </div>
                      <div style={{ flex: '0 1 150px' }}>
                        <Select value={telOutro.genero || ''} onChange={e => setTelOutro({ ...telOutro, genero: e.target.value })} aria-label="Tratamento nas mensagens">
                          <option value="">Sem género</option>
                          {GENEROS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </Select>
                      </div>
                      <div style={{ flex: '0 1 190px' }}>
                        <Select value={telOutro.funcao || ''} onChange={e => setTelOutro({ ...telOutro, funcao: e.target.value })} aria-label="Função na equipa">
                          <option value="">Sem função</option>
                          {FUNCOES_STAFF.map(f => <option key={f} value={f}>{f}</option>)}
                        </Select>
                      </div>
                      <Btn onClick={guardarTelefoneOutro}>Guardar</Btn>
                      <Btn variant="ghost" onClick={() => setTelOutro(null)}>Cancelar</Btn>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 12, color: m.telefone ? T.muted : T.mutedDim }}>
                      <MessageCircle size={12} color={m.telefone ? '#25D366' : undefined} />
                      <span style={{ ...mono, fontSize: 11.5 }}>{m.telefone || 'Sem telemóvel'}</span>
                      {m.genero && <span style={{ fontSize: 11.5 }}>· {m.genero === 'f' ? 'Feminino' : 'Masculino'}</span>}
                      {souDono && m.user_id !== euId && (
                        <button
                          onClick={() => setTelOutro({ userId: m.user_id, valor: m.telefone || '', genero: m.genero || '', generoAntes: m.genero || '', funcao: m.funcao || '', funcaoAntes: m.funcao || '' })}
                          title="Alterar telemóvel, tratamento nas mensagens e função"
                          style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}
                        ><Pencil size={12} /></button>
                      )}
                    </div>
                  )}
                </div>
                {souDono && m.user_id !== euId && (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}>
                    <button onClick={() => setPasseOutro(passeOutro && passeOutro.userId === m.user_id ? null : { userId: m.user_id, valor: '', msg: '' })} title="Escolher uma palavra-passe nova" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Lock size={14} /></button>
                    <button onClick={() => passarPosse(m)} title="Passar a administração da equipa" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Star size={14} /></button>
                    <button onClick={() => remover(m)} title="Remover da equipa" style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', padding: 0, display: 'flex' }}><Trash2 size={14} /></button>
                  </div>
                )}
                {souDono && m.user_id !== euId && passeOutro && passeOutro.userId === m.user_id && (
                  <div style={{ flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    <div style={{ fontSize: 12, color: T.mutedDim, lineHeight: 1.5 }}>
                      Palavra-passe nova para {rotulo(m)}. Escolhe uma provisória e diz-lha; depois pode trocá-la.
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                        <Input type="text" autoComplete="off" autoFocus value={passeOutro.valor}
                          onChange={e => setPasseOutro({ ...passeOutro, valor: e.target.value, msg: '', feito: false })}
                          onKeyDown={e => { if (e.key === 'Enter') gravarPasseOutro(); if (e.key === 'Escape') setPasseOutro(null); }}
                          placeholder="6 ou mais caracteres" />
                      </div>
                      <Btn onClick={gravarPasseOutro} disabled={passeOutro.aGravar}>{passeOutro.aGravar ? 'A mudar…' : 'Mudar'}</Btn>
                      <Btn variant="ghost" onClick={() => setPasseOutro(null)}>Fechar</Btn>
                    </div>
                    {passeOutro.msg && <div style={{ fontSize: 12, color: passeOutro.feito ? T.good : T.bad }}>{passeOutro.msg}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={barraAcoes}>
          <Btn variant="ghost" onClick={sairDaEquipa} style={botaoAcao}><LogOut size={15} /> Sair desta equipa</Btn>
        </div>
      </Panel>

      <div style={{ height: 16 }} />
      <Panel title="Portal do Atleta">
        <div style={{ fontSize: 12, color: T.mutedDim, marginBottom: 12, lineHeight: 1.5 }}>
          Envia este link aos atletas. Abre o Portal do Atleta (questionários de wellness e PSE, sala de vídeo, clipes e o resto do que partilhas com eles), sem mostrar a plataforma do staff.
          Cada atleta entra com o seu código individual, {souDono ? 'na lista logo abaixo' : 'que quem administra a equipa lhe dá'}.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Input readOnly value={linkPortal} onFocus={e => e.target.select()} style={{ flex: 1, minWidth: 220, ...mono, fontSize: 12.5 }} />
          <Btn variant="ghost" onClick={copiarLinkPortal}>
            {linkPortalCopiado ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar link</>}
          </Btn>
          {onPreview && <Btn onClick={onPreview}><Play size={15} /> Abrir o Portal</Btn>}
        </div>
      </Panel>

      {/* CÓDIGOS DE ACESSO INDIVIDUAIS — mudou-se para aqui a partir de
          Monitorização. É o login de cada atleta na plataforma, tão
          reservado como o código de convite logo acima — por isso vive
          ao lado dele, e não entre os gráficos de wellness onde
          qualquer consulta ao ecrã empurrava demasiado scroll antes de
          se chegar à tabela de respostas do dia. Pela mesma razão do
          código de convite, só quem administra a equipa vê e gere. */}
      {souDono && players.length > 0 && (
        <>
          <div style={{ height: 16 }} />
          <Panel title={<>Cartões de atleta <span style={{ color: T.mutedDim, fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>(entrada no Portal com PIN pessoal)</span></>}>
            {!cartoes ? (
              <div style={{ fontSize: 12.5, color: T.mutedDim }}>A carregar…</div>
            ) : cartoes.erro ? (
              <div style={{ fontSize: 12.5, color: T.warn, lineHeight: 1.5 }}>
                {cartoes.erro === 'sql'
                  ? 'Falta correr no Supabase o SQL da fase 2 (fase2_cartao_atleta.sql). Até lá, os atletas entram com os códigos de acesso abaixo.'
                  : cartoes.erro}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: T.mutedDim, marginBottom: 12, lineHeight: 1.5 }}>
                  Gera um código de ativação para cada atleta e envia-lho em mensagem privada. Ele usa-o uma vez, na Receção do Portal, e escolhe o seu PIN pessoal (que ninguém do staff vê). O código expira em 48 horas.
                </div>

                {codigoGerado && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '12px 14px', marginBottom: 12, borderRadius: 10, background: `${T.gold}14`, border: `1px solid ${T.gold}66` }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 12, color: T.muted }}>Código de ativação de <strong style={{ color: T.cream }}>{codigoGerado.nome}</strong></div>
                      <div style={{ ...mono, fontSize: 28, color: T.gold, letterSpacing: '.22em', lineHeight: 1.3 }}>{codigoGerado.codigo}</div>
                      <div style={{ fontSize: 11.5, color: T.mutedDim }}>Válido até {new Date(codigoGerado.expira_em).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · depois de levantado, serve com o PIN para outros aparelhos</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <a href={linkWhatsAppAtivacao(codigoGerado)} target="_blank" rel="noopener noreferrer" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8,
                        background: '#25D366', color: '#0b1f12', fontWeight: 600, fontSize: 13.5, textDecoration: 'none', ...body,
                      }}>
                        <MessageCircle size={15} /> Enviar por WhatsApp
                      </a>
                      <Btn variant="ghost" onClick={async () => {
                        try { await navigator.clipboard.writeText(semEmojis(mensagemAtivacao(codigoGerado))); setCartaoCopiado(true); } catch (e) { /* sem área de transferência */ }
                      }}>{cartaoCopiado ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar mensagem</>}</Btn>
                      <Btn variant="ghost" onClick={() => setCodigoGerado(null)}><X size={14} /></Btn>
                    </div>
                    {!linkWhatsApp(codigoGerado.contacto, 'x') && (
                      <div style={{ flexBasis: '100%', fontSize: 11.5, color: T.mutedDim }}>
                        Este atleta não tem contacto na ficha: o WhatsApp abre com a mensagem pronta e escolhes tu a conversa.
                      </div>
                    )}
                  </div>
                )}

                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead><tr><th style={th2}>Jogador</th><th style={th2}>Cartão</th><th style={th2}></th></tr></thead>
                    <tbody>
                      {sortByPosition(players).map(p => {
                        const est = estadoCartao(p.id) || {};
                        const quando = (d) => new Date(d).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                        return (
                          <tr key={p.id} style={{ borderBottom: `1px solid ${T.line}` }}>
                            <td style={{ ...td2, color: T.cream }} title={p.name}>{p.position ? `${p.position} · ` : ''}{shortPlayerName(p, players)}</td>
                            <td style={{ ...td2, fontSize: 12 }}>
                              {est.ativo
                                ? <span style={{ color: T.good }}>Ativo{est.aparelhos > 1 ? ` em ${est.aparelhos} aparelhos` : ''}{est.ultimo_uso ? ` · entrou ${quando(est.ultimo_uso)}` : ''}</span>
                                : est.pendente_ate
                                  ? <span style={{ color: T.warn }}>Código enviado · válido até {quando(est.pendente_ate)}</span>
                                  : <span style={{ color: T.mutedDim }}>Sem cartão</span>}
                            </td>
                            <td style={{ ...td2, whiteSpace: 'nowrap' }}>
                              <button onClick={() => gerarCodigoCartao(p)} title="Gerar código de ativação"
                                style={{ background: 'none', border: 'none', color: T.gold, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5 }}>
                                <Lock size={12} /> {est.ativo || est.pendente_ate ? 'Novo código' : 'Gerar código'}
                              </button>
                              {est.ativo && (
                                <button onClick={() => terminarCartao(p)} title="Terminar o cartão"
                                  style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, marginLeft: 10 }}>
                                  <X size={12} /> Terminar
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 14, padding: '11px 14px', borderRadius: 8, background: T.surface, border: `1px solid ${T.line}` }}>
                  <div style={{ flex: 1, minWidth: 200, fontSize: 12.5, color: T.cream, lineHeight: 1.5 }}>
                    <strong>Entrada só com cartão de atleta</strong>
                    <div style={{ fontSize: 12, color: T.mutedDim }}>
                      {(cartoes.jogadores || []).filter(j => j.ativo).length} de {players.length} atletas com cartão ativo.
                      {cartoes.so_cartao ? ' Os códigos antigos estão desligados.' : ' Enquanto estiver desligado, os códigos antigos continuam a funcionar.'}
                    </div>
                  </div>
                  <Btn variant={cartoes.so_cartao ? 'ghost' : 'primary'} onClick={() => mudarSoCartao(!cartoes.so_cartao)}>
                    {cartoes.so_cartao ? 'Voltar a ligar códigos antigos' : 'Desligar códigos antigos'}
                  </Btn>
                </div>
              </>
            )}
          </Panel>

          <div style={{ height: 16 }} />
          <Panel title={<>Códigos de acesso individuais <span style={{ color: T.mutedDim, fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>(questionários wellness e PSE)</span></>}
            action={<button onClick={() => setShowCodes(!showCodes)} style={{ background: 'none', border: 'none', color: T.warn, cursor: 'pointer', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 5 }}>
              {showCodes ? <><EyeOff size={13} /> Ocultar</> : <><Eye size={13} /> Mostrar</>}
            </button>}>
            {showCodes ? (
              <>
                {/* CÓDIGOS ANTIGOS, CURTOS.

                    Os de quatro dígitos ainda entram, mas são adivinháveis:
                    nove mil hipóteses para um plantel de quarenta. O aviso
                    só aparece enquanto houver algum por atualizar, e
                    desaparece sozinho quando deixar de haver — um aviso
                    permanente deixa de ser lido. */}
                {curtos.length > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    padding: '11px 14px', marginBottom: 12, borderRadius: 8,
                    background: `${T.warn}18`, border: `1px solid ${T.warn}55`,
                  }}>
                    <AlertTriangle size={15} style={{ color: T.warn, flexShrink: 0 }} />
                    <div style={{ fontSize: 12.5, color: T.cream, flex: 1, minWidth: 180, lineHeight: 1.5 }}>
                      {curtos.length} {curtos.length === 1 ? 'atleta tem um código antigo' : 'atletas têm códigos antigos'} de 4 dígitos,
                      fáceis de adivinhar por quem tenha o link.
                    </div>
                    <Btn variant="ghost" onClick={atualizarCodigosCurtos} style={{ flexShrink: 0 }}>
                      <RefreshCw size={14} /> Atualizar
                    </Btn>
                  </div>
                )}
                <div style={{ fontSize: 12, color: T.mutedDim, marginBottom: 10, lineHeight: 1.5 }}>
                  Cada atleta tem um código pessoal de {CHECKIN_CODE_LEN} dígitos. É o login dele no questionário: entra só com o próprio código e só vê o seu nome — nunca a lista do plantel. Envia o código individualmente a cada um (ex: mensagem privada).
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead><tr><th style={th2}>Jogador</th><th style={th2}>Código</th><th style={th2}></th></tr></thead>
                    <tbody>
                      {sortByPosition(players).map(p => (
                        <tr key={p.id} style={{ borderBottom: `1px solid ${T.line}` }}>
                          <td style={{ ...td2, color: T.cream }} title={p.name}>{p.position ? `${p.position} · ` : ''}{shortPlayerName(p, players)}</td>
                          <td style={{ ...td2, ...mono, color: T.warn, letterSpacing: '.1em' }}>{p.code || '—'}</td>
                          <td style={td2}>
                            <button onClick={() => regenerateCode(p.id)} title="Gerar novo código"
                              style={{ background: 'none', border: 'none', color: T.mutedDim, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5 }}>
                              <RefreshCw size={12} /> Novo código
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12.5, color: T.mutedDim, padding: '4px 0' }}>
                Códigos ocultos. Clica em "Mostrar" para veres e geres os códigos de acesso de cada atleta.
              </div>
            )}
          </Panel>
        </>
      )}

      <div style={{ height: 16 }} />

      <Panel title="Dados pessoais">
        {/* O RETRATO PRIMEIRO, AS AÇÕES DEPOIS.

            Quem chega aqui costuma vir com uma pergunta concreta — um
            clube que pede os dados, um atleta que saiu. Os números
            respondem antes de se carregar em nada, e são também a única
            forma de a pergunta "ainda faz sentido guardar isto?" chegar a
            ser feita. */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
          {[
            ['Jogadores', retrato.jogadores],
            ['Registos de bem-estar', retrato.wellness],
            ['Ocorrências clínicas', retrato.clinico],
            ['Desenvolvimento', retrato.desenvolvimento],
          ].map(([r, v]) => (
            <div key={r}>
              <div style={{ ...mono, fontSize: 20, color: T.cream }}>{v}</div>
              <div style={{ fontSize: 11.5, color: T.mutedDim }}>{r}</div>
            </div>
          ))}
        </div>

        {retrato.maisAntigo && (
          <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 16, lineHeight: 1.6 }}>
            O registo mais antigo é de {fmtDate(retrato.maisAntigo)}.
            Os dados de bem-estar e do boletim clínico são dados de saúde de menores:
            vale a pena decidir quantos anos os guardas depois de um atleta sair, e cumprir essa decisão.
          </div>
        )}

        <div style={barraAcoes}>
          <Btn variant="ghost" onClick={exportar} style={botaoAcao}><Download size={15} /> Exportar dados desta equipa</Btn>
          {clipesSala.length > 0 && (
            <Btn variant="ghost" onClick={descarregarClipesSala} disabled={!!(zipClipes && zipClipes.aCorrer)} style={botaoAcao}>
              <Download size={15} /> {zipClipes && zipClipes.aCorrer
                ? `A descarregar clipes… ${zipClipes.feitos}/${zipClipes.total}`
                : `Descarregar clipes da Sala de Vídeo (${clipesSala.length})`}
            </Btn>
          )}
          {souDono && (
            <Btn variant="danger" onClick={apagarEquipa} disabled={!souUnico} style={botaoAcao}>
              <Trash2 size={15} /> Apagar equipa e todos os dados
            </Btn>
          )}
        </div>
        {zipClipes && !zipClipes.aCorrer && (
          <div style={{ fontSize: 12, color: zipClipes.erro || zipClipes.falhados ? T.warn : T.good, marginTop: 10 }}>
            {zipClipes.erro || (zipClipes.falhados
              ? `Descarregados ${zipClipes.feitos} de ${zipClipes.total} clipes. ${zipClipes.falhados} não foram encontrados no Storage (estão listados no indice.json dentro do .zip).`
              : `${zipClipes.feitos} clipes descarregados num .zip, com um índice (indice.json). Guarda-o junto da exportação dos dados.`)}
          </div>
        )}
        {souDono && !souUnico && (
          <div style={{ fontSize: 11.5, color: T.mutedDim, marginTop: 10 }}>
            Para apagar a equipa, remove primeiro os outros membros — apagá-la agora destruiria o trabalho deles sem aviso.
          </div>
        )}
      </Panel>
    </div>
  );
}

