import { useId, useState, type FormEvent } from 'react';
import { ROTULO_FORMA } from '../dominio/rotulos';
import type { FormaPagamento } from '../dominio/tipos';
import { hojeISO } from '../regras/datas';
import { centavosParaCampo, formatarReais } from '../regras/dinheiro';
import { validarPagamento, type DadosPagamento, type ErrosPagamento, type ValoresPagamento } from '../regras/formulariosCobranca';
import { AreaDeTexto } from './AreaDeTexto';
import { Aviso } from './Aviso';
import { Botao } from './Botao';
import { Campo } from './Campo';
import { GrupoDeOpcoes } from './GrupoDeOpcoes';

const FORMAS: FormaPagamento[] = ['pix', 'dinheiro', 'cartao', 'transferencia'];
const OPCOES_DE_FORMA = FORMAS.map((valor) => ({ valor, rotulo: ROTULO_FORMA[valor] }));

/** Um valor fixo (o que vem dos valores guardados) ou um valor que a pessoa digita (parcela da avaliação). */
type Valor =
  | { valorCentavos: number; valorEditavel?: false }
  /** Com `valorEditavel`, `valorCentavos` é só o que o campo já traz (por exemplo, o que falta pagar). */
  | { valorCentavos?: number; valorEditavel: true };

type FormularioPagamentoProps = Valor & {
  /** Título do formulário (também o nome dele para leitores de tela). */
  titulo?: string;
  /** Gravando: o botão fica desligado. */
  enviando?: boolean;
  /** Recado de erro de quem gravou (a recusa do serviço, por exemplo). */
  erro?: string;
  /** Recebe os dados já conferidos. `valorCentavos` só vem quando o valor é editável. */
  aoEnviar: (dados: DadosPagamento) => void;
  aoCancelar: () => void;
};

/**
 * Data, forma, observação e valor de um pagamento. Só apresenta e confere: quem o usa grava (veja `useRegistrarPagamento`).
 * Com valor fixo, mostra "Valor: R$ …"; com valor editável, um campo "Valor" em reais.
 */
export function FormularioPagamento({
  valorCentavos,
  valorEditavel = false,
  titulo,
  enviando = false,
  erro,
  aoEnviar,
  aoCancelar,
}: FormularioPagamentoProps) {
  const idTitulo = useId();
  const [valores, setValores] = useState<ValoresPagamento>(() => ({
    data: hojeISO(),
    forma: 'pix',
    observacao: '',
    valor: valorCentavos === undefined ? '' : centavosParaCampo(valorCentavos),
  }));
  const [erros, setErros] = useState<ErrosPagamento>({});

  function mudar(mudanca: Partial<ValoresPagamento>) {
    setValores((v) => ({ ...v, ...mudanca }));
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    // O botão já fica desligado, mas Enter num campo também envia: quem grava não pode receber o pedido duas vezes.
    if (enviando) return;
    const lido = validarPagamento(valores, valorEditavel);
    setErros(lido.erros);
    if (lido.dados !== null) aoEnviar(lido.dados);
  }

  return (
    <form noValidate aria-labelledby={titulo ? idTitulo : undefined} onSubmit={enviar} className="flex flex-col gap-3">
      {titulo && (
        <h3 id={idTitulo} className="text-lg">
          {titulo}
        </h3>
      )}
      {valorEditavel ? (
        <Campo
          rotulo="Valor"
          ajuda="Em reais, por exemplo 500 ou 500,50."
          inputMode="decimal"
          autoComplete="off"
          value={valores.valor}
          onChange={(e) => mudar({ valor: e.target.value })}
          erro={erros.valor}
        />
      ) : (
        <p className="text-lg font-semibold">{`Valor: ${formatarReais(valorCentavos ?? 0)}`}</p>
      )}
      <Campo
        rotulo="Data"
        type="date"
        value={valores.data}
        onChange={(e) => mudar({ data: e.target.value })}
        erro={erros.data}
      />
      <GrupoDeOpcoes legenda="Forma" opcoes={OPCOES_DE_FORMA} valor={valores.forma} aoMudar={(forma) => mudar({ forma })} />
      <AreaDeTexto rotulo="Observação" rows={2} value={valores.observacao} onChange={(e) => mudar({ observacao: e.target.value })} />
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="flex flex-wrap gap-3">
        <Botao type="submit" disabled={enviando}>
          {enviando ? 'Registrando…' : 'Confirmar pagamento'}
        </Botao>
        <Botao variante="secundario" onClick={aoCancelar}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}
