import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { Botao } from './Botao';

interface FolhaProps {
  aberta: boolean;
  onFechar: () => void;
  /** Nome do diálogo (também é o título que aparece no topo). */
  titulo: string;
  /**
   * Elemento que abriu a folha e que recebe o foco de volta ao fechar. Guarde-o numa ref quando a pessoa
   * tocar nele: depois de um clique do mouse no Safari o foco não vai para o botão, então `document.activeElement`
   * não serve. Sem isto, volta ao que tinha o foco na hora de abrir (se havia algum).
   */
  retornarFocoPara?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

const FOCAVEIS = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * Folha por cima da tela: painel que sobe da parte de baixo no celular (menos de 768 px) e painel lateral
 * à direita a partir de 768 px. É um diálogo modal: o foco entra nela ao abrir e fica preso até fechar
 * (Esc, o botão "Fechar" ou um toque no fundo), quando volta a quem abriu. Fechada, não monta nada.
 */
export function Folha({ aberta, onFechar, titulo, retornarFocoPara, children }: FolhaProps) {
  const idTitulo = useId();
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberta) return;
    const ativo = document.activeElement;
    const quemAbriu = retornarFocoPara?.current ?? (ativo instanceof HTMLElement && ativo !== document.body ? ativo : null);
    caixa.current?.focus();
    return () => {
      if (quemAbriu?.isConnected) quemAbriu.focus();
    };
  }, [aberta, retornarFocoPara]);

  useEffect(() => {
    if (!aberta) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        onFechar();
        return;
      }
      if (evento.key !== 'Tab' || !caixa.current) return;
      // Em ordem de tela (o jsdom dos testes agrupa os resultados por parte do seletor).
      const focaveis = [...caixa.current.querySelectorAll<HTMLElement>(FOCAVEIS)].sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      );
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const atual = document.activeElement;
      const dentro = caixa.current.contains(atual);
      if (!primeiro) {
        evento.preventDefault();
      } else if (!dentro || (evento.shiftKey && (atual === primeiro || atual === caixa.current))) {
        evento.preventDefault();
        (evento.shiftKey ? ultimo : primeiro).focus();
      } else if (!evento.shiftKey && atual === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberta, onFechar]);

  if (!aberta) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-petroleo/50"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onFechar();
      }}
    >
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className={[
          'absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col overflow-y-auto rounded-t-2xl bg-creme shadow-xl focus:outline-none',
          'md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[28rem] md:rounded-t-none md:rounded-l-2xl',
        ].join(' ')}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-verde-claro bg-creme p-4">
          <h2 id={idTitulo} className="text-2xl">
            {titulo}
          </h2>
          <Botao variante="secundario" onClick={onFechar}>
            <X aria-hidden="true" className="size-5" />
            Fechar
          </Botao>
        </header>
        <div className="flex flex-col gap-5 p-4 pb-8">{children}</div>
      </div>
    </div>
  );
}
