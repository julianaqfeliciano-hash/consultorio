import type { Avaliacao, HorarioFixo, Paciente, Sessao } from '../dominio/tipos';

/**
 * Dados de apoio dos testes de serviços. O padrão é a Ana (id `p1`), em
 * psicoterapia, com horário fixo na terça às 14:00 desde 2026-10-01; cada teste
 * sobrescreve só o que importa para ele.
 */

export function dadosPacienteExemplo(sobre: Partial<Omit<Paciente, 'id'>> = {}): Omit<Paciente, 'id'> {
  return {
    nome: 'Ana Clara Souza',
    dataNascimento: null,
    cpf: null,
    escola: '',
    serie: '',
    observacoes: '',
    status: 'ativo',
    tipo: 'psicoterapia',
    dataEntrada: '2026-10-01',
    dataAlta: null,
    parceiroId: null,
    formaCobranca: 'por_sessao',
    valorSessaoCentavos: 20000,
    ...sobre,
  };
}

export function pacienteExemplo(sobre: Partial<Paciente> = {}): Paciente {
  const { id = 'p1', ...resto } = sobre;
  return { id, ...dadosPacienteExemplo(resto) };
}

export function horarioExemplo(sobre: Partial<HorarioFixo> = {}): HorarioFixo {
  return {
    id: 'hf1',
    pacienteId: 'p1',
    diaSemana: 2,
    hora: '14:00',
    duracaoMin: 50,
    validoDe: '2026-10-01',
    validoAte: null,
    ...sobre,
  };
}

export function avaliacaoExemplo(sobre: Partial<Avaliacao> = {}): Avaliacao {
  return {
    id: 'av1',
    pacienteId: 'p1',
    inicio: '2026-10-20',
    fim: null,
    sessoesPrevistas: 10,
    etapas: [],
    ...sobre,
  };
}

/** Sessão avulsa agendada na terça 2026-11-03 às 14:00 (17:00 UTC). */
export function sessaoExemplo(sobre: Partial<Sessao> = {}): Sessao {
  return {
    id: 's1',
    pacienteId: 'p1',
    inicio: '2026-11-03T17:00:00.000Z',
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
    ...sobre,
  };
}
