import { describe, expect, it } from 'vitest';
import { sessaoExemplo } from '../testes/fabricas';
import {
  CLASSE_FAIXA_TIPO,
  CLASSE_FUNDO_TIPO,
  COR_TIPO,
  descreverHorario,
  ICONE_SITUACAO,
  ROTULO_DIA_SEMANA,
  ROTULO_SITUACAO,
  ROTULO_TIPO,
  tipoVisual,
} from './rotulos';
import type { SituacaoSessao } from './tipos';

const SITUACOES: SituacaoSessao[] = ['agendada', 'compareceu', 'falta_com_aviso', 'falta_sem_aviso', 'cancelada', 'remarcada'];

describe('rótulos', () => {
  it('situações têm o texto exato da interface', () => {
    expect(ROTULO_SITUACAO).toEqual({
      agendada: 'Agendada',
      compareceu: 'Compareceu',
      falta_com_aviso: 'Faltou com aviso',
      falta_sem_aviso: 'Faltou sem aviso',
      cancelada: 'Cancelada',
      remarcada: 'Remarcada',
    });
  });

  it('toda situação tem um ícone (situação nunca aparece só como cor)', () => {
    for (const s of SITUACOES) expect(ICONE_SITUACAO[s]).toBeDefined();
    const icones = SITUACOES.map((s) => ICONE_SITUACAO[s]);
    expect(new Set(icones).size).toBe(SITUACOES.length);
  });

  it('tipos têm o texto exato da interface', () => {
    expect(ROTULO_TIPO).toEqual({
      avaliacao: 'Avaliação',
      psicoterapia: 'Psicoterapia',
      familiar: 'Acompanhamento familiar',
    });
  });

  it('cada tipo tem a sua cor da marca', () => {
    expect(COR_TIPO).toEqual({ avaliacao: 'amarelo', psicoterapia: 'laranja', familiar: 'azul-claro' });
  });

  it('as classes do Tailwind seguem as cores (nomes completos, para o Tailwind encontrar)', () => {
    expect(CLASSE_FUNDO_TIPO).toEqual({ avaliacao: 'bg-amarelo', psicoterapia: 'bg-laranja', familiar: 'bg-azul-claro' });
    expect(CLASSE_FAIXA_TIPO).toEqual({
      avaliacao: 'border-l-amarelo',
      psicoterapia: 'border-l-laranja',
      familiar: 'border-l-azul-claro',
    });
  });
});

describe('tipoVisual', () => {
  it('é o tipo da sessão, e "familiar" quando é acompanhamento familiar', () => {
    expect(tipoVisual(sessaoExemplo({ tipo: 'psicoterapia' }))).toBe('psicoterapia');
    expect(tipoVisual(sessaoExemplo({ tipo: 'avaliacao' }))).toBe('avaliacao');
    expect(tipoVisual(sessaoExemplo({ tipo: 'psicoterapia', acompanhamentoFamiliar: true }))).toBe('familiar');
    expect(tipoVisual(sessaoExemplo({ tipo: 'avaliacao', acompanhamentoFamiliar: true }))).toBe('familiar');
  });
});

describe('horários', () => {
  it('os dias da semana começam no domingo (0)', () => {
    expect(ROTULO_DIA_SEMANA).toEqual(['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']);
  });

  it('descreverHorario: "Terça, 14:00, 50 min"', () => {
    expect(descreverHorario({ diaSemana: 2, hora: '14:00', duracaoMin: 50 })).toBe('Terça, 14:00, 50 min');
    expect(descreverHorario({ diaSemana: 0, hora: '09:30', duracaoMin: 40 })).toBe('Domingo, 09:30, 40 min');
  });
});
