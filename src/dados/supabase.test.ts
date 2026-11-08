import type { SupabaseClient } from '@supabase/supabase-js';
import { RecusaDoRepositorio } from './repositorio';
import { buscarTodas, criarRepositorioSupabase, traduzirErroDoBanco } from './supabase';

const resposta = (n: number) => ({ data: Array.from({ length: n }, (_, i) => ({ i })), error: null });

describe('buscarTodas', () => {
  it('pede de 1000 em 1000, avançando pelo que veio, até uma página vazia: 1000, 1000 e 3 linhas são 2003 linhas', async () => {
    const paginas = [resposta(1000), resposta(1000), resposta(3), resposta(0)];
    const fabrica = vi.fn<(de: number, ate: number) => Promise<ReturnType<typeof resposta>>>(async () => paginas.shift()!);

    const linhas = await buscarTodas<{ i: number }>(fabrica);

    expect(linhas).toHaveLength(2003);
    // `.range(de, ate)` tem os dois limites incluídos; cada pedido começa onde o anterior parou.
    expect(fabrica.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
      [2003, 3002],
    ]);
  });

  it('se o projeto entrega menos de 1000 linhas por pedido (max_rows menor), não perde nenhuma', async () => {
    const pagina = (de: number, n: number) => ({ data: Array.from({ length: n }, (_, i) => de + i), error: null });
    const paginas = [pagina(0, 500), pagina(500, 500), pagina(1000, 3), pagina(1003, 0)];
    const fabrica = vi.fn<(de: number, ate: number) => Promise<ReturnType<typeof pagina>>>(async () => paginas.shift()!);

    const linhas = await buscarTodas<number>(fabrica);

    expect(linhas).toEqual(Array.from({ length: 1003 }, (_, i) => i));
    expect(fabrica.mock.calls).toEqual([
      [0, 999],
      [500, 1499],
      [1000, 1999],
      [1003, 2002],
    ]);
  });

  it('uma página incompleta ainda pergunta pela seguinte, que vem vazia', async () => {
    const paginas = [resposta(12), resposta(0)];
    const fabrica = vi.fn(async () => paginas.shift()!);
    expect(await buscarTodas(fabrica)).toHaveLength(12);
    expect(fabrica.mock.calls).toEqual([
      [0, 999],
      [12, 1011],
    ]);
  });

  it('sem nenhuma linha, devolve lista vazia num pedido só', async () => {
    const fabrica = vi.fn(async () => resposta(0));
    expect(await buscarTodas(fabrica)).toEqual([]);
    expect(fabrica).toHaveBeenCalledTimes(1);
  });

  it('com exatamente 1000 linhas ainda pergunta pela página seguinte, que vem vazia', async () => {
    const paginas = [resposta(1000), resposta(0)];
    const fabrica = vi.fn(async () => paginas.shift()!);
    expect(await buscarTodas(fabrica)).toHaveLength(1000);
    expect(fabrica).toHaveBeenCalledTimes(2);
  });

  it('mantém a ordem das páginas', async () => {
    const pagina = (de: number, n: number) => ({ data: Array.from({ length: n }, (_, i) => de + i), error: null });
    const paginas = [pagina(0, 1000), pagina(1000, 5), pagina(1005, 0)];
    const linhas = await buscarTodas<number>(async () => paginas.shift()!);
    expect(linhas).toEqual(Array.from({ length: 1005 }, (_, i) => i));
  });

  it('para no erro e o lança', async () => {
    const respostas = [resposta(1000), { data: null, error: { message: 'falha de rede' } }];
    const fabrica = vi.fn(async () => respostas.shift()!);
    await expect(buscarTodas(fabrica)).rejects.toThrow('falha de rede');
    expect(fabrica).toHaveBeenCalledTimes(2);
  });

  it('aceita uma consulta do Supabase, que só é executada quando recebe await (thenable)', async () => {
    const tamanhos = [7, 0];
    const consulta = (): PromiseLike<ReturnType<typeof resposta>> => ({
      then: (ok, falha) => Promise.resolve(resposta(tamanhos.shift() ?? 0)).then(ok, falha),
    });
    expect(await buscarTodas(() => consulta())).toHaveLength(7);
  });
});

describe('traduzirErroDoBanco', () => {
  // Textos como o Postgres (e o PostgREST) devolvem de verdade.
  const sessaoJaPaga = {
    code: '23505',
    message: 'duplicate key value violates unique constraint "pagamento_sessoes_sessao_id_key"',
    details: 'Key (sessao_id)=(11111111-1111-4111-8111-111111111111) already exists.',
  };
  const mesmaSessaoDuasVezes = {
    code: '23505',
    message: 'duplicate key value violates unique constraint "pagamento_sessoes_pkey"',
    details: null,
  };
  const sessaoPagaNaoSai = {
    code: '23001',
    message:
      'update or delete on table "sessoes" violates RESTRICT setting of foreign key constraint "pagamento_sessoes_sessao_id_fkey" on table "pagamento_sessoes"',
    details: 'Key is referenced from table "pagamento_sessoes".',
  };

  it('sessão já paga (unique em sessao_id e chave repetida na mesma chamada) vira uma recusa em português', () => {
    for (const erro of [sessaoJaPaga, mesmaSessaoDuasVezes]) {
      const traduzido = traduzirErroDoBanco(erro);
      expect(traduzido).toBeInstanceOf(RecusaDoRepositorio);
      expect(traduzido.message).toBe('Esta sessão já foi paga.');
    }
  });

  it('sessão paga não pode ser removida', () => {
    const traduzido = traduzirErroDoBanco(sessaoPagaNaoSai);
    expect(traduzido).toBeInstanceOf(RecusaDoRepositorio);
    expect(traduzido.message).toBe('Esta sessão já foi paga e não pode ser removida.');
  });

  it('a recusa levantada por uma função do banco (raise exception) chega com o texto dela', () => {
    const levantada = { code: 'P0001', message: 'Escolha só sessões em aberto deste paciente.', details: null };
    const traduzido = traduzirErroDoBanco(levantada);
    expect(traduzido).toBeInstanceOf(RecusaDoRepositorio);
    expect(traduzido.message).toBe('Escolha só sessões em aberto deste paciente.');
  });

  it('guarda o erro original como causa', () => {
    expect(traduzirErroDoBanco(sessaoJaPaga).cause).toBe(sessaoJaPaga);
  });

  it('outros erros seguem com a mensagem do banco, como erro comum (não recusa)', () => {
    const outro = { code: '23514', message: 'new row for relation "pagamentos" violates check constraint "x"' };
    expect(traduzirErroDoBanco(outro).message).toBe(outro.message);
    expect(traduzirErroDoBanco(outro)).not.toBeInstanceOf(RecusaDoRepositorio);
    const outroUnico = { code: '23505', message: 'duplicate key value violates unique constraint "sessoes_horario_fixo_id_data_ocorrencia_key"' };
    expect(traduzirErroDoBanco(outroUnico).message).toBe(outroUnico.message);
    expect(traduzirErroDoBanco(outroUnico)).not.toBeInstanceOf(RecusaDoRepositorio);
  });
});

/**
 * Um cliente de mentira: qualquer cadeia de chamadas (`from().select().eq()...`) é anotada em
 * `chamadas` e, ao receber `await`, devolve a próxima resposta da fila. Não prova o SQL (isso é
 * com o contrato contra o projeto de teste), mas prova o que o repositório pede ao Supabase.
 */
function clienteFalso(respostas: { data: unknown; error: unknown }[]) {
  const chamadas: { metodo: string; args: unknown[] }[] = [];
  const consulta: unknown = new Proxy(() => undefined, {
    get(_alvo, metodo) {
      if (metodo === 'then') {
        return (ok: (r: unknown) => unknown, falha: (e: unknown) => unknown) =>
          Promise.resolve(respostas.shift()).then(ok, falha);
      }
      return (...args: unknown[]) => {
        chamadas.push({ metodo: String(metodo), args });
        return consulta;
      };
    },
  });
  const argumentosDe = (metodo: string) => chamadas.filter((c) => c.metodo === metodo).map((c) => c.args);
  return { cliente: consulta as SupabaseClient, chamadas, argumentosDe };
}

const linhaDePagamento = (n: number) => ({
  id: `pagamento-${n}`,
  paciente_id: 'paciente-1',
  data: '2026-10-20',
  valor_centavos: 18000,
  forma: 'pix',
  observacao: null,
  referencia: 'sessoes',
  mes_referencia: null,
  avaliacao_id: null,
  pagamento_sessoes: [{ sessao_id: `sessao-${n}` }],
});

describe('repositório Supabase (o que ele pede ao cliente)', () => {
  it('listarPagamentos pagina de 1000 em 1000, com ordem total e os filtros pedidos', async () => {
    const pagina = (de: number, n: number) => ({
      data: Array.from({ length: n }, (_, i) => linhaDePagamento(de + i)),
      error: null,
    });
    const { cliente, argumentosDe } = clienteFalso([pagina(0, 1000), pagina(1000, 3), pagina(1003, 0)]);

    const lista = await criarRepositorioSupabase(cliente).listarPagamentos({
      pacienteId: 'paciente-1',
      de: '2026-10-01',
      ate: '2026-10-31',
    });

    expect(lista).toHaveLength(1003);
    expect(lista[0]).toMatchObject({ id: 'pagamento-0', sessaoIds: ['sessao-0'] });
    expect(argumentosDe('range')).toEqual([
      [0, 999],
      [1000, 1999],
      [1003, 2002],
    ]);
    expect(argumentosDe('select')[0]).toEqual(['*, pagamento_sessoes(sessao_id)']);
    expect(argumentosDe('eq')[0]).toEqual(['paciente_id', 'paciente-1']);
    expect(argumentosDe('gte')[0]).toEqual(['data', '2026-10-01']);
    expect(argumentosDe('lte')[0]).toEqual(['data', '2026-10-31']);
    // Por data, depois por criação, e `id` por último para a paginação nunca repetir nem pular linha.
    expect(argumentosDe('order').slice(0, 3)).toEqual([['data'], ['criado_em'], ['id']]);
  });

  it('listarPagamentos recusa data fora do formato antes de pedir qualquer coisa', async () => {
    const { cliente, chamadas } = clienteFalso([]);
    await expect(criarRepositorioSupabase(cliente).listarPagamentos({ de: '01/10/2026' })).rejects.toThrow('Data inválida');
    expect(chamadas.some((c) => c.metodo === 'range')).toBe(false);
  });

  it('registrarPagamento manda os nove parâmetros p_* à função e relê o pagamento com as ligações', async () => {
    const { cliente, chamadas, argumentosDe } = clienteFalso([
      { data: { ...linhaDePagamento(1), pagamento_sessoes: undefined }, error: null },
      { data: { ...linhaDePagamento(1), pagamento_sessoes: [{ sessao_id: 'sessao-b' }, { sessao_id: 'sessao-a' }] }, error: null },
    ]);

    const pago = await criarRepositorioSupabase(cliente).registrarPagamento({
      pacienteId: 'paciente-1',
      data: '2026-10-20',
      valorCentavos: 18000,
      forma: 'pix',
      observacao: null,
      referencia: 'sessoes',
      mesReferencia: null,
      avaliacaoId: null,
      sessaoIds: ['sessao-b', 'sessao-a'],
    });

    expect(argumentosDe('rpc')).toEqual([
      [
        'registrar_pagamento',
        {
          p_paciente_id: 'paciente-1',
          p_data: '2026-10-20',
          p_valor_centavos: 18000,
          p_forma: 'pix',
          p_observacao: null,
          p_referencia: 'sessoes',
          p_mes_referencia: null,
          p_avaliacao_id: null,
          p_sessao_ids: ['sessao-b', 'sessao-a'],
        },
      ],
    ]);
    const enviados = argumentosDe('rpc')[0][1] as Record<string, unknown>;
    expect(Object.keys(enviados)).toHaveLength(9);
    expect(Object.values(enviados)).not.toContain(undefined);
    // Depois da função, relê pelo id com as ligações embutidas.
    expect(chamadas.map((c) => c.metodo)).toEqual(['rpc', 'from', 'select', 'eq', 'single']);
    expect(argumentosDe('eq')).toEqual([['id', 'pagamento-1']]);
    expect(pago).toMatchObject({ id: 'pagamento-1', sessaoIds: ['sessao-a', 'sessao-b'] });
  });

  it('registrarPagamento traduz a violação de unicidade do banco para a mensagem em português', async () => {
    const { cliente } = clienteFalso([
      {
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "pagamento_sessoes_sessao_id_key"',
          details: 'Key (sessao_id)=(x) already exists.',
        },
      },
    ]);
    const recusa = criarRepositorioSupabase(cliente).registrarPagamento({
      pacienteId: 'paciente-1',
      data: '2026-10-20',
      valorCentavos: 18000,
      forma: 'pix',
      observacao: null,
      referencia: 'sessoes',
      mesReferencia: null,
      avaliacaoId: null,
      sessaoIds: ['x'],
    });
    await expect(recusa).rejects.toThrow('Esta sessão já foi paga.');
    await expect(recusa).rejects.toBeInstanceOf(RecusaDoRepositorio);
  });

  it('listarSessoesCobradas pede só as sessões com valor, com o paciente, em ordem total, página a página', async () => {
    const linha = (n: number, pacientes: unknown) => ({
      id: `sessao-${n}`,
      paciente_id: 'paciente-1',
      inicio: '2026-10-06T17:00:00+00:00',
      duracao_min: 50,
      tipo: 'psicoterapia',
      acompanhamento_familiar: false,
      origem: 'avulsa',
      horario_fixo_id: null,
      data_ocorrencia: null,
      situacao: 'compareceu',
      remarcada_para: null,
      avaliacao_id: null,
      confirmada: true,
      observacao: null,
      valor_centavos: 18000,
      pacientes,
    });
    const paciente = { nome: 'Ana', responsaveis: [{ nome: 'Mariana', telefone: null, principal: true }] };
    const { cliente, argumentosDe } = clienteFalso([
      { data: Array.from({ length: 1000 }, (_, i) => linha(i, paciente)), error: null },
      { data: [linha(1000, null)], error: null },
      { data: [], error: null },
    ]);

    const lista = await criarRepositorioSupabase(cliente).listarSessoesCobradas();

    expect(lista).toHaveLength(1001);
    expect(lista[0]).toMatchObject({ pacienteNome: 'Ana', responsavelPrincipal: { nome: 'Mariana', telefone: '' } });
    expect(lista[1000]).toMatchObject({ pacienteNome: '', responsavelPrincipal: null });
    expect(argumentosDe('not')).toEqual([
      ['valor_centavos', 'is', null],
      ['valor_centavos', 'is', null],
      ['valor_centavos', 'is', null],
    ]);
    expect(argumentosDe('order').slice(0, 2)).toEqual([['inicio'], ['id']]);
    expect(argumentosDe('range')).toEqual([[0, 999], [1000, 1999], [1001, 2000]]);
  });

  it('removerPagamento apaga pelo id; apagar sessão paga mostra a mensagem em português', async () => {
    const { cliente, argumentosDe } = clienteFalso([
      { data: null, error: null },
      {
        data: null,
        error: {
          code: '23001',
          message:
            'update or delete on table "sessoes" violates RESTRICT setting of foreign key constraint "pagamento_sessoes_sessao_id_fkey" on table "pagamento_sessoes"',
          details: 'Key is referenced from table "pagamento_sessoes".',
        },
      },
    ]);
    const repo = criarRepositorioSupabase(cliente);
    await repo.removerPagamento('pagamento-1');
    expect(argumentosDe('from')[0]).toEqual(['pagamentos']);
    expect(argumentosDe('eq')[0]).toEqual(['id', 'pagamento-1']);
    await expect(repo.removerSessoes(['sessao-1'])).rejects.toThrow('Esta sessão já foi paga e não pode ser removida.');
  });
});
