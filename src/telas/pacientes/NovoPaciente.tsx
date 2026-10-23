import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Aviso } from '../../componentes/Aviso';
import { Botao } from '../../componentes/Botao';
import { CaixaDeMarcar } from '../../componentes/CaixaDeMarcar';
import { GrupoDeOpcoes } from '../../componentes/GrupoDeOpcoes';
import { LinkBotao } from '../../componentes/LinkBotao';
import { useConfiguracoes } from '../../dados/useConfiguracoes';
import { useCriarPaciente } from '../../dados/usePacientes';
import { ROTULO_TIPO } from '../../dominio/rotulos';
import type { TipoAtendimento } from '../../dominio/tipos';
import { hojeISO } from '../../regras/datas';
import {
  DADOS_EM_BRANCO,
  validarCobranca,
  validarDados,
  type ErrosDados,
  type ValoresCobranca,
  type ValoresDados,
} from '../../regras/formularios';
import { CamposCobranca, CamposDados, SelecaoParceiro } from './CamposDoPaciente';
import { VoltarParaPacientes } from './VoltarParaPacientes';

const TIPOS: { valor: TipoAtendimento; rotulo: string }[] = [
  { valor: 'avaliacao', rotulo: ROTULO_TIPO.avaliacao },
  { valor: 'psicoterapia', rotulo: ROTULO_TIPO.psicoterapia },
];

type Erros = ErrosDados & { tipo?: string; valor?: string };

/** Cadastro de paciente novo. Salvando, abre a ficha dele para acrescentar responsáveis e horários. */
export function NovoPaciente() {
  const navigate = useNavigate();
  const { carregando } = useConfiguracoes();
  const criar = useCriarPaciente();
  const [dados, setDados] = useState<ValoresDados>(DADOS_EM_BRANCO);
  const [tipo, setTipo] = useState<TipoAtendimento | ''>('');
  const [listaDeEspera, setListaDeEspera] = useState(false);
  const [parceiroId, setParceiroId] = useState('');
  const [cobranca, setCobranca] = useState<ValoresCobranca>({ forma: 'por_sessao', valor: '' });
  const [erros, setErros] = useState<Erros>({});

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const lidoDados = validarDados(dados, hojeISO());
    const lidaCobranca = validarCobranca(cobranca);
    setErros({ ...lidoDados.erros, ...lidaCobranca.erros, ...(tipo === '' ? { tipo: 'Escolha o tipo de atendimento.' } : {}) });
    if (lidoDados.dados === null || lidaCobranca.dados === null || tipo === '') return;

    criar.mutate(
      {
        ...lidoDados.dados,
        ...lidaCobranca.dados,
        tipo,
        status: listaDeEspera ? 'lista_espera' : 'ativo',
        // A data de entrada é preenchida sozinha na primeira sessão a que o paciente comparece.
        dataEntrada: null,
        dataAlta: null,
        parceiroId: parceiroId || null,
      },
      { onSuccess: (criado) => navigate(`/pacientes/${criado.id}`, { replace: true }) },
    );
  }

  return (
    <section className="flex flex-col items-start gap-6">
      <VoltarParaPacientes />
      <h1 className="text-3xl">Novo paciente</h1>

      {carregando ? (
        <p role="status">Carregando…</p>
      ) : (
        <form noValidate onSubmit={aoEnviar} className="flex w-full max-w-xl flex-col gap-4">
          <CamposDados valores={dados} erros={erros} aoMudar={(m) => setDados((v) => ({ ...v, ...m }))} />
          <GrupoDeOpcoes
            legenda="Tipo de atendimento"
            opcoes={TIPOS}
            valor={tipo}
            aoMudar={setTipo}
            erro={erros.tipo}
          />
          <CaixaDeMarcar
            rotulo="Colocar na lista de espera"
            ajuda="Quem está na lista de espera ainda não entra na agenda."
            checked={listaDeEspera}
            onChange={(e) => setListaDeEspera(e.target.checked)}
          />
          <SelecaoParceiro valor={parceiroId} aoMudar={setParceiroId} />
          <CamposCobranca valores={cobranca} erros={erros} aoMudar={(m) => setCobranca((v) => ({ ...v, ...m }))} />
          {criar.isError && <Aviso tipo="erro">Não foi possível salvar. Tente de novo.</Aviso>}
          <div className="flex flex-wrap gap-3">
            <Botao type="submit" disabled={criar.isPending}>
              {criar.isPending ? 'Salvando…' : 'Salvar paciente'}
            </Botao>
            <LinkBotao to="/pacientes" variante="secundario">
              Cancelar
            </LinkBotao>
          </div>
        </form>
      )}
    </section>
  );
}
