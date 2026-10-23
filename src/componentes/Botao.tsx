import type { ButtonHTMLAttributes } from 'react';

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `primario` (cheio) para a ação principal da tela; `secundario` (contorno) para as demais. */
  variante?: 'primario' | 'secundario';
}

const VARIANTES = {
  primario: 'bg-petroleo text-creme hover:bg-petroleo/90',
  secundario: 'border-2 border-petroleo bg-transparent text-petroleo hover:bg-verde-claro/50',
};

/** Botão com área de toque de pelo menos 44 × 44 px. `type` é `button`, a não ser que se peça `submit`. */
export function Botao({ variante = 'primario', type = 'button', className = '', ...resto }: BotaoProps) {
  return (
    <button
      type={type}
      className={[
        'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-4 py-2 font-semibold',
        'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTES[variante],
        className,
      ].join(' ')}
      {...resto}
    />
  );
}
