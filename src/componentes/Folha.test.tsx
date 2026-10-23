import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { Folha } from './Folha';

function Exemplo({ aoFechar = () => {} }: { aoFechar?: () => void }) {
  const [aberta, setAberta] = useState(false);
  const gatilho = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={gatilho} onClick={() => setAberta(true)}>
        Abrir folha
      </button>
      <Folha
        aberta={aberta}
        titulo="Ana Clara Souza"
        retornarFocoPara={gatilho}
        onFechar={() => {
          aoFechar();
          setAberta(false);
        }}
      >
        <input aria-label="Primeiro campo" />
        <button>Último botão</button>
      </Folha>
    </>
  );
}

describe('Folha', () => {
  it('fechada, não mostra nada', () => {
    render(<Folha aberta={false} titulo="Título" onFechar={() => {}}>Conteúdo</Folha>);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Conteúdo')).not.toBeInTheDocument();
  });

  it('aberta, é um diálogo modal com o título como nome', () => {
    render(<Folha aberta titulo="Ana Clara Souza" onFechar={() => {}}>Conteúdo</Folha>);

    const dialogo = screen.getByRole('dialog', { name: 'Ana Clara Souza' });
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).toHaveTextContent('Conteúdo');
  });

  it('o botão "Fechar" pede para fechar', async () => {
    const aoFechar = vi.fn();
    render(<Folha aberta titulo="T" onFechar={aoFechar}>x</Folha>);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Fechar' }));

    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('Esc pede para fechar', async () => {
    const aoFechar = vi.fn();
    render(<Folha aberta titulo="T" onFechar={aoFechar}>x</Folha>);

    await userEvent.setup().keyboard('{Escape}');

    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('o clique no fundo fecha; o clique dentro não', async () => {
    const aoFechar = vi.fn();
    render(<Folha aberta titulo="T" onFechar={aoFechar}>x</Folha>);
    const usuaria = userEvent.setup();

    await usuaria.click(screen.getByRole('dialog'));
    expect(aoFechar).not.toHaveBeenCalled();

    // O fundo escurecido é o pai do diálogo.
    await usuaria.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('travada, não fecha: Esc e toque no fundo não têm efeito e "Fechar" fica desligado', async () => {
    const aoFechar = vi.fn();
    render(<Folha aberta travada titulo="T" onFechar={aoFechar}>x</Folha>);
    const usuaria = userEvent.setup();

    await usuaria.keyboard('{Escape}');
    await usuaria.click(screen.getByRole('dialog').parentElement as HTMLElement);

    expect(aoFechar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeDisabled();
  });

  it('travada, deixa o Tab para o diálogo que está por cima dela', async () => {
    render(
      <>
        <Folha aberta travada titulo="T" onFechar={() => {}}>
          <button>Dentro da folha</button>
        </Folha>
        <button>Em outro diálogo</button>
      </>,
    );
    const outro = screen.getByRole('button', { name: 'Em outro diálogo' });
    outro.focus();
    const tecla = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });

    outro.dispatchEvent(tecla);

    expect(tecla.defaultPrevented).toBe(false);
  });

  it('ao abrir, o foco vai para dentro dela', async () => {
    render(<Exemplo />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Abrir folha' }));

    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('ao fechar, o foco volta a quem abriu, mesmo sem o foco ter passado por ele (Safari)', () => {
    render(<Exemplo />);
    const gatilho = screen.getByRole('button', { name: 'Abrir folha' });

    // fireEvent não move o foco para o botão, como um clique de mouse no Safari: o foco fica no body.
    fireEvent.click(gatilho);
    expect(document.body).not.toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(gatilho).toHaveFocus();
  });

  it('o Tab fica preso dentro dela, nos dois sentidos', async () => {
    render(<Exemplo />);
    const usuaria = userEvent.setup();
    await usuaria.click(screen.getByRole('button', { name: 'Abrir folha' }));

    // Do último elemento volta ao primeiro (o botão Fechar, que vem antes do conteúdo).
    screen.getByRole('button', { name: 'Último botão' }).focus();
    await usuaria.tab();
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();

    // Do primeiro vai ao último.
    await usuaria.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Último botão' })).toHaveFocus();
  });
});
