import { CircleAlert, TriangleAlert } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { Botao } from './Botao';

interface DialogoConfirmacaoProps {
  titulo: string;
  mensagem: string;
  /** Linha de alerta depois da mensagem (ex.: "Atenção: são 45 dias."), em destaque. */
  aviso?: string;
  /** Texto do botão que confirma, no verbo da ação ("Remover"). */
  rotuloConfirmar: string;
  aoConfirmar: () => void;
  aoCancelar: () => void;
  /** Enquanto a ação roda, os dois botões ficam desligados e Esc não fecha. */
  ocupado?: boolean;
  /** Aviso de que a ação falhou; o diálogo continua aberto para tentar de novo. */
  erro?: string;
}

/**
 * Pergunta de confirmação por cima da tela (no lugar de `window.confirm`). O foco começa
 * em "Cancelar", o lado seguro; Tab fica preso no diálogo; Esc e o clique fora cancelam;
 * ao fechar, o foco volta a quem o abriu. Mostre-o só enquanto a pergunta valer.
 */
export function DialogoConfirmacao({
  titulo,
  mensagem,
  aviso,
  rotuloConfirmar,
  aoConfirmar,
  aoCancelar,
  ocupado = false,
  erro,
}: DialogoConfirmacaoProps) {
  const idTitulo = useId();
  const idMensagem = useId();
  const idAviso = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const botaoCancelar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const quemAbriu = document.activeElement;
    botaoCancelar.current?.focus();
    return () => {
      if (quemAbriu instanceof HTMLElement && quemAbriu.isConnected) quemAbriu.focus();
    };
  }, []);

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        if (!ocupado) aoCancelar();
        return;
      }
      if (evento.key !== 'Tab' || !caixa.current) return;
      const botoes = [...caixa.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const primeiro = botoes[0];
      const ultimo = botoes[botoes.length - 1];
      const dentro = caixa.current.contains(document.activeElement);
      if (!primeiro) {
        evento.preventDefault();
      } else if (!dentro || (evento.shiftKey && document.activeElement === primeiro)) {
        evento.preventDefault();
        (evento.shiftKey ? ultimo : primeiro).focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [ocupado, aoCancelar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-petroleo/50 p-4"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget && !ocupado) aoCancelar();
      }}
    >
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={aviso ? `${idMensagem} ${idAviso}` : idMensagem}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-creme p-6 shadow-xl"
      >
        <h2 id={idTitulo} className="text-xl">
          {titulo}
        </h2>
        <p id={idMensagem}>{mensagem}</p>
        {aviso && (
          <p id={idAviso} className="flex items-start gap-2 font-semibold">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            {aviso}
          </p>
        )}
        {erro && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-amarelo/30 p-3 font-semibold">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            {erro}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Botao ref={botaoCancelar} variante="secundario" disabled={ocupado} onClick={aoCancelar}>
            Cancelar
          </Botao>
          <Botao disabled={ocupado} onClick={aoConfirmar}>
            {rotuloConfirmar}
          </Botao>
        </div>
      </div>
    </div>
  );
}
