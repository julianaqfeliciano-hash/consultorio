import { TZDate } from '@date-fns/tz';
import { addDays, format, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import type { DataISO, Hora } from '../dominio/tipos';

/** Fuso único do sistema. Nenhuma regra depende do fuso do aparelho. */
export const FUSO = 'America/Sao_Paulo';

/** Meia-noite de uma data de calendário ('YYYY-MM-DD') no fuso do consultório. */
function meiaNoite(d: DataISO): TZDate {
  const [ano, mes, dia] = d.split('-').map(Number);
  return new TZDate(ano, mes - 1, dia, FUSO);
}

/** Um instante qualquer visto no fuso do consultório. */
function noFuso(instante: Date | string): TZDate {
  return new TZDate(new Date(instante), FUSO);
}

/** Dia de calendário (no fuso do consultório) em que o instante cai. */
export function dataLocal(instante: string): DataISO {
  return format(noFuso(instante), 'yyyy-MM-dd');
}

/** Hora do relógio (no fuso do consultório) em que o instante cai. */
export function horaLocal(instante: string): Hora {
  return format(noFuso(instante), 'HH:mm');
}

/** Data de hoje no fuso do consultório. */
export function hojeISO(agora: Date = new Date()): DataISO {
  return dataLocal(agora.toISOString());
}

/** Soma `n` dias de calendário (pode ser negativo). */
export function somarDias(d: DataISO, n: number): DataISO {
  return format(addDays(meiaNoite(d), n), 'yyyy-MM-dd');
}

/** Dia da semana de uma data: 0 = domingo, 1 = segunda, ..., 6 = sábado. */
export function diaDaSemana(d: DataISO): number {
  return meiaNoite(d).getDay();
}

/** Instante UTC (ISO) em que o relógio do consultório marca `h` na data `d`. */
export function instanteDe(d: DataISO, h: Hora): string {
  const [ano, mes, dia] = d.split('-').map(Number);
  const [hora, minuto] = h.split(':').map(Number);
  // TZDate.toISOString() devolve o deslocamento do fuso (-03:00); passamos por Date para obter UTC ('Z').
  return new Date(new TZDate(ano, mes - 1, dia, hora, minuto, FUSO).getTime()).toISOString();
}

/** Segunda-feira da semana em que a data cai (o domingo pertence à semana anterior). */
export function inicioDaSemana(d: DataISO): DataISO {
  return format(startOfWeek(meiaNoite(d), { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

/** Ex.: '03/11/2026'. */
export function formatarData(d: DataISO): string {
  const [ano, mes, dia] = d.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Ex.: 'terça-feira, 03/11'. */
export function diaPorExtenso(d: DataISO): string {
  return format(meiaNoite(d), 'EEEE, dd/MM', { locale: ptBR });
}

/** `d` está entre `ini` e `fim`, com os dois limites incluídos. */
export function entre(d: DataISO, ini: DataISO, fim: DataISO): boolean {
  // Datas 'YYYY-MM-DD' ordenam corretamente como texto.
  return d >= ini && d <= fim;
}
