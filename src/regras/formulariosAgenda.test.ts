import { instanteDe } from './datas';
import { descreverCanceladas, validarAvulsa, validarBloqueio, validarRemarcacao } from './formulariosAgenda';

describe('validarRemarcacao', () => {
  const atual = instanteDe('2026-11-03', '14:00');

  it('devolve o novo instante no fuso do consultório', () => {
    const r = validarRemarcacao({ data: '2026-11-05', hora: '15:00' }, atual);

    expect(r.erros).toEqual({});
    expect(r.dados).toEqual({ inicio: '2026-11-05T18:00:00.000Z' });
  });

  it('pede a data e a hora quando faltam', () => {
    const r = validarRemarcacao({ data: '', hora: '' }, atual);

    expect(r.dados).toBeNull();
    expect(r.erros).toEqual({ data: 'Informe a nova data.', hora: 'Informe a nova hora.' });
  });

  it('recusa o mesmo dia e a mesma hora da sessão', () => {
    const r = validarRemarcacao({ data: '2026-11-03', hora: '14:00' }, atual);

    expect(r.dados).toBeNull();
    expect(r.erros).toEqual({ data: 'Escolha uma data ou uma hora diferente da atual.' });
  });
});

describe('validarAvulsa', () => {
  const completo = { pacienteId: 'p1', data: '2026-11-06', hora: '10:30', duracao: '50', acompanhamentoFamiliar: true };

  it('devolve os dados prontos para criarAvulsa', () => {
    const r = validarAvulsa(completo);

    expect(r.erros).toEqual({});
    expect(r.dados).toEqual({
      pacienteId: 'p1',
      inicio: '2026-11-06T13:30:00.000Z',
      duracaoMin: 50,
      acompanhamentoFamiliar: true,
    });
  });

  it('pede paciente, data e hora', () => {
    const r = validarAvulsa({ ...completo, pacienteId: '', data: '', hora: '' });

    expect(r.dados).toBeNull();
    expect(r.erros).toEqual({ pacienteId: 'Escolha o paciente.', data: 'Informe a data.', hora: 'Informe a hora.' });
  });

  it.each(['', '0', '-5', '2,5', '481', 'abc'])('recusa a duração "%s"', (duracao) => {
    const r = validarAvulsa({ ...completo, duracao });

    expect(r.dados).toBeNull();
    expect(r.erros.duracao).toBe('Informe a duração em minutos (de 1 a 480).');
  });
});

describe('validarBloqueio', () => {
  it('aceita um período com motivo e tira os espaços das pontas', () => {
    const r = validarBloqueio({ inicio: '2026-11-10', fim: '2026-11-14', motivo: '  Feriado ' });

    expect(r.erros).toEqual({});
    expect(r.dados).toEqual({ inicio: '2026-11-10', fim: '2026-11-14', motivo: 'Feriado' });
  });

  it('aceita um dia só (fim igual ao início)', () => {
    expect(validarBloqueio({ inicio: '2026-11-15', fim: '2026-11-15', motivo: 'Feriado' }).dados).not.toBeNull();
  });

  it('pede início, fim e motivo', () => {
    const r = validarBloqueio({ inicio: '', fim: '', motivo: '   ' });

    expect(r.dados).toBeNull();
    expect(r.erros).toEqual({
      inicio: 'Informe a data de início.',
      fim: 'Informe a data de fim.',
      motivo: 'Informe o motivo, por exemplo: Férias.',
    });
  });

  it('recusa fim antes do início', () => {
    const r = validarBloqueio({ inicio: '2026-11-14', fim: '2026-11-10', motivo: 'Férias' });

    expect(r.dados).toBeNull();
    expect(r.erros).toEqual({ fim: 'A data de fim não pode ser antes do início.' });
  });
});

describe('descreverCanceladas', () => {
  it.each([
    [0, 'Nenhuma sessão cancelada.'],
    [1, '1 sessão cancelada.'],
    [2, '2 sessões canceladas.'],
    [12, '12 sessões canceladas.'],
  ])('com %i: "%s"', (n, texto) => {
    expect(descreverCanceladas(n)).toBe(texto);
  });
});
