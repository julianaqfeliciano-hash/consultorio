import { resumidorFalso } from '../testes/resumidorFalso';
import { useQueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provedores } from '../Provedores';
import { ANA, HOJE, LUCAS, MARIA, PEDRO, repositorioDemo, usarHojeFixo } from '../testes/ficha';
import { sessaoExemplo } from '../testes/fabricas';
import { criarRepositorioMemoria } from './memoria';
import { sementeDemo } from './semente-demo';
import { RecusaDoRepositorio, type Repositorio } from './repositorio';
import { traduzirErroDoBanco } from './supabase';
import { ErroCobranca, type PedidoPagamento } from '../servicos/cobranca';
import {
  mensagemDoErro,
  useAgendarReposicao,
  useAReceber,
  usePagamentosDoMes,
  usePagamentosDoPaciente,
  usePendencias,
  useRegistrarPagamento,
  useRemoverPagamento,
} from './useCobranca';

usarHojeFixo();

function montar<T>(hook: () => T, repositorio: Repositorio = repositorioDemo()) {
  const Envoltorio = ({ children }: { children: ReactNode }) => (
    <Provedores repositorio={repositorio} resumidor={resumidorFalso()} semNovasTentativas>
      {children}
    </Provedores>
  );
  return { repositorio, ...renderHook(hook, { wrapper: Envoltorio }) };
}

/** O hook de cobrança junto com o cliente de consultas, cujas invalidações o teste espia. */
function comCliente<T>(hook: () => T, repositorio?: Repositorio) {
  const resultado = montar(() => ({ cliente: useQueryClient(), alvo: hook() }), repositorio);
  const invalidar = vi.spyOn(resultado.result.current.cliente, 'invalidateQueries');
  const chavesInvalidadas = () => invalidar.mock.calls.map(([filtro]) => filtro?.queryKey);
  return { ...resultado, chavesInvalidadas };
}

const TODAS_AS_CHAVES = [['pagamentos'], ['sessoes'], ['ficha'], ['pacientes'], ['aReceber']];

describe('mensagemDoErro', () => {
  it('mostra a mensagem da recusa do serviço do jeito que está', () => {
    expect(mensagemDoErro(new ErroCobranca('Este mês não tem nada a receber.'), 'Tente de novo.')).toBe(
      'Este mês não tem nada a receber.',
    );
  });

  it('mostra a recusa do repositório (da memória ou do banco) do jeito que está, sem "tente de novo"', () => {
    expect(mensagemDoErro(new RecusaDoRepositorio('Esta sessão já foi paga.'), 'Tente de novo.')).toBe('Esta sessão já foi paga.');
    // Como chega do Supabase quando outro aparelho pagou a mesma sessão no mesmo instante.
    const doBanco = traduzirErroDoBanco({
      code: '23505',
      message: 'duplicate key value violates unique constraint "pagamento_sessoes_sessao_id_key"',
      details: 'Key (sessao_id)=(x) already exists.',
    });
    expect(mensagemDoErro(doBanco, 'Tente de novo.')).toBe('Esta sessão já foi paga.');
    const levantadaPelaFuncao = traduzirErroDoBanco({ code: 'P0001', message: 'Escolha só sessões em aberto deste paciente.' });
    expect(mensagemDoErro(levantadaPelaFuncao, 'Tente de novo.')).toBe('Escolha só sessões em aberto deste paciente.');
  });

  it('um erro técnico do banco continua escondido atrás da mensagem padrão', () => {
    const tecnico = traduzirErroDoBanco({ code: '23514', message: 'new row violates check constraint "x"' });
    expect(mensagemDoErro(tecnico, 'Tente de novo.')).toBe('Tente de novo.');
  });

  it.each([new Error('sem rede'), 'texto', null])('esconde o erro técnico %s atrás da mensagem padrão', (erro) => {
    expect(mensagemDoErro(erro, 'Tente de novo.')).toBe('Tente de novo.');
  });
});

describe('usePagamentosDoPaciente', () => {
  it('devolve só os pagamentos do paciente', async () => {
    const { result } = montar(() => usePagamentosDoPaciente(MARIA));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.map((p) => p.id)).toEqual(['demo-pagamento-maria']);
  });
});

describe('usePendencias', () => {
  it('enquanto carrega, devolve undefined', () => {
    const { result } = montar(() => usePendencias(MARIA));

    expect(result.current).toBeUndefined();
  });

  it('combina ficha, sessões e pagamentos: a Maria deve só a sessão que não foi paga', async () => {
    const { result } = montar(() => usePendencias(MARIA));

    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current?.sessoesAbertas.map((s) => s.id)).toEqual(['demo-sessao-maria-2']);
    expect(result.current?.totalEmAbertoCentavos).toBe(18000);
  });

  it('a Ana paga por mês: outubro está devendo R$ 800,00', async () => {
    const { result } = montar(() => usePendencias(ANA));

    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current?.sessoesAbertas).toEqual([]);
    expect(result.current?.meses).toEqual([expect.objectContaining({ mes: '2026-10-01', situacao: 'devendo', totalCentavos: 80000 })]);
  });

  it('o Pedro tem o pacote da avaliação: faltam R$ 810,00 dos R$ 1.620,00', async () => {
    const { result } = montar(() => usePendencias(PEDRO));

    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current?.avaliacao).toEqual({ valorFinalCentavos: 162000, pagoCentavos: 81000, faltaCentavos: 81000 });
  });

  it('paciente que não existe: continua undefined', async () => {
    const { result } = montar(() => usePendencias('nao-existe'), criarRepositorioMemoria());

    await waitFor(() => expect(result.current).toBeUndefined());
  });
});

describe('usePagamentosDoMes', () => {
  it('devolve os pagamentos do mês de todos os pacientes, do mais antigo para o mais novo', async () => {
    const { result } = montar(() => usePagamentosDoMes('2026-10-01'));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.map((p) => p.id)).toEqual(['demo-pagamento-pedro', 'demo-pagamento-maria']);
  });

  it('um mês sem pagamentos devolve a lista vazia', async () => {
    const { result } = montar(() => usePagamentosDoMes('2026-11-01'));

    await waitFor(() => expect(result.current.data).toEqual([]));
  });

  it('inclui o primeiro e o último dia do mês e deixa de fora os dias vizinhos', async () => {
    const semente = sementeDemo(HOJE);
    const pagamento = (id: string, data: string) => ({ ...semente.pagamentos[0], id, data });
    const repositorio = criarRepositorioMemoria({
      ...semente,
      pagamentos: [
        pagamento('fim-de-setembro', '2026-09-30'),
        pagamento('primeiro-de-outubro', '2026-10-01'),
        pagamento('ultimo-de-outubro', '2026-10-31'),
        pagamento('primeiro-de-novembro', '2026-11-01'),
      ],
    });
    const { result } = montar(() => usePagamentosDoMes('2026-10-01'), repositorio);

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.map((p) => p.id)).toEqual(['primeiro-de-outubro', 'ultimo-de-outubro']);
  });

  it('é refeito quando um pagamento é registrado', async () => {
    const { result } = montar(() => ({ mes: usePagamentosDoMes('2026-11-01'), registrar: useRegistrarPagamento() }));
    await waitFor(() => expect(result.current.mes.data).toEqual([]));

    result.current.registrar.mutate({
      pacienteId: MARIA,
      referencia: 'sessoes',
      sessaoIds: ['demo-sessao-maria-2'],
      data: HOJE,
      forma: 'pix',
      observacao: null,
    });

    await waitFor(() => expect(result.current.mes.data).toHaveLength(1));
    expect(result.current.mes.data?.[0]).toMatchObject({ pacienteId: MARIA, valorCentavos: 18000, data: HOJE });
  });
});

describe('useAReceber', () => {
  it('enquanto carrega, não tem dados', () => {
    const { result } = montar(() => useAReceber());

    expect(result.current.data).toBeUndefined();
  });

  it('junta pacientes, sessões, pagamentos e avaliações: Ana, Pedro e Maria, do que espera há mais tempo ao mais recente', async () => {
    const { result } = montar(() => useAReceber());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.map((i) => [i.paciente.id, i.totalCentavos, i.desde])).toEqual([
      [ANA, 80000, '2026-10-01'],
      [PEDRO, 81000, '2026-10-14'],
      [MARIA, 18000, '2026-10-29'],
    ]);
  });

  it('não mostra quem não deve nada (Lucas, na lista de espera, sem sessão)', async () => {
    const { result } = montar(() => useAReceber());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.map((i) => i.paciente.id)).not.toContain(LUCAS);
  });

  it('quem teve alta ou está na lista de espera continua aparecendo enquanto deve', async () => {
    const semente = sementeDemo(HOJE);
    const comStatus = (id: string, status: 'alta' | 'lista_espera') =>
      semente.pacientes.map((p) => (p.id === id ? { ...p, status } : p));
    const comAna = criarRepositorioMemoria({ ...semente, pacientes: comStatus(ANA, 'alta') });
    const comMaria = criarRepositorioMemoria({ ...semente, pacientes: comStatus(MARIA, 'lista_espera') });

    const daAna = montar(() => useAReceber(), comAna);
    const daMaria = montar(() => useAReceber(), comMaria);

    await waitFor(() => expect(daAna.result.current.data).toBeDefined());
    await waitFor(() => expect(daMaria.result.current.data).toBeDefined());
    expect(daAna.result.current.data?.map((i) => i.paciente.id)).toContain(ANA);
    expect(daMaria.result.current.data?.map((i) => i.paciente.id)).toContain(MARIA);
  });

  it('só conta as sessões de cada paciente: os R$ 800,00 da Ana não vão para a Maria', async () => {
    const { result } = montar(() => useAReceber());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.find((i) => i.paciente.id === MARIA)?.totalCentavos).toBe(18000);
  });

  it('é refeito quando um pagamento é registrado: a Maria sai da lista', async () => {
    const { result } = montar(() => ({ aReceber: useAReceber(), registrar: useRegistrarPagamento() }));
    await waitFor(() => expect(result.current.aReceber.data).toHaveLength(3));

    result.current.registrar.mutate({
      pacienteId: MARIA,
      referencia: 'sessoes',
      sessaoIds: ['demo-sessao-maria-2'],
      data: HOJE,
      forma: 'pix',
      observacao: null,
    });

    await waitFor(() => expect(result.current.aReceber.data?.map((i) => i.paciente.id)).toEqual([ANA, PEDRO]));
  });

  it('mês pago antes de uma sessão a mais: a diferença entra no a receber, com o desde do mês', async () => {
    const semente = sementeDemo(HOJE);
    const outubroPago = {
      id: 'outubro-da-ana',
      pacienteId: ANA,
      data: '2026-10-28',
      valorCentavos: 60000,
      forma: 'pix' as const,
      observacao: null,
      referencia: 'mes' as const,
      mesReferencia: '2026-10-01',
      avaliacaoId: null,
      sessaoIds: [],
    };
    const repositorio = criarRepositorioMemoria({ ...semente, pagamentos: [...semente.pagamentos, outubroPago] });
    const { result } = montar(() => useAReceber(), repositorio);

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.find((i) => i.paciente.id === ANA)).toMatchObject({ totalCentavos: 20000, desde: '2026-10-01' });
  });

  it('mudar a Ana para "por sessão" depois de pagar outubro não a faz voltar a dever', async () => {
    const semente = sementeDemo(HOJE);
    const repositorio = criarRepositorioMemoria({
      ...semente,
      pacientes: semente.pacientes.map((p) => (p.id === ANA ? { ...p, formaCobranca: 'por_sessao' as const } : p)),
      pagamentos: [
        ...semente.pagamentos,
        {
          id: 'outubro-da-ana',
          pacienteId: ANA,
          data: '2026-11-02',
          valorCentavos: 80000,
          forma: 'pix',
          observacao: null,
          referencia: 'mes',
          mesReferencia: '2026-10-01',
          avaliacaoId: null,
          sessaoIds: [],
        },
      ],
      // Uma sessão de novembro, já como "por sessão": essa sim é cobrada sozinha.
      sessoes: [
        ...semente.sessoes,
        sessaoExemplo({ id: 'ana-nov', pacienteId: ANA, inicio: '2026-11-02T13:00:00.000Z', situacao: 'compareceu', valorCentavos: 20000 }),
      ],
    });
    const { result } = montar(() => useAReceber(), repositorio);

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.find((i) => i.paciente.id === ANA)).toMatchObject({ totalCentavos: 20000, desde: '2026-11-02' });
  });

  it('se a consulta falha, avisa o erro', async () => {
    const base = repositorioDemo();
    const { result } = montar(
      () => useAReceber(),
      { ...base, listarSessoesCobradas: vi.fn().mockRejectedValue(new Error('sem rede')) },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRegistrarPagamento', () => {
  const pedido: PedidoPagamento = {
    pacienteId: MARIA,
    referencia: 'sessoes',
    sessaoIds: ['demo-sessao-maria-2'],
    data: HOJE,
    forma: 'pix',
    observacao: null,
  };

  it('grava o pagamento com o valor da sessão e refaz pagamentos, sessões, fichas, pacientes e a receber', async () => {
    const { result, repositorio, chavesInvalidadas } = comCliente(() => useRegistrarPagamento());

    result.current.alvo.mutate(pedido);

    await waitFor(() => expect(result.current.alvo.isSuccess).toBe(true));
    expect(await repositorio.listarPagamentos({ pacienteId: MARIA })).toHaveLength(2);
    expect(result.current.alvo.data).toMatchObject({ valorCentavos: 18000, data: HOJE, sessaoIds: ['demo-sessao-maria-2'] });
    expect(chavesInvalidadas()).toEqual(expect.arrayContaining(TODAS_AS_CHAVES));
  });

  it('refaz tudo também quando o pedido é recusado (onSettled)', async () => {
    const { result, repositorio, chavesInvalidadas } = comCliente(() => useRegistrarPagamento());

    // A sessão 1 da Maria já está paga: não é mais "em aberto".
    result.current.alvo.mutate({ ...pedido, sessaoIds: ['demo-sessao-maria-1'] });

    await waitFor(() => expect(result.current.alvo.isError).toBe(true));
    expect(result.current.alvo.error?.message).toBe('Escolha só sessões em aberto deste paciente.');
    expect(await repositorio.listarPagamentos({ pacienteId: MARIA })).toHaveLength(1);
    expect(chavesInvalidadas()).toEqual(expect.arrayContaining(TODAS_AS_CHAVES));
  });
});

describe('useRemoverPagamento', () => {
  it('apaga o pagamento e refaz o que depende dele', async () => {
    const { result, repositorio, chavesInvalidadas } = comCliente(() => useRemoverPagamento());

    result.current.alvo.mutate('demo-pagamento-maria');

    await waitFor(() => expect(result.current.alvo.isSuccess).toBe(true));
    expect(await repositorio.listarPagamentos({ pacienteId: MARIA })).toEqual([]);
    expect(chavesInvalidadas()).toEqual(expect.arrayContaining(TODAS_AS_CHAVES));
  });
});

describe('useAgendarReposicao', () => {
  it('cria a sessão de reposição, liga a original a ela e refaz o que depende disso', async () => {
    const repositorio = repositorioDemo();
    const original = (await repositorio.listarSessoesDoPaciente(PEDRO))[0];
    await repositorio.atualizarSessao(original.id, { situacao: 'falta_sem_aviso' });
    const { result, chavesInvalidadas } = comCliente(() => useAgendarReposicao(), repositorio);

    result.current.alvo.mutate({ sessao: { ...original, situacao: 'falta_sem_aviso' }, inicio: '2026-11-06T13:00:00.000Z' });

    await waitFor(() => expect(result.current.alvo.isSuccess).toBe(true));
    const sessoes = await repositorio.listarSessoesDoPaciente(PEDRO);
    const nova = sessoes.find((s) => s.id === result.current.alvo.data?.id);
    expect(nova).toMatchObject({ inicio: '2026-11-06T13:00:00.000Z', situacao: 'agendada', origem: 'remarcacao' });
    expect(sessoes.find((s) => s.id === original.id)?.remarcadaPara).toBe(nova?.id);
    expect(chavesInvalidadas()).toEqual(expect.arrayContaining(TODAS_AS_CHAVES));
  });

  it('recusa quando a sessão não é falta sem aviso da avaliação, e ainda assim refaz as consultas', async () => {
    const repositorio = repositorioDemo();
    const [sessao] = await repositorio.listarSessoesDoPaciente(ANA);
    const { result, chavesInvalidadas } = comCliente(() => useAgendarReposicao(), repositorio);

    result.current.alvo.mutate({ sessao, inicio: '2026-11-06T13:00:00.000Z' });

    await waitFor(() => expect(result.current.alvo.isError).toBe(true));
    expect(result.current.alvo.error?.message).toBe('A reposição é só para falta sem aviso na avaliação.');
    expect(chavesInvalidadas()).toEqual(expect.arrayContaining(TODAS_AS_CHAVES));
  });
});
