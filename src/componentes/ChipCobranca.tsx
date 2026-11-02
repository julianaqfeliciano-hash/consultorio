import { CalendarClock, CircleAlert, CircleCheck, type LucideIcon } from 'lucide-react';
import type { MesCobranca } from '../regras/cobranca';

type SituacaoDoMes = MesCobranca['situacao'];

const ROTULO: Record<SituacaoDoMes, string> = {
  pago: 'Pago',
  devendo: 'Devendo',
  em_andamento: 'Em andamento',
};

const ICONE: Record<SituacaoDoMes, LucideIcon> = {
  pago: CircleCheck,
  devendo: CircleAlert,
  em_andamento: CalendarClock,
};

// Como no `ChipSituacao`: fundo claro e texto em petróleo, para o contraste ficar bom e a situação não depender da cor.
const CLASSES: Record<SituacaoDoMes, string> = {
  pago: 'border-verde bg-verde-claro',
  devendo: 'border-laranja bg-laranja/30',
  em_andamento: 'border-petroleo bg-white',
};

/** A situação de cobrança do mês (Pago, Devendo ou Em andamento), sempre em texto e ícone (nunca só cor). */
export function ChipCobranca({ situacao }: { situacao: SituacaoDoMes }) {
  const Icone = ICONE[situacao];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-0.5 text-sm font-semibold ${CLASSES[situacao]}`}
    >
      <Icone aria-hidden="true" className="size-4 shrink-0" />
      {ROTULO[situacao]}
    </span>
  );
}
