import { DatabaseSync, backup } from 'node:sqlite';
import {
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  existsSync,
  renameSync,
  statSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';

export const DB_FILENAME = 'crm.sqlite';
const LOCK_FILENAME = 'app.lock';
export function resolveDataDir(demo = false) {
  const base = process.env.CRM_DATA_DIR
    ? resolve(process.env.CRM_DATA_DIR)
    : join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'CRMFaculdade');
  return demo ? join(base, 'demo') : base;
}

function processAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}
export function acquireLock(dataDir: string) {
  mkdirSync(dataDir, { recursive: true });
  const path = join(dataDir, LOCK_FILENAME),
    nonce = randomUUID();
  if (existsSync(path)) {
    let pid: number;
    try {
      pid = JSON.parse(readFileSync(path, 'utf8')).pid;
    } catch {
      throw new Error(
        'Arquivo de bloqueio inválido. Confira se o CRM está fechado antes de remover app.lock.',
      );
    }
    if (!Number.isInteger(pid) || pid <= 0 || processAlive(pid))
      throw new Error(
        'O CRM já está aberto neste diretório. Feche o aplicativo antes de continuar.',
      );
    unlinkSync(path);
  }
  const fd = openSync(path, 'wx');
  try {
    writeFileSync(fd, JSON.stringify({ pid: process.pid, nonce }));
  } finally {
    closeSync(fd);
  }
  return () => {
    try {
      if (JSON.parse(readFileSync(path, 'utf8')).nonce === nonce) unlinkSync(path);
    } catch {}
  };
}

export function openDatabase(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path, { timeout: 5000 });
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
  const version = (db.prepare('PRAGMA user_version').get() as { user_version: number })
    .user_version;
  if (version > 1) {
    db.close();
    throw new Error('Banco criado por uma versão mais recente do CRM.');
  }
  db.exec(`BEGIN;
    CREATE TABLE IF NOT EXISTS clients(id TEXT PRIMARY KEY,payload TEXT NOT NULL CHECK(json_valid(payload)));
    CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,sku TEXT NOT NULL COLLATE NOCASE UNIQUE,payload TEXT NOT NULL CHECK(json_valid(payload)));
    CREATE TABLE IF NOT EXISTS opportunities(id TEXT PRIMARY KEY,client_id TEXT NOT NULL REFERENCES clients(id),payload TEXT NOT NULL CHECK(json_valid(payload)));
    CREATE TABLE IF NOT EXISTS activities(id TEXT PRIMARY KEY,client_id TEXT NOT NULL REFERENCES clients(id),opportunity_id TEXT REFERENCES opportunities(id),payload TEXT NOT NULL CHECK(json_valid(payload)));
    CREATE TABLE IF NOT EXISTS quotes(id TEXT PRIMARY KEY,opportunity_id TEXT NOT NULL REFERENCES opportunities(id),client_id TEXT NOT NULL REFERENCES clients(id),payload TEXT NOT NULL CHECK(json_valid(payload)));
    CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,opportunity_id TEXT NOT NULL UNIQUE REFERENCES opportunities(id),quote_id TEXT NOT NULL UNIQUE REFERENCES quotes(id),client_id TEXT NOT NULL REFERENCES clients(id),payload TEXT NOT NULL CHECK(json_valid(payload)));
    CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,payload TEXT NOT NULL CHECK(json_valid(payload)));
    CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL CHECK(json_valid(payload)));
    CREATE INDEX IF NOT EXISTS quotes_opportunity ON quotes(opportunity_id);
    CREATE INDEX IF NOT EXISTS activities_opportunity ON activities(opportunity_id);
    PRAGMA user_version=1;
    COMMIT;`);
  return db;
}

export async function backupDatabase(dbPath: string, dest: string): Promise<string> {
  if (resolve(dbPath) === resolve(dest))
    throw new Error('O backup precisa ter destino diferente do banco ativo.');
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest)) throw new Error('O arquivo de destino já existe. Escolha outro nome.');
  const db = new DatabaseSync(dbPath, { readOnly: true, timeout: 5000 });
  try {
    await backup(db, dest);
  } finally {
    db.close();
  }
  const check = new DatabaseSync(dest, { readOnly: true });
  try {
    if (check.prepare('PRAGMA integrity_check').get()?.integrity_check !== 'ok')
      throw new Error('O backup não passou na verificação de integridade.');
  } finally {
    check.close();
  }
  return dest;
}

export async function restoreDatabase(dataDir: string, source: string): Promise<void> {
  const target = join(dataDir, DB_FILENAME);
  if (resolve(source) === resolve(target))
    throw new Error('Selecione um arquivo de backup diferente do banco ativo.');
  if (!existsSync(source)) throw new Error('Backup não encontrado.');
  const release = acquireLock(dataDir),
    staged = join(dataDir, `restore-${randomUUID()}.sqlite`);
  try {
    const check = new DatabaseSync(source, { readOnly: true });
    try {
      if (check.prepare('PRAGMA integrity_check').get()?.integrity_check !== 'ok')
        throw new Error('Backup corrompido.');
      if (
        (check.prepare('PRAGMA user_version').get() as { user_version: number }).user_version !== 1
      )
        throw new Error('Versão de backup incompatível.');
      for (const table of [
        'clients',
        'products',
        'opportunities',
        'activities',
        'quotes',
        'orders',
        'events',
        'settings',
      ])
        check.prepare(`SELECT id,payload FROM ${table} LIMIT 1`).all();
      if (check.prepare('PRAGMA foreign_key_check').all().length)
        throw new Error('Backup contém referências inválidas.');
    } finally {
      check.close();
    }
    await backupDatabase(source, staged);
    if (existsSync(target)) {
      await backupDatabase(target, join(dataDir, `before-restore-${Date.now()}.sqlite`));
      // Preserve the complete original state even if replacing the file fails.
      // A previous crash can leave committed transactions in the WAL.
      const current = new DatabaseSync(target, { timeout: 5000 });
      try {
        const result = current.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
        if (Number(result?.busy) !== 0)
          throw new Error('O banco está em uso por outro processo. Feche-o antes de restaurar.');
      } finally {
        current.close();
      }
      if (existsSync(target + '-wal') && statSync(target + '-wal').size > 0)
        throw new Error('O banco possui transações pendentes. Não foi alterado.');
    }
    for (const suffix of ['-wal', '-shm'])
      if (existsSync(target + suffix)) unlinkSync(target + suffix);
    renameSync(staged, target);
  } finally {
    if (existsSync(staged)) unlinkSync(staged);
    release();
  }
}
