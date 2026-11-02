import type { Avaliacao, DataISO, Etapa, FormaCobranca, Paciente, Responsavel, TipoDesconto } from '../dominio/tipos';
import { formatarData } from './datas';
import { centavosParaCampo, formatarReais, lerReais } from './dinheiro';
import { apenasDigitos, cpfCompleto, normalizarParaBusca, telefoneCompleto } from './texto';

/**
 * Validação do que se digita nos formulários de paciente. Cada `validar…` recebe os textos dos campos
 * e devolve os avisos (por campo) ou os dados prontos para gravar; nunca os dois.
 */

export type Resultado<E, D> = { erros: E; dados: null } | { erros: Record<string, never>; dados: D };

function ok<D>(dados: D): { erros: Record<string, never>; dados: D } {
  return { erros: {}, dados };
}

const vazioParaNulo = (texto: string): string | null => (texto.trim() === '' ? null : texto.trim());

// ---------------------------------------------------------------- dados da criança

export interface ValoresDados {
  nome: string;
  dataNascimento: string;
  cpf: string;
  escola: string;
  serie: string;
  observacoes: string;
}

export type DadosCadastrais = Pick<Paciente, 'nome' | 'dataNascimento' | 'cpf' | 'escola' | 'serie' | 'observacoes'>;
export type ErrosDados = Partial<Record<'nome' | 'dataNascimento' | 'cpf', string>>;

export function valoresDeDados(p: DadosCadastrais): ValoresDados {
  return {
    nome: p.nome,
    dataNascimento: p.dataNascimento ?? '',
    cpf: p.cpf ?? '',
    escola: p.escola,
    serie: p.serie,
    observacoes: p.observacoes,
  };
}

export const DADOS_EM_BRANCO: ValoresDados = { nome: '', dataNascimento: '', cpf: '', escola: '', serie: '', observacoes: '' };

export function validarDados(v: ValoresDados, hoje: DataISO): Resultado<ErrosDados, DadosCadastrais> {
  const erros: ErrosDados = {};
  if (v.nome.trim() === '') erros.nome = 'Informe o nome.';
  if (v.dataNascimento !== '' && v.dataNascimento > hoje) {
    erros.dataNascimento = 'A data de nascimento não pode ser no futuro.';
  }
  if (v.cpf.trim() !== '' && !cpfCompleto(v.cpf)) erros.cpf = 'O CPF deve ter 11 números.';
  if (Object.keys(erros).length > 0) return { erros, dados: null };
  return ok({
    nome: v.nome.trim(),
    dataNascimento: vazioParaNulo(v.dataNascimento),
    cpf: vazioParaNulo(v.cpf),
    escola: v.escola.trim(),
    serie: v.serie.trim(),
    observacoes: v.observacoes.trim(),
  });
}

// ---------------------------------------------------------------- cobrança

export interface ValoresCobranca {
  forma: FormaCobranca;
  /** O valor como digitado ('200', '1.250,50'); em branco vale zero. */
  valor: string;
}

export type DadosCobranca = Pick<Paciente, 'formaCobranca' | 'valorSessaoCentavos'>;

export function valoresDeCobranca(p: DadosCobranca): ValoresCobranca {
  return { forma: p.formaCobranca, valor: centavosParaCampo(p.valorSessaoCentavos) };
}

export function validarCobranca(v: ValoresCobranca): Resultado<{ valor?: string }, DadosCobranca> {
  const centavos = v.valor.trim() === '' ? 0 : lerReais(v.valor);
  if (centavos === null) return { erros: { valor: 'Informe um valor válido, como 180 ou 180,50.' }, dados: null };
  return ok({ formaCobranca: v.forma, valorSessaoCentavos: centavos });
}

// ---------------------------------------------------------------- responsável

export interface ValoresResponsavel {
  nome: string;
  parentesco: string;
  cpf: string;
  telefone: string;
  email: string;
  principal: boolean;
  pagador: boolean;
}

export type DadosResponsavel = Pick<
  Responsavel,
  'nome' | 'parentesco' | 'cpf' | 'telefone' | 'email' | 'principal' | 'pagador'
>;
export type ErrosResponsavel = Partial<Record<'nome' | 'cpf' | 'telefone' | 'email', string>>;

export function valoresDeResponsavel(r: DadosResponsavel): ValoresResponsavel {
  return { ...r, cpf: r.cpf ?? '', email: r.email ?? '' };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarResponsavel(v: ValoresResponsavel): Resultado<ErrosResponsavel, DadosResponsavel> {
  const erros: ErrosResponsavel = {};
  if (v.nome.trim() === '') erros.nome = 'Informe o nome do responsável.';
  if (v.cpf.trim() !== '' && !cpfCompleto(v.cpf)) erros.cpf = 'O CPF deve ter 11 números.';
  if (apenasDigitos(v.telefone) !== '' && !telefoneCompleto(v.telefone)) {
    erros.telefone = 'Informe o telefone com DDD, como (85) 98823-2033.';
  }
  if (v.email.trim() !== '' && !EMAIL.test(v.email.trim())) {
    erros.email = 'Informe um e-mail válido, como nome@exemplo.com.';
  }
  if (Object.keys(erros).length > 0) return { erros, dados: null };
  return ok({
    nome: v.nome.trim(),
    parentesco: v.parentesco.trim(),
    cpf: vazioParaNulo(v.cpf),
    telefone: v.telefone.trim(),
    email: vazioParaNulo(v.email),
    principal: v.principal,
    pagador: v.pagador,
  });
}

// ---------------------------------------------------------------- horário fixo

export interface ValoresHorario {
  /** '0' (domingo) a '6' (sábado), ou '' enquanto nada foi escolhido. */
  diaSemana: string;
  hora: string;
  duracao: string;
}

export interface DadosHorario {
  diaSemana: number;
  hora: string;
  duracaoMin: number;
}

export type ErrosHorario = Partial<Record<'diaSemana' | 'hora' | 'duracao', string>>;

export const DURACAO_MAXIMA_MIN = 480;

export function validarHorario(v: ValoresHorario): Resultado<ErrosHorario, DadosHorario> {
  const erros: ErrosHorario = {};
  if (v.diaSemana === '') erros.diaSemana = 'Escolha o dia da semana.';
  if (!/^\d{2}:\d{2}$/.test(v.hora)) erros.hora = 'Informe a hora.';
  const duracao = Number(v.duracao);
  if (v.duracao.trim() === '' || !Number.isInteger(duracao) || duracao < 1 || duracao > DURACAO_MAXIMA_MIN) {
    erros.duracao = `Informe a duração em minutos (de 1 a ${DURACAO_MAXIMA_MIN}).`;
  }
  if (Object.keys(erros).length > 0) return { erros, dados: null };
  return ok({ diaSemana: Number(v.diaSemana), hora: v.hora, duracaoMin: duracao });
}

/**
 * "A partir de quando?" da troca de horário fixo: uma data de hoje em diante, e não antes de o horário
 * atual começar a valer (o que já aconteceu não muda). Devolve o aviso, ou `undefined` quando a data serve.
 */
export function avisoDaMudancaDeHorario(aPartirDe: string, hoje: DataISO, validoDe: DataISO): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(aPartirDe)) return 'Informe a partir de quando vale o novo horário.';
  if (aPartirDe < hoje) return 'Escolha hoje ou uma data futura.';
  if (aPartirDe < validoDe) return `A mudança não pode começar antes de ${formatarData(validoDe)}.`;
  return undefined;
}

// ---------------------------------------------------------------- avaliação

export const SESSOES_PREVISTAS_MAXIMAS = 99;

/** Sessões previstas da avaliação: inteiro de 1 a 99. */
export function validarSessoesPrevistas(texto: string): Resultado<{ sessoesPrevistas: string }, number> {
  const n = Number(texto);
  if (texto.trim() === '' || !Number.isInteger(n) || n < 1 || n > SESSOES_PREVISTAS_MAXIMAS) {
    return { erros: { sessoesPrevistas: `Informe um número inteiro de 1 a ${SESSOES_PREVISTAS_MAXIMAS}.` }, dados: null };
  }
  return ok(n);
}

/** Etapa nova da avaliação: precisa de nome e não pode repetir uma que já existe (sem diferenciar maiúsculas e acentos). */
export function validarEtapa(nome: string, existentes: Etapa[]): Resultado<{ nome: string }, Etapa> {
  const limpo = nome.trim().replace(/\s+/g, ' ');
  if (limpo === '') return { erros: { nome: 'Informe o nome da etapa.' }, dados: null };
  if (existentes.some((e) => normalizarParaBusca(e.nome) === normalizarParaBusca(limpo))) {
    return { erros: { nome: 'Essa etapa já existe.' }, dados: null };
  }
  return ok({ nome: limpo, feita: false });
}

/** O maior valor aceito para uma avaliação: R$ 100.000,00 (em centavos). Passar disso é quase sempre um zero a mais. */
export const VALOR_AVALIACAO_MAXIMO_CENTAVOS = 10_000_000;

const AVISO_VALOR_INVALIDO = 'Informe um valor válido, como 1800 ou 1800,50.';
// O espaço do formatarReais não quebra linha; no aviso basta o espaço comum.
const AVISO_VALOR_ALTO = `Use um valor de até ${formatarReais(VALOR_AVALIACAO_MAXIMO_CENTAVOS).replace('\u00a0', ' ')}.`;

/** Valor de uma avaliação digitado em reais: em branco vale zero, e vai de R$ 0,00 a R$ 100.000,00. */
function lerValorDaAvaliacao(texto: string): { centavos: number } | { aviso: string } {
  const centavos = texto.trim() === '' ? 0 : lerReais(texto);
  if (centavos === null) return { aviso: AVISO_VALOR_INVALIDO };
  if (centavos > VALOR_AVALIACAO_MAXIMO_CENTAVOS) return { aviso: AVISO_VALOR_ALTO };
  return { centavos };
}

/** Valor padrão da avaliação (Configurações): o que uma avaliação nova prevê. Aceita zero (nenhum valor padrão). */
export function validarValorPadraoDaAvaliacao(texto: string): Resultado<{ valor: string }, number> {
  const lido = lerValorDaAvaliacao(texto);
  if ('aviso' in lido) return { erros: { valor: lido.aviso }, dados: null };
  return ok(lido.centavos);
}

export interface ValoresAvaliacao {
  /** O valor previsto como digitado ('1800', '1.800,50'). */
  valorPrevisto: string;
  descontoTipo: TipoDesconto;
  /** Reais ('150,50') quando o desconto é em reais; porcentagem ('15') quando é em porcentagem; ignorado sem desconto. */
  descontoValor: string;
}

export type DadosValoresAvaliacao = Pick<Avaliacao, 'valorPrevistoCentavos' | 'descontoTipo' | 'descontoValor'>;
export type ErrosValoresAvaliacao = Partial<Record<'valorPrevisto' | 'descontoValor', string>>;

export function valoresDaAvaliacao(a: DadosValoresAvaliacao): ValoresAvaliacao {
  const descontoValor = {
    nenhum: '',
    reais: centavosParaCampo(a.descontoValor),
    percentual: String(a.descontoValor),
  }[a.descontoTipo];
  return { valorPrevisto: centavosParaCampo(a.valorPrevistoCentavos), descontoTipo: a.descontoTipo, descontoValor };
}

/**
 * Valor previsto e desconto da avaliação. O desconto em porcentagem é um inteiro de 0 a 100; em reais não passa
 * do valor previsto. Em branco vale zero; sem desconto, o que estiver no campo do desconto não conta.
 */
export function validarValoresDaAvaliacao(v: ValoresAvaliacao): Resultado<ErrosValoresAvaliacao, DadosValoresAvaliacao> {
  const erros: ErrosValoresAvaliacao = {};
  const previsto = lerValorDaAvaliacao(v.valorPrevisto);
  if ('aviso' in previsto) erros.valorPrevisto = previsto.aviso;

  let descontoValor = 0;
  if (v.descontoTipo === 'percentual') {
    const texto = v.descontoValor.trim();
    const porcentagem = texto === '' ? 0 : /^\d+$/.test(texto) ? Number(texto) : Number.NaN;
    if (porcentagem <= 100) descontoValor = porcentagem;
    else erros.descontoValor = 'Use uma porcentagem de 0 a 100.';
  } else if (v.descontoTipo === 'reais') {
    const reais = v.descontoValor.trim() === '' ? 0 : lerReais(v.descontoValor);
    if (reais === null) erros.descontoValor = 'Informe um valor válido, como 150 ou 150,50.';
    else if ('centavos' in previsto && reais > previsto.centavos) erros.descontoValor = 'O desconto passa do valor previsto.';
    else descontoValor = reais;
  }

  if (Object.keys(erros).length > 0 || !('centavos' in previsto)) return { erros, dados: null };
  return ok({ valorPrevistoCentavos: previsto.centavos, descontoTipo: v.descontoTipo, descontoValor });
}
