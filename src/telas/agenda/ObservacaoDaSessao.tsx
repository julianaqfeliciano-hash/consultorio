import { useState } from 'react';
import { AreaDeTexto } from '../../componentes/AreaDeTexto';
import { Aviso } from '../../componentes/Aviso';
import { Botao } from '../../componentes/Botao';
import { useAtualizarSessao } from '../../dados/useAgenda';
import type { Sessao } from '../../dominio/tipos';

/** Anotação livre da sessão. Só grava ao tocar em "Salvar observação". */
export function ObservacaoDaSessao({ sessao }: { sessao: Sessao }) {
  const atualizar = useAtualizarSessao();
  const [texto, setTexto] = useState(sessao.observacao ?? '');
  const [salva, setSalva] = useState(false);

  function salvar() {
    const limpo = texto.trim();
    setSalva(false);
    atualizar.mutate(
      { id: sessao.id, mudancas: { observacao: limpo === '' ? null : limpo } },
      {
        onSuccess: () => {
          setTexto(limpo);
          setSalva(true);
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <AreaDeTexto
        rotulo="Observação"
        rows={3}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setSalva(false);
        }}
      />
      {salva && <Aviso tipo="sucesso">Observação salva.</Aviso>}
      {atualizar.isError && <Aviso tipo="erro">Não foi possível salvar a observação. Tente de novo.</Aviso>}
      <Botao variante="secundario" disabled={atualizar.isPending} onClick={salvar} className="self-start">
        {atualizar.isPending ? 'Salvando…' : 'Salvar observação'}
      </Botao>
    </div>
  );
}
