import type { DataISO, FormaPagamento } from '../dominio/tipos';
import { lerReais } from './dinheiro';
import type { Resultado } from './formularios';

/**
 * Validação do formulário de pagamento. Como em `formularios.ts`: devolve os avisos (por campo) ou os dados
 * prontos para gravar; nunca os dois.
 */

export interface ValoresPagamento {
  data: DataISO | '';
  forma: FormaPagamento;
  observacao: string;
  /** O valor como digitado ('500', '1.250,50'). Só conta quando o valor é editável. */
  valor: string;
}

export interface DadosPagamento {
  data: DataISO;
  forma: FormaPagamento;
  observacao: string | null;
  /** Só quando a pessoa digita o valor (parcela da avaliação). Nos demais, o valor sai dos valores guardados. */
  valorCentavos?: number;
}

export type ErrosPagamento = Partial<Record<'data' | 'valor', string>>;

export function validarPagamento(v: ValoresPagamento, valorEditavel: boolean): Resultado<ErrosPagamento, DadosPagamento> {
  const erros: ErrosPagamento = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.data)) erros.data = 'Informe a data do pagamento.';

  let valorCentavos: number | undefined;
  if (valorEditavel) {
    const lido = lerReais(v.valor);
    if (lido === null || lido <= 0) erros.valor = 'Informe um valor maior que zero, como 500 ou 500,50.';
    else valorCentavos = lido;
  }
  if (Object.keys(erros).length > 0 || v.data === '') return { erros, dados: null };

  const observacao = v.observacao.trim();
  const dados: DadosPagamento = { data: v.data, forma: v.forma, observacao: observacao === '' ? null : observacao };
  if (valorCentavos !== undefined) dados.valorCentavos = valorCentavos;
  return { erros: {}, dados };
}
