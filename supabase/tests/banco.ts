import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';

const arquivoShim = new URL('./shim.sql', import.meta.url);
const pastaMigracoes = new URL('../migrations/', import.meta.url);

function lerMigracoes(): string[] {
  return readdirSync(pastaMigracoes)
    .filter((nome) => nome.endsWith('.sql'))
    .sort()
    .map((nome) => readFileSync(new URL(nome, pastaMigracoes), 'utf8'));
}

// Subir o PGlite do zero leva ~2 s; abrir um banco a partir de um modelo já
// pronto, ~0,4 s. Por isso a migração roda uma vez só, num banco-modelo que
// nunca é entregue a ninguém, e cada criarBanco() abre uma cópia independente
// dele (os testes não compartilham nada).
async function montarModelo(): Promise<File | Blob> {
  const db = new PGlite();
  await db.exec(readFileSync(arquivoShim, 'utf8'));
  for (const sql of lerMigracoes()) {
    await db.exec(sql);
  }
  const copia = await db.dumpDataDir('none');
  await db.close();
  return copia;
}

let modelo: Promise<File | Blob> | undefined;

/** Banco novo e isolado, com o shim do Supabase e todas as migrações aplicadas. */
export async function criarBanco(): Promise<PGlite> {
  modelo ??= montarModelo();
  return PGlite.create({ loadDataDir: await modelo });
}

/** Cria uma usuária em auth.users (como superusuário) e devolve o id dela. */
export async function criarUsuario(db: PGlite): Promise<string> {
  await db.exec('reset role');
  const r = await db.query<{ id: string }>(
    'insert into auth.users (id) values (gen_random_uuid()) returning id',
  );
  return r.rows[0].id;
}

/** Passa a sessão a agir como a usuária logada `id`: o RLS passa a valer. */
export async function comoUsuario(db: PGlite, id: string): Promise<void> {
  // "reset role" antes: de anon não dá para pular direto para authenticated.
  await db.exec('reset role');
  await db.exec('set role authenticated');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [id]);
}

/** Passa a sessão a agir como visitante sem login. */
export async function comoAnonimo(db: PGlite): Promise<void> {
  await db.exec('reset role');
  await db.exec('set role anon');
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
}
