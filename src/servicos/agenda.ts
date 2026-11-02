import type { Repositorio } from '../dados/repositorio';
import type { Bloqueio, DataISO, Id, Sessao, SituacaoSessao } from '../dominio/tipos';
import { chaveOcorrencia, gerarOcorrencias, novaSessaoDeRemarcacao, selecionarAgendadas } from '../regras/agenda';
import { valorCobradoDaSessao } from '../regras/cobranca';
import { dataLocal, inicioDaSemana, somarDias } from '../regras/datas';
import { ErroCobranca } from './cobranca';
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

/**
 * Registra o que aconteceu na sessão e guarda o que ela custa (`valorCentavos`, ou `null` se não é cobrada).
 * O valor é o do paciente no dia em que a sessão passa a ser cobrada: reajustes não mexem em sessões já marcadas,
 * e mudar entre duas situações cobradas mantém o valor que ela já tinha.
 * O primeiro comparecimento define a data de entrada do paciente.
 *
 * Sessão já quitada por um pagamento de sessões não pode deixar de ser cobrada: o pagamento ficaria apontando
 * para uma sessão sem valor. A recusa vem antes de qualquer gravação.
 */
export async function marcarSituacao(
  repo: Repositorio,
  sessao: Sessao,
  situacao: Exclude<SituacaoSessao, 'remarcada'>,
): Promise<Sessao> {
  const { paciente } = await exigirFicha(repo, sessao.pacienteId);
  const valorNovo = valorCobradoDaSessao({ tipo: sessao.tipo, situacao }, paciente.valorSessaoCentavos);
  if (valorNovo === null) {
    const pagamentos = await repo.listarPagamentos({ pacienteId: sessao.pacienteId });
    const paga = pagamentos.some((p) => p.referencia === 'sessoes' && p.sessaoIds.includes(sessao.id));
    if (paga) {
      throw new ErroCobranca(
        'Esta sessão já foi paga. Para mudar a situação, remova o pagamento na ficha do paciente.',
      );
    }
  }
  const valorCentavos = valorNovo === null ? null : (sessao.valorCentavos ?? valorNovo);

  const atualizada = await repo.atualizarSessao(sessao.id, { situacao, valorCentavos });
  if (situacao === 'compareceu' && paciente.dataEntrada === null) {
    await repo.salvarPaciente({ ...paciente, dataEntrada: dataLocal(sessao.inicio) });
  }
  return atualizada;
}

/**
 * Passa a sessão para outro horário: cria a nova e marca a original como remarcada.
 * A original continua presa à sua ocorrência do horário fixo, então a agenda não a recria.
 */
export async function remarcar(repo: Repositorio, sessao: Sessao, novoInicio: string): Promise<Sessao> {
  const nova = await repo.criarSessao(novaSessaoDeRemarcacao(sessao, novoInicio));
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
    valorCentavos: null,
  });
}

/**
 * Bloqueia o período e cancela as sessões ainda agendadas dentro dele (de qualquer origem), com o motivo na
 * observação (acrescentado numa linha nova quando ela já tinha alguma). O que já aconteceu — comparecimento,
 * falta, remarcação — fica como está.
 */
export async function bloquearPeriodo(
  repo: Repositorio,
  b: Omit<Bloqueio, 'id'>,
): Promise<{ bloqueio: Bloqueio; canceladas: number }> {
  // O bloqueio entra primeiro: a partir daí a agenda já não gera sessões no período.
  const bloqueio = await repo.salvarBloqueio(b);
  const sessoes = await repo.listarSessoes(b.inicio, b.fim);
  const ids = new Set(selecionarAgendadas(sessoes, { de: b.inicio, ate: b.fim }));
  const canceladas = sessoes.filter((s) => ids.has(s.id));
  await Promise.all(
    canceladas.map((s) =>
      repo.atualizarSessao(s.id, {
        situacao: 'cancelada',
        observacao: s.observacao?.trim() ? `${s.observacao}\nBloqueio: ${b.motivo}` : b.motivo,
      }),
    ),
  );
  return { bloqueio, canceladas: canceladas.length };
}
