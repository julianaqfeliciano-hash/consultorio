import type { SupabaseClient } from '@supabase/supabase-js';

export type Usuario = { id: string; email: string };

/**
 * Quem entra, quem sai e quem está logada. A interface não conhece o Supabase:
 * em produção usa-se `criarAutenticacaoSupabase`; sem Supabase configurado e nos
 * testes, `criarAutenticacaoDemo` ou uma implementação falsa.
 */
export interface Autenticacao {
  /**
   * Preenchido só por quem já sabe, sem esperar, quem está logada (a demonstração).
   * Assim a interface não passa por "Carregando…". Ausente = é preciso perguntar a `usuarioAtual()`.
   */
  readonly usuarioInicial?: Usuario | null;
  /** Quem está logada agora (sessão guardada no aparelho), ou `null`. */
  usuarioAtual(): Promise<Usuario | null>;
  /** Falha com `ErroAutenticacao`, cuja mensagem já está em português, pronta para mostrar. */
  entrar(email: string, senha: string): Promise<void>;
  /** Falha com `ErroAutenticacao` (mensagem em português) se não conseguir encerrar a sessão. */
  sair(): Promise<void>;
  /** Avisa toda vez que alguém entra, sai ou a sessão acaba. Devolve a função que cancela o aviso. */
  aoMudar(cb: (u: Usuario | null) => void): () => void;
}

/** Erro de login/logout com mensagem em português para mostrar à usuária. O erro original fica em `cause`. */
export class ErroAutenticacao extends Error {
  constructor(mensagem: string, opcoes?: ErrorOptions) {
    super(mensagem, opcoes);
    this.name = 'ErroAutenticacao';
  }
}

const MENSAGEM_CREDENCIAIS_ERRADAS = 'E-mail ou senha incorretos.';
const MENSAGEM_SEM_CONEXAO = 'Sem conexão. Verifique a internet e tente de novo.';
const MENSAGEM_GENERICA = 'Algo deu errado. Tente de novo em instantes.';

function campo(erro: unknown, nome: 'name' | 'message' | 'code'): string | undefined {
  if (typeof erro !== 'object' || erro === null) return undefined;
  const valor = (erro as Record<string, unknown>)[nome];
  return typeof valor === 'string' ? valor : undefined;
}

function statusDe(erro: unknown): number | undefined {
  if (typeof erro !== 'object' || erro === null) return undefined;
  const status = (erro as Record<string, unknown>).status;
  return typeof status === 'number' ? status : undefined;
}

function ehCredencialInvalida(erro: unknown): boolean {
  if (campo(erro, 'code') === 'invalid_credentials') return true;
  // Servidores mais antigos respondem 400 sem `code`, só com a mensagem.
  return (
    campo(erro, 'code') === undefined &&
    statusDe(erro) === 400 &&
    /invalid login credentials/i.test(campo(erro, 'message') ?? '')
  );
}

function ehFalhaDeRede(erro: unknown): boolean {
  // `fetch` rejeita com TypeError quando não há rede; o Supabase embrulha isso em AuthRetryableFetchError.
  return erro instanceof TypeError || campo(erro, 'name') === 'AuthRetryableFetchError';
}

/**
 * Converte qualquer erro do Supabase (ou da rede) numa `ErroAutenticacao` com mensagem em português.
 * Reconhece os erros pelo formato (`name`, `status`, `code`), não pela classe, para não depender da biblioteca.
 */
export function traduzirErroDeAutenticacao(erro: unknown): ErroAutenticacao {
  if (erro instanceof ErroAutenticacao) return erro;
  if (ehCredencialInvalida(erro)) return new ErroAutenticacao(MENSAGEM_CREDENCIAIS_ERRADAS, { cause: erro });
  if (ehFalhaDeRede(erro)) return new ErroAutenticacao(MENSAGEM_SEM_CONEXAO, { cause: erro });
  return new ErroAutenticacao(MENSAGEM_GENERICA, { cause: erro });
}

type UsuarioDoSupabase = { id: string; email?: string } | null | undefined;

function paraUsuario(usuario: UsuarioDoSupabase): Usuario | null {
  return usuario ? { id: usuario.id, email: usuario.email ?? '' } : null;
}

/** Login por e-mail e senha no Supabase Auth. Use o MESMO cliente do repositório, para as consultas rodarem com a sessão. */
export function criarAutenticacaoSupabase(cliente: SupabaseClient): Autenticacao {
  return {
    async usuarioAtual() {
      const { data, error } = await cliente.auth.getSession();
      // Sem conseguir recuperar a sessão (ex.: sem rede para renová-la), por segurança vale "ninguém logada".
      if (error) return null;
      return paraUsuario(data.session?.user);
    },
    async entrar(email, senha) {
      try {
        // O Supabase devolve os erros de login em `error`; o que não for dele (ex.: falta de rede) é lançado.
        const { error } = await cliente.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      } catch (erro) {
        throw traduzirErroDeAutenticacao(erro);
      }
    },
    async sair() {
      try {
        const { error } = await cliente.auth.signOut();
        if (error) throw error;
      } catch (erro) {
        throw traduzirErroDeAutenticacao(erro);
      }
    },
    aoMudar(cb) {
      const {
        data: { subscription },
      } = cliente.auth.onAuthStateChange((_evento, sessao) => cb(paraUsuario(sessao?.user)));
      return () => subscription.unsubscribe();
    },
  };
}

export const USUARIO_DEMO: Usuario = { id: 'demo', email: 'demonstracao@consultorio' };

/** Modo demonstração: sempre logada, sem tela de login. Entrar e sair não fazem nada. */
export function criarAutenticacaoDemo(): Autenticacao {
  return {
    usuarioInicial: USUARIO_DEMO,
    usuarioAtual: async () => USUARIO_DEMO,
    entrar: async () => {},
    sair: async () => {},
    aoMudar: () => () => {},
  };
}
