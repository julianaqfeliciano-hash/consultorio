import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { DialogoConfirmacao } from './DialogoConfirmacao';

function montar(sobre: Partial<Parameters<typeof DialogoConfirmacao>[0]> = {}) {
  const aoConfirmar = vi.fn();
  const aoCancelar = vi.fn();
  render(
    <DialogoConfirmacao
      titulo="Apagar isto?"
      mensagem="Não dá para desfazer."
      rotuloConfirmar="Apagar"
      aoConfirmar={aoConfirmar}
      aoCancelar={aoCancelar}
      {...sobre}
    />,
  );
  return { aoConfirmar, aoCancelar };
}

describe('DialogoConfirmacao', () => {
  it('é um diálogo modal com título e mensagem, e o foco começa em "Cancelar" (o lado seguro)', () => {
    montar();

    const dialogo = screen.getByRole('dialog', { name: 'Apagar isto?' });
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).toHaveAccessibleDescription('Não dá para desfazer.');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('o botão de confirmar chama aoConfirmar; Cancelar e Esc chamam aoCancelar', async () => {
    const { aoConfirmar, aoCancelar } = montar();
    const usuaria = userEvent.setup();

    await usuaria.click(screen.getByRole('button', { name: 'Apagar' }));
    expect(aoConfirmar).toHaveBeenCalledTimes(1);

    await usuaria.click(screen.getByRole('button', { name: 'Cancelar' }));
    await usuaria.keyboard('{Escape}');
    expect(aoCancelar).toHaveBeenCalledTimes(2);
    expect(aoConfirmar).toHaveBeenCalledTimes(1);
  });

  it('o Tab fica preso dentro do diálogo', async () => {
    montar();
    const usuaria = userEvent.setup();
    const cancelar = screen.getByRole('button', { name: 'Cancelar' });
    const confirmar = screen.getByRole('button', { name: 'Apagar' });

    await usuaria.tab();
    expect(confirmar).toHaveFocus();
    await usuaria.tab();
    expect(cancelar).toHaveFocus();
    await usuaria.tab({ shift: true });
    expect(confirmar).toHaveFocus();
  });

  it('enquanto está ocupado, desliga os botões; com erro, mostra o aviso', () => {
    montar({ ocupado: true, erro: 'Deu ruim.' });

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Apagar' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Deu ruim.');
  });

  it('ao fechar, devolve o foco a quem o abriu', async () => {
    function Exemplo() {
      const [aberto, setAberto] = useState(false);
      return (
        <>
          <button onClick={() => setAberto(true)}>Abrir</button>
          {aberto && (
            <DialogoConfirmacao
              titulo="T"
              mensagem="M"
              rotuloConfirmar="Ok"
              aoConfirmar={() => {}}
              aoCancelar={() => setAberto(false)}
            />
          )}
        </>
      );
    }
    render(<Exemplo />);
    const usuaria = userEvent.setup();
    const abrir = screen.getByRole('button', { name: 'Abrir' });

    await usuaria.click(abrir);
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    await usuaria.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(abrir).toHaveFocus();
  });
});
