import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Botao } from '../../componentes/Botao';
import type { DataISO } from '../../dominio/tipos';
import { formatarData, somarDias } from '../../regras/datas';

interface NavegacaoSemanaProps {
  /** A segunda-feira da semana mostrada. */
  inicioSemana: DataISO;
  aoMudar: (semanas: -1 | 1) => void;
}

/** Ex.: '02/11' (dia e mês, sem o ano). */
const diaEMes = (d: DataISO) => formatarData(d).slice(0, 5);

/** Setas "Semana anterior" / "Próxima semana" e o período mostrado, como "02/11–08/11". */
export function NavegacaoSemana({ inicioSemana, aoMudar }: NavegacaoSemanaProps) {
  const fim = somarDias(inicioSemana, 6);
  const anoInicial = inicioSemana.slice(0, 4);
  const anoFinal = fim.slice(0, 4);
  return (
    <div className="flex items-center justify-between gap-3">
      <Botao variante="secundario" aria-label="Semana anterior" onClick={() => aoMudar(-1)}>
        <ChevronLeft aria-hidden="true" className="size-6" />
      </Botao>
      <p aria-live="polite" className="flex flex-col items-center leading-tight">
        <span className="text-xl font-bold">{`${diaEMes(inicioSemana)}–${diaEMes(fim)}`}</span>
        <span className="text-sm">{anoInicial === anoFinal ? anoInicial : `${anoInicial}–${anoFinal}`}</span>
      </p>
      <Botao variante="secundario" aria-label="Próxima semana" onClick={() => aoMudar(1)}>
        <ChevronRight aria-hidden="true" className="size-6" />
      </Botao>
    </div>
  );
}
