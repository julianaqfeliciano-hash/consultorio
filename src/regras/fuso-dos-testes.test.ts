import { dataLocal, hojeISO } from './datas';

describe('fuso dos testes', () => {
  it('roda em Tóquio, nunca no fuso do consultório', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Asia/Tokyo');
    expect(new Date('2026-11-03T12:00:00Z').getTimezoneOffset()).toBe(-540);
  });

  it('as regras de data seguem São Paulo mesmo com o aparelho em Tóquio', () => {
    // 01:00 em Tóquio já é dia 4, mas em São Paulo ainda são 13:00 do dia 3.
    expect(dataLocal('2026-11-03T16:00:00.000Z')).toBe('2026-11-03');
    expect(hojeISO(new Date('2026-11-03T16:00:00.000Z'))).toBe('2026-11-03');
  });
});
