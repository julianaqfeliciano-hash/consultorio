// @vitest-environment jsdom
import { FunctionsFetchError, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';
import { criarResumidorSupabase, ErroResumo, MENSAGEM_DO_RESUMO, resumidorDemonstracao } from './resumidor';

const CAMPOS = { comoChegou: 'a', trabalhado: 'b', observacoes: 'c', proximosPassos: 'd' };

function clienteCom(resposta: unknown) {
  const invoke = vi.fn(async () => resposta);
  return { cliente: { functions: { invoke } } as unknown as SupabaseClient, invoke };
}

function erroHttp(status: number, corpo: unknown) {
  return new FunctionsHttpError(new Response(JSON.stringify(corpo), { status }));
}

async function codigoDoErro(promessa: Promise<unknown>) {
  const erro = await promessa.then(
    () => null,
    (e: unknown) => e,
  );
  expect(erro).toBeInstanceOf(ErroResumo);
  return (erro as ErroResumo).codigo;
}

describe('criarResumidorSupabase', () => {
  afterEach(() => vi.restoreAllMocks());

  it('200 vira CamposRegistro e envia só o texto', async () => {
    const { cliente, invoke } = clienteCom({ data: { ...CAMPOS, extra: 'x' }, error: null });
    await expect(criarResumidorSupabase(cliente).resumir('texto [P]')).resolves.toEqual(CAMPOS);
    expect(invoke).toHaveBeenCalledWith('resumir-sessao', { body: { texto: 'texto [P]' } });
  });

  it('413 vira texto_longo', async () => {
    const { cliente } = clienteCom({ data: null, error: erroHttp(413, { erro: 'texto_longo' }) });
    expect(await codigoDoErro(criarResumidorSupabase(cliente).resumir('x'))).toBe('texto_longo');
  });

  it('500 sem_chave vira sem_chave', async () => {
    const { cliente } = clienteCom({ data: null, error: erroHttp(500, { erro: 'sem_chave' }) });
    expect(await codigoDoErro(criarResumidorSupabase(cliente).resumir('x'))).toBe('sem_chave');
  });

  it('422 vira recusa', async () => {
    const { cliente } = clienteCom({ data: null, error: erroHttp(422, { erro: 'recusa' }) });
    expect(await codigoDoErro(criarResumidorSupabase(cliente).resumir('x'))).toBe('recusa');
  });

  it('401 nao_autorizado vira sem_login', async () => {
    const { cliente } = clienteCom({ data: null, error: erroHttp(401, { erro: 'nao_autorizado' }) });
    expect(await codigoDoErro(criarResumidorSupabase(cliente).resumir('x'))).toBe('sem_login');
  });

  it('erro de rede vira sem_internet', async () => {
    const { cliente } = clienteCom({ data: null, error: new FunctionsFetchError(new TypeError('Failed to fetch')) });
    expect(await codigoDoErro(criarResumidorSupabase(cliente).resumir('x'))).toBe('sem_internet');
  });

  it('navigator.onLine falso vira sem_internet sem chamar a função', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { cliente, invoke } = clienteCom({ data: CAMPOS, error: null });
    expect(await codigoDoErro(criarResumidorSupabase(cliente).resumir('x'))).toBe('sem_internet');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('outro erro vira falha', async () => {
    const { cliente } = clienteCom({ data: null, error: erroHttp(502, { erro: 'falha_claude' }) });
    expect(await codigoDoErro(criarResumidorSupabase(cliente).resumir('x'))).toBe('falha');
  });

  it('resposta sem JSON ou com campos faltando vira falha', async () => {
    const semJson = new FunctionsHttpError(new Response('<html>', { status: 500 }));
    expect(
      await codigoDoErro(criarResumidorSupabase(clienteCom({ data: null, error: semJson }).cliente).resumir('x')),
    ).toBe('falha');
    expect(
      await codigoDoErro(criarResumidorSupabase(clienteCom({ data: { comoChegou: 'a' }, error: null }).cliente).resumir('x')),
    ).toBe('falha');
  });

  it('invoke que lança erro de rede vira sem_internet', async () => {
    const cliente = {
      functions: {
        invoke: vi.fn(async () => {
          throw new TypeError('Failed to fetch');
        }),
      },
    } as unknown as SupabaseClient;
    expect(await codigoDoErro(criarResumidorSupabase(cliente).resumir('x'))).toBe('sem_internet');
  });
});

describe('MENSAGEM_DO_RESUMO', () => {
  it('tem a mensagem exata de cada código', () => {
    expect(MENSAGEM_DO_RESUMO).toEqual({
      sem_internet: 'Sem internet agora. O texto ficou guardado neste aparelho; tente de novo quando a conexão voltar.',
      sem_login: 'Sua entrada no sistema expirou. Saia e entre de novo para resumir.',
      texto_longo: 'O texto está longo demais para resumir de uma vez (máximo de 20.000 caracteres).',
      sem_chave: 'O resumo com o Claude ainda não foi ligado. Veja o passo 1.7 do guia de instalação.',
      recusa: 'O Claude não quis resumir este texto. Escreva o registro à mão ou ajuste o texto e tente de novo.',
      falha: 'O Claude não conseguiu resumir agora. O texto continua aqui; tente de novo.',
    });
  });
});

describe('resumidorDemonstracao', () => {
  it('devolve campos fictícios que começam com (demonstração) e usam [P]', async () => {
    vi.useFakeTimers();
    const promessa = resumidorDemonstracao.resumir('qualquer');
    await vi.advanceTimersByTimeAsync(400);
    const campos = await promessa;
    vi.useRealTimers();
    expect(campos.comoChegou.startsWith('(demonstração)')).toBe(true);
    expect(Object.values(campos).join(' ')).toContain('[P]');
  });
});
