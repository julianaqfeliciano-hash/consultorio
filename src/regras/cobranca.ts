import type { Avaliacao, DataISO, Id, Paciente, Pagamento, Sessao } from '../dominio/tipos';
import { ehCobravel } from './agenda';
import { dataLocal } from './datas';

/*
 * Regras de cobrança (spec §5.2, §6 e §9.1). Funções puras: nada de relógio nem de
 * fuso do aparelho. "Hoje" chega por parâmetro e todo mês é um dia local 'YYYY-MM-01'.
 */

const MESES = [
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

/**
 * Valor que a sessão passa a custar quando ganha a situação dela, ou `null` se não é cobrada.
 * Psicoterapia (inclusive acompanhamento familiar): quem compareceu ou faltou sem avisar.
 * Avaliação: o comparecimento faz parte do pacote (§6.4); só a falta sem aviso é cobrada à parte.
 */
export function valorCobradoDaSessao(
  s: Pick<Sessao, 'tipo' | 'situacao'>,
  valorSessaoCentavos: number,
): number | null {
  const cobrada = s.tipo === 'avaliacao' ? s.situacao === 'falta_sem_aviso' : ehCobravel(s.situacao);
  return cobrada ? valorSessaoCentavos : null;
}

/** Valor do pacote de avaliação depois do desconto (nunca abaixo de zero). */
export function valorFinalDaAvaliacao(
  a: Pick<Avaliacao, 'valorPrevistoCentavos' | 'descontoTipo' | 'descontoValor'>,
): number {
  switch (a.descontoTipo) {
    case 'reais':
      return Math.max(0, a.valorPrevistoCentavos - a.descontoValor);
    case 'percentual':
      return Math.max(0, Math.round((a.valorPrevistoCentavos * (100 - a.descontoValor)) / 100));
    case 'nenhum':
      return a.valorPrevistoCentavos;
  }
}

/** O dia 1 do mês local da sessão: 23:30 de 31/10 em São Paulo ainda é outubro, mesmo já sendo novembro em UTC. */
export function mesDaSessao(inicio: string): DataISO {
  return `${dataLocal(inicio).slice(0, 7)}-01`;
}

/** '2026-11-01' → 'novembro de 2026'. */
export function mesPorExtenso(mes: DataISO): string {
  const [ano, numero] = mes.split('-');
  return `${MESES[Number(numero) - 1]} de ${ano}`;
}

export interface MesCobranca {
  mes: DataISO;
  /** As sessões cobradas do mês que não foram pagas uma a uma, da mais antiga para a mais nova. */
  sessoes: Sessao[];
  /** A soma dos valores guardados nessas sessões. */
  totalCentavos: number;
  /** `pago` quando os pagamentos do mês cobrem o total; senão `devendo` (mês que já terminou) ou `em_andamento`. */
  situacao: 'em_andamento' | 'devendo' | 'pago';
  /** Os pagamentos do mês (o primeiro e os da diferença), na ordem em que vieram. */
  pagamentos: Pagamento[];
  pagoCentavos: number;
  /** O que ainda falta receber do mês: total − pago, nunca abaixo de zero. É o que conta no "a receber". */
  faltaCentavos: number;
  /**
   * Total de agora menos o que foi pago, só em mês que já teve pagamento (sem pagamento é 0): positivo quando o
   * total subiu depois do pagamento (falta receber), negativo quando caiu (foi pago a mais).
   */
  diferencaCentavos: number;
}

export interface Pendencias {
  /** Cobradas individualmente e ainda sem pagamento, da mais antiga para a mais nova. */
  sessoesAbertas: Sessao[];
  /** Os meses cobrados como mês (veja `pendenciasDoPaciente`), do mais antigo para o mais novo. */
  meses: MesCobranca[];
  avaliacao: { valorFinalCentavos: number; pagoCentavos: number; faltaCentavos: number } | null;
  /** Sessões abertas + o que falta de cada mês (inclusive o em andamento) + o que falta da avaliação. */
  totalEmAbertoCentavos: number;
  /** Data do item em aberto mais antigo. */
  desde: DataISO | null;
}

const soma = (valores: number[]): number => valores.reduce((total, v) => total + v, 0);
const porInicio = (a: Sessao, b: Sessao): number => Date.parse(a.inicio) - Date.parse(b.inicio);
const menorData = (datas: DataISO[]): DataISO | null =>
  datas.reduce<DataISO | null>((menor, d) => (menor === null || d < menor ? d : menor), null);

function montarMeses(sessoes: Sessao[], pagamentosDoMes: Pagamento[], hoje: DataISO): MesCobranca[] {
  const mesDeHoje = `${hoje.slice(0, 7)}-01`;
  const sessoesPorMes = new Map<DataISO, Sessao[]>();
  for (const s of sessoes) {
    const mes = mesDaSessao(s.inicio);
    sessoesPorMes.set(mes, [...(sessoesPorMes.get(mes) ?? []), s]);
  }
  const pagamentosPorMes = new Map<DataISO, Pagamento[]>();
  for (const p of pagamentosDoMes) {
    if (p.mesReferencia === null) continue;
    pagamentosPorMes.set(p.mesReferencia, [...(pagamentosPorMes.get(p.mesReferencia) ?? []), p]);
  }

  // Mês pago aparece mesmo que as sessões dele tenham deixado de ser cobradas (é o que gera a diferença).
  const todos = [...new Set([...sessoesPorMes.keys(), ...pagamentosPorMes.keys()])].sort();
  return todos.flatMap((mes): MesCobranca[] => {
    const doMes = (sessoesPorMes.get(mes) ?? []).sort(porInicio);
    const totalCentavos = soma(doMes.map((s) => s.valorCentavos ?? 0));
    const pagamentos = pagamentosPorMes.get(mes) ?? [];
    if (pagamentos.length === 0 && totalCentavos === 0) return [];
    const pagoCentavos = soma(pagamentos.map((p) => p.valorCentavos));
    // Sem pagamento, o total (maior que zero) está todo em aberto.
    const faltaCentavos = Math.max(0, totalCentavos - pagoCentavos);
    const situacao: MesCobranca['situacao'] =
      faltaCentavos === 0 ? 'pago' : mes < mesDeHoje ? 'devendo' : 'em_andamento';
    const diferencaCentavos = pagamentos.length === 0 ? 0 : totalCentavos - pagoCentavos;
    return [
      { mes, sessoes: doMes, totalCentavos, situacao, pagamentos, pagoCentavos, faltaCentavos, diferencaCentavos },
    ];
  });
}

/**
 * O que o paciente ainda deve: sessões avulsas, meses e o pacote da avaliação.
 *
 * - Sessão paga uma a uma (num pagamento de sessões) está quitada e nunca entra no total de um mês.
 * - A psicoterapia é cobrada **como mês** quando o paciente paga por mês hoje, **ou** quando aquele mês já tem
 *   pagamento do mês, qualquer que seja a forma de agora: mudar a forma de cobrança não reabre um mês pago.
 *   O total do mês soma as sessões dele não pagas uma a uma; o que passa do que foi pago está em aberto.
 * - O resto é cobrado sessão por sessão: a psicoterapia de quem paga por sessão (fora dos meses pagos como mês) e
 *   a falta sem aviso da avaliação. O comparecimento à avaliação é do pacote.
 */
export function pendenciasDoPaciente(e: {
  paciente: Paciente;
  sessoes: Sessao[];
  pagamentos: Pagamento[];
  avaliacao: Avaliacao | null;
  hoje: DataISO;
}): Pendencias {
  // A lista pode vir com os pagamentos de todos os pacientes: só os deste contam.
  const pagamentos = e.pagamentos.filter((p) => p.pacienteId === e.paciente.id);
  const pagasIndividualmente = new Set<Id>(
    pagamentos.filter((p) => p.referencia === 'sessoes').flatMap((p) => p.sessaoIds),
  );
  const pagamentosDoMes = pagamentos.filter((p) => p.referencia === 'mes' && p.mesReferencia !== null);
  const mesesPagosComoMes = new Set(pagamentosDoMes.map((p) => p.mesReferencia));
  const cobradaNoMes = (s: Sessao): boolean =>
    s.tipo === 'psicoterapia' && (e.paciente.formaCobranca === 'mensal' || mesesPagosComoMes.has(mesDaSessao(s.inicio)));
  const cobradaAvulsa = (s: Sessao): boolean =>
    s.tipo === 'avaliacao' ? s.situacao === 'falta_sem_aviso' : !cobradaNoMes(s);

  const cobradas = e.sessoes.filter((s) => s.valorCentavos !== null && !pagasIndividualmente.has(s.id));
  // Sessão de valor zero não é dívida: não existe pagamento de zero que a quite.
  const sessoesAbertas = cobradas.filter((s) => (s.valorCentavos ?? 0) > 0 && cobradaAvulsa(s)).sort(porInicio);
  const meses = montarMeses(cobradas.filter(cobradaNoMes), pagamentosDoMes, e.hoje);

  let avaliacao: Pendencias['avaliacao'] = null;
  if (e.avaliacao !== null) {
    const id = e.avaliacao.id;
    const valorFinalCentavos = valorFinalDaAvaliacao(e.avaliacao);
    const pagoCentavos = soma(
      pagamentos.filter((p) => p.referencia === 'avaliacao' && p.avaliacaoId === id).map((p) => p.valorCentavos),
    );
    avaliacao = { valorFinalCentavos, pagoCentavos, faltaCentavos: Math.max(0, valorFinalCentavos - pagoCentavos) };
  }

  const mesesEmAberto = meses.filter((m) => m.faltaCentavos > 0);
  const faltaCentavos = avaliacao?.faltaCentavos ?? 0;
  return {
    sessoesAbertas,
    meses,
    avaliacao,
    totalEmAbertoCentavos:
      soma(sessoesAbertas.map((s) => s.valorCentavos ?? 0)) +
      soma(mesesEmAberto.map((m) => m.faltaCentavos)) +
      faltaCentavos,
    desde: menorData([
      ...sessoesAbertas.map((s) => dataLocal(s.inicio)),
      ...mesesEmAberto.map((m) => m.mes),
      ...(faltaCentavos > 0 && e.avaliacao !== null ? [e.avaliacao.inicio] : []),
    ]),
  };
}

/** Quem tem algo a receber, do que espera há mais tempo para o mais recente. */
export function resumoAReceber(
  itens: { paciente: Paciente; pendencias: Pendencias }[],
): { paciente: Paciente; totalCentavos: number; desde: DataISO | null }[] {
  return itens
    .filter((i) => i.pendencias.totalEmAbertoCentavos > 0)
    .map((i) => ({
      paciente: i.paciente,
      totalCentavos: i.pendencias.totalEmAbertoCentavos,
      desde: i.pendencias.desde,
    }))
    .sort((a, b) => (a.desde ?? '9999-12-31').localeCompare(b.desde ?? '9999-12-31'));
}
