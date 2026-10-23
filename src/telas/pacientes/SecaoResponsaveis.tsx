import { Pencil, Plus, Star, Trash2, Wallet, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Aviso } from '../../componentes/Aviso';
import { Botao } from '../../componentes/Botao';
import { DialogoConfirmacao } from '../../componentes/DialogoConfirmacao';
import { SecaoRecolhivel } from '../../componentes/SecaoRecolhivel';
import type { Rascunho } from '../../dados/repositorio';
import { useRemoverResponsavel, useSalvarResponsavel } from '../../dados/useFicha';
import type { Id, Responsavel } from '../../dominio/tipos';
import { FormularioResponsavel } from './FormularioResponsavel';

interface Props {
  pacienteId: Id;
  /** O principal vem primeiro. */
  responsaveis: Responsavel[];
}

function Selo({ icone: Icone, texto }: { icone: LucideIcon; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border-2 border-verde bg-verde-claro px-2.5 py-0.5 text-sm font-semibold">
      <Icone aria-hidden="true" className="size-4 shrink-0" />
      {texto}
    </span>
  );
}

/** Responsáveis da criança: o principal (recebe a confirmação) e o pagador (vai no recibo) ficam à vista. */
export function SecaoResponsaveis({ pacienteId, responsaveis }: Props) {
  const [emEdicao, setEmEdicao] = useState<Rascunho<Responsavel> | null>(null);
  const [aRemover, setARemover] = useState<Responsavel | null>(null);
  const remover = useRemoverResponsavel(pacienteId);
  const tornarPrincipal = useSalvarResponsavel(pacienteId);

  // O primeiro responsável cadastrado já nasce como principal e pagador.
  const primeiro = responsaveis.length === 0;
  const novo: Rascunho<Responsavel> = {
    pacienteId,
    nome: '',
    parentesco: '',
    cpf: null,
    telefone: '',
    email: null,
    principal: primeiro,
    pagador: primeiro,
  };

  function cancelarRemocao() {
    setARemover(null);
    remover.reset();
  }

  const outrosResponsaveis = aRemover ? responsaveis.filter((r) => r.id !== aRemover.id).length > 0 : false;
  const avisoDoPrincipal =
    aRemover?.principal && outrosResponsaveis ? ' Escolha outro responsável principal depois, para ele receber a confirmação das sessões.' : '';

  return (
    <SecaoRecolhivel titulo="Responsáveis" abertaNoCelular>
      {emEdicao ? (
        <FormularioResponsavel inicial={emEdicao} aoSalvar={() => setEmEdicao(null)} aoCancelar={() => setEmEdicao(null)} />
      ) : (
        <>
          {responsaveis.length === 0 && <p>Nenhum responsável cadastrado ainda.</p>}
          {responsaveis.length > 0 && (
            <ul className="flex flex-col gap-3">
              {responsaveis.map((r) => (
                <li key={r.id} className="flex flex-col gap-3 rounded-lg border-2 border-verde-claro p-4">
                  <div className="flex flex-col gap-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <strong className="text-lg">{r.nome}</strong>
                      {r.parentesco && <span>{r.parentesco}</span>}
                    </p>
                    {(r.principal || r.pagador) && (
                      <p className="flex flex-wrap gap-2">
                        {r.principal && <Selo icone={Star} texto="Principal" />}
                        {r.pagador && <Selo icone={Wallet} texto="Pagador" />}
                      </p>
                    )}
                    <p>{r.telefone || 'Sem telefone'}</p>
                    {r.email && <p>{r.email}</p>}
                    {r.cpf && <p>CPF {r.cpf}</p>}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Botao variante="secundario" aria-label={`Editar ${r.nome}`} onClick={() => setEmEdicao(r)}>
                      <Pencil aria-hidden="true" className="size-5" />
                      Editar
                    </Botao>
                    {!r.principal && (
                      <Botao
                        variante="secundario"
                        aria-label={`Marcar como principal: ${r.nome}`}
                        disabled={tornarPrincipal.isPending}
                        onClick={() => tornarPrincipal.mutate({ ...r, principal: true })}
                      >
                        <Star aria-hidden="true" className="size-5" />
                        Marcar como principal
                      </Botao>
                    )}
                    <Botao variante="secundario" aria-label={`Remover ${r.nome}`} onClick={() => setARemover(r)}>
                      <Trash2 aria-hidden="true" className="size-5" />
                      Remover
                    </Botao>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {tornarPrincipal.isError && <Aviso tipo="erro">Não foi possível mudar o responsável principal. Tente de novo.</Aviso>}
          <Botao className="self-start" onClick={() => setEmEdicao(novo)}>
            <Plus aria-hidden="true" className="size-5" />
            Adicionar responsável
          </Botao>
        </>
      )}

      {aRemover && (
        <DialogoConfirmacao
          titulo="Remover responsável?"
          mensagem={`${aRemover.nome} sai da ficha deste paciente.${avisoDoPrincipal}`}
          rotuloConfirmar="Remover"
          ocupado={remover.isPending}
          erro={remover.isError ? 'Não foi possível remover. Tente de novo.' : undefined}
          aoConfirmar={() => remover.mutate(aRemover.id, { onSuccess: () => setARemover(null) })}
          aoCancelar={cancelarRemocao}
        />
      )}
    </SecaoRecolhivel>
  );
}
