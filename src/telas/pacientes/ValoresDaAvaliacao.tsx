import { useState, type FormEvent } from 'react';
import { Aviso } from '../../componentes/Aviso';
import { Botao } from '../../componentes/Botao';
import { Campo } from '../../componentes/Campo';
import { GrupoDeOpcoes } from '../../componentes/GrupoDeOpcoes';
import { useSalvarAvaliacao } from '../../dados/useFicha';
import { ROTULO_DESCONTO } from '../../dominio/rotulos';
import type { Avaliacao, TipoDesconto } from '../../dominio/tipos';
import { valorFinalDaAvaliacao } from '../../regras/cobranca';
import { formatarReais } from '../../regras/dinheiro';
import {
  validarValoresDaAvaliacao,
  valoresDaAvaliacao,
  type ErrosValoresAvaliacao,
  type ValoresAvaliacao,
} from '../../regras/formularios';

const TIPOS_DE_DESCONTO: TipoDesconto[] = ['nenhum', 'reais', 'percentual'];
const OPCOES_DE_DESCONTO = TIPOS_DE_DESCONTO.map((valor) => ({ valor, rotulo: ROTULO_DESCONTO[valor] }));

/**
 * O pacote da avaliação: valor previsto, desconto (em reais ou em porcentagem) e o valor final,
 * que se atualiza a cada tecla. Só grava ao salvar, e só com valores que fazem sentido.
 */
export function ValoresDaAvaliacao({ avaliacao }: { avaliacao: Avaliacao }) {
  const salvar = useSalvarAvaliacao(avaliacao.pacienteId);
  const [valores, setValores] = useState<ValoresAvaliacao>(() => valoresDaAvaliacao(avaliacao));
  const [erros, setErros] = useState<ErrosValoresAvaliacao>({});

  function alterar(mudanca: Partial<ValoresAvaliacao>) {
    setValores((v) => ({ ...v, ...mudanca }));
    setErros({});
    // O "salvos" (ou o erro) era sobre o que ela tinha antes de mexer.
    if (!salvar.isIdle) salvar.reset();
  }

  const lidos = validarValoresDaAvaliacao(valores);
  const valorFinal = lidos.dados ? formatarReais(valorFinalDaAvaliacao(lidos.dados)) : null;

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErros(lidos.erros);
    if (lidos.dados === null) return;
    const dados = lidos.dados;
    // Grava a avaliação inteira com só os valores trocados. `avaliacao` é a da ficha neste instante (já com o que
    // foi marcado nas etapas, mesmo que ainda esteja sendo gravado), e não uma cópia guardada ao abrir a tela.
    salvar.mutate({ ...avaliacao, ...dados }, { onSuccess: () => setValores(valoresDaAvaliacao(dados)) });
  }

  return (
    <form noValidate onSubmit={aoEnviar} className="flex flex-col items-start gap-3">
      <h3 className="text-lg">Valores</h3>
      <Campo
        rotulo="Valor previsto"
        ajuda="Em reais, por exemplo 1800 ou 1800,50."
        inputMode="decimal"
        autoComplete="off"
        value={valores.valorPrevisto}
        onChange={(e) => alterar({ valorPrevisto: e.target.value })}
        erro={erros.valorPrevisto}
      />
      <GrupoDeOpcoes
        legenda="Desconto"
        opcoes={OPCOES_DE_DESCONTO}
        valor={valores.descontoTipo}
        // Trocar o tipo esvazia o campo: 10% não pode virar R$ 10,00 sem ela ver.
        aoMudar={(descontoTipo) => alterar({ descontoTipo, descontoValor: '' })}
      />
      {valores.descontoTipo === 'reais' && (
        <Campo
          key="reais"
          rotulo="Valor do desconto"
          ajuda="Em reais, por exemplo 150 ou 150,50."
          inputMode="decimal"
          autoComplete="off"
          value={valores.descontoValor}
          onChange={(e) => alterar({ descontoValor: e.target.value })}
          erro={erros.descontoValor}
        />
      )}
      {valores.descontoTipo === 'percentual' && (
        <Campo
          key="percentual"
          rotulo="Valor do desconto"
          ajuda="Porcentagem inteira, de 0 a 100."
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          value={valores.descontoValor}
          onChange={(e) => alterar({ descontoValor: e.target.value })}
          erro={erros.descontoValor}
        />
      )}
      <p aria-live="polite" aria-atomic="true" className="text-lg font-semibold">
        Valor final: {valorFinal ?? 'confira os valores.'}
      </p>
      {salvar.isError && <Aviso tipo="erro">Não foi possível salvar a avaliação. Tente de novo.</Aviso>}
      {salvar.isSuccess && <Aviso tipo="sucesso">Valores salvos.</Aviso>}
      <Botao type="submit" variante="secundario" disabled={salvar.isPending}>
        Salvar valores
      </Botao>
    </form>
  );
}
