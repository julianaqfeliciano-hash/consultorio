import '@fontsource/prata/latin-400.css';
import '@fontsource/nunito-sans/latin-400.css';
import '@fontsource/nunito-sans/latin-600.css';
import '@fontsource/nunito-sans/latin-700.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { config } from './config';
import { criarAutenticacaoDemo, criarAutenticacaoSupabase } from './dados/autenticacao';
import { criarClienteSupabase } from './dados/clienteSupabase';
import { criarRepositorioMemoria } from './dados/memoria';
import { sementeDemo } from './dados/semente-demo';
import { criarRepositorioSupabase } from './dados/supabase';
import './estilo/global.css';
import { Provedores } from './Provedores';
import { hojeISO } from './regras/datas';

// Um único cliente Supabase para o repositório e para o login: as consultas rodam com a sessão de quem entrou.
// Sem Supabase configurado não há cliente: demonstração, com dados fictícios e sempre logada.
const cliente = criarClienteSupabase(config);
const modoDemonstracao = cliente === null;
const repositorio = cliente ? criarRepositorioSupabase(cliente) : criarRepositorioMemoria(sementeDemo(hojeISO()));
const autenticacao = cliente ? criarAutenticacaoSupabase(cliente) : criarAutenticacaoDemo();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provedores repositorio={repositorio} autenticacao={autenticacao} modoDemonstracao={modoDemonstracao}>
      <App />
    </Provedores>
  </StrictMode>,
);
