import { existsSync } from 'node:fs';
import path from 'node:path';
import { backupDatabase, DB_FILENAME, resolveDataDir } from '../server/storage.ts';

const args = process.argv.slice(2);
const demo = args.includes('--demo');
const positions = args.filter((arg) => arg !== '--demo');
try {
  if (positions.length > 1 || positions.some((arg) => arg.startsWith('--')))
    throw new Error('Uso: npm run backup -- [--demo] [caminho-do-backup.sqlite]');
  const dataDir = resolveDataDir(demo);
  const source = path.join(dataDir, DB_FILENAME);
  if (!existsSync(source))
    throw new Error('Base não encontrada. Inicie o CRM no modo escolhido antes de gerar backup.');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destination = positions[0]
    ? path.resolve(positions[0])
    : path.join(dataDir, 'backups', `crm-${demo ? 'demo-' : ''}${stamp}.sqlite`);
  const result = await backupDatabase(source, destination);
  console.log(`Backup verificado: ${result}`);
  console.log(
    'Guarde uma cópia em outro local protegido. A exportação CSV não substitui este backup.',
  );
} catch (error) {
  console.error(`Backup não concluído: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
