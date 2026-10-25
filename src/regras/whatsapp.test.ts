import { describe, expect, it } from 'vitest';
import { linkWhatsApp, normalizarTelefone, preencherMensagem, primeiroNome } from './whatsapp';

describe('normalizarTelefone', () => {
  it('celular com máscara ganha o código do país', () => {
    expect(normalizarTelefone('(85) 98823-2033')).toBe('5585988232033');
  });

  it('número que já vem com +55 fica como está', () => {
    expect(normalizarTelefone('+55 85 98823-2033')).toBe('5585988232033');
  });

  it('fixo (10 dígitos) também ganha o 55', () => {
    expect(normalizarTelefone('8532221100')).toBe('558532221100');
  });

  it('DDD 55 (Santa Maria, RS) não é confundido com o código do país', () => {
    expect(normalizarTelefone('(55) 99999-1234')).toBe('5555999991234');
  });

  it('aceita o zero antes do DDD e o prefixo internacional 00', () => {
    expect(normalizarTelefone('(085) 98823-2033')).toBe('5585988232033');
    expect(normalizarTelefone('0055 85 98823-2033')).toBe('5585988232033');
  });

  it('devolve null para número incompleto, vazio ou de outro país', () => {
    expect(normalizarTelefone('98823')).toBeNull();
    expect(normalizarTelefone('')).toBeNull();
    expect(normalizarTelefone('   ')).toBeNull();
    expect(normalizarTelefone('sem número')).toBeNull();
    expect(normalizarTelefone('+44 20 7946 0958')).toBeNull();
    expect(normalizarTelefone('(85) 98823-2033 99')).toBeNull();
  });
});

describe('primeiroNome', () => {
  it('pega a primeira palavra, sem espaços nas pontas', () => {
    expect(primeiroNome('  Ana Clara Souza ')).toBe('Ana');
    expect(primeiroNome('Marta')).toBe('Marta');
    expect(primeiroNome('Maria\tLuísa')).toBe('Maria');
  });

  it('nome em branco dá texto vazio', () => {
    expect(primeiroNome('')).toBe('');
    expect(primeiroNome('   ')).toBe('');
  });
});

describe('preencherMensagem', () => {
  it('troca os campos conhecidos e deixa os desconhecidos como estão', () => {
    expect(
      preencherMensagem('Olá, {responsável}! {paciente} às {hora}. {outro}', {
        'responsável': 'Marta',
        paciente: 'Ana',
        hora: '14:00',
      }),
    ).toBe('Olá, Marta! Ana às 14:00. {outro}');
  });

  it('aceita o campo sem acento ou com maiúsculas, como se digita no celular', () => {
    const campos = { 'responsável': 'Marta', hora: '14:00' };
    expect(preencherMensagem('Olá, {responsavel}!', campos)).toBe('Olá, Marta!');
    expect(preencherMensagem('Olá, {RESPONSÁVEL}!', campos)).toBe('Olá, Marta!');
    expect(preencherMensagem('Olá, {Responsável}!', campos)).toBe('Olá, Marta!');
    expect(preencherMensagem('Às {Hora}.', campos)).toBe('Às 14:00.');
    expect(preencherMensagem('Às { hora }.', campos)).toBe('Às 14:00.');
  });

  it('o nome do campo também vale sem acento do lado de quem chama', () => {
    expect(preencherMensagem('{responsável}', { responsavel: 'Marta' })).toBe('Marta');
  });

  it('campos desconhecidos continuam como foram digitados, com a grafia original', () => {
    expect(preencherMensagem('{Outro} e {responsavel}', { 'responsável': 'Marta' })).toBe('{Outro} e Marta');
  });

  it('troca todas as ocorrências do mesmo campo', () => {
    expect(preencherMensagem('{hora} e {hora}', { hora: '09:00' })).toBe('09:00 e 09:00');
  });

  it('o valor entra como texto: não é trocado de novo nem interpreta $', () => {
    expect(preencherMensagem('{paciente} / {dia}', { paciente: '{dia}', dia: "R$& $1 $'" })).toBe("{dia} / R$& $1 $'");
  });

  it('nomes herdados de objetos ({constructor}) não são campos', () => {
    expect(preencherMensagem('{constructor} {toString}', {})).toBe('{constructor} {toString}');
  });

  it('campo com valor vazio some da mensagem', () => {
    expect(preencherMensagem('Olá, {responsável}!', { 'responsável': '' })).toBe('Olá, !');
  });
});

describe('linkWhatsApp', () => {
  it('monta o link wa.me com a mensagem codificada', () => {
    expect(linkWhatsApp('(85) 98823-2033', 'Olá, Marta!')).toBe(
      'https://wa.me/5585988232033?text=Ol%C3%A1%2C%20Marta!',
    );
  });

  it('codifica quebra de linha, & e # para não quebrar o link', () => {
    expect(linkWhatsApp('85988232033', 'a&b #1\nok')).toBe('https://wa.me/5585988232033?text=a%26b%20%231%0Aok');
  });

  it('sem telefone válido não há link', () => {
    expect(linkWhatsApp('', 'x')).toBeNull();
    expect(linkWhatsApp('98823', 'x')).toBeNull();
  });
});
