import { CircleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { AreaDeTexto } from '../../componentes/AreaDeTexto';
import { Botao } from '../../componentes/Botao';
import { Campo } from '../../componentes/Campo';
import type { Rascunho } from '../../dados/repositorio';
import { useSalvarParceiro } from '../../dados/useParceiros';
import type { Parceiro } from '../../dominio/tipos';

interface Props {
  /** Parceiro a editar; sem `id`, é um parceiro novo. */
  inicial: Rascunho<Parceiro>;
  aoSalvar: () => void;
  aoCancelar: () => void;
}

/** Formulário de um parceiro: só o nome é obrigatório. */
export function FormularioParceiro({ inicial, aoSalvar, aoCancelar }: Props) {
  const [nome, setNome] = useState(inicial.nome);
  const [profissao, setProfissao] = useState(inicial.profissao);
  const [contato, setContato] = useState(inicial.contato);
  const [observacoes, setObservacoes] = useState(inicial.observacoes);
  const [avisoDoNome, setAvisoDoNome] = useState('');
  const salvar = useSalvarParceiro();

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const nomeLimpo = nome.trim();
    setAvisoDoNome(nomeLimpo === '' ? 'Informe o nome do parceiro.' : '');
    if (nomeLimpo === '') return;

    salvar.mutate(
      { ...inicial, nome: nomeLimpo, profissao: profissao.trim(), contato: contato.trim(), observacoes: observacoes.trim() },
      { onSuccess: aoSalvar },
    );
  }

  return (
    <form noValidate onSubmit={aoEnviar} className="flex w-full max-w-xl flex-col gap-4">
      <h2 className="text-2xl">{inicial.id ? 'Editar parceiro' : 'Novo parceiro'}</h2>
      <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} erro={avisoDoNome} />
      <Campo
        rotulo="Profissão"
        ajuda="Por exemplo: Neuropediatra, Psiquiatra, Fonoaudióloga."
        value={profissao}
        onChange={(e) => setProfissao(e.target.value)}
      />
      <Campo rotulo="Contato" ajuda="Telefone, e-mail ou clínica." value={contato} onChange={(e) => setContato(e.target.value)} />
      <AreaDeTexto rotulo="Observações" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
      {salvar.isError && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-amarelo/30 p-3 font-semibold">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          Não foi possível salvar. Tente de novo.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Botao type="submit" disabled={salvar.isPending}>
          {salvar.isPending ? 'Salvando…' : 'Salvar'}
        </Botao>
        <Botao variante="secundario" disabled={salvar.isPending} onClick={aoCancelar}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}
