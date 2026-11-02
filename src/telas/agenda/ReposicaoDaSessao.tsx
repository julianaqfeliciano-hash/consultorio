import { CalendarPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Aviso } from '../../componentes/Aviso';
import { Botao } from '../../componentes/Botao';
import { Campo } from '../../componentes/Campo';
import { mensagemDoErro, useAgendarReposicao } from '../../dados/useCobranca';
import { useSessoesDoPaciente } from '../../dados/useFicha';
import type { Sessao } from '../../dominio/tipos';
import { dataLocal, diaPorExtenso, horaLocal } from '../../regras/datas';
import { validarRemarcacao, type ValoresRemarcacao } from '../../regras/formulariosAgenda';

/**
 * A reposição da falta sem aviso na avaliação (spec §6.4): data e hora da sessão que repõe a que faltou. Depois de
 * agendada, o painel passa a dizer "Reposição em {dia}, {hora}". Use só em avaliação com falta sem aviso.
 * A nova sessão pode estar em qualquer semana, então ela é procurada entre as sessões do paciente.
 */
export function ReposicaoDaSessao({ sessao }: { sessao: Sessao }) {
  const sessoes = useSessoesDoPaciente(sessao.pacienteId);
  const agendar = useAgendarReposicao();
  const [valores, setValores] = useState<ValoresRemarcacao>({ data: '', hora: '' });
  const [erros, setErros] = useState<Partial<Record<'data' | 'hora', string>>>({});

  if (sessao.remarcadaPara !== null) {
    const reposicao = sessoes.data?.find((s) => s.id === sessao.remarcadaPara);
    return (
      <p className="flex items-start gap-2 rounded-lg bg-azul-claro/30 p-3 font-semibold">
        <CalendarPlus aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        {reposicao
          ? `Reposição em ${diaPorExtenso(dataLocal(reposicao.inicio))}, ${horaLocal(reposicao.inicio)}`
          : 'Reposição agendada para outro horário.'}
      </p>
    );
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    // A mutação não tem trava própria contra duas chamadas: o botão desligado é a única.
    if (agendar.isPending) return;
    const lido = validarRemarcacao(valores, sessao.inicio);
    setErros(lido.erros);
    if (lido.dados === null) return;
    agendar.mutate({ sessao, inicio: lido.dados.inicio });
  }

  return (
    <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-3">
      <h3 className="text-lg">Agendar reposição</h3>
      <p className="text-sm">A falta é cobrada à parte; a reposição mantém o pacote da avaliação completo.</p>
      <div className="grid grid-cols-2 gap-3">
        <Campo
          rotulo="Nova data"
          type="date"
          value={valores.data}
          onChange={(e) => setValores((v) => ({ ...v, data: e.target.value }))}
          erro={erros.data}
        />
        <Campo
          rotulo="Nova hora"
          type="time"
          value={valores.hora}
          onChange={(e) => setValores((v) => ({ ...v, hora: e.target.value }))}
          erro={erros.hora}
        />
      </div>
      {agendar.isError && (
        <Aviso tipo="erro">
          {mensagemDoErro(agendar.error, 'Não foi possível agendar a reposição. Confira a agenda antes de tentar de novo.')}
        </Aviso>
      )}
      <Botao type="submit" variante="secundario" disabled={agendar.isPending} className="self-start">
        {agendar.isPending ? 'Agendando…' : 'Agendar reposição'}
      </Botao>
    </form>
  );
}
