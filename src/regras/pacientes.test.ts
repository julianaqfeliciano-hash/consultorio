import { describe, expect, it } from 'vitest';
import { pacienteExemplo } from '../testes/fabricas';
import { agruparPacientes, GRUPOS_DE_PACIENTES, grupoDoPaciente } from './pacientes';

const ana = pacienteExemplo({ id: 'ana', nome: 'Ana Clara Souza' });
const pedro = pacienteExemplo({ id: 'pedro', nome: 'Pedro Henrique Lima', tipo: 'avaliacao' });
const maria = pacienteExemplo({ id: 'maria', nome: 'Maria Luísa Costa' });
const lucas = pacienteExemplo({ id: 'lucas', nome: 'Lucas Oliveira', status: 'lista_espera' });
const bia = pacienteExemplo({ id: 'bia', nome: 'Beatriz Alves', status: 'alta', tipo: 'avaliacao' });
const todos = [ana, bia, lucas, maria, pedro];

describe('grupoDoPaciente', () => {
  it('alta e lista de espera vêm antes do tipo; os ativos vão pelo tipo', () => {
    expect(grupoDoPaciente(ana)).toBe('psicoterapia');
    expect(grupoDoPaciente(pedro)).toBe('avaliacao');
    expect(grupoDoPaciente(lucas)).toBe('espera');
    expect(grupoDoPaciente(bia)).toBe('alta');
  });
});

describe('agruparPacientes', () => {
  it('devolve os quatro grupos na ordem Em avaliação, Em psicoterapia, Lista de espera, Alta', () => {
    const grupos = agruparPacientes(todos, '');
    expect(grupos.map((g) => g.rotulo)).toEqual(['Em avaliação', 'Em psicoterapia', 'Lista de espera', 'Alta']);
    expect(GRUPOS_DE_PACIENTES.map((g) => g.rotulo)).toEqual(grupos.map((g) => g.rotulo));
    expect(grupos.map((g) => g.pacientes.map((p) => p.id))).toEqual([['pedro'], ['ana', 'maria'], ['lucas'], ['bia']]);
  });

  it('mantém grupos vazios (com zero pacientes)', () => {
    const grupos = agruparPacientes([ana], '');
    expect(grupos.map((g) => g.pacientes.length)).toEqual([0, 1, 0, 0]);
  });

  it('a busca ignora maiúsculas e acentos, nos dois lados', () => {
    expect(agruparPacientes(todos, 'ana').flatMap((g) => g.pacientes.map((p) => p.id))).toEqual(['ana']);
    expect(agruparPacientes(todos, 'Ána').flatMap((g) => g.pacientes.map((p) => p.id))).toEqual(['ana']);
    expect(agruparPacientes(todos, 'LUISA').flatMap((g) => g.pacientes.map((p) => p.id))).toEqual(['maria']);
    expect(agruparPacientes(todos, 'luísa').flatMap((g) => g.pacientes.map((p) => p.id))).toEqual(['maria']);
  });

  it('acha o texto em qualquer parte do nome e ignora espaços nas pontas', () => {
    expect(agruparPacientes(todos, '  henrique ').flatMap((g) => g.pacientes.map((p) => p.id))).toEqual(['pedro']);
  });

  it('busca em branco mostra todos', () => {
    expect(agruparPacientes(todos, '   ').flatMap((g) => g.pacientes)).toHaveLength(5);
  });

  it('a contagem de cada grupo acompanha a busca', () => {
    // "ri": Henrique (Pedro), Maria e Beatriz.
    const grupos = agruparPacientes(todos, 'ri');
    expect(grupos.map((g) => g.pacientes.length)).toEqual([1, 1, 0, 1]);
  });
});
