import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Config } from '../config';

/**
 * O cliente Supabase do aplicativo: crie UM e entregue o mesmo ao repositório e à autenticação,
 * para as consultas do repositório rodarem com a sessão de quem entrou. Sem Supabase configurado
 * (modo demonstração) não há cliente: devolve `null`.
 */
export function criarClienteSupabase({ modo, supabaseUrl, supabaseChave }: Config): SupabaseClient | null {
  if (modo === 'supabase' && supabaseUrl && supabaseChave) return createClient(supabaseUrl, supabaseChave);
  return null;
}
