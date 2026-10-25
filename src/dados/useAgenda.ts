import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { Bloqueio, DataISO, Id, Sessao, SituacaoSessao } from '../dominio/tipos';
import { hojeISO } from '../regras/datas';
import type { DadosAvulsa } from '../regras/formulariosAgenda';
import { bloquearPeriodo, criarAvulsa, garantirAgenda, marcarSituacao, remarcar } from '../servicos/agenda';
import { useRepositorio } from './contexto';
import { useConfiguracoes } from './useConfiguracoes';
import { CHAVE_PACIENTES } from './usePacientes';

/** As sessões dos dias de `de` a `ate` (dia local), com o nome do paciente e do responsável principal. */
export function useSessoes(de: DataISO, ate: DataISO) {
  const repositorio = useRepositorio();
  return useQuery({ queryKey: ['sessoes', de, ate], queryFn: () => repositorio.listarSessoes(de, ate) });
}

/**
 * Depois de qualquer mudança numa sessão: refaz as sessões (as da agenda e as de cada paciente, que
 * começam todas por 'sessoes') e o que depende delas (fichas e lista de pacientes: a data de entrada
 * nasce do primeiro comparecimento). Devolve a promessa para a mutação esperar os dados novos.
 *
 * As mutações de mais de uma gravação chamam isto em `onSettled`, não em `onSuccess`: se uma falha no meio,
 * a primeira já está gravada e a tela precisa mostrá-la.
 */
function useAtualizarAgenda() {
  const cliente = useQueryClient();
  return () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: ['sessoes'] }),
      cliente.invalidateQueries({ queryKey: ['ficha'] }),
      cliente.invalidateQueries({ queryKey: CHAVE_PACIENTES }),
    ]);
}

/**
 * Ao abrir a agenda, completa as próximas semanas a partir dos horários fixos (uma vez por abertura,
 * mesmo que o React rode o efeito duas vezes) e refaz as sessões na tela. Espera as configurações
 * chegarem para usar o número de semanas certo. `pronta` diz que terminou (deu certo ou não) e que as
 * sessões na tela já são as de depois da geração: contagens do dia só valem a partir daí.
 * `falhou` avisa que não deu; `tentarDeNovo` repete.
 */
export function useGarantirAgendaAoAbrir() {
  const repositorio = useRepositorio();
  const { config, carregando } = useConfiguracoes();
  const atualizar = useAtualizarAgenda();
  const jaIniciou = useRef(false);
  const { mutate, isError, isSuccess } = useMutation({
    mutationFn: (semanas: number) => garantirAgenda(repositorio, hojeISO(), semanas),
    onSettled: atualizar,
  });

  useEffect(() => {
    if (carregando || jaIniciou.current) return;
    jaIniciou.current = true;
    mutate(config.semanasGeradas);
  }, [carregando, config.semanasGeradas, mutate]);

  return { pronta: isSuccess || isError, falhou: isError, tentarDeNovo: () => mutate(config.semanasGeradas) };
}

/** Registra o que aconteceu na sessão (veja `marcarSituacao`). */
export function useMarcarSituacao() {
  const repositorio = useRepositorio();
  const atualizar = useAtualizarAgenda();
  return useMutation({
    mutationFn: (e: { sessao: Sessao; situacao: Exclude<SituacaoSessao, 'remarcada'> }) =>
      marcarSituacao(repositorio, e.sessao, e.situacao),
    onSettled: atualizar,
  });
}

/** Passa a sessão para `inicio` (instante ISO): cria a nova e marca a original como remarcada. */
export function useRemarcar() {
  const repositorio = useRepositorio();
  const atualizar = useAtualizarAgenda();
  return useMutation({
    mutationFn: (e: { sessao: Sessao; inicio: string }) => remarcar(repositorio, e.sessao, e.inicio),
    onSettled: atualizar,
  });
}

/** Muda campos de uma sessão (acompanhamento familiar, observação, confirmada). */
export function useAtualizarSessao() {
  const repositorio = useRepositorio();
  const atualizar = useAtualizarAgenda();
  return useMutation({
    mutationFn: (e: { id: Id; mudancas: Partial<Pick<Sessao, 'acompanhamentoFamiliar' | 'observacao' | 'confirmada'>> }) =>
      repositorio.atualizarSessao(e.id, e.mudancas),
    onSettled: atualizar,
  });
}

/** Sessão marcada fora do horário fixo. Devolve a sessão criada. */
export function useCriarAvulsa() {
  const repositorio = useRepositorio();
  const atualizar = useAtualizarAgenda();
  return useMutation({
    mutationFn: (dados: DadosAvulsa) => criarAvulsa(repositorio, dados),
    onSettled: atualizar,
  });
}

/** Bloqueia o período e cancela as sessões agendadas nele. Devolve quantas foram canceladas. */
export function useBloquearPeriodo() {
  const repositorio = useRepositorio();
  const atualizar = useAtualizarAgenda();
  return useMutation({
    mutationFn: (b: Omit<Bloqueio, 'id'>) => bloquearPeriodo(repositorio, b),
    onSettled: atualizar,
  });
}
