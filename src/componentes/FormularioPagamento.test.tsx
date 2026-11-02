import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { usarHojeFixo } from '../testes/ficha';
import { FormularioPagamento } from './FormularioPagamento';

usarHojeFixo();

function montar(props: Partial<ComponentProps<typeof FormularioPagamento>> = {}) {
  const aoEnviar = vi.fn();
  const aoCancelar = vi.fn();
  render(<FormularioPagamento valorCentavos={18000} aoEnviar={aoEnviar} aoCancelar={aoCancelar} {...props} />);
  return { aoEnviar, aoCancelar, usuaria: userEvent.setup() };
}

describe('FormularioPagamento', () => {
  describe('valor fixo', () => {
    it('mostra a data de hoje, as quatro formas com Pix marcada, a observação e o valor como texto', () => {
      montar();

      expect(screen.getByLabelText('Data')).toHaveValue('2026-11-02');
      const formas = screen.getAllByRole('radio').map((r) => r.parentElement?.textContent);
      expect(formas).toEqual(['Pix', 'Dinheiro', 'Cartão', 'Transferência']);
      expect(screen.getByRole('radio', { name: 'Pix' })).toBeChecked();
      expect(screen.getByLabelText('Observação')).toHaveValue('');
      expect(screen.getByText('Valor: R$ 180,00')).toBeInTheDocument();
      // O valor é fixo: não há campo para digitar.
      expect(screen.queryByRole('textbox', { name: 'Valor' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirmar pagamento' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    });

    it('"Confirmar pagamento" entrega data, forma e observação, sem valor', async () => {
      const { aoEnviar, usuaria } = montar();
      const data = screen.getByLabelText('Data');
      await usuaria.clear(data);
      await usuaria.type(data, '2026-11-03');
      await usuaria.click(screen.getByRole('radio', { name: 'Dinheiro' }));
      await usuaria.type(screen.getByLabelText('Observação'), '  Pagou a mãe.  ');

      await usuaria.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));

      expect(aoEnviar).toHaveBeenCalledTimes(1);
      expect(aoEnviar).toHaveBeenCalledWith({ data: '2026-11-03', forma: 'dinheiro', observacao: 'Pagou a mãe.' });
    });

    it('sem a data, avisa e não envia', async () => {
      const { aoEnviar, usuaria } = montar();
      await usuaria.clear(screen.getByLabelText('Data'));

      await usuaria.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));

      expect(screen.getByText('Informe a data do pagamento.')).toBeInTheDocument();
      expect(aoEnviar).not.toHaveBeenCalled();
    });
  });

  describe('valor editável', () => {
    it('mostra o campo "Valor" vazio e entrega os centavos digitados', async () => {
      const { aoEnviar, usuaria } = montar({ valorCentavos: undefined, valorEditavel: true });
      const valor = screen.getByLabelText('Valor');
      expect(valor).toHaveValue('');
      expect(screen.queryByText(/^Valor: /)).not.toBeInTheDocument();

      await usuaria.type(valor, '500,50');
      await usuaria.click(screen.getByRole('radio', { name: 'Cartão' }));
      await usuaria.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));

      expect(aoEnviar).toHaveBeenCalledWith({ data: '2026-11-02', forma: 'cartao', observacao: null, valorCentavos: 50050 });
    });

    it('o valor dado já vem preenchido, para ela só conferir ou mudar', () => {
      montar({ valorCentavos: 81000, valorEditavel: true });

      expect(screen.getByLabelText('Valor')).toHaveValue('810,00');
    });

    it('valor em branco, zero ou inválido: avisa no campo e não envia', async () => {
      const { aoEnviar, usuaria } = montar({ valorCentavos: undefined, valorEditavel: true });

      await usuaria.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));
      expect(screen.getByText('Informe um valor maior que zero, como 500 ou 500,50.')).toBeInTheDocument();
      expect(screen.getByLabelText('Valor')).toBeInvalid();

      await usuaria.type(screen.getByLabelText('Valor'), '0');
      await usuaria.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));
      expect(aoEnviar).not.toHaveBeenCalled();
    });
  });

  it('"Cancelar" avisa quem usa e não envia nada', async () => {
    const { aoEnviar, aoCancelar, usuaria } = montar();

    await usuaria.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(aoCancelar).toHaveBeenCalledTimes(1);
    expect(aoEnviar).not.toHaveBeenCalled();
  });

  it('enquanto envia, "Confirmar pagamento" fica desligado e diz que está registrando', async () => {
    const { aoEnviar, usuaria } = montar({ enviando: true });

    const botao = screen.getByRole('button', { name: 'Registrando…' });
    expect(botao).toBeDisabled();
    await usuaria.click(botao);
    expect(aoEnviar).not.toHaveBeenCalled();
  });

  it('mostra o erro que quem usa informar', () => {
    montar({ erro: 'Escolha só sessões em aberto deste paciente.' });

    expect(screen.getByRole('alert')).toHaveTextContent('Escolha só sessões em aberto deste paciente.');
  });

  it('com título, o formulário se chama por ele', () => {
    montar({ titulo: 'Registrar pagamento' });

    expect(screen.getByRole('heading', { name: 'Registrar pagamento' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Registrar pagamento' })).toBeInTheDocument();
  });
});
