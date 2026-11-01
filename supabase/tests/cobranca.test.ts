import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  argumentosRegistrarPagamento,
  avaliacaoParaLinha,
  bloqueioParaLinha,
  configuracoesParaLinha,
  horarioParaLinha,
  linhaParaAvaliacao,
  linhaParaBloqueio,
  linhaParaConfiguracoes,
  linhaParaHorario,
  linhaParaPaciente,
  linhaParaPagamento,
  linhaParaParceiro,
  linhaParaResponsavel,
  linhaParaSessao,
  pacienteParaLinha,
  pagamentoParaLinha,
  parceiroParaLinha,
  responsavelParaLinha,
  sessaoParaLinha,
  type LinhaAvaliacao,
  type LinhaBloqueio,
  type LinhaConfiguracoes,
  type LinhaHorario,
  type LinhaPaciente,
  type LinhaPagamentoComSessoes,
  type LinhaParceiro,
  type LinhaResponsavel,
  type LinhaSessao,
} from '../../src/dados/mapeamento.ts';
import { CONFIGURACOES_PADRAO } from '../../src/dominio/padroes.ts';
import { comoAnonimo, comoUsuario, criarBanco, criarUsuario } from './banco.ts';

const TABELAS_NOVAS = ['pagamento_sessoes', 'pagamentos'];

let db: PGlite;

// Cada teste ganha o seu próprio banco, já com todas as migrações aplicadas.
beforeEach(async () => {
  db = await criarBanco();
}, 60_000);

afterEach(async () => {
  await db.close();
});

async function novoPaciente(nome = 'Ana'): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into pacientes (nome, tipo) values ($1, 'psicoterapia') returning id`,
    [nome],
  );
  return r.rows[0].id;
}

async function novaSessao(pacienteId: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into sessoes (paciente_id, inicio, duracao_min, tipo, origem)
     values ($1, '2026-10-06T17:00:00Z', 50, 'psicoterapia', 'avulsa') returning id`,
    [pacienteId],
  );
  return r.rows[0].id;
}

async function novaAvaliacao(pacienteId: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into avaliacoes (paciente_id, inicio, sessoes_previstas)
     values ($1, '2026-10-01', 10) returning id`,
    [pacienteId],
  );
  return r.rows[0].id;
}

async function contar(tabela: string): Promise<number> {
  const r = await db.query<{ n: number }>(`select count(*)::int as n from ${tabela}`);
  return r.rows[0].n;
}

interface Registro {
  pacienteId: string;
  referencia?: 'sessoes' | 'mes' | 'avaliacao';
  mesReferencia?: string | null;
  avaliacaoId?: string | null;
  sessaoIds?: string[];
  valorCentavos?: number;
  forma?: string;
}

interface LinhaDePagamento {
  id: string;
  dono: string;
  paciente_id: string;
  valor_centavos: number;
  forma: string;
  observacao: string | null;
  referencia: string;
  avaliacao_id: string | null;
}

/** Chama a função com os nomes de parâmetro que o app usa (rpc do supabase-js). */
async function registrar(r: Registro): Promise<LinhaDePagamento> {
  const res = await db.query<LinhaDePagamento>(
    `select * from registrar_pagamento(
       p_paciente_id => $1,
       p_data => $2,
       p_valor_centavos => $3,
       p_forma => $4,
       p_observacao => $5,
       p_referencia => $6,
       p_mes_referencia => $7,
       p_avaliacao_id => $8,
       p_sessao_ids => $9
     )`,
    [
      r.pacienteId,
      '2026-10-20',
      r.valorCentavos ?? 16000,
      r.forma ?? 'pix',
      'Pago por Pix',
      r.referencia ?? 'sessoes',
      r.mesReferencia ?? null,
      r.avaliacaoId ?? null,
      r.sessaoIds ?? [],
    ],
  );
  return res.rows[0];
}

/** Insere direto na tabela, para exercitar as regras do banco sem passar pela função. */
function inserirPagamento(
  pacienteId: string,
  campos: Partial<{
    data: string;
    valor_centavos: number;
    forma: string;
    referencia: string;
    mes_referencia: string | null;
    avaliacao_id: string | null;
  }> = {},
) {
  const c = {
    data: '2026-10-20',
    valor_centavos: 16000,
    forma: 'pix',
    referencia: 'sessoes',
    mes_referencia: null,
    avaliacao_id: null,
    ...campos,
  };
  return db.query(
    `insert into pagamentos (paciente_id, data, valor_centavos, forma, referencia, mes_referencia, avaliacao_id)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [pacienteId, c.data, c.valor_centavos, c.forma, c.referencia, c.mes_referencia, c.avaliacao_id],
  );
}

describe('acesso às tabelas da cobrança', () => {
  it('as tabelas novas têm RLS e a política dono_tudo só para authenticated', async () => {
    const tabelas = await db.query<{ tablename: string; rowsecurity: boolean }>(
      `select tablename, rowsecurity from pg_tables
       where schemaname = 'public' and tablename = any($1) order by tablename`,
      [TABELAS_NOVAS],
    );
    expect(tabelas.rows.map((l) => l.tablename).sort()).toEqual(TABELAS_NOVAS);
    for (const linha of tabelas.rows) {
      expect(linha.rowsecurity, `RLS desligado em ${linha.tablename}`).toBe(true);
    }

    const politicas = await db.query<{ tablename: string; roles: string[]; cmd: string }>(
      `select tablename, roles::text[] as roles, cmd from pg_policies
       where schemaname = 'public' and policyname = 'dono_tudo' and tablename = any($1)
       order by tablename`,
      [TABELAS_NOVAS],
    );
    expect(politicas.rows.map((l) => l.tablename).sort()).toEqual(TABELAS_NOVAS);
    for (const linha of politicas.rows) {
      expect(linha.roles).toEqual(['authenticated']);
      expect(linha.cmd).toBe('ALL');
    }
  });

  it('uma usuária não vê os pagamentos nem as ligações da outra', async () => {
    const a = await criarUsuario(db);
    const b = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    await registrar({ pacienteId: paciente, sessaoIds: [await novaSessao(paciente)] });
    expect(await contar('pagamentos')).toBe(1);
    expect(await contar('pagamento_sessoes')).toBe(1);

    await comoUsuario(db, b);
    expect(await contar('pagamentos')).toBe(0);
    expect(await contar('pagamento_sessoes')).toBe(0);
    expect((await db.query('update pagamentos set observacao = $1', ['Invadido'])).affectedRows).toBe(0);
    expect((await db.query('delete from pagamentos')).affectedRows).toBe(0);

    await comoUsuario(db, a);
    expect(await contar('pagamentos')).toBe(1);
    expect(await contar('pagamento_sessoes')).toBe(1);
  });

  it('não deixa gravar um pagamento com dono de outra pessoa', async () => {
    const a = await criarUsuario(db);
    const b = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    await expect(
      db.query(
        `insert into pagamentos (dono, paciente_id, data, valor_centavos, forma, referencia)
         values ($1, $2, '2026-10-20', 16000, 'pix', 'sessoes')`,
        [b, paciente],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it.each(TABELAS_NOVAS)('anônimo é barrado em %s (leitura e gravação)', async (tabela) => {
    await comoAnonimo(db);
    await expect(db.query(`select * from ${tabela}`)).rejects.toThrow(/permission denied/);
    await expect(db.query(`insert into ${tabela} default values`)).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.query(`delete from ${tabela}`)).rejects.toThrow(/permission denied/);
  });

  it('anônimo não executa registrar_pagamento', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    await comoAnonimo(db);
    await expect(registrar({ pacienteId: paciente })).rejects.toThrow(/permission denied/);
  });

  it('uma tabela criada depois da migração não dá acesso a anon', async () => {
    await db.exec('reset role');
    await db.exec('create table tabela_de_teste (id int)');
    const r = await db.query<{ ler: boolean; qualquer: boolean }>(
      `select
         has_table_privilege('anon', 'tabela_de_teste', 'select') as ler,
         has_table_privilege(
           'anon', 'tabela_de_teste',
           'select, insert, update, delete, truncate, references, trigger'
         ) as qualquer`,
    );
    expect(r.rows[0]).toEqual({ ler: false, qualquer: false });

    await comoAnonimo(db);
    await expect(db.query('select * from tabela_de_teste')).rejects.toThrow(/permission denied/);
  });
});

describe('registrar_pagamento', () => {
  it('é executada com os direitos de quem chama (security invoker), só por authenticated', async () => {
    const r = await db.query<{ prosecdef: boolean; anon: boolean; authenticated: boolean }>(
      `select p.prosecdef,
              has_function_privilege('anon', p.oid, 'execute') as anon,
              has_function_privilege('authenticated', p.oid, 'execute') as authenticated
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'registrar_pagamento'`,
    );
    expect(r.rows).toEqual([{ prosecdef: false, anon: false, authenticated: true }]);
  });

  it('com 2 sessões cria 1 pagamento e 2 ligações', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    const s1 = await novaSessao(paciente);
    const s2 = await novaSessao(paciente);

    const pagamento = await registrar({
      pacienteId: paciente,
      valorCentavos: 32000,
      forma: 'dinheiro',
      sessaoIds: [s1, s2],
    });

    // Devolve a linha criada, já com o dono preenchido pela usuária logada.
    expect(pagamento).toMatchObject({
      dono: a,
      paciente_id: paciente,
      valor_centavos: 32000,
      forma: 'dinheiro',
      observacao: 'Pago por Pix',
      referencia: 'sessoes',
      avaliacao_id: null,
    });
    expect(await contar('pagamentos')).toBe(1);
    const ligacoes = await db.query<{ pagamento_id: string; sessao_id: string; dono: string }>(
      `select pagamento_id, sessao_id, dono from pagamento_sessoes order by sessao_id`,
    );
    expect(ligacoes.rows).toHaveLength(2);
    expect(ligacoes.rows.map((l) => l.sessao_id).sort()).toEqual([s1, s2].sort());
    for (const ligacao of ligacoes.rows) {
      expect(ligacao.pagamento_id).toBe(pagamento.id);
      expect(ligacao.dono).toBe(a);
    }
  });

  it('registra o pagamento do mês e o da avaliação, sem ligações', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    const avaliacao = await novaAvaliacao(paciente);

    const mes = await registrar({
      pacienteId: paciente,
      referencia: 'mes',
      mesReferencia: '2026-10-01',
    });
    const pacote = await registrar({
      pacienteId: paciente,
      referencia: 'avaliacao',
      avaliacaoId: avaliacao,
      valorCentavos: 81000,
    });

    expect(mes.referencia).toBe('mes');
    expect(pacote).toMatchObject({ referencia: 'avaliacao', avaliacao_id: avaliacao });
    expect(await contar('pagamentos')).toBe(2);
    expect(await contar('pagamento_sessoes')).toBe(0);
  });

  it('rejeita uma sessão que já foi paga e não deixa nada para trás (atomicidade)', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    const s1 = await novaSessao(paciente);
    const s2 = await novaSessao(paciente);
    const s3 = await novaSessao(paciente);
    await registrar({ pacienteId: paciente, sessaoIds: [s1, s2] });

    // s3 vem primeiro: se a função gravasse por partes, a ligação de s3 e o
    // pagamento ficariam no banco antes de s1 estourar a unicidade.
    await expect(registrar({ pacienteId: paciente, sessaoIds: [s3, s1] })).rejects.toThrow(
      /pagamento_sessoes_sessao_id_key/,
    );

    expect(await contar('pagamentos')).toBe(1);
    expect(await contar('pagamento_sessoes')).toBe(2);
    // s3 continua livre para ser paga depois.
    await registrar({ pacienteId: paciente, sessaoIds: [s3] });
    expect(await contar('pagamentos')).toBe(2);
  });
});

describe('regras de integridade da cobrança', () => {
  it('dois pagamentos do mesmo mês para o mesmo paciente são rejeitados', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    await registrar({ pacienteId: paciente, referencia: 'mes', mesReferencia: '2026-10-01' });

    await expect(
      registrar({ pacienteId: paciente, referencia: 'mes', mesReferencia: '2026-10-01' }),
    ).rejects.toThrow(/duplicate key|unique constraint/);
    expect(await contar('pagamentos')).toBe(1);
  });

  it('a unicidade do mês vale por paciente e só para pagamento do mês', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const ana = await novoPaciente('Ana');
    const beto = await novoPaciente('Beto');
    await registrar({ pacienteId: ana, referencia: 'mes', mesReferencia: '2026-10-01' });
    // Outro mês, outro paciente e pagamentos de sessões (sem mês) convivem.
    await registrar({ pacienteId: ana, referencia: 'mes', mesReferencia: '2026-11-01' });
    await registrar({ pacienteId: beto, referencia: 'mes', mesReferencia: '2026-10-01' });
    await registrar({ pacienteId: ana, sessaoIds: [await novaSessao(ana)] });
    await registrar({ pacienteId: ana, sessaoIds: [await novaSessao(ana)] });
    expect(await contar('pagamentos')).toBe(5);
  });

  it('pagamento do mês sem mês de referência é rejeitado', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    await expect(registrar({ pacienteId: paciente, referencia: 'mes' })).rejects.toThrow(
      /check constraint/,
    );
    expect(await contar('pagamentos')).toBe(0);
  });

  it('o mês de referência é sempre o dia 1', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    await expect(
      registrar({ pacienteId: paciente, referencia: 'mes', mesReferencia: '2026-10-15' }),
    ).rejects.toThrow(/check constraint/);
  });

  it('mês de referência e avaliação só combinam com a sua referência', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    const avaliacao = await novaAvaliacao(paciente);
    // Mês informado, mas o pagamento é de sessões.
    await expect(inserirPagamento(paciente, { mes_referencia: '2026-10-01' })).rejects.toThrow(
      /check constraint/,
    );
    // Pagamento da avaliação sem dizer qual.
    await expect(inserirPagamento(paciente, { referencia: 'avaliacao' })).rejects.toThrow(
      /check constraint/,
    );
    // Avaliação informada, mas o pagamento é de sessões.
    await expect(inserirPagamento(paciente, { avaliacao_id: avaliacao })).rejects.toThrow(
      /check constraint/,
    );
    expect(await contar('pagamentos')).toBe(0);
  });

  const pagamentosInvalidos: [string, Parameters<typeof inserirPagamento>[1]][] = [
    ['valor zero', { valor_centavos: 0 }],
    ['valor negativo', { valor_centavos: -100 }],
    ['forma desconhecida', { forma: 'fiado' }],
    ['referência desconhecida', { referencia: 'tudo' }],
  ];

  it.each(pagamentosInvalidos)('rejeita pagamento com %s', async (_descricao, campos) => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    await expect(inserirPagamento(paciente, campos)).rejects.toThrow(/check constraint/);
  });

  it('aceita todas as formas de pagamento previstas', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    for (const forma of ['pix', 'dinheiro', 'cartao', 'transferencia']) {
      await inserirPagamento(paciente, { forma });
    }
    expect(await contar('pagamentos')).toBe(4);
  });

  it('desconto em porcentagem acima de 100 é rejeitado', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    await expect(
      db.query(
        `insert into avaliacoes (paciente_id, inicio, sessoes_previstas, desconto_tipo, desconto_valor)
         values ($1, '2026-10-01', 10, 'percentual', 120)`,
        [paciente],
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it('desconto em porcentagem de até 100 e em reais acima de 100 são aceitos', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    for (const [tipo, valor] of [
      ['percentual', 100],
      ['reais', 20000],
      ['nenhum', 0],
    ] as const) {
      await db.query(
        `insert into avaliacoes (paciente_id, inicio, sessoes_previstas, desconto_tipo, desconto_valor)
         values ($1, '2026-10-01', 10, $2, $3)`,
        [paciente, tipo, valor],
      );
    }
    expect(await contar('avaliacoes')).toBe(3);
  });

  it('remover uma sessão ligada a um pagamento é rejeitado', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    const sessao = await novaSessao(paciente);
    await registrar({ pacienteId: paciente, sessaoIds: [sessao] });

    await expect(db.query('delete from sessoes where id = $1', [sessao])).rejects.toThrow(
      /violates RESTRICT setting of foreign key constraint/,
    );
    expect(await contar('sessoes')).toBe(1);
    expect(await contar('pagamento_sessoes')).toBe(1);
  });

  it('remover uma avaliação com pagamento é rejeitado', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    const avaliacao = await novaAvaliacao(paciente);
    await registrar({ pacienteId: paciente, referencia: 'avaliacao', avaliacaoId: avaliacao });

    await expect(db.query('delete from avaliacoes where id = $1', [avaliacao])).rejects.toThrow(
      /violates RESTRICT setting of foreign key constraint/,
    );
  });

  it('remover o pagamento remove as ligações e mantém as sessões', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    const pagamento = await registrar({
      pacienteId: paciente,
      sessaoIds: [await novaSessao(paciente), await novaSessao(paciente)],
    });
    expect(await contar('pagamento_sessoes')).toBe(2);

    await db.query('delete from pagamentos where id = $1', [pagamento.id]);

    expect(await contar('pagamentos')).toBe(0);
    expect(await contar('pagamento_sessoes')).toBe(0);
    expect(await contar('sessoes')).toBe(2);
  });

  it('apagar o paciente leva os pagamentos dele', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    const outro = await novoPaciente('Beto');
    await registrar({ pacienteId: paciente, referencia: 'mes', mesReferencia: '2026-10-01' });
    await registrar({ pacienteId: outro, referencia: 'mes', mesReferencia: '2026-10-01' });

    await db.query('delete from pacientes where id = $1', [paciente]);

    const { rows } = await db.query<{ paciente_id: string }>(`select paciente_id from pagamentos`);
    expect(rows).toEqual([{ paciente_id: outro }]);
  });

  it('apagar a conta em auth.users leva pagamentos e ligações da usuária', async () => {
    const a = await criarUsuario(db);
    const b = await criarUsuario(db);
    for (const usuaria of [a, b]) {
      await comoUsuario(db, usuaria);
      const paciente = await novoPaciente();
      await registrar({ pacienteId: paciente, sessaoIds: [await novaSessao(paciente)] });
      await registrar({ pacienteId: paciente, referencia: 'mes', mesReferencia: '2026-10-01' });
    }

    await db.exec('reset role');
    await db.query('delete from auth.users where id = $1', [a]);

    for (const tabela of ['pagamentos', 'pagamento_sessoes', 'sessoes', 'pacientes']) {
      const r = await db.query<{ n: number }>(
        `select count(*)::int as n from ${tabela} where dono = $1`,
        [a],
      );
      expect(r.rows[0].n, tabela).toBe(0);
    }
    // Os da outra usuária continuam lá.
    expect(await contar('pagamentos')).toBe(2);
    expect(await contar('pagamento_sessoes')).toBe(1);
  });
});

describe('colunas novas de valores', () => {
  it('têm os padrões esperados', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    await novaAvaliacao(paciente);
    await novaSessao(paciente);
    await db.query(`insert into configuracoes (mensagem_whatsapp) values ('Olá!')`);

    expect((await db.query(`select valor_avaliacao_padrao_centavos from configuracoes`)).rows).toEqual([
      { valor_avaliacao_padrao_centavos: 0 },
    ]);
    expect((await db.query(`select valor_centavos from sessoes`)).rows).toEqual([
      { valor_centavos: null },
    ]);
    expect(
      (await db.query(`select valor_previsto_centavos, desconto_tipo, desconto_valor from avaliacoes`))
        .rows,
    ).toEqual([{ valor_previsto_centavos: 0, desconto_tipo: 'nenhum', desconto_valor: 0 }]);
  });

  it('rejeitam valores negativos e tipo de desconto desconhecido', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    const sessao = await novaSessao(paciente);
    const avaliacao = await novaAvaliacao(paciente);
    await db.query(`insert into configuracoes (mensagem_whatsapp) values ('Olá!')`);

    const tentativas = [
      () => db.query(`update configuracoes set valor_avaliacao_padrao_centavos = -1`),
      () => db.query(`update sessoes set valor_centavos = -1 where id = $1`, [sessao]),
      () => db.query(`update avaliacoes set valor_previsto_centavos = -1 where id = $1`, [avaliacao]),
      () => db.query(`update avaliacoes set desconto_valor = -1 where id = $1`, [avaliacao]),
      () => db.query(`update avaliacoes set desconto_tipo = 'brinde' where id = $1`, [avaliacao]),
    ];
    for (const tentativa of tentativas) {
      await expect(tentativa()).rejects.toThrow(/check constraint/);
    }
  });
});

// ---------------------------------------------------------------------------
// Pino das colunas: o que o app grava e lê tem que existir no banco migrado
// ---------------------------------------------------------------------------
describe('mapeamento contra as tabelas migradas', () => {
  /**
   * Insere a linha produzida por um `…ParaLinha` (sem `dono`: quem preenche é o banco) e a
   * devolve do jeito que o PostgREST entrega, em JSON (datas e horas como texto).
   */
  async function inserirLinha<L>(tabela: string, linha: object): Promise<L> {
    const campos = Object.entries(linha);
    const colunas = campos.map(([coluna]) => `"${coluna}"`).join(', ');
    const marcas = campos.map((_, i) => `$${i + 1}`).join(', ');
    // jsonb (as etapas da avaliação) entra como texto JSON.
    const valores = campos.map(([, v]) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : v));
    const r = await db.query<{ linha: L }>(
      `with nova as (insert into ${tabela} (${colunas}) values (${marcas}) returning *)
       select to_jsonb(nova) as linha from nova`,
      valores,
    );
    return r.rows[0].linha;
  }

  /** O pagamento com as ligações embutidas, como `select *, pagamento_sessoes(sessao_id)` do PostgREST. */
  async function lerPagamento(id: string): Promise<LinhaPagamentoComSessoes> {
    const r = await db.query<{ linha: LinhaPagamentoComSessoes }>(
      `select to_jsonb(p) || jsonb_build_object(
                'pagamento_sessoes',
                coalesce((select jsonb_agg(jsonb_build_object('sessao_id', ps.sessao_id))
                          from pagamento_sessoes ps where ps.pagamento_id = p.id), '[]'::jsonb)
              ) as linha
       from pagamentos p where p.id = $1`,
      [id],
    );
    return r.rows[0].linha;
  }

  it('cada …ParaLinha entra na tabela migrada como usuária e volta igual pelo linhaPara… correspondente', async () => {
    await comoUsuario(db, await criarUsuario(db));

    const configuracoes = { ...CONFIGURACOES_PADRAO, valorAvaliacaoPadraoCentavos: 180000 };
    const linhaConfiguracoes = await inserirLinha<LinhaConfiguracoes>(
      'configuracoes',
      configuracoesParaLinha(configuracoes),
    );
    expect(linhaParaConfiguracoes(linhaConfiguracoes)).toEqual(configuracoes);

    const parceiro = { nome: 'Dra. Camila Rocha', profissao: 'Neuropediatra', contato: '(85) 90000-0101', observacoes: 'Encaminha' };
    const linhaParceiro = await inserirLinha<LinhaParceiro>('parceiros', parceiroParaLinha(parceiro));
    expect(linhaParaParceiro(linhaParceiro)).toEqual({ ...parceiro, id: linhaParceiro.id });

    const paciente = {
      nome: 'Pedro Henrique Lima',
      dataNascimento: '2017-03-09',
      cpf: '529.982.247-25',
      escola: 'Escola Arco-Íris',
      serie: '4º ano',
      observacoes: 'Prefere desenhar.',
      status: 'ativo' as const,
      tipo: 'avaliacao' as const,
      dataEntrada: '2026-10-14',
      dataAlta: '2026-12-16',
      parceiroId: linhaParceiro.id,
      formaCobranca: 'mensal' as const,
      valorSessaoCentavos: 20050,
    };
    const linhaPaciente = await inserirLinha<LinhaPaciente>('pacientes', pacienteParaLinha(paciente));
    expect(linhaParaPaciente(linhaPaciente)).toEqual({ ...paciente, id: linhaPaciente.id });
    const pacienteId = linhaPaciente.id;

    const responsavel = {
      pacienteId,
      nome: 'Carlos Lima',
      parentesco: 'Pai',
      cpf: '529.982.247-25',
      telefone: '(85) 90000-0002',
      email: 'carlos@exemplo.com',
      principal: true,
      pagador: true,
    };
    const linhaResponsavel = await inserirLinha<LinhaResponsavel>('responsaveis', responsavelParaLinha(responsavel));
    expect(linhaParaResponsavel(linhaResponsavel)).toEqual({ ...responsavel, id: linhaResponsavel.id });

    const horario = {
      pacienteId,
      diaSemana: 3,
      hora: '09:00',
      duracaoMin: 50,
      validoDe: '2026-10-14',
      validoAte: '2026-12-16',
    };
    const linhaHorario = await inserirLinha<LinhaHorario>('horarios_fixos', horarioParaLinha(horario));
    expect(linhaParaHorario(linhaHorario)).toEqual({ ...horario, id: linhaHorario.id });

    const avaliacao = {
      pacienteId,
      inicio: '2026-10-14',
      fim: '2026-12-16',
      sessoesPrevistas: 10,
      etapas: [
        { nome: 'Entrevista com os responsáveis', feita: true },
        { nome: 'Testes aplicados', feita: false },
      ],
      valorPrevistoCentavos: 180000,
      descontoTipo: 'percentual' as const,
      descontoValor: 10,
    };
    const linhaAvaliacao = await inserirLinha<LinhaAvaliacao>('avaliacoes', avaliacaoParaLinha(avaliacao));
    expect(linhaParaAvaliacao(linhaAvaliacao)).toEqual({ ...avaliacao, id: linhaAvaliacao.id });

    const destino = {
      pacienteId,
      inicio: '2026-10-28T12:00:00.000Z',
      duracaoMin: 50,
      tipo: 'avaliacao' as const,
      acompanhamentoFamiliar: false,
      origem: 'remarcacao' as const,
      horarioFixoId: null,
      dataOcorrencia: null,
      situacao: 'agendada' as const,
      remarcadaPara: null,
      avaliacaoId: linhaAvaliacao.id,
      confirmada: false,
      observacao: null,
      valorCentavos: null,
    };
    const linhaDestino = await inserirLinha<LinhaSessao>('sessoes', sessaoParaLinha(destino));
    expect(linhaParaSessao(linhaDestino)).toEqual({ ...destino, id: linhaDestino.id });

    const sessao = {
      ...destino,
      inicio: '2026-10-21T12:00:00.000Z',
      acompanhamentoFamiliar: true,
      origem: 'fixa' as const,
      horarioFixoId: linhaHorario.id,
      dataOcorrencia: '2026-10-21',
      situacao: 'remarcada' as const,
      remarcadaPara: linhaDestino.id,
      confirmada: true,
      observacao: 'Trazer os desenhos',
      valorCentavos: 16000,
    };
    const linhaSessao = await inserirLinha<LinhaSessao>('sessoes', sessaoParaLinha(sessao));
    expect(linhaParaSessao(linhaSessao)).toEqual({ ...sessao, id: linhaSessao.id });

    const bloqueio = { inicio: '2026-12-21', fim: '2027-01-04', motivo: 'Recesso' };
    const linhaBloqueio = await inserirLinha<LinhaBloqueio>('bloqueios', bloqueioParaLinha(bloqueio));
    expect(linhaParaBloqueio(linhaBloqueio)).toEqual({ ...bloqueio, id: linhaBloqueio.id });

    // Os três jeitos de pagar: sessões (com ligação), mês e avaliação. Sem `sessaoIds` na linha.
    const dePagamento = {
      pacienteId,
      data: '2026-10-21',
      valorCentavos: 16000,
      forma: 'pix' as const,
      observacao: 'Pago na hora',
      referencia: 'sessoes' as const,
      mesReferencia: null,
      avaliacaoId: null,
      sessaoIds: [linhaSessao.id],
    };
    const linhaPagamento = await inserirLinha<{ id: string }>('pagamentos', pagamentoParaLinha(dePagamento));
    await db.query(`insert into pagamento_sessoes (pagamento_id, sessao_id) values ($1, $2)`, [
      linhaPagamento.id,
      linhaSessao.id,
    ]);
    expect(linhaParaPagamento(await lerPagamento(linhaPagamento.id))).toEqual({ ...dePagamento, id: linhaPagamento.id });

    const doMes = { ...dePagamento, referencia: 'mes' as const, mesReferencia: '2026-10-01', observacao: null, sessaoIds: [] };
    const linhaDoMes = await inserirLinha<{ id: string }>('pagamentos', pagamentoParaLinha(doMes));
    expect(linhaParaPagamento(await lerPagamento(linhaDoMes.id))).toEqual({ ...doMes, id: linhaDoMes.id });

    const daAvaliacao = {
      ...dePagamento,
      valorCentavos: 81000,
      referencia: 'avaliacao' as const,
      avaliacaoId: linhaAvaliacao.id,
      sessaoIds: [],
    };
    const linhaDaAvaliacao = await inserirLinha<{ id: string }>('pagamentos', pagamentoParaLinha(daAvaliacao));
    expect(linhaParaPagamento(await lerPagamento(linhaDaAvaliacao.id))).toEqual({
      ...daAvaliacao,
      id: linhaDaAvaliacao.id,
    });
  });

  it('registrar_pagamento aceita exatamente os parâmetros que o app manda, nos três jeitos de pagar', async () => {
    await comoUsuario(db, await criarUsuario(db));
    const pacienteId = await novoPaciente();
    const avaliacaoId = await novaAvaliacao(pacienteId);
    const sessaoId = await novaSessao(pacienteId);
    const base = {
      pacienteId,
      data: '2026-10-21',
      valorCentavos: 16000,
      forma: 'transferencia' as const,
      observacao: null,
      mesReferencia: null,
      avaliacaoId: null,
      sessaoIds: [] as string[],
    };

    const chamar = async (p: Parameters<typeof argumentosRegistrarPagamento>[0]) => {
      const argumentos = argumentosRegistrarPagamento(p);
      const nomes = Object.keys(argumentos);
      // Parâmetros nomeados, como o PostgREST chama: o conjunto de nomes tem que ser o da função.
      const r = await db.query<{ id: string }>(
        `select * from registrar_pagamento(${nomes.map((n, i) => `${n} => $${i + 1}`).join(', ')})`,
        Object.values(argumentos),
      );
      return lerPagamento(r.rows[0].id);
    };

    const deSessoes = await chamar({ ...base, referencia: 'sessoes', sessaoIds: [sessaoId] });
    expect(linhaParaPagamento(deSessoes)).toMatchObject({ referencia: 'sessoes', sessaoIds: [sessaoId], forma: 'transferencia' });
    const doMes = await chamar({ ...base, referencia: 'mes', mesReferencia: '2026-10-01', sessaoIds: [sessaoId] });
    expect(linhaParaPagamento(doMes)).toMatchObject({ referencia: 'mes', mesReferencia: '2026-10-01', sessaoIds: [] });
    const daAvaliacao = await chamar({ ...base, referencia: 'avaliacao', avaliacaoId });
    expect(linhaParaPagamento(daAvaliacao)).toMatchObject({ referencia: 'avaliacao', avaliacaoId, sessaoIds: [] });
  });
});
