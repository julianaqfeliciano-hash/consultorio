import type {
  Avaliacao,
  Bloqueio,
  Configuracoes,
  DataISO,
  HorarioComPaciente,
  HorarioFixo,
  Id,
  NovaSessao,
  NovoPagamento,
  Paciente,
  Pagamento,
  Parceiro,
  RegistroSessao,
  Responsavel,
  Sessao,
} from '../dominio/tipos';
import { chaveOcorrencia } from '../regras/agenda';
import { dataLocal, entre } from '../regras/datas';
import {
  ERRO_SESSAO_JA_PAGA,
  ERRO_SESSAO_PAGA_NAO_SAI,
  RecusaDoRepositorio,
  type FichaPaciente,
  type Rascunho,
  type Repositorio,
  type SessaoComPaciente,
} from './repositorio';

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
  pagamentos?: Pagamento[];
  registros?: RegistroSessao[];
}

const copia = <T>(valor: T): T => structuredClone(valor);

function tabela<T extends { id: Id }>(itens: T[] = []): Map<Id, T> {
  return new Map(itens.map((i) => [i.id, copia(i)]));
}

const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, 'pt-BR');
const porInicio = (a: { inicio: string }, b: { inicio: string }) => Date.parse(a.inicio) - Date.parse(b.inicio);
const DIA_1 = /^\d{4}-\d{2}-01$/;

/**
 * Repositório que guarda tudo em Maps, sem rede. Imita o banco onde isso muda o
 * resultado: ids novos com `crypto.randomUUID()`, uma sessão por ocorrência de
 * horário fixo, `on delete set null` ao apagar parceiro ou sessão de destino e, nos
 * pagamentos, as mesmas regras (uma sessão só é paga uma vez, sessão paga não se apaga; um
 * mês pode ter vários pagamentos, como no banco).
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
  // Mesma ordem de leitura do banco: sessaoIds em ordem de id. A ordem de inserção do Map é a de criação.
  const pagamentos = tabela(semente.pagamentos?.map((p) => ({ ...p, sessaoIds: [...p.sessaoIds].sort() })));

  // Um registro por sessão, guardado pelo id da sessão (a chave primária do banco).
  const registros = new Map<Id, RegistroSessao>((semente.registros ?? []).map((r) => [r.sessaoId, copia(r)]));

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

  function comPaciente(s: Sessao): SessaoComPaciente {
    return {
      ...copia(s),
      pacienteNome: pacientes.get(s.pacienteId)?.nome ?? '',
      responsavelPrincipal: responsavelPrincipal(s.pacienteId),
    };
  }

  /** Ids das sessões que algum pagamento já quitou (o `unique (sessao_id)` do banco). */
  function sessoesPagas(): Set<Id> {
    return new Set([...pagamentos.values()].flatMap((p) => p.sessaoIds));
  }

  /** O que o banco confere com `check` e `foreign key` ao gravar um pagamento. */
  function exigirPagamentoCoerente(p: NovoPagamento): void {
    exigirPaciente(p.pacienteId);
    if (!Number.isInteger(p.valorCentavos) || p.valorCentavos <= 0) {
      throw new Error('O valor do pagamento precisa ser maior que zero.');
    }
    if ((p.referencia === 'mes') !== (p.mesReferencia !== null)) {
      throw new Error('O mês só vai no pagamento do mês, e ele exige o mês.');
    }
    if (p.mesReferencia !== null && !DIA_1.test(p.mesReferencia)) {
      throw new Error('O mês do pagamento tem que ser o dia 1.');
    }
    if ((p.referencia === 'avaliacao') !== (p.avaliacaoId !== null)) {
      throw new Error('A avaliação só vai no pagamento da avaliação, e ele exige a avaliação.');
    }
    if (p.avaliacaoId !== null && !avaliacoes.has(p.avaliacaoId)) {
      throw new Error(`Avaliação não encontrada: ${p.avaliacaoId}`);
    }
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
        .map(comPaciente);
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
    async listarSessoesCobradas() {
      return [...sessoes.values()]
        .filter((s) => s.valorCentavos !== null)
        .sort(porInicio)
        .map(comPaciente);
    },
    async removerSessoes(ids) {
      const apagar = new Set(ids);
      // Como o `on delete restrict` do banco: um lote com sessão paga não apaga nada.
      const pagas = sessoesPagas();
      if ([...apagar].some((id) => pagas.has(id))) throw new RecusaDoRepositorio(ERRO_SESSAO_PAGA_NAO_SAI);
      for (const id of apagar) {
        sessoes.delete(id);
        // on delete cascade: o registro vai junto com a sessão.
        registros.delete(id);
      }
      for (const s of sessoes.values()) {
        if (s.remarcadaPara !== null && apagar.has(s.remarcadaPara)) s.remarcadaPara = null;
      }
    },

    async listarPagamentos(filtro = {}) {
      return [...pagamentos.values()]
        .filter(
          (p) =>
            (filtro.pacienteId === undefined || p.pacienteId === filtro.pacienteId) &&
            (filtro.de === undefined || p.data >= filtro.de) &&
            (filtro.ate === undefined || p.data <= filtro.ate),
        )
        // Datas 'YYYY-MM-DD' ordenam como texto; o sort é estável, então na mesma data vale a ordem de criação.
        .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
        .map(copia);
    },
    async registrarPagamento(novo) {
      exigirPagamentoCoerente(novo);
      // Como no banco, as sessões só são ligadas ao pagamento de sessões.
      const sessaoIds = novo.referencia === 'sessoes' ? [...novo.sessaoIds].sort() : [];
      const pagas = sessoesPagas();
      for (const id of sessaoIds) {
        if (!sessoes.has(id)) throw new Error(`Sessão não encontrada: ${id}`);
        // Já paga, ou repetida na mesma chamada (a chave primária de pagamento_sessoes).
        if (pagas.has(id)) throw new RecusaDoRepositorio(ERRO_SESSAO_JA_PAGA);
        pagas.add(id);
      }
      // Tudo conferido: só agora grava, então a falha nunca deixa pagamento pela metade.
      return gravar(pagamentos, { ...copia(novo), id: crypto.randomUUID(), sessaoIds });
    },
    async removerPagamento(id) {
      pagamentos.delete(id);
    },

    async obterSessao(id) {
      const sessao = sessoes.get(id);
      return sessao ? comPaciente(sessao) : null;
    },
    async obterRegistro(sessaoId) {
      const registro = registros.get(sessaoId);
      return registro ? copia(registro) : null;
    },
    async salvarRegistro(sessaoId, dados) {
      if (!sessoes.has(sessaoId)) throw new Error(`Sessão não encontrada: ${sessaoId}`);
      const salvo: RegistroSessao = { ...copia(dados), sessaoId, atualizadoEm: new Date().toISOString() };
      registros.set(sessaoId, salvo);
      return copia(salvo);
    },
    async listarSessoesComRegistro(pacienteId) {
      return [...registros.keys()].filter((id) => sessoes.get(id)?.pacienteId === pacienteId).sort();
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
