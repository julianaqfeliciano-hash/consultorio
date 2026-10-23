import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { RepositorioProvider } from './dados/contexto';
import type { Repositorio } from './dados/repositorio';

interface Props {
  repositorio: Repositorio;
  /** Para os testes: erro vira erro na hora, sem esperar as tentativas automáticas. */
  semNovasTentativas?: boolean;
  children: ReactNode;
}

/**
 * Tudo que a interface precisa em volta das telas: cache de consultas (TanStack
 * Query) e repositório. A autenticação entra aqui quando o login existir.
 */
export function Provedores({ repositorio, semNovasTentativas = false, children }: Props) {
  // Um QueryClient novo a cada montagem: nada de cache compartilhado entre testes.
  const [clienteDeConsultas] = useState(
    () =>
      new QueryClient({
        defaultOptions: semNovasTentativas ? { queries: { retry: false }, mutations: { retry: false } } : undefined,
      }),
  );
  return (
    <QueryClientProvider client={clienteDeConsultas}>
      <RepositorioProvider repositorio={repositorio}>{children}</RepositorioProvider>
    </QueryClientProvider>
  );
}
