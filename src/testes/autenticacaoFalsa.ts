import { ErroAutenticacao, type Autenticacao, type Usuario } from '../dados/autenticacao';

export const USUARIA_DE_TESTE: Usuario = { id: 'u-1', email: 'juliana@consultorio.test' };

export const CREDENCIAIS_DE_TESTE = { email: 'juliana@consultorio.test', senha: 'senha-certa' };

interface OpcoesAutenticacaoFalsa {
  /** Quem já está logada quando o aplicativo abre (padrão: ninguém). */
  usuario?: Usuario | null;
  /** O único par que `entrar` aceita; qualquer outro vira "E-mail ou senha incorretos.". */
  credenciais?: { email: string; senha: string };
}

/**
 * `Autenticacao` falsa para os testes de tela. Comporta-se como a de verdade: `entrar` e
 * `sair` avisam quem assina `aoMudar`. Os métodos são `vi.fn`, então o teste confere as chamadas.
 */
export function criarAutenticacaoFalsa({ usuario = null, credenciais = CREDENCIAIS_DE_TESTE }: OpcoesAutenticacaoFalsa = {}) {
  let atual: Usuario | null = usuario;
  const ouvintes = new Set<(u: Usuario | null) => void>();
  const mudarPara = (u: Usuario | null) => {
    atual = u;
    ouvintes.forEach((ouvinte) => ouvinte(u));
  };

  return {
    usuarioAtual: vi.fn(async () => atual),
    entrar: vi.fn(async (email: string, senha: string) => {
      if (email !== credenciais.email || senha !== credenciais.senha) {
        throw new ErroAutenticacao('E-mail ou senha incorretos.');
      }
      mudarPara(USUARIA_DE_TESTE);
    }),
    sair: vi.fn(async () => {
      mudarPara(null);
    }),
    aoMudar: vi.fn((cb: (u: Usuario | null) => void) => {
      ouvintes.add(cb);
      return () => {
        ouvintes.delete(cb);
      };
    }),
  } satisfies Autenticacao;
}
