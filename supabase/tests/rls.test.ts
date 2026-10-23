import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { comoAnonimo, comoUsuario, criarBanco, criarUsuario } from './banco.ts';

const TABELAS = [
  'avaliacoes',
  'bloqueios',
  'configuracoes',
  'horarios_fixos',
  'pacientes',
  'parceiros',
  'responsaveis',
  'sessoes',
];

let db: PGlite;

// Cada teste ganha o seu próprio banco, já com a migração aplicada.
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

async function novoHorarioFixo(pacienteId: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into horarios_fixos (paciente_id, dia_semana, hora, duracao_min, valido_de)
     values ($1, 2, '14:00', 50, '2026-11-01') returning id`,
    [pacienteId],
  );
  return r.rows[0].id;
}

async function novaSessao(
  pacienteId: string,
  horarioFixoId: string | null = null,
  dataOcorrencia: string | null = null,
): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into sessoes (paciente_id, inicio, duracao_min, tipo, origem, horario_fixo_id, data_ocorrencia)
     values ($1, '2026-11-03T17:00:00Z', 50, 'psicoterapia', $2, $3, $4) returning id`,
    [pacienteId, horarioFixoId ? 'fixa' : 'avulsa', horarioFixoId, dataOcorrencia],
  );
  return r.rows[0].id;
}

async function contar(tabela: string): Promise<number> {
  const r = await db.query<{ n: number }>(`select count(*)::int as n from ${tabela}`);
  return r.rows[0].n;
}

describe('banco de testes', () => {
  it('cada criarBanco() devolve um banco isolado dos outros', async () => {
    const outro = await criarBanco();
    try {
      await criarUsuario(db);
      await db.query(`insert into parceiros (dono, nome) select id, 'Só aqui' from auth.users`);
      const aqui = await db.query<{ n: number }>('select count(*)::int as n from parceiros');
      const la = await outro.query<{ n: number }>('select count(*)::int as n from parceiros');
      const usuarias = await outro.query<{ n: number }>('select count(*)::int as n from auth.users');
      expect([aqui.rows[0].n, la.rows[0].n, usuarias.rows[0].n]).toEqual([1, 0, 0]);
    } finally {
      await outro.close();
    }
  });
});

describe('acesso: cada usuária só enxerga o que é dela', () => {
  it('usuária vê só os próprios pacientes', async () => {
    const a = await criarUsuario(db);
    const b = await criarUsuario(db);
    await comoUsuario(db, a);
    await db.query(`insert into pacientes (nome, tipo) values ('Ana', 'psicoterapia')`);
    await comoUsuario(db, b);
    expect((await db.query('select * from pacientes')).rows).toHaveLength(0);
    await comoUsuario(db, a);
    expect((await db.query('select * from pacientes')).rows).toHaveLength(1);
  });

  it('anônimo não lê nem grava nada', async () => {
    await comoAnonimo(db);
    await expect(db.query('select * from pacientes')).rejects.toThrow(/permission denied/);
  });

  it.each(TABELAS)('anônimo é barrado em %s (leitura e gravação)', async (tabela) => {
    await comoAnonimo(db);
    await expect(db.query(`select * from ${tabela}`)).rejects.toThrow(/permission denied/);
    await expect(db.query(`insert into ${tabela} default values`)).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.query(`delete from ${tabela}`)).rejects.toThrow(/permission denied/);
  });

  it('não deixa gravar com dono de outra pessoa', async () => {
    const a = await criarUsuario(db);
    const b = await criarUsuario(db);
    await comoUsuario(db, a);
    await expect(
      db.query(`insert into parceiros (nome, dono) values ('X', '${b}')`),
    ).rejects.toThrow(/row-level security/);
  });

  it('não deixa passar uma linha sua para o dono de outra pessoa', async () => {
    const a = await criarUsuario(db);
    const b = await criarUsuario(db);
    await comoUsuario(db, a);
    await novoPaciente();
    await expect(db.query(`update pacientes set dono = '${b}'`)).rejects.toThrow(
      /row-level security/,
    );
  });

  it('não altera nem apaga linhas de outra usuária', async () => {
    const a = await criarUsuario(db);
    const b = await criarUsuario(db);
    await comoUsuario(db, a);
    await novoPaciente('Ana');
    await comoUsuario(db, b);
    expect((await db.query(`update pacientes set nome = 'Invadida'`)).affectedRows).toBe(0);
    expect((await db.query('delete from pacientes')).affectedRows).toBe(0);
    await comoUsuario(db, a);
    const { rows } = await db.query<{ nome: string }>('select nome from pacientes');
    expect(rows).toEqual([{ nome: 'Ana' }]);
  });

  it('preenche o dono com a usuária logada', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const r = await db.query<{ dono: string }>(
      `insert into parceiros (nome) values ('Dra. Bia') returning dono`,
    );
    expect(r.rows[0].dono).toBe(a);
  });

  it('rejeita dono que não existe em auth.users', async () => {
    await comoUsuario(db, '00000000-0000-4000-8000-000000000000');
    await expect(db.query(`insert into parceiros (nome) values ('X')`)).rejects.toThrow(
      /foreign key/,
    );
  });

  it('todas as tabelas do schema public têm RLS ligado', async () => {
    const r = await db.query<{ tablename: string; rowsecurity: boolean }>(
      `select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename`,
    );
    // Garante que a checagem não é vazia: são exatamente as tabelas esperadas.
    expect(r.rows.map((l) => l.tablename)).toEqual(TABELAS);
    for (const linha of r.rows) {
      expect(linha.rowsecurity, `RLS desligado em ${linha.tablename}`).toBe(true);
    }
  });

  it('toda tabela tem a política dono_tudo só para authenticated', async () => {
    const r = await db.query<{ tablename: string; roles: string[]; cmd: string }>(
      `select tablename, roles::text[] as roles, cmd from pg_policies
       where schemaname = 'public' and policyname = 'dono_tudo' order by tablename`,
    );
    expect(r.rows.map((l) => l.tablename)).toEqual(TABELAS);
    for (const linha of r.rows) {
      expect(linha.roles).toEqual(['authenticated']);
      expect(linha.cmd).toBe('ALL');
    }
  });
});

describe('integridade dos dados', () => {
  it('mesma ocorrência de horário fixo não duplica', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    const horario = await novoHorarioFixo(paciente);
    const inserir = () =>
      db.query(
        `insert into sessoes (paciente_id, inicio, duracao_min, tipo, origem, horario_fixo_id, data_ocorrencia)
         values ($1, '2026-11-03T17:00:00Z', 50, 'psicoterapia', 'fixa', $2, '2026-11-03')
         on conflict (horario_fixo_id, data_ocorrencia) do nothing`,
        [paciente, horario],
      );
    await inserir();
    await inserir();
    expect(await contar('sessoes')).toBe(1);
  });

  it('sem "on conflict", repetir a ocorrência é rejeitado', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    const horario = await novoHorarioFixo(paciente);
    await novaSessao(paciente, horario, '2026-11-03');
    await expect(novaSessao(paciente, horario, '2026-11-03')).rejects.toThrow(
      /duplicate key|unique constraint/,
    );
  });

  it('ocorrências de datas diferentes, ou sem horário fixo, podem coexistir', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    const horario = await novoHorarioFixo(paciente);
    await novaSessao(paciente, horario, '2026-11-03');
    await novaSessao(paciente, horario, '2026-11-10');
    // Avulsas não têm horário fixo nem ocorrência: NULL não conflita com NULL.
    await novaSessao(paciente);
    await novaSessao(paciente);
    expect(await contar('sessoes')).toBe(4);
  });

  it('só um responsável principal por paciente', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const ana = await novoPaciente('Ana');
    const beto = await novoPaciente('Beto');
    const inserir = (paciente: string, nome: string, principal: boolean) =>
      db.query(`insert into responsaveis (paciente_id, nome, principal) values ($1, $2, $3)`, [
        paciente,
        nome,
        principal,
      ]);

    await inserir(ana, 'Mãe da Ana', true);
    await expect(inserir(ana, 'Pai da Ana', true)).rejects.toThrow(/duplicate key|unique/);
    // Não principais são ilimitados, e outro paciente tem o seu próprio principal.
    await inserir(ana, 'Avó da Ana', false);
    await inserir(ana, 'Tio da Ana', false);
    await inserir(beto, 'Mãe do Beto', true);
    expect(await contar('responsaveis')).toBe(4);
  });

  it('rejeita situação inválida', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    await expect(
      db.query(
        `insert into sessoes (paciente_id, inicio, duracao_min, tipo, origem, situacao)
         values ($1, '2026-11-03T17:00:00Z', 50, 'psicoterapia', 'avulsa', 'faltou')`,
        [paciente],
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it('aceita todas as situações previstas', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    const situacoes = [
      'agendada',
      'compareceu',
      'falta_com_aviso',
      'falta_sem_aviso',
      'cancelada',
      'remarcada',
    ];
    for (const situacao of situacoes) {
      await db.query(
        `insert into sessoes (paciente_id, inicio, duracao_min, tipo, origem, situacao)
         values ($1, '2026-11-03T17:00:00Z', 50, 'psicoterapia', 'avulsa', $2)`,
        [paciente, situacao],
      );
    }
    expect(await contar('sessoes')).toBe(situacoes.length);
  });

  const invalidos: [string, (paciente: string) => Promise<unknown>][] = [
    [
      'paciente com status desconhecido',
      () => db.query(`insert into pacientes (nome, tipo, status) values ('X', 'avaliacao', 'sumiu')`),
    ],
    [
      'paciente com tipo desconhecido',
      () => db.query(`insert into pacientes (nome, tipo) values ('X', 'terapia')`),
    ],
    [
      'paciente com forma de cobrança desconhecida',
      () =>
        db.query(
          `insert into pacientes (nome, tipo, forma_cobranca) values ('X', 'avaliacao', 'fiado')`,
        ),
    ],
    [
      'paciente com valor de sessão negativo',
      () =>
        db.query(
          `insert into pacientes (nome, tipo, valor_sessao_centavos) values ('X', 'avaliacao', -1)`,
        ),
    ],
    [
      'horário fixo com dia da semana 7',
      (p) =>
        db.query(
          `insert into horarios_fixos (paciente_id, dia_semana, hora, duracao_min, valido_de)
           values ($1, 7, '14:00', 50, '2026-11-01')`,
          [p],
        ),
    ],
    [
      'horário fixo com duração zero',
      (p) =>
        db.query(
          `insert into horarios_fixos (paciente_id, dia_semana, hora, duracao_min, valido_de)
           values ($1, 1, '14:00', 0, '2026-11-01')`,
          [p],
        ),
    ],
    [
      'avaliação com zero sessões previstas',
      (p) =>
        db.query(`insert into avaliacoes (paciente_id, inicio, sessoes_previstas) values ($1, '2026-11-01', 0)`, [
          p,
        ]),
    ],
    [
      'sessão com tipo desconhecido',
      (p) =>
        db.query(
          `insert into sessoes (paciente_id, inicio, duracao_min, tipo, origem)
           values ($1, '2026-11-03T17:00:00Z', 50, 'terapia', 'avulsa')`,
          [p],
        ),
    ],
    [
      'sessão com origem desconhecida',
      (p) =>
        db.query(
          `insert into sessoes (paciente_id, inicio, duracao_min, tipo, origem)
           values ($1, '2026-11-03T17:00:00Z', 50, 'psicoterapia', 'sorteio')`,
          [p],
        ),
    ],
    [
      'bloqueio que termina antes de começar',
      () =>
        db.query(
          `insert into bloqueios (inicio, fim, motivo) values ('2026-11-10', '2026-11-09', 'Férias')`,
        ),
    ],
  ];

  it.each(invalidos)('rejeita %s', async (_descricao, tentar) => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    await expect(tentar(paciente)).rejects.toThrow(/check constraint/);
  });

  it('paciente novo começa ativo, cobrado por sessão e com valor zero', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    await novoPaciente();
    const { rows } = await db.query(
      `select status, forma_cobranca, valor_sessao_centavos from pacientes`,
    );
    expect(rows).toEqual([{ status: 'ativo', forma_cobranca: 'por_sessao', valor_sessao_centavos: 0 }]);
  });

  it('sessão nova começa agendada, não confirmada e sem acompanhamento familiar', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    await novaSessao(await novoPaciente());
    const { rows } = await db.query(`select situacao, confirmada, acompanhamento_familiar from sessoes`);
    expect(rows).toEqual([{ situacao: 'agendada', confirmada: false, acompanhamento_familiar: false }]);
  });

  it('configurações têm os padrões do consultório e uma linha por usuária', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    await db.query(`insert into configuracoes (mensagem_whatsapp) values ('Olá, {nome}!')`);
    const { rows } = await db.query(
      `select duracao_padrao_min, sessoes_avaliacao_padrao, semanas_geradas, bloqueio_minutos
       from configuracoes`,
    );
    expect(rows).toEqual([
      { duracao_padrao_min: 50, sessoes_avaliacao_padrao: 10, semanas_geradas: 4, bloqueio_minutos: 15 },
    ]);
    await expect(
      db.query(`insert into configuracoes (mensagem_whatsapp) values ('Outra')`),
    ).rejects.toThrow(/duplicate key|unique/);
  });

  it('avaliação começa sem etapas', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    const r = await db.query<{ etapas: unknown }>(
      `insert into avaliacoes (paciente_id, inicio, sessoes_previstas)
       values ($1, '2026-11-01', 10) returning etapas`,
      [paciente],
    );
    expect(r.rows[0].etapas).toEqual([]);
  });
});

describe('remoções em cascata', () => {
  it('apagar o paciente leva responsáveis, horários, avaliações e sessões', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    const horario = await novoHorarioFixo(paciente);
    await novaSessao(paciente, horario, '2026-11-03');
    await db.query(`insert into responsaveis (paciente_id, nome) values ($1, 'Mãe')`, [paciente]);
    await db.query(
      `insert into avaliacoes (paciente_id, inicio, sessoes_previstas) values ($1, '2026-11-01', 10)`,
      [paciente],
    );

    await db.query('delete from pacientes where id = $1', [paciente]);

    for (const tabela of ['responsaveis', 'horarios_fixos', 'avaliacoes', 'sessoes']) {
      expect(await contar(tabela), tabela).toBe(0);
    }
  });

  it('apagar o horário fixo mantém as sessões já geradas, soltas dele', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    const horario = await novoHorarioFixo(paciente);
    await novaSessao(paciente, horario, '2026-11-03');
    await db.query('delete from horarios_fixos where id = $1', [horario]);
    const { rows } = await db.query(`select horario_fixo_id from sessoes`);
    expect(rows).toEqual([{ horario_fixo_id: null }]);
  });

  it('apagar o parceiro mantém o paciente, sem parceiro', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const parceiro = (
      await db.query<{ id: string }>(`insert into parceiros (nome) values ('Dra. Bia') returning id`)
    ).rows[0].id;
    await db.query(`insert into pacientes (nome, tipo, parceiro_id) values ('Ana', 'avaliacao', $1)`, [
      parceiro,
    ]);
    await db.query('delete from parceiros');
    const { rows } = await db.query(`select parceiro_id from pacientes`);
    expect(rows).toEqual([{ parceiro_id: null }]);
  });

  it('apagar a sessão de destino da remarcação mantém a original', async () => {
    const a = await criarUsuario(db);
    await comoUsuario(db, a);
    const paciente = await novoPaciente();
    const destino = await novaSessao(paciente);
    const original = await novaSessao(paciente);
    await db.query(`update sessoes set situacao = 'remarcada', remarcada_para = $1 where id = $2`, [
      destino,
      original,
    ]);
    await db.query('delete from sessoes where id = $1', [destino]);
    const { rows } = await db.query(`select situacao, remarcada_para from sessoes`);
    expect(rows).toEqual([{ situacao: 'remarcada', remarcada_para: null }]);
  });

  it('apagar a conta em auth.users leva todos os dados da usuária', async () => {
    const a = await criarUsuario(db);
    const b = await criarUsuario(db);
    for (const usuaria of [a, b]) {
      await comoUsuario(db, usuaria);
      const paciente = await novoPaciente();
      await novaSessao(paciente);
      await db.query(`insert into parceiros (nome) values ('Dra. Bia')`);
      await db.query(`insert into bloqueios (inicio, fim, motivo) values ('2026-12-01', '2026-12-05', 'Férias')`);
      await db.query(`insert into configuracoes (mensagem_whatsapp) values ('Olá!')`);
    }

    await db.exec('reset role');
    await db.query('delete from auth.users where id = $1', [a]);

    for (const tabela of TABELAS) {
      // Só os dados da usuária que ficou (b) permanecem: uma linha por tabela
      // que ela preencheu.
      const r = await db.query<{ n: number }>(
        `select count(*)::int as n from ${tabela} where dono = $1`,
        [a],
      );
      expect(r.rows[0].n, tabela).toBe(0);
    }
    expect(await contar('pacientes')).toBe(1);
    expect(await contar('sessoes')).toBe(1);
  });
});
