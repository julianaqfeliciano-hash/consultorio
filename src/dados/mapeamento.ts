import type {
  Avaliacao,
  Bloqueio,
  Configuracoes,
  Etapa,
  FormaCobranca,
  HorarioFixo,
  OrigemSessao,
  Paciente,
  Parceiro,
  Responsavel,
  Sessao,
  SituacaoSessao,
  StatusPaciente,
  TipoAtendimento,
} from '../dominio/tipos';
import type { Rascunho } from './repositorio';

/*
 * Tradução entre os tipos do app (camelCase) e as linhas do Supabase (snake_case).
 *
 * Escrita: nunca manda `dono` nem `criado_em` (o banco preenche) e só manda `id`
 * quando o registro já tem um. Leitura: normaliza o que o Postgres devolve em
 * outro formato (hora com segundos, instante com deslocamento) e troca texto
 * nulo por '' onde o tipo do app não admite null.
 */

// ---------------------------------------------------------------------------
// Tipos das linhas (como o Postgres devolve)
// ---------------------------------------------------------------------------

export interface LinhaConfiguracoes {
  nome_completo: string | null;
  nome_exibicao: string | null;
  titulo: string | null;
  crp: string | null;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  instagram: string | null;
  duracao_padrao_min: number;
  sessoes_avaliacao_padrao: number;
  mensagem_whatsapp: string;
  semanas_geradas: number;
  bloqueio_minutos: number;
}

export interface LinhaParceiro {
  id: string;
  nome: string;
  profissao: string | null;
  contato: string | null;
  observacoes: string | null;
}

export interface LinhaPaciente {
  id: string;
  nome: string;
  data_nascimento: string | null;
  cpf: string | null;
  escola: string | null;
  serie: string | null;
  observacoes: string | null;
  status: StatusPaciente;
  tipo: TipoAtendimento;
  data_entrada: string | null;
  data_alta: string | null;
  parceiro_id: string | null;
  forma_cobranca: FormaCobranca;
  valor_sessao_centavos: number;
}

export interface LinhaResponsavel {
  id: string;
  paciente_id: string;
  nome: string;
  parentesco: string | null;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  principal: boolean;
  pagador: boolean;
}

export interface LinhaHorario {
  id: string;
  paciente_id: string;
  dia_semana: number;
  /** 'HH:MM:SS' vindo do Postgres (tipo `time`). */
  hora: string;
  duracao_min: number;
  valido_de: string;
  valido_ate: string | null;
}

export interface LinhaAvaliacao {
  id: string;
  paciente_id: string;
  inicio: string;
  fim: string | null;
  sessoes_previstas: number;
  /** jsonb: lista de { nome, feita }. */
  etapas: unknown;
}

export interface LinhaSessao {
  id: string;
  paciente_id: string;
  /** timestamptz: o Postgres devolve algo como '2026-11-03T17:00:00+00:00'. */
  inicio: string;
  duracao_min: number;
  tipo: TipoAtendimento;
  acompanhamento_familiar: boolean;
  origem: OrigemSessao;
  horario_fixo_id: string | null;
  data_ocorrencia: string | null;
  situacao: SituacaoSessao;
  remarcada_para: string | null;
  avaliacao_id: string | null;
  confirmada: boolean;
  observacao: string | null;
}

export interface LinhaBloqueio {
  id: string;
  inicio: string;
  fim: string;
  motivo: string;
}

// ---------------------------------------------------------------------------
// Ajudantes
// ---------------------------------------------------------------------------

/** `{ id }` só quando há id; sem ele o banco gera um. */
function comIdOpcional(id: string | undefined): { id?: string } {
  return id === undefined ? {} : { id };
}

const texto = (valor: string | null): string => valor ?? '';

/** '14:00:00' (Postgres `time`) → '14:00'. Já em 'HH:MM' fica como está. */
function lerHora(valor: string): string {
  return valor.slice(0, 5);
}

/** Qualquer instante aceito por `Date` (ex.: '…T17:00:00+00:00') → '…T17:00:00.000Z'. */
function lerInstante(valor: string): string {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) throw new Error(`Instante inválido vindo do banco: ${valor}`);
  return data.toISOString();
}

function lerEtapas(valor: unknown): Etapa[] {
  if (!Array.isArray(valor)) return [];
  return valor.map((e: unknown) => {
    const etapa = (e ?? {}) as { nome?: unknown; feita?: unknown };
    return { nome: String(etapa.nome ?? ''), feita: etapa.feita === true };
  });
}

// ---------------------------------------------------------------------------
// Configurações
// ---------------------------------------------------------------------------

export function configuracoesParaLinha(c: Configuracoes): LinhaConfiguracoes {
  return {
    nome_completo: c.nomeCompleto,
    nome_exibicao: c.nomeExibicao,
    titulo: c.titulo,
    crp: c.crp,
    cpf: c.cpf,
    telefone: c.telefone,
    email: c.email,
    endereco: c.endereco,
    cidade: c.cidade,
    instagram: c.instagram,
    duracao_padrao_min: c.duracaoPadraoMin,
    sessoes_avaliacao_padrao: c.sessoesAvaliacaoPadrao,
    mensagem_whatsapp: c.mensagemWhatsapp,
    semanas_geradas: c.semanasGeradas,
    bloqueio_minutos: c.bloqueioMinutos,
  };
}

export function linhaParaConfiguracoes(l: LinhaConfiguracoes): Configuracoes {
  return {
    nomeCompleto: texto(l.nome_completo),
    nomeExibicao: texto(l.nome_exibicao),
    titulo: texto(l.titulo),
    crp: texto(l.crp),
    cpf: texto(l.cpf),
    telefone: texto(l.telefone),
    email: texto(l.email),
    endereco: texto(l.endereco),
    cidade: texto(l.cidade),
    instagram: texto(l.instagram),
    duracaoPadraoMin: l.duracao_padrao_min,
    sessoesAvaliacaoPadrao: l.sessoes_avaliacao_padrao,
    mensagemWhatsapp: l.mensagem_whatsapp,
    semanasGeradas: l.semanas_geradas,
    bloqueioMinutos: l.bloqueio_minutos,
  };
}

// ---------------------------------------------------------------------------
// Parceiros
// ---------------------------------------------------------------------------

export function parceiroParaLinha(p: Rascunho<Parceiro>): Rascunho<LinhaParceiro> {
  return {
    ...comIdOpcional(p.id),
    nome: p.nome,
    profissao: p.profissao,
    contato: p.contato,
    observacoes: p.observacoes,
  };
}

export function linhaParaParceiro(l: LinhaParceiro): Parceiro {
  return {
    id: l.id,
    nome: l.nome,
    profissao: texto(l.profissao),
    contato: texto(l.contato),
    observacoes: texto(l.observacoes),
  };
}

// ---------------------------------------------------------------------------
// Pacientes e responsáveis
// ---------------------------------------------------------------------------

export function pacienteParaLinha(p: Rascunho<Paciente>): Rascunho<LinhaPaciente> {
  return {
    ...comIdOpcional(p.id),
    nome: p.nome,
    data_nascimento: p.dataNascimento,
    cpf: p.cpf,
    escola: p.escola,
    serie: p.serie,
    observacoes: p.observacoes,
    status: p.status,
    tipo: p.tipo,
    data_entrada: p.dataEntrada,
    data_alta: p.dataAlta,
    parceiro_id: p.parceiroId,
    forma_cobranca: p.formaCobranca,
    valor_sessao_centavos: p.valorSessaoCentavos,
  };
}

export function linhaParaPaciente(l: LinhaPaciente): Paciente {
  return {
    id: l.id,
    nome: l.nome,
    dataNascimento: l.data_nascimento,
    cpf: l.cpf,
    escola: texto(l.escola),
    serie: texto(l.serie),
    observacoes: texto(l.observacoes),
    status: l.status,
    tipo: l.tipo,
    dataEntrada: l.data_entrada,
    dataAlta: l.data_alta,
    parceiroId: l.parceiro_id,
    formaCobranca: l.forma_cobranca,
    valorSessaoCentavos: l.valor_sessao_centavos,
  };
}

export function responsavelParaLinha(r: Rascunho<Responsavel>): Rascunho<LinhaResponsavel> {
  return {
    ...comIdOpcional(r.id),
    paciente_id: r.pacienteId,
    nome: r.nome,
    parentesco: r.parentesco,
    cpf: r.cpf,
    telefone: r.telefone,
    email: r.email,
    principal: r.principal,
    pagador: r.pagador,
  };
}

export function linhaParaResponsavel(l: LinhaResponsavel): Responsavel {
  return {
    id: l.id,
    pacienteId: l.paciente_id,
    nome: l.nome,
    parentesco: texto(l.parentesco),
    cpf: l.cpf,
    telefone: texto(l.telefone),
    email: l.email,
    principal: l.principal,
    pagador: l.pagador,
  };
}

// ---------------------------------------------------------------------------
// Agenda: horários, avaliações, sessões, bloqueios
// ---------------------------------------------------------------------------

export function horarioParaLinha(h: Rascunho<HorarioFixo>): Rascunho<LinhaHorario> {
  return {
    ...comIdOpcional(h.id),
    paciente_id: h.pacienteId,
    dia_semana: h.diaSemana,
    // Como o Postgres devolve (HH:MM:SS), para a linha ir e voltar igual.
    hora: `${h.hora}:00`,
    duracao_min: h.duracaoMin,
    valido_de: h.validoDe,
    valido_ate: h.validoAte,
  };
}

export function linhaParaHorario(l: LinhaHorario): HorarioFixo {
  return {
    id: l.id,
    pacienteId: l.paciente_id,
    diaSemana: l.dia_semana,
    hora: lerHora(l.hora),
    duracaoMin: l.duracao_min,
    validoDe: l.valido_de,
    validoAte: l.valido_ate,
  };
}

export function avaliacaoParaLinha(a: Rascunho<Avaliacao>): Rascunho<LinhaAvaliacao> {
  return {
    ...comIdOpcional(a.id),
    paciente_id: a.pacienteId,
    inicio: a.inicio,
    fim: a.fim,
    sessoes_previstas: a.sessoesPrevistas,
    etapas: a.etapas.map((e) => ({ nome: e.nome, feita: e.feita })),
  };
}

export function linhaParaAvaliacao(l: LinhaAvaliacao): Avaliacao {
  return {
    id: l.id,
    pacienteId: l.paciente_id,
    inicio: l.inicio,
    fim: l.fim,
    sessoesPrevistas: l.sessoes_previstas,
    etapas: lerEtapas(l.etapas),
  };
}

export function sessaoParaLinha(s: Rascunho<Sessao>): Rascunho<LinhaSessao> {
  return {
    ...comIdOpcional(s.id),
    paciente_id: s.pacienteId,
    inicio: s.inicio,
    duracao_min: s.duracaoMin,
    tipo: s.tipo,
    acompanhamento_familiar: s.acompanhamentoFamiliar,
    origem: s.origem,
    horario_fixo_id: s.horarioFixoId,
    data_ocorrencia: s.dataOcorrencia,
    situacao: s.situacao,
    remarcada_para: s.remarcadaPara,
    avaliacao_id: s.avaliacaoId,
    confirmada: s.confirmada,
    observacao: s.observacao,
  };
}

export function linhaParaSessao(l: LinhaSessao): Sessao {
  return {
    id: l.id,
    pacienteId: l.paciente_id,
    inicio: lerInstante(l.inicio),
    duracaoMin: l.duracao_min,
    tipo: l.tipo,
    acompanhamentoFamiliar: l.acompanhamento_familiar,
    origem: l.origem,
    horarioFixoId: l.horario_fixo_id,
    dataOcorrencia: l.data_ocorrencia,
    situacao: l.situacao,
    remarcadaPara: l.remarcada_para,
    avaliacaoId: l.avaliacao_id,
    confirmada: l.confirmada,
    observacao: l.observacao,
  };
}

const COLUNAS_MUDANCAS_SESSAO: Record<keyof Omit<Sessao, 'id' | 'pacienteId'>, keyof LinhaSessao> = {
  inicio: 'inicio',
  duracaoMin: 'duracao_min',
  tipo: 'tipo',
  acompanhamentoFamiliar: 'acompanhamento_familiar',
  origem: 'origem',
  horarioFixoId: 'horario_fixo_id',
  dataOcorrencia: 'data_ocorrencia',
  situacao: 'situacao',
  remarcadaPara: 'remarcada_para',
  avaliacaoId: 'avaliacao_id',
  confirmada: 'confirmada',
  observacao: 'observacao',
};

/** Só as colunas que mudaram. `undefined` = não mexer; `null` = limpar o campo. */
export function mudancasSessaoParaLinha(
  mudancas: Partial<Omit<Sessao, 'id' | 'pacienteId'>>,
): Partial<Omit<LinhaSessao, 'id' | 'paciente_id'>> {
  const linha: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(mudancas)) {
    if (valor === undefined) continue;
    const coluna = (COLUNAS_MUDANCAS_SESSAO as Record<string, string | undefined>)[campo];
    if (coluna === undefined) throw new Error(`Campo de sessão que não pode ser alterado: ${campo}`);
    linha[coluna] = valor;
  }
  return linha as Partial<Omit<LinhaSessao, 'id' | 'paciente_id'>>;
}

export function bloqueioParaLinha(b: Rascunho<Bloqueio>): Rascunho<LinhaBloqueio> {
  return { ...comIdOpcional(b.id), inicio: b.inicio, fim: b.fim, motivo: b.motivo };
}

export function linhaParaBloqueio(l: LinhaBloqueio): Bloqueio {
  return { id: l.id, inicio: l.inicio, fim: l.fim, motivo: l.motivo };
}
