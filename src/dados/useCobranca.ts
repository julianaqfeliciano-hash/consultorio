import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { DataISO, Id, Sessao } from '../dominio/tipos';
import { pendenciasDoPaciente, resumoAReceber, type Pendencias } from '../regras/cobranca';
import { hojeISO, ultimoDiaDoMes } from '../regras/datas';
import {
  agendarReposicao,
  ErroCobranca,
  registrarPagamento,
  removerPagamento,
  type PedidoPagamento,
} from '../servicos/cobranca';
import { useRepositorio } from './contexto';
import { RecusaDoRepositorio, type SessaoComPaciente } from './repositorio';
import { useFicha, useSessoesDoPaciente } from './useFicha';

const chavePagamentos = (id: Id) => ['pagamentos', id] as const;
/** Os pagamentos de um mês, de todos os pacientes. Começa por 'pagamentos': quem invalida os pagamentos refaz esta também. */
const chavePagamentosDoMes = (mes: DataISO) => ['pagamentos', 'mes', mes] as const;

/** Tudo que um pagamento ou uma reposição pode mudar na tela. 'aReceber' é a lista de quem tem algo a receber. */
const CHAVES_DA_COBRANCA = ['pagamentos', 'sessoes', 'ficha', 'pacientes', 'aReceber'] as const;

/** Os pagamentos do paciente, do mais antigo para o mais novo. */
export function usePagamentosDoPaciente(pacienteId: Id) {
  const repositorio = useRepositorio();
  return useQuery({
    queryKey: chavePagamentos(pacienteId),
    queryFn: () => repositorio.listarPagamentos({ pacienteId }),
  });
}

/**
 * O que o paciente ainda deve (veja `pendenciasDoPaciente`), a partir da ficha, das sessões e dos pagamentos dele.
 * `undefined` enquanto algum dos três não chegou, ou se o paciente não existe.
 */
export function usePendencias(pacienteId: Id): Pendencias | undefined {
  const ficha = useFicha(pacienteId).data;
  const sessoes = useSessoesDoPaciente(pacienteId).data;
  const pagamentos = usePagamentosDoPaciente(pacienteId).data;
  const hoje = hojeISO();
  return useMemo(() => {
    if (!ficha || !sessoes || !pagamentos) return undefined;
    return pendenciasDoPaciente({ paciente: ficha.paciente, sessoes, pagamentos, avaliacao: ficha.avaliacao, hoje });
  }, [ficha, sessoes, pagamentos, hoje]);
}

/** Os pagamentos com data em `mes` (o dia 1, 'YYYY-MM-01') de todos os pacientes, do mais antigo para o mais novo. */
export function usePagamentosDoMes(mes: DataISO) {
  const repositorio = useRepositorio();
  return useQuery({
    queryKey: chavePagamentosDoMes(mes),
    queryFn: () => repositorio.listarPagamentos({ de: mes, ate: ultimoDiaDoMes(mes) }),
  });
}

/**
 * Quem tem algo a receber, de qualquer mês: cada paciente (inclusive quem teve alta ou está na lista de espera)
 * com o que deve e desde quando, do que espera há mais tempo ao mais recente (veja `resumoAReceber`).
 *
 * Cada paciente entra com as sessões cobradas dele e a avaliação da ficha, como na seção Financeiro da ficha: quem
 * passou da avaliação para a psicoterapia ainda deve o que faltou do pacote, então a ficha de todos é consultada.
 */
export function useAReceber() {
  const repositorio = useRepositorio();
  return useQuery({
    queryKey: ['aReceber'],
    queryFn: async () => {
      const [pacientes, cobradas, pagamentos] = await Promise.all([
        repositorio.listarPacientes(),
        repositorio.listarSessoesCobradas(),
        repositorio.listarPagamentos(),
      ]);
      const fichas = await Promise.all(pacientes.map((p) => repositorio.obterFicha(p.id)));
      const sessoesPorPaciente = new Map<Id, SessaoComPaciente[]>();
      for (const s of cobradas) sessoesPorPaciente.set(s.pacienteId, [...(sessoesPorPaciente.get(s.pacienteId) ?? []), s]);
      const hoje = hojeISO();
      return resumoAReceber(
        pacientes.map((paciente, i) => ({
          paciente,
          pendencias: pendenciasDoPaciente({
            paciente,
            sessoes: sessoesPorPaciente.get(paciente.id) ?? [],
            pagamentos,
            avaliacao: fichas[i]?.avaliacao ?? null,
            hoje,
          }),
        })),
      );
    },
  });
}

/**
 * O texto de erro para a tela: a mensagem de uma recusa, que já é para a pessoa ler (`ErroCobranca` do serviço, ou
 * `RecusaDoRepositorio` quando o banco recusa, por exemplo uma sessão que outro aparelho acabou de pagar), ou
 * `padrao` para qualquer outro erro (rede, banco), cuja mensagem técnica ela não entenderia.
 */
export function mensagemDoErro(erro: unknown, padrao: string): string {
  return erro instanceof ErroCobranca || erro instanceof RecusaDoRepositorio ? erro.message : padrao;
}

/**
 * Depois de qualquer pagamento ou reposição: refaz os pagamentos, as sessões (as da agenda e as de cada
 * paciente), as fichas, a lista de pacientes e a de quem tem a receber. Devolve a promessa para a mutação esperar
 * os dados novos.
 *
 * As mutações chamam isto em `onSettled`, não em `onSuccess`: a reposição grava duas vezes, e se a segunda falha
 * a primeira já está gravada e a tela precisa mostrá-la.
 */
function useAtualizarCobranca() {
  const cliente = useQueryClient();
  return () => Promise.all(CHAVES_DA_COBRANCA.map((chave) => cliente.invalidateQueries({ queryKey: [chave] })));
}

/** Registra o pagamento de sessões, de um mês ou de uma parcela da avaliação (veja `registrarPagamento`). */
export function useRegistrarPagamento() {
  const repositorio = useRepositorio();
  const atualizar = useAtualizarCobranca();
  return useMutation({
    mutationFn: (pedido: PedidoPagamento) => registrarPagamento(repositorio, pedido, hojeISO()),
    onSettled: atualizar,
  });
}

/** Apaga o pagamento: as sessões que ele quitava, ou o que ele pagou do mês, voltam a ficar em aberto. */
export function useRemoverPagamento() {
  const repositorio = useRepositorio();
  const atualizar = useAtualizarCobranca();
  return useMutation({
    mutationFn: (id: Id) => removerPagamento(repositorio, id),
    onSettled: atualizar,
  });
}

/** Marca a reposição de uma falta sem aviso na avaliação, em `inicio` (instante ISO). Devolve a sessão nova. */
export function useAgendarReposicao() {
  const repositorio = useRepositorio();
  const atualizar = useAtualizarCobranca();
  return useMutation({
    mutationFn: (e: { sessao: Sessao; inicio: string }) => agendarReposicao(repositorio, e.sessao, e.inicio),
    onSettled: atualizar,
  });
}
