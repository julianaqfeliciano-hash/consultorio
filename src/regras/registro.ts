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

const APOSTROFOS = /[’‘'`´]/g;

function palavras(nome: string): string[] {
  return normalizarParaBusca(nome.replace(APOSTROFOS, ' '))
    .split(' ')
    .filter((p) => p !== '');
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? '';
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Palavras que ligam as partes do nome; sozinhas, não são trocadas. */
const CONECTORES = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

/**
 * Forma canônica de uma variante (já sem acentos e em minúsculas), em que as grafias trocáveis ficam iguais:
 * th→t, ph→f, y→i, z→s e letra dobrada (ll, ss, nn, tt, mm, rr) → uma só. É a chave de quem usa a variante.
 */
function formaCanonica(variante: string): string {
  return variante
    .replace(/th/g, 't')
    .replace(/ph/g, 'f')
    .replace(/y/g, 'i')
    .replace(/z/g, 's')
    .replace(/([lsntmr])\1+/g, '$1');
}

/** Expressão que acha a variante canônica no texto sem acentos, aceitando cada grafia trocável. */
function regexTolerante(canonica: string): string {
  let r = '';
  for (const ch of canonica) {
    if (ch === ' ') r += '\\s+';
    else if (ch === 's') r += '[sz]{1,2}';
    else if (ch === 'i') r += '[iy]';
    else if (ch === 't') r += 't{1,2}h?';
    else if (ch === 'f') r += '(?:f|ph)';
    else if ('lnmr'.includes(ch)) r += `${ch}{1,2}`;
    else r += escaparRegex(ch);
  }
  return r;
}

/** Versão do texto sem acentos e em minúsculas, com o índice de cada letra no texto original. */
function normalizarComIndices(texto: string): { norm: string; origem: number[] } {
  let norm = '';
  const origem: number[] = [];
  let i = 0;
  for (const ch of texto) {
    const parte = ch.replace(APOSTROFOS, ' ').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    for (let k = 0; k < parte.length; k++) origem.push(i);
    norm += parte;
    i += ch.length;
  }
  return { norm, origem };
}

/** Troca os nomes do paciente e dos responsáveis por [P], [R1], [R2]… (e [F] para o que for da família). */
export function anonimizar(texto: string, pessoas: Pessoas): TextoAnonimo {
  const mapa: Record<string, string> = { '[F]': 'família' };
  const nomes: { chave: string; nome: string }[] = [
    { chave: 'P', nome: pessoas.paciente },
    ...pessoas.responsaveis.map((nome, i) => ({ chave: `R${i + 1}`, nome })),
  ];

  // variante (forma canônica) → quem a usa
  const donos = new Map<string, Set<string>>();
  for (const { chave, nome } of nomes) {
    if (nome.trim() === '') continue;
    mapa[`[${chave}]`] = primeiroNome(nome);
    const ps = palavras(nome);
    if (ps.length === 0) continue;
    const variantes = new Set<string>([ps.join(' ')]);
    for (let a = 0; a < ps.length; a++) {
      for (let b = a + 1; b <= ps.length; b++) {
        const seq = ps.slice(a, b);
        // Uma palavra sozinha vale, de qualquer tamanho, menos os conectores e as iniciais de 1 letra.
        if (seq.length > 1 || (seq[0]!.length > 1 && !CONECTORES.has(seq[0]!))) variantes.add(seq.join(' '));
      }
    }
    for (const v of variantes) {
      const canonica = formaCanonica(v);
      const set = donos.get(canonica) ?? new Set<string>();
      set.add(chave);
      donos.set(canonica, set);
    }
  }

  const protegido = texto.replace(MARCADOR_PRONTO, (m) => `(${m.slice(1, -1)})`);
  if (donos.size === 0) return { texto: protegido, mapa };

  // A mais longa primeiro; cada variante no seu grupo, para saber de quem é o trecho achado.
  const ordenadas = [...donos.keys()].sort((x, y) => y.length - x.length);
  const grupos = ordenadas.map((v) => `(${regexTolerante(v)})`);
  const regex = new RegExp(`(?<!\\p{L})(?:${grupos.join('|')})(?!\\p{L})`, 'gu');

  // A busca corre sobre o texto sem acentos; `origem` leva cada trecho achado de volta ao texto original.
  const { norm, origem } = normalizarComIndices(protegido);
  let saida = '';
  let cursor = 0;
  for (const m of norm.matchAll(regex)) {
    const ini = m.index;
    const fim = ini + m[0].length;
    const iniOrig = origem[ini]!;
    // fim original: início do próximo caractere depois do trecho (ou o fim do texto)
    const fimOrig = fim < origem.length ? origem[fim]! : protegido.length;
    const grupo = m.slice(1).findIndex((g) => g !== undefined);
    const chaves = donos.get(ordenadas[grupo]!);
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
