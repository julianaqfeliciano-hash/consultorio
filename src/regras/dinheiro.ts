/** O banco guarda os valores num inteiro de 32 bits (centavos). */
const MAXIMO_CENTAVOS = 2_147_483_647;

const FORMATO_REAIS = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Ex.: 18000 → 'R$ 180,00' (com espaço não separável entre o R$ e o número). */
export function formatarReais(centavos: number): string {
  return FORMATO_REAIS.format(centavos / 100);
}

/** O valor como se digita num campo: 20000 → '200,00' (sem R$ e sem separador de milhar). */
export function centavosParaCampo(centavos: number): string {
  const sinal = centavos < 0 ? '-' : '';
  const absoluto = Math.abs(centavos);
  return `${sinal}${Math.floor(absoluto / 100)},${String(absoluto % 100).padStart(2, '0')}`;
}

const MILHARES = /^\d{1,3}(\.\d{3})+$/;

/**
 * Lê o que a pessoa digitou como dinheiro e devolve os centavos, ou `null` se não for um valor.
 * Aceita '180', '180,5', 'R$ 1.250,50', '1.250' (mil duzentos e cinquenta) e '180.50'.
 * Com vírgula, o ponto só pode separar milhares. Sem vírgula, 'N.NNN' é milhar e 'N.N' ou 'N.NN' é decimal.
 */
export function lerReais(texto: string): number | null {
  const limpo = texto.replace(/R\$/gi, '').replace(/\s/g, '');
  let inteira: string;
  let fracao = '';

  if (limpo.includes(',')) {
    const partes = limpo.split(',');
    if (partes.length !== 2) return null;
    [inteira, fracao] = partes;
    if (!MILHARES.test(inteira) && !/^\d+$/.test(inteira)) return null;
    inteira = inteira.replaceAll('.', '');
  } else if (MILHARES.test(limpo)) {
    inteira = limpo.replaceAll('.', '');
  } else if (/^\d+\.\d{1,2}$/.test(limpo)) {
    [inteira, fracao] = limpo.split('.');
  } else if (/^\d+$/.test(limpo)) {
    inteira = limpo;
  } else {
    return null;
  }
  if (!/^\d{0,2}$/.test(fracao)) return null;

  const centavos = Number(inteira) * 100 + Number(fracao.padEnd(2, '0'));
  return Number.isSafeInteger(centavos) && centavos <= MAXIMO_CENTAVOS ? centavos : null;
}
