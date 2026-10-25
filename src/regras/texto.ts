/** Só os números do texto. */
export function apenasDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

/**
 * Texto para comparar na busca: sem maiúsculas, sem acentos (NFD sem as marcas combinantes),
 * sem espaços sobrando. "Ána  CLARA" e "ana clara" ficam iguais.
 */
export function normalizarParaBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

const COMPARAR_NOMES = new Intl.Collator('pt-BR', { sensitivity: 'base' });

/**
 * Cópia da lista em ordem alfabética do português, sem diferenciar acentos nem maiúsculas ("Ágata" antes de
 * "Zeca"). A ordem fica no aparelho, então não depende da ordenação (collation) do banco.
 */
export function ordenarPorNome<T extends { nome: string }>(itens: readonly T[]): T[] {
  return [...itens].sort((a, b) => COMPARAR_NOMES.compare(a.nome, b.nome));
}

/**
 * Telefone com a máscara '(85) 98823-2033' (celular, 11 dígitos) ou '(85) 3222-1100' (fixo, 10).
 * Serve para formatar enquanto se digita. O código do país (55) é descartado quando o número vem completo.
 */
export function mascararTelefone(texto: string): string {
  let d = apenasDigitos(texto);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);

  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  const corte = d.length === 11 ? 7 : 6;
  return `(${d.slice(0, 2)}) ${d.slice(2, corte)}-${d.slice(corte)}`;
}

/** Tem DDD e o número inteiro: 10 dígitos (fixo) ou 11 (celular). */
export function telefoneCompleto(texto: string): boolean {
  const tamanho = apenasDigitos(texto).length;
  return tamanho === 10 || tamanho === 11;
}

/** CPF com a máscara '000.000.000-00', para formatar enquanto se digita. */
export function mascararCpf(texto: string): string {
  const d = apenasDigitos(texto).slice(0, 11);
  const partes = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean);
  const base = partes.join('.');
  return d.length > 9 ? `${base}-${d.slice(9)}` : base;
}

/** Tem os 11 números. Os dígitos verificadores não são conferidos. */
export function cpfCompleto(texto: string): boolean {
  return apenasDigitos(texto).length === 11;
}
