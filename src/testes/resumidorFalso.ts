import type { Resumidor } from '../dados/resumidor';

/** Resumidor dos testes: devolve campos fixos, sem rede. Os testes que precisam de outro passam o seu. */
export function resumidorFalso(): Resumidor {
  return {
    resumir: vi.fn(async () => ({
      comoChegou: 'Chegou bem.',
      trabalhado: 'Brincadeira livre.',
      observacoes: 'Sem observações.',
      proximosPassos: 'Retomar na próxima.',
    })),
  };
}
