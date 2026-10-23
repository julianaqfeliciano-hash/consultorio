export interface Config {
  /** `supabase` com banco de verdade; `demonstracao` com dados fictícios só na memória. */
  modo: 'supabase' | 'demonstracao';
  supabaseUrl?: string;
  supabaseChave?: string;
}

function preenchido(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : undefined;
}

/** Decide o modo a partir das variáveis de ambiente. Faltando qualquer uma das duas, é demonstração. */
export function lerConfig(env: Record<string, unknown>): Config {
  const supabaseUrl = preenchido(env.VITE_SUPABASE_URL);
  const supabaseChave = preenchido(env.VITE_SUPABASE_PUBLISHABLE_KEY);
  if (supabaseUrl && supabaseChave) return { modo: 'supabase', supabaseUrl, supabaseChave };
  return { modo: 'demonstracao' };
}

export const config: Config = lerConfig(import.meta.env);
