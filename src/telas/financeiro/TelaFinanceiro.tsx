import { ListaAReceber } from './ListaAReceber';
import { ListaPagamentos } from './ListaPagamentos';

/** O financeiro (spec §4.3): quem deve e os pagamentos recebidos em cada mês. */
export function TelaFinanceiro() {
  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <h1 className="text-3xl">Financeiro</h1>
      <ListaAReceber />
      <ListaPagamentos />
      <p className="text-sm">Despesas, recibos e relatórios chegam numa próxima etapa.</p>
    </div>
  );
}
