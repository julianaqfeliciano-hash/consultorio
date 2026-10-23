import {
  CalendarSync,
  CalendarX,
  CircleCheck,
  CircleMinus,
  CircleX,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import type { HorarioFixo, Sessao, SituacaoSessao, TipoAtendimento } from './tipos';

/** Situação da sessão em texto. Aparece sempre junto do ícone, nunca só como cor. */
export const ROTULO_SITUACAO: Record<SituacaoSessao, string> = {
  agendada: 'Agendada',
  compareceu: 'Compareceu',
  falta_com_aviso: 'Faltou com aviso',
  falta_sem_aviso: 'Faltou sem aviso',
  cancelada: 'Cancelada',
  remarcada: 'Remarcada',
};

export const ICONE_SITUACAO: Record<SituacaoSessao, LucideIcon> = {
  agendada: Clock,
  compareceu: CircleCheck,
  falta_com_aviso: CircleMinus,
  falta_sem_aviso: CircleX,
  cancelada: CalendarX,
  remarcada: CalendarSync,
};

/** Os dois tipos de atendimento mais a sessão com os responsáveis, que tem identidade própria na agenda. */
export type TipoVisual = TipoAtendimento | 'familiar';

export const ROTULO_TIPO: Record<TipoVisual, string> = {
  avaliacao: 'Avaliação',
  psicoterapia: 'Psicoterapia',
  familiar: 'Acompanhamento familiar',
};

/** Nome da cor da marca de cada tipo (as do `@theme` do Tailwind). */
export const COR_TIPO: Record<TipoVisual, string> = {
  avaliacao: 'amarelo',
  psicoterapia: 'laranja',
  familiar: 'azul-claro',
};

// O Tailwind só gera classes que aparecem escritas por inteiro no código: nada de montar `bg-${cor}`.
/** Fundo na cor do tipo (para bolinhas e marcas; texto em cima dessas cores não tem contraste suficiente). */
export const CLASSE_FUNDO_TIPO: Record<TipoVisual, string> = {
  avaliacao: 'bg-amarelo',
  psicoterapia: 'bg-laranja',
  familiar: 'bg-azul-claro',
};

/** Faixa lateral na cor do tipo (use junto com `border-l-4`). */
export const CLASSE_FAIXA_TIPO: Record<TipoVisual, string> = {
  avaliacao: 'border-l-amarelo',
  psicoterapia: 'border-l-laranja',
  familiar: 'border-l-azul-claro',
};

/** Sessão com os responsáveis aparece como "familiar", seja qual for o tipo do paciente. */
export function tipoVisual(s: Sessao): TipoVisual {
  return s.acompanhamentoFamiliar ? 'familiar' : s.tipo;
}

/** Nome curto de cada dia da semana, na ordem de `HorarioFixo.diaSemana` (0 = domingo). */
export const ROTULO_DIA_SEMANA: readonly string[] = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** Ex.: 'Terça, 14:00, 50 min'. */
export function descreverHorario(h: Pick<HorarioFixo, 'diaSemana' | 'hora' | 'duracaoMin'>): string {
  return `${ROTULO_DIA_SEMANA[h.diaSemana]}, ${h.hora}, ${h.duracaoMin} min`;
}
