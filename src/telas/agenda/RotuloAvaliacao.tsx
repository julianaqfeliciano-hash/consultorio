import { useFicha, useSessoesDoPaciente } from '../../dados/useFicha';
import type { Sessao } from '../../dominio/tipos';
import { numeroNaAvaliacao } from '../../regras/agenda';

/**
 * "sessão X de N" de uma sessão de avaliação: comparecimentos anteriores da mesma avaliação mais 1,
 * sem passar do total previsto (como na ficha). Só aparece quando a avaliação da sessão é a atual do paciente.
 * Busca a ficha e as sessões do paciente (compartilhadas com a ficha pelo cache), então use só em sessões de avaliação.
 */
export function RotuloAvaliacao({ sessao }: { sessao: Sessao }) {
  const ficha = useFicha(sessao.pacienteId);
  const sessoes = useSessoesDoPaciente(sessao.pacienteId);
  const avaliacao = ficha.data?.avaliacao;
  if (sessao.avaliacaoId === null || !avaliacao || avaliacao.id !== sessao.avaliacaoId || !sessoes.data) return null;

  const numero = Math.min(numeroNaAvaliacao(sessoes.data, sessao), avaliacao.sessoesPrevistas);
  return <span className="text-sm font-semibold">{`sessão ${numero} de ${avaliacao.sessoesPrevistas}`}</span>;
}
