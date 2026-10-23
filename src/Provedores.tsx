import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Autenticacao } from './dados/autenticacao';
import { AutenticacaoProvider, useAutenticacao } from './dados/contexto-autenticacao';
import { RepositorioProvider } from './dados/contexto';
import type { Repositorio } from './dados/repositorio';

interface Props {
  repositorio: Repositorio;
  /**
   * Quem entra e quem sai. O aplicativo (`main.tsx`) sempre informa. Se faltar, NÃO há provedor de
   * autenticação e `useAutenticacao` falha, em vez de liberar as telas por engano (só os testes que
   * não envolvem login omitem).
   */
  autenticacao?: Autenticacao;
  /** Mostra a faixa amarela de aviso e esconde o "Sair": dados fictícios, sem login. */
  modoDemonstracao?: boolean;
  /** Para os testes: erro vira erro na hora, sem esperar as tentativas automáticas. */
  semNovasTentativas?: boolean;
  children: ReactNode;
}

/**
 * Quando a usuária sai (ou outra pessoa assume a sessão), esquece tudo que as consultas guardaram:
 * dado de paciente não pode ficar na memória do aparelho depois do "Sair".
 */
function LimparCacheAoSair() {
  const { usuario } = useAutenticacao();
  const cliente = useQueryClient();
  const anterior = useRef<string | null>(null);
  const atual = usuario?.id ?? null;

  useEffect(() => {
    // Só conta quando havia alguém logada e agora é ninguém ou outra pessoa; quem ainda não entrou não deixou nada.
    if (anterior.current !== null && anterior.current !== atual) cliente.clear();
    anterior.current = atual;
  }, [atual, cliente]);

  return null;
}

/**
 * Tudo que a interface precisa em volta das telas: cache de consultas (TanStack
 * Query), repositório e autenticação.
 */
export function Provedores({
  repositorio,
  autenticacao,
  modoDemonstracao = false,
  semNovasTentativas = false,
  children,
}: Props) {
  // Um QueryClient novo a cada montagem: nada de cache compartilhado entre testes.
  const [clienteDeConsultas] = useState(
    () =>
      new QueryClient({
        defaultOptions: semNovasTentativas ? { queries: { retry: false }, mutations: { retry: false } } : undefined,
      }),
  );
  return (
    <QueryClientProvider client={clienteDeConsultas}>
      <RepositorioProvider repositorio={repositorio}>
        {autenticacao ? (
          <AutenticacaoProvider autenticacao={autenticacao} modoDemonstracao={modoDemonstracao}>
            <LimparCacheAoSair />
            {children}
          </AutenticacaoProvider>
        ) : (
          children
        )}
      </RepositorioProvider>
    </QueryClientProvider>
  );
}
