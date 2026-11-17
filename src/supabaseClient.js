import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fica visível na consola se esquecermos de configurar o .env
  console.warn(
    'Supabase não configurado: define VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ficheiro .env'
  );
}

/* OPÇÕES DE SESSÃO — explícitas de propósito.

   Estes três valores já são o comportamento por omissão do supabase-js v2,
   por isso escrevê-los não muda nada hoje. Ficam escritos por dois motivos:

   1. As omissões mudaram entre versões do SDK. Uma atualização futura que
      altere um destes valores tira a app do ar de uma forma difícil de
      diagnosticar (o sintoma é conteúdo a aparecer vazio, não um erro).
   2. Documentam a intenção: a sessão do treinador PERSISTE entre visitas e
      o token renova-se sozinho. Quem ler este ficheiro daqui a um ano não
      tem de ir confirmar omissões à documentação.

   `storageKey` fixa o nome da chave no localStorage. Sem ele, o SDK deriva
   o nome do URL do projeto — se o projeto Supabase mudar, toda a gente é
   deslogada sem aviso. */
/* A SESSÃO NUNCA FICA SEM SÍTIO (17/11).
   O token do staff vive no armazenamento do browser (localStorage), que é
   o MESMO para a app e para o Portal (mesmo endereço) e tem um limite
   (~5 MB). As cópias rápidas da app (Sala do Portal, cacifo, vídeos
   juntos…) podem enchê-lo. Cheio, o Supabase não consegue guardar o token
   renovado e, ao recarregar (ex.: depois de publicar uma versão nova), a
   sessão já não vale: "Sem sessão válida" e volta a pedir a entrada.
   Aqui: se a escrita falhar, apagam-se essas cópias (refazem-se sozinhas)
   e tenta-se outra vez. E ao abrir, se o armazenamento estiver quase
   cheio, limpa-se logo. */
const CACHES_APAGAVEIS = [/^misterjp:portal-bib:/, /^misterjp:cacifo:/, /^misterjp:compilacoes:.*:(servidor|mp4)$/];
export function limparCachesDaApp() {
  try {
    const apagar = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && CACHES_APAGAVEIS.some(re => re.test(k))) apagar.push(k);
    }
    apagar.forEach(k => localStorage.removeItem(k));
    return apagar.length;
  } catch (e) { return 0; }
}
try {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i) || ''; total += k.length + (localStorage.getItem(k) || '').length; }
  if (total > 3500000) limparCachesDaApp(); // ~3,5 M carateres: perto do limite
} catch (e) { /* sem armazenamento */ }
const armazenamentoSessao = {
  getItem: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  setItem: (k, v) => {
    try { localStorage.setItem(k, v); } catch (e) {
      limparCachesDaApp();
      try { localStorage.setItem(k, v); } catch (e2) { console.warn('Sessão: o armazenamento do browser está cheio.'); }
    }
  },
  removeItem: (k) => { try { localStorage.removeItem(k); } catch (e) { /* nada */ } },
};

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'misterjp-auth',
    storage: typeof window !== 'undefined' ? armazenamentoSessao : undefined,
  },
});
