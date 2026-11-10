import type { CamposRegistro } from '../dominio/tipos';
import { normalizarParaBusca } from './texto';

export interface Pessoas {
  paciente: string;
  responsaveis: string[];
}

export interface TextoAnonimo {
  texto: string;
  /** marcador (com colchetes) → texto para devolver */
  mapa: Record<string, string>;
}

const MARCADOR_PRONTO = /\[(?:P|F|R\d+)\]/g;

function palavras(nome: string): string[] {
  return normalizarParaBusca(nome)
    .split(' ')
    .filter((p) => p !== '');
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? '';
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Versão do texto sem acentos e em minúsculas, com o índice de cada letra no texto original. */
function normalizarComIndices(texto: string): { norm: string; origem: number[] } {
  let norm = '';
  const origem: number[] = [];
  let i = 0;
  for (const ch of texto) {
    const parte = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    for (let k = 0; k < parte.length; k++) origem.push(i);
    norm += parte;
    i += ch.length;
  }
  return { norm, origem };
}

/** Troca os nomes do paciente e dos responsáveis por [P], [R1], [R2]… (e [F] para o que for da família). */
export function anonimizar(texto: string, pessoas: Pessoas): TextoAnonimo {
  const mapa: Record<string, string> = { '[F]': 'a família' };
  const nomes: { chave: string; nome: string }[] = [
    { chave: 'P', nome: pessoas.paciente },
    ...pessoas.responsaveis.map((nome, i) => ({ chave: `R${i + 1}`, nome })),
  ];

  // variante (normalizada) → quem a usa
  const donos = new Map<string, Set<string>>();
  for (const { chave, nome } of nomes) {
    if (nome.trim() === '') continue;
    mapa[`[${chave}]`] = primeiroNome(nome);
    const ps = palavras(nome);
    const variantes = new Set<string>();
    for (let a = 0; a < ps.length; a++) {
      for (let b = a + 1; b <= ps.length; b++) {
        const seq = ps.slice(a, b);
        if (seq.length > 1 || seq[0]!.length >= 3) variantes.add(seq.join(' '));
      }
    }
    for (const v of variantes) {
      const set = donos.get(v) ?? new Set<string>();
      set.add(chave);
      donos.set(v, set);
    }
  }

  const protegido = texto.replace(MARCADOR_PRONTO, (m) => `(${m.slice(1, -1)})`);
  if (donos.size === 0) return { texto: protegido, mapa };

  const ordenadas = [...donos.keys()].sort((x, y) => y.length - x.length);
  const alternativas = ordenadas.map((v) => v.split(' ').map(escaparRegex).join('\\s+'));
  const regex = new RegExp(`(?<!\\p{L})(?:${alternativas.join('|')})(?!\\p{L})`, 'gu');

  const { norm, origem } = normalizarComIndices(protegido);
  let saida = '';
  let cursor = 0;
  for (const m of norm.matchAll(regex)) {
    const ini = m.index;
    const fim = ini + m[0].length;
    const iniOrig = origem[ini]!;
    // fim original: início do próximo caractere depois do trecho (ou o fim do texto)
    const fimOrig = fim < origem.length ? origem[fim]! : protegido.length;
    const chaves = donos.get(m[0].replace(/\s+/g, ' '));
    const marcador = !chaves || chaves.size > 1 ? '[F]' : `[${[...chaves][0]}]`;
    saida += protegido.slice(cursor, iniOrig) + marcador;
    cursor = fimOrig;
  }
  return { texto: saida + protegido.slice(cursor), mapa };
}

/** Devolve os nomes nos quatro campos. Marcador que não está no mapa fica como está. */
export function restaurar(campos: CamposRegistro, mapa: Record<string, string>): CamposRegistro {
  const volta = (t: string): string => t.replace(MARCADOR_PRONTO, (m) => (Object.hasOwn(mapa, m) ? mapa[m]! : m));
  return {
    comoChegou: volta(campos.comoChegou),
    trabalhado: volta(campos.trabalhado),
    observacoes: volta(campos.observacoes),
    proximosPassos: volta(campos.proximosPassos),
  };
}

/** Os quatro campos em branco (ou só com espaços). */
export function registroVazio(c: CamposRegistro): boolean {
  return [c.comoChegou, c.trabalhado, c.observacoes, c.proximosPassos].every((t) => t.trim() === '');
}
