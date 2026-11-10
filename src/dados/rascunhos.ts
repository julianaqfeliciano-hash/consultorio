import type { CamposRegistro } from '../dominio/tipos';

/**
 * O rascunho do registro de uma sessão, guardado no aparelho (localStorage) para não se perder se o
 * aplicativo fechar no meio do ditado. É a única exceção à regra de não guardar dado de paciente no
 * armazenamento do navegador: só texto e campos, nunca nome nem id de paciente. Apaga-se ao salvar e no "Sair".
 */
export interface Rascunho {
  textoFalado: string;
  campos: CamposRegistro;
  /** Instante ISO da última gravação do rascunho. */
  atualizadoEm: string;
}

const PREFIXO = 'consultorio:rascunho-registro:';

function ehTexto(v: unknown): v is string {
  return typeof v === 'string';
}

function ehRascunho(v: unknown): v is Rascunho {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  const c = r.campos as Record<string, unknown> | null | undefined;
  return (
    ehTexto(r.textoFalado) &&
    ehTexto(r.atualizadoEm) &&
    typeof c === 'object' &&
    c !== null &&
    ehTexto(c.comoChegou) &&
    ehTexto(c.trabalhado) &&
    ehTexto(c.observacoes) &&
    ehTexto(c.proximosPassos)
  );
}

/** O rascunho da sessão, ou `null` se não há, está corrompido ou o aparelho não deixa ler. */
export function lerRascunho(sessaoId: string): Rascunho | null {
  try {
    const bruto = localStorage.getItem(PREFIXO + sessaoId);
    if (bruto === null) return null;
    const valor: unknown = JSON.parse(bruto);
    return ehRascunho(valor) ? valor : null;
  } catch {
    return null;
  }
}

/** Guarda o rascunho (com a hora de agora). Sem armazenamento disponível, não faz nada. */
export function guardarRascunho(sessaoId: string, r: Omit<Rascunho, 'atualizadoEm'>): void {
  try {
    const completo: Rascunho = { textoFalado: r.textoFalado, campos: r.campos, atualizadoEm: new Date().toISOString() };
    localStorage.setItem(PREFIXO + sessaoId, JSON.stringify(completo));
  } catch {
    // Sem armazenamento a tela continua funcionando, só sem rascunho.
  }
}

export function apagarRascunho(sessaoId: string): void {
  try {
    localStorage.removeItem(PREFIXO + sessaoId);
  } catch {
    // idem
  }
}

/** Apaga todos os rascunhos (e só eles). Chamado no "Sair". */
export function apagarTodosOsRascunhos(): void {
  try {
    const chaves: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i);
      if (chave !== null && chave.startsWith(PREFIXO)) chaves.push(chave);
    }
    for (const chave of chaves) localStorage.removeItem(chave);
  } catch {
    // idem
  }
}
