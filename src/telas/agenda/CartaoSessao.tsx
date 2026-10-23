import { BadgeCheck } from 'lucide-react';
import { ChipSituacao } from '../../componentes/ChipSituacao';
import { EtiquetaTipo } from '../../componentes/EtiquetaTipo';
import type { SessaoComPaciente } from '../../dados/repositorio';
import { CLASSE_FAIXA_TIPO, tipoVisual } from '../../dominio/rotulos';
import { horaLocal } from '../../regras/datas';
import { RotuloAvaliacao } from './RotuloAvaliacao';

interface CartaoSessaoProps {
  sessao: SessaoComPaciente;
  /** Recebe também o botão tocado, para o foco voltar a ele quando o painel fechar. */
  aoAbrir: (sessao: SessaoComPaciente, gatilho: HTMLElement) => void;
}

/**
 * A sessão na grade: hora, paciente, tipo (faixa lateral e rótulo), situação em texto e ícone,
 * "sessão X de N" em avaliação e o ícone de confirmado. Tocar abre o painel da sessão.
 */
export function CartaoSessao({ sessao, aoAbrir }: CartaoSessaoProps) {
  const tipo = tipoVisual(sessao);
  return (
    <button
      type="button"
      onClick={(evento) => aoAbrir(sessao, evento.currentTarget)}
      className={[
        // Nas colunas estreitas (768 px ou mais) a letra e as margens diminuem e palavras longas podem quebrar.
        'flex min-h-11 w-full flex-col items-start gap-1 rounded-lg border-l-8 bg-white p-2 text-left shadow-sm',
        'hyphens-auto wrap-anywhere md:border-l-4 md:p-1.5 md:text-sm',
        'hover:bg-verde-claro/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo',
        CLASSE_FAIXA_TIPO[tipo],
      ].join(' ')}
    >
      <span className="flex w-full flex-wrap items-center justify-between gap-x-2">
        <span className="text-lg font-bold">{horaLocal(sessao.inicio)}</span>
        {sessao.confirmada && (
          <span className="inline-flex items-center gap-1 text-sm font-semibold">
            <BadgeCheck aria-hidden="true" className="size-4 shrink-0" />
            Confirmada
          </span>
        )}
      </span>
      <span className="font-semibold">{sessao.pacienteNome}</span>
      <EtiquetaTipo tipo={tipo} />
      {sessao.tipo === 'avaliacao' && <RotuloAvaliacao sessao={sessao} />}
      {/* A situação não quebra no meio das palavras. */}
      <span className="hyphens-manual wrap-normal">
        <ChipSituacao situacao={sessao.situacao} />
      </span>
    </button>
  );
}
