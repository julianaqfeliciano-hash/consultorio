import type { SupabaseClient } from '@supabase/supabase-js';
import {
  criarAutenticacaoDemo,
  criarAutenticacaoSupabase,
  ErroAutenticacao,
  traduzirErroDeAutenticacao,
  type Usuario,
} from './autenticacao';

const CREDENCIAIS_ERRADAS = 'E-mail ou senha incorretos.';
const SEM_CONEXAO = 'Sem conexão. Verifique a internet e tente de novo.';

/** Erro parecido com os do Supabase (mesmo `name`, `status` e `code`), sem rede nenhuma. */
function erroFalso(name: string, message: string, status?: number, code?: string) {
  return Object.assign(new Error(message), { name, status, code });
}

describe('traduzirErroDeAutenticacao', () => {
  it('credenciais erradas (AuthApiError 400 invalid_credentials) viram a mensagem de e-mail ou senha', () => {
    const erro = erroFalso('AuthApiError', 'Invalid login credentials', 400, 'invalid_credentials');
    const traduzido = traduzirErroDeAutenticacao(erro);
    expect(traduzido).toBeInstanceOf(ErroAutenticacao);
    expect(traduzido.message).toBe(CREDENCIAIS_ERRADAS);
    expect(traduzido.cause).toBe(erro);
  });

  it('aceita também a resposta antiga do servidor: 400 sem código, só com a mensagem', () => {
    const erro = erroFalso('AuthApiError', 'Invalid login credentials', 400);
    expect(traduzirErroDeAutenticacao(erro).message).toBe(CREDENCIAIS_ERRADAS);
  });

  it('falha de rede (AuthRetryableFetchError) vira "Sem conexão"', () => {
    const erro = erroFalso('AuthRetryableFetchError', 'Failed to fetch', 0);
    expect(traduzirErroDeAutenticacao(erro).message).toBe(SEM_CONEXAO);
  });

  it('o TypeError que o fetch lança sem internet também vira "Sem conexão"', () => {
    expect(traduzirErroDeAutenticacao(new TypeError('Failed to fetch')).message).toBe(SEM_CONEXAO);
  });

  it('qualquer outro erro vira uma mensagem genérica em português', () => {
    const limite = erroFalso('AuthApiError', 'Too many requests', 429, 'over_request_rate_limit');
    const outro400 = erroFalso('AuthApiError', 'Unable to validate email address', 400, 'validation_failed');
    for (const erro of [limite, outro400, new Error('boom'), 'texto solto', null, undefined]) {
      expect(traduzirErroDeAutenticacao(erro).message).toBe('Algo deu errado. Tente de novo em instantes.');
    }
  });

  it('não traduz duas vezes um ErroAutenticacao que já está traduzido', () => {
    const pronto = new ErroAutenticacao('Já em português.');
    expect(traduzirErroDeAutenticacao(pronto)).toBe(pronto);
  });
});

describe('criarAutenticacaoDemo', () => {
  it('está sempre logada como o usuário de demonstração', async () => {
    const auth = criarAutenticacaoDemo();
    const esperado: Usuario = { id: 'demo', email: 'demonstracao@consultorio' };
    expect(await auth.usuarioAtual()).toEqual(esperado);
    // Sem esperar nada: a interface não passa por "Carregando…" no modo demonstração.
    expect(auth.usuarioInicial).toEqual(esperado);
  });

  it('entrar e sair não mudam nada, e aoMudar nunca avisa', async () => {
    const auth = criarAutenticacaoDemo();
    const aviso = vi.fn();
    const parar = auth.aoMudar(aviso);
    await auth.entrar('qualquer@coisa', 'qualquer');
    await auth.sair();
    expect(await auth.usuarioAtual()).toEqual({ id: 'demo', email: 'demonstracao@consultorio' });
    expect(aviso).not.toHaveBeenCalled();
    expect(() => parar()).not.toThrow();
  });
});

type RespostaAuth = { data?: unknown; error: unknown };

/** Cliente Supabase de mentira: só o pedaço `auth` que `criarAutenticacaoSupabase` usa. */
function clienteFalso(respostas: {
  entrar?: () => Promise<RespostaAuth>;
  sair?: () => Promise<{ error: unknown }>;
  sessao?: () => Promise<{ data: { session: { user: { id: string; email?: string } } | null }; error: unknown }>;
} = {}) {
  let aoMudarSupabase: ((evento: string, sessao: { user: { id: string; email?: string } } | null) => void) | undefined;
  const subscription = { unsubscribe: vi.fn() };
  const auth = {
    signInWithPassword: vi.fn(respostas.entrar ?? (async () => ({ data: {}, error: null }))),
    signOut: vi.fn(respostas.sair ?? (async () => ({ error: null }))),
    getSession: vi.fn(respostas.sessao ?? (async () => ({ data: { session: null }, error: null }))),
    onAuthStateChange: vi.fn((cb: NonNullable<typeof aoMudarSupabase>) => {
      aoMudarSupabase = cb;
      return { data: { subscription } };
    }),
  };
  return {
    cliente: { auth } as unknown as SupabaseClient,
    auth,
    subscription,
    emitir: (evento: string, sessao: { user: { id: string; email?: string } } | null) => aoMudarSupabase?.(evento, sessao),
  };
}

describe('criarAutenticacaoSupabase', () => {
  it('entrar manda e-mail e senha ao Supabase', async () => {
    const { cliente, auth } = clienteFalso();
    await criarAutenticacaoSupabase(cliente).entrar('ju@exemplo.com', 'segredo');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'ju@exemplo.com', password: 'segredo' });
  });

  it('entrar traduz o erro devolvido pelo Supabase (credenciais erradas)', async () => {
    const { cliente } = clienteFalso({
      entrar: async () => ({
        data: {},
        error: erroFalso('AuthApiError', 'Invalid login credentials', 400, 'invalid_credentials'),
      }),
    });
    const resultado = criarAutenticacaoSupabase(cliente).entrar('ju@exemplo.com', 'errada');
    await expect(resultado).rejects.toBeInstanceOf(ErroAutenticacao);
    await expect(resultado).rejects.toThrow(CREDENCIAIS_ERRADAS);
  });

  it('entrar traduz o erro lançado quando não há rede', async () => {
    const { cliente } = clienteFalso({
      entrar: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await expect(criarAutenticacaoSupabase(cliente).entrar('ju@exemplo.com', 'x')).rejects.toThrow(SEM_CONEXAO);
  });

  it('sair chama signOut e, se falhar, traduz o erro', async () => {
    const ok = clienteFalso();
    await criarAutenticacaoSupabase(ok.cliente).sair();
    expect(ok.auth.signOut).toHaveBeenCalledTimes(1);

    const semRede = clienteFalso({
      sair: async () => ({ error: erroFalso('AuthRetryableFetchError', 'Failed to fetch', 0) }),
    });
    await expect(criarAutenticacaoSupabase(semRede.cliente).sair()).rejects.toThrow(SEM_CONEXAO);
  });

  it('usuarioAtual devolve id e e-mail da sessão guardada, ou null sem sessão', async () => {
    const logada = clienteFalso({
      sessao: async () => ({ data: { session: { user: { id: 'abc', email: 'ju@exemplo.com' } } }, error: null }),
    });
    expect(await criarAutenticacaoSupabase(logada.cliente).usuarioAtual()).toEqual({ id: 'abc', email: 'ju@exemplo.com' });

    const deslogada = clienteFalso();
    expect(await criarAutenticacaoSupabase(deslogada.cliente).usuarioAtual()).toBeNull();
  });

  it('usuarioAtual trata erro ao recuperar a sessão como "ninguém logada"', async () => {
    const { cliente } = clienteFalso({
      sessao: async () => ({ data: { session: null }, error: erroFalso('AuthRetryableFetchError', 'Failed to fetch', 0) }),
    });
    expect(await criarAutenticacaoSupabase(cliente).usuarioAtual()).toBeNull();
  });

  it('aoMudar repassa o usuário de cada mudança de sessão e devolve a função que cancela', () => {
    const { cliente, emitir, subscription } = clienteFalso();
    const avisos: Array<Usuario | null> = [];
    const parar = criarAutenticacaoSupabase(cliente).aoMudar((u) => avisos.push(u));

    emitir('SIGNED_IN', { user: { id: 'abc', email: 'ju@exemplo.com' } });
    emitir('SIGNED_OUT', null);
    expect(avisos).toEqual([{ id: 'abc', email: 'ju@exemplo.com' }, null]);

    expect(subscription.unsubscribe).not.toHaveBeenCalled();
    parar();
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
