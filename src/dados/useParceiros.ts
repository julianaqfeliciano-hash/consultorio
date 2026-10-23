import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Id, Parceiro } from '../dominio/tipos';
import { useRepositorio } from './contexto';
import type { Rascunho } from './repositorio';

const CHAVE = ['parceiros'] as const;

/** Os parceiros (médicos e psicólogos que encaminham pacientes), em ordem alfabética. */
export function useParceiros() {
  const repositorio = useRepositorio();
  return useQuery({ queryKey: CHAVE, queryFn: () => repositorio.listarParceiros() });
}

/** Cria (sem `id`) ou atualiza (com `id`) um parceiro. */
export function useSalvarParceiro() {
  const repositorio = useRepositorio();
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (parceiro: Rascunho<Parceiro>) => repositorio.salvarParceiro(parceiro),
    onSuccess: () => cliente.invalidateQueries({ queryKey: CHAVE }),
  });
}

/** Remove o parceiro; os pacientes que ele encaminhou ficam sem parceiro. */
export function useRemoverParceiro() {
  const repositorio = useRepositorio();
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => repositorio.removerParceiro(id),
    // Mexe também nos pacientes (o parceiro deles some), então vale refazer todas as consultas.
    onSuccess: () => cliente.invalidateQueries(),
  });
}
