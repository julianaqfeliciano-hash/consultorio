import { ChevronDown } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

interface SecaoRecolhivelProps {
  titulo: string;
  /**
   * No celular (menos de 768 px) a seção começa aberta? De 768 px em diante ela sempre começa aberta.
   * O que se abre ou fecha depois fica por conta de quem toca no título.
   */
  abertaNoCelular?: boolean;
  children: ReactNode;
}

function comecaAberta(abertaNoCelular: boolean): boolean {
  if (abertaNoCelular) return true;
  // Sem `matchMedia` (testes, navegadores muito antigos) vale a tela grande: tudo aberto.
  return typeof window.matchMedia !== 'function' || window.matchMedia('(min-width: 768px)').matches;
}

/**
 * Seção com título que abre e fecha. O conteúdo fechado continua montado (só escondido), então
 * o que foi digitado nos campos não se perde ao fechar.
 */
export function SecaoRecolhivel({ titulo, abertaNoCelular = false, children }: SecaoRecolhivelProps) {
  const idTitulo = useId();
  const idConteudo = useId();
  const [aberta, setAberta] = useState(() => comecaAberta(abertaNoCelular));

  return (
    <section aria-labelledby={idTitulo} className="rounded-lg border-2 border-verde-claro bg-white">
      <h2 id={idTitulo} className="text-xl">
        <button
          type="button"
          aria-expanded={aberta}
          aria-controls={idConteudo}
          onClick={() => setAberta((a) => !a)}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg px-4 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo"
        >
          {titulo}
          <ChevronDown aria-hidden="true" className={`size-6 shrink-0 transition-transform ${aberta ? 'rotate-180' : ''}`} />
        </button>
      </h2>
      <div id={idConteudo} hidden={!aberta} className="flex flex-col gap-4 px-4 pb-4">
        {children}
      </div>
    </section>
  );
}
