import type { Repositorio } from '../dados/repositorio';
import type { Bloqueio, DataISO, Id, Sessao, SituacaoSessao } from '../dominio/tipos';
import { chaveOcorrencia, gerarOcorrencias, selecionarAgendadas } from '../regras/agenda';
import { dataLocal, inicioDaSemana, somarDias } from '../regras/datas';
import { exigirFicha } from './comum';

/**
 * Gera as sessões dos horários fixos de `hoje` até `semanas` semanas à frente
 * (a janela termina em `hoje + semanas × 7 − 1`). Pode rodar quantas vezes e em
 * quantos aparelhos for preciso: devolve só quantas sessões entraram de fato.
 */
export async function garantirAgenda(repo: Repositorio, hoje: DataISO, semanas: number): Promise<number> {
  const ate = somarDias(hoje, semanas * 7 - 1);
  const [horarios, bloqueios, sessoes] = await Promise.all([
    repo.listarHorariosVigentes(hoje, ate),
    repo.listarBloqueios(),
    // Semanas inteiras: depois de uma troca de horário, a ocorrência do horário novo pode estar ocupada por uma
    // sessão de outro dia da mesma semana (veja `planejarMudancaDeHorario`).
    repo.listarSessoes(inicioDaSemana(hoje), somarDias(inicioDaSemana(ate), 6)),
  ]);
  // Sessão de qualquer situação conta: ocorrência cancelada ou remarcada nunca é recriada.
  const existentes = new Set(
    sessoes.flatMap((s) =>
      s.horarioFixoId !== null && s.dataOcorrencia !== null ? [chaveOcorrencia(s.horarioFixoId, s.dataOcorrencia)] : [],
    ),
  );
  return repo.inserirOcorrencias(gerarOcorrencias({ horarios, bloqueios, existentes, de: hoje, ate }));
}

/** Registra o que aconteceu na sessão. O primeiro comparecimento define a data de entrada do paciente. */
export async function marcarSituacao(
  repo: Repositorio,
  sessao: Sessao,
  situacao: Exclude<SituacaoSessao, 'remarcada'>,
): Promise<Sessao> {
  const atualizada = await repo.atualizarSessao(sessao.id, { situacao });
  if (situacao === 'compareceu') {
    const { paciente } = await exigirFicha(repo, sessao.pacienteId);
    if (paciente.dataEntrada === null) {
      await repo.salvarPaciente({ ...paciente, dataEntrada: dataLocal(sessao.inicio) });
    }
  }
  return atualizada;
}

/**
 * Passa a sessão para outro horário: cria a nova e marca a original como remarcada.
 * A original continua presa à sua ocorrência do horário fixo, então a agenda não a recria.
 */
export async function remarcar(repo: Repositorio, sessao: Sessao, novoInicio: string): Promise<Sessao> {
  const nova = await repo.criarSessao({
    pacienteId: sessao.pacienteId,
    inicio: novoInicio,
    duracaoMin: sessao.duracaoMin,
    tipo: sessao.tipo,
    acompanhamentoFamiliar: sessao.acompanhamentoFamiliar,
    origem: 'remarcacao',
    horarioFixoId: null,
    dataOcorrencia: null,
    situacao: 'agendada',
    remarcadaPara: null,
    avaliacaoId: sessao.avaliacaoId,
    confirmada: false,
    observacao: null,
  });
  await repo.atualizarSessao(sessao.id, { situacao: 'remarcada', remarcadaPara: nova.id });
  return nova;
}

/** Sessão marcada fora do horário fixo. O tipo e a avaliação são os que o paciente tem hoje. */
export async function criarAvulsa(
  repo: Repositorio,
  dados: { pacienteId: Id; inicio: string; duracaoMin: number; acompanhamentoFamiliar: boolean },
): Promise<Sessao> {
  const { paciente, avaliacao } = await exigirFicha(repo, dados.pacienteId);
  return repo.criarSessao({
    pacienteId: dados.pacienteId,
    inicio: dados.inicio,
    duracaoMin: dados.duracaoMin,
    tipo: paciente.tipo,
    acompanhamentoFamiliar: dados.acompanhamentoFamiliar,
    origem: 'avulsa',
    horarioFixoId: null,
    dataOcorrencia: null,
    situacao: 'agendada',
    remarcadaPara: null,
    avaliacaoId: paciente.tipo === 'avaliacao' ? (avaliacao?.id ?? null) : null,
    confirmada: false,
    observacao: null,
  });
}

/**
 * Bloqueia o período e cancela as sessões ainda agendadas dentro dele (de qualquer origem).
 * O que já aconteceu — comparecimento, falta, remarcação — fica como está.
 */
export async function bloquearPeriodo(
  repo: Repositorio,
  b: Omit<Bloqueio, 'id'>,
): Promise<{ bloqueio: Bloqueio; canceladas: number }> {
  // O bloqueio entra primeiro: a partir daí a agenda já não gera sessões no período.
  const bloqueio = await repo.salvarBloqueio(b);
  const sessoes = await repo.listarSessoes(b.inicio, b.fim);
  const ids = selecionarAgendadas(sessoes, { de: b.inicio, ate: b.fim });
  await Promise.all(ids.map((id) => repo.atualizarSessao(id, { situacao: 'cancelada', observacao: b.motivo })));
  return { bloqueio, canceladas: ids.length };
}
