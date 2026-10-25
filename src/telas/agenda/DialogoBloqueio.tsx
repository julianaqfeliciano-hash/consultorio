import { useState, type FormEvent, type RefObject } from 'react';
import { Aviso } from '../../componentes/Aviso';
import { Botao } from '../../componentes/Botao';
import { Campo } from '../../componentes/Campo';
import { DialogoConfirmacao } from '../../componentes/DialogoConfirmacao';
import { Folha } from '../../componentes/Folha';
import { useBloquearPeriodo } from '../../dados/useAgenda';
import { diasNoPeriodo, formatarData } from '../../regras/datas';
import {
  descreverCanceladas,
  validarBloqueio,
  type ErrosBloqueio,
  type ValoresBloqueio,
} from '../../regras/formulariosAgenda';

interface DialogoBloqueioProps {
  aberta: boolean;
  onFechar: () => void;
  retornarFocoPara: RefObject<HTMLElement | null>;
}

type DadosBloqueio = NonNullable<ReturnType<typeof validarBloqueio>['dados']>;

/** Período longo demais para ser engano comum: a pergunta pede atenção (um ano digitado errado, por exemplo). */
const DIAS_PARA_PEDIR_ATENCAO = 31;

function avisoDoPeriodo(p: DadosBloqueio): string | undefined {
  const dias = diasNoPeriodo(p.inicio, p.fim);
  return dias > DIAS_PARA_PEDIR_ATENCAO ? `Atenção: são ${dias} dias.` : undefined;
}

/** Campos do bloqueio. Ao enviar, só entrega os dados conferidos: quem usa pergunta antes de gravar. */
function FormularioBloqueio({ aoPedir, onFechar }: { aoPedir: (dados: DadosBloqueio) => void; onFechar: () => void }) {
  const [valores, setValores] = useState<ValoresBloqueio>({ inicio: '', fim: '', motivo: '' });
  const [erros, setErros] = useState<ErrosBloqueio>({});
  const alterar = (mudanca: Partial<ValoresBloqueio>) => setValores((v) => ({ ...v, ...mudanca }));

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const lido = validarBloqueio(valores);
    setErros(lido.erros);
    if (lido.dados !== null) aoPedir(lido.dados);
  }

  return (
    <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-4">
      <p>As sessões ainda agendadas nesse período serão canceladas, sem cobrança, e a agenda não vai gerar sessões nele.</p>
      <Campo rotulo="Início" type="date" value={valores.inicio} onChange={(e) => alterar({ inicio: e.target.value })} erro={erros.inicio} />
      <Campo rotulo="Fim" type="date" value={valores.fim} onChange={(e) => alterar({ fim: e.target.value })} erro={erros.fim} />
      <Campo
        rotulo="Motivo"
        ajuda="Por exemplo: Férias, Feriado."
        value={valores.motivo}
        onChange={(e) => alterar({ motivo: e.target.value })}
        erro={erros.motivo}
      />
      <div className="flex flex-wrap gap-3">
        <Botao type="submit">Bloquear período</Botao>
        <Botao variante="secundario" onClick={onFechar}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}

/**
 * Bloquear dias (férias, feriados): início, fim e motivo. Como cancela as sessões do período de uma vez,
 * pergunta antes de gravar (com o período, datas com o ano, e o aviso do que será cancelado; período de mais de
 * 31 dias pede atenção); depois diz quantas foram canceladas.
 * Com a pergunta aberta (e enquanto grava) a folha fica travada: nada fecha no meio da gravação.
 */
export function DialogoBloqueio({ aberta, onFechar, retornarFocoPara }: DialogoBloqueioProps) {
  const bloquear = useBloquearPeriodo();
  const [pedido, setPedido] = useState<DadosBloqueio | null>(null);

  function fechar() {
    setPedido(null);
    bloquear.reset();
    onFechar();
  }

  return (
    <>
      <Folha aberta={aberta} onFechar={fechar} titulo="Bloquear dias" retornarFocoPara={retornarFocoPara} travada={pedido !== null}>
        {bloquear.isSuccess ? (
          <>
            <Aviso tipo="sucesso">{descreverCanceladas(bloquear.data.canceladas)}</Aviso>
            <p>
              {`${formatarData(bloquear.data.bloqueio.inicio)} a ${formatarData(bloquear.data.bloqueio.fim)} (${bloquear.data.bloqueio.motivo}) ficou bloqueado: a agenda não vai gerar sessões nesses dias.`}
            </p>
          </>
        ) : (
          <FormularioBloqueio aoPedir={setPedido} onFechar={fechar} />
        )}
      </Folha>
      {pedido && (
        <DialogoConfirmacao
          titulo="Bloquear estes dias?"
          mensagem={`Bloquear de ${formatarData(pedido.inicio)} a ${formatarData(pedido.fim)} (${pedido.motivo})? As sessões que ainda estiverem agendadas nesse período serão canceladas, sem cobrança.`}
          aviso={avisoDoPeriodo(pedido)}
          rotuloConfirmar="Bloquear"
          ocupado={bloquear.isPending}
          erro={bloquear.isError ? 'Não foi possível bloquear o período. Tente de novo.' : undefined}
          aoConfirmar={() => bloquear.mutate(pedido, { onSuccess: () => setPedido(null) })}
          aoCancelar={() => {
            bloquear.reset();
            setPedido(null);
          }}
        />
      )}
    </>
  );
}
