import type { DataISO, Hora, Id } from '../dominio/tipos';
import { instanteDe } from './datas';
import { DURACAO_MAXIMA_MIN, type Resultado } from './formularios';

/**
 * Validação do que se digita nos formulários da agenda (remarcar, sessão avulsa, bloquear dias).
 * Como em `formularios.ts`: devolve os avisos (por campo) ou os dados prontos para gravar; nunca os dois.
 */

function ok<D>(dados: D): { erros: Record<string, never>; dados: D } {
  return { erros: {}, dados };
}

const ehData = (texto: string) => /^\d{4}-\d{2}-\d{2}$/.test(texto);
const ehHora = (texto: string) => /^\d{2}:\d{2}$/.test(texto);

// ---------------------------------------------------------------- remarcar

export interface ValoresRemarcacao {
  data: DataISO | '';
  hora: Hora | '';
}

/** `inicioAtual` é o instante da sessão que está sendo remarcada. */
export function validarRemarcacao(
  v: ValoresRemarcacao,
  inicioAtual: string,
): Resultado<Partial<Record<'data' | 'hora', string>>, { inicio: string }> {
  const erros: Partial<Record<'data' | 'hora', string>> = {};
  if (!ehData(v.data)) erros.data = 'Informe a nova data.';
  if (!ehHora(v.hora)) erros.hora = 'Informe a nova hora.';
  if (Object.keys(erros).length > 0) return { erros, dados: null };

  const inicio = instanteDe(v.data, v.hora);
  if (inicio === inicioAtual) {
    return { erros: { data: 'Escolha uma data ou uma hora diferente da atual.' }, dados: null };
  }
  return ok({ inicio });
}

// ---------------------------------------------------------------- sessão avulsa

export interface ValoresAvulsa {
  pacienteId: Id | '';
  data: DataISO | '';
  hora: Hora | '';
  /** Minutos, como digitados. */
  duracao: string;
  acompanhamentoFamiliar: boolean;
}

export interface DadosAvulsa {
  pacienteId: Id;
  inicio: string;
  duracaoMin: number;
  acompanhamentoFamiliar: boolean;
}

export type ErrosAvulsa = Partial<Record<'pacienteId' | 'data' | 'hora' | 'duracao', string>>;

export function validarAvulsa(v: ValoresAvulsa): Resultado<ErrosAvulsa, DadosAvulsa> {
  const erros: ErrosAvulsa = {};
  if (v.pacienteId === '') erros.pacienteId = 'Escolha o paciente.';
  if (!ehData(v.data)) erros.data = 'Informe a data.';
  if (!ehHora(v.hora)) erros.hora = 'Informe a hora.';
  const duracao = Number(v.duracao);
  if (v.duracao.trim() === '' || !Number.isInteger(duracao) || duracao < 1 || duracao > DURACAO_MAXIMA_MIN) {
    erros.duracao = `Informe a duração em minutos (de 1 a ${DURACAO_MAXIMA_MIN}).`;
  }
  if (Object.keys(erros).length > 0) return { erros, dados: null };
  return ok({
    pacienteId: v.pacienteId,
    inicio: instanteDe(v.data, v.hora),
    duracaoMin: duracao,
    acompanhamentoFamiliar: v.acompanhamentoFamiliar,
  });
}

// ---------------------------------------------------------------- bloquear dias

export interface ValoresBloqueio {
  inicio: DataISO | '';
  fim: DataISO | '';
  motivo: string;
}

export type ErrosBloqueio = Partial<Record<'inicio' | 'fim' | 'motivo', string>>;

export function validarBloqueio(v: ValoresBloqueio): Resultado<ErrosBloqueio, { inicio: DataISO; fim: DataISO; motivo: string }> {
  const erros: ErrosBloqueio = {};
  if (!ehData(v.inicio)) erros.inicio = 'Informe a data de início.';
  if (!ehData(v.fim)) erros.fim = 'Informe a data de fim.';
  else if (ehData(v.inicio) && v.fim < v.inicio) erros.fim = 'A data de fim não pode ser antes do início.';
  if (v.motivo.trim() === '') erros.motivo = 'Informe o motivo, por exemplo: Férias.';
  if (Object.keys(erros).length > 0) return { erros, dados: null };
  // As datas já foram conferidas acima; o TypeScript não enxerga isso através de `ehData`.
  return ok({ inicio: v.inicio as DataISO, fim: v.fim as DataISO, motivo: v.motivo.trim() });
}

/** O que se diz depois de bloquear: quantas sessões marcadas no período foram canceladas. */
export function descreverCanceladas(n: number): string {
  if (n === 0) return 'Nenhuma sessão cancelada.';
  if (n === 1) return '1 sessão cancelada.';
  return `${n} sessões canceladas.`;
}
