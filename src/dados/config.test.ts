import { lerConfig } from '../config';

describe('lerConfig', () => {
  it('usa o Supabase quando a URL e a chave existem', () => {
    expect(
      lerConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' }),
    ).toEqual({ modo: 'supabase', supabaseUrl: 'https://abc.supabase.co', supabaseChave: 'sb_publishable_x' });
  });

  it('cai no modo demonstração quando falta qualquer uma das duas', () => {
    expect(lerConfig({})).toEqual({ modo: 'demonstracao' });
    expect(lerConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co' })).toEqual({ modo: 'demonstracao' });
    expect(lerConfig({ VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' })).toEqual({ modo: 'demonstracao' });
  });

  it('trata valores vazios ou só com espaços como ausentes', () => {
    expect(lerConfig({ VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' })).toEqual({
      modo: 'demonstracao',
    });
    expect(lerConfig({ VITE_SUPABASE_URL: '  ', VITE_SUPABASE_PUBLISHABLE_KEY: '  ' })).toEqual({
      modo: 'demonstracao',
    });
  });
});
