import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { criarRepositorioMemoria } from '../../dados/memoria';
import type { Parceiro } from '../../dominio/tipos';
import { dadosPacienteExemplo } from '../../testes/fabricas';
import { renderComRotas } from '../../testes/utilitarios';

const CAMINHO = '/mais/parceiros';

const MARTA: Parceiro = {
  id: 'pa1',
  nome: 'Dra. Marta Ribeiro',
  profissao: 'Neuropediatra',
  contato: '(85) 99999-0000',
  observacoes: 'Atende às quartas.',
};
const ZE: Parceiro = { id: 'pa2', nome: 'Dr. Zé Alves', profissao: 'Pediatra', contato: '', observacoes: '' };

function comParceiros(...parceiros: Parceiro[]) {
  return renderComRotas(CAMINHO, { repositorio: criarRepositorioMemoria({ parceiros }) });
}

describe('TelaParceiros', () => {
  it('sem parceiros, explica como começar', async () => {
    renderComRotas(CAMINHO);

    expect(await screen.findByRole('heading', { name: 'Parceiros' })).toBeInTheDocument();
    expect(await screen.findByText('Nenhum parceiro cadastrado ainda.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar parceiro' })).toBeInTheDocument();
  });

  it('a ordem alfabética não depende do banco: "Ágata" vem antes de "Zeca"', async () => {
    const zeca: Parceiro = { ...ZE, id: 'z', nome: 'Zeca Moura' };
    const agata: Parceiro = { ...ZE, id: 'a', nome: 'Ágata Lins' };
    const base = criarRepositorioMemoria({ parceiros: [zeca, agata] });
    // Como um banco com ordenação por código de letra devolveria ("Á" depois de "Z").
    renderComRotas(CAMINHO, { repositorio: { ...base, listarParceiros: async () => [zeca, agata] } });

    const itens = await screen.findAllByRole('listitem');
    expect(itens.map((i) => i.textContent)).toEqual([expect.stringContaining('Ágata Lins'), expect.stringContaining('Zeca Moura')]);
  });

  it('lista os parceiros em ordem alfabética, com profissão, contato e observações', async () => {
    comParceiros(ZE, MARTA);

    const itens = await screen.findAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent('Dr. Zé Alves');
    expect(itens[1]).toHaveTextContent('Dra. Marta Ribeiro');
    expect(itens[1]).toHaveTextContent('Neuropediatra');
    expect(itens[1]).toHaveTextContent('(85) 99999-0000');
    expect(itens[1]).toHaveTextContent('Atende às quartas.');
  });

  it('adiciona "Dra. Marta Ribeiro — Neuropediatra"', async () => {
    const { repositorio } = renderComRotas(CAMINHO);
    const usuaria = userEvent.setup();

    await usuaria.click(await screen.findByRole('button', { name: 'Adicionar parceiro' }));
    await usuaria.type(screen.getByLabelText('Nome'), 'Dra. Marta Ribeiro');
    await usuaria.type(screen.getByLabelText('Profissão'), 'Neuropediatra');
    await usuaria.type(screen.getByLabelText('Contato'), '(85) 99999-0000');
    await usuaria.type(screen.getByLabelText('Observações'), 'Atende às quartas.');
    await usuaria.click(screen.getByRole('button', { name: 'Salvar' }));

    // Volta para a lista, já com o parceiro novo.
    const item = await screen.findByRole('listitem');
    expect(item).toHaveTextContent('Dra. Marta Ribeiro');
    expect(item).toHaveTextContent('Neuropediatra');
    expect(screen.getByRole('button', { name: 'Adicionar parceiro' })).toBeInTheDocument();
    expect(await repositorio.listarParceiros()).toEqual([
      expect.objectContaining({
        nome: 'Dra. Marta Ribeiro',
        profissao: 'Neuropediatra',
        contato: '(85) 99999-0000',
        observacoes: 'Atende às quartas.',
      }),
    ]);
  });

  it('o nome é obrigatório: sem ele mostra o aviso e não grava', async () => {
    const { repositorio } = renderComRotas(CAMINHO);
    const usuaria = userEvent.setup();

    await usuaria.click(await screen.findByRole('button', { name: 'Adicionar parceiro' }));
    await usuaria.type(screen.getByLabelText('Profissão'), 'Neuropediatra');
    await usuaria.type(screen.getByLabelText('Nome'), '   ');
    await usuaria.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Informe o nome do parceiro.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toBeInvalid();
    expect(await repositorio.listarParceiros()).toEqual([]);

    // Corrigindo o nome, o mesmo formulário grava.
    await usuaria.type(screen.getByLabelText('Nome'), ' Dra. Marta Ribeiro ');
    await usuaria.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('listitem')).toHaveTextContent('Dra. Marta Ribeiro');
    expect((await repositorio.listarParceiros())[0].nome).toBe('Dra. Marta Ribeiro');
  });

  it('edita um parceiro: o formulário vem preenchido e salvar atualiza o mesmo registro', async () => {
    const { repositorio } = comParceiros(MARTA);
    const usuaria = userEvent.setup();

    await usuaria.click(await screen.findByRole('button', { name: 'Editar Dra. Marta Ribeiro' }));
    expect(screen.getByLabelText('Nome')).toHaveValue('Dra. Marta Ribeiro');
    expect(screen.getByLabelText('Profissão')).toHaveValue('Neuropediatra');
    expect(screen.getByLabelText('Contato')).toHaveValue('(85) 99999-0000');
    expect(screen.getByLabelText('Observações')).toHaveValue('Atende às quartas.');

    await usuaria.clear(screen.getByLabelText('Contato'));
    await usuaria.type(screen.getByLabelText('Contato'), '(85) 98888-1111');
    await usuaria.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('(85) 98888-1111')).toBeInTheDocument();
    const lista = await repositorio.listarParceiros();
    expect(lista).toEqual([{ ...MARTA, contato: '(85) 98888-1111' }]);
  });

  it('cancelar a edição volta para a lista sem gravar', async () => {
    const { repositorio } = comParceiros(MARTA);
    const usuaria = userEvent.setup();

    await usuaria.click(await screen.findByRole('button', { name: 'Editar Dra. Marta Ribeiro' }));
    await usuaria.clear(screen.getByLabelText('Nome'));
    await usuaria.type(screen.getByLabelText('Nome'), 'Outro nome');
    await usuaria.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByRole('listitem')).toHaveTextContent('Dra. Marta Ribeiro');
    expect(await repositorio.listarParceiros()).toEqual([MARTA]);
  });

  describe('remover', () => {
    it('pede confirmação num diálogo; "Cancelar" mantém o parceiro', async () => {
      const { repositorio } = comParceiros(MARTA);
      const usuaria = userEvent.setup();

      const gatilho = await screen.findByRole('button', { name: 'Remover Dra. Marta Ribeiro' });
      await usuaria.click(gatilho);
      const dialogo = await screen.findByRole('dialog', { name: 'Remover parceiro?' });
      expect(dialogo).toHaveTextContent('Dra. Marta Ribeiro');
      // Nada foi apagado só por abrir o diálogo.
      expect(await repositorio.listarParceiros()).toEqual([MARTA]);

      await usuaria.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('listitem')).toHaveTextContent('Dra. Marta Ribeiro');
      expect(await repositorio.listarParceiros()).toEqual([MARTA]);
      // Foco volta para o botão que abriu o diálogo.
      expect(gatilho).toHaveFocus();
    });

    it('"Remover" no diálogo apaga o parceiro da lista e do repositório', async () => {
      const { repositorio } = comParceiros(MARTA, ZE);
      const usuaria = userEvent.setup();

      await usuaria.click(await screen.findByRole('button', { name: 'Remover Dra. Marta Ribeiro' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Remover parceiro?' });
      await usuaria.click(within(dialogo).getByRole('button', { name: 'Remover' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await waitFor(() => expect(screen.queryByText('Dra. Marta Ribeiro')).not.toBeInTheDocument());
      expect(screen.getByRole('listitem')).toHaveTextContent('Dr. Zé Alves');
      expect(await repositorio.listarParceiros()).toEqual([ZE]);
    });

    it('os pacientes encaminhados por ele ficam sem parceiro (e o diálogo avisa)', async () => {
      const repositorio = criarRepositorioMemoria({
        parceiros: [MARTA],
        pacientes: [{ id: 'p1', ...dadosPacienteExemplo({ parceiroId: 'pa1' }) }],
      });
      renderComRotas(CAMINHO, { repositorio });
      const usuaria = userEvent.setup();

      await usuaria.click(await screen.findByRole('button', { name: 'Remover Dra. Marta Ribeiro' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Remover parceiro?' });
      expect(dialogo).toHaveTextContent('ficam sem parceiro');
      await usuaria.click(within(dialogo).getByRole('button', { name: 'Remover' }));

      await waitFor(async () => expect((await repositorio.listarPacientes())[0].parceiroId).toBeNull());
    });

    it('Esc fecha o diálogo sem remover', async () => {
      const { repositorio } = comParceiros(MARTA);
      const usuaria = userEvent.setup();

      await usuaria.click(await screen.findByRole('button', { name: 'Remover Dra. Marta Ribeiro' }));
      await screen.findByRole('dialog');
      await usuaria.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(await repositorio.listarParceiros()).toEqual([MARTA]);
    });

    it('se não conseguir remover, avisa e o parceiro continua na lista', async () => {
      const base = criarRepositorioMemoria({ parceiros: [MARTA] });
      const repositorio = { ...base, removerParceiro: vi.fn().mockRejectedValue(new Error('sem rede')) };
      renderComRotas(CAMINHO, { repositorio });
      const usuaria = userEvent.setup();

      await usuaria.click(await screen.findByRole('button', { name: 'Remover Dra. Marta Ribeiro' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Remover parceiro?' });
      await usuaria.click(within(dialogo).getByRole('button', { name: 'Remover' }));

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Não foi possível remover. Tente de novo.');
      expect(screen.getByRole('listitem')).toHaveTextContent('Dra. Marta Ribeiro');
    });
  });

  it('se não conseguir carregar a lista, avisa', async () => {
    const base = criarRepositorioMemoria();
    renderComRotas(CAMINHO, { repositorio: { ...base, listarParceiros: vi.fn().mockRejectedValue(new Error('x')) } });

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os parceiros.');
  });

  it('tem um caminho de volta para "Mais"', async () => {
    renderComRotas(CAMINHO);
    const usuaria = userEvent.setup();

    await usuaria.click(await screen.findByRole('link', { name: 'Voltar para Mais' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Mais' })).toBeInTheDocument());
  });
});
