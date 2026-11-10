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

/** Mensagens que as duas implementações dão quando o banco (ou a memória) recusa um pagamento. */
export const ERRO_SESSAO_JA_PAGA = 'Esta sessão já foi paga.';
export const ERRO_SESSAO_PAGA_NAO_SAI = 'Esta sessão já foi paga e não pode ser removida.';

/**
 * Recusa de uma regra dos dados (sessão já paga, sessão paga que não sai…). A mensagem já é para ela ler, em
 * português: a interface a mostra do jeito que está, em vez de um "tente de novo" (tentar de novo daria o mesmo).
 */
export class RecusaDoRepositorio extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RecusaDoRepositorio';
  }
}

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

export interface FiltroPagamentos {
  pacienteId?: Id;
  /** Data do pagamento, limite inferior incluído. */
  de?: DataISO;
  /** Data do pagamento, limite superior incluído. */
  ate?: DataISO;
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
  /** Todas as sessões com `valorCentavos` não nulo, de todos os pacientes, por início. */
  listarSessoesCobradas(): Promise<SessaoComPaciente[]>;
  /**
   * Ids que não existem são ignorados. Rejeita (sem apagar nenhuma) quando alguma das
   * sessões está ligada a um pagamento, com `RecusaDoRepositorio`: primeiro se remove o pagamento.
   */
  removerSessoes(ids: Id[]): Promise<void>;

  /** Pagamentos do filtro, por data e depois por criação. Sem filtro: todos. */
  listarPagamentos(filtro?: FiltroPagamentos): Promise<Pagamento[]>;
  /**
   * Atômico: ou grava o pagamento e as ligações com as sessões, ou não grava nada.
   * Rejeita sessão já paga com `RecusaDoRepositorio("Esta sessão já foi paga.")`. Um mês pode ter vários
   * pagamentos (o da diferença): quem confere se ainda falta algo é o serviço.
   * `sessaoIds` só vale quando `referencia` é 'sessoes'; nos outros jeitos de pagar é descartado.
   * O `sessaoIds` devolvido vem em ordem de id.
   */
  registrarPagamento(p: NovoPagamento): Promise<Pagamento>;
  /** Libera as sessões que ele quitava (ou desconta o que pagou do mês). Id que não existe não dá erro. */
  removerPagamento(id: Id): Promise<void>;

  /** A sessão com o nome do paciente e o responsável principal, ou `null` quando não existe. */
  obterSessao(id: Id): Promise<SessaoComPaciente | null>;
  /** O registro da sessão, ou `null` enquanto não houver. */
  obterRegistro(sessaoId: Id): Promise<RegistroSessao | null>;
  /**
   * Insere o registro da sessão ou substitui o que havia (um por sessão); `atualizadoEm` passa a ser agora.
   * Rejeita quando a sessão não existe.
   */
  salvarRegistro(sessaoId: Id, dados: Omit<RegistroSessao, 'sessaoId' | 'atualizadoEm'>): Promise<RegistroSessao>;
  /** Ids das sessões do paciente que já têm registro, em ordem de id. */
  listarSessoesComRegistro(pacienteId: Id): Promise<Id[]>;

  /** Em ordem de início. */
  listarBloqueios(): Promise<Bloqueio[]>;
  salvarBloqueio(b: Rascunho<Bloqueio>): Promise<Bloqueio>;
  removerBloqueio(id: Id): Promise<void>;
}
