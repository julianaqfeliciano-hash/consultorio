import { CONFIGURACOES_PADRAO } from '../dominio/padroes';
import type { Sessao } from '../dominio/tipos';
import { numeroNaAvaliacao } from '../regras/agenda';
import { dataLocal, diaDaSemana, horaLocal, instanteDe } from '../regras/datas';
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
