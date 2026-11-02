import { useState } from 'react';
import { Aviso } from '../../componentes/Aviso';
import { Botao } from '../../componentes/Botao';
import { CaixaDeMarcar } from '../../componentes/CaixaDeMarcar';
import { ChipCobranca } from '../../componentes/ChipCobranca';
import { DialogoConfirmacao } from '../../componentes/DialogoConfirmacao';
import { FalhaAoCarregar } from '../../componentes/FalhaAoCarregar';
import { FormularioPagamento } from '../../componentes/FormularioPagamento';
import { SecaoRecolhivel } from '../../componentes/SecaoRecolhivel';
import {
  mensagemDoErro,
  usePagamentosDoPaciente,
  usePendencias,
  useRegistrarPagamento,
  useRemoverPagamento,
} from '../../dados/useCobranca';
import { useSessoesDoPaciente } from '../../dados/useFicha';
import { ROTULO_FORMA, ROTULO_TIPO, tipoVisual } from '../../dominio/rotulos';
import type { DataISO, Id, Pagamento, Sessao } from '../../dominio/tipos';
import { mesPorExtenso } from '../../regras/cobranca';
import { dataLocal, formatarData } from '../../regras/datas';
import { formatarReais } from '../../regras/dinheiro';
import type { DadosPagamento } from '../../regras/formulariosCobranca';

/** Qual formulário de pagamento está aberto (só um por vez). */
type Formulario = { tipo: 'sessoes' } | { tipo: 'mes'; mes: DataISO } | { tipo: 'avaliacao' };

/** O que o pagamento quita; o resto do pedido (paciente, data, forma e observação) é comum aos três. */
type Destino =
  | { referencia: 'sessoes'; sessaoIds: Id[] }
  | { referencia: 'mes'; mes: DataISO }
  | { referencia: 'avaliacao'; valorCentavos: number };

const soma = (valores: number[]): number => valores.reduce((total, v) => total + v, 0);

/** '22/10' (ou '22/10/2025' quando o ano não é o de `anoDeReferencia`). */
function dataCurta(dia: DataISO, anoDeReferencia: string): string {
  const completa = formatarData(dia);
  return dia.startsWith(anoDeReferencia) ? completa.slice(0, 5) : completa;
}

/** "Sessão de 29/10", "Sessões de 22/10 e 29/10", "Mensalidade de outubro de 2026" ou "Parcela da avaliação". */
function descreverPagamento(p: Pagamento, sessoes: Sessao[]): string {
  switch (p.referencia) {
    case 'mes':
      return p.mesReferencia === null ? 'Mensalidade' : `Mensalidade de ${mesPorExtenso(p.mesReferencia)}`;
    case 'avaliacao':
      return 'Parcela da avaliação';
    case 'sessoes': {
      const porId = new Map(sessoes.map((s) => [s.id, s]));
      const dias = p.sessaoIds
        .flatMap((id) => {
          const sessao = porId.get(id);
          return sessao ? [dataLocal(sessao.inicio)] : [];
        })
        .sort()
        .map((dia) => dataCurta(dia, p.data.slice(0, 4)));
      if (dias.length === 0) return 'Sessões';
      const juntas = dias.length === 1 ? dias[0] : `${dias.slice(0, -1).join(', ')} e ${dias[dias.length - 1]}`;
      return `${dias.length === 1 ? 'Sessão' : 'Sessões'} de ${juntas}`;
    }
  }
}

/** O que acontece quando o pagamento é removido. */
function avisoDaRemocao(p: Pagamento): string {
  switch (p.referencia) {
    case 'sessoes':
      return 'As sessões deste pagamento voltam a ficar em aberto.';
    case 'mes':
      return 'O mês volta a ficar em aberto.';
    case 'avaliacao':
      return 'O valor volta a faltar no pacote da avaliação.';
  }
}

/**
 * Financeiro do paciente (spec §4.2, §6): o que está em aberto (sessões para pagar em lote, meses e o saldo do pacote
 * da avaliação), o registro do pagamento de cada um e o histórico, de onde um pagamento pode ser removido.
 */
export function SecaoFinanceiro({ pacienteId }: { pacienteId: Id }) {
  const pendencias = usePendencias(pacienteId);
  const pagamentos = usePagamentosDoPaciente(pacienteId);
  const sessoes = useSessoesDoPaciente(pacienteId);
  const registrar = useRegistrarPagamento();
  const remover = useRemoverPagamento();
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [marcadas, setMarcadas] = useState<ReadonlySet<Id>>(new Set());
  const [removendo, setRemovendo] = useState<Pagamento | null>(null);

  if (pendencias === undefined) {
    return (
      <SecaoRecolhivel titulo="Financeiro" abertaNoCelular>
        {pagamentos.isError || sessoes.isError ? (
          <FalhaAoCarregar
            mensagem="Não foi possível carregar o financeiro."
            aoTentarDeNovo={() => {
              void pagamentos.refetch();
              void sessoes.refetch();
            }}
          />
        ) : (
          <p role="status">Carregando…</p>
        )}
      </SecaoRecolhivel>
    );
  }

  const { sessoesAbertas, meses, avaliacao, totalEmAbertoCentavos } = pendencias;
  // Do mais novo para o mais antigo (o repositório entrega do mais antigo para o mais novo).
  const historico = [...(pagamentos.data ?? [])].reverse();
  // Só as marcadas que ainda estão em aberto (uma sessão paga por outro caminho sai da lista e da conta).
  const sessoesMarcadas = sessoesAbertas.filter((s) => marcadas.has(s.id));
  const totalMarcadasCentavos = soma(sessoesMarcadas.map((s) => s.valorCentavos ?? 0));
  const erroAoRegistrar = registrar.isError
    ? mensagemDoErro(registrar.error, 'Não foi possível registrar o pagamento. Tente de novo.')
    : undefined;

  function abrir(novo: Formulario) {
    registrar.reset();
    setFormulario(novo);
  }

  function fechar() {
    registrar.reset();
    setFormulario(null);
  }

  function alternarMarca(id: Id) {
    if (!registrar.isIdle) registrar.reset();
    setMarcadas((atuais) => {
      const novas = new Set(atuais);
      if (!novas.delete(id)) novas.add(id);
      return novas;
    });
  }

  function enviar(dados: DadosPagamento, destino: Destino) {
    registrar.mutate(
      { pacienteId, data: dados.data, forma: dados.forma, observacao: dados.observacao, ...destino },
      {
        onSuccess: () => {
          setFormulario(null);
          setMarcadas(new Set());
        },
      },
    );
  }

  return (
    <SecaoRecolhivel titulo="Financeiro" abertaNoCelular>
      <p className="text-lg font-semibold">
        {totalEmAbertoCentavos > 0 ? `Em aberto: ${formatarReais(totalEmAbertoCentavos)}` : 'Nada em aberto.'}
      </p>

      {sessoesAbertas.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-lg">Sessões em aberto</h3>
          <ul aria-label="Sessões em aberto" className="flex flex-col">
            {sessoesAbertas.map((s) => (
              <li key={s.id}>
                <CaixaDeMarcar
                  rotulo={`${formatarData(dataLocal(s.inicio))} · ${ROTULO_TIPO[tipoVisual(s)]} · ${formatarReais(s.valorCentavos ?? 0)}`}
                  checked={marcadas.has(s.id)}
                  disabled={registrar.isPending}
                  onChange={() => alternarMarca(s.id)}
                />
              </li>
            ))}
          </ul>
          {sessoesMarcadas.length === 0 ? (
            <p className="text-sm">Marque as sessões que foram pagas.</p>
          ) : (
            <p className="font-semibold">{`Marcadas: ${formatarReais(totalMarcadasCentavos)}`}</p>
          )}
          {formulario?.tipo === 'sessoes' && sessoesMarcadas.length > 0 ? (
            <FormularioPagamento
              titulo="Pagamento das sessões marcadas"
              valorCentavos={totalMarcadasCentavos}
              enviando={registrar.isPending}
              erro={erroAoRegistrar}
              aoCancelar={fechar}
              aoEnviar={(dados) => enviar(dados, { referencia: 'sessoes', sessaoIds: sessoesMarcadas.map((s) => s.id) })}
            />
          ) : (
            <Botao
              variante="secundario"
              disabled={sessoesMarcadas.length === 0}
              onClick={() => abrir({ tipo: 'sessoes' })}
              className="self-start"
            >
              Registrar pagamento das marcadas
            </Botao>
          )}
        </div>
      )}

      {meses.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-lg">Meses</h3>
          {/* Do mais recente para o mais antigo: o mês de agora fica no alto, e os pagos antigos não o empurram para baixo. */}
          <ul aria-label="Meses" className="flex flex-col gap-2">
            {[...meses].reverse().map((m) => (
              <li key={m.mes} className="flex flex-col gap-3 rounded-lg bg-creme px-3 py-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold">
                    {`${mesPorExtenso(m.mes)} · ${m.sessoes.length} ${m.sessoes.length === 1 ? 'sessão' : 'sessões'} · ${formatarReais(m.totalCentavos)}`}
                  </span>
                  <ChipCobranca situacao={m.situacao} />
                </div>
                {m.situacao === 'pago' && m.diferencaCentavos !== 0 && (
                  <Aviso tipo="erro">
                    {`O valor de ${mesPorExtenso(m.mes)} mudou depois do pagamento: diferença de ${formatarReais(m.diferencaCentavos)}.`}
                  </Aviso>
                )}
                {m.situacao !== 'pago' &&
                  (formulario?.tipo === 'mes' && formulario.mes === m.mes ? (
                    <FormularioPagamento
                      titulo={`Pagamento de ${mesPorExtenso(m.mes)}`}
                      valorCentavos={m.totalCentavos}
                      enviando={registrar.isPending}
                      erro={erroAoRegistrar}
                      aoCancelar={fechar}
                      aoEnviar={(dados) => enviar(dados, { referencia: 'mes', mes: m.mes })}
                    />
                  ) : (
                    <Botao variante="secundario" onClick={() => abrir({ tipo: 'mes', mes: m.mes })} className="self-start">
                      Registrar pagamento do mês
                    </Botao>
                  ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {avaliacao !== null && (
        <div className="flex flex-col gap-2">
          <h3 className="text-lg">Pacote da avaliação</h3>
          <p>
            {`Valor final ${formatarReais(avaliacao.valorFinalCentavos)} · Pago ${formatarReais(avaliacao.pagoCentavos)} · Falta ${formatarReais(avaliacao.faltaCentavos)}`}
          </p>
          {avaliacao.faltaCentavos > 0 &&
            (formulario?.tipo === 'avaliacao' ? (
              <FormularioPagamento
                titulo="Parcela da avaliação"
                valorEditavel
                valorCentavos={avaliacao.faltaCentavos}
                enviando={registrar.isPending}
                erro={erroAoRegistrar}
                aoCancelar={fechar}
                aoEnviar={(dados) => {
                  // Com valor editável o formulário sempre entrega o valor, já conferido (maior que zero).
                  if (dados.valorCentavos !== undefined) {
                    enviar(dados, { referencia: 'avaliacao', valorCentavos: dados.valorCentavos });
                  }
                }}
              />
            ) : (
              <Botao variante="secundario" onClick={() => abrir({ tipo: 'avaliacao' })} className="self-start">
                Registrar parcela
              </Botao>
            ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-lg">Pagamentos</h3>
        {historico.length === 0 ? (
          <p>Nenhum pagamento registrado.</p>
        ) : (
          <ul aria-label="Pagamentos" className="flex flex-col gap-2">
            {historico.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-creme px-3 py-2">
                <span>
                  {`${formatarData(p.data)} · ${ROTULO_FORMA[p.forma]} · ${formatarReais(p.valorCentavos)} · ${descreverPagamento(p, sessoes.data ?? [])}`}
                </span>
                <Botao
                  variante="secundario"
                  aria-label={`Remover pagamento de ${formatarData(p.data)}, ${formatarReais(p.valorCentavos)}`}
                  onClick={() => {
                    remover.reset();
                    setRemovendo(p);
                  }}
                >
                  Remover
                </Botao>
                {p.observacao && <p className="basis-full text-sm">{p.observacao}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {removendo && (
        <DialogoConfirmacao
          titulo="Remover pagamento"
          mensagem={`Remover o pagamento de ${formatarReais(removendo.valorCentavos)} feito em ${formatarData(removendo.data)} (${descreverPagamento(removendo, sessoes.data ?? [])})?`}
          aviso={avisoDaRemocao(removendo)}
          rotuloConfirmar="Remover"
          ocupado={remover.isPending}
          erro={remover.isError ? mensagemDoErro(remover.error, 'Não foi possível remover o pagamento. Tente de novo.') : undefined}
          aoConfirmar={() => remover.mutate(removendo.id, { onSuccess: () => setRemovendo(null) })}
          aoCancelar={() => {
            remover.reset();
            setRemovendo(null);
          }}
        />
      )}
    </SecaoRecolhivel>
  );
}
