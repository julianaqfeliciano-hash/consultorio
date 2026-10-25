import { act, screen, waitFor, within } from '@testing-library/react';
import { focusManager } from '@tanstack/react-query';
import { criarRepositorioMemoria } from '../../dados/memoria';
import type { Repositorio } from '../../dados/repositorio';
import { garantirAgenda } from '../../servicos/agenda';
import { horarioExemplo, pacienteExemplo } from '../../testes/fabricas';
import { abrirFicha, ANA, HOJE, repositorioDemo, usarHojeFixo } from '../../testes/ficha';

usarHojeFixo();

const SEM_HORARIOS = () => criarRepositorioMemoria({ pacientes: [pacienteExemplo()] });

async function abrirSecao(id: string, repositorio: Repositorio = repositorioDemo()) {
  const resultado = abrirFicha(id, repositorio);
  const secao = await screen.findByRole('region', { name: 'Horários fixos' });
  return { ...resultado, secao };
}

describe('SecaoHorarios', () => {
  it('lista os horários fixos como "Terça, 14:00, 50 min"', async () => {
    const { secao } = await abrirSecao(ANA);

    expect(within(secao).getByText('Terça, 14:00, 50 min')).toBeInTheDocument();
    expect(within(secao).getByRole('button', { name: 'Mudar horário' })).toBeInTheDocument();
  });

  it('sem horário, avisa', async () => {
    const { secao } = await abrirSecao('p1', SEM_HORARIOS());

    expect(within(secao).getByText('Nenhum horário fixo ainda.')).toBeInTheDocument();
  });

  describe('adicionar', () => {
    it('adiciona "Terça, 14:00, 50 min": a seção Sessões mostra as próximas 4 terças', async () => {
      const repositorio = SEM_HORARIOS();
      const { usuaria, secao } = await abrirSecao('p1', repositorio);
      const sessoes = screen.getByRole('region', { name: 'Sessões' });
      expect(within(sessoes).queryAllByRole('listitem')).toHaveLength(0);

      await usuaria.click(within(secao).getByRole('button', { name: 'Adicionar horário' }));
      // A duração já vem com o padrão das configurações.
      expect(within(secao).getByLabelText('Duração (min)')).toHaveValue(50);
      await usuaria.selectOptions(within(secao).getByLabelText('Dia da semana'), 'Terça');
      await usuaria.type(within(secao).getByLabelText('Hora'), '14:00');
      await usuaria.click(within(secao).getByRole('button', { name: 'Salvar horário' }));

      expect(await within(secao).findByText('Terça, 14:00, 50 min')).toBeInTheDocument();
      expect(within(secao).queryByLabelText('Hora')).not.toBeInTheDocument();
      await waitFor(() => expect(within(sessoes).getAllByRole('listitem')).toHaveLength(4));
      const itens = within(sessoes).getAllByRole('listitem');
      expect(itens.map((i) => i.textContent)).toEqual([
        expect.stringContaining('terça-feira, 03/11'),
        expect.stringContaining('terça-feira, 10/11'),
        expect.stringContaining('terça-feira, 17/11'),
        expect.stringContaining('terça-feira, 24/11'),
      ]);
      for (const item of itens) {
        expect(item).toHaveTextContent('14:00');
        expect(item).toHaveTextContent('Agendada');
      }
      // O horário vale a partir de hoje e a agenda (4 semanas) foi gerada no repositório.
      const ficha = await repositorio.obterFicha('p1');
      expect(ficha!.horarios).toEqual([
        expect.objectContaining({ diaSemana: 2, hora: '14:00', duracaoMin: 50, validoDe: HOJE, validoAte: null }),
      ]);
      expect(await repositorio.listarSessoesDoPaciente('p1')).toHaveLength(4);
    });

    it('usa o número de semanas das configurações', async () => {
      const repositorio = criarRepositorioMemoria({
        pacientes: [pacienteExemplo()],
        configuracoes: {
          nomeCompleto: '', nomeExibicao: '', titulo: '', crp: '', cpf: '', telefone: '', email: '', endereco: '',
          cidade: '', instagram: '', duracaoPadraoMin: 40, sessoesAvaliacaoPadrao: 10, mensagemWhatsapp: 'x',
          semanasGeradas: 2, bloqueioMinutos: 15,
        },
      });
      const { usuaria, secao } = await abrirSecao('p1', repositorio);

      await usuaria.click(within(secao).getByRole('button', { name: 'Adicionar horário' }));
      expect(within(secao).getByLabelText('Duração (min)')).toHaveValue(40);
      await usuaria.selectOptions(within(secao).getByLabelText('Dia da semana'), 'Terça');
      await usuaria.type(within(secao).getByLabelText('Hora'), '09:30');
      await usuaria.click(within(secao).getByRole('button', { name: 'Salvar horário' }));

      expect(await within(secao).findByText('Terça, 09:30, 40 min')).toBeInTheDocument();
      await waitFor(async () => expect(await repositorio.listarSessoesDoPaciente('p1')).toHaveLength(2));
    });

    it('dia e hora são obrigatórios; a duração precisa ser um número maior que zero', async () => {
      const repositorio = SEM_HORARIOS();
      const { usuaria, secao } = await abrirSecao('p1', repositorio);

      await usuaria.click(within(secao).getByRole('button', { name: 'Adicionar horário' }));
      await usuaria.clear(within(secao).getByLabelText('Duração (min)'));
      await usuaria.click(within(secao).getByRole('button', { name: 'Salvar horário' }));

      expect(await within(secao).findByText('Escolha o dia da semana.')).toBeInTheDocument();
      expect(within(secao).getByText('Informe a hora.')).toBeInTheDocument();
      expect(within(secao).getByText('Informe a duração em minutos (de 1 a 480).')).toBeInTheDocument();
      expect((await repositorio.obterFicha('p1'))!.horarios).toEqual([]);
    });

    it('se a agenda falhar depois de gravar o horário, ele já aparece na lista e tentar de novo não o duplica', async () => {
      const base = SEM_HORARIOS();
      // O horário é gravado; a geração das sessões é a segunda etapa e falha na primeira tentativa.
      const inserirOcorrencias = vi.fn().mockRejectedValueOnce(new Error('sem rede')).mockImplementation(base.inserirOcorrencias);
      const { usuaria, secao } = await abrirSecao('p1', { ...base, inserirOcorrencias });

      await usuaria.click(within(secao).getByRole('button', { name: 'Adicionar horário' }));
      await usuaria.selectOptions(within(secao).getByLabelText('Dia da semana'), 'Terça');
      await usuaria.type(within(secao).getByLabelText('Hora'), '14:00');
      await usuaria.click(within(secao).getByRole('button', { name: 'Salvar horário' }));

      expect(await within(secao).findByRole('alert')).toHaveTextContent('Não foi possível salvar. Tente de novo.');
      // A ficha mostra o que foi gravado, mesmo com o erro.
      expect(await within(secao).findByText('Terça, 14:00, 50 min')).toBeInTheDocument();
      expect((await base.obterFicha('p1'))!.horarios).toHaveLength(1);
      expect(await base.listarSessoesDoPaciente('p1')).toEqual([]);

      // Tentar de novo conclui a agenda sem criar um segundo horário.
      await usuaria.click(within(secao).getByRole('button', { name: 'Salvar horário' }));
      await waitFor(() => expect(within(secao).queryByLabelText('Hora')).not.toBeInTheDocument());
      expect(within(secao).getAllByText('Terça, 14:00, 50 min')).toHaveLength(1);
      expect((await base.obterFicha('p1'))!.horarios).toHaveLength(1);
      expect(await base.listarSessoesDoPaciente('p1')).toHaveLength(4);
    });

    it('Cancelar fecha o formulário sem gravar', async () => {
      const repositorio = SEM_HORARIOS();
      const { usuaria, secao } = await abrirSecao('p1', repositorio);

      await usuaria.click(within(secao).getByRole('button', { name: 'Adicionar horário' }));
      await usuaria.click(within(secao).getByRole('button', { name: 'Cancelar' }));

      expect(within(secao).queryByLabelText('Hora')).not.toBeInTheDocument();
      expect((await repositorio.obterFicha('p1'))!.horarios).toEqual([]);
    });

    it('se não conseguir salvar, avisa e mantém o formulário', async () => {
      const base = SEM_HORARIOS();
      const salvarHorario = vi.fn().mockRejectedValue(new Error('sem rede'));
      const { usuaria, secao } = await abrirSecao('p1', { ...base, salvarHorario });

      await usuaria.click(within(secao).getByRole('button', { name: 'Adicionar horário' }));
      await usuaria.selectOptions(within(secao).getByLabelText('Dia da semana'), 'Terça');
      await usuaria.type(within(secao).getByLabelText('Hora'), '14:00');
      await usuaria.click(within(secao).getByRole('button', { name: 'Salvar horário' }));

      expect(await within(secao).findByRole('alert')).toHaveTextContent('Não foi possível salvar. Tente de novo.');
      expect(within(secao).getByLabelText('Hora')).toHaveValue('14:00');
    });
  });

  describe('mudar horário', () => {
    async function prepararAna() {
      const repositorio = repositorioDemo();
      await garantirAgenda(repositorio, HOJE, 4);
      return abrirSecao(ANA, repositorio);
    }

    it('pergunta "A partir de quando?" e aplica mudarHorarioFixo', async () => {
      const { repositorio, usuaria, secao } = await prepararAna();
      const antes = await repositorio.listarSessoesDoPaciente(ANA);
      expect(antes.map((s) => s.dataOcorrencia)).toEqual(['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24']);

      await usuaria.click(within(secao).getByRole('button', { name: 'Mudar horário' }));
      const data = within(secao).getByLabelText('A partir de quando?');
      expect(data).toHaveValue(HOJE);
      // O formulário começa com o horário atual.
      expect(within(secao).getByLabelText('Dia da semana')).toHaveValue('2');
      expect(within(secao).getByLabelText('Hora')).toHaveValue('14:00');
      expect(within(secao).getByLabelText('Duração (min)')).toHaveValue(50);

      await usuaria.clear(data);
      await usuaria.type(data, '2026-11-09');
      await usuaria.selectOptions(within(secao).getByLabelText('Dia da semana'), 'Quinta');
      await usuaria.clear(within(secao).getByLabelText('Hora'));
      await usuaria.type(within(secao).getByLabelText('Hora'), '15:00');
      await usuaria.click(within(secao).getByRole('button', { name: 'Aplicar mudança' }));

      expect(await within(secao).findByText('Quinta, 15:00, 50 min')).toBeInTheDocument();
      await waitFor(() => expect(within(secao).queryByLabelText('A partir de quando?')).not.toBeInTheDocument());
      // O antigo termina na véspera e continua visível enquanto vale ("até 08/11/2026").
      const itens = within(secao).getAllByRole('listitem');
      expect(itens[0]).toHaveTextContent('Terça, 14:00, 50 min');
      expect(itens[0]).toHaveTextContent('até 08/11/2026');
      expect(itens[1]).toHaveTextContent('Quinta, 15:00, 50 min');
      expect(itens[1]).toHaveTextContent('a partir de 09/11/2026');

      // O que veio antes de 09/11 fica; as terças seguintes dão lugar às quintas (4 semanas a partir de 09/11).
      const depois = await repositorio.listarSessoesDoPaciente(ANA);
      expect(depois.map((s) => s.dataOcorrencia)).toEqual(['2026-11-03', '2026-11-12', '2026-11-19', '2026-11-26', '2026-12-03']);
    });

    it('a seção Sessões mostra as sessões do horário novo', async () => {
      const { usuaria, secao } = await prepararAna();
      const sessoes = screen.getByRole('region', { name: 'Sessões' });
      await waitFor(() => expect(within(sessoes).getAllByRole('listitem')).toHaveLength(4));

      await usuaria.click(within(secao).getByRole('button', { name: 'Mudar horário' }));
      await usuaria.selectOptions(within(secao).getByLabelText('Dia da semana'), 'Quinta');
      await usuaria.click(within(secao).getByRole('button', { name: 'Aplicar mudança' }));

      await waitFor(() => {
        const dias = within(sessoes).getAllByRole('listitem').map((i) => i.textContent);
        expect(dias[0]).toContain('quinta-feira, 05/11');
        expect(dias.every((d) => d?.includes('quinta-feira'))).toBe(true);
      });
    });

    it('a data é obrigatória e é preciso mudar alguma coisa', async () => {
      const { repositorio, usuaria, secao } = await prepararAna();

      await usuaria.click(within(secao).getByRole('button', { name: 'Mudar horário' }));
      await usuaria.click(within(secao).getByRole('button', { name: 'Aplicar mudança' }));
      expect(await within(secao).findByText('Nada mudou no horário.')).toBeInTheDocument();

      await usuaria.clear(within(secao).getByLabelText('A partir de quando?'));
      await usuaria.click(within(secao).getByRole('button', { name: 'Aplicar mudança' }));
      expect(await within(secao).findByText('Informe a partir de quando vale o novo horário.')).toBeInTheDocument();

      expect((await repositorio.obterFicha(ANA))!.horarios).toHaveLength(1);
    });

    it('recusa data no passado (um dia antes, ou um ano digitado errado) e não muda nada', async () => {
      const { repositorio, usuaria, secao } = await prepararAna();
      const antes = await repositorio.listarSessoesDoPaciente(ANA);

      await usuaria.click(within(secao).getByRole('button', { name: 'Mudar horário' }));
      const data = within(secao).getByLabelText('A partir de quando?');
      // O calendário do aparelho já começa em hoje.
      expect(data).toHaveAttribute('min', HOJE);
      await usuaria.selectOptions(within(secao).getByLabelText('Dia da semana'), 'Quinta');

      for (const passada of ['2025-11-03', '2026-11-01']) {
        await usuaria.clear(data);
        await usuaria.type(data, passada);
        await usuaria.click(within(secao).getByRole('button', { name: 'Aplicar mudança' }));

        expect(await within(secao).findByText('Escolha hoje ou uma data futura.')).toBeInTheDocument();
        expect(data).toBeInvalid();
      }
      expect((await repositorio.obterFicha(ANA))!.horarios).toHaveLength(1);
      expect(await repositorio.listarSessoesDoPaciente(ANA)).toEqual(antes);
    });

    it('Cancelar fecha a pergunta sem mudar nada', async () => {
      const { repositorio, usuaria, secao } = await prepararAna();

      await usuaria.click(within(secao).getByRole('button', { name: 'Mudar horário' }));
      await usuaria.selectOptions(within(secao).getByLabelText('Dia da semana'), 'Quinta');
      await usuaria.click(within(secao).getByRole('button', { name: 'Cancelar' }));

      expect(within(secao).queryByLabelText('A partir de quando?')).not.toBeInTheDocument();
      expect((await repositorio.obterFicha(ANA))!.horarios).toHaveLength(1);
    });

    it('se não conseguir aplicar, avisa e fecha a pergunta, mostrando a lista como está', async () => {
      const base = repositorioDemo();
      const salvarHorario = vi.fn().mockRejectedValue(new Error('sem rede'));
      const { usuaria, secao } = await abrirSecao(ANA, { ...base, salvarHorario });

      await usuaria.click(within(secao).getByRole('button', { name: 'Mudar horário' }));
      await usuaria.selectOptions(within(secao).getByLabelText('Dia da semana'), 'Quinta');
      await usuaria.click(within(secao).getByRole('button', { name: 'Aplicar mudança' }));

      expect(await within(secao).findByRole('alert')).toHaveTextContent('Não foi possível mudar o horário.');
      expect(within(secao).queryByLabelText('A partir de quando?')).not.toBeInTheDocument();
      // Nada foi gravado: continua só o horário antigo.
      expect(within(secao).getAllByRole('listitem')).toHaveLength(1);
      expect(within(secao).getByText('Terça, 14:00, 50 min')).toBeInTheDocument();
    });

    it('se a troca falhar no meio, a lista mostra o que foi gravado e a pergunta fecha (não dá para repetir em cima de dados velhos)', async () => {
      const base = repositorioDemo();
      await garantirAgenda(base, HOJE, 4);
      // Os dois horários são gravados; a geração das sessões novas, no fim, falha.
      const inserirOcorrencias = vi.fn().mockRejectedValueOnce(new Error('sem rede')).mockImplementation(base.inserirOcorrencias);
      const { usuaria, secao } = await abrirSecao(ANA, { ...base, inserirOcorrencias });

      await usuaria.click(within(secao).getByRole('button', { name: 'Mudar horário' }));
      await usuaria.selectOptions(within(secao).getByLabelText('Dia da semana'), 'Quinta');
      await usuaria.click(within(secao).getByRole('button', { name: 'Aplicar mudança' }));

      expect(await within(secao).findByRole('alert')).toHaveTextContent('Não foi possível mudar o horário.');
      expect(within(secao).queryByLabelText('A partir de quando?')).not.toBeInTheDocument();
      expect(within(secao).queryByRole('button', { name: 'Aplicar mudança' })).not.toBeInTheDocument();
      // O horário novo já está na lista (o antigo terminou ontem e saiu dela).
      const itens = within(secao).getAllByRole('listitem');
      expect(itens).toHaveLength(1);
      expect(itens[0]).toHaveTextContent('Quinta, 14:00, 50 min');
      const ficha = await base.obterFicha(ANA);
      expect(ficha!.horarios.map((h) => [h.diaSemana, h.validoAte])).toEqual([
        [2, '2026-11-01'],
        [4, null],
      ]);
    });
  });

  describe('mudar horário: aviso de falha', () => {
    afterEach(() => focusManager.setFocused(undefined));

    it('aparece mesmo quando a ficha foi relida no meio da troca e o formulário já saiu da lista', async () => {
      const base = repositorioDemo();
      await garantirAgenda(base, HOJE, 4);
      // A última etapa da troca (gerar as sessões novas) fica pendente até o teste mandar falhar.
      let falhar: (erro: Error) => void = () => {};
      const inserirOcorrencias = vi.fn(
        () =>
          new Promise<number>((_resolver, rejeitar) => {
            falhar = rejeitar;
          }),
      );
      const { usuaria, secao } = await abrirSecao(ANA, { ...base, inserirOcorrencias });

      await usuaria.click(within(secao).getByRole('button', { name: 'Mudar horário' }));
      await usuaria.selectOptions(within(secao).getByLabelText('Dia da semana'), 'Quinta');
      await usuaria.click(within(secao).getByRole('button', { name: 'Aplicar mudança' }));
      await waitFor(() => expect(inserirOcorrencias).toHaveBeenCalled());

      // Ela sai do aplicativo e volta: a ficha é relida. O horário antigo já terminou ontem e sai da lista,
      // levando o formulário junto.
      act(() => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
      });
      await waitFor(() => expect(within(secao).queryByLabelText('A partir de quando?')).not.toBeInTheDocument());

      await act(async () => falhar(new Error('sem rede')));

      expect(await within(secao).findByRole('alert')).toHaveTextContent('Não foi possível mudar o horário.');
    });
  });

  it('horário que já terminou não aparece; o que começa no futuro aparece com a data', async () => {
    const repositorio = criarRepositorioMemoria({
      pacientes: [pacienteExemplo()],
      horarios: [
        horarioExemplo({ id: 'antigo', diaSemana: 1, hora: '08:00', validoDe: '2026-08-01', validoAte: '2026-10-31' }),
        horarioExemplo({ id: 'atual', diaSemana: 2, hora: '14:00', validoDe: '2026-11-01' }),
        horarioExemplo({ id: 'futuro', diaSemana: 5, hora: '10:00', validoDe: '2026-12-01' }),
      ],
    });
    const { secao } = await abrirSecao('p1', repositorio);

    const itens = within(secao).getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent('Terça, 14:00, 50 min');
    expect(itens[0]).not.toHaveTextContent('a partir de');
    expect(itens[1]).toHaveTextContent('Sexta, 10:00, 50 min');
    expect(itens[1]).toHaveTextContent('a partir de 01/12/2026');
  });

  it('depois da alta, o paciente não ganha nem muda horários', async () => {
    const repositorio = criarRepositorioMemoria({
      pacientes: [pacienteExemplo({ status: 'alta', dataAlta: '2026-10-20' })],
      horarios: [horarioExemplo({ validoAte: '2026-10-20' })],
    });
    const { secao } = await abrirSecao('p1', repositorio);

    expect(within(secao).getByText('Nenhum horário fixo ainda.')).toBeInTheDocument();
    expect(within(secao).queryByRole('button', { name: 'Adicionar horário' })).not.toBeInTheDocument();
  });
});
