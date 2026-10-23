import '@fontsource/prata/latin-400.css';
import '@fontsource/nunito-sans/latin-400.css';
import '@fontsource/nunito-sans/latin-600.css';
import '@fontsource/nunito-sans/latin-700.css';
import { createClient } from '@supabase/supabase-js';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { config } from './config';
import { criarRepositorioMemoria } from './dados/memoria';
import type { Repositorio } from './dados/repositorio';
import { sementeDemo } from './dados/semente-demo';
import { criarRepositorioSupabase } from './dados/supabase';
import './estilo/global.css';
import { Provedores } from './Provedores';
import { hojeISO } from './regras/datas';

/** Supabase quando as variáveis de ambiente existem; senão, demonstração com dados fictícios. */
function escolherRepositorio(): Repositorio {
  const { modo, supabaseUrl, supabaseChave } = config;
  if (modo === 'supabase' && supabaseUrl && supabaseChave) {
    return criarRepositorioSupabase(createClient(supabaseUrl, supabaseChave));
  }
  return criarRepositorioMemoria(sementeDemo(hojeISO()));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provedores repositorio={escolherRepositorio()}>
      <App />
    </Provedores>
  </StrictMode>,
);
