import { CONFIGURACOES_PADRAO, ETAPAS_AVALIACAO_PADRAO } from '../dominio/padroes';
import type { Avaliacao, DataISO, HorarioFixo, Paciente, Parceiro, Responsavel, Sessao } from '../dominio/tipos';
import { diaDaSemana, instanteDe, somarDias } from '../regras/datas';
import type { SementeMemoria } from './memoria';

/** Último dia da semana `dia` (0 = domingo … 6 = sábado) ANTES de `hoje`. */
function ultimoDiaAntes(hoje: DataISO, dia: number): DataISO {
  let d = somarDias(hoje, -1);
  while (diaDaSemana(d) !== dia) d = somarDias(d, -1);
  return d;
}

/**
 * Dados fictícios do modo demonstração. Tudo é calculado a partir de `hoje`, então
 * o aplicativo sempre parece em uso. Os nomes e telefones são inventados.
 *
 * As telas e os testes dependem destes fatos (com hoje = segunda, 2026-11-02):
 * Ana Clara tem horário na terça 14:00; Pedro Henrique já fez 3 sessões da avaliação
 * (a próxima, quarta 09:00, é a "sessão 4 de 10"); Maria Luísa tem horário na quinta
 * 16:00 e o responsável principal dela está sem telefone; Lucas está na lista de espera.
 */
export function sementeDemo(hoje: DataISO): Required<SementeMemoria> {
  const dias = (n: number) => somarDias(hoje, -n);
  const anosAtras = (anos: number, extraDias: number) => dias(Math.round(365.25 * anos) + extraDias);

  // As três sessões de Pedro: as três últimas quartas-feiras antes de hoje.
  const ultimaQuarta = ultimoDiaAntes(hoje, 3);
  const quartasFeitas = [-14, -7, 0].map((n) => somarDias(ultimaQuarta, n));

  const parceiros: Parceiro[] = [
    {
      id: 'demo-parceiro-camila',
      nome: 'Dra. Camila Rocha',
      profissao: 'Neuropediatra',
      contato: '(85) 90000-0101',
      observacoes: 'Encaminha crianças para avaliação.',
    },
    {
      id: 'demo-parceiro-rafael',
      nome: 'Dr. Rafael Nogueira',
      profissao: 'Pediatra',
      contato: '(85) 90000-0102',
      observacoes: '',
    },
  ];

  const pacientes: Paciente[] = [
    {
      id: 'demo-paciente-ana',
      nome: 'Ana Clara Souza',
      dataNascimento: anosAtras(7, 40),
      cpf: null,
      escola: 'Colégio Girassol',
      serie: '2º ano',
      observacoes: 'Gosta de brincar com massinha.',
      status: 'ativo',
      tipo: 'psicoterapia',
      dataEntrada: dias(90),
      dataAlta: null,
      parceiroId: 'demo-parceiro-rafael',
      formaCobranca: 'mensal',
      valorSessaoCentavos: 20000,
    },
    {
      id: 'demo-paciente-pedro',
      nome: 'Pedro Henrique Lima',
      dataNascimento: anosAtras(9, 120),
      cpf: null,
      escola: 'Escola Arco-Íris',
      serie: '4º ano',
      observacoes: 'Avaliação encaminhada pela neuropediatra.',
      status: 'ativo',
      tipo: 'avaliacao',
      dataEntrada: quartasFeitas[0],
      dataAlta: null,
      parceiroId: 'demo-parceiro-camila',
      formaCobranca: 'por_sessao',
      valorSessaoCentavos: 16000,
    },
    {
      id: 'demo-paciente-maria',
      nome: 'Maria Luísa Costa',
      dataNascimento: anosAtras(6, 200),
      cpf: null,
      escola: 'Colégio Girassol',
      serie: '1º ano',
      observacoes: '',
      status: 'ativo',
      tipo: 'psicoterapia',
      dataEntrada: dias(60),
      dataAlta: null,
      parceiroId: null,
      formaCobranca: 'por_sessao',
      valorSessaoCentavos: 18000,
    },
    {
      id: 'demo-paciente-lucas',
      nome: 'Lucas Oliveira',
      dataNascimento: anosAtras(8, 10),
      cpf: null,
      escola: 'Escola Arco-Íris',
      serie: '3º ano',
      observacoes: 'Aguardando vaga na terça à tarde.',
      status: 'lista_espera',
      tipo: 'psicoterapia',
      dataEntrada: null,
      dataAlta: null,
      parceiroId: null,
      formaCobranca: 'por_sessao',
      valorSessaoCentavos: 0,
    },
  ];

  const responsaveis: Responsavel[] = [
    {
      id: 'demo-resp-ana',
      pacienteId: 'demo-paciente-ana',
      nome: 'Mariana Souza',
      parentesco: 'Mãe',
      cpf: null,
      telefone: '(85) 90000-0001',
      email: 'mariana.souza@exemplo.com',
      principal: true,
      pagador: true,
    },
    {
      id: 'demo-resp-pedro',
      pacienteId: 'demo-paciente-pedro',
      nome: 'Carlos Lima',
      parentesco: 'Pai',
      cpf: null,
      telefone: '(85) 90000-0002',
      email: null,
      principal: true,
      pagador: true,
    },
    {
      id: 'demo-resp-pedro-2',
      pacienteId: 'demo-paciente-pedro',
      nome: 'Fernanda Lima',
      parentesco: 'Mãe',
      cpf: null,
      telefone: '(85) 90000-0004',
      email: null,
      principal: false,
      pagador: false,
    },
    {
      id: 'demo-resp-maria',
      pacienteId: 'demo-paciente-maria',
      nome: 'Renata Costa',
      parentesco: 'Mãe',
      cpf: null,
      telefone: '',
      email: null,
      principal: true,
      pagador: true,
    },
    {
      id: 'demo-resp-lucas',
      pacienteId: 'demo-paciente-lucas',
      nome: 'Paulo Oliveira',
      parentesco: 'Pai',
      cpf: null,
      telefone: '(85) 90000-0003',
      email: null,
      principal: true,
      pagador: true,
    },
  ];

  const horarios: HorarioFixo[] = [
    {
      id: 'demo-horario-ana',
      pacienteId: 'demo-paciente-ana',
      diaSemana: 2,
      hora: '14:00',
      duracaoMin: 50,
      validoDe: dias(90),
      validoAte: null,
    },
    {
      id: 'demo-horario-pedro',
      pacienteId: 'demo-paciente-pedro',
      diaSemana: 3,
      hora: '09:00',
      duracaoMin: 50,
      validoDe: quartasFeitas[0],
      validoAte: null,
    },
    {
      id: 'demo-horario-maria',
      pacienteId: 'demo-paciente-maria',
      diaSemana: 4,
      hora: '16:00',
      duracaoMin: 50,
      validoDe: dias(60),
      validoAte: null,
    },
  ];

  const avaliacoes: Avaliacao[] = [
    {
      id: 'demo-avaliacao-pedro',
      pacienteId: 'demo-paciente-pedro',
      inicio: quartasFeitas[0],
      fim: null,
      sessoesPrevistas: 10,
      etapas: ETAPAS_AVALIACAO_PADRAO.map((nome, i) => ({ nome, feita: i === 0 })),
    },
  ];

  const sessoes: Sessao[] = quartasFeitas.map((dia, i) => ({
    id: `demo-sessao-pedro-${i + 1}`,
    pacienteId: 'demo-paciente-pedro',
    inicio: instanteDe(dia, '09:00'),
    duracaoMin: 50,
    tipo: 'avaliacao',
    acompanhamentoFamiliar: false,
    origem: 'fixa',
    horarioFixoId: 'demo-horario-pedro',
    dataOcorrencia: dia,
    situacao: 'compareceu',
    remarcadaPara: null,
    avaliacaoId: 'demo-avaliacao-pedro',
    confirmada: true,
    observacao: null,
  }));

  return {
    configuracoes: CONFIGURACOES_PADRAO,
    parceiros,
    pacientes,
    responsaveis,
    horarios,
    avaliacoes,
    sessoes,
    bloqueios: [],
  };
}
