import { SecaoRecolhivel } from '../../componentes/SecaoRecolhivel';
import { ChipSituacao } from '../../componentes/ChipSituacao';
import { EtiquetaTipo } from '../../componentes/EtiquetaTipo';
import { FalhaAoCarregar } from '../../componentes/FalhaAoCarregar';
import { useSessoesDoPaciente } from '../../dados/useFicha';
import { CLASSE_FAIXA_TIPO, tipoVisual } from '../../dominio/rotulos';
import type { Id, Sessao } from '../../dominio/tipos';
import { separarSessoesDoPaciente } from '../../regras/agenda';
import { dataLocal, diaPorExtenso, formatarData, horaLocal, hojeISO } from '../../regras/datas';

function LinhaDaSessao({ sessao, comDiaDaSemana }: { sessao: Sessao; comDiaDaSemana: boolean }) {
  const dia = dataLocal(sessao.inicio);
  const tipo = tipoVisual(sessao);
  return (
    <li
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border-l-4 bg-creme px-3 py-2 ${CLASSE_FAIXA_TIPO[tipo]}`}
    >
      <span className="font-semibold">{`${comDiaDaSemana ? diaPorExtenso(dia) : formatarData(dia)} · ${horaLocal(sessao.inicio)}`}</span>
      <EtiquetaTipo tipo={tipo} />
      <ChipSituacao situacao={sessao.situacao} />
    </li>
  );
}

/** As próximas sessões agendadas e o histórico do paciente (mais recente primeiro). */
export function SecaoSessoes({ pacienteId }: { pacienteId: Id }) {
  const sessoes = useSessoesDoPaciente(pacienteId);
  const { proximas, historico } = separarSessoesDoPaciente(sessoes.data ?? [], hojeISO());

  return (
    <SecaoRecolhivel titulo="Sessões" abertaNoCelular>
      {sessoes.data === undefined && sessoes.isPending && <p role="status">Carregando…</p>}
      {sessoes.data === undefined && sessoes.isError && (
        <FalhaAoCarregar mensagem="Não foi possível carregar as sessões." aoTentarDeNovo={() => void sessoes.refetch()} />
      )}
      {sessoes.data && (
        <>
          <h3 className="text-lg">Próximas</h3>
          {proximas.length === 0 ? (
            <p>Nenhuma sessão agendada.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {proximas.map((s) => (
                <LinhaDaSessao key={s.id} sessao={s} comDiaDaSemana />
              ))}
            </ul>
          )}
          <h3 className="text-lg">Histórico</h3>
          {historico.length === 0 ? (
            <p>Nenhuma sessão no histórico ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {historico.map((s) => (
                <LinhaDaSessao key={s.id} sessao={s} comDiaDaSemana={false} />
              ))}
            </ul>
          )}
        </>
      )}
    </SecaoRecolhivel>
  );
}
