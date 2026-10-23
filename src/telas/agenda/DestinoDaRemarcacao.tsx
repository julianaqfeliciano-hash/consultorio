import { useSessoesDoPaciente } from '../../dados/useFicha';
import { ICONE_SITUACAO } from '../../dominio/rotulos';
import type { Sessao } from '../../dominio/tipos';
import { dataLocal, diaPorExtenso, horaLocal } from '../../regras/datas';

/**
 * Para uma sessão remarcada: "Remarcada para {dia}, {hora}". A nova sessão pode estar em qualquer semana,
 * então ela é procurada entre as sessões do paciente, não entre as da semana na tela.
 */
export function DestinoDaRemarcacao({ sessao }: { sessao: Sessao }) {
  const sessoes = useSessoesDoPaciente(sessao.pacienteId);
  const destino = sessoes.data?.find((s) => s.id === sessao.remarcadaPara);
  const Icone = ICONE_SITUACAO.remarcada;
  return (
    <p className="flex items-start gap-2 rounded-lg bg-azul-claro/30 p-3 font-semibold">
      <Icone aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      {destino
        ? `Remarcada para ${diaPorExtenso(dataLocal(destino.inicio))}, ${horaLocal(destino.inicio)}`
        : 'Remarcada para outro horário.'}
    </p>
  );
}
