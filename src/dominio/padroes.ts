import type { Configuracoes } from './tipos';

/** Dados profissionais que já vêm preenchidos na primeira vez que a tela de configurações abre. */
export const DADOS_PROFISSIONAIS = {
  nomeCompleto: 'Juliana Queiroz Feliciano',
  nomeExibicao: 'Juliana Feliciano',
  titulo: 'Psicóloga Infantil',
  crp: 'CRP 11/16479',
  cpf: '',
  telefone: '(85) 98823-2033',
  email: 'julianaqfeliciano@gmail.com',
  endereco: 'Av. Washington Soares, 855 – Sala 802',
  cidade: 'Fortaleza – CE',
  instagram: '@julianaqfelicianopsi',
} as const satisfies Pick<
  Configuracoes,
  | 'nomeCompleto'
  | 'nomeExibicao'
  | 'titulo'
  | 'crp'
  | 'cpf'
  | 'telefone'
  | 'email'
  | 'endereco'
  | 'cidade'
  | 'instagram'
>;

/**
 * Mensagem do lembrete de WhatsApp (spec §5.5). Os campos entre chaves são
 * trocados na hora do envio: {responsável}, {paciente}, {dia} e {hora}.
 */
export const MENSAGEM_WHATSAPP_PADRAO =
  'Olá, {responsável}! Passando para lembrar da sessão de {paciente} amanhã, {dia}, às {hora}. Caso não possa comparecer, por favor avise com antecedência. Até amanhã!';

export const CONFIGURACOES_PADRAO: Configuracoes = {
  ...DADOS_PROFISSIONAIS,
  duracaoPadraoMin: 50,
  sessoesAvaliacaoPadrao: 10,
  mensagemWhatsapp: MENSAGEM_WHATSAPP_PADRAO,
  semanasGeradas: 4,
  bloqueioMinutos: 15,
};

/** Etapas que toda avaliação nova já traz para marcar. */
export const ETAPAS_AVALIACAO_PADRAO: readonly string[] = [
  'Entrevista com os responsáveis',
  'Testes aplicados',
  'Contato com a escola',
  'Devolutiva',
  'Laudo entregue',
];
