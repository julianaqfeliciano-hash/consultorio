import { ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Botao } from '../../componentes/Botao';
import { FalhaAoCarregar } from '../../componentes/FalhaAoCarregar';
import { Folha } from '../../componentes/Folha';
import type { SessaoComPaciente } from '../../dados/repositorio';
import { useSessoes } from '../../dados/useAgenda';
import { useConfiguracoes } from '../../dados/useConfiguracoes';
import type { DataISO } from '../../dominio/tipos';
import { diaPorExtenso, hojeISO, somarDias } from '../../regras/datas';
import { LinhaDaLista } from './LinhaDaLista';

/** "1 paciente", "3 pacientes" ou "nenhum paciente". */
function textoDePacientes(n: number): string {
  if (n === 0) return 'nenhum paciente';
  return n === 1 ? '1 paciente' : `${n} pacientes`;
}

/** Só as que ainda estão agendadas, por horário (a lista é para confirmar o que vai acontecer). */
function agendadasPorHorario(sessoes: SessaoComPaciente[] | undefined): SessaoComPaciente[] {
  return (sessoes ?? [])
    .filter((s) => s.situacao === 'agendada')
    .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
}

const CAIXA_DO_AVISO = 'flex min-h-11 w-full items-center gap-2 rounded-lg bg-verde-claro/60 px-4 py-2 text-lg font-semibold';

interface ListaDoDiaProps {
  /** A agenda das próximas semanas já foi completada: antes disso a contagem de amanhã pode estar incompleta. */
  agendaPronta: boolean;
}

/**
 * O aviso "Amanhã: N pacientes" do topo da agenda e a lista do dia que ele abre numa folha: hora, paciente,
 * responsável, telefone, WhatsApp e "Confirmado". Setas mudam o dia da lista; ela sempre abre em amanhã.
 */
export function ListaDoDia({ agendaPronta }: ListaDoDiaProps) {
  const amanha = somarDias(hojeISO(), 1);
  const sessoes = useSessoes(amanha, amanha);
  // O dia da lista aberta; null com a folha fechada.
  const [dia, setDia] = useState<DataISO | null>(null);
  // O aviso que abriu a folha, para o foco voltar a ele ao fechar.
  const gatilho = useRef<HTMLElement | null>(null);

  let aviso;
  if (!agendaPronta || sessoes.isPending) {
    aviso = (
      <p role="status" className={CAIXA_DO_AVISO}>
        Amanhã: carregando…
      </p>
    );
  } else if (sessoes.isError) {
    aviso = (
      <FalhaAoCarregar
        mensagem="Não foi possível carregar a lista de amanhã."
        aoTentarDeNovo={() => void sessoes.refetch()}
      />
    );
  } else {
    aviso = (
      <button
        type="button"
        onClick={(evento) => {
          gatilho.current = evento.currentTarget;
          setDia(amanha);
        }}
        className={`${CAIXA_DO_AVISO} justify-between text-left hover:bg-verde-claro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo`}
      >
        <span className="flex items-center gap-2">
          <MessageCircle aria-hidden="true" className="size-5 shrink-0" />
          {`Amanhã: ${textoDePacientes(agendadasPorHorario(sessoes.data).length)}`}
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
      </button>
    );
  }

  return (
    <>
      {aviso}
      <Folha
        aberta={dia !== null}
        onFechar={() => setDia(null)}
        titulo={dia === null ? '' : dia === amanha ? `Amanhã, ${diaPorExtenso(dia)}` : diaPorExtenso(dia)}
        tituloEmTexto
        retornarFocoPara={gatilho}
      >
        {dia !== null && <SessoesDoDia dia={dia} aoMudarDia={setDia} />}
      </Folha>
    </>
  );
}

/** As setas e as sessões agendadas de um dia. Quem a usa mantém o título (o dia) na folha. */
function SessoesDoDia({ dia, aoMudarDia }: { dia: DataISO; aoMudarDia: (dia: DataISO) => void }) {
  const sessoes = useSessoes(dia, dia);
  const { config } = useConfiguracoes();
  const agendadas = useMemo(() => agendadasPorHorario(sessoes.data), [sessoes.data]);
  const contagem = textoDePacientes(agendadas.length);

  let conteudo;
  if (sessoes.isError) {
    conteudo = (
      <FalhaAoCarregar mensagem="Não foi possível carregar a lista." aoTentarDeNovo={() => void sessoes.refetch()} />
    );
  } else if (sessoes.isPending) {
    conteudo = <p role="status">Carregando a lista…</p>;
  } else if (agendadas.length === 0) {
    conteudo = <p>Nenhuma sessão agendada neste dia.</p>;
  } else {
    conteudo = (
      <ul className="flex flex-col gap-3">
        {agendadas.map((sessao) => (
          <LinhaDaLista key={sessao.id} sessao={sessao} modelo={config.mensagemWhatsapp} />
        ))}
      </ul>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Botao variante="secundario" aria-label="Dia anterior" onClick={() => aoMudarDia(somarDias(dia, -1))}>
          <ChevronLeft aria-hidden="true" className="size-6" />
        </Botao>
        {/* O dia vai junto no texto para a leitura de tela anunciar a troca, mesmo que a contagem não mude. */}
        <p aria-live="polite" aria-atomic="true" className="text-center text-lg font-bold">
          <span className="sr-only">{`${diaPorExtenso(dia)}: `}</span>
          {sessoes.isSuccess && contagem.charAt(0).toUpperCase() + contagem.slice(1)}
        </p>
        <Botao variante="secundario" aria-label="Próximo dia" onClick={() => aoMudarDia(somarDias(dia, 1))}>
          <ChevronRight aria-hidden="true" className="size-6" />
        </Botao>
      </div>
      {conteudo}
    </>
  );
}
