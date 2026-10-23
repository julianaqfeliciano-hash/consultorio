import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErroAutenticacao, type Autenticacao } from '../../dados/autenticacao';
import { CREDENCIAIS_DE_TESTE, criarAutenticacaoFalsa, USUARIA_DE_TESTE } from '../../testes/autenticacaoFalsa';
import { renderComRotas } from '../../testes/utilitarios';

async function preencherEEnviar(email: string, senha: string) {
  const usuaria = userEvent.setup();
  if (email) await usuaria.type(await screen.findByLabelText('E-mail'), email);
  if (senha) await usuaria.type(screen.getByLabelText('Senha'), senha);
  await usuaria.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('TelaLogin', () => {
  it('mostra a logo completa, os campos E-mail e Senha e o botão Entrar', async () => {
    const { container } = renderComRotas('/entrar', { autenticacao: criarAutenticacaoFalsa() });

    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    // Logo completa: símbolo + nome + especialidade.
    expect(container.querySelector('img[src="/marca/logo.svg"]')).not.toBeNull();
    expect(screen.getByText('Juliana Feliciano')).toBeInTheDocument();
    expect(screen.getByText('PSICÓLOGA INFANTIL')).toBeInTheDocument();
    // Tela de entrada não tem a navegação do sistema.
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('credenciais erradas mostram "E-mail ou senha incorretos." e mantêm o e-mail digitado', async () => {
    renderComRotas('/entrar', { autenticacao: criarAutenticacaoFalsa() });

    await preencherEEnviar('juliana@consultorio.test', 'senha-errada');

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
    expect(screen.getByLabelText('E-mail')).toHaveValue('juliana@consultorio.test');
    // Continua na tela de entrada, com o botão de novo disponível.
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  it('falha de rede mostra a mensagem de falta de conexão', async () => {
    const autenticacao: Autenticacao = {
      ...criarAutenticacaoFalsa(),
      entrar: async () => {
        throw new ErroAutenticacao('Sem conexão. Verifique a internet e tente de novo.');
      },
    };
    renderComRotas('/entrar', { autenticacao });

    await preencherEEnviar('juliana@consultorio.test', 'qualquer');

    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão. Verifique a internet e tente de novo.');
  });

  it('sucesso leva para a Agenda', async () => {
    const autenticacao = criarAutenticacaoFalsa();
    renderComRotas('/entrar', { autenticacao });

    await preencherEEnviar(CREDENCIAIS_DE_TESTE.email, CREDENCIAIS_DE_TESTE.senha);

    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
    expect(autenticacao.entrar).toHaveBeenCalledWith(CREDENCIAIS_DE_TESTE.email, CREDENCIAIS_DE_TESTE.senha);
  });

  it('tira os espaços das pontas do e-mail antes de enviar', async () => {
    const autenticacao = criarAutenticacaoFalsa();
    renderComRotas('/entrar', { autenticacao });

    await preencherEEnviar(`  ${CREDENCIAIS_DE_TESTE.email} `, CREDENCIAIS_DE_TESTE.senha);

    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
    expect(autenticacao.entrar).toHaveBeenCalledWith(CREDENCIAIS_DE_TESTE.email, CREDENCIAIS_DE_TESTE.senha);
  });

  it('campos vazios mostram o aviso ligado ao campo por aria-describedby e não chamam o login', async () => {
    const autenticacao = criarAutenticacaoFalsa();
    renderComRotas('/entrar', { autenticacao });

    await preencherEEnviar('', '');

    const email = screen.getByLabelText('E-mail');
    const senha = screen.getByLabelText('Senha');
    expect(email).toHaveAccessibleDescription('Digite seu e-mail.');
    expect(senha).toHaveAccessibleDescription('Digite sua senha.');
    expect(email).toBeInvalid();
    expect(autenticacao.entrar).not.toHaveBeenCalled();
  });

  it('quem já está logada e abre /entrar vai direto para a Agenda', async () => {
    renderComRotas('/entrar', { autenticacao: criarAutenticacaoFalsa({ usuario: USUARIA_DE_TESTE }) });

    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
  });
});

describe('ExigeLogin', () => {
  it('sem login, /pacientes manda para /entrar e, depois de entrar, volta para /pacientes', async () => {
    renderComRotas('/pacientes', { autenticacao: criarAutenticacaoFalsa() });

    // Foi barrada: a tela de entrada aparece e as telas do sistema, não.
    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pacientes' })).not.toBeInTheDocument();

    await preencherEEnviar(CREDENCIAIS_DE_TESTE.email, CREDENCIAIS_DE_TESTE.senha);

    expect(await screen.findByRole('heading', { name: 'Pacientes' })).toBeInTheDocument();
  });

  it('enquanto confere se há sessão, mostra "Carregando…" e não manda para /entrar', async () => {
    const autenticacao: Autenticacao = {
      ...criarAutenticacaoFalsa(),
      usuarioAtual: () => new Promise(() => {}),
    };
    renderComRotas('/pacientes', { autenticacao });

    expect(await screen.findByRole('status')).toHaveTextContent('Carregando…');
    expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pacientes' })).not.toBeInTheDocument();
  });

  it('com login, mostra a tela pedida', async () => {
    renderComRotas('/pacientes', { autenticacao: criarAutenticacaoFalsa({ usuario: USUARIA_DE_TESTE }) });

    expect(await screen.findByRole('heading', { name: 'Pacientes' })).toBeInTheDocument();
  });

  it('se a sessão acaba com a tela aberta, volta para /entrar', async () => {
    const autenticacao = criarAutenticacaoFalsa({ usuario: USUARIA_DE_TESTE });
    renderComRotas('/agenda', { autenticacao });
    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument();

    await autenticacao.sair();

    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument();
  });
});

describe('Sair (aba Mais)', () => {
  it('"Sair" encerra a sessão e volta para /entrar', async () => {
    const autenticacao = criarAutenticacaoFalsa({ usuario: USUARIA_DE_TESTE });
    renderComRotas('/mais', { autenticacao });
    const usuaria = userEvent.setup();

    await usuaria.click(await screen.findByRole('button', { name: 'Sair' }));

    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument();
    expect(autenticacao.sair).toHaveBeenCalledTimes(1);
  });

  it('se não conseguir sair, avisa e continua logada', async () => {
    const autenticacao: Autenticacao = {
      ...criarAutenticacaoFalsa({ usuario: USUARIA_DE_TESTE }),
      sair: async () => {
        throw new ErroAutenticacao('Sem conexão. Verifique a internet e tente de novo.');
      },
    };
    renderComRotas('/mais', { autenticacao });
    const usuaria = userEvent.setup();

    await usuaria.click(await screen.findByRole('button', { name: 'Sair' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão. Verifique a internet e tente de novo.');
    expect(screen.getByRole('heading', { name: 'Mais' })).toBeInTheDocument();
  });

  it('no modo demonstração não há o que sair, então o botão não aparece', async () => {
    renderComRotas('/mais', { modoDemonstracao: true });

    expect(await screen.findByRole('heading', { name: 'Mais' })).toBeInTheDocument();
    expect(within(screen.getByRole('main')).queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument();
  });
});
