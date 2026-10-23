import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { useRepositorio } from './dados/contexto';
import { criarRepositorioMemoria } from './dados/memoria';
import { Provedores } from './Provedores';

const clientes: QueryClient[] = [];

/** Mostra que o repositório chegou e guarda o QueryClient recebido. */
function Sonda() {
  const repo = useRepositorio();
  const cliente = useQueryClient();
  useEffect(() => {
    clientes.push(cliente);
  }, [cliente]);
  return <p>{typeof repo.listarPacientes}</p>;
}

describe('Provedores', () => {
  beforeEach(() => {
    clientes.length = 0;
  });

  it('dá aos filhos o repositório e um QueryClient', () => {
    render(
      <Provedores repositorio={criarRepositorioMemoria()}>
        <Sonda />
      </Provedores>,
    );
    expect(screen.getByText('function')).toBeInTheDocument();
    expect(clientes).toHaveLength(1);
  });

  it('cada montagem ganha um QueryClient novo (testes não compartilham cache)', () => {
    const repo = criarRepositorioMemoria();
    const primeira = render(
      <Provedores repositorio={repo}>
        <Sonda />
      </Provedores>,
    );
    primeira.unmount();
    render(
      <Provedores repositorio={repo}>
        <Sonda />
      </Provedores>,
    );
    expect(clientes).toHaveLength(2);
    expect(clientes[0]).not.toBe(clientes[1]);
  });

  it('semNovasTentativas desliga as tentativas automáticas', () => {
    render(
      <Provedores repositorio={criarRepositorioMemoria()} semNovasTentativas>
        <Sonda />
      </Provedores>,
    );
    expect(clientes[0].getDefaultOptions().queries?.retry).toBe(false);
    expect(clientes[0].getDefaultOptions().mutations?.retry).toBe(false);
  });

  it('por padrão mantém as tentativas automáticas do TanStack Query', () => {
    render(
      <Provedores repositorio={criarRepositorioMemoria()}>
        <Sonda />
      </Provedores>,
    );
    expect(clientes[0].getDefaultOptions().queries?.retry).toBeUndefined();
  });
});
