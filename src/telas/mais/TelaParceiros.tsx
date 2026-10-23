import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Botao } from '../../componentes/Botao';
import { DialogoConfirmacao } from '../../componentes/DialogoConfirmacao';
import { FalhaAoCarregar } from '../../componentes/FalhaAoCarregar';
import type { Rascunho } from '../../dados/repositorio';
import { useParceiros, useRemoverParceiro } from '../../dados/useParceiros';
import type { Parceiro } from '../../dominio/tipos';
import { FormularioParceiro } from './FormularioParceiro';
import { VoltarParaMais } from './VoltarParaMais';

const PARCEIRO_NOVO: Rascunho<Parceiro> = { nome: '', profissao: '', contato: '', observacoes: '' };

/** Médicos e psicólogos que encaminham pacientes: lista, cadastro, edição e remoção (com confirmação). */
export function TelaParceiros() {
  const parceiros = useParceiros();
  const remover = useRemoverParceiro();
  const [emEdicao, setEmEdicao] = useState<Rascunho<Parceiro> | null>(null);
  const [aRemover, setARemover] = useState<Parceiro | null>(null);

  function cancelarRemocao() {
    setARemover(null);
    remover.reset();
  }

  return (
    <section className="flex flex-col items-start gap-6">
      <VoltarParaMais />
      <h1 className="text-3xl">Parceiros</h1>

      {emEdicao ? (
        <FormularioParceiro inicial={emEdicao} aoSalvar={() => setEmEdicao(null)} aoCancelar={() => setEmEdicao(null)} />
      ) : (
        <>
          <Botao onClick={() => setEmEdicao(PARCEIRO_NOVO)}>
            <Plus aria-hidden="true" className="size-5" />
            Adicionar parceiro
          </Botao>
          {parceiros.isPending && <p role="status">Carregando…</p>}
          {parceiros.isError && (
            <FalhaAoCarregar mensagem="Não foi possível carregar os parceiros." aoTentarDeNovo={() => void parceiros.refetch()} />
          )}
          {parceiros.data?.length === 0 && <p>Nenhum parceiro cadastrado ainda.</p>}
          {parceiros.data && parceiros.data.length > 0 && (
            <ul className="flex w-full max-w-xl flex-col gap-3">
              {parceiros.data.map((parceiro) => (
                <li key={parceiro.id} className="flex flex-col gap-3 rounded-lg border-2 border-verde-claro bg-white p-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-lg font-semibold">{parceiro.nome}</p>
                    {parceiro.profissao && <p>{parceiro.profissao}</p>}
                    {parceiro.contato && <p>{parceiro.contato}</p>}
                    {parceiro.observacoes && <p className="text-sm">{parceiro.observacoes}</p>}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Botao variante="secundario" aria-label={`Editar ${parceiro.nome}`} onClick={() => setEmEdicao(parceiro)}>
                      <Pencil aria-hidden="true" className="size-5" />
                      Editar
                    </Botao>
                    <Botao variante="secundario" aria-label={`Remover ${parceiro.nome}`} onClick={() => setARemover(parceiro)}>
                      <Trash2 aria-hidden="true" className="size-5" />
                      Remover
                    </Botao>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {aRemover && (
        <DialogoConfirmacao
          titulo="Remover parceiro?"
          mensagem={`${aRemover.nome} sai da sua lista de parceiros. Os pacientes encaminhados por este parceiro ficam sem parceiro.`}
          rotuloConfirmar="Remover"
          ocupado={remover.isPending}
          erro={remover.isError ? 'Não foi possível remover. Tente de novo.' : undefined}
          aoConfirmar={() => remover.mutate(aRemover.id, { onSuccess: () => setARemover(null) })}
          aoCancelar={cancelarRemocao}
        />
      )}
    </section>
  );
}
