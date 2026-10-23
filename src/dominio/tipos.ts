export type Id = string;
/** Data de calendário no formato 'YYYY-MM-DD'. */
export type DataISO = string;
/** Hora do dia no formato 'HH:MM'. */
export type Hora = string;

export type StatusPaciente = 'lista_espera' | 'ativo' | 'alta';
export type TipoAtendimento = 'avaliacao' | 'psicoterapia';
export type FormaCobranca = 'por_sessao' | 'mensal';
export type SituacaoSessao =
  | 'agendada'
  | 'compareceu'
  | 'falta_com_aviso'
  | 'falta_sem_aviso'
  | 'cancelada'
  | 'remarcada';
export type OrigemSessao = 'fixa' | 'avulsa' | 'remarcacao';

export interface Configuracoes {
  nomeCompleto: string;
  nomeExibicao: string;
  titulo: string;
  crp: string;
  cpf: string;
  telefone: string;
  email: string;
  endereco: string;
  cidade: string;
  instagram: string;
  duracaoPadraoMin: number;
  sessoesAvaliacaoPadrao: number;
  mensagemWhatsapp: string;
  semanasGeradas: number;
  bloqueioMinutos: number;
}

export interface Parceiro {
  id: Id;
  nome: string;
  profissao: string;
  contato: string;
  observacoes: string;
}

export interface Paciente {
  id: Id;
  nome: string;
  dataNascimento: DataISO | null;
  cpf: string | null;
  escola: string;
  serie: string;
  observacoes: string;
  status: StatusPaciente;
  tipo: TipoAtendimento;
  dataEntrada: DataISO | null;
  dataAlta: DataISO | null;
  parceiroId: Id | null;
  formaCobranca: FormaCobranca;
  valorSessaoCentavos: number;
}

export interface Responsavel {
  id: Id;
  pacienteId: Id;
  nome: string;
  parentesco: string;
  cpf: string | null;
  telefone: string;
  email: string | null;
  principal: boolean;
  pagador: boolean;
}

export interface HorarioFixo {
  id: Id;
  pacienteId: Id;
  /** 0 = domingo, 1 = segunda, ..., 6 = sábado. */
  diaSemana: number;
  hora: Hora;
  duracaoMin: number;
  validoDe: DataISO;
  validoAte: DataISO | null;
}

export interface Etapa {
  nome: string;
  feita: boolean;
}

export interface Avaliacao {
  id: Id;
  pacienteId: Id;
  inicio: DataISO;
  fim: DataISO | null;
  sessoesPrevistas: number;
  etapas: Etapa[];
}

export interface Sessao {
  id: Id;
  pacienteId: Id;
  /** Instante em ISO UTC, ex.: '2026-11-03T17:00:00.000Z'. */
  inicio: string;
  duracaoMin: number;
  tipo: TipoAtendimento;
  acompanhamentoFamiliar: boolean;
  origem: OrigemSessao;
  horarioFixoId: Id | null;
  dataOcorrencia: DataISO | null;
  situacao: SituacaoSessao;
  remarcadaPara: Id | null;
  avaliacaoId: Id | null;
  confirmada: boolean;
  observacao: string | null;
}

export interface Bloqueio {
  id: Id;
  inicio: DataISO;
  fim: DataISO;
  motivo: string;
}

export type NovaSessao = Omit<Sessao, 'id'>;

export interface HorarioComPaciente extends HorarioFixo {
  statusPaciente: StatusPaciente;
  tipoPaciente: TipoAtendimento;
  avaliacaoId: Id | null;
}
