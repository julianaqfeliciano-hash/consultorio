import { CircleAlert } from 'lucide-react';
import { useId, type ReactNode } from 'react';

interface GrupoDeOpcoesProps<V extends string> {
  /** Pergunta do grupo, sempre visível. */
  legenda: string;
  opcoes: readonly { valor: V; rotulo: string }[];
  /** Valor escolhido, ou '' enquanto nada foi escolhido. */
  valor: V | '';
  aoMudar: (valor: V) => void;
  /** Dica fixa sob a legenda. */
  ajuda?: ReactNode;
  /** Aviso de que falta escolher: aparece com ícone e texto. */
  erro?: string;
}

/** Escolha de uma opção entre poucas (botões de rádio com área de toque de 44 px). */
export function GrupoDeOpcoes<V extends string>({ legenda, opcoes, valor, aoMudar, ajuda, erro }: GrupoDeOpcoesProps<V>) {
  const id = useId();
  const idAjuda = `${id}-ajuda`;
  const idErro = `${id}-erro`;
  const descricao = [ajuda ? idAjuda : '', erro ? idErro : ''].filter(Boolean).join(' ');

  return (
    <fieldset aria-describedby={descricao || undefined} className="flex flex-col gap-1">
      <legend className="font-semibold">{legenda}</legend>
      {ajuda && (
        <p id={idAjuda} className="text-sm">
          {ajuda}
        </p>
      )}
      <div className="flex flex-wrap gap-x-6">
        {opcoes.map((opcao) => (
          <label key={opcao.valor} className="flex min-h-11 cursor-pointer items-center gap-2">
            <input
              type="radio"
              name={id}
              value={opcao.valor}
              checked={valor === opcao.valor}
              onChange={() => aoMudar(opcao.valor)}
              className="size-5 accent-petroleo"
            />
            {opcao.rotulo}
          </label>
        ))}
      </div>
      {erro && (
        <p id={idErro} role="alert" className="flex items-start gap-2 text-sm font-semibold">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </fieldset>
  );
}
