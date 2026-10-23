import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { CONFIGURACOES_PADRAO } from '../dominio/padroes';
import { Provedores } from '../Provedores';
import { criarRepositorioMemoria } from './memoria';
import type { Repositorio } from './repositorio';
import { useConfiguracoes } from './useConfiguracoes';

function montar(repositorio: Repositorio) {
  const Envoltorio = ({ children }: { children: ReactNode }) => (
    <Provedores repositorio={repositorio} semNovasTentativas>
      {children}
    </Provedores>
  );
  return renderHook(() => useConfiguracoes(), { wrapper: Envoltorio });
}

describe('useConfiguracoes', () => {
  it('enquanto carrega, devolve os padrões e carregando = true', async () => {
    const { result } = montar(criarRepositorioMemoria());

    expect(result.current.carregando).toBe(true);
    expect(result.current.config).toEqual(CONFIGURACOES_PADRAO);
    await waitFor(() => expect(result.current.carregando).toBe(false));
  });

  it('primeiro acesso (repositório devolve null): grava e devolve os padrões', async () => {
    const repositorio = criarRepositorioMemoria();
    const { result } = montar(repositorio);

    await waitFor(() => expect(result.current.carregando).toBe(false));

    expect(result.current.config).toEqual(CONFIGURACOES_PADRAO);
    expect(result.current.erro).toBe(false);
    expect(await repositorio.obterConfiguracoes()).toEqual(CONFIGURACOES_PADRAO);
  });

  it('já existindo configurações, devolve as gravadas e não grava nada', async () => {
    const gravadas = { ...CONFIGURACOES_PADRAO, duracaoPadraoMin: 40 };
    const base = criarRepositorioMemoria({ configuracoes: gravadas });
    const repositorio = { ...base, salvarConfiguracoes: vi.fn(base.salvarConfiguracoes) };
    const { result } = montar(repositorio);

    await waitFor(() => expect(result.current.carregando).toBe(false));

    expect(result.current.config).toEqual(gravadas);
    expect(repositorio.salvarConfiguracoes).not.toHaveBeenCalled();
  });

  it('falha ao ler: erro = true, e os padrões NÃO são gravados por cima', async () => {
    const base = criarRepositorioMemoria();
    const repositorio = {
      ...base,
      obterConfiguracoes: vi.fn().mockRejectedValue(new Error('sem rede')),
      salvarConfiguracoes: vi.fn(),
    };
    const { result } = montar(repositorio);

    await waitFor(() => expect(result.current.erro).toBe(true));

    expect(result.current.carregando).toBe(false);
    expect(repositorio.salvarConfiguracoes).not.toHaveBeenCalled();
  });

  it('vários componentes pedindo ao mesmo tempo gravam os padrões uma única vez', async () => {
    const base = criarRepositorioMemoria();
    const repositorio = { ...base, salvarConfiguracoes: vi.fn(base.salvarConfiguracoes) };
    const Envoltorio = ({ children }: { children: ReactNode }) => (
      <Provedores repositorio={repositorio} semNovasTentativas>
        {children}
      </Provedores>
    );
    const { result } = renderHook(() => [useConfiguracoes(), useConfiguracoes()], { wrapper: Envoltorio });

    await waitFor(() => expect(result.current[1].carregando).toBe(false));

    expect(repositorio.salvarConfiguracoes).toHaveBeenCalledTimes(1);
  });
});
