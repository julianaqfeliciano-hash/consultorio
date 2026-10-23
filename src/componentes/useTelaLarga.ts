import { useSyncExternalStore } from 'react';

const A_PARTIR_DE_1024 = '(min-width: 1024px)';

function assinar(avisar: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const consulta = window.matchMedia(A_PARTIR_DE_1024);
  consulta.addEventListener('change', avisar);
  return () => consulta.removeEventListener('change', avisar);
}

// Sem `matchMedia` (testes, navegadores muito antigos) vale a tela grande, como em `SecaoRecolhivel`.
const larguraAtual = () => typeof window.matchMedia !== 'function' || window.matchMedia(A_PARTIR_DE_1024).matches;

/**
 * A tela tem 1024 px ou mais de largura (notebook e iPad na horizontal)? Só aí cabem as colunas da semana;
 * abaixo disso (celular e iPad na vertical) a agenda mostra um dia por vez. Acompanha a rotação e o redimensionamento.
 */
export function useTelaLarga(): boolean {
  return useSyncExternalStore(assinar, larguraAtual, () => true);
}
