import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

interface CaixaDeMarcarProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Texto ao lado da caixa. Quem toca no texto também marca. */
  rotulo: string;
  /** Dica sob a caixa, ligada a ela por `aria-describedby` (fica fora do rótulo para não entrar no nome). */
  ajuda?: ReactNode;
}

/** Caixa de marcar com área de toque de 44 px. */
export function CaixaDeMarcar({ rotulo, ajuda, className = '', ...resto }: CaixaDeMarcarProps) {
  const idAjuda = useId();
  return (
    <div className={className}>
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          aria-describedby={ajuda ? idAjuda : undefined}
          className="size-5 shrink-0 accent-petroleo"
          {...resto}
        />
        {rotulo}
      </label>
      {ajuda && (
        <p id={idAjuda} className="pl-8 text-sm">
          {ajuda}
        </p>
      )}
    </div>
  );
}
