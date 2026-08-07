import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fica visível na consola se esquecermos de configurar o .env
  console.warn(
    'Supabase não configurado: define VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ficheiro .env'
  );
}

export const supabase = createClient(url, anonKey);
