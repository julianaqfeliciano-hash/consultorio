import { useState, type FormEvent } from 'react';
import { Aviso } from '../../componentes/Aviso';
import { Botao } from '../../componentes/Botao';
import { Campo } from '../../componentes/Campo';
import { DialogoConfirmacao } from '../../componentes/DialogoConfirmacao';
import { useDarAlta, useIniciarAtendimento, useMudarTipo } from '../../dados/useFicha';
import type { Paciente, TipoAtendimento } from '../../dominio/tipos';
import { formatarData, hojeISO } from '../../regras/datas';

const MINUSCULA: Record<TipoAtendimento, string> = { avaliacao: 'avaliação', psicoterapia: 'psicoterapia' };

const MENSAGEM_DO_TIPO: Record<TipoAtendimento, (nome: string) => string> = {
  psicoterapia: (nome) =>
    `${nome} passa para psicoterapia. As sessões que ainda estão agendadas passam a ser de psicoterapia; o que já aconteceu continua como avaliação, no histórico.`,
  avaliacao: (nome) =>
    `${nome} passa para uma avaliação nova. As sessões que ainda estão agendadas passam a contar nela; o que já aconteceu continua como está, no histórico.`,
};

/**
 * As mudanças de situação do paciente: iniciar o atendimento (quem está na lista de espera),
 * mudar entre avaliação e psicoterapia e dar alta. Cada uma pede confirmação num diálogo.
 * Quem já teve alta não tem ações.
 */
export function AcoesDoAtendimento({ paciente }: { paciente: Paciente }) {
  const mudarTipo = useMudarTipo(paciente.id);
  const iniciar = useIniciarAtendimento(paciente.id);
  const alta = useDarAlta(paciente.id);
  // O tipo para o qual a pergunta foi aberta. Fica guardado porque, se a troca falhar no meio, o paciente
  // já pode estar no tipo novo; a pergunta não pode virar "mudar de volta".
  const [tipoAConfirmar, setTipoAConfirmar] = useState<TipoAtendimento | null>(null);
  const [pedindoDataDaAlta, setPedindoDataDaAlta] = useState(false);
  const [dataDaAlta, setDataDaAlta] = useState('');
  const [avisoDaData, setAvisoDaData] = useState('');
  const [confirmandoAlta, setConfirmandoAlta] = useState(false);

  if (paciente.status === 'alta') {
    // A alta tem várias gravações: se falhou no meio, a data já está gravada (a ficha mostra a alta),
    // mas os horários e as sessões agendadas podem não ter sido atualizados.
    return alta.isError ? (
      <Aviso tipo="erro">A alta foi registrada, mas não foi possível atualizar os horários e as sessões agendadas. Confira a agenda.</Aviso>
    ) : null;
  }

  const novoTipo: TipoAtendimento = paciente.tipo === 'avaliacao' ? 'psicoterapia' : 'avaliacao';

  function abrirPedidoDeAlta() {
    setDataDaAlta(hojeISO());
    setAvisoDaData('');
    setPedindoDataDaAlta(true);
  }

  function continuarAlta(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (dataDaAlta === '') {
      setAvisoDaData('Informe a data da alta.');
      return;
    }
    setAvisoDaData('');
    setConfirmandoAlta(true);
  }

  function cancelarAlta() {
    setConfirmandoAlta(false);
    alta.reset();
  }

  return (
    <div className="flex flex-col items-start gap-4 border-t-2 border-verde-claro pt-4">
      {paciente.status === 'lista_espera' && (
        <>
          <p>Esta criança está esperando vaga. Ao iniciar o atendimento, as sessões dos horários fixos entram na agenda.</p>
          <Botao disabled={iniciar.isPending} onClick={() => iniciar.mutate(paciente)}>
            {iniciar.isPending ? 'Iniciando…' : 'Iniciar atendimento'}
          </Botao>
          {iniciar.isError && <Aviso tipo="erro">Não foi possível iniciar o atendimento. Tente de novo.</Aviso>}
        </>
      )}

      {paciente.status === 'ativo' && iniciar.isError && (
        <Aviso tipo="erro">
          O atendimento foi iniciado, mas não foi possível completar a agenda. Abra a agenda para completar as sessões.
        </Aviso>
      )}

      <Botao variante="secundario" onClick={() => setTipoAConfirmar(novoTipo)}>
        {`Mudar para ${MINUSCULA[novoTipo]}`}
      </Botao>

      {pedindoDataDaAlta ? (
        <form noValidate onSubmit={continuarAlta} className="flex w-full flex-col items-start gap-3">
          <Campo rotulo="Data da alta" type="date" value={dataDaAlta} onChange={(e) => setDataDaAlta(e.target.value)} erro={avisoDaData} />
          <div className="flex flex-wrap gap-3">
            <Botao type="submit">Continuar</Botao>
            <Botao variante="secundario" onClick={() => setPedindoDataDaAlta(false)}>
              Cancelar
            </Botao>
          </div>
        </form>
      ) : (
        <Botao variante="secundario" onClick={abrirPedidoDeAlta}>
          Dar alta
        </Botao>
      )}

      {tipoAConfirmar && (
        <DialogoConfirmacao
          titulo={`Mudar para ${MINUSCULA[tipoAConfirmar]}?`}
          mensagem={MENSAGEM_DO_TIPO[tipoAConfirmar](paciente.nome)}
          rotuloConfirmar="Mudar tipo"
          ocupado={mudarTipo.isPending}
          erro={mudarTipo.isError ? 'Não foi possível mudar o tipo. Tente de novo.' : undefined}
          aoConfirmar={() => mudarTipo.mutate(tipoAConfirmar, { onSuccess: () => setTipoAConfirmar(null) })}
          aoCancelar={() => {
            setTipoAConfirmar(null);
            mudarTipo.reset();
          }}
        />
      )}

      {confirmandoAlta && (
        <DialogoConfirmacao
          titulo="Dar alta?"
          mensagem={`${paciente.nome} recebe alta em ${formatarData(dataDaAlta)}. Os horários fixos terminam nessa data e as sessões ainda agendadas depois dela saem da agenda. O histórico fica guardado.`}
          rotuloConfirmar="Confirmar alta"
          ocupado={alta.isPending}
          erro={alta.isError ? 'Não foi possível dar alta. Tente de novo.' : undefined}
          aoConfirmar={() =>
            alta.mutate(dataDaAlta, {
              onSuccess: () => {
                setConfirmandoAlta(false);
                setPedindoDataDaAlta(false);
              },
            })
          }
          aoCancelar={cancelarAlta}
        />
      )}
    </div>
  );
}
