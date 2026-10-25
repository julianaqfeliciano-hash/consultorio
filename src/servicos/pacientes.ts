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
import { planejarMudancaDeHorario, selecionarAgendadas } from '../regras/agenda';
import { hojeISO, somarDias } from '../regras/datas';
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

/**
 * Cadastra o paciente; em avaliação, já abre a avaliação (na data de entrada, ou hoje).
 * Quem chama pode informar o `id`: se a avaliação falhar depois de o paciente ser gravado,
 * repetir a chamada com o mesmo `id` completa o cadastro em vez de criar um segundo paciente.
 */
export async function criarPaciente(
  repo: Repositorio,
  dados: Rascunho<Paciente>,
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
 * Troca o horário fixo a partir de `aPartirDe` (hoje ou depois; não antes de o horário começar a valer).
 * O antigo termina na véspera e o novo começa nesse dia; se o antigo começou nesse mesmo dia, ele é trocado
 * no lugar (um horário nunca termina antes de começar). Das sessões do antigo dali em diante, só as agendadas
 * que ainda não aconteceram dão lugar às do novo; o que já aconteceu ou foi mexido à mão fica e ocupa a semana
 * (veja `planejarMudancaDeHorario`). O que veio antes de `aPartirDe` não muda.
 */
export async function mudarHorarioFixo(
  repo: Repositorio,
  horario: HorarioFixo,
  novo: Pick<HorarioFixo, 'diaSemana' | 'hora' | 'duracaoMin'>,
  aPartirDe: DataISO,
  semanas: number,
  agora: Date = new Date(),
): Promise<HorarioFixo> {
  if (aPartirDe < horario.validoDe) {
    throw new Error(`A mudança não pode começar antes de ${horario.validoDe}, quando o horário começa a valer.`);
  }
  const hoje = hojeISO(agora);
  const mudancas = { diaSemana: novo.diaSemana, hora: novo.hora, duracaoMin: novo.duracaoMin };
  let criado: HorarioFixo;
  if (aPartirDe === horario.validoDe) {
    criado = await repo.salvarHorario({ ...horario, ...mudancas });
  } else {
    const vespera = somarDias(aPartirDe, -1);
    // Um horário que já tinha data para terminar antes não é reaberto.
    const validoAte = horario.validoAte !== null && horario.validoAte < vespera ? horario.validoAte : vespera;
    await repo.salvarHorario({ ...horario, validoAte });
    criado = await repo.salvarHorario({ pacienteId: horario.pacienteId, ...mudancas, validoDe: aPartirDe, validoAte: null });
  }

  const sessoes = await repo.listarSessoesDoPaciente(horario.pacienteId);
  const { remover, ocupar } = planejarMudancaDeHorario({
    sessoes,
    antigoId: horario.id,
    novo: criado,
    aPartirDe,
    agora: agora.toISOString(),
  });
  await repo.removerSessoes(remover);
  await Promise.all(
    ocupar.map((o) => repo.atualizarSessao(o.id, { horarioFixoId: criado.id, dataOcorrencia: o.dataOcorrencia })),
  );
  // Nada é gerado no passado.
  await garantirAgenda(repo, aPartirDe > hoje ? aPartirDe : hoje, semanas);
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
