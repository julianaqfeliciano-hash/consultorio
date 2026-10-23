import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paciente } from '../dominio/tipos';
import { hojeISO } from '../regras/datas';
import { criarPaciente } from '../servicos/pacientes';
import { useRepositorio } from './contexto';
import { useConfiguracoes } from './useConfiguracoes';

export const CHAVE_PACIENTES = ['pacientes'] as const;

/** Todos os pacientes, em ordem alfabética (a lista agrupa e filtra no aparelho). */
export function usePacientes() {
  const repositorio = useRepositorio();
  return useQuery({ queryKey: CHAVE_PACIENTES, queryFn: () => repositorio.listarPacientes() });
}

/** Cadastra o paciente; em avaliação já abre a avaliação com as etapas padrão. Devolve o paciente criado. */
export function useCriarPaciente() {
  const repositorio = useRepositorio();
  const cliente = useQueryClient();
  const { config } = useConfiguracoes();
  return useMutation({
    mutationFn: (dados: Omit<Paciente, 'id'>) => criarPaciente(repositorio, dados, config, hojeISO()),
    onSuccess: () => cliente.invalidateQueries({ queryKey: CHAVE_PACIENTES }),
  });
}
