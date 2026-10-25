import { apenasDigitos } from './texto';

/**
 * Telefone no formato que o `wa.me` pede: só números, com o código do país (55).
 * Aceita o número como está nos cadastros: '(85) 98823-2033', '+55 85 98823-2033', '8532221100',
 * com o zero antes do DDD ou o '00' internacional. Devolve null quando não é um número brasileiro
 * completo (DDD + 8 ou 9 dígitos), por exemplo '98823' ou ''.
 *
 * O tamanho decide se o 55 já veio: 10 ou 11 dígitos são DDD + número (e o DDD pode ser 55);
 * 12 ou 13 dígitos só valem se começarem com 55.
 */
export function normalizarTelefone(tel: string): string | null {
  // DDD nunca começa com zero, então zeros à esquerda são prefixo de discagem ('0', '00').
  const digitos = apenasDigitos(tel).replace(/^0+/, '');
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) return digitos;
  return null;
}

/** Primeira palavra do nome, sem espaços nas pontas: 'Ana Clara Souza' vira 'Ana'. */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? '';
}

/**
 * Troca cada `{campo}` do modelo pelo valor de `campos`. Campos que não existem em `campos` ficam
 * como estão (a pessoa vê o erro de digitação em vez de uma mensagem com buraco). O valor entra
 * como texto: não é procurado de novo nem interpreta símbolos como `$&`.
 */
export function preencherMensagem(modelo: string, campos: Record<string, string>): string {
  return modelo.replace(/\{([^{}]+)\}/g, (trecho, nome: string) =>
    Object.hasOwn(campos, nome) ? campos[nome] : trecho,
  );
}

/** Link que abre a conversa no WhatsApp com a mensagem pronta; null quando o telefone não serve. */
export function linkWhatsApp(telefone: string, mensagem: string): string | null {
  const numero = normalizarTelefone(telefone);
  return numero === null ? null : `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
