import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { Botao } from '../../componentes/Botao';
import { traduzirErroDeAutenticacao } from '../../dados/autenticacao';
import { useAutenticacao } from '../../dados/contexto-autenticacao';

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
