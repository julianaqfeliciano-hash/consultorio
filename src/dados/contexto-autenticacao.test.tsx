import { render, screen } from '@testing-library/react';
import { AutenticacaoProvider, useAutenticacao } from './contexto-autenticacao';
import { USUARIA_DE_TESTE, criarAutenticacaoFalsa } from '../testes/autenticacaoFalsa';

function Sonda() {
  const { usuario, carregando, modoDemonstracao } = useAutenticacao();
  return (
    <p>
      {carregando ? 'carregando' : (usuario?.email ?? 'ninguém')} / {modoDemonstracao ? 'demo' : 'real'}
    </p>
  );
}

describe('AutenticacaoProvider', () => {
  it('começa carregando e depois mostra quem está logada', async () => {
    render(
      <AutenticacaoProvider autenticacao={criarAutenticacaoFalsa({ usuario: USUARIA_DE_TESTE })}>
        <Sonda />
      </AutenticacaoProvider>,
    );
    expect(screen.getByText('carregando / real')).toBeInTheDocument();
    expect(await screen.findByText(`${USUARIA_DE_TESTE.email} / real`)).toBeInTheDocument();
  });

  it('sem sessão, depois de carregar, ninguém está logada', async () => {
    render(
      <AutenticacaoProvider autenticacao={criarAutenticacaoFalsa()}>
        <Sonda />
      </AutenticacaoProvider>,
    );
    expect(await screen.findByText('ninguém / real')).toBeInTheDocument();
  });

  it('usa o usuarioInicial da implementação, sem passar por "carregando"', () => {
    render(
      <AutenticacaoProvider
        autenticacao={{ ...criarAutenticacaoFalsa(), usuarioInicial: USUARIA_DE_TESTE }}
        modoDemonstracao
      >
        <Sonda />
      </AutenticacaoProvider>,
    );
    expect(screen.getByText(`${USUARIA_DE_TESTE.email} / demo`)).toBeInTheDocument();
  });

  it('erro ao descobrir a sessão conta como "ninguém logada"', async () => {
    const autenticacao = {
      ...criarAutenticacaoFalsa(),
      usuarioAtual: () => Promise.reject(new Error('falhou')),
    };
    render(
      <AutenticacaoProvider autenticacao={autenticacao}>
        <Sonda />
      </AutenticacaoProvider>,
    );
    expect(await screen.findByText('ninguém / real')).toBeInTheDocument();
  });

  it('para de ouvir as mudanças quando sai da tela', () => {
    const autenticacao = criarAutenticacaoFalsa();
    const cancelar = vi.fn();
    autenticacao.aoMudar.mockReturnValueOnce(cancelar);
    const { unmount } = render(
      <AutenticacaoProvider autenticacao={autenticacao}>
        <Sonda />
      </AutenticacaoProvider>,
    );
    expect(cancelar).not.toHaveBeenCalled();
    unmount();
    expect(cancelar).toHaveBeenCalledTimes(1);
  });

  it('useAutenticacao fora do provedor avisa do erro de uso', () => {
    const erroOriginal = console.error;
    console.error = () => {}; // o React também registra o erro lançado; aqui é esperado
    try {
      expect(() => render(<Sonda />)).toThrow('useAutenticacao precisa ser usado dentro de <AutenticacaoProvider>.');
    } finally {
      console.error = erroOriginal;
    }
  });
});
