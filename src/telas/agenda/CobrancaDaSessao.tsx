import { CalendarRange, CircleCheck, CircleDollarSign, Package } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Botao } from '../../componentes/Botao';
import { FormularioPagamento } from '../../componentes/FormularioPagamento';
import { mensagemDoErro, usePagamentosDoPaciente, usePendencias, useRegistrarPagamento } from '../../dados/useCobranca';
import { useFicha, useSessoesDoPaciente } from '../../dados/useFicha';
import { ROTULO_FORMA } from '../../dominio/rotulos';
import type { Sessao } from '../../dominio/tipos';
import { mesDaSessao, mesPorExtenso } from '../../regras/cobranca';
import { formatarData } from '../../regras/datas';
import { formatarReais } from '../../regras/dinheiro';

/** Uma frase com ícone. O fundo amarelo chama a atenção para o que está em aberto; a informação está no texto. */
function Linha({ icone: Icone, aberta = false, children }: { icone: typeof CircleCheck; aberta?: boolean; children: ReactNode }) {
  return (
    <p className={`flex items-start gap-2 rounded-lg p-3 font-semibold ${aberta ? 'bg-amarelo/30' : 'bg-verde-claro/40'}`}>
      <Icone aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      {children}
    </p>
  );
}

/**
 * Como a sessão é cobrada (spec §4.1, §6): paga ("Pago em 03/11 · Pix"), pendente com o botão de registrar o
 * pagamento, parte da mensalidade, parte do pacote da avaliação, ou nada quando não há valor. Espera ficha,
 * sessões e pagamentos do paciente chegarem para não dizer "pendente" de uma sessão que já foi paga.
 */
export function CobrancaDaSessao({ sessao }: { sessao: Sessao }) {
  const ficha = useFicha(sessao.pacienteId);
  const pagamentos = usePagamentosDoPaciente(sessao.pacienteId);
  const sessoes = useSessoesDoPaciente(sessao.pacienteId);
  const pendencias = usePendencias(sessao.pacienteId);
  const registrar = useRegistrarPagamento();
  const [registrando, setRegistrando] = useState(false);

  if (ficha.isError || pagamentos.isError || sessoes.isError) {
    return <p className="text-sm">Não foi possível carregar a cobrança desta sessão.</p>;
  }
  if (!ficha.data || !pagamentos.data || !pendencias) return null;

  const paga = pagamentos.data.find((p) => p.referencia === 'sessoes' && p.sessaoIds.includes(sessao.id));
  if (paga) {
    // Só dia e mês: o ano é o da própria sessão, e o painel já a mostra por extenso.
    return (
      <Linha icone={CircleCheck}>{`Pago em ${formatarData(paga.data).slice(0, 5)} · ${ROTULO_FORMA[paga.forma]}`}</Linha>
    );
  }

  const aberta = pendencias.sessoesAbertas.find((s) => s.id === sessao.id);
  if (aberta) {
    const valor = aberta.valorCentavos ?? 0;
    return (
      <div className="flex flex-col gap-3">
        <Linha icone={CircleDollarSign} aberta>{`Pendente · ${formatarReais(valor)}`}</Linha>
        {registrando ? (
          <FormularioPagamento
            titulo="Registrar pagamento"
            valorCentavos={valor}
            enviando={registrar.isPending}
            erro={
              registrar.isError
                ? mensagemDoErro(registrar.error, 'Não foi possível registrar o pagamento. Tente de novo.')
                : undefined
            }
            aoCancelar={() => {
              registrar.reset();
              setRegistrando(false);
            }}
            aoEnviar={(dados) =>
              registrar.mutate(
                {
                  pacienteId: sessao.pacienteId,
                  referencia: 'sessoes',
                  sessaoIds: [sessao.id],
                  data: dados.data,
                  forma: dados.forma,
                  observacao: dados.observacao,
                },
                { onSuccess: () => setRegistrando(false) },
              )
            }
          />
        ) : (
          <Botao variante="secundario" onClick={() => setRegistrando(true)} className="self-start">
            Registrar pagamento
          </Botao>
        )}
      </div>
    );
  }

  const valorDaSessao = sessao.valorCentavos ?? 0;
  if (sessao.tipo === 'psicoterapia' && ficha.data.paciente.formaCobranca === 'mensal' && valorDaSessao > 0) {
    return (
      <Linha icone={CalendarRange}>{`Entra na mensalidade de ${mesPorExtenso(mesDaSessao(sessao.inicio))}`}</Linha>
    );
  }
  if (sessao.tipo === 'avaliacao' && sessao.situacao === 'compareceu') {
    return <Linha icone={Package}>Incluída no pacote da avaliação</Linha>;
  }
  return null;
}
