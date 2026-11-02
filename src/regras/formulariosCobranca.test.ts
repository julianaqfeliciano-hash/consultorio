import { validarPagamento, type ValoresPagamento } from './formulariosCobranca';

const base: ValoresPagamento = { data: '2026-11-02', forma: 'pix', observacao: '', valor: '' };

describe('validarPagamento', () => {
  describe('valor fixo (sessões e mês)', () => {
    it('devolve data, forma e observação, sem valor: ele vem dos valores guardados', () => {
      const r = validarPagamento({ ...base, valor: 'qualquer coisa' }, false);

      expect(r.erros).toEqual({});
      expect(r.dados).toEqual({ data: '2026-11-02', forma: 'pix', observacao: null });
      expect(r.dados).not.toHaveProperty('valorCentavos');
    });

    it('a observação vai sem as pontas em branco, ou como nula quando vazia', () => {
      expect(validarPagamento({ ...base, observacao: '  Pagou em dinheiro vivo.  ' }, false).dados?.observacao).toBe(
        'Pagou em dinheiro vivo.',
      );
      expect(validarPagamento({ ...base, observacao: '   ' }, false).dados?.observacao).toBeNull();
    });

    it('pede a data quando falta', () => {
      const r = validarPagamento({ ...base, data: '' }, false);

      expect(r.dados).toBeNull();
      expect(r.erros).toEqual({ data: 'Informe a data do pagamento.' });
    });
  });

  describe('valor editável (parcela da avaliação)', () => {
    it.each([
      ['500', 50000],
      ['500,5', 50050],
      ['R$ 1.250,50', 125050],
      ['0,01', 1],
    ])('lê "%s" como %i centavos', (texto, centavos) => {
      const r = validarPagamento({ ...base, forma: 'cartao', valor: texto }, true);

      expect(r.erros).toEqual({});
      expect(r.dados).toEqual({ data: '2026-11-02', forma: 'cartao', observacao: null, valorCentavos: centavos });
    });

    it.each(['', '   ', '0', '0,00', 'abc', '12,345,6', '-5'])('recusa o valor "%s"', (texto) => {
      const r = validarPagamento({ ...base, valor: texto }, true);

      expect(r.dados).toBeNull();
      expect(r.erros).toEqual({ valor: 'Informe um valor maior que zero, como 500 ou 500,50.' });
    });

    it('mostra os dois avisos de uma vez quando faltam a data e o valor', () => {
      const r = validarPagamento({ ...base, data: '', valor: '' }, true);

      expect(r.dados).toBeNull();
      expect(r.erros).toEqual({
        data: 'Informe a data do pagamento.',
        valor: 'Informe um valor maior que zero, como 500 ou 500,50.',
      });
    });
  });
});
