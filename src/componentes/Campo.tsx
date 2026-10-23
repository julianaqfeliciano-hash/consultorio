import { CircleAlert } from 'lucide-react';
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

interface CampoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  /** Rótulo sempre visível (nunca só `placeholder`). */
  rotulo: string;
  /** Dica fixa sob o rótulo (unidade, formato). Fica ligada ao campo por `aria-describedby`. */
  ajuda?: ReactNode;
  /** Mensagem de erro do campo: aparece com ícone e texto e fica ligada ao campo por `aria-describedby`. */
  erro?: string;
}

/** Campo de texto com rótulo visível e altura mínima de 44 px. */
export function Campo({ rotulo, ajuda, erro, className = '', ...resto }: CampoProps) {
  const id = useId();
  const idAjuda = `${id}-ajuda`;
  const idErro = `${id}-erro`;
  const descricao = [ajuda ? idAjuda : '', erro ? idErro : ''].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold">
        {rotulo}
      </label>
      {ajuda && (
        <p id={idAjuda} className="text-sm">
          {ajuda}
        </p>
      )}
      <input
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao || undefined}
        className={[
          'min-h-11 rounded-lg border-2 border-petroleo bg-white px-3 py-2 text-petroleo',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo',
          className,
        ].join(' ')}
        {...resto}
      />
      {erro && (
        <p id={idErro} role="alert" className="flex items-start gap-2 text-sm font-semibold">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </div>
  );
}
