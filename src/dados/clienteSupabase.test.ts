import { criarClienteSupabase } from './clienteSupabase';

describe('criarClienteSupabase', () => {
  it('no modo demonstração não cria cliente', () => {
    expect(criarClienteSupabase({ modo: 'demonstracao' })).toBeNull();
  });

  it('no modo Supabase cria o cliente com a URL e a chave configuradas', () => {
    const cliente = criarClienteSupabase({
      modo: 'supabase',
      supabaseUrl: 'https://abc.supabase.co',
      supabaseChave: 'sb_publishable_x',
    });
    expect(cliente).not.toBeNull();
    expect(typeof cliente?.auth.signInWithPassword).toBe('function');
    expect(typeof cliente?.from).toBe('function');
  });
});
