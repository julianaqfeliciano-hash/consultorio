import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Autenticacao, Usuario } from './autenticacao';

interface ValorAutenticacao {
  /** Quem está logada; `null` se ninguém (ou ainda não se sabe: veja `carregando`). */
  usuario: Usuario | null;
  /** `true` enquanto se confere se já existe uma sessão guardada. Não redirecione para o login nesse intervalo. */
  carregando: boolean;
  /** Modo demonstração (sem Supabase): dados fictícios, sempre logada, sem "Sair". */
  modoDemonstracao: boolean;
  entrar(email: string, senha: string): Promise<void>;
  sair(): Promise<void>;
}

interface Estado {
  usuario: Usuario | null;
  carregando: boolean;
}

const ContextoAutenticacao = createContext<ValorAutenticacao | null>(null);

function estadoInicial(autenticacao: Autenticacao): Estado {
  const { usuarioInicial } = autenticacao;
  return usuarioInicial === undefined ? { usuario: null, carregando: true } : { usuario: usuarioInicial, carregando: false };
}

/** Mantém o estado anterior (sem re-renderizar) quando nada mudou, p.ex. a cada renovação do token. */
function proximoEstado(anterior: Estado, usuario: Usuario | null): Estado {
  const igual = anterior.usuario?.id === usuario?.id && anterior.usuario?.email === usuario?.email;
  return !anterior.carregando && igual ? anterior : { usuario, carregando: false };
}

interface Props {
  autenticacao: Autenticacao;
  /** Só informa a interface (faixa amarela, sem "Sair"); quem fica sempre logada é `criarAutenticacaoDemo()`. */
  modoDemonstracao?: boolean;
  children: ReactNode;
}

/** Entrega a sessão atual (quem está logada) a toda a interface e acompanha entradas e saídas. */
export function AutenticacaoProvider({ autenticacao, modoDemonstracao = false, children }: Props) {
  const [estado, setEstado] = useState<Estado>(() => estadoInicial(autenticacao));

  useEffect(() => {
    let ativo = true;
    // Se `aoMudar` já avisou, esse aviso é mais novo que a resposta (atrasada) de `usuarioAtual`.
    let jaMudou = false;
    const definir = (usuario: Usuario | null) => {
      if (ativo) setEstado((anterior) => proximoEstado(anterior, usuario));
    };

    autenticacao.usuarioAtual().then(
      (usuario) => {
        if (!jaMudou) definir(usuario);
      },
      // Não conseguir descobrir a sessão é o mesmo que não ter sessão: pede o login.
      () => {
        if (!jaMudou) definir(null);
      },
    );
    const cancelar = autenticacao.aoMudar((usuario) => {
      jaMudou = true;
      definir(usuario);
    });

    return () => {
      ativo = false;
      cancelar();
    };
  }, [autenticacao]);

  const valor = useMemo<ValorAutenticacao>(
    () => ({
      usuario: estado.usuario,
      carregando: estado.carregando,
      modoDemonstracao,
      entrar: (email, senha) => autenticacao.entrar(email, senha),
      sair: () => autenticacao.sair(),
    }),
    [estado, modoDemonstracao, autenticacao],
  );

  return <ContextoAutenticacao.Provider value={valor}>{children}</ContextoAutenticacao.Provider>;
}

// O contexto, o provedor e o hook andam juntos; recarregar a página ao editar este arquivo é aceitável.
// eslint-disable-next-line react-refresh/only-export-components
export function useAutenticacao(): ValorAutenticacao {
  const valor = useContext(ContextoAutenticacao);
  if (valor === null) {
    throw new Error('useAutenticacao precisa ser usado dentro de <AutenticacaoProvider>.');
  }
  return valor;
}
