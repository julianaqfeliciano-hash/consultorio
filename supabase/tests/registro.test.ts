import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { linhaParaRegistro, registroParaLinha, type LinhaRegistro } from '../../src/dados/mapeamento.ts';
import type { RegistroSessao } from '../../src/dominio/tipos.ts';
import { comoAnonimo, comoUsuario, criarBanco, criarUsuario } from './banco.ts';

let db: PGlite;

// Cada teste ganha o seu próprio banco, já com todas as migrações aplicadas.
beforeEach(async () => {
  db = await criarBanco();
}, 60_000);

afterEach(async () => {
  await db.close();
});

/** Cria paciente e sessão como a usuária logada e devolve o id da sessão. */
async function novaSessao(): Promise<string> {
  const p = await db.query<{ id: string }>(
    `insert into pacientes (nome, tipo) values ('Ana', 'psicoterapia') returning id`,
  );
  const s = await db.query<{ id: string }>(
    `insert into sessoes (paciente_id, inicio, duracao_min, tipo, origem)
     values ($1, '2026-10-22T19:00:00Z', 50, 'psicoterapia', 'avulsa') returning id`,
    [p.rows[0].id],
  );
  return s.rows[0].id;
}

async function novoRegistro(sessaoId: string, textoFalado = 'Falou do medo.'): Promise<void> {
  await db.query(`insert into registros_sessao (sessao_id, texto_falado) values ($1, $2)`, [sessaoId, textoFalado]);
}

async function contar(): Promise<number> {
  const r = await db.query<{ n: number }>(`select count(*)::int as n from registros_sessao`);
  return r.rows[0].n;
}

describe('registros_sessao', () => {
  it('outra conta não lê nem grava o registro', async () => {
    const dona = await criarUsuario(db);
    const outra = await criarUsuario(db);
    await comoUsuario(db, dona);
    const sessao = await novaSessao();
    await novoRegistro(sessao);

    await comoUsuario(db, outra);
    expect(await contar()).toBe(0);
    // Não consegue alterar nem apagar o que não vê...
    const alterados = await db.query(`update registros_sessao set texto_falado = 'x' where sessao_id = $1`, [sessao]);
    expect(alterados.affectedRows).toBe(0);
    const apagados = await db.query(`delete from registros_sessao where sessao_id = $1`, [sessao]);
    expect(apagados.affectedRows).toBe(0);
    // ...nem gravar um registro em nome da dona (a sessão nem aparece para ela).
    await expect(
      db.query(`insert into registros_sessao (sessao_id, dono) values ($1, $2)`, [sessao, dona]),
    ).rejects.toThrow(/row-level security/);
    await expect(novoRegistro(sessao)).rejects.toThrow(/duplicate key|foreign key|row-level security/);

    await comoUsuario(db, dona);
    const intacto = await db.query<{ texto_falado: string }>(`select texto_falado from registros_sessao`);
    expect(intacto.rows).toEqual([{ texto_falado: 'Falou do medo.' }]);
  });

  it('anon não acessa registros_sessao', async () => {
    await comoUsuario(db, await criarUsuario(db));
    const sessao = await novaSessao();
    await novoRegistro(sessao);

    await comoAnonimo(db);
    await expect(db.query(`select * from registros_sessao`)).rejects.toThrow(/permission denied/);
    await expect(novoRegistro(sessao)).rejects.toThrow(/permission denied/);
  });

  it('um registro por sessão', async () => {
    await comoUsuario(db, await criarUsuario(db));
    const sessao = await novaSessao();
    await novoRegistro(sessao);
    await expect(novoRegistro(sessao)).rejects.toThrow(/duplicate key|unique/);
    expect(await contar()).toBe(1);
  });

  it('os campos começam vazios e a hora da gravação vem do banco', async () => {
    await comoUsuario(db, await criarUsuario(db));
    const sessao = await novaSessao();
    await db.query(`insert into registros_sessao (sessao_id) values ($1)`, [sessao]);
    const r = await db.query<Record<string, unknown>>(`select * from registros_sessao`);
    expect(r.rows[0]).toMatchObject({
      texto_falado: '',
      como_chegou: '',
      trabalhado: '',
      observacoes: '',
      proximos_passos: '',
    });
    expect(r.rows[0].atualizado_em).toBeInstanceOf(Date);
  });

  it('apagar a sessão apaga o registro', async () => {
    await comoUsuario(db, await criarUsuario(db));
    const sessao = await novaSessao();
    await novoRegistro(sessao);
    await db.query(`delete from sessoes where id = $1`, [sessao]);
    expect(await contar()).toBe(0);
  });

  it('não grava registro de sessão que não existe', async () => {
    await comoUsuario(db, await criarUsuario(db));
    await expect(novoRegistro('00000000-0000-0000-0000-000000000000')).rejects.toThrow(/foreign key/);
  });
});

// Pino das colunas: o que o app grava e lê tem que existir no banco migrado.
describe('mapeamento contra registros_sessao', () => {
  it('registroParaLinha entra na tabela como usuária e volta igual por linhaParaRegistro', async () => {
    await comoUsuario(db, await criarUsuario(db));
    const sessaoId = await novaSessao();
    const registro: RegistroSessao = {
      sessaoId,
      textoFalado: 'A Maria Luísa brincou de casinha.',
      comoChegou: 'Animada.',
      trabalhado: 'Brincadeira simbólica.',
      observacoes: 'Levou o desenho.',
      proximosPassos: 'Retomar o sono.',
      atualizadoEm: '2026-10-22T20:15:30.000Z',
    };

    const linha = Object.entries(registroParaLinha(registro));
    const colunas = linha.map(([c]) => `"${c}"`).join(', ');
    const marcas = linha.map((_, i) => `$${i + 1}`).join(', ');
    const r = await db.query<{ linha: LinhaRegistro }>(
      `with nova as (insert into registros_sessao (${colunas}) values (${marcas}) returning *)
       select to_jsonb(nova) as linha from nova`,
      linha.map(([, v]) => v),
    );

    expect(linhaParaRegistro(r.rows[0].linha)).toEqual(registro);
  });
});
