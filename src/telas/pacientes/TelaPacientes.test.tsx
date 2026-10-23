import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { criarRepositorioMemoria } from '../../dados/memoria';
import { dadosPacienteExemplo } from '../../testes/fabricas';
import { repositorioDemo, usarHojeFixo } from '../../testes/ficha';
import { renderComRotas } from '../../testes/utilitarios';

usarHojeFixo();

function abrirLista(repositorio = repositorioDemo()) {
  return { ...renderComRotas('/pacientes', { repositorio }), usuaria: userEvent.setup() };
}

function nomesDosGrupos() {
  return screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
}

describe('TelaPacientes — lista', () => {
  it('mostra os grupos na ordem Em avaliação, Em psicoterapia, Lista de espera e Alta, cada um com a sua contagem', async () => {
    abrirLista();

    await screen.findByRole('link', { name: /Ana Clara Souza/ });
    expect(nomesDosGrupos()).toEqual(['Em avaliação (1)', 'Em psicoterapia (2)', 'Lista de espera (1)', 'Alta (0)']);
  });

  it('cada paciente fica no seu grupo, em ordem alfabética', async () => {
    abrirLista();
    await screen.findByRole('link', { name: /Ana Clara Souza/ });

    const grupo = (nome: string) => screen.getByRole('heading', { name: nome }).closest('section') as HTMLElement;
    expect(within(grupo('Em avaliação (1)')).getByRole('link', { name: /Pedro Henrique Lima/ })).toBeInTheDocument();
    const psicoterapia = within(grupo('Em psicoterapia (2)')).getAllByRole('link');
    expect(psicoterapia.map((l) => l.textContent)).toEqual([
      expect.stringContaining('Ana Clara Souza'),
      expect.stringContaining('Maria Luísa Costa'),
    ]);
    expect(within(grupo('Lista de espera (1)')).getByRole('link', { name: /Lucas Oliveira/ })).toBeInTheDocument();
  });

  it('paciente com alta aparece no grupo Alta', async () => {
    const repositorio = criarRepositorioMemoria({
      pacientes: [{ id: 'p1', ...dadosPacienteExemplo({ nome: 'Beatriz Alves', status: 'alta', dataAlta: '2026-10-20' }) }],
    });
    abrirLista(repositorio);

    await screen.findByRole('link', { name: /Beatriz Alves/ });
    expect(nomesDosGrupos()).toEqual(['Em avaliação (0)', 'Em psicoterapia (0)', 'Lista de espera (0)', 'Alta (1)']);
  });

  it('a busca "ana" ignora maiúsculas e acentos ("Ána" acha "Ana Clara") e atualiza a contagem', async () => {
    const { usuaria } = abrirLista();
    await screen.findByRole('link', { name: /Ana Clara Souza/ });
    const busca = screen.getByRole('searchbox', { name: 'Buscar paciente' });

    await usuaria.type(busca, 'ana');
    expect(screen.getAllByRole('link', { name: /Souza|Lima|Costa|Oliveira/ })).toHaveLength(1);
    expect(screen.getByRole('link', { name: /Ana Clara Souza/ })).toBeInTheDocument();
    expect(nomesDosGrupos()).toEqual(['Em avaliação (0)', 'Em psicoterapia (1)', 'Lista de espera (0)', 'Alta (0)']);

    await usuaria.clear(busca);
    await usuaria.type(busca, 'Ána');
    expect(screen.getByRole('link', { name: /Ana Clara Souza/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Pedro Henrique/ })).not.toBeInTheDocument();

    await usuaria.clear(busca);
    await usuaria.type(busca, 'LUISA');
    expect(screen.getByRole('link', { name: /Maria Luísa Costa/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Ana Clara/ })).not.toBeInTheDocument();
  });

  it('busca sem resultado avisa; apagar a busca traz todos de volta', async () => {
    const { usuaria } = abrirLista();
    await screen.findByRole('link', { name: /Ana Clara Souza/ });
    const busca = screen.getByRole('searchbox', { name: 'Buscar paciente' });

    await usuaria.type(busca, 'zzz');
    expect(screen.getByText('Nenhum paciente encontrado.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Ana Clara/ })).not.toBeInTheDocument();

    await usuaria.clear(busca);
    expect(screen.queryByText('Nenhum paciente encontrado.')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ana Clara Souza/ })).toBeInTheDocument();
  });

  it('sem pacientes, explica como começar', async () => {
    abrirLista(criarRepositorioMemoria());

    expect(await screen.findByText('Nenhum paciente cadastrado ainda.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Novo paciente' })).toBeInTheDocument();
  });

  it('o botão "Novo paciente" leva ao formulário', async () => {
    const { usuaria } = abrirLista();

    await usuaria.click(await screen.findByRole('link', { name: 'Novo paciente' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Novo paciente' })).toBeInTheDocument();
  });

  it('tocar num paciente abre a ficha dele', async () => {
    const { usuaria } = abrirLista();

    await usuaria.click(await screen.findByRole('link', { name: /Maria Luísa Costa/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Maria Luísa Costa' })).toBeInTheDocument();
  });

  it('se não conseguir carregar, avisa e deixa tentar de novo', async () => {
    const base = repositorioDemo();
    const listarPacientes = vi.fn().mockRejectedValueOnce(new Error('sem rede')).mockImplementation(base.listarPacientes);
    const { usuaria } = abrirLista({ ...base, listarPacientes });

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os pacientes.');
    await usuaria.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('link', { name: /Ana Clara Souza/ })).toBeInTheDocument();
  });
});

describe('Novo paciente', () => {
  async function abrirFormulario(repositorio = repositorioDemo()) {
    const resultado = renderComRotas('/pacientes/novo', { repositorio });
    const usuaria = userEvent.setup();
    await screen.findByRole('heading', { level: 1, name: 'Novo paciente' });
    // O formulário só aparece quando as configurações carregaram.
    await screen.findByLabelText('Nome');
    return { ...resultado, usuaria };
  }

  it('o nome é obrigatório: sem ele mostra "Informe o nome." e não grava', async () => {
    const { repositorio, usuaria } = await abrirFormulario();
    const antes = (await repositorio.listarPacientes()).length;

    await usuaria.click(screen.getByLabelText('Psicoterapia'));
    await usuaria.type(screen.getByLabelText('Nome'), '   ');
    await usuaria.click(screen.getByRole('button', { name: 'Salvar paciente' }));

    expect(await screen.findByText('Informe o nome.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toBeInvalid();
    expect(await repositorio.listarPacientes()).toHaveLength(antes);
  });

  it('o tipo é obrigatório: sem escolher, mostra o aviso e não grava', async () => {
    const { repositorio, usuaria } = await abrirFormulario();
    const antes = (await repositorio.listarPacientes()).length;

    await usuaria.type(screen.getByLabelText('Nome'), 'Beatriz Teste');
    await usuaria.click(screen.getByRole('button', { name: 'Salvar paciente' }));

    expect(await screen.findByText('Escolha o tipo de atendimento.')).toBeInTheDocument();
    expect(screen.queryByText('Informe o nome.')).not.toBeInTheDocument();
    expect(await repositorio.listarPacientes()).toHaveLength(antes);

    // Escolhendo o tipo, o mesmo formulário grava.
    await usuaria.click(screen.getByLabelText('Psicoterapia'));
    await usuaria.click(screen.getByRole('button', { name: 'Salvar paciente' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Beatriz Teste' })).toBeInTheDocument();
  });

  it('mostra os dois avisos de uma vez quando falta nome e tipo', async () => {
    const { usuaria } = await abrirFormulario();

    await usuaria.click(screen.getByRole('button', { name: 'Salvar paciente' }));

    expect(await screen.findByText('Informe o nome.')).toBeInTheDocument();
    expect(screen.getByText('Escolha o tipo de atendimento.')).toBeInTheDocument();
  });

  it('salvando em avaliação, a ficha mostra "Avaliação · sessão 1 de 10" e as 5 etapas', async () => {
    const { repositorio, usuaria } = await abrirFormulario();

    await usuaria.type(screen.getByLabelText('Nome'), 'Beatriz Teste');
    await usuaria.click(screen.getByLabelText('Avaliação'));
    await usuaria.click(screen.getByRole('button', { name: 'Salvar paciente' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Beatriz Teste' })).toBeInTheDocument();
    expect(await screen.findByText('Avaliação · sessão 1 de 10')).toBeInTheDocument();
    const etapas = within(screen.getByRole('region', { name: 'Avaliação' })).getAllByRole('checkbox');
    expect(etapas.map((e) => e.closest('label')?.textContent)).toEqual([
      'Entrevista com os responsáveis',
      'Testes aplicados',
      'Contato com a escola',
      'Devolutiva',
      'Laudo entregue',
    ]);
    const salvo = (await repositorio.listarPacientes()).find((p) => p.nome === 'Beatriz Teste');
    expect(salvo).toMatchObject({ tipo: 'avaliacao', status: 'ativo' });
    expect((await repositorio.obterFicha(salvo!.id))?.avaliacao?.sessoesPrevistas).toBe(10);
  });

  it('salva tudo o que foi preenchido: dados, CPF com máscara, parceiro e cobrança', async () => {
    const { repositorio, usuaria } = await abrirFormulario();

    await usuaria.type(screen.getByLabelText('Nome'), '  Beatriz Teste ');
    await usuaria.type(screen.getByLabelText('Data de nascimento'), '2018-05-17');
    await usuaria.type(screen.getByLabelText('CPF'), '12345678901');
    expect(screen.getByLabelText('CPF')).toHaveValue('123.456.789-01');
    await usuaria.type(screen.getByLabelText('Escola'), 'Colégio Girassol');
    await usuaria.type(screen.getByLabelText('Série'), '3º ano');
    await usuaria.type(screen.getByLabelText('Observações'), 'Gosta de desenhar.');
    await usuaria.click(screen.getByLabelText('Psicoterapia'));
    await within(screen.getByLabelText('Quem encaminhou')).findByRole('option', { name: 'Dr. Rafael Nogueira' });
    await usuaria.selectOptions(screen.getByLabelText('Quem encaminhou'), 'Dr. Rafael Nogueira');
    await usuaria.click(screen.getByLabelText('Por mês'));
    await usuaria.type(screen.getByLabelText('Valor da sessão'), '150');
    await usuaria.click(screen.getByRole('button', { name: 'Salvar paciente' }));

    await screen.findByRole('heading', { level: 1, name: 'Beatriz Teste' });
    const salvo = (await repositorio.listarPacientes()).find((p) => p.nome === 'Beatriz Teste');
    expect(salvo).toMatchObject({
      nome: 'Beatriz Teste',
      dataNascimento: '2018-05-17',
      cpf: '123.456.789-01',
      escola: 'Colégio Girassol',
      serie: '3º ano',
      observacoes: 'Gosta de desenhar.',
      tipo: 'psicoterapia',
      status: 'ativo',
      dataAlta: null,
      parceiroId: 'demo-parceiro-rafael',
      formaCobranca: 'mensal',
      valorSessaoCentavos: 15000,
    });
    // Psicoterapia não abre avaliação.
    expect((await repositorio.obterFicha(salvo!.id))?.avaliacao).toBeNull();
  });

  it('CPF é opcional (fica null); cobrança padrão é por sessão', async () => {
    const { repositorio, usuaria } = await abrirFormulario();

    await usuaria.type(screen.getByLabelText('Nome'), 'Beatriz Teste');
    await usuaria.click(screen.getByLabelText('Psicoterapia'));
    expect(screen.getByLabelText('Por sessão')).toBeChecked();
    await usuaria.click(screen.getByRole('button', { name: 'Salvar paciente' }));

    await screen.findByRole('heading', { level: 1, name: 'Beatriz Teste' });
    const salvo = (await repositorio.listarPacientes()).find((p) => p.nome === 'Beatriz Teste');
    expect(salvo).toMatchObject({ cpf: null, dataNascimento: null, parceiroId: null, formaCobranca: 'por_sessao', valorSessaoCentavos: 0 });
  });

  it('CPF incompleto e valor inválido são recusados, com aviso', async () => {
    const { repositorio, usuaria } = await abrirFormulario();
    const antes = (await repositorio.listarPacientes()).length;

    await usuaria.type(screen.getByLabelText('Nome'), 'Beatriz Teste');
    await usuaria.click(screen.getByLabelText('Psicoterapia'));
    await usuaria.type(screen.getByLabelText('CPF'), '123456');
    await usuaria.type(screen.getByLabelText('Valor da sessão'), 'abc');
    await usuaria.click(screen.getByRole('button', { name: 'Salvar paciente' }));

    expect(await screen.findByText('O CPF deve ter 11 números.')).toBeInTheDocument();
    expect(screen.getByText('Informe um valor válido, como 180 ou 180,50.')).toBeInTheDocument();
    expect(await repositorio.listarPacientes()).toHaveLength(antes);
  });

  it('"Quem encaminhou" lista os parceiros', async () => {
    await abrirFormulario();

    const quem = screen.getByLabelText('Quem encaminhou');
    await within(quem).findByRole('option', { name: 'Dra. Camila Rocha' });
    // Em ordem alfabética, como o repositório entrega.
    expect(within(quem).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Não informado',
      'Dr. Rafael Nogueira',
      'Dra. Camila Rocha',
    ]);
  });

  it('"Colocar na lista de espera" cria o paciente na lista de espera', async () => {
    const { repositorio, usuaria } = await abrirFormulario();

    await usuaria.type(screen.getByLabelText('Nome'), 'Beatriz Teste');
    await usuaria.click(screen.getByLabelText('Psicoterapia'));
    await usuaria.click(screen.getByLabelText('Colocar na lista de espera'));
    await usuaria.click(screen.getByRole('button', { name: 'Salvar paciente' }));

    await screen.findByRole('heading', { level: 1, name: 'Beatriz Teste' });
    const salvo = (await repositorio.listarPacientes()).find((p) => p.nome === 'Beatriz Teste');
    expect(salvo?.status).toBe('lista_espera');
  });

  it('se não conseguir salvar, avisa e mantém o que foi digitado', async () => {
    const base = repositorioDemo();
    const salvarPaciente = vi.fn().mockRejectedValue(new Error('sem rede'));
    renderComRotas('/pacientes/novo', { repositorio: { ...base, salvarPaciente } });
    const usuaria = userEvent.setup();

    await usuaria.type(await screen.findByLabelText('Nome'), 'Beatriz Teste');
    await usuaria.click(screen.getByLabelText('Psicoterapia'));
    await usuaria.click(screen.getByRole('button', { name: 'Salvar paciente' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar. Tente de novo.');
    expect(screen.getByLabelText('Nome')).toHaveValue('Beatriz Teste');
  });

  it('se a avaliação falhar depois de gravar o paciente, tentar de novo completa o cadastro sem criar um segundo paciente', async () => {
    const base = repositorioDemo();
    const salvarAvaliacao = vi.fn().mockRejectedValueOnce(new Error('sem rede')).mockImplementation(base.salvarAvaliacao);
    renderComRotas('/pacientes/novo', { repositorio: { ...base, salvarAvaliacao } });
    const usuaria = userEvent.setup();
    const beatrizes = async () => (await base.listarPacientes()).filter((p) => p.nome === 'Beatriz Teste');

    await usuaria.type(await screen.findByLabelText('Nome'), 'Beatriz Teste');
    await usuaria.click(screen.getByLabelText('Avaliação'));
    await usuaria.click(screen.getByRole('button', { name: 'Salvar paciente' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível salvar. Tente de novo.');
    expect(alerta).toHaveTextContent('Se o paciente já foi gravado, ele não será duplicado.');
    // O paciente chegou a ser gravado; a avaliação não.
    expect(await beatrizes()).toHaveLength(1);
    expect(screen.getByLabelText('Nome')).toHaveValue('Beatriz Teste');

    await usuaria.click(screen.getByRole('button', { name: 'Salvar paciente' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Beatriz Teste' })).toBeInTheDocument();
    expect(await screen.findByText('Avaliação · sessão 1 de 10')).toBeInTheDocument();
    const gravados = await beatrizes();
    expect(gravados).toHaveLength(1);
    expect((await base.obterFicha(gravados[0].id))?.avaliacao?.etapas).toHaveLength(5);
  });

  it('Cancelar e o link de voltar levam de volta à lista, sem gravar', async () => {
    const { repositorio, usuaria } = await abrirFormulario();
    const antes = (await repositorio.listarPacientes()).length;

    await usuaria.type(screen.getByLabelText('Nome'), 'Beatriz Teste');
    await usuaria.click(screen.getByRole('link', { name: 'Cancelar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Pacientes' })).toBeInTheDocument();
    expect(await repositorio.listarPacientes()).toHaveLength(antes);
  });

  it('depois de salvar, "voltar" na ficha leva à lista com o paciente novo', async () => {
    const { usuaria } = await abrirFormulario();

    await usuaria.type(screen.getByLabelText('Nome'), 'Beatriz Teste');
    await usuaria.click(screen.getByLabelText('Psicoterapia'));
    await usuaria.click(screen.getByRole('button', { name: 'Salvar paciente' }));
    await screen.findByRole('heading', { level: 1, name: 'Beatriz Teste' });
    await usuaria.click(screen.getByRole('link', { name: 'Voltar para Pacientes' }));

    expect(await screen.findByRole('link', { name: /Beatriz Teste/ })).toBeInTheDocument();
    await waitFor(() => expect(nomesDosGrupos()).toEqual(['Em avaliação (1)', 'Em psicoterapia (3)', 'Lista de espera (1)', 'Alta (0)']));
  });
});
