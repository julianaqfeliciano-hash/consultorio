import type { ComponentProps } from 'react';
import { classesDoBotao, type VarianteBotao } from './estiloBotao';

interface BotaoProps extends ComponentProps<'button'> {
  /** `primario` (cheio) para a ação principal da tela; `secundario` (contorno) para as demais. */
  variante?: VarianteBotao;
}

/** Botão com área de toque de pelo menos 44 × 44 px. `type` é `button`, a não ser que se peça `submit`. */
export function Botao({ variante = 'primario', type = 'button', className = '', ...resto }: BotaoProps) {
  return <button type={type} className={classesDoBotao(variante, className)} {...resto} />;
}
