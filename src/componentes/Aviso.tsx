import { CircleAlert, CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';

interface AvisoProps {
  /** `erro` interrompe a leitura (`role="alert"`); `sucesso` só informa (`role="status"`). */
  tipo: 'erro' | 'sucesso';
  children: ReactNode;
}

/** Recado de um formulário: sempre com ícone e texto, nunca só cor. */
export function Aviso({ tipo, children }: AvisoProps) {
  const Icone = tipo === 'erro' ? CircleAlert : CircleCheck;
  return (
    <p
      role={tipo === 'erro' ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-lg p-3 font-semibold ${tipo === 'erro' ? 'bg-amarelo/30' : 'bg-verde-claro/60'}`}
    >
      <Icone aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      {children}
    </p>
  );
}
