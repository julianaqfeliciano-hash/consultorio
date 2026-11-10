import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CamposRegistro, Id } from '../dominio/tipos';
import { anonimizar, restaurar, type Pessoas } from '../regras/registro';
import { useRepositorio } from './contexto';
import { useResumidor } from './contexto-resumidor';

const chaveRegistro = (sessaoId: Id) => ['registro', sessaoId] as const;
const chaveSessoesComRegistro = (pacienteId: Id) => ['sessoesComRegistro', pacienteId] as const;

/** A sessão (com o nome do paciente e o responsável principal), ou `null` se não existe. */
export function useSessao(id: Id) {
  const repositorio = useRepositorio();
  return useQuery({ queryKey: ['sessao', id], queryFn: () => repositorio.obterSessao(id) });
}

/** O registro da sessão, ou `null` enquanto não houver. */
export function useRegistro(sessaoId: Id) {
  const repositorio = useRepositorio();
  return useQuery({ queryKey: chaveRegistro(sessaoId), queryFn: () => repositorio.obterRegistro(sessaoId) });
}

/** Ids das sessões do paciente que já têm registro. */
export function useSessoesComRegistro(pacienteId: Id) {
  const repositorio = useRepositorio();
  return useQuery({
    queryKey: chaveSessoesComRegistro(pacienteId),
    queryFn: () => repositorio.listarSessoesComRegistro(pacienteId),
  });
}

export interface PedidoSalvarRegistro {
  sessaoId: Id;
  /** Para atualizar a lista de sessões com registro do paciente. */
  pacienteId: Id;
  textoFalado: string;
  campos: CamposRegistro;
}

/** Grava (ou substitui) o registro da sessão. Refaz as consultas em `onSettled`, para dar certo ou errado. */
export function useSalvarRegistro() {
  const repositorio = useRepositorio();
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ sessaoId, textoFalado, campos }: PedidoSalvarRegistro) =>
      repositorio.salvarRegistro(sessaoId, { ...campos, textoFalado }),
    onSettled: (_dados, _erro, { sessaoId, pacienteId }) =>
      Promise.all([
        cliente.invalidateQueries({ queryKey: chaveRegistro(sessaoId) }),
        cliente.invalidateQueries({ queryKey: chaveSessoesComRegistro(pacienteId) }),
      ]),
  });
}

/**
 * Resume o texto ditado: troca os nomes por marcadores, manda ao resumidor e devolve os nomes aos quatro
 * campos. O nome de ninguém sai do aparelho.
 */
export function useResumir() {
  const resumidor = useResumidor();
  return useMutation({
    mutationFn: async ({ texto, pessoas }: { texto: string; pessoas: Pessoas }): Promise<CamposRegistro> => {
      const { texto: anonimo, mapa } = anonimizar(texto, pessoas);
      return restaurar(await resumidor.resumir(anonimo), mapa);
    },
  });
}
