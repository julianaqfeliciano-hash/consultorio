import { ICONE_SITUACAO, ROTULO_SITUACAO } from '../dominio/rotulos';
import type { SituacaoSessao } from '../dominio/tipos';

// Fundos claros (tons da marca) com o texto em petróleo: o contraste fica bom e a situação não depende só da cor.
const CLASSES: Record<SituacaoSessao, string> = {
  agendada: 'border-petroleo bg-white',
  compareceu: 'border-verde bg-verde-claro',
  falta_com_aviso: 'border-amarelo bg-amarelo/30',
  falta_sem_aviso: 'border-laranja bg-laranja/30',
  cancelada: 'border-petroleo/40 bg-creme',
  remarcada: 'border-azul-claro bg-azul-claro/30',
};

/** A situação da sessão sempre em texto e ícone (nunca só cor). */
export function ChipSituacao({ situacao }: { situacao: SituacaoSessao }) {
  const Icone = ICONE_SITUACAO[situacao];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-0.5 text-sm font-semibold ${CLASSES[situacao]}`}
    >
      <Icone aria-hidden="true" className="size-4 shrink-0" />
      {ROTULO_SITUACAO[situacao]}
    </span>
  );
}
