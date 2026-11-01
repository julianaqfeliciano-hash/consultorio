import { CONFIGURACOES_PADRAO } from '../dominio/padroes';
import type { Sessao } from '../dominio/tipos';
import { numeroNaAvaliacao } from '../regras/agenda';
import { pendenciasDoPaciente, valorFinalDaAvaliacao, mesDaSessao } from '../regras/cobranca';
import { dataLocal, diaDaSemana, horaLocal, instanteDe, somarDias } from '../regras/datas';
import { criarRepositorioMemoria } from './memoria';
import { sementeDemo } from './semente-demo';

// Os testes das telas usam este relógio fixo: segunda-feira.
const HOJE = '2026-11-02';

function achar<T>(itens: T[] | undefined, procurar: (i: T) => boolean): T {
  const item = itens?.find(procurar);
  if (!item) throw new Error('item esperado na semente não encontrado');
  return item;
}

describe('sementeDemo', () => {
  const semente = sementeDemo(HOJE);
  const paciente = (nome: string) => achar(semente.pacientes, (p) => p.nome === nome);

  it('tem os quatro pacientes fictícios', () => {
    expect(semente.pacientes?.map((p) => p.nome).sort()).toEqual(
      ['Ana Clara Souza', 'Lucas Oliveira', 'Maria Luísa Costa', 'Pedro Henrique Lima'].sort(),
    );
  });

  it('usa as configurações padrão e tem alguns parceiros', () => {
    expect(semente.configuracoes).toEqual(CONFIGURACOES_PADRAO);
    expect(semente.parceiros?.length).toBeGreaterThanOrEqual(2);
  });

  it('Ana Clara: psicoterapia mensal de R$ 200, terça 14:00 por 50 min, responsável principal com telefone', () => {
    const ana = paciente('Ana Clara Souza');
    expect(ana).toMatchObject({ status: 'ativo', tipo: 'psicoterapia', formaCobranca: 'mensal', valorSessaoCentavos: 20000 });
    expect(semente.horarios?.filter((h) => h.pacienteId === ana.id)).toEqual([
      expect.objectContaining({ diaSemana: 2, hora: '14:00', duracaoMin: 50, validoAte: null }),
    ]);
    const principal = achar(semente.responsaveis, (r) => r.pacienteId === ana.id && r.principal);
    expect(principal.telefone).toBe('(85) 90000-0001');
  });

  it('Pedro Henrique: avaliação de 10 sessões, quarta 09:00, com 3 sessões realizadas antes de hoje', () => {
    const pedro = paciente('Pedro Henrique Lima');
    expect(pedro).toMatchObject({ status: 'ativo', tipo: 'avaliacao' });

    const avaliacao = achar(semente.avaliacoes, (a) => a.pacienteId === pedro.id);
    expect(avaliacao).toMatchObject({ sessoesPrevistas: 10, fim: null });
    expect(avaliacao.etapas.length).toBeGreaterThan(0);

    const horario = achar(semente.horarios, (h) => h.pacienteId === pedro.id);
    expect(horario).toMatchObject({ diaSemana: 3, hora: '09:00' });

    const feitas = (semente.sessoes ?? []).filter((s) => s.pacienteId === pedro.id);
    expect(feitas).toHaveLength(3);
    for (const s of feitas) {
      expect(s).toMatchObject({
        situacao: 'compareceu',
        origem: 'fixa',
        tipo: 'avaliacao',
        avaliacaoId: avaliacao.id,
        horarioFixoId: horario.id,
      });
      expect(s.dataOcorrencia).not.toBeNull();
      expect(s.dataOcorrencia! < HOJE).toBe(true);
      expect(dataLocal(s.inicio)).toBe(s.dataOcorrencia);
      expect(horaLocal(s.inicio)).toBe('09:00');
      expect(diaDaSemana(s.dataOcorrencia!)).toBe(3);
    }
    expect(new Set(feitas.map((s) => s.dataOcorrencia)).size).toBe(3);
  });

  it('a próxima sessão de Pedro Henrique é a "sessão 4 de 10"', () => {
    const pedro = paciente('Pedro Henrique Lima');
    const avaliacao = achar(semente.avaliacoes, (a) => a.pacienteId === pedro.id);
    const proxima: Sessao = {
      ...achar(semente.sessoes, (s) => s.pacienteId === pedro.id),
      id: 'proxima',
      inicio: instanteDe('2026-11-04', '09:00'),
      dataOcorrencia: '2026-11-04',
      situacao: 'agendada',
    };
    expect(numeroNaAvaliacao([...(semente.sessoes ?? []), proxima], proxima)).toBe(4);
    expect(avaliacao.sessoesPrevistas).toBe(10);
  });

  it('Maria Luísa: psicoterapia por sessão de R$ 180, quinta 16:00, responsável principal sem telefone', () => {
    const maria = paciente('Maria Luísa Costa');
    expect(maria).toMatchObject({ status: 'ativo', tipo: 'psicoterapia', formaCobranca: 'por_sessao', valorSessaoCentavos: 18000 });
    expect(achar(semente.horarios, (h) => h.pacienteId === maria.id)).toMatchObject({ diaSemana: 4, hora: '16:00' });
    expect(achar(semente.responsaveis, (r) => r.pacienteId === maria.id && r.principal).telefone).toBe('');
  });

  it('Lucas: lista de espera, sem horário', () => {
    const lucas = paciente('Lucas Oliveira');
    expect(lucas.status).toBe('lista_espera');
    expect(semente.horarios?.some((h) => h.pacienteId === lucas.id)).toBe(false);
  });

  it('todo telefone preenchido segue o padrão fictício (85) 90000-000X', () => {
    const telefones = (semente.responsaveis ?? []).map((r) => r.telefone).filter((t) => t !== '');
    expect(telefones.length).toBeGreaterThanOrEqual(3);
    for (const t of telefones) expect(t).toMatch(/^\(85\) 90000-000\d$/);
    expect(new Set(telefones).size).toBe(telefones.length);
  });

  it('cada paciente tem um (e só um) responsável principal', () => {
    for (const p of semente.pacientes ?? []) {
      expect((semente.responsaveis ?? []).filter((r) => r.pacienteId === p.id && r.principal)).toHaveLength(1);
    }
  });

  it('é relativa a hoje: com outra data, continuam 3 sessões de Pedro, todas antes dela', () => {
    for (const hoje of ['2026-11-04', '2026-11-05', '2026-11-08', '2027-02-15']) {
      const outra = sementeDemo(hoje);
      const pedro = achar(outra.pacientes, (p) => p.nome === 'Pedro Henrique Lima');
      const feitas = (outra.sessoes ?? []).filter((s) => s.pacienteId === pedro.id);
      expect(feitas).toHaveLength(3);
      for (const s of feitas) {
        expect(s.dataOcorrencia! < hoje).toBe(true);
        expect(diaDaSemana(s.dataOcorrencia!)).toBe(3);
      }
      expect(Math.max(...feitas.map((s) => Date.parse(s.inicio)))).toBeLessThan(Date.parse(instanteDe(hoje, '00:00')));
    }
  });

  it('é consistente: carrega num repositório e as referências existem', async () => {
    const repo = criarRepositorioMemoria(semente);
    const pacientes = await repo.listarPacientes();
    expect(pacientes).toHaveLength(4);
    for (const p of pacientes) {
      const ficha = await repo.obterFicha(p.id);
      expect(ficha?.paciente).toEqual(p);
    }
    const pedro = achar(pacientes, (p) => p.nome === 'Pedro Henrique Lima');
    const ficha = await repo.obterFicha(pedro.id);
    expect(ficha?.avaliacao?.sessoesPrevistas).toBe(10);
    expect(ficha?.horarios).toHaveLength(1);
    expect(await repo.listarSessoesDoPaciente(pedro.id)).toHaveLength(3);
    expect(await repo.obterConfiguracoes()).toEqual(CONFIGURACOES_PADRAO);
    expect((await repo.listarParceiros()).length).toBeGreaterThanOrEqual(2);
  });
});

describe('sementeDemo: cobrança (hoje = 2026-11-02)', () => {
  const semente = sementeDemo(HOJE);
  const paciente = (nome: string) => achar(semente.pacientes, (p) => p.nome === nome);
  const sessoesDe = (pacienteId: string) => (semente.sessoes ?? []).filter((s) => s.pacienteId === pacienteId);
  const pagamentosDe = (pacienteId: string) => (semente.pagamentos ?? []).filter((p) => p.pacienteId === pacienteId);
  const pendencias = (nome: string) => {
    const p = paciente(nome);
    return pendenciasDoPaciente({
      paciente: p,
      sessoes: sessoesDe(p.id),
      pagamentos: semente.pagamentos ?? [],
      avaliacao: (semente.avaliacoes ?? []).find((a) => a.pacienteId === p.id) ?? null,
      hoje: HOJE,
    });
  };

  it('Ana Clara: 4 terças de outubro compareceu a R$ 200, sem pagamento; outubro devendo R$ 800,00', () => {
    const ana = paciente('Ana Clara Souza');
    const sessoes = sessoesDe(ana.id);
    expect(sessoes).toHaveLength(4);
    const horario = achar(semente.horarios, (h) => h.pacienteId === ana.id);
    for (const s of sessoes) {
      expect(s).toMatchObject({
        situacao: 'compareceu',
        valorCentavos: 20000,
        tipo: 'psicoterapia',
        origem: 'fixa',
        horarioFixoId: horario.id,
        avaliacaoId: null,
      });
      expect(diaDaSemana(s.dataOcorrencia!)).toBe(2);
      expect(dataLocal(s.inicio)).toBe(s.dataOcorrencia);
      expect(horaLocal(s.inicio)).toBe('14:00');
      expect(mesDaSessao(s.inicio)).toBe('2026-10-01');
    }
    expect(new Set(sessoes.map((s) => s.dataOcorrencia)).size).toBe(4);
    expect(pagamentosDe(ana.id)).toEqual([]);

    const { meses, totalEmAbertoCentavos } = pendencias('Ana Clara Souza');
    expect(meses).toHaveLength(1);
    expect(meses[0]).toMatchObject({ mes: '2026-10-01', situacao: 'devendo', totalCentavos: 80000, pagamento: null });
    expect(totalEmAbertoCentavos).toBe(80000);
  });

  it('Maria Luísa: 2 quintas de outubro compareceu a R$ 180; uma paga por Pix no dia, a outra aberta', () => {
    const maria = paciente('Maria Luísa Costa');
    const sessoes = sessoesDe(maria.id);
    expect(sessoes).toHaveLength(2);
    for (const s of sessoes) {
      expect(s).toMatchObject({ situacao: 'compareceu', valorCentavos: 18000, tipo: 'psicoterapia', origem: 'fixa' });
      expect(diaDaSemana(s.dataOcorrencia!)).toBe(4);
      expect(horaLocal(s.inicio)).toBe('16:00');
      expect(mesDaSessao(s.inicio)).toBe('2026-10-01');
    }

    const pagamentos = pagamentosDe(maria.id);
    expect(pagamentos).toHaveLength(1);
    const [paga] = sessoes.filter((s) => pagamentos[0].sessaoIds.includes(s.id));
    expect(pagamentos[0]).toMatchObject({
      forma: 'pix',
      referencia: 'sessoes',
      valorCentavos: 18000,
      data: paga.dataOcorrencia,
      mesReferencia: null,
      avaliacaoId: null,
      sessaoIds: [paga.id],
    });

    const { sessoesAbertas, totalEmAbertoCentavos } = pendencias('Maria Luísa Costa');
    expect(sessoesAbertas).toHaveLength(1);
    expect(sessoesAbertas[0].id).not.toBe(paga.id);
    expect(totalEmAbertoCentavos).toBe(18000);
  });

  it('Pedro: avaliação de R$ 1.800,00 com 10% de desconto, pagos R$ 810,00 por Pix na primeira sessão; faltam R$ 810,00', () => {
    const pedro = paciente('Pedro Henrique Lima');
    const avaliacao = achar(semente.avaliacoes, (a) => a.pacienteId === pedro.id);
    expect(avaliacao).toMatchObject({ valorPrevistoCentavos: 180000, descontoTipo: 'percentual', descontoValor: 10 });
    expect(valorFinalDaAvaliacao(avaliacao)).toBe(162000);

    const sessoes = sessoesDe(pedro.id);
    expect(sessoes).toHaveLength(3);
    for (const s of sessoes) expect(s.valorCentavos).toBeNull();
    const primeira = sessoes.map((s) => s.dataOcorrencia!).sort()[0];
    expect(primeira.startsWith('2026-10-')).toBe(true);

    expect(pagamentosDe(pedro.id)).toEqual([
      expect.objectContaining({
        valorCentavos: 81000,
        forma: 'pix',
        data: primeira,
        referencia: 'avaliacao',
        avaliacaoId: avaliacao.id,
        mesReferencia: null,
        sessaoIds: [],
      }),
    ]);
    expect(pendencias('Pedro Henrique Lima').avaliacao).toEqual({
      valorFinalCentavos: 162000,
      pagoCentavos: 81000,
      faltaCentavos: 81000,
    });
  });

  it('Lucas não tem sessão nem pagamento', () => {
    const lucas = paciente('Lucas Oliveira');
    expect(sessoesDe(lucas.id)).toEqual([]);
    expect(pagamentosDe(lucas.id)).toEqual([]);
  });

  it('nenhuma sessão da semente está agendada, e todas são anteriores a hoje', () => {
    for (const s of semente.sessoes ?? []) {
      expect(s.situacao, s.id).not.toBe('agendada');
      expect(s.dataOcorrencia! < HOJE, s.id).toBe(true);
    }
  });

  it('os ids são únicos e todo pagamento aponta para paciente, sessões e avaliação que existem', () => {
    const ids = (semente.sessoes ?? []).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const pagas = (semente.pagamentos ?? []).flatMap((p) => p.sessaoIds);
    expect(new Set(pagas).size).toBe(pagas.length);
    for (const p of semente.pagamentos ?? []) {
      expect(semente.pacientes?.some((x) => x.id === p.pacienteId)).toBe(true);
      for (const id of p.sessaoIds) expect(ids).toContain(id);
      if (p.avaliacaoId !== null) expect(semente.avaliacoes?.some((a) => a.id === p.avaliacaoId)).toBe(true);
    }
  });

  it('é relativa a hoje: o mês anterior tem sempre 4 sessões da Ana e 2 da Maria, e os mesmos valores devidos', () => {
    for (const hoje of ['2026-11-04', '2026-11-30', '2026-12-01', '2027-02-15']) {
      const outra = sementeDemo(hoje);
      const mesAnterior = `${somarDias(`${hoje.slice(0, 7)}-01`, -1).slice(0, 7)}-01`;
      const de = (nome: string) => achar(outra.pacientes, (p) => p.nome === nome);
      const ana = (outra.sessoes ?? []).filter((s) => s.pacienteId === de('Ana Clara Souza').id);
      const maria = (outra.sessoes ?? []).filter((s) => s.pacienteId === de('Maria Luísa Costa').id);
      expect(ana, hoje).toHaveLength(4);
      expect(maria, hoje).toHaveLength(2);
      for (const s of [...ana, ...maria]) {
        expect(mesDaSessao(s.inicio), hoje).toBe(mesAnterior);
        expect(s.dataOcorrencia! < hoje, hoje).toBe(true);
        expect(s.situacao).toBe('compareceu');
      }
      const pedro = de('Pedro Henrique Lima');
      const pagamentoPedro = (outra.pagamentos ?? []).find((p) => p.pacienteId === pedro.id);
      const primeira = (outra.sessoes ?? [])
        .filter((s) => s.pacienteId === pedro.id)
        .map((s) => s.dataOcorrencia!)
        .sort()[0];
      expect(pagamentoPedro?.data, hoje).toBe(primeira);
    }
  });

  it('carrega num repositório: pagamentos e sessões cobradas aparecem', async () => {
    const repo = criarRepositorioMemoria(semente);
    const pagamentos = await repo.listarPagamentos();
    expect(pagamentos).toHaveLength(2);
    expect(pagamentos.map((p) => p.referencia).sort()).toEqual(['avaliacao', 'sessoes']);

    const cobradas = await repo.listarSessoesCobradas();
    expect(cobradas).toHaveLength(6);
    expect(cobradas.filter((s) => s.pacienteNome === 'Ana Clara Souza')).toHaveLength(4);
    expect(cobradas.filter((s) => s.pacienteNome === 'Maria Luísa Costa')).toHaveLength(2);
    expect(cobradas.some((s) => s.pacienteNome === 'Pedro Henrique Lima')).toBe(false);
    expect(cobradas.map((s) => s.inicio)).toEqual([...cobradas.map((s) => s.inicio)].sort());
  });
});

