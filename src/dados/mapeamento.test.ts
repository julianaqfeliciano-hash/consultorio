import { CONFIGURACOES_PADRAO } from '../dominio/padroes';
import type {
  Avaliacao,
  Bloqueio,
  HorarioFixo,
  Paciente,
  Parceiro,
  Responsavel,
  Sessao,
} from '../dominio/tipos';
import {
  avaliacaoParaLinha,
  bloqueioParaLinha,
  configuracoesParaLinha,
  horarioParaLinha,
  linhaParaAvaliacao,
  linhaParaBloqueio,
  linhaParaConfiguracoes,
  linhaParaHorario,
  linhaParaPaciente,
  linhaParaParceiro,
  linhaParaResponsavel,
  linhaParaSessao,
  mudancasSessaoParaLinha,
  pacienteParaLinha,
  parceiroParaLinha,
  responsavelParaLinha,
  sessaoParaLinha,
  type LinhaAvaliacao,
  type LinhaBloqueio,
  type LinhaHorario,
  type LinhaPaciente,
  type LinhaParceiro,
  type LinhaResponsavel,
  type LinhaSessao,
} from './mapeamento';

const pacienteCompleto: Paciente = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Pedro Henrique Lima',
  dataNascimento: '2017-03-09',
  cpf: '529.982.247-25',
  escola: 'Escola Girassol',
  serie: '3º ano',
  observacoes: 'Prefere desenhar.',
  status: 'ativo',
  tipo: 'avaliacao',
  dataEntrada: '2026-10-14',
  dataAlta: '2026-12-16',
  parceiroId: '22222222-2222-4222-8222-222222222222',
  formaCobranca: 'mensal',
  valorSessaoCentavos: 20050,
};

const pacienteComNulos: Paciente = {
  ...pacienteCompleto,
  dataNascimento: null,
  cpf: null,
  dataEntrada: null,
  dataAlta: null,
  parceiroId: null,
  escola: '',
  serie: '',
  observacoes: '',
};

/** Linhas de ida têm `id` opcional por causa dos rascunhos; aqui sempre há id. */
const comId = <L>(l: unknown) => l as L;

describe('paciente', () => {
  it.each([
    ['completo', pacienteCompleto],
    ['com campos nulos', pacienteComNulos],
  ])('ida e volta preserva todos os campos (%s)', (_nome, p) => {
    expect(linhaParaPaciente(comId<LinhaPaciente>(pacienteParaLinha(p)))).toEqual(p);
  });

  it('grava com as colunas do banco, sem dono nem criado_em', () => {
    expect(pacienteParaLinha(pacienteCompleto)).toEqual({
      id: pacienteCompleto.id,
      nome: 'Pedro Henrique Lima',
      data_nascimento: '2017-03-09',
      cpf: '529.982.247-25',
      escola: 'Escola Girassol',
      serie: '3º ano',
      observacoes: 'Prefere desenhar.',
      status: 'ativo',
      tipo: 'avaliacao',
      data_entrada: '2026-10-14',
      data_alta: '2026-12-16',
      parceiro_id: '22222222-2222-4222-8222-222222222222',
      forma_cobranca: 'mensal',
      valor_sessao_centavos: 20050,
    });
  });

  it('rascunho sem id não manda a chave id (o banco gera)', () => {
    const { id, ...semId } = pacienteCompleto;
    void id;
    expect('id' in pacienteParaLinha(semId)).toBe(false);
  });

  it('lê textos nulos do banco como texto vazio, mas mantém nulos onde o tipo permite', () => {
    const linha: LinhaPaciente = {
      ...comId<LinhaPaciente>(pacienteParaLinha(pacienteComNulos)),
      escola: null,
      serie: null,
      observacoes: null,
    };
    expect(linhaParaPaciente(linha)).toEqual(pacienteComNulos);
  });
});

describe('responsável', () => {
  const completo: Responsavel = {
    id: '33333333-3333-4333-8333-333333333333',
    pacienteId: pacienteCompleto.id,
    nome: 'Carlos Lima',
    parentesco: 'Pai',
    cpf: '529.982.247-25',
    telefone: '(85) 90000-0002',
    email: 'carlos@exemplo.com',
    principal: true,
    pagador: true,
  };
  const comNulos: Responsavel = { ...completo, cpf: null, email: null, telefone: '', parentesco: '', principal: false, pagador: false };

  it.each([
    ['completo', completo],
    ['com nulos', comNulos],
  ])('ida e volta preserva todos os campos (%s)', (_nome, r) => {
    expect(linhaParaResponsavel(comId<LinhaResponsavel>(responsavelParaLinha(r)))).toEqual(r);
  });

  it('usa as colunas do banco', () => {
    expect(responsavelParaLinha(completo)).toMatchObject({
      paciente_id: pacienteCompleto.id,
      principal: true,
      pagador: true,
    });
  });

  it('lê telefone e parentesco nulos como texto vazio', () => {
    const linha = { ...comId<LinhaResponsavel>(responsavelParaLinha(comNulos)), telefone: null, parentesco: null };
    expect(linhaParaResponsavel(linha)).toEqual(comNulos);
  });
});

describe('horário fixo', () => {
  const horario: HorarioFixo = {
    id: '44444444-4444-4444-8444-444444444444',
    pacienteId: pacienteCompleto.id,
    diaSemana: 3,
    hora: '09:00',
    duracaoMin: 50,
    validoDe: '2026-10-14',
    validoAte: null,
  };

  it('ida e volta preserva todos os campos', () => {
    expect(linhaParaHorario(comId<LinhaHorario>(horarioParaLinha(horario)))).toEqual(horario);
    const encerrado = { ...horario, validoAte: '2026-12-16' };
    expect(linhaParaHorario(comId<LinhaHorario>(horarioParaLinha(encerrado)))).toEqual(encerrado);
  });

  it("a hora '14:00' vira '14:00:00' no banco e volta para '14:00'", () => {
    const linha = horarioParaLinha({ ...horario, hora: '14:00' });
    expect(linha.hora).toBe('14:00:00');
    expect(linhaParaHorario({ ...comId<LinhaHorario>(linha), hora: '14:00:00' }).hora).toBe('14:00');
  });

  it('aceita a hora do banco com ou sem segundos', () => {
    const linha = comId<LinhaHorario>(horarioParaLinha(horario));
    expect(linhaParaHorario({ ...linha, hora: '08:05' }).hora).toBe('08:05');
    expect(linhaParaHorario({ ...linha, hora: '08:05:00' }).hora).toBe('08:05');
  });
});

describe('avaliação', () => {
  const avaliacao: Avaliacao = {
    id: '55555555-5555-4555-8555-555555555555',
    pacienteId: pacienteCompleto.id,
    inicio: '2026-10-14',
    fim: null,
    sessoesPrevistas: 10,
    etapas: [
      { nome: 'Entrevista com os responsáveis', feita: true },
      { nome: 'Testes aplicados', feita: false },
    ],
  };

  it('ida e volta preserva as etapas e os demais campos', () => {
    expect(linhaParaAvaliacao(comId<LinhaAvaliacao>(avaliacaoParaLinha(avaliacao)))).toEqual(avaliacao);
    const encerrada = { ...avaliacao, fim: '2026-12-16', etapas: [] };
    expect(linhaParaAvaliacao(comId<LinhaAvaliacao>(avaliacaoParaLinha(encerrada)))).toEqual(encerrada);
  });

  it('as etapas vão como lista (jsonb)', () => {
    expect(avaliacaoParaLinha(avaliacao).etapas).toEqual(avaliacao.etapas);
  });

  it('etapas ausentes ou fora do formato viram lista vazia', () => {
    const linha = comId<LinhaAvaliacao>(avaliacaoParaLinha(avaliacao));
    expect(linhaParaAvaliacao({ ...linha, etapas: null as never }).etapas).toEqual([]);
  });
});

describe('sessão', () => {
  const sessao: Sessao = {
    id: '66666666-6666-4666-8666-666666666666',
    pacienteId: pacienteCompleto.id,
    inicio: '2026-11-03T17:00:00.000Z',
    duracaoMin: 50,
    tipo: 'avaliacao',
    acompanhamentoFamiliar: true,
    origem: 'remarcacao',
    horarioFixoId: '44444444-4444-4444-8444-444444444444',
    dataOcorrencia: '2026-11-03',
    situacao: 'remarcada',
    remarcadaPara: '77777777-7777-4777-8777-777777777777',
    avaliacaoId: '55555555-5555-4555-8555-555555555555',
    confirmada: true,
    observacao: 'Trazer os testes',
  };
  const avulsa: Sessao = {
    ...sessao,
    origem: 'avulsa',
    horarioFixoId: null,
    dataOcorrencia: null,
    remarcadaPara: null,
    avaliacaoId: null,
    observacao: null,
    situacao: 'agendada',
    confirmada: false,
    acompanhamentoFamiliar: false,
  };

  it.each([
    ['completa', sessao],
    ['avulsa, com nulos', avulsa],
  ])('ida e volta preserva todos os campos (%s)', (_nome, s) => {
    expect(linhaParaSessao(comId<LinhaSessao>(sessaoParaLinha(s)))).toEqual(s);
  });

  it('usa as colunas do banco', () => {
    expect(sessaoParaLinha(sessao)).toEqual({
      id: sessao.id,
      paciente_id: sessao.pacienteId,
      inicio: '2026-11-03T17:00:00.000Z',
      duracao_min: 50,
      tipo: 'avaliacao',
      acompanhamento_familiar: true,
      origem: 'remarcacao',
      horario_fixo_id: '44444444-4444-4444-8444-444444444444',
      data_ocorrencia: '2026-11-03',
      situacao: 'remarcada',
      remarcada_para: '77777777-7777-4777-8777-777777777777',
      avaliacao_id: '55555555-5555-4555-8555-555555555555',
      confirmada: true,
      observacao: 'Trazer os testes',
    });
  });

  it.each([
    ['2026-11-03T17:00:00+00:00', '2026-11-03T17:00:00.000Z'],
    ['2026-11-03T14:00:00-03:00', '2026-11-03T17:00:00.000Z'],
    ['2026-11-03T17:00:00.123456+00:00', '2026-11-03T17:00:00.123Z'],
    ['2026-11-03T17:00:00.000Z', '2026-11-03T17:00:00.000Z'],
  ])('lê o instante %s como %s', (bruto, esperado) => {
    const linha = { ...comId<LinhaSessao>(sessaoParaLinha(sessao)), inicio: bruto };
    expect(linhaParaSessao(linha).inicio).toBe(esperado);
  });

  describe('mudancasSessaoParaLinha', () => {
    it('converte só os campos presentes', () => {
      expect(mudancasSessaoParaLinha({ situacao: 'compareceu', confirmada: true })).toEqual({
        situacao: 'compareceu',
        confirmada: true,
      });
    });

    it('preserva null (voltar um campo para vazio) e ignora undefined', () => {
      expect(mudancasSessaoParaLinha({ remarcadaPara: null, observacao: undefined })).toEqual({
        remarcada_para: null,
      });
    });

    it('cobre todas as colunas, no mesmo formato de sessaoParaLinha', () => {
      const { id, pacienteId, ...mudancas } = sessao;
      void id;
      void pacienteId;
      const { id: _id, paciente_id, ...colunas } = sessaoParaLinha(sessao);
      void _id;
      void paciente_id;
      expect(mudancasSessaoParaLinha(mudancas)).toEqual(colunas);
    });
  });
});

describe('bloqueio', () => {
  const bloqueio: Bloqueio = {
    id: '88888888-8888-4888-8888-888888888888',
    inicio: '2026-12-21',
    fim: '2027-01-04',
    motivo: 'Recesso',
  };
  it('ida e volta preserva todos os campos', () => {
    expect(linhaParaBloqueio(comId<LinhaBloqueio>(bloqueioParaLinha(bloqueio)))).toEqual(bloqueio);
  });
});

describe('parceiro', () => {
  const parceiro: Parceiro = {
    id: '22222222-2222-4222-8222-222222222222',
    nome: 'Dra. Marta Ribeiro',
    profissao: 'Neuropediatra',
    contato: '(85) 90000-0100',
    observacoes: 'Atende às terças',
  };
  it('ida e volta preserva todos os campos', () => {
    expect(linhaParaParceiro(comId<LinhaParceiro>(parceiroParaLinha(parceiro)))).toEqual(parceiro);
  });
  it('lê textos nulos do banco como texto vazio', () => {
    const linha = { ...comId<LinhaParceiro>(parceiroParaLinha(parceiro)), profissao: null, contato: null, observacoes: null };
    expect(linhaParaParceiro(linha)).toEqual({ ...parceiro, profissao: '', contato: '', observacoes: '' });
  });
});

describe('configurações', () => {
  it('ida e volta preserva todos os campos', () => {
    expect(linhaParaConfiguracoes(configuracoesParaLinha(CONFIGURACOES_PADRAO))).toEqual(CONFIGURACOES_PADRAO);
  });

  it('usa as colunas do banco e não manda dono nem criado_em', () => {
    const linha = configuracoesParaLinha(CONFIGURACOES_PADRAO);
    expect(linha).toMatchObject({
      nome_completo: 'Juliana Queiroz Feliciano',
      duracao_padrao_min: 50,
      sessoes_avaliacao_padrao: 10,
      mensagem_whatsapp: CONFIGURACOES_PADRAO.mensagemWhatsapp,
      semanas_geradas: 4,
      bloqueio_minutos: 15,
    });
    expect(linha).not.toHaveProperty('dono');
    expect(linha).not.toHaveProperty('criado_em');
  });

  it('lê textos nulos do banco como texto vazio', () => {
    const linha = { ...configuracoesParaLinha(CONFIGURACOES_PADRAO), cpf: null, instagram: null };
    expect(linhaParaConfiguracoes(linha)).toEqual({ ...CONFIGURACOES_PADRAO, cpf: '', instagram: '' });
  });
});
