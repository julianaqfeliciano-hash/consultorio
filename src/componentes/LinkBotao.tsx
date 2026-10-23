import { Link, type LinkProps } from 'react-router';
import { classesDoBotao, type VarianteBotao } from './estiloBotao';

interface LinkBotaoProps extends LinkProps {
  variante?: VarianteBotao;
}

/** Link para outra tela com a cara de um botão (navegar é link; agir é botão). */
export function LinkBotao({ variante = 'primario', className = '', ...resto }: LinkBotaoProps) {
  return <Link className={classesDoBotao(variante, className)} {...resto} />;
}
