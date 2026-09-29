// Aplica db/migrations/*.sql em ordem, uma única vez cada (controle em schema_migrations).
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const dir = path.resolve('db/migrations');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )`);
  const { rows } = await client.query('select name from schema_migrations');
  const done = new Set(rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (done.has(file)) continue;
    console.log(`Aplicando ${file}...`);
    const sql = await readFile(path.join(dir, file), 'utf8');
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [file]);
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    }
  }
  console.log('Migrações em dia.');
} finally {
  await client.end();
}
