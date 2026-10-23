import { ChevronRight, Handshake, LogOut, Settings, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Botao } from '../../componentes/Botao';
import { traduzirErroDeAutenticacao } from '../../dados/autenticacao';
import { useAutenticacao } from '../../dados/contexto-autenticacao';

const ATALHOS: { para: string; rotulo: string; Icone: LucideIcon }[] = [
  { para: '/mais/parceiros', rotulo: 'Parceiros', Icone: Handshake },
  { para: '/mais/configuracoes', rotulo: 'Configurações', Icone: Settings },
];

export function TelaMais() {
  const { sair, modoDemonstracao } = useAutenticacao();
  const [erro, setErro] = useState('');

  async function aoSair() {
    setErro('');
    try {
      // Deu certo: `AutenticacaoProvider` avisa a mudança e `ExigeLogin` leva para /entrar.
      await sair();
    } catch (falha) {
      setErro(traduzirErroDeAutenticacao(falha).message);
    }
  }

  return (
    <section className="flex flex-col items-start gap-6">
      <h1 className="text-3xl">Mais</h1>
      <ul className="flex w-full max-w-md flex-col gap-3">
        {ATALHOS.map(({ para, rotulo, Icone }) => (
          <li key={para}>
            <Link
              to={para}
              className="flex min-h-14 items-center gap-3 rounded-lg border-2 border-verde-claro bg-white px-4 py-3 font-semibold hover:bg-verde-claro/50"
            >
              <Icone aria-hidden="true" className="size-6 shrink-0" />
              <span className="flex-1">{rotulo}</span>
              <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
      {/* Na demonstração ela está sempre logada: "Sair" não teria efeito algum. */}
      {!modoDemonstracao && (
        <Botao variante="secundario" onClick={aoSair}>
          <LogOut aria-hidden="true" className="size-5" />
          Sair
        </Botao>
      )}
      {erro && (
        <p role="alert" className="font-semibold">
          {erro}
        </p>
      )}
    </section>
  );
}
