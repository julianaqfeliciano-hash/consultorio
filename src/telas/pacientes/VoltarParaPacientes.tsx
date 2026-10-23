import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';

/** Caminho de volta para a lista, no alto da ficha e do formulário de paciente novo. */
export function VoltarParaPacientes() {
  return (
    <Link to="/pacientes" className="inline-flex min-h-11 items-center gap-2 font-semibold underline">
      <ArrowLeft aria-hidden="true" className="size-5" />
      Voltar para Pacientes
    </Link>
  );
}
