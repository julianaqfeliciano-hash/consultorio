import { Archive, Hourglass } from 'lucide-react';
import { useParams } from 'react-router';
import { EtiquetaTipo } from '../../componentes/EtiquetaTipo';
import { FalhaAoCarregar } from '../../componentes/FalhaAoCarregar';
import { useConfiguracoes } from '../../dados/useConfiguracoes';
import { useFicha, useSessoesDoPaciente } from '../../dados/useFicha';
import type { FichaPaciente as DadosDaFicha } from '../../dados/repositorio';
import { ROTULO_TIPO } from '../../dominio/rotulos';
import { sessaoAtualNaAvaliacao } from '../../regras/agenda';
import { formatarData } from '../../regras/datas';
import { SecaoAtendimento } from './SecaoAtendimento';
import { SecaoAvaliacao } from './SecaoAvaliacao';
import { SecaoCobranca } from './SecaoCobranca';
import { SecaoDados } from './SecaoDados';
import { SecaoHorarios } from './SecaoHorarios';
import { SecaoResponsaveis } from './SecaoResponsaveis';
import { SecaoSessoes } from './SecaoSessoes';
import { VoltarParaPacientes } from './VoltarParaPacientes';

/** Nome, tipo (com "sessão X de N" na avaliação) e situação do paciente. */
function Cabecalho({ ficha }: { ficha: DadosDaFicha }) {
  const { paciente, avaliacao } = ficha;
  const sessoes = useSessoesDoPaciente(paciente.id);
  // Só a avaliação em andamento conta: a antiga, de quem já passou para psicoterapia, fica de fora.
  const emAvaliacao = paciente.tipo === 'avaliacao' && avaliacao !== null;
  const textoDoTipo =
    emAvaliacao && sessoes.data
      ? `${ROTULO_TIPO.avaliacao} · sessão ${sessaoAtualNaAvaliacao(sessoes.data, avaliacao)} de ${avaliacao.sessoesPrevistas}`
      : undefined;

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl">{paciente.nome}</h1>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <EtiquetaTipo tipo={paciente.tipo} texto={textoDoTipo} />
        {paciente.status === 'lista_espera' && (
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <Hourglass aria-hidden="true" className="size-5 shrink-0" />
            Na lista de espera
          </span>
        )}
        {paciente.status === 'alta' && (
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <Archive aria-hidden="true" className="size-5 shrink-0" />
            {paciente.dataAlta ? `Alta em ${formatarData(paciente.dataAlta)}` : 'Alta'}
          </span>
        )}
      </p>
    </div>
  );
}

/**
 * A ficha do paciente, em seções que abrem e fecham (no celular, as de consulta rápida começam
 * abertas). Documentos e Financeiro chegam nos próximos planos.
 */
export function FichaPaciente() {
  const { id = '' } = useParams();
  const ficha = useFicha(id);
  // As configurações dão as sessões da avaliação, as semanas da agenda e a duração padrão: esperam-se antes dos formulários.
  const { carregando: carregandoConfiguracoes } = useConfiguracoes();

  if (ficha.data === undefined) {
    return (
      <section className="flex flex-col items-start gap-6">
        <VoltarParaPacientes />
        {ficha.isError ? (
          <FalhaAoCarregar mensagem="Não foi possível carregar a ficha." aoTentarDeNovo={() => void ficha.refetch()} />
        ) : (
          <p role="status">Carregando…</p>
        )}
      </section>
    );
  }
  if (ficha.data === null) {
    return (
      <section className="flex flex-col items-start gap-6">
        <VoltarParaPacientes />
        <p>Paciente não encontrado.</p>
      </section>
    );
  }
  if (carregandoConfiguracoes) {
    return (
      <section className="flex flex-col items-start gap-6">
        <VoltarParaPacientes />
        <p role="status">Carregando…</p>
      </section>
    );
  }

  const { paciente, responsaveis, horarios, avaliacao } = ficha.data;
  return (
    <article key={paciente.id} className="flex w-full max-w-3xl flex-col gap-6">
      <VoltarParaPacientes />
      <Cabecalho ficha={ficha.data} />
      <SecaoDados paciente={paciente} />
      <SecaoAtendimento paciente={paciente} />
      <SecaoCobranca paciente={paciente} />
      <SecaoResponsaveis pacienteId={paciente.id} responsaveis={responsaveis} />
      <SecaoHorarios pacienteId={paciente.id} status={paciente.status} horarios={horarios} />
      {paciente.tipo === 'avaliacao' && avaliacao && <SecaoAvaliacao avaliacao={avaliacao} />}
      <SecaoSessoes pacienteId={paciente.id} />
    </article>
  );
}
