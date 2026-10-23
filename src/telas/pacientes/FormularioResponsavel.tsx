import { useState, type FormEvent } from 'react';
import { Aviso } from '../../componentes/Aviso';
import { Botao } from '../../componentes/Botao';
import { CaixaDeMarcar } from '../../componentes/CaixaDeMarcar';
import { Campo } from '../../componentes/Campo';
import type { Rascunho } from '../../dados/repositorio';
import { useSalvarResponsavel } from '../../dados/useFicha';
import type { Responsavel } from '../../dominio/tipos';
import {
  validarResponsavel,
  valoresDeResponsavel,
  type ErrosResponsavel,
  type ValoresResponsavel,
} from '../../regras/formularios';
import { mascararCpf, mascararTelefone } from '../../regras/texto';

interface Props {
  /** Responsável a editar; sem `id`, é um responsável novo. */
  inicial: Rascunho<Responsavel>;
  aoSalvar: () => void;
  aoCancelar: () => void;
}

/** Formulário de um responsável: só o nome é obrigatório; telefone e CPF seguem as máscaras. */
export function FormularioResponsavel({ inicial, aoSalvar, aoCancelar }: Props) {
  const salvar = useSalvarResponsavel(inicial.pacienteId);
  const [valores, setValores] = useState<ValoresResponsavel>(() => valoresDeResponsavel(inicial));
  const [erros, setErros] = useState<ErrosResponsavel>({});

  function alterar(mudanca: Partial<ValoresResponsavel>) {
    setValores((v) => ({ ...v, ...mudanca }));
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const lido = validarResponsavel(valores);
    setErros(lido.erros);
    if (lido.dados === null) return;
    salvar.mutate({ ...inicial, ...lido.dados }, { onSuccess: aoSalvar });
  }

  return (
    <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-4">
      <h3 className="text-lg">{inicial.id ? 'Editar responsável' : 'Novo responsável'}</h3>
      <Campo rotulo="Nome" value={valores.nome} onChange={(e) => alterar({ nome: e.target.value })} erro={erros.nome} />
      <Campo
        rotulo="Parentesco"
        ajuda="Por exemplo: Mãe, Pai, Avó."
        value={valores.parentesco}
        onChange={(e) => alterar({ parentesco: e.target.value })}
      />
      <Campo
        rotulo="CPF"
        ajuda="Opcional. Aparece no recibo e no carnê-leão de quem paga."
        inputMode="numeric"
        autoComplete="off"
        value={valores.cpf}
        onChange={(e) => alterar({ cpf: mascararCpf(e.target.value) })}
        erro={erros.cpf}
      />
      <Campo
        rotulo="Telefone"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        value={valores.telefone}
        onChange={(e) => alterar({ telefone: mascararTelefone(e.target.value) })}
        erro={erros.telefone}
      />
      <Campo
        rotulo="E-mail"
        type="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        value={valores.email}
        onChange={(e) => alterar({ email: e.target.value })}
        erro={erros.email}
      />
      <CaixaDeMarcar
        rotulo="Responsável principal"
        ajuda="Recebe a confirmação das sessões. Só um responsável é o principal."
        checked={valores.principal}
        onChange={(e) => alterar({ principal: e.target.checked })}
      />
      <CaixaDeMarcar
        rotulo="Pagador"
        ajuda="Quem paga: o nome dele vai no recibo e no carnê-leão."
        checked={valores.pagador}
        onChange={(e) => alterar({ pagador: e.target.checked })}
      />
      {salvar.isError && <Aviso tipo="erro">Não foi possível salvar. Tente de novo.</Aviso>}
      <div className="flex flex-wrap gap-3">
        <Botao type="submit" disabled={salvar.isPending}>
          {salvar.isPending ? 'Salvando…' : 'Salvar responsável'}
        </Botao>
        <Botao variante="secundario" disabled={salvar.isPending} onClick={aoCancelar}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}
