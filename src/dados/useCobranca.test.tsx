import { useQueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provedores } from '../Provedores';
import { ANA, HOJE, MARIA, PEDRO, repositorioDemo, usarHojeFixo } from '../testes/ficha';
import { criarRepositorioMemoria } from './memoria';
import type { Repositorio } from './repositorio';
import { ErroCobranca, type PedidoPagamento } from '../servicos/cobranca';
import {
  mensagemDoErro,
  useAgendarReposicao,
  usePagamentosDoPaciente,
  usePendencias,
  useRegistrarPagamento,
  useRemoverPagamento,
} from './useCobranca';

usarHojeFixo();

function montar<T>(hook: () => T, repositorio: Repositorio = repositorioDemo()) {
  const Envoltorio = ({ children }: { children: ReactNode }) => (
    <Provedores repositorio={repositorio} semNovasTentativas>
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
