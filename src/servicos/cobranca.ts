import { ERRO_MES_JA_PAGO, type Repositorio } from '../dados/repositorio';
import type { DataISO, FormaPagamento, Id, Pagamento, Sessao } from '../dominio/tipos';
import { novaSessaoDeRemarcacao } from '../regras/agenda';
import { pendenciasDoPaciente } from '../regras/cobranca';
import { formatarReais } from '../regras/dinheiro';
import { exigirFicha } from './comum';

/** Recusa de uma operação de cobrança. A mensagem já é a que a interface mostra, do jeito que está. */
export class ErroCobranca extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErroCobranca';
  }
}

/**
 * O que a pessoa informa ao registrar um pagamento. O valor de sessões e de mês nunca vem dela:
 * sai dos valores guardados. Só na avaliação (parcelas) é ela quem diz quanto está pagando.
 */
export type PedidoPagamento = {
  pacienteId: Id;
  data: DataISO;
  forma: FormaPagamento;
  observacao: string | null;
} & (
  | { referencia: 'sessoes'; sessaoIds: Id[] }
  | { referencia: 'mes'; mes: DataISO }
  | { referencia: 'avaliacao'; valorCentavos: number }
);

const SO_SESSOES_ABERTAS = 'Escolha só sessões em aberto deste paciente.';
const MES_SEM_NADA = 'Este mês não tem nada a receber.';
const SEM_AVALIACAO = 'Este paciente não tem avaliação.';
const SO_FALTA_NA_AVALIACAO = 'A reposição é só para falta sem aviso na avaliação.';

/**
 * Registra o pagamento. O valor é calculado aqui, a partir do que está guardado (veja `PedidoPagamento`).
 * Erro de `ErroCobranca` quando o pedido não cabe no que o paciente deve.
 */
export async function registrarPagamento(repo: Repositorio, p: PedidoPagamento, hoje: DataISO): Promise<Pagamento> {
  const [{ paciente, avaliacao }, sessoes, pagamentos] = await Promise.all([
    exigirFicha(repo, p.pacienteId),
    repo.listarSessoesDoPaciente(p.pacienteId),
    repo.listarPagamentos({ pacienteId: p.pacienteId }),
  ]);
  const pendencias = pendenciasDoPaciente({ paciente, sessoes, pagamentos, avaliacao, hoje });
  const base = { pacienteId: p.pacienteId, data: p.data, forma: p.forma, observacao: p.observacao };
  const semLigacoes = { mesReferencia: null, avaliacaoId: null, sessaoIds: [] };

  switch (p.referencia) {
    case 'sessoes': {
      const ids = [...new Set(p.sessaoIds)];
      if (ids.length === 0) throw new ErroCobranca(SO_SESSOES_ABERTAS);
      const abertas = new Map(pendencias.sessoesAbertas.map((s) => [s.id, s]));
      let valorCentavos = 0;
      for (const id of ids) {
        const aberta = abertas.get(id);
        if (aberta === undefined) throw new ErroCobranca(SO_SESSOES_ABERTAS);
        valorCentavos += aberta.valorCentavos ?? 0;
      }
      return repo.registrarPagamento({ ...base, ...semLigacoes, referencia: 'sessoes', valorCentavos, sessaoIds: ids });
    }
    case 'mes': {
      const mes = `${p.mes.slice(0, 7)}-01`;
      const cobranca = pendencias.meses.find((m) => m.mes === mes);
      if (cobranca?.situacao === 'pago') throw new ErroCobranca(ERRO_MES_JA_PAGO);
      if (cobranca === undefined || cobranca.totalCentavos <= 0) throw new ErroCobranca(MES_SEM_NADA);
      return repo.registrarPagamento({
        ...base,
        ...semLigacoes,
        referencia: 'mes',
        valorCentavos: cobranca.totalCentavos,
        mesReferencia: mes,
      });
    }
    case 'avaliacao': {
      if (avaliacao === null || pendencias.avaliacao === null) throw new ErroCobranca(SEM_AVALIACAO);
      const { faltaCentavos } = pendencias.avaliacao;
      if (!Number.isInteger(p.valorCentavos) || p.valorCentavos <= 0 || p.valorCentavos > faltaCentavos) {
        throw new ErroCobranca(`O valor passa do que falta do pacote: ${formatarReais(faltaCentavos)}.`);
      }
      return repo.registrarPagamento({
        ...base,
        ...semLigacoes,
        referencia: 'avaliacao',
        valorCentavos: p.valorCentavos,
        avaliacaoId: avaliacao.id,
      });
    }
  }
}

/** Apaga o pagamento: as sessões e o mês que ele quitava voltam a ficar em aberto. */
export async function removerPagamento(repo: Repositorio, id: Id): Promise<void> {
  await repo.removerPagamento(id);
}

/**
 * Reposição da falta sem aviso na avaliação (spec §6.4): cria a sessão nova no horário dado e liga a original a
 * ela. A original continua "faltou sem aviso", e portanto cobrada à parte; o pacote ganha a sessão que faltou.
 */
export async function agendarReposicao(repo: Repositorio, sessao: Sessao, novoInicio: string): Promise<Sessao> {
  if (sessao.tipo !== 'avaliacao' || sessao.situacao !== 'falta_sem_aviso') {
    throw new ErroCobranca(SO_FALTA_NA_AVALIACAO);
  }
  const nova = await repo.criarSessao(novaSessaoDeRemarcacao(sessao, novoInicio));
  await repo.atualizarSessao(sessao.id, { remarcadaPara: nova.id });
  return nova;
}
