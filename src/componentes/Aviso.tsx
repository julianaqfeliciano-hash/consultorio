import { CircleAlert, CircleCheck, Info, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type TipoAviso = 'erro' | 'atencao' | 'sucesso';

interface AvisoProps {
  /**
   * `erro` interrompe a leitura (`role="alert"`). `atencao` pede atenção para algo que ela precisa saber, mas que
   * não é falha de nada (uma diferença no mês, um valor zerado), e `sucesso` só informa: os dois com `role="status"`.
   */
  tipo: TipoAviso;
  children: ReactNode;
}

const ICONE: Record<TipoAviso, LucideIcon> = { erro: CircleAlert, atencao: Info, sucesso: CircleCheck };
const FUNDO: Record<TipoAviso, string> = { erro: 'bg-amarelo/30', atencao: 'bg-amarelo/30', sucesso: 'bg-verde-claro/60' };

/** Recado de um formulário ou de uma seção: sempre com ícone e texto, nunca só cor. */
export function Aviso({ tipo, children }: AvisoProps) {
  const Icone = ICONE[tipo];
  return (
    <p
      role={tipo === 'erro' ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-lg p-3 font-semibold ${FUNDO[tipo]}`}
    >
      <Icone aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      {children}
    </p>
  );
}
