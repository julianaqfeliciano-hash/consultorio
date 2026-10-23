import type { Rascunho, Repositorio } from '../dados/repositorio';
import { ETAPAS_AVALIACAO_PADRAO } from '../dominio/padroes';
import type {
  Avaliacao,
  Configuracoes,
  DataISO,
  HorarioFixo,
  Id,
  Paciente,
  TipoAtendimento,
} from '../dominio/tipos';
import { selecionarAgendadas } from '../regras/agenda';
import { somarDias } from '../regras/datas';
import { garantirAgenda } from './agenda';
import { exigirFicha } from './comum';

/** Avaliação nova: etapas padrão ainda não feitas e o número de sessões das configurações. */
function novaAvaliacao(pacienteId: Id, inicio: DataISO, config: Configuracoes): Rascunho<Avaliacao> {
  return {
    pacienteId,
    inicio,
    fim: null,
    sessoesPrevistas: config.sessoesAvaliacaoPadrao,
    etapas: ETAPAS_AVALIACAO_PADRAO.map((nome) => ({ nome, feita: false })),
  };
}

/** Cadastra o paciente; em avaliação, já abre a avaliação (na data de entrada, ou hoje). */
export async function criarPaciente(
  repo: Repositorio,
  dados: Omit<Paciente, 'id'>,
  config: Configuracoes,
  hoje: DataISO,
): Promise<Paciente> {
  const paciente = await repo.salvarPaciente(dados);
  if (paciente.tipo === 'avaliacao') {
    await repo.salvarAvaliacao(novaAvaliacao(paciente.id, dados.dataEntrada ?? hoje, config));
  }
  return paciente;
}

/**
 * Troca o horário fixo a partir de `aPartirDe`: o antigo termina na véspera, o novo
 * começa nesse dia, e as sessões ainda agendadas do antigo dali em diante dão lugar às do novo.
 * O que veio antes de `aPartirDe` não muda.
 */
export async function mudarHorarioFixo(
  repo: Repositorio,
  horario: HorarioFixo,
  novo: Pick<HorarioFixo, 'diaSemana' | 'hora' | 'duracaoMin'>,
  aPartirDe: DataISO,
  semanas: number,
): Promise<HorarioFixo> {
  await repo.salvarHorario({ ...horario, validoAte: somarDias(aPartirDe, -1) });
  const criado = await repo.salvarHorario({
    pacienteId: horario.pacienteId,
    diaSemana: novo.diaSemana,
    hora: novo.hora,
    duracaoMin: novo.duracaoMin,
    validoDe: aPartirDe,
    validoAte: null,
  });
  const sessoes = await repo.listarSessoesDoPaciente(horario.pacienteId);
  await repo.removerSessoes(
    selecionarAgendadas(sessoes, { horarioFixoId: horario.id, de: aPartirDe, somenteFixas: true }),
  );
  await garantirAgenda(repo, aPartirDe, semanas);
  return criado;
}

/**
 * Muda o tipo de atendimento. As sessões de hoje em diante que ainda estão agendadas
 * passam para o tipo novo; o que já aconteceu (ou ficou para trás) mantém o tipo de então.
 */
export async function mudarTipo(
  repo: Repositorio,
  pacienteId: Id,
  novoTipo: TipoAtendimento,
  hoje: DataISO,
  config: Configuracoes,
): Promise<void> {
  const { paciente } = await exigirFicha(repo, pacienteId);
  if (paciente.tipo === novoTipo) return;

  // A avaliação precisa existir antes de a agenda ser regenerada: é dela que as sessões novas herdam o vínculo.
  const avaliacaoId =
    novoTipo === 'avaliacao' ? (await repo.salvarAvaliacao(novaAvaliacao(pacienteId, hoje, config))).id : null;
  await repo.salvarPaciente({ ...paciente, tipo: novoTipo });

  const sessoes = await repo.listarSessoesDoPaciente(pacienteId);
  // As fixas agendadas são regeneradas logo abaixo, já com o tipo novo.
  await repo.removerSessoes(selecionarAgendadas(sessoes, { pacienteId, de: hoje, somenteFixas: true }));
  // Avulsas e remarcações foram marcadas à mão para um horário específico: ficam onde estão e só mudam de tipo.
  const marcadasAMao = selecionarAgendadas(
    sessoes.filter((s) => s.origem !== 'fixa'),
    { pacienteId, de: hoje },
  );
  await Promise.all(marcadasAMao.map((id) => repo.atualizarSessao(id, { tipo: novoTipo, avaliacaoId })));

  await garantirAgenda(repo, hoje, config.semanasGeradas);
}

/**
 * Dá alta: encerra os horários na data da alta e tira da agenda as sessões ainda
 * agendadas de depois dela. O que já aconteceu fica no histórico.
 */
export async function darAlta(repo: Repositorio, pacienteId: Id, data: DataISO): Promise<void> {
  const { paciente, horarios } = await exigirFicha(repo, pacienteId);
  await repo.salvarPaciente({ ...paciente, status: 'alta', dataAlta: data });
  // Horário que já tinha terminado antes da alta continua com a data de término que tinha.
  await Promise.all(
    horarios
      .filter((h) => h.validoAte === null || h.validoAte > data)
      .map((h) => repo.salvarHorario({ ...h, validoAte: data })),
  );
  const sessoes = await repo.listarSessoesDoPaciente(pacienteId);
  await repo.removerSessoes(selecionarAgendadas(sessoes, { pacienteId, de: somarDias(data, 1) }));
}
