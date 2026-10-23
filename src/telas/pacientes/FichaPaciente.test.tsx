import { screen, within } from '@testing-library/react';
import { criarRepositorioMemoria } from '../../dados/memoria';
import { avaliacaoExemplo, pacienteExemplo, sessaoExemplo } from '../../testes/fabricas';
import { garantirAgenda } from '../../servicos/agenda';
import { abrirFicha, ANA, HOJE, LUCAS, PEDRO, repositorioDemo, secao, usarHojeFixo } from '../../testes/ficha';

usarHojeFixo();

describe('FichaPaciente — cabeçalho', () => {
  it('psicoterapia: nome, tipo, e sem a seção Avaliação', async () => {
    abrirFicha(ANA);

    expect(await screen.findByRole('heading', { level: 1, name: 'Ana Clara Souza' })).toBeInTheDocument();
    expect(screen.getByText('Psicoterapia')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Avaliação' })).not.toBeInTheDocument();
  });

  it('avaliação: mostra "Avaliação · sessão 4 de 10" (3 comparecimentos + 1) e a seção Avaliação', async () => {
    abrirFicha(PEDRO);

    expect(await screen.findByText('Avaliação · sessão 4 de 10')).toBeInTheDocument();
    expect(secao('Avaliação')).toBeInTheDocument();
  });

  it('não passa do total: com todas as sessões feitas, mostra "sessão 10 de 10"', async () => {
    const repositorio = criarRepositorioMemoria({
      pacientes: [pacienteExemplo({ tipo: 'avaliacao' })],
      avaliacoes: [avaliacaoExemplo({ sessoesPrevistas: 3 })],
      sessoes: [1, 2, 3, 4].map((n) =>
        sessaoExemplo({
          id: `s${n}`,
          tipo: 'avaliacao',
          avaliacaoId: 'av1',
          situacao: 'compareceu',
          inicio: `2026-10-0${n}T17:00:00.000Z`,
        }),
      ),
    });
    abrirFicha('p1', repositorio);

    expect(await screen.findByText('Avaliação · sessão 3 de 3')).toBeInTheDocument();
  });

  it('só conta comparecimentos: falta e sessão agendada não avançam a contagem', async () => {
    const repositorio = criarRepositorioMemoria({
      pacientes: [pacienteExemplo({ tipo: 'avaliacao' })],
      avaliacoes: [avaliacaoExemplo()],
      sessoes: [
        sessaoExemplo({ id: 's1', tipo: 'avaliacao', avaliacaoId: 'av1', situacao: 'compareceu', inicio: '2026-10-20T17:00:00.000Z' }),
        sessaoExemplo({ id: 's2', tipo: 'avaliacao', avaliacaoId: 'av1', situacao: 'falta_sem_aviso', inicio: '2026-10-27T17:00:00.000Z' }),
        sessaoExemplo({ id: 's3', tipo: 'avaliacao', avaliacaoId: 'av1', situacao: 'agendada', inicio: '2026-11-03T17:00:00.000Z' }),
      ],
    });
    abrirFicha('p1', repositorio);

    expect(await screen.findByText('Avaliação · sessão 2 de 10')).toBeInTheDocument();
  });

  it('depois de passar para psicoterapia, a avaliação antiga (ainda aberta) não aparece na ficha', async () => {
    const repositorio = criarRepositorioMemoria({
      pacientes: [pacienteExemplo({ tipo: 'psicoterapia' })],
      avaliacoes: [avaliacaoExemplo({ fim: null })],
    });
    abrirFicha('p1', repositorio);

    await screen.findByRole('heading', { level: 1, name: 'Ana Clara Souza' });
    expect(screen.queryByRole('region', { name: 'Avaliação' })).not.toBeInTheDocument();
    expect(screen.queryByText(/sessão \d+ de \d+/)).not.toBeInTheDocument();
  });

  it('lista de espera aparece no cabeçalho, com texto', async () => {
    abrirFicha(LUCAS);
    expect(await screen.findByText('Na lista de espera')).toBeInTheDocument();
  });

  it('as abas Documentos e Financeiro da ficha ainda não existem', async () => {
    abrirFicha(ANA);
    await screen.findByRole('heading', { level: 1, name: 'Ana Clara Souza' });

    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.queryByText('Documentos')).not.toBeInTheDocument();
  });

  it('paciente que não existe: avisa e oferece voltar', async () => {
    abrirFicha('nao-existe');

    expect(await screen.findByText('Paciente não encontrado.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para Pacientes' })).toHaveAttribute('href', '/pacientes');
  });

  it('se não conseguir carregar, avisa e deixa tentar de novo', async () => {
    const base = repositorioDemo();
    const obterFicha = vi.fn().mockRejectedValueOnce(new Error('sem rede')).mockImplementation(base.obterFicha);
    const { usuaria } = abrirFicha(ANA, { ...base, obterFicha });

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar a ficha.');
    await usuaria.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Ana Clara Souza' })).toBeInTheDocument();
  });
});

describe('FichaPaciente — seções recolhíveis', () => {
  it('cada seção abre e fecha pelo título', async () => {
    const { usuaria } = abrirFicha(ANA);
    const botao = await screen.findByRole('button', { name: 'Dados da criança' });
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(within(secao('Dados da criança')).getByLabelText('Escola')).toBeVisible();

    await usuaria.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(within(secao('Dados da criança')).getByLabelText('Escola')).not.toBeVisible();

    await usuaria.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(within(secao('Dados da criança')).getByLabelText('Escola')).toBeVisible();
  });

  it('o que foi digitado numa seção fechada não se perde', async () => {
    const { usuaria } = abrirFicha(ANA);
    const dados = await screen.findByRole('region', { name: 'Dados da criança' });
    await usuaria.type(within(dados).getByLabelText('Série'), ' B');

    await usuaria.click(screen.getByRole('button', { name: 'Dados da criança' }));
    await usuaria.click(screen.getByRole('button', { name: 'Dados da criança' }));

    expect(within(dados).getByLabelText('Série')).toHaveValue('2º ano B');
  });

  describe('no celular (menos de 768 px)', () => {
    const matchMediaOriginal = window.matchMedia;
    beforeEach(() => {
      window.matchMedia = ((consulta: string) => ({
        matches: false,
        media: consulta,
        addEventListener: () => {},
        removeEventListener: () => {},
      })) as unknown as typeof window.matchMedia;
    });
    afterEach(() => {
      window.matchMedia = matchMediaOriginal;
    });

    it('os dados cadastrais começam fechados e o que se consulta no dia a dia, aberto', async () => {
      abrirFicha(PEDRO);
      await screen.findByRole('heading', { level: 1, name: 'Pedro Henrique Lima' });

      for (const fechada of ['Dados da criança', 'Atendimento', 'Cobrança']) {
        expect(screen.getByRole('button', { name: fechada })).toHaveAttribute('aria-expanded', 'false');
      }
      for (const aberta of ['Responsáveis', 'Horários fixos', 'Avaliação', 'Sessões']) {
        expect(screen.getByRole('button', { name: aberta })).toHaveAttribute('aria-expanded', 'true');
      }
    });
  });
});

describe('FichaPaciente — dados da criança', () => {
  it('mostra os dados gravados', async () => {
    abrirFicha(ANA);
    const dados = await screen.findByRole('region', { name: 'Dados da criança' });

    expect(within(dados).getByLabelText('Nome')).toHaveValue('Ana Clara Souza');
    expect(within(dados).getByLabelText('Escola')).toHaveValue('Colégio Girassol');
    expect(within(dados).getByLabelText('Série')).toHaveValue('2º ano');
    expect(within(dados).getByLabelText('Observações')).toHaveValue('Gosta de brincar com massinha.');
  });

  it('edita e salva: CPF com a máscara 000.000.000-00', async () => {
    const { repositorio, usuaria } = abrirFicha(ANA);
    const dados = await screen.findByRole('region', { name: 'Dados da criança' });

    await usuaria.clear(within(dados).getByLabelText('Escola'));
    await usuaria.type(within(dados).getByLabelText('Escola'), 'Escola Nova');
    await usuaria.type(within(dados).getByLabelText('CPF'), '98765432100');
    expect(within(dados).getByLabelText('CPF')).toHaveValue('987.654.321-00');
    await usuaria.clear(within(dados).getByLabelText('Data de nascimento'));
    await usuaria.type(within(dados).getByLabelText('Data de nascimento'), '2019-03-08');
    await usuaria.click(within(dados).getByRole('button', { name: 'Salvar dados' }));

    expect(await within(dados).findByText('Dados salvos.')).toBeInTheDocument();
    expect((await repositorio.obterFicha(ANA))?.paciente).toMatchObject({
      escola: 'Escola Nova',
      cpf: '987.654.321-00',
      dataNascimento: '2019-03-08',
      nome: 'Ana Clara Souza',
    });
  });

  it('depois de salvar, os campos mostram o que ficou gravado (textos aparados)', async () => {
    const { usuaria } = abrirFicha(ANA);
    const dados = await screen.findByRole('region', { name: 'Dados da criança' });

    await usuaria.clear(within(dados).getByLabelText('Escola'));
    await usuaria.type(within(dados).getByLabelText('Escola'), '   Escola Nova   ');
    await usuaria.click(within(dados).getByRole('button', { name: 'Salvar dados' }));

    await within(dados).findByText('Dados salvos.');
    expect(within(dados).getByLabelText('Escola')).toHaveValue('Escola Nova');
  });

  it('o nome continua obrigatório', async () => {
    const { repositorio, usuaria } = abrirFicha(ANA);
    const dados = await screen.findByRole('region', { name: 'Dados da criança' });

    await usuaria.clear(within(dados).getByLabelText('Nome'));
    await usuaria.click(within(dados).getByRole('button', { name: 'Salvar dados' }));

    expect(await within(dados).findByText('Informe o nome.')).toBeInTheDocument();
    expect((await repositorio.obterFicha(ANA))?.paciente.nome).toBe('Ana Clara Souza');
  });

  it('trocar o nome atualiza o título da ficha', async () => {
    const { usuaria } = abrirFicha(ANA);
    const dados = await screen.findByRole('region', { name: 'Dados da criança' });

    await usuaria.clear(within(dados).getByLabelText('Nome'));
    await usuaria.type(within(dados).getByLabelText('Nome'), 'Ana Clara Souza Lima');
    await usuaria.click(within(dados).getByRole('button', { name: 'Salvar dados' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Ana Clara Souza Lima' })).toBeInTheDocument();
  });

  it('CPF incompleto é recusado; apagar o CPF o deixa em branco (null)', async () => {
    const repositorio = criarRepositorioMemoria({ pacientes: [pacienteExemplo({ cpf: '123.456.789-01' })] });
    const { usuaria } = abrirFicha('p1', repositorio);
    const dados = await screen.findByRole('region', { name: 'Dados da criança' });

    await usuaria.clear(within(dados).getByLabelText('CPF'));
    await usuaria.type(within(dados).getByLabelText('CPF'), '123');
    await usuaria.click(within(dados).getByRole('button', { name: 'Salvar dados' }));
    expect(await within(dados).findByText('O CPF deve ter 11 números.')).toBeInTheDocument();
    expect((await repositorio.obterFicha('p1'))?.paciente.cpf).toBe('123.456.789-01');

    await usuaria.clear(within(dados).getByLabelText('CPF'));
    await usuaria.click(within(dados).getByRole('button', { name: 'Salvar dados' }));
    expect(await within(dados).findByText('Dados salvos.')).toBeInTheDocument();
    expect((await repositorio.obterFicha('p1'))?.paciente.cpf).toBeNull();
  });

  it('data de nascimento no futuro é recusada', async () => {
    const { usuaria } = abrirFicha(ANA);
    const dados = await screen.findByRole('region', { name: 'Dados da criança' });

    await usuaria.clear(within(dados).getByLabelText('Data de nascimento'));
    await usuaria.type(within(dados).getByLabelText('Data de nascimento'), '2027-01-01');
    await usuaria.click(within(dados).getByRole('button', { name: 'Salvar dados' }));

    expect(await within(dados).findByText('A data de nascimento não pode ser no futuro.')).toBeInTheDocument();
  });

  it('se não conseguir salvar, avisa', async () => {
    const base = repositorioDemo();
    const salvarPaciente = vi.fn().mockRejectedValue(new Error('sem rede'));
    const { usuaria } = abrirFicha(ANA, { ...base, salvarPaciente });
    const dados = await screen.findByRole('region', { name: 'Dados da criança' });

    await usuaria.type(within(dados).getByLabelText('Escola'), ' 2');
    await usuaria.click(within(dados).getByRole('button', { name: 'Salvar dados' }));

    expect(await within(dados).findByRole('alert')).toHaveTextContent('Não foi possível salvar. Tente de novo.');
    expect(within(dados).queryByText('Dados salvos.')).not.toBeInTheDocument();
  });
});

describe('FichaPaciente — sessões (histórico)', () => {
  it('mostra o histórico, com situação em texto e ícone, e o tipo', async () => {
    abrirFicha(PEDRO);
    const sessoes = await screen.findByRole('region', { name: 'Sessões' });

    expect(await within(sessoes).findAllByText('Compareceu')).toHaveLength(3);
    const itens = within(sessoes).getAllByRole('listitem');
    expect(itens).toHaveLength(3);
    // Mais recente primeiro: as quartas 28/10, 21/10 e 14/10.
    expect(itens[0]).toHaveTextContent('28/10/2026');
    expect(itens[2]).toHaveTextContent('14/10/2026');
    for (const item of itens) {
      expect(item).toHaveTextContent('09:00');
      expect(item).toHaveTextContent('Avaliação');
      expect(item.querySelector('svg')).not.toBeNull();
    }
    expect(within(sessoes).getByText('Nenhuma sessão agendada.')).toBeInTheDocument();
  });

  it('sessão de acompanhamento familiar aparece com esse nome', async () => {
    const repositorio = criarRepositorioMemoria({
      pacientes: [pacienteExemplo()],
      sessoes: [sessaoExemplo({ id: 's1', situacao: 'compareceu', acompanhamentoFamiliar: true, inicio: '2026-10-20T17:00:00.000Z' })],
    });
    abrirFicha('p1', repositorio);
    const sessoes = await screen.findByRole('region', { name: 'Sessões' });

    expect(await within(sessoes).findByText('Acompanhamento familiar')).toBeInTheDocument();
  });

  it('sem nenhuma sessão, diz que não há histórico', async () => {
    abrirFicha(LUCAS);
    const sessoes = await screen.findByRole('region', { name: 'Sessões' });

    expect(await within(sessoes).findByText('Nenhuma sessão no histórico ainda.')).toBeInTheDocument();
    expect(within(sessoes).getByText('Nenhuma sessão agendada.')).toBeInTheDocument();
  });

  it('separa as próximas (agendadas) do histórico', async () => {
    const repositorio = repositorioDemo();
    await garantirAgenda(repositorio, HOJE, 4);
    abrirFicha(ANA, repositorio);
    const sessoes = await screen.findByRole('region', { name: 'Sessões' });

    const proximas = (await within(sessoes).findByRole('heading', { name: 'Próximas' })).nextElementSibling as HTMLElement;
    expect(within(proximas).getAllByRole('listitem')).toHaveLength(4);
    expect(within(proximas).getAllByText('Agendada')).toHaveLength(4);
  });

  it('se não conseguir carregar as sessões, avisa e deixa tentar de novo', async () => {
    const base = repositorioDemo();
    const listarSessoesDoPaciente = vi.fn().mockRejectedValueOnce(new Error('x')).mockImplementation(base.listarSessoesDoPaciente);
    const { usuaria } = abrirFicha(PEDRO, { ...base, listarSessoesDoPaciente });
    const sessoes = await screen.findByRole('region', { name: 'Sessões' });

    expect(await within(sessoes).findByRole('alert')).toHaveTextContent('Não foi possível carregar as sessões.');
    await usuaria.click(within(sessoes).getByRole('button', { name: 'Tentar de novo' }));

    expect(await within(sessoes).findAllByText('Compareceu')).toHaveLength(3);
  });
});
