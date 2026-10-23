import { AreaDeTexto } from '../../componentes/AreaDeTexto';
import { Campo } from '../../componentes/Campo';
import { GrupoDeOpcoes } from '../../componentes/GrupoDeOpcoes';
import { Selecao } from '../../componentes/Selecao';
import { useParceiros } from '../../dados/useParceiros';
import type { FormaCobranca } from '../../dominio/tipos';
import { hojeISO } from '../../regras/datas';
import type { ErrosDados, ValoresCobranca, ValoresDados } from '../../regras/formularios';
import { mascararCpf } from '../../regras/texto';

/**
 * Os campos que o formulário de paciente novo e a ficha têm em comum. Cada grupo é "controlado":
 * quem usa guarda os valores e recebe cada mudança em `aoMudar`.
 */

interface CamposDadosProps {
  valores: ValoresDados;
  erros: ErrosDados;
  aoMudar: (mudanca: Partial<ValoresDados>) => void;
}

/** Nome, nascimento, CPF (com máscara), escola, série e observações. */
export function CamposDados({ valores, erros, aoMudar }: CamposDadosProps) {
  return (
    <>
      <Campo rotulo="Nome" value={valores.nome} onChange={(e) => aoMudar({ nome: e.target.value })} erro={erros.nome} />
      <Campo
        rotulo="Data de nascimento"
        type="date"
        max={hojeISO()}
        value={valores.dataNascimento}
        onChange={(e) => aoMudar({ dataNascimento: e.target.value })}
        erro={erros.dataNascimento}
      />
      <Campo
        rotulo="CPF"
        ajuda="Opcional. Usado no carnê-leão."
        inputMode="numeric"
        autoComplete="off"
        value={valores.cpf}
        onChange={(e) => aoMudar({ cpf: mascararCpf(e.target.value) })}
        erro={erros.cpf}
      />
      <Campo rotulo="Escola" value={valores.escola} onChange={(e) => aoMudar({ escola: e.target.value })} />
      <Campo rotulo="Série" value={valores.serie} onChange={(e) => aoMudar({ serie: e.target.value })} />
      <AreaDeTexto rotulo="Observações" value={valores.observacoes} onChange={(e) => aoMudar({ observacoes: e.target.value })} />
    </>
  );
}

interface SelecaoParceiroProps {
  /** Id do parceiro, ou '' para "Não informado". */
  valor: string;
  aoMudar: (parceiroId: string) => void;
}

/** "Quem encaminhou": a lista de parceiros cadastrados. */
export function SelecaoParceiro({ valor, aoMudar }: SelecaoParceiroProps) {
  const parceiros = useParceiros();
  return (
    <Selecao
      rotulo="Quem encaminhou"
      value={valor}
      onChange={(e) => aoMudar(e.target.value)}
      ajuda={parceiros.isError ? 'Não foi possível carregar os parceiros.' : undefined}
    >
      <option value="">Não informado</option>
      {parceiros.data?.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nome}
        </option>
      ))}
    </Selecao>
  );
}

const FORMAS: { valor: FormaCobranca; rotulo: string }[] = [
  { valor: 'por_sessao', rotulo: 'Por sessão' },
  { valor: 'mensal', rotulo: 'Por mês' },
];

interface CamposCobrancaProps {
  valores: ValoresCobranca;
  erros: { valor?: string };
  aoMudar: (mudanca: Partial<ValoresCobranca>) => void;
}

/** Forma de cobrança (por sessão ou por mês) e valor da sessão. */
export function CamposCobranca({ valores, erros, aoMudar }: CamposCobrancaProps) {
  return (
    <>
      <GrupoDeOpcoes
        legenda="Forma de cobrança"
        opcoes={FORMAS}
        valor={valores.forma}
        aoMudar={(forma) => aoMudar({ forma })}
        ajuda="Na cobrança por mês, o total do mês é a soma das sessões cobradas."
      />
      <Campo
        rotulo="Valor da sessão"
        ajuda="Em reais, por exemplo 180 ou 180,50."
        inputMode="decimal"
        autoComplete="off"
        value={valores.valor}
        onChange={(e) => aoMudar({ valor: e.target.value })}
        erro={erros.valor}
      />
    </>
  );
}
