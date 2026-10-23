import { describe, expect, it } from 'vitest';
import type {
  Avaliacao,
  Bloqueio,
  HorarioComPaciente,
  Sessao,
  SituacaoSessao,
} from '../dominio/tipos';
import {
  chaveOcorrencia,
  ehCobravel,
  estaBloqueado,
  gerarOcorrencias,
  numeroNaAvaliacao,
  selecionarAgendadas,
  sessaoAtualNaAvaliacao,
  separarSessoesDoPaciente,
} from './agenda';

// Base: horário terça 14:00, 50 min, válido desde 2026-10-01, paciente ativo em psicoterapia.
const h: HorarioComPaciente = {
  id: 'hf1',
  pacienteId: 'p1',
  diaSemana: 2,
  hora: '14:00',
  duracaoMin: 50,
  validoDe: '2026-10-01',
  validoAte: null,
  statusPaciente: 'ativo',
  tipoPaciente: 'psicoterapia',
  avaliacaoId: null,
};

const periodo = { de: '2026-11-02', ate: '2026-11-29' };

describe('gerarOcorrencias', () => {
  it('gera uma sessão por semana no dia certo', () => {
    const r = gerarOcorrencias({ horarios: [h], bloqueios: [], existentes: new Set(), ...periodo });
    expect(r.map((s) => s.dataOcorrencia)).toEqual(['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24']);
    expect(r[0]).toMatchObject({
      inicio: '2026-11-03T17:00:00.000Z',
      duracaoMin: 50,
      tipo: 'psicoterapia',
      origem: 'fixa',
      horarioFixoId: h.id,
      situacao: 'agendada',
      confirmada: false,
      acompanhamentoFamiliar: false,
    });
  });

  it('preenche todos os campos de NovaSessao', () => {
    const [s] = gerarOcorrencias({ horarios: [h], bloqueios: [], existentes: new Set(), ...periodo });
    expect(s).toEqual({
      pacienteId: 'p1',
      inicio: '2026-11-03T17:00:00.000Z',
      duracaoMin: 50,
      tipo: 'psicoterapia',
      acompanhamentoFamiliar: false,
      origem: 'fixa',
      horarioFixoId: 'hf1',
      dataOcorrencia: '2026-11-03',
      situacao: 'agendada',
      remarcadaPara: null,
      avaliacaoId: null,
      confirmada: false,
      observacao: null,
    });
  });

  it('inclui os dois limites do período', () => {
    const r = gerarOcorrencias({ horarios: [h], bloqueios: [], existentes: new Set(), de: '2026-11-03', ate: '2026-11-10' });
    expect(r.map((s) => s.dataOcorrencia)).toEqual(['2026-11-03', '2026-11-10']);
  });

  it('não repete ocorrências existentes', () => {
    const existentes = new Set([chaveOcorrencia(h.id, '2026-11-10')]);
    const r = gerarOcorrencias({ horarios: [h], bloqueios: [], existentes, ...periodo });
    expect(r.map((s) => s.dataOcorrencia)).toEqual(['2026-11-03', '2026-11-17', '2026-11-24']);
  });

  it('pula dias bloqueados (limites inclusivos)', () => {
    const bloqueios: Bloqueio[] = [{ id: 'b1', inicio: '2026-11-10', fim: '2026-11-17', motivo: 'Férias' }];
    const r = gerarOcorrencias({ horarios: [h], bloqueios, existentes: new Set(), ...periodo });
    expect(r.map((s) => s.dataOcorrencia)).toEqual(['2026-11-03', '2026-11-24']);
  });

  it('respeita validoDe e validoAte', () => {
    const ate = gerarOcorrencias({
      horarios: [{ ...h, validoAte: '2026-11-12' }],
      bloqueios: [],
      existentes: new Set(),
      ...periodo,
    });
    expect(ate.map((s) => s.dataOcorrencia)).toEqual(['2026-11-03', '2026-11-10']);

    const de = gerarOcorrencias({
      horarios: [{ ...h, validoDe: '2026-11-10' }],
      bloqueios: [],
      existentes: new Set(),
      ...periodo,
    });
    expect(de.map((s) => s.dataOcorrencia)).toEqual(['2026-11-10', '2026-11-17', '2026-11-24']);
  });

  it('ignora pacientes em lista de espera ou de alta', () => {
    for (const statusPaciente of ['alta', 'lista_espera'] as const) {
      const r = gerarOcorrencias({
        horarios: [{ ...h, statusPaciente }],
        bloqueios: [],
        existentes: new Set(),
        ...periodo,
      });
      expect(r).toEqual([]);
    }
  });

  it('liga sessões de avaliação à avaliação', () => {
    const r = gerarOcorrencias({
      horarios: [{ ...h, tipoPaciente: 'avaliacao', avaliacaoId: 'av1' }],
      bloqueios: [],
      existentes: new Set(),
      ...periodo,
    });
    expect(r).toHaveLength(4);
    expect(r.every((s) => s.tipo === 'avaliacao' && s.avaliacaoId === 'av1')).toBe(true);
  });

  it('não liga avaliação em sessões de psicoterapia', () => {
    const r = gerarOcorrencias({
      horarios: [{ ...h, tipoPaciente: 'psicoterapia', avaliacaoId: 'av1' }],
      bloqueios: [],
      existentes: new Set(),
      ...periodo,
    });
    expect(r.every((s) => s.avaliacaoId === null)).toBe(true);
  });

  it('ordena por início misturando vários horários', () => {
    const quartaCedo: HorarioComPaciente = { ...h, id: 'hf2', pacienteId: 'p2', diaSemana: 3, hora: '08:00' };
    const tercaCedo: HorarioComPaciente = { ...h, id: 'hf3', pacienteId: 'p3', hora: '09:30' };
    const r = gerarOcorrencias({
      horarios: [h, quartaCedo, tercaCedo],
      bloqueios: [],
      existentes: new Set(),
      de: '2026-11-02',
      ate: '2026-11-15',
    });
    const inicios = r.map((s) => s.inicio);
    expect(inicios).toEqual([...inicios].sort());
    expect(r.map((s) => `${s.dataOcorrencia} ${s.horarioFixoId}`)).toEqual([
      '2026-11-03 hf3',
      '2026-11-03 hf1',
      '2026-11-04 hf2',
      '2026-11-10 hf3',
      '2026-11-10 hf1',
      '2026-11-11 hf2',
    ]);
  });

  it('devolve vazio quando o período está invertido', () => {
    const r = gerarOcorrencias({ horarios: [h], bloqueios: [], existentes: new Set(), de: '2026-11-29', ate: '2026-11-02' });
    expect(r).toEqual([]);
  });
});

describe('estaBloqueado', () => {
  const bloqueios: Bloqueio[] = [{ id: 'b1', inicio: '2026-11-10', fim: '2026-11-17', motivo: 'Férias' }];
  it('é inclusivo nos limites', () => {
    expect(estaBloqueado('2026-11-09', bloqueios)).toBe(false);
    expect(estaBloqueado('2026-11-10', bloqueios)).toBe(true);
    expect(estaBloqueado('2026-11-13', bloqueios)).toBe(true);
    expect(estaBloqueado('2026-11-17', bloqueios)).toBe(true);
    expect(estaBloqueado('2026-11-18', bloqueios)).toBe(false);
  });
});

describe('ehCobravel', () => {
  it('cobrança por situação', () => {
    expect(['compareceu', 'falta_sem_aviso'].every((s) => ehCobravel(s as SituacaoSessao))).toBe(true);
    expect(['agendada', 'falta_com_aviso', 'cancelada', 'remarcada'].some((s) => ehCobravel(s as SituacaoSessao))).toBe(false);
  });
});

function sessao(parcial: Partial<Sessao> & Pick<Sessao, 'id'>): Sessao {
  return {
    pacienteId: 'p1',
    inicio: '2026-11-03T17:00:00.000Z',
    duracaoMin: 50,
    tipo: 'psicoterapia',
    acompanhamentoFamiliar: false,
    origem: 'fixa',
    horarioFixoId: 'hf1',
    dataOcorrencia: '2026-11-03',
    situacao: 'agendada',
    remarcadaPara: null,
    avaliacaoId: null,
    confirmada: false,
    observacao: null,
    ...parcial,
  };
}

describe('numeroNaAvaliacao', () => {
  it('conta só realizadas antes', () => {
    const base = { tipo: 'avaliacao' as const, avaliacaoId: 'av1' };
    const sessoes: Sessao[] = [
      sessao({ id: 's1', ...base, inicio: '2026-11-03T17:00:00.000Z', situacao: 'compareceu' }),
      sessao({ id: 's2', ...base, inicio: '2026-11-10T17:00:00.000Z', situacao: 'compareceu' }),
      sessao({ id: 's3', ...base, inicio: '2026-11-17T17:00:00.000Z', situacao: 'compareceu' }),
      sessao({ id: 's4', ...base, inicio: '2026-11-24T17:00:00.000Z', situacao: 'falta_sem_aviso' }),
      // não contam: cancelada antes, outra avaliação, e uma depois do alvo
      sessao({ id: 's5', ...base, inicio: '2026-11-05T17:00:00.000Z', situacao: 'cancelada' }),
      sessao({ id: 's6', tipo: 'avaliacao', avaliacaoId: 'av2', inicio: '2026-11-06T17:00:00.000Z', situacao: 'compareceu' }),
      sessao({ id: 's8', ...base, inicio: '2026-12-08T17:00:00.000Z', situacao: 'compareceu' }),
    ];
    const alvo = sessao({ id: 's7', ...base, inicio: '2026-12-01T17:00:00.000Z' });
    expect(numeroNaAvaliacao([...sessoes, alvo], alvo)).toBe(4);
  });

  it('compara instantes e não o texto (mesmo instante em formatos diferentes não é "antes")', () => {
    const base = { tipo: 'avaliacao' as const, avaliacaoId: 'av1' };
    const mesmoInstante = sessao({ id: 's1', ...base, inicio: '2026-11-03T17:00:00+00:00', situacao: 'compareceu' });
    const alvo = sessao({ id: 's2', ...base, inicio: '2026-11-03T17:00:00.000Z' });
    expect(numeroNaAvaliacao([mesmoInstante, alvo], alvo)).toBe(1);
  });

  it('a primeira sessão é a de número 1', () => {
    const alvo = sessao({ id: 's1', tipo: 'avaliacao', avaliacaoId: 'av1' });
    expect(numeroNaAvaliacao([alvo], alvo)).toBe(1);
  });
});

describe('selecionarAgendadas', () => {
  const sessoes: Sessao[] = [
    sessao({ id: 'a', pacienteId: 'p1', horarioFixoId: 'hf1', inicio: '2026-11-03T17:00:00.000Z' }),
    sessao({ id: 'b', pacienteId: 'p1', horarioFixoId: 'hf1', inicio: '2026-11-10T17:00:00.000Z' }),
    sessao({ id: 'c', pacienteId: 'p1', horarioFixoId: 'hf1', inicio: '2026-11-17T17:00:00.000Z' }),
    sessao({ id: 'd', pacienteId: 'p2', horarioFixoId: 'hf2', inicio: '2026-11-10T18:00:00.000Z' }),
    sessao({ id: 'e', pacienteId: 'p1', horarioFixoId: null, origem: 'avulsa', inicio: '2026-11-10T19:00:00.000Z' }),
    sessao({ id: 'f', pacienteId: 'p1', horarioFixoId: 'hf1', inicio: '2026-11-10T20:00:00.000Z', situacao: 'compareceu' }),
  ];

  it('devolve só as agendadas a partir de `de`', () => {
    expect(selecionarAgendadas(sessoes, { de: '2026-11-10' }).sort()).toEqual(['b', 'c', 'd', 'e']);
  });

  it('filtra por paciente', () => {
    expect(selecionarAgendadas(sessoes, { pacienteId: 'p2', de: '2026-11-01' })).toEqual(['d']);
  });

  it('filtra por horário fixo', () => {
    expect(selecionarAgendadas(sessoes, { horarioFixoId: 'hf1', de: '2026-11-01' }).sort()).toEqual(['a', 'b', 'c']);
  });

  it('respeita `ate` inclusivo', () => {
    expect(selecionarAgendadas(sessoes, { pacienteId: 'p1', de: '2026-11-01', ate: '2026-11-10' }).sort()).toEqual(['a', 'b', 'e']);
  });

  it('somenteFixas exclui avulsas e remarcações', () => {
    expect(selecionarAgendadas(sessoes, { pacienteId: 'p1', de: '2026-11-10', somenteFixas: true }).sort()).toEqual(['b', 'c']);
  });

  it('usa o dia local, não o dia UTC', () => {
    const tarde = [sessao({ id: 'x', inicio: '2026-11-04T02:30:00.000Z' })]; // 23:30 do dia 03 em São Paulo
    expect(selecionarAgendadas(tarde, { de: '2026-11-03', ate: '2026-11-03' })).toEqual(['x']);
    expect(selecionarAgendadas(tarde, { de: '2026-11-04' })).toEqual([]);
  });
});

describe('sessaoAtualNaAvaliacao', () => {
  const avaliacao: Avaliacao = { id: 'av1', pacienteId: 'p1', inicio: '2026-10-14', fim: null, sessoesPrevistas: 10, etapas: [] };
  const base = { tipo: 'avaliacao' as const, avaliacaoId: 'av1' };

  it('sem nenhuma sessão realizada, é a sessão 1', () => {
    expect(sessaoAtualNaAvaliacao([], avaliacao)).toBe(1);
  });

  it('é o número de comparecimentos da avaliação mais 1', () => {
    const sessoes = [
      sessao({ id: 's1', ...base, situacao: 'compareceu' }),
      sessao({ id: 's2', ...base, situacao: 'compareceu' }),
      sessao({ id: 's3', ...base, situacao: 'compareceu' }),
    ];
    expect(sessaoAtualNaAvaliacao(sessoes, avaliacao)).toBe(4);
  });

  it('só conta comparecimentos desta avaliação', () => {
    const sessoes = [
      sessao({ id: 's1', ...base, situacao: 'compareceu' }),
      sessao({ id: 's2', ...base, situacao: 'falta_sem_aviso' }),
      sessao({ id: 's3', ...base, situacao: 'falta_com_aviso' }),
      sessao({ id: 's4', ...base, situacao: 'cancelada' }),
      sessao({ id: 's5', ...base, situacao: 'remarcada' }),
      sessao({ id: 's6', ...base, situacao: 'agendada' }),
      sessao({ id: 's7', tipo: 'avaliacao', avaliacaoId: 'outra', situacao: 'compareceu' }),
      sessao({ id: 's8', tipo: 'psicoterapia', avaliacaoId: null, situacao: 'compareceu' }),
    ];
    expect(sessaoAtualNaAvaliacao(sessoes, avaliacao)).toBe(2);
  });

  it('não passa do total previsto', () => {
    const sessoes = Array.from({ length: 12 }, (_, i) => sessao({ id: `s${i}`, ...base, situacao: 'compareceu' }));
    expect(sessaoAtualNaAvaliacao(sessoes, avaliacao)).toBe(10);
    expect(sessaoAtualNaAvaliacao(sessoes.slice(0, 9), avaliacao)).toBe(10);
    expect(sessaoAtualNaAvaliacao(sessoes.slice(0, 3), { ...avaliacao, sessoesPrevistas: 3 })).toBe(3);
  });
});

describe('separarSessoesDoPaciente', () => {
  const sessoes: Sessao[] = [
    sessao({ id: 'passada', inicio: '2026-10-27T17:00:00.000Z', situacao: 'compareceu' }),
    sessao({ id: 'esquecida', inicio: '2026-10-30T17:00:00.000Z', situacao: 'agendada' }),
    sessao({ id: 'hoje-tarde', inicio: '2026-11-03T02:00:00.000Z', situacao: 'agendada' }),
    sessao({ id: 'proxima-2', inicio: '2026-11-10T17:00:00.000Z', situacao: 'agendada' }),
    sessao({ id: 'proxima-1', inicio: '2026-11-03T17:00:00.000Z', situacao: 'agendada' }),
    sessao({ id: 'cancelada-futura', inicio: '2026-11-17T17:00:00.000Z', situacao: 'cancelada' }),
    sessao({ id: 'remarcada-futura', inicio: '2026-11-24T17:00:00.000Z', situacao: 'remarcada' }),
  ];

  it('próximas: agendadas de hoje em diante (dia local), da mais próxima para a mais distante', () => {
    // 2026-11-03T02:00Z ainda é 02/11 (23:00) em São Paulo.
    const { proximas } = separarSessoesDoPaciente(sessoes, '2026-11-02');
    expect(proximas.map((s) => s.id)).toEqual(['hoje-tarde', 'proxima-1', 'proxima-2']);
  });

  it('histórico: o resto, da mais recente para a mais antiga', () => {
    const { historico } = separarSessoesDoPaciente(sessoes, '2026-11-02');
    expect(historico.map((s) => s.id)).toEqual(['remarcada-futura', 'cancelada-futura', 'esquecida', 'passada']);
  });

  it('o dia de hoje conta como próxima, o dia anterior não', () => {
    const { proximas } = separarSessoesDoPaciente(sessoes, '2026-11-03');
    expect(proximas.map((s) => s.id)).toEqual(['proxima-1', 'proxima-2']);
  });
});
