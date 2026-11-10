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

describe('anonimizar: casos de borda', () => {
  it('troca nome de 1 ou 2 letras quando é o nome inteiro', () => {
    const p = { paciente: 'Li', responsaveis: [] };
    expect(anonimizar('Li chegou. li!', p).texto).toBe('[P] chegou. [P]!');
  });

  it('sobrenome com apóstrofo curvo ou reto, e o sobrenome sozinho', () => {
    const p = { paciente: "Maria D'Ávila", responsaveis: [] };
    expect(anonimizar("D’Ávila, D'Avila e Ávila e d´avila", p).texto).not.toMatch(/vila/i);
    expect(anonimizar('Maria D’Ávila', p).texto).toBe('[P]');
    expect(anonimizar('Avila veio', p).texto).toBe('[P] veio');
  });

  it('nome com hífen não vaza nada', () => {
    const t = anonimizar('Ana-Clara chegou', pessoas).texto;
    expect(t).not.toMatch(/Ana|Clara/);
  });

  it('nome quebrado por linha', () => {
    expect(anonimizar('Ana\nClara Souza veio', pessoas).texto).toBe('[P] veio');
  });

  it('marcador desconhecido literal vira parênteses', () => {
    expect(anonimizar('veio [R9]', pessoas).texto).toBe('veio (R9)');
  });
});

describe('anonimizar: grafias diferentes da ficha', () => {
  it('"Luiza" para a paciente Luísa vira [P]', () => {
    const p = { paciente: 'Maria Luísa Ferreira', responsaveis: [] };
    expect(anonimizar('Maria Luiza chegou, Luiza estava bem', p).texto).toBe('[P] chegou, [P] estava bem');
  });

  it('"Tiago" para Thiago vira [P]', () => {
    const p = { paciente: 'Thiago Lima', responsaveis: [] };
    expect(anonimizar('Tiago veio', p).texto).toBe('[P] veio');
  });

  it('"Isabela" para Isabella vira [P]', () => {
    const p = { paciente: 'Isabella Costa', responsaveis: [] };
    expect(anonimizar('Isabela veio', p).texto).toBe('[P] veio');
  });

  it('o inverso também: a ficha sem o h e o texto com ele', () => {
    const p = { paciente: 'Tiago', responsaveis: ['Rafaela Souza'] };
    expect(anonimizar('Thiago e Raphaela Sousa', p).texto).toBe('[P] e [R1]');
  });

  it('mantém o resto do texto com as letras de origem', () => {
    const p = { paciente: 'Luísa', responsaveis: [] };
    expect(anonimizar('Ontem LUIZA, já à tarde.', p).texto).toBe('Ontem [P], já à tarde.');
  });
});

describe('anonimizar: todas as palavras do nome', () => {
  it('primeiro nome de 2 letras vira [P]', () => {
    const p = { paciente: 'Lu Andrade', responsaveis: [] };
    expect(anonimizar('a Lu chegou', p).texto).toBe('a [P] chegou');
  });

  it('"da" de "Ana da Silva" não é trocado sozinho', () => {
    const p = { paciente: 'Ana da Silva', responsaveis: [] };
    expect(anonimizar('veio da escola', p).texto).toBe('veio da escola');
    expect(anonimizar('Ana da Silva veio', p).texto).toBe('[P] veio');
  });

  it('inicial de 1 letra não é trocada sozinha', () => {
    const p = { paciente: 'Pedro H. Costa', responsaveis: [] };
    expect(anonimizar('h de casa', p).texto).toBe('h de casa');
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
      proximosPassos: 'família',
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
