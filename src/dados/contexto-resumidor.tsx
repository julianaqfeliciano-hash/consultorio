import { createContext, useContext, type ReactNode } from 'react';
import type { Resumidor } from './resumidor';

const ContextoResumidor = createContext<Resumidor | null>(null);

/** Entrega o resumidor (Claude via Supabase, ou demonstração) a toda a interface. */
export function ResumidorProvider({ resumidor, children }: { resumidor: Resumidor; children: ReactNode }) {
  return <ContextoResumidor.Provider value={resumidor}>{children}</ContextoResumidor.Provider>;
}

// O contexto, o provedor e o hook andam juntos; recarregar a página ao editar este arquivo é aceitável.
// eslint-disable-next-line react-refresh/only-export-components
export function useResumidor(): Resumidor {
  const resumidor = useContext(ContextoResumidor);
  if (resumidor === null) throw new Error('useResumidor precisa ser usado dentro de <ResumidorProvider>.');
  return resumidor;
}
