import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { testarContrato } from './repositorio.contrato';
import { criarRepositorioSupabase } from './supabase';

// Roda contra um projeto Supabase de TESTE (separado do de verdade). Sem as quatro
// variáveis abaixo, a suíte inteira aparece como "skipped".
// (No Vitest, `import.meta.env` também enxerga as variáveis exportadas no terminal.)
const url = import.meta.env.TEST_SUPABASE_URL as string | undefined;
const chave = import.meta.env.TEST_SUPABASE_KEY as string | undefined;
const email = import.meta.env.TEST_SUPABASE_EMAIL as string | undefined;
const senha = import.meta.env.TEST_SUPABASE_SENHA as string | undefined;
const configurado = Boolean(url && chave && email && senha);

const SEM_ID = '00000000-0000-0000-0000-000000000000';

// O corpo do describe roda mesmo quando a suíte é pulada, então o cliente só nasce no beforeAll.
describe.skipIf(!configurado)('Supabase (projeto de teste)', { timeout: 30_000 }, () => {
  let cliente: SupabaseClient;

  beforeAll(async () => {
    cliente = createClient(url!, chave!, { auth: { persistSession: false } });
    const { error } = await cliente.auth.signInWithPassword({ email: email!, password: senha! });
    if (error) throw new Error(`Não foi possível entrar com o usuário de teste: ${error.message}`);
  });

  afterAll(async () => {
    await cliente.auth.signOut();
  });

  /** Apaga tudo que é do usuário de teste (o RLS já limita a ele). */
  async function limparTudo() {
    // Pacientes levam junto responsáveis, horários, avaliações e sessões (on delete cascade).
    for (const [tabela, coluna] of [
      ['pacientes', 'id'],
      ['parceiros', 'id'],
      ['bloqueios', 'id'],
      ['configuracoes', 'dono'],
    ] as const) {
      const { error } = await cliente.from(tabela).delete().neq(coluna, SEM_ID);
      if (error) throw new Error(`Falha ao limpar ${tabela}: ${error.message}`);
    }
  }

  testarContrato('supabase', async () => {
    await limparTudo();
    return criarRepositorioSupabase(cliente);
  });
});
