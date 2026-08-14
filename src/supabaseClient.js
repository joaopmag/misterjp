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
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'misterjp-auth',
  },
});
