import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { criarRepositorioMemoria } from '../../dados/memoria';
import type { FiltroPagamentos, Repositorio } from '../../dados/repositorio';
import { sementeDemo } from '../../dados/semente-demo';
import { ANA, HOJE, MARIA, PEDRO, repositorioDemo, usarHojeFixo } from '../../testes/ficha';
import { renderComRotas } from '../../testes/utilitarios';

usarHojeFixo();

function abrirFinanceiro(repositorio: Repositorio = repositorioDemo()) {
  return { ...renderComRotas('/financeiro', { repositorio }), usuaria: userEvent.setup() };
}

/** A parte "A receber", depois de carregada. */
async function secaoAReceber() {
  const secao = await screen.findByRole('region', { name: 'A receber' });
  await waitFor(() => expect(within(secao).queryByText('Carregando…')).not.toBeInTheDocument());
  return secao;
}

/** A parte "Pagamentos", depois de carregada. */
async function secaoPagamentos() {
  const secao = await screen.findByRole('region', { name: 'Pagamentos' });
  await waitFor(() => expect(within(secao).queryByText('Carregando…')).not.toBeInTheDocument());
  return secao;
}

/** O texto de um elemento como se lê na tela: `formatarReais` põe um espaço não separável entre "R$" e o número. */
const texto = (elemento: Element | null | undefined) => (elemento?.textContent ?? '').replace(/\s+/g, ' ');

/** Semente sem nada a receber: nenhuma sessão cobrada nem pacote de avaliação. */
function repositorioSemDivida(): Repositorio {
  return criarRepositorioMemoria({ ...sementeDemo(HOJE), sessoes: [], avaliacoes: [] });
}

describe('TelaFinanceiro', () => {
  it('tem o título, as duas partes e o rodapé discreto', async () => {
    abrirFinanceiro();

    expect(screen.getByRole('heading', { level: 1, name: 'Financeiro' })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'A receber' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Pagamentos' })).toBeInTheDocument();
    expect(screen.getByText('Despesas, recibos e relatórios chegam numa próxima etapa.')).toBeInTheDocument();
  });

  describe('A receber', () => {
    it('lista Ana, Pedro e Maria em ordem de "desde", com o valor de cada um', async () => {
      abrirFinanceiro();
      const aReceber = await secaoAReceber();

      const linhas = within(within(aReceber).getByRole('list')).getAllByRole('listitem');
      expect(linhas.map((l) => texto(l))).toEqual([
        'Ana Clara Souza desde 01/10/2026 R$ 800,00',
        'Pedro Henrique Lima desde 14/10/2026 R$ 810,00',
        'Maria Luísa Costa desde 29/10/2026 R$ 180,00',
      ]);
    });

    it('mostra o total geral', async () => {
      abrirFinanceiro();
      const aReceber = await secaoAReceber();

      expect(within(aReceber).getByText('Total a receber: R$ 1.790,00')).toBeInTheDocument();
    });

    it('cada paciente leva à ficha dele', async () => {
      abrirFinanceiro();
      const aReceber = await secaoAReceber();

      expect(within(aReceber).getByRole('link', { name: /Ana Clara Souza/ })).toHaveAttribute('href', `/pacientes/${ANA}`);
      expect(within(aReceber).getByRole('link', { name: /Pedro Henrique Lima/ })).toHaveAttribute('href', `/pacientes/${PEDRO}`);
      expect(within(aReceber).getByRole('link', { name: /Maria Luísa Costa/ })).toHaveAttribute('href', `/pacientes/${MARIA}`);
    });

    it('não lista quem não deve nada (Lucas, da lista de espera)', async () => {
      abrirFinanceiro();
      const aReceber = await secaoAReceber();

      expect(within(aReceber).queryByText(/Lucas Oliveira/)).not.toBeInTheDocument();
    });

    it('quem teve alta continua na lista enquanto deve', async () => {
      const semente = sementeDemo(HOJE);
      const pacientes = semente.pacientes.map((p) => (p.id === ANA ? { ...p, status: 'alta' as const } : p));
      abrirFinanceiro(criarRepositorioMemoria({ ...semente, pacientes }));
      const aReceber = await secaoAReceber();

      expect(within(aReceber).getByRole('link', { name: /Ana Clara Souza/ })).toBeInTheDocument();
      expect(within(aReceber).getByText('Total a receber: R$ 1.790,00')).toBeInTheDocument();
    });

    it('sem ninguém devendo, mostra "Ninguém está devendo." e nenhum total', async () => {
      abrirFinanceiro(repositorioSemDivida());
      const aReceber = await secaoAReceber();

      expect(within(aReceber).getByText('Ninguém está devendo.')).toBeInTheDocument();
      expect(within(aReceber).queryByRole('list')).not.toBeInTheDocument();
      expect(within(aReceber).queryByText(/^Total a receber/)).not.toBeInTheDocument();
    });

    it('registrar o pagamento na ficha da Maria tira a Maria da lista ao voltar à aba', async () => {
      const { usuaria } = abrirFinanceiro();
      const aReceber = await secaoAReceber();
      expect(within(aReceber).getByRole('link', { name: /Maria Luísa Costa/ })).toBeInTheDocument();

      // Pela lista mesmo: o link leva à ficha, onde a seção Financeiro já está aberta.
      await usuaria.click(within(aReceber).getByRole('link', { name: /Maria Luísa Costa/ }));
      const financeiroDaFicha = await screen.findByRole('region', { name: 'Financeiro' });
      await usuaria.click(await within(financeiroDaFicha).findByRole('checkbox', { name: /29\/10\/2026/ }));
      await usuaria.click(within(financeiroDaFicha).getByRole('button', { name: 'Registrar pagamento das marcadas' }));
      await usuaria.click(within(financeiroDaFicha).getByRole('button', { name: 'Confirmar pagamento' }));
      expect(await within(financeiroDaFicha).findByText('Nada em aberto.')).toBeInTheDocument();

      await usuaria.click(within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('link', { name: 'Financeiro' }));

      const depois = await screen.findByRole('region', { name: 'A receber' });
      await waitFor(() => expect(within(depois).queryByRole('link', { name: /Maria Luísa Costa/ })).not.toBeInTheDocument());
      expect(within(depois).getByText('Total a receber: R$ 1.610,00')).toBeInTheDocument();
      expect(within(depois).getAllByRole('link').map((l) => texto(l))).toEqual([
        'Ana Clara Souza desde 01/10/2026 R$ 800,00',
        'Pedro Henrique Lima desde 14/10/2026 R$ 810,00',
      ]);
      // O pagamento de hoje já conta em "Pagamentos" de novembro.
      const pagamentos = await secaoPagamentos();
      expect(await within(pagamentos).findByText('Recebido no mês: R$ 180,00')).toBeInTheDocument();
    });

    it('se não carrega, avisa e deixa tentar de novo', async () => {
      const base = repositorioDemo();
      const listarSessoesCobradas = vi.fn().mockRejectedValueOnce(new Error('sem rede')).mockImplementation(base.listarSessoesCobradas);
      const { usuaria } = abrirFinanceiro({ ...base, listarSessoesCobradas });

      const aviso = await screen.findByText('Não foi possível carregar o que há a receber.');
      expect(aviso).toBeInTheDocument();
      // Os pagamentos do mês não dependem disso e seguem à mostra.
      expect(await secaoPagamentos()).toBeInTheDocument();

      await usuaria.click(within(screen.getByRole('region', { name: 'A receber' })).getByRole('button', { name: 'Tentar de novo' }));

      const aReceber = await secaoAReceber();
      expect(await within(aReceber).findByText('Total a receber: R$ 1.790,00')).toBeInTheDocument();
      expect(screen.queryByText('Não foi possível carregar o que há a receber.')).not.toBeInTheDocument();
    });
  });

  describe('Pagamentos', () => {
    it('abre no mês de hoje, sem pagamentos em novembro, com "Recebido no mês: R$ 0,00"', async () => {
      abrirFinanceiro();
      const pagamentos = await secaoPagamentos();

      expect(within(pagamentos).getByText('novembro de 2026')).toBeInTheDocument();
      expect(within(pagamentos).getByText('Nenhum pagamento neste mês.')).toBeInTheDocument();
      expect(within(pagamentos).getByText('Recebido no mês: R$ 0,00')).toBeInTheDocument();
    });

    it('"Mês anterior" mostra os pagamentos de outubro: Pedro e Maria, com o recebido no mês', async () => {
      const { usuaria } = abrirFinanceiro();
      const pagamentos = await secaoPagamentos();

      await usuaria.click(within(pagamentos).getByRole('button', { name: 'Mês anterior' }));

      expect(await within(pagamentos).findByText('outubro de 2026')).toBeInTheDocument();
      const linhas = await within(pagamentos).findAllByRole('listitem');
      expect(linhas.map((l) => texto(l))).toEqual([
        '14/10/2026 · Pedro Henrique Lima · Pix R$ 810,00',
        '22/10/2026 · Maria Luísa Costa · Pix R$ 180,00',
      ]);
      expect(within(pagamentos).getByText('Recebido no mês: R$ 990,00')).toBeInTheDocument();
      expect(within(pagamentos).queryByText('Nenhum pagamento neste mês.')).not.toBeInTheDocument();
    });

    it('"Próximo mês" volta a novembro', async () => {
      const { usuaria } = abrirFinanceiro();
      const pagamentos = await secaoPagamentos();

      await usuaria.click(within(pagamentos).getByRole('button', { name: 'Mês anterior' }));
      expect(await within(pagamentos).findByText('outubro de 2026')).toBeInTheDocument();
      await usuaria.click(within(pagamentos).getByRole('button', { name: 'Próximo mês' }));

      expect(await within(pagamentos).findByText('novembro de 2026')).toBeInTheDocument();
      expect(await within(pagamentos).findByText('Recebido no mês: R$ 0,00')).toBeInTheDocument();
      expect(within(pagamentos).queryByRole('listitem')).not.toBeInTheDocument();
    });

    it('atravessa a virada do ano nos dois sentidos', async () => {
      const { usuaria } = abrirFinanceiro();
      const pagamentos = await secaoPagamentos();

      await usuaria.click(within(pagamentos).getByRole('button', { name: 'Próximo mês' }));
      expect(await within(pagamentos).findByText('dezembro de 2026')).toBeInTheDocument();
      await usuaria.click(within(pagamentos).getByRole('button', { name: 'Próximo mês' }));
      expect(await within(pagamentos).findByText('janeiro de 2027')).toBeInTheDocument();
      await usuaria.click(within(pagamentos).getByRole('button', { name: 'Mês anterior' }));
      expect(await within(pagamentos).findByText('dezembro de 2026')).toBeInTheDocument();
    });

    it('o último dia de outubro é de outubro e o primeiro de novembro é de novembro', async () => {
      const semente = sementeDemo(HOJE);
      const base = semente.pagamentos[0];
      const pagamentos = [
        { ...base, id: 'ultimo-de-outubro', data: '2026-10-31', valorCentavos: 10000 },
        { ...base, id: 'primeiro-de-novembro', data: '2026-11-01', valorCentavos: 25000 },
      ];
      const { usuaria } = abrirFinanceiro(criarRepositorioMemoria({ ...semente, pagamentos }));
      const secao = await secaoPagamentos();

      expect(await within(secao).findByText('Recebido no mês: R$ 250,00')).toBeInTheDocument();
      expect(within(secao).getAllByRole('listitem').map((l) => texto(l))).toEqual([
        '01/11/2026 · Maria Luísa Costa · Pix R$ 250,00',
      ]);

      await usuaria.click(within(secao).getByRole('button', { name: 'Mês anterior' }));
      expect(await within(secao).findByText('Recebido no mês: R$ 100,00')).toBeInTheDocument();
      expect(within(secao).getAllByRole('listitem').map((l) => texto(l))).toEqual([
        '31/10/2026 · Maria Luísa Costa · Pix R$ 100,00',
      ]);
    });

    it('as setas têm pelo menos 44 px de área de toque', async () => {
      abrirFinanceiro();
      const pagamentos = await secaoPagamentos();

      for (const nome of ['Mês anterior', 'Próximo mês']) {
        expect(within(pagamentos).getByRole('button', { name: nome })).toHaveClass('min-h-11', 'min-w-11');
      }
    });

    it('se não carrega, avisa e deixa tentar de novo', async () => {
      const base = repositorioDemo();
      // Só a consulta do mês (a que tem `de`) falha, e só na primeira vez: a lista de quem deve também usa os pagamentos.
      let jaFalhou = false;
      const listarPagamentos = vi.fn(async (filtro?: FiltroPagamentos) => {
        if (filtro?.de !== undefined && !jaFalhou) {
          jaFalhou = true;
          throw new Error('sem rede');
        }
        return base.listarPagamentos(filtro);
      });
      const { usuaria } = abrirFinanceiro({ ...base, listarPagamentos });

      expect(await screen.findByText('Não foi possível carregar os pagamentos.')).toBeInTheDocument();
      await usuaria.click(within(screen.getByRole('region', { name: 'Pagamentos' })).getByRole('button', { name: 'Tentar de novo' }));

      const pagamentos = await secaoPagamentos();
      expect(await within(pagamentos).findByText('Recebido no mês: R$ 0,00')).toBeInTheDocument();
      expect(screen.queryByText('Não foi possível carregar os pagamentos.')).not.toBeInTheDocument();
    });
  });
});
