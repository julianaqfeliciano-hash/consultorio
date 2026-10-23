import { CircleAlert } from 'lucide-react';
import { Botao } from './Botao';

interface FalhaAoCarregarProps {
  mensagem: string;
  aoTentarDeNovo: () => void;
}

/** Aviso de que uma lista ou tela não carregou, com o botão para tentar de novo. */
export function FalhaAoCarregar({ mensagem, aoTentarDeNovo }: FalhaAoCarregarProps) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p role="alert" className="flex items-start gap-2 rounded-lg bg-amarelo/30 p-3 font-semibold">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        {mensagem}
      </p>
      <Botao variante="secundario" onClick={aoTentarDeNovo}>
        Tentar de novo
      </Botao>
    </div>
  );
}
