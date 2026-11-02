import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';
import { Botao } from '../../componentes/Botao';
import { FalhaAoCarregar } from '../../componentes/FalhaAoCarregar';
import { usePagamentosDoMes } from '../../dados/useCobranca';
import { usePacientes } from '../../dados/usePacientes';
import { ROTULO_FORMA } from '../../dominio/rotulos';
import type { DataISO } from '../../dominio/tipos';
import { mesPorExtenso } from '../../regras/cobranca';
import { formatarData, hojeISO, somarMeses } from '../../regras/datas';
import { formatarReais } from '../../regras/dinheiro';

/** O mês de hoje, como o dia 1 ('2026-11-01'). */
const mesDeHoje = (): DataISO => `${hojeISO().slice(0, 7)}-01`;

/**
 * Os pagamentos de um mês e o total recebido nele (spec §9.1: "Recebido no mês", a soma dos pagamentos com data no
 * mês). Abre no mês de hoje; as setas andam de mês em mês.
 */
export function ListaPagamentos() {
  const idTitulo = useId();
  const [mes, setMes] = useState<DataISO>(mesDeHoje);
  const pagamentos = usePagamentosDoMes(mes);
  const pacientes = usePacientes();

  const nomes = new Map((pacientes.data ?? []).map((p) => [p.id, p.nome]));
  const doMes = pagamentos.data;
  const recebidoCentavos = (doMes ?? []).reduce((total, p) => total + p.valorCentavos, 0);

  function tentarDeNovo() {
    if (pagamentos.isError) void pagamentos.refetch();
    if (pacientes.isError) void pacientes.refetch();
  }

  return (
    <section aria-labelledby={idTitulo} className="flex flex-col gap-3">
      <h2 id={idTitulo} className="text-xl">
        Pagamentos
      </h2>
      <div className="flex items-center justify-between gap-3">
        <Botao variante="secundario" aria-label="Mês anterior" onClick={() => setMes((m) => somarMeses(m, -1))}>
          <ChevronLeft aria-hidden="true" className="size-6" />
        </Botao>
        <p aria-live="polite" className="text-xl font-bold">
          {mesPorExtenso(mes)}
        </p>
        <Botao variante="secundario" aria-label="Próximo mês" onClick={() => setMes((m) => somarMeses(m, 1))}>
          <ChevronRight aria-hidden="true" className="size-6" />
        </Botao>
      </div>
      {doMes === undefined || pacientes.data === undefined ? (
        pagamentos.isError || pacientes.isError ? (
          <FalhaAoCarregar mensagem="Não foi possível carregar os pagamentos." aoTentarDeNovo={tentarDeNovo} />
        ) : (
          <p role="status">Carregando…</p>
        )
      ) : (
        <>
          {doMes.length === 0 ? (
            <p>Nenhum pagamento neste mês.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {doMes.map((p) => (
                <li
                  key={p.id}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-lg border-2 border-verde-claro bg-white px-4 py-3"
                >
                  <span>{`${formatarData(p.data)} · ${nomes.get(p.pacienteId) ?? 'Paciente'} · ${ROTULO_FORMA[p.forma]}`}</span>{' '}
                  <span className="font-bold">{formatarReais(p.valorCentavos)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-lg font-bold">{`Recebido no mês: ${formatarReais(recebidoCentavos)}`}</p>
        </>
      )}
    </section>
  );
}
