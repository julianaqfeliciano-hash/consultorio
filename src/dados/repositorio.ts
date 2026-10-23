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

/** Registro a salvar: sem `id` cria um novo; com `id` atualiza (ou cria com esse id). */
export type Rascunho<T extends { id: Id }> = Omit<T, 'id'> & { id?: Id };

export interface FichaPaciente {
  paciente: Paciente;
  /** O responsável principal vem primeiro. */
  responsaveis: Responsavel[];
  /** Todos os horários do paciente, inclusive os já encerrados. */
  horarios: HorarioFixo[];
  /** A avaliação mais recente (maior `inicio`), ou `null`. */
  avaliacao: Avaliacao | null;
}

export interface SessaoComPaciente extends Sessao {
  pacienteNome: string;
  responsavelPrincipal: { nome: string; telefone: string } | null;
}

/**
 * A única porta de entrada para os dados. A interface fala com este contrato;
 * por baixo há a versão em memória (demonstração e testes) e a do Supabase.
 * Toda implementação precisa passar na suíte de `repositorio.contrato.ts`.
 */
export interface Repositorio {
  obterConfiguracoes(): Promise<Configuracoes | null>;
  salvarConfiguracoes(c: Configuracoes): Promise<void>;

  /** Em ordem alfabética. */
  listarParceiros(): Promise<Parceiro[]>;
  salvarParceiro(p: Rascunho<Parceiro>): Promise<Parceiro>;
  /** Os pacientes encaminhados por ele ficam sem parceiro. */
  removerParceiro(id: Id): Promise<void>;

  /** Em ordem alfabética. */
  listarPacientes(): Promise<Paciente[]>;
  obterFicha(pacienteId: Id): Promise<FichaPaciente | null>;
  salvarPaciente(p: Rascunho<Paciente>): Promise<Paciente>;
  /** Ao salvar `principal = true`, desmarca os outros responsáveis do paciente. */
  salvarResponsavel(r: Rascunho<Responsavel>): Promise<Responsavel>;
  removerResponsavel(id: Id): Promise<void>;
  salvarHorario(h: Rascunho<HorarioFixo>): Promise<HorarioFixo>;
  salvarAvaliacao(a: Rascunho<Avaliacao>): Promise<Avaliacao>;

  /** Horários cuja validade cruza [de, ate] (limites incluídos), de qualquer paciente. */
  listarHorariosVigentes(de: DataISO, ate: DataISO): Promise<HorarioComPaciente[]>;
  /** Sessões cujo dia LOCAL (São Paulo) está em [de, ate], ordenadas por início. */
  listarSessoes(de: DataISO, ate: DataISO): Promise<SessaoComPaciente[]>;
  /** Todas as sessões do paciente, da mais antiga para a mais nova. */
  listarSessoesDoPaciente(pacienteId: Id): Promise<Sessao[]>;
  /** Ignora conflito de (horarioFixoId, dataOcorrencia); devolve quantas entraram. */
  inserirOcorrencias(novas: NovaSessao[]): Promise<number>;
  /** Recusa (rejeita) uma segunda sessão para a mesma ocorrência de horário fixo. */
  criarSessao(nova: NovaSessao): Promise<Sessao>;
  /** Rejeita quando a sessão não existe. */
  atualizarSessao(id: Id, mudancas: Partial<Omit<Sessao, 'id' | 'pacienteId'>>): Promise<Sessao>;
  /** Ids que não existem são ignorados. */
  removerSessoes(ids: Id[]): Promise<void>;

  /** Em ordem de início. */
  listarBloqueios(): Promise<Bloqueio[]>;
  salvarBloqueio(b: Rascunho<Bloqueio>): Promise<Bloqueio>;
  removerBloqueio(id: Id): Promise<void>;
}
