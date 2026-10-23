import { useState, type FormEvent } from 'react';
import { Aviso } from '../../componentes/Aviso';
import { Botao } from '../../componentes/Botao';
import { Campo } from '../../componentes/Campo';
import { SecaoRecolhivel } from '../../componentes/SecaoRecolhivel';
import { useSalvarPaciente } from '../../dados/useFicha';
import type { Paciente } from '../../dominio/tipos';
import { formatarData } from '../../regras/datas';
import { AcoesDoAtendimento } from './AcoesDoAtendimento';
import { SelecaoParceiro } from './CamposDoPaciente';

/** Data de entrada, quem encaminhou e as mudanças de situação: mudar o tipo, iniciar o atendimento, dar alta. */
export function SecaoAtendimento({ paciente }: { paciente: Paciente }) {
  const salvar = useSalvarPaciente(paciente.id);
  const [dataEntrada, setDataEntrada] = useState(paciente.dataEntrada ?? '');
  const [parceiroId, setParceiroId] = useState(paciente.parceiroId ?? '');

  function alterar(mudanca: () => void) {
    mudanca();
    if (!salvar.isIdle) salvar.reset();
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    salvar.mutate({ ...paciente, dataEntrada: dataEntrada || null, parceiroId: parceiroId || null });
  }

  return (
    <SecaoRecolhivel titulo="Atendimento">
      <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-4">
        <Campo
          rotulo="Data de entrada"
          ajuda="Preenchida sozinha no primeiro comparecimento. Você pode corrigir."
          type="date"
          value={dataEntrada}
          onChange={(e) => alterar(() => setDataEntrada(e.target.value))}
        />
        <SelecaoParceiro valor={parceiroId} aoMudar={(id) => alterar(() => setParceiroId(id))} />
        {salvar.isError && <Aviso tipo="erro">Não foi possível salvar. Tente de novo.</Aviso>}
        {salvar.isSuccess && <Aviso tipo="sucesso">Atendimento salvo.</Aviso>}
        <Botao type="submit" disabled={salvar.isPending} className="self-start">
          {salvar.isPending ? 'Salvando…' : 'Salvar atendimento'}
        </Botao>
      </form>
      {paciente.status === 'alta' && paciente.dataAlta && <p>Data da alta: {formatarData(paciente.dataAlta)}</p>}
      <AcoesDoAtendimento paciente={paciente} />
    </SecaoRecolhivel>
  );
}
