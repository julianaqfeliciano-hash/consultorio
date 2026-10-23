import type {
  Avaliacao,
  Bloqueio,
  Configuracoes,
  DataISO,
  HorarioComPaciente,
  HorarioFixo,
  Id,
  NovaSessao,
  Paciente,
  Parceiro,
  Responsavel,
  Sessao,
} from '../dominio/tipos';
import { chaveOcorrencia } from '../regras/agenda';
import { dataLocal, entre } from '../regras/datas';
import type { FichaPaciente, Rascunho, Repositorio, SessaoComPaciente } from './repositorio';

/** Dados com que o repositório em memória já começa (demonstração e testes). */
export interface SementeMemoria {
  configuracoes?: Configuracoes;
  parceiros?: Parceiro[];
  pacientes?: Paciente[];
  responsaveis?: Responsavel[];
  horarios?: HorarioFixo[];
  avaliacoes?: Avaliacao[];
  sessoes?: Sessao[];
  bloqueios?: Bloqueio[];
}

const copia = <T>(valor: T): T => structuredClone(valor);

function tabela<T extends { id: Id }>(itens: T[] = []): Map<Id, T> {
  return new Map(itens.map((i) => [i.id, copia(i)]));
}

const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, 'pt-BR');
const porInicio = (a: { inicio: string }, b: { inicio: string }) => Date.parse(a.inicio) - Date.parse(b.inicio);

/**
 * Repositório que guarda tudo em Maps, sem rede. Imita o banco onde isso muda o
 * resultado: ids novos com `crypto.randomUUID()`, uma sessão por ocorrência de
 * horário fixo, `on delete set null` ao apagar parceiro ou sessão de destino.
 * Tudo que entra e sai é copiado, então quem chama nunca altera o estado guardado.
 */
export function criarRepositorioMemoria(semente: SementeMemoria = {}): Repositorio {
  let configuracoes: Configuracoes | null = semente.configuracoes ? copia(semente.configuracoes) : null;
  const parceiros = tabela(semente.parceiros);
  const pacientes = tabela(semente.pacientes);
  const responsaveis = tabela(semente.responsaveis);
  const horarios = tabela(semente.horarios);
  const avaliacoes = tabela(semente.avaliacoes);
  const sessoes = tabela(semente.sessoes);
  const bloqueios = tabela(semente.bloqueios);

  function gravar<T extends { id: Id }>(mapa: Map<Id, T>, r: Rascunho<T>): T {
    const salvo = { ...copia(r), id: r.id ?? crypto.randomUUID() } as T;
    mapa.set(salvo.id, salvo);
    return copia(salvo);
  }

  function exigirPaciente(id: Id): void {
    if (!pacientes.has(id)) throw new Error(`Paciente não encontrado: ${id}`);
  }

  /** Imita o `unique (horario_fixo_id, data_ocorrencia)` do banco. */
  function ocorrenciaOcupada(s: NovaSessao, ignorarId?: Id): boolean {
    if (s.horarioFixoId === null || s.dataOcorrencia === null) return false;
    const chave = chaveOcorrencia(s.horarioFixoId, s.dataOcorrencia);
    return [...sessoes.values()].some(
      (x) =>
        x.id !== ignorarId &&
        x.horarioFixoId !== null &&
        x.dataOcorrencia !== null &&
        chaveOcorrencia(x.horarioFixoId, x.dataOcorrencia) === chave,
    );
  }

  function avaliacaoMaisRecente(pacienteId: Id): Avaliacao | null {
    const dele = [...avaliacoes.values()].filter((a) => a.pacienteId === pacienteId);
    // Do mais novo para o mais antigo; datas 'YYYY-MM-DD' ordenam como texto.
    dele.sort((a, b) => (a.inicio < b.inicio ? 1 : a.inicio > b.inicio ? -1 : 0));
    return dele[0] ?? null;
  }

  function responsavelPrincipal(pacienteId: Id): SessaoComPaciente['responsavelPrincipal'] {
    const r = [...responsaveis.values()].find((x) => x.pacienteId === pacienteId && x.principal);
    return r ? { nome: r.nome, telefone: r.telefone } : null;
  }

  return {
    async obterConfiguracoes() {
      return configuracoes ? copia(configuracoes) : null;
    },
    async salvarConfiguracoes(c) {
      configuracoes = copia(c);
    },

    async listarParceiros() {
      return [...parceiros.values()].sort(porNome).map(copia);
    },
    async salvarParceiro(p) {
      return gravar(parceiros, p);
    },
    async removerParceiro(id) {
      parceiros.delete(id);
      for (const p of pacientes.values()) {
        if (p.parceiroId === id) p.parceiroId = null;
      }
    },

    async listarPacientes() {
      return [...pacientes.values()].sort(porNome).map(copia);
    },
    async obterFicha(pacienteId): Promise<FichaPaciente | null> {
      const paciente = pacientes.get(pacienteId);
      if (!paciente) return null;
      const dele = <T extends { pacienteId: Id }>(mapa: Map<Id, T>) =>
        [...mapa.values()].filter((x) => x.pacienteId === pacienteId);
      return copia({
        paciente,
        // sort é estável: dentro de cada grupo vale a ordem de cadastro.
        responsaveis: dele(responsaveis).sort((a, b) => Number(b.principal) - Number(a.principal)),
        horarios: dele(horarios).sort(
          (a, b) =>
            a.validoDe.localeCompare(b.validoDe) || a.diaSemana - b.diaSemana || a.hora.localeCompare(b.hora),
        ),
        avaliacao: avaliacaoMaisRecente(pacienteId),
      });
    },
    async salvarPaciente(p) {
      return gravar(pacientes, p);
    },
    async salvarResponsavel(r) {
      exigirPaciente(r.pacienteId);
      const id = r.id ?? crypto.randomUUID();
      if (r.principal) {
        for (const outro of responsaveis.values()) {
          if (outro.pacienteId === r.pacienteId && outro.id !== id) outro.principal = false;
        }
      }
      return gravar(responsaveis, { ...r, id });
    },
    async removerResponsavel(id) {
      responsaveis.delete(id);
    },
    async salvarHorario(h) {
      exigirPaciente(h.pacienteId);
      return gravar(horarios, h);
    },
    async salvarAvaliacao(a) {
      exigirPaciente(a.pacienteId);
      return gravar(avaliacoes, a);
    },

    async listarHorariosVigentes(de: DataISO, ate: DataISO) {
      const vigentes: HorarioComPaciente[] = [];
      for (const h of horarios.values()) {
        if (h.validoDe > ate || (h.validoAte !== null && h.validoAte < de)) continue;
        const paciente = pacientes.get(h.pacienteId);
        if (!paciente) continue;
        vigentes.push({
          ...copia(h),
          statusPaciente: paciente.status,
          tipoPaciente: paciente.tipo,
          avaliacaoId: avaliacaoMaisRecente(h.pacienteId)?.id ?? null,
        });
      }
      return vigentes.sort((a, b) => a.diaSemana - b.diaSemana || a.hora.localeCompare(b.hora));
    },
    async listarSessoes(de: DataISO, ate: DataISO) {
      return [...sessoes.values()]
        .filter((s) => entre(dataLocal(s.inicio), de, ate))
        .sort(porInicio)
        .map((s): SessaoComPaciente => ({
          ...copia(s),
          pacienteNome: pacientes.get(s.pacienteId)?.nome ?? '',
          responsavelPrincipal: responsavelPrincipal(s.pacienteId),
        }));
    },
    async listarSessoesDoPaciente(pacienteId) {
      return [...sessoes.values()]
        .filter((s) => s.pacienteId === pacienteId)
        .sort(porInicio)
        .map(copia);
    },
    async inserirOcorrencias(novas) {
      let entraram = 0;
      for (const nova of novas) {
        exigirPaciente(nova.pacienteId);
        if (ocorrenciaOcupada(nova)) continue;
        gravar(sessoes, { ...nova });
        entraram += 1;
      }
      return entraram;
    },
    async criarSessao(nova) {
      exigirPaciente(nova.pacienteId);
      if (ocorrenciaOcupada(nova)) {
        throw new Error('Já existe uma sessão para esta ocorrência do horário fixo.');
      }
      return gravar(sessoes, { ...nova });
    },
    async atualizarSessao(id, mudancas) {
      const atual = sessoes.get(id);
      if (!atual) throw new Error(`Sessão não encontrada: ${id}`);
      const definidas = Object.fromEntries(Object.entries(mudancas).filter(([, v]) => v !== undefined));
      const nova: Sessao = { ...atual, ...copia(definidas) };
      if (ocorrenciaOcupada(nova, id)) {
        throw new Error('Já existe uma sessão para esta ocorrência do horário fixo.');
      }
      sessoes.set(id, nova);
      return copia(nova);
    },
    async removerSessoes(ids) {
      const apagar = new Set(ids);
      for (const id of apagar) sessoes.delete(id);
      for (const s of sessoes.values()) {
        if (s.remarcadaPara !== null && apagar.has(s.remarcadaPara)) s.remarcadaPara = null;
      }
    },

    async listarBloqueios() {
      return [...bloqueios.values()]
        .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.fim.localeCompare(b.fim))
        .map(copia);
    },
    async salvarBloqueio(b) {
      return gravar(bloqueios, b);
    },
    async removerBloqueio(id) {
      bloqueios.delete(id);
    },
  };
}
