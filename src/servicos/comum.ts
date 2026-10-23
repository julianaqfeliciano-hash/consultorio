import type { FichaPaciente, Repositorio } from '../dados/repositorio';
import type { Id } from '../dominio/tipos';

/** A ficha do paciente, ou erro quando ele não existe. */
export async function exigirFicha(repo: Repositorio, pacienteId: Id): Promise<FichaPaciente> {
  const ficha = await repo.obterFicha(pacienteId);
  if (ficha === null) throw new Error(`Paciente não encontrado: ${pacienteId}`);
  return ficha;
}
