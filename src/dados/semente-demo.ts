import { CONFIGURACOES_PADRAO, ETAPAS_AVALIACAO_PADRAO } from '../dominio/padroes';
import type {
  Avaliacao,
  DataISO,
  HorarioFixo,
  Paciente,
  Pagamento,
  Parceiro,
  Responsavel,
  Sessao,
} from '../dominio/tipos';
import { diaDaSemana, instanteDe, somarDias } from '../regras/datas';
import type { SementeMemoria } from './memoria';

/** Último dia da semana `dia` (0 = domingo … 6 = sábado) ANTES de `hoje`. */
function ultimoDiaAntes(hoje: DataISO, dia: number): DataISO {
  let d = somarDias(hoje, -1);
  while (diaDaSemana(d) !== dia) d = somarDias(d, -1);
  return d;
}

/** Todos os dias da semana `dia` do mês anterior ao de `hoje`, em ordem. */
function diasDoMesAnterior(hoje: DataISO, dia: number): DataISO[] {
  const ultimoDoMes = somarDias(`${hoje.slice(0, 7)}-01`, -1);
  const primeiroDoMes = `${ultimoDoMes.slice(0, 7)}-01`;
  const dias: DataISO[] = [];
  for (let d = primeiroDoMes; d <= ultimoDoMes; d = somarDias(d, 1)) {
    if (diaDaSemana(d) === dia) dias.push(d);
  }
  return dias;
}

/**
 * Dados fictícios do modo demonstração. Tudo é calculado a partir de `hoje`, então
 * o aplicativo sempre parece em uso. Os nomes e telefones são inventados.
 *
 * As telas e os testes dependem destes fatos (com hoje = segunda, 2026-11-02):
 * Ana Clara tem horário na terça 14:00; Pedro Henrique já fez 3 sessões da avaliação
 * (a próxima, quarta 09:00, é a "sessão 4 de 10"); Maria Luísa tem horário na quinta
 * 16:00 e o responsável principal dela está sem telefone; Lucas está na lista de espera.
 *
 * Cobrança (o mês anterior ao de `hoje` é outubro de 2026): Ana Clara tem 4 terças
 * `compareceu` a R$ 200,00 sem pagamento (outubro devendo R$ 800,00); Maria Luísa tem 2
 * quintas `compareceu` a R$ 180,00, uma paga por Pix no dia e a outra aberta; Pedro Henrique
 * tem a avaliação de R$ 1.800,00 com 10% de desconto (R$ 1.620,00) e um pagamento de
 * R$ 810,00 por Pix na data da primeira sessão (as sessões dele seguem sem valor).
 */
export function sementeDemo(hoje: DataISO): Required<SementeMemoria> {
  const dias = (n: number) => somarDias(hoje, -n);
  const anosAtras = (anos: number, extraDias: number) => dias(Math.round(365.25 * anos) + extraDias);

  // As três sessões de Pedro: as três últimas quartas-feiras antes de hoje.
  const ultimaQuarta = ultimoDiaAntes(hoje, 3);
  const quartasFeitas = [-14, -7, 0].map((n) => somarDias(ultimaQuarta, n));
  // As sessões cobradas ficam no mês anterior ao de hoje, para o mês já estar fechado (devendo).
  const tercasDeAna = diasDoMesAnterior(hoje, 2).slice(-4);
  const quintasDeMaria = diasDoMesAnterior(hoje, 4).slice(-2);

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
      valorPrevistoCentavos: 180000,
      descontoTipo: 'percentual',
      descontoValor: 10,
    },
  ];

  // Sessão de horário fixo que já aconteceu; o valor só entra onde a sessão é cobrada à parte.
  const sessaoFeita = (e: {
    id: string;
    pacienteId: string;
    horarioFixoId: string;
    dia: DataISO;
    hora: string;
    tipo: Sessao['tipo'];
    avaliacaoId: string | null;
    valorCentavos: number | null;
  }): Sessao => ({
    id: e.id,
    pacienteId: e.pacienteId,
    inicio: instanteDe(e.dia, e.hora),
    duracaoMin: 50,
    tipo: e.tipo,
    acompanhamentoFamiliar: false,
    origem: 'fixa',
    horarioFixoId: e.horarioFixoId,
    dataOcorrencia: e.dia,
    situacao: 'compareceu',
    remarcadaPara: null,
    avaliacaoId: e.avaliacaoId,
    confirmada: true,
    observacao: null,
    valorCentavos: e.valorCentavos,
  });

  const sessoes: Sessao[] = [
    ...tercasDeAna.map((dia, i) =>
      sessaoFeita({
        id: `demo-sessao-ana-${i + 1}`,
        pacienteId: 'demo-paciente-ana',
        horarioFixoId: 'demo-horario-ana',
        dia,
        hora: '14:00',
        tipo: 'psicoterapia',
        avaliacaoId: null,
        valorCentavos: 20000,
      }),
    ),
    ...quartasFeitas.map((dia, i) =>
      sessaoFeita({
        id: `demo-sessao-pedro-${i + 1}`,
        pacienteId: 'demo-paciente-pedro',
        horarioFixoId: 'demo-horario-pedro',
        dia,
        hora: '09:00',
        tipo: 'avaliacao',
        avaliacaoId: 'demo-avaliacao-pedro',
        valorCentavos: null,
      }),
    ),
    ...quintasDeMaria.map((dia, i) =>
      sessaoFeita({
        id: `demo-sessao-maria-${i + 1}`,
        pacienteId: 'demo-paciente-maria',
        horarioFixoId: 'demo-horario-maria',
        dia,
        hora: '16:00',
        tipo: 'psicoterapia',
        avaliacaoId: null,
        valorCentavos: 18000,
      }),
    ),
  ];

  const pagamentos: Pagamento[] = [
    {
      // A primeira quinta de Maria foi paga por Pix no próprio dia; a segunda continua aberta.
      id: 'demo-pagamento-maria',
      pacienteId: 'demo-paciente-maria',
      data: quintasDeMaria[0],
      valorCentavos: 18000,
      forma: 'pix',
      observacao: null,
      referencia: 'sessoes',
      mesReferencia: null,
      avaliacaoId: null,
      sessaoIds: ['demo-sessao-maria-1'],
    },
    {
      // Metade do pacote da avaliação (R$ 1.620,00 já com o desconto), paga na primeira sessão.
      id: 'demo-pagamento-pedro',
      pacienteId: 'demo-paciente-pedro',
      data: quartasFeitas[0],
      valorCentavos: 81000,
      forma: 'pix',
      observacao: null,
      referencia: 'avaliacao',
      mesReferencia: null,
      avaliacaoId: 'demo-avaliacao-pedro',
      sessaoIds: [],
    },
  ];

  return {
    configuracoes: CONFIGURACOES_PADRAO,
    parceiros,
    pacientes,
    responsaveis,
    horarios,
    avaliacoes,
    sessoes,
    bloqueios: [],
    pagamentos,
  };
}
