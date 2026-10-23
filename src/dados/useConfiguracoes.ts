import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CONFIGURACOES_PADRAO } from '../dominio/padroes';
import type { Configuracoes } from '../dominio/tipos';
import { useRepositorio } from './contexto';

const CHAVE = ['configuracoes'] as const;

/**
 * As configurações do consultório, para qualquer tela que precise delas.
 * No primeiro acesso (nada gravado ainda) grava e devolve `CONFIGURACOES_PADRAO`.
 * Enquanto carrega, e se falhar, `config` são os padrões; `erro` avisa da falha para a
 * tela não deixar ninguém gravar os padrões por cima das configurações verdadeiras.
 */
export function useConfiguracoes(): {
  config: Configuracoes;
  carregando: boolean;
  erro: boolean;
  recarregar: () => void;
} {
  const repositorio = useRepositorio();
  const consulta = useQuery({
    queryKey: CHAVE,
    queryFn: async () => {
      const gravadas = await repositorio.obterConfiguracoes();
      if (gravadas) return gravadas;
      await repositorio.salvarConfiguracoes(CONFIGURACOES_PADRAO);
      return CONFIGURACOES_PADRAO;
    },
  });
  return {
    config: consulta.data ?? CONFIGURACOES_PADRAO,
    carregando: consulta.isPending,
    // Falha ao atualizar com dados já em mãos (ex.: sem rede) não é erro: o que já se leu continua valendo.
    erro: consulta.isError && consulta.data === undefined,
    recarregar: () => void consulta.refetch(),
  };
}

/** Grava as configurações e já atualiza o que `useConfiguracoes` mostra, sem nova ida ao repositório. */
export function useSalvarConfiguracoes() {
  const repositorio = useRepositorio();
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (config: Configuracoes) => {
      await repositorio.salvarConfiguracoes(config);
      return config;
    },
    onSuccess: (config) => cliente.setQueryData(CHAVE, config),
  });
}
