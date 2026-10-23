import { CircleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Botao } from '../../componentes/Botao';
import { Campo } from '../../componentes/Campo';
import { Logo } from '../../componentes/Logo';
import { traduzirErroDeAutenticacao } from '../../dados/autenticacao';
import { useAutenticacao } from '../../dados/contexto-autenticacao';

const DESTINO_PADRAO = '/agenda';

/** A tela que a usuária pediu antes de ser barrada (guardada por `ExigeLogin`). Só aceita caminhos internos. */
function destinoDepoisDoLogin(estado: unknown): string {
  const de = typeof estado === 'object' && estado !== null ? (estado as { de?: unknown }).de : undefined;
  const interno = typeof de === 'string' && de.startsWith('/') && !de.startsWith('//');
  return interno && !de.startsWith('/entrar') ? de : DESTINO_PADRAO;
}

export function TelaLogin() {
  const { usuario, entrar } = useAutenticacao();
  const local = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [avisos, setAvisos] = useState<{ email?: string; senha?: string }>({});
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const destino = destinoDepoisDoLogin(local.state);
  // Já logada (abriu /entrar com sessão guardada, ou acabou de entrar): segue para onde ia.
  if (usuario) return <Navigate to={destino} replace />;

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;
    const emailLimpo = email.trim();
    const novosAvisos = {
      email: emailLimpo === '' ? 'Digite seu e-mail.' : undefined,
      senha: senha === '' ? 'Digite sua senha.' : undefined,
    };
    setAvisos(novosAvisos);
    setErro('');
    if (novosAvisos.email || novosAvisos.senha) return;

    setEnviando(true);
    try {
      // Deu certo: `AutenticacaoProvider` avisa a mudança e o `Navigate` acima leva ao destino.
      await entrar(emailLimpo, senha);
    } catch (falha) {
      setErro(traduzirErroDeAutenticacao(falha).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-8">
      <div className="flex justify-center">
        <Logo variante="completa" />
      </div>
      <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-4">
        <h1 className="text-2xl">Acesso ao sistema</h1>
        <Campo
          rotulo="E-mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          erro={avisos.email}
        />
        <Campo
          rotulo="Senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          erro={avisos.senha}
        />
        {erro && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-amarelo/30 p-3 font-semibold">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            {erro}
          </p>
        )}
        <Botao type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </Botao>
      </form>
    </main>
  );
}
