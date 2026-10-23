import { useState, type FormEvent } from 'react';
import { Aviso } from '../../componentes/Aviso';
import { Botao } from '../../componentes/Botao';
import { CaixaDeMarcar } from '../../componentes/CaixaDeMarcar';
import { Campo } from '../../componentes/Campo';
import { SecaoRecolhivel } from '../../componentes/SecaoRecolhivel';
import { useSalvarAvaliacao } from '../../dados/useFicha';
import type { Avaliacao } from '../../dominio/tipos';
import { SESSOES_PREVISTAS_MAXIMAS, validarEtapa, validarSessoesPrevistas } from '../../regras/formularios';

/**
 * A avaliação em andamento: quantas sessões estão previstas e as etapas para marcar
 * (marcar grava na hora). Só aparece para quem está em avaliação.
 */
export function SecaoAvaliacao({ avaliacao }: { avaliacao: Avaliacao }) {
  const salvarEtapas = useSalvarAvaliacao(avaliacao.pacienteId);
  const salvarPrevistas = useSalvarAvaliacao(avaliacao.pacienteId);
  const [previstas, setPrevistas] = useState(String(avaliacao.sessoesPrevistas));
  const [avisoDasPrevistas, setAvisoDasPrevistas] = useState('');
  const [novaEtapa, setNovaEtapa] = useState('');
  const [avisoDaEtapa, setAvisoDaEtapa] = useState('');

  function alternar(indice: number) {
    const etapas = avaliacao.etapas.map((e, i) => (i === indice ? { ...e, feita: !e.feita } : e));
    salvarEtapas.mutate({ ...avaliacao, etapas });
  }

  function adicionarEtapa(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const lida = validarEtapa(novaEtapa, avaliacao.etapas);
    setAvisoDaEtapa(lida.erros.nome ?? '');
    if (lida.dados === null) return;
    const digitada = novaEtapa;
    // Limpa já: a etapa aparece na hora; se a gravação falhar, o texto volta para tentar de novo.
    setNovaEtapa('');
    salvarEtapas.mutate({ ...avaliacao, etapas: [...avaliacao.etapas, lida.dados] }, { onError: () => setNovaEtapa(digitada) });
  }

  function salvarSessoesPrevistas(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const lida = validarSessoesPrevistas(previstas);
    setAvisoDasPrevistas(lida.erros.sessoesPrevistas ?? '');
    if (lida.dados === null) return;
    salvarPrevistas.mutate({ ...avaliacao, sessoesPrevistas: lida.dados });
  }

  return (
    <SecaoRecolhivel titulo="Avaliação" abertaNoCelular>
      <form noValidate onSubmit={salvarSessoesPrevistas} className="flex flex-col items-start gap-3">
        <Campo
          rotulo="Sessões previstas"
          type="number"
          inputMode="numeric"
          min={1}
          max={SESSOES_PREVISTAS_MAXIMAS}
          step={1}
          value={previstas}
          onChange={(e) => {
            setPrevistas(e.target.value);
            if (!salvarPrevistas.isIdle) salvarPrevistas.reset();
          }}
          erro={avisoDasPrevistas}
        />
        {salvarPrevistas.isError && <Aviso tipo="erro">Não foi possível salvar a avaliação. Tente de novo.</Aviso>}
        {salvarPrevistas.isSuccess && <Aviso tipo="sucesso">Sessões previstas salvas.</Aviso>}
        <Botao type="submit" variante="secundario" disabled={salvarPrevistas.isPending}>
          Salvar sessões previstas
        </Botao>
      </form>

      <div className="flex flex-col gap-2">
        <h3 className="text-lg">Etapas</h3>
        <ul className="flex flex-col">
          {avaliacao.etapas.map((etapa, i) => (
            // O nome da etapa é o que a pessoa vê; a posição basta como chave porque a lista só cresce no fim.
            <li key={`${i}-${etapa.nome}`}>
              <CaixaDeMarcar rotulo={etapa.nome} checked={etapa.feita} onChange={() => alternar(i)} />
            </li>
          ))}
        </ul>
        {salvarEtapas.isError && <Aviso tipo="erro">Não foi possível salvar a avaliação. Tente de novo.</Aviso>}
      </div>

      <form noValidate onSubmit={adicionarEtapa} className="flex flex-col items-start gap-3">
        <Campo
          rotulo="Nova etapa"
          value={novaEtapa}
          onChange={(e) => {
            setNovaEtapa(e.target.value);
            setAvisoDaEtapa('');
          }}
          erro={avisoDaEtapa}
        />
        <Botao type="submit" variante="secundario">
          Adicionar etapa
        </Botao>
      </form>
    </SecaoRecolhivel>
  );
}
