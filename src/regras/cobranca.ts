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
  sessoes: Sessao[];
  totalCentavos: number;
  situacao: 'em_andamento' | 'devendo' | 'pago';
  pagamento: Pagamento | null;
  /** Total de agora menos o que foi pago, só em mês pago: negativo se o total caiu depois do pagamento. */
  diferencaCentavos: number;
}

export interface Pendencias {
  /** Cobradas individualmente e ainda sem pagamento, da mais antiga para a mais nova. */
  sessoesAbertas: Sessao[];
  /** Só para quem paga por mês, do mais antigo para o mais novo. */
  meses: MesCobranca[];
  avaliacao: { valorFinalCentavos: number; pagoCentavos: number; faltaCentavos: number } | null;
  /** Sessões abertas + meses não pagos (inclusive o em andamento) + o que falta da avaliação. */
  totalEmAbertoCentavos: number;
  /** Data do item em aberto mais antigo. */
  desde: DataISO | null;
}

const soma = (valores: number[]): number => valores.reduce((total, v) => total + v, 0);
const porInicio = (a: Sessao, b: Sessao): number => Date.parse(a.inicio) - Date.parse(b.inicio);
const menorData = (datas: DataISO[]): DataISO | null =>
  datas.reduce<DataISO | null>((menor, d) => (menor === null || d < menor ? d : menor), null);

/**
 * Cobrada uma a uma: a falta sem aviso da avaliação e a psicoterapia de quem paga por sessão.
 * O resto vai para o mês (psicoterapia de quem paga por mês). O comparecimento à avaliação é do pacote.
 */
function ehCobradaAvulsa(s: Sessao, paciente: Paciente): boolean {
  if (s.tipo === 'avaliacao') return s.situacao === 'falta_sem_aviso';
  return paciente.formaCobranca === 'por_sessao';
}

function montarMeses(sessoes: Sessao[], pagamentos: Pagamento[], hoje: DataISO): MesCobranca[] {
  const mesDeHoje = `${hoje.slice(0, 7)}-01`;
  const sessoesPorMes = new Map<DataISO, Sessao[]>();
  for (const s of sessoes) {
    const mes = mesDaSessao(s.inicio);
    sessoesPorMes.set(mes, [...(sessoesPorMes.get(mes) ?? []), s]);
  }
  const pagamentoPorMes = new Map<DataISO, Pagamento>();
  for (const p of pagamentos) {
    if (p.referencia === 'mes' && p.mesReferencia !== null) pagamentoPorMes.set(p.mesReferencia, p);
  }

  // Mês pago aparece mesmo que as sessões dele tenham deixado de ser cobradas (é o que gera a diferença).
  const todos = [...new Set([...sessoesPorMes.keys(), ...pagamentoPorMes.keys()])].sort();
  return todos.flatMap((mes): MesCobranca[] => {
    const doMes = (sessoesPorMes.get(mes) ?? []).sort(porInicio);
    const totalCentavos = soma(doMes.map((s) => s.valorCentavos ?? 0));
    const pagamento = pagamentoPorMes.get(mes) ?? null;
    if (pagamento === null && totalCentavos === 0) return [];
    const situacao: MesCobranca['situacao'] =
      pagamento !== null ? 'pago' : mes < mesDeHoje ? 'devendo' : 'em_andamento';
    const diferencaCentavos = pagamento === null ? 0 : totalCentavos - pagamento.valorCentavos;
    return [{ mes, sessoes: doMes, totalCentavos, situacao, pagamento, diferencaCentavos }];
  });
}

/** O que o paciente ainda deve: sessões avulsas, meses e o pacote da avaliação. */
export function pendenciasDoPaciente(e: {
  paciente: Paciente;
  sessoes: Sessao[];
  pagamentos: Pagamento[];
  avaliacao: Avaliacao | null;
  hoje: DataISO;
}): Pendencias {
  const pagasIndividualmente = new Set<Id>(
    e.pagamentos.filter((p) => p.referencia === 'sessoes').flatMap((p) => p.sessaoIds),
  );
  const cobradas = e.sessoes.filter((s) => s.valorCentavos !== null && !pagasIndividualmente.has(s.id));

  const sessoesAbertas = cobradas.filter((s) => ehCobradaAvulsa(s, e.paciente)).sort(porInicio);
  const doMes = cobradas.filter((s) => s.tipo === 'psicoterapia' && e.paciente.formaCobranca === 'mensal');
  const meses = e.paciente.formaCobranca === 'mensal' ? montarMeses(doMes, e.pagamentos, e.hoje) : [];

  let avaliacao: Pendencias['avaliacao'] = null;
  if (e.avaliacao !== null) {
    const id = e.avaliacao.id;
    const valorFinalCentavos = valorFinalDaAvaliacao(e.avaliacao);
    const pagoCentavos = soma(
      e.pagamentos.filter((p) => p.referencia === 'avaliacao' && p.avaliacaoId === id).map((p) => p.valorCentavos),
    );
    avaliacao = { valorFinalCentavos, pagoCentavos, faltaCentavos: Math.max(0, valorFinalCentavos - pagoCentavos) };
  }

  const mesesEmAberto = meses.filter((m) => m.situacao !== 'pago');
  const faltaCentavos = avaliacao?.faltaCentavos ?? 0;
  return {
    sessoesAbertas,
    meses,
    avaliacao,
    totalEmAbertoCentavos:
      soma(sessoesAbertas.map((s) => s.valorCentavos ?? 0)) +
      soma(mesesEmAberto.map((m) => m.totalCentavos)) +
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
