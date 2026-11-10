import { describe, expect, it } from 'vitest';
import { anonimizar, registroVazio, restaurar } from './registro';

const pessoas = { paciente: 'Ana Clara Souza', responsaveis: ['Marcos Souza', 'Júlia Ramos'] };

describe('anonimizar', () => {
  it('troca o nome completo por um só marcador', () => {
    expect(anonimizar('Ana Clara Souza chegou', pessoas).texto).toBe('[P] chegou');
  });

  it('troca o primeiro nome sem acento e em maiúsculas', () => {
    const p = { paciente: 'João Pedro', responsaveis: [] };
    expect(anonimizar('JOAO e joão', p).texto).toBe('[P] e [P]');
  });

  it('não troca dentro de outra palavra', () => {
    expect(anonimizar('Mariana e Anaís', pessoas).texto).toBe('Mariana e Anaís');
  });

  it('sobrenome em comum vira [F]', () => {
    expect(anonimizar('os Souza vieram', pessoas).texto).toBe('os [F] vieram');
  });

  it('responsáveis em ordem', () => {
    expect(anonimizar('Marcos e Júlia', pessoas).texto).toBe('[R1] e [R2]');
  });

  it('colchetes já existentes viram parênteses', () => {
    expect(anonimizar('[P]', pessoas).texto).toBe('(P)');
    expect(anonimizar('[R1] e [F]', pessoas).texto).toBe('(R1) e (F)');
  });

  it('aceita texto com acento decomposto', () => {
    const p = { paciente: 'João', responsaveis: [] };
    expect(anonimizar('João veio', p).texto).toBe('[P] veio');
  });

  it('não vaza partes do nome em sequência', () => {
    expect(anonimizar('Clara Souza e Ana Clara', pessoas).texto).toBe('[P] e [P]');
  });
});

describe('restaurar', () => {
  it('restaura pelo primeiro nome e mantém o desconhecido', () => {
    const { mapa } = anonimizar('', pessoas);
    expect(
      restaurar(
        { comoChegou: '[P] veio com [R1]', trabalhado: '[R9]', observacoes: '', proximosPassos: '[F]' },
        mapa,
      ),
    ).toEqual({
      comoChegou: 'Ana veio com Marcos',
      trabalhado: '[R9]',
      observacoes: '',
      proximosPassos: 'a família',
    });
  });
});

describe('registroVazio', () => {
  it('é verdadeiro só com os quatro campos em branco', () => {
    const v = { comoChegou: '', trabalhado: ' ', observacoes: '\n', proximosPassos: '  ' };
    expect(registroVazio(v)).toBe(true);
    expect(registroVazio({ ...v, observacoes: 'x' })).toBe(false);
  });
});
