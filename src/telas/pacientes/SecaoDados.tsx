import { useState, type FormEvent } from 'react';
import { Aviso } from '../../componentes/Aviso';
import { Botao } from '../../componentes/Botao';
import { SecaoRecolhivel } from '../../componentes/SecaoRecolhivel';
import { useSalvarPaciente } from '../../dados/useFicha';
import type { Paciente } from '../../dominio/tipos';
import { hojeISO } from '../../regras/datas';
import { validarDados, valoresDeDados, type ErrosDados, type ValoresDados } from '../../regras/formularios';
import { CamposDados } from './CamposDoPaciente';

/** Nome, nascimento, CPF, escola, série e observações da criança. */
export function SecaoDados({ paciente }: { paciente: Paciente }) {
  const salvar = useSalvarPaciente(paciente.id);
  const [valores, setValores] = useState<ValoresDados>(() => valoresDeDados(paciente));
  const [erros, setErros] = useState<ErrosDados>({});

  function alterar(mudanca: Partial<ValoresDados>) {
    setValores((v) => ({ ...v, ...mudanca }));
    // O "salvo" (ou o erro) era sobre o que estava antes de mexer.
    if (!salvar.isIdle) salvar.reset();
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const lido = validarDados(valores, hojeISO());
    setErros(lido.erros);
    if (lido.dados === null) return;
    const dados = lido.dados;
    // Depois de salvar, os campos mostram o que ficou gravado (textos aparados, CPF no formato certo).
    salvar.mutate({ ...paciente, ...dados }, { onSuccess: () => setValores(valoresDeDados(dados)) });
  }

  return (
    <SecaoRecolhivel titulo="Dados da criança">
      <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-4">
        <CamposDados valores={valores} erros={erros} aoMudar={alterar} />
        {salvar.isError && <Aviso tipo="erro">Não foi possível salvar. Tente de novo.</Aviso>}
        {salvar.isSuccess && <Aviso tipo="sucesso">Dados salvos.</Aviso>}
        <Botao type="submit" disabled={salvar.isPending} className="self-start">
          {salvar.isPending ? 'Salvando…' : 'Salvar dados'}
        </Botao>
      </form>
    </SecaoRecolhivel>
  );
}
