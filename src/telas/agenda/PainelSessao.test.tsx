import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { criarRepositorioMemoria } from '../../dados/memoria';
import type { Repositorio } from '../../dados/repositorio';
import { useSessoes } from '../../dados/useAgenda';
import type { Avaliacao, Paciente, Pagamento, Sessao } from '../../dominio/tipos';
import { instanteDe } from '../../regras/datas';
import { avaliacaoExemplo, pacienteExemplo, pagamentoExemplo, sessaoExemplo } from '../../testes/fabricas';
import { usarHojeFixo } from '../../testes/ficha';
import { ErroCobranca } from '../../servicos/cobranca';
import { Provedores } from '../../Provedores';
import { PainelSessao } from './PainelSessao';

usarHojeFixo();

/** A sessão de teste: terça 03/11, 14:00 (Ana, `p1`). */
const ID = 's1';
/** A semana em que o painel de teste procura a sessão (segunda a domingo). */
const SEMANA = ['2026-11-02', '2026-11-08'] as const;

/** Faz o papel da agenda: busca a sessão na semana e entrega ao painel, que se atualiza a cada mudança. */
function Pai({ semana = SEMANA }: { semana?: readonly [string, string] }) {
  const { data } = useSessoes(semana[0], semana[1]);
  const sessao = data?.find((s) => s.id === ID);
  return sessao ? <PainelSessao sessao={sessao} /> : <p>Carregando…</p>;
}

function repositorioCom(sessao = sessaoExemplo(), paciente = pacienteExemplo({ dataEntrada: null })): Repositorio {
  return criarRepositorioMemoria({ pacientes: [paciente], sessoes: [sessao] });
}

function abrirPainel(repositorio: Repositorio = repositorioCom(), semana: readonly [string, string] = SEMANA) {
  render(
    <Provedores repositorio={repositorio} semNovasTentativas>
      <Pai semana={semana} />
    </Provedores>,
  );
  return { repositorio, usuaria: userEvent.setup() };
}

const sessaoGravada = async (repositorio: Repositorio, id = ID) =>
  (await repositorio.listarSessoesDoPaciente('p1')).find((s) => s.id === id);

describe('PainelSessao', () => {
  it('mostra o dia, a hora, o tipo e a situação, e os controles da sessão', async () => {
    abrirPainel();

    expect(await screen.findByText('terça-feira, 03/11 · 14:00 · 50 min')).toBeInTheDocument();
    expect(screen.getByText('Psicoterapia')).toBeInTheDocument();
    expect(screen.getByText('Agendada')).toBeInTheDocument();
    for (const nome of ['Compareceu', 'Faltou com aviso', 'Faltou sem aviso', 'Cancelar sessão', 'Remarcar']) {
      expect(screen.getByRole('button', { name: nome })).toBeInTheDocument();
    }
    expect(screen.getByLabelText('Nova data')).toBeInTheDocument();
    expect(screen.getByLabelText('Nova hora')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Acompanhamento familiar' })).not.toBeChecked();
    expect(screen.getByLabelText('Observação')).toHaveValue('');
  });

  it('em avaliação, mostra "sessão X de N" contando só os comparecimentos anteriores', async () => {
    const repositorio = criarRepositorioMemoria({
      pacientes: [pacienteExemplo({ tipo: 'avaliacao', dataEntrada: '2026-10-20' })],
      avaliacoes: [avaliacaoExemplo({ sessoesPrevistas: 8 })],
      sessoes: [
        sessaoExemplo({ id: 'a', tipo: 'avaliacao', avaliacaoId: 'av1', situacao: 'compareceu', inicio: '2026-10-20T17:00:00.000Z' }),
        sessaoExemplo({ id: 'b', tipo: 'avaliacao', avaliacaoId: 'av1', situacao: 'falta_sem_aviso', inicio: '2026-10-27T17:00:00.000Z' }),
        sessaoExemplo({ id: ID, tipo: 'avaliacao', avaliacaoId: 'av1' }),
      ],
    });
    abrirPainel(repositorio);

    expect(await screen.findByText('sessão 2 de 8')).toBeInTheDocument();
  });

  describe('situação', () => {
    it.each([
      ['Compareceu', 'compareceu'],
      ['Faltou com aviso', 'falta_com_aviso'],
      ['Faltou sem aviso', 'falta_sem_aviso'],
      ['Cancelar sessão', 'cancelada'],
    ])('"%s" grava a situação %s e o botão fica marcado', async (botao, situacao) => {
      const { usuaria, repositorio } = abrirPainel();

      await usuaria.click(await screen.findByRole('button', { name: botao }));

      await waitFor(() => expect(screen.getByRole('button', { name: botao })).toHaveAttribute('aria-pressed', 'true'));
      expect((await sessaoGravada(repositorio))?.situacao).toBe(situacao);
      expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
    });

    it('"Voltar para Agendada" desfaz a marcação: o chip volta a "Agendada" e nenhum botão fica marcado', async () => {
      const { usuaria, repositorio } = abrirPainel();
      await usuaria.click(await screen.findByRole('button', { name: 'Faltou sem aviso' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Faltou sem aviso' })).toHaveAttribute('aria-pressed', 'true'));
      expect(screen.getByText('Faltou sem aviso', { selector: 'span' })).toBeInTheDocument();

      await usuaria.click(screen.getByRole('button', { name: 'Voltar para Agendada' }));

      await waitFor(() => expect(screen.getByText('Agendada', { selector: 'span' })).toBeInTheDocument());
      expect(screen.queryByRole('button', { pressed: true })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Voltar para Agendada' })).not.toBeInTheDocument();
      expect((await sessaoGravada(repositorio))?.situacao).toBe('agendada');
    });

    it('"Voltar para Agendada" só aparece depois de marcada uma situação', async () => {
      abrirPainel();

      await screen.findByRole('button', { name: 'Compareceu' });
      expect(screen.queryByRole('button', { name: 'Voltar para Agendada' })).not.toBeInTheDocument();
    });

    it('tocar de novo no botão já marcado não desmarca (só "Voltar para Agendada" desfaz)', async () => {
      const { usuaria, repositorio } = abrirPainel();
      await usuaria.click(await screen.findByRole('button', { name: 'Cancelar sessão' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar sessão' })).toHaveAttribute('aria-pressed', 'true'));

      await usuaria.click(screen.getByRole('button', { name: 'Cancelar sessão' }));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar sessão' })).toHaveAttribute('aria-pressed', 'true'));
      expect((await sessaoGravada(repositorio))?.situacao).toBe('cancelada');
    });

    it('o primeiro comparecimento define a data de entrada do paciente', async () => {
      const { usuaria, repositorio } = abrirPainel();

      await usuaria.click(await screen.findByRole('button', { name: 'Compareceu' }));

      await waitFor(async () => expect((await repositorio.obterFicha('p1'))?.paciente.dataEntrada).toBe('2026-11-03'));
    });

    it('avisa quando não foi possível gravar e deixa tentar de novo', async () => {
      const { usuaria, repositorio } = abrirPainel();
      const atualizar = vi.spyOn(repositorio, 'atualizarSessao').mockRejectedValueOnce(new Error('sem rede'));

      await usuaria.click(await screen.findByRole('button', { name: 'Faltou sem aviso' }));
      expect(await screen.findByText('Não foi possível salvar. Tente de novo.')).toBeInTheDocument();

      await usuaria.click(screen.getByRole('button', { name: 'Faltou sem aviso' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Faltou sem aviso' })).toHaveAttribute('aria-pressed', 'true'));
      expect(screen.queryByText('Não foi possível salvar. Tente de novo.')).not.toBeInTheDocument();
      expect(atualizar).toHaveBeenCalledTimes(2);
    });
  });

  describe('remarcar', () => {
    it('cria a nova sessão na data e hora escolhidas e mostra "Remarcada para {dia}, {hora}"', async () => {
      const { usuaria, repositorio } = abrirPainel();

      await usuaria.type(await screen.findByLabelText('Nova data'), '2026-11-05');
      await usuaria.type(screen.getByLabelText('Nova hora'), '15:00');
      await usuaria.click(screen.getByRole('button', { name: 'Remarcar' }));

      expect(await screen.findByText('Remarcada para quinta-feira, 05/11, 15:00')).toBeInTheDocument();
      expect(screen.getByText('Remarcada')).toBeInTheDocument();
      const todas = await repositorio.listarSessoesDoPaciente('p1');
      const nova = todas.find((s) => s.id !== ID);
      expect(nova).toMatchObject({ inicio: instanteDe('2026-11-05', '15:00'), situacao: 'agendada', origem: 'remarcacao' });
      expect(todas.find((s) => s.id === ID)).toMatchObject({ situacao: 'remarcada', remarcadaPara: nova?.id });
    });

    it('sem os botões de situação, nem o formulário de remarcar, depois de remarcada', async () => {
      const { usuaria } = abrirPainel();
      await usuaria.type(await screen.findByLabelText('Nova data'), '2026-11-05');
      await usuaria.type(screen.getByLabelText('Nova hora'), '15:00');
      await usuaria.click(screen.getByRole('button', { name: 'Remarcar' }));
      await screen.findByText('Remarcada para quinta-feira, 05/11, 15:00');

      for (const nome of ['Compareceu', 'Faltou com aviso', 'Faltou sem aviso', 'Cancelar sessão', 'Remarcar']) {
        expect(screen.queryByRole('button', { name: nome })).not.toBeInTheDocument();
      }
      expect(screen.queryByLabelText('Nova data')).not.toBeInTheDocument();
      // Ainda dá para mexer na observação.
      expect(screen.getByLabelText('Observação')).toBeInTheDocument();
    });

    it('uma sessão já remarcada, aberta de novo, mostra o destino mesmo em outra semana', async () => {
      const repositorio = criarRepositorioMemoria({
        pacientes: [pacienteExemplo()],
        sessoes: [
          sessaoExemplo({ id: ID, situacao: 'remarcada', remarcadaPara: 'destino' }),
          sessaoExemplo({ id: 'destino', inicio: instanteDe('2026-11-17', '16:30'), origem: 'remarcacao' }),
        ],
      });
      abrirPainel(repositorio);

      expect(await screen.findByText('Remarcada para terça-feira, 17/11, 16:30')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Compareceu' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Remarcar' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Voltar para Agendada' })).not.toBeInTheDocument();
    });

    it.each([
      ['compareceu', false],
      ['falta_sem_aviso', false],
      ['agendada', true],
      ['falta_com_aviso', true],
      ['cancelada', true],
    ] as const)('sessão %s: oferece remarcar? %s (a que já é cobrada não pode virar "remarcada")', async (situacao, oferece) => {
      abrirPainel(repositorioCom(sessaoExemplo({ situacao })));

      await screen.findByText('terça-feira, 03/11 · 14:00 · 50 min');
      expect(screen.queryByRole('button', { name: 'Remarcar' }) !== null).toBe(oferece);
      expect(screen.queryByLabelText('Nova data') !== null).toBe(oferece);
      // A situação continua podendo ser corrigida.
      expect(screen.getByRole('button', { name: 'Compareceu' })).toBeInTheDocument();
    });

    it('marcar "Compareceu" tira o remarcar; "Voltar para Agendada" traz de volta', async () => {
      const { usuaria } = abrirPainel();
      await usuaria.click(await screen.findByRole('button', { name: 'Compareceu' }));
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Remarcar' })).not.toBeInTheDocument());

      await usuaria.click(screen.getByRole('button', { name: 'Voltar para Agendada' }));

      expect(await screen.findByRole('button', { name: 'Remarcar' })).toBeInTheDocument();
    });

    it('pede data e hora, e não cria nada quando faltam', async () => {
      const { usuaria, repositorio } = abrirPainel();

      await usuaria.click(await screen.findByRole('button', { name: 'Remarcar' }));

      expect(screen.getByText('Informe a nova data.')).toBeInTheDocument();
      expect(screen.getByText('Informe a nova hora.')).toBeInTheDocument();
      expect(await repositorio.listarSessoesDoPaciente('p1')).toHaveLength(1);
    });

    it('recusa o mesmo dia e a mesma hora', async () => {
      const { usuaria } = abrirPainel();
      await usuaria.type(await screen.findByLabelText('Nova data'), '2026-11-03');
      await usuaria.type(screen.getByLabelText('Nova hora'), '14:00');

      await usuaria.click(screen.getByRole('button', { name: 'Remarcar' }));

      expect(screen.getByText('Escolha uma data ou uma hora diferente da atual.')).toBeInTheDocument();
    });

    it('avisa quando a remarcação falha', async () => {
      const { usuaria, repositorio } = abrirPainel();
      vi.spyOn(repositorio, 'criarSessao').mockRejectedValue(new Error('sem rede'));
      await usuaria.type(await screen.findByLabelText('Nova data'), '2026-11-05');
      await usuaria.type(screen.getByLabelText('Nova hora'), '15:00');

      await usuaria.click(screen.getByRole('button', { name: 'Remarcar' }));

      expect(await screen.findByText('Não foi possível remarcar. Confira a agenda antes de tentar de novo.')).toBeInTheDocument();
    });
  });

  describe('acompanhamento familiar', () => {
    it('liga e desliga, gravando na sessão', async () => {
      const { usuaria, repositorio } = abrirPainel();
      const caixa = await screen.findByRole('checkbox', { name: 'Acompanhamento familiar' });

      await usuaria.click(caixa);
      await waitFor(() => expect(screen.getByText('Acompanhamento familiar', { selector: 'span' })).toBeInTheDocument());
      expect(caixa).toBeChecked();
      expect((await sessaoGravada(repositorio))?.acompanhamentoFamiliar).toBe(true);

      await usuaria.click(caixa);
      await waitFor(async () => expect((await sessaoGravada(repositorio))?.acompanhamentoFamiliar).toBe(false));
      expect(caixa).not.toBeChecked();
    });

    it('já vem ligado numa sessão familiar, com o rótulo do tipo "Acompanhamento familiar"', async () => {
      abrirPainel(repositorioCom(sessaoExemplo({ acompanhamentoFamiliar: true })));

      expect(await screen.findByRole('checkbox', { name: 'Acompanhamento familiar' })).toBeChecked();
      expect(screen.queryByText('Psicoterapia')).not.toBeInTheDocument();
    });
  });

  describe('observação', () => {
    it('mostra a que já existe e grava o que for digitado', async () => {
      const { usuaria, repositorio } = abrirPainel(repositorioCom(sessaoExemplo({ observacao: 'Trazer o caderno.' })));
      const campo = await screen.findByLabelText('Observação');
      expect(campo).toHaveValue('Trazer o caderno.');

      await usuaria.clear(campo);
      await usuaria.type(campo, '  Combinar a devolutiva.  ');
      await usuaria.click(screen.getByRole('button', { name: 'Salvar observação' }));

      expect(await screen.findByText('Observação salva.')).toBeInTheDocument();
      expect((await sessaoGravada(repositorio))?.observacao).toBe('Combinar a devolutiva.');
    });

    it('apagar o texto grava a observação como vazia', async () => {
      const { usuaria, repositorio } = abrirPainel(repositorioCom(sessaoExemplo({ observacao: 'Algo' })));

      await usuaria.clear(await screen.findByLabelText('Observação'));
      await usuaria.click(screen.getByRole('button', { name: 'Salvar observação' }));

      await screen.findByText('Observação salva.');
      expect((await sessaoGravada(repositorio))?.observacao).toBeNull();
    });

    it('avisa quando não foi possível salvar', async () => {
      const { usuaria, repositorio } = abrirPainel();
      vi.spyOn(repositorio, 'atualizarSessao').mockRejectedValue(new Error('sem rede'));

      await usuaria.type(await screen.findByLabelText('Observação'), 'Oi');
      await usuaria.click(screen.getByRole('button', { name: 'Salvar observação' }));

      expect(await screen.findByText('Não foi possível salvar a observação. Tente de novo.')).toBeInTheDocument();
      expect(screen.queryByText('Observação salva.')).not.toBeInTheDocument();
    });
  });
});

/** A sessão `s1` (terça 03/11, 14:00) de um paciente cuja cobrança, avaliação e pagamentos o teste escolhe. */
function abrirCobranca(
  e: {
    sessao?: Partial<Sessao>;
    paciente?: Partial<Paciente>;
    pagamentos?: Pagamento[];
    avaliacao?: Avaliacao;
    /** A semana (segunda e domingo) em que está a sessão, quando não é a de 03/11. */
    semana?: readonly [string, string];
  } = {},
) {
  const repositorio = criarRepositorioMemoria({
    pacientes: [pacienteExemplo({ dataEntrada: null, ...e.paciente })],
    avaliacoes: e.avaliacao ? [e.avaliacao] : [],
    sessoes: [sessaoExemplo(e.sessao)],
    pagamentos: e.pagamentos ?? [],
  });
  return abrirPainel(repositorio, e.semana);
}

const FORMULARIO = { name: 'Registrar pagamento' };

describe('cobrança da sessão', () => {
  const feita = { situacao: 'compareceu', valorCentavos: 20000 } as const;

  describe('o que o painel diz', () => {
    it('por sessão, com valor e sem pagamento: "Pendente · R$ 200,00" e o botão "Registrar pagamento"', async () => {
      abrirCobranca({ sessao: feita });

      expect(await screen.findByText('Pendente · R$ 200,00')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Registrar pagamento' })).toBeInTheDocument();
      expect(screen.queryByRole('form', FORMULARIO)).not.toBeInTheDocument();
    });

    it('a falta sem aviso da avaliação também fica pendente, no valor da sessão', async () => {
      abrirCobranca({
        paciente: { tipo: 'avaliacao', valorSessaoCentavos: 16000 },
        avaliacao: avaliacaoExemplo(),
        sessao: { tipo: 'avaliacao', avaliacaoId: 'av1', situacao: 'falta_sem_aviso', valorCentavos: 16000 },
      });

      expect(await screen.findByText('Pendente · R$ 160,00')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Registrar pagamento' })).toBeInTheDocument();
    });

    it('paga: "Pago em 01/11 · Pix", sem botão de pagar (data só com dia e mês)', async () => {
      abrirCobranca({ sessao: feita, pagamentos: [pagamentoExemplo({ data: '2026-11-01', forma: 'pix' })] });

      expect(await screen.findByText('Pago em 01/11 · Pix')).toBeInTheDocument();
      expect(screen.queryByText(/^Pendente/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Registrar pagamento' })).not.toBeInTheDocument();
    });

    it('a forma do pagamento aparece pelo rótulo: "Transferência"', async () => {
      abrirCobranca({ sessao: feita, pagamentos: [pagamentoExemplo({ data: '2026-10-30', forma: 'transferencia' })] });

      expect(await screen.findByText('Pago em 30/10 · Transferência')).toBeInTheDocument();
    });

    it('só vale o pagamento que lista esta sessão: o de outra sessão não a quita', async () => {
      abrirCobranca({ sessao: feita, pagamentos: [pagamentoExemplo({ sessaoIds: ['outra'] })] });

      expect(await screen.findByText('Pendente · R$ 200,00')).toBeInTheDocument();
      expect(screen.queryByText(/^Pago em/)).not.toBeInTheDocument();
    });

    it('psicoterapia de quem paga por mês, com valor: "Entra na mensalidade de novembro de 2026"', async () => {
      abrirCobranca({ paciente: { formaCobranca: 'mensal' }, sessao: feita });

      expect(await screen.findByText('Entra na mensalidade de novembro de 2026')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Registrar pagamento' })).not.toBeInTheDocument();
      expect(screen.queryByText(/^Pendente/)).not.toBeInTheDocument();
    });

    const doMes = (valorCentavos: number) =>
      pagamentoExemplo({ referencia: 'mes', mesReferencia: '2026-11-01', sessaoIds: [], valorCentavos });

    it('mês já pago por inteiro: "Paga na mensalidade de novembro de 2026", não "Entra na mensalidade"', async () => {
      abrirCobranca({ paciente: { formaCobranca: 'mensal' }, sessao: feita, pagamentos: [doMes(20000)] });

      expect(await screen.findByText('Paga na mensalidade de novembro de 2026')).toBeInTheDocument();
      expect(screen.queryByText(/^Entra na mensalidade/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Registrar pagamento' })).not.toBeInTheDocument();
    });

    it('mês pago antes desta sessão (ainda falta a diferença): continua "Entra na mensalidade"', async () => {
      abrirCobranca({
        paciente: { formaCobranca: 'mensal' },
        sessao: feita,
        pagamentos: [doMes(10000)],
      });

      expect(await screen.findByText('Entra na mensalidade de novembro de 2026')).toBeInTheDocument();
      expect(screen.queryByText(/^Paga na mensalidade/)).not.toBeInTheDocument();
    });

    it('quem passou a pagar por sessão depois de pagar o mês: a sessão desse mês é da mensalidade, não "Pendente"', async () => {
      abrirCobranca({ paciente: { formaCobranca: 'por_sessao' }, sessao: feita, pagamentos: [doMes(20000)] });

      expect(await screen.findByText('Paga na mensalidade de novembro de 2026')).toBeInTheDocument();
      expect(screen.queryByText(/^Pendente/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Registrar pagamento' })).not.toBeInTheDocument();
    });

    it('o mês da mensalidade é o da data LOCAL: 30/11 às 23:30 em São Paulo ainda é novembro (em UTC já é dezembro)', async () => {
      abrirCobranca({
        paciente: { formaCobranca: 'mensal' },
        sessao: { ...feita, inicio: instanteDe('2026-11-30', '23:30') },
        semana: ['2026-11-30', '2026-12-06'],
      });

      expect(await screen.findByText('Entra na mensalidade de novembro de 2026')).toBeInTheDocument();
    });

    it('comparecimento na avaliação: "Incluída no pacote da avaliação"', async () => {
      abrirCobranca({
        paciente: { tipo: 'avaliacao' },
        avaliacao: avaliacaoExemplo(),
        sessao: { tipo: 'avaliacao', avaliacaoId: 'av1', situacao: 'compareceu', valorCentavos: null },
      });

      expect(await screen.findByText('Incluída no pacote da avaliação')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Registrar pagamento' })).not.toBeInTheDocument();
    });

    const SEM_COBRANCA =
      'Sem cobrança: o valor desta sessão está em R$ 0,00. Para cobrar, ajuste o valor na ficha do paciente, toque em Voltar para Agendada e marque de novo.';

    it.each([
      ['de quem paga por sessão', { paciente: { valorSessaoCentavos: 0 }, sessao: { situacao: 'compareceu', valorCentavos: 0 } }],
      [
        'de quem paga por mês',
        { paciente: { formaCobranca: 'mensal', valorSessaoCentavos: 0 }, sessao: { situacao: 'falta_sem_aviso', valorCentavos: 0 } },
      ],
      [
        'da falta sem aviso na avaliação',
        {
          paciente: { tipo: 'avaliacao', valorSessaoCentavos: 0 },
          sessao: { tipo: 'avaliacao', situacao: 'falta_sem_aviso', valorCentavos: 0 },
        },
      ],
    ] as const)('sessão cobrada de valor zero %s: avisa que não há cobrança e como corrigir', async (_nome, caso) => {
      abrirCobranca({ paciente: caso.paciente, sessao: caso.sessao });

      expect(await screen.findByText(SEM_COBRANCA)).toBeInTheDocument();
      for (const texto of [/^Pendente/, /^Pago em/, /^Entra na mensalidade/, /^Paga na mensalidade/]) {
        expect(screen.queryByText(texto)).not.toBeInTheDocument();
      }
      expect(screen.queryByRole('button', { name: 'Registrar pagamento' })).not.toBeInTheDocument();
    });

    it('"Voltar para Agendada" e marcar de novo, com o valor já corrigido, passa a cobrar a sessão', async () => {
      const { usuaria, repositorio } = abrirCobranca({ sessao: { situacao: 'compareceu', valorCentavos: 0 } });
      await screen.findByText(SEM_COBRANCA);

      await usuaria.click(screen.getByRole('button', { name: 'Voltar para Agendada' }));
      await waitFor(() => expect(screen.queryByText(SEM_COBRANCA)).not.toBeInTheDocument());
      await usuaria.click(screen.getByRole('button', { name: 'Compareceu' }));

      // O paciente da fábrica vale R$ 200,00.
      expect(await screen.findByText('Pendente · R$ 200,00')).toBeInTheDocument();
      expect((await sessaoGravada(repositorio))?.valorCentavos).toBe(20000);
    });

    it.each([
      ['ainda agendada (sem valor)', { paciente: {}, sessao: {} }],
      ['sem valor', { paciente: {}, sessao: { situacao: 'compareceu', valorCentavos: null } }],
      ['faltou com aviso', { paciente: {}, sessao: { situacao: 'falta_com_aviso', valorCentavos: null } }],
      ['de avaliação ainda agendada', { paciente: { tipo: 'avaliacao' }, sessao: { tipo: 'avaliacao' } }],
      [
        'com aviso de quem tem valor zero',
        { paciente: { valorSessaoCentavos: 0 }, sessao: { situacao: 'falta_com_aviso', valorCentavos: null } },
      ],
    ] as const)('sessão %s: não diz nada de cobrança', async (_nome, caso) => {
      abrirCobranca({ paciente: caso.paciente, sessao: caso.sessao });

      await screen.findByText('terça-feira, 03/11 · 14:00 · 50 min');
      // Dá tempo de a ficha, as sessões e os pagamentos chegarem.
      await waitFor(() => expect(screen.getByLabelText('Observação')).toBeInTheDocument());
      for (const texto of [/^Pendente/, /^Pago em/, /^Entra na mensalidade/, /^Paga na mensalidade/, /^Incluída no pacote/, /^Sem cobrança/]) {
        expect(screen.queryByText(texto)).not.toBeInTheDocument();
      }
      expect(screen.queryByRole('button', { name: 'Registrar pagamento' })).not.toBeInTheDocument();
    });

    it.each(['listarPagamentos', 'listarSessoesDoPaciente', 'obterFicha'] as const)(
      'avisa quando não consegue ler (%s), em vez de calar',
      async (leitura) => {
        const repositorio = repositorioCom();
        vi.spyOn(repositorio, leitura).mockRejectedValue(new Error('sem rede'));
        abrirPainel(repositorio);

        expect(await screen.findByText('Não foi possível carregar a cobrança desta sessão.')).toBeInTheDocument();
      },
    );
  });

  describe('ao mudar a situação', () => {
    it('"Compareceu" de quem paga por sessão passa a mostrar "Pendente" com o valor do paciente', async () => {
      const { usuaria, repositorio } = abrirCobranca();

      await usuaria.click(await screen.findByRole('button', { name: 'Compareceu' }));

      expect(await screen.findByText('Pendente · R$ 200,00')).toBeInTheDocument();
      expect((await sessaoGravada(repositorio))?.valorCentavos).toBe(20000);
    });

    it('"Faltou com aviso" tira a linha de cobrança', async () => {
      const { usuaria } = abrirCobranca({ sessao: feita });
      await screen.findByText('Pendente · R$ 200,00');

      await usuaria.click(screen.getByRole('button', { name: 'Faltou com aviso' }));

      await waitFor(() => expect(screen.queryByText(/^Pendente/)).not.toBeInTheDocument());
      expect(screen.queryByRole('button', { name: 'Registrar pagamento' })).not.toBeInTheDocument();
    });

    it('sessão paga: "Faltou com aviso" mostra a recusa, o chip continua "Compareceu" e nada é gravado', async () => {
      const { usuaria, repositorio } = abrirCobranca({ sessao: feita, pagamentos: [pagamentoExemplo()] });
      await screen.findByText('Pago em 01/11 · Pix');
      const atualizar = vi.spyOn(repositorio, 'atualizarSessao');

      await usuaria.click(screen.getByRole('button', { name: 'Faltou com aviso' }));

      const aviso = await screen.findByRole('alert');
      expect(aviso).toHaveTextContent('Esta sessão já foi paga. Para mudar a situação, remova o pagamento na ficha do paciente.');
      expect(screen.queryByText('Não foi possível salvar. Tente de novo.')).not.toBeInTheDocument();
      expect(screen.getByText('Compareceu', { selector: 'span' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Compareceu' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('Pago em 01/11 · Pix')).toBeInTheDocument();
      expect(atualizar).not.toHaveBeenCalled();
      expect((await sessaoGravada(repositorio))?.situacao).toBe('compareceu');
    });

    it('sessão paga: "Voltar para Agendada" também é recusado com a mesma mensagem', async () => {
      const { usuaria } = abrirCobranca({ sessao: feita, pagamentos: [pagamentoExemplo()] });

      await usuaria.click(await screen.findByRole('button', { name: 'Voltar para Agendada' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Esta sessão já foi paga.');
      expect(screen.getByText('Compareceu', { selector: 'span' })).toBeInTheDocument();
    });

    it('a recusa some quando a próxima mudança dá certo', async () => {
      const { usuaria } = abrirCobranca({ sessao: feita, pagamentos: [pagamentoExemplo()] });
      await usuaria.click(await screen.findByRole('button', { name: 'Faltou com aviso' }));
      await screen.findByRole('alert');

      // Continua cobrada, então a mudança é permitida.
      await usuaria.click(screen.getByRole('button', { name: 'Faltou sem aviso' }));

      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Faltou sem aviso' })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('registrar o pagamento', () => {
    it('abre o formulário com o valor fixo, a data de hoje e Pix; "Cancelar" fecha e devolve o botão', async () => {
      const { usuaria } = abrirCobranca({ sessao: feita });

      await usuaria.click(await screen.findByRole('button', { name: 'Registrar pagamento' }));

      const formulario = screen.getByRole('form', FORMULARIO);
      expect(within(formulario).getByLabelText('Data')).toHaveValue('2026-11-02');
      expect(within(formulario).getByRole('radio', { name: 'Pix' })).toBeChecked();
      expect(within(formulario).getByText('Valor: R$ 200,00')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Registrar pagamento' })).not.toBeInTheDocument();

      await usuaria.click(within(formulario).getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('form', FORMULARIO)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Registrar pagamento' })).toBeInTheDocument();
      expect(screen.getByText('Pendente · R$ 200,00')).toBeInTheDocument();
    });

    it('"Confirmar pagamento" grava o pagamento desta sessão com o valor guardado e passa a "Pago em 02/11 · Pix"', async () => {
      const { usuaria, repositorio } = abrirCobranca({ sessao: feita });
      await usuaria.click(await screen.findByRole('button', { name: 'Registrar pagamento' }));

      await usuaria.click(within(screen.getByRole('form', FORMULARIO)).getByRole('button', { name: 'Confirmar pagamento' }));

      expect(await screen.findByText('Pago em 02/11 · Pix')).toBeInTheDocument();
      expect(screen.queryByRole('form', FORMULARIO)).not.toBeInTheDocument();
      expect(screen.queryByText(/^Pendente/)).not.toBeInTheDocument();
      expect(await repositorio.listarPagamentos({ pacienteId: 'p1' })).toEqual([
        expect.objectContaining({
          referencia: 'sessoes',
          sessaoIds: [ID],
          valorCentavos: 20000,
          data: '2026-11-02',
          forma: 'pix',
          observacao: null,
        }),
      ]);
    });

    it('usa a data, a forma e a observação escolhidas', async () => {
      const { usuaria, repositorio } = abrirCobranca({ sessao: feita });
      await usuaria.click(await screen.findByRole('button', { name: 'Registrar pagamento' }));
      const formulario = screen.getByRole('form', FORMULARIO);
      const data = within(formulario).getByLabelText('Data');
      await usuaria.clear(data);
      await usuaria.type(data, '2026-10-30');
      await usuaria.click(within(formulario).getByRole('radio', { name: 'Dinheiro' }));
      await usuaria.type(within(formulario).getByLabelText('Observação'), 'Trocado.');

      await usuaria.click(within(formulario).getByRole('button', { name: 'Confirmar pagamento' }));

      expect(await screen.findByText('Pago em 30/10 · Dinheiro')).toBeInTheDocument();
      expect(await repositorio.listarPagamentos({ pacienteId: 'p1' })).toEqual([
        expect.objectContaining({ data: '2026-10-30', forma: 'dinheiro', observacao: 'Trocado.' }),
      ]);
    });

    it('depois de pago, mudar a situação passa a ser recusado', async () => {
      const { usuaria } = abrirCobranca({ sessao: feita });
      await usuaria.click(await screen.findByRole('button', { name: 'Registrar pagamento' }));
      await usuaria.click(within(screen.getByRole('form', FORMULARIO)).getByRole('button', { name: 'Confirmar pagamento' }));
      await screen.findByText('Pago em 02/11 · Pix');

      await usuaria.click(screen.getByRole('button', { name: 'Cancelar sessão' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Esta sessão já foi paga.');
    });

    it('pede a data quando ela é apagada, sem gravar nada', async () => {
      const { usuaria, repositorio } = abrirCobranca({ sessao: feita });
      await usuaria.click(await screen.findByRole('button', { name: 'Registrar pagamento' }));
      const formulario = screen.getByRole('form', FORMULARIO);
      await usuaria.clear(within(formulario).getByLabelText('Data'));

      await usuaria.click(within(formulario).getByRole('button', { name: 'Confirmar pagamento' }));

      expect(within(formulario).getByText('Informe a data do pagamento.')).toBeInTheDocument();
      expect(await repositorio.listarPagamentos({ pacienteId: 'p1' })).toEqual([]);
    });

    it('enquanto grava, o botão fica desligado e só um pagamento é criado', async () => {
      const { usuaria, repositorio } = abrirCobranca({ sessao: feita });
      const registrar = repositorio.registrarPagamento.bind(repositorio);
      let liberar: () => void = () => {};
      const espia = vi
        .spyOn(repositorio, 'registrarPagamento')
        .mockImplementation((p) => new Promise((resolve) => (liberar = () => resolve(registrar(p)))));
      await usuaria.click(await screen.findByRole('button', { name: 'Registrar pagamento' }));
      await usuaria.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));

      const gravando = await screen.findByRole('button', { name: 'Registrando…' });
      expect(gravando).toBeDisabled();
      await usuaria.click(gravando);
      liberar();

      expect(await screen.findByText('Pago em 02/11 · Pix')).toBeInTheDocument();
      expect(espia).toHaveBeenCalledTimes(1);
    });

    it('avisa quando não foi possível gravar, mantém o formulário e deixa tentar de novo', async () => {
      const { usuaria, repositorio } = abrirCobranca({ sessao: feita });
      vi.spyOn(repositorio, 'registrarPagamento').mockRejectedValueOnce(new Error('sem rede'));
      await usuaria.click(await screen.findByRole('button', { name: 'Registrar pagamento' }));
      await usuaria.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));

      expect(await screen.findByText('Não foi possível registrar o pagamento. Tente de novo.')).toBeInTheDocument();
      expect(screen.getByRole('form', FORMULARIO)).toBeInTheDocument();

      await usuaria.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));

      expect(await screen.findByText('Pago em 02/11 · Pix')).toBeInTheDocument();
    });

    it('mostra do jeito que está a mensagem de uma recusa do serviço', async () => {
      const { usuaria, repositorio } = abrirCobranca({ sessao: feita });
      vi.spyOn(repositorio, 'registrarPagamento').mockRejectedValueOnce(new ErroCobranca('Este mês não tem nada a receber.'));
      await usuaria.click(await screen.findByRole('button', { name: 'Registrar pagamento' }));

      await usuaria.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));

      expect(await screen.findByText('Este mês não tem nada a receber.')).toBeInTheDocument();
      expect(screen.queryByText('Não foi possível registrar o pagamento. Tente de novo.')).not.toBeInTheDocument();
      expect(screen.getByRole('form', FORMULARIO)).toBeInTheDocument();
    });

    it('se a sessão foi paga em outro aparelho com o formulário aberto, não duplica: o painel passa a mostrar o pagamento', async () => {
      const { usuaria, repositorio } = abrirCobranca({ sessao: feita });
      await usuaria.click(await screen.findByRole('button', { name: 'Registrar pagamento' }));
      await repositorio.registrarPagamento({
        pacienteId: 'p1',
        data: '2026-11-01',
        valorCentavos: 20000,
        forma: 'pix',
        observacao: null,
        referencia: 'sessoes',
        mesReferencia: null,
        avaliacaoId: null,
        sessaoIds: [ID],
      });

      await usuaria.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));

      expect(await screen.findByText('Pago em 01/11 · Pix')).toBeInTheDocument();
      expect(screen.queryByRole('form', FORMULARIO)).not.toBeInTheDocument();
      expect(await repositorio.listarPagamentos({ pacienteId: 'p1' })).toHaveLength(1);
    });
  });
});

describe('reposição da falta na avaliação', () => {
  const avaliacao = {
    paciente: { tipo: 'avaliacao', valorSessaoCentavos: 16000 },
    avaliacao: avaliacaoExemplo(),
  } as const;
  const falta = { tipo: 'avaliacao', avaliacaoId: 'av1', situacao: 'falta_sem_aviso', valorCentavos: 16000 } as const;
  const bloco = () => screen.queryByRole('heading', { name: 'Agendar reposição' });

  it('falta sem aviso na avaliação, sem reposição: mostra data, hora e o botão "Agendar reposição"', async () => {
    abrirCobranca({ ...avaliacao, sessao: falta });

    expect(await screen.findByRole('heading', { name: 'Agendar reposição' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nova data')).toBeInTheDocument();
    expect(screen.getByLabelText('Nova hora')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agendar reposição' })).toBeInTheDocument();
    // Cobrada, a sessão não é remarcada: só há um formulário de data e hora.
    expect(screen.queryByRole('button', { name: 'Remarcar' })).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('Nova data')).toHaveLength(1);
  });

  it.each([
    ['compareceu', { tipo: 'avaliacao', avaliacaoId: 'av1', situacao: 'compareceu' }, avaliacao],
    ['ainda agendada', { tipo: 'avaliacao', avaliacaoId: 'av1' }, avaliacao],
    ['faltou com aviso', { tipo: 'avaliacao', avaliacaoId: 'av1', situacao: 'falta_com_aviso' }, avaliacao],
    ['psicoterapia que faltou sem aviso', { situacao: 'falta_sem_aviso', valorCentavos: 20000 }, {}],
  ] as const)('sessão %s: não oferece reposição', async (_nome, sessao, resto) => {
    abrirCobranca({ ...resto, sessao });

    await screen.findByText('terça-feira, 03/11 · 14:00 · 50 min');
    await waitFor(() => expect(screen.getByLabelText('Observação')).toBeInTheDocument());
    expect(bloco()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agendar reposição' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Reposição em/)).not.toBeInTheDocument();
  });

  it('"Agendar reposição" cria a sessão no horário escolhido e passa a dizer "Reposição em sexta-feira, 06/11, 10:00"', async () => {
    const { usuaria, repositorio } = abrirCobranca({ ...avaliacao, sessao: falta });
    await usuaria.type(await screen.findByLabelText('Nova data'), '2026-11-06');
    await usuaria.type(screen.getByLabelText('Nova hora'), '10:00');

    await usuaria.click(screen.getByRole('button', { name: 'Agendar reposição' }));

    expect(await screen.findByText('Reposição em sexta-feira, 06/11, 10:00')).toBeInTheDocument();
    expect(bloco()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agendar reposição' })).not.toBeInTheDocument();
    // A original continua "Faltou sem aviso" e cobrada à parte.
    expect(screen.getByText('Faltou sem aviso', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Pendente · R$ 160,00')).toBeInTheDocument();
    const todas = await repositorio.listarSessoesDoPaciente('p1');
    const nova = todas.find((s) => s.id !== ID);
    expect(nova).toMatchObject({ inicio: instanteDe('2026-11-06', '10:00'), situacao: 'agendada', origem: 'remarcacao', tipo: 'avaliacao' });
    expect(todas.find((s) => s.id === ID)).toMatchObject({ situacao: 'falta_sem_aviso', remarcadaPara: nova?.id });
  });

  it('uma falta que já tem reposição, aberta de novo, mostra o dia mesmo em outra semana', async () => {
    const repositorio = criarRepositorioMemoria({
      pacientes: [pacienteExemplo(avaliacao.paciente)],
      avaliacoes: [avaliacao.avaliacao],
      sessoes: [
        sessaoExemplo({ id: ID, ...falta, remarcadaPara: 'repo' }),
        sessaoExemplo({ id: 'repo', tipo: 'avaliacao', avaliacaoId: 'av1', inicio: instanteDe('2026-11-17', '16:30'), origem: 'remarcacao' }),
      ],
    });
    abrirPainel(repositorio);

    expect(await screen.findByText('Reposição em terça-feira, 17/11, 16:30')).toBeInTheDocument();
    expect(bloco()).not.toBeInTheDocument();
  });

  it('pede data e hora, e não cria nada quando faltam', async () => {
    const { usuaria, repositorio } = abrirCobranca({ ...avaliacao, sessao: falta });

    await usuaria.click(await screen.findByRole('button', { name: 'Agendar reposição' }));

    expect(screen.getByText('Informe a nova data.')).toBeInTheDocument();
    expect(screen.getByText('Informe a nova hora.')).toBeInTheDocument();
    expect(await repositorio.listarSessoesDoPaciente('p1')).toHaveLength(1);
  });

  it('enquanto cria, o botão fica desligado e só uma sessão é criada', async () => {
    const { usuaria, repositorio } = abrirCobranca({ ...avaliacao, sessao: falta });
    const criar = repositorio.criarSessao.bind(repositorio);
    let liberar: () => void = () => {};
    const espia = vi
      .spyOn(repositorio, 'criarSessao')
      .mockImplementation((s) => new Promise((resolve) => (liberar = () => resolve(criar(s)))));
    await usuaria.type(await screen.findByLabelText('Nova data'), '2026-11-06');
    await usuaria.type(screen.getByLabelText('Nova hora'), '10:00');
    await usuaria.click(screen.getByRole('button', { name: 'Agendar reposição' }));

    const agendando = await screen.findByRole('button', { name: 'Agendando…' });
    expect(agendando).toBeDisabled();
    await usuaria.click(agendando);
    liberar();

    expect(await screen.findByText('Reposição em sexta-feira, 06/11, 10:00')).toBeInTheDocument();
    expect(espia).toHaveBeenCalledTimes(1);
    expect(await repositorio.listarSessoesDoPaciente('p1')).toHaveLength(2);
  });

  it('avisa quando a reposição falha', async () => {
    const { usuaria, repositorio } = abrirCobranca({ ...avaliacao, sessao: falta });
    vi.spyOn(repositorio, 'criarSessao').mockRejectedValue(new Error('sem rede'));
    await usuaria.type(await screen.findByLabelText('Nova data'), '2026-11-06');
    await usuaria.type(screen.getByLabelText('Nova hora'), '10:00');

    await usuaria.click(screen.getByRole('button', { name: 'Agendar reposição' }));

    expect(await screen.findByText('Não foi possível agendar a reposição. Confira a agenda antes de tentar de novo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agendar reposição' })).toBeEnabled();
  });
});

