import { screen, waitFor, within } from '@testing-library/react';
import { criarRepositorioMemoria } from '../../dados/memoria';
import type { Repositorio } from '../../dados/repositorio';
import { sementeDemo } from '../../dados/semente-demo';
import { instanteDe } from '../../regras/datas';
import { sessaoExemplo } from '../../testes/fabricas';
import { abrirFicha, ANA, HOJE, LUCAS, MARIA, PEDRO, repositorioDemo, usarHojeFixo } from '../../testes/ficha';

usarHojeFixo();

/** Abre a ficha e espera a seção Financeiro ter o que mostrar (ou seja, ter terminado de carregar). */
async function abrirFinanceiro(id: string, repositorio: Repositorio = repositorioDemo()) {
  const resultado = abrirFicha(id, repositorio);
  const financeiro = await screen.findByRole('region', { name: 'Financeiro' });
  await waitFor(() => expect(within(financeiro).queryByText('Carregando…')).not.toBeInTheDocument());
  return { ...resultado, financeiro };
}

/** O texto de um elemento como se lê na tela: `formatarReais` põe um espaço não separável entre "R$" e o número. */
const texto = (elemento: Element | null | undefined) => (elemento?.textContent ?? '').replace(/\s+/g, ' ');

/** A linha do mês, pelo nome por extenso ("outubro de 2026"). */
const linhaDoMes = (financeiro: HTMLElement, mes: string) =>
  within(financeiro).getByText(new RegExp(`^${mes} · `)).closest('li') as HTMLElement;

/** A linha do pagamento no histórico, pelo texto dela. */
const linhaDoPagamento = (financeiro: HTMLElement, texto: string) =>
  within(financeiro).getByText(texto).closest('li') as HTMLElement;

/** Ana com uma sessão já cobrada em novembro (o mês de hoje): outubro devendo e novembro em andamento. */
function repositorioDaAnaComNovembro(): Repositorio {
  const semente = sementeDemo(HOJE);
  const sessaoDeNovembro = sessaoExemplo({
    id: 'ana-novembro',
    pacienteId: ANA,
    inicio: instanteDe('2026-11-02', '10:00'),
    situacao: 'compareceu',
    valorCentavos: 20000,
  });
  return criarRepositorioMemoria({ ...semente, sessoes: [...semente.sessoes, sessaoDeNovembro] });
}

/** Maria sem nenhum pagamento: as duas quintas de outubro (22 e 29) em aberto. */
function repositorioDaMariaSemPagamento(): Repositorio {
  const semente = sementeDemo(HOJE);
  return criarRepositorioMemoria({ ...semente, pagamentos: semente.pagamentos.filter((p) => p.pacienteId !== MARIA) });
}

describe('SecaoFinanceiro', () => {
  it('fica logo depois da Cobrança e antes dos Responsáveis', async () => {
    await abrirFinanceiro(ANA);

    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Dados da criança',
      'Atendimento',
      'Cobrança',
      'Financeiro',
      'Responsáveis',
      'Horários fixos',
      'Sessões',
    ]);
  });

  describe('Ana Clara (paga por mês)', () => {
    it('mostra o que está em aberto e outubro como "Devendo", com o botão de registrar o mês', async () => {
      const { financeiro } = await abrirFinanceiro(ANA);

      expect(within(financeiro).getByText('Em aberto: R$ 800,00')).toBeInTheDocument();
      const outubro = linhaDoMes(financeiro, 'outubro de 2026');
      expect(outubro).toHaveTextContent('outubro de 2026 · 4 sessões · R$ 800,00');
      expect(within(outubro).getByText('Devendo')).toBeInTheDocument();
      expect(within(outubro).getByRole('button', { name: 'Registrar pagamento do mês' })).toBeInTheDocument();
      // Quem paga por mês não tem sessão avulsa nem pacote de avaliação.
      expect(within(financeiro).queryByText('Sessões em aberto')).not.toBeInTheDocument();
      expect(within(financeiro).queryByText('Pacote da avaliação')).not.toBeInTheDocument();
      expect(within(financeiro).getByText('Nenhum pagamento registrado.')).toBeInTheDocument();
    });

    it('uma sessão cobrada em novembro (o mês de hoje) deixa novembro "Em andamento", acima de outubro', async () => {
      const { financeiro } = await abrirFinanceiro(ANA, repositorioDaAnaComNovembro());

      expect(await within(financeiro).findByText('Em aberto: R$ 1.000,00')).toBeInTheDocument();
      const novembro = linhaDoMes(financeiro, 'novembro de 2026');
      // Uma sessão só: "1 sessão", não "1 sessões".
      expect(novembro).toHaveTextContent('novembro de 2026 · 1 sessão · R$ 200,00');
      expect(within(novembro).getByText('Em andamento')).toBeInTheDocument();
      expect(within(novembro).getByRole('button', { name: 'Registrar pagamento do mês' })).toBeInTheDocument();
      expect(within(linhaDoMes(financeiro, 'outubro de 2026')).getByText('Devendo')).toBeInTheDocument();
      const meses = within(within(financeiro).getByRole('list', { name: 'Meses' })).getAllByRole('listitem');
      expect(meses.map((m) => texto(m))).toEqual([
        expect.stringContaining('novembro de 2026'),
        expect.stringContaining('outubro de 2026'),
      ]);
    });

    it('"Registrar pagamento do mês" de outubro: o mês fica "Pago" e o em aberto cai', async () => {
      const { financeiro, usuaria, repositorio } = await abrirFinanceiro(ANA, repositorioDaAnaComNovembro());
      await within(financeiro).findByText('Em aberto: R$ 1.000,00');

      await usuaria.click(within(linhaDoMes(financeiro, 'outubro de 2026')).getByRole('button', { name: 'Registrar pagamento do mês' }));
      const formulario = within(financeiro).getByRole('form', { name: 'Pagamento de outubro de 2026' });
      // O valor do mês sai das sessões: ela só confere.
      expect(within(formulario).getByText('Valor: R$ 800,00')).toBeInTheDocument();
      expect(within(formulario).getByLabelText('Data')).toHaveValue('2026-11-02');
      await usuaria.click(within(formulario).getByRole('button', { name: 'Confirmar pagamento' }));

      expect(await within(financeiro).findByText('Em aberto: R$ 200,00')).toBeInTheDocument();
      const outubro = linhaDoMes(financeiro, 'outubro de 2026');
      expect(within(outubro).getByText('Pago')).toBeInTheDocument();
      expect(within(outubro).queryByRole('button', { name: 'Registrar pagamento do mês' })).not.toBeInTheDocument();
      expect(within(financeiro).queryByRole('form')).not.toBeInTheDocument();
      // Novembro, que ainda não foi pago, segue com o botão.
      expect(within(linhaDoMes(financeiro, 'novembro de 2026')).getByRole('button', { name: 'Registrar pagamento do mês' })).toBeInTheDocument();
      expect(within(financeiro).getByText('02/11/2026 · Pix · R$ 800,00 · Mensalidade de outubro de 2026')).toBeInTheDocument();
      expect(await repositorio.listarPagamentos({ pacienteId: ANA })).toEqual([
        expect.objectContaining({ referencia: 'mes', mesReferencia: '2026-10-01', valorCentavos: 80000, forma: 'pix', data: '2026-11-02' }),
      ]);
    });

    it('sem mais nada devendo, mostra "Nada em aberto." e o mês pago', async () => {
      const { financeiro, usuaria } = await abrirFinanceiro(ANA);

      await usuaria.click(within(financeiro).getByRole('button', { name: 'Registrar pagamento do mês' }));
      await usuaria.click(within(financeiro).getByRole('button', { name: 'Confirmar pagamento' }));

      expect(await within(financeiro).findByText('Nada em aberto.')).toBeInTheDocument();
      expect(within(financeiro).queryByText(/^Em aberto:/)).not.toBeInTheDocument();
      expect(within(linhaDoMes(financeiro, 'outubro de 2026')).getByText('Pago')).toBeInTheDocument();
    });

    it('cancelar o formulário do mês não registra nada', async () => {
      const { financeiro, usuaria, repositorio } = await abrirFinanceiro(ANA);

      await usuaria.click(within(financeiro).getByRole('button', { name: 'Registrar pagamento do mês' }));
      await usuaria.click(within(financeiro).getByRole('button', { name: 'Cancelar' }));

      expect(within(financeiro).queryByRole('form')).not.toBeInTheDocument();
      expect(within(financeiro).getByRole('button', { name: 'Registrar pagamento do mês' })).toBeInTheDocument();
      expect(await repositorio.listarPagamentos({ pacienteId: ANA })).toEqual([]);
    });

    it('se a gravação falha, o formulário continua aberto com o aviso', async () => {
      const base = repositorioDemo();
      const registrarPagamento = vi.fn().mockRejectedValue(new Error('sem rede'));
      const { financeiro, usuaria } = await abrirFinanceiro(ANA, { ...base, registrarPagamento });

      await usuaria.click(within(financeiro).getByRole('button', { name: 'Registrar pagamento do mês' }));
      await usuaria.click(within(financeiro).getByRole('button', { name: 'Confirmar pagamento' }));

      expect(await within(financeiro).findByText('Não foi possível registrar o pagamento. Tente de novo.')).toBeInTheDocument();
      expect(within(financeiro).getByRole('form', { name: 'Pagamento de outubro de 2026' })).toBeInTheDocument();
      expect(within(financeiro).getByText('Em aberto: R$ 800,00')).toBeInTheDocument();
    });

    it('depois de pago, marcar uma sessão de outubro como "Faltou com aviso" na agenda mostra a diferença na ficha', async () => {
      const { financeiro, usuaria } = await abrirFinanceiro(ANA);
      await usuaria.click(within(financeiro).getByRole('button', { name: 'Registrar pagamento do mês' }));
      await usuaria.click(within(financeiro).getByRole('button', { name: 'Confirmar pagamento' }));
      await within(financeiro).findByText('Nada em aberto.');
      // Sem diferença enquanto as sessões são as mesmas do pagamento.
      expect(within(financeiro).queryByText(/mudou depois do pagamento/)).not.toBeInTheDocument();

      // Na agenda, a semana passada: a terça 27/10 da Ana vira "Faltou com aviso".
      await usuaria.click(within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('link', { name: 'Agenda' }));
      await usuaria.click(await screen.findByRole('button', { name: 'Semana anterior' }));
      const terca = await screen.findByRole('region', { name: /terça-feira, 27\/10/i });
      await usuaria.click(await within(terca).findByRole('button', { name: /Ana Clara Souza/ }));
      const painel = await screen.findByRole('dialog', { name: 'Ana Clara Souza' });
      await usuaria.click(within(painel).getByRole('button', { name: 'Faltou com aviso' }));
      await waitFor(() => expect(within(painel).getByRole('button', { name: 'Faltou com aviso' })).toHaveAttribute('aria-pressed', 'true'));
      await usuaria.keyboard('{Escape}');

      // De volta à ficha da Ana: outubro vale R$ 600,00 e foi pago por R$ 800,00.
      await usuaria.click(within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('link', { name: 'Pacientes' }));
      await usuaria.click(await screen.findByRole('link', { name: /Ana Clara Souza/ }));
      const fichaDeNovo = await screen.findByRole('region', { name: 'Financeiro' });
      expect(
        await within(fichaDeNovo).findByText('O valor de outubro de 2026 mudou depois do pagamento: diferença de -R$ 200,00.'),
      ).toBeInTheDocument();
      const outubro = linhaDoMes(fichaDeNovo, 'outubro de 2026');
      expect(outubro).toHaveTextContent('outubro de 2026 · 3 sessões · R$ 600,00');
      expect(within(outubro).getByText('Pago')).toBeInTheDocument();
      // O aviso é só informação: o que está em aberto não muda.
      expect(within(fichaDeNovo).getByText('Nada em aberto.')).toBeInTheDocument();
    });
  });

  describe('Maria Luísa (paga por sessão)', () => {
    it('lista a sessão em aberto com data, tipo e valor; a paga não aparece na lista', async () => {
      const { financeiro } = await abrirFinanceiro(MARIA);

      expect(within(financeiro).getByText('Em aberto: R$ 180,00')).toBeInTheDocument();
      const lista = within(financeiro).getByRole('list', { name: 'Sessões em aberto' });
      expect(within(lista).getAllByRole('checkbox').map((c) => texto(c.closest('label')))).toEqual([
        '29/10/2026 · Psicoterapia · R$ 180,00',
      ]);
      // Quem paga por sessão não tem meses.
      expect(within(financeiro).queryByRole('list', { name: 'Meses' })).not.toBeInTheDocument();
    });

    it('o botão "Registrar pagamento das marcadas" só vale com alguma sessão marcada', async () => {
      const { financeiro, usuaria } = await abrirFinanceiro(MARIA);
      const botao = within(financeiro).getByRole('button', { name: 'Registrar pagamento das marcadas' });
      expect(botao).toBeDisabled();
      expect(within(financeiro).getByText('Marque as sessões que foram pagas.')).toBeInTheDocument();

      await usuaria.click(within(financeiro).getByRole('checkbox', { name: /29\/10\/2026/ }));
      expect(botao).toBeEnabled();
      expect(within(financeiro).getByText('Marcadas: R$ 180,00')).toBeInTheDocument();

      await usuaria.click(within(financeiro).getByRole('checkbox', { name: /29\/10\/2026/ }));
      expect(botao).toBeDisabled();
    });

    it('marcar a sessão aberta e registrar deixa "Nada em aberto." e o pagamento no alto do histórico', async () => {
      const { financeiro, usuaria, repositorio } = await abrirFinanceiro(MARIA);

      await usuaria.click(within(financeiro).getByRole('checkbox', { name: /29\/10\/2026/ }));
      await usuaria.click(within(financeiro).getByRole('button', { name: 'Registrar pagamento das marcadas' }));
      const formulario = within(financeiro).getByRole('form', { name: 'Pagamento das sessões marcadas' });
      expect(within(formulario).getByText('Valor: R$ 180,00')).toBeInTheDocument();
      await usuaria.click(within(formulario).getByRole('radio', { name: 'Dinheiro' }));
      await usuaria.type(within(formulario).getByLabelText('Observação'), 'Pagou a mãe.');
      await usuaria.click(within(formulario).getByRole('button', { name: 'Confirmar pagamento' }));

      expect(await within(financeiro).findByText('Nada em aberto.')).toBeInTheDocument();
      expect(within(financeiro).getByText('Pagou a mãe.')).toBeInTheDocument();
      expect(within(financeiro).queryByRole('list', { name: 'Sessões em aberto' })).not.toBeInTheDocument();
      expect(within(financeiro).queryByRole('form')).not.toBeInTheDocument();
      // Do mais novo para o mais antigo.
      const historico = within(within(financeiro).getByRole('list', { name: 'Pagamentos' })).getAllByRole('listitem');
      expect(historico.map((l) => texto(l.querySelector('span')))).toEqual([
        '02/11/2026 · Dinheiro · R$ 180,00 · Sessão de 29/10',
        '22/10/2026 · Pix · R$ 180,00 · Sessão de 22/10',
      ]);
      expect(await repositorio.listarPagamentos({ pacienteId: MARIA })).toHaveLength(2);
    });

    it('soma as sessões marcadas num só pagamento', async () => {
      const { financeiro, usuaria, repositorio } = await abrirFinanceiro(MARIA, repositorioDaMariaSemPagamento());
      expect(await within(financeiro).findByText('Em aberto: R$ 360,00')).toBeInTheDocument();
      expect(within(financeiro).getAllByRole('checkbox')).toHaveLength(2);

      await usuaria.click(within(financeiro).getByRole('checkbox', { name: /22\/10\/2026/ }));
      expect(within(financeiro).getByText('Marcadas: R$ 180,00')).toBeInTheDocument();
      await usuaria.click(within(financeiro).getByRole('checkbox', { name: /29\/10\/2026/ }));
      expect(within(financeiro).getByText('Marcadas: R$ 360,00')).toBeInTheDocument();
      await usuaria.click(within(financeiro).getByRole('button', { name: 'Registrar pagamento das marcadas' }));
      expect(within(financeiro).getByText('Valor: R$ 360,00')).toBeInTheDocument();
      await usuaria.click(within(financeiro).getByRole('button', { name: 'Confirmar pagamento' }));

      expect(await within(financeiro).findByText('Nada em aberto.')).toBeInTheDocument();
      expect(within(financeiro).getByText('02/11/2026 · Pix · R$ 360,00 · Sessões de 22/10 e 29/10')).toBeInTheDocument();
      const pagamentos = await repositorio.listarPagamentos({ pacienteId: MARIA });
      expect(pagamentos).toEqual([
        expect.objectContaining({ referencia: 'sessoes', valorCentavos: 36000, sessaoIds: ['demo-sessao-maria-1', 'demo-sessao-maria-2'] }),
      ]);
    });

    it('pagar só uma das duas deixa a outra em aberto', async () => {
      const { financeiro, usuaria } = await abrirFinanceiro(MARIA, repositorioDaMariaSemPagamento());
      await within(financeiro).findByText('Em aberto: R$ 360,00');

      await usuaria.click(within(financeiro).getByRole('checkbox', { name: /22\/10\/2026/ }));
      await usuaria.click(within(financeiro).getByRole('button', { name: 'Registrar pagamento das marcadas' }));
      await usuaria.click(within(financeiro).getByRole('button', { name: 'Confirmar pagamento' }));

      expect(await within(financeiro).findByText('Em aberto: R$ 180,00')).toBeInTheDocument();
      expect(within(financeiro).getAllByRole('checkbox').map((c) => texto(c.closest('label')))).toEqual([
        '29/10/2026 · Psicoterapia · R$ 180,00',
      ]);
      // A marcação da que foi paga não fica de resto: o botão volta a pedir uma marcação.
      expect(within(financeiro).getByRole('button', { name: 'Registrar pagamento das marcadas' })).toBeDisabled();
    });
  });

  describe('Pedro Henrique (pacote da avaliação)', () => {
    it('mostra o valor final, o que já foi pago e o que falta', async () => {
      const { financeiro } = await abrirFinanceiro(PEDRO);

      expect(within(financeiro).getByText('Em aberto: R$ 810,00')).toBeInTheDocument();
      expect(within(financeiro).getByText('Valor final R$ 1.620,00 · Pago R$ 810,00 · Falta R$ 810,00')).toBeInTheDocument();
      expect(within(financeiro).getByRole('button', { name: 'Registrar parcela' })).toBeInTheDocument();
      // A primeira metade foi paga por Pix na data da primeira sessão (quarta 14/10).
      expect(within(financeiro).getByText('14/10/2026 · Pix · R$ 810,00 · Parcela da avaliação')).toBeInTheDocument();
    });

    it('a parcela vem com o que falta, e valor acima do que falta é recusado com o aviso do serviço', async () => {
      const { financeiro, usuaria, repositorio } = await abrirFinanceiro(PEDRO);

      await usuaria.click(within(financeiro).getByRole('button', { name: 'Registrar parcela' }));
      const formulario = within(financeiro).getByRole('form', { name: 'Parcela da avaliação' });
      const valor = within(formulario).getByLabelText('Valor');
      expect(valor).toHaveValue('810,00');
      await usuaria.clear(valor);
      await usuaria.type(valor, '900');
      await usuaria.click(within(formulario).getByRole('button', { name: 'Confirmar pagamento' }));

      expect(await within(formulario).findByText('O valor passa do que falta do pacote: R$ 810,00.')).toBeInTheDocument();
      expect(within(financeiro).getByText('Valor final R$ 1.620,00 · Pago R$ 810,00 · Falta R$ 810,00')).toBeInTheDocument();
      expect(await repositorio.listarPagamentos({ pacienteId: PEDRO })).toHaveLength(1);
    });

    it('uma parcela de 810 quita o pacote: "Falta R$ 0,00", "Nada em aberto." e o botão some', async () => {
      const { financeiro, usuaria, repositorio } = await abrirFinanceiro(PEDRO);

      await usuaria.click(within(financeiro).getByRole('button', { name: 'Registrar parcela' }));
      const valor = within(financeiro).getByLabelText('Valor');
      await usuaria.clear(valor);
      await usuaria.type(valor, '810');
      await usuaria.click(within(financeiro).getByRole('button', { name: 'Confirmar pagamento' }));

      expect(await within(financeiro).findByText('Valor final R$ 1.620,00 · Pago R$ 1.620,00 · Falta R$ 0,00')).toBeInTheDocument();
      expect(within(financeiro).getByText('Nada em aberto.')).toBeInTheDocument();
      expect(within(financeiro).queryByRole('button', { name: 'Registrar parcela' })).not.toBeInTheDocument();
      expect(within(financeiro).queryByRole('form')).not.toBeInTheDocument();
      const pagamentos = await repositorio.listarPagamentos({ pacienteId: PEDRO });
      expect(pagamentos.map((p) => [p.referencia, p.valorCentavos])).toEqual([
        ['avaliacao', 81000],
        ['avaliacao', 81000],
      ]);
    });

    it('uma parcela menor deixa o resto: 300 → "Falta R$ 510,00"', async () => {
      const { financeiro, usuaria } = await abrirFinanceiro(PEDRO);

      await usuaria.click(within(financeiro).getByRole('button', { name: 'Registrar parcela' }));
      const valor = within(financeiro).getByLabelText('Valor');
      await usuaria.clear(valor);
      await usuaria.type(valor, '300,00');
      await usuaria.click(within(financeiro).getByRole('button', { name: 'Confirmar pagamento' }));

      expect(await within(financeiro).findByText('Valor final R$ 1.620,00 · Pago R$ 1.110,00 · Falta R$ 510,00')).toBeInTheDocument();
      expect(within(financeiro).getByText('Em aberto: R$ 510,00')).toBeInTheDocument();
      expect(within(financeiro).getByRole('button', { name: 'Registrar parcela' })).toBeInTheDocument();
    });

    it.each(['0', '0,00', 'abc'])('parcela de "%s": avisa no campo, sem chamar o serviço', async (digitado) => {
      const base = repositorioDemo();
      const registrarPagamento = vi.fn(base.registrarPagamento);
      const { financeiro, usuaria } = await abrirFinanceiro(PEDRO, { ...base, registrarPagamento });

      await usuaria.click(within(financeiro).getByRole('button', { name: 'Registrar parcela' }));
      const valor = within(financeiro).getByLabelText('Valor');
      await usuaria.clear(valor);
      await usuaria.type(valor, digitado);
      await usuaria.click(within(financeiro).getByRole('button', { name: 'Confirmar pagamento' }));

      expect(await within(financeiro).findByText('Informe um valor maior que zero, como 500 ou 500,50.')).toBeInTheDocument();
      expect(valor).toBeInvalid();
      expect(registrarPagamento).not.toHaveBeenCalled();
    });
  });

  describe('remover pagamento', () => {
    const PAGAMENTO_DA_MARIA = '22/10/2026 · Pix · R$ 180,00 · Sessão de 22/10';

    it('"Remover" pede confirmação e avisa que as sessões voltam a ficar em aberto', async () => {
      const { financeiro, usuaria, repositorio } = await abrirFinanceiro(MARIA);

      await usuaria.click(within(linhaDoPagamento(financeiro, PAGAMENTO_DA_MARIA)).getByRole('button', { name: /^Remover/ }));

      const dialogo = screen.getByRole('dialog', { name: 'Remover pagamento' });
      expect(dialogo).toHaveTextContent('Remover o pagamento de R$ 180,00 feito em 22/10/2026 (Sessão de 22/10)?');
      expect(dialogo).toHaveTextContent('As sessões deste pagamento voltam a ficar em aberto.');
      // Só perguntou: nada foi removido.
      expect(await repositorio.listarPagamentos({ pacienteId: MARIA })).toHaveLength(1);
      expect(within(financeiro).getByText('Em aberto: R$ 180,00')).toBeInTheDocument();
    });

    it('ao confirmar, a sessão paga volta a ficar em aberto', async () => {
      const { financeiro, usuaria, repositorio } = await abrirFinanceiro(MARIA);

      await usuaria.click(within(linhaDoPagamento(financeiro, PAGAMENTO_DA_MARIA)).getByRole('button', { name: /^Remover/ }));
      await usuaria.click(within(screen.getByRole('dialog', { name: 'Remover pagamento' })).getByRole('button', { name: 'Remover' }));

      expect(await within(financeiro).findByText('Em aberto: R$ 360,00')).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(within(financeiro).getAllByRole('checkbox').map((c) => texto(c.closest('label')))).toEqual([
        '22/10/2026 · Psicoterapia · R$ 180,00',
        '29/10/2026 · Psicoterapia · R$ 180,00',
      ]);
      expect(within(financeiro).getByText('Nenhum pagamento registrado.')).toBeInTheDocument();
      expect(await repositorio.listarPagamentos({ pacienteId: MARIA })).toEqual([]);
    });

    it('"Cancelar" mantém o pagamento', async () => {
      const { financeiro, usuaria, repositorio } = await abrirFinanceiro(MARIA);

      await usuaria.click(within(linhaDoPagamento(financeiro, PAGAMENTO_DA_MARIA)).getByRole('button', { name: /^Remover/ }));
      await usuaria.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(within(financeiro).getByText(PAGAMENTO_DA_MARIA)).toBeInTheDocument();
      expect(await repositorio.listarPagamentos({ pacienteId: MARIA })).toHaveLength(1);
    });

    it('se a remoção falha, o diálogo continua aberto com o aviso', async () => {
      const base = repositorioDemo();
      const removerPagamento = vi.fn().mockRejectedValue(new Error('sem rede'));
      const { financeiro, usuaria } = await abrirFinanceiro(MARIA, { ...base, removerPagamento });

      await usuaria.click(within(linhaDoPagamento(financeiro, PAGAMENTO_DA_MARIA)).getByRole('button', { name: /^Remover/ }));
      await usuaria.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remover' }));

      expect(await within(screen.getByRole('dialog')).findByText('Não foi possível remover o pagamento. Tente de novo.')).toBeInTheDocument();
      expect(within(financeiro).getByText('Em aberto: R$ 180,00')).toBeInTheDocument();
    });

    it('o pagamento do mês avisa que o mês volta a ficar em aberto', async () => {
      const { financeiro, usuaria } = await abrirFinanceiro(ANA);
      await usuaria.click(within(financeiro).getByRole('button', { name: 'Registrar pagamento do mês' }));
      await usuaria.click(within(financeiro).getByRole('button', { name: 'Confirmar pagamento' }));
      await within(financeiro).findByText('Nada em aberto.');

      await usuaria.click(
        within(linhaDoPagamento(financeiro, '02/11/2026 · Pix · R$ 800,00 · Mensalidade de outubro de 2026')).getByRole('button', { name: /^Remover/ }),
      );
      const dialogo = screen.getByRole('dialog', { name: 'Remover pagamento' });
      expect(dialogo).toHaveTextContent('O mês volta a ficar em aberto.');
      await usuaria.click(within(dialogo).getByRole('button', { name: 'Remover' }));

      expect(await within(financeiro).findByText('Em aberto: R$ 800,00')).toBeInTheDocument();
      expect(within(linhaDoMes(financeiro, 'outubro de 2026')).getByText('Devendo')).toBeInTheDocument();
    });

    it('o pagamento da avaliação avisa que o valor volta a faltar no pacote', async () => {
      const { financeiro, usuaria } = await abrirFinanceiro(PEDRO);

      await usuaria.click(within(financeiro).getByRole('button', { name: /^Remover/ }));
      const dialogo = screen.getByRole('dialog', { name: 'Remover pagamento' });
      expect(dialogo).toHaveTextContent('O valor volta a faltar no pacote da avaliação.');
      await usuaria.click(within(dialogo).getByRole('button', { name: 'Remover' }));

      expect(await within(financeiro).findByText('Valor final R$ 1.620,00 · Pago R$ 0,00 · Falta R$ 1.620,00')).toBeInTheDocument();
    });
  });

  describe('sem nada a mostrar, ou sem conseguir mostrar', () => {
    it('paciente sem sessões nem pagamentos: "Nada em aberto." e "Nenhum pagamento registrado."', async () => {
      const { financeiro } = await abrirFinanceiro(LUCAS);

      expect(within(financeiro).getByText('Nada em aberto.')).toBeInTheDocument();
      expect(within(financeiro).getByText('Nenhum pagamento registrado.')).toBeInTheDocument();
      expect(within(financeiro).queryByRole('button', { name: /^Registrar/ })).not.toBeInTheDocument();
    });

    it('se não conseguir carregar os pagamentos, avisa e deixa tentar de novo', async () => {
      const base = repositorioDemo();
      const listarPagamentos = vi.fn().mockRejectedValueOnce(new Error('sem rede')).mockImplementation(base.listarPagamentos);
      const { usuaria } = abrirFicha(MARIA, { ...base, listarPagamentos });

      const financeiro = await screen.findByRole('region', { name: 'Financeiro' });
      expect(await within(financeiro).findByText('Não foi possível carregar o financeiro.')).toBeInTheDocument();
      await usuaria.click(within(financeiro).getByRole('button', { name: 'Tentar de novo' }));

      expect(await within(financeiro).findByText('Em aberto: R$ 180,00')).toBeInTheDocument();
    });
  });
});
