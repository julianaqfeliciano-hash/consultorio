import type { Paciente } from '../dominio/tipos';
import { normalizarParaBusca } from './texto';

export type GrupoPaciente = 'avaliacao' | 'psicoterapia' | 'espera' | 'alta';

/** Os grupos da lista de pacientes, na ordem em que aparecem. */
export const GRUPOS_DE_PACIENTES: readonly { id: GrupoPaciente; rotulo: string }[] = [
  { id: 'avaliacao', rotulo: 'Em avaliação' },
  { id: 'psicoterapia', rotulo: 'Em psicoterapia' },
  { id: 'espera', rotulo: 'Lista de espera' },
  { id: 'alta', rotulo: 'Alta' },
];

/** Alta e lista de espera valem mais que o tipo; quem está em atendimento vai pelo tipo. */
export function grupoDoPaciente(p: Paciente): GrupoPaciente {
  if (p.status === 'alta') return 'alta';
  if (p.status === 'lista_espera') return 'espera';
  return p.tipo === 'avaliacao' ? 'avaliacao' : 'psicoterapia';
}

export interface GrupoComPacientes {
  id: GrupoPaciente;
  rotulo: string;
  pacientes: Paciente[];
}

/**
 * Separa os pacientes (já em ordem alfabética) nos quatro grupos, só com os que casam com a busca
 * (parte do nome, sem diferenciar maiúsculas nem acentos). Grupos sem ninguém continuam na lista.
 */
export function agruparPacientes(pacientes: Paciente[], busca: string): GrupoComPacientes[] {
  const procurado = normalizarParaBusca(busca);
  const casam = pacientes.filter((p) => procurado === '' || normalizarParaBusca(p.nome).includes(procurado));
  return GRUPOS_DE_PACIENTES.map(({ id, rotulo }) => ({
    id,
    rotulo,
    pacientes: casam.filter((p) => grupoDoPaciente(p) === id),
  }));
}
