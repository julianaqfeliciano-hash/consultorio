import { useState, type FormEvent } from 'react';
import { Aviso } from '../../componentes/Aviso';
import { Botao } from '../../componentes/Botao';
import { Campo } from '../../componentes/Campo';
import { useRemarcar } from '../../dados/useAgenda';
import type { Sessao } from '../../dominio/tipos';
import { validarRemarcacao, type ValoresRemarcacao } from '../../regras/formulariosAgenda';

/**
 * Data e hora novas para a sessão. Ao remarcar, a original fica como "remarcada" e nasce uma sessão nova
 * (quem mostra o resultado é o painel, que passa a exibir "Remarcada para …").
 */
export function RemarcarSessao({ sessao }: { sessao: Sessao }) {
  const remarcar = useRemarcar();
  const [valores, setValores] = useState<ValoresRemarcacao>({ data: '', hora: '' });
  const [erros, setErros] = useState<Partial<Record<'data' | 'hora', string>>>({});

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const lido = validarRemarcacao(valores, sessao.inicio);
    setErros(lido.erros);
    if (lido.dados === null) return;
    remarcar.mutate({ sessao, inicio: lido.dados.inicio });
  }

  return (
    <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-3">
      <h3 className="text-lg">Remarcar para outro dia</h3>
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
      {remarcar.isError && <Aviso tipo="erro">Não foi possível remarcar. Confira a agenda antes de tentar de novo.</Aviso>}
      <Botao type="submit" variante="secundario" disabled={remarcar.isPending} className="self-start">
        {remarcar.isPending ? 'Remarcando…' : 'Remarcar'}
      </Botao>
    </form>
  );
}
