import { useSyncExternalStore } from 'react';

const A_PARTIR_DE_768 = '(min-width: 768px)';

function assinar(avisar: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const consulta = window.matchMedia(A_PARTIR_DE_768);
  consulta.addEventListener('change', avisar);
  return () => consulta.removeEventListener('change', avisar);
}

// Sem `matchMedia` (testes, navegadores muito antigos) vale a tela grande, como em `SecaoRecolhivel`.
const larguraAtual = () => typeof window.matchMedia !== 'function' || window.matchMedia(A_PARTIR_DE_768).matches;

/** A tela tem 768 px ou mais de largura (iPad e notebook)? Acompanha a rotação e o redimensionamento. */
export function useTelaLarga(): boolean {
  return useSyncExternalStore(assinar, larguraAtual, () => true);
}
