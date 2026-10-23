import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import type { Autenticacao } from './dados/autenticacao';
import { AutenticacaoProvider } from './dados/contexto-autenticacao';
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
            {children}
          </AutenticacaoProvider>
        ) : (
          children
        )}
      </RepositorioProvider>
    </QueryClientProvider>
  );
}
