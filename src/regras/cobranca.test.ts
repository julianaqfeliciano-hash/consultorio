import { describe, expect, it } from 'vitest';
import type {
  FormaPagamento,
  Pagamento,
  ReferenciaPagamento,
  SituacaoSessao,
  TipoDesconto,
} from '../dominio/tipos';
import { avaliacaoExemplo, pacienteExemplo, sessaoExemplo } from '../testes/fabricas';
import {
  mesDaSessao,
  mesPorExtenso,
  pendenciasDoPaciente,
  resumoAReceber,
  valorCobradoDaSessao,
  valorFinalDaAvaliacao,
} from './cobranca';

describe('valorCobradoDaSessao', () => {
  it('psicoterapia compareceu e falta sem aviso são cobradas', () => {
    expect(valorCobradoDaSessao({ tipo: 'psicoterapia', situacao: 'compareceu' }, 18000)).toBe(18000);
    expect(valorCobradoDaSessao({ tipo: 'psicoterapia', situacao: 'falta_sem_aviso' }, 18000)).toBe(18000);
  });

  it('psicoterapia nas demais situações não é cobrada', () => {
    const naoCobradas: SituacaoSessao[] = ['agendada', 'falta_com_aviso', 'cancelada', 'remarcada'];
    for (const situacao of naoCobradas) {
      expect(valorCobradoDaSessao({ tipo: 'psicoterapia', situacao }, 18000)).toBeNull();
    }
  });

  it('avaliação: o comparecimento faz parte do pacote, só a falta sem aviso é cobrada à parte', () => {
    expect(valorCobradoDaSessao({ tipo: 'avaliacao', situacao: 'compareceu' }, 16000)).toBeNull();
    expect(valorCobradoDaSessao({ tipo: 'avaliacao', situacao: 'falta_sem_aviso' }, 16000)).toBe(16000);
    const outras: SituacaoSessao[] = ['agendada', 'falta_com_aviso', 'cancelada', 'remarcada'];
    for (const situacao of outras) {
      expect(valorCobradoDaSessao({ tipo: 'avaliacao', situacao }, 16000)).toBeNull();
    }
  });

  it('valor zero continua sendo um valor (não vira null)', () => {
    expect(valorCobradoDaSessao({ tipo: 'psicoterapia', situacao: 'compareceu' }, 0)).toBe(0);
  });
});

describe('valorFinalDaAvaliacao', () => {
  const a = (descontoTipo: TipoDesconto, descontoValor: number, valorPrevistoCentavos = 180000) => ({
    valorPrevistoCentavos,
    descontoTipo,
    descontoValor,
  });

  it('porcentagem tira a parte do previsto', () => {
    expect(valorFinalDaAvaliacao(a('percentual', 15))).toBe(153000);
    expect(valorFinalDaAvaliacao(a('percentual', 0))).toBe(180000);
    expect(valorFinalDaAvaliacao(a('percentual', 100))).toBe(0);
  });

  it('porcentagem arredonda para o centavo mais próximo', () => {
    expect(valorFinalDaAvaliacao(a('percentual', 10, 12345))).toBe(11111); // 11110,5
    expect(valorFinalDaAvaliacao(a('percentual', 33, 99999))).toBe(66999); // 66999,33
    expect(valorFinalDaAvaliacao(a('percentual', 33, 100001))).toBe(67001); // 67000,67
  });

  it('porcentagem acima de 100 não deixa o valor negativo', () => {
    expect(valorFinalDaAvaliacao(a('percentual', 120))).toBe(0);
  });

  it('desconto em reais (centavos) tira o valor, sem passar de zero', () => {
    expect(valorFinalDaAvaliacao(a('reais', 20000))).toBe(160000);
    expect(valorFinalDaAvaliacao(a('reais', 180000))).toBe(0);
    expect(valorFinalDaAvaliacao(a('reais', 200000))).toBe(0);
  });

  it('sem desconto é o valor previsto, mesmo que haja um número guardado', () => {
    expect(valorFinalDaAvaliacao(a('nenhum', 0))).toBe(180000);
    expect(valorFinalDaAvaliacao(a('nenhum', 15))).toBe(180000);
  });
});

describe('mesDaSessao', () => {
  it('é o dia 1 do mês local, não do mês UTC', () => {
    expect(mesDaSessao('2026-11-03T17:00:00.000Z')).toBe('2026-11-01');
    // 02:30 UTC de 01/11 ainda é 23:30 de 31/10 em São Paulo.
    expect(mesDaSessao('2026-11-01T02:30:00.000Z')).toBe('2026-10-01');
  });

  it('vira o mês à meia-noite de São Paulo (03:00 UTC)', () => {
    expect(mesDaSessao('2026-12-01T02:59:59.000Z')).toBe('2026-11-01');
    expect(mesDaSessao('2026-12-01T03:00:00.000Z')).toBe('2026-12-01');
  });

  it('vira o ano junto', () => {
    expect(mesDaSessao('2027-01-01T02:00:00.000Z')).toBe('2026-12-01');
    expect(mesDaSessao('2027-01-01T03:00:00.000Z')).toBe('2027-01-01');
  });
});

describe('mesPorExtenso', () => {
  it('escreve o mês em português, em minúsculas', () => {
    expect(mesPorExtenso('2026-11-01')).toBe('novembro de 2026');
  });

  it('cobre os doze meses', () => {
    const nomes = [
      'janeiro',
      'fevereiro',
      'março',
      'abril',
      'maio',
      'junho',
      'julho',
      'agosto',
      'setembro',
      'outubro',
      'novembro',
      'dezembro',
    ];
    nomes.forEach((nome, i) => {
      const mes = String(i + 1).padStart(2, '0');
      expect(mesPorExtenso(`2027-${mes}-01`)).toBe(`${nome} de 2027`);
    });
  });
});

describe('pendenciasDoPaciente', () => {
  const hoje = '2026-11-02';
  const mensal = pacienteExemplo({ formaCobranca: 'mensal', valorSessaoCentavos: 20000 });
  const porSessao = pacienteExemplo({ formaCobranca: 'por_sessao', valorSessaoCentavos: 20000 });

  // Terças de outubro e novembro às 14:00 (17:00 UTC).
  const OUT_06 = '2026-10-06T17:00:00.000Z';
  const OUT_13 = '2026-10-13T17:00:00.000Z';
  const OUT_20 = '2026-10-20T17:00:00.000Z';
  const NOV_03 = '2026-11-03T17:00:00.000Z';

  const cobrada = (id: string, inicio: string, valorCentavos: number | null = 20000, sobre = {}) =>
    sessaoExemplo({ id, inicio, situacao: 'compareceu', valorCentavos, ...sobre });

  const pagamento = (
    referencia: ReferenciaPagamento,
    valorCentavos: number,
    sobre: Partial<Pagamento> = {},
  ): Pagamento => ({
    id: 'pg1',
    pacienteId: 'p1',
    data: '2026-11-02',
    valorCentavos,
    forma: 'pix' satisfies FormaPagamento,
    observacao: null,
    referencia,
    mesReferencia: null,
    avaliacaoId: null,
    sessaoIds: [],
    ...sobre,
  });

  const outubro = [cobrada('s1', OUT_06), cobrada('s2', OUT_13), cobrada('s3', OUT_20)];

  describe('quem paga por mês', () => {
    it('três sessões de outubro sem pagamento viram um mês devendo', () => {
      const r = pendenciasDoPaciente({ paciente: mensal, sessoes: outubro, pagamentos: [], avaliacao: null, hoje });
      expect(r.meses).toHaveLength(1);
      expect(r.meses[0]).toMatchObject({
        mes: '2026-10-01',
        totalCentavos: 60000,
        situacao: 'devendo',
        pagamento: null,
        diferencaCentavos: 0,
      });
      expect(r.meses[0].sessoes.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
      expect(r.sessoesAbertas).toEqual([]);
      expect(r.avaliacao).toBeNull();
      expect(r.totalEmAbertoCentavos).toBe(60000);
      expect(r.desde).toBe('2026-10-01');
    });

    it('o mês soma o valor guardado em cada sessão (reajuste não muda o passado)', () => {
      const sessoes = [cobrada('s1', OUT_06), cobrada('s2', OUT_13), cobrada('s3', OUT_20, 22000)];
      const r = pendenciasDoPaciente({ paciente: mensal, sessoes, pagamentos: [], avaliacao: null, hoje });
      expect(r.meses[0].totalCentavos).toBe(62000);
      expect(r.totalEmAbertoCentavos).toBe(62000);
    });

    it('mês pago: a diferença é o total de agora menos o que foi pago', () => {
      const pago = pagamento('mes', 60000, { mesReferencia: '2026-10-01' });
      // Uma das sessões deixou de ser cobrada depois do pagamento.
      const sessoes = [cobrada('s1', OUT_06), cobrada('s2', OUT_13), cobrada('s3', OUT_20, null)];
      const r = pendenciasDoPaciente({ paciente: mensal, sessoes, pagamentos: [pago], avaliacao: null, hoje });
      expect(r.meses).toHaveLength(1);
      expect(r.meses[0]).toMatchObject({
        mes: '2026-10-01',
        totalCentavos: 40000,
        situacao: 'pago',
        pagamento: pago,
        diferencaCentavos: -20000,
      });
      expect(r.totalEmAbertoCentavos).toBe(0);
      expect(r.desde).toBeNull();
    });

    it('mês pago: a diferença pode ser zero ou positiva, e mês pago não está em aberto', () => {
      const pago = pagamento('mes', 60000, { mesReferencia: '2026-10-01' });
      const exato = pendenciasDoPaciente({ paciente: mensal, sessoes: outubro, pagamentos: [pago], avaliacao: null, hoje });
      expect(exato.meses[0]).toMatchObject({ situacao: 'pago', diferencaCentavos: 0 });

      const maisUma = [...outubro, cobrada('s4', '2026-10-27T17:00:00.000Z')];
      const aMais = pendenciasDoPaciente({ paciente: mensal, sessoes: maisUma, pagamentos: [pago], avaliacao: null, hoje });
      expect(aMais.meses[0]).toMatchObject({ situacao: 'pago', totalCentavos: 80000, diferencaCentavos: 20000 });
      expect(aMais.totalEmAbertoCentavos).toBe(0);
    });

    it('mês pago continua aparecendo se todas as sessões deixarem de ser cobradas', () => {
      const pago = pagamento('mes', 60000, { mesReferencia: '2026-10-01' });
      const sessoes = outubro.map((s) => ({ ...s, valorCentavos: null }));
      const r = pendenciasDoPaciente({ paciente: mensal, sessoes, pagamentos: [pago], avaliacao: null, hoje });
      expect(r.meses).toHaveLength(1);
      expect(r.meses[0]).toMatchObject({ totalCentavos: 0, situacao: 'pago', diferencaCentavos: -60000 });
    });

    it('mês de hoje está em andamento e já conta no total', () => {
      const r = pendenciasDoPaciente({
        paciente: mensal,
        sessoes: [cobrada('s9', NOV_03)],
        pagamentos: [],
        avaliacao: null,
        hoje: '2026-11-03',
      });
      expect(r.meses).toHaveLength(1);
      expect(r.meses[0]).toMatchObject({ mes: '2026-11-01', totalCentavos: 20000, situacao: 'em_andamento' });
      expect(r.totalEmAbertoCentavos).toBe(20000);
      expect(r.desde).toBe('2026-11-01');
    });

    it('o mês em andamento pode ser pago antes de acabar', () => {
      const pago = pagamento('mes', 20000, { mesReferencia: '2026-11-01' });
      const r = pendenciasDoPaciente({
        paciente: mensal,
        sessoes: [cobrada('s9', NOV_03)],
        pagamentos: [pago],
        avaliacao: null,
        hoje: '2026-11-03',
      });
      expect(r.meses[0]).toMatchObject({ situacao: 'pago', diferencaCentavos: 0 });
      expect(r.totalEmAbertoCentavos).toBe(0);
    });

    it('mês passado devendo e mês atual em andamento somam juntos, do mais antigo ao mais novo', () => {
      const sessoes = [cobrada('s9', NOV_03), ...outubro];
      const r = pendenciasDoPaciente({ paciente: mensal, sessoes, pagamentos: [], avaliacao: null, hoje: '2026-11-03' });
      expect(r.meses.map((m) => [m.mes, m.situacao, m.totalCentavos])).toEqual([
        ['2026-10-01', 'devendo', 60000],
        ['2026-11-01', 'em_andamento', 20000],
      ]);
      expect(r.totalEmAbertoCentavos).toBe(80000);
      expect(r.desde).toBe('2026-10-01');
    });

    it('mês com total zero e sem pagamento não aparece', () => {
      const sessoes = [cobrada('s1', OUT_06, null), cobrada('s2', OUT_13, 0)];
      const r = pendenciasDoPaciente({ paciente: mensal, sessoes, pagamentos: [], avaliacao: null, hoje });
      expect(r.meses).toEqual([]);
      expect(r.totalEmAbertoCentavos).toBe(0);
      expect(r.desde).toBeNull();
    });

    it('sessão sem valor fixado não entra no mês', () => {
      const sessoes = [...outubro, cobrada('s4', '2026-10-27T17:00:00.000Z', null)];
      const r = pendenciasDoPaciente({ paciente: mensal, sessoes, pagamentos: [], avaliacao: null, hoje });
      expect(r.meses[0].sessoes).toHaveLength(3);
      expect(r.meses[0].totalCentavos).toBe(60000);
    });

    it('o mês é o da data local: 23:30 de 31/10 em São Paulo ainda é outubro', () => {
      const viradaDoMes = cobrada('s5', '2026-11-01T02:30:00.000Z');
      const r = pendenciasDoPaciente({ paciente: mensal, sessoes: [viradaDoMes], pagamentos: [], avaliacao: null, hoje });
      expect(r.meses.map((m) => m.mes)).toEqual(['2026-10-01']);
      expect(r.desde).toBe('2026-10-01');
    });

    it('sessão paga individualmente nunca entra no mês', () => {
      const avulso = pagamento('sessoes', 20000, { id: 'pg2', sessaoIds: ['s2'] });
      const r = pendenciasDoPaciente({ paciente: mensal, sessoes: outubro, pagamentos: [avulso], avaliacao: null, hoje });
      expect(r.meses[0].sessoes.map((s) => s.id)).toEqual(['s1', 's3']);
      expect(r.meses[0].totalCentavos).toBe(40000);
      expect(r.sessoesAbertas).toEqual([]);
      expect(r.totalEmAbertoCentavos).toBe(40000);
    });

    it('pagamento do mês de outro paciente, na mesma lista, não quita o mês deste', () => {
      const deOutro = pagamento('mes', 60000, { id: 'px', pacienteId: 'p2', mesReferencia: '2026-10-01' });
      const r = pendenciasDoPaciente({ paciente: mensal, sessoes: outubro, pagamentos: [deOutro], avaliacao: null, hoje });
      expect(r.meses).toHaveLength(1);
      expect(r.meses[0]).toMatchObject({ mes: '2026-10-01', situacao: 'devendo', pagamento: null, totalCentavos: 60000 });
      expect(r.totalEmAbertoCentavos).toBe(60000);
    });

    it('pagamentos de outro paciente (sessões e avaliação) também são ignorados', () => {
      const avaliacao = avaliacaoExemplo({ id: 'av1', inicio: '2026-10-20', valorPrevistoCentavos: 100000 });
      const sessoes = [cobrada('s1', OUT_06)];
      const deOutro = [
        pagamento('sessoes', 20000, { id: 'py', pacienteId: 'p2', sessaoIds: ['s1'] }),
        pagamento('avaliacao', 100000, { id: 'pz', pacienteId: 'p2', avaliacaoId: 'av1' }),
      ];
      const r = pendenciasDoPaciente({ paciente: porSessao, sessoes, pagamentos: deOutro, avaliacao, hoje });
      expect(r.sessoesAbertas.map((s) => s.id)).toEqual(['s1']);
      expect(r.avaliacao).toEqual({ valorFinalCentavos: 100000, pagoCentavos: 0, faltaCentavos: 100000 });
      expect(r.totalEmAbertoCentavos).toBe(120000);
    });

    it('as sessões do mês e a lista de meses saem em ordem, mesmo com a entrada embaralhada', () => {
      const sessoes = [cobrada('s9', NOV_03), outubro[2], outubro[0], outubro[1]];
      const r = pendenciasDoPaciente({ paciente: mensal, sessoes, pagamentos: [], avaliacao: null, hoje: '2026-11-03' });
      expect(r.meses.map((m) => m.mes)).toEqual(['2026-10-01', '2026-11-01']);
      expect(r.meses[0].sessoes.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
    });

    it('falta sem aviso de psicoterapia de quem paga por mês entra no mês', () => {
      const sessoes = [cobrada('s1', OUT_06), cobrada('s2', OUT_13, 20000, { situacao: 'falta_sem_aviso' })];
      const r = pendenciasDoPaciente({ paciente: mensal, sessoes, pagamentos: [], avaliacao: null, hoje });
      expect(r.sessoesAbertas).toEqual([]);
      expect(r.meses[0].totalCentavos).toBe(40000);
    });
  });

  describe('quem paga por sessão', () => {
    it('duas sessões com valor, uma já paga: só a outra fica aberta', () => {
      const sessoes = [cobrada('s1', OUT_06), cobrada('s2', OUT_13)];
      const paga = pagamento('sessoes', 20000, { sessaoIds: ['s1'] });
      const r = pendenciasDoPaciente({ paciente: porSessao, sessoes, pagamentos: [paga], avaliacao: null, hoje });
      expect(r.sessoesAbertas.map((s) => s.id)).toEqual(['s2']);
      expect(r.meses).toEqual([]);
      expect(r.totalEmAbertoCentavos).toBe(20000);
      expect(r.desde).toBe('2026-10-13');
    });

    it('um pagamento pode quitar várias sessões', () => {
      const sessoes = [cobrada('s1', OUT_06), cobrada('s2', OUT_13), cobrada('s3', OUT_20)];
      const paga = pagamento('sessoes', 40000, { sessaoIds: ['s1', 's3'] });
      const r = pendenciasDoPaciente({ paciente: porSessao, sessoes, pagamentos: [paga], avaliacao: null, hoje });
      expect(r.sessoesAbertas.map((s) => s.id)).toEqual(['s2']);
    });

    it('as abertas saem da mais antiga para a mais nova, e o total soma o valor de cada uma', () => {
      const sessoes = [cobrada('s3', OUT_20, 22000), cobrada('s1', OUT_06), cobrada('s2', OUT_13)];
      const r = pendenciasDoPaciente({ paciente: porSessao, sessoes, pagamentos: [], avaliacao: null, hoje });
      expect(r.sessoesAbertas.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
      expect(r.totalEmAbertoCentavos).toBe(62000);
      expect(r.desde).toBe('2026-10-06');
    });

    it('sessão sem valor (agendada, falta com aviso…) não fica em aberto', () => {
      const sessoes = [cobrada('s1', OUT_06, null), cobrada('s2', OUT_13, null, { situacao: 'falta_com_aviso' })];
      const r = pendenciasDoPaciente({ paciente: porSessao, sessoes, pagamentos: [], avaliacao: null, hoje });
      expect(r.sessoesAbertas).toEqual([]);
      expect(r.totalEmAbertoCentavos).toBe(0);
      expect(r.desde).toBeNull();
    });

    it('pagamento do mês ou da avaliação não quita sessão avulsa', () => {
      const sessoes = [cobrada('s1', OUT_06)];
      const doMes = pagamento('mes', 20000, { mesReferencia: '2026-10-01', sessaoIds: ['s1'] });
      const r = pendenciasDoPaciente({ paciente: porSessao, sessoes, pagamentos: [doMes], avaliacao: null, hoje });
      expect(r.sessoesAbertas.map((s) => s.id)).toEqual(['s1']);
    });

    it('sessão de valor zero não fica em aberto (não há pagamento de zero para quitá-la)', () => {
      const sessoes = [cobrada('s1', OUT_06, 0), cobrada('s2', OUT_13, 0, { tipo: 'avaliacao', situacao: 'falta_sem_aviso' })];
      const r = pendenciasDoPaciente({ paciente: porSessao, sessoes, pagamentos: [], avaliacao: null, hoje });
      expect(r.sessoesAbertas).toEqual([]);
      expect(r.totalEmAbertoCentavos).toBe(0);
      expect(r.desde).toBeNull();
    });

    it('sessão de valor zero mais antiga que uma dívida de verdade não puxa o desde', () => {
      const sessoes = [cobrada('s1', OUT_06, 0), cobrada('s2', OUT_13)];
      const r = pendenciasDoPaciente({ paciente: porSessao, sessoes, pagamentos: [], avaliacao: null, hoje });
      expect(r.sessoesAbertas.map((s) => s.id)).toEqual(['s2']);
      expect(r.totalEmAbertoCentavos).toBe(20000);
      expect(r.desde).toBe('2026-10-13');
    });

    it('a data de desde é a data local da sessão', () => {
      const r = pendenciasDoPaciente({
        paciente: porSessao,
        sessoes: [cobrada('s5', '2026-11-01T02:30:00.000Z')],
        pagamentos: [],
        avaliacao: null,
        hoje,
      });
      expect(r.desde).toBe('2026-10-31');
    });
  });

  describe('avaliação', () => {
    const avaliacao = avaliacaoExemplo({
      id: 'av1',
      inicio: '2026-10-20',
      valorPrevistoCentavos: 180000,
      descontoTipo: 'percentual',
      descontoValor: 15,
    });
    const parcela = (id: string, valor: number) =>
      pagamento('avaliacao', valor, { id, avaliacaoId: 'av1', data: '2026-10-25' });

    it('mostra o valor final, o que foi pago em parcelas e o que falta', () => {
      const r = pendenciasDoPaciente({
        paciente: mensal,
        sessoes: [],
        pagamentos: [parcela('pa', 50000), parcela('pb', 30000)],
        avaliacao,
        hoje,
      });
      expect(r.avaliacao).toEqual({ valorFinalCentavos: 153000, pagoCentavos: 80000, faltaCentavos: 73000 });
      expect(r.totalEmAbertoCentavos).toBe(73000);
      expect(r.desde).toBe('2026-10-20');
    });

    it('a falta sem aviso da avaliação é cobrada à parte, na lista de sessões abertas', () => {
      const falta = cobrada('s7', OUT_13, 16000, {
        tipo: 'avaliacao',
        avaliacaoId: 'av1',
        situacao: 'falta_sem_aviso',
      });
      const comparecimento = cobrada('s8', OUT_20, null, { tipo: 'avaliacao', avaliacaoId: 'av1' });
      const r = pendenciasDoPaciente({
        paciente: porSessao,
        sessoes: [falta, comparecimento],
        pagamentos: [parcela('pa', 50000), parcela('pb', 30000)],
        avaliacao,
        hoje,
      });
      expect(r.sessoesAbertas.map((s) => s.id)).toEqual(['s7']);
      expect(r.avaliacao).toEqual({ valorFinalCentavos: 153000, pagoCentavos: 80000, faltaCentavos: 73000 });
      expect(r.totalEmAbertoCentavos).toBe(16000 + 73000);
      // A falta (13/10) é anterior ao início da avaliação (20/10).
      expect(r.desde).toBe('2026-10-13');
    });

    it('a falta sem aviso da avaliação vai para as abertas também quando o paciente paga por mês', () => {
      const falta = cobrada('s7', OUT_13, 16000, { tipo: 'avaliacao', avaliacaoId: 'av1', situacao: 'falta_sem_aviso' });
      const r = pendenciasDoPaciente({ paciente: mensal, sessoes: [falta], pagamentos: [], avaliacao, hoje });
      expect(r.sessoesAbertas.map((s) => s.id)).toEqual(['s7']);
      expect(r.meses).toEqual([]);
    });

    it('comparecimento à avaliação nunca é cobrado à parte', () => {
      const comparecimento = cobrada('s8', OUT_20, 16000, { tipo: 'avaliacao', avaliacaoId: 'av1' });
      for (const paciente of [porSessao, mensal]) {
        const r = pendenciasDoPaciente({ paciente, sessoes: [comparecimento], pagamentos: [], avaliacao: null, hoje });
        expect(r.sessoesAbertas).toEqual([]);
        expect(r.meses).toEqual([]);
      }
    });

    it('só conta pagamentos desta avaliação', () => {
      const deOutra = pagamento('avaliacao', 99000, { id: 'px', avaliacaoId: 'av-antiga' });
      const doMes = pagamento('mes', 5000, { id: 'py', mesReferencia: '2026-10-01' });
      const r = pendenciasDoPaciente({
        paciente: mensal,
        sessoes: [],
        pagamentos: [deOutra, doMes, parcela('pa', 50000)],
        avaliacao,
        hoje,
      });
      expect(r.avaliacao).toEqual({ valorFinalCentavos: 153000, pagoCentavos: 50000, faltaCentavos: 103000 });
    });

    it('avaliação quitada não fica em aberto e não puxa o desde', () => {
      const r = pendenciasDoPaciente({
        paciente: mensal,
        sessoes: [],
        pagamentos: [parcela('pa', 153000)],
        avaliacao,
        hoje,
      });
      expect(r.avaliacao).toEqual({ valorFinalCentavos: 153000, pagoCentavos: 153000, faltaCentavos: 0 });
      expect(r.totalEmAbertoCentavos).toBe(0);
      expect(r.desde).toBeNull();
    });

    it('pago a mais não deixa a falta negativa nem diminui o total de outras pendências', () => {
      const r = pendenciasDoPaciente({
        paciente: porSessao,
        sessoes: [cobrada('s1', OUT_06)],
        pagamentos: [parcela('pa', 160000)],
        avaliacao,
        hoje,
      });
      expect(r.avaliacao?.faltaCentavos).toBe(0);
      expect(r.totalEmAbertoCentavos).toBe(20000);
    });

    it('sem avaliação, o campo é nulo', () => {
      const r = pendenciasDoPaciente({ paciente: mensal, sessoes: [], pagamentos: [], avaliacao: null, hoje });
      expect(r.avaliacao).toBeNull();
    });
  });

  describe('em geral', () => {
    it('sem nada para cobrar o total é zero e não há desde', () => {
      const r = pendenciasDoPaciente({ paciente: mensal, sessoes: [], pagamentos: [], avaliacao: null, hoje });
      expect(r).toEqual({ sessoesAbertas: [], meses: [], avaliacao: null, totalEmAbertoCentavos: 0, desde: null });
    });

    it('desde é a data mais antiga entre sessões abertas, meses não pagos e a avaliação', () => {
      const avaliacao = avaliacaoExemplo({ id: 'av1', inicio: '2026-09-15', valorPrevistoCentavos: 100000 });
      const r = pendenciasDoPaciente({
        paciente: porSessao,
        sessoes: [cobrada('s1', OUT_13)],
        pagamentos: [],
        avaliacao,
        hoje,
      });
      expect(r.desde).toBe('2026-09-15');
    });

    it('não altera o que recebeu', () => {
      const sessoes = [cobrada('s3', OUT_20), cobrada('s1', OUT_06)];
      const pagamentos = [pagamento('sessoes', 20000, { sessaoIds: ['s9'] })];
      const copia = structuredClone({ sessoes, pagamentos });
      pendenciasDoPaciente({ paciente: porSessao, sessoes, pagamentos, avaliacao: null, hoje });
      expect({ sessoes, pagamentos }).toEqual(copia);
    });
  });
});

describe('resumoAReceber', () => {
  const hoje = '2026-11-02';
  const ana = pacienteExemplo({ id: 'pa', nome: 'Ana', formaCobranca: 'por_sessao' });
  const bia = pacienteExemplo({ id: 'pb', nome: 'Bia', formaCobranca: 'por_sessao' });
  const caio = pacienteExemplo({ id: 'pc', nome: 'Caio', formaCobranca: 'por_sessao' });
  const dani = pacienteExemplo({ id: 'pd', nome: 'Dani', formaCobranca: 'mensal' });

  const sessao = (id: string, pacienteId: string, inicio: string) =>
    sessaoExemplo({ id, pacienteId, inicio, situacao: 'compareceu', valorCentavos: 20000 });
  const pendencias = (paciente: typeof ana, sessoes: ReturnType<typeof sessao>[]) =>
    pendenciasDoPaciente({ paciente, sessoes, pagamentos: [], avaliacao: null, hoje });

  it('ordena por desde, do mais antigo ao mais novo, e omite quem não deve nada', () => {
    const itens = [
      { paciente: ana, pendencias: pendencias(ana, [sessao('a1', 'pa', '2026-10-27T17:00:00.000Z')]) },
      { paciente: bia, pendencias: pendencias(bia, []) },
      { paciente: caio, pendencias: pendencias(caio, [sessao('c1', 'pc', '2026-10-06T17:00:00.000Z'), sessao('c2', 'pc', '2026-10-13T17:00:00.000Z')]) },
      { paciente: dani, pendencias: pendencias(dani, [sessao('d1', 'pd', '2026-10-15T17:00:00.000Z')]) },
    ];
    expect(resumoAReceber(itens)).toEqual([
      { paciente: dani, totalCentavos: 20000, desde: '2026-10-01' },
      { paciente: caio, totalCentavos: 40000, desde: '2026-10-06' },
      { paciente: ana, totalCentavos: 20000, desde: '2026-10-27' },
    ]);
  });

  it('lista vazia e lista só de quem está em dia dão resumo vazio', () => {
    expect(resumoAReceber([])).toEqual([]);
    expect(resumoAReceber([{ paciente: bia, pendencias: pendencias(bia, []) }])).toEqual([]);
  });

  it('quem tem o mesmo desde mantém a ordem de entrada', () => {
    const itens = [
      { paciente: caio, pendencias: pendencias(caio, [sessao('c1', 'pc', '2026-10-06T17:00:00.000Z')]) },
      { paciente: ana, pendencias: pendencias(ana, [sessao('a1', 'pa', '2026-10-06T17:00:00.000Z')]) },
    ];
    expect(resumoAReceber(itens).map((r) => r.paciente.id)).toEqual(['pc', 'pa']);
  });
});
