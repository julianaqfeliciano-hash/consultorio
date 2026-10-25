import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Avaliacao, DataISO, HorarioFixo, Id, Paciente, Responsavel, TipoAtendimento } from '../dominio/tipos';
import { hojeISO } from '../regras/datas';
import { garantirAgenda } from '../servicos/agenda';
import { darAlta, mudarHorarioFixo, mudarTipo } from '../servicos/pacientes';
import { useRepositorio } from './contexto';
import type { FichaPaciente, Rascunho } from './repositorio';
import { CHAVE_PACIENTES } from './usePacientes';
import { useConfiguracoes } from './useConfiguracoes';

const chaveFicha = (id: Id) => ['ficha', id] as const;
const chaveSessoesDoPaciente = (id: Id) => ['sessoes', 'paciente', id] as const;

/** A ficha do paciente (dados, responsáveis, horários e avaliação), ou `null` se ele não existe. */
export function useFicha(id: Id) {
  const repositorio = useRepositorio();
  return useQuery({ queryKey: chaveFicha(id), queryFn: () => repositorio.obterFicha(id) });
}

/** Todas as sessões do paciente, da mais antiga para a mais nova. */
export function useSessoesDoPaciente(id: Id) {
  const repositorio = useRepositorio();
  return useQuery({ queryKey: chaveSessoesDoPaciente(id), queryFn: () => repositorio.listarSessoesDoPaciente(id) });
}

/**
 * Depois de qualquer mudança na ficha: refaz a ficha, a lista de pacientes e as sessões (as do paciente
 * e as da agenda, que começam todas por 'sessoes'). Devolve a promessa para a tela esperar os dados novos.
 *
 * As mutações de mais de uma gravação (horário, tipo, alta, início do atendimento) chamam isto em `onSettled`,
 * não em `onSuccess`: se uma falha no meio, a primeira gravação já está no banco e a tela precisa mostrá-la
 * (senão a pessoa tenta de novo vendo a ficha velha e duplica o que já foi gravado).
 */
function useAtualizarFicha(pacienteId: Id) {
  const cliente = useQueryClient();
  return () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: chaveFicha(pacienteId) }),
      cliente.invalidateQueries({ queryKey: CHAVE_PACIENTES }),
      cliente.invalidateQueries({ queryKey: ['sessoes'] }),
    ]);
}

/** Grava os dados do paciente (cadastro, atendimento ou cobrança). */
export function useSalvarPaciente(pacienteId: Id) {
  const repositorio = useRepositorio();
  const atualizar = useAtualizarFicha(pacienteId);
  return useMutation({
    mutationFn: (paciente: Paciente) => repositorio.salvarPaciente(paciente),
    onSuccess: atualizar,
  });
}

/** Tira da lista de espera: passa a "ativo" e a agenda já gera as sessões dos horários fixos dele. */
export function useIniciarAtendimento(pacienteId: Id) {
  const repositorio = useRepositorio();
  const { config } = useConfiguracoes();
  const atualizar = useAtualizarFicha(pacienteId);
  return useMutation({
    mutationFn: async (paciente: Paciente) => {
      await repositorio.salvarPaciente({ ...paciente, status: 'ativo' });
      await garantirAgenda(repositorio, hojeISO(), config.semanasGeradas);
    },
    onSettled: atualizar,
  });
}

/** Cria (sem `id`) ou atualiza (com `id`) um responsável. Marcar como principal desmarca os outros. */
export function useSalvarResponsavel(pacienteId: Id) {
  const repositorio = useRepositorio();
  const atualizar = useAtualizarFicha(pacienteId);
  return useMutation({
    mutationFn: (responsavel: Rascunho<Responsavel>) => repositorio.salvarResponsavel(responsavel),
    onSuccess: atualizar,
  });
}

export function useRemoverResponsavel(pacienteId: Id) {
  const repositorio = useRepositorio();
  const atualizar = useAtualizarFicha(pacienteId);
  return useMutation({
    mutationFn: (id: Id) => repositorio.removerResponsavel(id),
    onSuccess: atualizar,
  });
}

/**
 * Horário fixo novo, válido desde hoje; em seguida a agenda é completada para as próximas semanas.
 * Dê um `id` (o mesmo em toda tentativa do mesmo formulário): se a agenda falhar depois de o horário ser
 * gravado, repetir regrava o mesmo horário em vez de criar um segundo (que dobraria as sessões da semana).
 */
export function useAdicionarHorario(pacienteId: Id) {
  const repositorio = useRepositorio();
  const { config } = useConfiguracoes();
  const atualizar = useAtualizarFicha(pacienteId);
  return useMutation({
    mutationFn: async (horario: Pick<HorarioFixo, 'id' | 'diaSemana' | 'hora' | 'duracaoMin'>) => {
      const hoje = hojeISO();
      await repositorio.salvarHorario({ ...horario, pacienteId, validoDe: hoje, validoAte: null });
      await garantirAgenda(repositorio, hoje, config.semanasGeradas);
    },
    onSettled: atualizar,
  });
}

/** Troca o horário fixo a partir de uma data (veja `mudarHorarioFixo`). */
export function useMudarHorario(pacienteId: Id) {
  const repositorio = useRepositorio();
  const { config } = useConfiguracoes();
  const atualizar = useAtualizarFicha(pacienteId);
  return useMutation({
    mutationFn: (e: { horario: HorarioFixo; novo: Pick<HorarioFixo, 'diaSemana' | 'hora' | 'duracaoMin'>; aPartirDe: DataISO }) =>
      mudarHorarioFixo(repositorio, e.horario, e.novo, e.aPartirDe, config.semanasGeradas, new Date()),
    onSettled: atualizar,
  });
}

/** Avaliação ↔ psicoterapia, sem perder o histórico (veja `mudarTipo`). */
export function useMudarTipo(pacienteId: Id) {
  const repositorio = useRepositorio();
  const { config } = useConfiguracoes();
  const atualizar = useAtualizarFicha(pacienteId);
  return useMutation({
    mutationFn: (novoTipo: TipoAtendimento) => mudarTipo(repositorio, pacienteId, novoTipo, hojeISO(), config),
    onSettled: atualizar,
  });
}

/** Dá alta na data informada (veja `darAlta`). */
export function useDarAlta(pacienteId: Id) {
  const repositorio = useRepositorio();
  const atualizar = useAtualizarFicha(pacienteId);
  return useMutation({
    mutationFn: (data: DataISO) => darAlta(repositorio, pacienteId, data),
    onSettled: atualizar,
  });
}

/**
 * Grava a avaliação (etapas e sessões previstas). A ficha muda na hora, antes da resposta do
 * repositório, para marcar várias etapas seguidas sem uma sobrescrever a outra; se falhar, volta ao que era.
 */
export function useSalvarAvaliacao(pacienteId: Id) {
  const repositorio = useRepositorio();
  const cliente = useQueryClient();
  const atualizar = useAtualizarFicha(pacienteId);
  return useMutation({
    mutationFn: (avaliacao: Avaliacao) => repositorio.salvarAvaliacao(avaliacao),
    onMutate: async (avaliacao) => {
      await cliente.cancelQueries({ queryKey: chaveFicha(pacienteId) });
      const anterior = cliente.getQueryData<FichaPaciente | null>(chaveFicha(pacienteId));
      if (anterior) {
        const otimista: FichaPaciente = { ...anterior, avaliacao };
        cliente.setQueryData(chaveFicha(pacienteId), otimista);
      }
      return { anterior };
    },
    onError: (_erro, _avaliacao, contexto) => {
      if (contexto?.anterior) cliente.setQueryData(chaveFicha(pacienteId), contexto.anterior);
    },
    onSettled: atualizar,
  });
}
