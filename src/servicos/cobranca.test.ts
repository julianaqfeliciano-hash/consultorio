import { describe, expect, it } from 'vitest';
import { criarRepositorioMemoria } from '../dados/memoria';
import type { Repositorio } from '../dados/repositorio';
import { sementeDemo } from '../dados/semente-demo';
import { formatarReais } from '../regras/dinheiro';
import { avaliacaoExemplo, pacienteExemplo, sessaoExemplo } from '../testes/fabricas';
import { marcarSituacao } from './agenda';
import { agendarReposicao, ErroCobranca, registrarPagamento, removerPagamento } from './cobranca';

const HOJE = '2026-11-02';
const ANA = 'demo-paciente-ana';
const MARIA = 'demo-paciente-maria';
const PEDRO = 'demo-paciente-pedro';

const repoDemo = () => criarRepositorioMemoria(sementeDemo(HOJE));

/** A mensagem de erro de uma chamada que deve rejeitar com `ErroCobranca`. */
async function erroDe(chamada: Promise<unknown>): Promise<string> {
  try {
    await chamada;
  } catch (e) {
    expect(e).toBeInstanceOf(ErroCobranca);
    return (e as Error).message;
  }
  throw new Error('Era para rejeitar, mas a chamada deu certo.');
}

const COMUM = { data: '2026-11-02', forma: 'pix', observacao: null } as const;
const SO_ABERTAS = 'Escolha só sessões em aberto deste paciente.';

describe('registrarPagamento de sessões', () => {
  it('o valor é a soma dos valores guardados nas sessões', async () => {
    // Duas sessões a R$ 200,00 e uma de R$ 220,00 (depois de um reajuste): o pagamento soma o que cada uma guardou.
    const repo = criarRepositorioMemoria({
      pacientes: [pacienteExemplo()],
      sessoes: [
        sessaoExemplo({ id: 'a', inicio: '2026-10-06T17:00:00.000Z', situacao: 'compareceu', valorCentavos: 20000 }),
        sessaoExemplo({ id: 'b', inicio: '2026-10-13T17:00:00.000Z', situacao: 'compareceu', valorCentavos: 20000 }),
        sessaoExemplo({ id: 'c', inicio: '2026-10-20T17:00:00.000Z', situacao: 'falta_sem_aviso', valorCentavos: 22000 }),
      ],
    });

    const pagamento = await registrarPagamento(
      repo,
      { ...COMUM, pacienteId: 'p1', referencia: 'sessoes', sessaoIds: ['a', 'c'] },
      HOJE,
    );

    expect(pagamento).toEqual({
      id: expect.any(String),
      pacienteId: 'p1',
      data: '2026-11-02',
      valorCentavos: 42000,
      forma: 'pix',
      observacao: null,
      referencia: 'sessoes',
      mesReferencia: null,
      avaliacaoId: null,
      sessaoIds: ['a', 'c'],
    });
    expect(await repo.listarPagamentos({ pacienteId: 'p1' })).toEqual([pagamento]);
  });

  it('guarda a forma, a data e a observação que vieram', async () => {
    const repo = repoDemo();
    const pagamento = await registrarPagamento(
      repo,
      {
        pacienteId: MARIA,
        data: '2026-11-01',
        forma: 'dinheiro',
        observacao: 'Entregue em mãos',
        referencia: 'sessoes',
        sessaoIds: ['demo-sessao-maria-2'],
      },
      HOJE,
    );
    expect(pagamento).toMatchObject({
      valorCentavos: 18000,
      data: '2026-11-01',
      forma: 'dinheiro',
      observacao: 'Entregue em mãos',
    });
  });

  it('sessão repetida na lista conta uma vez só', async () => {
    const repo = repoDemo();
    const pagamento = await registrarPagamento(
      repo,
      { ...COMUM, pacienteId: MARIA, referencia: 'sessoes', sessaoIds: ['demo-sessao-maria-2', 'demo-sessao-maria-2'] },
      HOJE,
    );
    expect(pagamento.valorCentavos).toBe(18000);
    expect(pagamento.sessaoIds).toEqual(['demo-sessao-maria-2']);
  });

  it('rejeita sessão de outro paciente, sem gravar nada', async () => {
    const repo = repoDemo();
    const antes = await repo.listarPagamentos();

    const mensagem = await erroDe(
      registrarPagamento(repo, { ...COMUM, pacienteId: ANA, referencia: 'sessoes', sessaoIds: ['demo-sessao-maria-2'] }, HOJE),
    );

    expect(mensagem).toBe(SO_ABERTAS);
    expect(await repo.listarPagamentos()).toEqual(antes);
  });

  it('rejeita sessão sem valor (comparecimento na avaliação faz parte do pacote)', async () => {
    const repo = repoDemo();
    const mensagem = await erroDe(
      registrarPagamento(repo, { ...COMUM, pacienteId: PEDRO, referencia: 'sessoes', sessaoIds: ['demo-sessao-pedro-1'] }, HOJE),
    );
    expect(mensagem).toBe(SO_ABERTAS);
  });

  it('rejeita sessão que já foi paga, e uma lista com uma boa e uma ruim não paga nenhuma', async () => {
    const repo = criarRepositorioMemoria(sementeDemo(HOJE));
    expect(
      await erroDe(
        registrarPagamento(repo, { ...COMUM, pacienteId: MARIA, referencia: 'sessoes', sessaoIds: ['demo-sessao-maria-1'] }, HOJE),
      ),
    ).toBe(SO_ABERTAS);

    const antes = await repo.listarPagamentos();
    expect(
      await erroDe(
        registrarPagamento(
          repo,
          { ...COMUM, pacienteId: MARIA, referencia: 'sessoes', sessaoIds: ['demo-sessao-maria-2', 'demo-sessao-maria-1'] },
          HOJE,
        ),
      ),
    ).toBe(SO_ABERTAS);
    expect(await repo.listarPagamentos()).toEqual(antes);
  });

  it('rejeita lista vazia e sessão que não existe', async () => {
    const repo = repoDemo();
    expect(await erroDe(registrarPagamento(repo, { ...COMUM, pacienteId: MARIA, referencia: 'sessoes', sessaoIds: [] }, HOJE))).toBe(
      SO_ABERTAS,
    );
    expect(
      await erroDe(registrarPagamento(repo, { ...COMUM, pacienteId: MARIA, referencia: 'sessoes', sessaoIds: ['fantasma'] }, HOJE)),
    ).toBe(SO_ABERTAS);
  });

  it('rejeita sessão de quem paga por mês (ela entra na mensalidade)', async () => {
    const repo = repoDemo();
    const mensagem = await erroDe(
      registrarPagamento(repo, { ...COMUM, pacienteId: ANA, referencia: 'sessoes', sessaoIds: ['demo-sessao-ana-1'] }, HOJE),
    );
    expect(mensagem).toBe(SO_ABERTAS);
  });

  it('a falta sem aviso da avaliação é cobrada à parte e pode ser paga', async () => {
    const repo = repoDemo();
    const sessao = (await repo.listarSessoesDoPaciente(PEDRO))[2];
    const marcada = await marcarSituacao(repo, sessao, 'falta_sem_aviso');
    expect(marcada.valorCentavos).toBe(16000);

    const pagamento = await registrarPagamento(
      repo,
      { ...COMUM, pacienteId: PEDRO, referencia: 'sessoes', sessaoIds: [sessao.id] },
      HOJE,
    );
    expect(pagamento).toMatchObject({ valorCentavos: 16000, referencia: 'sessoes', sessaoIds: [sessao.id] });
  });
});

describe('registrarPagamento de mês', () => {
  it('o valor é o total do mês, não importa o que a tela mostrava', async () => {
    const repo = repoDemo();

    const pagamento = await registrarPagamento(
      repo,
      { ...COMUM, pacienteId: ANA, referencia: 'mes', mes: '2026-10-01' },
      HOJE,
    );

    expect(pagamento).toMatchObject({
      pacienteId: ANA,
      valorCentavos: 80000,
      referencia: 'mes',
      mesReferencia: '2026-10-01',
      avaliacaoId: null,
      sessaoIds: [],
    });
    expect(await repo.listarPagamentos({ pacienteId: ANA })).toEqual([pagamento]);
  });

  it('qualquer dia do mês serve: o pagamento fica no dia 1', async () => {
    const repo = repoDemo();
    const pagamento = await registrarPagamento(
      repo,
      { ...COMUM, pacienteId: ANA, referencia: 'mes', mes: '2026-10-17' },
      HOJE,
    );
    expect(pagamento.mesReferencia).toBe('2026-10-01');
  });

  it('o total soma o valor que cada sessão guardou (reajuste não muda o passado)', async () => {
    const repo = criarRepositorioMemoria({
      pacientes: [pacienteExemplo({ formaCobranca: 'mensal', valorSessaoCentavos: 25000 })],
      sessoes: [
        sessaoExemplo({ id: 'a', inicio: '2026-10-06T17:00:00.000Z', situacao: 'compareceu', valorCentavos: 20000 }),
        sessaoExemplo({ id: 'b', inicio: '2026-10-13T17:00:00.000Z', situacao: 'compareceu', valorCentavos: 20000 }),
        sessaoExemplo({ id: 'c', inicio: '2026-10-20T17:00:00.000Z', situacao: 'compareceu', valorCentavos: 22000 }),
      ],
    });
    const pagamento = await registrarPagamento(
      repo,
      { ...COMUM, pacienteId: 'p1', referencia: 'mes', mes: '2026-10-01' },
      HOJE,
    );
    expect(pagamento.valorCentavos).toBe(62000);
  });

  it('rejeita mês que já foi pago e continua havendo um pagamento só', async () => {
    const repo = repoDemo();
    await registrarPagamento(repo, { ...COMUM, pacienteId: ANA, referencia: 'mes', mes: '2026-10-01' }, HOJE);

    const mensagem = await erroDe(
      registrarPagamento(repo, { ...COMUM, pacienteId: ANA, referencia: 'mes', mes: '2026-10-01' }, HOJE),
    );

    expect(mensagem).toBe('Este mês já foi pago.');
    expect(await repo.listarPagamentos({ pacienteId: ANA })).toHaveLength(1);
  });

  it('rejeita mês sem nada a receber', async () => {
    const repo = repoDemo();
    const mensagem = await erroDe(
      registrarPagamento(repo, { ...COMUM, pacienteId: ANA, referencia: 'mes', mes: '2026-09-01' }, HOJE),
    );
    expect(mensagem).toBe('Este mês não tem nada a receber.');
    expect(await repo.listarPagamentos({ pacienteId: ANA })).toEqual([]);
  });

  it('rejeita mês de quem não paga por mês', async () => {
    const repo = repoDemo();
    const mensagem = await erroDe(
      registrarPagamento(repo, { ...COMUM, pacienteId: MARIA, referencia: 'mes', mes: '2026-10-01' }, HOJE),
    );
    expect(mensagem).toBe('Este mês não tem nada a receber.');
  });
});

describe('registrarPagamento da avaliação', () => {
  // Pedro: pacote de R$ 1.620,00, já pagou R$ 810,00. Faltam R$ 810,00.
  it('aceita o valor informado quando cabe no que falta', async () => {
    const repo = repoDemo();

    const pagamento = await registrarPagamento(
      repo,
      { ...COMUM, pacienteId: PEDRO, referencia: 'avaliacao', valorCentavos: 30000 },
      HOJE,
    );

    expect(pagamento).toMatchObject({
      pacienteId: PEDRO,
      valorCentavos: 30000,
      referencia: 'avaliacao',
      avaliacaoId: 'demo-avaliacao-pedro',
      mesReferencia: null,
      sessaoIds: [],
    });
  });

  it('aceita exatamente o que falta', async () => {
    const repo = repoDemo();
    const pagamento = await registrarPagamento(
      repo,
      { ...COMUM, pacienteId: PEDRO, referencia: 'avaliacao', valorCentavos: 81000 },
      HOJE,
    );
    expect(pagamento.valorCentavos).toBe(81000);
  });

  it('rejeita valor acima do que falta, com a mensagem exata', async () => {
    const repo = repoDemo();
    const antes = await repo.listarPagamentos();

    const mensagem = await erroDe(
      registrarPagamento(repo, { ...COMUM, pacienteId: PEDRO, referencia: 'avaliacao', valorCentavos: 81001 }, HOJE),
    );

    expect(mensagem).toBe(`O valor passa do que falta do pacote: ${formatarReais(81000)}.`);
    expect(mensagem).toContain('810,00');
    expect(await repo.listarPagamentos()).toEqual(antes);
  });

  it('o que falta desconta os pagamentos anteriores', async () => {
    const repo = repoDemo();
    await registrarPagamento(repo, { ...COMUM, pacienteId: PEDRO, referencia: 'avaliacao', valorCentavos: 81000 }, HOJE);

    const mensagem = await erroDe(
      registrarPagamento(repo, { ...COMUM, pacienteId: PEDRO, referencia: 'avaliacao', valorCentavos: 100 }, HOJE),
    );

    expect(mensagem).toBe(`O valor passa do que falta do pacote: ${formatarReais(0)}.`);
  });

  it('rejeita valor zero, negativo ou quebrado', async () => {
    const repo = repoDemo();
    for (const valorCentavos of [0, -100, 100.5]) {
      expect(
        await erroDe(registrarPagamento(repo, { ...COMUM, pacienteId: PEDRO, referencia: 'avaliacao', valorCentavos }, HOJE)),
      ).toBe(`O valor passa do que falta do pacote: ${formatarReais(81000)}.`);
    }
  });

  it('rejeita paciente sem avaliação', async () => {
    const repo = repoDemo();
    const mensagem = await erroDe(
      registrarPagamento(repo, { ...COMUM, pacienteId: ANA, referencia: 'avaliacao', valorCentavos: 10000 }, HOJE),
    );
    expect(mensagem).toBe('Este paciente não tem avaliação.');
  });

  it('o pagamento vale para a avaliação atual do paciente', async () => {
    const repo = criarRepositorioMemoria({
      pacientes: [pacienteExemplo({ tipo: 'avaliacao' })],
      avaliacoes: [
        avaliacaoExemplo({ id: 'av-velha', inicio: '2026-03-01', fim: '2026-04-01', valorPrevistoCentavos: 100000 }),
        avaliacaoExemplo({ id: 'av-nova', inicio: '2026-10-20', valorPrevistoCentavos: 150000 }),
      ],
    });
    const pagamento = await registrarPagamento(
      repo,
      { ...COMUM, pacienteId: 'p1', referencia: 'avaliacao', valorCentavos: 150000 },
      HOJE,
    );
    expect(pagamento.avaliacaoId).toBe('av-nova');
  });
});

describe('registrarPagamento', () => {
  it('rejeita paciente que não existe', async () => {
    const repo = repoDemo();
    await expect(
      registrarPagamento(repo, { ...COMUM, pacienteId: 'fantasma', referencia: 'mes', mes: '2026-10-01' }, HOJE),
    ).rejects.toThrow('Paciente não encontrado');
  });
});

describe('removerPagamento', () => {
  it('libera as sessões para voltarem a ficar em aberto', async () => {
    const repo = repoDemo();
    await removerPagamento(repo, 'demo-pagamento-maria');

    expect(await repo.listarPagamentos({ pacienteId: MARIA })).toEqual([]);
    // A sessão que estava paga volta a poder ser paga.
    const pagamento = await registrarPagamento(
      repo,
      { ...COMUM, pacienteId: MARIA, referencia: 'sessoes', sessaoIds: ['demo-sessao-maria-1'] },
      HOJE,
    );
    expect(pagamento.valorCentavos).toBe(18000);
  });

  it('libera o mês e devolve o controle da situação da sessão', async () => {
    const repo = repoDemo();
    const mes = await registrarPagamento(repo, { ...COMUM, pacienteId: ANA, referencia: 'mes', mes: '2026-10-01' }, HOJE);
    await removerPagamento(repo, mes.id);
    expect(await repo.listarPagamentos({ pacienteId: ANA })).toEqual([]);
    await expect(
      registrarPagamento(repo, { ...COMUM, pacienteId: ANA, referencia: 'mes', mes: '2026-10-01' }, HOJE),
    ).resolves.toMatchObject({ valorCentavos: 80000 });
  });

  it('depois de remover, a sessão paga pode mudar de situação', async () => {
    const repo = repoDemo();
    const sessao = (await repo.listarSessoesDoPaciente(MARIA))[0];
    await expect(marcarSituacao(repo, sessao, 'falta_com_aviso')).rejects.toBeInstanceOf(ErroCobranca);

    await removerPagamento(repo, 'demo-pagamento-maria');

    const marcada = await marcarSituacao(repo, sessao, 'falta_com_aviso');
    expect(marcada).toMatchObject({ situacao: 'falta_com_aviso', valorCentavos: null });
  });

  it('id que não existe não dá erro', async () => {
    const repo = repoDemo();
    await expect(removerPagamento(repo, 'fantasma')).resolves.toBeUndefined();
  });
});

describe('agendarReposicao', () => {
  /** Pedro (avaliação) faltou sem avisar na última sessão; devolve a sessão como ficou. */
  async function faltaDePedro(repo: Repositorio) {
    const sessao = (await repo.listarSessoesDoPaciente(PEDRO))[2];
    return marcarSituacao(repo, sessao, 'falta_sem_aviso');
  }

  it('cria a nova sessão da avaliação e a original continua faltou sem aviso, com a ligação', async () => {
    const repo = repoDemo();
    const original = await faltaDePedro(repo);

    const nova = await agendarReposicao(repo, original, '2026-11-06T13:00:00.000Z');

    expect(nova.id).not.toBe(original.id);
    expect(nova).toMatchObject({
      pacienteId: PEDRO,
      inicio: '2026-11-06T13:00:00.000Z',
      duracaoMin: original.duracaoMin,
      tipo: 'avaliacao',
      origem: 'remarcacao',
      horarioFixoId: null,
      dataOcorrencia: null,
      situacao: 'agendada',
      remarcadaPara: null,
      avaliacaoId: 'demo-avaliacao-pedro',
      confirmada: false,
      observacao: null,
      valorCentavos: null,
    });
    const sessoes = await repo.listarSessoesDoPaciente(PEDRO);
    expect(sessoes.find((s) => s.id === nova.id)).toEqual(nova);
    // Continua cobrada: a situação e o valor ficam como estavam; só ganha a ligação com a reposição.
    expect(sessoes.find((s) => s.id === original.id)).toEqual({ ...original, remarcadaPara: nova.id });
    expect(sessoes.find((s) => s.id === original.id)).toMatchObject({
      situacao: 'falta_sem_aviso',
      valorCentavos: 16000,
      remarcadaPara: nova.id,
    });
  });

  it('a falta continua pendente depois de agendar a reposição', async () => {
    const repo = repoDemo();
    const original = await faltaDePedro(repo);
    await agendarReposicao(repo, original, '2026-11-06T13:00:00.000Z');

    const aberta = await registrarPagamento(
      repo,
      { ...COMUM, pacienteId: PEDRO, referencia: 'sessoes', sessaoIds: [original.id] },
      HOJE,
    );
    expect(aberta.valorCentavos).toBe(16000);
  });

  it('rejeita em psicoterapia, sem criar sessão', async () => {
    const repo = repoDemo();
    const ana = await repo.listarSessoesDoPaciente(ANA);
    const faltou = await marcarSituacao(repo, ana[0], 'falta_sem_aviso');

    const mensagem = await erroDe(agendarReposicao(repo, faltou, '2026-11-06T13:00:00.000Z'));

    expect(mensagem).toBe('A reposição é só para falta sem aviso na avaliação.');
    expect(await repo.listarSessoesDoPaciente(ANA)).toHaveLength(ana.length);
  });

  it('rejeita na avaliação quando a sessão não foi falta sem aviso', async () => {
    const repo = repoDemo();
    const pedro = await repo.listarSessoesDoPaciente(PEDRO);
    // Compareceu (como a semente deixou) e falta com aviso.
    const comAviso = await marcarSituacao(repo, pedro[1], 'falta_com_aviso');
    for (const sessao of [pedro[0], comAviso]) {
      expect(await erroDe(agendarReposicao(repo, sessao, '2026-11-06T13:00:00.000Z'))).toBe(
        'A reposição é só para falta sem aviso na avaliação.',
      );
    }
    expect(await repo.listarSessoesDoPaciente(PEDRO)).toHaveLength(pedro.length);
  });
});
