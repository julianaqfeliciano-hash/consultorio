import { useState, type FormEvent, type RefObject } from 'react';
import { Aviso } from '../../componentes/Aviso';
import { Botao } from '../../componentes/Botao';
import { Campo } from '../../componentes/Campo';
import { Folha } from '../../componentes/Folha';
import { useBloquearPeriodo } from '../../dados/useAgenda';
import { formatarData } from '../../regras/datas';
import { descreverCanceladas, validarBloqueio, type ErrosBloqueio, type ValoresBloqueio } from '../../regras/formulariosAgenda';

interface DialogoBloqueioProps {
  aberta: boolean;
  onFechar: () => void;
  retornarFocoPara: RefObject<HTMLElement | null>;
}

function FormularioBloqueio({ onFechar }: Pick<DialogoBloqueioProps, 'onFechar'>) {
  const bloquear = useBloquearPeriodo();
  const [valores, setValores] = useState<ValoresBloqueio>({ inicio: '', fim: '', motivo: '' });
  const [erros, setErros] = useState<ErrosBloqueio>({});
  const alterar = (mudanca: Partial<ValoresBloqueio>) => setValores((v) => ({ ...v, ...mudanca }));

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const lido = validarBloqueio(valores);
    setErros(lido.erros);
    if (lido.dados === null) return;
    bloquear.mutate(lido.dados);
  }

  if (bloquear.isSuccess) {
    const { bloqueio, canceladas } = bloquear.data;
    return (
      <>
        <Aviso tipo="sucesso">{descreverCanceladas(canceladas)}</Aviso>
        <p>
          {`${formatarData(bloqueio.inicio)} a ${formatarData(bloqueio.fim)} (${bloqueio.motivo}) ficou bloqueado: a agenda não vai gerar sessões nesses dias.`}
        </p>
      </>
    );
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
      {bloquear.isError && <Aviso tipo="erro">Não foi possível bloquear o período. Tente de novo.</Aviso>}
      <div className="flex flex-wrap gap-3">
        <Botao type="submit" disabled={bloquear.isPending}>
          {bloquear.isPending ? 'Bloqueando…' : 'Bloquear período'}
        </Botao>
        <Botao variante="secundario" disabled={bloquear.isPending} onClick={onFechar}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}

/** Bloquear dias (férias, feriados): início, fim e motivo; depois diz quantas sessões foram canceladas. */
export function DialogoBloqueio({ aberta, onFechar, retornarFocoPara }: DialogoBloqueioProps) {
  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Bloquear dias" retornarFocoPara={retornarFocoPara}>
      <FormularioBloqueio onFechar={onFechar} />
    </Folha>
  );
}
