import { Undo2 } from 'lucide-react';
import { Aviso } from '../../componentes/Aviso';
import { Botao } from '../../componentes/Botao';
import { CaixaDeMarcar } from '../../componentes/CaixaDeMarcar';
import { ChipSituacao } from '../../componentes/ChipSituacao';
import { EtiquetaTipo } from '../../componentes/EtiquetaTipo';
import type { SessaoComPaciente } from '../../dados/repositorio';
import { useAtualizarSessao, useMarcarSituacao } from '../../dados/useAgenda';
import { ICONE_SITUACAO, tipoVisual } from '../../dominio/rotulos';
import type { SituacaoSessao } from '../../dominio/tipos';
import { ehCobravel } from '../../regras/agenda';
import { dataLocal, diaPorExtenso, horaLocal } from '../../regras/datas';
import { DestinoDaRemarcacao } from './DestinoDaRemarcacao';
import { ObservacaoDaSessao } from './ObservacaoDaSessao';
import { RemarcarSessao } from './RemarcarSessao';
import { RotuloAvaliacao } from './RotuloAvaliacao';

type SituacaoEscolhivel = Exclude<SituacaoSessao, 'remarcada'>;

const BOTOES_DE_SITUACAO: readonly { situacao: SituacaoEscolhivel; rotulo: string }[] = [
  { situacao: 'compareceu', rotulo: 'Compareceu' },
  { situacao: 'falta_com_aviso', rotulo: 'Faltou com aviso' },
  { situacao: 'falta_sem_aviso', rotulo: 'Faltou sem aviso' },
  { situacao: 'cancelada', rotulo: 'Cancelar sessão' },
];

/**
 * O que se faz com uma sessão: dizer o que aconteceu, remarcar (só a que não é cobrada), marcar como
 * acompanhamento familiar e anotar.
 * O título (nome do paciente) fica por conta da `Folha` que o envolve. A sessão vem de quem o usa e é
 * atualizada por lá a cada mudança.
 */
export function PainelSessao({ sessao }: { sessao: SessaoComPaciente }) {
  const marcar = useMarcarSituacao();
  const familiar = useAtualizarSessao();
  const tipo = tipoVisual(sessao);
  const remarcada = sessao.situacao === 'remarcada';
  // Sessão já cobrada (compareceu, faltou sem aviso) não é remarcada: viraria "remarcada" e perderia a cobrança.
  const podeRemarcar = !remarcada && !ehCobravel(sessao.situacao);
  // Enquanto grava, a caixa já mostra a escolha (a sessão só muda quando os dados novos chegam).
  const acompanhamentoFamiliar = familiar.isPending
    ? (familiar.variables.mudancas.acompanhamentoFamiliar ?? sessao.acompanhamentoFamiliar)
    : sessao.acompanhamentoFamiliar;

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-lg font-semibold">
          {`${diaPorExtenso(dataLocal(sessao.inicio))} · ${horaLocal(sessao.inicio)} · ${sessao.duracaoMin} min`}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <EtiquetaTipo tipo={tipo} />
          {sessao.tipo === 'avaliacao' && <RotuloAvaliacao sessao={sessao} />}
          <ChipSituacao situacao={sessao.situacao} />
        </div>
      </div>

      {remarcada ? (
        <DestinoDaRemarcacao sessao={sessao} />
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-lg">Situação</legend>
          <div className="grid grid-cols-2 gap-2">
            {BOTOES_DE_SITUACAO.map(({ situacao, rotulo }) => {
              const Icone = ICONE_SITUACAO[situacao];
              return (
                <Botao
                  key={situacao}
                  variante={sessao.situacao === situacao ? 'primario' : 'secundario'}
                  aria-pressed={sessao.situacao === situacao}
                  // Sem `disabled`: o botão tocado não pode perder o foco enquanto grava.
                  aria-disabled={marcar.isPending || undefined}
                  onClick={() => {
                    if (!marcar.isPending) marcar.mutate({ sessao, situacao });
                  }}
                >
                  <Icone aria-hidden="true" className="size-5 shrink-0" />
                  {rotulo}
                </Botao>
              );
            })}
          </div>
          {sessao.situacao !== 'agendada' && (
            // Para desfazer uma marcação feita por engano (a sessão ainda não aconteceu, por exemplo).
            <Botao
              variante="secundario"
              aria-disabled={marcar.isPending || undefined}
              onClick={() => {
                if (!marcar.isPending) marcar.mutate({ sessao, situacao: 'agendada' });
              }}
              className="self-start"
            >
              <Undo2 aria-hidden="true" className="size-5 shrink-0" />
              Voltar para Agendada
            </Botao>
          )}
          {marcar.isError && <Aviso tipo="erro">Não foi possível salvar. Tente de novo.</Aviso>}
        </fieldset>
      )}

      {podeRemarcar && <RemarcarSessao sessao={sessao} />}

      <div className="flex flex-col gap-2">
        <CaixaDeMarcar
          rotulo="Acompanhamento familiar"
          ajuda="Sessão com os responsáveis. Conta e é cobrada como uma sessão normal."
          checked={acompanhamentoFamiliar}
          onChange={(e) => {
            if (!familiar.isPending) familiar.mutate({ id: sessao.id, mudancas: { acompanhamentoFamiliar: e.target.checked } });
          }}
        />
        {familiar.isError && <Aviso tipo="erro">Não foi possível salvar. Tente de novo.</Aviso>}
      </div>

      <ObservacaoDaSessao sessao={sessao} />
    </>
  );
}
