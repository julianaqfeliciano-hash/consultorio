import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { criarRepositorioMemoria } from '../dados/memoria';
import type { Repositorio } from '../dados/repositorio';
import { sementeDemo } from '../dados/semente-demo';
import { renderComRotas } from './utilitarios';

/** "Hoje" dos testes de pacientes: segunda-feira, 02/11/2026 (os fatos da semente demo valem para este dia). */
export const HOJE = '2026-11-02';

export const ANA = 'demo-paciente-ana';
export const PEDRO = 'demo-paciente-pedro';
export const MARIA = 'demo-paciente-maria';
export const LUCAS = 'demo-paciente-lucas';

/**
 * Fixa o relógio em HOJE, meio-dia em São Paulo. Só `Date` é falso: os temporizadores
 * seguem reais, então `waitFor` e o `userEvent` funcionam normalmente.
 */
export function usarHojeFixo() {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-02T12:00:00-03:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}

/** Repositório em memória com a semente demo (Ana, Pedro, Maria e Lucas) calculada para HOJE. */
export function repositorioDemo(): Repositorio {
  return criarRepositorioMemoria(sementeDemo(HOJE));
}

/** Abre a ficha do paciente `id`. Devolve também o repositório e a `usuaria` (userEvent). */
export function abrirFicha(id: string, repositorio: Repositorio = repositorioDemo()) {
  return { ...renderComRotas(`/pacientes/${id}`, { repositorio }), usuaria: userEvent.setup() };
}

/** Uma seção da ficha, pelo título (`region` com esse nome). */
export function secao(nome: string): HTMLElement {
  return screen.getByRole('region', { name: nome });
}
