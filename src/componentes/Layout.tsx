import { Outlet } from 'react-router';
import { BarraNavegacao } from './BarraNavegacao';
import { FaixaDemonstracao } from './FaixaDemonstracao';
import { Logo } from './Logo';

/**
 * Rota-mãe: logo e navegação ficam no mesmo cabeçalho. No celular ele é a
 * faixa do topo (a navegação desce para a barra inferior); a partir de
 * 768 px vira a barra lateral, com a logo no topo. No modo demonstração, a faixa
 * amarela de aviso fica acima de tudo (ao lado da barra lateral, no desktop).
 */
export function Layout() {
  return (
    <div className="min-h-dvh md:pl-64">
      <FaixaDemonstracao />
      <header className="flex items-center border-b border-verde-claro px-4 py-2 md:fixed md:inset-y-0 md:left-0 md:w-64 md:flex-col md:items-start md:gap-6 md:border-r md:border-b-0 md:px-4 md:py-6">
        <Logo variante="completa" />
        <BarraNavegacao />
      </header>
      <main className="px-4 py-6 pb-24 md:px-8 md:pb-8">
        <Outlet />
      </main>
    </div>
  );
}
