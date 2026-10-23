import { useState, type FormEvent } from 'react';
import { Aviso } from '../../componentes/Aviso';
import { Botao } from '../../componentes/Botao';
import { SecaoRecolhivel } from '../../componentes/SecaoRecolhivel';
import { useSalvarPaciente } from '../../dados/useFicha';
import type { Paciente } from '../../dominio/tipos';
import { formatarReais } from '../../regras/dinheiro';
import { validarCobranca, valoresDeCobranca, type ValoresCobranca } from '../../regras/formularios';
import { CamposCobranca } from './CamposDoPaciente';

/** Forma de cobrança (por sessão ou por mês) e valor da sessão deste paciente. */
export function SecaoCobranca({ paciente }: { paciente: Paciente }) {
  const salvar = useSalvarPaciente(paciente.id);
  const [valores, setValores] = useState<ValoresCobranca>(() => valoresDeCobranca(paciente));
  const [erros, setErros] = useState<{ valor?: string }>({});

  function alterar(mudanca: Partial<ValoresCobranca>) {
    setValores((v) => ({ ...v, ...mudanca }));
    if (!salvar.isIdle) salvar.reset();
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const lido = validarCobranca(valores);
    setErros(lido.erros);
    if (lido.dados === null) return;
    const dados = lido.dados;
    // Depois de salvar, o valor aparece como ficou gravado ('200' vira '200,00').
    salvar.mutate({ ...paciente, ...dados }, { onSuccess: () => setValores(valoresDeCobranca(dados)) });
  }

  return (
    <SecaoRecolhivel titulo="Cobrança">
      <p>
        Hoje: {paciente.formaCobranca === 'mensal' ? 'por mês' : 'por sessão'},{' '}
        <strong>{formatarReais(paciente.valorSessaoCentavos)}</strong> a sessão.
      </p>
      {paciente.tipo === 'avaliacao' && (
        <p>
          A avaliação é cobrada como pacote. O valor da sessão vale para a psicoterapia e para as faltas sem aviso durante a
          avaliação.
        </p>
      )}
      <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-4">
        <CamposCobranca valores={valores} erros={erros} aoMudar={alterar} />
        {salvar.isError && <Aviso tipo="erro">Não foi possível salvar. Tente de novo.</Aviso>}
        {salvar.isSuccess && <Aviso tipo="sucesso">Cobrança salva.</Aviso>}
        <Botao type="submit" disabled={salvar.isPending} className="self-start">
          {salvar.isPending ? 'Salvando…' : 'Salvar cobrança'}
        </Botao>
      </form>
    </SecaoRecolhivel>
  );
}
