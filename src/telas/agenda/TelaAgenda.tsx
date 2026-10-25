import { CalendarOff, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { Aviso } from '../../componentes/Aviso';
import { Botao } from '../../componentes/Botao';
import { FalhaAoCarregar } from '../../componentes/FalhaAoCarregar';
import { Folha } from '../../componentes/Folha';
import { useTelaLarga } from '../../componentes/useTelaLarga';
import type { SessaoComPaciente } from '../../dados/repositorio';
import { useGarantirAgendaAoAbrir, useSessoes } from '../../dados/useAgenda';
import type { DataISO, Id } from '../../dominio/tipos';
import { dataLocal, hojeISO, inicioDaSemana, somarDias } from '../../regras/datas';
import { DialogoAvulsa } from './DialogoAvulsa';
import { DialogoBloqueio } from './DialogoBloqueio';
import { GradeSemana } from './GradeSemana';
import { ListaDoDia } from './ListaDoDia';
import { NavegacaoSemana } from './NavegacaoSemana';
import { PainelSessao } from './PainelSessao';

type Dialogo = 'avulsa' | 'bloqueio';

/**
 * A agenda: o aviso e a lista de amanhã, a semana (um dia por vez no celular, sete colunas a partir de 768 px),
 * o painel da sessão, a sessão avulsa e o bloqueio de dias. Ao abrir, completa as próximas semanas a partir dos horários fixos.
 */
export function TelaAgenda() {
  const telaLarga = useTelaLarga();
  // O dia em foco define a semana. No celular é o dia mostrado; trocar de semana mantém o dia da semana.
  const [dia, setDia] = useState<DataISO>(() => hojeISO());
  const inicioSemana = inicioDaSemana(dia);
  const sessoes = useSessoes(inicioSemana, somarDias(inicioSemana, 6));
  const agenda = useGarantirAgendaAoAbrir();

  const [idAberta, setIdAberta] = useState<Id | null>(null);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  // Quem abriu a folha (cartão ou botão), para o foco voltar a ele ao fechar.
  const gatilho = useRef<HTMLElement | null>(null);
  const sessaoAberta = sessoes.data?.find((s) => s.id === idAberta);

  function abrirSessao(sessao: SessaoComPaciente, botao: HTMLElement) {
    gatilho.current = botao;
    setIdAberta(sessao.id);
  }

  function abrirDialogo(qual: Dialogo, botao: HTMLElement) {
    gatilho.current = botao;
    setDialogo(qual);
  }

  const semDados =
    sessoes.isError ? (
      <FalhaAoCarregar mensagem="Não foi possível carregar a agenda." aoTentarDeNovo={() => void sessoes.refetch()} />
    ) : (
      <p role="status">Carregando a agenda…</p>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Agenda</h1>
        <div className="flex flex-wrap gap-3">
          <Botao variante="secundario" onClick={(e) => abrirDialogo('bloqueio', e.currentTarget)}>
            <CalendarOff aria-hidden="true" className="size-5" />
            Bloquear dias
          </Botao>
          <Botao onClick={(e) => abrirDialogo('avulsa', e.currentTarget)}>
            <Plus aria-hidden="true" className="size-5" />
            Sessão avulsa
          </Botao>
        </div>
      </div>

      <ListaDoDia agendaPronta={agenda.pronta} />

      {agenda.falhou && (
        <div className="flex flex-col items-start gap-3">
          <Aviso tipo="erro">Não foi possível completar a agenda das próximas semanas.</Aviso>
          <Botao variante="secundario" onClick={agenda.tentarDeNovo}>
            Completar agenda
          </Botao>
        </div>
      )}

      <NavegacaoSemana inicioSemana={inicioSemana} aoMudar={(semanas) => setDia(somarDias(dia, semanas * 7))} />
      <GradeSemana
        inicioSemana={inicioSemana}
        sessoes={sessoes.data}
        diaSelecionado={dia}
        telaLarga={telaLarga}
        semDados={semDados}
        aoEscolherDia={setDia}
        aoAbrirSessao={abrirSessao}
      />

      <Folha
        aberta={sessaoAberta !== undefined}
        onFechar={() => setIdAberta(null)}
        titulo={sessaoAberta?.pacienteNome ?? ''}
        retornarFocoPara={gatilho}
      >
        {sessaoAberta && <PainelSessao key={sessaoAberta.id} sessao={sessaoAberta} />}
      </Folha>
      <DialogoAvulsa
        aberta={dialogo === 'avulsa'}
        onFechar={() => setDialogo(null)}
        retornarFocoPara={gatilho}
        dataInicial={dia}
        aoCriar={(sessao) => {
          setDia(dataLocal(sessao.inicio));
          setDialogo(null);
        }}
      />
      <DialogoBloqueio aberta={dialogo === 'bloqueio'} onFechar={() => setDialogo(null)} retornarFocoPara={gatilho} />
    </div>
  );
}
