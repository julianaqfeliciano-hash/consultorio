import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';

/** Caminho de volta das telas de dentro de "Mais". */
export function VoltarParaMais() {
  return (
    <Link to="/mais" className="inline-flex min-h-11 items-center gap-2 font-semibold underline">
      <ArrowLeft aria-hidden="true" className="size-5" />
      Voltar para Mais
    </Link>
  );
}
