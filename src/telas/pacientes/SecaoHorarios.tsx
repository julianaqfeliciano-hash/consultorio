import { Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { Aviso } from '../../componentes/Aviso';
import { Botao } from '../../componentes/Botao';
import { SecaoRecolhivel } from '../../componentes/SecaoRecolhivel';
import { descreverHorario } from '../../dominio/rotulos';
import type { HorarioFixo, Id, StatusPaciente } from '../../dominio/tipos';
import { formatarData, hojeISO } from '../../regras/datas';
import { FormularioHorario } from './FormularioHorario';

interface Props {
  pacienteId: Id;
  status: StatusPaciente;
  /** Todos os horários do paciente, inclusive os já encerrados. */
  horarios: HorarioFixo[];
}

/** O que o horário tem de especial hoje: ainda não começou, ou já tem data para acabar. */
function observacao(h: HorarioFixo, hoje: string): string | null {
  if (h.validoDe > hoje) return `a partir de ${formatarData(h.validoDe)}`;
  if (h.validoAte !== null) return `até ${formatarData(h.validoAte)}`;
  return null;
}

/**
 * Horários fixos semanais. Mostra os que valem hoje ou ainda vão valer; os já encerrados ficam
 * de fora. A agenda das próximas semanas é completada ao adicionar ou mudar um horário.
 */
export function SecaoHorarios({ pacienteId, status, horarios }: Props) {
  const prefixo = useId();
  const [adicionando, setAdicionando] = useState(false);
  const [mudando, setMudando] = useState<Id | null>(null);
  const [mudancaFalhou, setMudancaFalhou] = useState(false);
  const hoje = hojeISO();
  const vigentes = horarios.filter((h) => h.validoAte === null || h.validoAte >= hoje);
  const somenteLeitura = status === 'alta';

  return (
    <SecaoRecolhivel titulo="Horários fixos" abertaNoCelular>
      {mudancaFalhou && (
        <Aviso tipo="erro">Não foi possível mudar o horário. Confira na lista o que ficou gravado antes de tentar de novo.</Aviso>
      )}
      {vigentes.length === 0 && <p>Nenhum horário fixo ainda.</p>}
      {vigentes.length > 0 && (
        <ul className="flex flex-col gap-3">
          {vigentes.map((h) => {
            const nota = observacao(h, hoje);
            const idDescricao = `${prefixo}-${h.id}`;
            // Só o horário que vale hoje e não tem data de término pode ser trocado.
            const podeMudar = !somenteLeitura && h.validoDe <= hoje && h.validoAte === null;
            return (
              <li key={h.id} className="flex flex-col gap-3 rounded-lg border-2 border-verde-claro p-4">
                <p className="flex flex-wrap items-baseline gap-x-3">
                  <span id={idDescricao} className="text-lg font-semibold">
                    {descreverHorario(h)}
                  </span>
                  {nota && <span>{nota}</span>}
                </p>
                {mudando === h.id ? (
                  <FormularioHorario
                    pacienteId={pacienteId}
                    horario={h}
                    aoConcluir={() => setMudando(null)}
                    aoCancelar={() => setMudando(null)}
                    aoFalhar={() => {
                      setMudando(null);
                      setMudancaFalhou(true);
                    }}
                  />
                ) : (
                  podeMudar && (
                    <Botao
                      variante="secundario"
                      aria-describedby={idDescricao}
                      className="self-start"
                      onClick={() => {
                        setMudancaFalhou(false);
                        setMudando(h.id);
                      }}
                    >
                      Mudar horário
                    </Botao>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!somenteLeitura &&
        (adicionando ? (
          <FormularioHorario pacienteId={pacienteId} aoConcluir={() => setAdicionando(false)} aoCancelar={() => setAdicionando(false)} />
        ) : (
          <Botao className="self-start" onClick={() => setAdicionando(true)}>
            <Plus aria-hidden="true" className="size-5" />
            Adicionar horário
          </Botao>
        ))}
    </SecaoRecolhivel>
  );
}
