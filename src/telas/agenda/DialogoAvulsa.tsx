import { useState, type FormEvent, type RefObject } from 'react';
import { Aviso } from '../../componentes/Aviso';
import { Botao } from '../../componentes/Botao';
import { CaixaDeMarcar } from '../../componentes/CaixaDeMarcar';
import { Campo } from '../../componentes/Campo';
import { Folha } from '../../componentes/Folha';
import { Selecao } from '../../componentes/Selecao';
import { useConfiguracoes } from '../../dados/useConfiguracoes';
import { useCriarAvulsa } from '../../dados/useAgenda';
import { usePacientes } from '../../dados/usePacientes';
import type { DataISO, Sessao } from '../../dominio/tipos';
import { validarAvulsa, type ErrosAvulsa, type ValoresAvulsa } from '../../regras/formulariosAgenda';

interface DialogoAvulsaProps {
  aberta: boolean;
  onFechar: () => void;
  retornarFocoPara: RefObject<HTMLElement | null>;
  /** Data que o campo já traz (o dia que a agenda está mostrando). */
  dataInicial: DataISO;
  /** A sessão foi criada; quem usa fecha a folha e mostra o dia dela. */
  aoCriar: (sessao: Sessao) => void;
}

function FormularioAvulsa({ dataInicial, onFechar, aoCriar }: Omit<DialogoAvulsaProps, 'aberta' | 'retornarFocoPara'>) {
  const { config } = useConfiguracoes();
  const pacientes = usePacientes();
  const criar = useCriarAvulsa();
  const [valores, setValores] = useState<ValoresAvulsa>({
    pacienteId: '',
    data: dataInicial,
    hora: '',
    duracao: String(config.duracaoPadraoMin),
    acompanhamentoFamiliar: false,
  });
  const [erros, setErros] = useState<ErrosAvulsa>({});

  // Só quem está em atendimento recebe sessão marcada: lista de espera e alta ficam de fora.
  const ativos = (pacientes.data ?? []).filter((p) => p.status === 'ativo');
  const alterar = (mudanca: Partial<ValoresAvulsa>) => setValores((v) => ({ ...v, ...mudanca }));

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const lido = validarAvulsa(valores);
    setErros(lido.erros);
    if (lido.dados === null) return;
    criar.mutate(lido.dados, { onSuccess: aoCriar });
  }

  return (
    <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-4">
      <Selecao
        rotulo="Paciente"
        value={valores.pacienteId}
        onChange={(e) => alterar({ pacienteId: e.target.value })}
        erro={erros.pacienteId}
        ajuda={pacientes.isError ? 'Não foi possível carregar os pacientes.' : undefined}
      >
        <option value="">Escolha o paciente</option>
        {ativos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </Selecao>
      <Campo rotulo="Data" type="date" value={valores.data} onChange={(e) => alterar({ data: e.target.value })} erro={erros.data} />
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
      <CaixaDeMarcar
        rotulo="Acompanhamento familiar"
        ajuda="Sessão com os responsáveis."
        checked={valores.acompanhamentoFamiliar}
        onChange={(e) => alterar({ acompanhamentoFamiliar: e.target.checked })}
      />
      {criar.isError && <Aviso tipo="erro">Não foi possível criar a sessão. Tente de novo.</Aviso>}
      <div className="flex flex-wrap gap-3">
        <Botao type="submit" disabled={criar.isPending}>
          {criar.isPending ? 'Criando…' : 'Criar sessão'}
        </Botao>
        <Botao variante="secundario" disabled={criar.isPending} onClick={onFechar}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}

/** Sessão avulsa (fora do horário fixo): paciente, data, hora, duração (a padrão das configurações) e acompanhamento familiar. */
export function DialogoAvulsa({ aberta, onFechar, retornarFocoPara, dataInicial, aoCriar }: DialogoAvulsaProps) {
  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Nova sessão avulsa" retornarFocoPara={retornarFocoPara}>
      <FormularioAvulsa dataInicial={dataInicial} onFechar={onFechar} aoCriar={aoCriar} />
    </Folha>
  );
}
