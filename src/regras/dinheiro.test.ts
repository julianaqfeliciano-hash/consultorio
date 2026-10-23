import { describe, expect, it } from 'vitest';
import { centavosParaCampo, formatarReais, lerReais } from './dinheiro';

describe('formatarReais', () => {
  it('escreve em reais, com vírgula e duas casas', () => {
    expect(formatarReais(18000)).toMatch(/^R\$\s180,00$/);
    expect(formatarReais(125050)).toMatch(/^R\$\s1\.250,50$/);
    expect(formatarReais(5)).toMatch(/^R\$\s0,05$/);
    expect(formatarReais(0)).toMatch(/^R\$\s0,00$/);
  });
});

describe('centavosParaCampo', () => {
  it('escreve o número que lerReais lê de volta, sem o R$ e sem separador de milhar', () => {
    expect(centavosParaCampo(20000)).toBe('200,00');
    expect(centavosParaCampo(125050)).toBe('1250,50');
    expect(centavosParaCampo(5)).toBe('0,05');
    expect(centavosParaCampo(0)).toBe('0,00');
    for (const c of [0, 5, 100, 20000, 125050, 99999999]) {
      expect(lerReais(centavosParaCampo(c))).toBe(c);
    }
  });
});

describe('lerReais', () => {
  it('lê reais inteiros', () => {
    expect(lerReais('180')).toBe(18000);
    expect(lerReais('0')).toBe(0);
    expect(lerReais('  200  ')).toBe(20000);
  });

  it('lê o formato brasileiro, com ou sem R$', () => {
    expect(lerReais('R$ 1.250,50')).toBe(125050);
    expect(lerReais('R$ 1.250,50')).toBe(125050);
    expect(lerReais('1.250,50')).toBe(125050);
    expect(lerReais('180,5')).toBe(18050);
    expect(lerReais('180,50')).toBe(18050);
    expect(lerReais('0,05')).toBe(5);
    expect(lerReais('1.250')).toBe(125000);
  });

  it('aceita o ponto como separador decimal quando só há um e ele não separa milhares', () => {
    expect(lerReais('180.50')).toBe(18050);
    expect(lerReais('180.5')).toBe(18050);
  });

  it('devolve null quando não é um valor', () => {
    expect(lerReais('abc')).toBeNull();
    expect(lerReais('')).toBeNull();
    expect(lerReais('   ')).toBeNull();
    expect(lerReais('R$')).toBeNull();
    expect(lerReais('-10')).toBeNull();
    expect(lerReais('1,2,3')).toBeNull();
    expect(lerReais('10,999')).toBeNull();
    expect(lerReais('12abc')).toBeNull();
    expect(lerReais('1..250,00')).toBeNull();
  });

  it('recusa valores que o banco não guarda (inteiro de 32 bits, em centavos)', () => {
    expect(lerReais('21474836,47')).toBe(2147483647);
    expect(lerReais('21474836,48')).toBeNull();
    expect(lerReais('999999999999999999999')).toBeNull();
  });
});
