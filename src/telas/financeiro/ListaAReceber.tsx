import { ChevronRight } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router';
import { FalhaAoCarregar } from '../../componentes/FalhaAoCarregar';
import { useAReceber } from '../../dados/useCobranca';
import { formatarData } from '../../regras/datas';
import { formatarReais } from '../../regras/dinheiro';

/**
 * Quem deve, quanto e desde quando (spec §4.3 e §9.1: tudo o que está em aberto, de qualquer mês). Cada linha leva à
 * ficha do paciente, onde a seção Financeiro registra o pagamento.
 */
export function ListaAReceber() {
  const idTitulo = useId();
  const aReceber = useAReceber();
  const itens = aReceber.data;
  const totalCentavos = (itens ?? []).reduce((total, i) => total + i.totalCentavos, 0);

  return (
    <section aria-labelledby={idTitulo} className="flex flex-col gap-3">
      <h2 id={idTitulo} className="text-xl">
        A receber
      </h2>
      {itens === undefined ? (
        aReceber.isError ? (
          <FalhaAoCarregar
            mensagem="Não foi possível carregar o que há a receber."
            aoTentarDeNovo={() => void aReceber.refetch()}
          />
        ) : (
          <p role="status">Carregando…</p>
        )
      ) : itens.length === 0 ? (
        <p>Ninguém está devendo.</p>
      ) : (
        <>
          <p className="text-lg font-bold">{`Total a receber: ${formatarReais(totalCentavos)}`}</p>
          <ul className="flex flex-col gap-2">
            {itens.map(({ paciente, totalCentavos: valor, desde }) => (
              <li key={paciente.id}>
                <Link
                  to={`/pacientes/${paciente.id}`}
                  className="flex min-h-14 items-center gap-3 rounded-lg border-2 border-verde-claro bg-white px-4 py-3 hover:bg-verde-claro/50"
                >
                  <span className="flex flex-1 flex-col">
                    <span className="font-semibold">{paciente.nome}</span>{' '}
                    {desde !== null && <span className="text-sm">{`desde ${formatarData(desde)}`}</span>}
                  </span>{' '}
                  <span className="font-bold">{formatarReais(valor)}</span>
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
