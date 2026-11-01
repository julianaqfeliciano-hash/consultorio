import { CONFIGURACOES_PADRAO } from '../dominio/padroes';
import type { Paciente, Pagamento, Sessao } from '../dominio/tipos';
import { instanteDe } from '../regras/datas';
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

  describe('pagamentos', () => {
    const sessao: Sessao = {
      id: 's1',
      pacienteId: 'p1',
      inicio: instanteDe('2026-10-06', '14:00'),
      duracaoMin: 50,
      tipo: 'psicoterapia',
      acompanhamentoFamiliar: false,
      origem: 'avulsa',
      horarioFixoId: null,
      dataOcorrencia: null,
      situacao: 'compareceu',
      remarcadaPara: null,
      avaliacaoId: null,
      confirmada: true,
      observacao: null,
      valorCentavos: 18000,
    };
    const paga: Pagamento = {
      id: 'pg1',
      pacienteId: 'p1',
      data: '2026-10-06',
      valorCentavos: 18000,
      forma: 'pix',
      observacao: null,
      referencia: 'sessoes',
      mesReferencia: null,
      avaliacaoId: null,
      sessaoIds: ['s1'],
    };

    it('os pagamentos da semente já valem: a sessão paga não pode ser paga de novo nem removida', async () => {
      const repo = criarRepositorioMemoria({ pacientes: [paciente], sessoes: [sessao], pagamentos: [paga] });
      expect(await repo.listarPagamentos()).toEqual([paga]);

      const { id: _id, ...novo } = paga;
      void _id;
      await expect(repo.registrarPagamento(novo)).rejects.toThrow('Esta sessão já foi paga.');
      await expect(repo.removerSessoes(['s1'])).rejects.toThrow('Esta sessão já foi paga e não pode ser removida.');

      await repo.removerPagamento('pg1');
      await repo.removerSessoes(['s1']);
      expect(await repo.listarSessoesDoPaciente('p1')).toEqual([]);
    });

    it('a mesma sessão repetida no mesmo pagamento conta como já paga e não grava nada', async () => {
      const repo = criarRepositorioMemoria({ pacientes: [paciente], sessoes: [sessao] });
      const { id: _id, ...novo } = paga;
      void _id;
      await expect(repo.registrarPagamento({ ...novo, sessaoIds: ['s1', 's1'] })).rejects.toThrow(
        'Esta sessão já foi paga.',
      );
      expect(await repo.listarPagamentos()).toEqual([]);
    });

    it('as sessões só valem no pagamento de sessões: no do mês elas são descartadas, como no banco', async () => {
      const repo = criarRepositorioMemoria({ pacientes: [paciente], sessoes: [sessao] });
      const { id: _id, ...novo } = paga;
      void _id;
      const mes = await repo.registrarPagamento({
        ...novo,
        referencia: 'mes',
        mesReferencia: '2026-10-01',
        sessaoIds: ['s1'],
      });
      expect(mes.sessaoIds).toEqual([]);
      // A sessão continua livre para ser paga à parte.
      expect((await repo.registrarPagamento(novo)).sessaoIds).toEqual(['s1']);
    });

    it('não deixa quem chamou alterar os pagamentos guardados', async () => {
      const repo = criarRepositorioMemoria({ pacientes: [paciente], sessoes: [sessao], pagamentos: [paga] });
      const [lido] = await repo.listarPagamentos();
      lido.sessaoIds.push('qualquer');
      lido.valorCentavos = 1;
      paga.sessaoIds.push('na-semente');
      expect(await repo.listarPagamentos()).toEqual([{ ...paga, sessaoIds: ['s1'] }]);
      paga.sessaoIds.pop();
    });
  });
});
