import { describe, expect, it } from 'vitest';
import { criarRepositorioMemoria, type SementeMemoria } from '../dados/memoria';
import type { Repositorio } from '../dados/repositorio';
import type { NovaSessao } from '../dominio/tipos';
import { avaliacaoExemplo, horarioExemplo, pacienteExemplo, sessaoExemplo } from '../testes/fabricas';
import {
  bloquearPeriodo,
  criarAvulsa,
  garantirAgenda,
  marcarSituacao,
  remarcar,
} from './agenda';

// Base: a Ana (ativa, psicoterapia) com horário fixo na terça 14:00; novembro de 2026
// tem terças nos dias 3, 10, 17 e 24 (14:00 em São Paulo = 17:00 UTC).
const novoRepo = (semente: SementeMemoria = {}) =>
  criarRepositorioMemoria({
    pacientes: [pacienteExemplo()],
    horarios: [horarioExemplo()],
    ...semente,
  });

/**
 * O mesmo repositório, mas anotando o que `garantirAgenda` manda inserir. O banco ignoraria
 * ocorrências repetidas de qualquer jeito; isto prova que o serviço nem tenta mandá-las.
 */
function espiarInsercoes(repo: Repositorio) {
  const enviadas: NovaSessao[] = [];
  const espiado: Repositorio = {
    ...repo,
    inserirOcorrencias: (novas) => {
      enviadas.push(...novas);
      return repo.inserirOcorrencias(novas);
    },
  };
  return { espiado, enviadas };
}

describe('garantirAgenda', () => {
  it('é idempotente', async () => {
    const repo = novoRepo();
    expect(await garantirAgenda(repo, '2026-11-02', 4)).toBe(4);
    expect(await garantirAgenda(repo, '2026-11-02', 4)).toBe(0);
    const sessoes = await repo.listarSessoes('2026-11-02', '2026-11-29');
    expect(sessoes).toHaveLength(4);
    expect(sessoes.map((s) => s.dataOcorrencia)).toEqual(['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24']);
  });

  it('gera as sessões completas, a partir do horário e do paciente', async () => {
    const repo = novoRepo();
    await garantirAgenda(repo, '2026-11-02', 1);
    const [s] = await repo.listarSessoes('2026-11-02', '2026-11-08');
    expect(s).toMatchObject({
      pacienteId: 'p1',
      inicio: '2026-11-03T17:00:00.000Z',
      duracaoMin: 50,
      tipo: 'psicoterapia',
      origem: 'fixa',
      horarioFixoId: 'hf1',
      dataOcorrencia: '2026-11-03',
      situacao: 'agendada',
      avaliacaoId: null,
    });
  });

  it('a janela vai de hoje até hoje + semanas × 7 − 1, com os dois limites incluídos', async () => {
    const repo = novoRepo();
    // 2026-11-04 (quarta) .. 2026-11-10 (terça): pega só a terça do último dia.
    expect(await garantirAgenda(repo, '2026-11-04', 1)).toBe(1);
    const sessoes = await repo.listarSessoes('2026-10-01', '2026-12-31');
    expect(sessoes.map((s) => s.dataOcorrencia)).toEqual(['2026-11-10']);
    // Uma semana a mais acrescenta só a terça seguinte.
    expect(await garantirAgenda(repo, '2026-11-04', 2)).toBe(1);
  });

  it('pula os dias bloqueados', async () => {
    const repo = novoRepo({
      bloqueios: [{ id: 'b1', inicio: '2026-11-10', fim: '2026-11-17', motivo: 'Férias' }],
    });
    expect(await garantirAgenda(repo, '2026-11-02', 4)).toBe(2);
    const sessoes = await repo.listarSessoes('2026-11-02', '2026-11-29');
    expect(sessoes.map((s) => s.dataOcorrencia)).toEqual(['2026-11-03', '2026-11-24']);
  });

  it('não gera sessões de quem não está ativo', async () => {
    const repo = novoRepo({ pacientes: [pacienteExemplo({ status: 'lista_espera' })] });
    expect(await garantirAgenda(repo, '2026-11-02', 4)).toBe(0);
  });

  it('não recria ocorrência cancelada, mesmo depois de ela ter sido marcada', async () => {
    const repo = novoRepo();
    await garantirAgenda(repo, '2026-11-02', 4);
    const [primeira] = await repo.listarSessoes('2026-11-02', '2026-11-29');
    await repo.atualizarSessao(primeira.id, { situacao: 'cancelada' });
    const { espiado, enviadas } = espiarInsercoes(repo);
    expect(await garantirAgenda(espiado, '2026-11-02', 4)).toBe(0);
    expect(enviadas).toEqual([]);
    expect(await repo.listarSessoes('2026-11-02', '2026-11-29')).toHaveLength(4);
  });
});

describe('marcarSituacao', () => {
  it('devolve a sessão com a situação nova e grava no repositório', async () => {
    const repo = novoRepo();
    await garantirAgenda(repo, '2026-11-02', 1);
    const [s] = await repo.listarSessoes('2026-11-02', '2026-11-08');
    const marcada = await marcarSituacao(repo, s, 'falta_com_aviso');
    expect(marcada).toMatchObject({ id: s.id, situacao: 'falta_com_aviso' });
    const [salva] = await repo.listarSessoes('2026-11-02', '2026-11-08');
    expect(salva.situacao).toBe('falta_com_aviso');
  });

  it('compareceu preenche a data de entrada só na primeira vez', async () => {
    const repo = novoRepo({ pacientes: [pacienteExemplo({ dataEntrada: null })] });
    await garantirAgenda(repo, '2026-11-02', 2);
    const [primeira, segunda] = await repo.listarSessoes('2026-11-02', '2026-11-15');

    await marcarSituacao(repo, primeira, 'compareceu');
    expect((await repo.obterFicha('p1'))?.paciente.dataEntrada).toBe('2026-11-03');

    await marcarSituacao(repo, segunda, 'compareceu');
    expect((await repo.obterFicha('p1'))?.paciente.dataEntrada).toBe('2026-11-03');
  });

  it('não mexe numa data de entrada que já existe', async () => {
    const repo = novoRepo({ pacientes: [pacienteExemplo({ dataEntrada: '2026-10-05' })] });
    await garantirAgenda(repo, '2026-11-02', 1);
    const [s] = await repo.listarSessoes('2026-11-02', '2026-11-08');
    await marcarSituacao(repo, s, 'compareceu');
    expect((await repo.obterFicha('p1'))?.paciente.dataEntrada).toBe('2026-10-05');
  });

  it('só o comparecimento preenche a data de entrada', async () => {
    const repo = novoRepo({ pacientes: [pacienteExemplo({ dataEntrada: null })] });
    await garantirAgenda(repo, '2026-11-02', 1);
    const [s] = await repo.listarSessoes('2026-11-02', '2026-11-08');
    await marcarSituacao(repo, s, 'falta_sem_aviso');
    expect((await repo.obterFicha('p1'))?.paciente.dataEntrada).toBeNull();
  });

  it('a data de entrada é o dia em São Paulo, não o do aparelho', async () => {
    // 23:30 de terça em São Paulo = 02:30 UTC de quarta (já quarta, 11:30, em Tóquio).
    const noite = sessaoExemplo({ inicio: '2026-11-04T02:30:00.000Z' });
    const repo = novoRepo({ pacientes: [pacienteExemplo({ dataEntrada: null })], sessoes: [noite] });
    await marcarSituacao(repo, noite, 'compareceu');
    expect((await repo.obterFicha('p1'))?.paciente.dataEntrada).toBe('2026-11-03');
  });
});

describe('remarcar', () => {
  it('cria nova sessão e marca a original', async () => {
    const repo = novoRepo();
    await garantirAgenda(repo, '2026-11-02', 4);
    const [original] = await repo.listarSessoes('2026-11-02', '2026-11-08');

    const nova = await remarcar(repo, original, '2026-11-05T13:00:00.000Z');

    expect(nova).toMatchObject({
      pacienteId: 'p1',
      inicio: '2026-11-05T13:00:00.000Z',
      duracaoMin: 50,
      tipo: 'psicoterapia',
      origem: 'remarcacao',
      horarioFixoId: null,
      dataOcorrencia: null,
      situacao: 'agendada',
      remarcadaPara: null,
      avaliacaoId: null,
      acompanhamentoFamiliar: false,
      confirmada: false,
    });
    expect(nova.id).not.toBe(original.id);

    const sessoes = await repo.listarSessoes('2026-11-02', '2026-11-29');
    const marcada = sessoes.find((s) => s.id === original.id);
    // A original continua presa à sua ocorrência do horário fixo — é isso que impede a agenda de recriá-la.
    expect(marcada).toMatchObject({
      situacao: 'remarcada',
      remarcadaPara: nova.id,
      horarioFixoId: 'hf1',
      dataOcorrencia: '2026-11-03',
    });
    expect(sessoes.find((s) => s.id === nova.id)).toMatchObject({ origem: 'remarcacao', situacao: 'agendada' });
  });

  it('garantirAgenda de novo não recria a ocorrência original', async () => {
    const repo = novoRepo();
    await garantirAgenda(repo, '2026-11-02', 4);
    const [original] = await repo.listarSessoes('2026-11-02', '2026-11-08');
    await remarcar(repo, original, '2026-11-05T13:00:00.000Z');

    const { espiado, enviadas } = espiarInsercoes(repo);
    expect(await garantirAgenda(espiado, '2026-11-02', 4)).toBe(0);
    expect(enviadas).toEqual([]);
    // 4 terças (uma delas remarcada) + a sessão nova de quinta.
    expect(await repo.listarSessoes('2026-11-02', '2026-11-29')).toHaveLength(5);
  });

  it('a nova sessão herda o tipo, a avaliação e o acompanhamento familiar', async () => {
    const original = sessaoExemplo({
      tipo: 'avaliacao',
      avaliacaoId: 'av1',
      acompanhamentoFamiliar: true,
      duracaoMin: 40,
      confirmada: true,
      observacao: 'Trazer o desenho',
    });
    const repo = novoRepo({
      pacientes: [pacienteExemplo({ tipo: 'avaliacao' })],
      avaliacoes: [avaliacaoExemplo()],
      sessoes: [original],
    });

    const nova = await remarcar(repo, original, '2026-11-06T13:00:00.000Z');

    expect(nova).toMatchObject({
      tipo: 'avaliacao',
      avaliacaoId: 'av1',
      acompanhamentoFamiliar: true,
      duracaoMin: 40,
      // Confirmação e observação eram do horário antigo: a nova começa limpa.
      confirmada: false,
      observacao: null,
    });
  });
});

describe('criarAvulsa', () => {
  it('em psicoterapia, o tipo vem da ficha e não há avaliação', async () => {
    const repo = novoRepo({ avaliacoes: [avaliacaoExemplo({ fim: '2026-10-30' })] });
    const s = await criarAvulsa(repo, {
      pacienteId: 'p1',
      inicio: '2026-11-06T13:00:00.000Z',
      duracaoMin: 50,
      acompanhamentoFamiliar: false,
    });
    expect(s).toMatchObject({
      pacienteId: 'p1',
      inicio: '2026-11-06T13:00:00.000Z',
      duracaoMin: 50,
      tipo: 'psicoterapia',
      acompanhamentoFamiliar: false,
      origem: 'avulsa',
      horarioFixoId: null,
      dataOcorrencia: null,
      situacao: 'agendada',
      remarcadaPara: null,
      avaliacaoId: null,
      confirmada: false,
      observacao: null,
    });
    expect(await repo.listarSessoesDoPaciente('p1')).toHaveLength(1);
  });

  it('em avaliação, o tipo e a avaliação vêm da ficha', async () => {
    const repo = novoRepo({
      pacientes: [pacienteExemplo({ tipo: 'avaliacao' })],
      avaliacoes: [avaliacaoExemplo()],
    });
    const s = await criarAvulsa(repo, {
      pacienteId: 'p1',
      inicio: '2026-11-06T13:00:00.000Z',
      duracaoMin: 60,
      acompanhamentoFamiliar: true,
    });
    expect(s).toMatchObject({
      tipo: 'avaliacao',
      avaliacaoId: 'av1',
      duracaoMin: 60,
      acompanhamentoFamiliar: true,
      origem: 'avulsa',
    });
  });

  it('rejeita paciente que não existe', async () => {
    const repo = novoRepo();
    await expect(
      criarAvulsa(repo, {
        pacienteId: 'inexistente',
        inicio: '2026-11-06T13:00:00.000Z',
        duracaoMin: 50,
        acompanhamentoFamiliar: false,
      }),
    ).rejects.toThrow('Paciente não encontrado');
  });
});

describe('bloquearPeriodo', () => {
  it('cancela só as agendadas (Review Focus 5)', async () => {
    const repo = novoRepo();
    await garantirAgenda(repo, '2026-11-02', 4);
    const [dia3] = await repo.listarSessoes('2026-11-03', '2026-11-03');
    await marcarSituacao(repo, dia3, 'compareceu');

    const { bloqueio, canceladas } = await bloquearPeriodo(repo, {
      inicio: '2026-11-01',
      fim: '2026-11-15',
      motivo: 'Férias',
    });

    expect(canceladas).toBe(1);
    expect(bloqueio).toMatchObject({ inicio: '2026-11-01', fim: '2026-11-15', motivo: 'Férias' });
    expect(bloqueio.id).toBeTruthy();
    expect(await repo.listarBloqueios()).toEqual([bloqueio]);

    const sessoes = await repo.listarSessoes('2026-11-01', '2026-11-30');
    const por = (dia: string) => sessoes.find((s) => s.dataOcorrencia === dia);
    expect(por('2026-11-03')).toMatchObject({ situacao: 'compareceu', observacao: null });
    expect(por('2026-11-10')).toMatchObject({ situacao: 'cancelada', observacao: 'Férias' });
    expect(por('2026-11-17')).toMatchObject({ situacao: 'agendada', observacao: null });
    expect(por('2026-11-24')).toMatchObject({ situacao: 'agendada' });
  });

  it('não mexe em faltas, remarcadas nem canceladas que já existiam', async () => {
    const repo = novoRepo();
    await garantirAgenda(repo, '2026-11-02', 4);
    const [d3, d10, d17] = await repo.listarSessoes('2026-11-02', '2026-11-29');
    await marcarSituacao(repo, d3, 'falta_sem_aviso');
    await marcarSituacao(repo, d10, 'falta_com_aviso');
    await remarcar(repo, d17, '2026-11-26T13:00:00.000Z');

    const { canceladas } = await bloquearPeriodo(repo, { inicio: '2026-11-01', fim: '2026-11-20', motivo: 'Congresso' });

    expect(canceladas).toBe(0);
    const sessoes = await repo.listarSessoes('2026-11-01', '2026-11-20');
    expect(sessoes.map((s) => s.situacao)).toEqual(['falta_sem_aviso', 'falta_com_aviso', 'remarcada']);
    expect(sessoes.every((s) => s.observacao === null)).toBe(true);
  });

  it('cancela também as avulsas e as remarcações agendadas do período', async () => {
    const repo = novoRepo({
      horarios: [],
      sessoes: [
        sessaoExemplo({ id: 'avulsa', inicio: '2026-11-11T13:00:00.000Z', origem: 'avulsa' }),
        sessaoExemplo({ id: 'remarcacao', inicio: '2026-11-12T13:00:00.000Z', origem: 'remarcacao' }),
        sessaoExemplo({ id: 'fora', inicio: '2026-11-13T13:00:00.000Z', origem: 'avulsa' }),
      ],
    });

    const { canceladas } = await bloquearPeriodo(repo, { inicio: '2026-11-10', fim: '2026-11-12', motivo: 'Viagem' });

    expect(canceladas).toBe(2);
    const sessoes = await repo.listarSessoesDoPaciente('p1');
    expect(sessoes.map((s) => [s.id, s.situacao])).toEqual([
      ['avulsa', 'cancelada'],
      ['remarcacao', 'cancelada'],
      ['fora', 'agendada'],
    ]);
  });

  it('o período vale em dias de São Paulo, nas duas pontas', async () => {
    const repo = novoRepo({
      horarios: [],
      sessoes: [
        // 09/11 23:30 em São Paulo (já 10/11 em Tóquio): antes do bloqueio.
        sessaoExemplo({ id: 'antes', inicio: '2026-11-10T02:30:00.000Z' }),
        // 12/11 23:30 em São Paulo (já 13/11 em Tóquio): último dia do bloqueio.
        sessaoExemplo({ id: 'ultimo-dia', inicio: '2026-11-13T02:30:00.000Z' }),
        // 13/11 00:30 em São Paulo: depois do bloqueio.
        sessaoExemplo({ id: 'depois', inicio: '2026-11-13T03:30:00.000Z' }),
      ],
    });

    const { canceladas } = await bloquearPeriodo(repo, { inicio: '2026-11-10', fim: '2026-11-12', motivo: 'Viagem' });

    expect(canceladas).toBe(1);
    const sessoes = await repo.listarSessoesDoPaciente('p1');
    expect(sessoes.map((s) => [s.id, s.situacao])).toEqual([
      ['antes', 'agendada'],
      ['ultimo-dia', 'cancelada'],
      ['depois', 'agendada'],
    ]);
  });

  it('a agenda gerada depois respeita o bloqueio', async () => {
    const repo = novoRepo();
    await bloquearPeriodo(repo, { inicio: '2026-11-09', fim: '2026-11-15', motivo: 'Férias' });
    expect(await garantirAgenda(repo, '2026-11-02', 4)).toBe(3);
    expect(await repo.listarSessoes('2026-11-09', '2026-11-15')).toEqual([]);
  });
});
