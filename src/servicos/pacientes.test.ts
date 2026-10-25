import { describe, expect, it } from 'vitest';
import { criarRepositorioMemoria, type SementeMemoria } from '../dados/memoria';
import { CONFIGURACOES_PADRAO, ETAPAS_AVALIACAO_PADRAO } from '../dominio/padroes';
import type { DataISO, Sessao } from '../dominio/tipos';
import { dataLocal, horaLocal, instanteDe } from '../regras/datas';
import {
  avaliacaoExemplo,
  dadosPacienteExemplo,
  horarioExemplo,
  pacienteExemplo,
  sessaoExemplo,
} from '../testes/fabricas';
import { criarAvulsa, garantirAgenda, marcarSituacao, remarcar } from './agenda';
import { criarPaciente, darAlta, mudarHorarioFixo, mudarTipo } from './pacientes';

// Base: a Ana (ativa, psicoterapia) com horário fixo na terça 14:00; novembro de 2026
// tem terças nos dias 3, 10, 17 e 24 (14:00 em São Paulo = 17:00 UTC).
const novoRepo = (semente: SementeMemoria = {}) =>
  criarRepositorioMemoria({
    pacientes: [pacienteExemplo()],
    horarios: [horarioExemplo()],
    ...semente,
  });

/** Sessão do horário fixo `hf1` na data dada, às 14:00 (já gravada, não gerada). */
const fixa = (dia: DataISO, sobre: Partial<Sessao> = {}) =>
  sessaoExemplo({
    id: `s-${dia}`,
    inicio: instanteDe(dia, '14:00'),
    origem: 'fixa',
    horarioFixoId: 'hf1',
    dataOcorrencia: dia,
    ...sobre,
  });

describe('criarPaciente', () => {
  it('em avaliação cria avaliação com 10 sessões e 5 etapas', async () => {
    const repo = criarRepositorioMemoria();
    const dados = dadosPacienteExemplo({ tipo: 'avaliacao', dataEntrada: null });

    const paciente = await criarPaciente(repo, dados, CONFIGURACOES_PADRAO, '2026-11-02');

    expect(paciente).toEqual({ id: expect.any(String), ...dados });
    expect(await repo.listarPacientes()).toEqual([paciente]);
    const avaliacao = (await repo.obterFicha(paciente.id))?.avaliacao;
    expect(avaliacao).toEqual({
      id: expect.any(String),
      pacienteId: paciente.id,
      inicio: '2026-11-02',
      fim: null,
      sessoesPrevistas: 10,
      etapas: ETAPAS_AVALIACAO_PADRAO.map((nome) => ({ nome, feita: false })),
    });
    expect(avaliacao?.etapas).toHaveLength(5);
  });

  it('a avaliação começa na data de entrada, quando ela é informada', async () => {
    const repo = criarRepositorioMemoria();
    const dados = dadosPacienteExemplo({ tipo: 'avaliacao', dataEntrada: '2026-10-20' });
    const paciente = await criarPaciente(repo, dados, CONFIGURACOES_PADRAO, '2026-11-02');
    expect((await repo.obterFicha(paciente.id))?.avaliacao?.inicio).toBe('2026-10-20');
  });

  it('o número de sessões da avaliação vem das configurações', async () => {
    const repo = criarRepositorioMemoria();
    const config = { ...CONFIGURACOES_PADRAO, sessoesAvaliacaoPadrao: 8 };
    const paciente = await criarPaciente(repo, dadosPacienteExemplo({ tipo: 'avaliacao' }), config, '2026-11-02');
    expect((await repo.obterFicha(paciente.id))?.avaliacao?.sessoesPrevistas).toBe(8);
  });

  it('com um id informado, repetir depois de uma falha na avaliação completa o cadastro sem duplicar o paciente', async () => {
    const base = criarRepositorioMemoria();
    const salvarAvaliacao = vi.fn().mockRejectedValueOnce(new Error('sem rede')).mockImplementation(base.salvarAvaliacao);
    const repo = { ...base, salvarAvaliacao };
    const dados = { id: 'p-fixo', ...dadosPacienteExemplo({ tipo: 'avaliacao' }) };

    await expect(criarPaciente(repo, dados, CONFIGURACOES_PADRAO, '2026-11-02')).rejects.toThrow('sem rede');
    // O paciente já foi gravado; a avaliação não.
    expect((await base.listarPacientes()).map((p) => p.id)).toEqual(['p-fixo']);
    expect((await base.obterFicha('p-fixo'))?.avaliacao).toBeNull();

    const paciente = await criarPaciente(repo, dados, CONFIGURACOES_PADRAO, '2026-11-02');

    expect(paciente.id).toBe('p-fixo');
    expect(await base.listarPacientes()).toHaveLength(1);
    expect((await base.obterFicha('p-fixo'))?.avaliacao?.etapas).toHaveLength(5);
  });

  it('em psicoterapia não cria avaliação', async () => {
    const repo = criarRepositorioMemoria();
    const dados = dadosPacienteExemplo({ tipo: 'psicoterapia' });
    const paciente = await criarPaciente(repo, dados, CONFIGURACOES_PADRAO, '2026-11-02');
    expect(paciente).toEqual({ id: expect.any(String), ...dados });
    expect((await repo.obterFicha(paciente.id))?.avaliacao).toBeNull();
  });
});

describe('mudarHorarioFixo', () => {
  const quinta = { diaSemana: 4, hora: '14:00', duracaoMin: 50 };
  /** Segunda, 02/11, meio-dia em São Paulo. */
  const AGORA = new Date('2026-11-02T12:00:00-03:00');

  it('move as futuras e preserva o passado', async () => {
    const repo = novoRepo();
    await garantirAgenda(repo, '2026-11-02', 4);

    const novo = await mudarHorarioFixo(repo, horarioExemplo(), quinta, '2026-11-10', 4, AGORA);

    expect(novo).toMatchObject({
      pacienteId: 'p1',
      diaSemana: 4,
      hora: '14:00',
      duracaoMin: 50,
      validoDe: '2026-11-10',
      validoAte: null,
    });
    expect(novo.id).not.toBe('hf1');

    const horarios = (await repo.obterFicha('p1'))?.horarios;
    expect(horarios).toEqual([
      { ...horarioExemplo(), validoAte: '2026-11-09' },
      novo,
    ]);

    const sessoes = await repo.listarSessoes('2026-11-02', '2026-12-31');
    // 11-03 (terça, horário antigo) fica; 11-10, 11-17 e 11-24 saem; entram as quintas.
    expect(sessoes.map((s) => [s.dataOcorrencia, s.horarioFixoId])).toEqual([
      ['2026-11-03', 'hf1'],
      ['2026-11-12', novo.id],
      ['2026-11-19', novo.id],
      ['2026-11-26', novo.id],
      ['2026-12-03', novo.id],
    ]);
  });

  it('as sessões novas usam o dia, a hora e a duração novos', async () => {
    const repo = novoRepo();
    await garantirAgenda(repo, '2026-11-02', 4);

    await mudarHorarioFixo(repo, horarioExemplo(), { diaSemana: 4, hora: '15:30', duracaoMin: 40 }, '2026-11-10', 1, AGORA);

    const sessoes = await repo.listarSessoes('2026-11-10', '2026-11-30');
    expect(sessoes).toHaveLength(1);
    expect(sessoes[0]).toMatchObject({
      inicio: '2026-11-12T18:30:00.000Z',
      duracaoMin: 40,
      dataOcorrencia: '2026-11-12',
      origem: 'fixa',
      situacao: 'agendada',
    });
  });

  it('só remove as agendadas fixas do horário antigo', async () => {
    const repo = novoRepo({
      pacientes: [pacienteExemplo(), pacienteExemplo({ id: 'p2', nome: 'Pedro Lima' })],
      horarios: [horarioExemplo(), horarioExemplo({ id: 'hf2', pacienteId: 'p2', hora: '15:00' })],
    });
    await garantirAgenda(repo, '2026-11-02', 4);
    const antes = await repo.listarSessoes('2026-11-02', '2026-11-29');
    const dia17 = antes.find((s) => s.pacienteId === 'p1' && s.dataOcorrencia === '2026-11-17');
    if (!dia17) throw new Error('sessão de 17/11 não foi gerada');
    await marcarSituacao(repo, dia17, 'falta_com_aviso');
    const avulsa = await criarAvulsa(repo, {
      pacienteId: 'p1',
      inicio: '2026-11-18T13:00:00.000Z',
      duracaoMin: 50,
      acompanhamentoFamiliar: true,
    });

    await mudarHorarioFixo(repo, horarioExemplo(), quinta, '2026-11-10', 4, AGORA);

    const ana = await repo.listarSessoesDoPaciente('p1');
    const antigas = ana
      .filter((s) => s.situacao !== 'agendada' || s.horarioFixoId === 'hf1')
      .map((s) => [dataLocal(s.inicio), s.situacao]);
    // Do horário antigo só saem as agendadas de 10/11 em diante; a falta de 17/11 é histórico e continua.
    expect(antigas).toEqual([
      ['2026-11-03', 'agendada'],
      ['2026-11-17', 'falta_com_aviso'],
    ]);
    expect(ana.find((s) => s.id === avulsa.id)).toMatchObject({ situacao: 'agendada', origem: 'avulsa' });
    // O horário de outro paciente não perde nada (só ganha a terça de 01/12, que a janela nova alcança).
    const pedro = await repo.listarSessoesDoPaciente('p2');
    expect(pedro.map((s) => s.dataOcorrencia)).toEqual([
      '2026-11-03',
      '2026-11-10',
      '2026-11-17',
      '2026-11-24',
      '2026-12-01',
    ]);
  });
});

describe('mudarHorarioFixo: o que já aconteceu não muda', () => {
  const quinta = { diaSemana: 4, hora: '14:00', duracaoMin: 50 };
  const dias = async (repo: ReturnType<typeof novoRepo>) =>
    (await repo.listarSessoesDoPaciente('p1')).map((s) => dataLocal(s.inicio));

  it('de hoje, depois da hora da sessão: a de hoje já aconteceu e fica, com a observação e a confirmação', async () => {
    const repo = novoRepo();
    await garantirAgenda(repo, '2026-11-02', 4);
    const [deHoje] = await repo.listarSessoes('2026-11-03', '2026-11-03');
    await repo.atualizarSessao(deHoje.id, { observacao: 'Desenhou a família.', confirmada: true });
    const terca16h = new Date('2026-11-03T16:00:00-03:00');

    await mudarHorarioFixo(repo, horarioExemplo(), quinta, '2026-11-03', 4, terca16h);

    const sessoes = await repo.listarSessoesDoPaciente('p1');
    expect(sessoes.find((s) => s.id === deHoje.id)).toMatchObject({
      inicio: deHoje.inicio,
      situacao: 'agendada',
      observacao: 'Desenhou a família.',
      confirmada: true,
    });
    // As terças seguintes dão lugar às quintas; a quinta desta semana não entra: a sessão da semana já foi na terça.
    expect(await dias(repo)).toEqual(['2026-11-03', '2026-11-12', '2026-11-19', '2026-11-26']);

    // Nem depois, quando a agenda é completada no dia seguinte.
    await garantirAgenda(repo, '2026-11-04', 4);
    expect(await dias(repo)).toEqual(['2026-11-03', '2026-11-12', '2026-11-19', '2026-11-26']);
  });

  it('de hoje, antes da hora da sessão: a de hoje também passa para o horário novo', async () => {
    const repo = novoRepo();
    await garantirAgenda(repo, '2026-11-02', 4);
    const terca12h = new Date('2026-11-03T12:00:00-03:00');

    await mudarHorarioFixo(repo, horarioExemplo(), quinta, '2026-11-03', 4, terca12h);

    expect(await dias(repo)).toEqual(['2026-11-05', '2026-11-12', '2026-11-19', '2026-11-26']);
  });

  it('com a data no passado, não apaga o que já passou nem gera sessões no passado', async () => {
    const repo = novoRepo();
    await garantirAgenda(repo, '2026-10-05', 5); // terças de 06/10 a 03/11, nenhuma marcada
    const terca12h = new Date('2026-11-03T12:00:00-03:00');

    await mudarHorarioFixo(repo, horarioExemplo(), quinta, '2026-10-06', 4, terca12h);

    expect(await dias(repo)).toEqual([
      '2026-10-06',
      '2026-10-13',
      '2026-10-20',
      '2026-10-27',
      // A de 03/11 (14:00) ainda não tinha acontecido: deu lugar às quintas, geradas só de hoje em diante.
      '2026-11-05',
      '2026-11-12',
      '2026-11-19',
      '2026-11-26',
    ]);
  });

  it('recusa começar antes de o horário valer, sem gravar nada', async () => {
    const repo = novoRepo();
    await garantirAgenda(repo, '2026-11-02', 4);
    const antes = await repo.listarSessoesDoPaciente('p1');

    await expect(
      mudarHorarioFixo(repo, horarioExemplo(), quinta, '2025-11-03', 4, new Date('2026-11-03T12:00:00-03:00')),
    ).rejects.toThrow();

    expect((await repo.obterFicha('p1'))?.horarios).toEqual([horarioExemplo()]);
    expect(await repo.listarSessoesDoPaciente('p1')).toEqual(antes);
  });

  it('o horário antigo nunca termina antes de começar: o que começou no próprio dia é trocado no lugar', async () => {
    const deHoje = horarioExemplo({ validoDe: '2026-11-03' });
    const repo = novoRepo({ horarios: [deHoje] });
    await garantirAgenda(repo, '2026-11-03', 4);

    const novo = await mudarHorarioFixo(repo, deHoje, quinta, '2026-11-03', 4, new Date('2026-11-03T12:00:00-03:00'));

    const horarios = (await repo.obterFicha('p1'))?.horarios ?? [];
    expect(horarios.every((h) => h.validoAte === null || h.validoAte >= h.validoDe)).toBe(true);
    expect(horarios).toEqual([{ ...deHoje, diaSemana: 4 }]);
    expect(novo).toEqual({ ...deHoje, diaSemana: 4 });
    expect(await dias(repo)).toEqual(['2026-11-05', '2026-11-12', '2026-11-19', '2026-11-26']);
  });

  it('não reabre um horário que já tinha data para terminar', async () => {
    const comFim = horarioExemplo({ validoAte: '2026-11-20' });
    const repo = novoRepo({ horarios: [comFim] });

    const novo = await mudarHorarioFixo(repo, comFim, quinta, '2026-12-01', 4, new Date('2026-11-03T12:00:00-03:00'));

    expect((await repo.obterFicha('p1'))?.horarios).toEqual([comFim, novo]);
    expect(novo).toMatchObject({ validoDe: '2026-12-01', validoAte: null });
  });
});

describe('mudarHorarioFixo: ocorrência mexida à mão não volta', () => {
  /** Segunda, 02/11, meio-dia em São Paulo. */
  const AGORA = new Date('2026-11-02T12:00:00-03:00');
  /** [dia, hora, situação] das sessões da Ana, em ordem. */
  const agendaDaAna = async (repo: ReturnType<typeof novoRepo>) =>
    (await repo.listarSessoesDoPaciente('p1')).map((s) => [dataLocal(s.inicio), horaLocal(s.inicio), s.situacao]);

  /** A Ana com as terças de novembro geradas e a de 17/11 cancelada (congresso). */
  async function comDia17Cancelado() {
    const repo = novoRepo();
    await garantirAgenda(repo, '2026-11-02', 4);
    const [dia17] = await repo.listarSessoes('2026-11-17', '2026-11-17');
    await marcarSituacao(repo, dia17, 'cancelada');
    await repo.atualizarSessao(dia17.id, { observacao: 'congresso' });
    return repo;
  }

  it('mesmo dia da semana, outra hora: 17/11 continua só cancelada (nada para lembrar no "Amanhã")', async () => {
    const repo = await comDia17Cancelado();

    await mudarHorarioFixo(repo, horarioExemplo(), { diaSemana: 2, hora: '15:00', duracaoMin: 50 }, '2026-11-09', 4, AGORA);

    expect(await agendaDaAna(repo)).toEqual([
      ['2026-11-03', '14:00', 'agendada'],
      ['2026-11-10', '15:00', 'agendada'],
      ['2026-11-17', '14:00', 'cancelada'],
      ['2026-11-24', '15:00', 'agendada'],
      ['2026-12-01', '15:00', 'agendada'],
    ]);
    // Completar a agenda depois (na véspera) também não traz a sessão de volta.
    await garantirAgenda(repo, '2026-11-16', 4);
    expect((await repo.listarSessoes('2026-11-17', '2026-11-17')).map((s) => s.situacao)).toEqual(['cancelada']);
  });

  it('outro dia da semana: a quinta da semana cancelada não é gerada, nem quando a agenda é completada no meio da semana', async () => {
    const repo = await comDia17Cancelado();

    await mudarHorarioFixo(repo, horarioExemplo(), { diaSemana: 4, hora: '15:00', duracaoMin: 50 }, '2026-11-09', 4, AGORA);

    expect(await agendaDaAna(repo)).toEqual([
      ['2026-11-03', '14:00', 'agendada'],
      ['2026-11-12', '15:00', 'agendada'],
      ['2026-11-17', '14:00', 'cancelada'],
      ['2026-11-26', '15:00', 'agendada'],
      ['2026-12-03', '15:00', 'agendada'],
    ]);

    // Quarta, 18/11: a agenda é aberta depois da terça cancelada e antes da quinta.
    await garantirAgenda(repo, '2026-11-18', 4);
    expect(await agendaDaAna(repo)).toEqual([
      ['2026-11-03', '14:00', 'agendada'],
      ['2026-11-12', '15:00', 'agendada'],
      ['2026-11-17', '14:00', 'cancelada'],
      ['2026-11-26', '15:00', 'agendada'],
      ['2026-12-03', '15:00', 'agendada'],
      ['2026-12-10', '15:00', 'agendada'],
    ]);
  });

  it('a semana de uma sessão remarcada à mão também não ganha outra', async () => {
    const repo = novoRepo();
    await garantirAgenda(repo, '2026-11-02', 4);
    const [dia17] = await repo.listarSessoes('2026-11-17', '2026-11-17');
    await remarcar(repo, dia17, instanteDe('2026-11-18', '10:00'));

    await mudarHorarioFixo(repo, horarioExemplo(), { diaSemana: 4, hora: '15:00', duracaoMin: 50 }, '2026-11-09', 4, AGORA);

    expect(await agendaDaAna(repo)).toEqual([
      ['2026-11-03', '14:00', 'agendada'],
      ['2026-11-12', '15:00', 'agendada'],
      ['2026-11-17', '14:00', 'remarcada'],
      ['2026-11-18', '10:00', 'agendada'],
      ['2026-11-26', '15:00', 'agendada'],
      ['2026-12-03', '15:00', 'agendada'],
    ]);
  });
});

describe('mudarTipo', () => {
  // Avaliação com 2 realizadas (27/10 e 03/11) e 2 agendadas futuras (10/11 e 17/11).
  const avaliacaoEmAndamento = (sessoesExtras: Sessao[] = []) =>
    novoRepo({
      pacientes: [pacienteExemplo({ tipo: 'avaliacao' })],
      avaliacoes: [avaliacaoExemplo()],
      sessoes: [
        fixa('2026-10-27', { situacao: 'compareceu', tipo: 'avaliacao', avaliacaoId: 'av1' }),
        fixa('2026-11-03', { situacao: 'compareceu', tipo: 'avaliacao', avaliacaoId: 'av1' }),
        fixa('2026-11-10', { tipo: 'avaliacao', avaliacaoId: 'av1' }),
        fixa('2026-11-17', { tipo: 'avaliacao', avaliacaoId: 'av1' }),
        ...sessoesExtras,
      ],
    });

  it('atualiza sessões futuras e preserva o histórico (Review Focus 4)', async () => {
    const repo = avaliacaoEmAndamento();

    await mudarTipo(repo, 'p1', 'psicoterapia', '2026-11-10', CONFIGURACOES_PADRAO);

    expect((await repo.obterFicha('p1'))?.paciente.tipo).toBe('psicoterapia');
    const sessoes = await repo.listarSessoesDoPaciente('p1');
    const realizadas = sessoes.filter((s) => s.situacao === 'compareceu');
    expect(realizadas.map((s) => [s.dataOcorrencia, s.tipo, s.avaliacaoId])).toEqual([
      ['2026-10-27', 'avaliacao', 'av1'],
      ['2026-11-03', 'avaliacao', 'av1'],
    ]);
    const futuras = sessoes.filter((s) => s.situacao === 'agendada');
    // A agenda é regenerada a partir de hoje (10/11) por 4 semanas.
    expect(futuras.map((s) => s.dataOcorrencia)).toEqual(['2026-11-10', '2026-11-17', '2026-11-24', '2026-12-01']);
    expect(futuras.every((s) => s.tipo === 'psicoterapia' && s.avaliacaoId === null)).toBe(true);
  });

  it('ao virar avaliação, cria a avaliação e as sessões futuras já nascem ligadas a ela', async () => {
    const repo = novoRepo({
      sessoes: [
        fixa('2026-11-03', { situacao: 'compareceu' }),
        fixa('2026-11-10'),
        fixa('2026-11-17'),
      ],
    });

    await mudarTipo(repo, 'p1', 'avaliacao', '2026-11-10', CONFIGURACOES_PADRAO);

    const ficha = await repo.obterFicha('p1');
    expect(ficha?.paciente.tipo).toBe('avaliacao');
    expect(ficha?.avaliacao).toEqual({
      id: expect.any(String),
      pacienteId: 'p1',
      inicio: '2026-11-10',
      fim: null,
      sessoesPrevistas: 10,
      etapas: ETAPAS_AVALIACAO_PADRAO.map((nome) => ({ nome, feita: false })),
    });
    const avaliacaoId = ficha?.avaliacao?.id;

    const sessoes = await repo.listarSessoesDoPaciente('p1');
    // O histórico continua como psicoterapia, sem avaliação.
    expect(sessoes[0]).toMatchObject({ dataOcorrencia: '2026-11-03', tipo: 'psicoterapia', avaliacaoId: null });
    const futuras = sessoes.filter((s) => s.situacao === 'agendada');
    expect(futuras.map((s) => s.dataOcorrencia)).toEqual(['2026-11-10', '2026-11-17', '2026-11-24', '2026-12-01']);
    expect(futuras.every((s) => s.tipo === 'avaliacao' && s.avaliacaoId === avaliacaoId)).toBe(true);
  });

  it('usa as semanas das configurações para regenerar a agenda', async () => {
    const repo = avaliacaoEmAndamento();
    await mudarTipo(repo, 'p1', 'psicoterapia', '2026-11-10', { ...CONFIGURACOES_PADRAO, semanasGeradas: 2 });
    const futuras = (await repo.listarSessoesDoPaciente('p1')).filter((s) => s.situacao === 'agendada');
    expect(futuras.map((s) => s.dataOcorrencia)).toEqual(['2026-11-10', '2026-11-17']);
  });

  it('avulsas e remarcações agendadas mudam de tipo no lugar; as passadas não', async () => {
    const repo = avaliacaoEmAndamento([
      sessaoExemplo({ id: 'avulsa-futura', inicio: '2026-11-12T13:00:00.000Z', tipo: 'avaliacao', avaliacaoId: 'av1' }),
      sessaoExemplo({
        id: 'remarcacao-futura',
        inicio: '2026-11-13T13:00:00.000Z',
        origem: 'remarcacao',
        tipo: 'avaliacao',
        avaliacaoId: 'av1',
      }),
      sessaoExemplo({ id: 'avulsa-passada', inicio: '2026-11-05T13:00:00.000Z', tipo: 'avaliacao', avaliacaoId: 'av1' }),
      sessaoExemplo({
        id: 'avulsa-realizada',
        inicio: '2026-11-20T13:00:00.000Z',
        situacao: 'compareceu',
        tipo: 'avaliacao',
        avaliacaoId: 'av1',
      }),
    ]);

    await mudarTipo(repo, 'p1', 'psicoterapia', '2026-11-10', CONFIGURACOES_PADRAO);

    const sessoes = await repo.listarSessoesDoPaciente('p1');
    const por = (id: string) => sessoes.find((s) => s.id === id);
    expect(por('avulsa-futura')).toMatchObject({
      inicio: '2026-11-12T13:00:00.000Z',
      situacao: 'agendada',
      tipo: 'psicoterapia',
      avaliacaoId: null,
    });
    expect(por('remarcacao-futura')).toMatchObject({ origem: 'remarcacao', tipo: 'psicoterapia', avaliacaoId: null });
    // Antes de hoje (agendada que ficou sem marcar) e já realizada: é histórico.
    expect(por('avulsa-passada')).toMatchObject({ tipo: 'avaliacao', avaliacaoId: 'av1' });
    expect(por('avulsa-realizada')).toMatchObject({ tipo: 'avaliacao', avaliacaoId: 'av1' });
  });

  it('avulsas futuras também passam a apontar para a avaliação nova', async () => {
    const repo = novoRepo({
      sessoes: [sessaoExemplo({ id: 'avulsa-futura', inicio: '2026-11-12T13:00:00.000Z' })],
    });
    await mudarTipo(repo, 'p1', 'avaliacao', '2026-11-10', CONFIGURACOES_PADRAO);
    const avaliacaoId = (await repo.obterFicha('p1'))?.avaliacao?.id;
    expect(avaliacaoId).toBeTruthy();
    const sessoes = await repo.listarSessoesDoPaciente('p1');
    expect(sessoes.find((s) => s.id === 'avulsa-futura')).toMatchObject({ tipo: 'avaliacao', avaliacaoId });
  });

  it('manter o mesmo tipo não mexe em nada', async () => {
    const repo = avaliacaoEmAndamento();
    const antes = await repo.listarSessoesDoPaciente('p1');

    await mudarTipo(repo, 'p1', 'avaliacao', '2026-11-10', CONFIGURACOES_PADRAO);

    expect(await repo.listarSessoesDoPaciente('p1')).toEqual(antes);
    expect((await repo.obterFicha('p1'))?.avaliacao?.id).toBe('av1');
  });

  it('rejeita paciente que não existe', async () => {
    const repo = novoRepo();
    await expect(mudarTipo(repo, 'inexistente', 'avaliacao', '2026-11-10', CONFIGURACOES_PADRAO)).rejects.toThrow(
      'Paciente não encontrado',
    );
  });
});

describe('darAlta', () => {
  it('encerra horários e remove futuras agendadas', async () => {
    const repo = novoRepo({
      pacientes: [pacienteExemplo(), pacienteExemplo({ id: 'p2', nome: 'Pedro Lima' })],
      horarios: [
        horarioExemplo(),
        // Um horário antigo, já encerrado antes da alta: a alta não pode reabri-lo.
        horarioExemplo({ id: 'hf0', diaSemana: 5, validoDe: '2026-09-01', validoAte: '2026-09-30' }),
        horarioExemplo({ id: 'hf2', pacienteId: 'p2', hora: '15:00' }),
      ],
    });
    await garantirAgenda(repo, '2026-11-02', 4);
    await criarAvulsa(repo, { pacienteId: 'p1', inicio: '2026-11-19T13:00:00.000Z', duracaoMin: 50, acompanhamentoFamiliar: false });
    const realizada = await criarAvulsa(repo, {
      pacienteId: 'p1',
      inicio: '2026-11-20T13:00:00.000Z',
      duracaoMin: 50,
      acompanhamentoFamiliar: false,
    });
    await marcarSituacao(repo, realizada, 'compareceu');

    await darAlta(repo, 'p1', '2026-11-10');

    const ficha = await repo.obterFicha('p1');
    expect(ficha?.paciente).toMatchObject({ status: 'alta', dataAlta: '2026-11-10' });
    expect(ficha?.horarios.map((h) => [h.id, h.validoAte])).toEqual([
      ['hf0', '2026-09-30'],
      ['hf1', '2026-11-10'],
    ]);

    const ana = await repo.listarSessoesDoPaciente('p1');
    // Fica o que é até o dia da alta (inclusive) e o que já foi realizado; saem as agendadas de depois.
    expect(ana.map((s) => [s.dataOcorrencia ?? s.inicio.slice(0, 10), s.situacao])).toEqual([
      ['2026-11-03', 'agendada'],
      ['2026-11-10', 'agendada'],
      ['2026-11-20', 'compareceu'],
    ]);
    // Outro paciente não é afetado.
    expect(await repo.listarSessoesDoPaciente('p2')).toHaveLength(4);
  });

  it('a agenda gerada depois não traz mais sessões de quem teve alta', async () => {
    const repo = novoRepo({
      pacientes: [pacienteExemplo(), pacienteExemplo({ id: 'p2', nome: 'Pedro Lima' })],
      horarios: [horarioExemplo(), horarioExemplo({ id: 'hf2', pacienteId: 'p2', hora: '15:00' })],
    });
    await garantirAgenda(repo, '2026-11-02', 4);
    await darAlta(repo, 'p1', '2026-11-10');

    // Só o Pedro ganha as 4 terças novas (dezembro).
    expect(await garantirAgenda(repo, '2026-11-02', 8)).toBe(4);
    expect(await repo.listarSessoesDoPaciente('p1')).toHaveLength(2);
  });

  it('a data da alta vale em dias de São Paulo', async () => {
    const repo = novoRepo({
      sessoes: [
        // 10/11 23:30 em São Paulo (já 11/11 em Tóquio): ainda é o dia da alta.
        sessaoExemplo({ id: 'noite-da-alta', inicio: '2026-11-11T02:30:00.000Z' }),
        // 11/11 00:30 em São Paulo: depois da alta.
        sessaoExemplo({ id: 'depois', inicio: '2026-11-11T03:30:00.000Z' }),
      ],
    });

    await darAlta(repo, 'p1', '2026-11-10');

    expect((await repo.listarSessoesDoPaciente('p1')).map((s) => s.id)).toEqual(['noite-da-alta']);
  });

  it('rejeita paciente que não existe', async () => {
    const repo = novoRepo();
    await expect(darAlta(repo, 'inexistente', '2026-11-10')).rejects.toThrow('Paciente não encontrado');
  });
});
