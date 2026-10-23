import { screen, waitFor, within } from '@testing-library/react';
import { criarRepositorioMemoria } from '../../dados/memoria';
import type { Responsavel } from '../../dominio/tipos';
import { pacienteExemplo } from '../../testes/fabricas';
import { abrirFicha, ANA, PEDRO, repositorioDemo, usarHojeFixo } from '../../testes/ficha';

usarHojeFixo();

const SEM_RESPONSAVEIS = () => criarRepositorioMemoria({ pacientes: [pacienteExemplo()] });

function responsavel(sobre: Partial<Responsavel> = {}): Responsavel {
  return {
    id: 'r1',
    pacienteId: 'p1',
    nome: 'Carla Souza',
    parentesco: 'Mãe',
    cpf: null,
    telefone: '(85) 90000-0009',
    email: null,
    principal: true,
    pagador: true,
    ...sobre,
  };
}

async function abrirSecao(id: string, repositorio = repositorioDemo()) {
  const resultado = abrirFicha(id, repositorio);
  const secao = await screen.findByRole('region', { name: 'Responsáveis' });
  return { ...resultado, secao };
}

/** Preenche o formulário "Adicionar responsável" (os campos opcionais só se vierem). */
async function adicionar(
  { usuaria, secao }: Awaited<ReturnType<typeof abrirSecao>>,
  dados: { nome: string; parentesco?: string; cpf?: string; telefone?: string; email?: string },
) {
  // Depois de salvar, o formulário se fecha e o botão volta.
  await usuaria.click(await within(secao).findByRole('button', { name: 'Adicionar responsável' }));
  await usuaria.type(within(secao).getByLabelText('Nome'), dados.nome);
  if (dados.parentesco) await usuaria.type(within(secao).getByLabelText('Parentesco'), dados.parentesco);
  if (dados.cpf) await usuaria.type(within(secao).getByLabelText('CPF'), dados.cpf);
  if (dados.telefone) await usuaria.type(within(secao).getByLabelText('Telefone'), dados.telefone);
  if (dados.email) await usuaria.type(within(secao).getByLabelText('E-mail'), dados.email);
  await usuaria.click(within(secao).getByRole('button', { name: 'Salvar responsável' }));
}

describe('SecaoResponsaveis', () => {
  it('lista os responsáveis, o principal primeiro e com o selo "Principal"; mostra pagador, telefone e e-mail', async () => {
    const { secao } = await abrirSecao(PEDRO);

    const itens = within(secao).getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent('Carlos Lima');
    expect(itens[0]).toHaveTextContent('Pai');
    expect(itens[0]).toHaveTextContent('(85) 90000-0002');
    expect(within(itens[0]).getByText('Principal')).toBeInTheDocument();
    expect(within(itens[0]).getByText('Pagador')).toBeInTheDocument();
    expect(itens[1]).toHaveTextContent('Fernanda Lima');
    expect(within(itens[1]).queryByText('Principal')).not.toBeInTheDocument();
    expect(within(itens[1]).queryByText('Pagador')).not.toBeInTheDocument();
  });

  it('sem responsáveis, avisa e oferece adicionar', async () => {
    const { secao } = await abrirSecao('p1', SEM_RESPONSAVEIS());

    expect(within(secao).getByText('Nenhum responsável cadastrado ainda.')).toBeInTheDocument();
    expect(within(secao).getByRole('button', { name: 'Adicionar responsável' })).toBeInTheDocument();
  });

  it('adiciona dois responsáveis e marca o segundo como principal: só ele fica com o selo "Principal"', async () => {
    const repositorio = SEM_RESPONSAVEIS();
    const contexto = await abrirSecao('p1', repositorio);
    const { usuaria, secao } = contexto;

    await adicionar(contexto, { nome: 'Carla Souza', parentesco: 'Mãe', telefone: '85900000009' });
    await within(secao).findByText('Carla Souza');
    // O primeiro responsável já nasce como principal e pagador.
    expect(within(secao).getAllByText('Principal')).toHaveLength(1);

    await adicionar(contexto, { nome: 'Paulo Souza', parentesco: 'Pai', telefone: '85988232033' });
    await within(secao).findByText('Paulo Souza');
    // O segundo não rouba o selo.
    expect(within(secao).getAllByText('Principal')).toHaveLength(1);
    expect(within(within(secao).getAllByRole('listitem')[0]).getByText('Principal')).toBeInTheDocument();
    expect(within(secao).getAllByRole('listitem')[0]).toHaveTextContent('Carla Souza');

    await usuaria.click(within(secao).getByRole('button', { name: 'Marcar como principal: Paulo Souza' }));

    await waitFor(() => {
      const itens = within(secao).getAllByRole('listitem');
      // Agora o principal vem primeiro e é o único com o selo.
      expect(itens[0]).toHaveTextContent('Paulo Souza');
      expect(within(secao).getAllByText('Principal')).toHaveLength(1);
      expect(within(itens[0]).getByText('Principal')).toBeInTheDocument();
    });
    expect(within(secao).queryByRole('button', { name: 'Marcar como principal: Paulo Souza' })).not.toBeInTheDocument();
    expect(within(secao).getByRole('button', { name: 'Marcar como principal: Carla Souza' })).toBeInTheDocument();

    const gravados = (await repositorio.obterFicha('p1'))!.responsaveis;
    expect(gravados.map((r) => [r.nome, r.principal])).toEqual([
      ['Paulo Souza', true],
      ['Carla Souza', false],
    ]);
  });

  it('o telefone é digitado com a máscara (85) 98823-2033, ou (85) 3222-1100 para fixo', async () => {
    const repositorio = SEM_RESPONSAVEIS();
    const contexto = await abrirSecao('p1', repositorio);
    const { usuaria, secao } = contexto;

    await usuaria.click(within(secao).getByRole('button', { name: 'Adicionar responsável' }));
    await usuaria.type(within(secao).getByLabelText('Telefone'), '85988232033');
    expect(within(secao).getByLabelText('Telefone')).toHaveValue('(85) 98823-2033');

    await usuaria.clear(within(secao).getByLabelText('Telefone'));
    await usuaria.type(within(secao).getByLabelText('Telefone'), '8532221100');
    expect(within(secao).getByLabelText('Telefone')).toHaveValue('(85) 3222-1100');

    await usuaria.type(within(secao).getByLabelText('Nome'), 'Carla');
    await usuaria.click(within(secao).getByRole('button', { name: 'Salvar responsável' }));
    await within(secao).findByText('Carla');
    expect((await repositorio.obterFicha('p1'))!.responsaveis[0].telefone).toBe('(85) 3222-1100');
  });

  it('CPF com a máscara 000.000.000-00, opcional (null quando em branco)', async () => {
    const repositorio = SEM_RESPONSAVEIS();
    const contexto = await abrirSecao('p1', repositorio);
    const { secao } = contexto;

    await adicionar(contexto, { nome: 'Carla', cpf: '12345678901', email: 'carla@exemplo.com' });
    await within(secao).findByText('Carla');
    expect(within(secao).getByText(/123\.456\.789-01/)).toBeInTheDocument();
    expect(within(secao).getByText(/carla@exemplo\.com/)).toBeInTheDocument();

    await adicionar(contexto, { nome: 'Paulo' });
    await within(secao).findByText('Paulo');
    const gravados = (await repositorio.obterFicha('p1'))!.responsaveis;
    expect(gravados.find((r) => r.nome === 'Carla')).toMatchObject({ cpf: '123.456.789-01', email: 'carla@exemplo.com' });
    expect(gravados.find((r) => r.nome === 'Paulo')).toMatchObject({ cpf: null, email: null, telefone: '', parentesco: '' });
    expect(within(secao).queryByLabelText('Telefone')).not.toBeInTheDocument();
  });

  it('o nome é obrigatório; telefone e CPF incompletos são recusados', async () => {
    const repositorio = SEM_RESPONSAVEIS();
    const { usuaria, secao } = await abrirSecao('p1', repositorio);

    await usuaria.click(within(secao).getByRole('button', { name: 'Adicionar responsável' }));
    await usuaria.type(within(secao).getByLabelText('Telefone'), '859882');
    await usuaria.type(within(secao).getByLabelText('CPF'), '123');
    await usuaria.click(within(secao).getByRole('button', { name: 'Salvar responsável' }));

    expect(await within(secao).findByText('Informe o nome do responsável.')).toBeInTheDocument();
    expect(within(secao).getByText('Informe o telefone com DDD, como (85) 98823-2033.')).toBeInTheDocument();
    expect(within(secao).getByText('O CPF deve ter 11 números.')).toBeInTheDocument();
    expect((await repositorio.obterFicha('p1'))!.responsaveis).toEqual([]);
  });

  it('e-mail inválido é recusado', async () => {
    const { usuaria, secao } = await abrirSecao('p1', SEM_RESPONSAVEIS());

    await usuaria.click(within(secao).getByRole('button', { name: 'Adicionar responsável' }));
    await usuaria.type(within(secao).getByLabelText('Nome'), 'Carla');
    await usuaria.type(within(secao).getByLabelText('E-mail'), 'carla-sem-arroba');
    await usuaria.click(within(secao).getByRole('button', { name: 'Salvar responsável' }));

    expect(await within(secao).findByText('Informe um e-mail válido, como nome@exemplo.com.')).toBeInTheDocument();
  });

  it('Cancelar fecha o formulário sem gravar', async () => {
    const repositorio = SEM_RESPONSAVEIS();
    const { usuaria, secao } = await abrirSecao('p1', repositorio);

    await usuaria.click(within(secao).getByRole('button', { name: 'Adicionar responsável' }));
    await usuaria.type(within(secao).getByLabelText('Nome'), 'Carla');
    await usuaria.click(within(secao).getByRole('button', { name: 'Cancelar' }));

    expect(within(secao).queryByLabelText('Nome')).not.toBeInTheDocument();
    expect((await repositorio.obterFicha('p1'))!.responsaveis).toEqual([]);
  });

  it('edita um responsável: o formulário vem preenchido e salvar atualiza o mesmo registro', async () => {
    const repositorio = criarRepositorioMemoria({ pacientes: [pacienteExemplo()], responsaveis: [responsavel()] });
    const { usuaria, secao } = await abrirSecao('p1', repositorio);

    await usuaria.click(within(secao).getByRole('button', { name: 'Editar Carla Souza' }));
    expect(within(secao).getByLabelText('Nome')).toHaveValue('Carla Souza');
    expect(within(secao).getByLabelText('Parentesco')).toHaveValue('Mãe');
    expect(within(secao).getByLabelText('Telefone')).toHaveValue('(85) 90000-0009');
    expect(within(secao).getByLabelText('Responsável principal')).toBeChecked();
    expect(within(secao).getByLabelText('Pagador')).toBeChecked();

    await usuaria.clear(within(secao).getByLabelText('Telefone'));
    await usuaria.type(within(secao).getByLabelText('Telefone'), '85911112222');
    await usuaria.click(within(secao).getByLabelText('Pagador'));
    await usuaria.click(within(secao).getByRole('button', { name: 'Salvar responsável' }));

    expect(await within(secao).findByText(/\(85\) 91111-2222/)).toBeInTheDocument();
    expect((await repositorio.obterFicha('p1'))!.responsaveis).toEqual([
      { ...responsavel(), telefone: '(85) 91111-2222', pagador: false },
    ]);
  });

  it('marcar "Responsável principal" no formulário passa o selo para ele', async () => {
    const repositorio = criarRepositorioMemoria({
      pacientes: [pacienteExemplo()],
      responsaveis: [responsavel(), responsavel({ id: 'r2', nome: 'Paulo Souza', principal: false, pagador: false })],
    });
    const { usuaria, secao } = await abrirSecao('p1', repositorio);

    await usuaria.click(within(secao).getByRole('button', { name: 'Editar Paulo Souza' }));
    await usuaria.click(within(secao).getByLabelText('Responsável principal'));
    await usuaria.click(within(secao).getByRole('button', { name: 'Salvar responsável' }));

    await waitFor(() => expect(within(secao).getAllByRole('listitem')[0]).toHaveTextContent('Paulo Souza'));
    expect(within(secao).getAllByText('Principal')).toHaveLength(1);
  });

  describe('remover', () => {
    it('pede confirmação num diálogo; "Cancelar" mantém o responsável', async () => {
      const repositorio = criarRepositorioMemoria({ pacientes: [pacienteExemplo()], responsaveis: [responsavel()] });
      const { usuaria, secao } = await abrirSecao('p1', repositorio);

      const gatilho = within(secao).getByRole('button', { name: 'Remover Carla Souza' });
      await usuaria.click(gatilho);
      const dialogo = await screen.findByRole('dialog', { name: 'Remover responsável?' });
      expect(dialogo).toHaveTextContent('Carla Souza');
      expect((await repositorio.obterFicha('p1'))!.responsaveis).toHaveLength(1);

      await usuaria.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(within(secao).getByText('Carla Souza')).toBeInTheDocument();
      expect((await repositorio.obterFicha('p1'))!.responsaveis).toHaveLength(1);
      expect(gatilho).toHaveFocus();
    });

    it('"Remover" no diálogo apaga o responsável', async () => {
      const repositorio = criarRepositorioMemoria({
        pacientes: [pacienteExemplo()],
        responsaveis: [responsavel(), responsavel({ id: 'r2', nome: 'Paulo Souza', principal: false })],
      });
      const { usuaria, secao } = await abrirSecao('p1', repositorio);

      await usuaria.click(within(secao).getByRole('button', { name: 'Remover Paulo Souza' }));
      await usuaria.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remover' }));

      await waitFor(() => expect(within(secao).queryByText('Paulo Souza')).not.toBeInTheDocument());
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect((await repositorio.obterFicha('p1'))!.responsaveis.map((r) => r.nome)).toEqual(['Carla Souza']);
    });

    it('ao remover o principal, o diálogo lembra de escolher outro', async () => {
      const repositorio = criarRepositorioMemoria({
        pacientes: [pacienteExemplo()],
        responsaveis: [responsavel(), responsavel({ id: 'r2', nome: 'Paulo Souza', principal: false })],
      });
      const { usuaria, secao } = await abrirSecao('p1', repositorio);

      await usuaria.click(within(secao).getByRole('button', { name: 'Remover Carla Souza' }));

      expect(await screen.findByRole('dialog')).toHaveTextContent('Escolha outro responsável principal');
    });

    it('se não conseguir remover, avisa e o responsável continua na lista', async () => {
      const base = criarRepositorioMemoria({ pacientes: [pacienteExemplo()], responsaveis: [responsavel()] });
      const removerResponsavel = vi.fn().mockRejectedValue(new Error('sem rede'));
      const { usuaria, secao } = await abrirSecao('p1', { ...base, removerResponsavel });

      await usuaria.click(within(secao).getByRole('button', { name: 'Remover Carla Souza' }));
      const dialogo = await screen.findByRole('dialog');
      await usuaria.click(within(dialogo).getByRole('button', { name: 'Remover' }));

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Não foi possível remover. Tente de novo.');
      expect(within(secao).getByText('Carla Souza')).toBeInTheDocument();
    });
  });

  it('se não conseguir salvar, avisa e mantém o formulário aberto', async () => {
    const base = SEM_RESPONSAVEIS();
    const salvarResponsavel = vi.fn().mockRejectedValue(new Error('sem rede'));
    const { usuaria, secao } = await abrirSecao('p1', { ...base, salvarResponsavel });

    await usuaria.click(within(secao).getByRole('button', { name: 'Adicionar responsável' }));
    await usuaria.type(within(secao).getByLabelText('Nome'), 'Carla');
    await usuaria.click(within(secao).getByRole('button', { name: 'Salvar responsável' }));

    expect(await within(secao).findByRole('alert')).toHaveTextContent('Não foi possível salvar. Tente de novo.');
    expect(within(secao).getByLabelText('Nome')).toHaveValue('Carla');
  });

  it('o telefone da Ana aparece como foi gravado', async () => {
    const { secao } = await abrirSecao(ANA);

    expect(within(secao).getByText(/\(85\) 90000-0001/)).toBeInTheDocument();
    expect(within(secao).getByText(/mariana\.souza@exemplo\.com/)).toBeInTheDocument();
  });
});
