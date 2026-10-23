import { describe, expect, it } from 'vitest';
import {
  DADOS_EM_BRANCO,
  validarCobranca,
  validarDados,
  validarEtapa,
  validarHorario,
  validarResponsavel,
  validarSessoesPrevistas,
  valoresDeCobranca,
  valoresDeDados,
  valoresDeResponsavel,
} from './formularios';

const HOJE = '2026-11-02';

describe('validarDados', () => {
  const preenchido = { ...DADOS_EM_BRANCO, nome: '  Ana Clara ', escola: ' Girassol ', serie: '2º ano', observacoes: ' x ' };

  it('apara os textos e transforma o que está em branco em null', () => {
    expect(validarDados(preenchido, HOJE)).toEqual({
      erros: {},
      dados: { nome: 'Ana Clara', dataNascimento: null, cpf: null, escola: 'Girassol', serie: '2º ano', observacoes: 'x' },
    });
  });

  it('o nome é obrigatório', () => {
    expect(validarDados({ ...preenchido, nome: '   ' }, HOJE)).toEqual({ erros: { nome: 'Informe o nome.' }, dados: null });
  });

  it('CPF: opcional, mas se vier precisa dos 11 números (dígitos verificadores não são conferidos)', () => {
    expect(validarDados({ ...preenchido, cpf: '123.456' }, HOJE).erros).toEqual({ cpf: 'O CPF deve ter 11 números.' });
    expect(validarDados({ ...preenchido, cpf: '111.111.111-11' }, HOJE).dados?.cpf).toBe('111.111.111-11');
  });

  it('data de nascimento: hoje vale, amanhã não', () => {
    expect(validarDados({ ...preenchido, dataNascimento: HOJE }, HOJE).dados?.dataNascimento).toBe(HOJE);
    expect(validarDados({ ...preenchido, dataNascimento: '2026-11-03' }, HOJE).erros).toEqual({
      dataNascimento: 'A data de nascimento não pode ser no futuro.',
    });
  });

  it('valoresDeDados e validarDados são inversos', () => {
    const dados = { nome: 'Ana', dataNascimento: '2019-01-02', cpf: '123.456.789-01', escola: 'E', serie: 'S', observacoes: 'O' };
    expect(validarDados(valoresDeDados(dados), HOJE).dados).toEqual(dados);
  });
});

describe('validarCobranca', () => {
  it('lê o valor em reais e devolve centavos', () => {
    expect(validarCobranca({ forma: 'mensal', valor: '200' }).dados).toEqual({ formaCobranca: 'mensal', valorSessaoCentavos: 20000 });
    expect(validarCobranca({ forma: 'por_sessao', valor: 'R$ 1.250,50' }).dados?.valorSessaoCentavos).toBe(125050);
  });

  it('em branco vale zero; texto que não é valor é recusado', () => {
    expect(validarCobranca({ forma: 'por_sessao', valor: '  ' }).dados?.valorSessaoCentavos).toBe(0);
    expect(validarCobranca({ forma: 'por_sessao', valor: 'abc' })).toEqual({
      erros: { valor: 'Informe um valor válido, como 180 ou 180,50.' },
      dados: null,
    });
  });

  it('valoresDeCobranca escreve o valor como se digita', () => {
    expect(valoresDeCobranca({ formaCobranca: 'mensal', valorSessaoCentavos: 18050 })).toEqual({ forma: 'mensal', valor: '180,50' });
  });
});

describe('validarResponsavel', () => {
  const base = { nome: ' Carla ', parentesco: ' Mãe ', cpf: '', telefone: ' (85) 90000-0009 ', email: '', principal: true, pagador: false };

  it('apara os textos; CPF e e-mail em branco viram null', () => {
    expect(validarResponsavel(base).dados).toEqual({
      nome: 'Carla',
      parentesco: 'Mãe',
      cpf: null,
      telefone: '(85) 90000-0009',
      email: null,
      principal: true,
      pagador: false,
    });
  });

  it('telefone em branco é aceito (a lista de amanhã mostra "sem telefone")', () => {
    expect(validarResponsavel({ ...base, telefone: '' }).dados?.telefone).toBe('');
  });

  it('nome obrigatório; telefone, CPF e e-mail precisam estar completos quando preenchidos', () => {
    expect(validarResponsavel({ ...base, nome: '', telefone: '(85) 9882', cpf: '123', email: 'x@y' }).erros).toEqual({
      nome: 'Informe o nome do responsável.',
      telefone: 'Informe o telefone com DDD, como (85) 98823-2033.',
      cpf: 'O CPF deve ter 11 números.',
      email: 'Informe um e-mail válido, como nome@exemplo.com.',
    });
  });

  it('aceita telefone fixo e e-mail com subdomínio', () => {
    const r = validarResponsavel({ ...base, telefone: '(85) 3222-1100', email: 'carla@mail.exemplo.com.br' });
    expect(r.erros).toEqual({});
  });

  it('valoresDeResponsavel e validarResponsavel são inversos', () => {
    const dados = { nome: 'C', parentesco: 'Mãe', cpf: '123.456.789-01', telefone: '(85) 90000-0009', email: 'c@e.com', principal: false, pagador: true };
    expect(validarResponsavel(valoresDeResponsavel(dados)).dados).toEqual(dados);
  });
});

describe('validarHorario', () => {
  it('converte para números', () => {
    expect(validarHorario({ diaSemana: '2', hora: '14:00', duracao: '50' }).dados).toEqual({ diaSemana: 2, hora: '14:00', duracaoMin: 50 });
    expect(validarHorario({ diaSemana: '0', hora: '09:30', duracao: '1' }).dados?.diaSemana).toBe(0);
  });

  it('exige dia, hora e uma duração inteira de 1 a 480 minutos', () => {
    expect(validarHorario({ diaSemana: '', hora: '', duracao: '' }).erros).toEqual({
      diaSemana: 'Escolha o dia da semana.',
      hora: 'Informe a hora.',
      duracao: 'Informe a duração em minutos (de 1 a 480).',
    });
    for (const duracao of ['0', '-5', '2.5', '481', 'abc']) {
      expect(validarHorario({ diaSemana: '2', hora: '14:00', duracao }).erros.duracao).toBeDefined();
    }
    expect(validarHorario({ diaSemana: '2', hora: '14:00', duracao: '480' }).erros).toEqual({});
  });
});

describe('validarSessoesPrevistas', () => {
  it('inteiro de 1 a 99', () => {
    expect(validarSessoesPrevistas('10').dados).toBe(10);
    expect(validarSessoesPrevistas('1').dados).toBe(1);
    expect(validarSessoesPrevistas('99').dados).toBe(99);
    for (const invalido of ['', '0', '100', '2.5', 'abc', '-1']) {
      expect(validarSessoesPrevistas(invalido).erros).toEqual({ sessoesPrevistas: 'Informe um número inteiro de 1 a 99.' });
    }
  });
});

describe('validarEtapa', () => {
  const existentes = [{ nome: 'Devolutiva', feita: true }];

  it('cria a etapa desmarcada, com o nome aparado', () => {
    expect(validarEtapa('  Visita   à escola ', existentes).dados).toEqual({ nome: 'Visita à escola', feita: false });
  });

  it('recusa nome em branco e nome repetido (sem diferenciar maiúsculas e acentos)', () => {
    expect(validarEtapa('  ', existentes).erros).toEqual({ nome: 'Informe o nome da etapa.' });
    expect(validarEtapa('devolutiva', existentes).erros).toEqual({ nome: 'Essa etapa já existe.' });
    expect(validarEtapa('DEVOLÚTIVA', existentes).erros).toEqual({ nome: 'Essa etapa já existe.' });
  });
});
