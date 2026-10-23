import { useState, type FormEvent } from 'react';
import { Aviso } from '../../componentes/Aviso';
import { Botao } from '../../componentes/Botao';
import { Campo } from '../../componentes/Campo';
import { Selecao } from '../../componentes/Selecao';
import { useConfiguracoes } from '../../dados/useConfiguracoes';
import { useAdicionarHorario, useMudarHorario } from '../../dados/useFicha';
import { ROTULO_DIA_SEMANA } from '../../dominio/rotulos';
import type { HorarioFixo, Id } from '../../dominio/tipos';
import { hojeISO } from '../../regras/datas';
import { validarHorario, type ErrosHorario, type ValoresHorario } from '../../regras/formularios';

/** Segunda a sábado, depois domingo: a semana de quem atende. */
const ORDEM_DOS_DIAS = [1, 2, 3, 4, 5, 6, 0];

interface Props {
  pacienteId: Id;
  /** Horário a trocar. Sem ele, o formulário cria um horário novo, válido desde hoje. */
  horario?: HorarioFixo;
  aoConcluir: () => void;
  aoCancelar: () => void;
}

/**
 * Formulário de horário fixo (dia da semana, hora e duração). Para um horário que já existe,
 * pergunta "A partir de quando?" e troca por um novo a partir dessa data.
 */
export function FormularioHorario({ pacienteId, horario, aoConcluir, aoCancelar }: Props) {
  const { config } = useConfiguracoes();
  const adicionar = useAdicionarHorario(pacienteId);
  const mudar = useMudarHorario(pacienteId);
  const operacao = horario ? mudar : adicionar;
  const [valores, setValores] = useState<ValoresHorario>(() =>
    horario
      ? { diaSemana: String(horario.diaSemana), hora: horario.hora, duracao: String(horario.duracaoMin) }
      : { diaSemana: '', hora: '', duracao: String(config.duracaoPadraoMin) },
  );
  const [aPartirDe, setAPartirDe] = useState(() => hojeISO());
  const [erros, setErros] = useState<ErrosHorario & { aPartirDe?: string }>({});
  const [semMudanca, setSemMudanca] = useState(false);

  function alterar(mudanca: Partial<ValoresHorario>) {
    setValores((v) => ({ ...v, ...mudanca }));
    setSemMudanca(false);
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const lido = validarHorario(valores);
    const avisoDaData = horario && aPartirDe === '' ? 'Informe a partir de quando vale o novo horário.' : undefined;
    setErros({ ...lido.erros, ...(avisoDaData ? { aPartirDe: avisoDaData } : {}) });
    setSemMudanca(false);
    if (lido.dados === null || avisoDaData) return;

    if (!horario) {
      adicionar.mutate(lido.dados, { onSuccess: aoConcluir });
      return;
    }
    if (
      lido.dados.diaSemana === horario.diaSemana &&
      lido.dados.hora === horario.hora &&
      lido.dados.duracaoMin === horario.duracaoMin
    ) {
      setSemMudanca(true);
      return;
    }
    mudar.mutate({ horario, novo: lido.dados, aPartirDe }, { onSuccess: aoConcluir });
  }

  return (
    <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-4">
      {horario && (
        <Campo
          rotulo="A partir de quando?"
          ajuda="O novo horário vale desta data em diante. O que já aconteceu não muda."
          type="date"
          value={aPartirDe}
          onChange={(e) => {
            setAPartirDe(e.target.value);
            setSemMudanca(false);
          }}
          erro={erros.aPartirDe}
        />
      )}
      <Selecao
        rotulo="Dia da semana"
        value={valores.diaSemana}
        onChange={(e) => alterar({ diaSemana: e.target.value })}
        erro={erros.diaSemana}
      >
        <option value="">Escolha o dia</option>
        {ORDEM_DOS_DIAS.map((dia) => (
          <option key={dia} value={dia}>
            {ROTULO_DIA_SEMANA[dia]}
          </option>
        ))}
      </Selecao>
      <Campo rotulo="Hora" type="time" value={valores.hora} onChange={(e) => alterar({ hora: e.target.value })} erro={erros.hora} />
      <Campo
        rotulo="Duração (min)"
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        value={valores.duracao}
        onChange={(e) => alterar({ duracao: e.target.value })}
        erro={erros.duracao}
      />
      {semMudanca && <Aviso tipo="erro">Nada mudou no horário.</Aviso>}
      {operacao.isError && (
        <Aviso tipo="erro">{horario ? 'Não foi possível mudar o horário. Tente de novo.' : 'Não foi possível salvar. Tente de novo.'}</Aviso>
      )}
      <div className="flex flex-wrap gap-3">
        <Botao type="submit" disabled={operacao.isPending}>
          {operacao.isPending ? 'Salvando…' : horario ? 'Aplicar mudança' : 'Salvar horário'}
        </Botao>
        <Botao variante="secundario" disabled={operacao.isPending} onClick={aoCancelar}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}
