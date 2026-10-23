export type VarianteBotao = 'primario' | 'secundario';

const VARIANTES: Record<VarianteBotao, string> = {
  primario: 'bg-petroleo text-creme hover:bg-petroleo/90',
  secundario: 'border-2 border-petroleo bg-transparent text-petroleo hover:bg-verde-claro/50',
};

/** O visual do botão (área de toque de pelo menos 44 × 44 px), também usado por `LinkBotao`. */
export function classesDoBotao(variante: VarianteBotao = 'primario', className = ''): string {
  return [
    'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-4 py-2 font-semibold',
    'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo',
    'disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTES[variante],
    className,
  ].join(' ');
}
