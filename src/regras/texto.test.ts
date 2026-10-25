import { describe, expect, it } from 'vitest';
import {
  apenasDigitos,
  cpfCompleto,
  mascararCpf,
  mascararTelefone,
  normalizarParaBusca,
  ordenarPorNome,
  telefoneCompleto,
} from './texto';

describe('normalizarParaBusca', () => {
  it('ignora maiúsculas e acentos', () => {
    expect(normalizarParaBusca('Ána CLARA')).toBe('ana clara');
    expect(normalizarParaBusca('Maria Luísa')).toBe('maria luisa');
    expect(normalizarParaBusca('Conceição Ângela Üñ')).toBe('conceicao angela un');
  });

  it('apara as pontas e junta espaços repetidos', () => {
    expect(normalizarParaBusca('  Ana   Clara ')).toBe('ana clara');
  });

  it('entende acentos já decompostos (NFD) e compostos do mesmo jeito', () => {
    expect(normalizarParaBusca('Luísa')).toBe(normalizarParaBusca('Luísa'));
  });
});

describe('apenasDigitos', () => {
  it('fica só com os números', () => {
    expect(apenasDigitos('(85) 98823-2033')).toBe('85988232033');
    expect(apenasDigitos('abc')).toBe('');
  });
});

describe('mascararTelefone', () => {
  it('celular de 11 dígitos: (85) 98823-2033', () => {
    expect(mascararTelefone('85988232033')).toBe('(85) 98823-2033');
  });

  it('fixo de 10 dígitos: (85) 3222-1100', () => {
    expect(mascararTelefone('8532221100')).toBe('(85) 3222-1100');
  });

  it('vai formatando enquanto se digita', () => {
    const passos = ['', '(8', '(85', '(85) 9', '(85) 98', '(85) 988', '(85) 9882', '(85) 9882-3', '(85) 9882-32'];
    const digitos = '85988232';
    expect(passos.map((_, i) => mascararTelefone(digitos.slice(0, i)))).toEqual(passos);
    expect(mascararTelefone('8598823203')).toBe('(85) 9882-3203');
  });

  it('refaz a máscara quando o texto já vem formatado (apagar e colar)', () => {
    expect(mascararTelefone('(85) 98823-2033')).toBe('(85) 98823-2033');
    expect(mascararTelefone('(85) ')).toBe('(85');
    expect(mascararTelefone('(85')).toBe('(85');
  });

  it('descarta o que não é número e o que passa de 11 dígitos', () => {
    expect(mascararTelefone('abc')).toBe('');
    expect(mascararTelefone('859882320339999')).toBe('(85) 98823-2033');
  });

  it('tira o código do país (55) quando o número vem completo, como no WhatsApp', () => {
    expect(mascararTelefone('+55 85 98823-2033')).toBe('(85) 98823-2033');
    expect(mascararTelefone('5585988232033')).toBe('(85) 98823-2033');
  });
});

describe('telefoneCompleto', () => {
  it('aceita 10 ou 11 dígitos, com DDD', () => {
    expect(telefoneCompleto('(85) 98823-2033')).toBe(true);
    expect(telefoneCompleto('(85) 3222-1100')).toBe(true);
    expect(telefoneCompleto('(85) 9882-32')).toBe(false);
    expect(telefoneCompleto('')).toBe(false);
  });
});

describe('mascararCpf', () => {
  it('000.000.000-00', () => {
    expect(mascararCpf('12345678901')).toBe('123.456.789-01');
  });

  it('vai formatando enquanto se digita', () => {
    const digitos = '12345678901';
    const esperado = ['', '1', '12', '123', '123.4', '123.45', '123.456', '123.456.7', '123.456.78', '123.456.789', '123.456.789-0', '123.456.789-01'];
    expect(esperado.map((_, i) => mascararCpf(digitos.slice(0, i)))).toEqual(esperado);
  });

  it('descarta o que não é número e o que passa de 11 dígitos', () => {
    expect(mascararCpf('abc')).toBe('');
    expect(mascararCpf('123.456.789-01999')).toBe('123.456.789-01');
  });
});

describe('cpfCompleto', () => {
  it('exige os 11 números (sem conferir dígitos verificadores)', () => {
    expect(cpfCompleto('123.456.789-01')).toBe(true);
    expect(cpfCompleto('123.456.789')).toBe(false);
    expect(cpfCompleto('')).toBe(false);
  });
});

describe('ordenarPorNome', () => {
  const nomes = (lista: string[]) => ordenarPorNome(lista.map((nome) => ({ nome }))).map((x) => x.nome);

  it('ordem alfabética do português, sem diferenciar acentos nem maiúsculas', () => {
    expect(nomes(['Zeca', 'Ágata'])).toEqual(['Ágata', 'Zeca']);
    expect(nomes(['Zeca', 'bruno', 'Érica', 'Álvaro', 'Ágata'])).toEqual(['Ágata', 'Álvaro', 'bruno', 'Érica', 'Zeca']);
  });

  it('devolve uma lista nova, sem mexer na recebida', () => {
    const lista = [{ nome: 'Zeca' }, { nome: 'Ágata' }];
    ordenarPorNome(lista);
    expect(lista.map((x) => x.nome)).toEqual(['Zeca', 'Ágata']);
  });
});
