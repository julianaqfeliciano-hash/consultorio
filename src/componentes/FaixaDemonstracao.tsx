import { useAutenticacao } from '../dados/contexto-autenticacao';

/** Faixa amarela no topo de todas as telas do modo demonstração. Fora dele não aparece. */
export function FaixaDemonstracao() {
  const { modoDemonstracao } = useAutenticacao();
  if (!modoDemonstracao) return null;
  return (
    <p className="bg-amarelo px-4 py-2 text-center text-sm font-semibold text-petroleo">
      Modo demonstração — os dados são fictícios e não são salvos.
    </p>
  );
}
