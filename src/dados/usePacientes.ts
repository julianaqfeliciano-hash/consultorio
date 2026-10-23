import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paciente } from '../dominio/tipos';
import type { Rascunho } from './repositorio';
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

/**
 * Cadastra o paciente; em avaliação já abre a avaliação com as etapas padrão. Devolve o paciente criado.
 * São duas gravações: dê um `id` (o mesmo em toda tentativa do mesmo cadastro) para que repetir depois de
 * uma falha no meio complete o cadastro em vez de criar um segundo paciente. A lista é refeita com ou sem falha.
 */
export function useCriarPaciente() {
  const repositorio = useRepositorio();
  const cliente = useQueryClient();
  const { config } = useConfiguracoes();
  return useMutation({
    mutationFn: (dados: Rascunho<Paciente>) => criarPaciente(repositorio, dados, config, hojeISO()),
    onSettled: () => cliente.invalidateQueries({ queryKey: CHAVE_PACIENTES }),
  });
}
