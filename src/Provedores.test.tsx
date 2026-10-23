import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { useAutenticacao } from './dados/contexto-autenticacao';
import { useRepositorio } from './dados/contexto';
import { criarRepositorioMemoria } from './dados/memoria';
import { Provedores } from './Provedores';
import { criarAutenticacaoFalsa, USUARIA_DE_TESTE } from './testes/autenticacaoFalsa';

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

/** Mostra quem está logada, para o teste esperar a sessão ser conhecida. */
function QuemEsta() {
  const { usuario } = useAutenticacao();
  return <p>{usuario?.email ?? 'ninguém'}</p>;
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

  describe('ao sair, os dados em memória somem', () => {
    const OUTRA_USUARIA = { id: 'u-2', email: 'outra@consultorio.test' };

    /** Monta já logada, com dados de paciente no cache de consultas. */
    async function montarLogada() {
      const autenticacao = criarAutenticacaoFalsa({ usuario: USUARIA_DE_TESTE });
      render(
        <Provedores repositorio={criarRepositorioMemoria()} autenticacao={autenticacao}>
          <Sonda />
          <QuemEsta />
        </Provedores>,
      );
      await screen.findByText(USUARIA_DE_TESTE.email);
      const cliente = clientes[0];
      cliente.setQueryData(['pacientes'], [{ id: 'p1', nome: 'Ana Clara Souza' }]);
      cliente.setQueryData(['ficha', 'p1'], { nome: 'Ana Clara Souza' });
      expect(cliente.getQueryCache().getAll()).toHaveLength(2);
      return { autenticacao, cliente };
    }

    it('com dados no cache, sair esvazia o cache de consultas', async () => {
      const { autenticacao, cliente } = await montarLogada();

      await act(() => autenticacao.sair());

      expect(cliente.getQueryCache().getAll()).toHaveLength(0);
      expect(cliente.getQueryData(['pacientes'])).toBeUndefined();
    });

    it('quando outra pessoa assume a sessão sem passar por "ninguém", também esvazia', async () => {
      const { autenticacao, cliente } = await montarLogada();

      // O mesmo canal que avisa entradas e saídas: troca direta de usuária.
      const [ouvinte] = autenticacao.aoMudar.mock.calls[0];
      act(() => ouvinte(OUTRA_USUARIA));

      expect(cliente.getQueryCache().getAll()).toHaveLength(0);
    });

    it('enquanto continua a mesma usuária (ex.: token renovado), o cache fica', async () => {
      const { autenticacao, cliente } = await montarLogada();

      const [ouvinte] = autenticacao.aoMudar.mock.calls[0];
      act(() => ouvinte({ ...USUARIA_DE_TESTE }));

      expect(cliente.getQueryCache().getAll()).toHaveLength(2);
    });

    it('não esvazia só por estar sem login (nada a limpar, nada a perder)', async () => {
      const autenticacao = criarAutenticacaoFalsa();
      render(
        <Provedores repositorio={criarRepositorioMemoria()} autenticacao={autenticacao}>
          <Sonda />
          <QuemEsta />
        </Provedores>,
      );
      await screen.findByText('ninguém');
      const cliente = clientes[0];
      cliente.setQueryData(['x'], 1);

      await act(() => autenticacao.entrar('juliana@consultorio.test', 'senha-certa'));
      await screen.findByText(USUARIA_DE_TESTE.email);

      expect(cliente.getQueryData(['x'])).toBe(1);
    });
  });
});
