import { Navigate, Outlet, useLocation } from 'react-router';
import { useAutenticacao } from '../dados/contexto-autenticacao';
import { Logo } from './Logo';

/**
 * Rota-mãe das telas internas: só deixa passar quem está logada. Quem não está vai para
 * `/entrar`, levando no estado da navegação a tela que pediu (`de`) para voltar a ela depois.
 */
export function ExigeLogin() {
  const { usuario, carregando } = useAutenticacao();
  const local = useLocation();

  // Ainda conferindo se há sessão guardada: mandar para o login agora faria a usuária logada "piscar" nele.
  if (carregando) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4">
        <Logo variante="completa" />
        <p role="status">Carregando…</p>
      </div>
    );
  }
  if (!usuario) {
    return <Navigate to="/entrar" replace state={{ de: `${local.pathname}${local.search}${local.hash}` }} />;
  }
  return <Outlet />;
}
