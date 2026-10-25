import type {
  Avaliacao,
  Bloqueio,
  DataISO,
  HorarioComPaciente,
  HorarioFixo,
  Id,
  NovaSessao,
  Sessao,
  SituacaoSessao,
} from '../dominio/tipos';
import { dataLocal, diaDaSemana, entre, instanteDe, mesmoDiaNaSemana, somarDias } from './datas';

/** Identifica uma ocorrência de horário fixo numa data (evita gerar a mesma sessão duas vezes). */
export function chaveOcorrencia(horarioFixoId: Id, d: DataISO): string {
  return `${horarioFixoId}|${d}`;
}

/** O dia cai dentro de algum bloqueio (limites incluídos). */
export function estaBloqueado(d: DataISO, bloqueios: Bloqueio[]): boolean {
  return bloqueios.some((b) => entre(d, b.inicio, b.fim));
}

/** Só se cobra quem compareceu ou faltou sem avisar. */
export function ehCobravel(s: SituacaoSessao): boolean {
  return s === 'compareceu' || s === 'falta_sem_aviso';
}

/**
 * Posição da sessão `alvo` dentro da avaliação: sessões da mesma avaliação
 * a que o paciente compareceu antes dela, mais 1.
 * Sem avaliação vinculada não há o que contar, então devolve 1.
 */
export function numeroNaAvaliacao(sessoes: Sessao[], alvo: Sessao): number {
  if (alvo.avaliacaoId === null) return 1;
  const inicioAlvo = Date.parse(alvo.inicio);
  const anteriores = sessoes.filter(
    (s) => s.avaliacaoId === alvo.avaliacaoId && s.situacao === 'compareceu' && Date.parse(s.inicio) < inicioAlvo,
  );
  return anteriores.length + 1;
}

/**
 * Em que sessão da avaliação o paciente está: comparecimentos desta avaliação mais 1,
 * sem passar do total previsto (a "sessão X de N" da ficha).
 */
export function sessaoAtualNaAvaliacao(sessoes: Sessao[], avaliacao: Avaliacao): number {
  const realizadas = sessoes.filter((s) => s.avaliacaoId === avaliacao.id && s.situacao === 'compareceu').length;
  return Math.min(realizadas + 1, avaliacao.sessoesPrevistas);
}

/**
 * Divide as sessões de um paciente: as próximas (agendadas de `hoje` em diante, a mais próxima
 * primeiro) e o histórico (todo o resto, o mais recente primeiro). O dia é o dia local do consultório.
 */
export function separarSessoesDoPaciente(
  sessoes: Sessao[],
  hoje: DataISO,
): { proximas: Sessao[]; historico: Sessao[] } {
  const porInicio = (a: Sessao, b: Sessao) => Date.parse(a.inicio) - Date.parse(b.inicio);
  const ehProxima = (s: Sessao) => s.situacao === 'agendada' && dataLocal(s.inicio) >= hoje;
  return {
    proximas: sessoes.filter(ehProxima).sort(porInicio),
    historico: sessoes.filter((s) => !ehProxima(s)).sort((a, b) => porInicio(b, a)),
  };
}

/** Gera as sessões dos horários fixos entre `de` e `ate` (inclusive), ordenadas por início. */
export function gerarOcorrencias(e: {
  horarios: HorarioComPaciente[];
  bloqueios: Bloqueio[];
  existentes: Set<string>;
  de: DataISO;
  ate: DataISO;
}): NovaSessao[] {
  const ativos = e.horarios.filter((h) => h.statusPaciente === 'ativo');
  const novas: NovaSessao[] = [];

  for (let d = e.de; d <= e.ate; d = somarDias(d, 1)) {
    if (estaBloqueado(d, e.bloqueios)) continue;
    const dia = diaDaSemana(d);
    for (const h of ativos) {
      if (h.diaSemana !== dia) continue;
      if (h.validoDe > d) continue;
      if (h.validoAte !== null && d > h.validoAte) continue;
      if (e.existentes.has(chaveOcorrencia(h.id, d))) continue;
      novas.push({
        pacienteId: h.pacienteId,
        inicio: instanteDe(d, h.hora),
        duracaoMin: h.duracaoMin,
        tipo: h.tipoPaciente,
        acompanhamentoFamiliar: false,
        origem: 'fixa',
        horarioFixoId: h.id,
        dataOcorrencia: d,
        situacao: 'agendada',
        remarcadaPara: null,
        avaliacaoId: h.tipoPaciente === 'avaliacao' ? h.avaliacaoId : null,
        confirmada: false,
        observacao: null,
      });
    }
  }

  // Sort estável: horários com o mesmo início mantêm a ordem em que vieram.
  return novas.sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
}

/** Ids das sessões agendadas que casam com o filtro (datas no fuso do consultório). */
export function selecionarAgendadas(
  sessoes: Sessao[],
  f: { pacienteId?: Id; horarioFixoId?: Id; de: DataISO; ate?: DataISO; somenteFixas?: boolean },
): Id[] {
  return sessoes
    .filter((s) => {
      if (s.situacao !== 'agendada') return false;
      if (f.pacienteId !== undefined && s.pacienteId !== f.pacienteId) return false;
      if (f.horarioFixoId !== undefined && s.horarioFixoId !== f.horarioFixoId) return false;
      if (f.somenteFixas && s.origem !== 'fixa') return false;
      const dia = dataLocal(s.inicio);
      return dia >= f.de && (f.ate === undefined || dia <= f.ate);
    })
    .map((s) => s.id);
}

/**
 * O que a troca do horário fixo `antigoId` pelo `novo`, a partir de `aPartirDe`, faz com as sessões dele
 * daquele dia em diante (dia local de São Paulo).
 *
 * - `remover`: as ainda agendadas que não aconteceram (`inicio` depois de `agora`): o horário novo gera as dele.
 * - `ocupar`: as que ficam — já aconteceram (agendadas cujo horário passou) ou foram mexidas à mão (canceladas,
 *   remarcadas, faltas, comparecimentos). A semana (segunda a domingo) de cada uma já tem a sua sessão, então ela
 *   passa a ocupar a ocorrência do horário novo nessa semana (`dataOcorrencia` = o dia do horário novo). Como a
 *   ocorrência fica gravada, o horário novo não a gera agora nem quando a agenda for completada depois.
 *   Só entram os dias que a agenda ainda poderia gerar: de `novo.validoDe` e de hoje em diante.
 */
export function planejarMudancaDeHorario(e: {
  sessoes: Sessao[];
  antigoId: Id;
  novo: Pick<HorarioFixo, 'id' | 'diaSemana' | 'validoDe'>;
  aPartirDe: DataISO;
  /** Instante ISO de agora. */
  agora: string;
}): { remover: Id[]; ocupar: { id: Id; dataOcorrencia: DataISO }[] } {
  const agora = Date.parse(e.agora);
  const hoje = dataLocal(e.agora);
  const primeiroDia = e.novo.validoDe > hoje ? e.novo.validoDe : hoje;
  const remover: Id[] = [];
  const ocupar: { id: Id; dataOcorrencia: DataISO }[] = [];
  const ocupados = new Set<DataISO>();

  for (const s of e.sessoes) {
    if (s.horarioFixoId !== e.antigoId || s.origem !== 'fixa') continue;
    const dia = dataLocal(s.inicio);
    if (dia < e.aPartirDe) continue;
    if (s.situacao === 'agendada' && Date.parse(s.inicio) > agora) {
      remover.push(s.id);
      continue;
    }
    const noNovo = mesmoDiaNaSemana(dia, e.novo.diaSemana);
    if (noNovo < primeiroDia || ocupados.has(noNovo)) continue;
    ocupados.add(noNovo);
    if (s.horarioFixoId === e.novo.id && s.dataOcorrencia === noNovo) continue;
    ocupar.push({ id: s.id, dataOcorrencia: noNovo });
  }
  return { remover, ocupar };
}
