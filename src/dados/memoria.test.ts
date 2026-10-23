import { CONFIGURACOES_PADRAO } from '../dominio/padroes';
import type { Paciente } from '../dominio/tipos';
import { criarRepositorioMemoria } from './memoria';
import { testarContrato } from './repositorio.contrato';

testarContrato('memória', async () => criarRepositorioMemoria());

describe('repositório em memória', () => {
  const paciente: Paciente = {
    id: 'p1',
    nome: 'Ana Semente',
    dataNascimento: null,
    cpf: null,
    escola: '',
    serie: '',
    observacoes: '',
    status: 'ativo',
    tipo: 'psicoterapia',
    dataEntrada: null,
    dataAlta: null,
    parceiroId: null,
    formaCobranca: 'por_sessao',
    valorSessaoCentavos: 18000,
  };

  it('começa com a semente recebida', async () => {
    const repo = criarRepositorioMemoria({ pacientes: [paciente], configuracoes: CONFIGURACOES_PADRAO });
    expect(await repo.listarPacientes()).toEqual([paciente]);
    expect(await repo.obterConfiguracoes()).toEqual(CONFIGURACOES_PADRAO);
  });

  it('não deixa quem chamou alterar os dados guardados (nem os da semente)', async () => {
    const repo = criarRepositorioMemoria({ pacientes: [paciente] });
    const [lido] = await repo.listarPacientes();
    lido.nome = 'Alterado por fora';
    paciente.nome = 'Alterado na semente';
    expect((await repo.listarPacientes())[0].nome).toBe('Ana Semente');
    paciente.nome = 'Ana Semente';
  });

  it('dois repositórios não compartilham dados', async () => {
    const a = criarRepositorioMemoria();
    const b = criarRepositorioMemoria();
    await a.salvarParceiro({ nome: 'Só no A', profissao: '', contato: '', observacoes: '' });
    expect(await b.listarParceiros()).toEqual([]);
  });

  it('recusa gravar filhos de um paciente que não existe', async () => {
    const repo = criarRepositorioMemoria();
    await expect(
      repo.salvarResponsavel({
        pacienteId: 'nao-existe',
        nome: 'X',
        parentesco: '',
        cpf: null,
        telefone: '',
        email: null,
        principal: false,
        pagador: false,
      }),
    ).rejects.toThrow();
  });
});
