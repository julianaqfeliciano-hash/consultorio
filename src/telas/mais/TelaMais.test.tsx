import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderComRotas } from '../../testes/utilitarios';

describe('TelaMais', () => {
  it('leva para as configurações', async () => {
    renderComRotas('/mais');
    const usuaria = userEvent.setup();

    await usuaria.click(await screen.findByRole('link', { name: /Configurações/ }));

    expect(await screen.findByRole('heading', { name: 'Configurações' })).toBeInTheDocument();
  });

  it('leva para os parceiros', async () => {
    renderComRotas('/mais');
    const usuaria = userEvent.setup();

    await usuaria.click(await screen.findByRole('link', { name: /Parceiros/ }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Parceiros' })).toBeInTheDocument());
  });

  it('continua marcando "Mais" na navegação dentro das telas filhas', async () => {
    renderComRotas('/mais/parceiros');

    const nav = await screen.findByRole('navigation', { name: 'Principal' });
    expect(nav.querySelector('a[aria-current="page"]')).toHaveTextContent('Mais');
  });
});
