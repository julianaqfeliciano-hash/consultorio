import { CONFIGURACOES_PADRAO } from '../dominio/padroes';
import type {
  Avaliacao,
  Bloqueio,
  HorarioFixo,
  Id,
  NovaSessao,
  NovoPagamento,
  Paciente,
  Responsavel,
} from '../dominio/tipos';
import { chaveOcorrencia } from '../regras/agenda';
import { instanteDe } from '../regras/datas';
import { RecusaDoRepositorio, type Rascunho, type Repositorio } from './repositorio';

/**
 * Suíte que toda implementação de `Repositorio` precisa passar (memória e Supabase).
 * `fabrica` é chamada antes de cada teste e deve devolver um repositório VAZIO.
 */
export function testarContrato(nome: string, fabrica: () => Promise<Repositorio>): void {
  describe(`contrato do repositório (${nome})`, () => {
    // ---------------------------------------------------------------- dados de apoio
    const idInexistente = () => crypto.randomUUID();

    const rascunhoPaciente = (sobre: Partial<Rascunho<Paciente>> = {}): Rascunho<Paciente> => ({
      nome: 'Ana Teste',
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
      ...sobre,
    });

    const rascunhoResponsavel = (
      pacienteId: Id,
      sobre: Partial<Rascunho<Responsavel>> = {},
    ): Rascunho<Responsavel> => ({
      pacienteId,
      nome: 'Mariana Teste',
      parentesco: 'Mãe',
      cpf: null,
      telefone: '(85) 90000-0001',
      email: null,
      principal: false,
      pagador: false,
      ...sobre,
    });

    const rascunhoHorario = (
      pacienteId: Id,
      sobre: Partial<Rascunho<HorarioFixo>> = {},
    ): Rascunho<HorarioFixo> => ({
      pacienteId,
      diaSemana: 2,
      hora: '14:00',
      duracaoMin: 50,
      validoDe: '2026-01-05',
      validoAte: null,
      ...sobre,
    });

    const rascunhoAvaliacao = (
      pacienteId: Id,
      sobre: Partial<Rascunho<Avaliacao>> = {},
    ): Rascunho<Avaliacao> => ({
      pacienteId,
      inicio: '2026-10-14',
      fim: null,
      sessoesPrevistas: 10,
      etapas: [
        { nome: 'Entrevista com os responsáveis', feita: true },
        { nome: 'Testes aplicados', feita: false },
      ],
      valorPrevistoCentavos: 0,
      descontoTipo: 'nenhum',
      descontoValor: 0,
      ...sobre,
    });

    const sessaoNova = (pacienteId: Id, sobre: Partial<NovaSessao> = {}): NovaSessao => ({
      pacienteId,
      inicio: instanteDe('2026-11-03', '14:00'),
      duracaoMin: 50,
      tipo: 'psicoterapia',
      acompanhamentoFamiliar: false,
      origem: 'avulsa',
      horarioFixoId: null,
      dataOcorrencia: null,
      situacao: 'agendada',
      remarcadaPara: null,
      avaliacaoId: null,
      confirmada: false,
      observacao: null,
      valorCentavos: null,
      ...sobre,
    });

    const ocorrenciaFixa = (
      pacienteId: Id,
      horarioFixoId: Id,
      dia: string,
      hora = '14:00',
    ): NovaSessao =>
      sessaoNova(pacienteId, {
        inicio: instanteDe(dia, hora),
        origem: 'fixa',
        horarioFixoId,
        dataOcorrencia: dia,
      });

    const pagamentoNovo = (pacienteId: Id, sobre: Partial<NovoPagamento> = {}): NovoPagamento => ({
      pacienteId,
      data: '2026-10-20',
      valorCentavos: 18000,
      forma: 'pix',
      observacao: null,
      referencia: 'sessoes',
      mesReferencia: null,
      avaliacaoId: null,
      sessaoIds: [],
      ...sobre,
    });

    /** Sessão já realizada e cobrada, para ser paga. */
    const sessaoCobrada = (pacienteId: Id, dia: string, valorCentavos = 18000): NovaSessao =>
      sessaoNova(pacienteId, {
        inicio: instanteDe(dia, '14:00'),
        situacao: 'compareceu',
        valorCentavos,
      });

    async function pacienteComHorario(repo: Repositorio) {
      const paciente = await repo.salvarPaciente(rascunhoPaciente());
      const horario = await repo.salvarHorario(rascunhoHorario(paciente.id));
      return { paciente, horario };
    }

    // ---------------------------------------------------------------- configurações
    describe('configurações', () => {
      it('começa sem configurações', async () => {
        const repo = await fabrica();
        expect(await repo.obterConfiguracoes()).toBeNull();
      });

      it('salva e relê as configurações; salvar de novo substitui', async () => {
        const repo = await fabrica();
        await repo.salvarConfiguracoes(CONFIGURACOES_PADRAO);
        expect(await repo.obterConfiguracoes()).toEqual(CONFIGURACOES_PADRAO);

        const alteradas = { ...CONFIGURACOES_PADRAO, duracaoPadraoMin: 45, cpf: '529.982.247-25' };
        await repo.salvarConfiguracoes(alteradas);
        expect(await repo.obterConfiguracoes()).toEqual(alteradas);
      });

      it('guarda o valor padrão da avaliação', async () => {
        const repo = await fabrica();
        const comValor = { ...CONFIGURACOES_PADRAO, valorAvaliacaoPadraoCentavos: 180000 };
        await repo.salvarConfiguracoes(comValor);
        expect(await repo.obterConfiguracoes()).toEqual(comValor);
      });
    });

    // ---------------------------------------------------------------- parceiros
    describe('parceiros', () => {
      it('cria, lista, edita e remove', async () => {
        const repo = await fabrica();
        const criado = await repo.salvarParceiro({
          nome: 'Dra. Marta Ribeiro',
          profissao: 'Neuropediatra',
          contato: '(85) 90000-0100',
          observacoes: 'Atende às terças',
        });
        expect(criado.id).toEqual(expect.any(String));
        expect(await repo.listarParceiros()).toEqual([criado]);

        const editado = await repo.salvarParceiro({ ...criado, contato: 'marta@exemplo.com' });
        expect(editado).toEqual({ ...criado, contato: 'marta@exemplo.com' });
        expect(await repo.listarParceiros()).toEqual([editado]);

        await repo.removerParceiro(criado.id);
        expect(await repo.listarParceiros()).toEqual([]);
      });

      it('lista em ordem alfabética', async () => {
        const repo = await fabrica();
        for (const n of ['Carla', 'Ana', 'Bruno']) {
          await repo.salvarParceiro({ nome: n, profissao: '', contato: '', observacoes: '' });
        }
        expect((await repo.listarParceiros()).map((p) => p.nome)).toEqual(['Ana', 'Bruno', 'Carla']);
      });

      it('remover um parceiro desvincula os pacientes dele', async () => {
        const repo = await fabrica();
        const parceiro = await repo.salvarParceiro({
          nome: 'Dr. Paulo',
          profissao: '',
          contato: '',
          observacoes: '',
        });
        const paciente = await repo.salvarPaciente(rascunhoPaciente({ parceiroId: parceiro.id }));
        await repo.removerParceiro(parceiro.id);
        expect((await repo.obterFicha(paciente.id))?.paciente.parceiroId).toBeNull();
      });
    });

    // ---------------------------------------------------------------- pacientes
    describe('pacientes', () => {
      it('salva e relê um paciente com todos os campos', async () => {
        const repo = await fabrica();
        const parceiro = await repo.salvarParceiro({
          nome: 'Dra. Marta',
          profissao: 'Pediatra',
          contato: '',
          observacoes: '',
        });
        const entrada = rascunhoPaciente({
          nome: 'Pedro Henrique Teste',
          dataNascimento: '2017-03-09',
          cpf: '529.982.247-25',
          escola: 'Escola Girassol',
          serie: '3º ano',
          observacoes: 'Prefere desenhar.',
          status: 'alta',
          tipo: 'avaliacao',
          dataEntrada: '2026-02-02',
          dataAlta: '2026-10-30',
          parceiroId: parceiro.id,
          formaCobranca: 'mensal',
          valorSessaoCentavos: 20050,
        });

        const salvo = await repo.salvarPaciente(entrada);
        expect(salvo.id).toEqual(expect.any(String));
        expect(salvo).toEqual({ ...entrada, id: salvo.id });

        const ficha = await repo.obterFicha(salvo.id);
        expect(ficha?.paciente).toEqual(salvo);
        expect(await repo.listarPacientes()).toEqual([salvo]);
      });

      it('preserva campos nulos e textos vazios', async () => {
        const repo = await fabrica();
        const salvo = await repo.salvarPaciente(rascunhoPaciente({ nome: 'Lucas Teste' }));
        const relido = (await repo.obterFicha(salvo.id))?.paciente;
        expect(relido).toEqual(salvo);
        expect(relido).toMatchObject({
          dataNascimento: null,
          cpf: null,
          dataEntrada: null,
          dataAlta: null,
          parceiroId: null,
          escola: '',
          serie: '',
          observacoes: '',
        });
      });

      it('salvar com id existente atualiza em vez de duplicar', async () => {
        const repo = await fabrica();
        const criado = await repo.salvarPaciente(rascunhoPaciente());
        const editado = await repo.salvarPaciente({ ...criado, nome: 'Ana Clara Teste', status: 'alta' });
        expect(editado.id).toBe(criado.id);
        expect(await repo.listarPacientes()).toEqual([editado]);
      });

      it('lista em ordem alfabética', async () => {
        const repo = await fabrica();
        for (const n of ['Carla', 'Ana', 'Bruno']) {
          await repo.salvarPaciente(rascunhoPaciente({ nome: n }));
        }
        expect((await repo.listarPacientes()).map((p) => p.nome)).toEqual(['Ana', 'Bruno', 'Carla']);
      });

      it('obterFicha devolve null para um paciente que não existe', async () => {
        const repo = await fabrica();
        expect(await repo.obterFicha(idInexistente())).toBeNull();
      });
    });

    // ---------------------------------------------------------------- ficha
    describe('ficha do paciente', () => {
      it('traz responsáveis, horários e avaliação do paciente', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente({ tipo: 'avaliacao' }));
        const outro = await repo.salvarPaciente(rascunhoPaciente({ nome: 'Outro Paciente' }));
        const resp = await repo.salvarResponsavel(
          rascunhoResponsavel(paciente.id, { principal: true, pagador: true }),
        );
        const horario = await repo.salvarHorario(rascunhoHorario(paciente.id));
        const avaliacao = await repo.salvarAvaliacao(rascunhoAvaliacao(paciente.id));
        // dados de outro paciente não podem aparecer
        await repo.salvarResponsavel(rascunhoResponsavel(outro.id, { nome: 'Alheia' }));
        await repo.salvarHorario(rascunhoHorario(outro.id, { diaSemana: 4 }));
        await repo.salvarAvaliacao(rascunhoAvaliacao(outro.id));

        const ficha = await repo.obterFicha(paciente.id);
        expect(ficha).toEqual({
          paciente,
          responsaveis: [resp],
          horarios: [horario],
          avaliacao,
        });
      });

      it('sem horários, responsáveis ou avaliação, vem vazio e avaliacao null', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        expect(await repo.obterFicha(paciente.id)).toEqual({
          paciente,
          responsaveis: [],
          horarios: [],
          avaliacao: null,
        });
      });

      it('com mais de uma avaliação, traz a mais recente', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente({ tipo: 'avaliacao' }));
        await repo.salvarAvaliacao(rascunhoAvaliacao(paciente.id, { inicio: '2025-03-03', fim: '2025-06-30' }));
        const recente = await repo.salvarAvaliacao(rascunhoAvaliacao(paciente.id, { inicio: '2026-10-14' }));
        expect((await repo.obterFicha(paciente.id))?.avaliacao).toEqual(recente);
      });
    });

    // ---------------------------------------------------------------- responsáveis
    describe('responsáveis', () => {
      it('salva todos os campos e relê', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const entrada = rascunhoResponsavel(paciente.id, {
          nome: 'Carlos Teste',
          parentesco: 'Pai',
          cpf: '529.982.247-25',
          telefone: '(85) 90000-0002',
          email: 'carlos@exemplo.com',
          principal: true,
          pagador: true,
        });
        const salvo = await repo.salvarResponsavel(entrada);
        expect(salvo).toEqual({ ...entrada, id: salvo.id });
        expect((await repo.obterFicha(paciente.id))?.responsaveis).toEqual([salvo]);
      });

      it('marcar um segundo responsável como principal desmarca o primeiro', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const outro = await repo.salvarPaciente(rascunhoPaciente({ nome: 'Outro Paciente' }));
        const primeiro = await repo.salvarResponsavel(
          rascunhoResponsavel(paciente.id, { nome: 'Primeira', principal: true }),
        );
        const principalDoOutro = await repo.salvarResponsavel(
          rascunhoResponsavel(outro.id, { nome: 'Do outro', principal: true }),
        );
        const segundo = await repo.salvarResponsavel(
          rascunhoResponsavel(paciente.id, { nome: 'Segundo', principal: true }),
        );

        const { responsaveis } = (await repo.obterFicha(paciente.id))!;
        expect(responsaveis.find((r) => r.id === primeiro.id)?.principal).toBe(false);
        expect(responsaveis.find((r) => r.id === segundo.id)?.principal).toBe(true);
        expect(responsaveis.filter((r) => r.principal)).toHaveLength(1);
        // o principal de outro paciente não é tocado
        expect((await repo.obterFicha(outro.id))?.responsaveis).toEqual([principalDoOutro]);
      });

      it('editar o responsável que já é principal mantém a marcação; salvar não-principal não mexe nos outros', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const principal = await repo.salvarResponsavel(
          rascunhoResponsavel(paciente.id, { nome: 'Principal', principal: true }),
        );
        await repo.salvarResponsavel({ ...principal, telefone: '(85) 90000-0009' });
        await repo.salvarResponsavel(rascunhoResponsavel(paciente.id, { nome: 'Outra', principal: false }));

        const { responsaveis } = (await repo.obterFicha(paciente.id))!;
        expect(responsaveis).toHaveLength(2);
        const relido = responsaveis.find((r) => r.id === principal.id);
        expect(relido).toMatchObject({ principal: true, telefone: '(85) 90000-0009' });
      });

      it('o principal vem primeiro na ficha', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        await repo.salvarResponsavel(rascunhoResponsavel(paciente.id, { nome: 'Comum' }));
        const principal = await repo.salvarResponsavel(
          rascunhoResponsavel(paciente.id, { nome: 'Principal', principal: true }),
        );
        expect((await repo.obterFicha(paciente.id))?.responsaveis[0].id).toBe(principal.id);
      });

      it('remove só o responsável pedido', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const a = await repo.salvarResponsavel(rascunhoResponsavel(paciente.id, { nome: 'A' }));
        const b = await repo.salvarResponsavel(rascunhoResponsavel(paciente.id, { nome: 'B' }));
        await repo.removerResponsavel(a.id);
        expect((await repo.obterFicha(paciente.id))?.responsaveis).toEqual([b]);
      });
    });

    // ---------------------------------------------------------------- horários e avaliações
    describe('horários fixos', () => {
      it('salva, relê com hora HH:MM e atualiza pelo id', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const criado = await repo.salvarHorario(
          rascunhoHorario(paciente.id, { diaSemana: 3, hora: '09:00', duracaoMin: 45, validoDe: '2026-10-14' }),
        );
        expect(criado).toMatchObject({ diaSemana: 3, hora: '09:00', duracaoMin: 45, validoAte: null });

        const encerrado = await repo.salvarHorario({ ...criado, validoAte: '2026-12-16' });
        expect(encerrado).toEqual({ ...criado, validoAte: '2026-12-16' });
        expect((await repo.obterFicha(paciente.id))?.horarios).toEqual([encerrado]);
      });
    });

    describe('avaliações', () => {
      it('salva as etapas e relê; atualizar mantém o id', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente({ tipo: 'avaliacao' }));
        const criada = await repo.salvarAvaliacao(rascunhoAvaliacao(paciente.id));
        expect(criada.etapas).toEqual([
          { nome: 'Entrevista com os responsáveis', feita: true },
          { nome: 'Testes aplicados', feita: false },
        ]);

        const atualizada = await repo.salvarAvaliacao({
          ...criada,
          fim: '2026-12-16',
          sessoesPrevistas: 12,
          etapas: [...criada.etapas, { nome: 'Devolutiva', feita: true }],
        });
        expect(atualizada.id).toBe(criada.id);
        expect((await repo.obterFicha(paciente.id))?.avaliacao).toEqual(atualizada);
      });
    });

    describe('valores da avaliação', () => {
      it('guarda o valor previsto e o desconto, e relê igual', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente({ tipo: 'avaliacao' }));
        const entrada = rascunhoAvaliacao(paciente.id, {
          valorPrevistoCentavos: 180000,
          descontoTipo: 'percentual',
          descontoValor: 10,
        });
        const criada = await repo.salvarAvaliacao(entrada);
        expect(criada).toEqual({ ...entrada, id: criada.id });
        expect((await repo.obterFicha(paciente.id))?.avaliacao).toEqual(criada);

        const emReais = await repo.salvarAvaliacao({ ...criada, descontoTipo: 'reais', descontoValor: 15000 });
        expect(emReais).toMatchObject({ valorPrevistoCentavos: 180000, descontoTipo: 'reais', descontoValor: 15000 });
        expect((await repo.obterFicha(paciente.id))?.avaliacao).toEqual(emReais);
      });
    });

    // ---------------------------------------------------------------- horários vigentes
    describe('listarHorariosVigentes', () => {
      it('exclui horários cuja validade termina antes de `de` ou começa depois de `ate`', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const aberto = await repo.salvarHorario(rascunhoHorario(paciente.id, { diaSemana: 2 }));
        const terminaNoLimite = await repo.salvarHorario(
          rascunhoHorario(paciente.id, { diaSemana: 3, validoAte: '2026-11-02' }),
        );
        await repo.salvarHorario(rascunhoHorario(paciente.id, { diaSemana: 4, validoAte: '2026-10-31' }));
        await repo.salvarHorario(rascunhoHorario(paciente.id, { diaSemana: 5, validoDe: '2026-12-01' }));

        const vigentes = await repo.listarHorariosVigentes('2026-11-02', '2026-11-29');
        expect(vigentes.map((h) => h.id).sort()).toEqual([aberto.id, terminaNoLimite.id].sort());
      });

      it('inclui um horário que começa no último dia da janela', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const h = await repo.salvarHorario(rascunhoHorario(paciente.id, { validoDe: '2026-11-29' }));
        const vigentes = await repo.listarHorariosVigentes('2026-11-02', '2026-11-29');
        expect(vigentes.map((x) => x.id)).toEqual([h.id]);
      });

      it('traz status e tipo do paciente e a avaliação dele', async () => {
        const repo = await fabrica();
        const avaliado = await repo.salvarPaciente(rascunhoPaciente({ nome: 'Avaliado', tipo: 'avaliacao' }));
        const espera = await repo.salvarPaciente(
          rascunhoPaciente({ nome: 'Na espera', status: 'lista_espera' }),
        );
        const avaliacao = await repo.salvarAvaliacao(rascunhoAvaliacao(avaliado.id));
        const hAvaliado = await repo.salvarHorario(rascunhoHorario(avaliado.id, { diaSemana: 3, hora: '09:00' }));
        const hEspera = await repo.salvarHorario(rascunhoHorario(espera.id, { diaSemana: 4, hora: '16:00' }));

        const vigentes = await repo.listarHorariosVigentes('2026-11-02', '2026-11-29');
        expect(vigentes).toHaveLength(2);
        expect(vigentes.find((h) => h.id === hAvaliado.id)).toEqual({
          ...hAvaliado,
          statusPaciente: 'ativo',
          tipoPaciente: 'avaliacao',
          avaliacaoId: avaliacao.id,
        });
        expect(vigentes.find((h) => h.id === hEspera.id)).toEqual({
          ...hEspera,
          statusPaciente: 'lista_espera',
          tipoPaciente: 'psicoterapia',
          avaliacaoId: null,
        });
      });
    });

    // ---------------------------------------------------------------- ocorrências
    describe('inserirOcorrencias', () => {
      it('a mesma ocorrência duas vezes vira uma só sessão e a segunda chamada devolve 0', async () => {
        const repo = await fabrica();
        const { paciente, horario } = await pacienteComHorario(repo);
        const ocorrencia = ocorrenciaFixa(paciente.id, horario.id, '2026-11-03');

        expect(await repo.inserirOcorrencias([ocorrencia])).toBe(1);
        expect(await repo.inserirOcorrencias([ocorrencia])).toBe(0);

        const sessoes = await repo.listarSessoes('2026-11-03', '2026-11-03');
        expect(sessoes).toHaveLength(1);
        expect(sessoes[0]).toMatchObject({
          pacienteId: paciente.id,
          horarioFixoId: horario.id,
          dataOcorrencia: '2026-11-03',
          origem: 'fixa',
          situacao: 'agendada',
        });
      });

      it('devolve quantas entraram quando o lote mistura novas e já existentes', async () => {
        const repo = await fabrica();
        const { paciente, horario } = await pacienteComHorario(repo);
        const a = ocorrenciaFixa(paciente.id, horario.id, '2026-11-03');
        const b = ocorrenciaFixa(paciente.id, horario.id, '2026-11-10');
        const c = ocorrenciaFixa(paciente.id, horario.id, '2026-11-17');
        expect(await repo.inserirOcorrencias([a])).toBe(1);
        expect(await repo.inserirOcorrencias([a, b, c])).toBe(2);

        const sessoes = await repo.listarSessoesDoPaciente(paciente.id);
        const chaves = new Set(sessoes.map((s) => chaveOcorrencia(s.horarioFixoId!, s.dataOcorrencia!)));
        expect(chaves).toEqual(
          new Set([
            chaveOcorrencia(horario.id, '2026-11-03'),
            chaveOcorrencia(horario.id, '2026-11-10'),
            chaveOcorrencia(horario.id, '2026-11-17'),
          ]),
        );
      });

      it('ignora repetição dentro do mesmo lote', async () => {
        const repo = await fabrica();
        const { paciente, horario } = await pacienteComHorario(repo);
        const a = ocorrenciaFixa(paciente.id, horario.id, '2026-11-03');
        expect(await repo.inserirOcorrencias([a, a])).toBe(1);
        expect(await repo.listarSessoesDoPaciente(paciente.id)).toHaveLength(1);
      });

      it('lote vazio devolve 0', async () => {
        const repo = await fabrica();
        expect(await repo.inserirOcorrencias([])).toBe(0);
      });

      it('sessões avulsas (sem horário fixo) nunca conflitam entre si', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const avulsa = sessaoNova(paciente.id);
        expect(await repo.inserirOcorrencias([avulsa, avulsa])).toBe(2);
      });
    });

    // ---------------------------------------------------------------- sessões
    describe('listarSessoes', () => {
      it('seleciona pela data LOCAL de São Paulo: inclui 23:30 do dia e exclui 00:30 do dia seguinte', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const tardeDoDia = await repo.criarSessao(
          sessaoNova(paciente.id, { inicio: instanteDe('2026-11-03', '23:30') }),
        );
        await repo.criarSessao(sessaoNova(paciente.id, { inicio: instanteDe('2026-11-04', '00:30') }));
        await repo.criarSessao(sessaoNova(paciente.id, { inicio: instanteDe('2026-11-02', '23:59') }));

        const doDia = await repo.listarSessoes('2026-11-03', '2026-11-03');
        expect(doDia.map((s) => s.id)).toEqual([tardeDoDia.id]);
      });

      it('os limites são a meia-noite local: 00:00 do primeiro dia entra, 00:00 depois do último não', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const naMeiaNoite = await repo.criarSessao(
          sessaoNova(paciente.id, { inicio: instanteDe('2026-11-03', '00:00') }),
        );
        await repo.criarSessao(sessaoNova(paciente.id, { inicio: instanteDe('2026-11-05', '00:00') }));
        const doIntervalo = await repo.listarSessoes('2026-11-03', '2026-11-04');
        expect(doIntervalo.map((s) => s.id)).toEqual([naMeiaNoite.id]);
      });

      it('devolve em ordem de início', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const tarde = await repo.criarSessao(sessaoNova(paciente.id, { inicio: instanteDe('2026-11-03', '16:00') }));
        const manha = await repo.criarSessao(sessaoNova(paciente.id, { inicio: instanteDe('2026-11-03', '09:00') }));
        const outroDia = await repo.criarSessao(sessaoNova(paciente.id, { inicio: instanteDe('2026-11-04', '08:00') }));
        const lista = await repo.listarSessoes('2026-11-03', '2026-11-04');
        expect(lista.map((s) => s.id)).toEqual([manha.id, tarde.id, outroDia.id]);
      });

      it('traz o nome do paciente e o responsável principal (ou null)', async () => {
        const repo = await fabrica();
        const comPrincipal = await repo.salvarPaciente(rascunhoPaciente({ nome: 'Com Principal' }));
        const semResponsavel = await repo.salvarPaciente(rascunhoPaciente({ nome: 'Sem Responsável' }));
        const semPrincipal = await repo.salvarPaciente(rascunhoPaciente({ nome: 'Sem Principal' }));
        await repo.salvarResponsavel(rascunhoResponsavel(comPrincipal.id, { nome: 'Outra Pessoa', telefone: '(85) 90000-0009' }));
        await repo.salvarResponsavel(
          rascunhoResponsavel(comPrincipal.id, { nome: 'Mariana Teste', telefone: '(85) 90000-0001', principal: true }),
        );
        await repo.salvarResponsavel(rascunhoResponsavel(semPrincipal.id, { nome: 'Só Comum' }));

        const a = await repo.criarSessao(sessaoNova(comPrincipal.id, { inicio: instanteDe('2026-11-03', '09:00') }));
        const b = await repo.criarSessao(sessaoNova(semResponsavel.id, { inicio: instanteDe('2026-11-03', '10:00') }));
        const c = await repo.criarSessao(sessaoNova(semPrincipal.id, { inicio: instanteDe('2026-11-03', '11:00') }));

        const lista = await repo.listarSessoes('2026-11-03', '2026-11-03');
        expect(lista).toEqual([
          { ...a, pacienteNome: 'Com Principal', responsavelPrincipal: { nome: 'Mariana Teste', telefone: '(85) 90000-0001' } },
          { ...b, pacienteNome: 'Sem Responsável', responsavelPrincipal: null },
          { ...c, pacienteNome: 'Sem Principal', responsavelPrincipal: null },
        ]);
      });

      it('responsável principal sem telefone vem com telefone vazio, não null', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        await repo.salvarResponsavel(
          rascunhoResponsavel(paciente.id, { nome: 'Renata Teste', telefone: '', principal: true }),
        );
        await repo.criarSessao(sessaoNova(paciente.id));
        const [sessao] = await repo.listarSessoes('2026-11-03', '2026-11-03');
        expect(sessao.responsavelPrincipal).toEqual({ nome: 'Renata Teste', telefone: '' });
      });
    });

    describe('criarSessao', () => {
      it('devolve a sessão com id e todos os campos', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente({ tipo: 'avaliacao' }));
        const avaliacao = await repo.salvarAvaliacao(rascunhoAvaliacao(paciente.id));
        const entrada = sessaoNova(paciente.id, {
          tipo: 'avaliacao',
          acompanhamentoFamiliar: true,
          avaliacaoId: avaliacao.id,
          confirmada: true,
          observacao: 'Trazer os desenhos',
          duracaoMin: 60,
        });
        const criada = await repo.criarSessao(entrada);
        expect(criada).toEqual({ ...entrada, id: criada.id });
        expect(await repo.listarSessoesDoPaciente(paciente.id)).toEqual([criada]);
      });

      it('rejeita uma segunda sessão para a mesma ocorrência do horário fixo', async () => {
        const repo = await fabrica();
        const { paciente, horario } = await pacienteComHorario(repo);
        await repo.criarSessao(ocorrenciaFixa(paciente.id, horario.id, '2026-11-03'));
        await expect(repo.criarSessao(ocorrenciaFixa(paciente.id, horario.id, '2026-11-03'))).rejects.toThrow();
        expect(await repo.listarSessoesDoPaciente(paciente.id)).toHaveLength(1);
      });

      it('guarda o valor da sessão (inclusive zero) e relê igual; sem valor volta null', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const cobrada = await repo.criarSessao(sessaoNova(paciente.id, { valorCentavos: 18000 }));
        const gratis = await repo.criarSessao(
          sessaoNova(paciente.id, { inicio: instanteDe('2026-11-04', '14:00'), valorCentavos: 0 }),
        );
        const semValor = await repo.criarSessao(
          sessaoNova(paciente.id, { inicio: instanteDe('2026-11-05', '14:00') }),
        );
        expect(cobrada.valorCentavos).toBe(18000);
        expect(gratis.valorCentavos).toBe(0);
        expect(semValor.valorCentavos).toBeNull();
        expect(await repo.listarSessoesDoPaciente(paciente.id)).toEqual([cobrada, gratis, semValor]);
      });
    });

    describe('atualizarSessao', () => {
      it('devolve a sessão alterada e grava só o que mudou', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const original = await repo.criarSessao(sessaoNova(paciente.id));

        const alterada = await repo.atualizarSessao(original.id, {
          situacao: 'compareceu',
          confirmada: true,
          observacao: 'Chegou cedo',
        });
        expect(alterada).toEqual({
          ...original,
          situacao: 'compareceu',
          confirmada: true,
          observacao: 'Chegou cedo',
        });
        expect(await repo.listarSessoesDoPaciente(paciente.id)).toEqual([alterada]);
      });

      it('troca o horário e permite voltar campos opcionais para null', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const destino = await repo.criarSessao(sessaoNova(paciente.id, { inicio: instanteDe('2026-11-10', '14:00') }));
        const original = await repo.criarSessao(sessaoNova(paciente.id, { observacao: 'Antes' }));

        const remarcada = await repo.atualizarSessao(original.id, {
          situacao: 'remarcada',
          remarcadaPara: destino.id,
          inicio: instanteDe('2026-11-04', '15:00'),
          duracaoMin: 30,
        });
        expect(remarcada).toMatchObject({
          situacao: 'remarcada',
          remarcadaPara: destino.id,
          inicio: instanteDe('2026-11-04', '15:00'),
          duracaoMin: 30,
          observacao: 'Antes',
        });

        const limpa = await repo.atualizarSessao(original.id, { remarcadaPara: null, observacao: null });
        expect(limpa).toMatchObject({ remarcadaPara: null, observacao: null });
      });

      it('fixa o valor da sessão e permite limpá-lo de volta para null', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const original = await repo.criarSessao(sessaoNova(paciente.id));

        const cobrada = await repo.atualizarSessao(original.id, { situacao: 'compareceu', valorCentavos: 18000 });
        expect(cobrada).toMatchObject({ situacao: 'compareceu', valorCentavos: 18000 });
        // `undefined` não mexe no valor; `null` o limpa.
        expect(await repo.atualizarSessao(original.id, { confirmada: true })).toMatchObject({ valorCentavos: 18000 });
        const limpa = await repo.atualizarSessao(original.id, { valorCentavos: null });
        expect(limpa.valorCentavos).toBeNull();
        expect(await repo.listarSessoesDoPaciente(paciente.id)).toEqual([limpa]);
      });

      it('rejeita quando a sessão não existe', async () => {
        const repo = await fabrica();
        await expect(repo.atualizarSessao(idInexistente(), { confirmada: true })).rejects.toThrow();
      });
    });

    describe('removerSessoes', () => {
      it('remove só os ids passados', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const s1 = await repo.criarSessao(sessaoNova(paciente.id, { inicio: instanteDe('2026-11-03', '09:00') }));
        const s2 = await repo.criarSessao(sessaoNova(paciente.id, { inicio: instanteDe('2026-11-03', '10:00') }));
        const s3 = await repo.criarSessao(sessaoNova(paciente.id, { inicio: instanteDe('2026-11-03', '11:00') }));

        await repo.removerSessoes([s1.id, s3.id]);
        expect((await repo.listarSessoes('2026-11-03', '2026-11-03')).map((s) => s.id)).toEqual([s2.id]);
      });

      it('lista vazia e ids que não existem não dão erro nem apagam nada', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const s = await repo.criarSessao(sessaoNova(paciente.id));
        await repo.removerSessoes([]);
        await repo.removerSessoes([idInexistente()]);
        expect((await repo.listarSessoesDoPaciente(paciente.id)).map((x) => x.id)).toEqual([s.id]);
      });

      it('apagar a sessão de destino de uma remarcação zera o vínculo da original', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const destino = await repo.criarSessao(sessaoNova(paciente.id, { inicio: instanteDe('2026-11-10', '14:00') }));
        const original = await repo.criarSessao(
          sessaoNova(paciente.id, { situacao: 'remarcada', remarcadaPara: destino.id }),
        );
        await repo.removerSessoes([destino.id]);
        const [restante] = await repo.listarSessoesDoPaciente(paciente.id);
        expect(restante).toEqual({ ...original, remarcadaPara: null });
      });
    });

    describe('listarSessoesDoPaciente', () => {
      it('devolve só as sessões do paciente, em ordem de início', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const outro = await repo.salvarPaciente(rascunhoPaciente({ nome: 'Outro Paciente' }));
        const depois = await repo.criarSessao(sessaoNova(paciente.id, { inicio: instanteDe('2026-11-10', '14:00') }));
        const antes = await repo.criarSessao(sessaoNova(paciente.id, { inicio: instanteDe('2026-11-03', '14:00') }));
        await repo.criarSessao(sessaoNova(outro.id));

        expect((await repo.listarSessoesDoPaciente(paciente.id)).map((s) => s.id)).toEqual([antes.id, depois.id]);
      });
    });

    // ---------------------------------------------------------------- sessões cobradas
    describe('listarSessoesCobradas', () => {
      it('traz só as sessões com valor (zero conta), de todos os pacientes, por início, com nome e responsável', async () => {
        const repo = await fabrica();
        const ana = await repo.salvarPaciente(rascunhoPaciente({ nome: 'Ana Cobrada' }));
        const bia = await repo.salvarPaciente(rascunhoPaciente({ nome: 'Bia Cobrada' }));
        await repo.salvarResponsavel(
          rascunhoResponsavel(ana.id, { nome: 'Mariana Teste', telefone: '(85) 90000-0001', principal: true }),
        );

        const tarde = await repo.criarSessao(sessaoCobrada(bia.id, '2026-10-20'));
        const cedo = await repo.criarSessao(sessaoCobrada(ana.id, '2026-10-06', 20000));
        const gratis = await repo.criarSessao(sessaoCobrada(ana.id, '2026-10-13', 0));
        await repo.criarSessao(sessaoNova(ana.id, { inicio: instanteDe('2026-10-27', '14:00') }));
        await repo.criarSessao(sessaoNova(bia.id, { inicio: instanteDe('2026-10-21', '14:00'), situacao: 'cancelada' }));

        expect(await repo.listarSessoesCobradas()).toEqual([
          { ...cedo, pacienteNome: 'Ana Cobrada', responsavelPrincipal: { nome: 'Mariana Teste', telefone: '(85) 90000-0001' } },
          { ...gratis, pacienteNome: 'Ana Cobrada', responsavelPrincipal: { nome: 'Mariana Teste', telefone: '(85) 90000-0001' } },
          { ...tarde, pacienteNome: 'Bia Cobrada', responsavelPrincipal: null },
        ]);
      });

      it('sem nenhuma sessão com valor, devolve lista vazia', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        await repo.criarSessao(sessaoNova(paciente.id));
        expect(await repo.listarSessoesCobradas()).toEqual([]);
      });
    });

    // ---------------------------------------------------------------- pagamentos
    describe('pagamentos', () => {
      it('registra o pagamento de sessões e ele aparece em listarPagamentos do paciente, com sessaoIds', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const outro = await repo.salvarPaciente(rascunhoPaciente({ nome: 'Outro Paciente' }));
        const s1 = await repo.criarSessao(sessaoCobrada(paciente.id, '2026-10-06'));
        const s2 = await repo.criarSessao(sessaoCobrada(paciente.id, '2026-10-13'));
        const alheia = await repo.criarSessao(sessaoCobrada(outro.id, '2026-10-06'));

        const entrada = pagamentoNovo(paciente.id, {
          valorCentavos: 36000,
          forma: 'dinheiro',
          observacao: 'Pago na recepção',
          sessaoIds: [s1.id, s2.id],
        });
        const pago = await repo.registrarPagamento(entrada);
        expect(pago.id).toEqual(expect.any(String));
        expect(pago).toEqual({ ...entrada, id: pago.id, sessaoIds: [s1.id, s2.id].sort() });

        await repo.registrarPagamento(pagamentoNovo(outro.id, { sessaoIds: [alheia.id] }));

        expect(await repo.listarPagamentos({ pacienteId: paciente.id })).toEqual([pago]);
        expect(await repo.listarPagamentos()).toHaveLength(2);
      });

      it('guarda o pagamento do mês e o da avaliação, sem sessões', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente({ formaCobranca: 'mensal' }));
        const avaliacao = await repo.salvarAvaliacao(rascunhoAvaliacao(paciente.id));

        const mes = await repo.registrarPagamento(
          pagamentoNovo(paciente.id, { referencia: 'mes', mesReferencia: '2026-10-01', valorCentavos: 80000 }),
        );
        const pacote = await repo.registrarPagamento(
          pagamentoNovo(paciente.id, { referencia: 'avaliacao', avaliacaoId: avaliacao.id, valorCentavos: 81000 }),
        );

        expect(mes).toMatchObject({ referencia: 'mes', mesReferencia: '2026-10-01', avaliacaoId: null, sessaoIds: [] });
        expect(pacote).toMatchObject({ referencia: 'avaliacao', avaliacaoId: avaliacao.id, mesReferencia: null, sessaoIds: [] });
        expect(await repo.listarPagamentos({ pacienteId: paciente.id })).toEqual([mes, pacote]);
      });

      it('registrar de novo a mesma sessão rejeita e continua havendo um só pagamento', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const sessao = await repo.criarSessao(sessaoCobrada(paciente.id, '2026-10-06'));
        const primeiro = await repo.registrarPagamento(pagamentoNovo(paciente.id, { sessaoIds: [sessao.id] }));

        const recusa = repo.registrarPagamento(pagamentoNovo(paciente.id, { sessaoIds: [sessao.id] }));
        await expect(recusa).rejects.toThrow('Esta sessão já foi paga.');
        // Uma recusa com mensagem para ela ler (não um "tente de novo").
        await expect(recusa).rejects.toBeInstanceOf(RecusaDoRepositorio);
        expect(await repo.listarPagamentos({ pacienteId: paciente.id })).toEqual([primeiro]);
      });

      it('é atômico: se uma das sessões já está paga, nenhuma é gravada e a outra continua livre', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const paga = await repo.criarSessao(sessaoCobrada(paciente.id, '2026-10-06'));
        const livre = await repo.criarSessao(sessaoCobrada(paciente.id, '2026-10-13'));
        const primeiro = await repo.registrarPagamento(pagamentoNovo(paciente.id, { sessaoIds: [paga.id] }));

        await expect(
          repo.registrarPagamento(pagamentoNovo(paciente.id, { sessaoIds: [livre.id, paga.id] })),
        ).rejects.toThrow('Esta sessão já foi paga.');
        expect(await repo.listarPagamentos()).toEqual([primeiro]);

        const depois = await repo.registrarPagamento(pagamentoNovo(paciente.id, { sessaoIds: [livre.id] }));
        expect(depois.sessaoIds).toEqual([livre.id]);
      });

      it('o mesmo mês pode ter mais de um pagamento (o da diferença), como as parcelas da avaliação', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente({ formaCobranca: 'mensal' }));
        const outro = await repo.salvarPaciente(rascunhoPaciente({ nome: 'Outro Paciente', formaCobranca: 'mensal' }));
        const outubro = await repo.registrarPagamento(
          pagamentoNovo(paciente.id, { referencia: 'mes', mesReferencia: '2026-10-01', valorCentavos: 60000 }),
        );

        // Quem decide se ainda falta algo é o serviço; o repositório guarda os dois.
        const diferenca = await repo.registrarPagamento(
          pagamentoNovo(paciente.id, { referencia: 'mes', mesReferencia: '2026-10-01', data: '2026-10-25', valorCentavos: 20000 }),
        );
        expect(await repo.listarPagamentos({ pacienteId: paciente.id })).toEqual([outubro, diferenca]);

        await repo.registrarPagamento(pagamentoNovo(paciente.id, { referencia: 'mes', mesReferencia: '2026-11-01' }));
        await repo.registrarPagamento(pagamentoNovo(outro.id, { referencia: 'mes', mesReferencia: '2026-10-01' }));
        expect(await repo.listarPagamentos()).toHaveLength(4);
      });

      it('rejeita pagamento incoerente: valor zero, mês sem referência, mês fora do dia 1, avaliação sem id', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const incoerentes: Partial<NovoPagamento>[] = [
          { valorCentavos: 0 },
          { referencia: 'mes', mesReferencia: null },
          { referencia: 'mes', mesReferencia: '2026-10-15' },
          { referencia: 'sessoes', mesReferencia: '2026-10-01' },
          { referencia: 'avaliacao', avaliacaoId: null },
        ];
        for (const sobre of incoerentes) {
          await expect(repo.registrarPagamento(pagamentoNovo(paciente.id, sobre)), JSON.stringify(sobre)).rejects.toThrow();
        }
        expect(await repo.listarPagamentos()).toEqual([]);
      });

      it('rejeita pagamento de paciente, sessão ou avaliação que não existem', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        await expect(repo.registrarPagamento(pagamentoNovo(idInexistente()))).rejects.toThrow();
        await expect(
          repo.registrarPagamento(pagamentoNovo(paciente.id, { sessaoIds: [idInexistente()] })),
        ).rejects.toThrow();
        await expect(
          repo.registrarPagamento(pagamentoNovo(paciente.id, { referencia: 'avaliacao', avaliacaoId: idInexistente() })),
        ).rejects.toThrow();
        expect(await repo.listarPagamentos()).toEqual([]);
      });

      it('removerPagamento libera a sessão para um novo pagamento', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const sessao = await repo.criarSessao(sessaoCobrada(paciente.id, '2026-10-06'));
        const primeiro = await repo.registrarPagamento(pagamentoNovo(paciente.id, { sessaoIds: [sessao.id] }));

        await repo.removerPagamento(primeiro.id);
        expect(await repo.listarPagamentos()).toEqual([]);

        const segundo = await repo.registrarPagamento(
          pagamentoNovo(paciente.id, { forma: 'cartao', sessaoIds: [sessao.id] }),
        );
        expect(segundo.id).not.toBe(primeiro.id);
        expect(await repo.listarPagamentos({ pacienteId: paciente.id })).toEqual([segundo]);
      });

      it('removerPagamento libera também o mês; id que não existe não dá erro', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente({ formaCobranca: 'mensal' }));
        const mes = await repo.registrarPagamento(
          pagamentoNovo(paciente.id, { referencia: 'mes', mesReferencia: '2026-10-01' }),
        );
        await repo.removerPagamento(idInexistente());
        await repo.removerPagamento(mes.id);
        const outra = await repo.registrarPagamento(
          pagamentoNovo(paciente.id, { referencia: 'mes', mesReferencia: '2026-10-01' }),
        );
        expect(await repo.listarPagamentos()).toEqual([outra]);
      });

      it('uma sessão paga não pode ser removida; depois de remover o pagamento, pode', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const paga = await repo.criarSessao(sessaoCobrada(paciente.id, '2026-10-06'));
        const livre = await repo.criarSessao(sessaoCobrada(paciente.id, '2026-10-13'));
        const pagamento = await repo.registrarPagamento(pagamentoNovo(paciente.id, { sessaoIds: [paga.id] }));

        // Um lote com uma sessão paga não apaga nada, nem as livres.
        const recusa = repo.removerSessoes([livre.id, paga.id]);
        await expect(recusa).rejects.toThrow('Esta sessão já foi paga e não pode ser removida.');
        await expect(recusa).rejects.toBeInstanceOf(RecusaDoRepositorio);
        expect((await repo.listarSessoesDoPaciente(paciente.id)).map((s) => s.id)).toEqual([paga.id, livre.id]);

        await repo.removerPagamento(pagamento.id);
        await repo.removerSessoes([paga.id]);
        expect((await repo.listarSessoesDoPaciente(paciente.id)).map((s) => s.id)).toEqual([livre.id]);
      });

      it('listarPagamentos({ de, ate }) filtra pela data, com os dois limites incluídos', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const dias = ['2026-09-30', '2026-10-01', '2026-10-15', '2026-10-31', '2026-11-01'];
        const feitos = [];
        for (const data of dias) {
          const s = await repo.criarSessao(sessaoCobrada(paciente.id, data));
          feitos.push(await repo.registrarPagamento(pagamentoNovo(paciente.id, { data, sessaoIds: [s.id] })));
        }

        const outubro = await repo.listarPagamentos({ de: '2026-10-01', ate: '2026-10-31' });
        expect(outubro.map((p) => p.data)).toEqual(['2026-10-01', '2026-10-15', '2026-10-31']);
        expect((await repo.listarPagamentos({ de: '2026-10-31' })).map((p) => p.data)).toEqual([
          '2026-10-31',
          '2026-11-01',
        ]);
        expect((await repo.listarPagamentos({ ate: '2026-10-01' })).map((p) => p.data)).toEqual([
          '2026-09-30',
          '2026-10-01',
        ]);
        expect(await repo.listarPagamentos({ de: '2026-12-01', ate: '2026-12-31' })).toEqual([]);
        expect(await repo.listarPagamentos()).toEqual(feitos);
      });

      it('lista por data e, na mesma data, pela ordem em que foram registrados', async () => {
        const repo = await fabrica();
        const paciente = await repo.salvarPaciente(rascunhoPaciente());
        const sessoes = [];
        for (const dia of ['2026-10-06', '2026-10-13', '2026-10-20']) {
          sessoes.push(await repo.criarSessao(sessaoCobrada(paciente.id, dia)));
        }
        const b = await repo.registrarPagamento(pagamentoNovo(paciente.id, { data: '2026-10-20', sessaoIds: [sessoes[0].id] }));
        const a = await repo.registrarPagamento(pagamentoNovo(paciente.id, { data: '2026-10-05', sessaoIds: [sessoes[1].id] }));
        const c = await repo.registrarPagamento(pagamentoNovo(paciente.id, { data: '2026-10-20', sessaoIds: [sessoes[2].id] }));
        expect((await repo.listarPagamentos()).map((p) => p.id)).toEqual([a.id, b.id, c.id]);
      });
    });

    // ---------------------------------------------------------------- bloqueios
    describe('bloqueios', () => {
      it('cria, lista por data, edita e remove', async () => {
        const repo = await fabrica();
        const depois = await repo.salvarBloqueio({ inicio: '2026-12-21', fim: '2027-01-04', motivo: 'Recesso' });
        const antes = await repo.salvarBloqueio({ inicio: '2026-11-20', fim: '2026-11-20', motivo: 'Congresso' });
        expect(antes.id).toEqual(expect.any(String));
        expect(await repo.listarBloqueios()).toEqual([antes, depois]);

        const editado: Bloqueio = await repo.salvarBloqueio({ ...antes, fim: '2026-11-21' });
        expect(editado).toEqual({ ...antes, fim: '2026-11-21' });

        await repo.removerBloqueio(antes.id);
        expect(await repo.listarBloqueios()).toEqual([depois]);
      });
    });
  });
}
