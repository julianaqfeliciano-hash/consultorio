import { describe, expect, it } from 'vitest';
import {
  FUSO,
  dataLocal,
  diaDaSemana,
  diaPorExtenso,
  entre,
  formatarData,
  hojeISO,
  horaLocal,
  inicioDaSemana,
  instanteDe,
  somarDias,
} from './datas';

describe('datas (fuso America/Sao_Paulo)', () => {
  it('usa o fuso de São Paulo', () => {
    expect(FUSO).toBe('America/Sao_Paulo');
  });

  it('instanteDe converte data e hora locais para o instante UTC', () => {
    expect(instanteDe('2026-11-03', '14:00')).toBe('2026-11-03T17:00:00.000Z');
  });

  it('dataLocal usa o dia local, não o dia UTC', () => {
    expect(dataLocal('2026-11-04T02:30:00.000Z')).toBe('2026-11-03');
  });

  it('horaLocal devolve a hora no fuso de São Paulo', () => {
    expect(horaLocal('2026-11-03T17:00:00.000Z')).toBe('14:00');
  });

  it('diaDaSemana conta 0 = domingo', () => {
    expect(diaDaSemana('2026-11-03')).toBe(2); // terça
    expect(diaDaSemana('2026-11-08')).toBe(0); // domingo
  });

  it('inicioDaSemana devolve a segunda-feira', () => {
    expect(inicioDaSemana('2026-11-08')).toBe('2026-11-02'); // domingo → segunda anterior
    expect(inicioDaSemana('2026-11-02')).toBe('2026-11-02'); // segunda → ela mesma
    expect(inicioDaSemana('2026-11-05')).toBe('2026-11-02');
  });

  it('somarDias atravessa meses e anos', () => {
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02');
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('diaPorExtenso usa o português do Brasil', () => {
    expect(diaPorExtenso('2026-11-03')).toBe('terça-feira, 03/11');
  });

  it('formatarData escreve dia/mês/ano', () => {
    expect(formatarData('2026-11-03')).toBe('03/11/2026');
    expect(formatarData('2027-01-09')).toBe('09/01/2027');
  });

  it('hojeISO usa o dia local de São Paulo', () => {
    expect(hojeISO(new Date('2026-11-04T02:30:00.000Z'))).toBe('2026-11-03');
  });

  it('entre é inclusivo nos dois limites', () => {
    expect(entre('2026-11-10', '2026-11-10', '2026-11-17')).toBe(true);
    expect(entre('2026-11-17', '2026-11-10', '2026-11-17')).toBe(true);
    expect(entre('2026-11-09', '2026-11-10', '2026-11-17')).toBe(false);
    expect(entre('2026-11-18', '2026-11-10', '2026-11-17')).toBe(false);
  });
});
