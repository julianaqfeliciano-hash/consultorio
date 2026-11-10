import type { SupabaseClient } from '@supabase/supabase-js';
import type { CamposRegistro } from '../dominio/tipos';

/** Resume o texto ditado (já sem nomes) nos quatro campos do registro. */
export interface Resumidor {
  resumir(textoAnonimo: string): Promise<CamposRegistro>;
}

export type CodigoErroResumo = 'sem_internet' | 'sem_login' | 'texto_longo' | 'sem_chave' | 'recusa' | 'falha';

export class ErroResumo extends Error {
  readonly codigo: CodigoErroResumo;
  constructor(codigo: CodigoErroResumo, opcoes?: ErrorOptions) {
    super(codigo, opcoes);
    this.name = 'ErroResumo';
    this.codigo = codigo;
  }
}

export const MENSAGEM_DO_RESUMO: Record<CodigoErroResumo, string> = {
  sem_internet: 'Sem internet agora. O texto ficou guardado neste aparelho; tente de novo quando a conexão voltar.',
  sem_login: 'Sua entrada no sistema expirou. Saia e entre de novo para resumir.',
  texto_longo: 'O texto está longo demais para resumir de uma vez (máximo de 20.000 caracteres).',
  sem_chave: 'O resumo com o Claude ainda não foi ligado. Veja o passo 1.7 do guia de instalação.',
  recusa: 'O Claude não quis resumir este texto. Escreva o registro à mão ou ajuste o texto e tente de novo.',
  falha: 'O Claude não conseguiu resumir agora. O texto continua aqui; tente de novo.',
};

function nomeDe(erro: unknown): string | undefined {
  return typeof erro === 'object' && erro !== null ? (erro as { name?: string }).name : undefined;
}

function ehTexto(v: unknown): v is string {
  return typeof v === 'string';
}

/** Lê o `{ erro }` que a função devolve numa resposta não-2xx. */
async function codigoDaResposta(erro: { context?: unknown }): Promise<string | undefined> {
  try {
    const resposta = erro.context as Response;
    const corpo: unknown = await resposta.json();
    const codigo = (corpo as { erro?: unknown } | null)?.erro;
    return ehTexto(codigo) ? codigo : undefined;
  } catch {
    return undefined;
  }
}

async function traduzir(erro: unknown): Promise<ErroResumo> {
  if (erro instanceof ErroResumo) return erro;
  if (erro instanceof TypeError || nomeDe(erro) === 'FunctionsFetchError') {
    return new ErroResumo('sem_internet', { cause: erro });
  }
  if (nomeDe(erro) === 'FunctionsHttpError') {
    switch (await codigoDaResposta(erro as { context?: unknown })) {
      case 'nao_autorizado':
        return new ErroResumo('sem_login', { cause: erro });
      case 'texto_longo':
        return new ErroResumo('texto_longo', { cause: erro });
      case 'sem_chave':
        return new ErroResumo('sem_chave', { cause: erro });
      case 'recusa':
        return new ErroResumo('recusa', { cause: erro });
    }
  }
  return new ErroResumo('falha', { cause: erro });
}

function comoCampos(dados: unknown): CamposRegistro | null {
  if (typeof dados !== 'object' || dados === null) return null;
  const d = dados as Record<string, unknown>;
  if (!ehTexto(d.comoChegou) || !ehTexto(d.trabalhado) || !ehTexto(d.observacoes) || !ehTexto(d.proximosPassos)) {
    return null;
  }
  return { comoChegou: d.comoChegou, trabalhado: d.trabalhado, observacoes: d.observacoes, proximosPassos: d.proximosPassos };
}

/** Chama a Edge Function `resumir-sessao` (Supabase) com a sessão de quem está logada. */
export function criarResumidorSupabase(cliente: SupabaseClient): Resumidor {
  return {
    async resumir(textoAnonimo) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new ErroResumo('sem_internet');
      try {
        const { data, error } = await cliente.functions.invoke('resumir-sessao', { body: { texto: textoAnonimo } });
        if (error) throw error;
        const campos = comoCampos(data);
        if (!campos) throw new ErroResumo('falha');
        return campos;
      } catch (erro) {
        throw await traduzir(erro);
      }
    },
  };
}

/** Demonstração (sem Supabase): devolve um resumo fictício depois de um instante. */
export const resumidorDemonstracao: Resumidor = {
  async resumir() {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      comoChegou: '(demonstração) [P] chegou tranquilo e animado.',
      trabalhado: '(demonstração) Brincadeira de faz de conta com [P], para falar de sentimentos.',
      observacoes: '(demonstração) [P] participou do começo ao fim.',
      proximosPassos: '(demonstração) Retomar a brincadeira na próxima sessão com [P].',
    };
  },
};
