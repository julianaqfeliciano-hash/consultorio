import { createContext, useContext, type ReactNode } from 'react';
import type { Repositorio } from './repositorio';

const ContextoRepositorio = createContext<Repositorio | null>(null);

/** Entrega o repositório (Supabase ou demonstração) a toda a interface. */
export function RepositorioProvider({ repositorio, children }: { repositorio: Repositorio; children: ReactNode }) {
  return <ContextoRepositorio.Provider value={repositorio}>{children}</ContextoRepositorio.Provider>;
}

// O contexto, o provedor e o hook andam juntos; recarregar a página ao editar este arquivo é aceitável.
// eslint-disable-next-line react-refresh/only-export-components
export function useRepositorio(): Repositorio {
  const repositorio = useContext(ContextoRepositorio);
  if (repositorio === null) {
    throw new Error('useRepositorio precisa ser usado dentro de <RepositorioProvider>.');
  }
  return repositorio;
}
