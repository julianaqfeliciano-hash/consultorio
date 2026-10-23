import type {
  Bloqueio,
  DataISO,
  HorarioComPaciente,
  Id,
  NovaSessao,
  Sessao,
  SituacaoSessao,
} from '../dominio/tipos';
import { dataLocal, diaDaSemana, entre, instanteDe, somarDias } from './datas';

/** Identifica uma ocorrência de horário fixo numa data (evita gerar a mesma sessão duas vezes). */
export function chaveOcorrencia(horarioFixoId: Id, d: DataISO): string {
  return `${horarioFixoId}|${d}`;
}

/** O dia cai dentro de algum bloqueio (limites incluídos). */
export function estaBloqueado(d: DataISO, bloqueios: Bloqueio[]): boolean {
  return bloqueios.some((b) => entre(d, b.inicio, b.fim));
}

/** Só se cobra quem compareceu ou faltou sem avisar. */
export function ehCobravel(s: SituacaoSessao): boolean {
  return s === 'compareceu' || s === 'falta_sem_aviso';
}

/**
 * Posição da sessão `alvo` dentro da avaliação: sessões da mesma avaliação
 * a que o paciente compareceu antes dela, mais 1.
 * Sem avaliação vinculada não há o que contar, então devolve 1.
 */
export function numeroNaAvaliacao(sessoes: Sessao[], alvo: Sessao): number {
  if (alvo.avaliacaoId === null) return 1;
  const inicioAlvo = Date.parse(alvo.inicio);
  const anteriores = sessoes.filter(
    (s) => s.avaliacaoId === alvo.avaliacaoId && s.situacao === 'compareceu' && Date.parse(s.inicio) < inicioAlvo,
  );
  return anteriores.length + 1;
}

/** Gera as sessões dos horários fixos entre `de` e `ate` (inclusive), ordenadas por início. */
export function gerarOcorrencias(e: {
  horarios: HorarioComPaciente[];
  bloqueios: Bloqueio[];
  existentes: Set<string>;
  de: DataISO;
  ate: DataISO;
}): NovaSessao[] {
  const ativos = e.horarios.filter((h) => h.statusPaciente === 'ativo');
  const novas: NovaSessao[] = [];

  for (let d = e.de; d <= e.ate; d = somarDias(d, 1)) {
    if (estaBloqueado(d, e.bloqueios)) continue;
    const dia = diaDaSemana(d);
    for (const h of ativos) {
      if (h.diaSemana !== dia) continue;
      if (h.validoDe > d) continue;
      if (h.validoAte !== null && d > h.validoAte) continue;
      if (e.existentes.has(chaveOcorrencia(h.id, d))) continue;
      novas.push({
        pacienteId: h.pacienteId,
        inicio: instanteDe(d, h.hora),
        duracaoMin: h.duracaoMin,
        tipo: h.tipoPaciente,
        acompanhamentoFamiliar: false,
        origem: 'fixa',
        horarioFixoId: h.id,
        dataOcorrencia: d,
        situacao: 'agendada',
        remarcadaPara: null,
        avaliacaoId: h.tipoPaciente === 'avaliacao' ? h.avaliacaoId : null,
        confirmada: false,
        observacao: null,
      });
    }
  }

  // Sort estável: horários com o mesmo início mantêm a ordem em que vieram.
  return novas.sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
}

/** Ids das sessões agendadas que casam com o filtro (datas no fuso do consultório). */
export function selecionarAgendadas(
  sessoes: Sessao[],
  f: { pacienteId?: Id; horarioFixoId?: Id; de: DataISO; ate?: DataISO; somenteFixas?: boolean },
): Id[] {
  return sessoes
    .filter((s) => {
      if (s.situacao !== 'agendada') return false;
      if (f.pacienteId !== undefined && s.pacienteId !== f.pacienteId) return false;
      if (f.horarioFixoId !== undefined && s.horarioFixoId !== f.horarioFixoId) return false;
      if (f.somenteFixas && s.origem !== 'fixa') return false;
      const dia = dataLocal(s.inicio);
      return dia >= f.de && (f.ate === undefined || dia <= f.ate);
    })
    .map((s) => s.id);
}
