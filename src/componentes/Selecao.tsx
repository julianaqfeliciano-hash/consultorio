import { CircleAlert } from 'lucide-react';
import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';

interface SelecaoProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  /** Rótulo sempre visível. */
  rotulo: string;
  /** Dica fixa sob o rótulo. Fica ligada ao campo por `aria-describedby`. */
  ajuda?: ReactNode;
  /** Mensagem de erro: aparece com ícone e texto e fica ligada ao campo por `aria-describedby`. */
  erro?: string;
}

/** Lista de opções (`<option>` como filhos) com o mesmo visual e as mesmas ligações de acessibilidade de `Campo`. */
export function Selecao({ rotulo, ajuda, erro, className = '', children, ...resto }: SelecaoProps) {
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
      <select
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao || undefined}
        className={[
          'min-h-11 rounded-lg border-2 border-petroleo bg-white px-3 py-2 text-petroleo',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo',
          className,
        ].join(' ')}
        {...resto}
      >
        {children}
      </select>
      {erro && (
        <p id={idErro} role="alert" className="flex items-start gap-2 text-sm font-semibold">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </div>
  );
}
