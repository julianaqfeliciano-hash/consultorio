import { BarChart3, CalendarDays, Menu, Users, Wallet, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';

interface Aba {
  para: string;
  rotulo: string;
  Icone: LucideIcon;
}

const ABAS: Aba[] = [
  { para: '/agenda', rotulo: 'Agenda', Icone: CalendarDays },
  { para: '/pacientes', rotulo: 'Pacientes', Icone: Users },
  { para: '/financeiro', rotulo: 'Financeiro', Icone: Wallet },
  { para: '/relatorios', rotulo: 'Relatórios', Icone: BarChart3 },
  { para: '/mais', rotulo: 'Mais', Icone: Menu },
];

/**
 * Uma única navegação, estilizada conforme a largura da tela: barra fixa
 * embaixo no celular (< 768 px) e lista na lateral a partir de 768 px.
 */
export function BarraNavegacao() {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-10 flex bg-petroleo pb-[env(safe-area-inset-bottom)] text-creme md:static md:w-full md:flex-col md:gap-1 md:bg-transparent md:pb-0 md:text-petroleo"
    >
      {ABAS.map(({ para, rotulo, Icone }) => (
        <NavLink
          key={para}
          to={para}
          className={({ isActive }) =>
            [
              'flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold',
              'md:min-h-11 md:flex-none md:flex-row md:justify-start md:gap-3 md:rounded-lg md:px-3 md:text-base',
              isActive
                ? 'text-amarelo md:bg-petroleo md:text-creme'
                : 'text-creme/80 md:text-petroleo md:hover:bg-verde-claro/50',
            ].join(' ')
          }
        >
          <Icone aria-hidden="true" className="size-6" />
          {rotulo}
        </NavLink>
      ))}
    </nav>
  );
}
