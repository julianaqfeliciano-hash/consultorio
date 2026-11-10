// @vitest-environment jsdom
import { apagarRascunho, apagarTodosOsRascunhos, guardarRascunho, lerRascunho } from './rascunhos';

const CAMPOS = { comoChegou: 'a', trabalhado: 'b', observacoes: 'c', proximosPassos: 'd' };
const PREFIXO = 'consultorio:rascunho-registro:';

describe('rascunhos', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('guarda e lê, só com texto, campos e data', () => {
    guardarRascunho('s1', { textoFalado: 'oi', campos: CAMPOS });
    const r = lerRascunho('s1');
    expect(r).toMatchObject({ textoFalado: 'oi', campos: CAMPOS });
    expect(typeof r?.atualizadoEm).toBe('string');
    expect(Object.keys(JSON.parse(localStorage.getItem(PREFIXO + 's1')!)).sort()).toEqual([
      'atualizadoEm',
      'campos',
      'textoFalado',
    ]);
  });

  it('sem rascunho devolve null', () => {
    expect(lerRascunho('nada')).toBeNull();
  });

  it('apagar remove só aquele', () => {
    guardarRascunho('s1', { textoFalado: '1', campos: CAMPOS });
    guardarRascunho('s2', { textoFalado: '2', campos: CAMPOS });
    apagarRascunho('s1');
    expect(lerRascunho('s1')).toBeNull();
    expect(lerRascunho('s2')?.textoFalado).toBe('2');
  });

  it('apagarTodos remove só as chaves consultorio:rascunho-registro:', () => {
    guardarRascunho('s1', { textoFalado: '1', campos: CAMPOS });
    guardarRascunho('s2', { textoFalado: '2', campos: CAMPOS });
    localStorage.setItem('outra', 'fica');
    localStorage.setItem('consultorio:outra', 'fica');
    apagarTodosOsRascunhos();
    expect(lerRascunho('s1')).toBeNull();
    expect(lerRascunho('s2')).toBeNull();
    expect(localStorage.getItem('outra')).toBe('fica');
    expect(localStorage.getItem('consultorio:outra')).toBe('fica');
  });

  it('localStorage que lança não quebra (ler devolve null)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cheio');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(lerRascunho('s1')).toBeNull();
    expect(() => guardarRascunho('s1', { textoFalado: 'x', campos: CAMPOS })).not.toThrow();
    expect(() => apagarRascunho('s1')).not.toThrow();
    expect(() => apagarTodosOsRascunhos()).not.toThrow();
  });

  it('JSON corrompido devolve null', () => {
    localStorage.setItem(PREFIXO + 's1', '{não é json');
    expect(lerRascunho('s1')).toBeNull();
    localStorage.setItem(PREFIXO + 's1', JSON.stringify({ textoFalado: 1 }));
    expect(lerRascunho('s1')).toBeNull();
  });
});
